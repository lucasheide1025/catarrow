// src/components/member/DailyQuest.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeMyCheckin, submitCheckin, approveCheckin, submitClassEnd, retryClassEndShopRushAward, addArrowdew,
  grantArrowMilestoneRewards, checkAndGrantArrowMilestones, subscribeLocalTodayArrows, initializeTodayArrows,
  submitMonthlyCardRequest, subscribeMyMonthlyRequests,
} from "../../lib/db";
import { getRewardsForMilestone } from "../../lib/arrowMilestone";
import { sfxSuccess, sfxTap } from "../../lib/sound";
import ArrowMilestonePopup from "./ArrowMilestonePopup";
import ClassEndSettlementModal from "./ClassEndSettlementModal";

export default function DailyQuest({ onJoinParty }) {
  const { profile } = useAuth();
  const [checkin,        setCheckin]        = useState(undefined);
  const [submitBusy,     setSubmitBusy]     = useState(false);
  const [justSubmitted,  setJustSubmitted]  = useState(false);
  const [classBusy,      setClassBusy]      = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [todayArrows,    setTodayArrows]    = useState(0);
  const [milestoneQueue, setMilestoneQueue] = useState([]);
  const [rushToast,       setRushToast]       = useState("");

  const [monthlyReqs,    setMonthlyReqs]    = useState([]);

  const monthlyCard = profile?.monthlyCard;

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeMyCheckin(profile.id, setCheckin);
    return () => unsub?.();
  }, [profile?.id]);

  // 下課已落盤但箭數 flush／旺季 claim 曾離線失敗時，重開本頁會依
  // durable arrow queue + shop checkpoint 安全重試；成功重放不會再次發放。
  useEffect(() => {
    if (!profile?.id || !checkin?.classEnded) return;
    retryClassEndShopRushAward(profile.id).catch(error => {
      console.warn("retryClassEndShopRushAward:", error?.message);
    });
  }, [profile?.id, checkin?.classEnded]);

  useEffect(() => {
    initializeTodayArrows(profile?.id).catch(() => {});
    return subscribeLocalTodayArrows(profile?.id, setTodayArrows);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) { setMonthlyReqs([]); return undefined; }
    return subscribeMyMonthlyRequests(profile.id, setMonthlyReqs);
  }, [profile?.id]);

  async function handleCheckin() {
    if (!profile?.id || submitBusy) return;
    setSubmitBusy(true);
    try {
      const { id } = await submitCheckin(profile.id, profile.name, profile.nickname);
      if (profile.isAdmin) {
        await approveCheckin(id, profile.id).catch(() => {});
      }
      sfxTap();
      setJustSubmitted(true);
    } catch (e) { console.warn("checkin:", e?.message); }
    setSubmitBusy(false);
  }

  async function confirmClassEnd(monthlyCardHours = 0) {
    if (classBusy) return;
    setClassBusy(true);
    try {
      if (monthlyCardHours > 0) {
        const request = await submitMonthlyCardRequest(
          profile.id,
          profile.nickname || profile.name || "射手",
          monthlyCardHours,
          monthlyCard,
          monthlyReqs.some(r => r.status === "pending"),
        );
        if (!request?.ok) {
          window.alert(request?.reason || "月卡扣抵申請送出失敗。");
          setClassBusy(false);
          return;
        }
      }

      const classEnd = await submitClassEnd(profile.id, checkin.id);
      sfxSuccess();
      setShowConfirm(false);
      try {
        const rush = classEnd?.rushAward;
        if ((rush?.awardedSeconds || 0) > 0) {
          const minutes = Math.floor(rush.awardedSeconds / 60);
          const seconds = rush.awardedSeconds % 60;
          const duration = [minutes > 0 ? `${minutes} 分鐘` : "", seconds > 0 ? `${seconds} 秒` : ""]
            .filter(Boolean).join(" ");
          setRushToast(`🏪 商店旺季時間 +${duration}`);
          setTimeout(() => setRushToast(""), 4000);
        }
      } catch (e) { console.warn("claimVillageShopRushTime:", e?.message); }
      if (todayArrows > 0) {
        addArrowdew(profile.id, todayArrows).catch(() => {});
        checkAndGrantArrowMilestones(profile.id, todayArrows).then(res => {
          if (res.milestones.length > 0) {
            setMilestoneQueue(res.milestones.map(ms => ({ ms, rewards: getRewardsForMilestone(ms) })));
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn("confirmClassEnd:", e?.message);
      window.alert("下課結算失敗，請稍後再試。");
    }
    setClassBusy(false);
  }

  const status     = checkin?.status;
  const isActive   = status === "active" && !checkin?.classEnded;
  const isEnded    = !!checkin?.classEnded;
  const isPending  = status === "pending";
  const isRejected = status === "rejected";
  const noCheckin  = !checkin || status === "cancelled";

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

      <ClassEndSettlementModal
        open={showConfirm}
        todayArrows={todayArrows}
        monthlyCard={monthlyCard || null}
        hasPending={monthlyReqs.some(r => r.status === "pending")}
        busy={classBusy}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmClassEnd}
      />
      {rushToast && (
        <div role="status" aria-live="polite" style={{
          position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)",
          zIndex: 230, maxWidth: "90vw", padding: "10px 16px", borderRadius: 16,
          background: "rgba(0,0,0,0.88)", border: "1px solid rgba(251,191,36,0.45)",
          color: "#fef3c7", fontSize: 14, fontWeight: 900, textAlign: "center",
        }}>
          {rushToast}
        </div>
      )}
    </div>
  );
}
