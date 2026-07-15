"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyBookingEvent, renderTemplate, buildBookingMessages, normalizeEmail,
  normalizeConfig, validateConfig, defaultTemplateFor, customBookingTemplate,
} = require("./bookingEmail");

test("classifies a new confirmed booking", () => {
  assert.equal(classifyBookingEvent(null, { status: "confirmed", rescheduledFrom: null }), "confirmed");
});

test("classifies only the new document of a reschedule", () => {
  assert.equal(classifyBookingEvent(
    null,
    { status: "confirmed", rescheduledFrom: "old" },
    { isVerifiedReschedule: true },
  ), "rescheduled");
  assert.equal(classifyBookingEvent(
    { status: "confirmed" },
    { status: "cancelled", rescheduledTo: "new" },
    { isVerifiedReschedule: true },
  ), null);
});

test("treats an unverified rescheduledFrom as a new booking", () => {
  assert.equal(classifyBookingEvent(
    null,
    { status: "confirmed", rescheduledFrom: "unrelated" },
  ), "confirmed");
});

test("does not let an unverified rescheduledTo suppress cancellation", () => {
  assert.equal(classifyBookingEvent(
    { status: "confirmed" },
    { status: "cancelled", rescheduledTo: "unrelated" },
  ), "cancelled");
});

test("classifies a genuine cancellation", () => {
  assert.equal(classifyBookingEvent({ status: "confirmed" }, { status: "cancelled" }), "cancelled");
});

test("ignores unrelated booking writes", () => {
  assert.equal(classifyBookingEvent({ status: "confirmed" }, { status: "confirmed", note: "changed" }), null);
  assert.equal(classifyBookingEvent(null, { status: "completed" }), null);
  assert.equal(classifyBookingEvent({ status: "cancelled" }, null), null);
});

test("renders only simple allowlisted-shaped tokens without executing content", () => {
  assert.equal(renderTemplate("Hi {{studentName}} {{missing}} {{bad-key}}", { studentName: "小明" }), "Hi 小明  {{bad-key}}");
});

test("builds reschedule messages with old and new slots", () => {
  const messages = buildBookingMessages("rescheduled", {
    memberName: "小明", contactEmail: "student@example.com", date: "2026-07-20", startTime: "10:00", endTime: "11:00", planType: "單堂", participantCount: 1, source: "online",
  }, { date: "2026-07-19", startTime: "09:00", endTime: "10:00" });
  assert.match(messages.student.text, /2026-07-19 09:00/);
  assert.match(messages.student.text, /2026-07-20 10:00/);
  assert.match(messages.coach.text, /Email：student@example.com/);
  assert.match(messages.coach.text, /事件：改期/);
  assert.match(messages.coach.text, /來源：online/);
});

test("normalizes valid email and rejects invalid recipient values", () => {
  assert.equal(normalizeEmail(" Student@Example.COM "), "Student@Example.COM");
  assert.equal(normalizeEmail("not-an-email"), "");
  assert.equal(normalizeEmail(null), "");
});

test("invalid custom template fields fall back to safe non-empty defaults", () => {
  const messages = buildBookingMessages("confirmed", {
    memberName: "小明", date: "2026-07-20", startTime: "10:00", endTime: "11:00",
  }, null, { studentSubject: "", studentText: 123, coachSubject: "自訂主旨" });
  assert.match(messages.student.subject, /catGROUP/);
  assert.match(messages.student.text, /預約已確認/);
  assert.equal(messages.coach.subject, "自訂主旨");
});

test("normalizes missing config to disabled safe defaults", () => {
  const config = normalizeConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.inactivityEnabled, false);
  assert.equal(config.dailyLimit, 20);
  assert.equal(config.coachTo, "broudes@gmail.com");
  assert.deepEqual(config.templates.studentInactive, defaultTemplateFor("studentInactive"));
});

test("rejects unknown tokens and invalid limits", () => {
  const config = normalizeConfig({});
  assert.throws(() => validateConfig({ ...config, dailyLimit: 51 }), /Daily limit/);
  assert.throws(() => validateConfig({
    ...config,
    templates: { ...config.templates, studentConfirmed: { subject: "{{password}}", text: "內容" } },
  }), /unsupported token/);
  assert.throws(() => validateConfig({
    ...config,
    templates: { ...config.templates, studentConfirmed: { subject: "{{studentName", text: "內容" } },
  }), /invalid token/);
});

test("enforces the same token whitelist shown for each template", () => {
  const config = normalizeConfig({});
  assert.throws(() => validateConfig({
    ...config,
    templates: { ...config.templates, studentCancelled: { subject: "{{oldDate}}", text: "內容" } },
  }), /unsupported token/);
  assert.doesNotThrow(() => validateConfig({
    ...config,
    templates: { ...config.templates, studentRescheduled: { subject: "{{oldDate}}", text: "{{date}}" } },
  }));
});

test("rejects blank or oversized template fields", () => {
  const config = normalizeConfig({});
  assert.throws(() => validateConfig({
    ...config,
    templates: { ...config.templates, coachConfirmed: { subject: "", text: "內容" } },
  }), /subject must be/);
  assert.throws(() => validateConfig({
    ...config,
    templates: { ...config.templates, coachConfirmed: { subject: "正常", text: "x".repeat(10001) } },
  }), /text must be/);
});

test("maps seven-template config back into booking message fields", () => {
  const config = normalizeConfig({});
  config.templates.studentConfirmed = { subject: "學生 {{studentName}}", text: "{{date}}" };
  config.templates.coachConfirmed = { subject: "教練 {{studentName}}", text: "{{source}}" };
  const mapped = customBookingTemplate(config, "confirmed");
  assert.equal(mapped.studentSubject, "學生 {{studentName}}");
  assert.equal(mapped.coachText, "{{source}}");
});
