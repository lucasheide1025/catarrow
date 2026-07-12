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

// 時數選項（07-10-booking-multihour-and-stats + 後續加2小時）
export const DURATION_OPTIONS = [
  { value: 1, label: "1小時" },
  { value: 2, label: "2小時" },
  { value: 3, label: "3小時（2送1）" },
];

// 方案類別 × 時數 → 價格（NT$）。2小時刻意「收費不變」＝直接是1小時的2倍，沒有折扣
// （3小時「2送1」才是折扣價）。這份數字要跟 BillingSystem.jsx 的 PLANS 常數保持一致——
// 那邊是給「結帳寫進會計系統」用的方案代碼+價格，這邊是給「預約當下顯示金額」用的純價格表，
// 兩處各自獨立維護但數字必須對得上，之後改價記得兩邊都要改。
export const PLAN_PRICE = {
  general:       { 1: 300, 2: 600, 3: 600 },
  discount:      { 1: 200, 2: 400, 3: 400 },
  own_equipment: { 1: 200, 2: 400, 3: 400 },
};

// 單價 × 人數＝總金額（07-10-booking-ui-polish-headcount：確認預約畫面要顯示自動加總的金額）
export function totalPrice(planType, durationHours, participantCount = 1) {
  const unit = PLAN_PRICE[planType]?.[durationHours] ?? 0;
  return unit * Math.max(1, participantCount);
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

// 判斷某時段目前該顯示的狀態（唯讀顯示用，不是唯一防線——後端 bookingDb.js 一定會再檢查一次）。
// durationHours（07-10-booking-multihour-and-stats）：3小時方案要連續3格都能選。
// participantCount（07-10-booking-ui-polish-headcount，預設1）：選N人＝檢查「這一格＋延伸出去的每一格」
// 扣掉目前已佔用的，剩餘名額是否還能塞得下N人，塞不下要直接disabled，不是選了才在送出時失敗。
// 顯示的統計數字（新X／舊X）仍然是這一格自己的即時人數，不是跨格加總。
export function slotState(date, startTime, slotCounts, durationHours = 1, participantCount = 1) {
  const slotStartMs = new Date(date + "T" + startTime + ":00+08:00").getTime();
  if (slotStartMs - Date.now() < 30 * 60 * 1000) {
    return { state: "too_soon", label: "已截止", disabled: true };
  }

  const localKey  = date + "_" + startTime;
  const localInfo = slotCounts[localKey] || {};
  const count          = localInfo.count || 0;
  const newCount        = localInfo.newCount || 0;
  const returningCount  = localInfo.returningCount || 0;
  const countLabel = `新${newCount}／舊${returningCount}（共${count}/${LANE_CAPACITY}）`;

  if (localInfo.blocked)                              return { state: "blocked", label: "教練暫停", disabled: true };
  if (count + participantCount > LANE_CAPACITY)        return { state: "full", label: countLabel + "・人數超過剩餘名額", disabled: true };

  // 多時段方案（1小時以上）：起點本身沒問題，但延伸出去的格子若有任一格容量不夠（含人數），這個起點也不能選
  if (durationHours > 1) {
    const [h, m] = startTime.split(":").map(Number);
    const mm = m === 0 ? "00" : String(m).padStart(2, "0");
    for (let i = 1; i < durationHours; i++) {
      const key = `${date}_${String(h + i).padStart(2, "0")}:${mm}`;
      const c = slotCounts[key] || {};
      if (c.blocked || (c.count || 0) + participantCount > LANE_CAPACITY) {
        return { state: "span_unavailable", label: countLabel + "・延伸時段名額不足", disabled: true };
      }
    }
  }

  return { state: "available", label: countLabel, disabled: false };
}
