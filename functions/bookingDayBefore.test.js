"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  taipeiDateOffset, isDayBeforeCandidate, dayBeforeRecipientDecision,
  dayBeforeMailId, dayBeforeVariables,
  boundedDayBeforeCandidates,
} = require("./bookingDayBefore");

test("computes tomorrow using the Taipei calendar boundary", () => {
  assert.equal(taipeiDateOffset(new Date("2026-07-15T15:59:59Z"), 1), "2026-07-16");
  assert.equal(taipeiDateOffset(new Date("2026-07-15T16:00:00Z"), 1), "2026-07-17");
  assert.equal(taipeiDateOffset(new Date("2026-12-31T04:00:00Z"), 1), "2027-01-01");
});

test("bounds each reminder scan to the configured 1-100 safety limit", () => {
  const values = Array.from({ length:101 }, (_, index) => index);
  assert.deepEqual(boundedDayBeforeCandidates(values, 2), { candidates:[0, 1], overLimit:true, limit:2 });
  assert.equal(boundedDayBeforeCandidates(values, 100).candidates.length, 100);
  assert.equal(boundedDayBeforeCandidates(values, 101).candidates.length, 50);
  assert.equal(boundedDayBeforeCandidates(values, 0).limit, 50);
});

test("accepts only confirmed self-service bookings on the target date", () => {
  const base = { status:"confirmed", date:"2026-07-16" };
  assert.equal(isDayBeforeCandidate({ ...base, source:"online_public" }, "2026-07-16"), true);
  assert.equal(isDayBeforeCandidate({ ...base, source:"online" }, "2026-07-16"), true);
  for (const source of ["phone", "walk_in", "unknown", "forged"]) {
    assert.equal(isDayBeforeCandidate({ ...base, source }, "2026-07-16"), false, source);
  }
  assert.equal(isDayBeforeCandidate({ ...base, source:"online", status:"cancelled" }, "2026-07-16"), false);
  assert.equal(isDayBeforeCandidate({ ...base, source:"online", date:"2026-07-17" }, "2026-07-16"), false);
});

test("public reminders use only the booking Email and never member fallback", () => {
  assert.deepEqual(dayBeforeRecipientDecision({ source:"online_public", contactEmail:"public@example.com", memberId:"guest" }), {
    source:"online_public", memberId:"guest", email:"public@example.com", shouldLookupMember:false,
  });
  assert.equal(dayBeforeRecipientDecision({ source:"online_public", contactEmail:"bad", memberId:"guest" }, { email:"private@example.com" }).email, "");
});

test("online reminders use one safe member fallback while other sources fail closed", () => {
  assert.equal(dayBeforeRecipientDecision({ source:"online", contactEmail:"bad", memberId:"student-1" }).shouldLookupMember, true);
  assert.equal(dayBeforeRecipientDecision({ source:"online", contactEmail:"bad", memberId:"student-1" }, { email:"student@example.com" }).email, "student@example.com");
  assert.equal(dayBeforeRecipientDecision({ source:"online", contactEmail:"bad", memberId:"bad/path" }).shouldLookupMember, false);
  for (const source of ["phone", "walk_in", "forged"]) {
    const result = dayBeforeRecipientDecision({ source, contactEmail:"student@example.com", memberId:"student-1" }, { email:"private@example.com" });
    assert.equal(result.email, "", source);
    assert.equal(result.shouldLookupMember, false, source);
  }
});

test("uses a deterministic date-scoped mail ID for retry and reschedule isolation", () => {
  assert.equal(dayBeforeMailId("booking-1", "2026-07-16"), "booking-day-before-booking-1-2026-07-16");
  assert.equal(dayBeforeMailId("booking-1", "2026-07-16"), dayBeforeMailId("booking-1", "2026-07-16"));
  assert.notEqual(dayBeforeMailId("booking-1", "2026-07-16"), dayBeforeMailId("booking-2", "2026-07-16"));
  assert.notEqual(dayBeforeMailId("booking-1", "2026-07-16"), dayBeforeMailId("booking-1", "2026-07-17"));
  assert.match(dayBeforeMailId("bad/path", "not-a-date"), /^booking-day-before-[a-f0-9]{64}$/);
});

test("builds the allowlisted reminder template variables", () => {
  assert.deepEqual(dayBeforeVariables({ memberName:"小明", date:"2026-07-16", startTime:"10:00", endTime:"11:00", planType:"general", participantCount:2, source:"online" }), {
    studentName:"小明", date:"2026年7月16日", startTime:"上午10:00", endTime:"上午11:00", planName:"單人一般", participantCount:"2人", source:"學生線上約課", bookingUrl:"https://student.catgroup.com.tw/",
  });
});
