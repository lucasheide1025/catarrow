"use strict";

const EVENT_TYPES = Object.freeze({
  CONFIRMED: "confirmed",
  RESCHEDULED: "rescheduled",
  CANCELLED: "cancelled",
});

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
    source: booking.source || "",
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
  DEFAULT_TEMPLATES,
  classifyBookingEvent,
  normalizeEmail,
  renderTemplate,
  buildBookingMessages,
};
