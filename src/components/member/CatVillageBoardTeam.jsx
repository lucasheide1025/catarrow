// src/components/member/CatVillageBoardTeam.jsx
// 貓貓村探索地圖：組隊版（Phase 3）。全員共享一顆棋、只吃房主骰子、成員各自 claim。
// 旅程＝「房主的旅程」（room.journeySeed 確定性重算，組隊吃房主進度）；
// 2.5D 格子 + 76px + 鏡頭雙軸跟隨；分岔路口＝全員投票（票多者勝）。
// 旅程規則與單機版一致：只有怪物格/終點 Boss 射箭、採集不射箭、fate/opp 純金幣不翻卡。
// 規格見 .trellis/tasks/08-07-village-board-journey-redesign/design.md。
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  createBoardRoom, joinBoardRoom, subscribeBoardRoom, leaveBoardRoom, disbandBoardRoom,
  findReconnectableBoardRoom, startBoardRoom, roomRollAndMove,
  claimBoardSettle, partyMultOf, subscribeOpenBoardRooms,
  submitBoardShootScore, finalizeBoardShoot, clearRoomPending, kickBoardMember, forceAdvanceRoom,
  ackBoardStep, voteForkPath, resolveFork,
} from "../../lib/villageBoardTeamDb";
import { ensureDailyDice, refillBoardDice, addBoardDice } from "../../lib/villageBoardDb";
import { useAuth } from "../../hooks/useAuth";
import { TILE_TYPES, BOARD_MODES, getModeTierCap, scoreToBand, MONSTER_BAND_TABLE, JOURNEY_BUFF_INFO, buffActive, buffValueLabel } from "../../lib/boardData";
import { JOURNEY_MAP_META, generateJourney, lockedJourneyTier } from "../../lib/boardJourney";
import { MATERIALS } from "../../lib/monsterMaterials";
import { NORMAL_MATERIALS } from "../../lib/monsterEconomyCatalog";
import { RESOURCE_NAMES } from "../../lib/villageData";
import { addRoundArrows, addVillageLap } from "../../lib/db";
import { getCatSpeech } from "../cat/catSpeeches";
import { getObstacleForTier } from "../../lib/councilMonsters";
import {
  sfxTap, sfxSuccess, sfxCast,
  sfxBoardDiceRoll, sfxBoardDiceLand, sfxBoardStep, sfxBoardLand, sfxBoardLap, sfxBoardTile,
} from "../../lib/sound";
import BoardRewardPopup from "./BoardRewardPopup";
import CatVillageNavArt from "./CatVillageNavArt";
import TileDemo from "./TileDemo";
import BossDuel from "./BossDuel";
import BoardGuide from "./BoardGuide";
import CardArtImage from "./cards/CardArt";
import { teamExplorationCompletionOperation } from "../../lib/villageGoalContribution";

const ASSET = "/assets/board";
// 旅程畫布尺寸（與單機版同一套）：76px 格子、88×96 間距、鏡頭雙軸跟隨
const CELL_W = 88;
const CELL_H = 96;
const TILE = 76;
// 新怪材料（無 icon）＋舊材料（有 icon）；舊材料放後面覆蓋同 id，保留其 icon
const MAT_BY_ID = { ...Object.fromEntries(NORMAL_MATERIALS.map(m => [m.id, m])), ...Object.fromEntries(MATERIALS.map(m => [m.id, m])) };
const RES_ICON = { ore: "⛏️", melon: "🍈", fish: "🐟", meat: "🍖", driedfish: "🐠", can: "🥫", fur: "🧶", arrowdew: "💧" };
const SCORE_PAD = [["X", 10], ["10", 10], ["9", 9], ["8", 8], ["7", 7], ["6", 6], ["5", 5], ["3", 3], ["M", 0]];
// 藥水品質
const POTION_QUALITY = { 1: "初級", 2: "中級", 3: "高級" };

// 落格特效顏色與爆散格子（與單機版同一套；動畫定義在 index.css 的 board-*）
const TILE_FX_COLOR = {
  start: "rgba(251,191,36,.9)", material: "rgba(74,222,128,.9)", mining: "rgba(148,163,184,.9)",
  monster: "rgba(248,113,113,.9)", arrowdew: "rgba(103,232,249,.9)", coins: "rgba(250,204,21,.95)",
  gacha: "rgba(232,121,249,.9)", potion: "rgba(129,140,248,.9)", chest: "rgba(251,146,60,.95)",
  catbond: "rgba(244,114,182,.9)", fate: "rgba(192,132,252,.9)", opp: "rgba(192,132,252,.9)",
  camp: "rgba(74,222,128,.9)", empower: "rgba(103,232,249,.9)", catmate: "rgba(244,114,182,.9)",
  trap: "rgba(248,113,113,.9)", shortcut: "rgba(52,211,153,.9)", market: "rgba(251,146,60,.95)",
  scenery: "rgba(163,230,53,.9)", fork: "rgba(192,132,252,.9)", boss: "rgba(248,113,113,1)",
  cardgacha: "rgba(232,121,249,1)",
};
const BURST_TILES = new Set(["chest", "coins", "material", "gacha", "arrowdew", "boss"]);

function tileBg(type) {
  return {
    start: "bg-amber-300/25", material: "bg-emerald-500/20", mining: "bg-orange-500/20",
    monster: "bg-rose-500/25", arrowdew: "bg-sky-500/20", coins: "bg-yellow-500/20",
    gacha: "bg-pink-500/20", potion: "bg-lime-500/20", chest: "bg-amber-500/25",
    catbond: "bg-fuchsia-500/20", fate: "bg-orange-500/25", opp: "bg-cyan-500/25",
    camp: "bg-emerald-500/20", empower: "bg-cyan-500/20", catmate: "bg-pink-500/20",
    trap: "bg-rose-500/25", shortcut: "bg-teal-500/20", market: "bg-amber-500/25",
    scenery: "bg-lime-500/20", fork: "bg-purple-500/25", boss: "bg-rose-600/30",
    cardgacha: "bg-fuchsia-500/25",
  }[type] || "bg-slate-700/30";
}

// tile 圖示：族專屬 2.5D 圖（tile_<mapId>_<type>.webp）→ 共用圖（tile_<type>.webp）→ emoji
function TileIcon({ type, size = 30, mapId = null }) {
  const [useBase, setUseBase] = useState(false);
  const [failed, setFailed] = useState(false);
  const meta = TILE_TYPES[type] || {};
  const src = useBase || !mapId ? `${ASSET}/tile_${type}.webp` : `${ASSET}/tile_${mapId}_${type}.webp`;
  if (!failed) {
    return <img src={src} alt="" width={size} height={size}
      onError={() => { if (mapId && !useBase) setUseBase(true); else setFailed(true); }}
      className="object-contain" draggable={false} />;
  }
  return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{meta.icon || "❔"}</span>;
}

// 🏗️ 怪物格／終點 Boss＝該採集點的「採集任務障礙」（08-07 玩家要求：與議會廳採集同一套 COUNCIL_MONSTERS）

// 解析 ore_t1 → { resource:'ore', tier:'T1' }，無 tier 的 key 原樣回傳
function parseTieredKey(key) {
  const m = key?.match(/^(.+)_t(\d+)$/);
  return m ? { resource: m[1], tier: `T${m[2]}` } : null;
}

function describeReward(rw) {
  if (!rw) return [];
  const out = [];
  if (rw.coins) out.push({ icon: "🪙", name: "金幣", amount: rw.coins });
  if (rw.arrowdew) out.push({ icon: "💧", name: "箭露", amount: rw.arrowdew });
  if (rw.gachaToken) out.push({ icon: "🎰", name: "扭蛋幣", amount: rw.gachaToken });
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
  const myId = profile?.id;
  const villageBuildings = profile?.village?.buildings || {};
  const catId = profile?.equippedCat?.catId || null;
  // 教練（admin）測試工具：前台可直接補骰（＋1／重置為每日上限）
  const { role } = useAuth();
  const isAdmin = role === "admin";

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
  const [animating, setAnimating] = useState(false);
  const [diceAnim, setDiceAnim] = useState(null);
  const [diceLocked, setDiceLocked] = useState(false);
  const [landFx, setLandFx] = useState(null);
  const [hopNonce, setHopNonce] = useState(0);
  const [shoot, setShoot] = useState(null);   // 被指派的射手 { type, seq }
  const [arrows, setArrows] = useState([]);   // 6 箭標籤（"X","10","9"...）
  const [shootResult, setShootResult] = useState(null); // { type, score, ratio, band, labels }
  const [reward, setReward] = useState(null);
  const [cardGachaResult, setCardGachaResult] = useState(null);   // 🃏 抽卡房結果：{views, seq}
  const [toast, setToast] = useState(null);
  const [showTeamSummary, setShowTeamSummary] = useState(false);
  const [catBondPop, setCatBondPop] = useState(null);
  const [buffHelp, setBuffHelp] = useState(false);   // 加成說明彈窗（buff chips 點開）
  const [boardGuide, setBoardGuide] = useState(false);   // 📖 探索地圖說明書（完整玩法總覽）
  const [gatherTeam, setGatherTeam] = useState(null); // 格子動作演示：null｜"mining"｜"material"｜"chest"｜"arrowdew"
  // 演示動畫狀態：同一 seq 只開一次；done 後 effect 才會真的送 claim（不 claim 全隊卡死）。
  const gatherAnimRef = useRef({ seq: 0, done: false });
  const lastSettleRef = useRef(0);
  // 寫入失敗的重試觸發器：claim/交分失敗時 +1，讓對應 effect 重跑。
  // ⚠️ 不能只靠 ref 解鎖——大家都在等的時候不會再有新快照，effect 就再也不會被叫起來。
  const [retryNonce, setRetryNonce] = useState(0);
  const bumpRetry = useCallback(() => setTimeout(() => setRetryNonce(n => n + 1), 1500), []);
  const [submittingScore, setSubmittingScore] = useState(false);
  const shootSeqRef = useRef(0);
  const animatedSeqRef = useRef(-1);            // 已播完跟隨動畫的 lastMove.seq
  const [animatedSeq, setAnimatedSeq] = useState(-1);
  // 動畫進行中的旗標必須用 ref：同一個 Firestore 快照會同時觸發「跟隨動畫」與「boardPos 同步」
  // 兩個 effect，而 setAnimating(true) 在同一個 commit 內還沒生效，同步 effect 讀到的
  // animating 仍是舊值 false → 立刻把棋子設到終點，骰子還沒定格棋子就先走完了。
  const animatingRef = useRef(false);
  const ackedSeqRef = useRef(0);          // 已送出 ack 的 seq（避免重複寫）
  const [confirmExit, setConfirmExit] = useState(false); // 返回鍵確認（房主按下去＝解散全房）
  const [stuckLong, setStuckLong] = useState(false);     // 卡同一步超過 15 秒 → 才給房主解卡工具
  const scrollRef = useRef(null);

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
  const hasPending = curSeq > 0 && ((room?.pendingSettle?.seq === curSeq) || (room?.pendingEvent?.seq === curSeq) || (room?.pendingFork?.seq === curSeq));
  // 分岔路：全員投完票（+各自 ack＝看完投票畫面）才算通過，房主才決定路線
  const forkPending = !!(room?.pendingFork && room.pendingFork.seq === curSeq);
  const forkAllVoted = forkPending && activeMems.every(([id]) => room?.forkVotes?.[id]);
  const forkUI = forkPending ? room.pendingFork : null;
  const myVote = forkPending ? (room?.forkVotes?.[myId] || null) : null;
  const leftVotes = forkPending ? activeMems.filter(([id]) => room?.forkVotes?.[id] === "left").length : 0;
  const rightVotes = forkPending ? activeMems.filter(([id]) => room?.forkVotes?.[id] === "right").length : 0;
  const forced = (room?.forcedSeq || 0) >= curSeq && curSeq > 0;
  const allPassed = !hasPending || forced || (forkPending
    ? forkAllVoted && activeMems.every(([id]) => ackedStep(id))
    : activeMems.every(([id]) => passedStep(id)));
  const claimedN = activeMems.filter(([id]) => forkPending ? room?.forkVotes?.[id] : passedStep(id)).length;
  // 還沒領取/OK 的人名單（讓大家知道是誰卡住）
  const nameOf = id => room?.members?.[id]?.name || "隊員";
  const waitingNames = forkPending
    ? activeMems.filter(([id]) => !room?.forkVotes?.[id]).map(([id]) => nameOf(id))
    : hasPending ? activeMems.filter(([id]) => !passedStep(id)).map(([id]) => nameOf(id)) : [];
  const waitingAckNames = forkPending
    ? []
    : hasPending ? activeMems.filter(([id]) => claimedStep(id) && !ackedStep(id)).map(([id]) => nameOf(id)) : [];

  // 旅程＝同 seed 確定性重算（seed 由房主旅程決定，Boss 完成後換新 seed）
  const journey = useMemo(() => {
    if (!room?.journeySeed) return null;
    return generateJourney(room.mode, room.journeySeed);
  }, [room?.journeySeed, room?.mode]);

  // 重連（僅在使用者尚未主動建立/加入房間時才自動重連）
  useEffect(() => {
    if (!myId) return;
    ensureDailyDice(myId);
    findReconnectableBoardRoom(myId).then(r => {
      if (!joinedRef.current && r.room) setRoomId(r.room.id);
    });
  }, [myId]);

  // 大廳：訂閱可加入的等待中房間
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

  // 初始化 animatedSeq（首次載入/重連：直接對齊當前 seq，不重播舊動畫）
  useEffect(() => {
    if (room && animatedSeqRef.current < 0) {
      animatedSeqRef.current = room.seq || 0;
      setAnimatedSeq(room.seq || 0);
    }
  }, [room]);

  // 棋子跟隨動畫：依權威 lastMove 把棋子從 from 逐格走到 to（骰子落點），
  // 若有 finalTo（陷阱後退/捷徑前進/分岔跳躍）再跳到最終位置。純視覺。
  // 狀態已由 roomRollAndMove 原子更新，動畫卡住也不影響進度。
  useEffect(() => {
    const lm = room?.lastMove;
    if (!lm) return;
    // ⚠️ 分岔路的 lastMove 沿用同一 seq（決定路線時的跳躍）：用 fork 旗標放行重播，
    //    否則同 seq 已被動畫過、會被閘門擋掉 → 棋子直接瞬移沒有跳躍演出。
    if (lm.seq <= animatedSeqRef.current && !lm.fork) return;
    animatingRef.current = true;
    setAnimating(true);
    setDisplayPos(lm.from);
    sfxBoardDiceRoll();
    setDiceLocked(false);
    const timers = [];
    let stepIv = null;
    let cur = lm.from;
    const finish = () => {
      animatedSeqRef.current = lm.seq;
      setAnimatedSeq(lm.seq);
      animatingRef.current = false;
      setAnimating(false);
    };
    const landAt = (pos, type) => {
      setDisplayPos(pos);
      setHopNonce(n => n + 1);
      sfxBoardLand();
      setLandFx({ index: pos, type, nonce: Date.now() });
    };
    const totalSteps = Math.max(1, (lm.to || 0) - (lm.from || 0));
    let stepIdx = 0;
    timers.push(setTimeout(() => {
      sfxBoardDiceLand();
      setDiceLocked(true);
      if (lm.to === lm.from) {
        // 原地（分岔跳躍起點）：直接閃一下再跳
        landAt(lm.to, lm.viaTile || lm.tile);
        timers.push(setTimeout(() => {
          if (lm.finalTo != null && lm.finalTo !== lm.to) landAt(lm.finalTo, lm.tile);
          timers.push(setTimeout(finish, 600));
        }, 500));
        return;
      }
      stepIv = setInterval(() => {
        cur += 1;
        setDisplayPos(cur);
        setHopNonce(n => n + 1);
        if (cur >= lm.to) {
          clearInterval(stepIv); stepIv = null;
          landAt(lm.to, lm.viaTile || lm.tile);
          if (lm.finalTo != null && lm.finalTo !== lm.to) {
            // 陷阱/捷徑：停一下後跳到最終位置
            timers.push(setTimeout(() => {
              landAt(lm.finalTo, lm.tile);
              timers.push(setTimeout(finish, 600));
            }, 800));
          } else {
            timers.push(setTimeout(finish, 700));
          }
        } else {
          sfxBoardStep(stepIdx, totalSteps);
        }
        stepIdx += 1;
      }, 240);
    }, 700));
    return () => { timers.forEach(clearTimeout); if (stepIv) clearInterval(stepIv); };
  }, [room?.lastMove?.seq, room?.lastMove?.fork]); // eslint-disable-line

  // 落格特效播完就清掉，否則再次踩到同一格時 class 沒變化、動畫不會重播
  useEffect(() => {
    if (!landFx) return undefined;
    const t = setTimeout(() => setLandFx(null), 700);
    return () => clearTimeout(t);
  }, [landFx]);

  // 棋子自動捲動追蹤（尊重 prefers-reduced-motion）——鏡頭雙軸置中目前位置
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !journey) return;
    const p = journey.path[displayPos];
    if (!p) return;
    const x = p.x * CELL_W + CELL_W / 2 - el.clientWidth / 2;
    const y = p.y * CELL_H + CELL_H / 2 - el.clientHeight / 2;
    const maxY = Math.max(0, el.scrollHeight - el.clientHeight);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    el.scrollTo({ left: Math.max(0, x), top: Math.min(maxY, Math.max(0, y)), behavior: reduce ? "auto" : "smooth" });
  }, [displayPos, journey]);

  // 被房主移出房間 → 立刻退回大廳
  useEffect(() => {
    if (!room || !myId || room.status !== "active") return;
    if (room.members && !room.members[myId]) {
      showToast("你已被移出房間");
      joinedRef.current = false;
      setRoomId(null); setRoom(null);
    }
  }, [room?.members, myId, room?.status]); // eslint-disable-line

  // 卡在同一步超過 15 秒 → 房主才看得到「移除隊員／強制推進」
  useEffect(() => {
    const blocked = (!!room?.pendingShoot) || (hasPending && !allPassed);
    if (!blocked) { setStuckLong(false); return; }
    setStuckLong(false);
    const t = setTimeout(() => setStuckLong(true), 15000);
    return () => clearTimeout(t);
  }, [room?.pendingShoot, hasPending, allPassed, curSeq]);

  // 動畫閘門的保險絲：claim/投票都要等 animatedSeq 追上 room.seq，
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
    }, 9000);
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
    const tileType = room.pendingSettle.tileType;
    // 動作格（挖礦/採集素材/寶箱/箭露）：先開動作演示（要有「動手」感覺），
    //   動畫完成或取消後才送 claim。08-08 起挖礦不再三選一（TileDemo 純動畫）。
    //   ⚠️ 動畫期間 effect 可能因其他快照重跑：gatherAnimRef 記住「這 seq 開過沒、動畫完沒」——
    //      開過但沒完 → return 等待；完 → 掉進下面的 claim（不重複開動畫、不卡全隊）。
    if (tileType === "mining" || tileType === "material" || tileType === "chest" || tileType === "arrowdew") {
      if (gatherAnimRef.current.seq !== seq) {
        gatherAnimRef.current = { seq, done: false };
        setGatherTeam(tileType);
        return;
      }
      if (!gatherAnimRef.current.done) return;
    }
    lastSettleRef.current = seq;
    const isCatBond = tileType === "catbond";
    claimBoardSettle(roomId, myId, { villageBuildings, catId }).then(res => {
      // 寫入失敗 → 解鎖並排重試（不重試的話 settleClaims 少我一筆，全隊卡死等我）
      if (!res?.ok && res?.reason !== "已領取") {
        lastSettleRef.current = seq - 1;
        bumpRetry();
        return;
      }
      if (!(res?.ok && res.reward)) { ackStep(seq); return; }
      sfxBoardTile(tileType);
      // 🃏 抽卡房：claim 已自動免費抽 1 張（cardGachaViews）→ 開專屬抽卡結果 popup
      if (tileType === "cardgacha" && (res.reward.cardGachaViews || []).length) {
        setCardGachaResult({ views: res.reward.cardGachaViews, seq });
        return;
      }
      // 特殊格子 toast（buff／陷阱／捷徑／完成旅程）——陷阱帶事件名（08-08 多種事件）
      if (tileType === "trap") {
        const ev = res.reward || {};
        showToast(`${ev.icon || "🕳️"} ${ev.label || "陷阱！"}，損失 ${ev.loseCoins || 0} 金幣${ev.loseArrowdew ? `、${ev.loseArrowdew} 箭露` : ""}`);
      }
      else if (tileType === "shortcut") showToast(`🌉 捷徑！前進 ${res.reward.jumpAhead ?? 3} 格`);
      else if (tileType === "camp") showToast(`🏕️ 營地${(room.buffs?.campMult || 1.2) > 1.2 ? "疊加" : ""}！村莊資源 ×${room.buffs?.campMult || 1.2}`);
      else if (tileType === "empower") {
        // 強化格兩種效果都可能抽到（下箭 ×2 或 多骰）——兩者都啟用就都顯示（與單人 toast 一致）
        const parts = [];
        if ((Number(room.buffs?.diceCount) || 0) > 1) parts.push(`🎲 多骰！下一次擲骰骰 ${room.buffs.diceCount} 顆`);
        if ((room.buffs?.nextShootMult || 1) > 1) parts.push(`✨ 強化${(room.buffs?.nextShootMult || 2) > 2 ? "疊加" : ""}！下次打怪/決戰 ×${room.buffs?.nextShootMult || 2}`);
        showToast(parts.join("　") || "✨ 強化！");
      }
      else if (tileType === "catmate") showToast(`🐾 貓夥伴${(Number(room.buffs?.catmate) || 1) > 1 ? "疊加" : ""}！射箭分數 +${Math.round((Number(room.buffs?.catmate) || 1) * 5)}%`);
      if (res.reward.boss) {
        addVillageLap(myId).catch(() => {});
        sfxBoardLap();
        showToast("🏁 完成旅程！下一趟開房可重新選階級");
        // A team clears one map, not one map per member. The host emits the
        // stable operation and Firestore deduplicates reconnect/replay.
        const completionId = teamExplorationCompletionOperation({
          memberId: myId, hostId: room.hostId, roomId,
          sequence: room.seq, completed: true,
        });
        if (completionId) {
          import("../../lib/villageGoalDb").then(m => m.contributeExplorationCompletionToGoal(myId, completionId, 1)).catch(() => {});
        }
      }
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
        // 清單為空（buff/陷阱/捷徑等沒有可領資源）就沒有演出可看，直接 ack
        if (items.length) setReward({ items, band: res.reward.band, tileType, seq });
        else ackStep(seq);
      }
    });
  }, [room?.pendingSettle?.seq, room?.settleClaims, myId, roomId, catId, profile, animatedSeq, retryNonce, ackStep, gatherTeam]); // eslint-disable-line

  // 採集動畫完成/取消：組隊的採集是「自動結算」，取消只是跳過動畫——**仍要 claim**，否則全隊卡死等我。
  const closeGather = useCallback(() => {
    gatherAnimRef.current.done = true;
    setGatherTeam(null);
  }, []);
  // ⚠️ 防卡死保險：動畫超過 7 秒沒自關（背景分頁節流/低階裝置卡頓/渲染例外）就強制結算。
  //    組隊卡死是全隊災難，且既有 retry 機制救不了「claim 根本沒送出」的狀態。
  useEffect(() => {
    if (!gatherTeam) return undefined;
    const t = setTimeout(closeGather, 7000);
    return () => clearTimeout(t);
  }, [gatherTeam, closeGather]);

  // 分岔路投票：被指派者按下 → 記錄投票＋ack（＝看完投票畫面）
  const doForkVote = useCallback((side) => {
    if (myVote || !forkUI) return;
    sfxTap();
    voteForkPath(roomId, myId, side).then(res => {
      if (res?.ok) ackStep(forkUI.seq);
      else showToast(res?.reason || "投票失敗");
    });
  }, [myVote, forkUI, roomId, myId, ackStep]);

  // 分岔路：20 秒未投票 → 自動選左路（穩妥），避免全隊乾等
  useEffect(() => {
    if (!forkPending || myVote) return undefined;
    const pf = room.pendingFork;
    const t = setTimeout(() => {
      voteForkPath(roomId, myId, "left").then(res => { if (res?.ok) ackStep(pf.seq); });
    }, 20000);
    return () => clearTimeout(t);
  }, [forkPending, myVote, roomId, myId, ackStep, room?.pendingFork?.seq]); // eslint-disable-line

  // 房主：全員投完 → 自動決定路線（跳到勝出的那格、照常結算）。
  // ⚠️ 失敗要自己重試（跟 finalizeBoardShoot 同一個教訓）：這步只由快照驅動，
  //    若 resolveFork 撞交易失敗，之後不會有新快照來叫醒它——且卡住時 allPassed 已是
  //    true、stuckLong 不會出現、resync 也不清 pendingFork，等於整房永久卡死。
  useEffect(() => {
    if (!isHost || !forkPending || !forkAllVoted) return;
    let stopped = false;
    let timer = null;
    const attempt = () => {
      resolveFork(roomId, myId)
        .then(r => { if (!stopped && !r?.done) timer = setTimeout(attempt, 2500); })
        .catch(() => { if (!stopped) timer = setTimeout(attempt, 2500); });
    };
    attempt();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [isHost, forkPending, forkAllVoted, roomId, myId]);

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
      setShoot({ type: ps.tileType, seq: ps.seq });
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

  // 全員領完當前這步 → 房主清空 pendingSettle/pendingEvent（pendingFork 由 resolveFork 清）
  useEffect(() => {
    if (!isHost || !room) return;
    const seq = room.seq || 0;
    const hasPend = seq > 0 && ((room.pendingEvent?.seq === seq) || (room.pendingSettle?.seq === seq));
    if (hasPend && allPassed) clearRoomPending(roomId, myId).catch(() => bumpRetry());
  }, [isHost, room, allPassed, roomId, myId, retryNonce]); // eslint-disable-line

  // 房主骰子用完 + 當前這步全員都領完 → 進結算畫面（全員都看得到）。
  useEffect(() => {
    if (room?.status !== "active") return;
    const idle = room?.hostDiceLeft === 0 && !animating && !room?.pendingShoot && !forkPending
      && allPassed && !shoot && !shootResult;
    if (idle) setShowTeamSummary(true);
  }, [room?.hostDiceLeft, room?.status, animating, room?.pendingShoot, forkPending, allPassed, shoot, shootResult]);

  // 🔄 卡住了？重新同步：不用重整頁面就能做到「重整」會做的事。
  const resync = useCallback((opts = {}) => {
    const seq = room?.seq || 0;
    animatedSeqRef.current = seq;
    setAnimatedSeq(seq);
    animatingRef.current = false;
    setAnimating(false);
    setRolling(false);
    // 解開 claim 鎖 → retryNonce 讓 claim effect 重跑。
    // 已經領過的會被 settleClaims 擋掉，不會重複領；只有真的沒寫進去的才補上。
    const iClaimed = (room?.settleClaims?.[myId] || 0) >= seq || (room?.eventClaims?.[myId] || 0) >= seq;
    if (!iClaimed) lastSettleRef.current = 0;
    setRetryNonce(n => n + 1);
    // ⚠️ 只有「全員都領完」才清 pending，否則會把還沒領的隊員的獎勵直接抹掉
    const hasPend = (room?.pendingEvent?.seq === seq) || (room?.pendingSettle?.seq === seq);
    if (isHost && allPassed && hasPend) clearRoomPending(roomId, myId).catch(() => {});
    if (!opts.silent) showToast("已重新同步");   // 自動同步不吵玩家
  }, [room, myId, isHost, allPassed, roomId]); // eslint-disable-line

  // 🤖 自動同步看門狗（0 次額外讀取：只重設本機閘門＋重試自己的寫入）
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
    // ⚠️ 階級鎖定（08-07）：房主這張地圖有進行中旅程 → 開房沿用鎖定 T，不重選
    const locked = lockedJourneyTier(profile?.villageBoard?.maps?.[selMode] || {}, selTier);
    const res = await createBoardRoom({ hostId: myId, hostName: profile?.name || "房主", mode: selMode, tier: locked, accountType: profile?.accountType, avatarId: profile?.avatarId });
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

  // ── 房主：擲骰（權威狀態機在 DB，動畫由 lastMove Effect 同步）──
  const hostRoll = useCallback(async () => {
    if (!isHost || rolling || hostDice <= 0) return;
    setRolling(true); sfxCast();
    const res = await roomRollAndMove(roomId, myId);
    if (!res?.ok) { showToast(res?.reason || "無法擲骰"); setRolling(false); return; }
    // 骰子動畫（快速跳數字）
    setDiceAnim(1);
    await new Promise(r => { const end = Date.now() + 700; const iv = setInterval(() => { if (Date.now() >= end) { clearInterval(iv); setDiceAnim(res.rolls?.length > 1 ? res.rolls.join("+") : res.roll); sfxSuccess(); r(); } else setDiceAnim(1 + Math.floor(Math.random() * 15)); }, 80); });
    await new Promise(r => setTimeout(r, 500)); setDiceAnim(null);
    setRolling(false);
  }, [isHost, rolling, hostDice, roomId, myId]);

  // 射手：6 箭計分完成 → 顯示分帶結果（S/A/B/C，與獎勵分層同一張表）
  const hostFinishShoot = useCallback(async () => {
    if (arrows.length < 6) return;
    const labels = arrows;
    const score = labels.reduce((s, l) => s + (l === "X" ? 10 : Number(l) || 0), 0);
    const band = scoreToBand(score / 60).band;
    setShootResult({ type: shoot.type, score, ratio: score / 60, band, labels });
  }, [arrows, shoot]);

  // 確認射擊結果 → 交出自己的分數（房主收齊所有射手後取平均結算）
  const confirmShootResult = useCallback(async () => {
    if (!shootResult || !shoot || submittingScore) return;
    const score = shootResult.labels.reduce((s, l) => s + (l === "X" ? 10 : Number(l) || 0), 0);
    // ⚠️ 必須「確認寫進去了」才收 UI。交分失敗（多人同時寫房間文件會撞）時射手以為交了，
    //    房主永遠收不齊，全隊卡在「射箭中」。
    setSubmittingScore(true);
    const res = await submitBoardShootScore(roomId, myId, { score, progress: 0 });
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

  // ── 大廳畫面 ──
  if (!roomId || !room) {
    const cap = getModeTierCap(selMode, villageBuildings);
    const tiers = Array.from({ length: cap }, (_, i) => i + 1);
    const m = BOARD_MODES.find(x => x.id === selMode) || BOARD_MODES[0];
    // 階級鎖定（08-07）：房主這張地圖有進行中旅程 → lobby 顯示鎖定 T、開房直接繼續。
    // ⚠️ 舊資料（遷移自舊棋盤）length>0 但 tier=0：不鎖定，讓房主首次選階級。
    const hostMaps = profile?.villageBoard?.maps || {};
    const hostMap = hostMaps[selMode] || {};
    const hostInProgress = hostMap.length > 0;
    const hostTierLocked = hostInProgress && hostMap.tier > 0;
    const hostLockedTier = lockedJourneyTier(hostMap, selTier);
    return (
      <div className="fixed inset-0 z-[200] overflow-y-auto" style={{ backgroundColor: "#140a04", backgroundImage: `linear-gradient(rgba(18,10,4,0.85),rgba(12,7,3,0.94)), url(${ASSET}/board_bg.webp)`, backgroundSize: "cover" }}>
        <div className="w-full max-w-lg mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
            <div className="text-amber-100 font-black">組隊探索大廳</div>
            <button onClick={() => setBoardGuide(true)} title="探索地圖說明書：完整玩法總覽"
              className="rounded-lg bg-sky-600/60 border border-sky-400/40 px-2 py-1 text-sky-50 text-[10px] font-black active:scale-95">📖 說明</button>
          </div>
          <div className="relative isolate overflow-hidden rounded-3xl border border-amber-300/35 mb-4 min-h-[148px] shadow-xl">
            <img src="/ui/cat-village/explore-map.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#160b04]/95 via-[#241207]/55 to-transparent" />
            <div className="relative flex min-h-[148px] items-center gap-3 p-5">
              <CatVillageNavArt name="village" size={70} />
              <div>
                <div className="text-xl font-black text-amber-50">和其他玩家一起出發</div>
                <div className="mt-1 max-w-[240px] text-xs font-bold leading-relaxed text-amber-100/75">
                  建立指定地圖的房間，或從下方搜尋正在等待隊友的隊伍。全隊走「房主的旅程」並共享進度。
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
              {BOARD_MODES.map(mo => {
                const hm = hostMaps[mo.id] || {};
                return (
                  <button key={mo.id} onClick={() => { setSelMode(mo.id); setSelTier(lockedJourneyTier(hm, 1)); }}
                    className={`relative isolate min-h-[94px] overflow-hidden rounded-xl border-2 text-left shadow-md transition active:scale-[.98] ${mo.id === selMode ? "border-amber-300 ring-2 ring-amber-200/20" : "border-amber-500/20"}`}>
                    <img src={`${ASSET}/map_${mo.id}.webp`} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />
                    {mo.id === selMode && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-amber-300 text-[10px] font-black text-amber-950">✓</span>}
                    {hm.length > 0 && <span className="absolute left-2 top-2 rounded-full bg-amber-400/95 px-1.5 py-0.5 text-[9px] font-black text-amber-950 shadow">{hm.tier > 0 ? `T${hm.tier}・進行中` : "進行中・待選 T"}</span>}
                    <span className="relative flex min-h-[90px] flex-col justify-end p-2.5">
                      <span className="text-xs font-black text-white">{mo.familyName}</span>
                      <span className="text-[10px] font-bold text-amber-100/70">{mo.name}・{mo.resourceName}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {hostTierLocked ? (
              <div className="flex items-center gap-2 mb-3 rounded-xl bg-amber-500/10 border border-amber-400/30 px-3 py-2">
                <span className="rounded-lg bg-amber-400 text-slate-900 font-black text-xs px-2 py-0.5">T{hostLockedTier}</span>
                <span className="text-amber-200/70 text-[10px] font-bold">這張地圖有進行中的旅程，階級已鎖定——開房直接繼續這趟。</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {hostInProgress && (
                  <div className="w-full text-[10px] font-bold text-amber-200/60">🔄 這張地圖的旅程已走完（或尚未選過階級），選好 T 後開房，走完前鎖定。</div>
                )}
                {tiers.map(t => <button key={t} onClick={() => setSelTier(t)} className={`px-3 py-1.5 rounded-lg text-xs font-black border ${t === selTier ? "bg-amber-400 text-slate-900 border-amber-300" : "bg-black/30 text-amber-100 border-amber-500/20"}`}>T{t}</button>)}
              </div>
            )}
            <button disabled={busy || tiers.length === 0} onClick={create} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black disabled:opacity-40">
              {hostTierLocked ? `繼續 ${m.familyName} T${hostLockedTier}（已鎖定）` : `建立 ${m.familyName} T${selTier} 房間`}
            </button>
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
        {/* 📖 探索地圖說明書（大廳也可開啟） */}
        {boardGuide && <BoardGuide onClose={() => setBoardGuide(false)} />}
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
            ? `你是房主，離開會直接解散房間，${Math.max(0, memberCount - 1)} 位隊友會一起被踢出。旅程進度已存回你的帳號，明天可以繼續。`
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
      <div className="fixed inset-0 z-[200] overflow-y-auto" style={{ backgroundColor: "#140a04", backgroundImage: `linear-gradient(rgba(18,10,4,0.85),rgba(12,7,3,0.94)), url(${ASSET}/board_bg.webp)`, backgroundSize: "cover" }}>
        <div className="w-full max-w-lg mx-auto p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
            <button onClick={() => setConfirmExit(true)} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
            <div className="text-amber-100 font-black">⏳ 組隊等待室</div>
            <button onClick={() => setBoardGuide(true)} title="探索地圖說明書：完整玩法總覽"
              className="rounded-lg bg-sky-600/60 border border-sky-400/40 px-2 py-1 text-sky-50 text-[10px] font-black active:scale-95">📖 說明</button>
            <div className="flex items-center gap-1.5">
              {isAdmin && isHost && (
                <div className="flex items-center gap-1">
                  <button onClick={() => addBoardDice(myId, 1)} title="測試用：＋1 骰"
                    className="rounded-lg bg-emerald-600/70 border border-emerald-400/40 px-1.5 py-1 text-emerald-50 text-[10px] font-black active:scale-95">＋1</button>
                  <button onClick={() => refillBoardDice(myId)} title="測試用：重置為每日上限"
                    className="rounded-lg bg-emerald-600/70 border border-emerald-400/40 px-1.5 py-1 text-emerald-50 text-[10px] font-black active:scale-95">🔄重置</button>
                </div>
              )}
              <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-amber-200 text-xs font-black">🎲 {hostDice}</div>
            </div>
          </div>
          <div className="rounded-2xl bg-black/30 border border-amber-500/25 p-4 mb-4 text-center">
            <div className="text-amber-200/60 text-xs">隊友可在「加入房間」列表看到這間</div>
            <div className="text-2xl font-black text-amber-300 tracking-[0.2em] my-1">{room.code}</div>
            <div className="text-amber-100/70 text-xs">{wm.icon}{wm.familyName}・T{room.tier || 1}</div>
            <div className="mt-1 text-amber-200/50 text-[10px]">開始後全隊走「{wm.name}」旅程（吃房主進度）</div>
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
        {/* 📖 探索地圖說明書（等待室也可開啟） */}
        {boardGuide && <BoardGuide onClose={() => setBoardGuide(false)} />}
      </div>
    );
  }

  // ── 團隊旅程 ──
  if (!journey) return null;
  const mode = BOARD_MODES.find(x => x.id === room.mode) || BOARD_MODES[0];
  const pMult = partyMultOf(memberCount);
  const progressPct = journey.length > 1 ? Math.round((displayPos / (journey.length - 1)) * 100) : 0;
  const shootWaiting = !!room?.pendingShoot && room.pendingShoot.seq === curSeq;
  const shootNames = shootWaiting ? (room.pendingShoot.shooters || []).map(id => room.members?.[id]?.name || "隊員") : [];
  const shootDone = shootWaiting ? Object.keys(room.pendingShoot.scores || {}).length : 0;
  const canRoll = isHost && !rolling && hostDice > 0 && allPassed && !shoot && !shootResult && !forkPending && !animating && !room?.pendingShoot;
  // 誰卡住了：射箭中＝還沒交分的射手；分岔路＝還沒投票；等領取＝還沒 claim 的隊員
  const blockingList = (shootWaiting
    ? (room.pendingShoot.shooters || []).filter(id => room.pendingShoot.scores?.[id] == null)
    : forkPending
      ? activeMems.filter(([id]) => !room?.forkVotes?.[id]).map(([id]) => id)
      : hasPending && !allPassed ? activeMems.filter(([id]) => !passedStep(id)).map(([id]) => id) : []
  ).filter(id => id !== myId).map(id => ({ id, name: room.members?.[id]?.name || "隊員" }));
  const shootMon = (shoot?.type === "monster" || shoot?.type === "boss")
    ? getObstacleForTier(room.mode, room.tier || 1)
    : null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center"
      style={{ backgroundColor: "#140a04", backgroundImage: `linear-gradient(rgba(18,10,4,0.72),rgba(12,7,3,0.9)), url(${ASSET}/board_bg.webp)`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="w-full max-w-lg flex items-center justify-between gap-2 flex-wrap px-4 py-3">
        <button onClick={() => setConfirmExit(true)} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
        <div className="text-amber-100 font-black text-sm">👥 房號 {room.code}・{memberCount}人</div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => resync()} title="卡住了？重新同步" className="rounded-xl bg-black/40 border border-amber-400/30 px-2 py-1 text-amber-200/80 text-xs font-black active:scale-95">🔄</button>
          {isAdmin && isHost && (
            <div className="flex items-center gap-1">
              <button onClick={() => addBoardDice(myId, 1)} title="測試用：＋1 骰"
                className="rounded-lg bg-emerald-600/70 border border-emerald-400/40 px-1.5 py-1 text-emerald-50 text-[10px] font-black active:scale-95">＋1</button>
              <button onClick={() => refillBoardDice(myId)} title="測試用：重置為每日上限"
                className="rounded-lg bg-emerald-600/70 border border-emerald-400/40 px-1.5 py-1 text-emerald-50 text-[10px] font-black active:scale-95">🔄重置</button>
            </div>
          )}
          <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-amber-200 text-xs font-black">🎲 {room?.hostDiceLeft ?? hostDice}</div>
        </div>
      </div>

      {/* 地圖資訊 + buff chips + 進度條 */}
      <div className="w-full max-w-lg mx-auto px-4 mb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="rounded-xl bg-black/30 border border-amber-500/25 px-3 py-1 text-amber-100 text-xs font-black">
            {mode.icon} {mode.familyName} · T{room.tier || 1} · 加成×{pMult.toFixed(2)}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button onClick={() => setBoardGuide(true)} title="探索地圖說明書：完整玩法總覽"
              className="rounded-full bg-sky-600/40 border border-sky-400/40 px-2 py-0.5 text-[10px] font-black text-sky-100 active:scale-95">📖 說明</button>
            <button onClick={() => setBuffHelp(true)} title="查看加成說明"
              className="rounded-full bg-white/10 border border-white/20 px-2 py-0.5 text-[10px] font-black text-slate-200 active:scale-95">❓ 加成</button>
            {buffActive(room.buffs || {}, "campMult") && <button onClick={() => setBuffHelp(true)} className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-black text-emerald-200 active:scale-95">🏕️ 資源 ×{room.buffs.campMult}</button>}
            {buffActive(room.buffs || {}, "nextShootMult") && <button onClick={() => setBuffHelp(true)} className="rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 text-[10px] font-black text-cyan-200 active:scale-95">✨ 下次打怪/決戰 ×{room.buffs.nextShootMult}</button>}
            {buffActive(room.buffs || {}, "diceCount") && <button onClick={() => setBuffHelp(true)} className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-black text-amber-200 active:scale-95">🎲 下次擲 {room.buffs.diceCount} 骰</button>}
            {buffActive(room.buffs || {}, "catmate") && <button onClick={() => setBuffHelp(true)} className="rounded-full bg-pink-500/20 border border-pink-400/40 px-2 py-0.5 text-[10px] font-black text-pink-200 active:scale-95">🐾 射箭 +{Math.round((Number(room.buffs.catmate) || 1) * 5)}%</button>}
            {(room.clears || 0) > 0 && <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-black text-amber-200">🏆 {room.clears} 趟</span>}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] font-black text-amber-200/70">{displayPos}/{journey.length - 1}</span>
          <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-300 bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-[10px] font-black text-amber-200/70">{progressPct}%</span>
        </div>
      </div>

      {/* 旅程大畫布：橫向捲動、蜿蜒 path 絕對定位、鏡頭雙軸跟隨 */}
      <div ref={scrollRef} className="flex-1 overflow-auto w-full" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(251,191,36,.4) transparent" }}>
        <div className="min-w-max mx-auto" style={{ position: "relative", width: (journey.length + 2) * CELL_W, height: 5 * CELL_H + 26 }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            <polyline
              points={journey.path.map(p => `${p.x * CELL_W + CELL_W / 2},${p.y * CELL_H + CELL_H / 2}`).join(" ")}
              fill="none" stroke="rgba(251,191,36,.30)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {journey.cells.map((type, i) => {
            const p = journey.path[i];
            const here = displayPos === i;
            const landed = landFx?.index === i;
            const metaT = TILE_TYPES[type] || {};
            return (
              <div key={i}
                style={{ position: "absolute", left: p.x * CELL_W + (CELL_W - TILE) / 2, top: p.y * CELL_H + (CELL_H - TILE) / 2, width: TILE, height: TILE, "--board-fx": TILE_FX_COLOR[type] || "rgba(251,191,36,.9)" }}
                className={`relative rounded-xl flex items-center justify-center border ${here ? "ring-2 ring-yellow-300 scale-110 z-10" : "border-amber-500/20"} ${landed ? "board-land-flash" : ""}`}>
                <span className={`w-full h-full rounded-xl flex items-center justify-center ${tileBg(type)}`}>
                  <TileIcon type={type} size={type === "boss" ? 66 : 58} mapId={room.mode} />
                </span>
                {type === "boss" && <span className="absolute -bottom-3 text-[11px] text-rose-300 font-black drop-shadow">終點</span>}
                {i === 0 && <span className="absolute -bottom-3 text-[11px] text-amber-200 font-black">起點</span>}
                {here && <div key={hopNonce} className="absolute -top-4 -right-2 text-3xl board-hop z-20">🐱</div>}
                {landed && BURST_TILES.has(type) && <span key={landFx.nonce} className="board-burst" />}
                {metaT.label && <span className="absolute top-1 left-1.5 text-[11px] text-amber-100/70 font-black">{metaT.label}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 房主解卡工具：卡同一步 15 秒以上才出現 */}
      {isHost && stuckLong && (
        <div className="w-full max-w-lg px-4 mb-1">
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
            <div className="text-amber-100/45 text-[10px] mt-1.5">移除＝把人請出這一局；強制推進＝不等了，他這步沒完成就沒完成，人還在房裡。</div>
          </div>
        </div>
      )}

      {/* 底部：骰子 / 等待 */}
      <div className="w-full max-w-lg mx-auto px-4 py-3">
        {shootWaiting && (
          <div className="text-center text-amber-200/85 text-xs font-black mb-1.5">
            🎯 {shootNames.join("、")} 射箭中…（{shootDone}/{room.pendingShoot.shooters.length}）
          </div>
        )}
        {isHost ? (
          <button onClick={hostRoll} disabled={!canRoll}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-base shadow-lg disabled:opacity-40 active:scale-95">
            {rolling ? "🎲 前進中…" : hostDice <= 0 ? "骰子用完了" : !allPassed ? `⏳ 等隊員完成 ${claimedN}/${memberCount}` : "🎲 房主擲骰"}
          </button>
        ) : (
          <div className="w-full py-3.5 rounded-2xl bg-black/30 border border-amber-500/25 text-center text-amber-200/80 text-sm font-black">
            {forkPending ? "🔀 分岔路口！請投票" : hasPending && !passedStep(myId) ? "領取你的獎勵…" : "等待房主擲骰…"}
          </div>
        )}
        {!allPassed && waitingNames.length > 0 && (
          <div className="mt-1.5 text-center text-amber-100/60 text-[10px]">
            {forkPending ? "還沒投票：" : waitingAckNames.length === waitingNames.length ? "還在看獎勵：" : "還沒 OK："}{waitingNames.join("、")}
          </div>
        )}
      </div>

      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[230] rounded-2xl bg-black/85 border border-amber-400/40 px-4 py-2.5 text-amber-100 text-sm font-black shadow-xl max-w-[90vw] text-center">{toast}</div>}

      {diceAnim != null && (
        <div className="fixed inset-0 z-[215] flex items-center justify-center pointer-events-none">
          <div className={`w-32 h-32 rounded-3xl bg-gradient-to-br from-amber-50 to-amber-200 border-4 border-amber-400 flex items-center justify-center shadow-2xl ${diceLocked ? "board-dice-settle" : "board-dice-tumble"}`} style={{ boxShadow: "0 0 52px rgba(251,146,60,.9)" }}>
            <span className={`leading-none font-black ${String(diceAnim).length > 8 ? "text-2xl" : String(diceAnim).length > 4 ? "text-4xl" : "text-7xl"}`} style={{ color: "#c2410c" }}>{diceAnim}</span>
          </div>
        </div>
      )}

      {/* 獎勵演出（與單機版共用元件） */}
      <BoardRewardPopup
        reward={reward}
        tileType={reward?.tileType}
        onClose={() => { ackStep(reward?.seq || curSeq); setReward(null); }}
        zIndex={215}
      />

      {/* 🃏 抽卡房結果（組隊自動免費抽 1 張） */}
      {cardGachaResult && (
        <TeamCardGachaResultPopup cardGachaResult={cardGachaResult} onClose={() => { setCardGachaResult(null); ackStep(cardGachaResult.seq || curSeq); }} />
      )}

      {/* 📖 探索地圖說明書（大廳／等待室／遊戲中都可開啟） */}
      {boardGuide && <BoardGuide onClose={() => setBoardGuide(false)} />}

      {/* 加成說明（點 ❓ 或任一 buff chip 打開；組隊＝全隊共享加成） */}
      {buffHelp && (
        <div className="fixed inset-0 z-[220] bg-black/85 flex items-center justify-center p-4" onClick={() => setBuffHelp(false)}>
          <div className="w-full max-w-sm rounded-3xl border-2 border-amber-400/40 bg-slate-900 p-5 animate-[fx-pop-in_0.3s_cubic-bezier(.34,1.56,.64,1)]" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="text-3xl mb-1">✨</div>
              <div className="text-amber-100 font-black text-lg">全隊加成效果</div>
              <div className="text-slate-400 text-xs mt-1">踩到「營地／強化／多骰／貓夥伴」格子獲得、全隊共享，完成旅程後全部重置</div>
            </div>
            <div className="space-y-2">
              {JOURNEY_BUFF_INFO.map(b => {
                const on = buffActive(room.buffs || {}, b.field);
                const val = buffValueLabel(room.buffs || {}, b.field);
                return (
                  <div key={b.field} className={`rounded-2xl border p-3 ${on ? "border-amber-400/50 bg-amber-500/10" : "border-white/10 bg-white/5"}`}>
                    <div className="flex items-center gap-1.5 text-sm font-black text-amber-100">
                      <span>{b.icon}</span><span>{b.name}</span>
                      {on && <span className="ml-auto rounded-full bg-amber-400/20 border border-amber-300/40 px-2 py-0.5 text-[9px] font-black text-amber-200">啟用中{val && `・${val}`}</span>}
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-300 leading-relaxed">{b.desc}</div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setBuffHelp(false)} className="w-full mt-4 py-2.5 rounded-xl bg-amber-400 text-slate-900 font-black active:scale-95">知道了</button>
          </div>
        </div>
      )}

      {/* 格子動作演示：挖礦／採集素材／寶箱／箭露——動畫完（或跳過）才送 claim，全隊才推得動 */}
      {gatherTeam && (
        <TileDemo meta={JOURNEY_MAP_META[room?.mode]} tier={room?.tier || 1}
          variant={gatherTeam} zIndex={212}
          onDone={closeGather}
          onCancel={closeGather}
          cancelLabel="✕ 跳過動畫（直接結算）" />
      )}

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

      {/* 分岔路口：全員投票（票多者勝） */}
      {forkUI && (
        <div className="fixed inset-0 z-[216] bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl border-2 border-purple-400/40 bg-slate-900 p-5 animate-[fx-pop-in_0.3s_cubic-bezier(.34,1.56,.64,1)]">
            <div className="text-center">
              <div className="text-3xl mb-1">🔀</div>
              <div className="text-purple-100 font-black text-lg">分岔路口・全員投票</div>
              <div className="text-slate-400 text-xs mt-1 mb-4">前方一分為二，全隊投票決定走哪條（票多者勝・不耗骰）</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => doForkVote("left")} disabled={!!myVote || !forkUI.options?.left}
                className={`rounded-2xl border p-4 text-center transition-transform ${myVote === "left" ? "border-emerald-300 bg-emerald-500/25" : "border-emerald-400/40 bg-emerald-500/10 hover:border-emerald-300/80"} active:scale-95 disabled:opacity-40`}>
                <div className="text-3xl">🌿</div>
                <div className="mt-1 text-sm font-black text-emerald-100">左路・穩妥</div>
                <div className="mt-1 text-[11px] font-bold text-emerald-200/70 leading-tight">
                  {forkUI.options?.left ? `前方 ${forkUI.options.left.dist} 格 → ${TILE_TYPES[forkUI.options.left.tile]?.icon} ${TILE_TYPES[forkUI.options.left.tile]?.label}` : "前方沒有素材格"}
                </div>
                <div className="mt-1.5 inline-block rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-black text-emerald-200">
                  {leftVotes} 票{myVote === "left" ? " ✓" : ""}
                </div>
              </button>
              <button onClick={() => doForkVote("right")} disabled={!!myVote || !forkUI.options?.right}
                className={`rounded-2xl border p-4 text-center transition-transform ${myVote === "right" ? "border-rose-300 bg-rose-500/25" : "border-rose-400/40 bg-rose-500/10 hover:border-rose-300/80"} active:scale-95 disabled:opacity-40`}>
                <div className="text-3xl">⚔️</div>
                <div className="mt-1 text-sm font-black text-rose-100">右路・冒險</div>
                <div className="mt-1 text-[11px] font-bold text-rose-200/70 leading-tight">
                  {forkUI.options?.right ? `前方 ${forkUI.options.right.dist} 格 → 👾 怪物戰（獎勵更高）` : "前方沒有怪物格"}
                </div>
                <div className="mt-1.5 inline-block rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-black text-rose-200">
                  {rightVotes} 票{myVote === "right" ? " ✓" : ""}
                </div>
              </button>
            </div>
            <div className="mt-3 text-center text-[10px] text-slate-500 font-bold">
              {myVote ? "已送出你的選擇，等全隊投票…" : "20 秒未投票將自動選左路（穩妥）"}
            </div>
          </div>
        </div>
      )}

      {showTeamSummary && (
        <div className="fixed inset-0 z-[220] bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-400/50 rounded-3xl p-6 w-full max-w-xs text-center animate-[fx-pop-in_0.35s_cubic-bezier(.34,1.56,.64,1)]">
            <div className="text-5xl mb-2">🎲</div>
            <div className="text-amber-200 font-black text-lg mb-1">今日探索結束</div>
            <div className="text-slate-300 text-sm mb-1">房主骰子已用完</div>
            <div className="text-amber-300/80 text-sm font-bold mb-2">
              房主旅程進度 {progressPct}%（{displayPos}/{journey.length - 1} 格）
            </div>
            <div className="text-amber-200/70 text-xs mb-5">本局完成 {room.clears || 0} 次旅程 🏁</div>
            <button onClick={() => { setShowTeamSummary(false); exitRoom(); }} className="w-full py-3 rounded-2xl bg-amber-400 text-slate-900 font-black">
              {isHost ? "結束並解散房間" : "離開房間"}
            </button>
          </div>
        </div>
      )}

      {/* 🏁 終點 Boss：專屬決戰（登場→血條→討伐成功）——討伐演出結束直接交分（全員各自射） */}
      {shoot?.type === "boss" && !shootResult && (
        <BossDuel obstacle={shootMon} tier={room?.tier || 1} party zIndex={215}
          onFinish={async bossArrows => {
            // BossDuel 傳的是數字陣列（10/9/8/…，X 也已轉成 10）——直接相加即可
            const score = bossArrows.reduce((s, v) => s + Number(v), 0);
            // ⚠️ 必須「確認寫進去了」才收 UI——交分失敗全隊卡在「射箭中」
            setSubmittingScore(true);
            const res = await submitBoardShootScore(roomId, myId, { score, progress: 0 });
            setSubmittingScore(false);
            if (!res?.ok && res?.reason !== "已提交") showToast(res?.reason || "交分失敗，重試中");
          }} />
      )}

      {/* 射箭格（怪物）：6 箭計分 */}
      {shoot?.type === "monster" && !shootResult && (
        <div className="fixed inset-0 z-[215] bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 w-full max-w-sm">
            <div className="text-center text-amber-100 font-black mb-1">{TILE_TYPES[shoot.type].icon} {TILE_TYPES[shoot.type].label}・射 6 箭</div>
            {shootMon && (
              <div className="relative mx-auto mb-2 w-24 h-24 rounded-2xl overflow-hidden border-2 border-rose-400/40 shadow-inner flex items-center justify-center" style={{ background: shootMon.bgColor || "#1e293b" }}>
                <span className="text-5xl drop-shadow-md">{shootMon.emoji || "👾"}</span>
                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-center text-[10px] font-black text-rose-100 py-0.5">{shootMon.name}</span>
              </div>
            )}
            <div className="text-center text-slate-400 text-xs mb-1">{shoot.type === "boss" ? "終點決戰：全隊射 6 箭，完成度越高獎勵越大（不會輸）" : "依實際命中輸入 6 箭分數（完成度決定獎勵）"}</div>
            {shootMon?.action && <div className="text-center text-[10px] font-bold text-rose-200/60 mb-2">🛠️ {shootMon.action}</div>}
            <div className="flex justify-center gap-1 mb-3">{Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border ${arrows[i] != null ? "bg-emerald-600 text-white border-emerald-400" : "bg-slate-800 text-slate-500 border-slate-700"}`}>{arrows[i] != null ? arrows[i] : "?"}</div>
            ))}</div>
            <div className="grid grid-cols-5 gap-1.5">{SCORE_PAD.map(([l, v]) => (
              <button key={l} disabled={arrows.length >= 6} onClick={() => { sfxTap(); setArrows(a => a.length < 6 ? [...a, l] : a); }} className="py-2 rounded-lg bg-amber-500/20 text-amber-100 font-black text-xs border border-amber-400/30 disabled:opacity-40">{l}</button>
            ))}</div>
            <div className="flex gap-2 mt-4"><button onClick={() => setArrows([])} className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">清除</button><button onClick={hostFinishShoot} disabled={arrows.length < 6} className="flex-[2] py-2 rounded-xl bg-amber-400 text-slate-900 font-black text-sm disabled:opacity-40">結算（{arrows.length}/6）</button></div>
          </div>
        </div>
      )}

      {shootResult && (() => {
        const isBoss = shootResult.type === "boss";
        // Boss 用終點分帶（scoreToBand.monsterMult × 0.5），怪物格才用 MONSTER_BAND_TABLE
        const bossBand = { S: { mult: 1.5, mats: 12, chest: 2 }, A: { mult: 1.0, mats: 10, chest: 1 }, B: { mult: 0.75, mats: 9, chest: 1 }, C: { mult: 0.5, mats: 8, chest: 1 } }[shootResult.band] || { mult: 0.5, mats: 8, chest: 1 };
        const mult = isBoss ? bossBand.mult : (MONSTER_BAND_TABLE[shootResult.band]?.mult || 1);
        const mats = isBoss ? bossBand.mats : (MONSTER_BAND_TABLE[shootResult.band]?.mats ?? 1);
        const chests = isBoss ? bossBand.chest : Math.round((MONSTER_BAND_TABLE[shootResult.band]?.chest || 0) * 100);
        return (
        <div className="fixed inset-0 z-[215] bg-black/85 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
          <div className="bg-slate-900 border-2 border-amber-400/50 rounded-3xl p-6 w-full max-w-sm text-center animate-[fx-pop-in_0.35s_cubic-bezier(.34,1.56,.64,1)]">
            <div className="text-5xl mb-2">{isBoss ? "⚔️" : mode.icon}</div>
            <div className="text-amber-200 font-black text-lg">
              {isBoss ? "🏁 終點決戰完成！" : "擊倒怪物！"}
            </div>
            <div className="flex justify-center gap-4 my-3 text-sm">
              <div className="text-slate-400">
                得分<br /><span className="text-amber-300 font-black text-xl">{shootResult.score}</span>
              </div>
              <div className="text-slate-400">
                完成度<br /><span className="text-amber-300 font-black text-xl">{Math.round(shootResult.ratio * 100)}%</span>
              </div>
              <div className="text-slate-400">
                資源倍率<br /><span className="text-amber-300 font-black text-xl">×{mult.toFixed(2).replace(/\.?0+$/, "")}</span>
              </div>
            </div>
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-black ${shootResult.band === "S" ? "bg-yellow-500/25 text-yellow-300" : shootResult.band === "A" ? "bg-emerald-500/20 text-emerald-300" : shootResult.band === "B" ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-600/30 text-slate-300"}`}>
              {shootResult.band} 級・素材 {mats}・寶箱 {isBoss ? `${chests} 個` : `${chests}%`}
            </div>
            <div className="text-slate-500 text-[10px] mt-2">S≥85% / A≥65% / B≥40% / C&lt;40%</div>
            <button onClick={confirmShootResult} disabled={submittingScore}
              className={`mt-5 w-full py-3 rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all ${submittingScore ? "bg-slate-600 text-slate-300" : "bg-amber-400 text-slate-900 hover:bg-amber-300"}`}>
              {submittingScore ? "送出中…" : "✓ 確認送出"}
            </button>
          </div>
        </div>
        );
      })()}
      {exitDialog}
    </div>
  );
}


// 🃏 抽卡房結果（組隊自動免費抽 1 張）：卡背出場 → 高量翻開（單張金色光暈）
// 演出與單人 CardGachaRoom 的 GachaCard 同款（card-gacha-* CSS 在 index.css）。
function TeamCardGachaResultPopup({ cardGachaResult, onClose }) {
  const [flipped, setFlipped] = useState(false);
  const [ready, setReady] = useState(false);   // 翻完後顯示「收下卡片」
  useEffect(() => {
    const t1 = setTimeout(() => setFlipped(true), 650);    // 卡背 0.65s 後翻開
    const t2 = setTimeout(() => setReady(true), 1500);     // 翻完 0.8s 後可收
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const view = cardGachaResult.views[0];
  if (!view) return null;
  const frame = "#f59e0b";
  return (
    <div className="fixed inset-0 z-[216] bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl border-2 bg-slate-900 p-5 text-center animate-[fx-pop-in_0.3s_cubic-bezier(.34,1.56,.64,1)]"
        style={{ borderColor: "rgba(232,121,249,.45)" }}>
        <div className="text-[10px] font-black tracking-[.25em] text-fuchsia-300/80 mb-1">🃏 抽卡房</div>
        <div className="text-fuchsia-100 font-black text-lg mb-3">免費抽到 1 張卡片！</div>
        <div className="card-gacha-scene gacha-single-glow mx-auto" style={{ width: 150, aspectRatio: "3/4", borderRadius: 14 }}>
          <div className={`card-gacha-inner ${flipped ? "flipped" : ""}`}>
            <div className="card-gacha-face card-gacha-back">
              <span className="text-3xl" style={{ opacity: .85 }}>🃏</span>
              {!flipped && <span className="absolute inset-1.5 rounded-xl border-2 border-dashed" style={{ borderColor: "rgba(250,204,21,.45)" }} />}
            </div>
            <div className={`card-gacha-face card-gacha-face-back ${flipped ? "gacha-reveal-flash" : ""}`}
              style={{ border: `2px solid ${frame}`, background: "#0f172a", boxShadow: `0 0 18px ${frame}55` }}>
              <div className="w-full h-full relative">
                <CardArtImage view={view} />
                <div className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-1">
                  <div className="text-[11px] font-black text-white truncate">{view.name}</div>
                  <div className="text-[9px] font-bold text-amber-300">T{view.tierIndex}・{view.family}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2 text-[10px] font-bold text-slate-400">卡片已存入個人收集（重複自動累計升星）</div>
        <button onClick={onClose} disabled={!ready}
          className={`w-full mt-3 py-2.5 rounded-xl font-black active:scale-95 transition-all ${ready ? "bg-fuchsia-400 text-slate-900" : "bg-white/10 text-slate-500"}`}>
          {ready ? "收下卡片" : "翻卡中…"}
        </button>
      </div>
    </div>
  );
}
