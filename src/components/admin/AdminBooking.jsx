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
  createBooking, cancelBooking, rescheduleBooking, blockSlot, unblockSlot,
  getBookingsForDateRange, LANE_CAPACITY,
} from "../../lib/bookingDb";
import {
  slotsForDate, isBusinessDay, todayStr, addDays, startOfWeek,
  fetchSlotCountsForRange, PLAN_TYPES, DURATION_OPTIONS,
} from "../../lib/bookingSchedule";
import { resolveGuestSession } from "../../lib/guestAuth";
import { getMembers } from "../../lib/db";
import { fmtDT } from "../../lib/constants";
import DateSlotPicker from "../booking/DateSlotPicker";
import { Card, Btn, Inp, Sel, Modal, Spinner, Empty, useToast } from "../shared/UI";

const DOW_LABEL = ["日", "一", "二", "三", "四", "五", "六"];
const PAYMENT_LABEL = { cash: "💵 現金", transfer: "🏦 轉帳" };

export default function AdminBooking() {
  const { toast, ToastContainer } = useToast();
  const [tab, setTab] = useState("calendar"); // "calendar" | "beta" | "report"

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <h2 className="text-white font-black text-xl">📅 線上約課</h2>
      <div className="flex gap-2">
        <Btn v={tab === "calendar" ? "primary" : "secondary"} size="sm" className="flex-1" onClick={() => setTab("calendar")}>行事曆</Btn>
        <Btn v={tab === "beta" ? "primary" : "secondary"} size="sm" className="flex-1" onClick={() => setTab("beta")}>開放名單</Btn>
        <Btn v={tab === "report" ? "primary" : "secondary"} size="sm" className="flex-1" onClick={() => setTab("report")}>收費報表</Btn>
      </div>
      {tab === "calendar" && <CalendarTab toast={toast} />}
      {tab === "beta"     && <BetaAccessTab toast={toast} />}
      {tab === "report"   && <ReportTab />}
    </div>
  );
}

// ─── 行事曆檢視 ──────────────────────────────────────────────
function CalendarTab({ toast }) {
  const [viewMode, setViewMode] = useState("week"); // "week" | "day"
  const [anchor, setAnchor] = useState(todayStr());
  const [bookings, setBookings] = useState([]);
  const [slotCounts, setSlotCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [detailSlot, setDetailSlot] = useState(null); // { date, startTime, endTime }
  const [reloadTick, setReloadTick] = useState(0);

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
    setBookings(bRes.ok ? bRes.bookings.filter(b => b.status === "confirmed") : []);
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

  const ALL_HOURS = Array.from({ length: 12 }).map((_, i) => 10 + i); // 10~21 時起跳

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Btn v={viewMode === "week" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("week")}>週檢視</Btn>
          <Btn v={viewMode === "day" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("day")}>日檢視</Btn>
        </div>
        <div className="flex gap-2 items-center">
          <Btn v="secondary" size="sm" onClick={() => setAnchor(a => addDays(a, viewMode === "day" ? -1 : -7))}>← 上一{viewMode === "day" ? "天" : "週"}</Btn>
          <Btn v="secondary" size="sm" onClick={() => setAnchor(todayStr())}>今天</Btn>
          <Btn v="secondary" size="sm" onClick={() => setAnchor(a => addDays(a, viewMode === "day" ? 1 : 7))}>下一{viewMode === "day" ? "天" : "週"} →</Btn>
        </div>
      </div>
      <div className="text-slate-400 text-xs">{range.start} ～ {range.end}</div>

      {loading ? <Spinner /> : (
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
            {ALL_HOURS.map(h => (
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
                  const colorClass = blocked
                    ? "bg-gray-700/50 border-gray-600 text-gray-400"
                    : full
                      ? "bg-red-900/40 border-red-500/50 text-red-300"
                      : count > 0
                        ? "bg-blue-900/40 border-blue-500/50 text-blue-300"
                        : "bg-white/5 border-white/10 text-slate-500";
                  return (
                    <button key={`${d}-${h}`}
                      onClick={() => setDetailSlot({ date: d, startTime, endTime: `${String(h + 1).padStart(2, "0")}:00` })}
                      className={`rounded-lg border min-h-[38px] px-1 py-1 text-[10px] font-bold flex flex-col items-center justify-center leading-tight ${colorClass}`}>
                      {blocked ? "封鎖" : (
                        <>
                          <span>{`新${newCount}／舊${returningCount}`}</span>
                          <span>{`共${count}/${LANE_CAPACITY}`}</span>
                        </>
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
    </div>
  );
}

// ─── 時段詳情 Modal：清單、封鎖切換、標記付款方式、取消/改期、＋新增預約 ──
function SlotDetailModal({ slot, bookings, blocked, onClose, onChanged, toast }) {
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  // 這一格目前人數的新/舊生拆分，直接從這一格的實際預約清單算（清單已含跨時段進來的3小時預約）
  const newCount = bookings.filter(b => b.isNewStudent).length;
  const returningCount = bookings.length - newCount;

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

  async function markPayment(bookingId, method) {
    setBusy(true);
    try {
      await updateDoc(doc(db, "bookings", bookingId), { paymentMethod: method, updatedAt: serverTimestamp() });
      toast("已標記付款方式 ✓");
      onChanged();
    } catch (e) { toast("標記失敗：" + (e?.message || ""), "error"); }
    setBusy(false);
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
            目前 {bookings.length}/{LANE_CAPACITY} 位（新{newCount}／舊{returningCount}）・{blocked ? "已封鎖" : "開放中"}
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
                      ・{b.durationHours === 3 ? "3小時（2送1）" : "1小時"}
                      {b.source === "phone" ? "・電話進線" : b.source === "online_public" ? "・新生自助" : "・線上自助"}
                      {b.isNewStudent ? "・🆕新生" : "・舊生"}
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">{b.contactEmail} {b.contactPhone ? `· ${b.contactPhone}` : ""}</div>
                  </div>
                  <Btn v="danger" size="sm" onClick={() => handleCancel(b.id)} disabled={busy}>取消</Btn>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 text-xs">付款方式：{b.paymentMethod ? PAYMENT_LABEL[b.paymentMethod] : "未標記"}</span>
                  <Btn v="secondary" size="sm" onClick={() => markPayment(b.id, "cash")} disabled={busy}>標為現金</Btn>
                  <Btn v="secondary" size="sm" onClick={() => markPayment(b.id, "transfer")} disabled={busy}>標為轉帳</Btn>
                  <Btn v="ghost" size="sm" onClick={() => setRescheduleTarget(b)} disabled={busy}>改期</Btn>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!blocked && bookings.length < LANE_CAPACITY && (
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
              （{rescheduleTarget.durationHours === 3 ? "3小時（2送1），時數不可變更" : "1小時"}）
            </div>
            <RescheduleSlotPicker durationHours={rescheduleTarget.durationHours || 1} onConfirm={handleReschedule} />
          </div>
        </Modal>
      )}
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
  const [mode, setMode] = useState("search"); // "search" | "new"
  const [searchTerm, setSearchTerm] = useState("");
  const [allMembers, setAllMembers] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null); // {id,name,email,phone}
  const [newForm, setNewForm] = useState({ name: "", email: "", phone: "" });
  const [planType, setPlanType] = useState("general");
  const [durationHours, setDurationHours] = useState(1);
  const [isNewStudent, setIsNewStudent] = useState(true);
  const [slot, setSlot] = useState(initialSlot || null);
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
  }, []);

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

  async function handleCreateNewCustomer() {
    if (!newForm.name.trim() || !newForm.email.trim() || !newForm.phone.trim()) {
      setErr("姓名／Email／電話皆為必填"); return;
    }
    setBusy(true); setErr("");
    // 沿用既有 resolveGuestSession：用 email 找回/建立同一筆 members 文件（accountType:"guest"），
    // 之後要轉正式學籍走既有 convertGuestToOfficial，不另建顧客資料表（design.md §1）。
    const res = await resolveGuestSession(newForm.email.trim(), "guest", null);
    setBusy(false);
    if (!res.ok) { setErr(res.reason || "建立顧客失敗"); return; }
    setSelectedMember({
      id: res.id, name: newForm.name.trim() || res.name, email: newForm.email.trim(), phone: newForm.phone.trim(),
      bookingStats: res.bookingStats, // 若是找回既有訪客記錄，可能已經有 bookingStats，用來預設「是否為第一次」
    });
  }

  async function handleSubmit() {
    if (!selectedMember) { setErr("請先搜尋或建立顧客"); return; }
    if (!slot) { setErr("請選擇時段"); return; }
    setBusy(true); setErr("");
    const res = await createBooking(
      selectedMember.id, selectedMember.name,
      { email: selectedMember.email || "", phone: selectedMember.phone || "" },
      planType, durationHours, isNewStudent,
      slot.date, slot.startTime, slot.endTime, "phone",
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
              <Btn v={mode === "search" ? "primary" : "secondary"} size="sm" onClick={() => setMode("search")}>搜尋既有顧客</Btn>
              <Btn v={mode === "new" ? "primary" : "secondary"} size="sm" onClick={() => setMode("new")}>新顧客</Btn>
            </div>
            {mode === "search" ? (
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
            ) : (
              <div className="flex flex-col gap-2">
                <Inp label="姓名" value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))} />
                <Inp label="Email" value={newForm.email} onChange={e => setNewForm(p => ({ ...p, email: e.target.value }))} />
                <Inp label="電話" value={newForm.phone} onChange={e => setNewForm(p => ({ ...p, phone: e.target.value }))} />
                {err && <div className="text-red-400 text-sm">{err}</div>}
                <Btn v="primary" onClick={handleCreateNewCustomer} disabled={busy}>{busy ? "建立中…" : "建立顧客並繼續"}</Btn>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="bg-blue-900/20 border border-blue-400/30 rounded-xl px-3 py-2 text-blue-300 text-sm flex items-center justify-between gap-2">
              <span>顧客：{selectedMember.name}（{selectedMember.email || selectedMember.phone || "—"}）</span>
              <button type="button" onClick={() => setSelectedMember(null)} className="text-xs underline text-blue-400 flex-shrink-0">重選</button>
            </div>
            <Sel label="時數" value={durationHours}
              onChange={e => { setDurationHours(Number(e.target.value)); setSlot(null); }}
              options={DURATION_OPTIONS.map(d => ({ value: d.value, label: d.label }))} />
            <Sel label="方案類別" value={planType} onChange={e => setPlanType(e.target.value)}
              options={PLAN_TYPES.map(p => ({ value: p.id, label: p.label }))} />
            <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
              <input type="checkbox" checked={isNewStudent} onChange={e => setIsNewStudent(e.target.checked)}
                className="accent-blue-500 w-4 h-4" />
              是否為第一次來體驗
            </label>
            <DateSlotPicker selected={slot} onSelect={setSlot} durationHours={durationHours} />
            {err && <div className="text-red-400 text-sm">{err}</div>}
            <Btn v="primary" onClick={handleSubmit} disabled={busy || !slot}>{busy ? "送出中…" : "確認建立預約"}</Btn>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── bookingBetaAccess 開放名單 ─────────────────────────────────
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
      toast(next ? `已開放給 ${m.nickname || m.name} ✓` : `已關閉 ${m.nickname || m.name} 的權限`);
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
        勾選開啟後，該學生的「約課」分頁才會出現。教練自己在射手模式永遠看得到（不受此開關影響）。
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
