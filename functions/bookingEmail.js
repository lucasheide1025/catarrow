"use strict";

const EVENT_TYPES = Object.freeze({
  CONFIRMED: "confirmed",
  RESCHEDULED: "rescheduled",
  CANCELLED: "cancelled",
});

const BOOKING_SOURCES = Object.freeze([
  "online_public",
  "online",
  "phone",
  "walk_in",
]);

const DEFAULT_TEMPLATES = Object.freeze({
  confirmed: {
    studentSubject: "catGROUP 預約確認｜{{date}} {{startTime}}",
    studentText: "{{studentName}} 您好，\n\n您的預約已確認。\n日期：{{date}}\n時間：{{startTime}}－{{endTime}}\n方案：{{planName}}\n\n如需異動，請回到預約頁面操作。",
    coachSubject: "新預約｜{{studentName}}｜{{date}} {{startTime}}",
    coachText: "事件：{{eventLabel}}\n學生：{{studentName}}\nEmail：{{contactEmail}}\n日期：{{date}}\n時間：{{startTime}}－{{endTime}}\n方案：{{planName}}\n人數：{{participantCount}}\n來源：{{source}}",
  },
  rescheduled: {
    studentSubject: "catGROUP 預約改期完成｜{{date}} {{startTime}}",
    studentText: "{{studentName}} 您好，\n\n您的預約已改期。\n原時段：{{oldDate}} {{oldStartTime}}－{{oldEndTime}}\n新時段：{{date}} {{startTime}}－{{endTime}}\n方案：{{planName}}",
    coachSubject: "預約改期｜{{studentName}}｜{{date}} {{startTime}}",
    coachText: "事件：{{eventLabel}}\n學生：{{studentName}}\nEmail：{{contactEmail}}\n原時段：{{oldDate}} {{oldStartTime}}－{{oldEndTime}}\n新時段：{{date}} {{startTime}}－{{endTime}}\n方案：{{planName}}\n人數：{{participantCount}}\n來源：{{source}}",
  },
  cancelled: {
    studentSubject: "catGROUP 預約已取消｜{{date}} {{startTime}}",
    studentText: "{{studentName}} 您好，\n\n您的預約已取消。\n日期：{{date}}\n時間：{{startTime}}－{{endTime}}\n方案：{{planName}}",
    coachSubject: "預約取消｜{{studentName}}｜{{date}} {{startTime}}",
    coachText: "事件：{{eventLabel}}\n學生：{{studentName}}\nEmail：{{contactEmail}}\n已取消：{{date}} {{startTime}}－{{endTime}}\n方案：{{planName}}\n人數：{{participantCount}}\n來源：{{source}}",
  },
});

const INACTIVITY_TEMPLATE = Object.freeze({
  studentSubject: "catGROUP｜好久不見，回來預約練習吧",
  studentText: "{{studentName}} 您好，\n\n距離您上次完成課程已經 {{daysSinceLastClass}} 天。\n上次上課日期：{{lastClassDate}}\n\n期待再次與您一起練習！\n預約網址：{{bookingUrl}}",
});

const TEMPLATE_DEFINITIONS = Object.freeze({
  studentConfirmed: { eventType: "confirmed", audience: "student", subjectField: "studentSubject", textField: "studentText", tokens: ["studentName", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
  studentRescheduled: { eventType: "rescheduled", audience: "student", subjectField: "studentSubject", textField: "studentText", tokens: ["studentName", "oldDate", "oldStartTime", "oldEndTime", "date", "startTime", "endTime", "planName"] },
  studentCancelled: { eventType: "cancelled", audience: "student", subjectField: "studentSubject", textField: "studentText", tokens: ["studentName", "date", "startTime", "endTime", "planName"] },
  studentInactive: { eventType: "inactive", audience: "student", subjectField: "studentSubject", textField: "studentText", tokens: ["studentName", "daysSinceLastClass", "lastClassDate", "bookingUrl"] },
  coachConfirmed: { eventType: "confirmed", audience: "coach", subjectField: "coachSubject", textField: "coachText", tokens: ["eventLabel", "studentName", "contactEmail", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
  coachRescheduled: { eventType: "rescheduled", audience: "coach", subjectField: "coachSubject", textField: "coachText", tokens: ["eventLabel", "studentName", "contactEmail", "oldDate", "oldStartTime", "oldEndTime", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
  coachCancelled: { eventType: "cancelled", audience: "coach", subjectField: "coachSubject", textField: "coachText", tokens: ["eventLabel", "studentName", "contactEmail", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
});
const DEFAULT_COACH_TO = "broudes@gmail.com";
const DEFAULT_COACH_BCC = Object.freeze(["chobitsgl1@gmail.com", "beluga0109@gmail.com"]);

function defaultTemplateFor(templateId) {
  const definition = TEMPLATE_DEFINITIONS[templateId];
  if (!definition) return null;
  const source = definition.eventType === "inactive" ? INACTIVITY_TEMPLATE : DEFAULT_TEMPLATES[definition.eventType];
  return { subject: source[definition.subjectField], text: source[definition.textField] };
}

function allowedTokensFor(templateId) {
  return TEMPLATE_DEFINITIONS[templateId]?.tokens || [];
}

function validateTemplate(templateId, value) {
  const fallback = defaultTemplateFor(templateId);
  if (!fallback) throw new Error(`Unknown template: ${templateId}`);
  const subject = typeof value?.subject === "string" ? value.subject.trim() : "";
  const text = typeof value?.text === "string" ? value.text.trim() : "";
  if (!subject || subject.length > 200) throw new Error(`${templateId} subject must be 1-200 characters`);
  if (!text || text.length > 10000) throw new Error(`${templateId} text must be 1-10000 characters`);
  const allowed = new Set(allowedTokensFor(templateId));
  for (const content of [subject, text]) {
    const tokens = content.matchAll(/{{([^{}]+)}}/g);
    for (const match of tokens) {
      if (!allowed.has(match[1])) throw new Error(`${templateId} contains unsupported token: ${match[1]}`);
    }
    const remainder = content.replace(/{{[^{}]+}}/g, "");
    if (remainder.includes("{{") || remainder.includes("}}")) throw new Error(`${templateId} contains an invalid token`);
  }
  return { subject, text };
}

function normalizeConfig(input = {}) {
  const coachTo = normalizeEmail(input.coachTo) || DEFAULT_COACH_TO;
  const coachBcc = Array.isArray(input.coachBcc)
    ? [...new Set(input.coachBcc.map(normalizeEmail).filter(email => email && email !== coachTo))].slice(0, 10)
    : [...DEFAULT_COACH_BCC];
  const templates = {};
  for (const templateId of Object.keys(TEMPLATE_DEFINITIONS)) {
    const fallback = defaultTemplateFor(templateId);
    try { templates[templateId] = validateTemplate(templateId, input.templates?.[templateId] || fallback); }
    catch { templates[templateId] = fallback; }
  }
  return {
    enabled: input.enabled === true,
    inactivityEnabled: input.inactivityEnabled === true,
    dailyLimit: Number.isInteger(input.dailyLimit) && input.dailyLimit >= 1 && input.dailyLimit <= 50 ? input.dailyLimit : 20,
    coachTo,
    coachBcc,
    templates,
  };
}

function validateConfig(input = {}) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("Invalid config");
  if (typeof input.enabled !== "boolean" || typeof input.inactivityEnabled !== "boolean") throw new Error("Invalid notification toggles");
  if (!Number.isInteger(input.dailyLimit) || input.dailyLimit < 1 || input.dailyLimit > 50) throw new Error("Daily limit must be 1-50");
  const coachTo = normalizeEmail(input.coachTo);
  if (!coachTo) throw new Error("Invalid primary coach email");
  if (!Array.isArray(input.coachBcc) || input.coachBcc.length > 10) throw new Error("Invalid coach BCC list");
  const coachBcc = [...new Set(input.coachBcc.map(normalizeEmail))];
  if (coachBcc.some(email => !email) || coachBcc.includes(coachTo)) throw new Error("Invalid coach BCC email");
  const templates = {};
  for (const templateId of Object.keys(TEMPLATE_DEFINITIONS)) templates[templateId] = validateTemplate(templateId, input.templates?.[templateId]);
  return { enabled: input.enabled, inactivityEnabled: input.inactivityEnabled, dailyLimit: input.dailyLimit, coachTo, coachBcc, templates };
}

function customBookingTemplate(config, eventType) {
  const studentId = { confirmed: "studentConfirmed", rescheduled: "studentRescheduled", cancelled: "studentCancelled" }[eventType];
  const coachId = { confirmed: "coachConfirmed", rescheduled: "coachRescheduled", cancelled: "coachCancelled" }[eventType];
  return {
    studentSubject: config.templates[studentId].subject,
    studentText: config.templates[studentId].text,
    coachSubject: config.templates[coachId].subject,
    coachText: config.templates[coachId].text,
  };
}

function classifyBookingEvent(before, after, options = {}) {
  if (!before && after?.status === "confirmed") {
    return after.rescheduledFrom && options.isVerifiedReschedule === true
      ? EVENT_TYPES.RESCHEDULED
      : EVENT_TYPES.CONFIRMED;
  }
  if (
    before?.status === "confirmed" &&
    after?.status === "cancelled" &&
    options.isVerifiedReschedule !== true
  ) {
    return EVENT_TYPES.CANCELLED;
  }
  return null;
}

function normalizeEmail(value) {
  const email = typeof value === "string" ? value.trim() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function normalizeBookingSource(value) {
  return BOOKING_SOURCES.includes(value) ? value : "unknown";
}

function safeMemberId(value) {
  if (typeof value !== "string") return "";
  const memberId = value.trim();
  if (!memberId || memberId.length > 200 || memberId.includes("/") || /[\u0000-\u001f\u007f]/.test(memberId)) return "";
  return memberId;
}

function memberContactEmail(member = {}) {
  return normalizeEmail(member.email) || normalizeEmail(member.contactEmail) || "";
}

function studentRecipientDecision(booking = {}, member = null) {
  const source = normalizeBookingSource(booking.source);
  const snapshotEmail = normalizeEmail(booking.contactEmail);
  const memberId = safeMemberId(booking.memberId);
  // Public bookings already require a contact Email at creation time. Never
  // replace it from a member document: that could send a guest notification
  // to an unrelated account if a malformed/legacy booking carries a bad ID.
  // Walk-ins intentionally have no student Email notification, and unknown
  // sources fail closed. Only authenticated member and coach-created bookings
  // may use the single-document member fallback.
  const acceptsSnapshot = source === "online_public" || source === "online" || source === "phone";
  const mayUseMember = (source === "online" || source === "phone") && !!memberId;
  const fallbackEmail = mayUseMember ? memberContactEmail(member || {}) : "";
  return {
    source,
    memberId,
    email: (acceptsSnapshot ? snapshotEmail : "") || fallbackEmail,
    shouldLookupMember: acceptsSnapshot && !snapshotEmail && mayUseMember && member === null,
  };
}

function bookingRecipientPlan(booking = {}, member = null) {
  const student = studentRecipientDecision(booking, member);
  return {
    ...student,
    studentQueued: !!student.email,
    coachQueued: true,
  };
}

function bookingMailId(bookingId, eventType, audience) {
  return `booking-${bookingId}-${eventType}-${audience}`;
}

function safeTemplateValue(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : fallback;
}

function renderTemplate(template, variables) {
  return String(template || "").replace(/{{([A-Za-z][A-Za-z0-9]*)}}/g, (_match, key) => (
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key] ?? "") : ""
  ));
}

function bookingVariables(eventType, booking, previousBooking = null) {
  return {
    eventLabel: { confirmed: "新預約", rescheduled: "改期", cancelled: "取消" }[eventType] || eventType,
    studentName: booking.memberName || "同學",
    contactEmail: normalizeEmail(booking.contactEmail) || "未提供",
    date: booking.date || "",
    startTime: booking.startTime || "",
    endTime: booking.endTime || "",
    planName: booking.planType || "未指定",
    participantCount: booking.participantCount || 1,
    source: normalizeBookingSource(booking.source),
    oldDate: previousBooking?.date || "",
    oldStartTime: previousBooking?.startTime || "",
    oldEndTime: previousBooking?.endTime || "",
  };
}

function buildBookingMessages(eventType, booking, previousBooking = null, customTemplate = null) {
  const defaults = DEFAULT_TEMPLATES[eventType];
  if (!defaults) throw new Error(`Unsupported booking email event: ${eventType}`);
  const custom = customTemplate && typeof customTemplate === "object" ? customTemplate : {};
  const template = {
    studentSubject: safeTemplateValue(custom.studentSubject, defaults.studentSubject, 200),
    studentText: safeTemplateValue(custom.studentText, defaults.studentText, 10000),
    coachSubject: safeTemplateValue(custom.coachSubject, defaults.coachSubject, 200),
    coachText: safeTemplateValue(custom.coachText, defaults.coachText, 10000),
  };
  const variables = bookingVariables(eventType, booking, previousBooking);
  return {
    student: {
      subject: renderTemplate(template.studentSubject, variables),
      text: renderTemplate(template.studentText, variables),
    },
    coach: {
      subject: renderTemplate(template.coachSubject, variables),
      text: renderTemplate(template.coachText, variables),
    },
  };
}

module.exports = {
  EVENT_TYPES,
  BOOKING_SOURCES,
  DEFAULT_TEMPLATES,
  TEMPLATE_DEFINITIONS,
  DEFAULT_COACH_TO,
  DEFAULT_COACH_BCC,
  classifyBookingEvent,
  normalizeEmail,
  normalizeBookingSource,
  safeMemberId,
  memberContactEmail,
  studentRecipientDecision,
  bookingRecipientPlan,
  bookingMailId,
  renderTemplate,
  buildBookingMessages,
  allowedTokensFor,
  defaultTemplateFor,
  validateTemplate,
  normalizeConfig,
  validateConfig,
  customBookingTemplate,
};
