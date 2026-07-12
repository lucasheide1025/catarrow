// src/components/booking/PlanDurationPicker.jsx
// 方案類別 ＋ 時數 合併成單一選單（原本是兩個獨立下拉，使用者要求「放在一起」＋要看得到金額）。
// 三個入口（學生前台 MemberBooking／新生隱藏入口 PublicBookingApp／教練後台代建）共用同一個元件，
// 不各自重刻選單，確保三邊的方案清單與價格永遠一致（COMBINED_PLAN_OPTIONS 是唯一資料來源）。
import { COMBINED_PLAN_OPTIONS } from "../../lib/bookingSchedule";

// 並排小卡樣式（使用者反映原本的直向長條列表很難看）——每張卡片顯示方案名稱+金額，
// 選中要有明顯的視覺區別（邊框+底色），比照 BillingSystem.jsx/CheckoutModal 既有的卡片語言。
export default function PlanDurationPicker({ planType, durationHours, onChange }) {
  return (
    <div>
      <div className="text-slate-400 text-xs font-bold mb-1.5">方案</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {COMBINED_PLAN_OPTIONS.map(opt => {
          const active = opt.planType === planType && opt.durationHours === durationHours;
          return (
            <button key={`${opt.planType}-${opt.durationHours}`} type="button"
              onClick={() => onChange({ planType: opt.planType, durationHours: opt.durationHours })}
              className={`rounded-xl px-2.5 py-2.5 border text-center transition-colors flex flex-col items-center gap-0.5 ${
                active ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-white/5 hover:bg-white/[0.08]"
              }`}>
              <span className={`text-xs font-bold leading-tight ${active ? "text-blue-300" : "text-slate-200"}`}>{opt.label}</span>
              <span className={`text-sm font-black ${active ? "text-blue-300" : "text-slate-400"}`}>NT$ {opt.price}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
