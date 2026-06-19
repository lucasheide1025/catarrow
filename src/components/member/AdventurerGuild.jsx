// src/components/member/AdventurerGuild.jsx — 冒險者公會
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeAdventurerProgress, completeGuildTask, completePromotionQuest } from "../../lib/db";
import {
  levelFromXP, rankFromLevel, rankIdxFromLevel, levelInRank, xpProgress,
  isPromotionLevel, getDailyGuildTasks, TARGET_ZONES, TARGET_NAME,
  checkTaskPass, taskDesc, RANKS, STANDARD_ZONES, PROMOTION_QUESTS,
} from "../../lib/adventurerSystem";
import { sfxSuccess, sfxSoftFail, sfxTap } from "../../lib/sound";

const DIFF_LABEL = { 1: "🟢 一般", 2: "🟡 挑戰", 3: "🔴 精英" };

export default function AdventurerGuild({ onBack }) {
  const { profile } = useAuth();
  const [progress, setProgress] = useState(null);
  const [view, setView]         = useState("list"); // "list" | "shoot" | "promotion"
  const [activeTask, setActiveTask]   = useState(null);
  const [arrows, setArrows]           = useState([]);
  const [taskResult, setTaskResult]   = useState(null);
  const [busy, setBusy]               = useState(false);
  const [promoArrows, setPromoArrows] = useState([]);
  const [promoResult, setPromoResult] = useState(null); // null | { pass, bonusXP } | "rankup"
  const [promoBusy, setPromoBusy]     = useState(false);

  const xp       = profile?.adventurerXP || 0;
  const level    = levelFromXP(xp);
  const rank     = rankFromLevel(level);
  const lvInRank = levelInRank(level);
  const { current, needed, pct } = xpProgress(xp, level);
  const tasks = getDailyGuildTasks(new Date().toISOString().slice(0, 10));

  // 晉階任務：當前等級是晉階等級且尚未完成
  const promoDone = new Set(profile?.promotionDone || []);
  const promoQuest = isPromotionLevel(level) && PROMOTION_QUESTS[level] && !promoDone.has(level)
    ? PROMOTION_QUESTS[level] : null;

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeAdventurerProgress(profile.id, setProgress);
    return () => unsub?.();
  }, [profile?.id]);

  const completed = new Set(progress?.completed || []);

  function tapPromo(val) {
    if (!promoQuest) return;
    if (promoArrows.length >= promoQuest.arrowCount) return;
    sfxTap();
    setPromoArrows(prev => [...prev, val]);
  }

  async function submitPromo() {
    if (!promoQuest || !profile?.id) return;
    if (promoArrows.length < promoQuest.arrowCount) return;
    setPromoBusy(true);
    const total = promoArrows.reduce((s, a) => s + a, 0);
    const pass  = total >= promoQuest.goal;
    if (pass) {
      sfxSuccess();
      await completePromotionQuest(profile.id, promoQuest.level, promoQuest.bonusXP).catch(() => {});
      setPromoResult("rankup");
    } else {
      sfxSoftFail();
      setPromoResult({ pass: false, total });
    }
    setPromoBusy(false);
  }

  function openTask(task) {
    if (completed.has(task.id)) return;
    setActiveTask(task);
    setArrows([]);
    setTaskResult(null);
    setView("shoot");
  }

  function tapArrow(val) {
    if (!activeTask) return;
    const max = activeTask.type === "one_shot" ? 1 : activeTask.arrowCount;
    if (arrows.length >= max) return;
    sfxTap();
    setArrows(prev => [...prev, val]);
  }

  function undoArrow() {
    setArrows(prev => prev.slice(0, -1));
  }

  async function submitTask() {
    if (!activeTask || !profile?.id) return;
    const max = activeTask.type === "one_shot" ? 1 : activeTask.arrowCount;
    if (arrows.length < max) return;
    setBusy(true);
    const pass = checkTaskPass(activeTask, arrows);
    if (pass) {
      sfxSuccess();
      const actualCoins = Math.round(activeTask.coins * rank.mult);
      await completeGuildTask(profile.id, activeTask.id, activeTask.xp, actualCoins);
      setTaskResult({ pass: true, xp: activeTask.xp, coins: actualCoins });
    } else {
      sfxSoftFail();
      setTaskResult({ pass: false });
    }
    setBusy(false);
  }

  // ── 晉階任務頁面 ───────────────────────────────────────────
  if (view === "promotion" && promoQuest) {
    const total = promoArrows.reduce((s, a) => s + a, 0);
    const done  = promoArrows.length >= promoQuest.arrowCount;
    const nextRank = RANKS[rankIdxFromLevel(level) + 1] || rank;

    // 晉階成功動畫畫面
    if (promoResult === "rankup") {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
          style={{ background: `linear-gradient(135deg,${nextRank.color}33,#0f172a)` }}>
          <div className="text-6xl mb-4">{nextRank.icon}</div>
          <div className="text-white/60 text-sm mb-1">恭喜晉階！</div>
          <div className="text-white font-black text-3xl mb-1">{nextRank.name}</div>
          <div className="text-white/50 text-sm mb-6">+{promoQuest.bonusXP} XP 晉階獎勵已發放</div>
          <div className="rounded-2xl px-6 py-3 font-black text-sm text-gray-900 mb-8"
            style={{ background: nextRank.color }}>
            {promoQuest.fromRank} → {nextRank.name} 正式晉升 ⚔️
          </div>
          <button onClick={() => { setView("list"); setPromoResult(null); setPromoArrows([]); }}
            className="w-full max-w-xs py-4 rounded-2xl bg-white text-gray-900 font-black text-base">
            返回公會
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#0f172a" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b sticky top-0 z-10"
          style={{ background: "#0f172a", borderColor: "#fbbf2440" }}>
          <button onClick={() => { setView("list"); setPromoResult(null); setPromoArrows([]); }}
            className="text-white/60 text-sm">← 返回</button>
          <div className="text-amber-300 font-black flex-1">⚔️ 晉階任務</div>
          <div className="text-xs text-amber-400/60">{promoQuest.fromRank}→{promoQuest.toRank}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-8">
          {/* 任務說明 */}
          <div className="rounded-2xl p-4 border border-amber-400/30"
            style={{ background: "rgba(251,191,36,0.08)" }}>
            <div className="text-amber-300 font-black text-base mb-1">原野射箭靶紙</div>
            <div className="text-white/80 text-sm mb-0.5">
              📍 {promoQuest.dist}米・{promoQuest.arrowCount}箭・總分 ≥ {promoQuest.goal} 分
            </div>
            <div className="text-amber-200/60 text-xs mt-2">
              通過即晉升 {promoQuest.toRank}，並獲得 +{promoQuest.bonusXP} XP 晉階獎勵
            </div>
          </div>

          {!promoResult && (
            <>
              {/* 箭矢槽 */}
              <div className="flex gap-1.5 flex-wrap items-center">
                {Array.from({ length: promoQuest.arrowCount }).map((_, i) => (
                  <span key={i} className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black
                    ${i < promoArrows.length
                      ? "bg-amber-400 text-gray-900"
                      : i === promoArrows.length ? "bg-white/20 text-white ring-2 ring-amber-400" : "bg-white/10 text-white/30"}`}>
                    {i < promoArrows.length ? (promoArrows[i] === 0 ? "M" : promoArrows[i]) : ""}
                  </span>
                ))}
                {promoArrows.length > 0 && (
                  <button onClick={() => setPromoArrows(p => p.slice(0, -1))}
                    className="text-white/50 text-xs ml-auto underline">↩ 退一箭</button>
                )}
              </div>

              {/* 分數按鈕（標準原野射箭） */}
              <div className="grid grid-cols-4 gap-2">
                {STANDARD_ZONES.map(z => (
                  <button key={z.label} onClick={() => tapPromo(z.val)} disabled={done}
                    className="py-4 rounded-2xl font-black text-white text-sm active:scale-95 transition-transform disabled:opacity-40"
                    style={{ background: z.color }}>
                    {z.label}
                    {z.val > 0 && <span className="block text-xs opacity-70 font-normal mt-0.5">+{z.val}</span>}
                  </button>
                ))}
              </div>

              {/* 當前分數 */}
              {promoArrows.length > 0 && (
                <div className="rounded-xl p-3 text-center border border-amber-400/20"
                  style={{ background: "rgba(251,191,36,0.06)" }}>
                  <span className="text-amber-300 font-black text-2xl">{total} 分</span>
                  <span className="text-white/40 text-sm ml-2">/ {promoQuest.goal} 分目標</span>
                  <span className="text-white/30 text-xs ml-2">{promoArrows.length}/{promoQuest.arrowCount} 箭</span>
                </div>
              )}

              <button onClick={submitPromo} disabled={promoBusy || !done}
                className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-transform disabled:opacity-40 text-gray-900"
                style={{ background: done ? "#fbbf24" : "rgba(251,191,36,0.3)", color: done ? "#1c1917" : "#d97706" }}>
                {done ? "提交晉階成績" : `還要射 ${promoQuest.arrowCount - promoArrows.length} 箭`}
              </button>
            </>
          )}

          {/* 失敗結果 */}
          {promoResult && promoResult !== "rankup" && !promoResult.pass && (
            <div className="rounded-2xl p-6 text-center border border-amber-400/20"
              style={{ background: "rgba(251,191,36,0.06)" }}>
              <div className="text-4xl mb-3">💪</div>
              <div className="text-white font-black text-xl mb-1">差一點！</div>
              <div className="text-white/50 text-sm mb-1">本次 {promoResult.total} 分・目標 {promoQuest.goal} 分</div>
              <div className="text-white/40 text-xs mb-5">晉階任務可無限重試，繼續加油！</div>
              <button onClick={() => { setPromoArrows([]); setPromoResult(null); }}
                className="w-full py-3 rounded-xl font-black text-sm text-amber-300 border border-amber-400/30">
                再試一次
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 射擊頁面 ──────────────────────────────────────────────
  if (view === "shoot" && activeTask) {
    const zones  = TARGET_ZONES[activeTask.target] || [];
    const maxArr = activeTask.type === "one_shot" ? 1 : activeTask.arrowCount;
    const total  = arrows.reduce((s, a) => s + a, 0);
    const done   = arrows.length >= maxArr;

    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#0f172a" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 sticky top-0" style={{ background: "#0f172a", zIndex: 10 }}>
          <button onClick={() => { setView("list"); setTaskResult(null); }}
            className="text-white/60 text-sm">← 返回</button>
          <div className="text-white font-black flex-1">{activeTask.label}</div>
          <div className="text-xs text-white/40">{TARGET_NAME[activeTask.target]}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-8">
          {/* 任務資訊 */}
          <div className="rounded-2xl p-4 border border-white/10" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="text-white/60 text-xs mb-1">{DIFF_LABEL[activeTask.difficulty]}</div>
            <div className="text-white font-black text-base mb-1">{taskDesc(activeTask)}</div>
            <div className="text-white/50 text-xs">📍 {activeTask.dist}米・{TARGET_NAME[activeTask.target]}・{maxArr}箭</div>
            <div className="text-emerald-400 text-xs mt-1.5">
              +{activeTask.xp} XP &nbsp;·&nbsp; +{Math.round(activeTask.coins * rank.mult)} 金幣（{rank.name} {rank.mult}x）
            </div>
          </div>

          {!taskResult && (
            <>
              {/* 箭矢槽 */}
              <div className="flex gap-1.5 flex-wrap items-center">
                {Array.from({ length: maxArr }).map((_, i) => (
                  <span key={i} className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black
                    ${i < arrows.length
                      ? arrows[i] < 0 ? "bg-red-700 text-white" : "bg-white text-gray-900"
                      : i === arrows.length ? "bg-white/20 text-white ring-2 ring-white" : "bg-white/10 text-white/30"}`}>
                    {i < arrows.length
                      ? arrows[i] < 0 ? "❌" : arrows[i] === 0 ? "M" : arrows[i]
                      : ""}
                  </span>
                ))}
                {arrows.length > 0 && (
                  <button onClick={undoArrow} className="text-white/50 text-xs ml-auto underline">↩ 退一箭</button>
                )}
              </div>

              {/* 分數按鈕 */}
              <div className={`grid gap-2 ${zones.length <= 4 ? "grid-cols-2" : "grid-cols-4"}`}>
                {zones.map(z => (
                  <button key={z.label} onClick={() => tapArrow(z.val)} disabled={done}
                    className="py-4 rounded-2xl font-black text-white text-sm active:scale-95 transition-transform disabled:opacity-40"
                    style={{ background: z.penalty ? "linear-gradient(135deg,#7f1d1d,#1e293b)" : z.color }}>
                    {z.label}
                    {!z.penalty && z.val !== 0 && (
                      <span className="block text-xs opacity-70 font-normal mt-0.5">{z.val > 0 ? `+${z.val}` : z.val}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* 當前分數 */}
              {arrows.length > 0 && (
                <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <span className="text-white font-black text-2xl">
                    {total >= 0 ? total : total} 分
                  </span>
                  <span className="text-white/40 text-sm ml-2">{arrows.length}/{maxArr} 箭</span>
                </div>
              )}

              <button onClick={submitTask} disabled={busy || !done}
                className="w-full py-4 rounded-2xl bg-white text-gray-900 font-black text-base active:scale-95 transition-transform disabled:opacity-40">
                {done ? "登記成績" : `還要射 ${maxArr - arrows.length} 箭`}
              </button>
            </>
          )}

          {/* 結果 */}
          {taskResult && (
            <div className={`rounded-2xl p-6 text-center border ${taskResult.pass
              ? "border-emerald-500/30" : "border-red-500/30"}`}
              style={{ background: taskResult.pass ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)" }}>
              <div className="text-4xl mb-3">{taskResult.pass ? "🎉" : "💪"}</div>
              <div className="text-white font-black text-xl mb-2">
                {taskResult.pass ? "任務完成！" : "差一點！"}
              </div>
              {taskResult.pass ? (
                <>
                  <div className="text-emerald-300 font-bold text-sm">+{taskResult.xp} 冒險者 XP</div>
                  <div className="text-yellow-300 font-bold text-sm mb-4">+{taskResult.coins} 金幣</div>
                </>
              ) : (
                <div className="text-red-300 text-sm mb-4">繼續嘗試！目標：{taskDesc(activeTask)}</div>
              )}
              <div className="flex gap-3">
                {!taskResult.pass && (
                  <button onClick={() => { setArrows([]); setTaskResult(null); }}
                    className="flex-1 py-3 rounded-xl font-black text-sm text-white border border-white/20">
                    重試
                  </button>
                )}
                <button onClick={() => { setView("list"); setTaskResult(null); }}
                  className="flex-1 py-3 rounded-xl bg-white text-gray-900 font-black text-sm">
                  {taskResult.pass ? "返回公會" : "換任務"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 任務清單頁面 ──────────────────────────────────────────
  const doneCount = completed.size;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0f172a" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 sticky top-0 z-10" style={{ background: "#0f172a" }}>
        <button onClick={onBack} className="text-white/60 text-sm">← 返回</button>
        <div className="text-white font-black flex-1">冒險者公會</div>
        <div className="text-xs text-white/40">{doneCount}/{tasks.length} 完成</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-10">

        {/* 等級 / 階級 Banner */}
        <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: rank.gradient }}>
          <div className="flex items-start gap-3 mb-3">
            <div className="text-5xl leading-none">{rank.icon}</div>
            <div className="flex-1">
              <div className="text-white/60 text-xs mb-0.5">冒險者等級</div>
              <div className="text-white font-black text-2xl leading-tight">Lv.{level} {rank.name}</div>
              <div className="text-white/60 text-xs">{rank.name}段 {lvInRank}/10 　累積 {xp.toLocaleString()} XP</div>
            </div>
            <div className="text-right">
              <div className="text-white font-black text-xl">{doneCount}/{tasks.length}</div>
              <div className="text-white/60 text-xs">今日任務</div>
            </div>
          </div>

          {/* XP 進度條 */}
          {level < 60 ? (
            <>
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span>{current.toLocaleString()} / {needed.toLocaleString()} XP</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2.5 bg-black/30 rounded-full overflow-hidden">
                <div className="h-full bg-white/80 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </>
          ) : (
            <div className="text-amber-300 font-black text-sm">⚡ 神話滿等！傳說的射手</div>
          )}

          {promoQuest && (
            <button onClick={() => { setPromoArrows([]); setPromoResult(null); setView("promotion"); }}
              className="mt-3 w-full rounded-xl px-3 py-2.5 border border-amber-400/50 text-left active:scale-[0.98] transition-transform"
              style={{ background: "rgba(251,191,36,0.12)" }}>
              <div className="text-amber-300 font-black text-xs">⚔️ 晉階任務已解鎖！點此開始 →</div>
              <div className="text-amber-200/60 text-xs mt-0.5">
                原野射箭 {promoQuest.dist}m・{promoQuest.arrowCount}箭・≥{promoQuest.goal}分 → 晉升 {promoQuest.toRank}
              </div>
            </button>
          )}
          {isPromotionLevel(level) && !promoQuest && (
            <div className="mt-3 rounded-xl px-3 py-2 border border-emerald-400/30"
              style={{ background: "rgba(16,185,129,0.08)" }}>
              <div className="text-emerald-300 font-black text-xs">✓ Lv{level} 晉階任務已完成</div>
            </div>
          )}
        </div>

        {/* 任務列表 */}
        <div className="flex flex-col gap-2">
          <div className="text-white/50 text-xs font-bold px-1">今日公會任務（每日 00:00 重置）</div>
          {tasks.map(task => {
            const isDone = completed.has(task.id);
            const actualCoins = Math.round(task.coins * rank.mult);
            return (
              <button key={task.id} onClick={() => openTask(task)} disabled={isDone}
                className={`w-full rounded-2xl p-4 text-left border transition-all ${isDone ? "opacity-50 cursor-default" : "active:scale-[0.98] active:opacity-90"}`}
                style={{
                  background: isDone ? "rgba(30,41,59,0.8)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${isDone ? "#334155" : "rgba(255,255,255,0.08)"}`,
                }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs">{DIFF_LABEL[task.difficulty]}</span>
                  <span className="text-white font-black text-sm flex-1">{task.label}</span>
                  {isDone
                    ? <span className="text-emerald-400 text-xs font-bold">✓ 完成</span>
                    : <span className="text-white/30 text-xs">→</span>
                  }
                </div>
                <div className="text-white/50 text-xs mb-1">
                  📍 {task.dist}米 &nbsp;·&nbsp; {TARGET_NAME[task.target]} &nbsp;·&nbsp; {task.type === "one_shot" ? 1 : task.arrowCount}箭
                </div>
                <div className="text-white/60 text-xs mb-2">{taskDesc(task)}</div>
                <div className="flex gap-3 text-xs">
                  <span className="text-cyan-400">+{task.xp} XP</span>
                  <span className="text-yellow-400">+{actualCoins} 金幣</span>
                  {rank.mult > 1 && <span className="text-white/30">{rank.mult}x 倍率</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* 階級倍率參考 */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-white/50 text-xs font-bold mb-3">階級獎勵倍率</div>
          <div className="grid grid-cols-3 gap-2">
            {RANKS.map((r, i) => (
              <div key={r.name}
                className={`rounded-xl p-2 text-center ${rankIdxFromLevel(level) === i ? "ring-1 ring-white/40" : ""}`}
                style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="text-xl leading-none mb-1">{r.icon}</div>
                <div className="text-white text-xs font-black">{r.name}</div>
                <div className="text-white/40 text-xs">{r.mult}x</div>
              </div>
            ))}
          </div>
        </div>

        {/* XP 獲得說明 */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-white/50 text-xs font-bold mb-2">XP 獲得方式</div>
          <div className="text-white/40 text-xs flex flex-col gap-1">
            <span>⚔️ 打怪：傷害 ÷ 100</span>
            <span>🌍 世界王：傷害 ÷ 100</span>
            <span>🎯 練習 / 比賽：總分 ÷ 10</span>
            <span>🏰 地下城：總分 ÷ 8</span>
            <span>📜 公會任務：固定 50 / 100 / 150 XP</span>
          </div>
        </div>
      </div>
    </div>
  );
}
