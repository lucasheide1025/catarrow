"use strict";

const { initializeApp } = require("firebase-admin/app");
const { FieldPath, FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const worldBossLifecycle = require("./worldBossLifecycle");
const { buildWorldBossRewardSnapshot, rewardCategoryForBoss, largestRemainderAllocation, stableUnit, materialChest, coinChest, mergeNumeric } = require("./worldBossRewardSnapshot");
const { WORLD_BOSS_CATALOG } = require("./worldBossCatalog");
const { parseCostSignal, shouldRaise } = require("./costSignal");
const {
  classifyBookingEvent, buildBookingMessages, normalizeEmail, normalizeConfig, validateConfig,
  customBookingTemplate, defaultTemplateFor, allowedTokensFor, memberContactEmail,
  bookingRecipientPlan, bookingMailId, renderTemplate,
  bookingMailEnvelope,
} = require("./bookingEmail");
const { buildReminderCycle, reminderMailId, inactivityVariables, shouldReplaceReminderCycle } = require("./bookingReminder");
const { buildDungeonNormalCardClaim, buildTrustedMonsterReward, buildTrustedMultiMonsterReward } = require("./monsterReward");
const { buildPartyReward } = require("./partyReward");
const { FREE_HUNT_DAILY_LIMIT, assertMode:assertFreeHuntMode, consumeUsage:consumeFreeHuntUsage } = require("./freeHuntQuota");
const { buildDungeonBossEnvelope, buildFamilyMaterialChests, isRewardableDungeonRoom, isRewardableTeamDungeonBossRoom, publicEnvelope, validateChoices } = require("./dungeonBossReward");
const { GUEST_COMMON_EQUIPMENT, assertActiveGuest, starterPatch, purchasePatch } = require("./guestEquipment");
const {
  taipeiDateOffset, isDayBeforeCandidate, dayBeforeRecipientDecision,
  dayBeforeMailId, dayBeforeVariables, boundedDayBeforeCandidates,
} = require("./bookingDayBefore");
const guestReviews = require("./guestReviews");
const marketingEmail = require("./marketingEmail");
const competitionWebsitePublisher = require("./competitionWebsitePublisher");
const multiMonsterPartyV2 = require("./multiMonsterPartyV2");
const {buildDungeonMultiReward,hasDungeonMultiRunProof}=require("./dungeonMultiReward");
const combatRuntime = require("./generated/combat/lib/multiMonsterLoadoutRuntime");
const CAT_ARCHERY_VERCEL = defineSecret("CAT_ARCHERY_VERCEL");

initializeApp();

async function authoritativeMultiMonsterLoadouts(db, room) {
  const ids=Object.keys(room.members||{}).sort();
  const family=room.multiFamily||null;
  const [configSnap,certCompetitionSnap,catalogCompetitionSnap]=await Promise.all([
    db.doc("dexConfig/rounds").get(),
    db.collection("competitions").where("type","==","年度檢定").get(),
    db.collection("competitions").where("dexCatalog","==",true).get(),
  ]);
  const competitionMap=new Map();
  for(const doc of [...certCompetitionSnap.docs,...catalogCompetitionSnap.docs])competitionMap.set(doc.id,{id:doc.id,...doc.data()});
  const dexCompetitions=[...competitionMap.values()];
  const pairs=await Promise.all(ids.map(async memberId=>{
    const refs=["members","certifications","dexGrants","monsterDex","craftStats","chestStats","potionDex","cardCollections","guildProfiles","duelStats","equipSpecializations"].map(name=>db.doc(`${name}/${memberId}`));
    const [docs,certs,cats]=await Promise.all([
      db.getAll(...refs),
      db.collection("certRecords").where("memberId","==",memberId).get(),
      db.collection(`members/${memberId}/cats`).get(),
    ]);
    const data=Object.fromEntries(refs.map((ref,index)=>[ref.parent.id,docs[index].data()||{}]));
    if(!docs[0].exists)throw new Error("member_not_found");
    const guild=data.guildProfiles||{};
    const sharedData={
      certification:data.certifications||null,certRecords:certs.docs.map(doc=>({id:doc.id,...doc.data()})),
      dexConfig:configSnap.data()||{physicalMax:10,pointMax:10},dexGrants:data.dexGrants?.items||[],
      monsterDex:data.monsterDex?.monsters||{},craftStats:data.craftStats||{},chestStats:data.chestStats?.opens||{},
      potionDex:data.potionDex||{},cardData:data.cardCollections||{cards:{},wbCards:{},equipped:[]},duelStats:data.duelStats||{},
      cats:cats.docs.map(doc=>({catId:doc.id,...doc.data()})),guildRep:Math.max(0,Number(guild.rep)||0),guildExpeditionStats:guild.expeditions||{},dexCompetitions,
    };
    const persistedSpec=data.equipSpecializations||{};
    const equipSpec=Object.fromEntries(["weapon","armor","accessory"].map(slot=>{
      const trackId=persistedSpec[slot]?.activeTrackId;
      const level=Math.max(0,Number(persistedSpec[slot]?.tracks?.[trackId]?.level)||0);
      return [slot,trackId&&level>0?{trackId,level}:null];
    }));
    return [memberId,combatRuntime.buildMultiMonsterLoadout({member:{id:memberId,...data.members},sharedData,equipSpec,enemyFamily:family,enemyClass:"normal"})];
  }));
  return Object.fromEntries(pairs);
}

function taipeiFreeHuntDateKey(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone:"Asia/Taipei", year:"numeric", month:"2-digit", day:"2-digit",
  }).formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function safeFreeHuntId(value, code) {
  const id = String(value || "").trim();
  if (!id || id.includes("/") || id.length > 240) throw new HttpsError("invalid-argument", code);
  return id;
}

async function requireOwnedMember(db, request, memberId) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "login_required");
  const snap=await db.doc(`members/${safeFreeHuntId(memberId,"invalid_member_id")}`).get();
  const data=snap.data()||{};
  if(!snap.exists||(data.uid!==request.auth.uid&&(!request.auth.token?.email||data.email!==request.auth.token.email)))throw new HttpsError("permission-denied","member_identity_mismatch");
  return snap;
}

async function requireAdmin(request) {
  if (!request.auth?.uid || !(await getFirestore().doc(`admins/${request.auth.uid}`).get()).exists) {
    throw new HttpsError("permission-denied", "admin_required");
  }
  return request.auth.uid;
}

async function memberForAuth(db, auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "login_required");
  const byUid = await db.collection("members").where("uid", "==", auth.uid).limit(2).get();
  const matches = byUid.docs.filter(doc => doc.data().accountType === "guest");
  if (matches.length !== 1) throw new HttpsError("permission-denied", "guest_identity_not_found");
  return matches[0];
}

function reviewError(error) {
  if (error instanceof HttpsError) return error;
  return new HttpsError("failed-precondition", error?.message || "guest_review_failed");
}

async function subjectForToken(db, token) {
  if (!/^[A-Za-z0-9_-]{40,120}$/.test(String(token || ""))) throw new HttpsError("invalid-argument", "invalid_review_link");
  const found = await db.collection("guestReviewSubjects").where("tokenHash", "==", guestReviews.tokenHash(token)).limit(2).get();
  if (found.size !== 1) throw new HttpsError("not-found", "review_link_not_found");
  const subject = found.docs[0];
  if (subject.data().tokenExpiresAt?.toMillis?.() <= Date.now()) throw new HttpsError("deadline-exceeded", "review_link_expired");
  return subject;
}

async function submitReview(db, subjectSnap, input) {
  let normalized;
  try { normalized = guestReviews.normalizeReviewInput(input); } catch (error) { throw reviewError(error); }
  const memberId = subjectSnap.id, subjectRef = subjectSnap.ref, reviewRef = db.doc(`guestReviews/${memberId}`);
  await db.runTransaction(async tx => {
    const [subject, review, member, booking] = await tx.getAll(subjectRef, reviewRef, db.doc(`members/${memberId}`), db.doc(`bookings/${subjectSnap.data().bookingId}`));
    if (!subject.exists || subject.data().state === "submitted" || review.exists) throw new HttpsError("already-exists", "review_already_submitted");
    if (!member.exists || member.data().accountType !== "guest" || !booking.exists || booking.data().status !== "completed" || booking.data().memberId !== memberId) throw new HttpsError("failed-precondition", "visit_not_eligible");
    tx.create(reviewRef, { memberId, bookingId:booking.id, ...normalized, state:normalized.consentToPublish ? "pending" : "private_unread", submittedAt:FieldValue.serverTimestamp(), reviewedAt:null, reviewedBy:null, rejectionReason:null, publicReviewId:null, complaint:null });
    tx.update(subjectRef, { state:"submitted", tokenHash:FieldValue.delete(), tokenExpiresAt:FieldValue.delete(), updatedAt:FieldValue.serverTimestamp() });
  });
  const config = guestReviews.defaultConfig((await db.doc("guestReviewConfig/main").get()).data());
  return { ok:true, googleReviewUrl:normalized.rating === 5 && config.googlePromptEnabled ? config.googleReviewUrl || null : null };
}

exports.contributeWorldBossSpawnProgress = onCall({ region:"asia-east1" }, async request => {
  return worldBossLifecycle.contribute(getFirestore(), request);
});

// Guest review workflow. All internal collections are server-owned; clients use these callables.
exports.createGuestReviewSubject = onDocumentWritten({ region:"asia-east1", document:"bookings/{bookingId}" }, async event => {
  const before = event.data?.before.data(), after = event.data?.after.data();
  if (!after || after.status !== "completed" || before?.status === "completed" || !after.memberId) return;
  const db = getFirestore(), config = guestReviews.defaultConfig((await db.doc("guestReviewConfig/main").get()).data());
  if (!config.enabled) return;
  const memberRef = db.doc(`members/${after.memberId}`), subjectRef = db.doc(`guestReviewSubjects/${after.memberId}`), reviewRef = db.doc(`guestReviews/${after.memberId}`);
  await db.runTransaction(async tx => {
    const [member, subject, review] = await tx.getAll(memberRef, subjectRef, reviewRef);
    if (!member.exists || member.data().accountType !== "guest" || !guestReviews.normalizeEmail(member.data().email) || subject.exists || review.exists) return;
    tx.create(subjectRef, { memberId:after.memberId, bookingId:event.params.bookingId, state:"scheduled", dueAt:Timestamp.fromDate(guestReviews.nextTaipeiTen()), tokenHash:null, tokenExpiresAt:null, inviteMailId:null, inviteQueuedAt:null, inviteDeliveredAt:null, lastInviteError:null, inviteAttemptCount:0, manualInviteCount:0, createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() });
  });
});

async function queueGuestReviewInvite(db, subjectRef, { operatorId = null, requestId = null } = {}) {
  const rawToken = guestReviews.makeToken(), now = new Date();
  return db.runTransaction(async tx => {
    const subject = await tx.get(subjectRef); if (!subject.exists) throw new HttpsError("not-found", "review_invite_not_found");
    const current = subject.data(), memberRef = db.doc(`members/${subject.id}`), bookingRef = db.doc(`bookings/${current.bookingId}`), reviewRef=db.doc(`guestReviews/${subject.id}`);
    if (current.hiddenAt) return { queued:false, hidden:true };
    const [member, booking, review] = await tx.getAll(memberRef, bookingRef, reviewRef);
    if (review.exists || current.state === "submitted") throw new HttpsError("failed-precondition", "review_already_submitted");
    if (!member.exists || member.data().accountType !== "guest" || !booking.exists || booking.data().status !== "completed" || booking.data().memberId !== subject.id) throw new HttpsError("failed-precondition", "visit_not_eligible");
    const email = guestReviews.normalizeEmail(member.data().email); if (!email) throw new HttpsError("failed-precondition", "guest_email_invalid");
    const sequence = operatorId ? (Number(current.manualInviteCount) || 0) + 1 : (Number(current.inviteAttemptCount) || 0) + 1;
    if (!operatorId && !["scheduled", "invite_failed"].includes(current.state)) return { queued:false };
    if (operatorId && !["scheduled","invited","invite_failed"].includes(current.state)) throw new HttpsError("failed-precondition","invite_not_resendable");
    if (operatorId && requestId && current.lastManualRequestId === requestId) return { queued:false };
    const config = guestReviews.defaultConfig((await tx.get(db.doc("guestReviewConfig/main"))).data()); if (!config.enabled) throw new HttpsError("failed-precondition", "guest_reviews_disabled");
    const mailId = guestReviews.inviteMailId(subject.id, sequence, operatorId ? "manual" : "auto"), appUrl=String(process.env.GUEST_REVIEW_APP_URL||"https://catarrow.vercel.app").replace(/\/$/,""), reviewUrl = `${appUrl}/?review=${encodeURIComponent(rawToken)}`;
    const mailRef = db.doc(`mail/${mailId}`), mail = await tx.get(mailRef); if (mail.exists) return { queued:false };
    tx.create(mailRef, { to:email, message:{ subject:config.inviteSubject, text:`${config.inviteText}\n\n${reviewUrl}\n\n此連結於 14 天後失效。` }, guestReviewInvite:{ memberId:subject.id, bookingId:current.bookingId, sequence }, createdAt:FieldValue.serverTimestamp() });
    tx.update(subjectRef, { state:"invited", tokenHash:guestReviews.tokenHash(rawToken), tokenExpiresAt:Timestamp.fromDate(guestReviews.tokenExpiresAt(now)), inviteMailId:mailId, inviteQueuedAt:FieldValue.serverTimestamp(), inviteDeliveredAt:null, lastInviteError:null, ...(!operatorId?{inviteAttemptCount:sequence}:{}), ...(operatorId ? { manualInviteCount:sequence, lastManualInviteAt:FieldValue.serverTimestamp(), lastManualInviteBy:operatorId, lastManualRequestId:requestId } : {}), updatedAt:FieldValue.serverTimestamp() });
    return { queued:true };
  });
}

exports.processGuestReviewInvites = onSchedule({ region:"asia-east1", schedule:"0 10 * * *", timeZone:"Asia/Taipei", retryCount:1 }, async () => {
  const db = getFirestore(), config = guestReviews.defaultConfig((await db.doc("guestReviewConfig/main").get()).data()); if (!config.enabled) return;
  // 自動清理：邀請已送達超過 14 天仍未提交評價 → 刪除該邀請（避免管理清單累積）
  const staleCutoff = Timestamp.fromMillis(Date.now() - 14 * guestReviews.DAY_MS);
  const stale = await db.collection("guestReviewSubjects").where("inviteDeliveredAt", "<=", staleCutoff).limit(100).get();
  let cleaned = 0;
  for (const snap of stale.docs) {
    const s = snap.data();
    if (s.state !== "invited" || s.hiddenAt) continue;
    const review = await db.doc(`guestReviews/${snap.id}`).get();
    if (review.exists) continue;
    await snap.ref.delete(); cleaned += 1;
  }
  if (cleaned) logger.info("Guest review stale invites cleaned", { cleaned });
  const due = await db.collection("guestReviewSubjects").where("state", "in", ["scheduled", "invite_failed"]).where("dueAt", "<=", Timestamp.now()).limit(50).get();
  for (const subject of due.docs) await queueGuestReviewInvite(db, subject.ref).catch(error => logger.error("Guest review invite failed", { subjectId: subject.id, error: error.message }));
});

exports.previewGuestReview = onCall({ region:"asia-east1" }, async request => {
  const subject = await subjectForToken(getFirestore(), request.data?.token);
  return { eligible:subject.data().state !== "submitted", expiresAt:subject.data().tokenExpiresAt.toDate().toISOString() };
});
exports.submitGuestReviewByToken = onCall({ region:"asia-east1" }, async request => submitReview(getFirestore(), await subjectForToken(getFirestore(), request.data?.token), request.data));
exports.getMyGuestReview = onCall({ region:"asia-east1" }, async request => {
  const db=getFirestore(), member=await memberForAuth(db,request.auth), subject=await db.doc(`guestReviewSubjects/${member.id}`).get(), review=await db.doc(`guestReviews/${member.id}`).get();
  return { eligible:subject.exists && subject.data().state!=="submitted", review:review.exists ? {rating:review.data().rating,message:review.data().message,publicAlias:review.data().publicAlias,consentToPublish:review.data().consentToPublish,state:review.data().state} : null };
});
exports.submitMyGuestReview = onCall({ region:"asia-east1" }, async request => { const db=getFirestore(),member=await memberForAuth(db,request.auth),subject=await db.doc(`guestReviewSubjects/${member.id}`).get();if(!subject.exists)throw new HttpsError("failed-precondition","no_review_eligibility");return submitReview(db,subject,request.data); });
exports.withdrawGuestReviewPublication = onCall({ region:"asia-east1" }, async request => {
  const db=getFirestore(),member=await memberForAuth(db,request.auth),reviewRef=db.doc(`guestReviews/${member.id}`);await db.runTransaction(async tx=>{const review=await tx.get(reviewRef);if(!review.exists||!guestReviews.canTransition(review.data().state,"publication_withdrawn"))throw new HttpsError("failed-precondition","review_not_withdrawable");if(review.data().publicReviewId)tx.delete(db.doc(`publicGuestReviews/${review.data().publicReviewId}`));tx.update(reviewRef,{state:"publication_withdrawn",consentToPublish:false,publicConsentWithdrawnAt:FieldValue.serverTimestamp(),publicConsentWithdrawnBy:member.id});});return{ok:true};
});

exports.adminGuestReviewAction = onCall({ region:"asia-east1" }, async request => {
  const adminId=await requireAdmin(request),db=getFirestore(),memberId=String(request.data?.memberId||""),action=String(request.data?.action||"");if(!memberId||memberId.includes("/"))throw new HttpsError("invalid-argument","invalid_member");
  if(action==="resend")return queueGuestReviewInvite(db,db.doc(`guestReviewSubjects/${memberId}`),{operatorId:adminId,requestId:String(request.data?.requestId||"")});
  if(action==="hide_subject"||action==="unhide_subject"){const subjectRef=db.doc(`guestReviewSubjects/${memberId}`);await db.runTransaction(async tx=>{const subject=await tx.get(subjectRef);if(!subject.exists)throw new HttpsError("not-found","subject_not_found");if(action==="hide_subject")tx.update(subjectRef,{hiddenAt:FieldValue.serverTimestamp(),hiddenBy:adminId,updatedAt:FieldValue.serverTimestamp()});else tx.update(subjectRef,{hiddenAt:FieldValue.delete(),hiddenBy:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()});});return{ok:true};}
  const reviewRef=db.doc(`guestReviews/${memberId}`);await db.runTransaction(async tx=>{const review=await tx.get(reviewRef);if(!review.exists)throw new HttpsError("not-found","review_not_found");const data=review.data();let target;if(action==="approve")target="approved";else if(action==="reject"||action==="complaint")target="complaint_open";else if(action==="read")target="private_read";else if(action==="revoke")target="approval_revoked";else throw new HttpsError("invalid-argument","invalid_action");if(!guestReviews.canTransition(data.state,target))throw new HttpsError("failed-precondition","invalid_review_transition");
    if(target==="approved"){if(!data.consentToPublish)throw new HttpsError("failed-precondition","publication_not_authorized");const publicId=data.publicReviewId||db.collection("publicGuestReviews").doc().id;tx.create(db.doc(`publicGuestReviews/${publicId}`),{rating:data.rating,message:data.message,publicAlias:data.publicAlias,approvedAt:FieldValue.serverTimestamp(),displayOrderAt:FieldValue.serverTimestamp()});tx.update(reviewRef,{state:target,publicReviewId:publicId,reviewedAt:FieldValue.serverTimestamp(),reviewedBy:adminId});}
    else {if(target==="complaint_open"&&action==="reject"){let reason;try{reason=guestReviews.cleanText(request.data?.reason,{min:2,max:1000});}catch(e){throw reviewError(e);}tx.update(reviewRef,{state:target,rejectionReason:reason,reviewedAt:FieldValue.serverTimestamp(),reviewedBy:adminId});}else{if(target==="approval_revoked"&&data.publicReviewId)tx.delete(db.doc(`publicGuestReviews/${data.publicReviewId}`));tx.update(reviewRef,{state:target,reviewedAt:FieldValue.serverTimestamp(),reviewedBy:adminId});}}
  });return{ok:true};
});

exports.sendGuestReviewComplaintReply = onCall({ region:"asia-east1" }, async request => {
  const adminId=await requireAdmin(request),db=getFirestore(),memberId=String(request.data?.memberId||""),requestId=String(request.data?.requestId||"");let replyText;try{replyText=guestReviews.cleanText(request.data?.replyText,{min:2,max:5000});}catch(e){throw reviewError(e);}if(!memberId||memberId.includes("/")||!requestId||requestId.length>200)throw new HttpsError("invalid-argument","invalid_complaint_reply");
  const reviewRef=db.doc(`guestReviews/${memberId}`),memberRef=db.doc(`members/${memberId}`),mailId=guestReviews.complaintMailId(memberId,requestId),mailRef=db.doc(`mail/${mailId}`);await db.runTransaction(async tx=>{const[review,member,mail,configSnap]=await tx.getAll(reviewRef,memberRef,mailRef,db.doc("guestReviewConfig/main"));if(mail.exists)return;if(!review.exists||!["complaint_open","complaint_send_failed"].includes(review.data().state)||!member.exists)throw new HttpsError("failed-precondition","complaint_not_sendable");const email=guestReviews.normalizeEmail(member.data().email);if(!email)throw new HttpsError("failed-precondition","guest_email_invalid");const config=guestReviews.defaultConfig(configSnap.data()),queuedAt=Timestamp.now(),attempt={requestId,replyText,mailId,queuedAt,deliveredAt:null,deliveryError:null,operatorId:adminId};tx.create(mailRef,{to:email,message:{subject:config.complaintSubject,text:replyText},guestReviewComplaint:{memberId,requestId},createdAt:FieldValue.serverTimestamp()});tx.update(reviewRef,{state:"complaint_sending",complaint:{attempts:[...(review.data().complaint?.attempts||[]),attempt],activeMailId:mailId,closedAt:null}});});return{ok:true,maskedEmail:"由系統寄送至訪客帳號 Email"};
});

exports.handleGuestReviewMailDelivery = onDocumentWritten({ region:"asia-east1", document:"mail/{mailId}" }, async event => {
  const mail=event.data?.after.data();if(!mail)return;const db=getFirestore();if(mail.guestReviewInvite){const info=mail.guestReviewInvite,subjectRef=db.doc(`guestReviewSubjects/${info.memberId}`);await db.runTransaction(async tx=>{const subject=await tx.get(subjectRef);if(!subject.exists||subject.data().inviteMailId!==event.params.mailId)return;if(mail.delivery?.state==="SUCCESS")tx.update(subjectRef,{inviteDeliveredAt:FieldValue.serverTimestamp(),lastInviteError:null});else if(mail.delivery?.error)tx.update(subjectRef,{state:"invite_failed",lastInviteError:String(mail.delivery.error).slice(0,1000),updatedAt:FieldValue.serverTimestamp()});});}
  if(mail.guestReviewComplaint){const reviewRef=db.doc(`guestReviews/${mail.guestReviewComplaint.memberId}`);await db.runTransaction(async tx=>{const review=await tx.get(reviewRef);if(!review.exists||review.data().complaint?.activeMailId!==event.params.mailId)return;const complaint=review.data().complaint,attempts=[...(complaint.attempts||[])],index=attempts.findIndex(a=>a.mailId===event.params.mailId);if(index<0)return;if(mail.delivery?.state==="SUCCESS"){attempts[index]={...attempts[index],deliveredAt:Timestamp.now(),deliveryError:null};tx.update(reviewRef,{state:"complaint_closed",complaint:{...complaint,attempts,closedAt:Timestamp.now()}});}else if(mail.delivery?.error){attempts[index]={...attempts[index],deliveryError:String(mail.delivery.error).slice(0,1000)};tx.update(reviewRef,{state:"complaint_send_failed",complaint:{...complaint,attempts}});}});}
});

exports.saveGuestReviewConfig = onCall({ region:"asia-east1" }, async request => {const adminId=await requireAdmin(request);let config;try{config=guestReviews.defaultConfig(request.data);}catch(e){throw reviewError(e);}await getFirestore().doc("guestReviewConfig/main").set({...config,updatedAt:FieldValue.serverTimestamp(),updatedBy:adminId},{merge:true});return{ok:true,config};});

exports.ensureWorldBossLifecycle = onCall({ region:"asia-east1" }, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "login_required");
  await worldBossLifecycle.ensureCycle(getFirestore());
  return worldBossLifecycle.trySpawn(getFirestore());
});

exports.forceSpawnWorldBossFromCycle = onCall({ region:"asia-east1" }, async request => {
  if (!request.auth?.uid || !(await getFirestore().doc(`admins/${request.auth.uid}`).get()).exists) {
    throw new HttpsError("permission-denied", "admin_required");
  }
  return worldBossLifecycle.trySpawn(getFirestore(), "admin");
});

exports.createWorldBossEventV2 = onCall({ region:"asia-east1" }, async request => {
  const adminId=await requireAdmin(request),bossKey=String(request.data?.bossKey||""),bossData=WORLD_BOSS_CATALOG[bossKey];
  if(!bossKey||bossKey.includes("/")||!bossData)throw new HttpsError("invalid-argument","invalid_world_boss");
  const family=String(bossData.family||"");
  const category=rewardCategoryForBoss({bossKey,bossData});
  const durationDays=Math.max(1,Math.min(30,Math.floor(Number(request.data?.durationDays)||7)));
  const hp=Math.max(1,Math.floor(Number(bossData.hp)||0));
  if(!hp)throw new HttpsError("invalid-argument","invalid_world_boss_hp");
  const rewardSnapshot=buildWorldBossRewardSnapshot({category,bossFamily:family});
  const db=getFirestore(),eventRef=db.collection("worldBossEvents").doc(),endAt=Timestamp.fromMillis(Date.now()+durationDays*86400000);
  await db.runTransaction(async tx=>{
    tx.create(eventRef,{bossKey,bossData,bossMaxHP:hp,bossCurrentHP:hp,status:"active",startAt:FieldValue.serverTimestamp(),endAt,durationDays,rewardSnapshot,lastHitBy:null,announcement:null,totalParticipants:0,participants:{},createdBy:adminId,createdAt:FieldValue.serverTimestamp(),autoSpawned:false});
    tx.set(db.doc("worldBossStatus/current"),{eventId:eventRef.id,status:"active",bossKey,bossName:String(bossData.name||""),announcement:null,killReplay:null,updatedAt:FieldValue.serverTimestamp()},{merge:true});
  });
  return {ok:true,eventId:eventRef.id,rewardSnapshot};
});

function ownsMember(member,auth){return member?.uid===auth?.uid||(auth?.token?.email&&member?.email===auth.token.email);}
function safeWorldBossId(value){const text=String(value||"");if(!text||text.includes("/")||text.length>300)throw new HttpsError("invalid-argument","invalid_world_boss_claim_identity");return text;}

exports.claimWorldBossParticipationV2=onCall({region:"asia-east1"},async request=>{
  if(!request.auth?.uid)throw new HttpsError("unauthenticated","login_required");
  const eventId=safeWorldBossId(request.data?.eventId),memberId=safeWorldBossId(request.data?.memberId),attemptId=safeWorldBossId(request.data?.attemptId);
  const db=getFirestore(),eventRef=db.doc(`worldBossEvents/${eventId}`),memberRef=db.doc(`members/${memberId}`),chestRef=db.doc(`chestInventory/${memberId}`),claimRef=db.doc(`worldBossRewardClaims/${encodeURIComponent(`${eventId}:${memberId}:participation:${attemptId}`)}`);
  return db.runTransaction(async tx=>{
    const[eventSnap,memberSnap,chestSnap,claimSnap]=await tx.getAll(eventRef,memberRef,chestRef,claimRef);
    if(claimSnap.exists)return{ok:true,duplicate:true,reward:claimSnap.data().reward};
    if(!eventSnap.exists||!memberSnap.exists||!ownsMember(memberSnap.data(),request.auth))throw new HttpsError("permission-denied","world_boss_claim_owner_mismatch");
    const event=eventSnap.data(),participant=event.participants?.[memberId],snapshot=event.rewardSnapshot;
    if(snapshot?.version!==2||!participant||participant.participationClaimId!==attemptId||participant.isGuest===true&&participant.accountType!=="official")throw new HttpsError("failed-precondition","world_boss_participation_not_eligible");
    const reward={...snapshot.participation},member=memberSnap.data(),catId=member.equippedCat?.catId||null,memberPatch={worldBossParticipations:FieldValue.increment(1),coins:FieldValue.increment(reward.coins||0),"village.resources.arrowdew":FieldValue.increment(reward.arrowDew||0),archerXP:FieldValue.increment(reward.archerXP||0),updatedAt:FieldValue.serverTimestamp()};
    if(catId){memberPatch["equippedCat.catXP"]=FieldValue.increment(reward.catXP||0);memberPatch["equippedCat.bond"]=FieldValue.increment(reward.bond||0);tx.set(db.doc(`members/${memberId}/cats/${catId}`),{catXP:FieldValue.increment(reward.catXP||0),bond:FieldValue.increment(reward.bond||0)},{merge:true});}else memberPatch.coins=FieldValue.increment((reward.coins||0)+(reward.catXP||0)+(reward.bond||0));
    const range=snapshot.kill.materialTierRange,family=snapshot.kill.materialFamily,chests=Array.from({length:reward.materialChests||0},(_,i)=>materialChest({id:`wb_part_${eventId}_${memberId}_${attemptId}_${i}`,range,family,seed:`${eventId}:${memberId}:${attemptId}:part:${i}`,from:"世界王參戰獎勵"}));
    tx.set(memberRef,memberPatch,{merge:true});if(chests.length)tx.set(chestRef,{chests:[...(chestSnap.data()?.chests||[]),...chests],updatedAt:FieldValue.serverTimestamp()},{merge:true});
    tx.create(claimRef,{eventId,memberId,attemptId,type:"participation",reward,createdAt:FieldValue.serverTimestamp()});tx.update(eventRef,{[`participants.${memberId}.participationRewardClaimedAt`]:FieldValue.serverTimestamp()});return{ok:true,duplicate:false,reward};
  });
});

exports.claimWorldBossKillRewardV2=onCall({region:"asia-east1"},async request=>{
  if(!request.auth?.uid)throw new HttpsError("unauthenticated","login_required");
  const eventId=safeWorldBossId(request.data?.eventId),memberId=safeWorldBossId(request.data?.memberId),db=getFirestore(),eventRef=db.doc(`worldBossEvents/${eventId}`),memberRef=db.doc(`members/${memberId}`),chestRef=db.doc(`chestInventory/${memberId}`),cardRef=db.doc(`cardCollections/${memberId}`),claimRef=db.doc(`worldBossRewardClaims/${encodeURIComponent(`${eventId}:${memberId}:kill`)}`);
  return db.runTransaction(async tx=>{
    const[eventSnap,memberSnap,chestSnap,cardSnap,claimSnap]=await tx.getAll(eventRef,memberRef,chestRef,cardRef,claimRef);if(claimSnap.exists){const saved=claimSnap.data().reward;return{ok:true,duplicate:true,reward:saved,trophy:saved.isLastHit?'lastHit':saved.rank?'top3':null};}
    if(!eventSnap.exists||!memberSnap.exists||!ownsMember(memberSnap.data(),request.auth))throw new HttpsError("permission-denied","world_boss_claim_owner_mismatch");const event=eventSnap.data(),snapshot=event.rewardSnapshot,participant=event.participants?.[memberId];
    if(event.status!=="defeated"||snapshot?.version!==2||!participant||Number(participant.totalDmg)<=0||participant.isGuest===true&&participant.accountType!=="official")throw new HttpsError("failed-precondition","world_boss_kill_not_eligible");
    const eligible=Object.fromEntries(Object.entries(event.participants||{}).filter(([,p])=>Number(p.totalDmg)>0&&!(p.isGuest===true&&p.accountType!=="official"))),top3=Object.entries(eligible).sort(([,a],[,b])=>Number(b.totalDmg)-Number(a.totalDmg)).slice(0,3).map(([id])=>id),rank=top3.indexOf(memberId)+1,isLastHit=event.lastHitBy?.memberId===memberId,effort=largestRemainderAllocation(snapshot.effortPool,eligible)[memberId]||{},rankHonor=rank?snapshot.honor[`rank${rank}`]:{},lastHonor=isLastHit?snapshot.honor.lastHit:{},total=mergeNumeric(snapshot.kill,effort,rankHonor,lastHonor),member=memberSnap.data(),catId=member.equippedCat?.catId||null;
    const memberPatch={worldBossKills:FieldValue.increment(1),coins:FieldValue.increment(total.coins||0),"village.resources.arrowdew":FieldValue.increment(total.arrowDew||0),archerXP:FieldValue.increment(total.archerXP||0),gachaCoins:FieldValue.increment(total.gachaCoins||0),"dungeonExcavation.scrolls":FieldValue.increment(total.scrolls||0),updatedAt:FieldValue.serverTimestamp()};if(rank)memberPatch[`dungeonCollectibles.${event.bossKey}_top3_trophy`]=FieldValue.increment(1);if(isLastHit)memberPatch[`dungeonCollectibles.${event.bossKey}_lasthit_trophy`]=FieldValue.increment(1);if(catId){memberPatch["equippedCat.catXP"]=FieldValue.increment(total.catXP||0);memberPatch["equippedCat.bond"]=FieldValue.increment(total.bond||0);tx.set(db.doc(`members/${memberId}/cats/${catId}`),{catXP:FieldValue.increment(total.catXP||0),bond:FieldValue.increment(total.bond||0)},{merge:true});}else memberPatch.coins=FieldValue.increment((total.coins||0)+(total.catXP||0)+(total.bond||0));
    const chests=[],addHonor=(honor,label)=>{for(let i=0;i<(honor.materialChests||0);i++)chests.push(materialChest({id:`wb_${label}_mat_${eventId}_${memberId}_${i}`,range:honor.materialTierRange,family:honor.materialFamily,seed:`${eventId}:${memberId}:${label}:mat:${i}`,from:"世界王榮譽獎勵"}));for(let i=0;i<(honor.coinChests||0);i++)chests.push(coinChest({id:`wb_${label}_coin_${eventId}_${memberId}_${i}`,range:honor.coinTierRange,seed:`${eventId}:${memberId}:${label}:coin:${i}`,from:"世界王榮譽獎勵"}));for(let i=0;i<(honor.catBoxes||0);i++)chests.push({id:`wb_${label}_cat_${eventId}_${memberId}_${i}`,type:"cat_box",family:"worldboss",tier:"boss",from:"世界王榮譽獎勵",ts:Date.now()});for(let i=0;i<(honor.mimiBoxes||0);i++)chests.push({id:`wb_${label}_mimi_${eventId}_${memberId}_${i}`,type:"mimi_box",family:"worldboss",tier:"boss",from:"世界王榮譽獎勵",ts:Date.now()});};
    for(let i=0;i<(snapshot.kill.materialChests||0);i++)chests.push(materialChest({id:`wb_kill_mat_${eventId}_${memberId}_${i}`,range:snapshot.kill.materialTierRange,family:snapshot.kill.materialFamily,seed:`${eventId}:${memberId}:kill:mat:${i}`,from:"世界王共同擊殺獎勵"}));for(let i=0;i<(snapshot.kill.coinChests||0);i++)chests.push(coinChest({id:`wb_kill_coin_${eventId}_${memberId}_${i}`,range:snapshot.kill.materialTierRange,seed:`${eventId}:${memberId}:kill:coin:${i}`,from:"世界王共同擊殺獎勵"}));for(let i=0;i<(snapshot.kill.mimiBoxes||0);i++)chests.push({id:`wb_kill_mimi_${eventId}_${memberId}_${i}`,type:"mimi_box",family:"worldboss",tier:"boss",from:"世界王共同擊殺獎勵",ts:Date.now()});for(let i=0;i<(snapshot.kill.cardPacks||0);i++)chests.push({id:`wb_kill_pack_${eventId}_${memberId}_${i}`,type:"card_pack",family:"special",tier:"special",from:"世界王共同擊殺獎勵",ts:Date.now()});addHonor(rankHonor,`rank${rank}`);addHonor(lastHonor,"lastHit");
    let wbCard=null,duplicateCoins=0;if(stableUnit(`${eventId}:${memberId}:wbcard`)<snapshot.kill.wbCardChance){const data=cardSnap.data()||{},wbCards={...(data.wbCards||{})};if(wbCards[event.bossKey]){duplicateCoins=100;memberPatch.coins=FieldValue.increment((total.coins||0)+(catId?0:(total.catXP||0)+(total.bond||0))+100);}else{wbCard=event.bossKey;wbCards[event.bossKey]={bossKey:event.bossKey,tier:"worldboss",stars:1,ts:Date.now()};tx.set(cardRef,{cards:data.cards||{},wbCards,equipped:data.equipped||[],updatedAt:FieldValue.serverTimestamp()},{merge:true});}}
    tx.set(memberRef,memberPatch,{merge:true});if(chests.length)tx.set(chestRef,{chests:[...(chestSnap.data()?.chests||[]),...chests],updatedAt:FieldValue.serverTimestamp()},{merge:true});const reward={...total,effort,rank:rank||null,isLastHit,wbCard,wbCardDuplicateCoins:duplicateCoins};tx.create(claimRef,{eventId,memberId,type:"kill",reward,createdAt:FieldValue.serverTimestamp()});tx.update(eventRef,{[`participants.${memberId}.claimed`]:true});return{ok:true,duplicate:false,reward,trophy:isLastHit?'lastHit':rank?'top3':null};
  });
});

exports.worldBossLifecycleSchedule = onSchedule({
  region:"asia-east1",
  schedule:"every 15 minutes",
  timeZone:"Asia/Taipei",
  retryCount:1,
}, async () => {
  await worldBossLifecycle.ensureCycle(getFirestore());
  await worldBossLifecycle.trySpawn(getFirestore()).catch(error => logger.error("worldBoss lifecycle", error));
});

exports.initializeGuestEquipment = onCall({ region:"asia-east1" }, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "login_required");
  const memberId=String(request.data?.memberId||""); if(!memberId||memberId.includes("/")) throw new HttpsError("invalid-argument","invalid_member");
  const db=getFirestore(), ref=db.doc(`members/${memberId}`);
  return db.runTransaction(async tx=>{ const snap=await tx.get(ref); if(!snap.exists) throw new HttpsError("not-found","member_not_found"); const member=snap.data();
    if(member.uid!==request.auth.uid) throw new HttpsError("permission-denied","owner_mismatch");
    try{assertActiveGuest(member,Date.now());}catch(e){throw new HttpsError("failed-precondition",e.message);}
    const patch=starterPatch(member); if(patch) tx.update(ref,{...patch,updatedAt:FieldValue.serverTimestamp()});
    return {ok:true,seeded:!!patch,catalog:GUEST_COMMON_EQUIPMENT}; });
});
exports.purchaseGuestEquipment = onCall({ region:"asia-east1" }, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "login_required");
  const memberId=String(request.data?.memberId||""),itemId=String(request.data?.itemId||""); if(!memberId||memberId.includes("/")) throw new HttpsError("invalid-argument","invalid_member");
  const db=getFirestore(),ref=db.doc(`members/${memberId}`);
  return db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new HttpsError("not-found","member_not_found");const member=snap.data();
    if(member.uid!==request.auth.uid)throw new HttpsError("permission-denied","owner_mismatch");try{assertActiveGuest(member,Date.now());const result=purchasePatch(member,itemId);tx.update(ref,{...result.patch,updatedAt:FieldValue.serverTimestamp()});return{ok:true,item:result.item};}catch(e){throw new HttpsError("failed-precondition",e.message);}});
});

exports.consumeFreeHuntAttempt = onCall({ region:"asia-east1" }, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "login_required");
  const memberId = safeFreeHuntId(request.data?.memberId, "invalid_member");
  const battleId = safeFreeHuntId(request.data?.battleId, "invalid_free_hunt_battle");
  let mode;
  try { mode = assertFreeHuntMode(request.data?.mode); }
  catch (error) { throw new HttpsError("invalid-argument", error.message); }
  const rawRoomId = String(request.data?.roomId || "").trim();
  const roomId = rawRoomId ? safeFreeHuntId(rawRoomId, "invalid_free_hunt_room") : null;
  const claimId = [memberId, mode, battleId].map(encodeURIComponent).join("~");
  const db = getFirestore();
  const memberRef = db.doc(`members/${memberId}`);
  const claimRef = db.doc(`freeHuntAttemptClaims/${claimId}`);
  const roomRef = roomId ? db.doc(`partyRooms/${roomId}`) : null;
  return db.runTransaction(async tx => {
    const [memberSnap, claimSnap, roomSnap] = await tx.getAll(memberRef, claimRef, ...(roomRef ? [roomRef] : []));
    if (!memberSnap.exists) throw new HttpsError("not-found", "member_not_found");
    const member = memberSnap.data();
    const ownsMember = member.uid === request.auth.uid || (request.auth.token.email && member.email === request.auth.token.email);
    if (!ownsMember) throw new HttpsError("permission-denied", "free_hunt_owner_mismatch");
    if (claimSnap.exists) {
      const saved = claimSnap.data();
      return { ok:true, duplicate:true, date:saved.date, count:saved.count, remaining:saved.remaining, limit:saved.limit || FREE_HUNT_DAILY_LIMIT };
    }
    if (roomRef) {
      if (!roomSnap?.exists) throw new HttpsError("not-found", "free_hunt_room_not_found");
      const room = roomSnap.data();
      if (room.hostId !== memberId) throw new HttpsError("permission-denied", "free_hunt_host_only");
      if (room.status !== "waiting") throw new HttpsError("failed-precondition", "free_hunt_room_not_waiting");
      const isMulti = room.multiMonster === true || room.huntType === "multi";
      const isSingle = room.type === "battle" && !isMulti && !!(room.huntMonsterId || room.monsterId);
      if ((mode === "multi" && !isMulti) || (mode === "single" && !isSingle)) throw new HttpsError("failed-precondition", "free_hunt_room_mode_mismatch");
    }
    const date = taipeiFreeHuntDateKey();
    let consumed;
    try { consumed = consumeFreeHuntUsage(member.freeHuntUsage, mode, date); }
    catch (error) {
      if (error.message === "free_hunt_limit_reached") throw new HttpsError("resource-exhausted", "free_hunt_limit_reached");
      throw new HttpsError("invalid-argument", error.message);
    }
    tx.update(memberRef, { freeHuntUsage:consumed.usage, updatedAt:FieldValue.serverTimestamp() });
    tx.create(claimRef, { memberId, mode, battleId, roomId:roomId || null, date, count:consumed.count, remaining:consumed.remaining, limit:consumed.limit, createdAt:FieldValue.serverTimestamp() });
    return { ok:true, duplicate:false, date, count:consumed.count, remaining:consumed.remaining, limit:consumed.limit };
  });
});

function multiPartyCallableError(error) {
  if(error instanceof HttpsError)return error;
  const message=String(error?.message||error||"multi_party_failed");
  if(message==="room_not_found")return new HttpsError("not-found",message);
  if(message==="host_only")return new HttpsError("permission-denied",message);
  const precondition=new Set(["invalid_arrows","invalid_target","stale_round","loadout_v2_required","unsupported_loadout_effect","invalid_loadout_stats","battle_not_active","round_locked","member_down","not_all_ready","room_not_waiting","not_multi_room","not_dungeon_multi_room","empty_party","member_stats_pending","battle_not_finished","rewards_pending"]);
  if(precondition.has(message))return new HttpsError("failed-precondition",message);
  const code=String(error?.code||"").toLowerCase();
  if(code==="10"||code.includes("aborted"))return new HttpsError("aborted",message);
  return new HttpsError("internal",message);
}

function multiBattleRoomRef(db, request) {
  const roomId=safeFreeHuntId(request.data?.roomId,"invalid_room_id");
  const dungeon=request.data?.dungeonMode===true;
  return {roomId,dungeon,ref:db.doc(`${dungeon?"dungeonRooms":"partyRooms"}/${roomId}`)};
}

exports.startMultiMonsterPartyBattleV2 = onCall({region:"asia-east1"},async request=>{
  const db=getFirestore(),{roomId,dungeon,ref}=multiBattleRoomRef(db,request),memberId=safeFreeHuntId(request.data?.memberId,"invalid_member_id");
  await requireOwnedMember(db,request,memberId);
  try{const initial=await ref.get();if(!initial.exists)throw new Error("room_not_found");const initialRoom=initial.data();if(initialRoom.hostId!==memberId)throw new Error("host_only");if(dungeon&&!(initialRoom.expeditionMode===true&&initialRoom.dungeonMulti===true))throw new Error("not_dungeon_multi_room");const loadouts=await authoritativeMultiMonsterLoadouts(db,initialRoom);return await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new Error("room_not_found");const room=snap.data();if(room.hostId!==memberId)throw new Error("host_only");const members=Object.fromEntries(Object.entries(room.members||{}).map(([id,m])=>[id,{...m,loadoutSnapshot:loadouts[id],catId:loadouts[id]?.cat?.catId||"",catName:m.catName||"",catLevel:loadouts[id]?.cat?.catLevel||0,bondLv:loadouts[id]?.cat?.bondLv||0,catHP:loadouts[id]?.cat?.catHP||0,catATK:loadouts[id]?.cat?.catATK||0,catDEF:loadouts[id]?.cat?.catDEF||0,catBattleState:loadouts[id]?.cat?.battleState||null}]));const patch=multiMonsterPartyV2.startPatch({...room,members},roomId);if(patch)tx.update(ref,{...patch,battleStartedAt:FieldValue.serverTimestamp()});return{ok:true,alreadyStarted:!patch,combatVersion:2};});}catch(error){throw multiPartyCallableError(error);}
});

exports.submitMultiMonsterPartyRoundV2 = onCall({region:"asia-east1"},async request=>{
  const db=getFirestore(),roomId=safeFreeHuntId(request.data?.roomId,"invalid_room_id"),memberId=safeFreeHuntId(request.data?.memberId,"invalid_member_id");
  await requireOwnedMember(db,request,memberId);
  try{return await db.runTransaction(async tx=>{const ref=multiBattleRoomRef(db,request).ref,snap=await tx.get(ref);if(!snap.exists)throw new Error("room_not_found");const room=snap.data();const replay=multiMonsterPartyV2.submissionReplayStatus(room,memberId,request.data||{});if(replay)return{ok:true,...replay,resolved:replay.alreadyResolved===true};const submission=multiMonsterPartyV2.submissionPatch(room,roomId,memberId,request.data||{});room.members={...(room.members||{}),[memberId]:{...room.members[memberId],submission,ready:true}};const living=Object.values(room.members).filter(m=>m.alive!==false&&Number(m.hp)>0),ready=living.length>0&&living.every(m=>m.ready&&Number(m.submission?.round)===Number(room.round));if(ready){const resolved=multiMonsterPartyV2.resolveRound({...room,roundPhase:"resolving"},roomId);tx.update(ref,resolved);return{ok:true,revision:submission.revision,resolved:true,resolutionId:resolved.lastResolution.resolutionId};}tx.update(ref,{[`members.${memberId}.submission`]:submission,[`members.${memberId}.ready`]:true});return{ok:true,revision:submission.revision,resolved:false};},{maxAttempts:10});}catch(error){throw multiPartyCallableError(error);}
});

exports.reviseMultiMonsterPartyRoundV2 = onCall({region:"asia-east1"},async request=>{
  const db=getFirestore(),roomId=safeFreeHuntId(request.data?.roomId,"invalid_room_id"),memberId=safeFreeHuntId(request.data?.memberId,"invalid_member_id");await requireOwnedMember(db,request,memberId);
  try{return await db.runTransaction(async tx=>{const ref=multiBattleRoomRef(db,request).ref,snap=await tx.get(ref);if(!snap.exists)throw new Error("room_not_found");const room=snap.data();if(room.status!=="active"||Number(room.round)!==Number(request.data?.round))throw new Error("stale_round");if(room.roundPhase!=="input")throw new Error("round_locked");if(!room.members?.[memberId])throw new Error("not_member");tx.update(ref,{[`members.${memberId}.ready`]:false});return{ok:true,revision:Number(room.members[memberId].submission?.revision)||0};});}catch(error){throw multiPartyCallableError(error);}
});

exports.leaveMultiMonsterPartyRoomV2 = onCall({region:"asia-east1"},async request=>{
  const db=getFirestore(),roomId=safeFreeHuntId(request.data?.roomId,"invalid_room_id"),memberId=safeFreeHuntId(request.data?.memberId,"invalid_member_id");await requireOwnedMember(db,request,memberId);
  try{return await db.runTransaction(async tx=>{const ref=multiBattleRoomRef(db,request).ref,snap=await tx.get(ref);if(!snap.exists)return{ok:true};const room=snap.data(),members={...(room.members||{})};if(!members[memberId])return{ok:true};delete members[memberId];const ids=Object.keys(members).sort();if(!ids.length){tx.update(ref,{members:{},status:"completed",roundPhase:"complete"});return{ok:true,completed:true};}const patch={members};if(room.hostId===memberId)patch.hostId=ids[0];tx.update(ref,patch);return{ok:true,newHostId:patch.hostId||room.hostId};});}catch(error){throw multiPartyCallableError(error);}
});

exports.cleanupMultiMonsterPartyRoomV2 = onCall({region:"asia-east1"},async request=>{
  const db=getFirestore(),roomId=safeFreeHuntId(request.data?.roomId,"invalid_room_id"),memberId=safeFreeHuntId(request.data?.memberId,"invalid_member_id");await requireOwnedMember(db,request,memberId);
  try{return await db.runTransaction(async tx=>{const ref=multiBattleRoomRef(db,request).ref,snap=await tx.get(ref);if(!snap.exists)return{ok:true};const room=snap.data();if(room.hostId!==memberId)throw new Error("host_only");if(!["victory","defeat","completed"].includes(room.status))throw new Error("battle_not_finished");const pending=!request.data?.dungeonMode&&room.status==="victory"&&Object.values(room.members||{}).some(m=>m.rewardClaimed!==true);if(pending&&request.data?.force!==true)throw new Error("rewards_pending");tx.delete(ref);return{ok:true};});}catch(error){throw multiPartyCallableError(error);}
});

exports.claimMonsterBattleReward = onCall({ region:"asia-east1" }, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "請先登入");
  let reward;
  try { reward = buildTrustedMonsterReward(request.data); }
  catch (error) { throw new HttpsError("invalid-argument", error.message); }

  const db = getFirestore();
  const memberRef = db.doc(`members/${reward.memberId}`);
  const claimRef = db.doc(`monsterRewardClaims/${reward.claimId}`);
  const inventoryRef = db.doc(`materialInventory/${reward.memberId}`);
  const chestRef = db.doc(`chestInventory/${reward.memberId}`);
  const cardRef = db.doc(`cardCollections/${reward.memberId}`);
  return db.runTransaction(async transaction => {
    const [memberSnap, claimSnap, inventorySnap, chestSnap, cardSnap] = await transaction.getAll(memberRef, claimRef, inventoryRef, chestRef, cardRef);
    if (!memberSnap.exists) throw new HttpsError("not-found", "member_not_found");
    const member = memberSnap.data();
    const ownsMember = member.uid === request.auth.uid || (request.auth.token.email && member.email === request.auth.token.email);
    if (!ownsMember) throw new HttpsError("permission-denied", "reward_owner_mismatch");
    if (claimSnap.exists) return { ok:true, duplicate:true, claimId:reward.claimId, reward:claimSnap.data().reward };
    const items = { ...(inventorySnap.data()?.items || {}) };
    for (const [materialId, quantity] of Object.entries(reward.materialTotals)) items[materialId] = Math.max(0, Number(items[materialId]) || 0) + quantity;
    transaction.set(inventoryRef, { items, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    transaction.set(chestRef,{chests:[...(chestSnap.data()?.chests||[]),...(reward.chests||[])],updatedAt:FieldValue.serverTimestamp()},{merge:true});
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
    const publicReward = { coins:reward.coins, materialTotals:reward.materialTotals, chests:reward.chests||[], card:reward.card };
    transaction.create(claimRef, {
      battleId:reward.battleId, memberId:reward.memberId, rewardType:reward.rewardType,
      materialTotals:reward.materialTotals, coins:reward.coins, cardId:reward.card?.monsterId || null,
      metadata:{ mode:reward.mode, monsterId:reward.monsterId, catalogVersion:reward.catalogVersion, source:"callable" },
      reward:publicReward, claimedAt:FieldValue.serverTimestamp(),
    });
    return { ok:true, duplicate:false, claimId:reward.claimId, reward:publicReward };
  });
});

exports.claimMultiMonsterBattleReward = onCall({ region:"asia-east1" }, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "login_required");
  let reward;
  try { reward = buildTrustedMultiMonsterReward(request.data || {}); }
  catch (error) { throw new HttpsError("invalid-argument", error.message); }

  const roomId = String(request.data?.roomId || "").trim();
  if (roomId && (roomId.includes("/") || roomId.length > 240)) throw new HttpsError("invalid-argument", "invalid_multi_room_id");
  const db = getFirestore();
  const memberRef = db.doc(`members/${reward.memberId}`);
  const claimRef = db.doc(`monsterRewardClaims/${reward.claimId}`);
  const inventoryRef = db.doc(`materialInventory/${reward.memberId}`);
  const chestRef = db.doc(`chestInventory/${reward.memberId}`);
  const cardRef = db.doc(`cardCollections/${reward.memberId}`);
  const roomRef = roomId ? db.doc(`partyRooms/${roomId}`) : null;

  return db.runTransaction(async transaction => {
    const refs = [memberRef, claimRef, inventoryRef, chestRef, cardRef, ...(roomRef ? [roomRef] : [])];
    const snaps = await transaction.getAll(...refs);
    const [memberSnap, claimSnap, inventorySnap, chestSnap, cardSnap, roomSnap] = snaps;
    if (!memberSnap.exists) throw new HttpsError("not-found", "member_not_found");
    const member = memberSnap.data();
    if (!(member.uid === request.auth.uid || (request.auth.token.email && member.email === request.auth.token.email))) {
      throw new HttpsError("permission-denied", "reward_owner_mismatch");
    }
    if (claimSnap.exists) return { ok:true, duplicate:true, claimId:reward.claimId, reward:claimSnap.data().reward };

    if (roomRef) {
      if (!roomSnap?.exists) throw new HttpsError("not-found", "multi_party_room_not_found");
      const room = roomSnap.data();
      const targets = room.targets || {};
      const order = Array.isArray(room.targetOrder) ? room.targetOrder : Object.keys(targets);
      const fronts = order.map(id => targets[id]).filter(target => target?.position === "front" && target?.isRunePillar !== true);
      const roomMonsterIds = fronts.map(target => target?.id);
      const sameMonsters = roomMonsterIds.length === reward.monsterIds.length && roomMonsterIds.every((id, index) => id === reward.monsterIds[index]);
      const defeated = fronts.length === 3 && fronts.every(target => target?.alive === false || Number(target?.currentHp) <= 0);
      if (room.huntType !== "multi" || room.multiMonster !== true || room.status !== "victory" || !room.members?.[reward.memberId] || room.multiFamily !== reward.family || Number(room.multiTier) !== reward.tierIndex || !sameMonsters || !defeated) {
        throw new HttpsError("failed-precondition", "multi_party_reward_not_verified");
      }
      if (roomId !== reward.battleId) throw new HttpsError("invalid-argument", "multi_party_battle_id_mismatch");
    }

    // Solo local battles have no authoritative room document. This endpoint verifies
    // the exact catalog encounter identity and derives every reward value server-side.
    // Full combat replay needs a shared server battle engine and is not claimed here.
    const items = { ...(inventorySnap.data()?.items || {}) };
    for (const [materialId, quantity] of Object.entries(reward.materialTotals || {})) items[materialId] = Math.max(0, Number(items[materialId]) || 0) + quantity;
    transaction.set(inventoryRef, { items, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    if (reward.chests?.length) transaction.set(chestRef, { chests:[...(chestSnap.data()?.chests || []), ...reward.chests], updatedAt:FieldValue.serverTimestamp() }, { merge:true });

    if (reward.cards?.length) {
      const collection = cardSnap.data() || {};
      const cards = { ...(collection.cards || {}) };
      for (const card of reward.cards) {
        const existing = cards[card.monsterId];
        cards[card.monsterId] = existing ? { ...existing, duplicates:(existing.duplicates || 0) + 1 } : { ...card, stars:1, duplicates:0, chosenStat:null, ts:Date.now() };
      }
      transaction.set(cardRef, { cards, wbCards:collection.wbCards || {}, equipped:collection.equipped || [], updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    }

    const memberPatch = { updatedAt:FieldValue.serverTimestamp() };
    if (reward.coins > 0) memberPatch.coins = FieldValue.increment(reward.coins);
    if (reward.archerXP > 0) memberPatch.archerXP = FieldValue.increment(reward.archerXP);
    transaction.update(memberRef, memberPatch);
    if (roomRef) transaction.update(roomRef, { [`members.${reward.memberId}.rewardClaimed`]:true, [`members.${reward.memberId}.rewardClaimedAt`]:FieldValue.serverTimestamp() });

    const publicReward = { coins:reward.coins, archerXP:reward.archerXP, materialTotals:reward.materialTotals, chests:reward.chests || [], cards:reward.cards || [] };
    transaction.create(claimRef, {
      battleId:reward.battleId,
      memberId:reward.memberId,
      rewardType:"multi_hunt",
      reward:publicReward,
      metadata:{ family:reward.family, tierIndex:reward.tierIndex, monsterIds:reward.monsterIds, catalogVersion:reward.catalogVersion, source:roomRef ? "verified_multi_party_room" : "catalog_verified_local_multi_hunt" },
      claimedAt:FieldValue.serverTimestamp(),
    });
    return { ok:true, duplicate:false, claimId:reward.claimId, reward:publicReward };
  });
});

exports.claimDungeonNormalCard = onCall({region:"asia-east1"},async request=>{
  if(!request.auth?.uid)throw new HttpsError("unauthenticated","login_required");
  let claim;
  try{claim=buildDungeonNormalCardClaim(request.data||{});}catch(error){throw new HttpsError("invalid-argument",error.message);}
  const db=getFirestore(),roomRef=db.doc(`dungeonRooms/${claim.battleId}`),memberRef=db.doc(`members/${claim.memberId}`),claimRef=db.doc(`monsterRewardClaims/${claim.claimId}`),cardRef=db.doc(`cardCollections/${claim.memberId}`);
  return db.runTransaction(async transaction=>{
    const [roomSnap,memberSnap,claimSnap,cardSnap]=await transaction.getAll(roomRef,memberRef,claimRef,cardRef);
    if(!roomSnap.exists||!memberSnap.exists)throw new HttpsError("not-found","dungeon_battle_not_found");
    const room=roomSnap.data(),member=memberSnap.data(),roomMember=room.members?.[claim.memberId];
    if(!(member.uid===request.auth.uid||(request.auth.token.email&&member.email===request.auth.token.email)))throw new HttpsError("permission-denied","reward_owner_mismatch");
    if(!roomMember||!isRewardableDungeonRoom(room,claim.memberId,claim.monsterId))throw new HttpsError("failed-precondition","dungeon_battle_not_rewardable");
    if(claimSnap.exists)return{ok:true,duplicate:true,card:claimSnap.data().reward?.card||null,chance:claim.chance};
    if(claim.card){const collection=cardSnap.data()||{},cards={...(collection.cards||{})},existing=cards[claim.card.monsterId];cards[claim.card.monsterId]=existing?{...existing,duplicates:(existing.duplicates||0)+1}:{...claim.card,stars:1,duplicates:0,chosenStat:null,ts:Date.now()};transaction.set(cardRef,{cards,wbCards:collection.wbCards||{},equipped:collection.equipped||[],updatedAt:FieldValue.serverTimestamp()},{merge:true});}
    transaction.create(claimRef,{battleId:claim.battleId,memberId:claim.memberId,rewardType:"dungeon_normal_card",cardId:claim.card?.monsterId||null,metadata:{monsterId:claim.monsterId,source:"verified_dungeon_room"},reward:{card:claim.card},claimedAt:FieldValue.serverTimestamp()});
    return{ok:true,duplicate:false,card:claim.card,chance:claim.chance};
  });
});

exports.claimDungeonEncounterTargetCard = onCall({region:"asia-east1"},async request=>{
  if(!request.auth?.uid)throw new HttpsError("unauthenticated","login_required");
  let claim;
  try{claim=buildDungeonNormalCardClaim(request.data||{});}catch(error){throw new HttpsError("invalid-argument",error.message);}
  if(!claim.targetInstanceId)throw new HttpsError("invalid-argument","target_instance_required");
  const db=getFirestore(),roomRef=db.doc(`dungeonRooms/${claim.battleId}`),memberRef=db.doc(`members/${claim.memberId}`),claimRef=db.doc(`monsterRewardClaims/${claim.claimId}`),cardRef=db.doc(`cardCollections/${claim.memberId}`);
  return db.runTransaction(async transaction=>{const [roomSnap,memberSnap,claimSnap,cardSnap]=await transaction.getAll(roomRef,memberRef,claimRef,cardRef);if(!roomSnap.exists||!memberSnap.exists)throw new HttpsError("not-found","dungeon_battle_not_found");const room=roomSnap.data(),member=memberSnap.data(),target=room.targets?.[claim.targetInstanceId];if(!(member.uid===request.auth.uid||(request.auth.token.email&&member.email===request.auth.token.email)))throw new HttpsError("permission-denied","reward_owner_mismatch");if(!(room.expeditionMode===true&&room.dungeonMulti===true&&room.status==="victory"&&room.members?.[claim.memberId]&&target?.id===claim.monsterId&&(target.alive===false||Number(target.currentHp)<=0)))throw new HttpsError("failed-precondition","dungeon_target_not_rewardable");if(claimSnap.exists)return{ok:true,duplicate:true,card:claimSnap.data().reward?.card||null,chance:claim.chance};if(claim.card){const collection=cardSnap.data()||{},cards={...(collection.cards||{})},existing=cards[claim.card.monsterId];cards[claim.card.monsterId]=existing?{...existing,duplicates:(existing.duplicates||0)+1}:{...claim.card,stars:1,duplicates:0,chosenStat:null,ts:Date.now()};transaction.set(cardRef,{cards,wbCards:collection.wbCards||{},equipped:collection.equipped||[],updatedAt:FieldValue.serverTimestamp()},{merge:true});}transaction.create(claimRef,{battleId:claim.battleId,memberId:claim.memberId,rewardType:"dungeon_target_card",cardId:claim.card?.monsterId||null,metadata:{monsterId:claim.monsterId,targetInstanceId:claim.targetInstanceId,source:"verified_dungeon_multi_room"},reward:{card:claim.card},claimedAt:FieldValue.serverTimestamp()});return{ok:true,duplicate:false,card:claim.card,chance:claim.chance};});
});

exports.claimDungeonMultiSoloReward = onCall({region:"asia-east1"},async request=>{
  if(!request.auth?.uid)throw new HttpsError("unauthenticated","login_required");
  const battleId=safeFreeHuntId(request.data?.battleId,"invalid_battle_id"),memberId=safeFreeHuntId(request.data?.memberId,"invalid_member_id");
  const db=getFirestore(),roomRef=db.doc(`dungeonRooms/${battleId}`),memberRef=db.doc(`members/${memberId}`),chestRef=db.doc(`chestInventory/${memberId}`),cardRef=db.doc(`cardCollections/${memberId}`);
  return db.runTransaction(async tx=>{
    const [roomSnap,memberSnap,chestSnap,cardSnap]=await tx.getAll(roomRef,memberRef,chestRef,cardRef);
    if(!roomSnap.exists||!memberSnap.exists)throw new HttpsError("not-found","dungeon_multi_battle_not_found");
    const member=memberSnap.data();if(!(member.uid===request.auth.uid||(request.auth.token.email&&member.email===request.auth.token.email)))throw new HttpsError("permission-denied","reward_owner_mismatch");
    const room=roomSnap.data();
    if(!hasDungeonMultiRunProof({room,battleId,memberId,activeExpedition:member.activeExpedition}))throw new HttpsError("failed-precondition","dungeon_multi_run_mismatch");
    let reward;try{reward=buildDungeonMultiReward({room,battleId,memberId});}catch(error){throw new HttpsError("failed-precondition",error.message);}
    const claimRef=db.doc(`monsterRewardClaims/${reward.claimId}`),claimSnap=await tx.get(claimRef);
    if(claimSnap.exists)return{ok:true,duplicate:true,reward:claimSnap.data().reward};
    tx.set(chestRef,{chests:[...(chestSnap.data()?.chests||[]),...reward.chests],updatedAt:FieldValue.serverTimestamp()},{merge:true});
    if(reward.cards.length){const collection=cardSnap.data()||{},cards={...(collection.cards||{})};for(const card of reward.cards){const existing=cards[card.monsterId];cards[card.monsterId]=existing?{...existing,duplicates:(existing.duplicates||0)+1}:{...card,stars:1,duplicates:0,chosenStat:null,ts:Date.now()};}tx.set(cardRef,{cards,wbCards:collection.wbCards||{},equipped:collection.equipped||[],updatedAt:FieldValue.serverTimestamp()},{merge:true});}
    const memberPatch={coins:FieldValue.increment(reward.coins),archerXP:FieldValue.increment(reward.archerXP),updatedAt:FieldValue.serverTimestamp()};for(const drop of reward.collectibles)memberPatch[`dungeonCollectibles.${drop.itemId}`]=FieldValue.increment(drop.qty);
    tx.update(memberRef,memberPatch);tx.create(claimRef,{battleId,memberId,rewardType:"dungeon_multi_solo",reward,claimedAt:FieldValue.serverTimestamp()});tx.update(roomRef,{[`members.${memberId}.rewardClaimed`]:true});
    return{ok:true,duplicate:false,reward};
  });
});

exports.claimPartyBattleRewardV2=onCall({region:"asia-east1"},async request=>{
  if(!request.auth?.uid)throw new HttpsError("unauthenticated","login_required");
  const roomId=String(request.data?.roomId||""),battleInstanceId=String(request.data?.battleInstanceId||""),memberId=String(request.data?.memberId||"");
  if(!roomId||!battleInstanceId||!memberId||roomId.includes("/")||battleInstanceId.includes("/")||memberId.includes("/"))throw new HttpsError("invalid-argument","invalid_party_reward_identity");
  const db=getFirestore(),roomRef=db.doc(`partyRooms/${roomId}`),memberRef=db.doc(`members/${memberId}`),inventoryRef=db.doc(`materialInventory/${memberId}`),chestRef=db.doc(`chestInventory/${memberId}`),cardRef=db.doc(`cardCollections/${memberId}`),claimRef=db.doc(`monsterRewardClaims/${[roomId,battleInstanceId,memberId,"party_v2"].map(encodeURIComponent).join("~")}`);
  return db.runTransaction(async transaction=>{const [roomSnap,memberSnap,inventorySnap,chestSnap,cardSnap,claimSnap]=await transaction.getAll(roomRef,memberRef,inventoryRef,chestRef,cardRef,claimRef);if(!roomSnap.exists||!memberSnap.exists)throw new HttpsError("not-found","party_battle_not_found");const member=memberSnap.data();if(!(member.uid===request.auth.uid||(request.auth.token.email&&member.email===request.auth.token.email)))throw new HttpsError("permission-denied","reward_owner_mismatch");if(claimSnap.exists)return{ok:true,duplicate:true,reward:claimSnap.data().reward};let reward;try{reward=buildPartyReward({roomId,battleInstanceId,memberId,room:roomSnap.data()});}catch(error){throw new HttpsError("failed-precondition",error.message);}const items={...(inventorySnap.data()?.items||{})};for(const[id,qty]of Object.entries(reward.materialTotals))items[id]=(Number(items[id])||0)+qty;transaction.set(inventoryRef,{items,updatedAt:FieldValue.serverTimestamp()},{merge:true});transaction.set(chestRef,{chests:[...(chestSnap.data()?.chests||[]),...reward.chests],updatedAt:FieldValue.serverTimestamp()},{merge:true});if(reward.card){const collection=cardSnap.data()||{},cards={...(collection.cards||{})},existing=cards[reward.card.monsterId];cards[reward.card.monsterId]=existing?{...existing,duplicates:(existing.duplicates||0)+1}:{...reward.card,stars:1,duplicates:0,chosenStat:null,ts:Date.now()};transaction.set(cardRef,{cards,wbCards:collection.wbCards||{},equipped:collection.equipped||[],updatedAt:FieldValue.serverTimestamp()},{merge:true});}transaction.update(memberRef,{coins:FieldValue.increment(reward.coins),arrowDew:FieldValue.increment(reward.arrowDew),archerXP:FieldValue.increment(reward.archerXP),updatedAt:FieldValue.serverTimestamp()});const publicReward={coins:reward.coins,arrowDew:reward.arrowDew,archerXP:reward.archerXP,materialTotals:reward.materialTotals,chests:reward.chests,card:reward.card};transaction.create(claimRef,{roomId,battleInstanceId,memberId,rewardType:"party_v2",reward:publicReward,claimedAt:FieldValue.serverTimestamp()});transaction.update(roomRef,{rewardClaimed:FieldValue.arrayUnion(memberId)});return{ok:true,duplicate:false,reward:publicReward};});
});

exports.createDungeonBossRewardClaim = onCall({ region:"asia-east1" }, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "請先登入");
  const battleId=String(request.data?.battleId||""), memberId=String(request.data?.memberId||""), monsterId=String(request.data?.monsterId||""), teamRoomId=String(request.data?.teamRoomId||"");
  if (!battleId || !memberId || !monsterId || [battleId,memberId,monsterId,teamRoomId].some(value=>value.includes("/")||value.length>240)) throw new HttpsError("invalid-argument","invalid_dungeon_reward_identity");
  const claimId=[battleId,memberId,"dungeonBoss"].map(encodeURIComponent).join("~");
  const db=getFirestore(), roomRef=db.doc(`dungeonRooms/${battleId}`),teamRoomRef=teamRoomId?db.doc(`dungeonRooms/${teamRoomId}`):null,memberRef=db.doc(`members/${memberId}`), claimRef=db.doc(`monsterRewardClaims/${claimId}`), choiceRef=db.doc(`dungeonBossChoiceClaims/${claimId}`), inventoryRef=db.doc(`materialInventory/${memberId}`), cardRef=db.doc(`cardCollections/${memberId}`);
  return db.runTransaction(async transaction=>{
    const teamRoomSnap=teamRoomRef?await transaction.get(teamRoomRef):null;
    const [roomSnap,memberSnap,claimSnap,choiceSnap,inventorySnap,cardSnap]=await transaction.getAll(roomRef,memberRef,claimRef,choiceRef,inventoryRef,cardRef);
    if(!memberSnap.exists) throw new HttpsError("not-found","member_not_found");
    const member=memberSnap.data();
    if(!(member.uid===request.auth.uid||(request.auth.token.email&&member.email===request.auth.token.email))) throw new HttpsError("permission-denied","reward_owner_mismatch");
    const room=roomSnap.data();
    const rewardable=teamRoomId
      ? Boolean(teamRoomSnap?.exists&&isRewardableTeamDungeonBossRoom(teamRoomSnap.data(),battleId,memberId,monsterId))
      : Boolean(roomSnap.exists&&isRewardableDungeonRoom(room,memberId,monsterId));
    if(!rewardable)throw new HttpsError("failed-precondition","dungeon_battle_not_rewardable");
    if(claimSnap.exists) return {ok:true,duplicate:true,claimId,envelope:{...publicEnvelope(claimSnap.data().envelope),revealedRewards:choiceSnap.data()?.revealedRewards||[]}};
    let envelope;
    try{envelope=buildDungeonBossEnvelope({battleId,memberId,monsterId});}
    catch(error){throw new HttpsError("invalid-argument",error.message);}
    const materialTotals={};
    [envelope.fixedReward.bossMaterial,...envelope.fixedReward.generalMaterials].forEach(item=>{materialTotals[item.materialId]=(materialTotals[item.materialId]||0)+item.quantity;});
    const items={...(inventorySnap.data()?.items||{})}; Object.entries(materialTotals).forEach(([id,qty])=>{items[id]=Math.max(0,Number(items[id])||0)+qty;});
    transaction.set(inventoryRef,{items,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    transaction.update(memberRef,{coins:FieldValue.increment(envelope.fixedReward.coins),kingSeals:FieldValue.increment(envelope.fixedReward.bossMarks),[`equipmentRuneFragments.${envelope.fixedReward.runeFragment.type}`]:FieldValue.increment(envelope.fixedReward.runeFragment.count),updatedAt:FieldValue.serverTimestamp()});
    if(envelope.card){const collection=cardSnap.data()||{},cards={...(collection.cards||{})},existing=cards[envelope.card.monsterId];cards[envelope.card.monsterId]=existing?{...existing,duplicates:(existing.duplicates||0)+1}:{...envelope.card,stars:1,duplicates:0,chosenStat:null,ts:Date.now()};transaction.set(cardRef,{cards,wbCards:collection.wbCards||{},equipped:collection.equipped||[],updatedAt:FieldValue.serverTimestamp()},{merge:true});}
    transaction.create(claimRef,{battleId,memberId,rewardType:"dungeonBoss",materialTotals,coins:envelope.fixedReward.coins,cardId:envelope.card?.monsterId||null,metadata:{mode:"dungeon",monsterId,catalogVersion:envelope.catalogVersion,source:"callable"},envelope,choiceStatus:"pending",claimedAt:FieldValue.serverTimestamp()});
    return {ok:true,duplicate:false,claimId,envelope:publicEnvelope(envelope)};
  });
});

exports.claimDungeonBossChoices = onCall({region:"asia-east1"},async request=>{
  if(!request.auth?.uid) throw new HttpsError("unauthenticated","請先登入");
  const claimId=String(request.data?.claimId||""),memberId=String(request.data?.memberId||""),selectedOptionIds=Array.isArray(request.data?.selectedOptionIds)?request.data.selectedOptionIds.map(String):[];
  if(!claimId||!memberId||claimId.includes("/")||memberId.includes("/")) throw new HttpsError("invalid-argument","invalid_dungeon_choice_identity");
  const db=getFirestore(),fixedRef=db.doc(`monsterRewardClaims/${claimId}`),choiceRef=db.doc(`dungeonBossChoiceClaims/${claimId}`),memberRef=db.doc(`members/${memberId}`),inventoryRef=db.doc(`materialInventory/${memberId}`),chestRef=db.doc(`chestInventory/${memberId}`),cardRef=db.doc(`cardCollections/${memberId}`);
  return db.runTransaction(async transaction=>{
    const [fixedSnap,choiceSnap,memberSnap,inventorySnap,chestSnap,cardSnap]=await transaction.getAll(fixedRef,choiceRef,memberRef,inventoryRef,chestRef,cardRef);
    if(choiceSnap.exists)return{ok:true,duplicate:true,selectedOptionIds:choiceSnap.data().selectedOptionIds||[],revealedRewards:choiceSnap.data().revealedRewards||[]};
    if(!fixedSnap.exists||!memberSnap.exists)throw new HttpsError("not-found","dungeon_boss_reward_not_found");
    const member=memberSnap.data(),fixed=fixedSnap.data();
    if(!(member.uid===request.auth.uid||(request.auth.token.email&&member.email===request.auth.token.email))||fixed.memberId!==memberId)throw new HttpsError("permission-denied","dungeon_choice_owner_mismatch");
    if(!validateChoices(fixed.envelope,selectedOptionIds))throw new HttpsError("invalid-argument","invalid_dungeon_boss_choices");
    const selected=fixed.envelope.choiceOptions.filter(option=>selectedOptionIds.includes(option.id)),materialTotals={},collectibleTotals={},cards=[],chests=[];let coins=0,arrowDew=0,archerXP=0;
    selected.forEach(option=>{const reward=option.reward||{};if(reward.type==="coins")coins+=reward.coins||0;else if(reward.type==="materialChests")chests.push(...buildFamilyMaterialChests({claimId,optionId:option.id,family:reward.family,tierIndex:reward.tier,quantity:reward.quantity}));else if(reward.type==="card"&&reward.card)cards.push(reward.card);else if(reward.type==="consolation"){arrowDew+=reward.arrowDew||0;archerXP+=reward.archerXP||0;}});
    if(Object.keys(materialTotals).length){const items={...(inventorySnap.data()?.items||{})};Object.entries(materialTotals).forEach(([id,qty])=>{items[id]=Math.max(0,Number(items[id])||0)+qty;});transaction.set(inventoryRef,{items,updatedAt:FieldValue.serverTimestamp()},{merge:true});}
    if(chests.length)transaction.set(chestRef,{chests:[...(chestSnap.data()?.chests||[]),...chests],updatedAt:FieldValue.serverTimestamp()},{merge:true});
    if(cards.length){const collection=cardSnap.data()||{},owned={...(collection.cards||{})};cards.forEach(card=>{const existing=owned[card.monsterId];owned[card.monsterId]=existing?{...existing,duplicates:(existing.duplicates||0)+1}:{...card,stars:1,duplicates:0,chosenStat:null,ts:Date.now()};});transaction.set(cardRef,{cards:owned,wbCards:collection.wbCards||{},equipped:collection.equipped||[],updatedAt:FieldValue.serverTimestamp()},{merge:true});}
    transaction.update(memberRef,{...(coins?{coins:FieldValue.increment(coins)}:{}),...(arrowDew?{arrowDew:FieldValue.increment(arrowDew)}:{}),...(archerXP?{archerXP:FieldValue.increment(archerXP)}:{}),updatedAt:FieldValue.serverTimestamp()});
    const revealedRewards=selected.map(option=>{const reward=option.reward||{};if(reward.type==="coins")return{type:"coins",coins:reward.coins||0};if(reward.type==="materialChests")return{type:"materialChests",quantity:reward.quantity||0,family:reward.family,tierIndex:reward.tier};if(reward.type==="card")return{type:"card",card:reward.card};return{type:"consolation",arrowDew:reward.arrowDew||0,archerXP:reward.archerXP||0};});
    transaction.create(choiceRef,{memberId,battleId:fixed.battleId,fixedClaimId:claimId,selectedOptionIds,materialTotals,collectibleTotals,coins,arrowDew,archerXP,chestCount:chests.length,cardIds:cards.map(card=>card.monsterId),revealedRewards,claimedAt:FieldValue.serverTimestamp()});
    return{ok:true,duplicate:false,selectedOptionIds,coins,arrowDew,archerXP,chestCount:chests.length,cardIds:cards.map(card=>card.monsterId),revealedRewards};
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

// ---------------------------------------------------------------------------
// Admin marketing / competition email campaigns.
// Sending is opt-in only. The hourly/daily limits are operational throttles,
// not a mechanism for bypassing provider anti-spam controls.
// ---------------------------------------------------------------------------

function assertMarketingAudience(value) {
  const audience = String(value || "all");
  if (!["official", "guest", "all"].includes(audience)) {
    throw new HttpsError("invalid-argument", "audience_invalid");
  }
  return audience;
}

function matchesMarketingAudience(accountType, audience) {
  if (accountType !== "official" && accountType !== "guest") return false;
  return audience === "all" || audience === accountType;
}

async function collectMarketingAudience(db, audience) {
  const [membersSnap, suppressionsSnap] = await Promise.all([
    db.collection("members").get(),
    db.collection("emailSuppressions").get(),
  ]);
  const suppressedHashes = new Set(suppressionsSnap.docs.map(doc => doc.id));
  const recipients = new Map();
  const stats = { scanned:0, eligible:0, invalid:0, notOptedIn:0, suppressed:0, duplicate:0 };

  for (const memberDoc of membersSnap.docs) {
    const member = memberDoc.data() || {};
    const accountType = marketingEmail.normalizeMarketingAccountType(member.accountType);
    if (!matchesMarketingAudience(accountType, audience)) continue;
    stats.scanned += 1;
    const email = marketingEmail.normalizeEmail(member.email || member.gmail || member.contactEmail);
    if (!email) { stats.invalid += 1; continue; }
    if (member.marketingOptIn !== true) { stats.notOptedIn += 1; continue; }
    const emailHash = marketingEmail.hashEmail(email);
    if (suppressedHashes.has(emailHash)) { stats.suppressed += 1; continue; }
    const existing = recipients.get(email);
    if (existing) {
      stats.duplicate += 1;
      existing.memberIds.push(memberDoc.id);
      continue;
    }
    recipients.set(email, {
      email,
      emailHash,
      memberIds:[memberDoc.id],
      displayName:String(member.nickname || member.name || member.displayName || "").trim(),
      accountType,
    });
  }
  stats.eligible = recipients.size;
  return { recipients:[...recipients.values()], stats };
}

function marketingCampaignStats(queued = 0, initiallySuppressed = 0) {
  return { queued, sent:0, failed:0, opened:0, unsubscribed:0, suppressed:initiallySuppressed, processed:0 };
}

function marketingCampaignId(value) {
  const id = String(value || "");
  if (!id || id.length > 1500 || id.includes("/")) throw new HttpsError("invalid-argument", "campaign_id_invalid");
  return id;
}

exports.saveMarketingEmailConfig = onCall({ region:"asia-east1" }, async request => {
  const uid = await requireAdmin(request);
  const config = marketingEmail.normalizeConfig(request.data || {});
  await getFirestore().doc("marketingEmailConfig/main").set({ ...config, updatedAt:FieldValue.serverTimestamp(), updatedBy:uid }, { merge:true });
  return { ok:true, config };
});

exports.previewMarketingAudience = onCall({ region:"asia-east1", timeoutSeconds:120 }, async request => {
  await requireAdmin(request);
  const audience = assertMarketingAudience(request.data?.audience);
  const { stats } = await collectMarketingAudience(getFirestore(), audience);
  return { ok:true, audience, stats };
});

exports.createMarketingCampaign = onCall({ region:"asia-east1" }, async request => {
  const uid = await requireAdmin(request);
  let input;
  try { input = marketingEmail.validateCampaignInput(request.data || {}); }
  catch (error) { throw new HttpsError("invalid-argument", error.message || "campaign_invalid"); }
  const ref = getFirestore().collection("marketingCampaigns").doc();
  await ref.set({
    ...input,
    status:"draft",
    stats:marketingCampaignStats(),
    createdBy:uid,
    createdAt:FieldValue.serverTimestamp(),
    updatedAt:FieldValue.serverTimestamp(),
  });
  return { ok:true, campaignId:ref.id };
});

exports.startMarketingCampaign = onCall({ region:"asia-east1", timeoutSeconds:540 }, async request => {
  await requireAdmin(request);
  const campaignId = marketingCampaignId(request.data?.campaignId);
  const db = getFirestore();
  const campaignRef = db.doc(`marketingCampaigns/${campaignId}`);
  const campaignSnap = await campaignRef.get();
  if (!campaignSnap.exists) throw new HttpsError("not-found", "campaign_not_found");
  const campaign = campaignSnap.data() || {};
  if (campaign.status !== "draft") throw new HttpsError("failed-precondition", "campaign_not_draft");
  const audience = assertMarketingAudience(campaign.audience);

  // Lock the draft before materialising the deterministic queue. If this call
  // fails, it is returned to draft; deterministic queue ids make a retry safe.
  await campaignRef.update({ status:"queued", updatedAt:FieldValue.serverTimestamp() });
  try {
    const { recipients, stats } = await collectMarketingAudience(db, audience);
    for (let offset = 0; offset < recipients.length; offset += 400) {
      const batch = db.batch();
      for (const recipient of recipients.slice(offset, offset + 400)) {
        const id = marketingEmail.queueId(campaignId, recipient.emailHash);
        batch.set(db.doc(`marketingEmailQueue/${id}`), {
          campaignId,
          email:recipient.email,
          emailHash:recipient.emailHash,
          memberIds:recipient.memberIds,
          displayName:recipient.displayName,
          accountType:recipient.accountType,
          status:"pending",
          attempts:0,
          nextAttemptAt:Timestamp.now(),
          trackingToken:marketingEmail.makeToken(),
          unsubscribeToken:marketingEmail.makeToken(),
          openedAt:null,
          unsubscribedAt:null,
          mailId:null,
          lastError:null,
          createdAt:FieldValue.serverTimestamp(),
          updatedAt:FieldValue.serverTimestamp(),
        }, { merge:false });
      }
      await batch.commit();
    }
    await campaignRef.update({
      status:recipients.length ? "running" : "completed",
      stats:marketingCampaignStats(recipients.length, stats.suppressed),
      audienceStats:stats,
      startedAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp(),
    });
    return { ok:true, queued:recipients.length, stats };
  } catch (error) {
    await campaignRef.set({ status:"draft", lastError:String(error?.message || error), updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    throw error;
  }
});

exports.pauseMarketingCampaign = onCall({ region:"asia-east1" }, async request => {
  await requireAdmin(request);
  const ref = getFirestore().doc(`marketingCampaigns/${marketingCampaignId(request.data?.campaignId)}`);
  await getFirestore().runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "campaign_not_found");
    if (snap.data()?.status !== "running") throw new HttpsError("failed-precondition", "campaign_not_running");
    tx.update(ref, { status:"paused", pausedAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() });
  });
  return { ok:true };
});

exports.resumeMarketingCampaign = onCall({ region:"asia-east1" }, async request => {
  await requireAdmin(request);
  const ref = getFirestore().doc(`marketingCampaigns/${marketingCampaignId(request.data?.campaignId)}`);
  await getFirestore().runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "campaign_not_found");
    if (snap.data()?.status !== "paused") throw new HttpsError("failed-precondition", "campaign_not_paused");
    tx.update(ref, { status:"running", resumedAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() });
  });
  return { ok:true };
});

function taipeiRunKeys(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone:"Asia/Taipei", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", hourCycle:"h23",
  }).formatToParts(date).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return { day, hour:`${day}-${parts.hour}` };
}

function marketingMailContent(campaign, queue, config) {
  const unsubscribeUrl = `${marketingEmail.publicFunctionUrl("marketingEmailUnsubscribe")}?token=${encodeURIComponent(queue.unsubscribeToken)}`;
  const openUrl = `${marketingEmail.publicFunctionUrl("marketingEmailOpen")}?token=${encodeURIComponent(queue.trackingToken)}`;
  const tracking = campaign.trackingEnabled !== false && config.trackingEnabled !== false;
  const baseHtml = campaign.html?.trim() || marketingEmail.textToHtml(campaign.text || "");
  const footer = `<hr style="margin:28px 0 16px;border:0;border-top:1px solid #ddd"><p style="font-size:12px;color:#666;line-height:1.6">您收到這封信是因為曾同意接收貓小隊射箭場的通知。<a href="${marketingEmail.escapeHtml(unsubscribeUrl)}">取消接收通知</a>${tracking ? "；本郵件可能透過圖片載入統計整體開信成效。" : ""}</p>`;
  const pixel = tracking ? `<img src="${marketingEmail.escapeHtml(openUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />` : "";
  const textFooter = `\n\n---\n若不再希望收到通知：${unsubscribeUrl}`;
  return { subject:campaign.subject, text:`${campaign.text || ""}${textFooter}`, html:`${baseHtml}${footer}${pixel}` };
}

async function reserveAndQueueMarketingMail(db, queueDoc, config, keys) {
  const queueRef = queueDoc.ref;
  return db.runTransaction(async tx => {
    const queueSnap = await tx.get(queueRef);
    if (!queueSnap.exists) return "skip";
    const queue = queueSnap.data() || {};
    if (queue.status !== "pending" || (queue.nextAttemptAt?.toMillis?.() || 0) > Date.now()) return "skip";
    const campaignRef = db.doc(`marketingCampaigns/${queue.campaignId}`);
    const suppressionRef = db.doc(`emailSuppressions/${queue.emailHash}`);
    const dayRef = db.doc(`marketingEmailRuns/day-${keys.day}`);
    const hourRef = db.doc(`marketingEmailRuns/hour-${keys.hour}`);
    const [campaignSnap, suppressionSnap, daySnap, hourSnap] = await Promise.all([
      tx.get(campaignRef), tx.get(suppressionRef), tx.get(dayRef), tx.get(hourRef),
    ]);
    if (!campaignSnap.exists || campaignSnap.data()?.status !== "running") return "skip";
    const campaign = campaignSnap.data() || {};
    if (suppressionSnap.exists) {
      const nextProcessed = Number(campaign.stats?.processed || 0) + 1;
      const queued = Number(campaign.stats?.queued || 0);
      tx.update(queueRef, { status:"suppressed", updatedAt:FieldValue.serverTimestamp() });
      tx.update(campaignRef, {
        "stats.suppressed":FieldValue.increment(1),
        "stats.processed":FieldValue.increment(1),
        ...(queued > 0 && nextProcessed >= queued ? { status:"completed", completedAt:FieldValue.serverTimestamp() } : {}),
        updatedAt:FieldValue.serverTimestamp(),
      });
      return "suppressed";
    }
    const dayCount = Number(daySnap.data()?.queuedCount || 0);
    const hourCount = Number(hourSnap.data()?.queuedCount || 0);
    if (dayCount >= config.dailyLimit || hourCount >= config.hourlyLimit) return "limit";
    const attempt = Number(queue.attempts || 0) + 1;
    const id = marketingEmail.mailId(queueRef.id, attempt);
    const mailRef = db.doc(`mail/${id}`);
    const mailSnap = await tx.get(mailRef);
    if (mailSnap.exists) return "skip";
    const message = marketingMailContent(campaign, queue, config);
    tx.set(mailRef, {
      to:queue.email,
      message,
      marketingEmail:{ queueId:queueRef.id, campaignId:queue.campaignId, attempt },
      createdAt:FieldValue.serverTimestamp(),
    });
    tx.update(queueRef, {
      status:"sending", attempts:attempt, mailId:id, lastAttemptAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp(),
    });
    tx.set(dayRef, { queuedCount:dayCount + 1, day:keys.day, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    tx.set(hourRef, { queuedCount:hourCount + 1, hour:keys.hour, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    return "queued";
  });
}

exports.processMarketingEmailQueue = onSchedule({
  region:"asia-east1", schedule:"0 * * * *", timeZone:"Asia/Taipei", timeoutSeconds:540,
}, async () => {
  const db = getFirestore();
  const configSnap = await db.doc("marketingEmailConfig/main").get();
  const config = marketingEmail.normalizeConfig(configSnap.data() || {});
  if (!config.enabled) return;
  const candidatesSnap = await db.collection("marketingEmailQueue").where("status", "==", "pending").limit(Math.max(100, config.hourlyLimit * 5)).get();
  const candidates = candidatesSnap.docs
    .filter(doc => (doc.data()?.nextAttemptAt?.toMillis?.() || 0) <= Date.now())
    .sort((a, b) => (a.data()?.nextAttemptAt?.toMillis?.() || 0) - (b.data()?.nextAttemptAt?.toMillis?.() || 0));
  const keys = taipeiRunKeys();
  let queued = 0;
  for (const doc of candidates) {
    const result = await reserveAndQueueMarketingMail(db, doc, config, keys);
    if (result === "queued") queued += 1;
    if (result === "limit" || queued >= config.hourlyLimit) break;
  }
  logger.info("marketing email hourly queue processed", { candidates:candidates.length, queued, day:keys.day, hour:keys.hour });
});

exports.handleMarketingEmailMailDelivery = onDocumentWritten({ region:"asia-east1", document:"mail/{mailId}" }, async event => {
  const after = event.data?.after;
  if (!after?.exists) return;
  const mail = after.data() || {};
  const meta = mail.marketingEmail;
  if (!meta?.queueId || !meta?.campaignId) return;
  const success = mail.delivery?.state === "SUCCESS";
  const deliveryError = mail.delivery?.error;
  if (!success && !deliveryError) return;
  const db = getFirestore();
  const queueRef = db.doc(`marketingEmailQueue/${meta.queueId}`);
  const campaignRef = db.doc(`marketingCampaigns/${meta.campaignId}`);
  await db.runTransaction(async tx => {
    const [queueSnap, campaignSnap] = await Promise.all([tx.get(queueRef), tx.get(campaignRef)]);
    if (!queueSnap.exists || !campaignSnap.exists) return;
    const queue = queueSnap.data() || {};
    const campaign = campaignSnap.data() || {};
    if (queue.status !== "sending" || queue.mailId !== event.params.mailId) return;
    if (success) {
      const nextProcessed = Number(campaign.stats?.processed || 0) + 1;
      const total = Number(campaign.stats?.queued || 0);
      tx.update(queueRef, { status:"sent", sentAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp(), lastError:null });
      tx.update(campaignRef, {
        "stats.sent":FieldValue.increment(1), "stats.processed":FieldValue.increment(1),
        ...(total > 0 && nextProcessed >= total ? { status:"completed", completedAt:FieldValue.serverTimestamp() } : {}),
        updatedAt:FieldValue.serverTimestamp(),
      });
      return;
    }
    const attempts = Number(queue.attempts || 0);
    const errorText = String(deliveryError?.message || deliveryError || "delivery_error").slice(0, 1000);
    if (attempts < 3) {
      tx.update(queueRef, {
        status:"pending", mailId:null, lastError:errorText,
        nextAttemptAt:Timestamp.fromMillis(Date.now() + Math.max(1, attempts) * 60 * 60 * 1000),
        updatedAt:FieldValue.serverTimestamp(),
      });
      return;
    }
    const nextProcessed = Number(campaign.stats?.processed || 0) + 1;
    const total = Number(campaign.stats?.queued || 0);
    tx.update(queueRef, { status:"failed", lastError:errorText, updatedAt:FieldValue.serverTimestamp() });
    tx.update(campaignRef, {
      "stats.failed":FieldValue.increment(1), "stats.processed":FieldValue.increment(1),
      ...(total > 0 && nextProcessed >= total ? { status:"completed", completedAt:FieldValue.serverTimestamp() } : {}),
      updatedAt:FieldValue.serverTimestamp(),
    });
  });
});

function sendTrackingGif(res) {
  res.set("Content-Type", "image/gif");
  res.set("Cache-Control", "no-store, private, max-age=0");
  res.status(200).send(marketingEmail.transparentGif);
}

exports.marketingEmailOpen = onRequest({ region:"asia-east1" }, async (req, res) => {
  const token = String(req.query?.token || "");
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return sendTrackingGif(res);
  try {
    const db = getFirestore();
    const snap = await db.collection("marketingEmailQueue").where("trackingToken", "==", token).limit(1).get();
    if (!snap.empty) {
      const queueRef = snap.docs[0].ref;
      await db.runTransaction(async tx => {
        const queueSnap = await tx.get(queueRef);
        const queue = queueSnap.data() || {};
        if (!queueSnap.exists || queue.openedAt) return;
        const campaignRef = db.doc(`marketingCampaigns/${queue.campaignId}`);
        const campaignSnap = await tx.get(campaignRef);
        tx.update(queueRef, { openedAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() });
        if (campaignSnap.exists) tx.update(campaignRef, { "stats.opened":FieldValue.increment(1), updatedAt:FieldValue.serverTimestamp() });
      });
    }
  } catch (error) {
    logger.warn("marketing open tracking failed", { error:String(error?.message || error) });
  }
  return sendTrackingGif(res);
});

function unsubscribeConfirmationHtml(token) {
  const safe = marketingEmail.escapeHtml(token);
  return `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>取消 Email 通知</title><body style="font-family:Arial,'Noto Sans TC',sans-serif;max-width:560px;margin:60px auto;padding:0 20px;line-height:1.7"><h1>取消 Email 通知</h1><p>按下確認後，這個 Email 將不再接收貓小隊射箭場的優惠與比賽通知。</p><form method="post" action="?token=${safe}"><button type="submit" style="font-size:16px;padding:10px 18px">確認取消通知</button></form></body></html>`;
}

exports.marketingEmailUnsubscribe = onRequest({ region:"asia-east1" }, async (req, res) => {
  const token = String(req.query?.token || "");
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store");
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return res.status(400).send("無效的取消通知連結。");
  if (req.method === "GET") return res.status(200).send(unsubscribeConfirmationHtml(token));
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  try {
    const db = getFirestore();
    const match = await db.collection("marketingEmailQueue").where("unsubscribeToken", "==", token).limit(1).get();
    if (match.empty) return res.status(400).send("無效或已失效的取消通知連結。");
    const queueRef = match.docs[0].ref;
    await db.runTransaction(async tx => {
      const queueSnap = await tx.get(queueRef);
      if (!queueSnap.exists) return;
      const queue = queueSnap.data() || {};
      const campaignRef = db.doc(`marketingCampaigns/${queue.campaignId}`);
      const campaignSnap = await tx.get(campaignRef);
      const now = Timestamp.now();
      tx.set(db.doc(`emailSuppressions/${queue.emailHash}`), {
        emailHash:queue.emailHash, reason:"unsubscribe", sourceCampaignId:queue.campaignId,
        createdAt:now, updatedAt:now,
      }, { merge:true });
      if (!queue.unsubscribedAt) {
        tx.update(queueRef, { unsubscribedAt:now, updatedAt:now });
        if (campaignSnap.exists) tx.update(campaignRef, { "stats.unsubscribed":FieldValue.increment(1), updatedAt:now });
      }
      for (const memberId of [...new Set(Array.isArray(queue.memberIds) ? queue.memberIds : [])].slice(0, 50)) {
        if (memberId && !String(memberId).includes("/")) tx.set(db.doc(`members/${memberId}`), { marketingOptIn:false, marketingOptOutAt:now }, { merge:true });
      }
    });
    return res.status(200).send("<!doctype html><html lang=\"zh-Hant\"><meta charset=\"utf-8\"><body style=\"font-family:Arial,'Noto Sans TC',sans-serif;max-width:560px;margin:60px auto;padding:0 20px\"><h1>已取消通知</h1><p>之後不會再寄送優惠與比賽 Email 到這個地址。</p></body></html>");
  } catch (error) {
    logger.error("marketing unsubscribe failed", error);
    return res.status(500).send("取消通知時發生錯誤，請稍後再試。");
  }
});


function websiteCompetitionIso(value) {
  if (value?.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : "";
}

exports.publishCompetitionWebsite = onCall({
  region:"asia-east1",
  timeoutSeconds:540,
  memory:"1GiB",
  secrets:[CAT_ARCHERY_VERCEL],
}, async request => {
  const uid = await requireAdmin(request);
  const db = getFirestore();
  const stateRef = db.doc("websitePublishState/competition");
  const now = Timestamp.now();

  await db.runTransaction(async tx => {
    const state = await tx.get(stateRef);
    const data = state.data() || {};
    const startedMs = data.startedAt?.toMillis?.() || 0;
    if (data.status === "running" && Date.now() - startedMs < 10 * 60 * 1000) {
      throw new HttpsError("already-exists", "competition_publish_already_running");
    }
    tx.set(stateRef, { status:"running", startedAt:now, startedBy:uid, updatedAt:now }, { merge:true });
  });

  let workspace = "";
  try {
    const templateDir = require("path").join(__dirname, "website-template");
    const toolsDir = require("path").join(__dirname, "website-publisher-tools");
    if (!require("fs").existsSync(templateDir) || !require("fs").existsSync(toolsDir)) {
      throw new Error("publisher_template_missing: run npm run website:publisher:prepare before deploying this function");
    }

    const snap = await db.collection("websiteCompetitionResults").get();
    const sourceEvents = snap.docs.map(docSnap => {
      const row = docSnap.data() || {};
      return {
        ...row,
        publishedAt:websiteCompetitionIso(row.publishedAt),
        updatedAt:websiteCompetitionIso(row.updatedAt),
        createdAt:websiteCompetitionIso(row.createdAt),
      };
    });

    workspace = competitionWebsitePublisher.createWorkspace();
    const fs = require("fs"), path = require("path");
    competitionWebsitePublisher.copyTree(templateDir, path.join(workspace, "website"));
    competitionWebsitePublisher.copyTree(toolsDir, path.join(workspace, "scripts", "website"));

    const publication = require(path.join(workspace, "scripts", "website", "competition-publication.cjs"));
    const snapshot = publication.buildSnapshot(sourceEvents, new Date().toISOString());
    fs.writeFileSync(path.join(workspace, "website", "assets", "competition-results.json"), JSON.stringify(snapshot, null, 2) + "\n", "utf8");
    const generator = require(path.join(workspace, "scripts", "website", "generate-competition-pages.cjs"));
    generator.generate();

    const deployment = await competitionWebsitePublisher.deployDirectory(path.join(workspace, "website"), CAT_ARCHERY_VERCEL.value());
    await stateRef.set({
      status:"submitted", completedAt:Timestamp.now(), updatedAt:Timestamp.now(), completedBy:uid,
      eventCount:snapshot.events.length, deploymentId:deployment.id, deploymentUrl:deployment.url,
      deploymentState:deployment.readyState, fileCount:deployment.fileCount, error:FieldValue.delete(),
    }, { merge:true });
    logger.info("competition website deployment submitted", { uid, eventCount:snapshot.events.length, deploymentId:deployment.id, fileCount:deployment.fileCount });
    return { ok:true, eventCount:snapshot.events.length, ...deployment };
  } catch (error) {
    logger.error("competition website publish failed", error);
    await stateRef.set({ status:"failed", failedAt:Timestamp.now(), updatedAt:Timestamp.now(), failedBy:uid, error:String(error?.message || error).slice(0,1000) }, { merge:true });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "competition_publish_failed", { message:String(error?.message || error).slice(0,500) });
  } finally {
    if (workspace) { try { require("fs").rmSync(workspace, { recursive:true, force:true }); } catch {} }
  }
});
