// test-booking-concurrency.js — Step 1 驗證腳本（07-10-booking-system-student-pilot）
//                              ＋ Test E 多時段併發驗證（07-10-booking-multihour-and-stats）
// 執行方式：node test-booking-concurrency.js
// 需求：serviceAccountKey.json 放在專案根目錄（backup.js 已在用同一把 key）
//
// 這支腳本用 firebase-admin 直接對「正式站同一個 Firestore 專案」跑測試（這個專案沒有架 emulator），
// 所以：
// 1. 一律用 __booking_test__ 開頭的假 memberId / 假日期（2099年），確保不會撞到任何真實資料。
// 2. 邏輯刻意「複寫」一份 src/lib/bookingDb.js 的 transaction 規則（不是 import 原始檔）——
//    因為 bookingDb.js 用的是瀏覽器端 firebase/firestore SDK（需要瀏覽器環境 + 使用者登入），
//    這裡改用 firebase-admin 的 Firestore transaction API 對同一份資料模型/規則跑同樣的邏輯，
//    驗證的是「這個 transaction 設計本身在真正的 Firestore 上是否具備原子性」，
//    不是驗證 bookingDb.js 這份原始檔案逐行有沒有語法錯誤（那個交給 CI=true npx react-scripts build）。
// 3. 跑完一定會把自己建立的全部測試資料刪乾淨，最後再查一次確認沒有殘留。
//
// Test E（新增）：複寫 bookingDb.js 多時段版本的 createBooking（slotKeys 陣列版），
// 驗證「3小時預約橫跨 3 個時段格時，N 個格子的全有全無保證」在真正的 Firestore 上也成立——
// 不是只有單一時段格版本（Test A）才具備原子性。跟 Test A-D 一樣：邏輯是複寫，不是 import 原始檔，
// 同樣尚未實際跑過（Firestore 額度尚未恢復，見 booking-system.md §6），先確保程式碼邏輯經過靜態走查正確。

const admin = require("firebase-admin");
const fs    = require("fs");
const path  = require("path");

const SA_PATH = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(SA_PATH)) {
  console.error("❌ 找不到 serviceAccountKey.json，請先從 Firebase Console 下載並放在專案根目錄");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)) });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const LANE_CAPACITY = 8;
const MIN_LEAD_MS   = 30 * 60 * 1000;
const VENUE_TZ_OFFSET = "+08:00";

const TEST_PREFIX = "__booking_test__";
const TEST_MEMBER_ID = `${TEST_PREFIX}member_${Date.now()}`;
const TEST_DATE = "2099-06-01"; // 遠未來假日期，不會撞到任何真實預約

// 追蹤這次跑測試建立的全部文件 ref，收尾一定要刪光
const createdBookingIds = new Set();
const createdCounterKeys = new Set();

let pass = 0;
let fail = 0;
function ok(label, cond, extra = "") {
  if (cond) { pass++; console.log(`✅ ${label}`); }
  else      { fail++; console.log(`❌ ${label} ${extra}`); }
}

// ─── 複寫自 bookingDb.js 的核心邏輯（見檔頭說明）───────────────

function checkLeadTime(date, startTime) {
  const slotStart = new Date(`${date}T${startTime}:00${VENUE_TZ_OFFSET}`);
  if (Number.isNaN(slotStart.getTime())) return "時段格式錯誤";
  if (slotStart.getTime() - Date.now() < MIN_LEAD_MS) {
    return "這個時段快開始了（少於30分鐘），請選晚一點的時段，或直接來電/加LINE確認是否還能安排";
  }
  return null;
}

function readCounter(snap) {
  if (!snap.exists) return { count: 0, blocked: false };
  const data = snap.data() || {};
  return { count: data.count || 0, blocked: !!data.blocked };
}

function slotKeyOf(date, startTime) { return `${date}_${startTime}`; }

async function createBookingAdmin(memberId, memberName, contact, planType, date, startTime, endTime, source, note = "") {
  const leadErr = checkLeadTime(date, startTime);
  if (leadErr) return { ok: false, reason: leadErr };

  const slotKey    = slotKeyOf(date, startTime);
  const counterRef = db.collection("bookingSlotCounts").doc(slotKey);
  const memberRef  = db.collection("members").doc(memberId);
  const bookingRef = db.collection("bookings").doc();
  createdCounterKeys.add(slotKey);

  try {
    await db.runTransaction(async (tx) => {
      const counterSnap = await tx.get(counterRef);
      const memberSnap  = await tx.get(memberRef);

      const counter = readCounter(counterSnap);
      if (counter.blocked) throw new Error("SLOT_BLOCKED");
      if (counter.count >= LANE_CAPACITY) throw new Error("SLOT_FULL");

      const bookingStats   = memberSnap.exists ? (memberSnap.data().bookingStats || {}) : {};
      const isFirstBooking = !bookingStats.firstBookingAt;

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
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        cancelledAt: null,
      });

      const statsPatch = {
        totalBookings: FieldValue.increment(1),
        lastBookingAt: FieldValue.serverTimestamp(),
      };
      if (isFirstBooking) statsPatch.firstBookingAt = FieldValue.serverTimestamp();
      tx.set(memberRef, { bookingStats: statsPatch }, { merge: true });
    });
    createdBookingIds.add(bookingRef.id);
    return { ok: true, id: bookingRef.id };
  } catch (e) {
    if (e.message === "SLOT_FULL")    return { ok: false, reason: "這個時段已經滿了，換一個時段看看" };
    if (e.message === "SLOT_BLOCKED") return { ok: false, reason: "這個時段教練暫停預約" };
    return { ok: false, reason: "系統忙碌，請稍後再試：" + e.message };
  }
}

async function cancelBookingAdmin(bookingId) {
  const bookingRef = db.collection("bookings").doc(bookingId);
  try {
    await db.runTransaction(async (tx) => {
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists) throw new Error("BOOKING_NOT_FOUND");
      const booking = bookingSnap.data();
      if (booking.status !== "confirmed") throw new Error("BOOKING_NOT_ACTIVE");

      const counterRef = db.collection("bookingSlotCounts").doc(booking.slotKey);
      const memberRef  = db.collection("members").doc(booking.memberId);

      const counterSnap = await tx.get(counterRef);
      const memberSnap  = await tx.get(memberRef);

      const counter      = readCounter(counterSnap);
      const currentTotal = memberSnap.exists ? (memberSnap.data().bookingStats?.totalBookings || 0) : 0;

      tx.set(counterRef, { count: Math.max(0, counter.count - 1), blocked: counter.blocked }, { merge: true });
      tx.update(bookingRef, { status: "cancelled", cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      tx.set(memberRef, { bookingStats: { totalBookings: Math.max(0, currentTotal - 1) } }, { merge: true });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function rescheduleBookingAdmin(bookingId, newDate, newStartTime, newEndTime) {
  const leadErr = checkLeadTime(newDate, newStartTime);
  if (leadErr) return { ok: false, reason: leadErr };

  const oldBookingRef = db.collection("bookings").doc(bookingId);
  const newBookingRef = db.collection("bookings").doc();

  try {
    await db.runTransaction(async (tx) => {
      const oldSnap = await tx.get(oldBookingRef);
      if (!oldSnap.exists) throw new Error("BOOKING_NOT_FOUND");
      const old = oldSnap.data();
      if (old.status !== "confirmed") throw new Error("BOOKING_NOT_ACTIVE");

      const newSlotKey   = slotKeyOf(newDate, newStartTime);
      const sameSlot      = newSlotKey === old.slotKey;
      const oldCounterRef = db.collection("bookingSlotCounts").doc(old.slotKey);
      const newCounterRef = sameSlot ? oldCounterRef : db.collection("bookingSlotCounts").doc(newSlotKey);
      const memberRef     = db.collection("members").doc(old.memberId);
      createdCounterKeys.add(newSlotKey);

      const oldCounterSnap = await tx.get(oldCounterRef);
      const newCounterSnap = sameSlot ? oldCounterSnap : await tx.get(newCounterRef);
      const memberSnap     = await tx.get(memberRef);

      const oldCounter = readCounter(oldCounterSnap);
      const newCounter = sameSlot ? oldCounter : readCounter(newCounterSnap);

      if (!sameSlot) {
        if (newCounter.blocked) throw new Error("SLOT_BLOCKED");
        if (newCounter.count >= LANE_CAPACITY) throw new Error("SLOT_FULL");
      }

      if (!sameSlot) {
        tx.set(oldCounterRef, { count: Math.max(0, oldCounter.count - 1), blocked: oldCounter.blocked }, { merge: true });
        tx.set(newCounterRef, { count: newCounter.count + 1, blocked: newCounter.blocked }, { merge: true });
      }

      tx.update(oldBookingRef, { status: "cancelled", cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      tx.set(newBookingRef, {
        memberId: old.memberId, memberName: old.memberName,
        contactEmail: old.contactEmail, contactPhone: old.contactPhone,
        planType: old.planType, participantCount: old.participantCount || 1,
        date: newDate, startTime: newStartTime, endTime: newEndTime, slotKey: newSlotKey,
        instructorId: old.instructorId ?? null,
        status: "confirmed", source: old.source,
        paymentMethod: old.paymentMethod ?? null, note: old.note || "",
        rescheduledFrom: bookingId,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), cancelledAt: null,
      });

      const currentTotal = memberSnap.exists ? (memberSnap.data().bookingStats?.totalBookings || 0) : 0;
      const netTotal = Math.max(0, currentTotal - 1) + 1;
      tx.set(memberRef, { bookingStats: { totalBookings: netTotal, lastBookingAt: FieldValue.serverTimestamp() } }, { merge: true });
    });
    createdBookingIds.add(newBookingRef.id);
    return { ok: true, id: newBookingRef.id };
  } catch (e) {
    if (e.message === "SLOT_FULL")          return { ok: false, reason: "新時段已經滿了，換一個時段看看" };
    if (e.message === "SLOT_BLOCKED")       return { ok: false, reason: "新時段教練暫停預約" };
    if (e.message === "BOOKING_NOT_FOUND")  return { ok: false, reason: "找不到這筆預約" };
    if (e.message === "BOOKING_NOT_ACTIVE") return { ok: false, reason: "這筆預約已經是取消或完成狀態，無法改期" };
    return { ok: false, reason: "系統忙碌，請稍後再試：" + e.message };
  }
}

// ─── Test E 用：複寫 bookingDb.js 多時段版本的 createBooking ─────────────
// （design.md §2-3：slotKeysFor + 全部讀取→逐格檢查→全部通過才逐格寫入）

function slotKeysForMulti(date, startTime, durationHours) {
  const [h, m] = startTime.split(":").map(Number);
  const mm = m === 0 ? "00" : String(m).padStart(2, "0");
  const keys = [];
  for (let i = 0; i < durationHours; i++) keys.push(`${date}_${String(h + i).padStart(2, "0")}:${mm}`);
  return keys;
}

function readCounterMulti(snap) {
  if (!snap.exists) return { count: 0, blocked: false, newCount: 0, returningCount: 0 };
  const data = snap.data() || {};
  return {
    count: data.count || 0, blocked: !!data.blocked,
    newCount: data.newCount || 0, returningCount: data.returningCount || 0,
  };
}

async function createBookingMultiAdmin(memberId, memberName, contact, planType, durationHours, isNewStudent, date, startTime, endTime, source, note = "") {
  const leadErr = checkLeadTime(date, startTime);
  if (leadErr) return { ok: false, reason: leadErr };

  const slotKeys    = slotKeysForMulti(date, startTime, durationHours);
  const counterRefs = slotKeys.map(k => db.collection("bookingSlotCounts").doc(k));
  const memberRef   = db.collection("members").doc(memberId);
  const bookingRef  = db.collection("bookings").doc();
  slotKeys.forEach(k => createdCounterKeys.add(k));

  try {
    await db.runTransaction(async (tx) => {
      // ── 全部讀取先於任何寫入：3 個 bookingSlotCounts 文件 + 會員文件 ──
      const counterSnaps = await Promise.all(counterRefs.map(ref => tx.get(ref)));
      const memberSnap   = await tx.get(memberRef);
      const counters     = counterSnaps.map(readCounterMulti);

      // ── 逐格檢查：任何一格額滿/封鎖就整筆丟出，不寫入任何東西 ──
      counters.forEach((c, i) => {
        if (c.blocked)                 throw new Error(`SLOT_BLOCKED:${slotKeys[i]}`);
        if (c.count >= LANE_CAPACITY)  throw new Error(`SLOT_FULL:${slotKeys[i]}`);
      });

      const bookingStats   = memberSnap.exists ? (memberSnap.data().bookingStats || {}) : {};
      const isFirstBooking = !bookingStats.firstBookingAt;

      // ── 全部通過才寫入：每一格各自 +1（count 與 new/returningCount 一起動）──
      counterRefs.forEach((ref, i) => {
        const c = counters[i];
        tx.set(ref, {
          count: c.count + 1,
          blocked: c.blocked,
          newCount:       c.newCount       + (isNewStudent ? 1 : 0),
          returningCount: c.returningCount + (isNewStudent ? 0 : 1),
        }, { merge: true });
      });

      tx.set(bookingRef, {
        memberId, memberName,
        contactEmail: contact.email, contactPhone: contact.phone,
        planType, participantCount: 1,
        durationHours, isNewStudent: !!isNewStudent,
        date, startTime, endTime, slotKeys, slotKey: slotKeys[0],
        instructorId: null, status: "confirmed", source,
        paymentMethod: null, note: note || "", rescheduledFrom: null,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), cancelledAt: null,
      });

      const statsPatch = { totalBookings: FieldValue.increment(1), lastBookingAt: FieldValue.serverTimestamp() };
      if (isFirstBooking) statsPatch.firstBookingAt = FieldValue.serverTimestamp();
      tx.set(memberRef, { bookingStats: statsPatch }, { merge: true });
    });
    createdBookingIds.add(bookingRef.id);
    return { ok: true, id: bookingRef.id, slotKeys };
  } catch (e) {
    const msg = e.message || "";
    if (msg.startsWith("SLOT_FULL"))    return { ok: false, reason: "這個時段已經滿了，換一個時段看看" };
    if (msg.startsWith("SLOT_BLOCKED")) return { ok: false, reason: "這個時段教練暫停預約" };
    return { ok: false, reason: "系統忙碌，請稍後再試：" + e.message };
  }
}

// ─── 測試用小工具 ────────────────────────────────────────────

// 用 UTC+8 位移算出「距現在 N 分鐘後」在台北時區的 date/HH:mm 字串
function taipeiDateTimeAfter(minutesFromNow) {
  const ms = Date.now() + minutesFromNow * 60 * 1000 + 8 * 3600 * 1000;
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return { date, time };
}

const CONTACT = { email: "booking-test@example.com", phone: "0912345678" };

// ─── 主測試流程 ──────────────────────────────────────────────

async function main() {
  console.log(`\n=== Step 1 驗證：${TEST_MEMBER_ID} / ${TEST_DATE} ===\n`);

  // 建立測試會員（模擬既有 members 文件）
  await db.collection("members").doc(TEST_MEMBER_ID).set({
    accountType: "guest",
    contactHash: "test",
    name: "__booking_test__ 測試會員",
    createdAt: FieldValue.serverTimestamp(),
  });

  // ── Test A：容量搶位（7/8 已滿前一位，兩個同時搶最後一位）──────
  const slotA = { date: TEST_DATE, startTime: "10:00", endTime: "11:00" };
  await db.collection("bookingSlotCounts").doc(slotKeyOf(slotA.date, slotA.startTime)).set({ count: 7, blocked: false });
  createdCounterKeys.add(slotKeyOf(slotA.date, slotA.startTime));

  const [raceA, raceB] = await Promise.all([
    createBookingAdmin(TEST_MEMBER_ID, "測試會員", CONTACT, "general", slotA.date, slotA.startTime, slotA.endTime, "online", "race-A"),
    createBookingAdmin(TEST_MEMBER_ID, "測試會員", CONTACT, "general", slotA.date, slotA.startTime, slotA.endTime, "online", "race-B"),
  ]);
  const raceResults = [raceA, raceB];
  const successes = raceResults.filter(r => r.ok);
  const failures  = raceResults.filter(r => !r.ok);
  ok("Test A：兩個同時搶最後一位，剛好只有一人成功", successes.length === 1 && failures.length === 1,
    `(成功:${successes.length} 失敗:${failures.length})`);
  ok("Test A：失敗那邊的原因是「已經滿了」", failures[0]?.reason?.includes("已經滿了"), `(reason=${failures[0]?.reason})`);

  const counterAfterRace = await db.collection("bookingSlotCounts").doc(slotKeyOf(slotA.date, slotA.startTime)).get();
  ok("Test A：搶位後 counter.count === 8（不會超賣）", counterAfterRace.data()?.count === 8, `(count=${counterAfterRace.data()?.count})`);

  const winningBookingId = successes[0].id;

  // ── Test B：30 分鐘最短前置時間規則 ─────────────────────────
  const tooSoon = taipeiDateTimeAfter(10); // 10 分鐘後開始，應該被擋
  const bTooSoon = await createBookingAdmin(TEST_MEMBER_ID, "測試會員", CONTACT, "general", tooSoon.date, tooSoon.time, "11:00", "online", "leadtime-too-soon");
  ok("Test B：不到30分鐘的時段被後端擋下", bTooSoon.ok === false && bTooSoon.reason?.includes("30分鐘"), `(result=${JSON.stringify(bTooSoon)})`);

  // 「超過30分鐘應該放行」用固定的假日期時段（TEST_DATE 20:00），跟真實資料完全隔開，
  // 不用真的算「now+60分鐘」——那樣反而會去動到當天真實時段的 bookingSlotCounts。
  const slotLeadOk = { date: TEST_DATE, startTime: "20:00", endTime: "21:00" };
  const bFarEnough = await createBookingAdmin(TEST_MEMBER_ID, "測試會員", CONTACT, "general", slotLeadOk.date, slotLeadOk.startTime, slotLeadOk.endTime, "online", "leadtime-ok");
  createdCounterKeys.add(slotKeyOf(slotLeadOk.date, slotLeadOk.startTime));
  ok("Test B：超過30分鐘的時段沒有被 lead-time 規則擋下", bFarEnough.ok === true, `(result=${JSON.stringify(bFarEnough)})`);
  if (bFarEnough.ok) {
    // 這筆不是本次測試核心，取消掉釋放名額，保持乾淨
    await cancelBookingAdmin(bFarEnough.id);
  }

  // ── Test C：取消 → totalBookings / slot counter 正確扣回去 ──
  const memberBeforeCancel = await db.collection("members").doc(TEST_MEMBER_ID).get();
  const totalBeforeCancel = memberBeforeCancel.data()?.bookingStats?.totalBookings || 0;

  const cancelResult = await cancelBookingAdmin(winningBookingId);
  ok("Test C：cancelBooking 回傳成功", cancelResult.ok === true, `(result=${JSON.stringify(cancelResult)})`);

  const counterAfterCancel = await db.collection("bookingSlotCounts").doc(slotKeyOf(slotA.date, slotA.startTime)).get();
  ok("Test C：取消後 slot counter 從 8 扣回 7", counterAfterCancel.data()?.count === 7, `(count=${counterAfterCancel.data()?.count})`);

  const memberAfterCancel = await db.collection("members").doc(TEST_MEMBER_ID).get();
  const totalAfterCancel = memberAfterCancel.data()?.bookingStats?.totalBookings || 0;
  ok("Test C：取消後 totalBookings 正確扣回 -1", totalAfterCancel === totalBeforeCancel - 1,
    `(before=${totalBeforeCancel} after=${totalAfterCancel})`);

  const cancelledBookingSnap = await db.collection("bookings").doc(winningBookingId).get();
  ok("Test C：該筆預約 status 變成 cancelled", cancelledBookingSnap.data()?.status === "cancelled");

  // ── Test D：改期 → 舊時段 -1、新時段 +1（同一 transaction），totalBookings 淨變化 0 ──
  const slotB = { date: TEST_DATE, startTime: "14:00", endTime: "15:00" };
  const slotC = { date: TEST_DATE, startTime: "15:00", endTime: "16:00" };

  const createForReschedule = await createBookingAdmin(TEST_MEMBER_ID, "測試會員", CONTACT, "general", slotB.date, slotB.startTime, slotB.endTime, "online", "reschedule-origin");
  ok("Test D：改期前置作業——先在 slotB 建立一筆預約成功", createForReschedule.ok === true);

  const totalBeforeReschedule = (await db.collection("members").doc(TEST_MEMBER_ID).get()).data()?.bookingStats?.totalBookings || 0;

  const rescheduleResult = await rescheduleBookingAdmin(createForReschedule.id, slotC.date, slotC.startTime, slotC.endTime);
  ok("Test D：rescheduleBooking 回傳成功", rescheduleResult.ok === true, `(result=${JSON.stringify(rescheduleResult)})`);

  const slotBCounterAfter = await db.collection("bookingSlotCounts").doc(slotKeyOf(slotB.date, slotB.startTime)).get();
  const slotCCounterAfter = await db.collection("bookingSlotCounts").doc(slotKeyOf(slotC.date, slotC.startTime)).get();
  ok("Test D：舊時段（slotB）count 釋放回 0", slotBCounterAfter.data()?.count === 0, `(count=${slotBCounterAfter.data()?.count})`);
  ok("Test D：新時段（slotC）count 鎖定為 1", slotCCounterAfter.data()?.count === 1, `(count=${slotCCounterAfter.data()?.count})`);

  const oldBookingAfterReschedule = await db.collection("bookings").doc(createForReschedule.id).get();
  ok("Test D：舊預約文件被標記 cancelled", oldBookingAfterReschedule.data()?.status === "cancelled");

  const newBookingAfterReschedule = await db.collection("bookings").doc(rescheduleResult.id).get();
  ok("Test D：新預約文件 rescheduledFrom 指回原本那筆", newBookingAfterReschedule.data()?.rescheduledFrom === createForReschedule.id);
  ok("Test D：新預約文件 status 是 confirmed", newBookingAfterReschedule.data()?.status === "confirmed");

  const totalAfterReschedule = (await db.collection("members").doc(TEST_MEMBER_ID).get()).data()?.bookingStats?.totalBookings || 0;
  ok("Test D：改期後 totalBookings 淨變化為 0", totalAfterReschedule === totalBeforeReschedule,
    `(before=${totalBeforeReschedule} after=${totalAfterReschedule})`);

  // 收尾：取消掉改期後留下的那筆 confirmed 預約，讓 totalBookings 乾淨歸零好驗證
  await cancelBookingAdmin(rescheduleResult.id);

  // ── Test E：3小時預約併發搶最後一格時段（多時段版本的全有全無保證）──────
  // 用 16:00/17:00/18:00 三個 key（跟 Test A-D 用過的 10/14/15/20:00 完全不重疊，避免互相污染）。
  // 中間那格（17:00）預先設成 7/8（只差最後一位），兩端（16:00/18:00）還很空（3/8）。
  // 兩個「9:00~12:00 概念相同、時段換成 16:00~19:00」的 3 小時預約同時搶 17:00 這最後一位：
  // 應該剛好一個成功、一個失敗，而且失敗那個絕對不能在 16:00 或 18:00 留下任何殘留 +1
  // （這才是「N 個格子全有全無」跟「單一格子全有全無」的差異所在——多一個格子失敗的機會，
  //  但保證仍然要成立：只要有 1 格失敗，其他 2 格也一格都不能寫入）。
  const slotEStart  = { date: TEST_DATE, startTime: "16:00" };
  const slotEMid    = { date: TEST_DATE, startTime: "17:00" }; // 只差最後一位的瓶頸格
  const slotEEnd    = { date: TEST_DATE, startTime: "18:00" };
  const slotEKeys   = [slotEStart, slotEMid, slotEEnd].map(s => slotKeyOf(s.date, s.startTime));

  await db.collection("bookingSlotCounts").doc(slotEKeys[0]).set({ count: 3, blocked: false, newCount: 1, returningCount: 2 });
  await db.collection("bookingSlotCounts").doc(slotEKeys[1]).set({ count: 7, blocked: false, newCount: 2, returningCount: 5 });
  await db.collection("bookingSlotCounts").doc(slotEKeys[2]).set({ count: 3, blocked: false, newCount: 0, returningCount: 3 });
  slotEKeys.forEach(k => createdCounterKeys.add(k));

  const [raceE1, raceE2] = await Promise.all([
    createBookingMultiAdmin(TEST_MEMBER_ID, "測試會員", CONTACT, "general", 3, true, slotEStart.date, slotEStart.startTime, "19:00", "online", "race-E1"),
    createBookingMultiAdmin(TEST_MEMBER_ID, "測試會員", CONTACT, "general", 3, true, slotEStart.date, slotEStart.startTime, "19:00", "online", "race-E2"),
  ]);
  const raceEResults  = [raceE1, raceE2];
  const eSuccesses    = raceEResults.filter(r => r.ok);
  const eFailures     = raceEResults.filter(r => !r.ok);

  ok("Test E：兩個 3 小時預約同時搶最後一位，剛好只有一人成功", eSuccesses.length === 1 && eFailures.length === 1,
    `(成功:${eSuccesses.length} 失敗:${eFailures.length})`);
  ok("Test E：失敗那邊的原因是「已經滿了」", eFailures[0]?.reason?.includes("已經滿了"), `(reason=${eFailures[0]?.reason})`);

  const [counterEStart, counterEMid, counterEEnd] = await Promise.all(
    slotEKeys.map(k => db.collection("bookingSlotCounts").doc(k).get())
  );
  // 贏家把 3 格都各自 +1：起點 3→4、瓶頸格 7→8、終點 3→4。
  // 輸家完全沒有寫入——若輸家有任何殘留寫入，起點/終點會變成 5（多寫了 2 次）而不是正確的 4，
  // 這正是「N 個格子全有全無」在真正 Firestore transaction 上是否成立的關鍵斷言。
  ok("Test E：起點格（16:00）count 正確變成 4（不多不少，沒有輸家殘留）",
    counterEStart.data()?.count === 4, `(count=${counterEStart.data()?.count})`);
  ok("Test E：瓶頸格（17:00）count 正確變成 8（不會超賣）",
    counterEMid.data()?.count === 8, `(count=${counterEMid.data()?.count})`);
  ok("Test E：終點格（18:00）count 正確變成 4（不多不少，沒有輸家殘留）",
    counterEEnd.data()?.count === 4, `(count=${counterEEnd.data()?.count})`);
  ok("Test E：起點格 newCount 正確 +1（1→2，兩個測試預約都是 isNewStudent=true，只有贏家那筆算數）",
    counterEStart.data()?.newCount === 2, `(newCount=${counterEStart.data()?.newCount})`);
  ok("Test E：瓶頸格 newCount 正確 +1（2→3）",
    counterEMid.data()?.newCount === 3, `(newCount=${counterEMid.data()?.newCount})`);
  ok("Test E：終點格 newCount 正確 +1（0→1）",
    counterEEnd.data()?.newCount === 1, `(newCount=${counterEEnd.data()?.newCount})`);

  // 贏家那筆的 bookingId 記在 createdBookingIds（createBookingMultiAdmin 內部已加），
  // 不需要額外取消——收尾清理會連同 bookings/bookingSlotCounts 一起刪掉。

  // ── 清理所有測試資料 ─────────────────────────────────────────
  console.log("\n=== 清理測試資料 ===");
  for (const id of createdBookingIds) {
    await db.collection("bookings").doc(id).delete();
  }
  for (const key of createdCounterKeys) {
    await db.collection("bookingSlotCounts").doc(key).delete();
  }
  await db.collection("members").doc(TEST_MEMBER_ID).delete();
  console.log(`已刪除 ${createdBookingIds.size} 筆測試 bookings、${createdCounterKeys.size} 筆測試 bookingSlotCounts、1 筆測試 member`);

  // ── 最終確認：查詢有沒有殘留的 __booking_test__ 資料 ─────────
  console.log("\n=== 最終殘留檢查 ===");
  const leftoverMember = await db.collection("members").doc(TEST_MEMBER_ID).get();
  ok("清理驗證：測試 member 文件已不存在", !leftoverMember.exists);

  const leftoverBookings = await db.collection("bookings").where("memberId", "==", TEST_MEMBER_ID).get();
  ok("清理驗證：沒有殘留任何測試 bookings 文件", leftoverBookings.empty, `(殘留 ${leftoverBookings.size} 筆)`);

  let leftoverCounters = 0;
  for (const key of createdCounterKeys) {
    const snap = await db.collection("bookingSlotCounts").doc(key).get();
    if (snap.exists) leftoverCounters++;
  }
  ok("清理驗證：沒有殘留任何測試 bookingSlotCounts 文件", leftoverCounters === 0, `(殘留 ${leftoverCounters} 筆)`);

  console.log(`\n=== 測試結果：${pass} 通過 / ${fail} 失敗 ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error("測試腳本執行失敗：", e);
  process.exit(1);
});
