// src/components/member/DailyQuest.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeMyCheckin, submitCheckin, approveCheckin, submitClassEnd, addArrowdew,
  grantArrowMilestoneRewards, subscribeTodayPracticeLogs,
} from "../../lib/db";
import { ALL_MILESTONES, getMilestonesReached, getRewardsForMilestone } from "../../lib/arrowMilestone";
import { sfxSuccess, sfxTap } from "../../lib/sound";
import ArrowMilestonePopup from "./ArrowMilestonePopup";

// ── 今日里程碑全覽板 ─────────────────────────────────────────────
function MilestoneBoard({ todayArrows }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.4)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: "10px 12px",
      marginTop: 8,
    }}>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
        🏹 今日射箭里程碑
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {ALL_MILESTONES.map(ms => {
          const unlocked = todayArrows >= ms.arrows;
          const rewards = getRewardsForMilestone(ms);
          const rewardText = [
            rewards.gachaCoins ? `+${rewards.gachaCoins}抽獎幣` : "",
            rewards.catBoxes   ? `+${rewards.catBoxes}貓箱`     : "",
          ].filter(Boolean).join(" ");
          return (
            <div key={ms.arrows} style={{
              display: "flex", alignItems: "center", gap: 8,
              opacity: unlocked ? 1 : 0.35,
            }}>
              {/* 勾 / 圓 */}
              <div style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                background: unlocked ? "linear-gradient(135deg,#22c55e,#16a34a)" : "rgba(255,255,255,0.08)",
                border: unlocked ? "none" : "1px solid rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10,
              }}>
                {unlocked ? "✓" : ""}
              </div>
              {/* 標籤 */}
              <div style={{ flex: 1, fontSize: 11, color: unlocked ? "#e2e8f0" : "#64748b", fontWeight: unlocked ? 700 : 400 }}>
                {ms.label}
              </div>
              {/* 獎勵 */}
              <div style={{ fontSize: 10, color: unlocked ? "#fbbf24" : "#475569", fontWeight: 700 }}>
                {rewardText}
              </div>
            </div>
          );
        })}
      </div>
      {/* 進度條 */}
      {(() => {
        const nextMs = ALL_MILESTONES.find(m => m.arrows > todayArrows);
        if (!nextMs) return (
          <div style={{ color: "#22c55e", fontSize: 10, fontWeight: 700, textAlign: "center", marginTop: 8 }}>
            🎉 今日所有里程碑已全解！
          </div>
        );
        const prevMs = ALL_MILESTONES.slice().reverse().find(m => m.arrows <= todayArrows);
        const from = prevMs?.arrows || 0;
        const pct = Math.round(((todayArrows - from) / (nextMs.arrows - from)) * 100);
        return (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginBottom: 3 }}>
              <span>下個里程碑：{nextMs.arrows}箭</span>
              <span>還差 {nextMs.arrows - todayArrows} 箭</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#3b82f6,#06b6d4)", borderRadius: 4, transition: "width 0.4s" }} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function DailyQuest({ onJoinParty }) {
  const { profile } = useAuth();
  const [checkin,       setCheckin]       = useState(undefined);
  const [submitBusy,    setSubmitBusy]    = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [classBusy,     setClassBusy]     = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [todayArrows,   setTodayArrows]   = useState(0);
  const [milestoneQueue, setMilestoneQueue] = useState([]);

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeMyCheckin(profile.id, setCheckin);
    return () => unsub?.();
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    // 全模式都計入（不排除任何 source），讓「今日箭數」反映真實射箭量
    const unsub = subscribeTodayPracticeLogs(profile.id, todayStr, logs => {
      const count = logs.reduce(
        (s, l) => s + (l.totalArrows ?? (Array.isArray(l.rounds) ? l.rounds.flat().length : 0)),
        0
      );
      setTodayArrows(count);
    });
    return () => unsub?.();
  }, [profile?.id]); // eslint-disable-line

  async function handleCheckin() {
    if (!profile?.id || submitBusy) return;
    setSubmitBusy(true);
    try {
      const { id } = await submitCheckin(profile.id, profile.name, profile.nickname);
      // 教練自主報到 → 立即審核通過，不需等另一位教練
      if (profile.isAdmin) {
        await approveCheckin(id, profile.id).catch(() => {});
      }
      sfxTap();
      setJustSubmitted(true);
    } catch (e) { console.warn("checkin:", e?.message); }
    setSubmitBusy(false);
  }

  async function confirmClassEnd() {
    setShowConfirm(false);
    setClassBusy(true); sfxSuccess();
    try {
      await submitClassEnd(profile.id, checkin.id);
      if (todayArrows > 0) {
        addArrowdew(profile.id, todayArrows).catch(() => {});
        const milestones = getMilestonesReached(0, todayArrows);
        if (milestones.length > 0) {
          grantArrowMilestoneRewards(profile.id, milestones).catch(() => {});
          setMilestoneQueue(milestones.map(ms => ({ ms, rewards: getRewardsForMilestone(ms) })));
        }
      }
    } catch (e) { console.warn("confirmClassEnd:", e?.message); }
    setClassBusy(false);
  }

  if (checkin === undefined) {
    return (
      <div style={{ color:"rgba(255,255,255,0.4)", fontSize:13, padding:"10px 0", textAlign:"center" }}
        className="animate-pulse">載入中…</div>
    );
  }

  const status     = checkin?.status;
  const isActive   = status === "active" && !checkin?.classEnded;
  const isEnded    = !!checkin?.classEnded;
  const isPending  = status === "pending";
  const isRejected = status === "rejected";
  const noCheckin  = !checkin || status === "cancelled";

  // ── 報到按鈕 config ───────────────────────────────────────────
  let ciLabel, ciBg, ciColor, ciDisabled;
  if (submitBusy) {
    ciLabel = "送出中…"; ciBg = "#1e293b"; ciColor = "#94a3b8"; ciDisabled = true;
  } else if (noCheckin && !justSubmitted) {
    ciLabel = "📋 報到";
    ciBg = "linear-gradient(135deg,#059669,#0d9488)";
    ciColor = "white"; ciDisabled = false;
  } else if (justSubmitted || isPending) {
    ciLabel = "⏳ 待審核"; ciBg = "#1e293b"; ciColor = "#64748b"; ciDisabled = true;
  } else if (isActive) {
    ciLabel = "✅ 已審核"; ciBg = "#1e293b"; ciColor = "#64748b"; ciDisabled = true;
  } else if (isEnded) {
    ciLabel = "🏁 已下課"; ciBg = "#1e293b"; ciColor = "#64748b"; ciDisabled = true;
  } else if (isRejected) {
    ciLabel = "🔄 重新報到"; ciBg = "linear-gradient(135deg,#059669,#0d9488)"; ciColor = "white"; ciDisabled = false;
  } else {
    ciLabel = "📋 報到";
    ciBg = "linear-gradient(135deg,#059669,#0d9488)";
    ciColor = "white"; ciDisabled = false;
  }

  // ── 下課按鈕 config ───────────────────────────────────────────
  const canEndClass = isActive && !classBusy && !showConfirm;

  const BtnBase = {
    flex:1, padding:"11px 8px", borderRadius:12,
    fontWeight:900, fontSize:13, border:"none",
    transition:"all 0.2s", cursor:"default",
  };

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background:"rgba(15,23,42,0.6)" }}>

      {milestoneQueue.length > 0 && (
        <ArrowMilestonePopup
          milestones={milestoneQueue.map(q => q.ms)}
          rewardsList={milestoneQueue.map(q => q.rewards)}
          onAllClose={() => setMilestoneQueue([])} />
      )}

      {/* 今日箭數（任何狀態都顯示，讓射手即時看到累積進度） */}
      {todayArrows > 0 && !showConfirm && (
        <div style={{
          background: "rgba(59,130,246,0.08)",
          border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: 10, padding: "7px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>🏹 今日已射</span>
          <span style={{ color: "#60a5fa", fontWeight: 900, fontSize: 15 }}>{todayArrows} 箭</span>
          {isEnded && <span style={{ color: "#4ade80", fontSize: 10, fontWeight: 700 }}>已結算</span>}
        </div>
      )}

      {/* 兩按鈕並排 */}
      <div style={{ display:"flex", gap:8 }}>
        <button
          onClick={!ciDisabled ? handleCheckin : undefined}
          style={{ ...BtnBase, background:ciBg, color:ciColor,
            cursor: ciDisabled ? "default" : "pointer",
            opacity: submitBusy ? 0.55 : 1 }}>
          {ciLabel}
        </button>
        <button
          onClick={canEndClass ? () => setShowConfirm(true) : undefined}
          style={{ ...BtnBase,
            background: canEndClass ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "#1e293b",
            color: canEndClass ? "white" : "#64748b",
            cursor: canEndClass ? "pointer" : "default",
            opacity: classBusy ? 0.5 : 1 }}>
          {classBusy ? "處理中…" : "🏁 下課"}
        </button>
      </div>

      {/* 狀態訊息 */}
      {(justSubmitted || isPending) && (
        <div style={{ color:"#fbbf24", fontSize:12, fontWeight:700, textAlign:"center" }}>
          📣 已報到！請告知教練進行審核
        </div>
      )}
      {isRejected && !justSubmitted && (
        <div style={{ color:"#fb923c", fontSize:12, fontWeight:700, textAlign:"center" }}>
          ⚠️ 教練拒絕了報到，可點擊按鈕重新報到
        </div>
      )}

      {/* 下課確認（含里程碑全覽板） */}
      {showConfirm && (
        <div style={{ paddingTop:12, borderTop:"1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color:"rgba(255,255,255,0.85)", fontSize:14, fontWeight:700, textAlign:"center", marginBottom:4 }}>
            確定下課嗎？
          </div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, textAlign:"center", marginBottom:4 }}>
            今日 {todayArrows} 箭的箭露將立即結算
          </div>

          {/* 里程碑全覽板 */}
          <MilestoneBoard todayArrows={todayArrows} />

          <div style={{ display:"flex", gap:8, marginTop:12 }}>
            <button onClick={() => setShowConfirm(false)}
              style={{ flex:1, padding:"8px", borderRadius:10, background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.6)", fontSize:13, border:"none", cursor:"pointer" }}>
              取消
            </button>
            <button onClick={confirmClassEnd} disabled={classBusy}
              style={{ flex:1, padding:"8px", borderRadius:10, background:"#2563eb", color:"white", fontWeight:900, fontSize:13, border:"none", cursor:"pointer", opacity: classBusy ? 0.5 : 1 }}>
              確認下課
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
