import {
  bookingTotalPrice,
  firstReturningCounts,
  legacyPlanTypeFor,
  normalizeParticipantBreakdown,
  participantTotal,
} from "./bookingPricing";

test("混合同行依三類人數正確計算價格", () => {
  const party = { general: 2, discount: 1, own_equipment: 1 };
  expect(participantTotal(party)).toBe(4);
  expect(bookingTotalPrice(party, 1)).toBe(1200);
  expect(bookingTotalPrice(party, 2)).toBe(2200);
  expect(bookingTotalPrice(party, 3)).toBe(2200);
});

test("舊預約可轉成單一類別人數", () => {
  expect(normalizeParticipantBreakdown(null, {
    planType: "discount",
    participantCount: 3,
  })).toEqual({ general: 0, discount: 3, own_equipment: 0 });
});

test("第一次與回訪人數固定等於同行總數", () => {
  expect(firstReturningCounts({ participantCount: 4, firstTimeCount: 1 }))
    .toEqual({ firstTimeCount: 1, returningCount: 3 });
  expect(firstReturningCounts({ participantCount: 2, isNewStudent: true }))
    .toEqual({ firstTimeCount: 2, returningCount: 0 });
});

test("舊 planType 使用第一個有人的類別相容", () => {
  expect(legacyPlanTypeFor({ general: 0, discount: 2, own_equipment: 1 })).toBe("discount");
});
