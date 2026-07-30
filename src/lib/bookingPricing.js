export const BOOKING_PLAN_TYPES = [
  { id: "general", label: "一般體驗" },
  { id: "discount", label: "兒童／學生／敬老" },
  { id: "own_equipment", label: "自備器材" },
];

export const BOOKING_DURATIONS = [
  { value: 1, label: "1小時" },
  { value: 2, label: "2小時" },
  { value: 3, label: "3小時" },
];

export const BOOKING_PRICES = {
  general: { 1: 350, 2: 650, 3: 650 },
  discount: { 1: 250, 2: 450, 3: 450 },
  own_equipment: { 1: 250, 2: 450, 3: 450 },
};

export const EMPTY_PARTICIPANT_BREAKDOWN = Object.freeze({
  general: 0,
  discount: 0,
  own_equipment: 0,
});

function safeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export function normalizeParticipantBreakdown(value, legacy = {}) {
  if (value && typeof value === "object") {
    return {
      general: safeCount(value.general),
      discount: safeCount(value.discount),
      own_equipment: safeCount(value.own_equipment),
    };
  }
  const planType = BOOKING_PRICES[legacy.planType] ? legacy.planType : "general";
  return {
    ...EMPTY_PARTICIPANT_BREAKDOWN,
    [planType]: Math.max(1, safeCount(legacy.participantCount) || 1),
  };
}

export function participantTotal(breakdown) {
  const normalized = normalizeParticipantBreakdown(breakdown);
  return Object.values(normalized).reduce((sum, count) => sum + count, 0);
}

export function firstReturningCounts({ firstTimeCount, participantCount, isNewStudent }) {
  const total = Math.max(1, safeCount(participantCount) || 1);
  const legacyFirst = isNewStudent ? total : 0;
  const first = Math.min(total, firstTimeCount == null ? legacyFirst : safeCount(firstTimeCount));
  return { firstTimeCount: first, returningCount: total - first };
}

// 同行總人數必須落在 1～max。超過一律整筆拒絕，不可無聲截斷成 max——截斷會少收後面幾個人
// 的錢，也會讓使用者以為全部人都訂到了。max 由呼叫端傳入（LANE_CAPACITY 定義在 bookingDb，
// 從這裡 import 會形成循環相依）。
export function validatePartySize(breakdown, max) {
  const count = participantTotal(breakdown);
  if (count < 1 || count > max) {
    return { ok: false, count, reason: `同行總人數需為 1～${max} 人` };
  }
  return { ok: true, count };
}

export function bookingTotalPrice(breakdown, durationHours) {
  const normalized = normalizeParticipantBreakdown(breakdown);
  return BOOKING_PLAN_TYPES.reduce(
    (sum, plan) => sum + normalized[plan.id] * (BOOKING_PRICES[plan.id]?.[durationHours] || 0),
    0,
  );
}

export function legacyPlanTypeFor(breakdown) {
  const normalized = normalizeParticipantBreakdown(breakdown);
  return BOOKING_PLAN_TYPES.find(plan => normalized[plan.id] > 0)?.id || "general";
}

export function participantBreakdownLabel(breakdown) {
  const normalized = normalizeParticipantBreakdown(breakdown);
  return BOOKING_PLAN_TYPES
    .filter(plan => normalized[plan.id] > 0)
    .map(plan => `${plan.label} ${normalized[plan.id]} 人`)
    .join("、");
}

// ── 後台結帳方案 ───────────────────────────────────────────────────────────
// `id` 是既有帳務紀錄 billingRecords.plan 欄位實際存進 Firestore 的字串，改名會對不上
// 歷史資料，只能沿用。價格一律從 BOOKING_PRICES 推導，不再各處手抄一份——
// AdminDailyQuest.jsx 的舊價（單一 300／自訂一小時 200）就是手抄後漏改留下來的。
export const BILLING_PLAN_CODES = [
  { id: "自一", planType: "own_equipment", hours: 1 },
  { id: "自二", planType: "own_equipment", hours: 2 },
  { id: "自三", planType: "own_equipment", hours: 3 },
  { id: "單一", planType: "general",       hours: 1 },
  { id: "單二", planType: "general",       hours: 2 },
  { id: "單三", planType: "general",       hours: 3 },
  { id: "學一", planType: "discount",      hours: 1 },
  { id: "學二", planType: "discount",      hours: 2 },
  { id: "學三", planType: "discount",      hours: 3 },
];

export function billingPlanPrice(planId) {
  const code = BILLING_PLAN_CODES.find(p => p.id === planId);
  return code ? BOOKING_PRICES[code.planType][code.hours] : 0;
}

export const BILLING_PLANS = BILLING_PLAN_CODES.map(code => ({
  id: code.id,
  price: billingPlanPrice(code.id),
}));

export const PAY_METHODS = ["現金", "轉帳", "月卡"];

// 報到核准後直接開帳單（AdminDailyQuest）用的方案清單。這條路徑的方案代號與上面的
// BILLING_PLAN_CODES 不同字串，但同樣是既有帳務紀錄實際存過的值，不可更名。
// 依會員是否已登記自備器材分成兩份，價格一律從 BOOKING_PRICES 推導。
// 這裡的「月卡」是方案而不是付款方式，實收 0。
export const CHECKIN_PLANS_EQUIP = [
  { id: "自訂一小時", price: billingPlanPrice("自一") },
  { id: "自訂二小時", price: billingPlanPrice("自二") },
  { id: "自訂三小時", price: billingPlanPrice("自三") },
  { id: "月卡",       price: 0 },
];

// 原本第一項是「早鳥折扣 200」，已移除：正式的早鳥制度是射手編號 1～123 每筆帳單
// 自動折抵 NT$50，同名方案是舊制殘留，兩者疊加會變成 150。歷史紀錄不受影響。
export const CHECKIN_PLANS_NO_EQUIP = [
  { id: "單一", price: billingPlanPrice("單一") },
  { id: "單二", price: billingPlanPrice("單二") },
  { id: "單三", price: billingPlanPrice("單三") },
];

// 射手編號 1～123 的既有優惠：每筆帳單折抵一次 NT$50。是「每筆帳單」而不是「每人」——
// 混合同行把多人算成一筆 basePrice，折抵仍只有一次，不隨人數倍增。
export const EARLY_BIRD_MAX = 123;
export const EARLY_BIRD_DISC = 50;

export function isEarlyBirdArcher(archerNo) {
  const no = Number(archerNo);
  return Number.isFinite(no) && no >= 1 && no <= EARLY_BIRD_MAX;
}

// 月卡走另一套方案，實收 0，且不套用早鳥折扣。
export function finalBillPrice({ basePrice, earlyBird = false, payMethod }) {
  if (payMethod === "月卡") return 0;
  const base = Math.max(0, Number(basePrice) || 0);
  return Math.max(0, base - (earlyBird ? EARLY_BIRD_DISC : 0));
}

