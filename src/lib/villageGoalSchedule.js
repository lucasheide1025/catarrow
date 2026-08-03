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
//    所以時間必須**跟著階級一起長**，不能只是把 24 改成一個更大的數字。
//
// 公式：`baseHours + tier × perTierHours`（tier 0~3）
//   預設 72 / +24 → 3天 / 4天 / 5天 / 6天
//
// ⚠️ 全部可由教練在後台調整（sysConfig/villageGoal）。
//    這支是純函式，不碰 Firestore。
// ─────────────────────────────────────────────────────────────

export const VILLAGE_GOAL_SCHEDULE_DEFAULTS = Object.freeze({
  baseHours: 72,        // tier 0 給幾小時
  perTierHours: 24,     // 每高一階多給幾小時
  cooldownHours: 12,    // 上一個結束後，隔多久才會刷新的下一個
});

/** 可設定範圍。⚠️ 下限刻意不低於 12 小時——比一天還短就沒有「全村一起推」的意義。 */
export const SCHEDULE_LIMITS = Object.freeze({
  baseHours: { min: 12, max: 336 },      // 12 小時 ~ 14 天
  perTierHours: { min: 0, max: 120 },
  cooldownHours: { min: 0, max: 168 },
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
