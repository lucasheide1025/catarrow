// src/lib/bookingSchedule.js
// 線上約課系統的營業時段格線 + 容量/封鎖顯示用唯讀查詢（07-10-booking-system-student-pilot）
//
// 這個檔案只負責「畫格子」（算出有哪些時段、時段目前顯示什麼狀態），
// 不包含任何預約寫入邏輯——建立/取消/改期一律呼叫 bookingDb.js 對應函式
// （createBooking/cancelBooking/rescheduleBooking/blockSlot/unblockSlot），
// 容量正確性完全由那邊的 runTransaction 保護，這裡的讀取只是唯讀顯示用，
// 實際寫入時 bookingDb.js 內部一定會再檢查一次，不能只靠這裡的顯示狀態當防線。
import { collection, query, where, getDocs, documentId } from "firebase/firestore";
import { db } from "./firebase";
import {
  BOOKING_DURATIONS,
  BOOKING_PLAN_TYPES,
  BOOKING_PRICES,
  bookingTotalPrice,
  normalizeParticipantBreakdown,
} from "./bookingPricing";

const SLOT_COUNTS = "bookingSlotCounts";

// slotState 已抽到 bookingSlotState.js（純邏輯、不含 firebase 相依，才測得到）。
// 這裡再匯出，既有 import 路徑不用全部改。
export { slotState } from "./bookingSlotState";

// 方案類別（design.md 資料模型章節）
export const PLAN_TYPES = BOOKING_PLAN_TYPES;

// 時數選項（07-10-booking-multihour-and-stats + 後續加2小時）
export const DURATION_OPTIONS = BOOKING_DURATIONS;

// 方案類別 × 時數 → 價格（NT$）。3小時與2小時同價，但保留兩種時數讓行程較短的人不必
// 佔滿三小時；舊的「2送1」文案已隨新價移除。價格的單一來源是 bookingPricing.js，
// 前台顯示、後台結帳代碼與報到開帳單全部從那裡推導，不要在任何地方另抄一份數字。
export const PLAN_PRICE = BOOKING_PRICES;

// 單價 × 人數＝總金額（07-10-booking-ui-polish-headcount：確認預約畫面要顯示自動加總的金額）
export function totalPrice(planType, durationHours, participantCount = 1) {
  const breakdown = normalizeParticipantBreakdown(null, { planType, participantCount });
  return bookingTotalPrice(breakdown, durationHours);
}

// 方案類別 × 時數 攤平成一份「組合選單」，前台三個入口共用同一份，不要各自重刻選單邏輯。
export const COMBINED_PLAN_OPTIONS = PLAN_TYPES.flatMap(pt =>
  DURATION_OPTIONS.map(d => ({
    planType: pt.id,
    durationHours: d.value,
    label: `${pt.label}・${d.label}`,
    price: PLAN_PRICE[pt.id][d.value],
  }))
);

// 時數的顯示文字，統一從 DURATION_OPTIONS 找，不要在各個元件裡各自寫死 1/2/3 的三元判斷
// （新增2小時之前，好幾個地方都各自寫了 `durationHours===3 ? "3小時" : "1小時"` 這種只認識兩種值
// 的寫法，現在多了2小時，全部要改用這個函式，之後再加時數選項也不用到處補判斷式）。
export function durationLabel(hours) {
  return DURATION_OPTIONS.find(d => d.value === hours)?.label || `${hours}小時`;
}

// 依起始時間＋時數，算出 "HH:mm" 格式的結束時間（design.md §1：endTime 依 durationHours 計算）
export function computeEndTime(startTime, durationHours) {
  const [h, m] = startTime.split(":").map(Number);
  return `${String(h + durationHours).padStart(2, "0")}:${m === 0 ? "00" : String(m).padStart(2, "0")}`;
}

// 場地在台北，全站沿用同一個時區假設（跟 bookingDb.js 的 30 分鐘檢查一致）
const VENUE_TZ = "Asia/Taipei";

function pad2(n) {
  return String(n).padStart(2, "0");
}

// 回傳 "YYYY-MM-DD" 格式（台北時區的今天）
export function todayStr() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: VENUE_TZ });
}

function dateObjOf(dateStr) {
  return new Date(dateStr + "T00:00:00+08:00");
}

// getDay(): 0=Sun,1=Mon,...,6=Sat。營業時間：週一公休。
export function isBusinessDay(dateStr) {
  return dateObjOf(dateStr).getDay() !== 1;
}

// 週三～週日 10:00-22:00（12 格）；週二 13:00-22:00（9 格）；週一公休（0 格）
export function slotsForDate(dateStr) {
  const dow = dateObjOf(dateStr).getDay();
  if (dow === 1) return [];
  const startHour = dow === 2 ? 13 : 10;
  const list = [];
  for (let h = startHour; h < 22; h++) {
    list.push({ startTime: pad2(h) + ":00", endTime: pad2(h + 1) + ":00" });
  }
  return list;
}

export function addDays(dateStr, n) {
  const d = dateObjOf(dateStr);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE", { timeZone: VENUE_TZ });
}

// Public booking window: same calendar day next month, clamped to that month's last day.
export function addOneMonth(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const targetMonthIndex = month; // JS months are zero-based, so current 1-based month means +1 month.
  const lastDay = new Date(Date.UTC(year, targetMonthIndex + 1, 0)).getUTCDate();
  return `${targetMonthIndex >= 12 ? year + 1 : year}-${pad2((targetMonthIndex % 12) + 1)}-${pad2(Math.min(day, lastDay))}`;
}

// 該日期所在週的週一日期（供教練後台週檢視用）
export function startOfWeek(dateStr) {
  const dow = dateObjOf(dateStr).getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, diff);
}

// 讀取一段日期範圍（含頭尾）內所有時段的容量計數（{count, blocked}），
// 供 UI 顯示可選/已滿/封鎖狀態用。slotKey = "YYYY-MM-DD_HH:mm"，
// 文件 ID 本身可字典序排序，用 documentId() range query 一次查完整段範圍，
// 上界用「隔天日期的前綴」當 exclusive 邊界，不需要逐日個別查
// （bounded read，同一個 App 既有的 Firestore 成本教訓）。
export async function fetchSlotCountsForRange(startDate, endDate) {
  try {
    const upperExclusive = addDays(endDate, 1) + "_";
    const snap = await getDocs(query(
      collection(db, SLOT_COUNTS),
      where(documentId(), ">=", startDate + "_"),
      where(documentId(), "<", upperExclusive),
    ));
    const map = {};
    snap.docs.forEach(d => { map[d.id] = d.data() || {}; });
    return map;
  } catch (e) {
    console.error("[fetchSlotCountsForRange]", e);
    // 讀不到容量時「回傳空物件」等於告訴畫面「每個時段都沒人」，未登入的訪客會看到全部
    // 時段都可預約，選到已額滿的時段，直到最後送出才被 transaction 擋下來（實際發生過：
    // bookingSlotCounts 規則要求 isLoggedIn，訪客在登入前就會踩到）。
    // 用 null 明確表示「未知」，讓呼叫端顯示「無法查詢名額」而不是假裝有空位。
    return null;
  }
}

