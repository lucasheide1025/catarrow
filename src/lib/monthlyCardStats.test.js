import {
  existingMonthlyCardPurchaseCount,
  nextMonthlyCardPurchaseCounters,
  purchaseCountFromMonthlyCardLogs,
} from "./monthlyCardStats";

test("monthly card first purchase starts permanent counters", () => {
  expect(nextMonthlyCardPurchaseCounters(null)).toEqual({ purchaseCount:1, renewCount:0, isRenew:false });
});

test("expired or exhausted legacy card is still treated as a prior purchase", () => {
  const legacy = { active:false, sessions:0, startedAt:{ seconds:1 } };
  expect(existingMonthlyCardPurchaseCount(legacy)).toBe(1);
  expect(nextMonthlyCardPurchaseCounters(legacy)).toEqual({ purchaseCount:2, renewCount:1, isRenew:true });
});

test("existing permanent renewCount remains a lower-bound purchase history", () => {
  const card = { active:false, sessions:0, renewCount:2, startedAt:{ seconds:1 } };
  expect(existingMonthlyCardPurchaseCount(card)).toBe(3);
  expect(nextMonthlyCardPurchaseCounters(card)).toEqual({ purchaseCount:4, renewCount:3, isRenew:true });
});

test("repair derivation counts only paid purchase and renew logs", () => {
  expect(purchaseCountFromMonthlyCardLogs([
    { action:"purchase" }, { action:"purchase" }, { action:"renew" },
    { action:"gift_sessions" }, { action:"use_approved" },
  ])).toBe(3);
});
