import { BOOKING_PLAN_TYPES, participantTotal } from "../../lib/bookingPricing";

const NOTES = {
  general: "一般成人",
  discount: "學生請帶學生證；敬老請帶身分證",
  own_equipment: "正式會員且經教練確認",
};

export default function ParticipantBreakdownPicker({ value, onChange, max = 8 }) {
  const total = participantTotal(value);

  function setCount(planId, next) {
    const count = Math.max(0, Math.min(max, Number(next) || 0));
    const candidate = { ...value, [planId]: count };
    if (participantTotal(candidate) <= max) onChange(candidate);
  }

  return (
    <fieldset className="booking-breakdown">
      <legend className="text-slate-400 text-xs font-bold mb-2">同行人數（可混合不同方案）</legend>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {BOOKING_PLAN_TYPES.map(plan => (
          <div key={plan.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <label className="block text-sm font-bold text-white mb-1" htmlFor={`party-${plan.id}`}>{plan.label}</label>
            <p className="text-[11px] text-slate-400 min-h-8 mb-2">{NOTES[plan.id]}</p>
            <div className="flex items-center justify-between gap-2">
              <button type="button" aria-label={`${plan.label}減少一人`}
                onClick={() => setCount(plan.id, (value?.[plan.id] || 0) - 1)}
                className="w-9 h-9 rounded-lg border border-white/15 bg-white/5 text-white font-black">−</button>
              <input id={`party-${plan.id}`} type="number" inputMode="numeric" min="0" max={max}
                value={value?.[plan.id] || 0} onChange={event => setCount(plan.id, event.target.value)}
                className="w-14 h-9 rounded-lg border border-white/15 bg-slate-950 text-white text-center font-black" />
              <button type="button" aria-label={`${plan.label}增加一人`} disabled={total >= max}
                onClick={() => setCount(plan.id, (value?.[plan.id] || 0) + 1)}
                className="w-9 h-9 rounded-lg border border-white/15 bg-white/5 text-white font-black disabled:opacity-30">＋</button>
            </div>
          </div>
        ))}
      </div>
      <p className={`mt-2 text-xs font-bold ${total ? "text-blue-300" : "text-red-400"}`}>
        同行共 {total} 人（一般預約上限 {max} 人）
      </p>
    </fieldset>
  );
}

