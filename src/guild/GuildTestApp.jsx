// src/guild/GuildTestApp.jsx
// 冒險者公會「戰鬥雛形」測試殼。入口：網址帶 ?guild（隱藏測試用）。
// 已登入 → 讀真存檔（guildProfiles/{memberId}），結算真的發獎（CAT幣/聲望/公會裝/材料/金幣）。
// 未登入（直接開 ?guild）→ 離線試玩：假 member + 起手裝，一切照跑但不寫 Firestore。
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { rollExpedition } from "./domain/rollExpedition";
import { consumeTravelSupplies, createExpeditionState, prepareExpeditionWave } from "./domain/expeditionFlow";
import {
  advanceExpeditionJourney,
  completeExpeditionJourneyBattle,
  createExpeditionJourney,
} from "./domain/expeditionGridEvents";
import { calcGuildExpeditionStats, STAT_META } from "./domain/guildStats";
import { settleExpedition } from "./domain/settleExpedition";
import { equipFromStash, normalizeGuildProfile } from "./domain/guildRewards";
import { consumeExpeditionSupplies, EXPEDITION_SUPPLY_LOAD, refundExpeditionSupplies } from "./domain/guildSupplies";
import { claimBuildingProduction, finishConstruction, startConstruction } from "./domain/guildBuildings";
import { buildCatRoster, pickPartyCats, togglePartyCat } from "./domain/guildCats";
import { subscribeMyCats } from "../lib/catDb";
import { addRoundArrows } from "../lib/db";
import { nextRankInfo } from "./domain/guildRank";
import { unlockAudio, sfxLevelUp, sfxCoinDrop, sfxOpenChest } from "../lib/sound";
import { rollDailyContracts, rollChallengeContracts, contractsStateFor, todayKey } from "./domain/guildContracts";
import {
  createGuildTeamRoom, joinGuildTeamRoomById, setGuildTeamLoadout, unreadyGuildTeamMember,
  setGuildTeamSettings,
  startGuildTeamExpedition, advanceGuildTeamJourney, submitGuildTeamShots, commitGuildTeamRound,
  markGuildTeamClaimed, leaveGuildTeamRoom, subscribeGuildTeamRoom, subscribeOpenGuildTeamRooms,
  findReconnectableGuildTeamRoom,
} from "./db/guildTeamDb";
import {
  createTeamState, prepareTeamExpeditionWave, processTeamRound, memberSettleState, scaleExpeditionForParty,
} from "./domain/teamExpeditionFlow";
import { loadGuildProfile, saveGuildProfileDebounced, flushGuildSave, grantExpeditionRewards, buyGuildShopItem, sellGuildJunk, mutateGuildEquipment } from "./db/guildDb";
import { equipDisplayName, GRADE_META } from "./data/guildEquipCatalog";
import GuildBattle from "./ui/GuildBattle";
import { fieldBg, bgLayer, rankBadge, junkArt, ArtOrEmoji, HeroArt, CatArt } from "./ui/GuildArt";
import { GuildJunkArt } from "./ui/GuildItemArt";
import GuildBoard from "./ui/GuildBoard";
import GuildContractSheet from "./ui/GuildContractSheet";
import GuildLoadout from "./ui/GuildLoadout";
import GuildTeamLobby from "./ui/GuildTeamLobby";
import GuildTeamBattle from "./ui/GuildTeamBattle";
import ExpeditionMapView from "./ui/ExpeditionMapView";
import { initialGuildTargetFace, rememberGuildTargetFace } from "./ui/guildTargetFace";
import GuildStash from "./ui/GuildStash";
import GuildShop from "./ui/GuildShop";
import GuildVault from "./ui/GuildVault";
import GuildLicense from "./ui/GuildLicense";
import GuildTerritory from "./ui/GuildTerritory";
import "./ui/guild-ui.css";
import { availablePromotionTrial, completePromotionTrial } from "./domain/guildPromotion";
import { normalizeSavedMission } from "./domain/guildMission";

const MOCK_MEMBER = { archerXP: 8000 };
// 離線試玩（未登入直接開 ?guild）才用的假貓；登入後一律用 members/{id}/cats 的真貓
const MOCK_CATS = [
  { id: "cat_a", name: "小黑（測試）", icon: "🐈‍⬛", typeLabel: "攻擊型", level: 10, atk: 28, def: 6 },
  { id: "cat_b", name: "橘子（測試）", icon: "🐈", typeLabel: "全能型", level: 8, atk: 22, def: 4 },
];

// ── 防斷線：單人遠征的本機續戰存檔（2026-07-26）───────────────────
// 組隊的戰鬥狀態本來就在 Firestore（斷線不掉），但**單人的只在 React 記憶體裡**——
// 關掉 App／手機殺背景就整趟消失，而委託又還沒結案，玩家會覺得「白打了」。
// 所以每回合結束把狀態存一份到 localStorage，回來就能從那一回合續戰。
//
// ⚠️ 為什麼不存 Firestore：一回合寫一次雲端＝純粹浪費（見 feedback：省不到的不要動）。
//    單人進度只有自己需要，本機就夠；真正需要跨裝置的是組隊，那本來就在雲端。
const RUN_KEY_VERSION = 2;
const runKey = memberId => `catarrow.guild.run.v${RUN_KEY_VERSION}.${memberId || "guest"}`;

function loadSavedRun(memberId) {
  try {
    const v = JSON.parse(localStorage.getItem(runKey(memberId)) || "null");
    if (!v?.contract || !v?.exp) return null;
    if (v.stage !== "map" && v.battle?.status !== "fighting") return null;
    if (Date.now() - (v.at || 0) > 24 * 3600 * 1000) return null; // 隔一天以上就別留了
    return normalizeSavedMission(v);
  } catch { return null; }
}
function saveRun(memberId, data) {
  try {
    localStorage.setItem(runKey(memberId), JSON.stringify(normalizeSavedMission({ at: Date.now(), ...data })));
  } catch { /* 滿了就算了 */ }
}
function clearSavedRun(memberId) {
  try { localStorage.removeItem(runKey(memberId)); } catch { /* ignore */ }
}

// 一趟遠征 = 一張委託（委託決定族群與危險度）
function newRun(contract) {
  // ⚠️ affixes/challenge 一定要傳下去，否則挑戰委託會退化成一般難度（詞綴只剩卡片上的裝飾）
  return {
    exp: rollExpedition({
      id: contract.id, danger: contract.danger, family: contract.family, families: contract.families,
      affixes: contract.affixes || [], challenge: contract.challenge || null,
    }),
    key: Date.now(),
  };
}

export default function GuildTestApp({ onBack, onLegacy, onImmersiveChange }) {
  const { profile, loading } = useAuth();
  const memberId = profile?.id || null;
  const member = profile || MOCK_MEMBER;

  const [gp, setGp] = useState(null);            // 公會存檔（null = 載入中）
  const [contract, setContract] = useState(null); // 目前接下的委託
  const [run, setRun] = useState(null);
  const [result, setResult] = useState(null);
  const [loot, setLoot] = useState(null);        // 只 roll 一次：顯示與入帳同一份
  const [grantMsg, setGrantMsg] = useState("");
  const [phase, setPhase] = useState("board");   // board | loadout | battle | stash | shop | vault | license
  const [shopReturnPhase, setShopReturnPhase] = useState("board");
  const [supplies, setSupplies] = useState({ food: 6, water: 6 });
  const [supplyLoad, setSupplyLoad] = useState({ ...EXPEDITION_SUPPLY_LOAD });
  const [soloTargetFormat, setSoloTargetFormat] = useState(initialGuildTargetFace);
  const [catRoster, setCatRoster] = useState(MOCK_CATS);
  const [rankUp, setRankUp] = useState(null);    // 這趟升階了 → 顯示橫幅
  const [sheet, setSheet] = useState(null);      // 正在看詳情的委託（點小卡才開）
  const grantedRef = useRef(null);               // 一趟只請領一次
  // ── 組隊遠征 ──────────────────────────────────────────────
  const [teamRoomId, setTeamRoomId] = useState(null);
  const [teamRoom, setTeamRoom] = useState(null);
  const [teamBusy, setTeamBusy] = useState(false);
  const [openTeamRooms, setOpenTeamRooms] = useState([]);   // 正在招人的隊伍（取代房號）
  const [resumeState, setResumeState] = useState(null);    // 單人續戰用的戰鬥狀態
  const [journey, setJourney] = useState(null);            // 單人地圖目前所在節點
  const [savedRun, setSavedRun] = useState(null);          // 本機找到的未完成遠征（顯示續戰橫幅）
  const [teamResume, setTeamResume] = useState(null);      // 雲端找到的未完成組隊
  const teamCommitRef = useRef(0);               // 房主推進的防重複（同一 seq 只推一次）
  const immersiveBattle = phase === "battle" || phase === "defense" || phase === "teamBattle";

  // Web Audio 需要使用者手勢才能出聲；進公會就先解鎖，第一個音效才不會被吃掉
  useEffect(() => { unlockAudio(); }, []);
  useEffect(() => {
    onImmersiveChange?.(immersiveBattle);
  }, [immersiveBattle, onImmersiveChange]);
  useEffect(() => () => onImmersiveChange?.(false), [onImmersiveChange]);

  // ── 防斷線：進公會就掃「有沒有沒打完的」──────────────────────
  // 單人 → 本機 localStorage；組隊 → 雲端房間（狀態本來就在那，只是沒人去找回來）
  useEffect(() => {
    if (loading) return;
    setSavedRun(loadSavedRun(memberId));
    if (!memberId) { setTeamResume(null); return; }
    let alive = true;
    findReconnectableGuildTeamRoom(memberId).then(res => {
      if (alive) setTeamResume(res.room || null);
    });
    return () => { alive = false; };
  }, [memberId, loading]);

  // 每日委託：同一天同一個人固定同一批（重整不會換，見 guildContracts）
  const dateKey = todayKey();
  const dailyContracts = useMemo(() => rollDailyContracts({ dateKey, memberId: memberId || "guest" }), [dateKey, memberId]);
  // 挑戰委託：每階精銳＋危殆各一張，另開分頁（同日同人固定，重整不能洗）
  const challengeContracts = useMemo(() => rollChallengeContracts({ dateKey, memberId: memberId || "guest" }), [dateKey, memberId]);

  // 載入存檔（auth 還在解析時先不載，免得用離線存檔覆蓋真存檔）
  useEffect(() => {
    if (loading) return;
    let alive = true;
    loadGuildProfile(memberId).then(p => { if (alive) setGp(p); });
    return () => { alive = false; };
  }, [memberId, loading]);

  // 真貓（members/{id}/cats）：等級/羈絆/裝備沿用主線養成，公會只讀不寫
  useEffect(() => {
    if (!memberId) { setCatRoster(MOCK_CATS); return; }
    return subscribeMyCats(memberId, cats => {
      const roster = buildCatRoster(cats);
      setCatRoster(roster);   // 沒有貓 → 空陣列，備包不顯示貓區塊、戰鬥就沒助攻
    });
  }, [memberId]);

  // 結算入帳：settleExpedition 有隨機性，只能 roll 這一次
  useEffect(() => {
    if (!result || !gp || !run || grantedRef.current === run.key) return;
    grantedRef.current = run.key;
    const rolled = result.status === "won" ? settleExpedition(result) : { won: false, materials: [], junk: [], equipDrops: [], coins: 0, catCoins: 0 };
    setLoot(rolled);
    // 組隊時委託額度**只算房主那張**（鼓勵揪人）：隊員不傳 contractId，自己的每日委託不被消耗
    const inTeam = !!teamRoom?.battle;
    const promotion = rolled.won && contract?.isPromotion ? completePromotionTrial(gp, contract.targetRankId) : null;
    const promotedProfile = promotion?.ok ? promotion.profile : gp;
    const rewardProfile = result.supplies
      ? refundExpeditionSupplies(promotedProfile, result.supplies)
      : promotedProfile;
    grantExpeditionRewards(memberId, rolled, {
      danger: contract?.danger || 1, profile: rewardProfile,
      contractId: contract?.isPromotion || (inTeam && !isTeamHost) ? undefined : contract?.id, dateKey,
    }).then(res => {
      setGp(res.profile);
      if (res.offline) setGrantMsg("（未登入：離線試玩，未存檔）");
      else if (!res.ok) setGrantMsg(`⚠️ 入帳失敗：${res.reason || "請確認 Firestore 規則已貼上"}`);
      else if (rolled.won) {
        // 自動分解／倉庫溢出都會轉成碎片（不會白掉），這裡要講清楚玩家拿到什麼
        const bits = [`✅ 已入帳　聲望 +${res.repGained}`];
        if (res.autoSalvaged) bits.push(`⚙️ 自動分解 ${res.autoSalvaged} 件`);
        if (res.overflowSalvaged) bits.push(`📦 倉庫滿，${res.overflowSalvaged} 件轉碎片`);
        if (res.shardsGained) bits.push(`🔧 +${res.shardsGained}`);
        setGrantMsg(bits.join("　"));
      }

      // 戰利品音效：金幣 → 裝備開箱 → 升階（依序錯開，才聽得出層次）
      if (rolled.won) {
        setTimeout(() => sfxCoinDrop(), 500);
        if (rolled.equipDrops.length) setTimeout(() => sfxOpenChest(), 1000);
        const before = gp.rankId;
        const after = res.profile.rankId;
        if (before !== after) {
          setRankUp(nextRankInfo(res.profile).current);
          setTimeout(() => sfxLevelUp(), 1500);
        }
      }
    });
  }, [result, gp, run, memberId, contract, dateKey]); // eslint-disable-line

  // 回委託板（一趟結束或中途放棄）
  const backToBoard = () => {
    clearSavedRun(memberId);   // 這趟結束/放棄了 → 續戰存檔作廢
    setResumeState(null);
    setTeamRoomId(null); setTeamRoom(null);   // 順手收掉房間監聽（打完的房間沒必要繼續訂閱）
    setResult(null); setLoot(null); setGrantMsg(""); setContract(null); setRun(null); setJourney(null); setRankUp(null); setPhase("board");
  };
  // 組隊：帶這張委託進等待室（開房前先記住委託，開房那步才真的寫 Firestore）
  const startTeamFrom = c => {
    setSheet(null);
    setSupplyLoad({ ...EXPEDITION_SUPPLY_LOAD });
    setContract(c); setRun(null); setResult(null); setLoot(null); setGrantMsg("");
    setTeamRoomId(null); setTeamRoom(null); setPhase("team");
  };
  // 續戰：把存檔還原成「正在戰鬥」的狀態
  const resumeSavedRun = () => {
    if (!savedRun) return;
    setContract(savedRun.contract);
    setRun({ exp: savedRun.exp, key: savedRun.key || `resume_${Date.now()}` });
    setSupplies(savedRun.stage === "map"
      ? (savedRun.supplies || { food: 6, water: 6 })
      : (savedRun.battle.supplies || { food: 6, water: 6 }));
    setResumeState(savedRun.battle || null);
    setJourney(savedRun.journey || createExpeditionJourney(savedRun.exp));
    grantedRef.current = null;
    setResult(null); setLoot(null); setGrantMsg("");
    setSavedRun(null);
    setPhase(savedRun.stage === "map" ? "map" : "battle");
  };
  const dropSavedRun = () => { clearSavedRun(memberId); setSavedRun(null); };

  // 回到未打完的組隊（狀態在房間文件裡，直接接回去）
  const resumeTeamRoom = () => {
    if (!teamResume) return;
    setTeamRoomId(teamResume.id);
    setContract(teamResume.contract || null);
    setPhase(teamResume.status === "active" ? "teamBattle" : "team");
    setTeamResume(null);
  };
  const dropTeamResume = () => {
    if (teamResume) leaveGuildTeamRoom(teamResume.id, memberId);
    setTeamResume(null);
  };

  const acceptContract = c => {
    setSheet(null);
    clearSavedRun(memberId); setResumeState(null); setSavedRun(null);   // 開新的一趟 → 舊續戰作廢
    setSupplyLoad({ ...EXPEDITION_SUPPLY_LOAD });
    setContract(c); setRun(newRun(c)); setJourney(null); setResult(null); setLoot(null); setGrantMsg(""); setPhase("loadout");
  };

  // 存檔寫入**合併**：UI 連續操作（整理倉庫、按過濾器）只寫最後一次，
  // 不是每點一下就寫一份含 120 格倉庫的文件。離開畫面/切到背景會強制落地。
  const changeProfile = next => {
    const p = normalizeGuildProfile(next);
    setGp(p);
    saveGuildProfileDebounced(memberId, p);
  };

  // 關頁、切到背景、元件卸載 → 把還沒寫的存檔補上（debounce 的代價就是要自己收尾）
  useEffect(() => {
    const flush = () => { flushGuildSave(); };
    const onHide = () => { if (document.hidden) flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, []);

  // 實際出戰的貓：存檔沒選過 → 自動帶最強的前 N 隻（新玩家不必先進設定）
  // ⚠️ 這段要放在「載入中 early return」**之前**：組隊的 handler 會用到它，
  //    放在後面會變成依賴渲染順序的 TDZ 陷阱。
  const partyCats = gp ? pickPartyCats(catRoster, gp.partyCats) : [];
  const partyCatIds = partyCats.map(c => c.id);

  // ── 組隊遠征：房間訂閱與操作 ──────────────────────────────
  useEffect(() => {
    if (!teamRoomId) { setTeamRoom(null); return; }
    return subscribeGuildTeamRoom(teamRoomId, r => {
      if (r === null) { setTeamRoomId(null); setTeamRoom(null); setPhase("board"); return; }  // 房間被解散
      setTeamRoom(r);
    });
  }, [teamRoomId]);

  // 只在「組隊大廳且還沒進隊」時訂閱招人列表——不常駐，不會變成隱形的讀取來源
  useEffect(() => {
    if (phase !== "team" || teamRoomId) { setOpenTeamRooms([]); return; }
    return subscribeOpenGuildTeamRooms(setOpenTeamRooms);
  }, [phase, teamRoomId]);

  const teamStats = useMemo(() => (gp ? calcGuildExpeditionStats(member, gp.equipped) : null), [member, gp]);
  const isTeamHost = !!teamRoom && teamRoom.hostId === memberId;

  const teamAct = async fn => {
    setTeamBusy(true);
    try { return await fn(); } finally { setTeamBusy(false); }
  };

  const teamCreate = () => teamAct(async () => {
    if (!contract) return { ok: false, reason: "先從委託板選一張委託" };
    const res = await createGuildTeamRoom({
      hostId: memberId,
      hostName: member?.nickname || member?.name || "房主",
      contract,
      targetFormat: initialGuildTargetFace(),
    });
    if (res.ok) { setTeamRoomId(res.roomId); setPhase("team"); }
    return res;
  });

  const teamJoinRoom = roomId => teamAct(async () => {
    const res = await joinGuildTeamRoomById(roomId, memberId, member?.nickname || member?.name || "隊員");
    if (res.ok) { setTeamRoomId(res.roomId); setPhase("team"); }
    return res;
  });

  // 備包完成：六維/貓/箭數直接沿用自己的存檔，只有食水是這一場現場決定的
  const teamReady = () => teamAct(async () => {
    const consumed = consumeExpeditionSupplies(gp, supplyLoad);
    if (!consumed.ok) return consumed;
    changeProfile(consumed.profile);
    const res = await setGuildTeamLoadout(teamRoomId, memberId, {
      guildStats: teamStats,
      supplies: consumed.supplies,
      suppliesReserved: true,
      cats: partyCats.map(c => ({ id: c.id, name: c.name, icon: c.icon || null, atk: c.atk, def: c.def })),
      arrowsPerRound: teamRoom?.settings?.arrowsPerRound || gp.arrowsPerRound,
      targetFormat: teamRoom?.settings?.targetFormat || "full_110",
      appearanceId: gp.appearanceId,
      name: member?.nickname || member?.name || "隊員",
    });
    if (res?.ok === false) changeProfile(refundExpeditionSupplies(consumed.profile, consumed.supplies));
    return res;
  });

  const teamUnready = () => teamAct(async () => {
    const reserved = !!teamRoom?.loadouts?.[memberId]?.suppliesReserved;
    const res = await unreadyGuildTeamMember(teamRoomId, memberId);
    const reservedSupplies = teamRoom?.loadouts?.[memberId]?.supplies;
    if (res?.ok !== false && reserved) changeProfile(refundExpeditionSupplies(gp, reservedSupplies));
    return res;
  });

  const teamDepart = () => teamAct(async () => {
    const ids = Object.keys(teamRoom?.members || {});
    // ⚠️ 箭數**全隊跟房主**（作者要求）：不然每人不同箭數 → 補給消耗與清場速度全隊不一致，
    //    「6 箭清場快但補給加倍」這個取捨會變成各玩各的，回合節奏也對不起來。
    const hostArrows = teamRoom.settings?.arrowsPerRound || teamRoom.loadouts?.[teamRoom.hostId]?.arrowsPerRound || 3;
    const roster = ids.map(id => {
      const lo = teamRoom.loadouts?.[id] || {};
      return {
        id,
        name: lo.name || teamRoom.members[id]?.name || "隊員",
        guildStats: lo.guildStats,
        supplies: lo.supplies,
        cats: lo.cats || [],
        arrowsPerRound: hostArrows,
        targetFormat: teamRoom.settings?.targetFormat || "full_110",
      };
    });
    if (roster.some(r => !r.guildStats)) return { ok: false, reason: "有人還沒備包完成" };
    // 委託 → 遠征（怪物依人數放大血量，見 partyHpScale）
    const exp = scaleExpeditionForParty(
      rollExpedition({ id: teamRoom.contract.id, danger: teamRoom.contract.danger, family: teamRoom.contract.family, families: teamRoom.contract.families,
        affixes: teamRoom.contract.affixes || [], challenge: teamRoom.contract.challenge || null }),
      roster.length,
    );
    const battle = createTeamState(exp, roster, {
      alreadyScaled: true,
      missionMode: teamRoom.contract.mode,
      targetFormat: teamRoom.settings?.targetFormat || "full_110",
    });
    // ⚠️ 不在這裡 setPhase：房主與隊員都由下面的 effect 依「房間狀態」進場，
    //    否則只有按按鈕的那個人會進去（隊員的 phase 沒人改 → 卡在等待室）。
    const teamJourney = teamRoom.contract.mode === "exploration" ? createExpeditionJourney(exp) : null;
    return startGuildTeamExpedition(teamRoomId, memberId, battle, teamJourney);
  });

  const temporarilyLeaveTeamBattle = () => {
    if (teamRoom) setTeamResume({ id: teamRoomId, ...teamRoom });
    setTeamRoomId(null);
    setTeamRoom(null);
    setPhase("board");
  };

  // 🐛 2026-07-26 修：房主點出發後**隊員沒有跟著進場**。
  // 原因：出發只有房主自己 setPhase，隊員的房間快照雖然更新了（status→active、battle 有值），
  // 但沒有任何地方改他們的 phase，所以卡在等待室。
  // 順帶修好的另外兩個致命問題（隊員專屬）：
  //   ① `run` 沒設 → 結算 effect 的 `if (!run) return` 直接擋掉 ⇒ **隊員永遠領不到獎勵**
  //   ② `contract` 沒設 → 發獎時 danger 當成 1 ⇒ 聲望算錯（掉落沒事，那個讀 expedition.danger）
  // 現在改成「以房間狀態為準」，房主與隊員走同一條路徑，只有一份邏輯要維護。
  useEffect(() => {
    if (!teamRoom) return;
    if (teamRoom.status === "active" && teamRoom.battle) {
      setContract(teamRoom.contract || null);
      // key 用房間 id：一個房間＝一趟遠征＝只結算一次（grantedRef 靠這個防重複）
      setRun(prev => (prev?.key === `team_${teamRoom.id}` ? prev : { exp: teamRoom.battle.expedition, key: `team_${teamRoom.id}` }));
      const destination = teamRoom.stage === "map" ? "teamMap" : "teamBattle";
      setPhase(p => (p === "team" || p === "teamMap" || p === "teamBattle" ? destination : p));
    }
  }, [teamRoom?.status, teamRoom?.id, teamRoom?.stage]); // eslint-disable-line

  const teamSubmit = async shots => {
    try {
      recordArrows(shots.length);                  // 公會的箭也算進今日/終身箭數
      return await submitGuildTeamShots(teamRoomId, memberId, teamRoom?.seq || 0, shots);
    } catch (e) {
      // 寧可在畫面上顯示錯誤讓玩家重按，也不要讓例外冒出去變成 uncaught
      console.warn("teamSubmit:", e);
      return { ok: false, reason: e?.message || "送出時發生錯誤" };
    }
  };
  const teamAcknowledgeEvent = () => teamAct(async () => {
    if (!isTeamHost || !teamRoom?.battle?.eventGate) return { ok: false, reason: "等待房主確認" };
    return commitGuildTeamRound(
      teamRoomId,
      memberId,
      { ...teamRoom.battle, eventGate: null, log: [] },
      (teamRoom.seq || 0) + 1,
    );
  });

  // 房主推進一回合：全員交齊（或強制）→ processTeamRound → 寫回房間
  const teamCommit = ({ force = false } = {}) => teamAct(async () => {
    const battle = teamRoom?.battle;
    const seq = teamRoom?.seq || 0;
    if (!battle || battle.status !== "fighting") return { ok: true };
    if (teamCommitRef.current === seq) return { ok: true };   // 這個 seq 已經推過了
    const shotsByMember = {};
    for (const [id, sub] of Object.entries(teamRoom.submits || {})) {
      if (sub?.seq === seq) shotsByMember[id] = sub.shots || [];
    }
    if (!force) {
      const pending = (battle.order || []).filter(id => battle.members[id]?.status === "alive" && !shotsByMember[id]);
      if (pending.length) return { ok: false, reason: "還有人沒送出" };
    }
    teamCommitRef.current = seq;
    try {
      const next = processTeamRound(battle, shotsByMember);
      const res = next.awaitingMap
        ? await advanceGuildTeamJourney(
          teamRoomId, memberId, completeExpeditionJourneyBattle(teamRoom.journey), next, "map",
        )
        : await commitGuildTeamRound(teamRoomId, memberId, next, seq + 1);
      if (!res.ok) teamCommitRef.current = 0;      // 寫失敗 → 讓它可以再試
      return res;
    } catch (e) {
      // 房主這裡一丟例外，全隊就永遠等不到下一回合 → 一定要吞下並讓它可重試
      console.warn("teamCommit:", e);
      teamCommitRef.current = 0;
      return { ok: false, reason: e?.message || "推進回合時發生錯誤" };
    }
  });

  const teamLeave = () => teamAct(async () => {
    const reserved = teamRoom?.status === "waiting" && !!teamRoom?.loadouts?.[memberId]?.suppliesReserved;
    const reservedSupplies = teamRoom?.loadouts?.[memberId]?.supplies;
    const res = await leaveGuildTeamRoom(teamRoomId, memberId);
    if (res.ok === false) return res;
    if (reserved) changeProfile(refundExpeditionSupplies(gp, reservedSupplies));
    setTeamRoomId(null); setTeamRoom(null); setPhase("board");
    return { ok: true };
  });

  // 戰鬥結束 → 把「自己那份」投影成單人形狀，走既有的結算頁與發獎路徑
  useEffect(() => {
    const battle = teamRoom?.battle;
    if (!battle || battle.status === "fighting" || !memberId) return;
    if (teamRoom.claims?.[memberId]) return;
    const mine = memberSettleState(battle, memberId);
    if (!mine) return;
    markGuildTeamClaimed(teamRoomId, memberId);
    setResult(mine);
  }, [teamRoom?.battle?.status, teamRoom?.seq]); // eslint-disable-line

  const sellJunk = async (sellMap, valuationMult) => {
    const res = await sellGuildJunk(memberId, gp, sellMap, valuationMult);
    if (res.ok) setGp(res.profile);
    return res;
  };

  // 公會遠征射出的箭 → 記進今日／終身箭數（跟主線同一條 addRoundArrows 路徑，含離線佇列）
  // ⚠️ 一定要 .catch()：這支回傳 promise，沒接的話任何失敗都會變成
  //    「Uncaught (in promise)」浮到 console，看起來像戰鬥送出爆掉。
  //    箭數同步失敗本身不該中斷戰鬥（它有 localStorage 佇列會補傳）。
  const recordArrows = n => {
    if (!memberId || !n) return;
    addRoundArrows(memberId, n, { accountType: profile?.accountType || "official" })
      .catch(e => console.warn("公會箭數同步失敗（已排進本機佇列，稍後補傳）:", e?.message || e));
  };

  const buy = async itemId => {
    const res = await buyGuildShopItem(memberId, gp, itemId, member?.coins || 0);
    if (res.ok) setGp(res.profile);
    return res;
  };
  const acceptPromotion = () => {
    const trial = availablePromotionTrial(gp);
    if (trial) acceptContract(trial);
  };
  const upgradeBuilding = buildingId => {
    const res = startConstruction(gp, buildingId);
    if (res.ok) changeProfile(res.profile);
    return Promise.resolve(res);
  };
  const claimProduction = () => {
    const res = claimBuildingProduction(gp);
    if (res.ok) changeProfile(res.profile);
    return Promise.resolve(res);
  };
  const finishBuilding = () => {
    const res = finishConstruction(gp);
    if (res.ok) changeProfile(res.profile);
    return Promise.resolve(res);
  };

  if (loading || !gp) {
    return <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b1220", color: "#94a3b8", fontSize: 13 }}>載入公會存檔…</div>;
  }

  const rankInfo = nextRankInfo(gp);
  const rank = rankInfo.current;

  const toggleCat = catId => changeProfile({ ...gp, partyCats: togglePartyCat(partyCatIds, catId) });

  // 續戰橫幅：組隊優先（別人也在等你），沒有才顯示單人的
  const resumeBanner = teamResume
    ? {
        label: `🤝 組隊：${teamResume.contract?.title || "遠征"}（${Object.keys(teamResume.members || {}).length} 人${teamResume.status === "active" ? "・戰鬥中" : "・等待室"}）`,
        onResume: resumeTeamRoom, onDrop: dropTeamResume,
      }
    : savedRun
      ? {
          label: savedRun.stage === "map"
            ? `🗺️ 單人：${savedRun.contract?.title || "遠征"}（路線整備中）`
            : `🏹 單人：${savedRun.contract?.title || "遠征"}（第 ${savedRun.battle?.round || 1} 回合・波 ${(savedRun.battle?.waveIndex || 0) + 1}）`,
          onResume: resumeSavedRun, onDrop: dropSavedRun,
        }
      : null;

  const doneIds = contractsStateFor(gp, dateKey).done;
  const closePanel = () => setPhase(contract ? "loadout" : "board");

  // ── 組隊遠征畫面 ──────────────────────────────────────────
  if (phase === "team") {
    return (
      <GuildTeamLobby
        room={teamRoom} openRooms={openTeamRooms} myId={memberId} isHost={isTeamHost} contract={contract}
        stats={teamStats || {}} guildEquip={gp.equipped} partyCats={partyCats}
        arrowsPerRound={teamRoom?.settings?.arrowsPerRound || gp.arrowsPerRound}
        targetFormat={teamRoom?.settings?.targetFormat || initialGuildTargetFace()}
        onChangeSettings={settings => {
          if (settings?.targetFormat) rememberGuildTargetFace(settings.targetFormat);
          return teamAct(() => setGuildTeamSettings(teamRoomId, memberId, settings));
        }}
        supplyStock={gp.supplyStock} supplyLoad={supplyLoad} onChangeSupplyLoad={setSupplyLoad}
        onNeedShop={() => { setShopReturnPhase("team"); setPhase("shop"); }}
        busy={teamBusy}
        onCreate={teamCreate} onJoinRoom={teamJoinRoom} onReady={teamReady} onUnready={teamUnready}
        onDepart={teamDepart} onLeave={teamLeave}
        onClose={() => { setTeamRoomId(null); setPhase("board"); }}
      />
    );
  }

  if (phase === "teamMap" && teamRoom?.battle && teamRoom?.journey) {
    const myBattle = teamRoom.battle.members?.[memberId] || {};
    return (
      <ExpeditionMapView
        contract={teamRoom.contract}
        expedition={teamRoom.battle.expedition}
        supplies={myBattle.supplies || { food:0, water:0 }}
        partyCats={myBattle.cats || []}
        journey={teamRoom.journey}
        event={teamRoom.journey.phase === "event"
          ? { label:"全隊停下來確認路況；閱讀完成後由房主繼續前進。" }
          : null}
        onAdvance={() => {
          if (!isTeamHost || teamBusy) return;
          teamAct(async () => {
            const nextJourney = advanceExpeditionJourney(teamRoom.journey);
            const nextBattle = nextJourney.phase === "battle"
              ? prepareTeamExpeditionWave(teamRoom.battle, nextJourney.waveIndex)
              : teamRoom.battle;
            return advanceGuildTeamJourney(
              teamRoomId, memberId, nextJourney, nextBattle,
              nextJourney.phase === "battle" ? "battle" : "map",
            );
          });
        }}
        onBack={temporarilyLeaveTeamBattle}
        isHost={isTeamHost}
        waitingLabel={!isTeamHost ? "等待房主推進全隊路線" : ""}
      />
    );
  }

  if (phase === "teamBattle" && teamRoom?.battle && !result) {
    return (
      <GuildTeamBattle
        room={teamRoom} battle={teamRoom.battle} myId={memberId} isHost={isTeamHost}
        arrowsPerRound={teamRoom.battle.members?.[memberId]?.arrowsPerRound || gp.arrowsPerRound}
        initialTargetFormat={teamRoom?.settings?.targetFormat || initialGuildTargetFace()}
          onSubmitShots={teamSubmit} onCommitRound={teamCommit}
          onAcknowledgeEvent={teamAcknowledgeEvent}
        onTemporaryLeave={temporarilyLeaveTeamBattle}
      />
    );
  }

  if (phase === "stash") {
    const mutateEquipment = async action => {
      const res = await mutateGuildEquipment(memberId, gp, action, member?.coins || 0);
      if (res.ok) setGp(res.profile);
      return res;
    };
    return <GuildStash member={member} profile={gp} onChange={changeProfile}
      onEnhance={target => mutateEquipment({ type: "enhance", target })}
      onSalvage={uid => mutateEquipment({ type: "salvage", uid })}
      onSalvageMany={uids => mutateEquipment({ type: "salvageMany", uids })}
      onClose={closePanel} />;
  }

  if (phase === "shop") {
    return <GuildShop profile={gp} memberCoins={member?.coins || 0} onBuy={buy}
      onClose={() => setPhase(shopReturnPhase)} />;
  }
  if (phase === "territory") {
    return <GuildTerritory profile={gp} onStartConstruction={upgradeBuilding}
      onFinishConstruction={finishBuilding} onClaimProduction={claimProduction}
      onClose={() => setPhase("board")} />;
  }

  if (phase === "vault") {
    return <GuildVault member={member} profile={gp} onSell={sellJunk} onClose={closePanel} />;
  }

  if (phase === "license") {
    return (
      <GuildLicense profile={gp} memberName={profile?.nickname || profile?.name}
        onChange={changeProfile} onClose={closePanel} />
    );
  }

  if (phase === "board" && !result) {
    return (
      <>
        <GuildBoard profile={gp} contracts={dailyContracts} challengeContracts={challengeContracts} doneIds={doneIds}
          onOpen={setSheet} onOpenStash={() => setPhase("stash")} onOpenShop={() => { setShopReturnPhase("board"); setPhase("shop"); }}
          onOpenTerritory={() => setPhase("territory")} onPromotion={acceptPromotion}
          onOpenVault={() => setPhase("vault")} onOpenLicense={() => setPhase("license")}
          onOpenTeam={() => { setContract(null); setTeamRoomId(null); setPhase("team"); }}
          resume={resumeBanner} onBack={onBack} onLegacy={onLegacy} />
        {sheet && (
          <GuildContractSheet contract={sheet} profile={gp} done={doneIds.includes(sheet.id)}
            onAccept={acceptContract} onTeam={startTeamFrom} onClose={() => setSheet(null)} />
        )}
      </>
    );
  }

  if (result) {
    const won = result.status === "won";
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center", ...bgLayer(fieldBg(contract?.family), { overlay: won ? "rgba(6,14,8,.74)" : "rgba(18,6,6,.8)" }), color: "#e2e8f0" }}>
        {/* 凱旋＝射手與出戰貓一起站在結算畫面上（失敗就維持骷髏，不放角色）*/}
        {won ? (
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 6 }}>
            <HeroArt size={104} style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,.7))" }} />
            {partyCats.map(c => (
              <CatArt key={c.id} catId={c.id} icon={c.icon} size={54}
                style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,.6))" }} />
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 56 }}>💀</div>
        )}
        <div style={{ fontSize: 22, fontWeight: 900, color: won ? "#fbbf24" : "#f87171" }}>{won ? "凱旋歸來！" : "遠征失敗"}</div>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>{won ? "討伐完成，戰利品如下" : result.lostReason}</div>
        {loot && won && (
          <div style={{ width: "100%", maxWidth: 340, background: "rgba(0,0,0,.35)", border: "1px solid rgba(251,191,36,.3)", borderRadius: 12, padding: 12, fontSize: 13, textAlign: "left", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: "#fbbf24", fontWeight: 900 }}>💰 {loot.coins} 金幣　🐾 {loot.catCoins} CAT幣</div>
            {loot.accuracy && (
              <div style={{ color: loot.accuracy.dropMult >= 1.2 ? "#6ee7b7" : loot.accuracy.dropMult >= 1 ? "#93c5fd" : "#fca5a5" }}>
                🎯 射擊評價 <b>{loot.accuracy.band}・{loot.accuracy.label}</b>
                （命中 {Math.round(loot.accuracy.ratio * 100)}%　掉寶 ×{loot.accuracy.dropMult.toFixed(2)}
                {loot.accuracy.extraRoll ? "　＋額外掉落判定" : ""}）
              </div>
            )}
            {/* LUK 原本完全看不見（多拿了什麼、雜貨多值多少都沒提示），玩家因此覺得沒意義 */}
            {loot.luck && (
              <div style={{ color: "#fde68a" }}>
                🍀 幸運 LUK <b>{loot.luck.luk}</b>
                （掉寶 +{loot.luck.dropBonusPct}%　雜貨售價 +{loot.luck.valuationBonusPct}%　爆擊 {loot.luck.critChancePct}%）
              </div>
            )}
            {loot.materials.length > 0 && (
              <div style={{ color: "#a7f3d0" }}>
                📦 材料：{loot.materials.map(m => `${m.name}×${m.qty}`).join("、")}
                {/* 材料改掉擴充材料後，形狀是 {id,name,qty}——不是舊的 familyTier（顯示 undefined 的原因） */}
              </div>
            )}
            {loot.junk.length > 0 && (
              <div style={{ color: "#93c5fd", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                🧺 入庫雜貨：
                {loot.junk.map((j, i) => (
                  <span key={`${j.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <GuildJunkArt junkId={j.id} size={26} />
                    <span style={{ fontSize: 11 }}>{j.name}</span>
                  </span>
                ))}
              </div>
            )}
            {/* 裝備掉落：用 equipDisplayName 顯示中文全名（含詞綴），別把 grade/archetypeId 這種內部 id 丟給玩家看 */}
            {loot.equipDrops.length > 0 && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
                <span style={{ color: "#f0abfc", fontWeight: 800 }}>⭐ 裝備掉落：</span>
                {loot.equipDrops.map((e, i) => (
                  <span key={i} style={{ fontWeight: 900, color: GRADE_META[e.grade]?.color || "#f0abfc" }}>
                    {equipDisplayName(e.archetypeId, e.grade, e)}
                  </span>
                ))}
              </div>
            )}
            {loot.materials.length === 0 && loot.junk.length === 0 && loot.equipDrops.length === 0 && <div style={{ color: "#64748b" }}>（這趟只拿到基礎報酬）</div>}
          </div>
        )}
        {grantMsg && <div style={{ fontSize: 12, color: grantMsg.startsWith("⚠️") ? "#f87171" : "#6ee7b7" }}>{grantMsg}</div>}

        {/* 升階橫幅：聲望跨過門檻的那一刻要被看見 */}
        {rankUp && (
          <>
            <style>{"@keyframes gt-rankup{0%{opacity:0;transform:scale(.7)}40%{opacity:1;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}"}</style>
            <div style={{ animation: "gt-rankup .7s ease-out", background: "rgba(0,0,0,.45)", border: `1px solid ${rankUp.color}`, borderRadius: 14, padding: "10px 18px" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800 }}>🎖️ 階級提升！</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <ArtOrEmoji sources={[rankBadge(rankUp.id)]} emoji={rankUp.icon} size={40} />
                <div style={{ fontSize: 18, fontWeight: 900, color: rankUp.color }}>{rankUp.name}</div>
              </div>
              <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 2 }}>可接 ☠️×{rankUp.maxDanger} 委託・{rankUp.shopTier} 級貨架解鎖</div>
            </div>
          </>
        )}

        {/* 階級進度：聲望的意義在這裡被看見 */}
        <div style={{ width: "100%", maxWidth: 340 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: rank.color, fontWeight: 900 }}>{rank.icon} {rank.name}</span>
            <span style={{ color: "#94a3b8" }}>🏅 {gp.rep}{rankInfo.next ? (rankInfo.trialAvailable ? `　${rankInfo.next.name}試煉已解鎖` : `　距 ${rankInfo.next.name} 還差 ${rankInfo.need}`) : "　已達頂階"}</span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,.08)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${rankInfo.progressPct}%`, background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} />
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>🐾 CAT幣 {gp.catCoins}</div>

        <button onClick={backToBoard} style={{ marginTop: 4, padding: "11px 22px", borderRadius: 10, fontWeight: 900, fontSize: 14, color: "#fff", border: "none", background: "linear-gradient(135deg,#f59e0b,#b45309)", cursor: "pointer" }}>
          📜 回委託板
        </button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={() => { setResult(null); setContract(null); setRun(null); setPhase("stash"); }} style={{ padding: "8px 14px", borderRadius: 10, fontWeight: 900, fontSize: 12, color: "#fff", border: "none", background: "#334155", cursor: "pointer" }}>🎒 倉庫</button>
          <button onClick={() => { setResult(null); setContract(null); setRun(null); setShopReturnPhase("board"); setPhase("shop"); }} style={{ padding: "8px 14px", borderRadius: 10, fontWeight: 900, fontSize: 12, color: "#fff", border: "none", background: "#4c1d95", cursor: "pointer" }}>🏪 商店</button>
        </div>
      </div>
    );
  }

  if (phase === "loadout") {
    return (
      <div>
        <div style={{ padding: "8px 12px", background: "#1a1207", color: "#fcd34d", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ color: rank.color }}>{rank.icon} {rank.name}　🐾 {gp.catCoins}　🏅 {gp.rep}{memberId ? "" : "（離線試玩）"}</span>
          <span style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => setPhase("stash")} style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: "#334155", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>🎒 倉庫</button>
            <button type="button" onClick={() => { setShopReturnPhase("loadout"); setPhase("shop"); }} style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: "#4c1d95", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>🏪 商店</button>
          </span>
        </div>
        {/* 接下的委託：出發前隨時可以放棄回委託板（還沒出發就不算結案）*/}
        <div style={{ padding: "8px 12px", background: "#0f172a", display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 800, minWidth: 0 }}>
            📜 {contract?.title}
            <span style={{ color: "#94a3b8", fontWeight: 700 }}>　{contract?.skulls} {contract?.familyIcon}{contract?.familyLabel}・{contract?.waves} 波</span>
          </span>
          <button type="button" onClick={backToBoard} style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: "#334155", color: "#cbd5e1", fontSize: 11, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>放棄</button>
        </div>
        <GuildLoadout member={member} expedition={run.exp} guildEquip={gp.equipped} profile={gp} catRoster={catRoster} partyCatIds={partyCatIds} onToggleCat={toggleCat}
          onEquip={uid => changeProfile(equipFromStash(gp, uid))}
          arrowsPerRound={gp.arrowsPerRound} onChangeArrows={n => changeProfile({ ...gp, arrowsPerRound: n })}
          appearanceId={gp.appearanceId} onChangeAppearance={appearanceId => changeProfile({ ...gp, appearanceId })}
          targetFormat={soloTargetFormat} onChangeTargetFormat={format => {
            setSoloTargetFormat(format);
            rememberGuildTargetFace(format);
          }}
          supplyLoad={supplyLoad} onChangeSupplyLoad={setSupplyLoad}
          onNeedShop={() => { setShopReturnPhase("loadout"); setPhase("shop"); }}
          onDepart={load => {
            const consumed = consumeExpeditionSupplies(gp, load);
            if (!consumed.ok) { setShopReturnPhase("loadout"); setPhase("shop"); return; }
            changeProfile(consumed.profile);
            setSupplies(consumed.supplies);
            const nextJourney = createExpeditionJourney(run.exp);
            const nextBattle = createExpeditionState(
              run.exp,
              teamStats,
              consumed.supplies,
              partyCats,
              { arrowsPerRound: gp.arrowsPerRound, targetFormat: soloTargetFormat, combatV2: true, missionMode: contract?.mode },
            );
            setJourney(nextJourney);
            setResumeState(nextBattle);
            saveRun(memberId, {
              stage: contract?.mode === "exploration" ? "map" : "battle",
              contract,
              exp: run.exp,
              supplies: consumed.supplies,
              journey: nextJourney,
              battle: nextBattle,
              key: run.key,
            });
            setPhase(contract?.mode === "exploration" ? "map" : contract?.mode === "defense" ? "defense" : "battle");
          }} />
      </div>
    );
  }

  if (phase === "map") {
    return (
      <ExpeditionMapView
        contract={contract}
        expedition={run.exp}
        supplies={supplies}
        partyCats={partyCats}
        journey={journey || createExpeditionJourney(run.exp)}
        event={resumeState?.log?.find(entry => entry.type === "travelEvent") || null}
        onAdvance={() => {
          const currentJourney = journey || createExpeditionJourney(run.exp);
          const nextJourney = advanceExpeditionJourney(currentJourney);
            let nextBattle = resumeState || createExpeditionState(
            run.exp,
            teamStats,
            supplies,
            partyCats,
              { arrowsPerRound: gp.arrowsPerRound, targetFormat: resumeState?.targetFormat || soloTargetFormat },
            );
            nextBattle = consumeTravelSupplies(nextBattle);

            if (nextJourney.phase === "event" && nextBattle.status !== "lost") {
              nextBattle = prepareExpeditionWave(nextBattle, nextJourney.waveIndex);
            }
            setSupplies(nextBattle.supplies);

          setJourney(nextJourney);
          setResumeState(nextBattle);
          saveRun(memberId, {
            stage: nextJourney.phase === "battle" ? "battle" : "map",
            contract,
            exp: run.exp,
            supplies: nextBattle.supplies,
            journey: nextJourney,
            battle: nextBattle,
            key: run.key,
          });
          if (nextBattle.status === "lost") {
            clearSavedRun(memberId);
            setResult(nextBattle);
            return;
          }
          if (nextJourney.phase === "battle") setPhase("battle");
        }}
        onAvoid={() => {
          const currentJourney = journey || createExpeditionJourney(run.exp);
          const encounterJourney = advanceExpeditionJourney(currentJourney);
          const encounterNode = encounterJourney.nodes?.[encounterJourney.nodeIndex];
          if (encounterNode?.type !== "battle") return;
          const rate = Math.round((1 - (resumeState?.derived?.supplySavePct || 0)) * 100) / 100;
          const nextBattle = {
            ...resumeState,
            supplies: {
              food: Math.max(0, Math.round((resumeState.supplies.food - rate) * 100) / 100),
              water: Math.max(0, Math.round((resumeState.supplies.water - rate) * 100) / 100),
            },
            skippedWaveIndexes: [...new Set([...(resumeState.skippedWaveIndexes || []), encounterJourney.waveIndex])],
            log: [{ type: "encounterAvoided", waveIndex: encounterJourney.waveIndex, food: -rate, water: -rate }],
          };
          const nextJourney = completeExpeditionJourneyBattle(encounterJourney);
          setSupplies(nextBattle.supplies);
          setResumeState(nextBattle);
          setJourney(nextJourney);
          saveRun(memberId, { stage: "map", contract, exp: run.exp, supplies: nextBattle.supplies, journey: nextJourney, battle: nextBattle, key: run.key });
        }}
        onBack={() => {
          changeProfile(refundExpeditionSupplies(gp, supplies));
          backToBoard();
        }}
      />
    );
  }

  // 保險：沒有委託/沒 roll 到遠征就不該在戰鬥畫面（例如放棄後的殘留狀態）
  if (!run || !contract) {
    return (
      <GuildBoard profile={gp} contracts={dailyContracts} challengeContracts={challengeContracts} doneIds={doneIds}
        onOpen={setSheet} onOpenStash={() => setPhase("stash")} onOpenShop={() => { setShopReturnPhase("board"); setPhase("shop"); }}
        onOpenTerritory={() => setPhase("territory")} onPromotion={acceptPromotion}
        onOpenVault={() => setPhase("vault")} onOpenLicense={() => setPhase("license")}
          onOpenTeam={() => { setContract(null); setTeamRoomId(null); setPhase("team"); }}
          resume={resumeBanner} onBack={onBack} onLegacy={onLegacy} />
    );
  }

  const stats = teamStats;
  return (
    <div>
      <div style={{ padding: "6px 12px", background: "#1a1207", color: "#fcd34d", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between" }}>
        <span>📜 {contract?.title || "遠征中"}　{contract?.skulls}　🏹{gp.arrowsPerRound}箭/回合</span>
        <span style={{ color: "#94a3b8" }}>
          {Object.keys(STAT_META).map(k => `${STAT_META[k].short} ${stats[k]}`).join(" · ")}
        </span>
      </div>
      <GuildBattle key={run.key} expedition={run.exp} guildStats={stats} supplies={supplies} cats={partyCats}
        appearanceId={gp.appearanceId}
        missionMode={contract?.mode || "assault"}
        targetFormat={resumeState?.targetFormat || soloTargetFormat}
        arrowsPerRound={gp.arrowsPerRound} onArrowsShot={recordArrows} onEnd={setResult}
        resumeState={resumeState}
        pauseBetweenWaves={contract?.mode === "exploration"}
        onTemporaryLeave={battle => {
          const saved = {
            stage: "battle",
            contract,
            exp: run.exp,
            journey,
            battle,
            key: run.key,
          };
          saveRun(memberId, saved);
          setSavedRun(saved);
          setResumeState(null);
          setContract(null);
          setRun(null);
          setJourney(null);
          setPhase("board");
        }}
        onWaveClear={battle => {
          const nextJourney = completeExpeditionJourneyBattle(journey);
          setJourney(nextJourney);
          setResumeState(battle);
          setSupplies(battle.supplies);
          saveRun(memberId, {
            stage: "map",
            contract,
            exp: run.exp,
            supplies: battle.supplies,
            journey: nextJourney,
            battle,
            key: run.key,
          });
          setPhase("map");
        }}
        onPersist={battle => {
          // 每回合落地一次：關掉 App 再回來能從這一回合續戰；打完就清掉
          if (battle.status === "fighting") saveRun(memberId, {
            stage: "battle",
            contract,
            exp: run.exp,
            journey,
            battle,
            key: run.key,
          });
          else clearSavedRun(memberId);
        }} />
    </div>
  );
}
