"use strict";

const FREE_HUNT_DAILY_LIMIT = 5;
const MODES = new Set(["single", "multi"]);

function assertMode(mode) {
  const value = String(mode || "");
  if (!MODES.has(value)) throw new Error("invalid_free_hunt_mode");
  return value;
}

function normalizeUsage(usage, dateKey) {
  const current = usage?.date === dateKey ? usage : {};
  return {
    date:dateKey,
    single:Math.max(0, Math.min(FREE_HUNT_DAILY_LIMIT, Number(current.single) || 0)),
    multi:Math.max(0, Math.min(FREE_HUNT_DAILY_LIMIT, Number(current.multi) || 0)),
  };
}

function consumeUsage(usage, mode, dateKey) {
  const key = assertMode(mode);
  const next = normalizeUsage(usage, dateKey);
  if (next[key] >= FREE_HUNT_DAILY_LIMIT) throw new Error("free_hunt_limit_reached");
  next[key] += 1;
  return { usage:next, count:next[key], remaining:FREE_HUNT_DAILY_LIMIT-next[key], limit:FREE_HUNT_DAILY_LIMIT };
}

module.exports = { FREE_HUNT_DAILY_LIMIT, assertMode, normalizeUsage, consumeUsage };
