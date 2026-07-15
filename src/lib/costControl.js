export const COST_CONTROL_LEVELS = Object.freeze({
  normal: 0,
  warning: 1,
  protect: 2,
  restricted: 3,
  emergency: 4,
});

export const COST_THRESHOLDS = Object.freeze({
  monthlyCeilingTwd: 300,
  warning: 50,
  protect: 80,
  restricted: 90,
  emergency: 95,
});

export const COST_CAPABILITIES = Object.freeze({
  coreOperations: "coreOperations",
  bulkAdminWrites: "bulkAdminWrites",
  migrations: "migrations",
  backgroundSync: "backgroundSync",
  shootingHistorySync: "shootingHistorySync",
  gameAnalysisWrites: "gameAnalysisWrites",
  gameCloudProgress: "gameCloudProgress",
  nonessentialListeners: "nonessentialListeners",
});

const BLOCKED_FROM = Object.freeze({
  bulkAdminWrites: "protect",
  migrations: "protect",
  backgroundSync: "restricted",
  shootingHistorySync: "restricted",
  gameAnalysisWrites: "restricted",
  nonessentialListeners: "restricted",
  gameCloudProgress: "emergency",
});

export const DEFAULT_COST_CONTROL = Object.freeze({
  level: "normal",
  monthlyCeilingTwd: COST_THRESHOLDS.monthlyCeilingTwd,
  observedPercent: 0,
  reason: "",
  source: "default",
  revision: 0,
  manualRecoveryRequired: false,
});

// Until the remote policy has been read, keep core flows available but fail
// closed for migrations and bulk admin writes.
export const BOOTSTRAP_COST_CONTROL = Object.freeze({
  ...DEFAULT_COST_CONTROL,
  level: "protect",
  reason: "Waiting for cost-control policy",
  source: "bootstrap",
});

let effectivePolicy = BOOTSTRAP_COST_CONTROL;

export function normalizeCostControl(value = {}) {
  const level = Object.hasOwn(COST_CONTROL_LEVELS, value.level) ? value.level : "normal";
  return {
    ...DEFAULT_COST_CONTROL,
    ...value,
    level,
    monthlyCeilingTwd: Number(value.monthlyCeilingTwd) || COST_THRESHOLDS.monthlyCeilingTwd,
    observedPercent: Math.max(0, Number(value.observedPercent) || 0),
    revision: Math.max(0, Number(value.revision) || 0),
  };
}

export function setEffectiveCostControl(value) {
  effectivePolicy = normalizeCostControl(value);
  return effectivePolicy;
}

export function getEffectiveCostControl() {
  return effectivePolicy;
}

export function isCostCapabilityAllowed(capability, policy = effectivePolicy) {
  if (capability === COST_CAPABILITIES.coreOperations) return true;
  const blockedLevel = BLOCKED_FROM[capability];
  if (!blockedLevel) return false;
  return COST_CONTROL_LEVELS[policy.level] < COST_CONTROL_LEVELS[blockedLevel];
}

export function assertCostCapability(capability, policy = effectivePolicy) {
  if (isCostCapabilityAllowed(capability, policy)) return;
  const error = new Error(`成本防護已啟用（${policy.level}），此高風險操作已暫停。`);
  error.code = "cost-control/blocked";
  error.capability = capability;
  throw error;
}

export function levelForObservedPercent(percent) {
  const n = Math.max(0, Number(percent) || 0);
  if (n >= COST_THRESHOLDS.emergency) return "emergency";
  if (n >= COST_THRESHOLDS.restricted) return "restricted";
  if (n >= COST_THRESHOLDS.protect) return "protect";
  if (n >= COST_THRESHOLDS.warning) return "warning";
  return "normal";
}

export function canAutomaticTransition(current, next) {
  const a = normalizeCostControl(current);
  const b = normalizeCostControl(next);
  return COST_CONTROL_LEVELS[b.level] > COST_CONTROL_LEVELS[a.level]
    && b.revision > a.revision;
}

export function nextRecoveryLevel(level) {
  if (level === "emergency") return "restricted";
  if (level === "restricted") return "protect";
  if (level === "protect") return "warning";
  if (level === "warning") return "normal";
  return "normal";
}

export function canManualRecovery(current, nextLevel) {
  const currentLevel = normalizeCostControl(current).level;
  return nextLevel === nextRecoveryLevel(currentLevel)
    && COST_CONTROL_LEVELS[nextLevel] < COST_CONTROL_LEVELS[currentLevel];
}
