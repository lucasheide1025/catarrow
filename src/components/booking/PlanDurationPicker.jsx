// src/components/booking/PlanDurationPicker.jsx
// 方案類別 ＋ 時數 合併成單一選單（原本是兩個獨立下拉，使用者要求「放在一起」＋要看得到金額）。
// 三個入口（學生前台 MemberBooking／新生隱藏入口 PublicBookingApp／教練後台代建）共用同一個元件，
// 不各自重刻選單，確保三邊的方案清單與價格永遠一致（COMBINED_PLAN_OPTIONS 是唯一資料來源）。
import { COMBINED_PLAN_OPTIONS } from "../../lib/bookingSchedule";

export default function PlanDurationPicker({ planType, durationHours, onChange }) {
  return (
    <div>
      <div className="text-slate-400 text-xs font-bold mb-1.5">方案</div>
      <div className="grid grid-cols-1 gap-1.5">
        {COMBINED_PLAN_OPTIONS.map(opt => {
          const active = opt.planType === planType && opt.durationHours === durationHours;
          return (
            <button key={`${opt.planType}-${opt.durationHours}`} type="button"
              onClick={() => onChange({ planType: opt.planType, durationHours: opt.durationHours })}
              className={`flex items-center justify-between rounded-xl px-3 py-2 border text-left transition-colors ${
                active ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-white/5 hover:bg-white/[0.08]"
              }`}>
              <span className={`text-sm font-bold ${active ? "text-blue-300" : "text-slate-200"}`}>{opt.label}</span>
              <span className={`text-sm font-black ${active ? "text-blue-300" : "text-slate-400"}`}>NT$ {opt.price}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
