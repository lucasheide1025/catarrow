// src/lib/villageGoalSchedule.js
// ─────────────────────────────────────────────────────────────
// ⏳ 村目標的「給多久」與「多久刷一次」（2026-08-03）
//
// ⚠️ 原本自然刷出的目標**寫死 24 小時**，而且教練改不了
//    （手動建立的反而可以設 durationHours——只有自動的被寫死）。
//
// ⚠️ 更根本的問題：**目標值會隨村莊等級成長 16 倍，時間卻不動**。
//      total_arrows：tier0 5,000 → tier3 80,000
//      total_damage：tier0 50,000 → tier3 800,000
//    80,000 箭要在一天內射完，對一間道館來說不可能。
//    所以時間必須夠長。作者定案為**一律一個月**，並保留「每階增量」旋鈕
//    以備日後要讓高階村莊更寬鬆。
//
// 公式：`baseHours + tier × perTierHours`（tier 0~3）
//   預設 720 / +0 → 所有階級都是 30 天（作者 2026-08-03 定案）
//
// ⚠️ 全部可由教練在後台調整（sysConfig/villageGoal）。
//    這支是純函式，不碰 Firestore。
// ─────────────────────────────────────────────────────────────

// ⚠️ 作者 2026-08-03 定案：**完成期限一個月、結束三天後才刷下一個**。
//    一個月的窗口讓「一週來兩三次」的射手也追得上，村目標才真的是全村的事，
//    而不是那幾天剛好有來的人的事。
export const VILLAGE_GOAL_SCHEDULE_DEFAULTS = Object.freeze({
  baseHours: 720,       // 30 天
  perTierHours: 0,      // ⚠️ 預設 0＝所有階級都給一個月。留著這個旋鈕是為了
                        //    以後想讓高階村莊更寬鬆時不用改程式。
  cooldownHours: 72,    // 上一個結束後隔 3 天才刷下一個（作者指定）
});

/** 可設定範圍。⚠️ 下限刻意不低於 12 小時——比一天還短就沒有「全村一起推」的意義。 */
export const SCHEDULE_LIMITS = Object.freeze({
  baseHours: { min: 12, max: 1440 },     // 12 小時 ~ 60 天
  perTierHours: { min: 0, max: 120 },
  cooldownHours: { min: 0, max: 336 },   // 0 ~ 14 天
});

const clamp = (value, { min, max }, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

/** 把後台存的設定正規化。壞值一律退回預設，不會回 NaN。 */
export function normalizeGoalSchedule(raw = {}) {
  const d = VILLAGE_GOAL_SCHEDULE_DEFAULTS;
  return {
    baseHours: clamp(raw?.baseHours, SCHEDULE_LIMITS.baseHours, d.baseHours),
    perTierHours: clamp(raw?.perTierHours, SCHEDULE_LIMITS.perTierHours, d.perTierHours),
    cooldownHours: clamp(raw?.cooldownHours, SCHEDULE_LIMITS.cooldownHours, d.cooldownHours),
  };
}

export const VILLAGE_GOAL_SCHEDULE_VERSION = 2;

export function resolveGoalSchedule(raw = null) {
  const source = raw || {};
  const isLegacy24Hour = source.version == null
    && Number(source.baseHours) === 24
    && Number(source.perTierHours || 0) === 0
    && Number(source.cooldownHours ?? 72) === 72;
  return {
    ...normalizeGoalSchedule(isLegacy24Hour ? VILLAGE_GOAL_SCHEDULE_DEFAULTS : source),
    version: VILLAGE_GOAL_SCHEDULE_VERSION,
    migrated: isLegacy24Hour,
  };
}

export function legacyActiveGoalDeadlinePatch(goal, nowMs = Date.now()) {
  if (!goal || goal.status !== "active" || goal.isAdminCreated
    || goal.scheduleVersion != null
    || goal.deadlineMigrationVersion >= VILLAGE_GOAL_SCHEDULE_VERSION) return null;
  const startMs = goal.startAt?.toMillis?.() ?? Number(goal.startAtMs);
  const endMs = goal.endAt?.toMillis?.() ?? Number(goal.endAtMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || (endMs - startMs) / 3600000 > 24.01) return null;
  return {
    endAtMs: nowMs + VILLAGE_GOAL_SCHEDULE_DEFAULTS.baseHours * 3600000,
    deadlineMigrationVersion: VILLAGE_GOAL_SCHEDULE_VERSION,
  };
}

/** 這個階級的目標要給幾小時 */
export function goalDurationHours(tier = 0, config = null) {
  const cfg = normalizeGoalSchedule(config || {});
  const t = Math.max(0, Math.min(3, Math.floor(Number(tier) || 0)));
  return cfg.baseHours + t * cfg.perTierHours;
}

/** 這個階級的目標什麼時候結束 */
export function goalEndAtMs(tier = 0, config = null, nowMs = Date.now()) {
  return nowMs + goalDurationHours(tier, config) * 3600000;
}

/**
 * 現在能不能自然刷出新目標。
 *
 * ⚠️ 兩個擋門的理由要分開回報，不然教練看不出「是還有活躍目標」還是
 *    「只是冷卻中」——舊版兩種都只回 false。
 */
export function canAutoSpawn(latest, config = null, nowMs = Date.now()) {
  if (!latest) return { ok: true, reason: "no_goal" };
  if (latest.status === "active") return { ok: false, reason: "already_active" };
  const cfg = normalizeGoalSchedule(config || {});
  const endMs = latest.endAt?.toMillis?.() ?? Number(latest.endAtMs) ?? null;
  if (!Number.isFinite(endMs)) return { ok: true, reason: "no_end_time" };
  const readyAt = endMs + cfg.cooldownHours * 3600000;
  if (nowMs < readyAt) return { ok: false, reason: "cooling_down", remainingMs: readyAt - nowMs };
  return { ok: true, reason: "ready" };
}

/** 給後台看的說明：四個階級各給多久 */
export function describeSchedule(config = null) {
  return [0, 1, 2, 3].map(tier => {
    const hours = goalDurationHours(tier, config);
    return { tier, hours, days: Math.round((hours / 24) * 10) / 10 };
  });
}
