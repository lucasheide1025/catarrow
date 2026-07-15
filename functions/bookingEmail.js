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

const COPY_VERSION = 2;
const BOOKING_EMAIL_FROM = "貓小隊室內射箭場 <broudes@gmail.com>";
const PLAN_LABELS = Object.freeze({
  general: "單人一般",
  discount: "兒童／學生／敬老",
  own_equipment: "自備器材",
});
const SOURCE_LABELS = Object.freeze({
  online_public: "訪客線上預約",
  online: "學生線上約課",
  phone: "教練代為預約",
  walk_in: "教練現場新增",
});

const DEFAULT_TEMPLATES = Object.freeze({
  confirmed: {
    studentSubject: "catGROUP 預約確認｜{{date}} {{startTime}}",
    studentText: "{{studentName}} 您好，\n\n您的預約已確認。\n\n上課日期：{{date}}\n上課時間：{{startTime}}－{{endTime}}\n課程方案：{{planName}}\n上課人數：{{participantCount}}\n\n如需改期或取消，請回到預約頁面操作。",
    coachSubject: "catGROUP 新增預約通知｜{{studentName}}｜{{date}} {{startTime}}",
    coachText: "已為「{{studentName}}」新增預約。\n\n上課日期：{{date}}\n上課時間：{{startTime}}－{{endTime}}\n課程方案：{{planName}}\n上課人數：{{participantCount}}\n預約方式：{{source}}\n聯絡信箱：{{contactEmail}}\n\n請至 catGROUP 教練後台查看完整預約資料。",
  },
  rescheduled: {
    studentSubject: "catGROUP 預約改期完成｜{{date}} {{startTime}}",
    studentText: "{{studentName}} 您好，\n\n您的預約已完成改期。\n\n原上課時間：{{oldDate}} {{oldStartTime}}－{{oldEndTime}}\n新上課時間：{{date}} {{startTime}}－{{endTime}}\n課程方案：{{planName}}\n\n請依新的日期與時間前來上課。",
    coachSubject: "catGROUP 預約改期通知｜{{studentName}}｜{{date}} {{startTime}}",
    coachText: "「{{studentName}}」的預約已完成改期。\n\n原上課時間：{{oldDate}} {{oldStartTime}}－{{oldEndTime}}\n新上課時間：{{date}} {{startTime}}－{{endTime}}\n課程方案：{{planName}}\n上課人數：{{participantCount}}\n預約方式：{{source}}\n聯絡信箱：{{contactEmail}}\n\n請至 catGROUP 教練後台查看完整預約資料。",
  },
  cancelled: {
    studentSubject: "catGROUP 預約已取消｜{{date}} {{startTime}}",
    studentText: "{{studentName}} 您好，\n\n您的預約已取消。\n\n原上課日期：{{date}}\n原上課時間：{{startTime}}－{{endTime}}\n課程方案：{{planName}}\n\n若需要其他時段，歡迎重新預約。",
    coachSubject: "catGROUP 預約取消通知｜{{studentName}}｜{{date}} {{startTime}}",
    coachText: "「{{studentName}}」的預約已取消。\n\n原上課日期：{{date}}\n原上課時間：{{startTime}}－{{endTime}}\n課程方案：{{planName}}\n上課人數：{{participantCount}}\n預約方式：{{source}}\n聯絡信箱：{{contactEmail}}\n\n請至 catGROUP 教練後台查看完整預約資料。",
  },
});

const INACTIVITY_TEMPLATE = Object.freeze({
  studentSubject: "catGROUP｜好久不見，回來預約練習吧",
  studentText: "{{studentName}} 您好，\n\n距離您上次上課已經 {{daysSinceLastClass}} 天，好久不見！\n\n上次上課日期：{{lastClassDate}}\n\n期待再次與您一起練習，歡迎回來預約課程：\n{{bookingUrl}}",
});

const DAY_BEFORE_TEMPLATE = Object.freeze({
  studentSubject: "catGROUP｜明天上課提醒｜{{date}} {{startTime}}",
  studentText: "{{studentName}} 您好，\n\n提醒您明天有預約課程。\n\n上課日期：{{date}}\n上課時間：{{startTime}}－{{endTime}}\n課程方案：{{planName}}\n上課人數：{{participantCount}}\n\n請記得準時前來，期待與您見面！\n預約頁面：{{bookingUrl}}",
});

const TEMPLATE_DEFINITIONS = Object.freeze({
  studentConfirmed: { eventType: "confirmed", audience: "student", subjectField: "studentSubject", textField: "studentText", tokens: ["studentName", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
  studentRescheduled: { eventType: "rescheduled", audience: "student", subjectField: "studentSubject", textField: "studentText", tokens: ["studentName", "oldDate", "oldStartTime", "oldEndTime", "date", "startTime", "endTime", "planName"] },
  studentCancelled: { eventType: "cancelled", audience: "student", subjectField: "studentSubject", textField: "studentText", tokens: ["studentName", "date", "startTime", "endTime", "planName"] },
  studentInactive: { eventType: "inactive", audience: "student", subjectField: "studentSubject", textField: "studentText", tokens: ["studentName", "daysSinceLastClass", "lastClassDate", "bookingUrl"] },
  studentDayBefore: { eventType: "dayBefore", audience: "student", subjectField: "studentSubject", textField: "studentText", tokens: ["studentName", "date", "startTime", "endTime", "planName", "participantCount", "source", "bookingUrl"] },
  coachConfirmed: { eventType: "confirmed", audience: "coach", subjectField: "coachSubject", textField: "coachText", tokens: ["eventLabel", "studentName", "contactEmail", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
  coachRescheduled: { eventType: "rescheduled", audience: "coach", subjectField: "coachSubject", textField: "coachText", tokens: ["eventLabel", "studentName", "contactEmail", "oldDate", "oldStartTime", "oldEndTime", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
  coachCancelled: { eventType: "cancelled", audience: "coach", subjectField: "coachSubject", textField: "coachText", tokens: ["eventLabel", "studentName", "contactEmail", "date", "startTime", "endTime", "planName", "participantCount", "source"] },
});
const DEFAULT_COACH_TO = "broudes@gmail.com";
const DEFAULT_COACH_BCC = Object.freeze(["chobitsgl1@gmail.com", "beluga0109@gmail.com"]);

function defaultTemplateFor(templateId) {
  const definition = TEMPLATE_DEFINITIONS[templateId];
  if (!definition) return null;
  const source = definition.eventType === "inactive"
    ? INACTIVITY_TEMPLATE
    : definition.eventType === "dayBefore"
      ? DAY_BEFORE_TEMPLATE
      : DEFAULT_TEMPLATES[definition.eventType];
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
  const acceptsStoredTemplates = input.copyVersion === COPY_VERSION;
  for (const templateId of Object.keys(TEMPLATE_DEFINITIONS)) {
    const fallback = defaultTemplateFor(templateId);
    const stored = acceptsStoredTemplates ? input.templates?.[templateId] : null;
    try { templates[templateId] = validateTemplate(templateId, stored || fallback); }
    catch { templates[templateId] = fallback; }
  }
  return {
    copyVersion: COPY_VERSION,
    enabled: input.enabled === true,
    inactivityEnabled: input.inactivityEnabled === true,
    dayBeforeEnabled: input.dayBeforeEnabled === true,
    dailyLimit: Number.isInteger(input.dailyLimit) && input.dailyLimit >= 1 && input.dailyLimit <= 50 ? input.dailyLimit : 20,
    dayBeforeDailyLimit: Number.isInteger(input.dayBeforeDailyLimit) && input.dayBeforeDailyLimit >= 1 && input.dayBeforeDailyLimit <= 100 ? input.dayBeforeDailyLimit : 50,
    coachTo,
    coachBcc,
    templates,
  };
}

function validateConfig(input = {}) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("Invalid config");
  if (input.copyVersion !== COPY_VERSION) throw new Error(`Email copy version must be ${COPY_VERSION}`);
  if (typeof input.enabled !== "boolean" || typeof input.inactivityEnabled !== "boolean" || typeof input.dayBeforeEnabled !== "boolean") throw new Error("Invalid notification toggles");
  if (!Number.isInteger(input.dailyLimit) || input.dailyLimit < 1 || input.dailyLimit > 50) throw new Error("Daily limit must be 1-50");
  if (!Number.isInteger(input.dayBeforeDailyLimit) || input.dayBeforeDailyLimit < 1 || input.dayBeforeDailyLimit > 100) throw new Error("Day-before daily limit must be 1-100");
  const coachTo = normalizeEmail(input.coachTo);
  if (!coachTo) throw new Error("Invalid primary coach email");
  if (!Array.isArray(input.coachBcc) || input.coachBcc.length > 10) throw new Error("Invalid coach BCC list");
  const coachBcc = [...new Set(input.coachBcc.map(normalizeEmail))];
  if (coachBcc.some(email => !email) || coachBcc.includes(coachTo)) throw new Error("Invalid coach BCC email");
  const templates = {};
  for (const templateId of Object.keys(TEMPLATE_DEFINITIONS)) templates[templateId] = validateTemplate(templateId, input.templates?.[templateId]);
  return { copyVersion: COPY_VERSION, enabled: input.enabled, inactivityEnabled: input.inactivityEnabled, dayBeforeEnabled: input.dayBeforeEnabled, dailyLimit: input.dailyLimit, dayBeforeDailyLimit: input.dayBeforeDailyLimit, coachTo, coachBcc, templates };
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

function formatPlanName(value) {
  return PLAN_LABELS[value] || "未指定方案";
}

function formatSourceName(value) {
  return SOURCE_LABELS[normalizeBookingSource(value)] || "其他方式";
}

function formatTaiwanDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof value === "string" ? value : "");
  if (!match) return "日期未提供";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "日期未提供";
  return `${year}年${month}月${day}日`;
}

function formatTaiwanTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(typeof value === "string" ? value : "");
  if (!match) return "時間未提供";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return "時間未提供";
  const period = hour < 12 ? "上午" : "下午";
  const displayHour = hour % 12 || 12;
  return `${period}${displayHour}:${String(minute).padStart(2, "0")}`;
}

function formatParticipantCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 && count <= 100 ? `${count}人` : "人數未提供";
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

function bookingMailEnvelope(data = {}) {
  return { ...data, from: BOOKING_EMAIL_FROM };
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
    date: formatTaiwanDate(booking.date),
    startTime: formatTaiwanTime(booking.startTime),
    endTime: formatTaiwanTime(booking.endTime),
    planName: formatPlanName(booking.planType),
    participantCount: formatParticipantCount(booking.participantCount ?? 1),
    source: formatSourceName(booking.source),
    oldDate: formatTaiwanDate(previousBooking?.date),
    oldStartTime: formatTaiwanTime(previousBooking?.startTime),
    oldEndTime: formatTaiwanTime(previousBooking?.endTime),
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
  COPY_VERSION,
  BOOKING_EMAIL_FROM,
  DEFAULT_TEMPLATES,
  TEMPLATE_DEFINITIONS,
  DEFAULT_COACH_TO,
  DEFAULT_COACH_BCC,
  classifyBookingEvent,
  normalizeEmail,
  normalizeBookingSource,
  formatPlanName,
  formatSourceName,
  formatTaiwanDate,
  formatTaiwanTime,
  formatParticipantCount,
  safeMemberId,
  memberContactEmail,
  studentRecipientDecision,
  bookingRecipientPlan,
  bookingMailId,
  bookingMailEnvelope,
  renderTemplate,
  buildBookingMessages,
  allowedTokensFor,
  defaultTemplateFor,
  validateTemplate,
  normalizeConfig,
  validateConfig,
  customBookingTemplate,
};
