// src/components/member/VillageGoalBanner.jsx — 村目標進度條
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeLatestGoal, checkGoalStatus, claimVillageGoalReward } from "../../lib/villageGoalDb";
import { GOAL_TYPE_MAP, buildGoalTitle } from "../../lib/villageGoalData";
import { useToast } from "../shared/UI";

const C = {
  bg: "linear-gradient(135deg,#2d1a08,#451a03,#1a0f05)",
  border: "#92400e",
  gold: "#fbbf24",
  goldDim: "#d97706",
  text: "#fde68a",
  textMuted: "rgba(255,255,255,0.5)",
  barBg: "rgba(255,255,255,0.08)",
  barFill: "linear-gradient(90deg,#f59e0b,#fbbf24)",
};

function gatheringGoalTitle(goal, fallbackTitle) {
  if (!goal?.goalType?.startsWith("gathering_")) return fallbackTitle;
  const meta = GOAL_TYPE_MAP[goal.goalType];
  const targetName = goal.targetMaterialName || goal.targetResourceName || "";
  const value = Number(goal.targetValue || 0).toLocaleString();
  return `${meta?.icon || "🏹"} 村目標：${targetName ? `${targetName} ` : ""}${value} ${meta?.contributionLabel || ""}`;
}

function gatheringGoalDesc(goal, fallbackDesc) {
  if (!goal?.goalType?.startsWith("gathering_")) return fallbackDesc;
  if (goal.goalType === "gathering_progress") return "全村累積貓村採集進度，單人與組隊採集都會推進。";
  if (goal.goalType === "gathering_participants") return "全村累積採集參與人次，組隊採集會依參與人數推進。";
  if (goal.goalType === "gathering_material") return `透過採集取得${goal.targetMaterialName || "指定怪物素材"}來推進。`;
  if (goal.goalType === "gathering_resource") return `透過採集取得${goal.targetResourceName || "指定村資源"}來推進。`;
  return fallbackDesc;
}

export default function VillageGoalBanner() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [goal, setGoal] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [showRewards, setShowRewards] = useState(false);
  const [myContribution, setMyContribution] = useState(0);

  // 訂閱最新一筆目標（不限 active）：active 時顯示 banner，completed/expired 時觸發自行請領
  useEffect(() => {
    const unsub = subscribeLatestGoal(g => {
      setGoal(g?.status === "active" ? g : null);
      if (g?.status === "active") {
        setMyContribution(g.participants?.[profile?.id]?.contributed || 0);
        // 在 snapshot 回呼外部檢查狀態（避免在 listener 內寫入）
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
  }, [profile?.id]); // eslint-disable-line

  // 倒數計時器
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

  // 有貢獻的參與者人數（不含自己）
  const participantEntries = Object.entries(goal.participants || {});
  const totalCount = participantEntries.filter(([, p]) => (p.contributed || 0) > 0).length;

  const meta = GOAL_TYPE_MAP[goal.goalType];
  const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
  const titleText = gatheringGoalTitle(goal, goal.customTitle || buildGoalTitle(goal.goalType, goal.targetValue));
  const desc = goal?.goalType?.startsWith("gathering_")
    ? `${titleText}｜${gatheringGoalDesc(goal, goal.customDescription || meta?.desc || "")}`
    : gatheringGoalDesc(goal, goal.customDescription || meta?.desc || "");

  return (
    <div
      style={{
        background: C.bg,
        borderBottom: `2px solid ${C.border}`,
        padding: "10px 14px",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
      onClick={() => {
        // 只點 banner 更新 state（不跳轉）
      }}>
      {/* 背景裝飾 */}
      <div style={{ position: "absolute", top: -10, right: -10, fontSize: 60, opacity: 0.04, pointerEvents: "none" }}>
        {meta?.icon || "🏡"}
      </div>

      {/* 標題列 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>{meta?.icon || "🏡"}</span>
          <span style={{ fontWeight: 900, fontSize: 13, color: C.text }}>村目標</span>
          <span style={{ fontSize: 10, color: C.textMuted }}>⏳ {timeLeft}</span>
        </div>
        <span style={{ fontWeight: 900, fontSize: 12, color: C.gold }}>
          {goal.currentValue.toLocaleString()}
          <span style={{ color: C.textMuted }}> / {goal.targetValue.toLocaleString()}</span>
        </span>
      </div>

      {/* 描述 + 貢獻 + 參與者 */}
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>
          {desc}
          {totalCount > 0 && (
            <span style={{ marginLeft: 8, color: C.goldDim, fontWeight: 700 }}>
              👥 {profile?.name || profile?.nickname || "我"} + {totalCount - 1}位村民
            </span>
          )}
        </span>
        <span style={{ fontWeight: 700, color: C.goldDim }}>我的貢獻：{myContribution.toLocaleString()}</span>
      </div>

      {/* 完成獎勵預覽（可點擊展開） */}
      <div
        onClick={e => { e.stopPropagation(); setShowRewards(p => !p); }}
        style={{
          fontSize: 10, color: C.goldDim, cursor: "pointer",
          marginBottom: showRewards ? 6 : 0,
          userSelect: "none",
          display: "flex", alignItems: "center", gap: 4,
        }}>
        <span>🎁 完成獎勵</span>
        <span style={{ fontSize: 8 }}>{showRewards ? "▲" : "▼"}</span>
      </div>
      {showRewards && goal.rewards && (
        <div style={{
          display: "flex", gap: 12, marginBottom: 8,
          padding: "6px 10px", borderRadius: 8,
          background: "rgba(255,255,255,0.06)",
          fontSize: 11, fontWeight: 700,
        }}>
          <span>💧 箭露 <span style={{ fontWeight: 900, color: C.gold }}>+{goal.rewards.arrowdew ?? 0}</span></span>
          <span>🪙 金幣 <span style={{ fontWeight: 900, color: C.gold }}>+{goal.rewards.coins ?? 0}</span></span>
          <span>🎰 扭蛋幣 <span style={{ fontWeight: 900, color: C.gold }}>+{goal.rewards.gachaToken ?? 0}</span></span>
        </div>
      )}

      {/* 進度條 */}
      <div style={{
        height: 10, borderRadius: 99,
        background: C.barBg,
        overflow: "hidden",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)",
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: C.barFill,
          borderRadius: 99,
          transition: "width 0.5s ease",
          boxShadow: `0 0 10px ${C.gold}66`,
        }} />
      </div>

      {/* 完成狀態 */}
      {pct >= 100 && (
        <div style={{
          textAlign: "center",
          marginTop: 5,
          fontSize: 12,
          fontWeight: 900,
          color: C.gold,
          animation: "goalPulse 1s ease infinite",
        }}>
          🎉 目標達成！獎勵發放中…
        </div>
      )}

      <style>{`@keyframes goalPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }`}</style>
    </div>
  );
}
