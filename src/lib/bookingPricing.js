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

