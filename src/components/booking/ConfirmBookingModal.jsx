// src/components/booking/ConfirmBookingModal.jsx
// 選完時段後的「確認預約」畫面（07-10-booking-ui-polish-headcount）：使用者反映原本點時段格
// 就直接跳去註冊/登入、而且「已選擇」只顯示日期時間，看不到人數/方案/金額——這個元件把
// 完整資訊（日期時間/方案/時數/人數/總金額）攤開來給使用者按確認前先看清楚。
// 純顯示用元件，不呼叫 bookingDb.js，實際送出/下一步交給呼叫端的 onConfirm。
import { PLAN_TYPES, durationLabel, totalPrice } from "../../lib/bookingSchedule";
import { Modal, Btn } from "../shared/UI";

export default function ConfirmBookingModal({ slot, planType, durationHours, participantCount, onConfirm, onCancel, confirmLabel = "確認", busy = false }) {
  if (!slot) return null;
  const planLabel = PLAN_TYPES.find(p => p.id === planType)?.label || planType;
  const price = totalPrice(planType, durationHours, participantCount);

  return (
    <Modal open onClose={onCancel} title="確認預約時段">
      <div className="flex flex-col gap-3">
        <Row label="日期時間" value={`${slot.date}　${slot.startTime}-${slot.endTime}`} />
        <Row label="方案" value={`${planLabel}・${durationLabel(durationHours)}`} />
        <Row label="人數" value={`${participantCount} 人`} />
        <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 mt-1">
          <span className="text-slate-400 text-sm">總金額</span>
          <span className="text-white text-2xl font-black">NT$ {price}</span>
        </div>
        <div className="flex gap-2 mt-2">
          <Btn v="secondary" className="flex-1" onClick={onCancel} disabled={busy}>返回修改</Btn>
          <Btn v="primary" className="flex-1" onClick={onConfirm} disabled={busy}>{busy ? "處理中…" : confirmLabel}</Btn>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-white font-bold">{value}</span>
    </div>
  );
}
