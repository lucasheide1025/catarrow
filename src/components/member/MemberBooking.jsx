// src/components/member/MemberBooking.jsx — 學生前台「線上約課」分頁（07-10-booking-system-student-pilot）
// 只在 profile?.bookingBetaAccess===true || role==="admin" 時才會被 MemberApp.jsx / AdminApp.jsx
// 的射手模式渲染入口（design.md §4.1），這個元件本身不重複做這層判斷。
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { createBooking, cancelBooking, rescheduleBooking, getBookingsForMember } from "../../lib/bookingDb";
import { PLAN_TYPES, DURATION_OPTIONS } from "../../lib/bookingSchedule";
import DateSlotPicker from "../booking/DateSlotPicker";
import { Card, Btn, Sel, Modal, Spinner, Empty, ConfirmModal, useToast } from "../shared/UI";

export default function MemberBooking() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [tab, setTab] = useState("new"); // "new" | "mine"

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [planType, setPlanType] = useState("general");
  const [durationHours, setDurationHours] = useState(1);
  // bookingStats.totalBookings 是 0（或還沒有這個欄位）時預設勾選「第一次來體驗」，使用者仍可自己改
  const [isNewStudent, setIsNewStudent] = useState(() => !(profile?.bookingStats?.totalBookings > 0));
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const [bookings, setBookings] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  const loadBookings = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingList(true);
    const res = await getBookingsForMember(profile.id);
    setBookings(res.ok ? res.bookings.filter(b => b.status === "confirmed") : []);
    setLoadingList(false);
  }, [profile?.id]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  async function handleSubmit() {
    if (!selectedSlot) { setErr("請先選擇時段"); return; }
    setErr("");
    setSubmitting(true);
    const res = await createBooking(
      profile.id, profile.nickname || profile.name,
      { email: profile.email || "", phone: profile.phone || "" },
      planType, durationHours, isNewStudent,
      selectedSlot.date, selectedSlot.startTime, selectedSlot.endTime,
      "online",
    );
    setSubmitting(false);
    if (!res.ok) { setErr(res.reason || "預約失敗，請稍後再試"); return; }
    toast("預約成功 ✓");
    setSelectedSlot(null);
    await loadBookings();
    setTab("mine");
  }

  async function handleCancel(id) {
    const res = await cancelBooking(id);
    setCancelTarget(null);
    if (!res.ok) { toast(res.reason || "取消失敗", "error"); return; }
    toast("已取消 ✓");
    loadBookings();
  }

  async function handleReschedule(newSlot) {
    if (!rescheduleTarget) return;
    const res = await rescheduleBooking(rescheduleTarget.id, newSlot.date, newSlot.startTime, newSlot.endTime);
    if (!res.ok) { toast(res.reason || "改期失敗", "error"); return; }
    toast("改期成功 ✓");
    setRescheduleTarget(null);
    loadBookings();
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <h2 className="text-white font-black text-xl">📅 線上約課</h2>

      <div className="flex gap-2">
        <Btn v={tab === "new" ? "primary" : "secondary"} size="sm" className="flex-1" onClick={() => setTab("new")}>新增預約</Btn>
        <Btn v={tab === "mine" ? "primary" : "secondary"} size="sm" className="flex-1" onClick={() => setTab("mine")}>
          我的預約{bookings.length ? `（${bookings.length}）` : ""}
        </Btn>
      </div>

      {tab === "new" && (
        <Card className="p-4 flex flex-col gap-4">
          <Sel label="時數" value={durationHours}
            onChange={e => { setDurationHours(Number(e.target.value)); setSelectedSlot(null); }}
            options={DURATION_OPTIONS.map(d => ({ value: d.value, label: d.label }))} />
          <DateSlotPicker selected={selectedSlot} onSelect={s => { setSelectedSlot(s); setErr(""); }} durationHours={durationHours} />
          <Sel label="方案類別" value={planType} onChange={e => setPlanType(e.target.value)}
            options={PLAN_TYPES.map(p => ({ value: p.id, label: p.label }))} />
          <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
            <input type="checkbox" checked={isNewStudent} onChange={e => setIsNewStudent(e.target.checked)}
              className="accent-blue-500 w-4 h-4" />
            是否為第一次來體驗
          </label>
          {selectedSlot && (
            <div className="text-slate-300 text-sm bg-white/5 rounded-xl px-3 py-2">
              已選擇：{selectedSlot.date}　{selectedSlot.startTime}-{selectedSlot.endTime}
            </div>
          )}
          {err && <div className="text-red-400 text-sm">{err}</div>}
          <Btn v="primary" onClick={handleSubmit} disabled={submitting || !selectedSlot}>
            {submitting ? "送出中…" : "確認預約"}
          </Btn>
        </Card>
      )}

      {tab === "mine" && (
        loadingList ? <Spinner /> :
        bookings.length === 0 ? <Empty icon="📅" message="目前沒有預約" /> : (
          <div className="flex flex-col gap-2">
            {bookings.slice()
              .sort((a, b) => `${a.date}_${a.startTime}`.localeCompare(`${b.date}_${b.startTime}`))
              .map(b => (
                <Card key={b.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-white font-bold text-sm">{b.date}　{b.startTime}-{b.endTime}</div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      {PLAN_TYPES.find(p => p.id === b.planType)?.label || b.planType}
                      ・{b.durationHours === 3 ? "3小時（2送1）" : "1小時"}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Btn v="secondary" size="sm" onClick={() => setRescheduleTarget(b)}>改期</Btn>
                    <Btn v="danger" size="sm" onClick={() => setCancelTarget(b)}>取消</Btn>
                  </div>
                </Card>
              ))}
          </div>
        )
      )}

      <ConfirmModal open={!!cancelTarget} title="確認取消預約"
        message={cancelTarget ? `確定要取消 ${cancelTarget.date} ${cancelTarget.startTime} 的預約嗎？` : ""}
        onConfirm={() => handleCancel(cancelTarget.id)} onCancel={() => setCancelTarget(null)} />

      <Modal open={!!rescheduleTarget} onClose={() => setRescheduleTarget(null)} title="改期" wide>
        {rescheduleTarget && (
          <RescheduleForm booking={rescheduleTarget} onConfirm={handleReschedule} />
        )}
      </Modal>
    </div>
  );
}

function RescheduleForm({ booking, onConfirm }) {
  const [slot, setSlot] = useState(null);
  // 改期不開放連時數一起改（design.md §4），沿用原預約的 durationHours
  const durationHours = booking.durationHours || 1;
  return (
    <div className="flex flex-col gap-4">
      <div className="text-slate-400 text-xs">
        原時段：{booking.date} {booking.startTime}-{booking.endTime}（{durationHours === 3 ? "3小時（2送1）" : "1小時"}）
      </div>
      <DateSlotPicker selected={slot} onSelect={setSlot} durationHours={durationHours} />
      <Btn v="primary" disabled={!slot} onClick={() => onConfirm(slot)}>確認改期到此時段</Btn>
    </div>
  );
}
