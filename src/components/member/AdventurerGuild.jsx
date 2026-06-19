// src/components/member/AdventurerGuild.jsx — 冒險者公會（遊戲風格 UI）
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeAdventurerProgress, completeGuildTask,
  completePromotionQuest, subscribeActiveGuildQuests,
  submitGuildQuestCompletion, submitCoachChallenge,
  subscribeMonsterDex, acceptGuildQuest,
} from "../../lib/db";
import { MONSTERS } from "../../lib/monsterData";
import {
  levelFromXP, rankFromLevel, rankIdxFromLevel, levelInRank, xpProgress,
  isPromotionLevel, getDailyGuildTasks, TARGET_ZONES, TARGET_NAME,
  checkTaskPass, taskDesc, RANKS, STANDARD_ZONES, PROMOTION_QUESTS,
} from "../../lib/adventurerSystem";
import { sfxSuccess, sfxSoftFail, sfxTap } from "../../lib/sound";
import { EQUIP_SLOT_DEFS } from "../../lib/constants";

// ── NPC 公會長台詞（依星期輪流）──────────────────────────────
const NPC_LINES = [
  "冒險者，今日的任務需要你的力量！",
  "每一箭，都是實力的積累。",
  "懸賞告示欄已更新，請查閱。",
  "完成任務，榮耀將屬於你。",
  "公會長久以來等待一位真正的神射手…",
  "黑章任務，只有最強者才能挑戰。",
  "今天也要全力以赴！",
];
function getNPCLine() {
  return NPC_LINES[new Date().getDay()];
}

const BADGE_LABEL  = { silver: "🥈 銀章", gold: "🥇 金章", black: "⬛ 黑章" };
const BADGE_BORDER = { silver: "#94a3b8", gold: "#fbbf24", black: "#475569" };
const DIFF_LABEL   = { 1: "🟢 一般", 2: "🟡 挑戰", 3: "🔴 精英" };

// ── 徽章先決條件檢查 ──────────────────────────────────────────
function canAcceptBadgeQuest(quest, profile) {
  if (!quest.badgeReward) return { ok: true };
  if (quest.badgeReward === "silver") return { ok: true };
  if (quest.badgeReward === "gold")
    return (profile?.achievement?.silver || 0) >= 1
      ? { ok: true } : { ok: false, reason: "需先取得銀章" };
  if (quest.badgeReward === "black")
    return (profile?.achievement?.gold || 0) >= 1
      ? { ok: true } : { ok: false, reason: "需先取得金章" };
  return { ok: true };
}

// 根據子任務類型自動生成條件摘要（顯示在卡片上，不需教練手動填說明）
function questRequirementChip(q) {
  const sub = q.questSubtype;
  const req = q.requirement || {};
  if (sub === "kill_monster" && req.monsterId) {
    const m = MONSTERS.find(x => x.id === req.monsterId);
    return m ? `${m.icon} ${m.name} ×${req.killCount || 1}` : null;
  }
  if (sub === "shoot_score" && req.minScore) return `🎯 達 ${req.minScore} 分`;
  if (sub === "hit_target"  && req.minPercent) return `🏹 命中率 ≥${req.minPercent}%`;
  if (sub === "coach_duel") return "🥊 教練決鬥";
  return null;
}

export default function AdventurerGuild({ onBack, onNavigate }) {
  const { profile } = useAuth();

  // ── 訂閱資料 ───────────────────────────────────────────────
  const [progress, setProgress]       = useState(null);
  const [guildQuests, setGuildQuests] = useState([]);
  const [monsterDex, setMonsterDex]   = useState({});

  useEffect(() => {
    if (!profile?.id) return;
    const u1 = subscribeAdventurerProgress(profile.id, setProgress);
    const u2 = subscribeActiveGuildQuests(setGuildQuests);
    const u3 = subscribeMonsterDex(profile.id, setMonsterDex);
    return () => { u1?.(); u2?.(); u3?.(); };
  }, [profile?.id]);

  // ── 衍生數值 ───────────────────────────────────────────────
  const xp        = profile?.adventurerXP || 0;
  const level     = levelFromXP(xp);
  const rank      = rankFromLevel(level);
  const lvInRank  = levelInRank(level);
  const { current, needed, pct } = xpProgress(xp, level);
  const promoDone = new Set(profile?.promotionDone || []);
  const promoQuest = isPromotionLevel(level) && PROMOTION_QUESTS[level] && !promoDone.has(level)
    ? PROMOTION_QUESTS[level] : null;
  const submitted = new Set(progress?.submittedQuests || []);
  const accepted  = new Set(progress?.acceptedQuests  || []);
  const completed = new Set(progress?.completed || []);
  const dailyTasks = getDailyGuildTasks(new Date().toISOString().slice(0, 10));
  const doneToday  = completed.size;

  // ── View 狀態機 ────────────────────────────────────────────
  // "main" | "confirm" | "accepting" | "completing" | "daily-shoot" | "promotion"
  const [view, setView]             = useState("main");
  const [activeQuest, setActiveQuest]   = useState(null);  // 公會任務
  const [activeDailyTask, setActiveDailyTask] = useState(null); // 今日任務
  const [note, setNote]             = useState("");
  const [busy, setBusy]             = useState(false);
  const [questResult, setQuestResult] = useState(null);
  // 今日射擊
  const [arrows, setArrows]         = useState([]);
  const [taskResult, setTaskResult] = useState(null);
  // 晉階
  const [promoArrows, setPromoArrows] = useState([]);
  const [promoResult, setPromoResult] = useState(null);
  const [promoBusy, setPromoBusy]   = useState(false);
  // 接任務動畫
  const [accepting, setAccepting]   = useState(false);

  // ── 公會任務：確認接任務 ────────────────────────────────────
  function handleOpenQuest(q) {
    const sub = q.questSubtype || "general";
    setActiveQuest(q);
    setNote("");
    setQuestResult(null);
    // 一般任務已接受 → 直接跳到送出頁
    if (sub === "general" && accepted.has(q.id) && !submitted.has(q.id)) {
      setView("completing");
      return;
    }
    setView("confirm");
  }

  async function handleAcceptAndComplete() {
    if (!activeQuest || !profile?.id) return;
    setBusy(true);
    // 接任務動畫
    setView("accepting");
    await new Promise(r => setTimeout(r, 1800));
    setView("completing");
    setBusy(false);
  }

  async function handleSubmitQuest() {
    if (!activeQuest || !profile?.id) return;
    setBusy(true);
    await submitGuildQuestCompletion(
      profile.id, profile.nickname || profile.name, activeQuest, note
    ).catch(() => {});
    sfxSuccess();
    setQuestResult({ pass: true, hasBadge: !!activeQuest.badgeReward });
    setBusy(false);
  }

  // ── 今日公會任務：射擊 ──────────────────────────────────────
  function openDailyTask(task) {
    if (completed.has(task.id)) return;
    setActiveDailyTask(task);
    setArrows([]);
    setTaskResult(null);
    setView("daily-shoot");
  }
  function tapArrow(val) {
    const max = activeDailyTask?.type === "one_shot" ? 1 : activeDailyTask?.arrowCount;
    if (arrows.length >= max) return;
    sfxTap();
    setArrows(p => [...p, val]);
  }
  async function submitDailyTask() {
    if (!activeDailyTask || !profile?.id) return;
    const max = activeDailyTask.type === "one_shot" ? 1 : activeDailyTask.arrowCount;
    if (arrows.length < max) return;
    setBusy(true);
    const pass = checkTaskPass(activeDailyTask, arrows);
    if (pass) {
      sfxSuccess();
      const actualCoins = Math.round(activeDailyTask.coins * rank.mult);
      await completeGuildTask(profile.id, activeDailyTask.id, activeDailyTask.xp, actualCoins, activeDailyTask.bonus);
      setTaskResult({ pass: true, xp: activeDailyTask.xp, coins: actualCoins, bonus: activeDailyTask.bonus });
    } else {
      sfxSoftFail();
      setTaskResult({ pass: false });
    }
    setBusy(false);
  }

  // ── 晉階任務 ────────────────────────────────────────────────
  function tapPromo(val) {
    if (!promoQuest || promoArrows.length >= promoQuest.arrowCount) return;
    sfxTap();
    setPromoArrows(p => [...p, val]);
  }
  async function submitPromo() {
    if (!promoQuest || !profile?.id) return;
    if (promoArrows.length < promoQuest.arrowCount) return;
    setPromoBusy(true);
    const total = promoArrows.reduce((s, a) => s + a, 0);
    if (total >= promoQuest.goal) {
      sfxSuccess();
      await completePromotionQuest(profile.id, promoQuest.level, promoQuest.bonusXP).catch(() => {});
      setPromoResult("rankup");
    } else {
      sfxSoftFail();
      setPromoResult({ pass: false, total });
    }
    setPromoBusy(false);
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW: 晉階任務
  // ═══════════════════════════════════════════════════════════
  if (view === "promotion" && promoQuest) {
    const nextRank = RANKS[rankIdxFromLevel(level) + 1] || rank;
    if (promoResult === "rankup") return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
        style={{ background: `linear-gradient(135deg,${nextRank.color}33,#0f172a)` }}>
        <div className="text-6xl mb-4">{nextRank.icon}</div>
        <div className="text-white/60 text-sm mb-1">恭喜晉階！</div>
        <div className="text-white font-black text-3xl mb-1">{nextRank.name}</div>
        <div className="text-white/50 text-sm mb-6">+{promoQuest.bonusXP} XP 晉階獎勵已發放</div>
        <button onClick={() => { setView("main"); setPromoResult(null); setPromoArrows([]); }}
          className="w-full max-w-xs py-4 rounded-2xl bg-white text-gray-900 font-black text-base">
          返回公會
        </button>
      </div>
    );
    const total = promoArrows.reduce((s, a) => s + a, 0);
    const promoDone2 = promoArrows.length >= promoQuest.arrowCount;
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#0f172a" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b sticky top-0 z-10"
          style={{ background: "#0f172a", borderColor: "#fbbf2440" }}>
          <button onClick={() => { setView("main"); setPromoResult(null); setPromoArrows([]); }} className="text-white/60 text-sm">← 返回</button>
          <div className="text-amber-300 font-black flex-1">⚔️ 晉階任務</div>
          <div className="text-xs text-amber-400/60">{promoQuest.fromRank}→{promoQuest.toRank}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-8">
          <div className="rounded-2xl p-4 border border-amber-400/30" style={{ background: "rgba(251,191,36,0.08)" }}>
            <div className="text-amber-300 font-black text-base mb-1">原野射箭靶紙</div>
            <div className="text-white/80 text-sm mb-0.5">📍 {promoQuest.dist}米・{promoQuest.arrowCount}箭・總分 ≥ {promoQuest.goal} 分</div>
            <div className="text-amber-200/60 text-xs mt-2">通過即晉升 {promoQuest.toRank}，+{promoQuest.bonusXP} XP</div>
          </div>
          {!promoResult && (<>
            <div className="flex gap-1.5 flex-wrap items-center">
              {Array.from({ length: promoQuest.arrowCount }).map((_, i) => (
                <span key={i} className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${i < promoArrows.length ? "bg-amber-400 text-gray-900" : i === promoArrows.length ? "bg-white/20 text-white ring-2 ring-amber-400" : "bg-white/10 text-white/30"}`}>
                  {i < promoArrows.length ? (promoArrows[i] === 0 ? "M" : promoArrows[i]) : ""}
                </span>
              ))}
              {promoArrows.length > 0 && <button onClick={() => setPromoArrows(p => p.slice(0, -1))} className="text-white/50 text-xs ml-auto underline">↩ 退一箭</button>}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {STANDARD_ZONES.map(z => (
                <button key={z.label} onClick={() => tapPromo(z.val)} disabled={promoDone2}
                  className="py-4 rounded-2xl font-black text-white text-sm active:scale-95 disabled:opacity-40" style={{ background: z.color }}>
                  {z.label}{z.val > 0 && <span className="block text-xs opacity-70 font-normal mt-0.5">+{z.val}</span>}
                </button>
              ))}
            </div>
            {promoArrows.length > 0 && (
              <div className="rounded-xl p-3 text-center border border-amber-400/20" style={{ background: "rgba(251,191,36,0.06)" }}>
                <span className="text-amber-300 font-black text-2xl">{total} 分</span>
                <span className="text-white/40 text-sm ml-2">/ {promoQuest.goal} 分目標</span>
              </div>
            )}
            <button onClick={submitPromo} disabled={promoBusy || !promoDone2}
              className="w-full py-4 rounded-2xl font-black text-base active:scale-95 disabled:opacity-40 text-gray-900"
              style={{ background: promoDone2 ? "#fbbf24" : "rgba(251,191,36,0.3)", color: promoDone2 ? "#1c1917" : "#d97706" }}>
              {promoDone2 ? "提交晉階成績" : `還要射 ${promoQuest.arrowCount - promoArrows.length} 箭`}
            </button>
          </>)}
          {promoResult && !promoResult.pass && (
            <div className="rounded-2xl p-6 text-center border border-amber-400/20" style={{ background: "rgba(251,191,36,0.06)" }}>
              <div className="text-4xl mb-3">💪</div>
              <div className="text-white font-black text-xl mb-1">差一點！</div>
              <div className="text-white/50 text-sm mb-5">本次 {promoResult.total} 分・目標 {promoQuest.goal} 分</div>
              <button onClick={() => { setPromoArrows([]); setPromoResult(null); }} className="w-full py-3 rounded-xl font-black text-sm text-amber-300 border border-amber-400/30">再試一次</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW: 今日任務射擊
  // ═══════════════════════════════════════════════════════════
  if (view === "daily-shoot" && activeDailyTask) {
    const zones  = TARGET_ZONES[activeDailyTask.target] || [];
    const maxArr = activeDailyTask.type === "one_shot" ? 1 : activeDailyTask.arrowCount;
    const total  = arrows.reduce((s, a) => s + a, 0);
    const done   = arrows.length >= maxArr;
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#0f172a" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 sticky top-0 z-10" style={{ background: "#0f172a" }}>
          <button onClick={() => { setView("main"); setTaskResult(null); }} className="text-white/60 text-sm">← 返回</button>
          <div className="text-white font-black flex-1">{activeDailyTask.label}</div>
          <div className="text-xs text-white/40">{TARGET_NAME[activeDailyTask.target]}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-8">
          <div className="rounded-2xl p-4 border border-white/10" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="text-white/60 text-xs mb-1">{DIFF_LABEL[activeDailyTask.difficulty]}</div>
            <div className="text-white font-black text-base mb-1">{taskDesc(activeDailyTask)}</div>
            <div className="text-white/50 text-xs">📍 {activeDailyTask.dist}米・{TARGET_NAME[activeDailyTask.target]}・{maxArr}箭</div>
            <div className="text-emerald-400 text-xs mt-1.5">+{activeDailyTask.xp} XP &nbsp;·&nbsp; +{Math.round(activeDailyTask.coins * rank.mult)} 金幣（{rank.name} {rank.mult}x）</div>
          </div>
          {!taskResult && (<>
            <div className="flex gap-1.5 flex-wrap items-center">
              {Array.from({ length: maxArr }).map((_, i) => (
                <span key={i} className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${i < arrows.length ? arrows[i] < 0 ? "bg-red-700 text-white" : "bg-white text-gray-900" : i === arrows.length ? "bg-white/20 text-white ring-2 ring-white" : "bg-white/10 text-white/30"}`}>
                  {i < arrows.length ? arrows[i] < 0 ? "❌" : arrows[i] === 0 ? "M" : arrows[i] : ""}
                </span>
              ))}
              {arrows.length > 0 && <button onClick={() => setArrows(p => p.slice(0, -1))} className="text-white/50 text-xs ml-auto underline">↩ 退一箭</button>}
            </div>
            <div className={`grid gap-2 ${zones.length <= 4 ? "grid-cols-2" : "grid-cols-4"}`}>
              {zones.map(z => (
                <button key={z.label} onClick={() => tapArrow(z.val)} disabled={done}
                  className="py-4 rounded-2xl font-black text-white text-sm active:scale-95 disabled:opacity-40"
                  style={{ background: z.penalty ? "linear-gradient(135deg,#7f1d1d,#1e293b)" : z.color }}>
                  {z.label}{!z.penalty && z.val !== 0 && <span className="block text-xs opacity-70 font-normal mt-0.5">{z.val > 0 ? `+${z.val}` : z.val}</span>}
                </button>
              ))}
            </div>
            {arrows.length > 0 && (
              <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                <span className="text-white font-black text-2xl">{total} 分</span>
                <span className="text-white/40 text-sm ml-2">{arrows.length}/{maxArr} 箭</span>
              </div>
            )}
            <button onClick={submitDailyTask} disabled={busy || !done}
              className="w-full py-4 rounded-2xl bg-white text-gray-900 font-black text-base active:scale-95 disabled:opacity-40">
              {done ? "登記成績" : `還要射 ${maxArr - arrows.length} 箭`}
            </button>
          </>)}
          {taskResult && (
            <div className={`rounded-2xl p-6 text-center border ${taskResult.pass ? "border-emerald-500/30" : "border-red-500/30"}`}
              style={{ background: taskResult.pass ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)" }}>
              <div className="text-4xl mb-3">{taskResult.pass ? "🎉" : "💪"}</div>
              <div className="text-white font-black text-xl mb-2">{taskResult.pass ? "任務完成！" : "差一點！"}</div>
              {taskResult.pass ? (<>
                <div className="text-emerald-300 font-bold text-sm">+{taskResult.xp} 冒險者 XP</div>
                <div className="text-yellow-300 font-bold text-sm">+{taskResult.coins} 金幣</div>
                {taskResult.bonus && (
                  <div className="text-amber-300 font-black text-sm mt-1">
                    {taskResult.bonus.icon} 額外獲得 {taskResult.bonus.label}！
                    {taskResult.bonus.type === "coins" && <span className="text-yellow-200 ml-1">+{taskResult.bonus.amount}</span>}
                  </div>
                )}
                <div className="mb-4" />
              </>) : (
                <div className="text-red-300 text-sm mb-4">繼續嘗試！目標：{taskDesc(activeDailyTask)}</div>
              )}
              <div className="flex gap-3">
                {!taskResult.pass && <button onClick={() => { setArrows([]); setTaskResult(null); }} className="flex-1 py-3 rounded-xl font-black text-sm text-white border border-white/20">重試</button>}
                <button onClick={() => { setView("main"); setTaskResult(null); }} className="flex-1 py-3 rounded-xl bg-white text-gray-900 font-black text-sm">{taskResult.pass ? "返回公會" : "換任務"}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW: 確認接任務
  // ═══════════════════════════════════════════════════════════
  if (view === "confirm" && activeQuest) {
    const lock = canAcceptBadgeQuest(activeQuest, profile);
    const sub  = activeQuest.questSubtype || "general";
    const req  = activeQuest.requirement || {};
    const isAlreadySubmitted = submitted.has(activeQuest.id);

    // kill_monster 自動比對
    const monsterInfo = sub === "kill_monster" && req.monsterId
      ? MONSTERS.find(m => m.id === req.monsterId) : null;
    const currentKills = monsterInfo ? (monsterDex[req.monsterId]?.kills || 0) : 0;
    const killPassed   = sub === "kill_monster" ? currentKills >= (req.killCount || 1) : true;

    async function handleCoachDuelSubmit() {
      if (!activeQuest || !profile?.id) return;
      setBusy(true);
      await submitCoachChallenge(profile.id, profile.nickname || profile.name, activeQuest).catch(() => {});
      sfxSuccess();
      setBusy(false);
      setView("main");
    }

    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#0f172a" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 sticky top-0 z-10" style={{ background: "#0f172a" }}>
          <button onClick={() => setView("main")} className="text-white/60 text-sm">← 返回</button>
          <div className="text-white font-black flex-1">確認接取任務</div>
        </div>
        <div className="flex-1 p-4 flex flex-col gap-4">
          {/* 任務資訊卡 */}
          <div className="rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: "linear-gradient(135deg,rgba(120,53,15,0.4),rgba(15,23,42,0.97))", border: activeQuest.badgeReward ? `2px solid ${BADGE_BORDER[activeQuest.badgeReward]}` : "1px solid rgba(255,255,255,0.12)" }}>
            <div className="flex flex-wrap gap-2">
              {activeQuest.type === "special" && <span className="text-amber-300 text-xs font-black">⚡ 緊急懸賞</span>}
              {activeQuest.badgeReward && <span className="text-xs font-black" style={{ color: BADGE_BORDER[activeQuest.badgeReward] }}>{BADGE_LABEL[activeQuest.badgeReward]} 任務</span>}
            </div>
            <div className="text-white font-black text-2xl">{activeQuest.title}</div>
            {activeQuest.desc && <div className="text-white/70 text-sm leading-relaxed">{activeQuest.desc}</div>}

            {/* 子類型條件區塊 */}
            {sub === "kill_monster" && monsterInfo && (
              <div className="rounded-xl p-3" style={{ background: killPassed ? "rgba(16,185,129,0.12)" : "rgba(251,191,36,0.08)", border: killPassed ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(251,191,36,0.3)" }}>
                <div className="text-xs font-black mb-1" style={{ color: killPassed ? "#10b981" : "#fbbf24" }}>⚔️ 擊殺任務</div>
                <div className="text-white/80 text-sm">{monsterInfo.icon} {monsterInfo.name} × {req.killCount}</div>
                <div className="text-xs mt-1" style={{ color: killPassed ? "#10b981" : "#fbbf24" }}>
                  目前擊殺：{currentKills} / {req.killCount}　{killPassed ? "✓ 已達成" : "尚未達成"}
                </div>
              </div>
            )}
            {sub === "shoot_score" && (
              <div className="rounded-xl p-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <div className="text-emerald-400 text-xs font-black mb-1">🎯 射分數任務</div>
                <div className="text-white/80 text-sm">目標分數：{req.minScore} 分</div>
                {req.conditionDesc && <div className="text-white/55 text-xs mt-0.5">{req.conditionDesc}</div>}
              </div>
            )}
            {sub === "hit_target" && (
              <div className="rounded-xl p-3" style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)" }}>
                <div className="text-orange-400 text-xs font-black mb-1">🏹 命中任務</div>
                {req.minPercent && <div className="text-white/80 text-sm">最低命中率：{req.minPercent}%</div>}
                {req.conditionDesc && <div className="text-white/55 text-xs mt-0.5">{req.conditionDesc}</div>}
              </div>
            )}
            {sub === "coach_duel" && (
              <div className="rounded-xl p-3" style={{ background: "rgba(190,18,60,0.08)", border: "1px solid rgba(190,18,60,0.25)" }}>
                <div className="text-rose-400 text-xs font-black mb-1">🥊 教練挑戰賽</div>
                <div className="text-white/70 text-xs">線下找教練進行決鬥，勝出後教練在後台確認完成</div>
              </div>
            )}

            <div className="rounded-xl p-3 flex flex-col gap-1.5" style={{ background: "rgba(0,0,0,0.3)" }}>
              <div className="text-white/50 text-xs font-bold">任務獎勵</div>
              {(activeQuest.reward?.xp || 0) > 0   && <div className="text-cyan-300 text-sm">⚔️ +{activeQuest.reward.xp} 冒險者 XP</div>}
              {(activeQuest.reward?.coins || 0) > 0 && <div className="text-yellow-300 text-sm">🪙 +{activeQuest.reward.coins} 金幣</div>}
              {activeQuest.badgeReward && <div className="text-sm font-black" style={{ color: BADGE_BORDER[activeQuest.badgeReward] }}>{BADGE_LABEL[activeQuest.badgeReward]}（教練核准後發放）</div>}
            </div>
          </div>

          {!lock.ok && (
            <div className="rounded-xl p-3 border border-amber-400/30 text-amber-300 text-sm font-bold" style={{ background: "rgba(251,191,36,0.08)" }}>
              🔒 {lock.reason}，無法接受此任務
            </div>
          )}

          {isAlreadySubmitted ? (
            <div className="w-full py-4 rounded-2xl text-center text-emerald-300 font-black border border-emerald-500/30" style={{ background: "rgba(16,185,129,0.08)" }}>
              {sub === "coach_duel" ? "⏳ 等待教練確認中" : "✓ 已提交完成"}
            </div>
          ) : lock.ok && sub === "coach_duel" ? (
            <button onClick={handleCoachDuelSubmit} disabled={busy}
              className="w-full py-4 rounded-2xl font-black text-xl active:scale-95 disabled:opacity-40 text-white"
              style={{ background: "linear-gradient(135deg,#be123c,#9f1239)" }}>
              🥊 申請挑戰教練！
            </button>
          ) : lock.ok && sub === "kill_monster" ? (
            onNavigate ? (
              <button onClick={() => onNavigate("monster", { questId: activeQuest.id, questSubtype: "kill_monster", monsterId: req.monsterId, killsNeeded: req.killCount || 1, reward: activeQuest.reward, title: activeQuest.title })}
                className="w-full py-4 rounded-2xl font-black text-xl active:scale-95 text-white"
                style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)" }}>
                ⚔️ 確認接取・進入狩獵
              </button>
            ) : (
              <div className="w-full py-3 rounded-2xl text-center text-purple-300 text-sm font-bold border border-purple-400/20" style={{ background: "rgba(124,58,237,0.06)" }}>
                找到 {monsterInfo?.icon}{monsterInfo?.name} 並擊殺 {req.killCount || 1} 次
              </div>
            )
          ) : lock.ok && (sub === "shoot_score" || sub === "hit_target") ? (
            onNavigate ? (
              <button onClick={() => onNavigate("practice", { questId: activeQuest.id, questSubtype: sub, requirement: req, reward: activeQuest.reward, title: activeQuest.title })}
                className="w-full py-4 rounded-2xl font-black text-xl active:scale-95 text-gray-900"
                style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
                🎯 確認接取・前往練習
              </button>
            ) : null
          ) : lock.ok ? (
            <button onClick={async () => {
              if (!profile?.id) return;
              setBusy(true);
              await acceptGuildQuest(profile.id, activeQuest.id).catch(() => {});
              setBusy(false);
              setView("main");
            }} disabled={busy}
              className="w-full py-4 rounded-2xl font-black text-xl active:scale-95 disabled:opacity-40 text-gray-900"
              style={{ background: "linear-gradient(135deg,#fbbf24,#d97706)" }}>
              ✅ 確認接取
            </button>
          ) : null}

          <button onClick={() => setView("main")} className="text-white/40 text-sm text-center">暫時不接</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW: 接任務動畫
  // ═══════════════════════════════════════════════════════════
  if (view === "accepting" && activeQuest) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8"
        style={{ background: "linear-gradient(135deg,#1c1410,#78350f,#1c1410)" }}>
        <style>{`
          @keyframes scrollUnfurl {
            0%   { transform: scaleY(0) rotateX(90deg); opacity: 0; }
            60%  { transform: scaleY(1.05) rotateX(0deg); opacity: 1; }
            100% { transform: scaleY(1) rotateX(0deg); opacity: 1; }
          }
          @keyframes fadeInText {
            0%   { opacity: 0; transform: translateY(8px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .scroll-unfurl { animation: scrollUnfurl 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards; transform-origin: top center; }
          .quest-text    { animation: fadeInText 0.5s ease 0.6s both; }
        `}</style>
        <div className="w-full max-w-xs">
          <div className="scroll-unfurl rounded-2xl overflow-hidden shadow-2xl"
            style={{ backgroundImage: "url(/ui/card-bg.webp)", backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "rgba(120,53,15,0.9)", backgroundBlendMode: "multiply" }}>
            <div className="p-6 text-center">
              <div className="quest-text text-amber-300 text-xs font-black mb-3 tracking-widest">— 任務已接受 —</div>
              <div className="quest-text text-white font-black text-xl leading-snug mb-4">{activeQuest.title}</div>
              <div className="quest-text text-amber-200/60 text-xs">前往道場完成後回報結果</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW: 提交完成
  // ═══════════════════════════════════════════════════════════
  if (view === "completing" && activeQuest) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#0f172a" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 sticky top-0 z-10" style={{ background: "#0f172a" }}>
          <button onClick={() => setView("main")} className="text-white/60 text-sm">← 放棄</button>
          <div className="text-white font-black flex-1">回報完成</div>
        </div>
        <div className="flex-1 p-4 flex flex-col gap-4">
          {!questResult ? (<>
            <div className="rounded-2xl p-4 border border-white/10" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="text-white font-black text-lg mb-1">{activeQuest.title}</div>
              {activeQuest.desc && <div className="text-white/50 text-sm">{activeQuest.desc}</div>}
            </div>
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-white/50 text-xs font-bold mb-2">備註（選填）</div>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="例如：達成分數、完成日期…"
                rows={3} className="w-full text-white text-sm rounded-xl p-3 resize-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", outline: "none" }} />
            </div>
            {activeQuest.badgeReward && (
              <div className="rounded-xl p-3 border border-amber-400/20 text-amber-200/70 text-xs" style={{ background: "rgba(251,191,36,0.06)" }}>
                🎖️ 此任務含 {BADGE_LABEL[activeQuest.badgeReward]} 獎勵，XP + 金幣立即發放，徽章需等待教練核准。
              </div>
            )}
            <button onClick={handleSubmitQuest} disabled={busy}
              className="w-full py-4 rounded-2xl font-black text-base active:scale-95 disabled:opacity-40 text-gray-900"
              style={{ background: "linear-gradient(135deg,#fbbf24,#d97706)" }}>
              {busy ? "提交中…" : "確認完成任務 ✓"}
            </button>
          </>) : (
            <div className="rounded-2xl p-8 text-center border border-emerald-500/30" style={{ background: "rgba(16,185,129,0.08)" }}>
              <div className="text-5xl mb-4">🎉</div>
              <div className="text-white font-black text-2xl mb-2">任務回報成功！</div>
              {(activeQuest.reward?.xp || 0) > 0    && <div className="text-cyan-300 font-bold text-sm">+{activeQuest.reward.xp} XP 已發放</div>}
              {(activeQuest.reward?.coins || 0) > 0  && <div className="text-yellow-300 font-bold text-sm">+{activeQuest.reward.coins} 金幣已發放</div>}
              {activeQuest.badgeReward && <div className="text-amber-300 text-sm mt-1">🎖️ {BADGE_LABEL[activeQuest.badgeReward]} 待教練審核中</div>}
              <button onClick={() => setView("main")}
                className="w-full py-3 rounded-xl bg-white text-gray-900 font-black text-sm mt-6">
                返回公會
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW: 主畫面
  // ═══════════════════════════════════════════════════════════
  const badgeQuests    = guildQuests.filter(q => q.badgeReward);           // 成就懸賞
  const normalQuests   = guildQuests.filter(q => !q.badgeReward);          // 懸賞告示（賽事用）
  const equippedCount  = EQUIP_SLOT_DEFS.filter(s => profile?.rpgEquip?.[s.id]?.itemId).length;

  return (
    <div className="min-h-screen flex flex-col" style={{
      backgroundImage: "linear-gradient(rgba(10,15,30,0.78),rgba(10,15,30,0.78)),url(/ui/guild-interior.webp)",
      backgroundSize: "cover", backgroundPosition: "center top",
    }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 sticky top-0 z-10"
        style={{ background: "rgba(10,15,30,0.88)", backdropFilter: "blur(8px)" }}>
        <button onClick={onBack} className="text-white/60 text-sm">← 返回</button>
        <div className="text-white font-black flex-1">冒險者公會</div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">

        {/* ── NPC + 狀態欄 ──────────────────────────────── */}
        <div className="flex gap-2 p-3 pb-2">

          {/* 左：狀態欄（較緊湊） */}
          <div className="flex-1 rounded-2xl overflow-hidden relative" style={{ minWidth: 0 }}>
            {/* 半透明背景層 */}
            <div className="absolute inset-0" style={{ background: rank.gradient, opacity: 0.72 }} />
            <div className="relative p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xl leading-none">{rank.icon}</span>
              <div>
                <div className="text-white font-black text-sm leading-tight">Lv.{level} {rank.name}</div>
                <div className="text-white/60 text-[9px]">{rank.name}段 {lvInRank}/10</div>
              </div>
            </div>
            {level < 60 ? (
              <div>
                <div className="h-1 bg-black/30 rounded-full overflow-hidden">
                  <div className="h-full bg-white/80 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-white/50 text-[9px] mt-0.5">{current}/{needed} XP</div>
              </div>
            ) : (
              <div className="text-amber-300 font-black text-[10px]">⚡ 神話滿等</div>
            )}
            <div className="grid grid-cols-2 gap-1">
              <div className="rounded-md px-1.5 py-1 text-center" style={{ background: "rgba(0,0,0,0.25)" }}>
                <div className="text-yellow-300 font-black text-[9px]">🪙 {(profile?.coins || 0).toLocaleString()}</div>
                <div className="text-white/40 text-[8px]">金幣</div>
              </div>
              <div className="rounded-md px-1.5 py-1 text-center" style={{ background: "rgba(0,0,0,0.25)" }}>
                <div className="text-indigo-300 font-black text-[9px]">🎒 {equippedCount}/10</div>
                <div className="text-white/40 text-[8px]">裝備</div>
              </div>
              <div className="rounded-md px-1.5 py-1 text-center" style={{ background: "rgba(0,0,0,0.25)" }}>
                <div className="text-emerald-300 font-black text-[9px]">📜 {doneToday}/{dailyTasks.length}</div>
                <div className="text-white/40 text-[8px]">今日任務</div>
              </div>
              <div className="rounded-md px-1.5 py-1 text-center" style={{ background: "rgba(0,0,0,0.25)" }}>
                <div className="text-white font-black text-[9px]">
                  🥈{profile?.achievement?.silver || 0} 🥇{profile?.achievement?.gold || 0} ⬛{profile?.achievement?.black || 0}
                </div>
                <div className="text-white/40 text-[8px]">成就章</div>
              </div>
            </div>

            {/* 晉階任務入口 */}
            {promoQuest && (
              <button onClick={() => { setPromoArrows([]); setPromoResult(null); setView("promotion"); }}
                className="w-full rounded-lg px-2 py-1.5 border border-amber-400/50 text-left active:scale-[0.98] transition-transform"
                style={{ background: "rgba(251,191,36,0.12)" }}>
                <div className="text-amber-300 font-black text-[9px]">⚔️ 晉階任務解鎖！點此 →</div>
                <div className="text-amber-200/60 text-[8px]">{promoQuest.dist}m · ≥{promoQuest.goal}分 → {promoQuest.toRank}</div>
              </button>
            )}
            {isPromotionLevel(level) && !promoQuest && (
              <div className="rounded-lg px-2 py-1 border border-emerald-400/30" style={{ background: "rgba(16,185,129,0.08)" }}>
                <div className="text-emerald-300 font-black text-[9px]">✓ Lv{level} 晉階完成</div>
              </div>
            )}
            </div>{/* end relative content */}
          </div>{/* end 狀態欄 */}

          {/* 右：NPC（放大） */}
          <div className="w-36 flex-shrink-0 flex flex-col items-center gap-1.5">
            <div className="w-36 h-36 rounded-2xl overflow-hidden relative"
              style={{ background: "linear-gradient(135deg,#1c1a0e,#3d2e0a)", border: "1px solid rgba(251,191,36,0.3)" }}>
              <img src="/ui/npc_clean.webp" alt="公會長" className="w-full h-full object-cover object-top"
                onError={e => { e.target.style.display = "none"; }} />
            </div>
            {/* 對話泡泡 */}
            <div className="w-full rounded-xl p-2 relative" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)" }}>
              <div className="text-amber-200 text-[9px] leading-tight font-bold">{getNPCLine()}</div>
              <div className="absolute -top-1.5 left-3 w-3 h-3 rotate-45" style={{ background: "rgba(251,191,36,0.12)", borderTop: "1px solid rgba(251,191,36,0.25)", borderLeft: "1px solid rgba(251,191,36,0.25)" }} />
            </div>
            <div className="text-white/40 text-[10px] font-bold">公會長</div>
          </div>
        </div>

        {/* ── 成就懸賞（銀/金/黑章任務）──────────────────── */}
        <div className="mt-3">
          {/* section 標題橫幅 */}
          <div className="mx-4 rounded-xl overflow-hidden mb-2" style={{
            backgroundImage: "url(/ui/alert-banner.webp)",
            backgroundSize: "cover", backgroundPosition: "center",
          }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "rgba(0,0,0,0.52)" }}>
              {badgeQuests.length > 0
                ? <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                : <span className="w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />}
              <span className="text-amber-300 font-black text-sm">成就懸賞</span>
              <span className="text-amber-200/50 text-xs ml-auto">實體徽章由教練發放</span>
            </div>
          </div>
          {badgeQuests.length === 0 ? (
            <div className="mx-4 rounded-xl p-4 text-center border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="text-white/20 text-2xl mb-1">🎖️</div>
              <div className="text-white/25 text-xs">公會長尚未發佈成就任務</div>
            </div>
          ) : (
            <div className="px-4" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8 }}>
              {badgeQuests.map(q => {
                const isSubmitted = submitted.has(q.id);
                const isAccepted  = accepted.has(q.id) && !isSubmitted;
                const lock = canAcceptBadgeQuest(q, profile);
                const bColor = BADGE_BORDER[q.badgeReward] || "#94a3b8";
                return (
                  <button key={q.id} onClick={() => !isSubmitted && lock.ok && handleOpenQuest(q)}
                    disabled={isSubmitted || !lock.ok}
                    className="rounded-xl overflow-hidden text-left active:scale-[0.97] transition-transform disabled:opacity-70"
                    style={q.badgeReward === "gold" ? {
                      background: "linear-gradient(180deg,rgba(255,228,80,0.28) 0%,rgba(255,200,60,0) 40%),linear-gradient(145deg,rgba(255,190,40,0.16) 0%,transparent 55%),linear-gradient(160deg,rgba(42,30,4,0.92),rgba(26,19,2,0.97))",
                      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                      boxShadow: "inset 0 1px 0 rgba(255,228,80,0.38),inset 0 -1px 0 rgba(0,0,0,0.4),0 6px 18px rgba(0,0,0,0.5)",
                      border: "1.5px solid rgba(251,191,36,0.55)",
                    } : q.badgeReward === "black" ? {
                      background: "linear-gradient(180deg,rgba(180,160,255,0.18) 0%,rgba(140,120,200,0) 38%),linear-gradient(145deg,rgba(100,80,160,0.12) 0%,transparent 50%),linear-gradient(160deg,rgba(15,14,30,0.94),rgba(8,8,20,0.98))",
                      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                      boxShadow: "inset 0 1px 0 rgba(180,160,255,0.28),inset 0 -1px 0 rgba(0,0,0,0.55),0 6px 18px rgba(0,0,0,0.6)",
                      border: "1.5px solid rgba(100,80,160,0.6)",
                    } : {
                      background: "linear-gradient(180deg,rgba(255,255,255,0.22) 0%,rgba(255,255,255,0) 35%),linear-gradient(145deg,rgba(210,225,240,0.12) 0%,transparent 50%),linear-gradient(160deg,rgba(30,37,53,0.92),rgba(20,27,40,0.95))",
                      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3),inset 0 -1px 0 rgba(0,0,0,0.35),0 6px 18px rgba(0,0,0,0.45)",
                      border: "1.5px solid rgba(148,163,184,0.55)",
                    }}>
                    {/* 頂部章別色帶（加 glow） */}
                    <div style={{ height: 3, background: `linear-gradient(90deg,${bColor},${bColor}aa,transparent)`, boxShadow: `0 0 8px ${bColor}66` }} />
                    <div className="p-3 flex flex-col gap-1.5">
                      <div className="text-[11px] font-black" style={{ color: bColor }}>{BADGE_LABEL[q.badgeReward]}</div>
                      {(() => { const chip = questRequirementChip(q); return chip ? (
                        <div className="self-start text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ background:"rgba(124,58,237,0.22)", color:"#c4b5fd", border:"1px solid rgba(124,58,237,0.3)" }}>
                          {chip}
                        </div>
                      ) : null; })()}
                      {!lock.ok && <div className="text-[10px]" style={{ color:"#fbbf24" }}>🔒 {lock.reason}</div>}
                      <div className="font-black text-sm leading-snug text-white/90">{q.title}</div>
                      {q.desc && <div className="text-[11px] leading-snug line-clamp-3 text-white/55">{q.desc}</div>}
                      <div className="mt-1 flex flex-col gap-0.5">
                        {(q.reward?.xp || 0) > 0   && <div className="text-[10px] font-bold text-blue-300">+{q.reward.xp} XP</div>}
                        {(q.reward?.coins || 0) > 0 && <div className="text-[10px] font-bold text-amber-300">+{q.reward.coins} 🪙</div>}
                      </div>
                      <div className="mt-1 text-[10px] font-black text-right"
                        style={{ color: isSubmitted ? "#10b981" : !lock.ok ? "#fbbf24" : isAccepted ? "#a78bfa" : bColor }}>
                        {isSubmitted ? "✓ 已提交" : !lock.ok ? "🔒" : isAccepted ? "⚡ 進行中" : "→ 接受"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 懸賞告示（教練發佈，賽事活動用）────────────── */}
        {normalQuests.length > 0 && (
          <div className="px-4 mt-4">
            <div className="text-white/40 text-xs font-black mb-2">📋 懸賞告示</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8 }}>
              {normalQuests.map(q => {
                const isSubmitted = submitted.has(q.id);
                const isAccepted  = accepted.has(q.id) && !isSubmitted;
                return (
                  <button key={q.id} onClick={() => !isSubmitted && handleOpenQuest(q)}
                    disabled={isSubmitted}
                    className="rounded-xl overflow-hidden text-left active:scale-[0.97] transition-transform disabled:opacity-60"
                    style={{
                      background: "radial-gradient(ellipse at 50% -5%,rgba(210,160,60,0.3) 0%,transparent 60%),linear-gradient(180deg,rgba(255,200,80,0.08) 0%,transparent 30%),linear-gradient(160deg,rgba(42,25,5,0.88),rgba(15,23,42,0.95))",
                      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                      boxShadow: "inset 0 1px 0 rgba(255,200,80,0.2),0 4px 14px rgba(0,0,0,0.4)",
                      border: "1px solid rgba(180,120,40,0.45)",
                    }}>
                    <div style={{ height: 2, background: "linear-gradient(90deg,rgba(180,120,40,0.85),rgba(180,120,40,0.4),transparent)", boxShadow: "0 0 6px rgba(180,120,40,0.4)" }} />
                    <div className="p-3 flex flex-col gap-1.5">
                      {(() => { const chip = questRequirementChip(q); return chip ? (
                        <div className="self-start text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ background:"rgba(124,58,237,0.25)", color:"#c4b5fd", border:"1px solid rgba(124,58,237,0.35)" }}>
                          {chip}
                        </div>
                      ) : null; })()}
                      <div className="font-black text-sm leading-snug text-white/90">{q.title}</div>
                      {q.desc && <div className="text-[11px] line-clamp-3 text-white/55">{q.desc}</div>}
                      <div className="flex flex-col gap-0.5 mt-1">
                        {(q.reward?.xp || 0) > 0   && <div className="text-[10px] text-blue-300">+{q.reward.xp} XP</div>}
                        {(q.reward?.coins || 0) > 0 && <div className="text-[10px] text-amber-300">+{q.reward.coins} 🪙</div>}
                      </div>
                      <div className="text-right text-[10px] font-black mt-1" style={{ color: isSubmitted ? "#10b981" : isAccepted ? "#a78bfa" : "#fbbf24" }}>
                        {isSubmitted ? "✓ 已提交" : isAccepted ? "⚡ 進行中 →" : "→ 接受"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 今日公會任務 ─────────────────────────────── */}
        <div className="px-4 mt-4">
          <div className="text-white/50 text-xs font-black mb-2 flex justify-between items-center">
            <span>⚔️ 今日公會任務（{doneToday}/{dailyTasks.length} 完成）</span>
            <span className="text-white/25 text-[10px]">每日 00:00 重置</span>
          </div>
          {/* 響應式自動欄數：每張最窄 108px，多一點就多一欄 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(108px,1fr))", gap:8 }}>
            {dailyTasks.map(task => {
              const isDone      = completed.has(task.id);
              const actualCoins = Math.round(task.coins * rank.mult);
              const DIFF_COLOR  = { 1: "#22c55e", 2: "#f59e0b", 3: "#ef4444" };
              const DIFF_TEXT   = { 1: "一般", 2: "挑戰", 3: "精英" };
              return (
                <button key={task.id} onClick={() => openDailyTask(task)} disabled={isDone}
                  className="rounded-xl overflow-hidden active:scale-[0.96] transition-transform disabled:cursor-default"
                  style={isDone ? {
                    background: "linear-gradient(160deg,rgba(25,33,45,0.9),rgba(12,18,28,0.95))",
                    backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    minHeight: 170,
                  } : {
                    background: `linear-gradient(180deg,rgba(255,255,255,0.12) 0%,transparent 28%),linear-gradient(145deg,${DIFF_COLOR[task.difficulty]}30 0%,transparent 55%),linear-gradient(160deg,rgba(15,23,42,0.88),rgba(10,16,30,0.95))`,
                    backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15),0 4px 12px rgba(0,0,0,0.4)`,
                    border: `1.5px solid ${DIFF_COLOR[task.difficulty]}55`,
                    minHeight: 170,
                  }}>
                  {/* 難度色條（加 glow） */}
                  <div style={{ height: isDone ? 1 : 2, background: isDone ? "rgba(255,255,255,0.06)" : `linear-gradient(90deg,${DIFF_COLOR[task.difficulty]},${DIFF_COLOR[task.difficulty]}aa,transparent)`, boxShadow: isDone ? "none" : `0 0 6px ${DIFF_COLOR[task.difficulty]}55` }} />

                  <div className="p-2 flex flex-col items-center text-center gap-1.5 h-full">
                    {/* 難度標籤 */}
                    <span className="text-[9px] font-black px-1 py-0.5 rounded self-start"
                      style={isDone
                        ? { background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.2)" }
                        : { background:`${DIFF_COLOR[task.difficulty]}22`, color: DIFF_COLOR[task.difficulty] }}>
                      {DIFF_TEXT[task.difficulty]}
                    </span>

                    {/* 任務名稱 */}
                    <div className="font-black text-xs leading-tight w-full"
                      style={{ color: isDone ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.92)" }}>
                      {task.questName || task.label}
                    </div>

                    {/* 靶紙 + 距離 */}
                    <div className="text-[10px]" style={{ color: isDone ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.5)" }}>
                      {TARGET_NAME[task.target]}<br/>{task.dist}m
                    </div>

                    {/* 達成條件 */}
                    <div className="text-[9px] leading-snug w-full rounded px-1 py-1"
                      style={{
                        color: isDone ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.65)",
                        background: isDone ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
                      }}>
                      {taskDesc(task)}
                    </div>

                    <div className="flex-1" />

                    {/* 獎勵 + 完成狀態 */}
                    <div className="w-full rounded px-1 py-1"
                      style={{ background: isDone ? "rgba(255,255,255,0.04)" : "rgba(120,60,10,0.18)" }}>
                      {isDone ? (
                        <div className="text-[9px] font-black" style={{ color:"#059669" }}>✓ 完成</div>
                      ) : (<>
                        <div className="text-[9px] font-bold text-blue-300">+{task.xp} XP</div>
                        <div className="text-[9px] font-bold text-amber-300">+{actualCoins}🪙{rank.mult > 1 ? ` ×${rank.mult}` : ""}</div>
                        {task.bonus && (
                          <div className="text-[9px] font-black animate-pulse text-amber-200">
                            {task.bonus.icon} {task.bonus.label}
                          </div>
                        )}
                      </>)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
