// src/lib/bookingDb.js — 線上約課預約系統資料層（07-10-booking-system-student-pilot ＋ 07-10-booking-multihour-and-stats）
//
// 核心規則（詳見 .trellis/tasks/07-10-booking-system-student-pilot/design.md
// 與 .trellis/tasks/07-10-booking-multihour-and-stats/design.md）：
// - 全場固定 8 個靶位，容量計算一律用 runTransaction 對「日期+時段」原子計數，
//   不能先查後寫（多人搶同一時段必崩，這是這個 App 的鐵律）。
// - 每筆預約可能橫跨多個時段格（1 或 3 小時），容量鎖定/釋放要對「這筆預約牽涉到的全部格子」
//   在同一個 transaction 內一起做——全部通過才全部寫入，任何一格失敗就整筆不動任何東西
//   （N 個格子版本的「先讀後寫、失敗就全部不動」原則，從單格推廣過來，原則完全沒變）。
// - 30 分鐘最短前置時間規則要在這個檔案（後端函式本體）擋，不能只靠前端 UI 篩選；只檢查起始時段。
// - 改期＝同一個 transaction 內「舊時段釋放 + 新時段鎖定」一起做，不能拆成兩次獨立呼叫。
// - `bookingSlotCounts/{slotKey}` 除了 count/blocked，還有 newCount/returningCount（新生/舊生人數），
//   不變式：count === newCount + returningCount，三者永遠在同一次 tx.set() 裡一起寫。
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

// 讀出 bookingSlotCounts 文件的安全預設值（文件不存在，或存在但缺欄位時都要有預設）。
// newCount/returningCount 是這次任務新增的兩個欄位（design.md §1），舊資料/舊文件沒有這兩個
// 欄位時安全預設為 0，跟 count/blocked 的既有慣例一致。
function readCounter(snap) {
  if (!snap.exists()) return { count: 0, blocked: false, newCount: 0, returningCount: 0 };
  const data = snap.data() || {};
  return {
    count: data.count || 0,
    blocked: !!data.blocked,
    newCount: data.newCount || 0,
    returningCount: data.returningCount || 0,
  };
}

function slotKeyOf(date, startTime) {
  return `${date}_${startTime}`;
}

// 一筆預約橫跨 durationHours 個連續小時，回傳它實際佔用的全部時段格 key（design.md §2）。
// 例：10:00 起 3 小時 → ["date_10:00","date_11:00","date_12:00"]（不含 12:00 之後，
// 因為 hourly slot key 代表「這筆預約佔用了這一小時」，3 小時預約佔用 10/11/12 這三個起點小時，
// 到了 13:00 這個 key 就已經不屬於這筆預約——這也是 prd.md 驗收項目 2 的核心正確性依據）。
function slotKeysFor(date, startTime, durationHours) {
  const [h, m] = startTime.split(":").map(Number);
  const mm = m === 0 ? "00" : String(m).padStart(2, "0");
  const keys = [];
  for (let i = 0; i < durationHours; i++) {
    keys.push(`${date}_${String(h + i).padStart(2, "0")}:${mm}`);
  }
  return keys;
}

// ─── 建立預約（學生前台 / 新生隱藏入口 / 教練後台代建 共用）────

// contact: { email, phone }。只有訪客自助（source==="online_public"）強制填寫——那是日後
//   找回帳號 / 轉正式學籍的依據。學籍會員自己約課（"online"）或教練代建（"phone"）不強制，
//   因為會員本來就有帳號，很多人 profile 沒留 email/電話，不該擋住他們預約。
// durationHours: 1 | 2 | 3（3 小時＝方案表「2送1」選項）
// participantCount: 1~LANE_CAPACITY（07-10-booking-ui-polish-headcount：選N人＝這筆預約原子性
// 佔用N個靶位，不是備註欄位——每一格容量檢查從「count>=LANE_CAPACITY」推廣成
// 「count+participantCount>LANE_CAPACITY」，寫入時每一格的 count/new-returningCount 都 +participantCount
// 而不是固定+1。整筆預約只有一個 isNewStudent，不細分這N人裡面誰新誰舊，是刻意的簡化。）
// isNewStudent: boolean（使用者自己勾選「是否為第一次來體驗」，不是用 accountType 反推）
// source:  "online" | "online_public" | "phone"
// intake: 非必填問卷 { experience, bowInterest, purpose, remark, needSystemIntro }（只有 online_public 會帶）
export async function createBooking(memberId, memberName, contact, planType, durationHours, participantCount, isNewStudent, date, startTime, endTime, source, note = "", intake = null) {
  if (!memberId) return { ok: false, reason: "缺少會員 ID" };
  if (source === "online_public" && (!contact?.email || !contact?.phone)) {
    return { ok: false, reason: "Email 與電話為必填" };
  }
  const count = Math.max(1, Math.min(LANE_CAPACITY, participantCount || 1));

  const leadErr = checkLeadTime(date, startTime);
  if (leadErr) return { ok: false, reason: leadErr };

  const slotKeys    = slotKeysFor(date, startTime, durationHours);
  const counterRefs = slotKeys.map(k => doc(db, SLOT_COUNTS, k));
  const memberRef   = doc(db, "members", memberId);
  const bookingRef  = doc(collection(db, BOOKINGS)); // 先產生 ref 拿 id，還沒寫入

  try {
    await runTransaction(db, async (tx) => {
      // ── 全部讀取要在任何寫入之前完成（Firestore transaction 規則）——
      // 3 小時預約牽涉到 3 個 bookingSlotCounts 文件，全部平行讀完才能開始判斷/寫入 ──
      const counterSnaps = await Promise.all(counterRefs.map(ref => tx.get(ref)));
      const memberSnap   = await tx.get(memberRef);

      const counters = counterSnaps.map(readCounter);

      // ── 逐格檢查：任何一格「加上這次要佔用的人數」會超過上限，或已封鎖，就整筆丟出，
      // 不寫入任何東西（3 小時×N人預約要嘛全部格子都通過，要嘛整筆失敗）──
      counters.forEach((c, i) => {
        if (c.blocked)                        throw new Error(`SLOT_BLOCKED:${slotKeys[i]}`);
        if (c.count + count > LANE_CAPACITY)  throw new Error(`SLOT_FULL:${slotKeys[i]}`);
      });

      const bookingStats   = memberSnap.exists() ? (memberSnap.data().bookingStats || {}) : {};
      const isFirstBooking = !bookingStats.firstBookingAt;

      // ── 全部通過才寫入：每一格各自 +count（不是固定+1）──
      counterRefs.forEach((ref, i) => {
        const c = counters[i];
        tx.set(ref, {
          count: c.count + count,
          blocked: c.blocked,
          newCount:       c.newCount       + (isNewStudent ? count : 0),
          returningCount: c.returningCount + (isNewStudent ? 0 : count),
        }, { merge: true });
      });

      tx.set(bookingRef, {
        memberId, memberName,
        contactEmail: contact?.email || "", contactPhone: contact?.phone || "",
        planType, participantCount: count,
        durationHours, isNewStudent: !!isNewStudent,
        date, startTime, endTime,
        slotKeys, slotKey: slotKeys[0], // slotKey（單數）保留＝slotKeys[0]，向後相容舊讀取程式碼
        instructorId: null,
        status: "confirmed",
        source,
        paymentMethod: null,
        note: note || "",
        intake: intake || null,
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
    const msg = e.message || "";
    if (msg.startsWith("SLOT_FULL") || msg.startsWith("SLOT_BLOCKED")) {
      const isFull    = msg.startsWith("SLOT_FULL");
      const failedKey = msg.split(":")[1];
      const hourLabel = failedKey ? failedKey.split("_")[1] : "";
      let reason;
      if (durationHours > 1) {
        reason = isFull
          ? `這筆預約需要連續 ${durationHours} 小時，其中 ${hourLabel} 時段已經滿了，換一個時段看看`
          : `這筆預約需要連續 ${durationHours} 小時，其中 ${hourLabel} 時段教練暫停預約，換一個時段看看`;
      } else {
        reason = isFull ? "這個時段已經滿了，換一個時段看看" : "這個時段教練暫停預約";
      }
      return { ok: false, reason };
    }
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

      // 舊資料（沒有 slotKeys 陣列，只有單數 slotKey）向後相容 fallback
      const slotKeys    = (booking.slotKeys && booking.slotKeys.length) ? booking.slotKeys : [booking.slotKey];
      const counterRefs = slotKeys.map(k => doc(db, SLOT_COUNTS, k));
      const memberRef   = doc(db, "members", booking.memberId);
      const isNew       = !!booking.isNewStudent;
      const count       = booking.participantCount || 1; // 07-10-booking-ui-polish-headcount：釋放跟建立時同樣的人數

      // ── 讀取先於寫入（這筆預約牽涉到的全部時段格 + 會員文件）──
      const counterSnaps = await Promise.all(counterRefs.map(ref => tx.get(ref)));
      const memberSnap   = await tx.get(memberRef);

      const counters      = counterSnaps.map(readCounter);
      const currentTotal  = memberSnap.exists() ? (memberSnap.data().bookingStats?.totalBookings || 0) : 0;

      // ── 寫入：每一格都釋放 count 個名額 + 各自扣回對應的 new/returningCount（不會低於 0）──
      counterRefs.forEach((ref, i) => {
        const c = counters[i];
        tx.set(ref, {
          count: Math.max(0, c.count - count),
          blocked: c.blocked,
          newCount:       Math.max(0, c.newCount       - (isNew ? count : 0)),
          returningCount: Math.max(0, c.returningCount - (isNew ? 0 : count)),
        }, { merge: true });
      });

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
// durationHours/isNewStudent 沿用原本那筆預約的值（這次任務不開放改期時連時數一起改，design.md §4）。
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

      const durationHours = old.durationHours || 1;
      const participantCount = old.participantCount || 1; // 07-10-booking-ui-polish-headcount：改期沿用同樣人數，不開放連人數一起改
      const isNew          = !!old.isNewStudent;
      const oldSlotKeys     = (old.slotKeys && old.slotKeys.length) ? old.slotKeys : [old.slotKey];
      const newSlotKeys     = slotKeysFor(newDate, newStartTime, durationHours);

      // 這筆改期牽涉到的全部時段格（舊 ∪ 新），每個文件只讀一次，避免重複讀寫
      const allKeys = Array.from(new Set([...oldSlotKeys, ...newSlotKeys]));
      const refByKey = {};
      allKeys.forEach(k => { refByKey[k] = doc(db, SLOT_COUNTS, k); });
      const memberRef = doc(db, "members", old.memberId);

      // ── 全部讀取（舊+新全部 bookingSlotCounts 文件 + 會員文件）要在任何寫入之前 ──
      const snapPairs = await Promise.all(allKeys.map(async (k) => [k, await tx.get(refByKey[k])]));
      const memberSnap = await tx.get(memberRef);

      const counterByKey = {};
      snapPairs.forEach(([k, snap]) => { counterByKey[k] = readCounter(snap); });

      // ── 容量檢查：只檢查「新格且不是舊格本來就佔用的」那些格子——
      // 本來就佔用的格子（新舊重疊）不算「新增佔用」，不需要通過容量檢查 ──
      const oldSet = new Set(oldSlotKeys);
      const newSet = new Set(newSlotKeys);
      newSlotKeys.forEach((k) => {
        if (oldSet.has(k)) return;
        const c = counterByKey[k];
        if (c.blocked)                                throw new Error(`SLOT_BLOCKED:${k}`);
        if (c.count + participantCount > LANE_CAPACITY) throw new Error(`SLOT_FULL:${k}`);
      });

      // ── 寫入：對每個牽涉到的格子計算淨變化——只在舊格出現＝-participantCount，
      // 只在新格出現＝+participantCount，兩者都出現（改期後仍佔用同一格）就互相抵銷、不用動這格 ──
      allKeys.forEach(k => {
        const inOld = oldSet.has(k);
        const inNew = newSet.has(k);
        if (inOld === inNew) return; // 沒有變化的格子（新舊都佔用，或都不佔用）
        const c = counterByKey[k];
        const delta = inNew ? participantCount : -participantCount;
        tx.set(refByKey[k], {
          count: Math.max(0, c.count + delta),
          blocked: c.blocked,
          newCount:       Math.max(0, c.newCount       + (isNew ? delta : 0)),
          returningCount: Math.max(0, c.returningCount + (isNew ? 0 : delta)),
        }, { merge: true });
      });

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
        durationHours, isNewStudent: isNew,
        date: newDate, startTime: newStartTime, endTime: newEndTime,
        slotKeys: newSlotKeys, slotKey: newSlotKeys[0],
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
    const msg = e.message || "";
    if (msg.startsWith("SLOT_FULL"))    return { ok: false, reason: "新時段已經滿了，換一個時段看看" };
    if (msg.startsWith("SLOT_BLOCKED")) return { ok: false, reason: "新時段教練暫停預約" };
    if (msg === "BOOKING_NOT_FOUND")    return { ok: false, reason: "找不到這筆預約" };
    if (msg === "BOOKING_NOT_ACTIVE")   return { ok: false, reason: "這筆預約已經是取消或完成狀態，無法改期" };
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
