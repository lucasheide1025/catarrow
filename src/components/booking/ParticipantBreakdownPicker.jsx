import {
  BOOKING_DURATIONS,
  BOOKING_PLAN_TYPES,
  BOOKING_PRICES,
  bookingTotalPrice,
  participantTotal,
} from "../../lib/bookingPricing";

// 每張身分卡都要自己標出單價與小計。原本卡上只有人數，金額全部集中在下方的時數卡，
// 訪客得自己換算「換成優惠身分會差多少」；使用者反映這點，所以單價直接寫在卡上，
// 並隨選定時數即時更新。
const NOTES = {
  general: "不符優惠資格者適用",
  discount: "學生請帶學生證；敬老請帶身分證",
  // 磅數上限與禁用弓種要跟官網自備器材價目卡一致（website/index.html 等 6 處）
  own_equipment: "自備弓與箭矢，限 50 磅內；禁止複合弓與彈弓",
};

export default function ParticipantBreakdownPicker({ value, onChange, max = 8, durationHours = 1 }) {
  const total = participantTotal(value);
  const durationLabel = BOOKING_DURATIONS.find(d => d.value === durationHours)?.label
    || `${durationHours}小時`;

  function setCount(planId, next) {
    const count = Math.max(0, Math.min(max, Number(next) || 0));
    const candidate = { ...value, [planId]: count };
    if (participantTotal(candidate) <= max) onChange(candidate);
  }

  return (
    <fieldset className="booking-breakdown">
      <legend className="text-slate-400 text-xs font-bold mb-2">同行人數（可混合不同方案）</legend>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {BOOKING_PLAN_TYPES.map(plan => {
          const count = value?.[plan.id] || 0;
          const unitPrice = BOOKING_PRICES[plan.id]?.[durationHours] || 0;
          return (
            <div key={plan.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <label className="block text-sm font-bold text-white" htmlFor={`party-${plan.id}`}>{plan.label}</label>
              <p className="mt-0.5 mb-1">
                <span className="text-base font-black text-blue-300">NT$ {unitPrice}</span>
                <span className="text-[11px] text-slate-400 ml-1">／人・{durationLabel}</span>
              </p>
              <p className="text-[11px] text-slate-400 min-h-8 mb-2">{NOTES[plan.id]}</p>
              <div className="flex items-center justify-between gap-2">
                <button type="button" aria-label={`${plan.label}減少一人`}
                  onClick={() => setCount(plan.id, count - 1)}
                  className="w-9 h-9 rounded-lg border border-white/15 bg-white/5 text-white font-black">−</button>
                <input id={`party-${plan.id}`} type="number" inputMode="numeric" min="0" max={max}
                  value={count} onChange={event => setCount(plan.id, event.target.value)}
                  className="w-14 h-9 rounded-lg border border-white/15 bg-slate-950 text-white text-center font-black" />
                <button type="button" aria-label={`${plan.label}增加一人`} disabled={total >= max}
                  onClick={() => setCount(plan.id, count + 1)}
                  className="w-9 h-9 rounded-lg border border-white/15 bg-white/5 text-white font-black disabled:opacity-30">＋</button>
              </div>
              {/* 小計只在有人時出現，0 人時留空位避免整排 NT$0 的視覺雜訊 */}
              <p className="mt-1.5 text-[11px] font-bold text-center min-h-4">
                {count > 0 && <span className="text-slate-300">小計 NT$ {unitPrice * count}</span>}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2 flex-wrap">
        <span className={`text-xs font-bold ${total ? "text-blue-300" : "text-red-400"}`}>
          同行共 {total} 人（一般預約上限 {max} 人）
        </span>
        {total > 0 && (
          <span className="text-xs font-bold text-slate-300">
            合計 NT$ {bookingTotalPrice(value, durationHours)}
          </span>
        )}
      </div>
    </fieldset>
  );
}
