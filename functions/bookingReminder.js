"use strict";

const REMINDER_DELAY_DAYS = 14;
const BOOKING_URL = "https://student.catgroup.com.tw/";

function taipeiBookingEnd(booking) {
  const date = String(booking?.date || "");
  const time = String(booking?.endTime || booking?.startTime || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (year < 2000 || year > 2200 || month < 1 || month > 12 || day < 1 || day > daysInMonth) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute));
}

function buildReminderCycle(bookingId, booking) {
  const memberId = typeof booking?.memberId === "string" ? booking.memberId.trim() : "";
  if (!bookingId || booking?.status !== "completed" || !memberId || memberId.includes("/")) return null;
  const completedAt = taipeiBookingEnd(booking);
  if (!completedAt) return null;
  return {
    memberId,
    completionCycleId: bookingId,
    completedAt,
    dueAt: new Date(completedAt.getTime() + REMINDER_DELAY_DAYS * 86400000),
    lastClassDate: booking.date,
    studentName: booking.memberName || "同學",
    contactEmail: booking.contactEmail || "",
  };
}

function reminderMailId(memberId, completionCycleId) {
  return `inactive-${memberId}-${completionCycleId}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 1400);
}

function inactivityVariables(queue, now = new Date()) {
  const completedMs = queue.completedAt?.toMillis?.() ?? new Date(queue.completedAt).getTime();
  return {
    studentName: queue.studentName || "同學",
    daysSinceLastClass: Math.max(REMINDER_DELAY_DAYS, Math.floor((now.getTime() - completedMs) / 86400000)),
    lastClassDate: queue.lastClassDate || "",
    bookingUrl: BOOKING_URL,
  };
}

function isFutureConfirmedBooking(booking, today, currentTime) {
  return booking?.status === "confirmed" && (booking.date > today || (booking.date === today && booking.startTime > currentTime));
}

function shouldReplaceReminderCycle(currentCompletedMs, nextCompletedMs) {
  return Number(currentCompletedMs || 0) < Number(nextCompletedMs || 0);
}

function takeReminderBatch(items, dailyLimit) {
  return (Array.isArray(items) ? items : []).slice(0, Math.min(50, Math.max(1, Number(dailyLimit) || 20)));
}

module.exports = { REMINDER_DELAY_DAYS, BOOKING_URL, taipeiBookingEnd, buildReminderCycle, reminderMailId, inactivityVariables, isFutureConfirmedBooking, shouldReplaceReminderCycle, takeReminderBatch };
