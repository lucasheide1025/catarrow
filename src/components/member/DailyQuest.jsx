// src/components/member/DailyQuest.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeMyCheckin, submitClassEnd, addArrowdew,
  grantArrowMilestoneRewards, subscribePracticeLogs,
} from "../../lib/db";
import { getMilestonesReached, getRewardsForMilestone } from "../../lib/arrowMilestone";
import { sfxSuccess } from "../../lib/sound";
import ArrowMilestonePopup from "./ArrowMilestonePopup";

export default function DailyQuest() {
  const { profile } = useAuth();
  const [checkin, setCheckin] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [todayArrows, setTodayArrows] = useState(0);
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

  async function confirmClassEnd() {
    setShowConfirm(false);
    setBusy(true); sfxSuccess();
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
    setBusy(false);
  }

  if (checkin === undefined) {
    return <div style={{ color:"rgba(255,255,255,0.4)", fontSize:13, padding:"8px 0" }} className="animate-pulse">載入中…</div>;
  }

  const status = checkin?.status;

  if (!checkin || status === "cancelled") {
    return (
      <div className="rounded-2xl p-4" style={{ background:"rgba(15,23,42,0.6)" }}>
        <div style={{ color:"rgba(255,255,255,0.4)", fontSize:13 }}>今日尚未報到，請等待浮動視窗或重新整理頁面</div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="rounded-2xl p-4" style={{ background:"rgba(15,23,42,0.6)" }}>
        <div style={{ color:"#fbbf24", fontWeight:700, fontSize:14 }}>⏳ 等待教練審核中…</div>
        <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, marginTop:4 }}>教練確認後即可開始累積箭數與箭露</div>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="rounded-2xl p-4" style={{ background:"rgba(15,23,42,0.6)" }}>
        <div style={{ color:"#f87171", fontWeight:700, fontSize:14 }}>❌ 今日報到未通過</div>
        <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, marginTop:4 }}>請詢問教練</div>
      </div>
    );
  }

  if (checkin.classEnded) {
    return (
      <>
        {milestoneQueue.length > 0 && (
          <ArrowMilestonePopup
            milestones={milestoneQueue.map(q => q.ms)}
            rewardsList={milestoneQueue.map(q => q.rewards)}
            onAllClose={() => setMilestoneQueue([])} />
        )}
        <div className="rounded-2xl p-4" style={{ background:"rgba(15,23,42,0.6)" }}>
          <div style={{ color:"#4ade80", fontWeight:700, fontSize:14 }}>✅ 今日已下課</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, marginTop:4 }}>箭露已結算（{todayArrows} 箭），辛苦了！</div>
        </div>
      </>
    );
  }

  // status === "active"
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background:"rgba(15,23,42,0.6)" }}>
      {milestoneQueue.length > 0 && (
        <ArrowMilestonePopup
          milestones={milestoneQueue.map(q => q.ms)}
          rewardsList={milestoneQueue.map(q => q.rewards)}
          onAllClose={() => setMilestoneQueue([])} />
      )}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ color:"#4ade80", fontWeight:700, fontSize:14 }}>🎯 上課中</div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, marginTop:2 }}>今日已射 {todayArrows} 箭</div>
        </div>
        <button
          disabled={busy}
          onClick={() => setShowConfirm(true)}
          style={{ padding:"8px 16px", borderRadius:10, background:"#2563eb", color:"white", fontWeight:900, fontSize:12, border:"none", cursor:"pointer", opacity: busy ? 0.5 : 1 }}>
          {busy ? "處理中…" : "🏁 下課"}
        </button>
      </div>

      {showConfirm && (
        <div style={{ marginTop:8, paddingTop:12, borderTop:"1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color:"rgba(255,255,255,0.7)", fontSize:13, marginBottom:12 }}>
            確定要下課嗎？今日 {todayArrows} 箭的箭露將立即結算。
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setShowConfirm(false)}
              style={{ flex:1, padding:"8px", borderRadius:10, background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.6)", fontSize:13, border:"none", cursor:"pointer" }}>
              取消
            </button>
            <button onClick={confirmClassEnd} disabled={busy}
              style={{ flex:1, padding:"8px", borderRadius:10, background:"#2563eb", color:"white", fontWeight:900, fontSize:13, border:"none", cursor:"pointer", opacity: busy ? 0.5 : 1 }}>
              確認下課
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
