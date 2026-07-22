// src/components/member/VillageGoalBanner.jsx — 村目標進度條
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeLatestGoal, checkGoalStatus, claimVillageGoalReward } from "../../lib/villageGoalDb";
import { GOAL_TYPE_MAP, buildGoalTitle } from "../../lib/villageGoalData";
import { useToast } from "../shared/UI";

const C = {
  cardBg: "linear-gradient(135deg, rgba(254,243,199,0.95), rgba(253,230,138,0.85))",
  border: "#F59E0B",
  gold: "#B45309",
  goldDim: "#D97706",
  text: "#78350F",
  textMuted: "#92400E",
  barBg: "rgba(180, 83, 9, 0.12)",
  barFill: "linear-gradient(90deg, #F59E0B, #D97706)",
};

function gatheringGoalTitle(goal, fallbackTitle) {
  if (!goal?.goalType?.startsWith("gathering_")) return fallbackTitle;
  const meta = GOAL_TYPE_MAP[goal.goalType];
  const targetName = goal.targetMaterialName || goal.targetResourceName || "";
  const value = Number(goal.targetValue || 0).toLocaleString();
  return `${targetName ? `${targetName} ` : ""}${value} ${meta?.contributionLabel || ""}`;
}

function gatheringGoalDesc(goal, fallbackDesc) {
  if (!goal?.goalType?.startsWith("gathering_")) return fallbackDesc;
  if (goal.goalType === "gathering_progress") return "全村累積採集進度，單人與組隊採集皆推進。";
  if (goal.goalType === "gathering_participants") return "全村累積參與人次。";
  if (goal.goalType === "gathering_material") return `採集${goal.targetMaterialName || "指定素材"}。`;
  if (goal.goalType === "gathering_resource") return `採集${goal.targetResourceName || "指定村資源"}。`;
  return fallbackDesc;
}

export default function VillageGoalBanner() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [goal, setGoal] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [showRewards, setShowRewards] = useState(false);
  const [myContribution, setMyContribution] = useState(0);

  useEffect(() => {
    const unsub = subscribeLatestGoal(g => {
      setGoal(g?.status === "active" ? g : null);
      if (g?.status === "active") {
        setMyContribution(g.participants?.[profile?.id]?.contributed || 0);
        setTimeout(() => checkGoalStatus(g), 0);
        return;
      }
      const mine = g?.participants?.[profile?.id];
      if (profile?.id && mine?.contributed > 0 && !mine?.claimed
        && (g.status === "completed" || g.status === "expired")) {
        claimVillageGoalReward(g.id, profile.id).then(res => {
          if (res?.ok && res?.reward) {
            const parts = [];
            if (res.reward.coins > 0)      parts.push(`+${res.reward.coins} 金幣`);
            if (res.reward.arrowdew > 0)   parts.push(`+${res.reward.arrowdew} 箭露`);
            if (res.reward.gachaToken > 0) parts.push(`+${res.reward.gachaToken} 扭蛋幣`);
            if (parts.length) toast(`🎁 村目標獎勵已入帳：${parts.join(" ")}`);
          }
        }).catch(() => {});
      }
    });
    return unsub;
  }, [profile?.id]);

  useEffect(() => {
    if (!goal) return;
    function tick() {
      const endMs = goal.endAt?.toMillis?.();
      if (!endMs) { setTimeLeft(""); return; }
      const diff = endMs - Date.now();
      if (diff <= 0) { setTimeLeft("即將結束"); return; }
      const days = Math.max(0, Math.floor(diff / 86400000));
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${days}日 ${hours}小時 ${mins}分`);
    }
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [goal]);

  if (!goal) return <ToastContainer />;

  const participantEntries = Object.entries(goal.participants || {});
  const totalCount = participantEntries.filter(([, p]) => (p.contributed || 0) > 0).length;

  const meta = GOAL_TYPE_MAP[goal.goalType];
  const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
  const titleText = gatheringGoalTitle(goal, goal.customTitle || buildGoalTitle(goal.goalType, goal.targetValue));
  const desc = gatheringGoalDesc(goal, goal.customDescription || meta?.desc || "");

  return (
    <div className="mx-4 my-2.5 rounded-2xl p-3.5 shadow-sm transition-all relative overflow-hidden"
      style={{
        background: C.cardBg,
        border: `1.5px solid ${C.border}`,
        boxShadow: "0 4px 12px rgba(245, 158, 11, 0.15)"
      }}>
      {/* 浮水印背景裝飾 */}
      <div style={{ position: "absolute", right: -5, bottom: -10, fontSize: 54, opacity: 0.12, pointerEvents: "none" }}>
        {meta?.icon || "🎯"}
      </div>

      {/* 標題與對齊 */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base">{meta?.icon || "🎯"}</span>
          <span className="font-black text-xs sm:text-sm truncate" style={{ color: C.text }}>
            全村目標：{titleText}
          </span>
        </div>
        <span className="text-[11px] font-black shrink-0 px-2 py-0.5 rounded-full" style={{ background: "rgba(180,83,9,0.12)", color: C.textMuted }}>
          ⏳ {timeLeft}
        </span>
      </div>

      {/* 說明與個人貢獻 */}
      <div className="flex items-center justify-between text-[11px] font-bold mb-2" style={{ color: C.textMuted }}>
        <span className="truncate flex-1 pr-2">{desc}</span>
        <span className="shrink-0 font-black" style={{ color: C.gold }}>
          我的貢獻：{myContribution.toLocaleString()}
        </span>
      </div>

      {/* 進度條 */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px] font-black">
          <span style={{ color: C.textMuted }}>全體累積進度</span>
          <span style={{ color: C.gold }}>
            {goal.currentValue.toLocaleString()} / {goal.targetValue.toLocaleString()} ({pct}%)
          </span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: C.barBg }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: C.barFill, boxShadow: "0 0 8px rgba(245,158,11,0.5)" }} />
        </div>
      </div>

      {/* 獎勵領取預覽展開 */}
      <div className="mt-2.5 pt-2 border-t border-amber-900/10 flex items-center justify-between text-[10px] font-bold">
        <div onClick={() => setShowRewards(p => !p)} className="cursor-pointer flex items-center gap-1 hover:underline" style={{ color: C.goldDim }}>
          <span>🎁 查看完成全村獎勵</span>
          <span>{showRewards ? "▲" : "▼"}</span>
        </div>
        {totalCount > 0 && (
          <span style={{ color: C.textMuted }}>
            👥 已有 {totalCount} 位村民參與
          </span>
        )}
      </div>

      {showRewards && goal.rewards && (
        <div className="mt-2 flex gap-3 p-2 rounded-xl text-xs font-black" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <span>💧 箭露 <span style={{ color: C.gold }}>+{goal.rewards.arrowdew ?? 0}</span></span>
          <span>🪙 金幣 <span style={{ color: C.gold }}>+{goal.rewards.coins ?? 0}</span></span>
          <span>🎰 扭蛋幣 <span style={{ color: C.gold }}>+{goal.rewards.gachaToken ?? 0}</span></span>
        </div>
      )}
    </div>
  );
}
