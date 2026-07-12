// src/components/booking/ParticipantCountPicker.jsx
// 人數選擇（07-10-booking-ui-polish-headcount）：選N人＝這筆預約會在同一時段原子性佔用N個靶位
// （不是備註欄位），塞不塞得下由 DateSlotPicker 依這裡選的人數逐格判斷、動態灰階不可選的時段，
// 這個元件本身只是單純的 1~LANE_CAPACITY 步進器，不重複做容量判斷。
import { LANE_CAPACITY } from "../../lib/bookingDb";

export default function ParticipantCountPicker({ value, onChange }) {
  const options = Array.from({ length: LANE_CAPACITY }, (_, i) => i + 1);
  return (
    <div>
      <div className="text-slate-400 text-xs font-bold mb-1.5">人數</div>
      <div className="flex gap-1.5 flex-wrap">
        {options.map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`w-9 h-9 rounded-lg border text-sm font-bold transition-colors ${
              n === value ? "border-blue-500 bg-blue-500/10 text-blue-300" : "border-white/10 bg-white/5 text-slate-300 hover:border-blue-400"
            }`}>
            {n}
          </button>
        ))}
      </div>
      <div className="text-slate-500 text-[11px] mt-1">選的人數會一起佔用對應數量的靶位，若某時段名額不夠會直接灰階不可選</div>
    </div>
  );
}
