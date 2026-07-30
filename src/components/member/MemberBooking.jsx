// src/components/member/MemberBooking.jsx — 學生前台「線上約課」分頁（07-10-booking-system-student-pilot）
// 由 MemberApp.jsx 控制入口；目前已正式開放給所有已登入學生。
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { createBooking, cancelBooking, rescheduleBooking, getBookingsForMember, bookingHasStarted } from "../../lib/bookingDb";
import { PLAN_TYPES, durationLabel, totalPrice } from "../../lib/bookingSchedule";
import {
  bookingTotalPrice,
  defaultFirstTimeCount,
  legacyPlanTypeFor,
  normalizeParticipantBreakdown,
  participantBreakdownLabel,
  participantTotal,
} from "../../lib/bookingPricing";
import DateSlotPicker from "../booking/DateSlotPicker";
import PlanDurationPicker from "../booking/PlanDurationPicker";
import ParticipantBreakdownPicker from "../booking/ParticipantBreakdownPicker";
import ConfirmBookingModal from "../booking/ConfirmBookingModal";
import { Card, Btn, Modal, Spinner, Empty, ConfirmModal, useToast } from "../shared/UI";

export default function MemberBooking() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [tab, setTab] = useState("new"); // "new" | "mine"

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [durationHours, setDurationHours] = useState(1);
  const [participantBreakdown, setParticipantBreakdown] = useState({ general: 1, discount: 0, own_equipment: 0 });
  const participantCount = participantTotal(participantBreakdown);
  const planType = legacyPlanTypeFor(participantBreakdown);
  const [firstTimeCount, setFirstTimeCount] = useState(0);
  // 預設值：學籍會員本人幾乎都預約過 → 本人算回訪、其餘同行者算第一次來。教練仍可請學員自行修改。
  const [firstTimeTouched, setFirstTimeTouched] = useState(false);
  const hasBookedBefore = !!profile?.bookingStats?.firstBookingAt;
  useEffect(() => {
    if (firstTimeTouched) return;
    setFirstTimeCount(defaultFirstTimeCount(
      hasBookedBefore ? { firstBookingAt: true } : null,
      participantCount,
    ));
  }, [hasBookedBefore, participantCount, firstTimeTouched]);
  const [confirming, setConfirming] = useState(false); // 07-10-booking-ui-polish-headcount：選完時段先看確認畫面
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const [bookings, setBookings] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const loadBookings = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingList(true);
    const res = await getBookingsForMember(profile.id);
    setBookings(res.ok ? res.bookings.filter(b => ["confirmed", "completed"].includes(b.status)) : []);
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
      planType, durationHours, participantCount, firstTimeCount === participantCount,
      selectedSlot.date, selectedSlot.startTime, selectedSlot.endTime,
      "online", "", null, { participantBreakdown, firstTimeCount },
    );
    setSubmitting(false);
    if (!res.ok) { setErr(res.reason || "預約失敗，請稍後再試"); setConfirming(false); return; }
    toast("預約成功 ✓");
    setSelectedSlot(null);
    setConfirming(false);
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
          <ParticipantBreakdownPicker value={participantBreakdown} durationHours={durationHours}
            onChange={next => {
              const nextTotal = participantTotal(next);
              setParticipantBreakdown(next);
              setFirstTimeCount(current => Math.min(current, nextTotal));
              setSelectedSlot(null);
            }} />
          <PlanDurationPicker durationHours={durationHours} participantBreakdown={participantBreakdown}
            onChange={({ durationHours: dh }) => { setDurationHours(dh); setSelectedSlot(null); }} />
          <label className="text-slate-300 text-sm font-bold">
            同行中第一次來的人數
            <input type="number" inputMode="numeric" min="0" max={participantCount} value={firstTimeCount}
              onChange={event => {
                setFirstTimeTouched(true);
                setFirstTimeCount(Math.max(0, Math.min(participantCount, Number(event.target.value) || 0)));
              }}
              className="ml-3 w-16 rounded-lg border border-white/15 bg-slate-950 px-2 py-2 text-center text-white" />
            <span className="ml-2 text-xs text-slate-500">回訪 {participantCount - firstTimeCount} 人</span>
          </label>
          {participantBreakdown.discount > 0 && <p className="text-amber-300 text-xs">學生請帶學生證；敬老優惠請帶身分證，到場確認資格。</p>}
          <DateSlotPicker selected={selectedSlot} onSelect={s => { setSelectedSlot(s); setErr(""); setConfirming(true); }}
            durationHours={durationHours} participantCount={participantCount} />
          {err && <div className="text-red-400 text-sm">{err}</div>}
        </Card>
      )}

      {confirming && (
        <ConfirmBookingModal slot={selectedSlot} planType={planType} durationHours={durationHours}
          participantCount={participantCount} participantBreakdown={participantBreakdown} firstTimeCount={firstTimeCount} busy={submitting}
          onConfirm={handleSubmit}
          onCancel={() => { setConfirming(false); setSelectedSlot(null); }} />
      )}

      {tab === "mine" && (
        loadingList ? <Spinner /> :
        bookings.length === 0 ? <Empty icon="📅" message="目前沒有預約" /> : (
          <div className="flex flex-col gap-2">
            {bookings.slice()
              .sort((a, b) => `${a.date}_${a.startTime}`.localeCompare(`${b.date}_${b.startTime}`))
              .map(b => {
                const completed = b.status === "completed";
                const started = bookingHasStarted(b, now);
                return (
                <Card key={b.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-white font-bold text-sm">{b.date}　{b.startTime}-{b.endTime}</div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      {b.participantBreakdown
                        ? participantBreakdownLabel(normalizeParticipantBreakdown(b.participantBreakdown, b))
                        : (PLAN_TYPES.find(p => p.id === b.planType)?.label || b.planType)}
                      ・{durationLabel(b.durationHours || 1)}・{b.participantCount || 1}人
                      ・NT$ {b.participantBreakdown
                        ? bookingTotalPrice(normalizeParticipantBreakdown(b.participantBreakdown, b), b.durationHours || 1)
                        : totalPrice(b.planType, b.durationHours || 1, b.participantCount || 1)}
                    </div>
                    <div className={`text-xs mt-1 font-bold ${completed ? "text-emerald-400" : started ? "text-amber-400" : "text-blue-400"}`}>
                      {completed ? "✓ 已完成課程" : started ? "上課時間已到" : "已預約"}
                    </div>
                  </div>
                  {!completed && !started && <div className="flex gap-1.5 flex-shrink-0">
                    <Btn v="secondary" size="sm" onClick={() => setRescheduleTarget(b)}>改期</Btn>
                    <Btn v="danger" size="sm" onClick={() => setCancelTarget(b)}>取消</Btn>
                  </div>}
                </Card>
                );
              })}
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
  // 改期不開放連時數/人數一起改（design.md §4 ＋ 07-10-booking-ui-polish-headcount），沿用原預約的值
  const durationHours = booking.durationHours || 1;
  const participantCount = booking.participantCount || 1;
  return (
    <div className="flex flex-col gap-4">
      <div className="text-slate-400 text-xs">
        原時段：{booking.date} {booking.startTime}-{booking.endTime}（{durationLabel(durationHours)}・{participantCount}人）
      </div>
      <DateSlotPicker selected={slot} onSelect={setSlot} durationHours={durationHours} participantCount={participantCount} />
      <Btn v="primary" disabled={!slot} onClick={() => onConfirm(slot)}>確認改期到此時段</Btn>
    </div>
  );
}
