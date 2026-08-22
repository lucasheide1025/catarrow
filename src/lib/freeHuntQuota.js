import { taipeiDateKey } from "./arrowProgress";

export const FREE_HUNT_DAILY_LIMIT = 5;
export const FREE_HUNT_QUOTA_MODE = Object.freeze({ SINGLE:"single", MULTI:"multi" });
export const FREE_HUNT_RESET_SCOPE = Object.freeze({ SINGLE:"single", MULTI:"multi", ALL:"all" });

export function normalizeFreeHuntUsage(source = {}, date = new Date()) {
  const usage = source?.freeHuntUsage || source || {};
  const today = taipeiDateKey(date);
  const current = usage?.date === today ? usage : {};
  return {
    date:today,
    single:Math.max(0, Math.min(FREE_HUNT_DAILY_LIMIT, Number(current.single) || 0)),
    multi:Math.max(0, Math.min(FREE_HUNT_DAILY_LIMIT, Number(current.multi) || 0)),
  };
}

export function getFreeHuntRemaining(source, mode, date = new Date()) {
  const usage = normalizeFreeHuntUsage(source, date);
  const key = mode === FREE_HUNT_QUOTA_MODE.MULTI ? "multi" : "single";
  return Math.max(0, FREE_HUNT_DAILY_LIMIT - usage[key]);
}

export function resetFreeHuntUsage(source, scope, date = new Date()) {
  const usage = normalizeFreeHuntUsage(source, date);
  if (scope === FREE_HUNT_RESET_SCOPE.SINGLE || scope === FREE_HUNT_RESET_SCOPE.ALL) usage.single = 0;
  if (scope === FREE_HUNT_RESET_SCOPE.MULTI || scope === FREE_HUNT_RESET_SCOPE.ALL) usage.multi = 0;
  return usage;
}

export function freeHuntQuotaLabel(mode) {
  return mode === FREE_HUNT_QUOTA_MODE.MULTI ? "複數討伐" : "指定單怪";
}
