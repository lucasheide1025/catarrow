import { GUEST_ALLOWED_FAMILIES, GUEST_MAX_TIER, filterGuestMonsters, getQrExpiry, isGuestMonsterAllowed, isQrProfileExpired } from "./guestContentPolicy";

test("guest policy admits all six T1 families and rejects higher tiers", () => {
  expect(GUEST_ALLOWED_FAMILIES).toHaveLength(6);
  expect(GUEST_MAX_TIER).toBe(1);
  expect(GUEST_ALLOWED_FAMILIES.every(family => isGuestMonsterAllowed({ family, tierIndex:1 }))).toBe(true);
  expect(isGuestMonsterAllowed({ family:"ghost", tierIndex:2 })).toBe(false);
  expect(isGuestMonsterAllowed({ family:"unknown", tierIndex:1 })).toBe(false);
  expect(filterGuestMonsters([{ family:"ghost", tier:1 }, { family:"ghost", tier:2 }])).toHaveLength(1);
});
test("official world boss is the sole monster-pool exception", () => {
  expect(isGuestMonsterAllowed({ family:"external", tier:6 }, "worldboss")).toBe(true);
});
test("QR expiry is fixed at two hours and fails closed when missing", () => {
  const start = Date.UTC(2026, 6, 22, 1);
  expect(getQrExpiry(start).getTime()).toBe(start + 2 * 60 * 60 * 1000);
  expect(isQrProfileExpired({ accountType:"kid", expiresAt:new Date(start + 1) }, start)).toBe(false);
  expect(isQrProfileExpired({ accountType:"kid", expiresAt:new Date(start) }, start)).toBe(true);
  expect(isQrProfileExpired({ accountType:"kid" }, start)).toBe(true);
  expect(isQrProfileExpired({ accountType:"guest" }, start)).toBe(false);
});
