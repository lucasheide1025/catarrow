// src/components/admin/AdminBookingAlert.jsx
// 教練後台頂部橫幅（Part A · in-system 通知）：
//   ① 🆕 自「上次查看」以來的新預約數——登入後台就明確知道有新客預約。
//   ② ⏰ 未來一小時內開始的預約——沒有就不顯示（對應「若無則不用通知」）。
// 音效：新預約與下一小時用「不同且加大音量」的專用提示音，每 12 秒重複提醒，
//       直到教練點該橫幅「查看/閱讀」為止（除非又有更新的預約才會再次響起）。
//
// 自給自足小元件：自己抓資料（reuse bookingDb.getBookingsForDateRange，唯讀）＋純前端計算＋
// lastSeen 存 localStorage，不動 AdminBooking.jsx / bookingDb.js。系統外通知（LINE/推播=Part B）另做。
import { useState, useEffect, useCallback, useRef } from "react";
import { getBookingsForDateRange } from "../../lib/bookingDb";
import { todayStr, addDays } from "../../lib/bookingSchedule";
import { sfxNewBookingAlert, sfxNextHourAlert } from "../../lib/sound";

const LS_KEY = "adminBookingAlert_lastSeenMs";

function hmToMin(hm) {
  const [h, m] = (hm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function bookingCreatedMs(b) {
  const c = b?.createdAt;
  if (!c) return 0;
  if (typeof c.toMillis === "function") return c.toMillis();
  if (typeof c.seconds === "number") return c.seconds * 1000;
  return 0;
}

export default function AdminBookingAlert({ onGoBooking }) {
  const [newCount, setNewCount] = useState(0);
  const [nextHour, setNextHour] = useState([]);
  const [dismissedNew, setDismissedNew] = useState(false);
  const [dismissedNextHour, setDismissedNextHour] = useState(false);
  const prevNewCountRef = useRef(0);
  const prevNextHourKeyRef = useRef("");

  const load = useCallback(async () => {
    const res = await getBookingsForDateRange(todayStr(), addDays(todayStr(), 14));
    if (!res.ok) return;
    const confirmed = res.bookings.filter(b => b.status === "confirmed");

    // ① 新預約：createdAt 晚於 lastSeen。首次無基準 → 以「現在」建基準並持久化。
    let lastSeen = Number(localStorage.getItem(LS_KEY));
    if (!lastSeen) { lastSeen = Date.now(); localStorage.setItem(LS_KEY, String(lastSeen)); }
    const nc = confirmed.filter(b => bookingCreatedMs(b) > lastSeen).length;
    // 又有更新的預約進來 → 解除「已閱讀」讓提示音再次響起
    if (nc > prevNewCountRef.current) setDismissedNew(false);
    prevNewCountRef.current = nc;
    setNewCount(nc);

    // ② 未來一小時：今天、開始時間落在 [now, now+60min]
    const today = todayStr();
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const nh = confirmed
      .filter(b => b.date === today && (() => { const s = hmToMin(b.startTime); return s >= nowMin && s <= nowMin + 60; })())
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    const nhKey = nh.map(b => b.id).sort().join(",");
    if (nhKey && nhKey !== prevNextHourKeyRef.current) setDismissedNextHour(false);
    prevNextHourKeyRef.current = nhKey;
    setNextHour(nh);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000); // 每 5 分鐘重抓資料
    return () => clearInterval(t);
  }, [load]);

  // 提示音：有未閱讀的新預約/下一小時預約時，每 12 秒響一次（兩者用不同音效、錯開避免疊在一起）
  const soundNew = newCount > 0 && !dismissedNew;
  const soundNext = nextHour.length > 0 && !dismissedNextHour;
  useEffect(() => {
    if (!soundNew && !soundNext) return;
    const ring = () => {
      if (soundNew) sfxNewBookingAlert();
      if (soundNext) setTimeout(() => sfxNextHourAlert(), soundNew ? 700 : 0);
    };
    ring();
    const t = setInterval(ring, 12000);
    return () => clearInterval(t);
  }, [soundNew, soundNext]);

  function seeNew() {
    localStorage.setItem(LS_KEY, String(Date.now()));
    setNewCount(0);
    setDismissedNew(true);
    prevNewCountRef.current = 0;
    onGoBooking?.();
  }
  function seeNextHour() {
    setDismissedNextHour(true);
    onGoBooking?.();
  }

  const showNew = newCount > 0 && !dismissedNew;
  if (!showNew && nextHour.length === 0) return null;

  return (
    <>
      {showNew && (
        <button
          onClick={seeNew}
          style={{ width:"100%", background:"rgba(52,211,153,0.10)", borderBottom:"1px solid rgba(52,211,153,0.25)", padding:"10px 16px", display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", border:"none", textAlign:"left" }}>
          <span style={{ fontSize:"16px" }}>🆕</span>
          <span style={{ fontSize:"13px", color:"#34d399", fontWeight:"bold" }}>
            {newCount} 筆新預約（自上次查看後）
          </span>
          <span style={{ marginLeft:"auto", fontSize:"12px", color:"#10b981", fontWeight:"bold" }}>查看預約 →</span>
        </button>
      )}
      {nextHour.length > 0 && (
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
    </>
  );
}
