// src/components/booking/DateSlotPicker.jsx
// 共用日期＋時段選擇器（07-10-booking-system-student-pilot）
// 學生前台（MemberBooking）／新生隱藏入口（PublicBookingApp）／教練後台代建 共用同一套 UI，
// 只負責「選出一個 {date,startTime,endTime}」，實際送出預約一律由呼叫端呼叫 bookingDb.js。
import { useState, useEffect, useMemo } from "react";
import { slotsForDate, isBusinessDay, todayStr, addDays, fetchSlotCountsForRange, slotState } from "../../lib/bookingSchedule";

const DOW_LABEL = ["日", "一", "二", "三", "四", "五", "六"];

export default function DateSlotPicker({ selected, onSelect, daysAhead = 14 }) {
  const days = useMemo(() => {
    const base = todayStr();
    return Array.from({ length: daysAhead }).map((_, i) => {
      const dateStr = addDays(base, i);
      const dow = new Date(dateStr + "T00:00:00+08:00").getDay();
      return { dateStr, dow, business: isBusinessDay(dateStr) };
    });
  }, [daysAhead]);

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

  const slots = slotsForDate(date);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map(d => (
          <button key={d.dateStr} type="button" disabled={!d.business}
            title={d.business ? "" : "公休（週一）"}
            onClick={() => setDate(d.dateStr)}
            className={`flex-shrink-0 flex flex-col items-center rounded-xl px-3 py-2 text-xs font-bold border transition-colors
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
            const st = slotState(date, s.startTime, slotCounts);
            const isSel = selected?.date === date && selected?.startTime === s.startTime;
            return (
              <button key={s.startTime} type="button" disabled={st.disabled} title={st.label}
                onClick={() => onSelect({ date, startTime: s.startTime, endTime: s.endTime })}
                className={`rounded-xl px-2 py-2.5 text-xs font-bold border flex flex-col items-center gap-0.5 transition-colors
                  ${isSel
                    ? "bg-blue-600 border-blue-500 text-white"
                    : st.disabled
                      ? "bg-white/5 border-white/5 text-slate-600 cursor-not-allowed"
                      : "bg-white/10 border-white/15 text-slate-200 hover:border-blue-400"}`}>
                <span>{s.startTime}</span>
                <span className="text-[10px] opacity-80">{st.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
