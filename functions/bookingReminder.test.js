"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildReminderCycle, reminderMailId, inactivityVariables, isFutureConfirmedBooking, shouldReplaceReminderCycle, takeReminderBatch } = require("./bookingReminder");

test("completed booking creates a 14-day reminder cycle", () => {
  const cycle = buildReminderCycle("b1", { status:"completed", memberId:"m1", date:"2026-07-01", endTime:"11:00", memberName:"小明", contactEmail:"a@example.com" });
  assert.equal(cycle.completedAt.toISOString(), "2026-07-01T03:00:00.000Z");
  assert.equal(cycle.dueAt.toISOString(), "2026-07-15T03:00:00.000Z");
});
test("walk-ins and unfinished bookings are excluded", () => {
  assert.equal(buildReminderCycle("b1", { status:"completed", memberId:null, date:"2026-07-01", endTime:"11:00" }), null);
  assert.equal(buildReminderCycle("b1", { status:"confirmed", memberId:"m1", date:"2026-07-01", endTime:"11:00" }), null);
});
test("malformed Taipei dates, times, and member paths are excluded", () => {
  assert.equal(buildReminderCycle("b1", { status:"completed", memberId:"m1", date:"2026-02-30", endTime:"11:00" }), null);
  assert.equal(buildReminderCycle("b1", { status:"completed", memberId:"m1", date:"2026-07-01", endTime:"24:00" }), null);
  assert.equal(buildReminderCycle("b1", { status:"completed", memberId:"members/m1", date:"2026-07-01", endTime:"11:00" }), null);
});
test("mail id is deterministic and variables have a 14 day floor", () => {
  assert.equal(reminderMailId("m/1", "b/1"), reminderMailId("m/1", "b/1"));
  assert.equal(inactivityVariables({ completedAt:new Date("2026-07-01T00:00:00Z") }, new Date("2026-07-15T00:00:00Z")).daysSinceLastClass, 14);
});
test("future guard distinguishes a past slot today from a future slot", () => {
  assert.equal(isFutureConfirmedBooking({ status:"confirmed", date:"2026-07-15", startTime:"09:00" }, "2026-07-15", "10:00"), false);
  assert.equal(isFutureConfirmedBooking({ status:"confirmed", date:"2026-07-15", startTime:"11:00" }, "2026-07-15", "10:00"), true);
  assert.equal(isFutureConfirmedBooking({ status:"confirmed", date:"2026-07-16", startTime:"09:00" }, "2026-07-15", "10:00"), true);
});
test("replay cannot replace the same or newer completion cycle", () => {
  assert.equal(shouldReplaceReminderCycle(100, 100), false);
  assert.equal(shouldReplaceReminderCycle(101, 100), false);
  assert.equal(shouldReplaceReminderCycle(99, 100), true);
});
test("daily reminder batch is bounded to configured limit and hard maximum", () => {
  const items = Array.from({ length:60 }, (_, i) => i);
  assert.equal(takeReminderBatch(items, 20).length, 20);
  assert.equal(takeReminderBatch(items, 99).length, 50);
});
