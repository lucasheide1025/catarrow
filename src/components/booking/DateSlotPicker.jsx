// src/components/booking/DateSlotPicker.jsx
// 共用日期＋時段選擇器（07-10-booking-system-student-pilot ＋ 07-10-booking-multihour-and-stats）
// 學生前台（MemberBooking）／新生隱藏入口（PublicBookingApp）／教練後台代建 共用同一套 UI，
// 只負責「選出一個 {date,startTime,endTime}」，實際送出預約一律由呼叫端呼叫 bookingDb.js。
//
// durationHours（1|3，預設 1）：3 小時方案要連續佔用 3 個時段格，這裡負責：
// (a) 只列出「起點 + durationHours 小時」還在營業時間內（22:00 打烊）的起始時間；
// (b) 每個按鈕的可選/額滿狀態要連同延伸出去的格子一起檢查（slotState 內部處理）；
// (c) 選中後算出正確的 endTime（computeEndTime），不是永遠 +1 小時。
import { useState, useEffect, useMemo } from "react";
import { slotsForDate, isBusinessDay, todayStr, addDays, addOneMonth, fetchSlotCountsForRange, slotState, computeEndTime, durationLabel } from "../../lib/bookingSchedule";

const DOW_LABEL = ["日", "一", "二", "三", "四", "五", "六"];
const CLOSING_HOUR = 22; // 全站營業時間固定 22:00 打烊（bookingSchedule.js slotsForDate 既有假設）

export default function DateSlotPicker({ selected, onSelect, daysAhead = 14, durationHours = 1, participantCount = 1, availabilityDisplay = "detailed", bookingWindow = "default" }) {
  const [pageStart, setPageStart] = useState(0);
  const days = useMemo(() => {
    const base = todayStr();
    const maxDate = bookingWindow === "public-month" ? addOneMonth(base) : addDays(base, daysAhead - 1);
    const length = bookingWindow === "public-month"
      ? Math.floor((new Date(maxDate + "T00:00:00+08:00") - new Date(base + "T00:00:00+08:00")) / 86400000) + 1
      : daysAhead;
    return Array.from({ length }).map((_, i) => {
      const dateStr = addDays(base, i);
      const dow = new Date(dateStr + "T00:00:00+08:00").getDay();
      return { dateStr, dow, business: isBusinessDay(dateStr) };
    });
  }, [daysAhead, bookingWindow]);

  const visibleDays = bookingWindow === "public-month" ? days.slice(pageStart, pageStart + 7) : days;

  const [date, setDate] = useState(() => selected?.date || days.find(d => d.business)?.dateStr || days[0].dateStr);
  const [slotCounts, setSlotCounts] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSlotCountsForRange(date, date).then(m => {
      if (!cancelled) { setSlotCounts(m); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [date]);

  // 3 小時方案：起點 + durationHours 必須還在打烊時間（22:00）之前結束，否則這個起點根本不成立
  const slots = slotsForDate(date).filter(s => parseInt(s.startTime, 10) + durationHours <= CLOSING_HOUR);

  return (
    <div className="flex flex-col gap-3">
      {bookingWindow === "public-month" && (
        <div className="flex items-center justify-between gap-3">
          <button type="button" disabled={pageStart === 0} onClick={() => { const next = Math.max(0, pageStart - 7); setPageStart(next); setDate(days.slice(next, next + 7).find(d => d.business)?.dateStr || days[next].dateStr); }}
            className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-slate-200 disabled:cursor-not-allowed disabled:opacity-30">← 前 7 天</button>
          <span className="text-xs font-semibold text-slate-400">僅開放一個月內預約</span>
          <button type="button" disabled={pageStart + 7 >= days.length} onClick={() => { const next = Math.min(Math.max(0, days.length - 7), pageStart + 7); setPageStart(next); setDate(days.slice(next, next + 7).find(d => d.business)?.dateStr || days[next].dateStr); }}
            className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-slate-200 disabled:cursor-not-allowed disabled:opacity-30">後 7 天 →</button>
        </div>
      )}
      <div className="grid grid-cols-7 gap-1.5 pb-1">
        {visibleDays.map(d => (
          <button key={d.dateStr} type="button" disabled={!d.business}
            title={d.business ? "" : "公休（週一）"}
            onClick={() => setDate(d.dateStr)}
            className={`min-w-0 min-h-14 flex flex-col items-center justify-center rounded-xl px-1 py-2 text-xs font-bold border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300
              ${date === d.dateStr
                ? "bg-blue-600 border-blue-500 text-white"
                : d.business
                  ? "bg-white/10 border-white/15 text-slate-200 hover:border-blue-400"
                  : "bg-white/5 border-white/5 text-slate-600 cursor-not-allowed"}`}>
            <span>{d.dateStr.slice(5)}</span>
            <span>{d.business ? `週${DOW_LABEL[d.dow]}` : "公休"}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-400 text-sm py-6">載入時段中…</div>
      ) : slots.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">當天公休，請選其他日期</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {slots.map(s => {
            const st = slotState(date, s.startTime, slotCounts, durationHours, participantCount);
            const publicLabel = st.disabled ? (st.state === "full" ? "已額滿" : "不可預約") : "可預約";
            const stateLabel = availabilityDisplay === "public" ? publicLabel : st.label;
            const isSel = selected?.date === date && selected?.startTime === s.startTime;
            return (
              <button key={s.startTime} type="button" disabled={st.disabled} title={stateLabel}
                onClick={() => onSelect({ date, startTime: s.startTime, endTime: computeEndTime(s.startTime, durationHours) })}
                className={`min-h-16 rounded-xl px-2 py-2.5 text-xs font-bold border flex flex-col items-center gap-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300
                  ${isSel
                    ? "bg-blue-600 border-blue-500 text-white"
                    : st.disabled
                      ? "bg-white/5 border-white/5 text-slate-600 cursor-not-allowed"
                      : "bg-white/10 border-white/15 text-slate-200 hover:border-blue-400"}`}>
                <span>{s.startTime}－{computeEndTime(s.startTime, durationHours)}</span>
                <span className="text-[10px] opacity-80 leading-tight text-center">{durationLabel(durationHours)}・{stateLabel}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
