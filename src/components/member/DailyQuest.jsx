// src/components/member/DailyQuest.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeMyCheckin, submitCheckin, submitClassEnd, addArrowdew,
  grantArrowMilestoneRewards, subscribePracticeLogs,
} from "../../lib/db";
import { getMilestonesReached, getRewardsForMilestone } from "../../lib/arrowMilestone";
import { sfxSuccess, sfxTap } from "../../lib/sound";
import ArrowMilestonePopup from "./ArrowMilestonePopup";

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
    const unsub = subscribePracticeLogs(profile.id, logs => {
      const DIRECT_SOURCES = ["party", "duel", "dungeon"];
      const count = logs
        .filter(l => l.date === todayStr && !DIRECT_SOURCES.includes(l.source))
        .reduce((s, l) => s + (l.totalArrows ?? (Array.isArray(l.rounds) ? l.rounds.flat().length : 0)), 0);
      setTodayArrows(count);
    });
    return () => unsub?.();
  }, [profile?.id]); // eslint-disable-line

  async function handleCheckin() {
    if (!profile?.id || submitBusy) return;
    setSubmitBusy(true);
    try {
      await submitCheckin(profile.id, profile.name, profile.nickname);
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
    ciLabel = "❌ 未通過"; ciBg = "#450a0a"; ciColor = "#f87171"; ciDisabled = true;
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
      {isActive && (
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, textAlign:"center" }}>
          上課中 · 今日已射 {todayArrows} 箭
        </div>
      )}
      {isEnded && (
        <div style={{ color:"#4ade80", fontSize:12, fontWeight:700, textAlign:"center" }}>
          ✅ 今日已下課 · 箭露已結算（{todayArrows} 箭）
        </div>
      )}
      {isRejected && (
        <div style={{ color:"#f87171", fontSize:12, fontWeight:700, textAlign:"center" }}>
          ❌ 今日報到未通過，請詢問教練
        </div>
      )}

      {/* 下課確認 */}
      {showConfirm && (
        <div style={{ paddingTop:12, borderTop:"1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color:"rgba(255,255,255,0.7)", fontSize:13, marginBottom:12 }}>
            確定要下課嗎？今日 {todayArrows} 箭的箭露將立即結算。
          </div>
          <div style={{ display:"flex", gap:8 }}>
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
