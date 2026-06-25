// src/components/duel/DuelRoom.jsx — 決鬥戰鬥室
import { useState, useEffect, useRef, useCallback } from "react";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import CatMsg from "../cat/CatMsg";
import { useToast } from "../shared/UI";
import DuelBattleCard from "./DuelBattleCard";
import { resolveHitPart, BODY_PARTS } from "../../lib/monsterData";
import TargetFaceOverlay, { TargetFmtPicker, InputModePicker, getBattleTargetFmt, setBattleTargetFmt, getBattleInputMode, setBattleInputMode } from "../shared/TargetFaceOverlay";
import { sfxArrowHit, sfxCritBoom, sfxMonsterDead, sfxCounter } from "../../lib/sound";
import {
  subscribeDuelRoom, submitDuelArrows, processDuelRound,
  updateDuelHeartbeat, sendDuelCheer, resetDuelRoom, getDuelStats, recordDuelResult,
  clearDuelProcessing, proposeRematch, voteRematch, clearRematch,
  removePlayerFromRoom, resetWithRedistribution,
  skipDisconnected, applyPlayerCatToRoom,
} from "../../lib/duelDb";
import { generateBotArrows } from "../../lib/botUtils";
import { addPracticeLog, grantArrowMilestoneRewards, addArrowdew, addArcherXP } from "../../lib/db";
import { DUEL_WIN_XP, DUEL_LOSE_XP } from "../../lib/archerLevel";
import { getMilestonesReached, getRewardsForMilestone } from "../../lib/arrowMilestone";
import ArrowMilestonePopup from "../member/ArrowMilestonePopup";
import { useCheckinActive } from "../../hooks/useCheckinActive";

const ARROWS = 6;
const REVEAL_TOTAL = ARROWS * 2; // A 隊先攻 6 箭 + B 隊後攻 6 箭
const ALL_PARTS = new Set(BODY_PARTS.map(p => p.id));
const SCORE_BTNS = [
  { label:"X", score:10 }, { label:"10", score:10 }, { label:"9", score:9 }, { label:"8", score:8 },
  { label:"7", score:7 },  { label:"6",  score:6  }, { label:"5", score:5 }, { label:"4", score:4 },
  { label:"3", score:3 },  { label:"2",  score:2  }, { label:"1", score:1 }, { label:"M", score:0 },
];

const DUEL_CSS = `
@keyframes dmg-float{0%{opacity:1;transform:translateY(0) scale(1)}80%{opacity:1;transform:translateY(-28px) scale(1.1)}100%{opacity:0;transform:translateY(-36px) scale(0.9)}}
@keyframes crit-pop{0%{opacity:1;transform:scale(1) rotate(-5deg)}50%{transform:scale(1.4) rotate(3deg)}100%{opacity:0;transform:scale(0.8) rotate(0deg)}}
@keyframes slide-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes hp-flash{0%,100%{background:transparent}50%{background:rgba(255,50,50,0.25)}}
@keyframes result-pop{0%{opacity:0;transform:scale(0.7) rotate(-4deg)}60%{transform:scale(1.06) rotate(1deg)}100%{opacity:1;transform:scale(1)}}
@keyframes lunge-right{0%{transform:translateX(0)}40%{transform:translateX(20px)}100%{transform:translateX(0)}}
@keyframes lunge-left{0%{transform:translateX(0)}40%{transform:translateX(-20px)}100%{transform:translateX(0)}}
@keyframes recoil-left{0%{transform:translateX(0)}30%{transform:translateX(-10px)}100%{transform:translateX(0)}}
@keyframes recoil-right{0%{transform:translateX(0)}30%{transform:translateX(10px)}100%{transform:translateX(0)}}
@keyframes enter-from-left{from{opacity:0;transform:translateX(-70px) scale(0.75)}to{opacity:1;transform:translateX(0) scale(1)}}
@keyframes enter-from-right{from{opacity:0;transform:translateX(70px) scale(0.75)}to{opacity:1;transform:translateX(0) scale(1)}}
@keyframes vs-glow{0%,100%{transform:scale(1);text-shadow:0 0 20px #f59e0b,0 0 40px #f59e0b}50%{transform:scale(1.18);text-shadow:0 0 40px #fbbf24,0 0 80px #f59e0b,0 0 120px #d97706}}
@keyframes battle-zoom{0%{opacity:0;transform:scale(0.4) rotate(-6deg)}35%{opacity:1;transform:scale(1.08) rotate(1deg)}65%{opacity:1;transform:scale(1)}85%{opacity:1}100%{opacity:0;transform:scale(1.15)}}
@keyframes kill-in{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:translateX(0)}}
@keyframes mvp-pop{0%{opacity:0;transform:scale(0.5) rotate(-8deg)}60%{transform:scale(1.15) rotate(2deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
@keyframes screen-white{0%,100%{opacity:0}25%{opacity:0.7}}
@keyframes intro-appear{from{transform:scale(1.18);opacity:0}to{transform:scale(1);opacity:1}}
.dmg-float{position:absolute;pointer-events:none;font-size:1.1rem;font-weight:900;animation:dmg-float 1.4s ease forwards;white-space:nowrap;}
.crit-pop{position:absolute;pointer-events:none;font-size:1.4rem;font-weight:900;animation:crit-pop 1.1s ease forwards;}
.battle-start-txt{-webkit-text-stroke:2px rgba(255,180,0,0.5);letter-spacing:0.18em;font-weight:900;}
`;

// ── 決鬥入場動畫 ────────────────────────────────────────────
function DuelIntro({ room, myId, onDone }) {
  const [shownCount, setShownCount] = useState(0);
  const [battleStart, setBattleStart] = useState(false);

  const allA = Object.entries(room.teamA || {});
  const allB = Object.entries(room.teamB || {});

  // 交錯排列：A0,B0,A1,B1,A2,B2…
  const slots = [];
  const maxLen = Math.max(allA.length, allB.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < allA.length) slots.push({ team:"A", id:allA[i][0], m:allA[i][1] });
    if (i < allB.length) slots.push({ team:"B", id:allB[i][0], m:allB[i][1] });
  }

  const imgSz = Math.max(allA.length, allB.length) === 1 ? 144
    : Math.max(allA.length, allB.length) <= 2 ? 108
    : Math.max(allA.length, allB.length) <= 4 ? 80 : 60;

  useEffect(() => {
    if (shownCount < slots.length) {
      const interval = shownCount === 0 ? 700 : slots.length > 6 ? 380 : slots.length > 4 ? 460 : 620;
      const t = setTimeout(() => setShownCount(n => n + 1), interval);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(() => setBattleStart(true), 450);
    const t2 = setTimeout(onDone, 1950);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [shownCount]); // eslint-disable-line

  const shownA = slots.slice(0, shownCount).filter(s => s.team === "A");
  const shownB = slots.slice(0, shownCount).filter(s => s.team === "B");

  return (
    <div className="fixed inset-0 z-[200] flex overflow-hidden select-none"
      style={{ background:"linear-gradient(180deg,#04000f 0%,#0c0020 60%,#04000f 100%)",
        animation:"intro-appear 0.55s cubic-bezier(.25,.46,.45,.94) both" }}
      onClick={onDone}>
      <style>{DUEL_CSS}</style>

      {/* A 隊 — 左側 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background:"radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.25), transparent 70%)" }} />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-blue-500/30 to-transparent" />
        {shownA.map(({ id, m }) => (
          <div key={id} className="flex flex-col items-center gap-1.5 relative z-10"
            style={{ animation:"enter-from-left 0.55s cubic-bezier(.34,1.56,.64,1) both" }}>
            <img src={`/cats/portraits/${m.archerStyle||"baobao"}.webp`} alt={m.name}
              style={{ width:imgSz, height:imgSz, objectFit:"cover", borderRadius:"50%",
                filter:"drop-shadow(0 0 18px rgba(96,165,250,0.9)) drop-shadow(0 4px 8px rgba(0,0,0,0.8))" }} />
            <span className="text-white font-black text-sm tracking-wider"
              style={{ textShadow:"0 0 10px #60a5fa, 0 2px 4px rgba(0,0,0,0.9)" }}>
              {id === myId ? "▶ " : ""}{m.name}
            </span>
          </div>
        ))}
      </div>

      {/* 中央 VS */}
      <div className="flex flex-col items-center justify-center shrink-0 w-14 z-10">
        <span className="font-black text-2xl text-amber-400"
          style={{ animation:"vs-glow 1.2s ease infinite", letterSpacing:"0.05em" }}>
          VS
        </span>
      </div>

      {/* B 隊 — 右側 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background:"radial-gradient(ellipse at 70% 50%, rgba(239,68,68,0.25), transparent 70%)" }} />
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-red-500/30 to-transparent" />
        {shownB.map(({ id, m }) => (
          <div key={id} className="flex flex-col items-center gap-1.5 relative z-10"
            style={{ animation:"enter-from-right 0.55s cubic-bezier(.34,1.56,.64,1) both" }}>
            <img src={`/cats/portraits/${m.archerStyle||"baobao"}.webp`} alt={m.name}
              style={{ width:imgSz, height:imgSz, objectFit:"cover", borderRadius:"50%",
                filter:"drop-shadow(0 0 18px rgba(248,113,113,0.9)) drop-shadow(0 4px 8px rgba(0,0,0,0.8))" }} />
            <span className="text-white font-black text-sm tracking-wider"
              style={{ textShadow:"0 0 10px #f87171, 0 2px 4px rgba(0,0,0,0.9)" }}>
              {id === myId ? "◀ " : ""}{m.name}
            </span>
          </div>
        ))}
      </div>

      {/* 「決鬥開始！」閃現 */}
      {battleStart && (
        <>
          <div className="absolute inset-0 z-20 pointer-events-none"
            style={{ background:"white", animation:"screen-white 0.5s ease forwards" }} />
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="battle-start-txt text-center"
              style={{ fontSize:"clamp(2rem,9vw,3.2rem)", animation:"battle-zoom 1.5s ease forwards",
                color:"#ffd700",
                textShadow:"0 0 20px #fff, 0 0 40px #fbbf24, 0 0 80px #f59e0b, 0 0 140px #dc2626, 4px 4px 0 rgba(0,0,0,0.9)" }}>
              ⚔️ 決鬥開始！
            </div>
          </div>
        </>
      )}

      {/* 跳過提示 */}
      <div className="absolute bottom-6 left-0 right-0 text-center text-white/25 text-xs pointer-events-none">
        點擊跳過
      </div>
    </div>
  );
}

// ── 傷害計算（client-side，用於 host 處理回合）─────────────
function calcDmgFn(arrows, atk, targetDef) {
  // 防玻璃心：≥3 M → 40% 機率「天外飛箭」，救回 1~2 支
  const missCount = arrows.filter(a => a.score === 0).length;
  let processedArrows = arrows;
  let luckyEvent = null;
  if (missCount >= 3 && Math.random() < 0.40) {
    let saved = 0;
    processedArrows = arrows.map(a => {
      if (a.score === 0 && saved < 2 && Math.random() < 0.60) {
        saved++;
        const s = 5 + Math.floor(Math.random() * 3); // 5~7 分
        return { ...a, score: s, label: `✨${s}`, lucky: true };
      }
      return a;
    });
    if (saved > 0) {
      luckyEvent = {
        icon: "✨",
        title: "天外飛箭",
        desc: `${saved} 支脫靶的箭竟然擦中了目標！`,
      };
    }
  }

  let dmg = 0, crits = 0;
  const arrowBreakdown = [];
  for (const arrow of processedArrows) {
    const score = arrow.score ?? 0;
    const part  = resolveHitPart(score, ALL_PARTS, arrow.label === "X");
    const pMult = part?.mult ?? 1.0;
    if (!score || pMult === 0) {
      arrowBreakdown.push({ label: "M", partIcon:"💨", partName:"脫靶", dmg:0, isCrit:false });
      continue;
    }
    const base = 2 + atk * 0.5 + score * 0.4 - targetDef * 0.3;
    const mult = 0.85 + Math.random() * 0.3;
    const isCrit = mult > 1.05 || pMult >= 1.8;
    const d = Math.max(1, Math.round(base * pMult * mult));
    dmg += d;
    if (isCrit) crits++;
    arrowBreakdown.push({
      label: arrow.lucky ? `✨${score}` : (arrow.label || String(score)),
      partIcon: part?.icon || "❤️", partName: part?.name || "胸腔",
      partMult: pMult, dmg: d, isCrit, lucky: arrow.lucky || false,
    });
  }
  return { dmg, crits, arrowBreakdown, luckyEvent };
}

// ── 決鬥玩家小卡 ────────────────────────────────────────────
function DuelPlayerCard({ id, m, isMe, flash, displayHp, attack, revealIdx, teamA, teamB }) {
  const hp     = displayHp?.[id] ?? m.hp;
  const maxHP  = m.maxHP || 1;
  const pct    = Math.max(0, Math.round(hp / maxHP * 100));
  const color  = pct > 50 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
  const isDead = !m.alive || hp <= 0;

  return (
    <div className={`rounded-xl p-2 border transition-all ${
      isDead     ? "opacity-40 border-slate-700 bg-slate-900/40"
      : flash    ? "border-red-400 bg-red-900/15"
      : isMe     ? "border-amber-500/60 bg-amber-900/15"
               : "border-white/15 bg-white/5"
    }`} style={flash ? { animation:"hp-flash 0.4s ease" } : {}}>
      <div className="flex items-center gap-1 mb-1">
        <span className={`text-xs font-black truncate flex-1 ${
          isDead ? "line-through text-slate-500" : isMe ? "text-amber-300" : "text-slate-200"
        }`}>
          {isDead ? "💀" : m.ready ? "✅" : "🏹"} {m.name}
          {isMe && <span className="ml-1 text-[9px] text-amber-400/70">(我)</span>}
          {m.catName && <span className="ml-1 text-[9px] text-indigo-400">🐱</span>}
        </span>
      </div>
      <div className="h-1.5 bg-slate-700/80 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width:`${pct}%`, background:color }} />
      </div>
    </div>
  );
}

// ── 主組件 ─────────────────────────────────────────────────
export default function DuelRoom({ roomId, isHost, onLeave, profile, isGuest }) {
  const checkinActive = useCheckinActive(profile?.id);
  const { catMsg, clearCatMsg, showCatEntry, saveBond, hasCat, catName: myCatName, calcCatRoundDamage } = useCatCompanion();
  const { toast, ToastContainer } = useToast();
  const [room, setRoom]           = useState(null);
  const [myArrows, setMyArrows]   = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [targetMode, setTargetMode]   = useState(() => getBattleInputMode() === "target");
  const [targetPending, setTargetPending] = useState(false);
  const [targetFmt, setTargetFmt]     = useState(getBattleTargetFmt);
  const [revealEntry, setRevealEntry] = useState(null);
  const [revealIdx, setRevealIdx]     = useState(-1);
  const [floats, setFloats]           = useState([]);   // { id, text, team, memberId, isCrit }
  const [flashIds, setFlashIds]       = useState({});   // { memberId: true }
  const [resultShown, setResultShown] = useState(false);
  const [showResult,  setShowResult]  = useState(false); // 玩家確認後才跳結算頁
  const [eventPhase,  setEventPhase]  = useState(false); // 事件暫停畫面
  const [duelStats, setDuelStats]     = useState(null);
  const [showDuelCard, setShowDuelCard] = useState(false);
  const [milestoneQueue, setMilestoneQueue] = useState([]);
  const [cheerMsg, setCheerMsg]       = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showIntro,    setShowIntro]    = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [attackingIds, setAttackingIds] = useState(new Set());
  const [hittingIds,   setHittingIds]   = useState(new Set());
  const [displayHp, setDisplayHp]    = useState(null); // 揭露動畫期間的血量暫存（回合前→逐箭扣）
  const [showEndAnim, setShowEndAnim]  = useState(false); // 結束動畫（kill feed + MVP）
  const [revealPhaseBanner, setRevealPhaseBanner] = useState(null); // "A" | "B" | null
  const battleAreaRef = useRef(null);
  const lastLogLen      = useRef(0);
  const lastCheerTs     = useRef(0);
  const heartbeatRef    = useRef(null);
  const lastRoundFired  = useRef(0);
  const catAppliedRef   = useRef(false);
  const prevDuelRound   = useRef(0);
  const introShownRef   = useRef(false);

  const myId   = profile?.id || profile?.uid || "guest";
  const myName = profile?.nickname || profile?.name || (isGuest ? "訪客" : "射手");

  // 我在哪一隊
  const myTeam = room
    ? (Object.keys(room.teamA || {}).includes(myId) ? "A" : "B")
    : null;

  // ── 訂閱房間 ────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeDuelRoom(roomId, r => setRoom(r));
    // host 進場時清除可能卡住的 processing（前次異常遺留）
    if (isHost) clearDuelProcessing(roomId).catch(() => {});
    return unsub;
  }, [roomId]);

  // ── 入場動畫：第一次進入 active 且 log 為空才觸發 ─────────
  useEffect(() => {
    if (room?.status !== "active" || introShownRef.current) return;
    introShownRef.current = true;
    if ((room?.round || 1) === 1 && !(room?.log?.length)) {
      setShowIntro(true);
    }
  }, [room?.status]); // eslint-disable-line

  // ── 心跳（30s）──────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !myId) return;
    heartbeatRef.current = setInterval(() => updateDuelHeartbeat(roomId, myId), 30000);
    return () => clearInterval(heartbeatRef.current);
  }, [roomId, myId]);

  // ── 貓貓光環：進房後套用一次（只寫一次 Firestore）─────────
  useEffect(() => {
    if (!room || !myTeam || !hasCat || catAppliedRef.current) return;
    const myData = (myTeam === "A" ? room.teamA : room.teamB)?.[myId];
    if (!myData) return;
    if (myData.catName) { catAppliedRef.current = true; return; } // 已套用
    catAppliedRef.current = true;
    applyPlayerCatToRoom(roomId, myTeam, myId, myCatName, 1.0).catch(() => {});
  }, [room, myTeam, hasCat]); // eslint-disable-line

  // ── 決鬥開始時顯示一次貓貓進場訊息（intro 結束後）──────────
  useEffect(() => {
    if (!hasCat || room?.status !== "active" || showIntro) return;
    if (prevDuelRound.current !== 0) return;
    prevDuelRound.current = 1;
    showCatEntry();
  }, [hasCat, room?.status, showIntro]); // eslint-disable-line

  // ── 防呆：戰鬥結束後 8 秒還沒進結算 → 強制顯示 ────────────
  useEffect(() => {
    if (room?.status !== "finished" || showResult || showEndAnim) return;
    const t = setTimeout(() => setShowEndAnim(true), 8000);
    return () => clearTimeout(t);
  }, [room?.status, showResult]); // eslint-disable-line

  // ── 30 秒未送出箭分提醒 ─────────────────────────────────
  const needsSubmit = !submitted && (room?.status === "active") && !eventPhase
    && revealIdx < 0;   // 不在揭露動畫期間
  useEffect(() => {
    if (!needsSubmit) return;
    const t = setTimeout(() => toast("⏰ 快點送出本回合的箭分！"), 30000);
    return () => clearTimeout(t);
  }, [needsSubmit]); // eslint-disable-line

  // ── 偵測新 log 並開始揭露動畫 ───────────────────────────
  useEffect(() => {
    if (!room?.log?.length) return;
    if (room.log.length <= lastLogLen.current) return;
    lastLogLen.current = room.log.length;
    const entry = room.log[room.log.length - 1];
    // 從 hpDelta 反推回合開始前的 HP（hpDelta 為負值，故 preHp = m.hp - hpDelta）
    const preHp = {};
    [...Object.entries(room.teamA || {}), ...Object.entries(room.teamB || {})].forEach(([id, m]) => {
      preHp[id] = Math.max(0, (m.hp || 0) - (entry.hpDelta?.[id] || 0));
    });
    setDisplayHp(preHp);
    setRevealEntry(entry);
    setSubmitted(false);
    setMyArrows([]);
    // 有事件 → 先全員暫停看事件畫面，之後再播逐箭動畫
    if (entry.event) {
      setEventPhase(true);
    } else {
      setRevealIdx(0);
    }
  }, [room?.log?.length]);

  // ── 逐箭揭露計時器（一來一往：前 6 步 A 攻 B，後 6 步 B 攻 A）──
  useEffect(() => {
    if (revealIdx < 0 || !revealEntry) return;
    if (revealIdx >= REVEAL_TOTAL) return;

    // 判斷當前是 A 攻還是 B 攻
    const phase     = revealIdx < ARROWS ? "A" : "B";
    const arrowIdx  = revealIdx % ARROWS;

    // 換邊時顯示相間橫幅
    if (revealIdx === ARROWS) {
      setRevealPhaseBanner("B");
      const bt = setTimeout(() => setRevealPhaseBanner(null), 800);
      // 延遲 900ms 後繼續（讓橫幅看得到）
      const t = setTimeout(() => setRevealIdx(i => i + 1), 900);
      return () => { clearTimeout(bt); clearTimeout(t); };
    }

    // 只處理本回合攻擊方的攻擊
    const teamAIds = new Set(Object.keys(room?.teamA || {}));
    const phaseAttacks = (revealEntry.attacks || []).filter(a =>
      phase === "A" ? teamAIds.has(a.attackerId) : !teamAIds.has(a.attackerId)
    );

    const t = setTimeout(() => {
      const lungers = phaseAttacks.filter(a => (a.arrowBreakdown?.[arrowIdx]?.dmg || 0) > 0).map(a => a.attackerId);
      const targets = phaseAttacks.filter(a => (a.arrowBreakdown?.[arrowIdx]?.dmg || 0) > 0).map(a => a.targetId);
      if (lungers.length) {
        setAttackingIds(new Set(lungers));
        setHittingIds(new Set(targets));
        setTimeout(() => { setAttackingIds(new Set()); setHittingIds(new Set()); }, 700);
      }

      // 音效：每箭只播一次（最強音效優先）
      let playCrit = false, playHit = false;
      const newFloats = [];
      for (const atk of phaseAttacks) {
        const bk = atk.arrowBreakdown?.[arrowIdx];
        if (!bk || bk.dmg === 0) continue;
        if (bk.isCrit) playCrit = true; else playHit = true;
        newFloats.push({
          id: `${atk.attackerId}-${revealIdx}-${Date.now()}`,
          text: bk.isCrit ? `💥 ${bk.dmg}!` : `-${bk.dmg}`,
          memberId: atk.targetId,
          isCrit: bk.isCrit,
        });
        setFlashIds(prev => ({ ...prev, [atk.targetId]: true }));
        setTimeout(() => setFlashIds(prev => { const n = {...prev}; delete n[atk.targetId]; return n; }), 400);
      }
      if (playCrit) sfxCritBoom(); else if (playHit) sfxArrowHit();

      if (newFloats.length) {
        setFloats(prev => [...prev, ...newFloats]);
        setTimeout(() => setFloats(prev => prev.filter(f => !newFloats.find(n => n.id === f.id))), 1400);
      }
      // 逐箭扣血條（本階段攻擊者造成的傷害）
      setDisplayHp(prev => {
        if (!prev) return prev;
        const next = { ...prev };
        for (const atk of phaseAttacks) {
          const bk = atk.arrowBreakdown?.[arrowIdx];
          if (!bk || bk.dmg === 0) continue;
          next[atk.targetId] = Math.max(0, (next[atk.targetId] ?? 0) - bk.dmg);
        }
        return next;
      });
      setRevealIdx(i => i + 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [revealIdx, revealEntry]); // eslint-disable-line

  // 事件暫停：4 秒後自動進入逐箭揭露
  useEffect(() => {
    if (!eventPhase) return;
    const t = setTimeout(() => { setEventPhase(false); setRevealIdx(0); }, 4000);
    return () => clearTimeout(t);
  }, [eventPhase]);

  // 揭露完畢 → 清暫存血量、死亡音效
  useEffect(() => {
    if (revealIdx < REVEAL_TOTAL || !room) return;
    setDisplayHp(null); // 回到 room 真實 HP
    setRevealPhaseBanner(null);
    const allMembers = [
      ...Object.entries(room.teamA || {}).map(([id, m]) => ({ id, ...m })),
      ...Object.entries(room.teamB || {}).map(([id, m]) => ({ id, ...m })),
    ];
    if (allMembers.some(m => !m.alive && m.hp <= 0)) sfxMonsterDead();
  }, [revealIdx]); // eslint-disable-line

  // ── 加油訊息 ────────────────────────────────────────────
  useEffect(() => {
    if (!room?.cheer?.ts) return;
    if (room.cheer.ts <= lastCheerTs.current) return;
    lastCheerTs.current = room.cheer.ts;
    setCheerMsg(`🎉 ${room.cheer.fromName} 加油！`);
    setTimeout(() => setCheerMsg(""), 3000);
  }, [room?.cheer?.ts]);

  // ── Host：偵測所有人就緒 → 先幫機器人補送箭分，再處理回合 ──
  useEffect(() => {
    if (!isHost || !room || room.status !== "active" || room.processing) return;
    const currentRound = room.round || 1;
    if (lastRoundFired.current >= currentRound) return; // 同一回合只結算一次
    const teamA = room.teamA || {};
    const teamB = room.teamB || {};
    const aliveA = Object.entries(teamA).filter(([, m]) => m.alive);
    const aliveB = Object.entries(teamB).filter(([, m]) => m.alive);
    if (!aliveA.length || !aliveB.length) return;
    // 未 ready 的機器人：立即幫牠送出箭分，等下一次 snapshot 再結算
    const botsUnready = [
      ...aliveA.map(([id, m]) => ({ id, m, team: "A" })),
      ...aliveB.map(([id, m]) => ({ id, m, team: "B" })),
    ].filter(({ m }) => m.isBot && !m.ready);
    if (botsUnready.length > 0) {
      botsUnready.forEach(({ id, m, team }) => {
        const arrows = generateBotArrows(m.difficulty || "normal");
        submitDuelArrows(roomId, team, id, arrows).catch(() => {});
      });
      return;
    }
    const allReady = [...aliveA, ...aliveB].every(([, m]) => m.ready);
    if (!allReady) return;
    lastRoundFired.current = currentRound;
    processDuelRound(roomId, room, calcDmgFn);
  }, [room]); // eslint-disable-line

  // ── 結算時記錄成就/統計 ─────────────────────────────────
  useEffect(() => {
    if (!room || room.status !== "finished" || resultShown) return;
    setResultShown(true);
    if (isGuest || !profile?.id || !myTeam) return;

    const isSolo  = room.type === "1v1";
    const mode    = isSolo ? "solo" : "team";
    let outcome   = "draw";
    if (room.result === `team${myTeam}`) outcome = "win";
    if (room.result !== `team${myTeam}` && room.result !== "draw") outcome = "loss";

    // 完美勝利：我的 HP 未減少
    const myHP    = (myTeam === "A" ? room.teamA : room.teamB)?.[myId]?.hp;
    const myMaxHP = (myTeam === "A" ? room.teamA : room.teamB)?.[myId]?.maxHP;
    const flawless = outcome === "win" && myHP === myMaxHP;

    // 我打出的總傷害
    const myDmg = (room.log || []).reduce((sum, entry) => {
      return sum + (entry.attacks || [])
        .filter(a => a.attackerId === myId)
        .reduce((s, a) => s + (a.dmg || 0), 0);
    }, 0);

    recordDuelResult(profile.id, outcome, mode, { flawless, dmg: myDmg });
    getDuelStats(profile.id).then(setDuelStats);
    saveBond("monster");

    // 箭數累積 + 里程碑
    if (profile?.id) {
      const myArrowCount = (room.log || []).flatMap(entry =>
        (entry.attacks || []).filter(a => a.attackerId === myId)
          .flatMap(a => a.arrowBreakdown || [])
      ).length;
      if (myArrowCount > 0) {
        const todayStr = new Date().toISOString().slice(0, 10);
        addPracticeLog(profile.id, {
          date: todayStr, source: "duel",
          totalArrows: myArrowCount,
        }, profile.id).catch(() => {});
        addArrowdew(profile.id, myArrowCount).catch(() => {});
        // 射手等級 XP（勝利 50、失敗/平局 20）
        const duelXP = outcome === "win" ? DUEL_WIN_XP : DUEL_LOSE_XP;
        addArcherXP(profile.id, duelXP).catch(() => {});
        if (checkinActive) {
          const milestones = getMilestonesReached(0, myArrowCount);
          if (milestones.length > 0) {
            grantArrowMilestoneRewards(profile.id, milestones).catch(() => {});
            setMilestoneQueue(milestones.map(ms => ({ ms, rewards: getRewardsForMilestone(ms) })));
          }
        }
      }
    }
  }, [room?.status]);

  // ── 輸入箭分 ────────────────────────────────────────────
  function addArrow(score, label) {
    if (myArrows.length >= ARROWS || submitted) return;
    sfxArrowHit();
    setMyArrows(prev => [...prev, { score, label }]);
  }
  function addArrowByLabel(label) {
    const rawScore = label === "M" ? 0 : label === "X" ? 10 : parseInt(label) || 0;
    const score = (targetFmt === "field_16" && rawScore > 0)
      ? Math.min(rawScore + 5, 10)
      : rawScore;
    addArrow(score, label);
  }
  function removeArrow() {
    setMyArrows(prev => prev.slice(0, -1));
  }
  function handleTargetSubmit() {
    setTargetPending(true);
    setTimeout(() => { setTargetPending(false); handleSubmit(); }, 2000);
  }
  async function handleSubmit() {
    if (myArrows.length < ARROWS || submitted || !myTeam) return;
    setSubmitted(true);
    battleAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    await submitDuelArrows(roomId, myTeam, myId, myArrows, selectedTarget || null);
  }

  async function handleCheer() {
    await sendDuelCheer(roomId, myName);
  }
  function startReveal() {
    setEventPhase(false);
    setRevealIdx(0);
  }

  function resetLocalState() {
    setResultShown(false);
    setShowResult(false);
    setShowEndAnim(false);
    setRevealPhaseBanner(null);
    setEventPhase(false);
    setRevealEntry(null);
    setRevealIdx(-1);
    setSelectedTarget(null);
    setAttackingIds(new Set());
    setHittingIds(new Set());
    lastLogLen.current = 0;
    lastRoundFired.current = 0;
  }

  async function handleReset() {
    if (!isHost || !room) return;
    await resetDuelRoom(roomId, room);
    resetLocalState();
  }

  // ── 再來一局：投票 ──────────────────────────────────────
  async function handleProposeRematch() {
    await proposeRematch(roomId, myId);
  }
  async function handleVoteRematch() {
    await voteRematch(roomId, myId);
  }

  // host 主動開始下一局（不等全員同意，重新分隊）
  async function handleStartRematch() {
    if (!isHost || !room) return;
    await resetWithRedistribution(roomId, room);
    resetLocalState();
  }

  // 不同意：將自己移出房間後離開
  async function handleDisagree() {
    if (!myTeam) { onLeave(); return; }
    await removePlayerFromRoom(roomId, myTeam, myId).catch(() => {});
    onLeave();
  }

  const rematchVotes = room?.rematch?.votes || {};

  if (!room) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
      <div className="animate-pulse text-2xl">⚔️ 連接中…</div>
    </div>
  );

  // ── 結束動畫（kill feed + MVP）────────────────────────────
  if (showEndAnim && !showResult) {
    // 計算 kill feed
    const allPlayers = [
      ...Object.entries(room.teamA||{}).map(([id,m]) => ({id,m})),
      ...Object.entries(room.teamB||{}).map(([id,m]) => ({id,m})),
    ];
    const hpTrace = {};
    for (const {id, m} of allPlayers) hpTrace[id] = m.maxHP || m.hp || 1;
    const killFeed = [];
    for (const entry of room.log||[]) {
      for (const atk of entry.attacks||[]) {
        const prev = hpTrace[atk.targetId] ?? 0;
        const after = Math.max(0, prev - (atk.dmg||0));
        if (prev > 0 && after <= 0 && !killFeed.find(k => k.victimId === atk.targetId)) {
          killFeed.push({ killerId: atk.attackerId, killerName: atk.attackerName||"?", victimId: atk.targetId, victimName: atk.targetName||"?" });
        }
        hpTrace[atk.targetId] = after;
      }
    }
    // MVP = 最高總傷害
    const dmgMap = {};
    for (const entry of room.log||[]) {
      for (const atk of entry.attacks||[]) {
        dmgMap[atk.attackerId] = (dmgMap[atk.attackerId]||0) + (atk.dmg||0);
      }
    }
    let mvpId = null, mvpDmg = 0;
    for (const [id, dmg] of Object.entries(dmgMap)) {
      if (dmg > mvpDmg) { mvpDmg = dmg; mvpId = id; }
    }
    const mvpPlayer = allPlayers.find(p => p.id === mvpId);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5"
        style={{ background:"linear-gradient(135deg,#0f172a,#1e1b4b)" }}>
        <style>{DUEL_CSS}</style>
        <div className="text-slate-400 text-xs tracking-widest font-bold">⚔️ 本場回顧</div>

        {/* kill feed */}
        {killFeed.length > 0 && (
          <div className="w-full max-w-sm space-y-2">
            {killFeed.map((k, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3"
                style={{ animation:`kill-in .4s ease ${i * 0.25}s both` }}>
                <span className="text-lg">💀</span>
                <div className="flex-1 text-sm">
                  <span className="font-black text-red-300">{k.killerName}</span>
                  <span className="text-slate-400"> 擊倒了 </span>
                  <span className="font-black text-slate-300">{k.victimName}</span>
                </div>
                <span className="text-xs text-slate-500">尾刀</span>
              </div>
            ))}
          </div>
        )}
        {killFeed.length === 0 && (
          <div className="text-slate-500 text-sm">此回合無人擊倒</div>
        )}

        {/* MVP */}
        {mvpPlayer && (
          <div className="w-full max-w-sm bg-amber-500/10 border border-amber-400/40 rounded-3xl p-5 text-center"
            style={{ animation:`mvp-pop .6s cubic-bezier(.34,1.56,.64,1) ${killFeed.length * 0.25 + 0.2}s both` }}>
            <div className="text-3xl mb-1">🏅</div>
            <div className="text-amber-300 text-xs font-bold tracking-widest mb-2">本場 MVP</div>
            <div className="text-white font-black text-xl">{mvpPlayer.m.name}</div>
            <div className="text-amber-400 text-sm mt-1">造成傷害 {mvpDmg}</div>
          </div>
        )}

        <button onClick={() => { setShowEndAnim(false); setShowResult(true); }}
          className="w-full max-w-sm py-3 rounded-2xl font-black text-white border border-amber-400/50 active:scale-95 transition-all mt-2"
          style={{ background:"linear-gradient(135deg,#92400e,#b45309)" }}>
          查看完整結果 →
        </button>
      </div>
    );
  }

  // ── 結算畫面 ────────────────────────────────────────────
  if (showResult) {
    const win  = room.result === `team${myTeam}`;
    const draw = room.result === "draw";
    const isSolo = room.type === "1v1";

    const allA = Object.entries(room.teamA || {});
    const allB = Object.entries(room.teamB || {});

    const myDmg = (room.log || []).reduce((sum, entry) => {
      return sum + (entry.attacks || [])
        .filter(a => a.attackerId === myId)
        .reduce((s, a) => s + (a.dmg || 0), 0);
    }, 0);
    const totalRounds = room.log?.length || 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 gap-4">
        <style>{DUEL_CSS}</style>
        <ToastContainer />

        {/* 結果大字 */}
        <div className="text-center" style={{ animation:"result-pop .6s cubic-bezier(.34,1.56,.64,1) forwards" }}>
          <div className="text-7xl mb-2">{draw ? "🤝" : win ? "🏆" : "💀"}</div>
          <div className={`text-4xl font-black ${draw ? "text-slate-300" : win ? "text-amber-400" : "text-red-400"}`}>
            {draw ? "平局" : win ? "勝利！" : "落敗"}
          </div>
          <div className="text-slate-400 text-sm mt-1">{totalRounds} 回合</div>
        </div>

        {/* 雙隊 HP 對比 */}
        <div className="w-full max-w-sm flex gap-3">
          {[["A", allA], ["B", allB]].map(([team, entries]) => (
            <div key={team} className={`flex-1 rounded-2xl p-3 border ${team === myTeam ? "border-amber-500/50 bg-amber-900/20" : "border-white/10 bg-white/5"}`}>
              <div className={`text-xs font-black tracking-widest mb-2 ${team === "A" ? "text-blue-300" : "text-red-300"}`}>隊伍 {team}</div>
              {entries.map(([id, m]) => (
                <DuelPlayerCard key={id} id={id} m={m} isMe={id === myId} flash={false} displayHp={null} />
              ))}
            </div>
          ))}
        </div>

        {/* 我的本場統計 */}
        <div className="w-full max-w-sm rounded-2xl bg-white/5 border border-white/10 p-4 flex justify-around">
          <div className="text-center">
            <div className="text-xl font-black text-white">{myDmg}</div>
            <div className="text-xs text-slate-400">⚔️ 造成傷害</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-white">{room.log?.reduce((s, e) => s + (e.attacks || []).filter(a => a.attackerId === myId).reduce((ss, a) => ss + (a.crits || 0), 0), 0)}</div>
            <div className="text-xs text-slate-400">💥 爆擊次數</div>
          </div>
          {duelStats && (
            <div className="text-center">
              <div className="text-xl font-black text-white">
                {duelStats.wins + (win ? 0 : 0)}W {duelStats.losses}L
              </div>
              <div className="text-xs text-slate-400">📊 累積戰績</div>
            </div>
          )}
        </div>

        {/* 按鈕 */}
        <div className="w-full max-w-sm flex flex-col gap-2">
          {/* 未發起：host 顯示「再來一局」 */}
          {!room.rematch?.pending && isHost && (
            <button onClick={handleProposeRematch}
              className="w-full py-3 rounded-2xl font-black text-white border border-amber-400/50"
              style={{ background:"linear-gradient(135deg,#92400e,#b45309)" }}>
              ⚔️ 再來一局
            </button>
          )}
          {!room.rematch?.pending && !isHost && (
            <div className="text-center text-slate-400 text-sm py-1">等待主持人發起下一局…</div>
          )}

          {/* 投票中 */}
          {room.rematch?.pending && (() => {
            const total = Object.keys(room.teamA||{}).length + Object.keys(room.teamB||{}).length;
            const vCount = Object.keys(rematchVotes).length;
            const myVoted = !!rematchVotes[myId];
            return (
              <div className="flex flex-col gap-2">
                <div className="text-center text-slate-300 text-sm font-bold py-1">
                  ⚔️ 再來一局？　同意 {vCount}/{total}
                </div>
                {isHost && (
                  <button onClick={handleStartRematch}
                    className="w-full py-3 rounded-2xl font-black text-white border border-amber-400/50"
                    style={{ background:"linear-gradient(135deg,#1d4ed8,#6d28d9)" }}>
                    🚀 開始下一局（{vCount} 人同意）
                  </button>
                )}
                {!isHost && !myVoted && (
                  <button onClick={handleVoteRematch}
                    className="w-full py-3 rounded-2xl font-black text-white border border-green-400/50"
                    style={{ background:"linear-gradient(135deg,#065f46,#16a34a)" }}>
                    ✅ 同意
                  </button>
                )}
                {!isHost && !myVoted && (
                  <button onClick={handleDisagree}
                    className="w-full py-2.5 rounded-2xl font-black text-red-400 border border-red-600/40 bg-red-900/20">
                    ❌ 不同意（離開房間）
                  </button>
                )}
                {!isHost && myVoted && (
                  <div className="text-center text-green-400 text-sm font-bold py-1 animate-pulse">
                    ✅ 已同意，等待主持人開始…
                  </div>
                )}
              </div>
            );
          })()}

          <button onClick={() => setShowDuelCard(true)}
            className="w-full py-2.5 rounded-2xl font-black text-indigo-300 border border-indigo-500/40 bg-indigo-900/20">
            📤 分享戰績小卡
          </button>
          <button onClick={onLeave}
            className="w-full py-3 rounded-2xl font-black text-slate-300 border border-slate-600 bg-slate-800">
            ← 離開
          </button>
        </div>

        {showDuelCard && (
          <DuelBattleCard
            onClose={() => setShowDuelCard(false)}
            duelData={{ room, myId }}
          />
        )}
      </div>
    );
  }

  // ── 事件暫停畫面（全員同步看到，4 秒後或點擊繼續）────────
  if (eventPhase && revealEntry?.event) {
    const ev = revealEntry.event;
    const isBetrayal  = ev.id === "betrayal";
    const bgStyle = isBetrayal
      ? { background: "linear-gradient(135deg,#1a0533,#3b1a6e)" }
      : ev.type === "debuff"
        ? { background: "linear-gradient(135deg,#1a0000,#4a0000)" }
        : { background: "linear-gradient(135deg,#001a0a,#004422)" };
    const titleColor = isBetrayal ? "text-purple-200" : ev.type === "debuff" ? "text-red-300" : "text-green-300";

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6" style={bgStyle}>
        <style>{DUEL_CSS}</style>

        <div className="text-center max-w-xs" style={{ animation:"result-pop .5s cubic-bezier(.34,1.56,.64,1) forwards" }}>
          <div className="text-8xl mb-4">{ev.icon}</div>
          <div className={`text-3xl font-black mb-3 ${titleColor}`}>{ev.title}</div>
          <div className="text-slate-300 text-sm leading-relaxed">{ev.desc}</div>

          {/* 叛變事件：顯示交換的成員 */}
          {isBetrayal && ev.swapAName && ev.swapBName && (
            <div className="mt-5 flex items-center justify-center gap-4 p-4 rounded-2xl bg-white/10 border border-white/20">
              <div className="text-center">
                <div className="text-xs text-blue-300 mb-1">隊伍 A</div>
                <div className="font-black text-white">{ev.swapAName}</div>
              </div>
              <div className="text-3xl animate-pulse text-purple-300">⇄</div>
              <div className="text-center">
                <div className="text-xs text-red-300 mb-1">隊伍 B</div>
                <div className="font-black text-white">{ev.swapBName}</div>
              </div>
            </div>
          )}
        </div>

        <button onClick={startReveal}
          className="px-8 py-3 rounded-2xl font-black text-sm text-white border border-white/30 bg-white/10 active:scale-95 transition-all">
          繼續 →
        </button>
        <div className="text-slate-500 text-xs">4 秒後自動繼續</div>
      </div>
    );
  }

  // ── 戰鬥主畫面 ──────────────────────────────────────────
  const teamA = room.teamA || {};
  const teamB = room.teamB || {};
  const allA  = Object.entries(teamA);
  const allB  = Object.entries(teamB);
  const aliveA = allA.filter(([, m]) => m.alive);
  const aliveB = allB.filter(([, m]) => m.alive);

  const isRevealing = revealIdx >= 0 && revealIdx < REVEAL_TOTAL;
  const myPlayer = (myTeam === "A" ? teamA : teamB)?.[myId];
  const canSubmit = myArrows.length >= ARROWS && !submitted && !targetPending;
  const amAlive   = myPlayer?.alive !== false;

  // Host 斷線偵測：90 秒未心跳視為可能斷線
  const STALE_MS = 90_000;
  const staleMembers = (room.status === "active" && isHost)
    ? [...allA.map(([id, m]) => ({ id, team:"A", m })), ...allB.map(([id, m]) => ({ id, team:"B", m }))]
      .filter(({ id, m }) => m.alive && !m.ready && id !== myId && room.lastSeen?.[id] && Date.now() - room.lastSeen[id] > STALE_MS)
    : [];

  // 本回合我攻擊的目標（從最新 log entry）
  const myLastAtk = revealEntry?.attacks?.find(a => a.attackerId === myId);

  const lastLogEntry = room.log?.length > 0 ? room.log[room.log.length - 1] : null;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden"
      style={{ backgroundImage:"url(/ui/dungeon-bg.webp)", backgroundSize:"cover", backgroundPosition:"center" }}>
      <style>{DUEL_CSS}</style>
      {milestoneQueue.length > 0 && (
        <ArrowMilestonePopup
          milestones={milestoneQueue.map(q => q.ms)}
          rewardsList={milestoneQueue.map(q => q.rewards)}
          onAllClose={() => setMilestoneQueue([])} />
      )}
      {showIntro && room && (
        <DuelIntro room={room} myId={myId} onDone={() => setShowIntro(false)} />
      )}
      <ToastContainer />
      <CatMsg msg={catMsg} onDone={clearCatMsg}/>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50 shrink-0">
        <button onClick={() => { if (room?.status === "active") { setConfirmLeave(true); } else { onLeave(); } }}
          className="text-slate-300 text-sm">← 離開</button>
        <div className="text-white font-black text-sm">
          ⚔️ {room.type} 決鬥 · 第 {(room.round || 1) - (isRevealing ? 1 : 0)} 回合
        </div>
        <button onClick={handleCheer} className="text-slate-300 text-xl">🎉</button>
      </div>

      {/* 加油訊息 */}
      {cheerMsg && (
        <div className="mx-4 mt-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 text-sm font-bold text-center py-2 shrink-0"
          style={{ animation:"slide-in .3s ease" }}>
          {cheerMsg}
        </div>
      )}

      {/* 斷線玩家提示（只有 host 看到） */}
      {staleMembers.length > 0 && (
        <div className="mx-4 mt-2 rounded-xl bg-orange-900/40 border border-orange-500/40 px-3 py-2 shrink-0">
          {staleMembers.map(({ id, team, m }) => (
            <div key={id} className="flex items-center justify-between text-xs">
              <span className="text-orange-300">📡 {m.name} 可能斷線</span>
              <button onClick={() => skipDisconnected(roomId, team, id).catch(() => {})}
                className="text-red-300 border border-red-500/40 rounded-lg px-2 py-0.5 font-bold ml-2">
                跳過
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 事件橫幅 */}
      {isRevealing && revealEntry?.event && (
        <div className={`mx-4 mt-2 rounded-xl px-3 py-2 text-sm font-black text-center border shrink-0 ${revealEntry.event.type === "buff" ? "bg-green-900/40 border-green-500/40 text-green-300" : revealEntry.event.type === "duel_special" ? "bg-purple-900/40 border-purple-500/40 text-purple-300" : "bg-red-900/40 border-red-500/40 text-red-300"}`}
          style={{ animation:"slide-in .3s ease" }}>
          {revealEntry.event.icon} {revealEntry.event.title} — {revealEntry.event.desc}
        </div>
      )}

      {/* 換邊橫幅 */}
      {revealPhaseBanner === "B" && (
        <div className="mx-4 mt-2 rounded-xl px-3 py-2 text-sm font-black text-center border shrink-0 bg-red-900/60 border-red-500/60 text-red-200"
          style={{ animation:"slide-in .2s ease" }}>
          ⚔️ 隊伍 B 反擊！
        </div>
      )}

      {/* 雙隊弓箭手 + 血條 — 可滾動中間區 */}
      <div ref={battleAreaRef} className="flex-1 overflow-y-auto">

      {/* 角色展示區：弓箭手 + 短血條 直列 */}
      {(() => {
        const maxSide = Math.max(allA.length, allB.length);
        // 超過4隻改用2欄網格
        const useGrid = maxSide > 4;
        const imgSz   = maxSide >= 6 ? 44 : maxSide >= 4 ? 56 : 72;

        const renderArcher = (id, m, team) => {
          const hp      = displayHp?.[id] ?? m.hp;
          const maxHP   = m.maxHP || 1;
          const pct     = Math.max(0, hp / maxHP * 100);
          const hpColor = pct > 50 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
          const isDead  = isRevealing ? hp <= 0 : !m.alive;
          const isAtk   = attackingIds.has(id);
          const isHit   = hittingIds.has(id);
          const anim    = isAtk ? (team === "A" ? "lunge-right .55s ease" : "lunge-left .55s ease")
                        : isHit ? (team === "A" ? "recoil-left .4s ease" : "recoil-right .4s ease")
                        : undefined;
          const myBg    = "rgba(255,255,255,0.04)";
          const border  = "1px solid rgba(255,255,255,0.08)";

          return (
            <div key={id} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2,
              padding:"4px 3px", background:myBg, border, borderRadius:8,
              opacity: isDead ? 0.35 : 1, animation: anim, position:"relative" }}>
              <img src={`/cats/archers/${m.archerStyle||"baobao"}.webp`} alt={m.name}
                style={{ width:imgSz, height:imgSz, objectFit:"contain",
                  transform: team === "B" ? "scaleX(-1)" : undefined,
                  filter: isDead ? "grayscale(1)" : undefined }} />
              <div style={{ fontSize:8, fontWeight:700, maxWidth:imgSz+8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                color: id === myId ? "#fbbf24" : team === "A" ? "#93c5fd" : "#fca5a5" }}>
                {isDead ? "💀" : ""}{m.name}{id === myId ? " ▲" : ""}
              </div>
              <div style={{ width:imgSz+4, height:4, background:"rgba(255,255,255,0.1)", borderRadius:3, overflow:"hidden",
                animation: flashIds[id] ? "hp-flash 0.4s ease" : undefined }}>
                <div style={{ height:"100%", width:`${pct}%`, background:hpColor, borderRadius:3, transition:"width 0.5s" }}/>
              </div>
              {/* 浮動傷害 */}
              {floats.filter(f => f.memberId === id).map(f => (
                <span key={f.id} className={f.isCrit ? "crit-pop" : "dmg-float"}
                  style={{ top:0, left:"50%", transform:"translateX(-50%)", color: f.isCrit ? "#f59e0b" : "#f87171", zIndex:20 }}>
                  {f.text}
                </span>
              ))}
            </div>
          );
        };

        return (
          <div style={{ display:"flex", alignItems:"center", gap:4, padding:"10px 8px 6px", justifyContent:"space-between" }}>
            {/* A 隊 */}
            <div style={{ flex:1, display: useGrid ? "grid" : "flex", gridTemplateColumns: useGrid ? "1fr 1fr" : undefined,
              flexDirection: useGrid ? undefined : "column", gap:4 }}>
              {allA.map(([id, m]) => renderArcher(id, m, "A"))}
            </div>

            <div style={{ color:"#fbbf24", fontWeight:900, fontSize:18, padding:"0 6px", flexShrink:0, textShadow:"0 0 12px #f59e0b" }}>VS</div>

            {/* B 隊（鏡像） */}
            <div style={{ flex:1, display: useGrid ? "grid" : "flex", gridTemplateColumns: useGrid ? "1fr 1fr" : undefined,
              flexDirection: useGrid ? undefined : "column", gap:4 }}>
              {allB.map(([id, m]) => renderArcher(id, m, "B"))}
            </div>
          </div>
        );
      })()}


      {/* 戰鬥結束 → reveal 跑完後顯示確認按鈕 */}
      {room.status === "finished" && !showResult && !showEndAnim && (
        <div className="mx-4 mt-3">
          {revealIdx >= REVEAL_TOTAL ? (
            <button onClick={() => setShowEndAnim(true)}
              className="w-full py-3 rounded-2xl font-black text-white border border-amber-400/60 active:scale-95 transition-transform"
              style={{ background:"linear-gradient(135deg,#92400e,#b45309)", animation:"slide-in .4s ease" }}>
              🏆 查看戰鬥結果
            </button>
          ) : (
            <div className="text-center text-slate-400 text-sm animate-pulse py-2">⚔️ 結算中，請稍候…</div>
          )}
        </div>
      )}
      </div>{/* end scrollable */}

      {/* 箭分輸入區 — 固定在底部，送出後消失 */}
      {amAlive && !isRevealing && !submitted && room.status === "active" && (
        <div className="px-4 pb-4 pt-2 border-t border-white/10 bg-black/30 shrink-0">
          {/* 已輸入箭 */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className="text-[10px] text-slate-400 font-bold">{myArrows.length}/{ARROWS}：</span>
            {myArrows.map((a, i) => (
              <span key={i} className={`text-xs font-black px-1.5 py-0.5 rounded-lg ${a.score === 0 ? "bg-slate-700 text-slate-400" : a.score >= 9 ? "bg-amber-600 text-white" : "bg-slate-600 text-white"}`}>
                {a.label}
              </span>
            ))}
            {myArrows.length > 0 && (
              <button onClick={removeArrow} className="text-slate-500 text-[10px] underline ml-1">撤銷</button>
            )}
          </div>

          {/* 指定目標（多目標才顯示） */}
          {(() => {
            const enemies = Object.entries(myTeam === "A" ? teamB : teamA).filter(([, m]) => m.alive);
            if (enemies.length <= 1) return null;
            return (
              <div className="mb-2">
                <div className="text-[9px] text-slate-500 mb-1">🎯 指定目標（50% 命中）</div>
                <div className="flex gap-1 flex-wrap">
                  <button onClick={() => setSelectedTarget(null)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${!selectedTarget ? "bg-amber-600 border-amber-400 text-white" : "bg-slate-700/80 border-slate-600 text-slate-300"}`}>
                    隨機
                  </button>
                  {enemies.map(([eid, em]) => (
                    <button key={eid} onClick={() => setSelectedTarget(eid === selectedTarget ? null : eid)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${selectedTarget === eid ? "bg-red-600 border-red-400 text-white" : "bg-slate-700/80 border-slate-600 text-slate-300"}`}>
                      {em.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {myArrows.length === 0 && !targetPending && (
            <div className="bg-slate-800/60 border border-slate-600/40 rounded-xl p-3 mb-2 flex flex-col gap-3">
              <TargetFmtPicker value={targetFmt} onChange={v => { setTargetFmt(v); setBattleTargetFmt(v); }} />
              <InputModePicker value={targetMode ? "target" : "button"} onChange={v => { const t = v === "target"; setTargetMode(t); setBattleInputMode(v); }} />
            </div>
          )}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] text-slate-500 font-bold">輸入方式</span>
            <button onClick={() => setTargetMode(m => !m)}
              className={`px-3 py-1 rounded-lg text-xs font-black border transition-all ${targetMode ? "bg-green-600/20 border-green-500 text-green-400" : "bg-slate-700/60 border-slate-600 text-slate-400"}`}>
              {targetMode ? "🎯 靶面" : "⌨️ 按鈕"}
            </button>
          </div>
          {targetPending && <div className="text-center text-xs text-purple-400 font-bold mb-2">計算中…⚔️</div>}
          {!targetMode && (
            <div className="grid grid-cols-6 gap-1.5 mb-2">
              {SCORE_BTNS.map(({ label, score }) => (
                <button key={label} onClick={() => addArrow(score, label)}
                  disabled={myArrows.length >= ARROWS}
                  className={`py-2.5 rounded-xl font-black text-sm border transition-all active:scale-90 disabled:opacity-30 ${score === 10 ? "bg-amber-600 border-amber-400 text-white" : score === 0 ? "bg-slate-700 border-slate-600 text-slate-400" : "bg-slate-700 border-slate-600 text-white"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <TargetFaceOverlay
            open={targetMode && !targetPending && !submitted}
            fmtId={targetFmt}
            arrowLabels={myArrows.map(a => a.label)}
            arrowsPerRound={ARROWS}
            onArrow={addArrowByLabel}
            onUndo={removeArrow}
            onSubmit={handleTargetSubmit}
          />
          <button onClick={handleSubmit} disabled={!canSubmit}
            className={`w-full py-3 rounded-2xl font-black text-sm transition-all ${canSubmit ? "text-white border border-amber-400/50 active:scale-95" : "bg-slate-700 text-slate-500 border border-slate-600"}`}
            style={canSubmit ? { background:"linear-gradient(135deg,#1d4ed8,#7c3aed)" } : {}}>
            {canSubmit ? "⚔️ 送出攻擊" : `再輸入 ${ARROWS - myArrows.length} 箭`}
          </button>
        </div>
      )}

      {!amAlive && (
        <div className="px-4 pb-2 text-center text-slate-500 text-sm shrink-0">
          💀 你已倒下，等待本場結束…
        </div>
      )}

      {/* 離開確認 overlay */}
      {confirmLeave && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-xs w-full border border-slate-600 text-center">
            <div className="text-3xl mb-2">⚠️</div>
            <div className="text-white font-black mb-1">確定離開決鬥？</div>
            <div className="text-slate-400 text-sm mb-5">離開中途將視為放棄，其他玩家可繼續對決。</div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmLeave(false)}
                className="flex-1 py-2.5 rounded-xl font-black text-slate-300 border border-slate-600 bg-slate-700">
                取消
              </button>
              <button onClick={async () => {
                if (myTeam) await removePlayerFromRoom(roomId, myTeam, myId).catch(() => {});
                onLeave();
              }} className="flex-1 py-2.5 rounded-xl font-black text-red-300 border border-red-600/40 bg-red-900/20">
                確定離開
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
