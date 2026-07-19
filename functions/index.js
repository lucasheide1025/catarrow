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
  customBookingTemplate, defaultTemplateFor, allowedTokensFor, memberContactEmail,
  bookingRecipientPlan, bookingMailId, renderTemplate,
  bookingMailEnvelope,
} = require("./bookingEmail");
const { buildReminderCycle, reminderMailId, inactivityVariables, shouldReplaceReminderCycle } = require("./bookingReminder");
const { buildTrustedMonsterReward } = require("./monsterReward");
const { buildDungeonBossEnvelope, validateChoices } = require("./dungeonBossReward");
const {
  taipeiDateOffset, isDayBeforeCandidate, dayBeforeRecipientDecision,
  dayBeforeMailId, dayBeforeVariables, boundedDayBeforeCandidates,
} = require("./bookingDayBefore");

initializeApp();

exports.claimMonsterBattleReward = onCall({ region:"asia-east1" }, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "請先登入");
  let reward;
  try { reward = buildTrustedMonsterReward(request.data); }
  catch (error) { throw new HttpsError("invalid-argument", error.message); }

  const db = getFirestore();
  const memberRef = db.doc(`members/${reward.memberId}`);
  const claimRef = db.doc(`monsterRewardClaims/${reward.claimId}`);
  const inventoryRef = db.doc(`materialInventory/${reward.memberId}`);
  const cardRef = db.doc(`cardCollections/${reward.memberId}`);
  return db.runTransaction(async transaction => {
    const [memberSnap, claimSnap, inventorySnap, cardSnap] = await transaction.getAll(memberRef, claimRef, inventoryRef, cardRef);
    if (!memberSnap.exists) throw new HttpsError("not-found", "member_not_found");
    const member = memberSnap.data();
    const ownsMember = member.uid === request.auth.uid || (request.auth.token.email && member.email === request.auth.token.email);
    if (!ownsMember) throw new HttpsError("permission-denied", "reward_owner_mismatch");
    if (claimSnap.exists) return { ok:true, duplicate:true, claimId:reward.claimId, reward:claimSnap.data().reward };
    const items = { ...(inventorySnap.data()?.items || {}) };
    for (const [materialId, quantity] of Object.entries(reward.materialTotals)) items[materialId] = Math.max(0, Number(items[materialId]) || 0) + quantity;
    transaction.set(inventoryRef, { items, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    if (reward.coins > 0) transaction.update(memberRef, { coins:FieldValue.increment(reward.coins), updatedAt:FieldValue.serverTimestamp() });
    if (reward.card) {
      const collection = cardSnap.data() || {};
      const cards = { ...(collection.cards || {}) };
      const existing = cards[reward.card.monsterId];
      cards[reward.card.monsterId] = existing
        ? { ...existing, duplicates:(existing.duplicates || 0) + 1 }
        : { ...reward.card, stars:1, duplicates:0, chosenStat:null, ts:Date.now() };
      transaction.set(cardRef, { cards, wbCards:collection.wbCards || {}, equipped:collection.equipped || [], updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    }
    const publicReward = { coins:reward.coins, materialTotals:reward.materialTotals, card:reward.card };
    transaction.create(claimRef, {
      battleId:reward.battleId, memberId:reward.memberId, rewardType:reward.rewardType,
      materialTotals:reward.materialTotals, coins:reward.coins, cardId:reward.card?.monsterId || null,
      metadata:{ mode:reward.mode, monsterId:reward.monsterId, catalogVersion:reward.catalogVersion, source:"callable" },
      reward:publicReward, claimedAt:FieldValue.serverTimestamp(),
    });
    return { ok:true, duplicate:false, claimId:reward.claimId, reward:publicReward };
  });
});

exports.createDungeonBossRewardClaim = onCall({ region:"asia-east1" }, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "請先登入");
  const battleId=String(request.data?.battleId||""), memberId=String(request.data?.memberId||""), monsterId=String(request.data?.monsterId||"");
  if (!battleId || !memberId || !monsterId || [battleId,memberId,monsterId].some(value=>value.includes("/")||value.length>240)) throw new HttpsError("invalid-argument","invalid_dungeon_reward_identity");
  const claimId=[battleId,memberId,"dungeonBoss"].map(encodeURIComponent).join("~");
  const db=getFirestore(), memberRef=db.doc(`members/${memberId}`), claimRef=db.doc(`monsterRewardClaims/${claimId}`), inventoryRef=db.doc(`materialInventory/${memberId}`), cardRef=db.doc(`cardCollections/${memberId}`);
  return db.runTransaction(async transaction=>{
    const [memberSnap,claimSnap,inventorySnap,cardSnap]=await transaction.getAll(memberRef,claimRef,inventoryRef,cardRef);
    if(!memberSnap.exists) throw new HttpsError("not-found","member_not_found");
    const member=memberSnap.data();
    if(!(member.uid===request.auth.uid||(request.auth.token.email&&member.email===request.auth.token.email))) throw new HttpsError("permission-denied","reward_owner_mismatch");
    if(claimSnap.exists) return {ok:true,duplicate:true,claimId,envelope:claimSnap.data().envelope};
    const progress=member.dungeonBossCardProgress?.[monsterId]||{};
    let envelope;
    try{envelope=buildDungeonBossEnvelope({battleId,memberId,monsterId,firstDefeat:!(Number(progress.defeats)>0),cardMisses:Math.max(0,Math.floor(Number(progress.misses)||0))});}
    catch(error){throw new HttpsError("invalid-argument",error.message);}
    const materialTotals={};
    [envelope.fixedReward.bossMaterial,...envelope.fixedReward.generalMaterials].forEach(item=>{materialTotals[item.materialId]=(materialTotals[item.materialId]||0)+item.quantity;});
    const items={...(inventorySnap.data()?.items||{})}; Object.entries(materialTotals).forEach(([id,qty])=>{items[id]=Math.max(0,Number(items[id])||0)+qty;});
    transaction.set(inventoryRef,{items,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    transaction.update(memberRef,{coins:FieldValue.increment(envelope.fixedReward.coins),kingSeals:FieldValue.increment(envelope.fixedReward.bossMarks),[`equipmentRuneFragments.${envelope.fixedReward.runeFragment.type}`]:FieldValue.increment(envelope.fixedReward.runeFragment.count),[`dungeonBossCardProgress.${monsterId}`]:{defeats:(Number(progress.defeats)||0)+1,misses:envelope.cardResult.nextMisses,lastBattleId:battleId},updatedAt:FieldValue.serverTimestamp()});
    if(envelope.card){const collection=cardSnap.data()||{},cards={...(collection.cards||{})},existing=cards[envelope.card.monsterId];cards[envelope.card.monsterId]=existing?{...existing,duplicates:(existing.duplicates||0)+1}:{...envelope.card,stars:1,duplicates:0,chosenStat:null,ts:Date.now()};transaction.set(cardRef,{cards,wbCards:collection.wbCards||{},equipped:collection.equipped||[],updatedAt:FieldValue.serverTimestamp()},{merge:true});}
    transaction.create(claimRef,{battleId,memberId,rewardType:"dungeonBoss",materialTotals,coins:envelope.fixedReward.coins,cardId:envelope.card?.monsterId||null,metadata:{mode:"dungeon",monsterId,catalogVersion:envelope.catalogVersion,source:"callable"},envelope,choiceStatus:"pending",claimedAt:FieldValue.serverTimestamp()});
    return {ok:true,duplicate:false,claimId,envelope};
  });
});

exports.claimDungeonBossChoices = onCall({region:"asia-east1"},async request=>{
  if(!request.auth?.uid) throw new HttpsError("unauthenticated","請先登入");
  const claimId=String(request.data?.claimId||""),memberId=String(request.data?.memberId||""),selectedOptionIds=Array.isArray(request.data?.selectedOptionIds)?request.data.selectedOptionIds.map(String):[];
  if(!claimId||!memberId||claimId.includes("/")||memberId.includes("/")) throw new HttpsError("invalid-argument","invalid_dungeon_choice_identity");
  const db=getFirestore(),fixedRef=db.doc(`monsterRewardClaims/${claimId}`),choiceRef=db.doc(`dungeonBossChoiceClaims/${claimId}`),memberRef=db.doc(`members/${memberId}`),inventoryRef=db.doc(`materialInventory/${memberId}`);
  return db.runTransaction(async transaction=>{
    const [fixedSnap,choiceSnap,memberSnap,inventorySnap]=await transaction.getAll(fixedRef,choiceRef,memberRef,inventoryRef);
    if(choiceSnap.exists)return{ok:true,duplicate:true,selectedOptionIds:choiceSnap.data().selectedOptionIds||[]};
    if(!fixedSnap.exists||!memberSnap.exists)throw new HttpsError("not-found","dungeon_boss_reward_not_found");
    const member=memberSnap.data(),fixed=fixedSnap.data();
    if(!(member.uid===request.auth.uid||(request.auth.token.email&&member.email===request.auth.token.email))||fixed.memberId!==memberId)throw new HttpsError("permission-denied","dungeon_choice_owner_mismatch");
    if(!validateChoices(fixed.envelope,selectedOptionIds))throw new HttpsError("invalid-argument","invalid_dungeon_boss_choices");
    const selected=fixed.envelope.choiceOptions.filter(option=>selectedOptionIds.includes(option.id)),materialTotals={},collectibleTotals={};let coins=0;
    selected.forEach(option=>{if(option.type==="material")(option.reward.materials||[]).forEach(item=>{materialTotals[item.materialId]=(materialTotals[item.materialId]||0)+item.quantity;});else if(option.type==="coins")coins+=option.reward.coins||0;else if(option.type==="exploration"&&option.reward.itemId)collectibleTotals[option.reward.itemId]=(collectibleTotals[option.reward.itemId]||0)+option.reward.quantity;});
    if(Object.keys(materialTotals).length){const items={...(inventorySnap.data()?.items||{})};Object.entries(materialTotals).forEach(([id,qty])=>{items[id]=Math.max(0,Number(items[id])||0)+qty;});transaction.set(inventoryRef,{items,updatedAt:FieldValue.serverTimestamp()},{merge:true});}
    transaction.update(memberRef,{...(coins?{coins:FieldValue.increment(coins)}:{}),...Object.fromEntries(Object.entries(collectibleTotals).map(([id,qty])=>[`dungeonCollectibles.${id}`,FieldValue.increment(qty)])),updatedAt:FieldValue.serverTimestamp()});
    transaction.create(choiceRef,{memberId,battleId:fixed.battleId,fixedClaimId:claimId,selectedOptionIds,materialTotals,collectibleTotals,coins,claimedAt:FieldValue.serverTimestamp()});
    return{ok:true,duplicate:false,selectedOptionIds,materialTotals,collectibleTotals,coins};
  });
});

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
    date: "2026年7月20日", startTime: "上午10:00", endTime: "上午11:00", planName: "單人一般",
    participantCount: "1人", source: "學生線上約課", oldDate: "2026年7月19日", oldStartTime: "上午9:00",
    oldEndTime: "上午10:00", daysSinceLastClass: "14", lastClassDate: "2026年7月6日",
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
    transaction.create(ref, bookingMailEnvelope({
      to: recipient,
      message: {
        subject: `[測試] ${renderTemplate(template.subject, variables)}`,
        text: renderTemplate(template.text, variables),
      },
      createdAt: FieldValue.serverTimestamp(),
      bookingEmailTest: { templateId, requestedBy: request.auth.uid, requestId },
    }));
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
  const isImmediateEmailCandidate =
    (!before && after?.status === "confirmed") ||
    (before?.status === "confirmed" && after?.status === "cancelled");
  if (!isImmediateEmailCandidate) return;

  // Check the fail-closed rollout gate before any reschedule-relationship or
  // recipient lookup. Reminder-cycle maintenance above is intentionally
  // independent so disabling immediate notifications does not lose history.
  const configSnap = await db.doc("bookingEmailConfig/main").get();
  const rawConfig = configSnap.exists ? configSnap.data() : {};
  const config = normalizeConfig(rawConfig);
  if (config.enabled !== true) {
    logger.info("Booking email skipped by rollout gate", {
      bookingId: event.params.bookingId,
    });
    return;
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
  let recipient = bookingRecipientPlan(booking);
  if (recipient.shouldLookupMember) {
    const memberSnap = await db.doc(`members/${recipient.memberId}`).get();
    recipient = bookingRecipientPlan(booking, memberSnap.exists ? memberSnap.data() : {});
  }
  const studentEmail = recipient.email;
  const bookingForMessage = studentEmail && studentEmail !== normalizeEmail(booking.contactEmail)
    ? { ...booking, contactEmail: studentEmail }
    : booking;
  const messages = buildBookingMessages(
    eventType,
    bookingForMessage,
    previousBooking,
    customBookingTemplate(config, eventType),
  );
  const mailEntries = [
    studentEmail ? {
      ref: db.doc(`mail/${bookingMailId(event.params.bookingId, eventType, "student")}`),
      data: { to: studentEmail, message: messages.student },
    } : null,
    {
      ref: db.doc(`mail/${bookingMailId(event.params.bookingId, eventType, "coach")}`),
      data: { to: config.coachTo, bcc: config.coachBcc, message: messages.coach },
    },
  ].filter(Boolean);

  await db.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(...mailEntries.map(({ ref }) => ref));
    mailEntries.forEach(({ ref, data }, index) => {
      if (snapshots[index].exists) return;
      transaction.create(ref, bookingMailEnvelope({
        ...data,
        createdAt: FieldValue.serverTimestamp(),
        bookingNotification: {
          bookingId: event.params.bookingId,
          eventType,
          sourceEventId: event.id || null,
        },
      }));
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
      transaction.create(mailRef, bookingMailEnvelope({
        to: email,
        message: { subject: require("./bookingEmail").renderTemplate(template.subject, variables), text: require("./bookingEmail").renderTemplate(template.text, variables) },
        createdAt: FieldValue.serverTimestamp(),
        bookingInactivityReminder: { memberId:queue.memberId, completionCycleId:queue.completionCycleId },
      }));
      transaction.update(docSnap.ref, { state:"sent", sentAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() });
      transaction.set(runRef, { sentCount:sentCount + 1, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
      return "queued";
    });
    if (result === "queued") queued += 1;
    if (result === "limit-reached") break;
  }
  logger.info("Booking inactivity reminder batch completed", { candidates:queueSnap.size, queued });
});

exports.processBookingDayBeforeReminders = onSchedule({
  schedule: "0 10 * * *", timeZone: "Asia/Taipei", region: "asia-east1", retryCount: 0,
}, async () => {
  const db = getFirestore();
  const configSnap = await db.doc("bookingEmailConfig/main").get();
  const config = normalizeConfig(configSnap.exists ? configSnap.data() : {});
  if (!config.dayBeforeEnabled) return;

  const targetDate = taipeiDateOffset(new Date(), 1);
  const queryLimit = config.dayBeforeDailyLimit + 1;
  const bookingSnap = await db.collection("bookings")
    .where("status", "==", "confirmed")
    .where("date", "==", targetDate)
    .limit(queryLimit)
    .get();
  const { candidates, overLimit } = boundedDayBeforeCandidates(bookingSnap.docs, config.dayBeforeDailyLimit);
  let queued = 0;
  let skipped = 0;

  for (const candidateSnap of candidates) {
    const booking = candidateSnap.data();
    if (!isDayBeforeCandidate(booking, targetDate)) {
      skipped += 1;
      continue;
    }

    const mailRef = db.doc(`mail/${dayBeforeMailId(candidateSnap.id, targetDate)}`);
    const result = await db.runTransaction(async transaction => {
      const [freshBookingSnap, mailSnap] = await transaction.getAll(candidateSnap.ref, mailRef);
      if (mailSnap.exists) return "already-queued";
      if (!freshBookingSnap.exists || !isDayBeforeCandidate(freshBookingSnap.data(), targetDate)) return "no-longer-eligible";
      let freshRecipient = dayBeforeRecipientDecision(freshBookingSnap.data());
      if (freshRecipient.shouldLookupMember) {
        const memberSnap = await transaction.get(db.doc(`members/${freshRecipient.memberId}`));
        freshRecipient = dayBeforeRecipientDecision(
          freshBookingSnap.data(),
          memberSnap.exists ? memberSnap.data() : {},
        );
      }
      if (!freshRecipient.email) return "no-longer-eligible";
      const variables = dayBeforeVariables(freshBookingSnap.data());
      const template = config.templates.studentDayBefore;
      transaction.create(mailRef, bookingMailEnvelope({
        to: freshRecipient.email,
        message: {
          subject: renderTemplate(template.subject, variables),
          text: renderTemplate(template.text, variables),
        },
        createdAt: FieldValue.serverTimestamp(),
        bookingDayBeforeReminder: {
          bookingId: candidateSnap.id,
          bookingDate: targetDate,
          source: freshRecipient.source,
        },
      }));
      return "queued";
    });
    if (result === "queued") queued += 1;
    else skipped += 1;
  }

  if (overLimit) {
    logger.warn("Booking day-before reminder limit reached; remaining bookings were not scanned", {
      targetDate,
      dailyLimit: config.dayBeforeDailyLimit,
      observedAtLeast: bookingSnap.size,
    });
  }
  logger.info("Booking day-before reminder batch completed", {
    targetDate,
    scanned: candidates.length,
    queued,
    skipped,
    overLimit,
  });
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
