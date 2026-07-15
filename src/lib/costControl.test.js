import {
  COST_CAPABILITIES, COST_THRESHOLDS, canAutomaticTransition,
  canManualRecovery, isCostCapabilityAllowed, levelForObservedPercent,
  nextRecoveryLevel, normalizeCostControl,
} from "./costControl";

test("80 percent starts protection", () => {
  expect(COST_THRESHOLDS.protect).toBe(80);
  expect(levelForObservedPercent(79.99)).toBe("warning");
  expect(levelForObservedPercent(80)).toBe("protect");
  expect(isCostCapabilityAllowed(COST_CAPABILITIES.bulkAdminWrites, { level:"protect" })).toBe(false);
});

test("capability degradation preserves core operations", () => {
  expect(isCostCapabilityAllowed(COST_CAPABILITIES.coreOperations, { level:"emergency" })).toBe(true);
  expect(isCostCapabilityAllowed(COST_CAPABILITIES.backgroundSync, { level:"protect" })).toBe(true);
  expect(isCostCapabilityAllowed(COST_CAPABILITIES.backgroundSync, { level:"restricted" })).toBe(false);
  expect(isCostCapabilityAllowed(COST_CAPABILITIES.gameCloudProgress, { level:"restricted" })).toBe(true);
  expect(isCostCapabilityAllowed(COST_CAPABILITIES.gameCloudProgress, { level:"emergency" })).toBe(false);
});

test("automatic transitions are monotonic and revisioned", () => {
  const current = normalizeCostControl({ level:"protect", revision:4 });
  expect(canAutomaticTransition(current, { level:"restricted", revision:5 })).toBe(true);
  expect(canAutomaticTransition(current, { level:"warning", revision:5 })).toBe(false);
  expect(canAutomaticTransition(current, { level:"restricted", revision:4 })).toBe(false);
});

test("manual recovery lowers exactly one level", () => {
  expect(nextRecoveryLevel("emergency")).toBe("restricted");
  expect(canManualRecovery({ level:"emergency" }, "restricted")).toBe(true);
  expect(canManualRecovery({ level:"emergency" }, "normal")).toBe(false);
  expect(canManualRecovery({ level:"protect" }, "restricted")).toBe(false);
});
