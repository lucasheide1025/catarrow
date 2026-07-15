"use strict";

const { initializeApp } = require("firebase-admin/app");
const { FieldPath, FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { parseCostSignal, shouldRaise } = require("./costSignal");
const {
  classifyBookingEvent, buildBookingMessages, normalizeEmail, normalizeConfig, validateConfig,
  customBookingTemplate, defaultTemplateFor, allowedTokensFor,
} = require("./bookingEmail");
const { buildReminderCycle, reminderMailId, inactivityVariables, shouldReplaceReminderCycle } = require("./bookingReminder");

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
  if (after?.status === "completed" && before?.status !== "completed") {
    const cycle = buildReminderCycle(event.params.bookingId, after);
    if (cycle) {
      if (!normalizeEmail(cycle.contactEmail)) {
        const memberSnap = await db.doc(`members/${cycle.memberId}`).get();
        if (memberSnap.exists) cycle.contactEmail = memberContactEmail(memberSnap.data());
      }
      const queueRef = db.doc(`bookingReminderQueue/${cycle.memberId}`);
      await db.runTransaction(async transaction => {
        const current = await transaction.get(queueRef);
        const currentMs = current.data()?.completedAt?.toMillis?.() || 0;
        if (!shouldReplaceReminderCycle(currentMs, cycle.completedAt.getTime())) return;
        transaction.set(queueRef, {
          ...cycle,
          completedAt: Timestamp.fromDate(cycle.completedAt), dueAt: Timestamp.fromDate(cycle.dueAt),
          state: "pending", sentAt: null, skippedReason: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    }
  }
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

function taipeiDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Taipei", year:"numeric", month:"2-digit", day:"2-digit" }).format(now);
}

function taipeiTime(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone:"Asia/Taipei", hour:"2-digit", minute:"2-digit", hour12:false }).format(now);
}

function memberContactEmail(member = {}) {
  return normalizeEmail(member.email) || normalizeEmail(member.contactEmail) || "";
}

async function hasFutureConfirmedBooking(db, memberId, today, now = new Date()) {
  const currentTime = taipeiTime(now);
  const base = db.collection("bookings").where("memberId", "==", memberId).where("status", "==", "confirmed");
  const [laterDay, laterToday] = await Promise.all([
    base.where("date", ">", today).limit(1).get(),
    base.where("date", "==", today).where("startTime", ">", currentTime).limit(1).get(),
  ]);
  return !laterDay.empty || !laterToday.empty;
}

async function hasNewerCompletedBooking(db, cycle) {
  const snap = await db.collection("bookings").where("memberId", "==", cycle.memberId)
    .where("status", "==", "completed").orderBy("date", "desc").limit(50).get();
  return snap.docs.some(item => {
    if (item.id === cycle.completionCycleId) return false;
    const other = buildReminderCycle(item.id, item.data());
    return other && other.completedAt.getTime() > cycle.completedAt.getTime();
  });
}

exports.processBookingInactivityReminders = onSchedule({
  schedule: "0 10 * * *", timeZone: "Asia/Taipei", region: "asia-east1", retryCount: 0,
}, async () => {
  const db = getFirestore();
  const configSnap = await db.doc("bookingEmailConfig/main").get();
  const config = normalizeConfig(configSnap.exists ? configSnap.data() : {});
  if (!config.inactivityEnabled) return;
  const now = new Date();
  const runDate = taipeiDate(now);
  const runRef = db.doc(`bookingReminderRuns/${runDate}`);
  const queueSnap = await db.collection("bookingReminderQueue").where("state", "==", "pending")
    .where("dueAt", "<=", Timestamp.fromDate(now)).orderBy("dueAt").limit(50).get();
  let queued = 0;
  for (const docSnap of queueSnap.docs) {
    if (queued >= config.dailyLimit) break;
    const queue = docSnap.data();
    const email = normalizeEmail(queue.contactEmail);
    let skippedReason = "";
    if (!email) skippedReason = "invalid-email";
    else if (await hasFutureConfirmedBooking(db, queue.memberId, taipeiDate(now))) skippedReason = "future-booking";
    if (skippedReason) {
      await docSnap.ref.update({ state:"skipped", skippedReason, updatedAt:FieldValue.serverTimestamp() });
      continue;
    }
    const mailRef = db.doc(`mail/${reminderMailId(queue.memberId, queue.completionCycleId)}`);
    const variables = inactivityVariables(queue, now);
    const template = config.templates.studentInactive;
    const result = await db.runTransaction(async transaction => {
      const [freshQueue, mail, run] = await transaction.getAll(docSnap.ref, mailRef, runRef);
      if (!freshQueue.exists || freshQueue.data().state !== "pending") return "unchanged";
      if (mail.exists) {
        transaction.update(docSnap.ref, { state:"sent", sentAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() });
        return "already-queued";
      }
      const sentCount = Math.max(0, Number(run.data()?.sentCount) || 0);
      if (sentCount >= config.dailyLimit) return "limit-reached";
      transaction.create(mailRef, {
        to: email,
        message: { subject: require("./bookingEmail").renderTemplate(template.subject, variables), text: require("./bookingEmail").renderTemplate(template.text, variables) },
        createdAt: FieldValue.serverTimestamp(),
        bookingInactivityReminder: { memberId:queue.memberId, completionCycleId:queue.completionCycleId },
      });
      transaction.update(docSnap.ref, { state:"sent", sentAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() });
      transaction.set(runRef, { sentCount:sentCount + 1, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
      return "queued";
    });
    if (result === "queued") queued += 1;
    if (result === "limit-reached") break;
  }
  logger.info("Booking inactivity reminder batch completed", { candidates:queueSnap.size, queued });
});

exports.previewBookingInactivityBackfill = onCall({ region:"asia-east1" }, async request => {
  await requireAdmin(request);
  const limit = Math.min(50, Math.max(1, Number(request.data?.limit) || 20));
  const cursor = String(request.data?.cursor || "");
  if (cursor && !/^[^/]{1,1500}$/.test(cursor)) throw new HttpsError("invalid-argument", "游標格式錯誤");
  let query = getFirestore().collection("bookings").where("status", "==", "completed").orderBy("date", "desc").orderBy(FieldPath.documentId(), "desc").limit(limit);
  if (cursor) {
    const cursorSnap = await getFirestore().doc(`bookings/${cursor}`).get();
    if (!cursorSnap.exists) throw new HttpsError("invalid-argument", "游標已失效，請重新開始");
    const cursorData = cursorSnap.data();
    if (cursorData.status !== "completed" || !/^\d{4}-\d{2}-\d{2}$/.test(String(cursorData.date || ""))) {
      throw new HttpsError("invalid-argument", "游標不是有效的已完成預約，請重新開始");
    }
    query = query.startAfter(cursorSnap);
  }
  const snap = await query.get();
  const today = taipeiDate();
  const seen = new Set();
  const candidates = [];
  for (const bookingSnap of snap.docs) {
    const cycle = buildReminderCycle(bookingSnap.id, bookingSnap.data());
    if (!cycle || seen.has(cycle.memberId)) continue;
    seen.add(cycle.memberId);
    if (!normalizeEmail(cycle.contactEmail)) {
      const memberSnap = await getFirestore().doc(`members/${cycle.memberId}`).get();
      if (memberSnap.exists) cycle.contactEmail = memberContactEmail(memberSnap.data());
    }
    const email = normalizeEmail(cycle.contactEmail);
    const due = cycle.dueAt.getTime() <= Date.now();
    const newerCompletion = due && email ? await hasNewerCompletedBooking(getFirestore(), cycle) : false;
    const futureBooking = due && email && !newerCompletion ? await hasFutureConfirmedBooking(getFirestore(), cycle.memberId, today) : false;
    candidates.push({ bookingId:bookingSnap.id, memberId:cycle.memberId, studentName:cycle.studentName, email, lastClassDate:cycle.lastClassDate, eligible:!!email && due && !newerCompletion && !futureBooking, reason:!email?"沒有有效 Email":!due?"尚未滿 14 天":newerCompletion?"已有較新的完成課程":futureBooking?"已有未來預約":"可加入" });
  }
  return { candidates, nextCursor:snap.docs.at(-1)?.id || "", done:snap.size < limit };
});

exports.initializeBookingInactivityHistory = onCall({ region:"asia-east1" }, async request => {
  await requireAdmin(request);
  const ids = Array.isArray(request.data?.bookingIds) ? [...new Set(request.data.bookingIds.map(String).filter(id => /^[^/]{1,1500}$/.test(id)))].slice(0, 50) : [];
  if (!ids.length) throw new HttpsError("invalid-argument", "沒有可初始化的歷史紀錄");
  const db = getFirestore();
  let initialized = 0;
  for (const id of ids) {
    const bookingSnap = await db.doc(`bookings/${id}`).get();
    const cycle = bookingSnap.exists ? buildReminderCycle(id, bookingSnap.data()) : null;
    if (cycle && !normalizeEmail(cycle.contactEmail)) {
      const memberSnap = await db.doc(`members/${cycle.memberId}`).get();
      if (memberSnap.exists) cycle.contactEmail = memberContactEmail(memberSnap.data());
    }
    if (!cycle || !normalizeEmail(cycle.contactEmail) || cycle.dueAt.getTime() > Date.now()) continue;
    if (await hasNewerCompletedBooking(db, cycle)) continue;
    if (await hasFutureConfirmedBooking(db, cycle.memberId, taipeiDate())) continue;
    const ref = db.doc(`bookingReminderQueue/${cycle.memberId}`);
    const didInitialize = await db.runTransaction(async transaction => {
      const current = await transaction.get(ref);
      if ((current.data()?.completedAt?.toMillis?.() || 0) >= cycle.completedAt.getTime()) return false;
      transaction.set(ref, { ...cycle, completedAt:Timestamp.fromDate(cycle.completedAt), dueAt:Timestamp.fromDate(cycle.dueAt), state:"pending", sentAt:null, skippedReason:null, source:"admin-history", updatedAt:FieldValue.serverTimestamp() });
      return true;
    });
    if (didInitialize) initialized += 1;
  }
  return { ok:true, initialized };
});
