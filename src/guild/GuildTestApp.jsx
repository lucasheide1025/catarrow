// src/guild/GuildTestApp.jsx
// 冒險者公會「戰鬥雛形」測試殼。入口：網址帶 ?guild（隱藏測試用）。
// 已登入 → 讀真存檔（guildProfiles/{memberId}），結算真的發獎（CAT幣/聲望/公會裝/材料/金幣）。
// 未登入（直接開 ?guild）→ 離線試玩：假 member + 起手裝，一切照跑但不寫 Firestore。
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { rollExpedition } from "./domain/rollExpedition";
import { calcGuildExpeditionStats, STAT_META } from "./domain/guildStats";
import { settleExpedition } from "./domain/settleExpedition";
import { normalizeGuildProfile } from "./domain/guildRewards";
import { buildCatRoster, pickPartyCats, togglePartyCat } from "./domain/guildCats";
import { subscribeMyCats } from "../lib/catDb";
import { addRoundArrows } from "../lib/db";
import { nextRankInfo, repToRank } from "./domain/guildRank";
import { unlockAudio, sfxLevelUp, sfxCoinDrop, sfxOpenChest } from "../lib/sound";
import { rollDailyContracts, contractsStateFor, todayKey } from "./domain/guildContracts";
import {
  createGuildTeamRoom, joinGuildTeamRoom, setGuildTeamLoadout, unreadyGuildTeamMember,
  startGuildTeamExpedition, submitGuildTeamShots, commitGuildTeamRound,
  markGuildTeamClaimed, leaveGuildTeamRoom, subscribeGuildTeamRoom,
} from "./db/guildTeamDb";
import {
  createTeamState, processTeamRound, memberSettleState, scaleExpeditionForParty,
} from "./domain/teamExpeditionFlow";
import { loadGuildProfile, saveGuildProfileDebounced, flushGuildSave, grantExpeditionRewards, buyGuildShopItem, sellGuildJunk } from "./db/guildDb";
import { equipDisplayName, GRADE_META } from "./data/guildEquipCatalog";
import GuildBattle from "./ui/GuildBattle";
import { fieldBg, bgLayer, rankBadge, junkArt, ArtOrEmoji, HeroArt, CatArt } from "./ui/GuildArt";
import GuildBoard from "./ui/GuildBoard";
import GuildContractSheet from "./ui/GuildContractSheet";
import GuildLoadout from "./ui/GuildLoadout";
import GuildTeamLobby from "./ui/GuildTeamLobby";
import GuildTeamBattle from "./ui/GuildTeamBattle";
import GuildStash from "./ui/GuildStash";
import GuildShop from "./ui/GuildShop";
import GuildVault from "./ui/GuildVault";
import GuildLicense from "./ui/GuildLicense";

const MOCK_MEMBER = { archerXP: 8000 };
// 離線試玩（未登入直接開 ?guild）才用的假貓；登入後一律用 members/{id}/cats 的真貓
const MOCK_CATS = [
  { id: "cat_a", name: "小黑（測試）", icon: "🐈‍⬛", typeLabel: "攻擊型", level: 10, atk: 28, def: 6 },
  { id: "cat_b", name: "橘子（測試）", icon: "🐈", typeLabel: "全能型", level: 8, atk: 22, def: 4 },
];

// 一趟遠征 = 一張委託（委託決定族群與危險度）
function newRun(contract) {
  return { exp: rollExpedition({ id: contract.id, danger: contract.danger, family: contract.family }), key: Date.now() };
}

export default function GuildTestApp({ onBack, onLegacy }) {
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
  const [supplies, setSupplies] = useState({ food: 6, water: 6 });
  const [catRoster, setCatRoster] = useState(MOCK_CATS);
  const [rankUp, setRankUp] = useState(null);    // 這趟升階了 → 顯示橫幅
  const [sheet, setSheet] = useState(null);      // 正在看詳情的委託（點小卡才開）
  const grantedRef = useRef(null);               // 一趟只請領一次
  // ── 組隊遠征 ──────────────────────────────────────────────
  const [teamRoomId, setTeamRoomId] = useState(null);
  const [teamRoom, setTeamRoom] = useState(null);
  const [teamBusy, setTeamBusy] = useState(false);
  const teamCommitRef = useRef(0);               // 房主推進的防重複（同一 seq 只推一次）

  // Web Audio 需要使用者手勢才能出聲；進公會就先解鎖，第一個音效才不會被吃掉
  useEffect(() => { unlockAudio(); }, []);

  // 每日委託：同一天同一個人固定同一批（重整不會換，見 guildContracts）
  const dateKey = todayKey();
  const dailyContracts = useMemo(() => rollDailyContracts({ dateKey, memberId: memberId || "guest" }), [dateKey, memberId]);

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
    grantExpeditionRewards(memberId, rolled, {
      danger: contract?.danger || 1, profile: gp,
      contractId: contract?.id, dateKey,   // 勝敗都把這張委託結案（當天不能重刷）
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
        const before = repToRank(gp.rep).id;
        const after = repToRank(res.profile.rep).id;
        if (before !== after) {
          setRankUp(repToRank(res.profile.rep));
          setTimeout(() => sfxLevelUp(), 1500);
        }
      }
    });
  }, [result, gp, run, memberId, contract, dateKey]); // eslint-disable-line

  // 回委託板（一趟結束或中途放棄）
  const backToBoard = () => {
    setResult(null); setLoot(null); setGrantMsg(""); setContract(null); setRun(null); setRankUp(null); setPhase("board");
  };
  // 組隊：帶這張委託進等待室（開房前先記住委託，開房那步才真的寫 Firestore）
  const startTeamFrom = c => {
    setSheet(null);
    setContract(c); setRun(null); setResult(null); setLoot(null); setGrantMsg("");
    setTeamRoomId(null); setTeamRoom(null); setPhase("team");
  };
  const acceptContract = c => {
    setSheet(null);
    setContract(c); setRun(newRun(c)); setResult(null); setLoot(null); setGrantMsg(""); setPhase("loadout");
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

  const teamStats = useMemo(() => (gp ? calcGuildExpeditionStats(member, gp.equipped) : null), [member, gp]);
  const isTeamHost = !!teamRoom && teamRoom.hostId === memberId;

  const teamAct = async fn => {
    setTeamBusy(true);
    try { return await fn(); } finally { setTeamBusy(false); }
  };

  const teamCreate = () => teamAct(async () => {
    if (!contract) return { ok: false, reason: "先從委託板選一張委託" };
    const res = await createGuildTeamRoom({ hostId: memberId, hostName: member?.nickname || member?.name || "房主", contract });
    if (res.ok) { setTeamRoomId(res.roomId); setPhase("team"); }
    return res;
  });

  const teamJoin = code => teamAct(async () => {
    const res = await joinGuildTeamRoom(code, memberId, member?.nickname || member?.name || "隊員");
    if (res.ok) { setTeamRoomId(res.roomId); setPhase("team"); }
    return res;
  });

  // 備包完成：六維/貓/箭數直接沿用自己的存檔，只有食水是這一場現場決定的
  const teamReady = sup => teamAct(() => setGuildTeamLoadout(teamRoomId, memberId, {
    guildStats: teamStats,
    supplies: { food: sup.food, water: sup.water },
    cats: partyCats.map(c => ({ id: c.id, name: c.name, icon: c.icon || null, atk: c.atk, def: c.def })),
    arrowsPerRound: gp.arrowsPerRound,
    name: member?.nickname || member?.name || "隊員",
  }));

  const teamUnready = () => teamAct(() => unreadyGuildTeamMember(teamRoomId, memberId));

  const teamDepart = () => teamAct(async () => {
    const ids = Object.keys(teamRoom?.members || {});
    const roster = ids.map(id => {
      const lo = teamRoom.loadouts?.[id] || {};
      return {
        id,
        name: lo.name || teamRoom.members[id]?.name || "隊員",
        guildStats: lo.guildStats,
        supplies: lo.supplies,
        cats: lo.cats || [],
        arrowsPerRound: lo.arrowsPerRound,
      };
    });
    if (roster.some(r => !r.guildStats)) return { ok: false, reason: "有人還沒備包完成" };
    // 委託 → 遠征（怪物依人數放大血量，見 partyHpScale）
    const exp = scaleExpeditionForParty(
      rollExpedition({ id: teamRoom.contract.id, danger: teamRoom.contract.danger, family: teamRoom.contract.family }),
      roster.length,
    );
    const battle = createTeamState(exp, roster, { alreadyScaled: true });
    const res = await startGuildTeamExpedition(teamRoomId, memberId, battle);
    if (res.ok) { setContract(teamRoom.contract); setRun({ exp, key: `team_${teamRoomId}_${Date.now()}` }); setPhase("teamBattle"); }
    return res;
  });

  const teamSubmit = shots => {
    recordArrows(shots.length);                    // 公會的箭也算進今日/終身箭數
    return submitGuildTeamShots(teamRoomId, memberId, teamRoom?.seq || 0, shots);
  };

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
    const next = processTeamRound(battle, shotsByMember);
    const res = await commitGuildTeamRound(teamRoomId, memberId, next, seq + 1);
    if (!res.ok) teamCommitRef.current = 0;        // 寫失敗 → 讓它可以再試
    return res;
  });

  const teamLeave = () => teamAct(async () => {
    await leaveGuildTeamRoom(teamRoomId, memberId);
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
  const recordArrows = n => {
    if (!memberId || !n) return;
    addRoundArrows(memberId, n, { accountType: profile?.accountType || "official" });
  };

  const buy = async itemId => {
    const res = await buyGuildShopItem(memberId, gp, itemId);
    if (res.ok) setGp(res.profile);
    return res;
  };

  if (loading || !gp) {
    return <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b1220", color: "#94a3b8", fontSize: 13 }}>載入公會存檔…</div>;
  }

  const rankInfo = nextRankInfo(gp.rep);
  const rank = rankInfo.current;

  const toggleCat = catId => changeProfile({ ...gp, partyCats: togglePartyCat(partyCatIds, catId) });

  const doneIds = contractsStateFor(gp, dateKey).done;
  const closePanel = () => setPhase(contract ? "loadout" : "board");

  // ── 組隊遠征畫面 ──────────────────────────────────────────
  if (phase === "team") {
    return (
      <GuildTeamLobby
        room={teamRoom} myId={memberId} isHost={isTeamHost} contract={contract}
        stats={teamStats || {}} partyCats={partyCats} arrowsPerRound={gp.arrowsPerRound}
        busy={teamBusy}
        onCreate={teamCreate} onJoin={teamJoin} onReady={teamReady} onUnready={teamUnready}
        onDepart={teamDepart} onLeave={teamLeave}
        onClose={() => { setTeamRoomId(null); setPhase("board"); }}
      />
    );
  }

  if (phase === "teamBattle" && teamRoom?.battle && !result) {
    return (
      <GuildTeamBattle
        room={teamRoom} battle={teamRoom.battle} myId={memberId} isHost={isTeamHost}
        arrowsPerRound={teamRoom.battle.members?.[memberId]?.arrowsPerRound || gp.arrowsPerRound}
        onSubmitShots={teamSubmit} onCommitRound={teamCommit} onLeave={teamLeave}
      />
    );
  }

  if (phase === "stash") {
    return <GuildStash member={member} profile={gp} onChange={changeProfile} onClose={closePanel} />;
  }

  if (phase === "shop") {
    return <GuildShop profile={gp} onBuy={buy} onClose={closePanel} />;
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
        <GuildBoard profile={gp} contracts={dailyContracts} doneIds={doneIds}
          onOpen={setSheet} onOpenStash={() => setPhase("stash")} onOpenShop={() => setPhase("shop")}
          onOpenVault={() => setPhase("vault")} onOpenLicense={() => setPhase("license")}
          onOpenTeam={() => { setContract(null); setTeamRoomId(null); setPhase("team"); }} onBack={onBack} onLegacy={onLegacy} />
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
                    <ArtOrEmoji sources={[junkArt(j.id)]} emoji={j.icon} size={22} />
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
            <span style={{ color: "#94a3b8" }}>🏅 {gp.rep}{rankInfo.next ? `　距 ${rankInfo.next.name} 還差 ${rankInfo.need}` : "　已達頂階"}</span>
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
          <button onClick={() => { setResult(null); setContract(null); setRun(null); setPhase("shop"); }} style={{ padding: "8px 14px", borderRadius: 10, fontWeight: 900, fontSize: 12, color: "#fff", border: "none", background: "#4c1d95", cursor: "pointer" }}>🏪 商店</button>
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
            <button type="button" onClick={() => setPhase("shop")} style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: "#4c1d95", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>🏪 商店</button>
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
        <GuildLoadout member={member} guildEquip={gp.equipped} catRoster={catRoster} partyCatIds={partyCatIds} onToggleCat={toggleCat}
          arrowsPerRound={gp.arrowsPerRound} onChangeArrows={n => changeProfile({ ...gp, arrowsPerRound: n })}
          onDepart={sup => { setSupplies(sup); setPhase("battle"); }} />
      </div>
    );
  }

  // 保險：沒有委託/沒 roll 到遠征就不該在戰鬥畫面（例如放棄後的殘留狀態）
  if (!run || !contract) {
    return (
      <GuildBoard profile={gp} contracts={dailyContracts} doneIds={doneIds}
        onOpen={setSheet} onOpenStash={() => setPhase("stash")} onOpenShop={() => setPhase("shop")}
        onOpenVault={() => setPhase("vault")} onOpenLicense={() => setPhase("license")}
          onOpenTeam={() => { setContract(null); setTeamRoomId(null); setPhase("team"); }} onBack={onBack} onLegacy={onLegacy} />
    );
  }

  const stats = calcGuildExpeditionStats(member, gp.equipped);
  return (
    <div>
      <div style={{ padding: "6px 12px", background: "#1a1207", color: "#fcd34d", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between" }}>
        <span>📜 {contract?.title || "遠征中"}　{contract?.skulls}　🏹{gp.arrowsPerRound}箭/回合</span>
        <span style={{ color: "#94a3b8" }}>
          {Object.keys(STAT_META).map(k => `${STAT_META[k].short} ${stats[k]}`).join(" · ")}
        </span>
      </div>
      <GuildBattle key={run.key} expedition={run.exp} guildStats={stats} supplies={supplies} cats={partyCats}
        arrowsPerRound={gp.arrowsPerRound} onArrowsShot={recordArrows} onEnd={setResult} />
    </div>
  );
}
