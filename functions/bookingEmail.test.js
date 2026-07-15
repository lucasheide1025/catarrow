"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyBookingEvent, renderTemplate, buildBookingMessages, normalizeEmail,
  normalizeConfig, validateConfig, defaultTemplateFor, customBookingTemplate,
  normalizeBookingSource, safeMemberId, memberContactEmail, studentRecipientDecision,
  bookingRecipientPlan, bookingMailId,
  COPY_VERSION, BOOKING_EMAIL_FROM, bookingMailEnvelope, formatPlanName, formatSourceName,
  formatTaiwanDate, formatTaiwanTime, formatParticipantCount,
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
    memberName: "小明", contactEmail: "student@example.com", date: "2026-07-20", startTime: "10:00", endTime: "11:00", planType: "general", participantCount: 1, source: "online",
  }, { date: "2026-07-19", startTime: "09:00", endTime: "10:00" });
  assert.match(messages.student.text, /2026年7月19日 上午9:00/);
  assert.match(messages.student.text, /2026年7月20日 上午10:00/);
  assert.match(messages.coach.text, /聯絡信箱：student@example.com/);
  assert.doesNotMatch(messages.coach.text, /事件：/);
  assert.match(messages.coach.text, /預約方式：學生線上約課/);
});

test("normalizes valid email and rejects invalid recipient values", () => {
  assert.equal(normalizeEmail(" Student@Example.COM "), "Student@Example.COM");
  assert.equal(normalizeEmail("not-an-email"), "");
  assert.equal(normalizeEmail(null), "");
});

test("maps every booking entry source without trusting unknown values", () => {
  assert.equal(normalizeBookingSource("online_public"), "online_public");
  assert.equal(normalizeBookingSource("online"), "online");
  assert.equal(normalizeBookingSource("phone"), "phone");
  assert.equal(normalizeBookingSource("walk_in"), "walk_in");
  assert.equal(normalizeBookingSource("client-forged"), "unknown");
});

test("coach template receives only a safe Chinese booking source label", () => {
  const messages = buildBookingMessages("confirmed", {
    memberName:"小明", contactEmail:"student@example.com", source:"client-forged",
  }, null, { coachText:"{{source}}" });
  assert.equal(messages.coach.text, "其他方式");
});

test("formats booking values as safe natural Traditional Chinese", () => {
  assert.equal(formatPlanName("general"), "單人一般");
  assert.equal(formatPlanName("discount"), "兒童／學生／敬老");
  assert.equal(formatPlanName("own_equipment"), "自備器材");
  assert.equal(formatPlanName("secret-plan"), "未指定方案");
  assert.equal(formatSourceName("online_public"), "訪客線上預約");
  assert.equal(formatSourceName("online"), "學生線上約課");
  assert.equal(formatSourceName("phone"), "教練代為預約");
  assert.equal(formatSourceName("walk_in"), "教練現場新增");
  assert.equal(formatSourceName("forged"), "其他方式");
  assert.equal(formatTaiwanDate("2026-07-16"), "2026年7月16日");
  assert.equal(formatTaiwanDate("2026-02-30"), "日期未提供");
  assert.equal(formatTaiwanTime("00:05"), "上午12:05");
  assert.equal(formatTaiwanTime("12:00"), "下午12:00");
  assert.equal(formatTaiwanTime("23:45"), "下午11:45");
  assert.equal(formatTaiwanTime("24:00"), "時間未提供");
  assert.equal(formatParticipantCount(2), "2人");
  assert.equal(formatParticipantCount("raw"), "人數未提供");
});

test("all eight defaults are natural Chinese and hide internal booking codes", () => {
  const ids = ["studentConfirmed", "studentRescheduled", "studentCancelled", "studentInactive", "studentDayBefore", "coachConfirmed", "coachRescheduled", "coachCancelled"];
  for (const id of ids) {
    const template = defaultTemplateFor(id);
    assert.ok(template.subject.length > 0, id);
    assert.ok(template.text.length > 0, id);
    assert.doesNotMatch(`${template.subject}\n${template.text}`, /\b(?:general|discount|own_equipment|online_public|walk_in)\b/, id);
  }
  assert.doesNotMatch(defaultTemplateFor("coachConfirmed").text, /^事件：/);
});

test("accepts only safe single-segment member document IDs", () => {
  assert.equal(safeMemberId(" member-123 "), "member-123");
  assert.equal(safeMemberId("members/member-123"), "");
  assert.equal(safeMemberId("bad\nmember"), "");
  assert.equal(safeMemberId(null), "");
});

test("prefers member email then legacy contactEmail for member fallback", () => {
  assert.equal(memberContactEmail({ email:"student@example.com", contactEmail:"old@example.com" }), "student@example.com");
  assert.equal(memberContactEmail({ email:"invalid", contactEmail:"old@example.com" }), "old@example.com");
});

test("covers student recipient outcomes for all booking entry points", () => {
  const matrix = [
    { source:"online_public", bookingEmail:"public@example.com", memberId:"guest-1", expected:"public@example.com", lookup:false },
    { source:"online", bookingEmail:"invalid", memberId:"student-1", member:{ email:"student@example.com" }, expected:"student@example.com", lookup:false },
    { source:"phone", bookingEmail:"", memberId:"student-2", member:{ contactEmail:"phone@example.com" }, expected:"phone@example.com", lookup:false },
    { source:"walk_in", bookingEmail:"", memberId:null, expected:"", lookup:false },
  ];
  for (const row of matrix) {
    const decision = studentRecipientDecision({ source:row.source, contactEmail:row.bookingEmail, memberId:row.memberId }, row.member ?? null);
    assert.equal(decision.email, row.expected, row.source);
    assert.equal(decision.shouldLookupMember, row.lookup, row.source);
  }
});

test("public, walk-in, and unknown sources never cross-read a member recipient", () => {
  const member = { email:"private-member@example.com" };
  assert.deepEqual(
    studentRecipientDecision({ source:"online_public", contactEmail:"", memberId:"guest-1" }, member),
    { source:"online_public", memberId:"guest-1", email:"", shouldLookupMember:false },
  );
  assert.equal(studentRecipientDecision({ source:"walk_in", contactEmail:"walkin@example.com", memberId:"student-1" }, member).email, "");
  assert.equal(studentRecipientDecision({ source:"forged", contactEmail:"attacker@example.com", memberId:"student-1" }, member).email, "");
});

test("keeps coach notification eligible across the complete entry matrix", () => {
  for (const source of ["online_public", "online", "phone", "walk_in"]) {
    const plan = bookingRecipientPlan({ source, contactEmail:"", memberId:null });
    assert.equal(plan.studentQueued, false, source);
    assert.equal(plan.coachQueued, true, source);
  }
});

test("requests one bounded fallback read only for a safe member-linked booking", () => {
  assert.equal(studentRecipientDecision({ source:"online", contactEmail:"bad", memberId:"student-1" }).shouldLookupMember, true);
  assert.equal(studentRecipientDecision({ source:"phone", contactEmail:"", memberId:"student-2" }).shouldLookupMember, true);
  assert.equal(studentRecipientDecision({ source:"walk_in", contactEmail:"", memberId:"student-3" }).shouldLookupMember, false);
  assert.equal(studentRecipientDecision({ source:"online_public", contactEmail:"", memberId:"guest-1" }).shouldLookupMember, false);
  assert.equal(studentRecipientDecision({ source:"unknown", contactEmail:"", memberId:"student-3" }).shouldLookupMember, false);
  assert.equal(studentRecipientDecision({ source:"online", contactEmail:"", memberId:"bad/path" }).shouldLookupMember, false);
  assert.equal(studentRecipientDecision({ source:"online", contactEmail:"snapshot@example.com", memberId:"student-1" }).shouldLookupMember, false);
});

test("cancel and reschedule keep the original source and recipient snapshot", () => {
  const original = { source:"phone", memberId:"student-1", contactEmail:"student@example.com", status:"confirmed" };
  const cancelled = { ...original, status:"cancelled" };
  const rescheduled = { ...original, status:"confirmed", rescheduledFrom:"old-booking" };
  assert.equal(classifyBookingEvent(original, cancelled), "cancelled");
  assert.equal(classifyBookingEvent(null, rescheduled, { isVerifiedReschedule:true }), "rescheduled");
  assert.equal(bookingRecipientPlan(cancelled).email, "student@example.com");
  assert.equal(bookingRecipientPlan(rescheduled).email, "student@example.com");
});

test("mail IDs are deterministic per booking, event, and audience", () => {
  assert.equal(bookingMailId("abc", "confirmed", "student"), "booking-abc-confirmed-student");
  assert.equal(bookingMailId("abc", "confirmed", "student"), bookingMailId("abc", "confirmed", "student"));
  assert.notEqual(bookingMailId("abc", "confirmed", "student"), bookingMailId("abc", "confirmed", "coach"));
  assert.notEqual(bookingMailId("abc", "confirmed", "student"), bookingMailId("abc", "cancelled", "student"));
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
  assert.equal(config.copyVersion, COPY_VERSION);
  assert.equal(config.inactivityEnabled, false);
  assert.equal(config.dayBeforeEnabled, false);
  assert.equal(config.dailyLimit, 20);
  assert.equal(config.dayBeforeDailyLimit, 50);
  assert.equal(config.coachTo, "broudes@gmail.com");
  assert.deepEqual(config.templates.studentInactive, defaultTemplateFor("studentInactive"));
  assert.deepEqual(config.templates.studentDayBefore, defaultTemplateFor("studentDayBefore"));
});

test("rejects unknown tokens and invalid limits", () => {
  const config = normalizeConfig({});
  assert.throws(() => validateConfig({ ...config, dailyLimit: 51 }), /Daily limit/);
  assert.throws(() => validateConfig({ ...config, dayBeforeDailyLimit: 101 }), /Day-before daily limit/);
  assert.throws(() => validateConfig({
    ...config,
    templates: { ...config.templates, studentConfirmed: { subject: "{{password}}", text: "內容" } },
  }), /unsupported token/);
  assert.throws(() => validateConfig({
    ...config,
    templates: { ...config.templates, studentConfirmed: { subject: "{{studentName", text: "內容" } },
  }), /invalid token/);
});

test("keeps old stored config fail-closed for the new day-before reminder", () => {
  const config = normalizeConfig({ enabled:true, inactivityEnabled:true, dailyLimit:20 });
  assert.equal(config.enabled, true);
  assert.equal(config.inactivityEnabled, true);
  assert.equal(config.dayBeforeEnabled, false);
  assert.equal(config.dayBeforeDailyLimit, 50);
  assert.doesNotThrow(() => validateConfig(config));
});

test("upgrades legacy stored templates while preserving operational settings", () => {
  const config = normalizeConfig({
    enabled:true, inactivityEnabled:true, dailyLimit:17,
    coachTo:"coach@example.com",
    templates:{ studentConfirmed:{ subject:"OLD", text:"OLD" } },
  });
  assert.equal(config.copyVersion, COPY_VERSION);
  assert.equal(config.enabled, true);
  assert.equal(config.dailyLimit, 17);
  assert.equal(config.coachTo, "coach@example.com");
  assert.deepEqual(config.templates.studentConfirmed, defaultTemplateFor("studentConfirmed"));
});

test("preserves valid version-two custom templates", () => {
  const base = normalizeConfig({});
  const config = normalizeConfig({
    ...base,
    copyVersion:COPY_VERSION,
    templates:{ ...base.templates, studentConfirmed:{ subject:"自訂 {{date}}", text:"自訂內容 {{studentName}}" } },
  });
  assert.deepEqual(config.templates.studentConfirmed, { subject:"自訂 {{date}}", text:"自訂內容 {{studentName}}" });
  assert.doesNotThrow(() => validateConfig(config));
  assert.throws(() => validateConfig({ ...config, copyVersion:1 }), /copy version/);
});

test("uses the approved Chinese sender identity", () => {
  assert.equal(BOOKING_EMAIL_FROM, "貓小隊室內射箭場 <broudes@gmail.com>");
  assert.deepEqual(bookingMailEnvelope({ to:"student@example.com" }), {
    to:"student@example.com", from:BOOKING_EMAIL_FROM,
  });
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
