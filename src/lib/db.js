// src/lib/db.js
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  setDoc, query, where, orderBy, limit, serverTimestamp, onSnapshot,
  increment, arrayUnion, Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Collections ───────────────────────────────────────────
const C = {
  members:       "members",
  competitions: "competitions",
  results:      "results",
  messages:     "messages",
  learnLogs:    "learnLogs",
  practiceLogs: "practiceLogs",
  achievements: "achievements",
  certRecords:  "certRecords",
  badgeLogs:    "badgeLogs",
  auditLogs:    "auditLogs",
  externalComps:"externalComps",
  registrations:"registrations",
};

// ─── Audit Log helper ──────────────────────────────────────
export async function writeAuditLog(action, targetId, targetType, before, after, operatorId) {
  await addDoc(collection(db, C.auditLogs), {
    action, targetId, targetType, before, after, operatorId,
    createdAt: serverTimestamp(),
  });
}

// ─── Members ───────────────────────────────────────────────
export async function getMembers() {
  const snap = await getDocs(query(collection(db, C.members), orderBy("lastLoginAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeMembers(callback) {
  return onSnapshot(
    query(collection(db, C.members), orderBy("lastLoginAt", "desc")),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

export async function getMember(id) {
  const snap = await getDoc(doc(db, C.members, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createMember(data, operatorId) {
  const now = serverTimestamp();
  const uid = data.uid;
  if (!uid) throw new Error("uid is required");
  await setDoc(doc(db, C.members, uid), {
    ...data,
    fatCat: { gold: 0, silver: 0, bronze: 0 },
    score: { gold: 0, silver: 0, bronze: 0 },
    achievement: { black: 0, gold: 0, silver: 0 },
    eventPoints: 0,
    createdAt: now,
    lastLoginAt: now,
    updatedAt: now,
  });
  await writeAuditLog("CREATE", uid, "member", null, data, operatorId);
  return uid;
}

export async function updateMember(id, data, operatorId) {
  const before = await getMember(id);
  if (!before) throw new Error("找不到該會員資料");
  const updateData = { updatedAt: serverTimestamp() };
const safeFields = ["name", "nickname", "username", "email", "phone", "archerNo", "archerNoDate", "joinDate", "note", "equipment", "armorSets", "accessorySets", "fatCat", "score", "achievement", "eventPoints", "shareSlogan"];
  safeFields.forEach(field => { if (data[field] !== undefined) updateData[field] = data[field]; });
  await updateDoc(doc(db, C.members, id), updateData);
  await writeAuditLog("UPDATE", id, "member", before, updateData, operatorId);
}

export async function deleteMember(id, operatorId) {
  const before = await getMember(id);
  await deleteDoc(doc(db, C.members, id));
  await writeAuditLog("DELETE", id, "member", before, null, operatorId);
}

export async function updateLastLogin(id) {
  try {
    const snap = await getDoc(doc(db, C.members, id));
    if (snap.exists()) await updateDoc(doc(db, C.members, id), { lastLoginAt: serverTimestamp() });
  } catch (e) { console.warn("updateLastLogin failed:", e.message); }
}

// ─── Badge Logic ───────────────────────────────────────────
export async function addBadge(memberId, badgeType, color, count, operatorId, note = "") {
  const member = await getMember(memberId);
  const current = { ...member[badgeType] };
  current[color] = (current[color] || 0) + count;
  const bronzeToSilver = Math.floor(current.bronze / 10);
  if (bronzeToSilver > 0) { current.bronze -= bronzeToSilver * 10; current.silver += bronzeToSilver; }
  const silverToGold = Math.floor(current.silver / 5);
  if (silverToGold > 0) { current.silver -= silverToGold * 5; current.gold += silverToGold; }
  await addDoc(collection(db, C.badgeLogs), { memberId, badgeType, color, count, note, resultSnapshot: current, status: "pending_claim", createdAt: serverTimestamp(), operatorId });
  await updateMember(memberId, { [badgeType]: current }, operatorId);
  return current;
}

export async function claimBadge(logId, memberId) {
  await updateDoc(doc(db, C.badgeLogs, logId), { status: "claimed", claimedAt: serverTimestamp(), claimedBy: memberId });
}

export async function reportBadgeError(logId, memberId, reason) {
  await updateDoc(doc(db, C.badgeLogs, logId), { status: "disputed", disputeReason: reason, disputedAt: serverTimestamp(), disputedBy: memberId });
}

function reviveResult(d) {
  const res = { id: d.id, ...d.data() };
  if (res.roundsString && typeof res.roundsString === "string") {
    try { res.rounds = JSON.parse(res.roundsString); } catch { res.rounds = []; }
  }
  if (!Array.isArray(res.rounds)) res.rounds = [];
  return res;
}

// ─── Practice & Competitions ───────────────────────────────
export function subscribePracticeLogs(memberId, callback) {
  return onSnapshot(query(collection(db, C.practiceLogs), where("memberId", "==", memberId), orderBy("date", "desc")), snap => {
    const logs = snap.docs.map(d => {
      const res = { id: d.id, ...d.data() };
      if (res.roundsString && typeof res.roundsString === "string") { try { res.rounds = JSON.parse(res.roundsString); } catch (e) { res.rounds = []; } }
      if (!Array.isArray(res.rounds)) res.rounds = [];
      return res;
    });
    callback(logs);
  });
}

export async function addPracticeLog(memberId, data, operatorId) {
  const cleanedData = JSON.parse(JSON.stringify(data));
  if (cleanedData.equipment && typeof cleanedData.equipment === "object") cleanedData.equipment = cleanedData.equipment.label || cleanedData.equipment.category || "未指定裝備";
  if (Array.isArray(cleanedData.rounds)) { cleanedData.roundsString = JSON.stringify(cleanedData.rounds); delete cleanedData.rounds; }
  else { cleanedData.roundsString = JSON.stringify([]); }
  const ref = await addDoc(collection(db, C.practiceLogs), { memberId, ...cleanedData, createdAt: serverTimestamp(), operatorId: operatorId || memberId });
  return ref.id;
}

export async function resolveBadgeDispute(logId, operatorId, newCount, note) {
  await updateDoc(doc(db, C.badgeLogs, logId), { status: "resolved", resolvedAt: serverTimestamp(), resolvedBy: operatorId, resolvedNote: note, correctedCount: newCount });
}

export function subscribeBadgeLogs(memberId, callback) {
  return onSnapshot(query(collection(db, C.badgeLogs), where("memberId", "==", memberId), orderBy("createdAt", "desc")), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function getCompetitions() {
  const snap = await getDocs(query(collection(db, C.competitions), orderBy("date", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeCompetitions(callback) {
  return onSnapshot(query(collection(db, C.competitions), orderBy("date", "desc")), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function createCompetition(data, operatorId) {
  const ref = await addDoc(collection(db, C.competitions), { ...data, status: "upcoming", participants: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await writeAuditLog("CREATE", ref.id, "competition", null, data, operatorId);
  return ref.id;
}

export async function updateCompetition(id, data, operatorId) {
  const before = (await getDoc(doc(db, C.competitions, id))).data();
  await updateDoc(doc(db, C.competitions, id), { ...data, updatedAt: serverTimestamp() });
  await writeAuditLog("UPDATE", id, "competition", before, data, operatorId);
}

// ─── Results ───────────────────────────────────────────────
export async function getResults(compId) {
  const snap = await getDocs(query(collection(db, C.results), where("compId", "==", compId)));
  return snap.docs.map(reviveResult);
}

export function subscribeResults(compId, callback) {
  return onSnapshot(query(collection(db, C.results), where("compId", "==", compId)), snap => callback(snap.docs.map(reviveResult)), err => { console.warn("subscribeResults:", err.message); callback([]); });
}

export async function submitResult(compId, memberId, data) {
  const clean = { ...data };
  if (Array.isArray(clean.rounds)) {
    clean.roundsString = JSON.stringify(clean.rounds);
    delete clean.rounds;
  }

  const existingSnap = await getDocs(
    query(collection(db, C.results), where("compId", "==", compId), where("memberId", "==", memberId))
  );

  let prev = null;
  if (clean.isCert) {
    prev = existingSnap.docs.find(d => d.data().certBowType === clean.certBowType) || null;
  } else {
    prev = existingSnap.docs[0] || null;
  }

  let resultId;
  if (prev) {
    if (clean.isCert) {
      await updateDoc(doc(db, C.results, prev.id), { ...clean, updatedAt: serverTimestamp() });
    } else {
      const prevTotal = prev.data().total || 0;
      if ((clean.total || 0) >= prevTotal) {
        await updateDoc(doc(db, C.results, prev.id), { ...clean, updatedAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, C.results, prev.id), { lastAttemptAt: serverTimestamp() });
      }
    }
    resultId = prev.id;
  } else {
    const ref = await addDoc(collection(db, C.results), {
      compId, memberId, ...clean,
      submittedAt: serverTimestamp(),
    });
    resultId = ref.id;
  }

  return resultId;
}

// ─── 結算與其它功能 ────────────────────────────────────────
export async function settleCompetition(compId, operatorId) {
  const results = await getResults(compId);
  const sorted = [...results].sort((a, b) => (b.total || 0) - (a.total || 0));
  const pointMap = { 0: 3, 1: 2, 2: 1 };

  for (let i = 0; i < sorted.length; i++) {
    const pts = pointMap[i] ?? 0;
    try {
      await updateDoc(doc(db, C.results, sorted[i].id), { rank: i + 1 });
    } catch (e) { console.warn("write rank failed:", e?.message); }
    if (pts > 0) {
      await updateDoc(doc(db, C.members, sorted[i].memberId), { eventPoints: increment(pts) });
    }
  }
  await updateCompetition(compId, { status: "settled", settledAt: serverTimestamp() }, operatorId);
}

export async function getMemberResults(memberId) {
  const snap = await getDocs(query(collection(db, C.results), where("memberId", "==", memberId), orderBy("submittedAt", "desc")));
  return snap.docs.map(reviveResult);
}

export async function register(compId, memberData) {
  const { memberId, name, nickname, isGuest, guestInfo } = memberData;
  const existing = await getDocs(query(collection(db, C.registrations), where("compId", "==", compId), where("memberId", "==", memberId)));
  if (!existing.empty) return existing.docs[0].id;
  const ref = await addDoc(collection(db, C.registrations), {
    compId, memberId, name, nickname,
    isGuest: isGuest || false, guestInfo: guestInfo || {},
    registeredAt: serverTimestamp(), status: "registered"
  });
  await updateDoc(doc(db, C.competitions, compId), { participants: arrayUnion(memberId) });
  return ref.id;
}

export async function getRegistrations(compId) {
  const snap = await getDocs(query(collection(db, C.registrations), where("compId", "==", compId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addLearnLog(memberId, data) {
  const ref = await addDoc(collection(db, C.learnLogs), { memberId, ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateLearnLog(id, data, operatorId) {
  const before = (await getDoc(doc(db, C.learnLogs, id))).data();
  await updateDoc(doc(db, C.learnLogs, id), { ...data, updatedAt: serverTimestamp() });
  await writeAuditLog("UPDATE", id, "learnLog", before, data, operatorId);
}

export function subscribeLearnLogs(memberId, callback) {
  return onSnapshot(query(collection(db, C.learnLogs), where("memberId", "==", memberId), orderBy("date", "desc")), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function upsertCertRecord(memberId, year, half, bowType, score, operatorId) {
  const id = `${memberId}_${year}_${half}_${bowType}`;
  await setDoc(doc(db, C.certRecords, id), { memberId, year, half, bowType, score, updatedAt: serverTimestamp(), operatorId }, { merge: true });
}

export async function getCertRecords(memberId) {
  const snap = await getDocs(query(collection(db, C.certRecords), where("memberId", "==", memberId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAchievements() {
  const snap = await getDocs(query(collection(db, C.achievements), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createAchievement(data, operatorId) {
  const ref = await addDoc(collection(db, C.achievements), { ...data, status: "active", createdAt: serverTimestamp(), operatorId });
  return ref.id;
}

export async function addExternalComp(memberId, data) {
  const ref = await addDoc(collection(db, C.externalComps), { memberId, ...data, status: "pending_review", submittedAt: serverTimestamp() });
  return ref.id;
}

export async function reviewExternalComp(id, approved, badgeType, badgeColor, badgeCount, operatorId) {
  await updateDoc(doc(db, C.externalComps, id), { status: approved ? "approved" : "rejected", reviewedAt: serverTimestamp(), reviewedBy: operatorId, badgeType, badgeColor, badgeCount });
  if (approved) {
    const snap = await getDoc(doc(db, C.externalComps, id));
    const data = snap.data();
    await addBadge(data.memberId, badgeType, badgeColor, badgeCount, operatorId, `對外比賽：${data.compName}`);
  }
}

export function subscribeExternalComps(memberId, callback) {
  return onSnapshot(query(collection(db, C.externalComps), where("memberId", "==", memberId), orderBy("submittedAt", "desc")), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function sendMessage(memberId, content) {
  await addDoc(collection(db, C.messages), { memberId, content, reply: null, repliedAt: null, memberRead: false, createdAt: serverTimestamp() });
}

export async function replyMessage(id, reply, operatorId) {
  await updateDoc(doc(db, C.messages, id), { reply, repliedAt: serverTimestamp(), replyBy: operatorId, memberRead: false });
}

export async function markMessagesRead(memberId) {
  const snap = await getDocs(query(collection(db, C.messages), where("memberId", "==", memberId), where("memberRead", "==", false)));
  for (const d of snap.docs) { await updateDoc(d.ref, { memberRead: true }); }
}

export function subscribeMessages(memberId, callback) {
  return onSnapshot(query(collection(db, C.messages), where("memberId", "==", memberId), orderBy("createdAt", "desc")), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function subscribeAllMessages(callback) {
  return onSnapshot(query(collection(db, C.messages), orderBy("createdAt", "desc")), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function getAuditLogs(targetId) {
  const snap = await getDocs(query(collection(db, C.auditLogs), where("targetId", "==", targetId), orderBy("createdAt", "desc"), limit(50)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeAllDisputes(callback) {
  return onSnapshot(query(collection(db, "badgeLogs"), where("status", "==", "disputed")), snap => {
    const map = {};
    snap.docs.forEach(d => { const log = { id: d.id, ...d.data() }; if (!map[log.memberId]) map[log.memberId] = []; map[log.memberId].push(log); });
    callback(map);
  }, err => { console.warn("subscribeAllDisputes error:", err.message); callback({}); });
}

export function subscribeCompResults(compId, callback) {
  return onSnapshot(query(collection(db, C.results), where("compId", "==", compId)), snap => callback(snap.docs.map(reviveResult)), err => { console.warn("subscribeCompResults:", err.message); callback([]); });
}

export function subscribePendingCertResults(callback) {
  return onSnapshot(query(collection(db, C.results), where("reviewStatus", "==", "pending")), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => { console.warn("subscribePendingCertResults:", err.message); callback([]); });
}

export async function approveCertResult(resultId, operatorId, finalTotal, certLevel) {
  const ref = doc(db, C.results, resultId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("找不到成績");
  const r = snap.data();
 
  await updateDoc(ref, {
    total: Number(finalTotal),
    certLevel: certLevel || "未達標",
    reviewStatus: "approved",
    reviewedAt: serverTimestamp(),
    reviewedBy: operatorId,
  });
 
  if (r.certBowType && r.certYear && r.certHalf) {
    const id = `${r.memberId}_${Number(r.certYear)}_${r.certHalf}_${r.certBowType}`;
 
    let prevScore = 0;
    try {
      const prevSnap = await getDoc(doc(db, C.certRecords, id));
      if (prevSnap.exists()) prevScore = Number(prevSnap.data().score || 0);
    } catch {}
 
    const best = Math.max(prevScore, Number(finalTotal));
    await upsertCertRecord(r.memberId, Number(r.certYear), r.certHalf, r.certBowType, best, operatorId);
 
    // ── 直接內嵌「分數→級別」邏輯，不依賴外部函式 ──
    const TH = {
      recurve_bare: { 入門:60, 初級:90, 中級:108, 進階:126, 精英:144 },
      recurve_full: { 入門:60, 初級:90, 中級:108, 進階:126, 精英:144 },
      compound:     { 入門:54, 初級:81, 中級:99,  進階:114, 精英:132 },
      traditional:  { 入門:48, 初級:72, 中級:90,  進階:102, 菁英:114 },
    };
    function levelOf(score) {
      if (!score || score <= 0) return null;
      const t = TH[r.certBowType] || {};
      let lv = null;
      for (const [name, pts] of Object.entries(t)) { if (score >= pts) lv = name; }
      return lv;
    }
 
    const prevLevel = levelOf(prevScore);
    const newLevel = certLevel && certLevel !== "未達標" ? certLevel : levelOf(Number(finalTotal));
 
    try {
      await maybeSendCertHonor({
        memberId: r.memberId,
        bowType: r.certBowType,
        bowLabel: r.bowLabel,
        year: r.certYear, half: r.certHalf,
        score: Number(finalTotal),
        prevLevel, newLevel,
        operatorId,
      });
    } catch (e) { console.warn("honor:", e?.message); }
  }
}

export async function rejectCertResult(resultId, operatorId) {
  const ref = doc(db, C.results, resultId);
  const snap = await getDoc(ref);
  if (snap.exists()) { await updateDoc(ref, { reviewStatus: "rejected", reviewedAt: serverTimestamp(), reviewedBy: operatorId }); await deleteDoc(ref); }
}

export async function getMyCompResult(compId, memberId) {
  const snap = await getDocs(query(collection(db, C.results), where("compId", "==", compId), where("memberId", "==", memberId)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function getApprovedResults() {
  const snap = await getDocs(query(collection(db, C.results), where("reviewStatus", "==", "approved")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAllCertRecords() {
  const snap = await getDocs(collection(db, C.certRecords));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// 刪除某人「某年+某半年+某弓種」的檢定：清掉 certRecords 那筆 + 對應的 results 檢定成績
export async function deleteCertRecord(memberId, year, half, bowType, operatorId) {
  const certId = `${memberId}_${year}_${half}_${bowType}`;
  try { await deleteDoc(doc(db, C.certRecords, certId)); } catch (e) { console.warn("del certRecord:", e?.message); }
  const snap = await getDocs(query(
    collection(db, C.results),
    where("memberId", "==", memberId),
    where("isCert", "==", true),
    where("certBowType", "==", bowType)
  ));
  for (const d of snap.docs) {
    const r = d.data();
    const sameYear = String(r.certYear) === String(year);
    const sameHalf = (r.certHalf || "first") === half;
    if (sameYear && sameHalf) {
      try { await deleteDoc(d.ref); } catch (e) { console.warn("del result:", e?.message); }
    }
  }
}

/* ════════════════════════════════════════════════════════════
   模組三：射手證畢業考（灰/藍/金）
   ════════════════════════════════════════════════════════════ */

const CERT_CERTIFICATIONS = "certifications";
const CERT_CONFIG = "certConfig";

export const CERT_PASS_DEFAULT = {
  blueDistance: 10,
  goldDistance: 15,
  blue: {
    rental:      { task1Hits: 3, task2Score: 60 },
    traditional: { task1Hits: 3, task2Score: 50 },
    standard:    { task1Hits: 4, task2Score: 70 },
  },
  gold: {
    rental:      { task1Hits: 3, task2Score: 60 },
    traditional: { task1Hits: 3, task2Score: 50 },
    standard:    { task1Hits: 4, task2Score: 70 },
  },
};

export function certBowGroup(bowType) {
  if (bowType === "rental") return "rental";
  if (bowType === "traditional") return "traditional";
  return "standard";
}

export async function getCertConfig() {
  try {
    const snap = await getDoc(doc(db, CERT_CONFIG, "default"));
    if (snap.exists()) return snap.data();
  } catch (e) { console.warn("getCertConfig:", e?.message); }
  return CERT_PASS_DEFAULT;
}

export async function saveCertConfig(config, operatorId) {
  await setDoc(doc(db, CERT_CONFIG, "default"), { ...config, updatedAt: serverTimestamp(), operatorId }, { merge: true });
}

export async function getCertification(memberId) {
  try {
    const snap = await getDoc(doc(db, CERT_CERTIFICATIONS, memberId));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
  } catch (e) { console.warn("getCertification:", e?.message); }
  return null;
}

export function subscribeCertification(memberId, callback) {
  return onSnapshot(doc(db, CERT_CERTIFICATIONS, memberId),
    snap => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    err => { console.warn("subscribeCertification:", err.message); callback(null); });
}

export async function submitCertTask(memberId, tier, task, payload, bowType, equipLabels) {
  const ref = doc(db, CERT_CERTIFICATIONS, memberId);
  const snap = await getDoc(ref);
  const base = snap.exists() ? snap.data() : { level: "none", locked: false };

  if (base.locked) throw new Error("射手證已取得最高級（金證），無法再測驗");

  const tierData = base[tier] || {};
  const taskData = {
    ...(payload || {}),
    passed: false,
    reviewStatus: "pending",
    submittedAt: serverTimestamp(),
  };

  await setDoc(ref, {
    level: base.level || "none",
    locked: base.locked || false,
    [tier]: {
      ...tierData,
      bowType: bowType || tierData.bowType || null,
      bowLabel:       equipLabels?.bowLabel       || null,
      armorLabel:     equipLabels?.armorLabel     || null,
      accessoryLabel: equipLabels?.accessoryLabel || null,
      [task]: taskData,
    },
  }, { merge: true });

  return memberId;
}

export async function reviewCertTask(memberId, tier, task, approve, operatorId) {
  const ref = doc(db, "certifications", memberId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("找不到考證紀錄");
  const data = snap.data();
  const tierData = { ...(data[tier] || {}) };
  const taskData = { ...(tierData[task] || {}) };
 
  taskData.passed = approve;
  taskData.reviewStatus = approve ? "approved" : "rejected";
  taskData.reviewedAt = serverTimestamp();
  taskData.reviewedBy = operatorId;
  tierData[task] = taskData;
 
  const update = { [tier]: tierData };
 
  const t1ok = tierData.task1?.passed === true;
  const t2ok = tierData.task2?.passed === true;
  let granted = false;
  if (approve && t1ok && t2ok) {
    tierData.grantedAt = serverTimestamp();
    update[tier] = tierData;
    update.level = tier;
    if (tier === "gold") update.locked = true;
    granted = true;
  }
 
  await setDoc(ref, update, { merge: true });
 
  // 取得證 → 發榮耀通知
  if (granted) {
    try { await sendCertExamHonor({ memberId, tier, operatorId }); }
    catch (e) { console.warn("exam honor:", e?.message); }
  }
 
  return { granted, level: update.level };
}
 
/* ════════════════════════════════════════════════════════════
   模組二：訊息中心 / 通知
   把這整段「新增」到 db.js 最後面。
   ════════════════════════════════════════════════════════════ */

const C_NOTIF = "notifications";

// ── 發送通知（通用）──────────────────────────────────────
// type: important | promo | new_comp | cert_pass | high_score | comp_result
export async function createNotification(data, operatorId) {
  const ref = await addDoc(collection(db, C_NOTIF), {
    type: data.type,
    title: data.title || "",
    content: data.content || "",
    targetMemberId: data.targetMemberId ?? null,   // null = 全體
    mustRead: data.mustRead || false,
    subjectMemberId: data.subjectMemberId ?? null,
    subjectInfo: data.subjectInfo ?? null,
    congrats: [],
    readBy: [],
    createdAt: serverTimestamp(),
    createdBy: operatorId || null,
  });
  return ref.id;
}

// ── 訂閱「我看得到的」通知 ────────────────────────────────
// 全體通知(targetMemberId=null) + 指定給我的(targetMemberId=myId)
// 榮耀通知(cert_pass/high_score)全體可見（為了能去祝賀）
export function subscribeNotifications(memberId, callback, memberCreatedAt) {
  return onSnapshot(
    query(collection(db, C_NOTIF), orderBy("createdAt", "desc")),
    snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const joinedMs = memberCreatedAt
        ? (memberCreatedAt?.toMillis?.() ?? memberCreatedAt?.seconds * 1000 ?? Number(memberCreatedAt))
        : 0;

      const visible = all.filter(n => {
        if (n.targetMemberId != null && n.targetMemberId !== memberId) return false;
        if ((n.deletedBy || []).includes(memberId)) return false;
        if (joinedMs > 0) {
          const notifMs = n.createdAt?.toMillis?.() ?? n.createdAt?.seconds * 1000 ?? 0;
          if (notifMs < joinedMs) return false;
        }
        return true;
      });

      callback(visible);
    },
    err => { console.warn("subscribeNotifications:", err.message); callback([]); }
  );
}

// 標記已讀
export async function markNotificationRead(notifId, memberId) {
  try { await updateDoc(doc(db, C_NOTIF, notifId), { readBy: arrayUnion(memberId) }); }
  catch (e) { console.warn("markNotificationRead:", e?.message); }
}

// 會員自己刪除通知（從自己的「已刪除」名單，前端過濾；不真的刪全體那筆）
// 改用 deletedBy 名單：會員刪除＝把自己加進 deletedBy，前端過濾掉
export async function deleteNotificationForMe(notifId, memberId) {
  try { await updateDoc(doc(db, C_NOTIF, notifId), { deletedBy: arrayUnion(memberId) }); }
  catch (e) { console.warn("deleteNotificationForMe:", e?.message); }
}

// 送出祝賀留言（具名或匿名）
export async function addCongrats(notifId, fromName, anon, text) {
  try {
    await updateDoc(doc(db, C_NOTIF, notifId), {
      congrats: arrayUnion({
        name: anon ? "" : (fromName || "某位射手"),
        anon: !!anon,
        text: text || "",
        at: Date.now(),
      }),
    });
  } catch (e) { console.warn("addCongrats:", e?.message); }
}

// ── 榮耀通知：第一次通過 / 成功晉級 才發 ─────────────────
// 給 approveCertResult 內部呼叫：傳入舊級別與新級別判斷
export async function maybeSendCertHonor({ memberId, bowType, bowLabel, year, half, score, prevLevel, newLevel, operatorId }) {
  console.log("【榮耀除錯】進入函式", { memberId, bowType, score, prevLevel, newLevel });
 
  const order = ["入門", "初級", "中級", "進階", "精英", "菁英"];
  const prevIdx = prevLevel ? order.indexOf(prevLevel) : -1;
  const newIdx = newLevel ? order.indexOf(newLevel) : -1;
  console.log("【榮耀除錯】級別 index", { prevLevel, prevIdx, newLevel, newIdx });
 
  if (newIdx < 0) { console.log("【榮耀除錯】❌ newIdx<0，沒達標，不發"); return; }
  const isFirst = prevIdx < 0;
  const isUpgrade = newIdx > prevIdx;
  console.log("【榮耀除錯】判斷", { isFirst, isUpgrade });
  if (!isFirst && !isUpgrade) { console.log("【榮耀除錯】❌ 沒進步，不發"); return; }
 
  let nickname = "", archerNo = "";
  try {
    const m = await getMember(memberId);
    nickname = m?.nickname || m?.name || "射手";
    archerNo = m?.archerNo || "";
    console.log("【榮耀除錯】拿到會員", { nickname, archerNo });
  } catch (e) {
    console.log("【榮耀除錯】❌ getMember 出錯", e?.message);
  }
 
  try {
    const id = await createNotification({
      type: "high_score",
      title: isFirst ? `🎯 ${nickname} 完成檢定！` : `🎉 ${nickname} 晉級了！`,
      content: isFirst
        ? `${nickname} 通過了 ${bowLabel || bowType} 檢定，達到 ${newLevel} 級（${score} 分）`
        : `${nickname} 在 ${bowLabel || bowType} 晉級到 ${newLevel} 級（${score} 分）！`,
      targetMemberId: null,
      subjectMemberId: memberId,
      subjectInfo: { nickname, archerNo, bowType, bowLabel, item: "年度檢定", score, level: newLevel },
    }, operatorId);
    console.log("【榮耀除錯】✅ 通知已寫入，id =", id);
  } catch (e) {
    console.log("【榮耀除錯】❌ createNotification 出錯", e?.message);
  }
}

// 給 reviewCertTask 內部呼叫：取得藍證/金證時發榮耀
export async function sendCertExamHonor({ memberId, tier, operatorId }) {
  let nickname = "", archerNo = "";
  try {
    const m = await getMember(memberId);
    nickname = m?.nickname || m?.name || "射手";
    archerNo = m?.archerNo || "";
  } catch {}
  const tierLabel = tier === "gold" ? "金證" : "藍證";
  await createNotification({
    type: "cert_pass",
    title: `🎖️ ${nickname} 取得${tierLabel}！`,
    content: `恭喜 ${nickname} 通過射手證畢業考，取得${tierLabel}！`,
    targetMemberId: null,
    subjectMemberId: memberId,
    subjectInfo: { nickname, archerNo, level: tierLabel, item: "射手證畢業考" },
  }, operatorId);
}

export function subscribePendingCertTasks(callback) {
  return onSnapshot(collection(db, "certifications"), snap => {
    const pending = [];
    snap.docs.forEach(d => {
      const data = d.data();
      ["blue", "gold"].forEach(tier => {
        ["task1", "task2"].forEach(task => {
          const t = data[tier]?.[task];
          if (t && t.reviewStatus === "pending") {
            pending.push({
              memberId: d.id, tier, task,
              bowType: data[tier]?.bowType,
              ...t,
            });
          }
        });
      });
    });
    callback(pending);
  }, err => { console.warn("subscribePendingCertTasks:", err.message); callback([]); });
}

// 後台直接覆寫射手證紀錄（最高權限：改等級、裝備、任務、鎖定）
export async function adminUpdateCertification(memberId, data, operatorId) {
  await setDoc(doc(db, "certifications", memberId), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: operatorId,
  }, { merge: true });
}
 
// 後台刪除整個射手證紀錄（重來）
export async function deleteCertification(memberId, operatorId) {
  try {
    await deleteDoc(doc(db, "certifications", memberId));
  } catch (e) { console.warn("deleteCertification:", e?.message); }
}
 
/* ════════════════════════════════════════════════════════════
   RPG 第一步：報到 + Buff + 今日任務
   把這整段「新增」到 db.js 最後面。
   ════════════════════════════════════════════════════════════ */

const C_QUEST_CONFIG = "dailyQuestConfig";
const C_CHECKIN = "checkins";

// 今日任務預設設定
export const DAILY_QUEST_DEFAULT = {
  targetType: "score",      // "score"=總分達標 / "hits"=幾中幾
  targetName: "標準靶紙",    // 靶紙類型
  arrowCount: 6,            // 箭數
  distance: 10,             // 距離(米)
  targetScore: 50,          // targetType=score 時的目標總分
  targetHits: 3,            // targetType=hits 時的目標中靶數
  rewardEvery: 10,          // 滿幾次換實體成就銀章
};

// ── 今日任務設定（後台讀/寫）──────────────────────────
export async function getDailyQuestConfig() {
  try {
    const snap = await getDoc(doc(db, C_QUEST_CONFIG, "default"));
    if (snap.exists()) return { ...DAILY_QUEST_DEFAULT, ...snap.data() };
  } catch (e) { console.warn("getDailyQuestConfig:", e?.message); }
  return DAILY_QUEST_DEFAULT;
}

export async function saveDailyQuestConfig(config, operatorId) {
  await setDoc(doc(db, C_QUEST_CONFIG, "default"),
    { ...config, updatedAt: serverTimestamp(), operatorId }, { merge: true });
}

// ── 報到 ───────────────────────────────────────────────
// 文件 ID = memberId_YYYY-MM-DD（一天一筆，天然防重複）
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function checkinId(memberId, date) {
  return `${memberId}_${date || todayStr()}`;
}

// 學生點報到 → 建立 pending 紀錄（已存在就不重建）
export async function submitCheckin(memberId, memberName, memberNickname) {
  const date = todayStr();
  const id = checkinId(memberId, date);
  const ref = doc(db, C_CHECKIN, id);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id, already: true, data: snap.data() };
  await setDoc(ref, {
    memberId, memberName: memberName || "", memberNickname: memberNickname || "",
    date,
    status: "pending",        // pending → approved
    buff: null,               // 核准後抽的 buff
    failCount: 0,             // 重抽次數
    questDone: false,         // 今日任務是否達標
    questResult: null,        // { type, value, target }
    finalConfirmed: false,    // 教練最終確認（計入次數）
    createdAt: serverTimestamp(),
  });
  return { id, already: false };
}

// 訂閱「我今天的報到」
export function subscribeMyCheckin(memberId, callback) {
  const id = checkinId(memberId);
  return onSnapshot(doc(db, C_CHECKIN, id),
    snap => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    err => { console.warn("subscribeMyCheckin:", err.message); callback(null); });
}

// 訂閱「今日所有待核准 / 待最終確認」報到（後台用）
export function subscribePendingCheckins(callback) {
  const date = todayStr();
  return onSnapshot(
    query(collection(db, C_CHECKIN), where("date", "==", date)),
    snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        // 待核准(pending) 或 已達標待最終確認(questDone && !finalConfirmed)
        .filter(c => c.status === "pending" || (c.questDone && !c.finalConfirmed));
      callback(list);
    },
    err => { console.warn("subscribePendingCheckins:", err.message); callback([]); }
  );
}

// 教練核准報到 → 寫入抽到的 buff（buff 由前端用 drawBuff 抽好傳進來）
export async function approveCheckin(checkinId, buff, operatorId) {
  await updateDoc(doc(db, C_CHECKIN, checkinId), {
    status: "approved",
    buff: buff || null,
    approvedAt: serverTimestamp(),
    approvedBy: operatorId,
  });
}

// 學生重抽 buff（失敗後）→ failCount +1，寫入新 buff
export async function rerollCheckinBuff(checkinId, newBuff, newFailCount) {
  await updateDoc(doc(db, C_CHECKIN, checkinId), {
    buff: newBuff || null,
    failCount: newFailCount,
  });
}

// 學生登記今日任務結果（達標）
export async function markQuestDone(checkinId, questResult) {
  await updateDoc(doc(db, C_CHECKIN, checkinId), {
    questDone: true,
    questResult: questResult || null,
    questDoneAt: serverTimestamp(),
  });
}

// 教練最終確認 → 計入會員 dailyQuestCount，標記 finalConfirmed
export async function confirmCheckinReward(checkinId, memberId, operatorId) {
  await updateDoc(doc(db, C_CHECKIN, checkinId), {
    finalConfirmed: true,
    confirmedAt: serverTimestamp(),
    confirmedBy: operatorId,
  });
  // 累積今日任務完成次數
  try {
    await updateDoc(doc(db, C.members, memberId), { dailyQuestCount: increment(1) });
  } catch (e) { console.warn("dailyQuestCount:", e?.message); }
}

// 取得會員今日任務累積次數
export async function getDailyQuestCount(memberId) {
  try {
    const m = await getMember(memberId);
    return m?.dailyQuestCount || 0;
  } catch { return 0; }
}

const C_DEX_GRANT = "dexGrants";      // 每個會員後台授予的成就
const C_DEX_CONFIG = "dexConfig";     // 屆數設定
 
// ── 屆數設定（後台可加）──
export async function getDexConfig() {
  try {
    const snap = await getDoc(doc(db, C_DEX_CONFIG, "rounds"));
    if (snap.exists()) return snap.data();
  } catch (e) { console.warn("getDexConfig:", e?.message); }
  return { physicalMax: 10, pointMax: 10 };   // 預設都到第10屆
}
 
export async function saveDexConfig(config, operatorId) {
  await setDoc(doc(db, C_DEX_CONFIG, "rounds"),
    { ...config, updatedAt: serverTimestamp(), operatorId }, { merge: true });
}
 
// ── 某會員的授予成就（B類）──
// 文件 ID = memberId，items 陣列
export async function getDexGrants(memberId) {
  try {
    const snap = await getDoc(doc(db, C_DEX_GRANT, memberId));
    if (snap.exists()) return snap.data().items || [];
  } catch (e) { console.warn("getDexGrants:", e?.message); }
  return [];
}
 
export function subscribeDexGrants(memberId, callback) {
  return onSnapshot(doc(db, C_DEX_GRANT, memberId),
    snap => callback(snap.exists() ? (snap.data().items || []) : []),
    err => { console.warn("subscribeDexGrants:", err.message); callback([]); });
}
 
// 授予屆數成就（實體賽/積分賽 第N屆 + 名次）
// type: "physical" | "point"；rank: 1/2/3/0(參加)
export async function grantRoundAchievement(memberId, type, round, rank, operatorId) {
  const items = await getDexGrants(memberId);
  // 同屆同類型只留一筆（更新名次）
  const filtered = items.filter(x => !(x.type === type && x.round === round));
  filtered.push({ type, round: Number(round), rank: Number(rank), grantedAt: Date.now() });
  await setDoc(doc(db, C_DEX_GRANT, memberId), { items: filtered, updatedAt: serverTimestamp(), operatorId }, { merge: true });
}
 
// 取消屆數成就
export async function revokeRoundAchievement(memberId, type, round, operatorId) {
  const items = await getDexGrants(memberId);
  const filtered = items.filter(x => !(x.type === type && x.round === round));
  await setDoc(doc(db, C_DEX_GRANT, memberId), { items: filtered, updatedAt: serverTimestamp(), operatorId }, { merge: true });
}
 
// 授予 / 取消 特殊成就（擊敗教練等）
export async function grantSpecialAchievement(memberId, specialId, operatorId) {
  const items = await getDexGrants(memberId);
  if (items.find(x => x.type === "special" && x.id === specialId)) return;
  items.push({ type: "special", id: specialId, grantedAt: Date.now() });
  await setDoc(doc(db, C_DEX_GRANT, memberId), { items, updatedAt: serverTimestamp(), operatorId }, { merge: true });
}
 
export async function revokeSpecialAchievement(memberId, specialId, operatorId) {
  const items = await getDexGrants(memberId);
  const filtered = items.filter(x => !(x.type === "special" && x.id === specialId));
  await setDoc(doc(db, C_DEX_GRANT, memberId), { items: filtered, updatedAt: serverTimestamp(), operatorId }, { merge: true });
}