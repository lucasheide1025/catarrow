"use strict";

const { initializeApp } = require("firebase-admin/app");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { parseCostSignal, shouldRaise } = require("./costSignal");
const {
  classifyBookingEvent, buildBookingMessages, normalizeEmail, normalizeConfig, validateConfig,
  customBookingTemplate, defaultTemplateFor, allowedTokensFor,
} = require("./bookingEmail");

initializeApp();

exports.handleCostSignal = onMessagePublished({
  topic: "firestore-cost-signals",
  region: "asia-east1",
  retry: true,
}, async (event) => {
  let payload;
  try {
    payload = event.data.message.json;
  } catch (error) {
    logger.warn("Ignored malformed cost signal", {
      eventId: event.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const signal = parseCostSignal(payload);
  if (!signal) {
    logger.info("Ignored cost signal", { eventId: event.id });
    return;
  }

  const ref = getFirestore().doc("sysConfig/costControl");
  const result = await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() : {};
    const currentLevel = current.level || "normal";
    if (event.id && current.lastAutomationEventId === event.id) {
      return { raised: false, currentLevel, duplicate: true };
    }
    if (!shouldRaise(currentLevel, signal.level)) {
      return { raised: false, currentLevel };
    }

    const update = {
      level: signal.level,
      reason: signal.reason,
      source: signal.source,
      raisedAt: FieldValue.serverTimestamp(),
      raisedBy: "cost-signal-handler",
      observedAt: FieldValue.serverTimestamp(),
      observedPercent: signal.observedPercent,
      manualRecoveryRequired: true,
      revision: Math.max(0, Number(current.revision) || 0) + 1,
      lastAutomationEventId: event.id || null,
      lastAutomationEventAt: event.time
        ? Timestamp.fromDate(new Date(event.time))
        : FieldValue.serverTimestamp(),
    };
    if (snapshot.exists) transaction.update(ref, update);
    else transaction.create(ref, { monthlyCeilingTwd: 300, ...update });
    return { raised: true, previousLevel: currentLevel, nextLevel: signal.level };
  });

  logger.info("Processed cost signal", {
    eventId: event.id,
    source: signal.source,
    ...result,
  });
});

async function requireAdmin(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "請先登入");
  const adminSnap = await getFirestore().doc(`admins/${request.auth.uid}`).get();
  if (!adminSnap.exists) throw new HttpsError("permission-denied", "只有管理員可以執行此操作");
}

exports.saveBookingEmailConfig = onCall({ region: "asia-east1" }, async (request) => {
  await requireAdmin(request);
  let config;
  try { config = validateConfig(request.data); }
  catch (error) { throw new HttpsError("invalid-argument", error.message); }
  await getFirestore().doc("bookingEmailConfig/main").set({
    ...config,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  }, { merge: false });
  return { ok: true };
});

exports.sendBookingEmailTest = onCall({ region: "asia-east1" }, async (request) => {
  await requireAdmin(request);
  const requestId = String(request.data?.requestId || "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) {
    throw new HttpsError("invalid-argument", "測試信請求識別碼格式錯誤");
  }
  const templateId = String(request.data?.templateId || "");
  const fallback = defaultTemplateFor(templateId);
  if (!fallback) throw new HttpsError("invalid-argument", "未知的 Email 範本");
  let template;
  try {
    const config = validateConfig(request.data?.config);
    template = config.templates[templateId];
  } catch (error) {
    throw new HttpsError("invalid-argument", error.message);
  }
  const sample = {
    eventLabel: "新預約", studentName: "測試學生", contactEmail: "student@example.com",
    date: "2026-07-20", startTime: "10:00", endTime: "11:00", planName: "單人一般",
    participantCount: "1", source: "online", oldDate: "2026-07-19", oldStartTime: "09:00",
    oldEndTime: "10:00", daysSinceLastClass: "14", lastClassDate: "2026-07-06",
    bookingUrl: "https://student.catgroup.com.tw/",
  };
  const allowed = new Set(allowedTokensFor(templateId));
  const variables = Object.fromEntries(Object.entries(sample).filter(([key]) => allowed.has(key)));
  const { renderTemplate } = require("./bookingEmail");
  const recipient = normalizeEmail(request.data.config.coachTo);
  const db = getFirestore();
  const ref = db.doc(`mail/booking-email-test-${request.auth.uid}-${requestId}`);
  const rateRef = db.doc(`bookingEmailTestRate/${request.auth.uid}`);
  const queued = await db.runTransaction(async transaction => {
    const [mailSnap, rateSnap] = await transaction.getAll(ref, rateRef);
    if (mailSnap.exists) return false;
    const recent = (rateSnap.data()?.recent || [])
      .map(value => value?.toMillis?.() || 0)
      .filter(value => value > Date.now() - 60000);
    if (recent.length >= 5) {
      throw new HttpsError("resource-exhausted", "測試信每分鐘最多寄送 5 封，請稍後再試");
    }
    transaction.set(rateRef, {
      recent: [...recent.map(value => Timestamp.fromMillis(value)), Timestamp.now()],
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(ref, {
      to: recipient,
      message: {
        subject: `[測試] ${renderTemplate(template.subject, variables)}`,
        text: renderTemplate(template.text, variables),
      },
      createdAt: FieldValue.serverTimestamp(),
      bookingEmailTest: { templateId, requestedBy: request.auth.uid, requestId },
    });
    return true;
  });
  return { ok: true, recipient, queued };
});

// Rollout gate: bookingEmailConfig/main must explicitly contain enabled:true.
// Missing config therefore produces no email and makes deployment safe by default.
exports.handleBookingEmail = onDocumentWritten({
  document: "bookings/{bookingId}",
  region: "asia-east1",
  retry: true,
}, async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  const db = getFirestore();
  let previousBooking = null;
  let isVerifiedReschedule = false;
  if (!before && after?.status === "confirmed" && after.rescheduledFrom) {
    const previousSnap = await db.doc(`bookings/${after.rescheduledFrom}`).get();
    previousBooking = previousSnap.exists ? previousSnap.data() : null;
    isVerifiedReschedule = previousBooking?.status === "cancelled" &&
      previousBooking?.rescheduledTo === event.params.bookingId &&
      previousBooking?.memberId === after.memberId;
  } else if (before?.status === "confirmed" && after?.status === "cancelled" && after.rescheduledTo) {
    const nextSnap = await db.doc(`bookings/${after.rescheduledTo}`).get();
    const next = nextSnap.exists ? nextSnap.data() : null;
    isVerifiedReschedule = next?.status === "confirmed" &&
      next?.rescheduledFrom === event.params.bookingId &&
      next?.memberId === before.memberId;
  }
  const eventType = classifyBookingEvent(before, after, { isVerifiedReschedule });
  if (!eventType) return;

  const booking = after || before;
  const configSnap = await db.doc("bookingEmailConfig/main").get();
  const rawConfig = configSnap.exists ? configSnap.data() : {};
  const config = normalizeConfig(rawConfig);
  if (config.enabled !== true) {
    logger.info("Booking email skipped by rollout gate", {
      bookingId: event.params.bookingId,
      eventType,
    });
    return;
  }

  const messages = buildBookingMessages(
    eventType,
    booking,
    previousBooking,
    customBookingTemplate(config, eventType),
  );
  const baseId = `booking-${event.params.bookingId}-${eventType}`;
  const studentEmail = normalizeEmail(booking.contactEmail);
  const mailEntries = [
    studentEmail ? {
      ref: db.doc(`mail/${baseId}-student`),
      data: { to: studentEmail, message: messages.student },
    } : null,
    {
      ref: db.doc(`mail/${baseId}-coach`),
      data: { to: config.coachTo, bcc: config.coachBcc, message: messages.coach },
    },
  ].filter(Boolean);

  await db.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(...mailEntries.map(({ ref }) => ref));
    mailEntries.forEach(({ ref, data }, index) => {
      if (snapshots[index].exists) return;
      transaction.create(ref, {
        ...data,
        createdAt: FieldValue.serverTimestamp(),
        bookingNotification: {
          bookingId: event.params.bookingId,
          eventType,
          sourceEventId: event.id || null,
        },
      });
    });
  });

  logger.info("Booking email queued", {
    bookingId: event.params.bookingId,
    eventType,
    studentQueued: !!studentEmail,
    coachQueued: true,
  });
});
