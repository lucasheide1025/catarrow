import { FREE_HUNT_DAILY_LIMIT, FREE_HUNT_QUOTA_MODE, FREE_HUNT_RESET_SCOPE, getFreeHuntRemaining, normalizeFreeHuntUsage, resetFreeHuntUsage } from "./freeHuntQuota";

test("Free Hunt single and multi quotas are independent and reset by Taipei date", () => {
  const date = new Date("2026-08-20T03:00:00.000Z"); // 11:00 Asia/Taipei
  const profile = { freeHuntUsage:{ date:"2026-08-20", single:4, multi:2 } };
  expect(normalizeFreeHuntUsage(profile, date)).toEqual({ date:"2026-08-20", single:4, multi:2 });
  expect(getFreeHuntRemaining(profile, FREE_HUNT_QUOTA_MODE.SINGLE, date)).toBe(1);
  expect(getFreeHuntRemaining(profile, FREE_HUNT_QUOTA_MODE.MULTI, date)).toBe(3);
  expect(FREE_HUNT_DAILY_LIMIT).toBe(5);
  expect(normalizeFreeHuntUsage({ freeHuntUsage:{ date:"2026-08-19", single:5, multi:5 } }, date)).toEqual({ date:"2026-08-20", single:0, multi:0 });
});

test("quota reset preserves the other current-day counter", () => {
  const date = new Date("2026-08-20T03:00:00.000Z");
  const usage = { date:"2026-08-20", single:4, multi:2 };
  expect(resetFreeHuntUsage(usage, FREE_HUNT_RESET_SCOPE.SINGLE, date)).toEqual({ date:"2026-08-20", single:0, multi:2 });
  expect(resetFreeHuntUsage(usage, FREE_HUNT_RESET_SCOPE.MULTI, date)).toEqual({ date:"2026-08-20", single:4, multi:0 });
  expect(resetFreeHuntUsage(usage, FREE_HUNT_RESET_SCOPE.ALL, date)).toEqual({ date:"2026-08-20", single:0, multi:0 });
});

test("quota reset normalizes stale usage before resetting", () => {
  const date = new Date("2026-08-20T03:00:00.000Z");
  const stale = { date:"2026-08-19", single:5, multi:3 };
  expect(resetFreeHuntUsage(stale, FREE_HUNT_RESET_SCOPE.SINGLE, date)).toEqual({ date:"2026-08-20", single:0, multi:0 });
  expect(resetFreeHuntUsage(stale, FREE_HUNT_RESET_SCOPE.MULTI, date)).toEqual({ date:"2026-08-20", single:0, multi:0 });
});
