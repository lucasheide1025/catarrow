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
  submitBoardShootScore, finalizeBoardShoot, clearRoomPending, kickBoardMember, forceAdvanceRoom,
  ackBoardStep,
} from "../../lib/villageBoardTeamDb";
import { ensureDailyDice, applyEventEffect, DAILY_DICE, applyBoardReward } from "../../lib/villageBoardDb";
import { BOARD_LAYOUT, BOARD_SIZE, TILE_TYPES, BOARD_MODES, getModeTierCap, rollTileReward } from "../../lib/boardData";
import { MATERIALS } from "../../lib/monsterMaterials";
import { NORMAL_MATERIALS } from "../../lib/monsterEconomyCatalog";
import { RESOURCE_NAMES } from "../../lib/villageData";
import { calculateGatheringRound } from "../../lib/catVillageGathering";
import { addRoundArrows, addVillageLap } from "../../lib/db";
import { getCatSpeech } from "../cat/catSpeeches";
import {
  sfxTap, sfxSuccess, sfxCast,
  sfxBoardDiceRoll, sfxBoardDiceLand, sfxBoardStep, sfxBoardLand, sfxBoardLap,
  sfxGachaRoll, sfxGachaReveal, sfxBoardTile,
} from "../../lib/sound";
import BoardRewardPopup from "./BoardRewardPopup";
import CatVillageNavArt from "./CatVillageNavArt";

const ASSET = "/assets/board";
// 新怪材料（無 icon）＋舊材料（有 icon）；舊材料放後面覆蓋同 id，保留其 icon
const MAT_BY_ID = { ...Object.fromEntries(NORMAL_MATERIALS.map(m => [m.id, m])), ...Object.fromEntries(MATERIALS.map(m => [m.id, m])) };
const RES_ICON = { ore:"⛏️", melon:"🍈", fish:"🐟", meat:"🍖", driedfish:"🐠", can:"🥫", fur:"🧶", arrowdew:"💧" };
const SCORE_PAD = [["X",10],["10",10],["9",9],["8",8],["7",7],["6",6],["5",5],["3",3],["M",0]];
// 藥水品質
const POTION_QUALITY = { 1: "初級", 2: "中級", 3: "高級" };

// 落格特效顏色與爆散格子（與單機版 CatVillageBoard 同一套；動畫定義在 index.css 的 board-*）
const TILE_FX_COLOR = {
  start:"rgba(251,191,36,.9)", material:"rgba(74,222,128,.9)", mining:"rgba(148,163,184,.9)",
  monster:"rgba(248,113,113,.9)", arrowdew:"rgba(103,232,249,.9)", coins:"rgba(250,204,21,.95)",
  gacha:"rgba(232,121,249,.9)", potion:"rgba(129,140,248,.9)", chest:"rgba(251,146,60,.95)",
  catbond:"rgba(244,114,182,.9)", fate:"rgba(192,132,252,.9)", opp:"rgba(192,132,252,.9)",
};
const BURST_TILES = new Set(["chest", "coins", "material", "gacha", "arrowdew"]);

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
  const [diceLocked, setDiceLocked] = useState(false);
  const [landFx, setLandFx] = useState(null);
  const [hopNonce, setHopNonce] = useState(0);
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
  // 寫入失敗的重試觸發器：claim/交分失敗時 +1，讓對應 effect 重跑。
  // ⚠️ 不能只靠 ref 解鎖——大家都在等的時候不會再有新快照，effect 就再也不會被叫起來。
  const [retryNonce, setRetryNonce] = useState(0);
  const bumpRetry = useCallback(() => setTimeout(() => setRetryNonce(n => n + 1), 1500), []);
  const [submittingScore, setSubmittingScore] = useState(false);
  const shootSeqRef = useRef(0);
  const animatedSeqRef = useRef(-1);            // 已播完跟隨動畫的 lastMove.seq
  const [animatedSeq, setAnimatedSeq] = useState(-1); // 同上（state，供 pending UI 閘門）
  // 動畫進行中的旗標必須用 ref：同一個 Firestore 快照會同時觸發「跟隨動畫」與「boardPos 同步」
  // 兩個 effect，而 setAnimating(true) 在同一個 commit 內還沒生效，同步 effect 讀到的
  // animating 仍是舊值 false → 立刻把棋子設到終點，骰子還沒定格棋子就先走完了。
  const animatingRef = useRef(false);
  const ackedSeqRef = useRef(0);          // 已送出 ack 的 seq（避免重複寫）
  const [pendingEventMsg, setPendingEventMsg] = useState(null); // 事件結果訊息，等全員確認後才跳
  const [confirmExit, setConfirmExit] = useState(false); // 返回鍵確認（房主按下去＝解散全房，不能手滑）
  const [stuckLong, setStuckLong] = useState(false);     // 卡同一步超過 15 秒 → 才給房主解卡工具（避免動不動就踢人）

  const showToast = t => { setToast(t); setTimeout(() => setToast(null), 2400); };

  // 送出「我看完這一步了」。沒有東西可看的步驟要立刻 ack，否則全隊會互等。
  // 失敗就排重試——少一筆 ack 房主就永遠推不動（跟 settleClaims 同一個教訓）。
  const ackStep = useCallback((seq) => {
    const n = Math.max(0, Math.floor(Number(seq) || 0));
    if (!roomId || !myId || n <= 0) return;
    if (ackedSeqRef.current >= n) return;
    ackedSeqRef.current = n;
    ackBoardStep(roomId, myId, n).then(res => {
      if (!res?.ok) { ackedSeqRef.current = n - 1; bumpRetry(); }
    });
  }, [roomId, myId, bumpRetry]);

  // ── allPassed 等全域閘門變數（需在 useEffect 前計算，避免 TDZ）──
  const activeMems = room ? Object.entries(room.members || {}).filter(([, mm]) => mm) : [];
  const memberCount = room ? Object.values(room.members || {}).filter(Boolean).length : 0;
  const curSeq = room?.seq || 0;
  // 推進閘門＝「領取過」且「按過收下」。領取是動畫追上就自動寫入（保獎勵不丟），
  // ack 才代表人真的看完演出——房主因此不會在隊員還在看獎勵時就骰下一步。
  const claimedStep = mid => (room?.settleClaims?.[mid] || 0) >= curSeq || (room?.eventClaims?.[mid] || 0) >= curSeq;
  const ackedStep = mid => (room?.ackClaims?.[mid] || 0) >= curSeq;
  const passedStep = mid => claimedStep(mid) && ackedStep(mid);
  const hasPending = curSeq > 0 && ((room?.pendingSettle?.seq === curSeq) || (room?.pendingEvent?.seq === curSeq));
  const claimedN = activeMems.filter(([id]) => passedStep(id)).length;
  // forcedSeq＝房主按過「強制推進」：這一步不再等任何人（斷線的人就是沒領到）
  const forced = (room?.forcedSeq || 0) >= curSeq && curSeq > 0;
  const allPassed = !hasPending || forced || activeMems.every(([id]) => passedStep(id));
  // 還沒領取/OK 的人名單（讓大家知道是誰卡住）
  // 分開顯示「還在結算」與「還沒按收下」，房主才知道是網路慢還是有人在看獎勵沒按
  const nameOf = id => room?.members?.[id]?.name || "隊員";
  const waitingNames = hasPending ? activeMems.filter(([id]) => !passedStep(id)).map(([id]) => nameOf(id)) : [];
  const waitingAckNames = hasPending
    ? activeMems.filter(([id]) => claimedStep(id) && !ackedStep(id)).map(([id]) => nameOf(id))
    : [];

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

  // 初始化 animatedSeq（首次載入/重連：直接對齊當前 seq，不重播舊動畫、pending 立即可操作）
  useEffect(() => {
    if (room && animatedSeqRef.current < 0) {
      animatedSeqRef.current = room.seq || 0;
      setAnimatedSeq(room.seq || 0);
    }
  }, [room]);

  // 棋子跟隨動畫：依權威 lastMove 把棋子從 from 逐格走到 to（純視覺）。
  // 狀態已由 roomRollAndMove 原子更新，動畫卡住也不影響進度；動畫追上後才放行該 seq 的事件 UI。
  useEffect(() => {
    const lm = room?.lastMove;
    if (!lm || lm.seq <= animatedSeqRef.current) return;
    animatingRef.current = true;
    setAnimating(true);
    setDisplayPos(lm.from);
    let cur = lm.from, stepIv = null, landT = null;
    const finish = () => {
      animatedSeqRef.current = lm.seq;
      setAnimatedSeq(lm.seq);
      animatingRef.current = false;
      setAnimating(false);
      if (lm.lapped) {
        addVillageLap(myId).catch(() => {}); // 排行榜繞圈數：每位成員各自累計
        if (isHost) { // 繞圈獎勵（房主自己領）
          const lapMode = BOARD_MODES.find(x => x.id === lm.modeId) || BOARD_MODES[0];
          const rw = rollTileReward("start", { mode: lapMode, tierCap: getModeTierCap(lm.modeId, villageBuildings), tier: lm.tier, partyMult: lm.partyMult || 1 });
          applyBoardReward(myId, rw, { catId }).catch(() => {});
          setReward({ items: describeReward(rw), band: rw.band, tileType: "start" });
        }
      }
    };
    // 骰子在 roomRollAndMove 寫入後由 lastMove 驅動：這裡先播滾動音，定格再播落定音
    sfxBoardDiceRoll();
    setDiceLocked(false);
    const totalSteps = ((lm.to - lm.from) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE || BOARD_SIZE;
    let stepIdx = 0;
    const startT = setTimeout(() => {
      sfxBoardDiceLand();
      setDiceLocked(true);
      stepIv = setInterval(() => {
        cur = (cur + 1) % BOARD_SIZE;
        setDisplayPos(cur);
        setHopNonce(n => n + 1);
        if (cur === lm.to) {
          clearInterval(stepIv); stepIv = null;
          sfxBoardLand();
          setLandFx({ index: cur, type: BOARD_LAYOUT[cur], nonce: Date.now() });
          if (lm.lapped) sfxBoardLap();
          landT = setTimeout(finish, 700);
        } else {
          sfxBoardStep(stepIdx, totalSteps);
        }
        stepIdx += 1;
      }, 240);
    }, 700);
    return () => { clearTimeout(startT); if (stepIv) clearInterval(stepIv); if (landT) clearTimeout(landT); };
  }, [room?.lastMove?.seq]); // eslint-disable-line

  // 落格特效播完就清掉，否則再次踩到同一格時 class 沒變化、動畫不會重播
  useEffect(() => {
    if (!landFx) return undefined;
    const t = setTimeout(() => setLandFx(null), 700);
    return () => clearTimeout(t);
  }, [landFx]);

  // 被房主移出房間 → 立刻退回大廳（不然會一直看著一個自己已不在其中的房間）
  useEffect(() => {
    if (!room || !myId || room.status !== "active") return;
    if (room.members && !room.members[myId]) {
      showToast("你已被移出房間");
      joinedRef.current = false;
      setRoomId(null); setRoom(null);
    }
  }, [room?.members, myId, room?.status]); // eslint-disable-line

  // 卡在同一步超過 15 秒 → 房主才看得到「移除隊員／強制推進」，避免網路慢就被踢
  useEffect(() => {
    const blocked = (!!room?.pendingShoot) || (hasPending && !allPassed);
    if (!blocked) { setStuckLong(false); return; }
    setStuckLong(false);
    const t = setTimeout(() => setStuckLong(true), 15000);
    return () => clearTimeout(t);
  }, [room?.pendingShoot, hasPending, allPassed, curSeq]);

  // 動畫閘門的保險絲：claim/翻牌都要等 animatedSeq 追上 room.seq，
  // 但手機切到背景時 setInterval/setTimeout 會被瀏覽器節流甚至凍結 → 動畫走不完 →
  // 這個人永遠不 claim → 全隊卡住等他。超時就直接對齊（跳過動畫，狀態本來就是權威的）。
  useEffect(() => {
    if (!room) return;
    const seq = room.seq || 0;
    if (animatedSeq >= seq) return;
    const t = setTimeout(() => {
      animatedSeqRef.current = seq;
      setAnimatedSeq(seq);
      animatingRef.current = false;
      setAnimating(false);
    }, 9000); // 正常動畫最長約 3 秒（走 6 格），9 秒還沒完就是被凍結了
    return () => clearTimeout(t);
  }, [room?.seq, animatedSeq]); // eslint-disable-line

  // boardPos 同步（重整/非動畫時對齊權威位置——desync 自我修復）
  useEffect(() => { if (room && !animatingRef.current) setDisplayPos(room.boardPos || 0); }, [room?.boardPos, animating]);

  // 成員自動 claim 結算獎勵
  useEffect(() => {
    if (!room?.pendingSettle || !myId) return;
    const seq = room.pendingSettle.seq;
    if (seq > animatedSeq) return; // 等棋子動畫走到才結算（先移動、後結算）
    if ((room.settleClaims?.[myId] || 0) >= seq || lastSettleRef.current >= seq) return;
    lastSettleRef.current = seq;
    const isCatBond = room.pendingSettle.tileType === "catbond";
    claimBoardSettle(roomId, myId, { villageBuildings, catId }).then(res => {
      // 寫入失敗（8 人同時寫同一份房間文件會撞、離線也會失敗）→ 解鎖並排重試。
      // 不重試的話 settleClaims 少我一筆，房主的 allPassed 永遠不成立 → 全隊卡死等我。
      if (!res?.ok && res?.reason !== "已領取") {
        lastSettleRef.current = seq - 1;
        bumpRetry();
        return;
      }
      if (!(res?.ok && res.reward)) { ackStep(seq); return; }
      sfxBoardTile(room.pendingSettle.tileType);   // 每個格子有自己的聲音
      // 貓貓羈絆格：讓裝備中的陪練貓出來說句話 + 顯示經驗/羈絆
      if (isCatBond && catId) {
        setCatBondPop({
          seq,
          catId,
          name: profile?.equippedCat?.name || "貓貓",
          speech: getCatSpeech(catId, "encourage"),
          catXP: res.reward.catXP || 0,
          catBond: res.reward.catBond || 0,
        });
      } else {
        const items = describeReward(res.reward);
        // 清單為空（例如只加了看不見的統計）就沒有演出可看，直接 ack
        if (items.length) setReward({ items, band: res.reward.band, tileType: room.pendingSettle.tileType, seq });
        else ackStep(seq);
      }
    });
  }, [room?.pendingSettle?.seq, room?.settleClaims, myId, roomId, catId, profile, animatedSeq, retryNonce, ackStep]); // eslint-disable-line

  // 命運/機會事件卡：顯示 + 成員 claim（房主另處理共享棋效果）
  useEffect(() => {
    if (!room?.pendingEvent || !myId) return;
    const seq = room.pendingEvent.seq;
    if (seq > animatedSeq) return; // 等棋子動畫走到才翻牌
    if (lastEventRef.current >= seq) return;
    lastEventRef.current = seq;
    setCard({ event: room.pendingEvent.event, flipped: false });
    sfxGachaRoll();                         // 卡背飛入
    setTimeout(() => {
      setCard(c => c && { ...c, flipped: true });
      sfxGachaReveal();                     // 翻面瞬間
    }, 550);
  }, [room?.pendingEvent?.seq, myId, animatedSeq]);

  // 射箭格：被隨機指派的射手開射擊介面；交分後收起。非射手只會看到「射箭中」等待。
  useEffect(() => {
    const ps = room?.pendingShoot;
    if (!ps || !myId) {
      if (shootSeqRef.current) { shootSeqRef.current = 0; setShoot(null); setShootResult(null); }
      return;
    }
    if (ps.seq > animatedSeq) return; // 等棋子動畫走到才開射擊介面
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
  }, [room?.pendingShoot, myId, animatedSeq]);

  // 房主：所有指派射手都交分後 → 結算平均分數。
  // ⚠️ 失敗要自己重試：這步只由快照驅動，若 finalize 撞交易失敗，之後不會再有新快照來叫醒它，
  //    全隊就永遠停在「射箭中」。所以失敗就每 2.5 秒重試到成功（元件卸載/狀態變了就停）。
  useEffect(() => {
    if (!isHost || !room?.pendingShoot) return;
    const ps = room.pendingShoot;
    if (Object.keys(ps.scores || {}).length < (ps.shooters?.length || 1)) return;
    let stopped = false;
    let timer = null;
    const attempt = () => {
      finalizeBoardShoot(roomId, myId)
        .then(r => { if (!stopped && !r?.done) timer = setTimeout(attempt, 2500); })
        .catch(() => { if (!stopped) timer = setTimeout(attempt, 2500); });
    };
    attempt();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [isHost, room?.pendingShoot, roomId, myId]);

  // 全員領完當前這步 → 房主清空 pendingEvent/pendingSettle，
  // 否則殘留在房間文件：離開再回來（lastEventRef 重置）會重複看到同一張命運卡/結算。
  useEffect(() => {
    if (!isHost || !room) return;
    const seq = room.seq || 0;
    const hasPend = seq > 0 && ((room.pendingEvent?.seq === seq) || (room.pendingSettle?.seq === seq));
    if (hasPend && allPassed) clearRoomPending(roomId, myId).catch(() => bumpRetry());
  }, [isHost, room, allPassed, roomId, myId, retryNonce]); // eslint-disable-line

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

  // 🔄 卡住了？重新同步：不用重整頁面就能做到「重整」會做的事。
  // 卡住的往往是**自己這台的本地閘門**（動畫沒走完、claim 鎖住、卡片停在 waiting），
  // 房間文件本身是權威且正確的——所以這裡只重置本地狀態並重試自己的寫入。
  const resync = useCallback((opts = {}) => {
    const seq = room?.seq || 0;
    animatedSeqRef.current = seq;
    setAnimatedSeq(seq);
    animatingRef.current = false;
    setAnimating(false);
    setRolling(false);
    setCard(c => (c?.waiting ? null : c));
    // 解開 claim 鎖 → retryNonce 讓 claim effect 重跑。
    // 已經領過的會被 settleClaims/eventClaims 擋掉，不會重複領；只有真的沒寫進去的才補上。
    const iClaimed = (room?.settleClaims?.[myId] || 0) >= seq || (room?.eventClaims?.[myId] || 0) >= seq;
    if (!iClaimed) { lastSettleRef.current = 0; lastEventRef.current = 0; }
    setRetryNonce(n => n + 1);
    // ⚠️ 只有「全員都領完」才清 pending，否則會把還沒領的隊員的獎勵直接抹掉
    if (isHost && allPassed) clearRoomPending(roomId, myId).catch(() => {});
    if (!opts.silent) showToast("已重新同步");   // 自動同步不吵玩家
  }, [room, myId, isHost, allPassed, roomId]); // eslint-disable-line

  // 🤖 自動同步看門狗（2026-07-26：不要再讓玩家自己按 🔄）
  //
  // ⚠️ 這裡**刻意不去輪詢 Firestore**：房間是 onSnapshot 推送的，資料一直都有進來，
  //    每 3 秒撈一次不會更新鮮，只會讓每個人每分鐘多 20 次讀取（8 人房＝每分鐘 160 次）。
  //    真正卡住的是**本機**：動畫閘門被背景分頁凍結、claim 寫入失敗沒重試。
  //    所以看門狗只跑 resync 的本地邏輯 ＋ 重試自己的寫入 → **0 次額外讀取**。
  const autoSyncedRef = useRef(0);
  useEffect(() => {
    const seq = room?.seq || 0;
    const iClaimed = (room?.settleClaims?.[myId] || 0) >= seq || (room?.eventClaims?.[myId] || 0) >= seq;
    const blocked = (!!room?.pendingShoot) || (hasPending && !allPassed) || animatedSeq < seq;
    if (!blocked || autoSyncedRef.current >= seq) return;
    const t = setTimeout(() => { autoSyncedRef.current = seq; if (!iClaimed) resync({ silent: true }); }, 6000);
    return () => clearTimeout(t);
  }, [room?.seq, room?.pendingShoot, hasPending, allPassed, animatedSeq, myId, resync]); // eslint-disable-line

  // 從背景切回前景 → 立刻同步一次（手機鎖屏後最常見的卡住情境）
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) resync({ silent: true }); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [resync]);

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
    setConfirmExit(false);
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
    if (!shootResult || !shoot || submittingScore) return;
    const { labels } = shootResult;
    const t = shoot.type;
    const score = labels.reduce((s, l) => s + (l === "X" ? 10 : Number(l) || 0), 0);
    const { progress } = t === "mining" ? calculateGatheringRound(labels) : { progress: 0 };

    // ⚠️ 必須「確認寫進去了」才收 UI。之前是先收 UI 再送、而且不看回傳值——
    //    交分失敗（多人同時寫房間文件會撞）時射手以為交了，房主永遠收不齊，全隊卡在「射箭中 1/2」。
    setSubmittingScore(true);
    const res = await submitBoardShootScore(roomId, myId, { score, progress });
    setSubmittingScore(false);
    if (!res?.ok && res?.reason !== "已提交") {
      showToast(`送出失敗：${res?.reason || "請再按一次確認"}`);
      return; // 保留結果畫面，讓射手直接再按一次
    }
    shootSeqRef.current = 0;
    setShootResult(null);
    setShoot(null);
    addRoundArrows(myId, 6).catch(() => {}); // 這 6 箭算實際射手的今日/終身箭數
  }, [shootResult, shoot, roomId, myId, submittingScore]); // eslint-disable-line

  // 事件卡確認：成員 claim 資源；房主另套用共享棋效果
  // 卡片設為 waiting 狀態直到全員領取，防止房主跳過事件、隊員被拉走
  const confirmCard = useCallback(async () => {
    const ev = card?.event;
    if (!ev) return;
    // 設為 waiting 不馬上消失，讓隊員有時間確認
    setCard(c => c && c.event ? { event: c.event, flipped: true, waiting: true } : null);
    const res = await claimBoardEvent(roomId, myId, { villageBuildings, catId });
    // 失敗 → 把卡片退回可按狀態，否則 eventClaims 少我一筆，卡片永遠停在 waiting、全隊等我
    if (!res?.ok && res?.reason !== "已領取") {
      setCard(c => c && { ...c, waiting: false });
      showToast(`領取失敗：${res?.reason || "請再按一次"}`);
      return;
    }
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
      // 按下確認就是「我看完了」，事件卡沒有另一個關閉動作
      ackStep(room?.pendingEvent?.seq || curSeq);
    }
    if (isHost) {
      const r = await applyEventEffect(myId, ev, { villageBuildings, catId });
      if (r.kind === "move") await roomApplyBoardEffect(roomId, myId, { pos: (((room.boardPos + r.steps) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE });
      else if (r.kind === "teleport") { for (let d = 1; d <= BOARD_SIZE; d++) { const idx = (room.boardPos + d) % BOARD_SIZE; if (BOARD_LAYOUT[idx] === r.tile) { await roomApplyBoardEffect(roomId, myId, { pos: idx }); break; } } }
      else if (r.kind === "dice") await roomApplyBoardEffect(roomId, myId, { diceDelta: r.delta });
    }
  }, [card, roomId, myId, isHost, room, catId, ackStep, curSeq]);

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
            <div className="text-amber-100 font-black">組隊探索大廳</div>
            <div className="w-9" />
          </div>
          <div className="relative isolate overflow-hidden rounded-3xl border border-amber-300/35 mb-4 min-h-[148px] shadow-xl">
            <img src="/ui/cat-village/explore-map.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#160b04]/95 via-[#241207]/55 to-transparent" />
            <div className="relative flex min-h-[148px] items-center gap-3 p-5">
              <CatVillageNavArt name="village" size={70} />
              <div>
                <div className="text-xl font-black text-amber-50">和其他玩家一起出發</div>
                <div className="mt-1 max-w-[240px] text-xs font-bold leading-relaxed text-amber-100/75">
                  建立指定地圖的房間，或從下方搜尋正在等待隊友的隊伍。
                </div>
              </div>
            </div>
          </div>
          {err && <div className="mb-3 text-rose-300 text-xs font-bold">{err}</div>}
          <div className="rounded-2xl bg-black/30 border border-amber-500/25 p-4 mb-4">
            <div className="flex items-center gap-2 text-amber-100 font-black mb-3">
              <CatVillageNavArt name="tasks" size={42} />
              <div>
                <div className="text-sm">建立探索隊伍</div>
                <div className="text-[10px] font-bold text-amber-200/55">先選採集地圖與階級</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {BOARD_MODES.map(mo => (
                <button key={mo.id} onClick={() => { setSelMode(mo.id); setSelTier(1); }}
                  className={`relative isolate min-h-[94px] overflow-hidden rounded-xl border-2 text-left shadow-md transition active:scale-[.98] ${mo.id===selMode ? "border-amber-300 ring-2 ring-amber-200/20" : "border-amber-500/20"}`}>
                  <img src={`${ASSET}/map_${mo.id}.webp`} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />
                  {mo.id === selMode && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-amber-300 text-[10px] font-black text-amber-950">✓</span>}
                  <span className="relative flex min-h-[90px] flex-col justify-end p-2.5">
                    <span className="text-xs font-black text-white">{mo.familyName}</span>
                    <span className="text-[10px] font-bold text-amber-100/70">{mo.name}・{mo.resourceName}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tiers.map(t => <button key={t} onClick={() => setSelTier(t)} className={`px-3 py-1.5 rounded-lg text-xs font-black border ${t===selTier?"bg-amber-400 text-slate-900 border-amber-300":"bg-black/30 text-amber-100 border-amber-500/20"}`}>T{t}</button>)}
            </div>
            <button disabled={busy || tiers.length===0} onClick={create} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black disabled:opacity-40">建立 {m.familyName} T{selTier} 房間</button>
          </div>
          <div className="rounded-2xl bg-black/30 border border-amber-500/25 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CatVillageNavArt name="village" size={42} />
              <div className="flex-1">
                <div className="text-sm font-black text-amber-100">搜尋可加入的隊伍</div>
                <div className="text-[10px] font-bold text-amber-200/55">目前找到 {openRooms.length} 間等待中的房間</div>
              </div>
            </div>
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

  // 返回確認彈窗（等待室與遊戲中共用）。房主與隊員的後果完全不同，文案要講清楚。
  const exitDialog = confirmExit ? (
    <div className="fixed inset-0 z-[240] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.72)" }}>
      <div className="w-full max-w-xs rounded-3xl border border-amber-500/30 p-5 text-center" style={{ background: "linear-gradient(160deg,#2a1a0c,#150c05)" }}>
        <div className="text-4xl mb-2">{isHost ? "⚠️" : "🚪"}</div>
        <div className="text-amber-200 font-black text-base mb-1">{isHost ? "解散整間房間？" : "確定要離開？"}</div>
        <div className="text-amber-100/70 text-xs leading-relaxed mb-4">
          {isHost
            ? `你是房主，離開會直接解散房間，${Math.max(0, memberCount - 1)} 位隊友會一起被踢出，這局的進度不會保留。`
            : room.status === "waiting"
              ? "離開等待室後，可以再從大廳加入這間房。"
              : <>⚠️ 遊戲已經開始，離開後<span className="text-red-300 font-black">無法再回到這一局</span>（重連只找得回還在名單內的房間）。</>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setConfirmExit(false)} className="flex-1 py-2.5 rounded-2xl bg-amber-400 text-slate-900 font-black text-sm active:scale-95">繼續遊戲</button>
          <button onClick={exitRoom} className="flex-1 py-2.5 rounded-2xl bg-black/40 border border-red-400/40 text-red-300 font-black text-sm active:scale-95">
            {isHost ? "解散" : "離開"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── 等待室 ──
  if (room.status === "waiting") {
    const mems = Object.entries(room.members || {}).filter(([, mm]) => mm);
    const wm = BOARD_MODES.find(x => x.id === room.mode) || BOARD_MODES[0];
    return (
      <div className="fixed inset-0 z-[200] overflow-y-auto" style={{ backgroundColor:"#140a04", backgroundImage:`linear-gradient(rgba(18,10,4,0.85),rgba(12,7,3,0.94)), url(${ASSET}/board_bg.webp)`, backgroundSize:"cover" }}>
        <div className="w-full max-w-lg mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setConfirmExit(true)} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
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
        {exitDialog}
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
  // 誰卡住了：射箭中＝還沒交分的射手；等領取＝還沒 claim 的隊員（房主自己不列，他不能踢自己）
  const blockingList = (shootWaiting
    ? (room.pendingShoot.shooters || []).filter(id => room.pendingShoot.scores?.[id] == null)
    : hasPending && !allPassed ? activeMems.filter(([id]) => !passedStep(id)).map(([id]) => id) : []
  ).filter(id => id !== myId).map(id => ({ id, name: room.members?.[id]?.name || "隊員" }));

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center overflow-y-auto"
      style={{ backgroundColor:"#140a04", backgroundImage:`linear-gradient(rgba(18,10,4,0.72),rgba(12,7,3,0.9)), url(${ASSET}/board_bg.webp)`, backgroundSize:"cover", backgroundPosition:"center" }}>
      <div className="w-full max-w-lg flex items-center justify-between px-4 py-3">
        {/* 返回一律先確認：房主＝解散全房、隊員＝退出這局，兩者都不能手滑 */}
        <button onClick={() => setConfirmExit(true)} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
        <div className="text-amber-100 font-black text-sm">👥 房號 {room.code}・{memberCount}人</div>
        <div className="flex items-center gap-1.5">
          {/* 卡住時不用重整頁面的逃生門（重整會做的事，這顆按鈕都做） */}
          <button onClick={() => resync()} title="卡住了？重新同步" className="rounded-xl bg-black/40 border border-amber-400/30 px-2 py-1 text-amber-200/80 text-xs font-black active:scale-95">🔄</button>
          <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-amber-200 text-xs font-black">🎲 {room?.hostDiceLeft ?? hostDice}</div>
        </div>
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

      {/* 房主解卡工具：卡同一步 15 秒以上才出現（隊員關 App／斷線時，全隊會永遠互等）*/}
      {isHost && stuckLong && (
        <div className="w-full max-w-lg px-3 mb-1">
          <div className="rounded-2xl bg-black/40 border border-red-400/25 px-3 py-2">
            <div className="text-red-200/90 text-[11px] font-black mb-1.5">
              ⏳ 卡住超過 15 秒{blockingList.length > 0 ? `：等 ${blockingList.map(m => m.name).join("、")}` : ""}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {blockingList.map(m => (
                <button key={m.id} onClick={() => kickBoardMember(roomId, myId, m.id).then(r => showToast(r.ok ? `已移除 ${m.name}` : r.reason || "移除失敗"))}
                  className="rounded-xl bg-black/50 border border-red-400/40 px-2.5 py-1 text-red-300 text-[11px] font-black active:scale-95">
                  移除 {m.name}
                </button>
              ))}
              <button onClick={() => forceAdvanceRoom(roomId, myId).then(r => showToast(r.ok ? "已強制推進（沒完成的人這步就沒領到）" : r.reason || "推進失敗"))}
                className="rounded-xl bg-amber-500/80 text-slate-900 px-2.5 py-1 text-[11px] font-black active:scale-95">
                ⏭ 強制推進
              </button>
            </div>
            <div className="text-amber-100/45 text-[10px] mt-1.5">移除＝把人請出這一局（遊戲中無法再加入，要等下一局）；強制推進＝不等了，他這步沒領到就沒領到，人還在房裡，下一步能繼續玩。</div>
          </div>
        </div>
      )}

      <div className="w-full max-w-lg p-3">
        <div className="w-full rounded-[26px] p-2.5" style={{ background:"linear-gradient(145deg,#d4a017,#8a5a12)", boxShadow:"0 12px 34px rgba(0,0,0,.6), inset 0 0 0 3px rgba(253,230,138,.55), inset 0 0 0 6px rgba(120,53,15,.5)" }}>
          <div className="grid aspect-square w-full rounded-2xl p-1.5" style={{ gridTemplateColumns:"repeat(8,1fr)", gridTemplateRows:"repeat(8,1fr)", gap:4, background:"linear-gradient(160deg,#2a1a0c,#1a0f06)", boxShadow:"inset 0 0 24px rgba(0,0,0,.7)" }}>
            <div style={{ gridColumn:"2 / 8", gridRow:"2 / 8" }} className="rounded-xl overflow-hidden border border-amber-500/30">
              <div className="w-full h-full rounded-xl flex flex-col items-center justify-center text-center p-2" style={{ backgroundColor: mode.palette?.[1]||"#0f172a", backgroundImage:`linear-gradient(160deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55)), url(${ASSET}/map_${mode.id}.webp)`, backgroundSize:"cover", backgroundPosition:"center" }}>
                <div className="text-amber-100 font-black text-lg drop-shadow">{mode.name}</div>
                <div className="text-amber-300/70 text-[11px] mt-1">已繞 {room.lapCount || 0} 圈</div>
                {shootWaiting ? (
                  <>
                    <div className="mt-3 text-amber-200/85 text-xs font-black">🎯 {shootNames.join("、")} 射箭中…（{shootDone}/{room.pendingShoot.shooters.length}）</div>
                    <div className="mt-1 text-amber-100/50 text-[10px]">還沒射：{(room.pendingShoot.shooters || []).filter(id => room.pendingShoot.scores?.[id] == null).map(id => room.members?.[id]?.name || "隊員").join("、") || "—"}</div>
                  </>
                ) : isHost ? (
                  <>
                    <button onClick={hostRoll} disabled={!canRoll} className="mt-3 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-sm shadow-lg disabled:opacity-40 active:scale-95">
                      {rolling ? "🎲 前進中…" : hostDice <= 0 ? "骰子用完了" : !allPassed ? `⏳ 等隊員領取 ${claimedN}/${memberCount}` : "🎲 房主擲骰"}
                    </button>
                    {!allPassed && waitingNames.length > 0 && (
                      <div className="mt-1 text-amber-100/60 text-[10px]">
                        {waitingAckNames.length === waitingNames.length ? "還在看獎勵：" : "還沒 OK："}{waitingNames.join("、")}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mt-3 text-amber-200/70 text-xs">{hasPending && !passedStep(myId) ? "領取你的獎勵…" : "等待房主擲骰…"}</div>
                    {!allPassed && waitingNames.length > 0 && (
                      <div className="mt-1 text-amber-100/60 text-[10px]">
                        {waitingAckNames.length === waitingNames.length ? "還在看獎勵：" : "還沒 OK："}{waitingNames.join("、")}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {BOARD_LAYOUT.map((type, i) => {
              const { row, col } = gridPos(i);
              const here = displayPos === i;
              const landed = landFx?.index === i;
              return (
                <div key={i} style={{ gridColumn:col, gridRow:row, "--board-fx": TILE_FX_COLOR[type] || "rgba(251,191,36,.9)" }}
                  className={`relative rounded-lg flex items-center justify-center border ${here ? "ring-2 ring-yellow-300 scale-105 z-10" : "border-amber-500/20"} ${landed ? "board-land-flash" : ""}`}>
                  <div className={`w-full h-full rounded-lg flex items-center justify-center ${tileBg(type)}`}>
                    <span className={landed && type === "chest" ? "board-chest-shake" : undefined}>
                      <TileIcon type={type} size={24} />
                    </span>
                    {here && <div key={hopNonce} className="absolute -top-1 -right-1 text-base board-hop">🐱</div>}
                  </div>
                  {landed && BURST_TILES.has(type) && <span key={landFx.nonce} className="board-burst" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[210] rounded-2xl bg-black/85 border border-amber-400/40 px-4 py-2.5 text-amber-100 text-sm font-black">{toast}</div>}

      {diceAnim != null && (
        <div className="fixed inset-0 z-[215] flex items-center justify-center pointer-events-none">
          <div className={`w-32 h-32 rounded-3xl bg-gradient-to-br from-amber-50 to-amber-200 border-4 border-amber-400 flex items-center justify-center shadow-2xl ${diceLocked ? "board-dice-settle" : "board-dice-tumble"}`} style={{ boxShadow:"0 0 52px rgba(251,146,60,.9)" }}>
            <span className="text-7xl font-black" style={{ color:"#c2410c" }}>{diceAnim}</span>
          </div>
        </div>
      )}

      {/* 獎勵演出（三段：前置動畫→逐項顯示→領取，與單機版共用元件） */}
      <BoardRewardPopup
        reward={reward}
        tileType={reward?.tileType}
        onClose={() => { ackStep(reward?.seq || curSeq); setReward(null); }}
        zIndex={215}
      />

      {catBondPop && (
        <div className="fixed inset-0 z-[218] bg-black/75 flex items-center justify-center p-4" onClick={() => { ackStep(catBondPop?.seq || curSeq); setCatBondPop(null); }}>
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
            <button onClick={() => { ackStep(catBondPop?.seq || curSeq); setCatBondPop(null); }} className="w-full py-2.5 rounded-xl bg-fuchsia-400 text-slate-900 font-black active:scale-95">摸摸貓！</button>
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
            <button onClick={confirmShootResult} disabled={submittingScore}
              className={`mt-5 w-full py-3 rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all ${submittingScore ? "bg-slate-600 text-slate-300" : "bg-amber-400 text-slate-900 hover:bg-amber-300"}`}>
              {submittingScore ? "送出中…" : "✓ 確認領取"}
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
            <div className="[perspective:1000px] board-card-fly-in">
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
      {exitDialog}
    </div>
  );
}
