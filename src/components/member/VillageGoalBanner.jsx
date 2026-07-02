// src/components/member/VillageGoalBanner.jsx — 村目標進度條
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeActiveGoal, checkGoalStatus } from "../../lib/villageGoalDb";
import { GOAL_TYPE_MAP, buildGoalTitle } from "../../lib/villageGoalData";

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

export default function VillageGoalBanner() {
  const { profile } = useAuth();
  const [goal, setGoal] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [myContribution, setMyContribution] = useState(0);

  useEffect(() => {
    const unsub = subscribeActiveGoal(g => {
      setGoal(g);
      if (g) {
        setMyContribution(g.participants?.[profile?.id]?.contributed || 0);
        // 在 snapshot 回呼外部檢查狀態（避免在 listener 內寫入）
        setTimeout(() => checkGoalStatus(g), 0);
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
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(h >= 24 ? `${Math.floor(h/24)}天 ${h%24}小時` : `${h}小時 ${m}分`);
    }
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [goal]);

  if (!goal) return null;

  const meta = GOAL_TYPE_MAP[goal.goalType];
  const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
  const title = buildGoalTitle(goal.goalType, goal.targetValue);

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

      {/* 描述 */}
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
        {meta?.desc || ""} 我的貢獻：{myContribution.toLocaleString()}
      </div>

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
