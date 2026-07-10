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
import { LANE_CAPACITY } from "./bookingDb";

const SLOT_COUNTS = "bookingSlotCounts";

// 方案類別（design.md 資料模型章節）
export const PLAN_TYPES = [
  { id: "general",       label: "單人一般" },
  { id: "discount",      label: "兒童／學生／敬老" },
  { id: "own_equipment", label: "自備器材" },
];

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
    return {};
  }
}

// 判斷某時段目前該顯示的狀態（唯讀顯示用，不是唯一防線——後端 bookingDb.js 一定會再檢查一次）
export function slotState(date, startTime, slotCounts) {
  const slotKey = date + "_" + startTime;
  const info = slotCounts[slotKey] || { count: 0, blocked: false };
  const slotStartMs = new Date(date + "T" + startTime + ":00+08:00").getTime();
  if (slotStartMs - Date.now() < 30 * 60 * 1000) {
    return { state: "too_soon", label: "已截止", disabled: true };
  }
  if (info.blocked) return { state: "blocked", label: "教練暫停", disabled: true };
  const count = info.count || 0;
  if (count >= LANE_CAPACITY) return { state: "full", label: "已滿", disabled: true };
  return { state: "available", label: count + "/" + LANE_CAPACITY, disabled: false };
}
