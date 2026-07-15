"use strict";

const { initializeApp } = require("firebase-admin/app");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { parseCostSignal, shouldRaise } = require("./costSignal");
const { classifyBookingEvent, buildBookingMessages, normalizeEmail } = require("./bookingEmail");

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

const COACH_TO = "broudes@gmail.com";
const COACH_BCC = ["chobitsgl1@gmail.com", "beluga0109@gmail.com"];

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
  const config = configSnap.exists ? configSnap.data() : {};
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
    config.templates?.[eventType],
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
      data: { to: COACH_TO, bcc: COACH_BCC, message: messages.coach },
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
