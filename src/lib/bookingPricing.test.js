import {
  BILLING_PLANS,
  BILLING_PLAN_CODES,
  BOOKING_DURATIONS,
  CHECKIN_PLANS_EQUIP,
  CHECKIN_PLANS_NO_EQUIP,
  BOOKING_PLAN_TYPES,
  BOOKING_PRICES,
  EARLY_BIRD_DISC,
  EARLY_BIRD_MAX,
  bookingTotalPrice,
  billingPlanPrice,
  finalBillPrice,
  firstReturningCounts,
  isEarlyBirdArcher,
  legacyPlanTypeFor,
  normalizeParticipantBreakdown,
  participantTotal,
  validatePartySize,
} from "./bookingPricing";

const LANE_CAPACITY = 8; // 對齊 bookingDb.LANE_CAPACITY（那邊 import firebase，測試不載入）

// ── 價格 ───────────────────────────────────────────────────────────────────
test("混合同行依三類人數正確計算價格", () => {
  const party = { general: 2, discount: 1, own_equipment: 1 };
  expect(participantTotal(party)).toBe(4);
  expect(bookingTotalPrice(party, 1)).toBe(1200);
  expect(bookingTotalPrice(party, 2)).toBe(2200);
  expect(bookingTotalPrice(party, 3)).toBe(2200);
});

test("2小時與3小時同價，且1小時的兩倍不等於折扣", () => {
  for (const plan of BOOKING_PLAN_TYPES) {
    const p = BOOKING_PRICES[plan.id];
    expect(p[3]).toBe(p[2]);
    expect(p[2]).toBeLessThan(p[1] * 2 + 1); // 沒有比兩倍更貴
  }
});

test("已確認的公開價目表", () => {
  expect(BOOKING_PRICES).toEqual({
    general:       { 1: 350, 2: 650, 3: 650 },
    discount:      { 1: 250, 2: 450, 3: 450 },
    own_equipment: { 1: 250, 2: 450, 3: 450 },
  });
});

test("空的同行人數總價為 0，不會變成 NaN", () => {
  expect(bookingTotalPrice({ general: 0, discount: 0, own_equipment: 0 }, 1)).toBe(0);
  expect(bookingTotalPrice({ general: 1 }, 99)).toBe(0); // 沒有的時數 → 0，不是 NaN
});

// ── 後台結帳價格必須與預約價格同源 ─────────────────────────────────────────
// 這組測試是為了擋「價格表被抄成好幾份、改價時漏改其中一份」。
// AdminDailyQuest.jsx 的單一 300／自訂一小時 200 就是這樣留下來的。
test("後台結帳方案代號涵蓋三方案 × 三時數，沒有遺漏或重複", () => {
  expect(BILLING_PLAN_CODES).toHaveLength(
    BOOKING_PLAN_TYPES.length * BOOKING_DURATIONS.length,
  );
  const ids = BILLING_PLAN_CODES.map(c => c.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const plan of BOOKING_PLAN_TYPES) {
    for (const d of BOOKING_DURATIONS) {
      const hit = BILLING_PLAN_CODES.filter(
        c => c.planType === plan.id && c.hours === d.value,
      );
      expect(hit).toHaveLength(1);
    }
  }
});

test("後台結帳每個方案代號的價格都等於預約價目表", () => {
  for (const code of BILLING_PLAN_CODES) {
    expect(billingPlanPrice(code.id)).toBe(BOOKING_PRICES[code.planType][code.hours]);
  }
  expect(BILLING_PLANS).toEqual([
    { id: "自一", price: 250 },
    { id: "自二", price: 450 },
    { id: "自三", price: 450 },
    { id: "單一", price: 350 },
    { id: "單二", price: 650 },
    { id: "單三", price: 650 },
    { id: "學一", price: 250 },
    { id: "學二", price: 450 },
    { id: "學三", price: 450 },
  ]);
});

test("未知的方案代號回 0，不會回 undefined 汙染金額", () => {
  expect(billingPlanPrice("不存在")).toBe(0);
  expect(billingPlanPrice(undefined)).toBe(0);
});

test("報到開帳單的方案價格同樣等於預約價目表", () => {
  expect(CHECKIN_PLANS_EQUIP).toEqual([
    { id: "自訂一小時", price: 250 },
    { id: "自訂二小時", price: 450 },
    { id: "自訂三小時", price: 450 },
    { id: "月卡",       price: 0 },
  ]);
  expect(CHECKIN_PLANS_NO_EQUIP).toEqual([
    { id: "單一", price: 350 },
    { id: "單二", price: 650 },
    { id: "單三", price: 650 },
  ]);
});

test("報到開帳單三種時數都有，且不再有與早鳥機制重複的方案", () => {
  for (const plans of [CHECKIN_PLANS_EQUIP, CHECKIN_PLANS_NO_EQUIP]) {
    // 月卡不算時數方案
    expect(plans.filter(p => p.id !== "月卡")).toHaveLength(BOOKING_DURATIONS.length);
    expect(plans.map(p => p.id)).not.toContain("早鳥折扣");
  }
});

test("報到開帳單的預設方案（清單第一項）是 1 小時而非月卡", () => {
  // openBill() 在會員沒有 defaultPlan 時會退回 plans[0]
  expect(CHECKIN_PLANS_EQUIP[0].id).toBe("自訂一小時");
  expect(CHECKIN_PLANS_NO_EQUIP[0].id).toBe("單一");
});

// ── 早鳥折扣：每筆帳單只折一次 ─────────────────────────────────────────────
test("射手編號 1～123 才是早鳥", () => {
  expect(isEarlyBirdArcher(1)).toBe(true);
  expect(isEarlyBirdArcher(EARLY_BIRD_MAX)).toBe(true);
  expect(isEarlyBirdArcher(EARLY_BIRD_MAX + 1)).toBe(false);
  expect(isEarlyBirdArcher(0)).toBe(false);
  expect(isEarlyBirdArcher(-5)).toBe(false);
  expect(isEarlyBirdArcher(null)).toBe(false);
  expect(isEarlyBirdArcher(undefined)).toBe(false);
  expect(isEarlyBirdArcher("")).toBe(false);
  expect(isEarlyBirdArcher("77")).toBe(true); // Firestore 可能存字串
});

test("早鳥折抵綁帳單而非人數，混合同行 4 人也只折一次 50", () => {
  const party = { general: 2, discount: 1, own_equipment: 1 };
  const basePrice = bookingTotalPrice(party, 1); // 1200
  expect(finalBillPrice({ basePrice, earlyBird: true, payMethod: "現金" }))
    .toBe(basePrice - EARLY_BIRD_DISC);
  // 若誤寫成每人折 50，4 人會變成 -200
  expect(finalBillPrice({ basePrice, earlyBird: true, payMethod: "現金" }))
    .not.toBe(basePrice - EARLY_BIRD_DISC * 4);
});

test("月卡實收 0，且不與早鳥疊加", () => {
  expect(finalBillPrice({ basePrice: 650, earlyBird: false, payMethod: "月卡" })).toBe(0);
  expect(finalBillPrice({ basePrice: 650, earlyBird: true, payMethod: "月卡" })).toBe(0);
});

test("實收金額不會變成負數", () => {
  expect(finalBillPrice({ basePrice: 30, earlyBird: true, payMethod: "現金" })).toBe(0);
  expect(finalBillPrice({ basePrice: 0, earlyBird: true, payMethod: "現金" })).toBe(0);
  expect(finalBillPrice({ basePrice: undefined, earlyBird: true, payMethod: "現金" })).toBe(0);
});

// ── 容量：不得超收 8 人 ────────────────────────────────────────────────────
test("同行 1～8 人可通過，9 人整筆拒絕而非截成 8 人", () => {
  for (let n = 1; n <= LANE_CAPACITY; n++) {
    const result = validatePartySize({ general: n }, LANE_CAPACITY);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(n);
  }
  const over = validatePartySize({ general: LANE_CAPACITY + 1 }, LANE_CAPACITY);
  expect(over.ok).toBe(false);
  expect(over.count).toBe(LANE_CAPACITY + 1); // 保留真實人數，不回報被截斷的 8
});

test("混合同行的三類人數相加超過 8 也要擋下來", () => {
  expect(validatePartySize({ general: 4, discount: 4 }, LANE_CAPACITY).ok).toBe(true);
  expect(validatePartySize({ general: 4, discount: 4, own_equipment: 1 }, LANE_CAPACITY).ok)
    .toBe(false);
  expect(validatePartySize({ general: 3, discount: 3, own_equipment: 3 }, LANE_CAPACITY).ok)
    .toBe(false);
});

test("同行 0 人不成立", () => {
  expect(validatePartySize({ general: 0, discount: 0, own_equipment: 0 }, LANE_CAPACITY).ok)
    .toBe(false);
});

// ── 新舊生人數不變式 ───────────────────────────────────────────────────────
test("第一次與回訪人數固定等於同行總數", () => {
  expect(firstReturningCounts({ participantCount: 4, firstTimeCount: 1 }))
    .toEqual({ firstTimeCount: 1, returningCount: 3 });
  expect(firstReturningCounts({ participantCount: 2, isNewStudent: true }))
    .toEqual({ firstTimeCount: 2, returningCount: 0 });
});

test("不論輸入多離譜，firstTimeCount + returningCount 永遠等於總人數", () => {
  const inputs = [
    { participantCount: 5, firstTimeCount: 99 },   // 超過總數
    { participantCount: 5, firstTimeCount: -3 },   // 負數
    { participantCount: 5, firstTimeCount: 2.7 },  // 小數
    { participantCount: 5, firstTimeCount: "3" },  // 字串
    { participantCount: 5, firstTimeCount: null }, // null → 用 isNewStudent 判斷
    { participantCount: 5, firstTimeCount: NaN },
    { participantCount: 0, firstTimeCount: 0 },    // 總數會被夾成 1
    { participantCount: 3, isNewStudent: true, firstTimeCount: undefined },
  ];
  for (const input of inputs) {
    const { firstTimeCount, returningCount } = firstReturningCounts(input);
    const total = Math.max(1, Math.floor(Number(input.participantCount) || 1));
    expect(firstTimeCount + returningCount).toBe(total);
    expect(firstTimeCount).toBeGreaterThanOrEqual(0);
    expect(returningCount).toBeGreaterThanOrEqual(0);
  }
});

// ── 舊資料相容 ─────────────────────────────────────────────────────────────
test("舊預約可轉成單一類別人數", () => {
  expect(normalizeParticipantBreakdown(null, {
    planType: "discount",
    participantCount: 3,
  })).toEqual({ general: 0, discount: 3, own_equipment: 0 });
});

test("舊資料缺欄位或方案代號無效時退回一般體驗 1 人", () => {
  expect(normalizeParticipantBreakdown(null, {})).toEqual({
    general: 1, discount: 0, own_equipment: 0,
  });
  expect(normalizeParticipantBreakdown(null, { planType: "不存在", participantCount: 2 }))
    .toEqual({ general: 2, discount: 0, own_equipment: 0 });
});

test("人數欄位的負數、小數與字串都被正規化成非負整數", () => {
  expect(normalizeParticipantBreakdown({ general: -2, discount: 1.8, own_equipment: "3" }))
    .toEqual({ general: 0, discount: 1, own_equipment: 3 });
});

test("舊 planType 使用第一個有人的類別相容", () => {
  expect(legacyPlanTypeFor({ general: 0, discount: 2, own_equipment: 1 })).toBe("discount");
});

test("完全沒人時 legacyPlanTypeFor 仍回一般體驗，不回 undefined", () => {
  expect(legacyPlanTypeFor({ general: 0, discount: 0, own_equipment: 0 })).toBe("general");
});
