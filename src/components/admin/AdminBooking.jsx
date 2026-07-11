// src/components/admin/AdminBooking.jsx — 教練後台「線上約課」（07-10-booking-system-student-pilot）
//
// 資料層一律呼叫 src/lib/bookingDb.js 既有函式（createBooking/cancelBooking/rescheduleBooking/
// blockSlot/unblockSlot/getBookingsForDateRange），不重新實作容量 transaction 邏輯。
// bookingBetaAccess／paymentMethod 這兩個欄位不在 bookingDb.js 的職責範圍內（前者是 members
// 文件欄位、後者是教練事後標記用的單欄位更新，都不需要 transaction），直接用 Firestore
// updateDoc 寫入，比照專案其他 admin 元件（AdminAchievements 等）已有的直接寫入慣例。
import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  createBooking, cancelBooking, rescheduleBooking, blockSlot, unblockSlot, setSlotRangeBlocked,
  completeBookingFromCheckin,
  bookingHasStarted,
  getBookingsForDateRange, getRecentBookings, LANE_CAPACITY,
} from "../../lib/bookingDb";
import { seedIfFirstRun, getSeenSet, isUnseen, markSeen, markAllSeen } from "../../lib/bookingSeen";
import {
  slotsForDate, isBusinessDay, todayStr, addDays, startOfWeek,
  fetchSlotCountsForRange, PLAN_TYPES, durationLabel, totalPrice, computeEndTime,
} from "../../lib/bookingSchedule";
import { getMembers, addBillingRecord, getRecentCheckinMembers } from "../../lib/db";
import { fmtDT } from "../../lib/constants";
import DateSlotPicker from "../booking/DateSlotPicker";
import PlanDurationPicker from "../booking/PlanDurationPicker";
import ParticipantCountPicker from "../booking/ParticipantCountPicker";
import { Card, Btn, Inp, Modal, Spinner, Empty, useToast } from "../shared/UI";
import { PLANS as BILLING_PLANS, PAY_METHODS, EARLY_BIRD_DISC } from "./BillingSystem";

const DOW_LABEL = ["日", "一", "二", "三", "四", "五", "六"];
const PAYMENT_LABEL = { cash: "💵 現金", transfer: "🏦 轉帳", monthly: "💳 月卡" };
// 行事曆格子空間有限，用短版方案名稱（教練後台直接顯示「誰＋什麼方案」用，不是給學生看的）
const PLAN_SHORT_LABEL = { general: "單人一般", discount: "兒童/學生/敬老", own_equipment: "自備器材" };
// 預約方案類別＋時數 → 會計系統既有方案代碼（見 BillingSystem.jsx 的 PLANS，價格沿用那邊，不重複定義）
const BOOKING_TO_BILLING_PLAN = {
  general:       { 1: "單一", 2: "單二", 3: "單三" },
  discount:      { 1: "學一", 2: "學二", 3: "學三" },
  own_equipment: { 1: "自一", 2: "自二", 3: "自三" },
};
const PAY_METHOD_CODE = { "現金": "cash", "轉帳": "transfer", "月卡": "monthly" };

const CALENDAR_HOURS = Array.from({ length:12 }, (_, i) => 10 + i);

function allocateDayLanes(bookings, date) {
  const occupied = Array.from({ length:LANE_CAPACITY }, () => new Set());
  const placements = [];
  bookings
    .filter(b => b.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id))
    .forEach(booking => {
      const startHour = Number(booking.startTime?.split(":")[0]);
      const duration = Math.max(1, booking.durationHours || 1);
      const hours = Array.from({ length:duration }, (_, i) => startHour + i);
      const freeLanes = occupied
        .map((hoursUsed, lane) => ({ hoursUsed, lane }))
        .filter(({ hoursUsed }) => hours.every(hour => !hoursUsed.has(hour)))
        .slice(0, Math.max(1, booking.participantCount || 1));
      freeLanes.forEach(({ hoursUsed, lane }, participantIndex) => {
        hours.forEach(hour => hoursUsed.add(hour));
        placements.push({ booking, lane, participantIndex, duration, startHour });
      });
    });
  return placements;
}

export default function AdminBooking() {
  const { toast, ToastContainer } = useToast();
  const [tab, setTab] = useState("calendar"); // "calendar" | "beta" | "report"

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <h2 className="text-white font-black text-xl">📅 線上約課</h2>
      <div className="flex gap-2">
        <Btn v={tab === "calendar" ? "primary" : "secondary"} size="sm" className="flex-1" onClick={() => setTab("calendar")}>行事曆</Btn>
        <Btn v={tab === "beta" ? "primary" : "secondary"} size="sm" className="flex-1" onClick={() => setTab("beta")}>名單註記</Btn>
        <Btn v={tab === "report" ? "primary" : "secondary"} size="sm" className="flex-1" onClick={() => setTab("report")}>收費報表</Btn>
      </div>
      {tab === "calendar" && <CalendarTab toast={toast} />}
      {tab === "beta"     && <BetaAccessTab toast={toast} />}
      {tab === "report"   && <ReportTab />}
    </div>
  );
}

// ─── 最新預約清單（前十筆，未看過的高亮 + 可點過去看）─────────
// 用 getRecentBookings（依 createdAt 由新到舊）抓最新十筆，直接寫清楚「約哪一天幾點・人數・方案」。
// 「看過了沒」走共用的 bookingSeen（跟頂部橫幅同一組 seenIds）：未看過整列琥珀色高亮 + 🆕，
// 點下去＝標記已看 + 跳到那天日曆並開該時段詳情。reloadTick 變動（新增/取消預約後）會自動重抓。
function RecentBookingsPanel({ reloadTick, onOpen }) {
  const [list, setList] = useState(null);
  const [seenVer, setSeenVer] = useState(0); // 標記已看後 +1 逼重新讀 seenIds 重繪高亮
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    const res = await getRecentBookings(20);
    if (!res.ok) { setList([]); return; }
    const confirmed = res.bookings.filter(b => ["confirmed", "completed"].includes(b.status));
    seedIfFirstRun(confirmed.map(b => b.id));
    setList(confirmed.slice(0, 10));
  }, []);
  useEffect(() => { load(); }, [load, reloadTick]);

  const seen = useMemo(() => getSeenSet(), [seenVer, list]);
  const items = list || [];
  const unseenCount = items.filter(b => isUnseen(b.id, seen)).length;

  function open(b) {
    markSeen(b.id);
    setSeenVer(v => v + 1);
    onOpen?.(b);
  }
  function allSeen() {
    markAllSeen(items.map(b => b.id));
    setSeenVer(v => v + 1);
  }

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-white font-black text-sm">🆕 最新預約</span>
          {unseenCount > 0 && (
            <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-400/30 rounded-full px-2 py-0.5">{unseenCount} 筆待看</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unseenCount > 0 && <Btn v="ghost" size="sm" onClick={allSeen}>全部已看</Btn>}
          <Btn v="ghost" size="sm" onClick={() => setCollapsed(c => !c)}>{collapsed ? "展開" : "收起"}</Btn>
        </div>
      </div>
      {!collapsed && (
        list === null ? <Spinner /> :
        items.length === 0 ? <div className="text-slate-500 text-xs py-2">目前沒有預約</div> :
        <div className="flex flex-col gap-1.5">
          {items.map(b => {
            const unseen = isUnseen(b.id, seen);
            const people = (b.participantCount || 1) > 1 ? `${b.participantCount}人` : "1人";
            return (
              <button key={b.id} type="button" onClick={() => open(b)}
                className={`w-full text-left rounded-lg px-3 py-2 border transition ${unseen
                  ? "border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/[0.15]"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                <div className="flex items-center gap-2">
                  {unseen && <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 rounded px-1.5 py-0.5 flex-shrink-0">🆕 新</span>}
                  <span className={`font-bold text-sm truncate ${unseen ? "text-amber-100" : "text-white"}`}>{b.memberName || "顧客"}</span>
                  {b.status === "completed" && <span className="text-emerald-400 text-[11px] flex-shrink-0 ml-auto">🏁 已完成</span>}
                </div>
                <div className="text-slate-300 text-xs mt-0.5">
                  📅 {b.date} {b.startTime}–{b.endTime}・{people}・{PLAN_TYPES.find(p => p.id === b.planType)?.label || b.planType}・{durationLabel(b.durationHours || 1)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── 行事曆檢視 ──────────────────────────────────────────────
function CalendarTab({ toast }) {
  const [viewMode, setViewMode] = useState("day"); // "week" | "day"
  const [anchor, setAnchor] = useState(todayStr());
  const [bookings, setBookings] = useState([]);
  const [slotCounts, setSlotCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [detailSlot, setDetailSlot] = useState(null); // { date, startTime, endTime }
  const [reloadTick, setReloadTick] = useState(0);
  const [rangeOpen, setRangeOpen] = useState(false);

  const range = useMemo(() => {
    if (viewMode === "day") return { start: anchor, end: anchor };
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 6) };
  }, [viewMode, anchor]);

  const days = useMemo(() => {
    const n = viewMode === "day" ? 1 : 7;
    return Array.from({ length: n }).map((_, i) => addDays(range.start, i));
  }, [range, viewMode]);

  const load = useCallback(async () => {
    setLoading(true);
    const [bRes, cMap] = await Promise.all([
      getBookingsForDateRange(range.start, range.end),
      fetchSlotCountsForRange(range.start, range.end),
    ]);
    setBookings(bRes.ok ? bRes.bookings.filter(b => ["confirmed", "completed"].includes(b.status)) : []);
    setSlotCounts(cMap);
    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load, reloadTick]);

  function refresh() { setReloadTick(t => t + 1); }

  // 每個 booking 可能橫跨多個時段格（3小時方案），要在它牽涉到的每一個 slotKey 底下都列出來，
  // 這樣不管點哪一格的詳情，都看得到「從更早時段跨進來、目前還在佔用中」的預約（design.md §4 的推廣）。
  // 向後相容：舊資料沒有 slotKeys 陣列時 fallback 成單數 slotKey。
  const bookingsBySlot = useMemo(() => {
    const m = {};
    bookings.forEach(b => {
      const keys = (b.slotKeys && b.slotKeys.length) ? b.slotKeys : [b.slotKey];
      keys.forEach(k => { (m[k] ||= []).push(b); });
    });
    return m;
  }, [bookings]);

  const dayPlacements = useMemo(() => allocateDayLanes(bookings, anchor), [bookings, anchor]);

  return (
    <div className="flex flex-col gap-3">
      <RecentBookingsPanel
        reloadTick={reloadTick}
        onOpen={(b) => {
          setViewMode("day");
          setAnchor(b.date);
          setDetailSlot({ date: b.date, startTime: b.startTime, endTime: computeEndTime(b.startTime, 1) });
        }}
      />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Btn v={viewMode === "week" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("week")}>週檢視</Btn>
          <Btn v={viewMode === "day" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("day")}>日檢視</Btn>
        </div>
        <div className="flex gap-2 items-center">
          <Btn v="warn" size="sm" onClick={() => setRangeOpen(true)}>批次關閉／開放</Btn>
          <Btn v="secondary" size="sm" onClick={() => setAnchor(a => addDays(a, viewMode === "day" ? -1 : -7))}>← 上一{viewMode === "day" ? "天" : "週"}</Btn>
          <Btn v="secondary" size="sm" onClick={() => setAnchor(todayStr())}>今天</Btn>
          <Btn v="secondary" size="sm" onClick={() => setAnchor(a => addDays(a, viewMode === "day" ? 1 : 7))}>下一{viewMode === "day" ? "天" : "週"} →</Btn>
        </div>
      </div>
      <div className="text-slate-400 text-xs">{range.start} ～ {range.end}</div>

      {loading ? <Spinner /> : viewMode === "day" ? (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/40">
          <div className="grid relative min-w-[680px]"
            style={{ gridTemplateColumns:`56px repeat(${LANE_CAPACITY}, minmax(72px, 1fr))`, gridTemplateRows:`32px repeat(${CALENDAR_HOURS.length}, 64px)` }}>
            <div className="border-b border-r border-white/10" />
            {Array.from({ length:LANE_CAPACITY }, (_, lane) => (
              <div key={`lane-head-${lane}`} className="border-b border-r border-white/10 text-center text-[11px] font-bold text-slate-400 py-2">
                靶位 {lane + 1}
              </div>
            ))}
            {CALENDAR_HOURS.map((hour, row) => {
              const startTime = `${String(hour).padStart(2, "0")}:00`;
              const valid = slotsForDate(anchor).some(slot => slot.startTime === startTime);
              const info = slotCounts[`${anchor}_${startTime}`] || {};
              return (
                <Fragment key={`day-row-${hour}`}>
                  <div className="border-b border-r border-white/10 text-right pr-2 pt-2 text-[11px] text-slate-500"
                    style={{ gridColumn:1, gridRow:row + 2 }}>{startTime}</div>
                  <button type="button" disabled={!valid}
                    onClick={() => valid && setDetailSlot({ date:anchor, startTime, endTime:computeEndTime(startTime, 1) })}
                    className={`${info.blocked ? "bg-gray-700/60" : valid ? "bg-white/[0.025] hover:bg-white/[0.06]" : "bg-black/20"} border-b border-white/10 text-left px-2`}
                    style={{ gridColumn:`2 / span ${LANE_CAPACITY}`, gridRow:row + 2 }}>
                    {info.blocked && <span className="text-[10px] font-bold text-gray-400">已封鎖</span>}
                  </button>
                </Fragment>
              );
            })}
            {dayPlacements.map(({ booking, lane, participantIndex, duration, startHour }) => (
              <button key={`${booking.id}-${participantIndex}`} type="button"
                onClick={() => setDetailSlot({ date:booking.date, startTime:booking.startTime, endTime:computeEndTime(booking.startTime, 1) })}
                className="z-10 m-0.5 overflow-hidden rounded-md border border-blue-300/50 bg-blue-700/80 px-1.5 py-1 text-left shadow-lg"
                style={{ gridColumn:lane + 2, gridRow:`${startHour - 10 + 2} / span ${duration}` }}>
                <div className="text-[11px] font-black text-white truncate">{booking.memberName || "顧客"}</div>
                <div className="text-[9px] text-blue-100 leading-tight">{PLAN_SHORT_LABEL[booking.planType] || booking.planType}</div>
                <div className="text-[9px] text-blue-200">{participantIndex + 1}/{booking.participantCount || 1}人・{duration}hr</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid gap-1" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(84px,1fr))` }}>
            <div />
            {days.map(d => {
              const dow = new Date(d + "T00:00:00+08:00").getDay();
              return (
                <div key={d} className="text-center text-slate-300 text-xs font-bold pb-1">
                  {d.slice(5)}<br />週{DOW_LABEL[dow]}{!isBusinessDay(d) ? "（休）" : ""}
                </div>
              );
            })}
            {CALENDAR_HOURS.map(h => (
              <Fragment key={`h-${h}`}>
                <div className="text-slate-500 text-[11px] text-right pr-1 pt-1">{String(h).padStart(2, "0")}:00</div>
                {days.map(d => {
                  const validSlots = slotsForDate(d).map(s => s.startTime);
                  const startTime = `${String(h).padStart(2, "0")}:00`;
                  if (!validSlots.includes(startTime)) {
                    return <div key={`${d}-${h}`} className="rounded-lg bg-white/[0.02] min-h-[38px]" />;
                  }
                  const slotKey = `${d}_${startTime}`;
                  // count/newCount/returningCount 直接讀 bookingSlotCounts（同一份資料前後台都讀這裡，
                  // 保證數字一致），不用 bookingsBySlot.length 現算——3小時預約跨進來的人數
                  // 已經在 bookingDb.js 的 transaction 裡正確算進每一格的 count 了（design.md §5）。
                  const counterInfo = slotCounts[slotKey] || {};
                  const blocked = !!counterInfo.blocked;
                  const count = counterInfo.count || 0;
                  const newCount = counterInfo.newCount || 0;
                  const returningCount = counterInfo.returningCount || 0;
                  const full = count >= LANE_CAPACITY;
                  // 這一格實際的預約名單（本名+方案），教練後台要直接看到「誰」訂了，不用點進詳情才看得到
                  // ——比照使用者提供的 SimplyBook 截圖，行事曆格子直接列出姓名+方案色塊。
                  // 學生前台（MemberBooking/PublicBookingApp/DateSlotPicker）刻意只顯示新/舊生人數，
                  // 完全不讀 memberName/contactEmail/contactPhone，不能讓學生看到彼此的預約身份。
                  const occupants = bookingsBySlot[slotKey] || [];
                  const cellBg = blocked
                    ? "bg-gray-700/50 border-gray-600"
                    : full
                      ? "bg-red-900/30 border-red-500/40"
                      : count > 0
                        ? "bg-blue-900/20 border-blue-500/30"
                        : "bg-white/5 border-white/10";
                  return (
                    <button key={`${d}-${h}`}
                      onClick={() => setDetailSlot({ date: d, startTime, endTime: `${String(h + 1).padStart(2, "0")}:00` })}
                      className={`rounded-lg border min-h-[38px] max-h-[140px] overflow-y-auto px-1 py-1 text-left flex flex-col gap-0.5 ${cellBg}`}>
                      {blocked ? (
                        <span className="text-[10px] font-bold text-gray-400 text-center">封鎖</span>
                      ) : occupants.length === 0 ? (
                        <span className="text-[10px] text-slate-500 text-center">空</span>
                      ) : (
                        occupants.map(b => (
                          <div key={b.id} className="rounded bg-blue-800/60 px-1 py-0.5 leading-tight">
                            <div className="text-[10px] font-bold text-white truncate">{b.memberName || "顧客"}</div>
                            <div className="text-[9px] text-blue-200 truncate">
                              {PLAN_SHORT_LABEL[b.planType] || b.planType}
                              ・{b.participantCount || 1}人{b.durationHours > 1 ? `・${b.durationHours}hr` : ""}
                            </div>
                          </div>
                        ))
                      )}
                      {!blocked && (
                        <span className="text-[9px] text-slate-500 text-center mt-auto">{`共${count}/${LANE_CAPACITY}${newCount||returningCount?`・新${newCount}／舊${returningCount}`:""}`}</span>
                      )}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {detailSlot && (
        <SlotDetailModal
          slot={detailSlot}
          bookings={bookingsBySlot[`${detailSlot.date}_${detailSlot.startTime}`] || []}
          blocked={!!slotCounts[`${detailSlot.date}_${detailSlot.startTime}`]?.blocked}
          onClose={() => setDetailSlot(null)}
          onChanged={() => { refresh(); }}
          toast={toast}
        />
      )}
      {rangeOpen && (
        <RangeBlockModal initialDate={anchor} bookingsBySlot={bookingsBySlot}
          onClose={() => setRangeOpen(false)} onDone={() => { setRangeOpen(false); refresh(); }} toast={toast} />
      )}
    </div>
  );
}

// ─── 客人自助預約時填的非必填問卷（intake），只有 online_public 來源才會有 ──
// 欄位對應 PublicBookingApp 的 intake：{experience,bowInterest,purpose,needSystemIntro,remark}
// 全部空白就整塊不顯示（教練代建/會員自約沒有這塊）。
function IntakeInfo({ intake }) {
  if (!intake) return null;
  const rows = [
    ["射箭經驗", intake.experience],
    ["想了解弓種", intake.bowInterest],
    ["目的", intake.purpose],
    ["需介紹電子系統", intake.needSystemIntro],
    ["備註", intake.remark],
  ].filter(([, v]) => v && String(v).trim());
  if (rows.length === 0) return null;
  return (
    <div className="mt-1.5 rounded-lg bg-amber-500/10 border border-amber-400/20 px-2 py-1.5 flex flex-col gap-0.5">
      <div className="text-amber-300 text-[11px] font-bold">📝 客人填答</div>
      {rows.map(([k, v]) => (
        <div key={k} className="text-[11px] text-amber-100/80 leading-tight">
          <span className="text-amber-300/70">{k}：</span>{v}
        </div>
      ))}
    </div>
  );
}

function RangeBlockModal({ initialDate, bookingsBySlot, onClose, onDone, toast }) {
  const date = initialDate;
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("17:00");
  const [blocked, setBlocked] = useState(true);
  const [busy, setBusy] = useState(false);
  const startHour = Number(startTime.split(":")[0]);
  const endHour = Number(endTime.split(":")[0]);
  const affectedKeys = Number.isFinite(startHour) && Number.isFinite(endHour) && endHour > startHour
    ? Array.from({ length:endHour - startHour }, (_, i) => `${date}_${String(startHour + i).padStart(2, "0")}:00`)
    : [];
  const occupiedCount = new Set(affectedKeys.flatMap(key => (bookingsBySlot[key] || []).map(b => b.id))).size;

  async function submit() {
    if (!affectedKeys.length) { toast("結束時間必須晚於開始時間", "error"); return; }
    setBusy(true);
    const res = await setSlotRangeBlocked(date, startTime, endTime, blocked);
    setBusy(false);
    if (!res.ok) { toast(res.reason || "操作失敗", "error"); return; }
    toast(`${blocked ? "已關閉" : "已開放"} ${res.count} 個時段 ✓`);
    onDone();
  }

  const hourOptions = Array.from({ length:13 }, (_, i) => 10 + i);
  return (
    <Modal open onClose={onClose} title="批次關閉／開放時段" wide>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">日期：{date}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-slate-400">開始時間
            <select value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-white">
              {hourOptions.slice(0, -1).map(h => <option key={h} value={`${String(h).padStart(2, "0")}:00`}>{String(h).padStart(2, "0")}:00</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-400">結束時間
            <select value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-white">
              {hourOptions.slice(1).map(h => <option key={h} value={`${String(h).padStart(2, "0")}:00`}>{String(h).padStart(2, "0")}:00</option>)}
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <Btn v={blocked ? "warn" : "secondary"} className="flex-1" onClick={() => setBlocked(true)}>關閉此區間</Btn>
          <Btn v={!blocked ? "success" : "secondary"} className="flex-1" onClick={() => setBlocked(false)}>重新開放</Btn>
        </div>
        {occupiedCount > 0 && blocked && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            此區間已有 {occupiedCount} 筆預約。關閉不會取消既有預約，只會阻止新增與改期進入。
          </div>
        )}
        <Btn v="primary" onClick={submit} disabled={busy || !affectedKeys.length}>{busy ? "處理中…" : "確認套用整個區間"}</Btn>
      </div>
    </Modal>
  );
}

// ─── 時段詳情 Modal：清單、封鎖切換、標記付款方式、取消/改期、＋新增預約 ──
function SlotDetailModal({ slot, bookings, blocked, onClose, onChanged, toast }) {
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [checkoutTarget, setCheckoutTarget] = useState(null);

  // 這一格目前人數的新/舊生拆分，直接從這一格的實際預約清單算（清單已含跨時段進來的3小時預約）
  const newCount = bookings.reduce((sum, b) => sum + (b.isNewStudent ? (b.participantCount || 1) : 0), 0);
  const returningCount = bookings.reduce((sum, b) => sum + (!b.isNewStudent ? (b.participantCount || 1) : 0), 0);
  const totalPeople = newCount + returningCount;

  async function toggleBlock() {
    setBusy(true);
    const res = blocked
      ? await unblockSlot(slot.date, slot.startTime)
      : await blockSlot(slot.date, slot.startTime);
    setBusy(false);
    if (!res.ok) { toast(res.reason || "操作失敗", "error"); return; }
    toast(blocked ? "已恢復開放 ✓" : "已封鎖此時段 ✓");
    onChanged();
  }

  async function handleCancel(id) {
    setBusy(true);
    const res = await cancelBooking(id);
    setBusy(false);
    if (!res.ok) { toast(res.reason || "取消失敗", "error"); return; }
    toast("已取消 ✓");
    onChanged();
  }

  async function handleReschedule(newSlot) {
    if (!rescheduleTarget) return;
    setBusy(true);
    const res = await rescheduleBooking(rescheduleTarget.id, newSlot.date, newSlot.startTime, newSlot.endTime);
    setBusy(false);
    if (!res.ok) { toast(res.reason || "改期失敗", "error"); return; }
    toast("改期成功 ✓");
    setRescheduleTarget(null);
    onChanged();
  }

  return (
    <Modal open onClose={onClose} title={`${slot.date} ${slot.startTime}-${slot.endTime}`} wide>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-slate-300 text-sm">
            目前 {totalPeople}/{LANE_CAPACITY} 位（新{newCount}／舊{returningCount}）・{blocked ? "已封鎖" : "開放中"}
          </div>
          <Btn v={blocked ? "success" : "warn"} size="sm" onClick={toggleBlock} disabled={busy}>
            {blocked ? "解除封鎖" : "封鎖此時段"}
          </Btn>
        </div>

        {bookings.length === 0 ? (
          <Empty icon="📅" message="這個時段目前沒有預約" />
        ) : (
          <div className="flex flex-col gap-2">
            {bookings.map(b => (
              <Card key={b.id} className="p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-white font-bold text-sm">{b.memberName || "顧客"}</div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      {PLAN_TYPES.find(p => p.id === b.planType)?.label || b.planType}
                      ・{durationLabel(b.durationHours || 1)}・{b.participantCount || 1}人・NT$ {totalPrice(b.planType, b.durationHours || 1, b.participantCount || 1)}
                      {b.source === "phone" ? "・電話進線" : b.source === "online_public" ? "・新生自助" : "・線上自助"}
                      {b.isNewStudent ? "・🆕新生" : "・舊生"}
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">{b.contactEmail} {b.contactPhone ? `· ${b.contactPhone}` : ""}</div>
                    <IntakeInfo intake={b.intake} />
                  </div>
                  {b.status === "confirmed" && !bookingHasStarted(b) && <Btn v="danger" size="sm" onClick={() => handleCancel(b.id)} disabled={busy}>取消</Btn>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 text-xs">付款方式：{b.paymentMethod ? PAYMENT_LABEL[b.paymentMethod] : "未標記"}</span>
                  {b.billingRecordId ? (
                    <span className="text-emerald-400 text-xs font-bold">✅ 已結帳</span>
                  ) : (
                    <Btn v="success" size="sm" onClick={() => setCheckoutTarget(b)} disabled={busy}>💰 結帳</Btn>
                  )}
                  {b.status === "completed"
                    ? <span className="text-emerald-400 text-xs font-bold">🏁 已完成課程</span>
                    : !bookingHasStarted(b) && <Btn v="ghost" size="sm" onClick={() => setRescheduleTarget(b)} disabled={busy}>改期</Btn>}
                </div>
              </Card>
            ))}
          </div>
        )}

        {!blocked && totalPeople < LANE_CAPACITY && (
          <Btn v="primary" onClick={() => setCreateOpen(true)}>＋ 在此時段新增預約</Btn>
        )}
      </div>

      {createOpen && (
        <CreateBookingModal initialSlot={slot} onClose={() => setCreateOpen(false)}
          onDone={() => { setCreateOpen(false); onChanged(); }} toast={toast} />
      )}

      {rescheduleTarget && (
        <Modal open onClose={() => setRescheduleTarget(null)} title={`改期：${rescheduleTarget.memberName || "顧客"}`} wide>
          <div className="flex flex-col gap-4">
            <div className="text-slate-400 text-xs">
              原時段：{rescheduleTarget.date} {rescheduleTarget.startTime}-{rescheduleTarget.endTime}
              （{durationLabel(rescheduleTarget.durationHours || 1)}，時數不可變更）
            </div>
            <RescheduleSlotPicker durationHours={rescheduleTarget.durationHours || 1} onConfirm={handleReschedule} />
          </div>
        </Modal>
      )}

      {checkoutTarget && (
        <CheckoutModal booking={checkoutTarget} onClose={() => setCheckoutTarget(null)}
          onDone={() => { setCheckoutTarget(null); onChanged(); }} toast={toast} />
      )}
    </Modal>
  );
}

// ─── 結帳：把預約轉成一筆會計系統記錄（07-10-booking-billing-integration）──
// 方案/日期/付款方式全部從這筆預約自動帶入，教練仍可在送出前修改任何一項。
// 送出＝呼叫既有 addBillingRecord()，寫進跟 BillingSystem.jsx「記帳」分頁同一個 collection，
// 不另外做一套記帳資料——這樣會計系統的清單/報表/CSV匯出自動就看得到這筆。
function CheckoutModal({ booking, onClose, onDone, toast }) {
  const defaultPlan = BOOKING_TO_BILLING_PLAN[booking.planType]?.[booking.durationHours || 1] || "單一";
  const [plan, setPlan]           = useState(defaultPlan);
  const [discount, setDiscount]   = useState(false);
  const [payMethod, setPayMethod] = useState("現金");
  const [date, setDate]           = useState(booking.date);
  const [note, setNote]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdBillingId, setCreatedBillingId] = useState(null);

  const participantCount = booking.participantCount || 1;
  // 07-10-booking-ui-polish-headcount：N人的預約結帳金額要乘上人數，早鳥折扣則維持每筆固定折額
  // （不隨人數翻倍，這是刻意的簡化：折扣是給「這一次預約」的優惠，不是每人各自折）。
  const basePrice  = (BILLING_PLANS.find(p => p.id === plan)?.price ?? 0) * participantCount;
  const finalPrice = payMethod === "月卡" ? 0 : Math.max(0, basePrice - (discount ? EARLY_BIRD_DISC : 0));

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const [y, m, d] = date.split("-").map(Number);
      let billingId = createdBillingId;
      if (!billingId) {
        const ref = await addBillingRecord({
          memberName: booking.memberName || "顧客", memberId:booking.memberId ?? null,
          plan, basePrice, discount:discount ? EARLY_BIRD_DISC : 0, finalPrice, paymentMethod:payMethod,
          year:y, month:m, day:d, date,
          note:note.trim() || `線上約課結帳（預約 ${booking.id}）`,
          createdBy:"", createdByName:"教練（線上約課結帳）",
          bookingId:booking.id, checkinId:booking.checkinId || null,
        });
        billingId = ref.id;
        setCreatedBillingId(billingId);
      }
      await updateDoc(doc(db, "bookings", booking.id), { paymentMethod: PAY_METHOD_CODE[payMethod] || "cash", updatedAt:serverTimestamp() });
      const linked = await completeBookingFromCheckin(booking.id, booking.checkinId || null, billingId);
      if (!linked.ok) throw new Error(`帳務已建立，但預約連動失敗：${linked.reason || "未知錯誤"}`);
      toast(`✓ 已結帳 ${booking.memberName || "顧客"} · ${plan} NT$${finalPrice}`);
      onDone();
    } catch (e) {
      toast("結帳失敗：" + (e?.message || ""), "error");
    }
    setSubmitting(false);
  }

  return (
    <Modal open onClose={onClose} title={`結帳：${booking.memberName || "顧客"}`} wide>
      <div className="flex flex-col gap-4">
        <div className="text-slate-400 text-xs">
          原預約：{booking.date} {booking.startTime}-{booking.endTime}
          ・{PLAN_TYPES.find(p => p.id === booking.planType)?.label || booking.planType}
          {booking.billingRecordId && <span className="text-amber-400 ml-2">⚠ 這筆先前已結過帳，送出會再新增一筆記錄</span>}
        </div>

        <div>
          <div className="text-slate-400 text-xs font-bold mb-1.5">方案（已依預約自動帶入，可修改）</div>
          <div className="grid grid-cols-3 gap-2">
            {BILLING_PLANS.map(p => (
              <button key={p.id} onClick={() => setPlan(p.id)}
                className={`rounded-xl px-2 py-2 text-center border ${plan === p.id ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-white/5"}`}>
                <div className={`font-black text-sm ${plan === p.id ? "text-blue-300" : "text-white"}`}>{p.id}</div>
                <div className="text-slate-400 text-[11px]">NT${p.price}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
          <div>
            <div className="text-slate-400 text-xs">實收金額</div>
            <div className="text-white text-2xl font-black">NT$ {finalPrice}</div>
          </div>
          <Btn v={discount ? "warn" : "secondary"} size="sm" onClick={() => setDiscount(d => !d)}>
            {discount ? `✓ 早鳥 -$${EARLY_BIRD_DISC}` : "早鳥折扣"}
          </Btn>
        </div>

        <div>
          <div className="text-slate-400 text-xs font-bold mb-1.5">付款方式</div>
          <div className="flex gap-2">
            {PAY_METHODS.map(m => (
              <Btn key={m} v={payMethod === m ? "primary" : "secondary"} size="sm" className="flex-1" onClick={() => setPayMethod(m)}>{m}</Btn>
            ))}
          </div>
        </div>

        <Inp label="日期" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Inp label="備註（選填）" value={note} onChange={e => setNote(e.target.value)} placeholder="例：補繳、折扣說明…" />

        <Btn v="primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "結帳中…" : "確認結帳"}
        </Btn>
      </div>
    </Modal>
  );
}

function RescheduleSlotPicker({ durationHours = 1, onConfirm }) {
  const [slot, setSlot] = useState(null);
  return (
    <div className="flex flex-col gap-4">
      <DateSlotPicker selected={slot} onSelect={setSlot} durationHours={durationHours} />
      <Btn v="primary" disabled={!slot} onClick={() => onConfirm(slot)}>確認改期到此時段</Btn>
    </div>
  );
}

// ─── 建立預約 Modal（教練後台代建，含電話進線）──────────────────
function CreateBookingModal({ initialSlot, onClose, onDone, toast }) {
  const [mode, setMode] = useState("recent"); // "recent" | "search"
  const [searchTerm, setSearchTerm] = useState("");
  const [allMembers, setAllMembers] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null); // {id,name,email,phone}
  const [recentVisits, setRecentVisits] = useState([]);
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInNote, setWalkInNote] = useState("");
  const [planType, setPlanType] = useState("general");
  const [durationHours, setDurationHours] = useState(1);
  const [participantCount, setParticipantCount] = useState(1);
  const [isNewStudent, setIsNewStudent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // 選定顧客後，用該顧客的 bookingStats 帶出「是否為第一次來體驗」預設值，教練仍可自己改
  useEffect(() => {
    if (selectedMember) setIsNewStudent(!(selectedMember.bookingStats?.totalBookings > 0));
  }, [selectedMember]);

  useEffect(() => {
    // 電話進線的顧客可能還沒有正式學籍（accountType:"guest"），搜尋要涵蓋全部 members，
    // 不能只用 getMembers()（那個會過濾掉 guest/kid）。這裡就近讀一次即可，不訂閱，
    // 只有開這個 Modal 才讀，避免常駐訂閱增加成本。加 limit 是防禦性上限，
    // 不是預期會員數真的逼近這個量級（今天稍早處理過 Firestore 額度問題的同一個教訓：
    // 任何新查詢都不留無界讀取，即使目前規模不構成問題）。
    getDocs(query(collection(db, "members"), limit(2000))).then(snap => {
      setAllMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => setAllMembers([]));
    getRecentCheckinMembers(14).then(setRecentVisits);
  }, []);

  const recentMembers = useMemo(() => recentVisits.map(v => {
    const member = (allMembers || []).find(m => m.id === v.memberId);
    return member && !["guest", "kid"].includes(member.accountType) ? { ...member, recentVisitDate:v.date } : null;
  }).filter(Boolean), [allMembers, recentVisits]);

  const results = useMemo(() => {
    if (!allMembers || !searchTerm.trim()) return [];
    const q = searchTerm.trim().toLowerCase();
    return allMembers.filter(m =>
      (m.email || "").toLowerCase().includes(q) ||
      (m.phone || "").includes(q) ||
      (m.contactRaw || "").toLowerCase().includes(q) ||
      (m.name || "").toLowerCase().includes(q) ||
      (m.nickname || "").toLowerCase().includes(q)
    ).slice(0, 20);
  }, [allMembers, searchTerm]);

  async function handleSubmit() {
    if (!selectedMember) { setErr("請先搜尋或建立顧客"); return; }
    if (!initialSlot) { setErr("缺少開始時段"); return; }
    if (Number(computeEndTime(initialSlot.startTime, durationHours).split(":")[0]) > 22) {
      setErr("此方案會超過當日 22:00，請從更早的時段建立"); return;
    }
    setBusy(true); setErr("");
    const res = await createBooking(
      selectedMember.id, selectedMember.name,
      { email: selectedMember.email || "", phone: selectedMember.isWalkIn ? walkInPhone.trim() : (selectedMember.phone || "") },
      planType, durationHours, participantCount, isNewStudent,
      initialSlot.date, initialSlot.startTime, computeEndTime(initialSlot.startTime, durationHours), selectedMember.isWalkIn ? "walk_in" : "phone", selectedMember.isWalkIn ? walkInNote.trim() : "", null,
      { bypassLeadTime:true },
    );
    setBusy(false);
    if (!res.ok) { setErr(res.reason || "建立失敗"); return; }
    toast("預約已建立 ✓");
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="建立預約（電話進線）" wide>
      <div className="flex flex-col gap-4">
        {!selectedMember ? (
          <>
            <div className="flex gap-2">
              <Btn v={mode === "recent" ? "primary" : "secondary"} size="sm" onClick={() => setMode("recent")}>近期學生</Btn>
              <Btn v={mode === "search" ? "primary" : "secondary"} size="sm" onClick={() => setMode("search")}>搜尋顧客</Btn>
              <Btn v="warn" size="sm" onClick={() => setSelectedMember({ id:null, name:"臨時訪客", isWalkIn:true })}>臨時訪客</Btn>
            </div>
            {mode === "recent" ? (
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                {recentMembers.map(m => (
                  <button key={m.id} type="button" onClick={() => setSelectedMember({ id:m.id, name:m.nickname || m.name, email:m.email || "", phone:m.phone || "", bookingStats:m.bookingStats })}
                    className="text-left bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 text-sm text-slate-200">
                    <div className="font-bold">{m.nickname || m.name}</div><div className="text-xs text-slate-400">最近到訪：{m.recentVisitDate}</div>
                  </button>
                ))}
                {allMembers !== null && recentMembers.length === 0 && <div className="text-slate-500 text-xs text-center py-3">近 14 天沒有學生到訪紀錄</div>}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Inp placeholder="輸入 Email、電話或姓名搜尋" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                {allMembers === null ? <Spinner /> : (
                  <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                    {results.map(m => (
                      <button key={m.id} type="button"
                        onClick={() => setSelectedMember({ id: m.id, name: m.nickname || m.name || "顧客", email: m.email || "", phone: m.phone || m.contactRaw || "", bookingStats: m.bookingStats })}
                        className="text-left bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 text-sm text-slate-200">
                        <div className="font-bold">{m.nickname || m.name || "（無名稱）"}</div>
                        <div className="text-xs text-slate-400">{m.email || m.contactRaw || "—"}{m.phone ? ` · ${m.phone}` : ""}</div>
                        {m.bookingStats && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            目前有效預約 {m.bookingStats.totalBookings || 0} 筆・最近一次：{m.bookingStats.lastBookingAt ? fmtDT(m.bookingStats.lastBookingAt) : "—"}
                          </div>
                        )}
                      </button>
                    ))}
                    {searchTerm.trim() && results.length === 0 && (
                      <div className="text-slate-500 text-xs text-center py-3">找不到符合的顧客，可切換「新顧客」建立</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="bg-blue-900/20 border border-blue-400/30 rounded-xl px-3 py-2 text-blue-300 text-sm flex items-center justify-between gap-2">
              <span>顧客：{selectedMember.name}（{selectedMember.email || selectedMember.phone || "—"}）</span>
              <button type="button" onClick={() => setSelectedMember(null)} className="text-xs underline text-blue-400 flex-shrink-0">重選</button>
            </div>
            <PlanDurationPicker planType={planType} durationHours={durationHours}
              onChange={({ planType: pt, durationHours: dh }) => { setPlanType(pt); setDurationHours(dh); }} />
            <ParticipantCountPicker value={participantCount}
              onChange={setParticipantCount} />
            {selectedMember.isWalkIn && <>
              <Inp label="預約電話" value={walkInPhone} onChange={e => setWalkInPhone(e.target.value)} placeholder="手動輸入聯絡電話" />
              <Inp label="備註" value={walkInNote} onChange={e => setWalkInNote(e.target.value)} placeholder="臨時訪客備註（選填）" />
            </>}
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              預約時間：{initialSlot.date} {initialSlot.startTime}－{computeEndTime(initialSlot.startTime, durationHours)}
            </div>
            <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5">
              <span className="text-slate-400 text-sm">總金額</span>
              <span className="text-white text-xl font-black">NT$ {totalPrice(planType, durationHours, participantCount)}</span>
            </div>
            {err && <div className="text-red-400 text-sm">{err}</div>}
            <Btn v="primary" onClick={handleSubmit} disabled={busy}>{busy ? "送出中…" : "確認建立預約"}</Btn>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── bookingBetaAccess 歷史註記 ─────────────────────────────────
function BetaAccessTab({ toast }) {
  const [members, setMembers] = useState(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    getMembers().then(setMembers).catch(() => setMembers([]));
  }, []);

  async function toggle(m) {
    setBusyId(m.id);
    try {
      const next = !m.bookingBetaAccess;
      await updateDoc(doc(db, "members", m.id), { bookingBetaAccess: next, updatedAt: serverTimestamp() });
      setMembers(list => list.map(x => x.id === m.id ? { ...x, bookingBetaAccess: next } : x));
      toast(next ? `已標記 ${m.nickname || m.name} ✓` : `已取消 ${m.nickname || m.name} 的標記`);
    } catch (e) { toast("更新失敗：" + (e?.message || ""), "error"); }
    setBusyId(null);
  }

  const filtered = (members || []).filter(m => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (m.name || "").toLowerCase().includes(q) || (m.nickname || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q);
  });

  if (members === null) return <Spinner />;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-blue-900/20 border border-blue-400/30 rounded-xl px-4 py-3 text-blue-300 text-xs leading-relaxed">
        線上約課已正式開放給所有已登入學生。這裡保留舊 beta 名單作為歷史註記，不再控制學生前台是否顯示「約課」分頁。
      </div>
      <Inp placeholder="搜尋姓名／暱稱／Email" value={search} onChange={e => setSearch(e.target.value)} />
      {filtered.length === 0 ? <Empty message="沒有符合的會員" /> : (
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {filtered.map(m => (
            <Card key={m.id} className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-white font-bold text-sm truncate">{m.nickname || m.name}</div>
                <div className="text-slate-500 text-xs truncate">{m.email || "—"}</div>
                {/* 「更多紀錄」三欄位：直接讀 members 文件本身的 bookingStats，
                    不對 bookings collection 額外查詢（PRD 驗收項目 6，見 bookingDb.js 的 transaction 註解）*/}
                {m.bookingStats && (
                  <div className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                    首次預約：{m.bookingStats.firstBookingAt ? fmtDT(m.bookingStats.firstBookingAt) : "—"}
                    ・目前有效預約 {m.bookingStats.totalBookings || 0} 筆
                    ・最近一次：{m.bookingStats.lastBookingAt ? fmtDT(m.bookingStats.lastBookingAt) : "—"}
                  </div>
                )}
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                <input type="checkbox" checked={!!m.bookingBetaAccess} disabled={busyId === m.id}
                  onChange={() => toggle(m)} className="accent-blue-500 w-4 h-4" />
              </label>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 收費分類報表 ───────────────────────────────────────────────
function ReportTab() {
  const [start, setStart] = useState(() => todayStr().slice(0, 8) + "01"); // 本月 1 號
  const [end, setEnd] = useState(() => todayStr());
  const [bookings, setBookings] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getBookingsForDateRange(start, end);
    setBookings(res.ok ? res.bookings : []);
    setLoading(false);
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const list = (bookings || []).filter(b => b.status !== "cancelled");
    const grid = {};
    PLAN_TYPES.forEach(p => { grid[p.id] = { cash: 0, transfer: 0, unmarked: 0, total: 0 }; });
    list.forEach(b => {
      if (!grid[b.planType]) grid[b.planType] = { cash: 0, transfer: 0, unmarked: 0, total: 0 };
      const key = b.paymentMethod === "cash" ? "cash" : b.paymentMethod === "transfer" ? "transfer" : "unmarked";
      grid[b.planType][key] += 1;
      grid[b.planType].total += 1;
    });
    return { grid, totalCount: list.length };
  }, [bookings]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 items-end flex-wrap">
        <Inp label="起" type="date" value={start} onChange={e => setStart(e.target.value)} />
        <Inp label="迄" type="date" value={end} onChange={e => setEnd(e.target.value)} />
        <Btn v="secondary" size="sm" onClick={load}>重新查詢</Btn>
      </div>
      {loading ? <Spinner /> : (
        <Card className="p-4 flex flex-col gap-3">
          <div className="text-slate-400 text-xs">區間內共 {stats.totalCount} 筆有效預約（不含已取消）</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-300">
              <thead>
                <tr className="text-slate-500 text-xs">
                  <th className="text-left py-1.5">方案</th>
                  <th className="text-right py-1.5">現金</th>
                  <th className="text-right py-1.5">轉帳</th>
                  <th className="text-right py-1.5">未標記</th>
                  <th className="text-right py-1.5">小計</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_TYPES.map(p => (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="py-1.5">{p.label}</td>
                    <td className="text-right py-1.5">{stats.grid[p.id]?.cash || 0}</td>
                    <td className="text-right py-1.5">{stats.grid[p.id]?.transfer || 0}</td>
                    <td className="text-right py-1.5">{stats.grid[p.id]?.unmarked || 0}</td>
                    <td className="text-right py-1.5 font-bold text-white">{stats.grid[p.id]?.total || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
