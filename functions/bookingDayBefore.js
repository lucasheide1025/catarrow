"use strict";

const crypto = require("node:crypto");
const { normalizeBookingSource, normalizeEmail, safeMemberId, memberContactEmail } = require("./bookingEmail");

const BOOKING_URL = "https://student.catgroup.com.tw/";

function taipeiDateOffset(now = new Date(), days = 0) {
  const shifted = new Date(now.getTime() + Number(days || 0) * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(shifted);
}

function isDayBeforeCandidate(booking = {}, targetDate) {
  const source = normalizeBookingSource(booking.source);
  return booking.status === "confirmed" &&
    booking.date === targetDate &&
    (source === "online_public" || source === "online");
}

function dayBeforeRecipientDecision(booking = {}, member = null) {
  const source = normalizeBookingSource(booking.source);
  if (source !== "online_public" && source !== "online") {
    return { source, memberId: "", email: "", shouldLookupMember: false };
  }
  const snapshotEmail = normalizeEmail(booking.contactEmail);
  const memberId = safeMemberId(booking.memberId);
  const mayUseMember = source === "online" && !!memberId;
  return {
    source,
    memberId,
    email: snapshotEmail || (mayUseMember ? memberContactEmail(member || {}) : ""),
    shouldLookupMember: !snapshotEmail && mayUseMember && member === null,
  };
}

function dayBeforeMailId(bookingId, bookingDate) {
  const id = String(bookingId || "");
  const date = String(bookingDate || "");
  if (/^[^/]{1,1400}$/.test(id) && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `booking-day-before-${id}-${date}`;
  }
  const digest = crypto.createHash("sha256").update(`${id}\u0000${date}`).digest("hex");
  return `booking-day-before-${digest}`;
}

function dayBeforeVariables(booking = {}) {
  return {
    studentName: booking.memberName || "同學",
    date: booking.date || "",
    startTime: booking.startTime || "",
    endTime: booking.endTime || "",
    planName: booking.planType || "未指定",
    participantCount: booking.participantCount || 1,
    source: normalizeBookingSource(booking.source),
    bookingUrl: BOOKING_URL,
  };
}

function boundedDayBeforeCandidates(items, dailyLimit) {
  const limit = Number.isInteger(dailyLimit) && dailyLimit >= 1 && dailyLimit <= 100 ? dailyLimit : 50;
  const values = Array.isArray(items) ? items : [];
  return { candidates: values.slice(0, limit), overLimit: values.length > limit, limit };
}

module.exports = {
  BOOKING_URL,
  taipeiDateOffset,
  isDayBeforeCandidate,
  dayBeforeRecipientDecision,
  dayBeforeMailId,
  dayBeforeVariables,
  boundedDayBeforeCandidates,
};
