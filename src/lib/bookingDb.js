// src/lib/bookingDb.js — 線上約課預約系統資料層（07-10-booking-system-student-pilot）
//
// 核心規則（詳見 .trellis/tasks/07-10-booking-system-student-pilot/design.md）：
// - 全場固定 8 個靶位，容量計算一律用 runTransaction 對「日期+時段」原子計數，
//   不能先查後寫（多人搶同一時段必崩，這是這個 App 的鐵律）。
// - 30 分鐘最短前置時間規則要在這個檔案（後端函式本體）擋，不能只靠前端 UI 篩選。
// - 改期＝同一個 transaction 內「舊時段釋放 + 新時段鎖定」一起做，不能拆成兩次獨立呼叫。
//
// Firestore 規則見 firestore.rules 的 `bookings` / `bookingSlotCounts` 區塊，
// 修改完務必提醒使用者手動貼進 Firebase Console（CLI 部署規則會 403，這個專案的已知限制）。

import {
  collection, doc, getDocs, setDoc, query, where, orderBy, limit,
  serverTimestamp, increment, runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";

const BOOKINGS    = "bookings";
const SLOT_COUNTS = "bookingSlotCounts";

export const LANE_CAPACITY   = 8;                 // 全場固定 8 個靶位
const MIN_LEAD_MS            = 30 * 60 * 1000;     // 30 分鐘最短前置時間
const VENUE_TZ_OFFSET        = "+08:00";           // 場地在台北，不能假設伺服器/瀏覽器時區一致

// ─── 內部小工具 ──────────────────────────────────────────────

// 30 分鐘最短前置時間檢查（純函式，不需要讀資料庫）。
// 回傳 null 表示通過；否則回傳要顯示給使用者的中文原因字串。
function checkLeadTime(date, startTime) {
  const slotStart = new Date(`${date}T${startTime}:00${VENUE_TZ_OFFSET}`);
  if (Number.isNaN(slotStart.getTime())) return "時段格式錯誤";
  if (slotStart.getTime() - Date.now() < MIN_LEAD_MS) {
    return "這個時段快開始了（少於30分鐘），請選晚一點的時段，或直接來電/加LINE確認是否還能安排";
  }
  return null;
}

// 讀出 bookingSlotCounts 文件的安全預設值（文件不存在，或存在但缺 count/blocked 欄位時都要有預設）
function readCounter(snap) {
  if (!snap.exists()) return { count: 0, blocked: false };
  const data = snap.data() || {};
  return { count: data.count || 0, blocked: !!data.blocked };
}

function slotKeyOf(date, startTime) {
  return `${date}_${startTime}`;
}

// ─── 建立預約（學生前台 / 新生隱藏入口 / 教練後台代建 共用）────

// contact: { email, phone }（皆為必填，是轉正式學籍的依據）
// source:  "online" | "online_public" | "phone"
export async function createBooking(memberId, memberName, contact, planType, date, startTime, endTime, source, note = "") {
  if (!memberId) return { ok: false, reason: "缺少會員 ID" };
  if (!contact?.email || !contact?.phone) return { ok: false, reason: "Email 與電話為必填" };

  const leadErr = checkLeadTime(date, startTime);
  if (leadErr) return { ok: false, reason: leadErr };

  const slotKey     = slotKeyOf(date, startTime);
  const counterRef  = doc(db, SLOT_COUNTS, slotKey);
  const memberRef   = doc(db, "members", memberId);
  const bookingRef  = doc(collection(db, BOOKINGS)); // 先產生 ref 拿 id，還沒寫入

  try {
    await runTransaction(db, async (tx) => {
      // ── 全部讀取要在任何寫入之前完成（Firestore transaction 規則）──
      const counterSnap = await tx.get(counterRef);
      const memberSnap  = await tx.get(memberRef);

      const counter = readCounter(counterSnap);
      if (counter.blocked) throw new Error("SLOT_BLOCKED");
      if (counter.count >= LANE_CAPACITY) throw new Error("SLOT_FULL");

      const bookingStats   = memberSnap.exists() ? (memberSnap.data().bookingStats || {}) : {};
      const isFirstBooking = !bookingStats.firstBookingAt;

      // ── 寫入：容量計數器 + 預約文件 + 會員摘要欄位（同一個 transaction）──
      tx.set(counterRef, { count: counter.count + 1, blocked: counter.blocked }, { merge: true });

      tx.set(bookingRef, {
        memberId, memberName,
        contactEmail: contact.email, contactPhone: contact.phone,
        planType, participantCount: 1,
        date, startTime, endTime, slotKey,
        instructorId: null,
        status: "confirmed",
        source,
        paymentMethod: null,
        note: note || "",
        rescheduledFrom: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        cancelledAt: null,
      });

      const statsPatch = {
        totalBookings: increment(1),
        lastBookingAt: serverTimestamp(),
      };
      // firstBookingAt 只在第一次寫入時設定，Firestore 沒有「只在不存在時才設定」的原生語法，
      // 所以要先讀出現有值判斷（design.md §3）。
      if (isFirstBooking) statsPatch.firstBookingAt = serverTimestamp();
      tx.set(memberRef, { bookingStats: statsPatch }, { merge: true });
    });
    return { ok: true, id: bookingRef.id };
  } catch (e) {
    if (e.message === "SLOT_FULL")    return { ok: false, reason: "這個時段已經滿了，換一個時段看看" };
    if (e.message === "SLOT_BLOCKED") return { ok: false, reason: "這個時段教練暫停預約" };
    console.error("[createBooking]", e);
    return { ok: false, reason: "系統忙碌，請稍後再試" };
  }
}

// ─── 取消預約（學生取消自己的 / 教練取消任何一筆）──────────────

export async function cancelBooking(bookingId) {
  const bookingRef = doc(db, BOOKINGS, bookingId);
  try {
    await runTransaction(db, async (tx) => {
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists()) throw new Error("BOOKING_NOT_FOUND");
      const booking = bookingSnap.data();
      if (booking.status !== "confirmed") throw new Error("BOOKING_NOT_ACTIVE");

      const counterRef = doc(db, SLOT_COUNTS, booking.slotKey);
      const memberRef  = doc(db, "members", booking.memberId);

      // ── 讀取先於寫入 ──
      const counterSnap = await tx.get(counterRef);
      const memberSnap  = await tx.get(memberRef);

      const counter      = readCounter(counterSnap);
      const currentTotal = memberSnap.exists() ? (memberSnap.data().bookingStats?.totalBookings || 0) : 0;

      // ── 寫入：釋放容量 + 標記取消 + totalBookings 扣回去（不會低於 0）──
      tx.set(counterRef, { count: Math.max(0, counter.count - 1), blocked: counter.blocked }, { merge: true });
      tx.update(bookingRef, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // lastBookingAt 刻意不更新——取消不是「一次新的預約」，不該覆蓋掉最近一次真正的預約時間（design.md §3）
      tx.set(memberRef, {
        bookingStats: { totalBookings: Math.max(0, currentTotal - 1) },
      }, { merge: true });
    });
    return { ok: true };
  } catch (e) {
    if (e.message === "BOOKING_NOT_FOUND")  return { ok: false, reason: "找不到這筆預約" };
    if (e.message === "BOOKING_NOT_ACTIVE") return { ok: false, reason: "這筆預約已經是取消或完成狀態" };
    console.error("[cancelBooking]", e);
    return { ok: false, reason: "系統忙碌，請稍後再試" };
  }
}

// ─── 變更時段（改期）──────────────────────────────────────────
// 用「新建一筆預約（rescheduledFrom 指回原本那筆）+ 把舊那筆標記 cancelled」的方式做 audit trail，
// 跟 firestore.rules 的權限設計吻合：學生只能 create 自己的新預約 + update 舊預約的 status 欄位，
// 沒有「直接改別人/自己既有預約日期時段」這種寫入路徑。
//
// 舊時段釋放 + 新時段鎖定在同一個 transaction 內完成，不能拆成兩次獨立呼叫
// （拆開的話中間會有一個瞬間舊名額已經釋放、新名額還沒鎖定，可能被搶走造成爛尾狀態）。
export async function rescheduleBooking(bookingId, newDate, newStartTime, newEndTime) {
  const leadErr = checkLeadTime(newDate, newStartTime);
  if (leadErr) return { ok: false, reason: leadErr };

  const oldBookingRef = doc(db, BOOKINGS, bookingId);
  const newBookingRef = doc(collection(db, BOOKINGS)); // 預先產生新文件 ref

  try {
    await runTransaction(db, async (tx) => {
      const oldSnap = await tx.get(oldBookingRef);
      if (!oldSnap.exists()) throw new Error("BOOKING_NOT_FOUND");
      const old = oldSnap.data();
      if (old.status !== "confirmed") throw new Error("BOOKING_NOT_ACTIVE");

      const newSlotKey    = slotKeyOf(newDate, newStartTime);
      const sameSlot       = newSlotKey === old.slotKey;
      const oldCounterRef  = doc(db, SLOT_COUNTS, old.slotKey);
      const newCounterRef  = sameSlot ? oldCounterRef : doc(db, SLOT_COUNTS, newSlotKey);
      const memberRef      = doc(db, "members", old.memberId);

      // ── 全部讀取（舊/新兩個 bookingSlotCounts 文件 + 會員文件）要在任何寫入之前 ──
      const oldCounterSnap = await tx.get(oldCounterRef);
      const newCounterSnap = sameSlot ? oldCounterSnap : await tx.get(newCounterRef);
      const memberSnap     = await tx.get(memberRef);

      const oldCounter = readCounter(oldCounterSnap);
      const newCounter = sameSlot ? oldCounter : readCounter(newCounterSnap);

      if (!sameSlot) {
        if (newCounter.blocked) throw new Error("SLOT_BLOCKED");
        if (newCounter.count >= LANE_CAPACITY) throw new Error("SLOT_FULL");
      }

      // ── 寫入：舊時段釋放 + 新時段鎖定（容量沒變就不用動 counter）──
      if (!sameSlot) {
        tx.set(oldCounterRef, { count: Math.max(0, oldCounter.count - 1), blocked: oldCounter.blocked }, { merge: true });
        tx.set(newCounterRef, { count: newCounter.count + 1, blocked: newCounter.blocked }, { merge: true });
      }

      tx.update(oldBookingRef, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.set(newBookingRef, {
        memberId: old.memberId,
        memberName: old.memberName,
        contactEmail: old.contactEmail,
        contactPhone: old.contactPhone,
        planType: old.planType,
        participantCount: old.participantCount || 1,
        date: newDate, startTime: newStartTime, endTime: newEndTime,
        slotKey: newSlotKey,
        instructorId: old.instructorId ?? null,
        status: "confirmed",
        source: old.source,
        paymentMethod: old.paymentMethod ?? null,
        note: old.note || "",
        rescheduledFrom: bookingId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        cancelledAt: null,
      });

      // totalBookings 淨變化為 0：舊時段 decrement + 新時段 increment 在同一個 transaction 內互相抵銷，
      // 只有 lastBookingAt 更新成新時段時間（design.md §3）。Math.max 保護理論上不會觸底，但還是要寫。
      const currentTotal = memberSnap.exists() ? (memberSnap.data().bookingStats?.totalBookings || 0) : 0;
      const netTotal = Math.max(0, currentTotal - 1) + 1;
      tx.set(memberRef, {
        bookingStats: { totalBookings: netTotal, lastBookingAt: serverTimestamp() },
      }, { merge: true });
    });
    return { ok: true, id: newBookingRef.id };
  } catch (e) {
    if (e.message === "SLOT_FULL")          return { ok: false, reason: "新時段已經滿了，換一個時段看看" };
    if (e.message === "SLOT_BLOCKED")       return { ok: false, reason: "新時段教練暫停預約" };
    if (e.message === "BOOKING_NOT_FOUND")  return { ok: false, reason: "找不到這筆預約" };
    if (e.message === "BOOKING_NOT_ACTIVE") return { ok: false, reason: "這筆預約已經是取消或完成狀態，無法改期" };
    console.error("[rescheduleBooking]", e);
    return { ok: false, reason: "系統忙碌，請稍後再試" };
  }
}

// ─── 暫停 / 恢復 特定時段（教練後台，全場封鎖）─────────────────
// 單一文件單一欄位寫入，不需要 transaction。
// 容量計數器欄位（count）由 createBooking/rescheduleBooking 的 readCounter() 安全預設值處理，
// 這裡不用先讀再寫也不會壞（setDoc + merge 不會動到沒寫進 payload 的既有欄位）。

export async function blockSlot(date, startTime) {
  try {
    const slotKey = slotKeyOf(date, startTime);
    await setDoc(doc(db, SLOT_COUNTS, slotKey), { blocked: true }, { merge: true });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

export async function unblockSlot(date, startTime) {
  try {
    const slotKey = slotKeyOf(date, startTime);
    await setDoc(doc(db, SLOT_COUNTS, slotKey), { blocked: false }, { merge: true });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ─── 查詢 ────────────────────────────────────────────────────

// 學生「我的預約」清單。刻意不加 orderBy(date) 搭配 where(memberId==) ——
// 那個組合會需要新的複合索引（跟 firestore.rules 一樣，CLI 部署不了，需要手動 Console 步驟）。
// 用 limit 界定上限即可，排序交給呼叫端（見 firestore-cost-optimization.md 的既有慣例）。
export async function getBookingsForMember(memberId, maxCount = 200) {
  try {
    const snap = await getDocs(query(
      collection(db, BOOKINGS),
      where("memberId", "==", memberId),
      limit(maxCount),
    ));
    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    bookings.sort((a, b) => `${b.date}_${b.startTime}`.localeCompare(`${a.date}_${a.startTime}`));
    return { ok: true, bookings };
  } catch (e) {
    return { ok: false, reason: e.message, bookings: [] };
  }
}

// 教練行事曆用：一定要帶日期範圍 where，不能無界查詢全部歷史預約
// （今天處理 Firestore 額度問題學到的教訓，見 .trellis/spec/frontend/firestore-cost-optimization.md）。
// startDate/endDate 格式 "YYYY-MM-DD"，range 都在同一個欄位（date）上，
// 不需要額外複合索引（inequality 搭配同欄位的 orderBy 是 Firestore 原生支援的組合）。
export async function getBookingsForDateRange(startDate, endDate) {
  try {
    const snap = await getDocs(query(
      collection(db, BOOKINGS),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "asc"),
    ));
    return { ok: true, bookings: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
  } catch (e) {
    return { ok: false, reason: e.message, bookings: [] };
  }
}
