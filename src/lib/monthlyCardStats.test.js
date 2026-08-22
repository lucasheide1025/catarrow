import {
  existingMonthlyCardPurchaseCount,
  getMonthlyCardStatus,
  getUsableMonthlyCardSessions,
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

test("class end sees only active unexpired monthly-card sessions", () => {
  const now = 1_700_000_000_000;
  expect(getUsableMonthlyCardSessions(null, now)).toBe(0);
  expect(getUsableMonthlyCardSessions({ active:false, sessions:5, expiresAt:{ seconds:(now + 86400000) / 1000 } }, now)).toBe(0);
  expect(getUsableMonthlyCardSessions({ active:true, sessions:5, expiresAt:{ seconds:(now - 1000) / 1000 } }, now)).toBe(0);
  expect(getUsableMonthlyCardSessions({ active:true, sessions:2, expiresAt:{ seconds:(now + 86400000) / 1000 } }, now)).toBe(2);
});

test("monthly card status exposes remaining hours and expiry for serialized timestamps", () => {
  const now = 1_700_000_000_000;
  const status = getMonthlyCardStatus({
    active:true,
    sessions:7,
    expiresAt:{ seconds:(now + (5 * 86400000)) / 1000, nanoseconds:0 },
  }, now);
  expect(status).toMatchObject({ hasCard:true, state:"usable", sessions:7, usableSessions:7, daysRemaining:5 });
  expect(status.expiresMs).toBe(now + (5 * 86400000));
});
