// src/components/member/CatVillageBoardTeam.jsx
// 貓貓村大富翁：組隊（Phase 1b）。全員共享一顆棋、只吃房主骰子、成員各自 claim。
// 規格見 docs/second_brain/village-board-spec.md §3。需 2 個 client 測試。
import { useState, useEffect, useRef, useCallback } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import {
  createBoardRoom, joinBoardRoom, subscribeBoardRoom, leaveBoardRoom, disbandBoardRoom,
  findReconnectableBoardRoom, startBoardRoom, roomRollAndMove,
  roomApplyBoardEffect, claimBoardSettle, claimBoardEvent, partyMultOf, subscribeOpenBoardRooms,
  commitBoardMove, submitBoardShootScore, finalizeBoardShoot,
} from "../../lib/villageBoardTeamDb";
import { ensureDailyDice, applyEventEffect, DAILY_DICE, applyBoardReward } from "../../lib/villageBoardDb";
import { BOARD_LAYOUT, BOARD_SIZE, TILE_TYPES, BOARD_MODES, getModeTierCap, rollTileReward } from "../../lib/boardData";
import { drawBoardEvent } from "../../lib/boardEvents";
import { MATERIALS } from "../../lib/monsterMaterials";
import { NORMAL_MATERIALS } from "../../lib/monsterEconomyCatalog";
import { RESOURCE_NAMES } from "../../lib/villageData";
import { calculateGatheringRound } from "../../lib/catVillageGathering";
import { addRoundArrows } from "../../lib/db";
import { getCatSpeech } from "../cat/catSpeeches";
import { sfxTap, sfxSuccess, sfxCast } from "../../lib/sound";

const ASSET = "/assets/board";
// 新怪材料（無 icon）＋舊材料（有 icon）；舊材料放後面覆蓋同 id，保留其 icon
const MAT_BY_ID = { ...Object.fromEntries(NORMAL_MATERIALS.map(m => [m.id, m])), ...Object.fromEntries(MATERIALS.map(m => [m.id, m])) };
const RES_ICON = { ore:"⛏️", melon:"🍈", fish:"🐟", meat:"🍖", driedfish:"🐠", can:"🥫", fur:"🧶", arrowdew:"💧" };
const SCORE_PAD = [["X",10],["10",10],["9",9],["8",8],["7",7],["6",6],["5",5],["3",3],["M",0]];
// 藥水品質
const POTION_QUALITY = { 1: "初級", 2: "中級", 3: "高級" };

function gridPos(i) {
  if (i < 8) return { row: 1, col: i + 1 };
  if (i < 15) return { row: i - 8 + 2, col: 8 };
  if (i < 22) return { row: 8, col: 7 - (i - 15) };
  return { row: 7 - (i - 22), col: 1 };
}
function tileBg(type) {
  return { start:"bg-amber-300/25", material:"bg-emerald-500/20", mining:"bg-orange-500/20", monster:"bg-rose-500/25",
    arrowdew:"bg-sky-500/20", coins:"bg-yellow-500/20", gacha:"bg-pink-500/20", potion:"bg-lime-500/20",
    chest:"bg-amber-500/25", catbond:"bg-fuchsia-500/20", fate:"bg-orange-500/25", opp:"bg-cyan-500/25" }[type] || "bg-slate-700/30";
}
function TileIcon({ type, size = 24 }) {
  const [failed, setFailed] = useState(false);
  const meta = TILE_TYPES[type] || {};
  if (!failed) return <img src={`${ASSET}/tile_${type}.webp`} alt="" width={size} height={size} onError={() => setFailed(true)} className="object-contain" draggable={false} />;
  return <span style={{ fontSize: size * 0.8 }}>{meta.icon || "❔"}</span>;
}
// 解析 ore_t1 → { resource:'ore', tier:'T1' }，無 tier 的 key 原樣回傳
function parseTieredKey(key) {
  const m = key?.match(/^(.+)_t(\d+)$/);
  return m ? { resource: m[1], tier: `T${m[2]}` } : null;
}



function describeReward(rw) {
  if (!rw) return [];
  const out = [];
  if (rw.coins) out.push({ icon:"🪙", name:"金幣", amount:rw.coins });
  if (rw.arrowdew) out.push({ icon:"💧", name:"箭露", amount:rw.arrowdew });
  if (rw.gachaToken) out.push({ icon:"🎰", name:"扭蛋幣", amount:rw.gachaToken });
  Object.entries(rw.familyMaterials || {}).forEach(([id, n]) => {
    const m = MAT_BY_ID[id];
    out.push({ icon: m?.icon || "🧩", name: m?.name || id, amount: n });
  });
  // 村資源：分級 key（ore_t1）顯示「T1 礦物」；無 tier 原樣顯示
  Object.entries(rw.villageResources || {}).forEach(([k, n]) => {
    const parsed = parseTieredKey(k);
    if (parsed) {
      out.push({ icon: RES_ICON[parsed.resource] || "📦", name: `${parsed.tier} ${RESOURCE_NAMES[parsed.resource] || parsed.resource}`, amount: n });
    } else {
      out.push({ icon: RES_ICON[k] || "📦", name: RESOURCE_NAMES[k] || k, amount: n });
    }
  });
  // 藥水（applyBoardReward 會在入帳時隨機抽選實際藥水，此處顯示品質）
  (rw.potions || []).forEach(p => {
    const q = p?.tier || 1;
    out.push({ icon: "🧪", name: `${POTION_QUALITY[q] || ""}藥水`, amount: 1 });
  });
  (rw.chests || []).forEach(() => out.push({ icon: "🎁", name: "寶箱", amount: 1 }));
  if (rw.catXP) out.push({ icon: "🐱", name: "貓咪經驗", amount: rw.catXP });
  if (rw.catBond) out.push({ icon: "💕", name: "貓咪羈絆", amount: rw.catBond });
  return out;
}

export default function CatVillageBoardTeam({ profile, onClose }) {
  const { role } = useAuth();
  const myId = profile?.id;
  const villageBuildings = profile?.village?.buildings || {};
  const catId = profile?.equippedCat?.catId || null;

  const [roomId, setRoomId] = useState(null);
  const [room, setRoom] = useState(null);
  const [hostDice, setHostDice] = useState(0);
  const [openRooms, setOpenRooms] = useState([]);
  const [selMode, setSelMode] = useState(BOARD_MODES[0].id);
  const [selTier, setSelTier] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const joinedRef = useRef(false); // 避免重連覆蓋使用者主動建立/加入
  const [displayPos, setDisplayPos] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [animating, setAnimating] = useState(false); // 棋子動畫進行中（所有客戶端同步）
  const [diceAnim, setDiceAnim] = useState(null);
  const [shoot, setShoot] = useState(null);   // 房主射箭 { type }
  const [arrows, setArrows] = useState([]);   // 6 箭標籤（"X","10","9"...）
  const [shootResult, setShootResult] = useState(null); // { type, scoreRatio, threshold, passed, band, progressPct }
  const [card, setCard] = useState(null);      // { event, flipped }
  const [reward, setReward] = useState(null);
  const [toast, setToast] = useState(null);
  const [showTeamSummary, setShowTeamSummary] = useState(false);
  const [catBondPop, setCatBondPop] = useState(null); // 貓貓羈絆格：{ catId, name, speech, catXP, catBond }
  const lastSettleRef = useRef(0);
  const lastEventRef = useRef(0);
  const shootSeqRef = useRef(0);
  const animDoneRef = useRef(0); // 已完整跑完動畫的 pendingMove.seq；房主 commit 要等它對上才觸發
  const [pendingEventMsg, setPendingEventMsg] = useState(null); // 事件結果訊息，等全員確認後才跳

  const showToast = t => { setToast(t); setTimeout(() => setToast(null), 2400); };

  // ── allPassed 等全域閘門變數（需在 useEffect 前計算，避免 TDZ）──
  const activeMems = room ? Object.entries(room.members || {}).filter(([, mm]) => mm) : [];
  const memberCount = room ? Object.values(room.members || {}).filter(Boolean).length : 0;
  const curSeq = room?.seq || 0;
  const passedStep = mid => (room?.settleClaims?.[mid] || 0) >= curSeq || (room?.eventClaims?.[mid] || 0) >= curSeq;
  const hasPending = curSeq > 0 && ((room?.pendingSettle?.seq === curSeq) || (room?.pendingEvent?.seq === curSeq));
  const claimedN = activeMems.filter(([id]) => passedStep(id)).length;
  const allPassed = !hasPending || activeMems.every(([id]) => passedStep(id));

  // 重連（僅在使用者尚未主動建立/加入房間時才自動重連）
  useEffect(() => {
    if (!myId) return;
    ensureDailyDice(myId);
    findReconnectableBoardRoom(myId).then(r => {
      if (!joinedRef.current && r.room) setRoomId(r.room.id);
    });
  }, [myId]);

  // 大廳：訂閱可加入的等待中房間（跟其他模式一樣列出房間讓玩家選）
  useEffect(() => {
    if (roomId) { setOpenRooms([]); return; }
    return subscribeOpenBoardRooms(setOpenRooms);
  }, [roomId]);

  // 訂閱房間
  useEffect(() => {
    if (!roomId) { setRoom(null); return; }
    const unsub = subscribeBoardRoom(roomId, r => {
      if (!r || r.status === "completed") { setRoomId(null); setRoom(null); return; }
      setRoom(r);
    });
    return unsub;
  }, [roomId]);

  const isHost = room && room.hostId === myId;

  // 訂閱房主骰子
  useEffect(() => {
    if (!room?.hostId) return;
    const unsub = onSnapshot(doc(db, "members", room.hostId), s => setHostDice(s.data()?.villageBoard?.dice || 0));
    return unsub;
  }, [room?.hostId]);

  // pendingMove → 所有客戶端同步動畫（房主執骰後雙方一起看棋子移動）。
  // 依賴 pendingMove.seq（每次擲骰都變）→ 動畫才會重跑；不看 animating 以免殘留 true 卡死後續動畫。
  useEffect(() => {
    if (!room?.pendingMove) return;
    const pm = room.pendingMove;
    setAnimating(true);
    setDisplayPos(pm.from);
    let cur = pm.from;
    let stepIv = null;
    let landT = null;
    // ① 起步前停頓：讓房主端的骰子數字先亮出來、隊員看清「準備移動」，避免骰子與棋子同時動
    const startT = setTimeout(() => {
      stepIv = setInterval(() => {
        cur = (cur + 1) % BOARD_SIZE;
        setDisplayPos(cur);
        sfxTap();
        if (cur === pm.to) {
          clearInterval(stepIv); stepIv = null;
          sfxSuccess();
          // ② 落點停頓：讓「踩到格子上」看得清楚，才記錄動畫完成 + setAnimating(false) → 房主 commit → 觸發事件/結算
          landT = setTimeout(() => { animDoneRef.current = pm.seq; setAnimating(false); }, 850);
        }
      }, 260);
    }, 900);
    return () => { clearTimeout(startT); if (stepIv) clearInterval(stepIv); if (landT) clearTimeout(landT); };
  }, [room?.pendingMove?.seq]);

  // boardPos 同步（頁面重整/動畫結束後確保棋子位置正確）
  useEffect(() => { if (room && !animating) setDisplayPos(room.boardPos || 0); }, [room?.boardPos, animating]);

  // 動畫結束後房主確認移動 → 寫入 boardPos + pendingSettle/Event。
  // 必須等這次 pendingMove 的動畫「真的跑完」（animDoneRef 對上 seq）才 commit，
  // 否則骰子一擲、動畫還沒跑就 commit，會變成「沒動畫直接跳結果」。
  useEffect(() => {
    if (animating || !room?.pendingMove || !isHost) return;
    if (animDoneRef.current !== room.pendingMove.seq) return;
    const pm = room.pendingMove;

    if (TILE_TYPES[pm.tile]?.shooting) {
      // 射箭格：確認移動 → commitBoardMove 會隨機指派射手寫 pendingShoot，
      // 由下方 pendingShoot Effect 對被指派者開射擊介面（不再固定房主射）。
      commitBoardMove(roomId, myId).catch(() => {});
    } else if (pm.tile === "fate" || pm.tile === "opp") {
      // 命運/機會：抽牌後提交（pendingEvent 會讓雙方都看到卡片）
      const card = drawBoardEvent(pm.tile);
      commitBoardMove(roomId, myId, { eventCard: card }).catch(() => {});
    } else {
      // 一般格子：提交 pendingSettle → 雙方自動領取
      commitBoardMove(roomId, myId).catch(() => {});
    }

    // 繞圈獎勵（房主自己領）
    if (pm.lapped) {
      const lapMode = BOARD_MODES.find(x => x.id === pm.modeId) || BOARD_MODES[0];
      const rw = rollTileReward("start", {
        mode: lapMode, tierCap: getModeTierCap(pm.modeId, villageBuildings),
        tier: pm.tier, partyMult: pm.partyMult || 1,
      });
      applyBoardReward(myId, rw, { catId }).catch(() => {});
      sfxSuccess();
      setReward({ items: describeReward(rw), band: rw.band });
    }
  }, [animating, room?.pendingMove, isHost, roomId, myId]);

  // 成員自動 claim 結算獎勵
  useEffect(() => {
    if (!room?.pendingSettle || !myId) return;
    const seq = room.pendingSettle.seq;
    if ((room.settleClaims?.[myId] || 0) >= seq || lastSettleRef.current >= seq) return;
    lastSettleRef.current = seq;
    const isCatBond = room.pendingSettle.tileType === "catbond";
    claimBoardSettle(roomId, myId, { villageBuildings, catId }).then(res => {
      if (!(res?.ok && res.reward)) return;
      sfxSuccess();
      // 貓貓羈絆格：讓裝備中的陪練貓出來說句話 + 顯示經驗/羈絆
      if (isCatBond && catId) {
        setCatBondPop({
          catId,
          name: profile?.equippedCat?.name || "貓貓",
          speech: getCatSpeech(catId, "encourage"),
          catXP: res.reward.catXP || 0,
          catBond: res.reward.catBond || 0,
        });
      } else {
        setReward({ items: describeReward(res.reward), band: res.reward.band });
      }
    });
  }, [room?.pendingSettle?.seq, room?.settleClaims, myId, roomId, catId, profile]);

  // 命運/機會事件卡：顯示 + 成員 claim（房主另處理共享棋效果）
  useEffect(() => {
    if (!room?.pendingEvent || !myId) return;
    const seq = room.pendingEvent.seq;
    if (lastEventRef.current >= seq) return;
    lastEventRef.current = seq;
    setCard({ event: room.pendingEvent.event, flipped: false });
    setTimeout(() => setCard(c => c && { ...c, flipped: true }), 550);
  }, [room?.pendingEvent?.seq, myId]);

  // 射箭格：被隨機指派的射手開射擊介面；交分後收起。非射手只會看到「射箭中」等待。
  useEffect(() => {
    const ps = room?.pendingShoot;
    if (!ps || !myId) {
      if (shootSeqRef.current) { shootSeqRef.current = 0; setShoot(null); setShootResult(null); }
      return;
    }
    const iAmShooter = ps.shooters?.includes(myId);
    const iSubmitted = ps.scores?.[myId] != null;
    if (iAmShooter && !iSubmitted && shootSeqRef.current !== ps.seq) {
      shootSeqRef.current = ps.seq;
      setShoot({ type: ps.tileType, threshold: ps.threshold || 0, seq: ps.seq });
      setArrows([]); setShootResult(null);
    } else if (iSubmitted && shootSeqRef.current === ps.seq) {
      shootSeqRef.current = 0;
      setShoot(null); setShootResult(null);
    }
  }, [room?.pendingShoot, myId]);

  // 房主：所有指派射手都交分後 → 結算平均分數
  useEffect(() => {
    if (!isHost || !room?.pendingShoot) return;
    const ps = room.pendingShoot;
    if (Object.keys(ps.scores || {}).length >= (ps.shooters?.length || 1)) {
      finalizeBoardShoot(roomId, myId).catch(() => {});
    }
  }, [isHost, room?.pendingShoot, roomId, myId]);

  // 房主骰子用完 + 當前這步全員都領完 → 進結算畫面（全員都看得到）。
  // 用房間權威的 hostDiceLeft（=== 0 才算，未定義代表還沒擲過骰），避免隊員讀不到房主 dice 誤觸發。
  // ⚠️ pendingSettle claim 後不會被清空（只記 settleClaims），所以不能用「沒有 pendingSettle」判斷，
  //    要用 allPassed（全員已領取當前 seq）——否則最後一顆骰後永遠卡著不出結算。
  useEffect(() => {
    if (room?.status !== "active") return;
    const idle = room?.hostDiceLeft === 0 && !animating && !room?.pendingMove && !room?.pendingShoot
      && allPassed && !shoot && !shootResult && !card;
    if (idle) setShowTeamSummary(true);
  }, [room?.hostDiceLeft, room?.status, animating, room?.pendingMove, room?.pendingShoot, allPassed, shoot, shootResult, card]);

  // ── 大廳動作 ──
  async function create() {
    setBusy(true); setErr("");
    joinedRef.current = true;
    const res = await createBoardRoom({ hostId: myId, hostName: profile?.name || "房主", mode: selMode, tier: selTier, accountType: profile?.accountType, avatarId: profile?.avatarId });
    setBusy(false);
    if (res.ok) setRoomId(res.roomId);
    else { joinedRef.current = false; setErr(res.reason || "建立失敗"); }
  }
  async function join(code) {
    if (!code) return;
    setBusy(true); setErr("");
    joinedRef.current = true;
    const res = await joinBoardRoom(code, myId, profile?.name || "隊員", { accountType: profile?.accountType, avatarId: profile?.avatarId });
    setBusy(false);
    if (res.ok) setRoomId(res.roomId); else { joinedRef.current = false; setErr(res.reason || "加入失敗"); }
  }
  async function exitRoom() {
    joinedRef.current = false;
    if (isHost) { await disbandBoardRoom(roomId, myId).catch(() => {}); }
    else { await leaveBoardRoom(roomId, myId).catch(() => {}); }
    setRoomId(null); setRoom(null);
  }

  // ── 房主：擲骰（只寫 pendingMove，動畫交給 Effect 同步處理）──
  const hostRoll = useCallback(async () => {
    if (!isHost || rolling || hostDice <= 0) return;
    setRolling(true); sfxCast();
    const res = await roomRollAndMove(roomId, myId);
    if (!res?.ok) { showToast(res?.reason || "無法擲骰"); setRolling(false); return; }
    // 骰子動畫（快速跳數字）
    setDiceAnim(1);
    await new Promise(r => { const end = Date.now() + 700; const iv = setInterval(() => { if (Date.now() >= end) { clearInterval(iv); setDiceAnim(res.roll); sfxSuccess(); r(); } else setDiceAnim(1 + Math.floor(Math.random() * 6)); }, 80); });
    await new Promise(r => setTimeout(r, 500)); setDiceAnim(null);
    // 棋子動畫與事件處理統一由 pendingMove Effect 負責（雙方同步）
    setRolling(false);
  }, [isHost, rolling, hostDice, roomId, myId]);

  const hostFinishShoot = useCallback(async () => {
    if (arrows.length < 6) return;
    // arrows 存標籤（"X","10","9"...），計算分數比值與採集進度
    const labels = arrows;
    const score = labels.reduce((s, l) => s + (l === "X" ? 10 : Number(l) || 0), 0);
    const ratio = score / 60;
    const t = shoot.type;

    if (t === "monster") {
      // 怪物格：門檻由房間統一指派（shoot.threshold），兩人射時最終以平均分判定
      const threshold = shoot.threshold || 38;
      const passed = score >= threshold;
      const band = passed ? (score >= 50 ? "S" : score >= 40 ? "A" : "B") : "C";
      setShootResult({ type: "monster", score, ratio, threshold, passed, band, labels });
    } else {
      // 採集格：用 gathering 計分制計算進度（每箭 X=30, 10=25, 9=20…），最高 180%
      const { progress } = calculateGatheringRound(labels);
      const pp = Math.max(0, Math.min(180, progress));
      const completion = pp >= 180 ? "大豐收" : pp >= 130 ? "豐收" : pp >= 100 ? "完成" : pp >= 50 ? "半成品" : "安慰獎";
      setShootResult({ type: "mining", score, ratio, progressPct: pp, band: completion, labels });
    }
  }, [arrows, shoot]);

  // 確認射擊結果 → 交出自己的分數（房主收齊所有射手後取平均結算）
  const confirmShootResult = useCallback(async () => {
    if (!shootResult || !shoot) return;
    const { labels } = shootResult;
    const t = shoot.type;
    const score = labels.reduce((s, l) => s + (l === "X" ? 10 : Number(l) || 0), 0);
    const { progress } = t === "mining" ? calculateGatheringRound(labels) : { progress: 0 };
    shootSeqRef.current = 0;
    setShootResult(null);
    setShoot(null);
    addRoundArrows(myId, 6).catch(() => {}); // 這 6 箭算實際射手的今日/終身箭數
    await submitBoardShootScore(roomId, myId, { score, progress });
  }, [shootResult, shoot, roomId, myId]);

  // 事件卡確認：成員 claim 資源；房主另套用共享棋效果
  // 卡片設為 waiting 狀態直到全員領取，防止房主跳過事件、隊員被拉走
  const confirmCard = useCallback(async () => {
    const ev = card?.event;
    if (!ev) return;
    // 設為 waiting 不馬上消失，讓隊員有時間確認
    setCard(c => c && c.event ? { event: c.event, flipped: true, waiting: true } : null);
    const res = await claimBoardEvent(roomId, myId, { villageBuildings, catId });
    // 先算好「拿到/失去什麼」的訊息，但不立刻跳——等全員都確認後（allPassed）才顯示（見下方 effect）
    if (res?.ok) {
      const label = r => ({ coins:"金幣", arrowdew:"箭露", gachaToken:"扭蛋幣", catXP:"貓咪經驗", material:"家族素材", ...RESOURCE_NAMES }[r] || r);
      let msg = "";
      if (res.kind === "gain")        msg = `✨ 獲得 ${res.amount} ${label(res.resource)}`;
      else if (res.kind === "lose")   msg = `💸 失去 ${res.amount} ${label(res.resource)}`;
      else if (res.kind === "micro")  msg = `🪙 獲得 ${res.amount} 金幣`;
      else if (res.kind === "chest")  msg = "🎁 獲得寶箱！";
      else if (res.kind === "catBond")msg = `🐱 貓咪 +${res.xp || 0} 經驗`;
      else if (res.kind === "dice")   msg = res.delta > 0 ? `🎲 骰子 +${res.delta}` : "😴 暫停一回合";
      else                            msg = `😸 ${ev.text?.length > 14 ? "會心一笑" : ev.text}`;
      setPendingEventMsg(msg);
    }
    if (isHost) {
      const r = await applyEventEffect(myId, ev, { villageBuildings, catId });
      if (r.kind === "move") await roomApplyBoardEffect(roomId, myId, { pos: (((room.boardPos + r.steps) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE });
      else if (r.kind === "teleport") { for (let d = 1; d <= BOARD_SIZE; d++) { const idx = (room.boardPos + d) % BOARD_SIZE; if (BOARD_LAYOUT[idx] === r.tile) { await roomApplyBoardEffect(roomId, myId, { pos: idx }); break; } } }
      else if (r.kind === "dice") await roomApplyBoardEffect(roomId, myId, { diceDelta: r.delta });
    }
  }, [card, roomId, myId, isHost, room, catId]);

  // 全員確認後才關卡片 + 跳事件結果通知（不能先跑，要等大家都通過）
  useEffect(() => {
    if (card?.waiting && allPassed) {
      setCard(null);
      if (pendingEventMsg) { showToast(pendingEventMsg); setPendingEventMsg(null); }
    }
  }, [card?.waiting, allPassed, pendingEventMsg]);

  // ── 大廳畫面 ──
  if (!roomId || !room) {
    const cap = getModeTierCap(selMode, villageBuildings);
    const tiers = Array.from({ length: cap }, (_, i) => i + 1);
    const m = BOARD_MODES.find(x => x.id === selMode) || BOARD_MODES[0];
    return (
      <div className="fixed inset-0 z-[200] overflow-y-auto" style={{ backgroundColor:"#140a04", backgroundImage:`linear-gradient(rgba(18,10,4,0.85),rgba(12,7,3,0.94)), url(${ASSET}/board_bg.webp)`, backgroundSize:"cover" }}>
        <div className="w-full max-w-lg mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
            <div className="text-amber-100 font-black">👥 組隊探索</div>
            <div className="w-9" />
          </div>
          {err && <div className="mb-3 text-rose-300 text-xs font-bold">{err}</div>}
          <div className="rounded-2xl bg-black/30 border border-amber-500/25 p-4 mb-4">
            <div className="text-amber-200/80 text-xs font-bold mb-2">建立房間・選地圖</div>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {BOARD_MODES.map(mo => (
                <button key={mo.id} onClick={() => { setSelMode(mo.id); setSelTier(1); }}
                  className={`rounded-xl p-2 text-[11px] font-bold border ${mo.id===selMode ? "border-amber-300 bg-amber-400/20 text-amber-100" : "border-amber-500/20 text-amber-100/70"}`}>{mo.icon}{mo.familyName}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tiers.map(t => <button key={t} onClick={() => setSelTier(t)} className={`px-3 py-1.5 rounded-lg text-xs font-black border ${t===selTier?"bg-amber-400 text-slate-900 border-amber-300":"bg-black/30 text-amber-100 border-amber-500/20"}`}>T{t}</button>)}
            </div>
            <button disabled={busy || tiers.length===0} onClick={create} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black disabled:opacity-40">建立 {m.familyName} T{selTier} 房間</button>
          </div>
          <div className="rounded-2xl bg-black/30 border border-amber-500/25 p-4">
            <div className="text-amber-200/80 text-xs font-bold mb-2">加入房間（{openRooms.length}）</div>
            {openRooms.length === 0 ? (
              <div className="text-center text-amber-100/50 text-xs py-6">目前沒有開放的房間，建立一個吧！</div>
            ) : (
              <div className="space-y-2">
                {openRooms.map(r => {
                  const rm = BOARD_MODES.find(x => x.id === r.mode) || BOARD_MODES[0];
                  const full = (r.memberCount || 0) >= 8;
                  return (
                    <div key={r.id} className="flex items-center gap-2 rounded-xl bg-slate-900/70 border border-white/10 px-3 py-2.5">
                      <span className="text-lg">{rm.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-bold text-sm truncate">{r.hostName} 的房間</div>
                        <div className="text-amber-100/60 text-[11px]">{rm.familyName}・{r.memberCount || 1}/8 人</div>
                      </div>
                      <button disabled={busy || full} onClick={() => join(r.code)}
                        className="px-4 py-1.5 rounded-lg bg-amber-500/30 border border-amber-400/30 text-amber-100 font-black text-xs disabled:opacity-40">
                        {full ? "已滿" : "加入"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 等待室 ──
  if (room.status === "waiting") {
    const mems = Object.entries(room.members || {}).filter(([, mm]) => mm);
    const wm = BOARD_MODES.find(x => x.id === room.mode) || BOARD_MODES[0];
    return (
      <div className="fixed inset-0 z-[200] overflow-y-auto" style={{ backgroundColor:"#140a04", backgroundImage:`linear-gradient(rgba(18,10,4,0.85),rgba(12,7,3,0.94)), url(${ASSET}/board_bg.webp)`, backgroundSize:"cover" }}>
        <div className="w-full max-w-lg mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={exitRoom} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
            <div className="text-amber-100 font-black">⏳ 組隊等待室</div>
            <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-amber-200 text-xs font-black">🎲 {hostDice}</div>
          </div>
          <div className="rounded-2xl bg-black/30 border border-amber-500/25 p-4 mb-4 text-center">
            <div className="text-amber-200/60 text-xs">隊友可在「加入房間」列表看到這間</div>
            <div className="text-2xl font-black text-amber-300 tracking-[0.2em] my-1">{room.code}</div>
            <div className="text-amber-100/70 text-xs">{wm.icon}{wm.familyName}・T{room.tier || 1}</div>
          </div>
          <div className="text-amber-200/80 text-xs font-bold mb-2">隊員（{mems.length}/8）</div>
          <div className="space-y-2 mb-6">
            {mems.map(([id, mem]) => (
              <div key={id} className="flex items-center gap-2 rounded-xl bg-slate-900/70 border border-white/10 px-3 py-2.5">
                <span className="text-lg">🐱</span>
                <span className="flex-1 text-white font-bold text-sm">{mem.name}{id === room.hostId ? " 👑" : ""}{id === myId ? "（你）" : ""}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            ))}
          </div>
          {isHost ? (
            <button onClick={() => startBoardRoom(roomId, myId)} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-base shadow-lg active:scale-95">
              🎲 開始探索（{mems.length} 人）
            </button>
          ) : (
            <div className="text-center text-amber-200/70 text-sm py-3 rounded-2xl bg-black/20">等待房主開始…</div>
          )}
        </div>
      </div>
    );
  }

  // ── 團隊棋盤 ──
  const mode = room ? (BOARD_MODES.find(x => x.id === room.mode) || BOARD_MODES[0]) : BOARD_MODES[0];
  const pMult = partyMultOf(memberCount);
  const shootWaiting = !!room?.pendingShoot && room.pendingShoot.seq === curSeq;
  const shootNames = shootWaiting ? (room.pendingShoot.shooters || []).map(id => room.members?.[id]?.name || "隊員") : [];
  const shootDone = shootWaiting ? Object.keys(room.pendingShoot.scores || {}).length : 0;
  const canRoll = isHost && !rolling && hostDice > 0 && allPassed && !shoot && !shootResult && !card && !animating && !room?.pendingShoot;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center overflow-y-auto"
      style={{ backgroundColor:"#140a04", backgroundImage:`linear-gradient(rgba(18,10,4,0.72),rgba(12,7,3,0.9)), url(${ASSET}/board_bg.webp)`, backgroundSize:"cover", backgroundPosition:"center" }}>
      <div className="w-full max-w-lg flex items-center justify-between px-4 py-3">
        <button onClick={exitRoom} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
        <div className="text-amber-100 font-black text-sm">👥 房號 {room.code}・{memberCount}人</div>
        <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-amber-200 text-xs font-black">🎲 {room?.hostDiceLeft ?? hostDice}</div>
      </div>
      <div className="w-full max-w-lg px-3 flex items-center justify-center gap-2 mb-1">
        <div className="rounded-xl bg-black/30 border border-amber-500/25 px-3 py-1 text-amber-100 text-xs font-black">
          {mode.icon} {mode.familyName} · T{room.tier || 1}
          {/* Bug 6 修正：有 pending 待結算時，顯示結算時的加成倍率 */}
          {room.pendingSettle?.partyMult
            ? ` · 加成×${room.pendingSettle.partyMult.toFixed(2)}`
            : room.pendingEvent?.partyMult
              ? ` · 加成×${room.pendingEvent.partyMult.toFixed(2)}`
              : ` · 加成×${partyMultOf(memberCount).toFixed(2)}`}
        </div>
      </div>

      <div className="w-full max-w-lg p-3">
        <div className="w-full rounded-[26px] p-2.5" style={{ background:"linear-gradient(145deg,#d4a017,#8a5a12)", boxShadow:"0 12px 34px rgba(0,0,0,.6), inset 0 0 0 3px rgba(253,230,138,.55), inset 0 0 0 6px rgba(120,53,15,.5)" }}>
          <div className="grid aspect-square w-full rounded-2xl p-1.5" style={{ gridTemplateColumns:"repeat(8,1fr)", gridTemplateRows:"repeat(8,1fr)", gap:4, background:"linear-gradient(160deg,#2a1a0c,#1a0f06)", boxShadow:"inset 0 0 24px rgba(0,0,0,.7)" }}>
            <div style={{ gridColumn:"2 / 8", gridRow:"2 / 8" }} className="rounded-xl overflow-hidden border border-amber-500/30">
              <div className="w-full h-full rounded-xl flex flex-col items-center justify-center text-center p-2" style={{ backgroundColor: mode.palette?.[1]||"#0f172a", backgroundImage:`linear-gradient(160deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55)), url(${ASSET}/map_${mode.id}.webp)`, backgroundSize:"cover", backgroundPosition:"center" }}>
                <div className="text-amber-100 font-black text-lg drop-shadow">{mode.name}</div>
                <div className="text-amber-300/70 text-[11px] mt-1">已繞 {room.lapCount || 0} 圈</div>
                {shootWaiting ? (
                  <div className="mt-3 text-amber-200/85 text-xs font-black">🎯 {shootNames.join("、")} 射箭中…（{shootDone}/{room.pendingShoot.shooters.length}）</div>
                ) : isHost ? (
                  <button onClick={hostRoll} disabled={!canRoll} className="mt-3 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-sm shadow-lg disabled:opacity-40 active:scale-95">
                    {rolling ? "🎲 前進中…" : hostDice <= 0 ? "骰子用完了" : !allPassed ? `⏳ 等隊員領取 ${claimedN}/${memberCount}` : "🎲 房主擲骰"}
                  </button>
                ) : <div className="mt-3 text-amber-200/70 text-xs">{hasPending && !passedStep(myId) ? "領取你的獎勵…" : "等待房主擲骰…"}</div>}
              </div>
            </div>
            {BOARD_LAYOUT.map((type, i) => {
              const { row, col } = gridPos(i);
              const here = displayPos === i;
              return (
                <div key={i} style={{ gridColumn:col, gridRow:row }} className={`relative rounded-lg flex items-center justify-center border ${here ? "ring-2 ring-yellow-300 scale-105 z-10" : "border-amber-500/20"}`}>
                  <div className={`w-full h-full rounded-lg flex items-center justify-center ${tileBg(type)}`}>
                    <TileIcon type={type} size={24} />
                    {here && <div className="absolute -top-1 -right-1 text-base">🐱</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[210] rounded-2xl bg-black/85 border border-amber-400/40 px-4 py-2.5 text-amber-100 text-sm font-black">{toast}</div>}

      {diceAnim != null && (
        <div className="fixed inset-0 z-[215] flex items-center justify-center pointer-events-none">
          <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-amber-50 to-amber-200 border-4 border-amber-400 flex items-center justify-center shadow-2xl animate-bounce" style={{ boxShadow:"0 0 52px rgba(251,146,60,.9)" }}>
            <span className="text-7xl font-black" style={{ color:"#c2410c" }}>{diceAnim}</span>
          </div>
        </div>
      )}

      {reward && (
        <div className="fixed inset-0 z-[215] bg-black/70 flex items-center justify-center p-4" onClick={() => setReward(null)}>
          <div className="bg-slate-900 border-2 border-amber-400/50 rounded-3xl p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <div className="text-center text-amber-200 font-black mb-2">🎁 獲得獎勵{reward.band ? `・${reward.band} 級` : ""}</div>
            <div className="space-y-1.5 my-2 max-h-[45vh] overflow-y-auto">
              {reward.items.map((it, i) => <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2"><span className="text-sm font-bold text-slate-100">{it.icon} {it.name}</span><span className="text-amber-300 font-black">×{it.amount}</span></div>)}
            </div>
            <button onClick={() => setReward(null)} className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-900 font-black">收下！</button>
          </div>
        </div>
      )}

      {catBondPop && (
        <div className="fixed inset-0 z-[218] bg-black/75 flex items-center justify-center p-4" onClick={() => setCatBondPop(null)}>
          <div className="bg-gradient-to-b from-fuchsia-950/90 to-slate-900 border-2 border-fuchsia-400/50 rounded-3xl p-5 w-full max-w-xs text-center animate-[fx-pop-in_0.35s_cubic-bezier(.34,1.56,.64,1)]" onClick={e => e.stopPropagation()}>
            <img src={`/cats/portraits/${catBondPop.catId}.webp`} alt={catBondPop.name}
              className="w-24 h-24 rounded-2xl object-cover mx-auto border-2 border-fuchsia-300/40 shadow-lg"
              onError={e => { e.currentTarget.style.display = "none"; }} />
            <div className="mt-2 text-fuchsia-200 font-black">{catBondPop.name}</div>
            <div className="mt-2 mb-3 rounded-2xl bg-white/90 text-slate-800 font-bold text-sm px-3 py-2 leading-relaxed">「{catBondPop.speech}」</div>
            <div className="flex justify-center gap-3 mb-4">
              {catBondPop.catXP > 0 && <div className="rounded-xl bg-black/30 px-3 py-1.5 text-amber-200 text-sm font-black">✨ 經驗 +{catBondPop.catXP}</div>}
              {catBondPop.catBond > 0 && <div className="rounded-xl bg-black/30 px-3 py-1.5 text-fuchsia-200 text-sm font-black">💖 羈絆 +{catBondPop.catBond}</div>}
            </div>
            <button onClick={() => setCatBondPop(null)} className="w-full py-2.5 rounded-xl bg-fuchsia-400 text-slate-900 font-black active:scale-95">摸摸貓！</button>
          </div>
        </div>
      )}

      {showTeamSummary && (
        <div className="fixed inset-0 z-[220] bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-400/50 rounded-3xl p-6 w-full max-w-xs text-center animate-[fx-pop-in_0.35s_cubic-bezier(.34,1.56,.64,1)]">
            <div className="text-5xl mb-2">🎲</div>
            <div className="text-amber-200 font-black text-lg mb-1">今日探索結束</div>
            <div className="text-slate-300 text-sm mb-1">房主骰子已用完</div>
            <div className="text-amber-300/80 text-sm font-bold mb-5">本局共繞了 {room.lapCount || 0} 圈 🏁</div>
            <button onClick={() => { setShowTeamSummary(false); exitRoom(); }} className="w-full py-3 rounded-2xl bg-amber-400 text-slate-900 font-black">
              {isHost ? "結束並解散房間" : "離開房間"}
            </button>
          </div>
        </div>
      )}

      {shoot && !shootResult && (
        <div className="fixed inset-0 z-[215] bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 w-full max-w-sm">
            <div className="text-center text-amber-100 font-black mb-1">{TILE_TYPES[shoot.type].icon} {TILE_TYPES[shoot.type].label}格・輪到你射 6 箭</div>
            <div className="flex justify-center gap-1 my-3">{Array.from({length:6}).map((_,i)=>(<div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border ${arrows[i]!=null?"bg-emerald-600 text-white border-emerald-400":"bg-slate-800 text-slate-500 border-slate-700"}`}>{arrows[i]!=null?arrows[i]:"?"}</div>))}</div>
            <div className="grid grid-cols-5 gap-1.5">{SCORE_PAD.map(([l,v])=>(<button key={l} disabled={arrows.length>=6} onClick={()=>{sfxTap();setArrows(a=>a.length<6?[...a,l]:a);}} className="py-2 rounded-lg bg-amber-500/20 text-amber-100 font-black text-xs border border-amber-400/30 disabled:opacity-40">{l}</button>))}</div>
            <div className="flex gap-2 mt-4"><button onClick={()=>setArrows([])} className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">清除</button><button onClick={hostFinishShoot} disabled={arrows.length<6} className="flex-[2] py-2 rounded-xl bg-amber-400 text-slate-900 font-black text-sm disabled:opacity-40">結算（{arrows.length}/6）</button></div>
          </div>
        </div>
      )}

      {shootResult && (
        <div className="fixed inset-0 z-[215] bg-black/85 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
          <div className="bg-slate-900 border-2 border-amber-400/50 rounded-3xl p-6 w-full max-w-sm text-center animate-[fx-pop-in_0.35s_cubic-bezier(.34,1.56,.64,1)]">
            {shootResult.type === "monster" ? (
              <>
                <div className="text-5xl mb-2">{mode.icon}</div>
                <div className="text-amber-200 font-black text-lg">
                  {shootResult.passed ? "⚔️ 擊倒怪物！" : "💨 怪物逃走了…"}
                </div>
                <div className="flex justify-center gap-4 my-3 text-sm">
                  <div className="text-slate-400">
                    門檻<br/><span className="text-amber-300 font-black text-xl">{shootResult.threshold}</span>
                  </div>
                  <div className="text-slate-400">
                    得分<br/><span className={`font-black text-xl ${shootResult.passed ? "text-emerald-400" : "text-rose-400"}`}>{shootResult.score}</span>
                  </div>
                  <div className="text-slate-400">
                    獎勵倍率<br/><span className="text-amber-300 font-black text-xl">×{shootResult.passed ? 1.5 : 0.8}</span>
                  </div>
                </div>
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-black ${shootResult.passed ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                  {shootResult.passed ? `✓ 擊倒成功！(${shootResult.band}級)` : "✗ 未達門檻"}
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl mb-2">⛏️</div>
                <div className="text-amber-200 font-black text-lg">採集結果</div>
                <div className="flex justify-center gap-4 my-3 text-sm">
                  <div className="text-slate-400">
                    進度<br/><span className="text-amber-300 font-black text-xl">{Math.round(shootResult.progressPct)}%</span>
                  </div>
                  <div className="text-slate-400">
                    評級<br/><span className="text-amber-300 font-black text-lg">{shootResult.band}</span>
                  </div>
                </div>
                <div className="mt-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${shootResult.progressPct >= 180 ? "bg-amber-400" : shootResult.progressPct >= 100 ? "bg-emerald-400" : "bg-blue-400"}`}
                    style={{ width: `${Math.min(100, shootResult.progressPct)}%` }} />
                </div>
                <div className="text-slate-500 text-[10px] mt-1">最高 180%</div>
              </>
            )}
            <button onClick={confirmShootResult}
              className="mt-5 w-full py-3 rounded-2xl bg-amber-400 text-slate-900 font-black text-sm shadow-lg active:scale-95 transition-all hover:bg-amber-300">
              ✓ 確認領取
            </button>
          </div>
        </div>
      )}

      {card && (
        <div className="fixed inset-0 z-[215] bg-black/85 flex items-center justify-center p-4" onClick={card.waiting ? undefined : confirmCard}>
          {card.waiting ? (
            <div className="rounded-3xl bg-slate-900/90 border-2 border-amber-400/50 p-8 w-full max-w-xs text-center">
              <div className="text-amber-300 text-lg font-black mb-2">⏳ 等待全員確認</div>
              <div className="text-amber-100/80 text-sm mb-3">其他隊員正在查看卡片…</div>
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay:'0s' }} />
                <div className="w-3 h-3 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay:'0.15s' }} />
                <div className="w-3 h-3 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay:'0.3s' }} />
              </div>
              <div className="text-amber-200/60 text-xs mt-4">{claimedN}/{memberCount} 已確認</div>
            </div>
          ) : (
            <div className="[perspective:1000px]">
              <div className="relative w-64 h-96 transition-transform duration-500" style={{ transformStyle:"preserve-3d", transform: card.flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
                <div className="absolute inset-0 rounded-3xl border-4 flex items-center justify-center [backface-visibility:hidden]" style={{ borderColor: card.event.deck==="fate"?"#f59e0b":"#38bdf8", backgroundColor: card.event.deck==="fate"?"#431407":"#0c4a6e", backgroundImage:`url(${ASSET}/card_${card.event.deck}_back.webp)`, backgroundSize:"cover", backgroundPosition:"center" }}><div className="text-3xl font-black" style={{ color: card.event.deck==="fate"?"#fcd34d":"#7dd3fc" }}>{card.event.deck==="fate"?"命運":"機會"}</div></div>
                <div className="absolute inset-0 rounded-3xl border-4 flex flex-col items-center justify-center p-6 text-center [backface-visibility:hidden]" style={{ transform:"rotateY(180deg)", borderColor: card.event.deck==="fate"?"#f59e0b":"#38bdf8", backgroundColor: card.event.deck==="fate"?"#fde8cf":"#d4f0fe", backgroundImage:`url(${ASSET}/card_${card.event.deck}.webp)`, backgroundSize:"cover", backgroundPosition:"center" }}>
                  <div className="rounded-2xl px-4 py-3" style={{ background:"rgba(255,255,255,0.86)", boxShadow:"0 2px 10px rgba(0,0,0,0.15)" }}>
                    <div className="text-slate-900 font-black text-lg mb-2">{card.event.deck==="fate"?"命運":"機會"}</div>
                    <div className="text-slate-800 font-bold text-base leading-relaxed">{card.event.text}</div>
                    <div className="text-slate-600 text-xs mt-3 font-bold">（點擊確認）</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
