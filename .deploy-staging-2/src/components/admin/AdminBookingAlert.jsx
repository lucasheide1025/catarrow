// src/components/admin/AdminBookingAlert.jsx
// 教練後台頂部橫幅（Part A · in-system 通知）：
//   ① 🆕 尚未看過的新預約——每筆直接列出「日期・時間・人數・方案」，一眼看到約了什麼時候。
//   ② ⏰ 未來一小時內開始的預約——沒有就不顯示（對應「若無則不用通知」）。
// 音效：新預約與下一小時用「不同且加大音量」的專用提示音，每 12 秒重複提醒，
//       直到教練點該橫幅為止（除非又有更新的預約才會再次響起）。
//
// 「看過了沒」統一走 src/lib/bookingSeen.js 的 seenIds（跟最新預約清單同一個真相來源），
// 不再各自用各自的 lastSeen 時間戳，避免橫幅與清單數字對不上。
// 點「查看預約 →」只停止提示音並跳到清單，不強制標記已看——留給教練在清單逐筆點過去看。
import { useState, useEffect, useCallback, useRef } from "react";
import { getRecentBookings, getBookingsForDateRange, getRecentCancellations } from "../../lib/bookingDb";
import { todayStr, PLAN_TYPES } from "../../lib/bookingSchedule";
import { seedIfFirstRun, getSeenSet, isUnseen, markSeen,
         seedCancelIfFirstRun, getCancelSeenSet, isCancelUnseen, markAllCancelSeen } from "../../lib/bookingSeen";
import { sfxNewBookingAlert, sfxNextHourAlert, sfxError } from "../../lib/sound";

function hmToMin(hm) {
  const [h, m] = (hm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function planLabel(b) {
  return PLAN_TYPES.find(p => p.id === b.planType)?.label || b.planType || "方案";
}
// 一筆新預約的一句話摘要：日期・時間・人數・方案
function bookingSummary(b) {
  const people = (b.participantCount || 1) > 1 ? `${b.participantCount}人` : "1人";
  return `${b.date} ${b.startTime}–${b.endTime}・${people}・${planLabel(b)}・${b.memberName || "顧客"}`;
}

export default function AdminBookingAlert({ onGoBooking }) {
  const [newBookings, setNewBookings] = useState([]);
  const [nextHour, setNextHour] = useState([]);
  const [cancelled, setCancelled] = useState([]);
  const [dismissedNew, setDismissedNew] = useState(false);
  const [dismissedNextHour, setDismissedNextHour] = useState(false);
  const [dismissedCancel, setDismissedCancel] = useState(false);
  const prevNewCountRef = useRef(0);
  const prevNextHourKeyRef = useRef("");
  const prevCancelCountRef = useRef(0);

  const load = useCallback(async () => {
    const [recentRes, todayRes, cancelRes] = await Promise.all([
      getRecentBookings(20),
      getBookingsForDateRange(todayStr(), todayStr()),
      getRecentCancellations(20),
    ]);

    // ① 新預約：最近建立的 confirmed 中，seenIds 尚未標記過的。首次啟用先把現有的全標已看當基準。
    if (recentRes.ok) {
      const recentConfirmed = recentRes.bookings.filter(b => b.status === "confirmed");
      seedIfFirstRun(recentConfirmed.map(b => b.id));
      const seen = getSeenSet();
      const unseen = recentConfirmed.filter(b => isUnseen(b.id, seen));
      // 又有更新的預約進來（未看數變多）→ 解除「已閱讀」讓提示音再次響起
      if (unseen.length > prevNewCountRef.current) setDismissedNew(false);
      prevNewCountRef.current = unseen.length;
      setNewBookings(unseen);
    }

    // ② 未來一小時：今天、開始時間落在 [now, now+60min]
    if (todayRes.ok) {
      const confirmedToday = todayRes.bookings.filter(b => b.status === "confirmed");
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const nh = confirmedToday
        .filter(b => { const s = hmToMin(b.startTime); return s >= nowMin && s <= nowMin + 60; })
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
      const nhKey = nh.map(b => b.id).sort().join(",");
      const persistedKey = localStorage.getItem("admin_booking_next_hour_read") || "";
      if (nhKey && nhKey !== prevNextHourKeyRef.current) setDismissedNextHour(nhKey === persistedKey);
      prevNextHourKeyRef.current = nhKey;
      setNextHour(nh);
    }

    // ③ 取消通知：最近被取消的，seenIds(取消專用) 尚未標記過的。首次啟用先把現有的全標已看當基準。
    if (cancelRes.ok) {
      seedCancelIfFirstRun(cancelRes.bookings.map(b => b.id));
      const seen = getCancelSeenSet();
      const unseen = cancelRes.bookings.filter(b => isCancelUnseen(b.id, seen));
      if (unseen.length > prevCancelCountRef.current) setDismissedCancel(false);
      prevCancelCountRef.current = unseen.length;
      setCancelled(unseen);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000); // 每 5 分鐘重抓資料
    return () => clearInterval(t);
  }, [load]);

  // 提示音：有未閱讀的新預約/下一小時/取消預約時，每 12 秒響一次（各用不同音效、錯開避免疊在一起）
  const soundNew = newBookings.length > 0 && !dismissedNew;
  const soundNext = nextHour.length > 0 && !dismissedNextHour;
  const soundCancel = cancelled.length > 0 && !dismissedCancel;
  useEffect(() => {
    if (!soundNew && !soundNext && !soundCancel) return;
    const ring = () => {
      if (soundNew) sfxNewBookingAlert();
      if (soundNext) setTimeout(() => sfxNextHourAlert(), soundNew ? 700 : 0);
      if (soundCancel) setTimeout(() => sfxError(), (soundNew ? 700 : 0) + (soundNext ? 700 : 0));
    };
    ring();
    const t = setInterval(ring, 12000);
    return () => clearInterval(t);
  }, [soundNew, soundNext, soundCancel]);

  function seeNew() {
    newBookings.forEach(b => markSeen(b.id));
    setNewBookings([]);
    setDismissedNew(true);
    onGoBooking?.();
  }
  function seeNextHour() {
    const key = nextHour.map(b => b.id).sort().join(",");
    localStorage.setItem("admin_booking_next_hour_read", key);
    setDismissedNextHour(true);
    onGoBooking?.();
  }
  function seeCancel() {
    markAllCancelSeen(cancelled.map(b => b.id));
    setCancelled([]);
    setDismissedCancel(true);
    onGoBooking?.();
  }

  const showNew = newBookings.length > 0 && !dismissedNew;
  const showNextHour = nextHour.length > 0 && !dismissedNextHour;
  const showCancel = cancelled.length > 0 && !dismissedCancel;
  if (!showNew && !showNextHour && !showCancel) return null;

  const shown = newBookings.slice(0, 4);
  const extra = newBookings.length - shown.length;
  const cancelShown = cancelled.slice(0, 4);
  const cancelExtra = cancelled.length - cancelShown.length;

  return (
    <>
      {showNew && (
        <button
          onClick={seeNew}
          style={{ width:"100%", background:"rgba(52,211,153,0.10)", borderBottom:"1px solid rgba(52,211,153,0.25)", padding:"10px 16px", display:"flex", alignItems:"flex-start", gap:"8px", cursor:"pointer", border:"none", textAlign:"left" }}>
          <span style={{ fontSize:"16px", lineHeight:"18px" }}>🆕</span>
          <span style={{ flex:1, minWidth:0 }}>
            <span style={{ display:"block", fontSize:"13px", color:"#34d399", fontWeight:"bold", marginBottom:"3px" }}>
              {newBookings.length} 筆新預約（尚未查看）
            </span>
            {shown.map(b => (
              <span key={b.id} style={{ display:"block", fontSize:"12px", color:"#a7f3d0", lineHeight:"17px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                • {bookingSummary(b)}
              </span>
            ))}
            {extra > 0 && (
              <span style={{ display:"block", fontSize:"12px", color:"#6ee7b7", lineHeight:"17px" }}>…等共 {newBookings.length} 筆</span>
            )}
          </span>
          <span style={{ fontSize:"12px", color:"#10b981", fontWeight:"bold", flexShrink:0, alignSelf:"center" }}>查看預約 →</span>
        </button>
      )}
      {showNextHour && (
        <button
          onClick={seeNextHour}
          style={{ width:"100%", background:"rgba(96,165,250,0.08)", borderBottom:"1px solid rgba(96,165,250,0.2)", padding:"10px 16px", display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", border:"none", textAlign:"left" }}>
          <span style={{ fontSize:"16px" }}>⏰</span>
          <span style={{ fontSize:"13px", color:"#60a5fa", fontWeight:"bold", minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            下一小時 {nextHour.length} 筆預約：
            {nextHour.map(b => `${b.startTime} ${b.memberName || "顧客"}${b.participantCount > 1 ? `×${b.participantCount}` : ""}`).join("、")}
          </span>
          <span style={{ marginLeft:"auto", fontSize:"12px", color:"#60a5fa", fontWeight:"bold", flexShrink:0 }}>行事曆 →</span>
        </button>
      )}
      {showCancel && (
        <button
          onClick={seeCancel}
          style={{ width:"100%", background:"rgba(248,113,113,0.10)", borderBottom:"1px solid rgba(248,113,113,0.25)", padding:"10px 16px", display:"flex", alignItems:"flex-start", gap:"8px", cursor:"pointer", border:"none", textAlign:"left" }}>
          <span style={{ fontSize:"16px", lineHeight:"18px" }}>❌</span>
          <span style={{ flex:1, minWidth:0 }}>
            <span style={{ display:"block", fontSize:"13px", color:"#f87171", fontWeight:"bold", marginBottom:"3px" }}>
              {cancelled.length} 筆預約已被取消
            </span>
            {cancelShown.map(b => (
              <span key={b.id} style={{ display:"block", fontSize:"12px", color:"#fecaca", lineHeight:"17px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                • {bookingSummary(b)}
              </span>
            ))}
            {cancelExtra > 0 && (
              <span style={{ display:"block", fontSize:"12px", color:"#fca5a5", lineHeight:"17px" }}>…等共 {cancelled.length} 筆</span>
            )}
          </span>
          <span style={{ fontSize:"12px", color:"#ef4444", fontWeight:"bold", flexShrink:0, alignSelf:"center" }}>知道了 →</span>
        </button>
      )}
    </>
  );
}
