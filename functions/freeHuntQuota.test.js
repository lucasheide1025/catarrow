"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { FREE_HUNT_DAILY_LIMIT, normalizeUsage, consumeUsage } = require("./freeHuntQuota");

test("single and multi have independent five-attempt daily quotas", () => {
  let usage = normalizeUsage(null, "2026-08-20");
  for (let i=0;i<5;i++) usage = consumeUsage(usage, "single", "2026-08-20").usage;
  assert.equal(usage.single, 5);
  assert.equal(usage.multi, 0);
  assert.throws(() => consumeUsage(usage, "single", "2026-08-20"), /free_hunt_limit_reached/);
  const multi = consumeUsage(usage, "multi", "2026-08-20");
  assert.equal(multi.usage.multi, 1);
  assert.equal(multi.remaining, FREE_HUNT_DAILY_LIMIT - 1);
});

test("quota resets on a new Taipei date", () => {
  const next = normalizeUsage({ date:"2026-08-19", single:5, multi:5 }, "2026-08-20");
  assert.deepEqual(next, { date:"2026-08-20", single:0, multi:0 });
});
