// src/lib/db.js
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  setDoc, query, where, orderBy, limit, serverTimestamp, onSnapshot,
  increment, arrayUnion, arrayRemove, Timestamp, deleteField, writeBatch
} from "firebase/firestore";
import { db } from "./firebase";
import { MATERIALS } from "./monsterMaterials";
import { POTIONS, FRAGMENTS } from "./itemData";
import { EQUIP_GRADES } from "./constants";
import { EQUIP_UPGRADE_COST } from "./equipData";

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
  billingRecords:"billingRecords",
};
const C_GUILD      = "guildProgress";
const C_GUILD_Q    = "guildQuests";       // 後台發佈的任務
const C_GUILD_SUBS = "guildQuestSubs";    // 會員提交紀錄（待審核徽章）

// ─── Audit Log helper ──────────────────────────────────────
export async function writeAuditLog(action, targetId, targetType, before, after, operatorId) {
  await addDoc(collection(db, C.auditLogs), {
    action, targetId, targetType, before, after, operatorId,
    createdAt: serverTimestamp(),
  });
}

// ─── Members ───────────────────────────────────────────────
const sortByLastLogin = docs =>
  docs.sort((a, b) => (b.lastLoginAt?.toMillis?.() ?? 0) - (a.lastLoginAt?.toMillis?.() ?? 0));

export async function getMembers() {
  const snap = await getDocs(collection(db, C.members));
  return sortByLastLogin(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

export function subscribeMembers(callback) {
  return onSnapshot(
    collection(db, C.members),
    snap => callback(sortByLastLogin(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
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
const safeFields = ["name", "nickname", "username", "email", "phone", "archerNo", "archerNoDate", "joinDate", "note", "equipment", "armorSets", "accessorySets", "fatCat", "score", "achievement", "eventPoints", "shareSlogan", "rpgEquip"];
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

  // ── 冒險者 XP 計算（非同步，不阻塞）─────────────────────
  const logType = cleanedData.type || "practice";
  let xpGain = 0;
  if (logType === "monster" || logType === "world_boss") {
    xpGain = Math.round((cleanedData.dmg || 0) / 100);
  } else if (logType === "dungeon") {
    xpGain = Math.round((cleanedData.score || 0) / 8);
  } else {
    const total = cleanedData.score
      || (Array.isArray(cleanedData.rounds)
        ? cleanedData.rounds.flat().reduce((s, v) => s + (typeof v === "number" ? v : 0), 0)
        : 0);
    xpGain = Math.round(total / 10);
  }
  // ──────────────────────────────────────────────────────────

  if (Array.isArray(cleanedData.rounds)) { cleanedData.roundsString = JSON.stringify(cleanedData.rounds); delete cleanedData.rounds; }
  else { cleanedData.roundsString = JSON.stringify([]); }
  const ref = await addDoc(collection(db, C.practiceLogs), { memberId, ...cleanedData, createdAt: serverTimestamp(), operatorId: operatorId || memberId });

  if (xpGain > 0) addAdventurerXP(memberId, xpGain).catch(() => {});

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
  try {
    await updateDoc(doc(db, C.competitions, compId), { participants: arrayUnion(memberId) });
  } catch {}
  return ref.id;
}

export async function getRegistrations(compId) {
  const snap = await getDocs(query(collection(db, C.registrations), where("compId", "==", compId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function isMemberRegistered(compId, memberId) {
  const snap = await getDocs(query(collection(db, C.registrations), where("compId", "==", compId), where("memberId", "==", memberId)));
  return !snap.empty;
}

export async function addLearnLog(memberId, data) {
  const ref = await addDoc(collection(db, C.learnLogs), { memberId, ...data, createdAt: serverTimestamp() });
  if (data.coachAdded) {
    updateDoc(doc(db, C.members, memberId), { hasNewLearnLog: true }).catch(() => {});
  }
  return ref.id;
}

export async function updateLearnLog(id, data, operatorId) {
  const before = (await getDoc(doc(db, C.learnLogs, id))).data();
  await updateDoc(doc(db, C.learnLogs, id), { ...data, updatedAt: serverTimestamp() });
  await writeAuditLog("UPDATE", id, "learnLog", before, data, operatorId);
  if (data.coachNote != null && before?.memberId) {
    updateDoc(doc(db, C.members, before.memberId), { hasNewLearnLog: true }).catch(() => {});
  }
}

export async function markLearnLogsRead(memberId) {
  updateDoc(doc(db, C.members, memberId), { hasNewLearnLog: false }).catch(() => {});
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

export function subscribeCertRecords(memberId, callback) {
  return onSnapshot(
    query(collection(db, C.certRecords), where("memberId", "==", memberId)),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.warn("subscribeCertRecords:", err.message); callback([]); }
  );
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
  const snap = await getDoc(doc(db, C.messages, id));
  const memberId = snap.data()?.memberId;
  await updateDoc(doc(db, C.messages, id), { reply, repliedAt: serverTimestamp(), replyBy: operatorId, memberRead: false });
  if (memberId) {
    updateDoc(doc(db, C.members, memberId), { hasUnreadReply: true }).catch(() => {});
  }
}

export async function markMessagesRead(memberId) {
  const snap = await getDocs(query(collection(db, C.messages), where("memberId", "==", memberId), where("memberRead", "==", false)));
  for (const d of snap.docs) { await updateDoc(d.ref, { memberRead: true }); }
  updateDoc(doc(db, C.members, memberId), { hasUnreadReply: false }).catch(() => {});
}

export function subscribeMessages(memberId, callback) {
  return onSnapshot(query(collection(db, C.messages), where("memberId", "==", memberId), orderBy("createdAt", "desc")), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function subscribeAllMessages(callback) {
  return onSnapshot(query(collection(db, C.messages), orderBy("createdAt", "desc"), limit(150)), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
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
// 需要 Firestore 複合索引：notifications → targetMemberId ASC + createdAt DESC
export function subscribeNotifications(memberId, callback, memberCreatedAt) {
  const joinedMs = memberCreatedAt
    ? (memberCreatedAt?.toMillis?.() ?? memberCreatedAt?.seconds * 1000 ?? Number(memberCreatedAt))
    : 0;

  function process(snap) {
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  }

  // 優先用 WHERE 條件過濾（Firestore 層面減少讀取）
  // 若複合索引尚未建立則自動降級為舊方式
  let unsub = onSnapshot(
    query(collection(db, C_NOTIF), where("targetMemberId", "in", [memberId, null]), orderBy("createdAt", "desc"), limit(20)),
    process,
    () => {
      unsub = onSnapshot(
        query(collection(db, C_NOTIF), orderBy("createdAt", "desc"), limit(20)),
        process,
        () => callback([])
      );
    }
  );
  return () => { unsub?.(); };
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
  arrowCount: 6,
  rewardEvery: 10,
  distanceMin: 1,
  distanceMax: 15,
  scoreMin: 1,
  scoreMax: 100,
  hitsMin: 1,
  hitsMax: 6,
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

// 純報到：直接計入 +1 次，不需教練核准，不做任務
export async function submitSimpleCheckin(memberId, memberName, memberNickname) {
  const date = todayStr();
  const id = checkinId(memberId, date);
  const ref = doc(db, C_CHECKIN, id);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id, already: true };
  await setDoc(ref, {
    memberId, memberName: memberName || "", memberNickname: memberNickname || "",
    date, type: "simple", status: "done", finalConfirmed: true,
    createdAt: serverTimestamp(),
  });
  try {
    const member = await getMember(memberId);
    const newCount = (member?.dailyQuestCount || 0) + 1;
    await updateDoc(doc(db, C.members, memberId), { dailyQuestCount: increment(1), eventPoints: increment(1) });
    const config = await getDailyQuestConfig();
    const rewardEvery = config?.rewardEvery || 10;
    if (newCount % rewardEvery === 0) {
      await addBadge(memberId, "achievement", "silver", 1, memberId, `每日任務累積 ${newCount} 次`);
    }
  } catch (e) { console.warn("simpleCheckin:", e?.message); }
  return { id, already: false };
}

// 學生點報到 → 建立 active 紀錄（已存在就不重建）
export async function submitCheckin(memberId, memberName, memberNickname) {
  const date = todayStr();
  const id = checkinId(memberId, date);
  const ref = doc(db, C_CHECKIN, id);
  const snap = await getDoc(ref);
  // 已報到且不是 cancelled，不重複建立
  if (snap.exists() && snap.data().status !== "cancelled") return { id, already: true, data: snap.data() };
  // 全新報到或重新啟動 cancelled 的 doc
  await setDoc(ref, {
    memberId, memberName: memberName || "", memberNickname: memberNickname || "",
    date,
    status: "active",
    buff: null,
    failCount: 0,
    questDone: false,
    questResult: null,
    finalConfirmed: false,
    createdAt: serverTimestamp(),
  }, { merge: false });
  return { id, already: false };
}

// 訂閱「我今天的報到」
export function subscribeMyCheckin(memberId, callback) {
  const id = checkinId(memberId);
  return onSnapshot(doc(db, C_CHECKIN, id),
    snap => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    err => { console.warn("subscribeMyCheckin:", err.message); callback(null); });
}

// 取得今日所有報到會員（記帳用）
export async function getTodayCheckinMembers() {
  try {
    const snap = await getDocs(query(collection(db, C_CHECKIN), where("date", "==", todayStr())));
    return snap.docs.map(d => ({ memberId: d.data().memberId, memberName: d.data().memberName || "" }));
  } catch { return []; }
}

// 訂閱「今日所有報到」（含已完成），後台自行分類
export function subscribePendingCheckins(callback) {
  const date = todayStr();
  return onSnapshot(
    query(collection(db, C_CHECKIN), where("date", "==", date)),
    snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(c => (c.status === "active" || c.type === "simple") && c.status !== "cancelled");
      callback(list);
    },
    err => { console.warn("subscribePendingCheckins:", err.message); callback([]); }
  );
}

// 教練施法 → 隨機 10-50% 降幅 buff
export async function castBuff(checkinId, operatorId) {
  const pct = Math.floor(Math.random() * 41) + 10; // 10-50
  const buff = { name: `魔法加持 ${pct}%`, icon: "✨", actualPower: pct, type: "cast" };
  await updateDoc(doc(db, C_CHECKIN, checkinId), {
    buff,
    buffAt: serverTimestamp(),
    buffBy: operatorId,
  });
  return buff;
}

// 學生重抽 buff（失敗後）→ failCount +1，寫入新 buff
export async function rerollCheckinBuff(checkinId, newBuff, newFailCount) {
  await updateDoc(doc(db, C_CHECKIN, checkinId), {
    buff: newBuff || null,
    failCount: newFailCount,
  });
}

// 學生登記今日任務結果（達標）→ 自動計入次數 + 給寶箱
export async function markQuestDone(checkinId, questResult, memberId = null, chestType = null) {
  await updateDoc(doc(db, C_CHECKIN, checkinId), {
    questDone: true,
    questResult: questResult || null,
    questDoneAt: serverTimestamp(),
    finalConfirmed: true,
  });
  if (memberId) {
    try {
      const member = await getMember(memberId);
      const newCount = (member?.dailyQuestCount || 0) + 1;
      await updateDoc(doc(db, C.members, memberId), { dailyQuestCount: increment(1), eventPoints: increment(1) });
      const config = await getDailyQuestConfig();
      const rewardEvery = config?.rewardEvery || 10;
      if (newCount % rewardEvery === 0) {
        await addBadge(memberId, "achievement", "silver", 1, memberId, `每日任務累積 ${newCount} 次`);
      }
      if (chestType) {
        const tierMap = { wood: "common", iron: "rare", gold: "elite" };
        await addChests(memberId, [{
          id: `quest_${checkinId}_${Date.now()}`,
          type: chestType, family: "quest", tier: tierMap[chestType] || "common",
          from: "每日任務獎勵", ts: Date.now(),
        }]);
      }
    } catch (e) { console.warn("markQuestDone:", e?.message); }
  }
}

// 教練最終確認（舊流程相容，新流程已不需要）
export async function confirmCheckinReward(checkinId, memberId, operatorId, chestType = "iron") {
  await markQuestDone(checkinId, null, memberId, chestType);
}

// 取得會員今日任務累積次數
export async function getDailyQuestCount(memberId) {
  try {
    const m = await getMember(memberId);
    return m?.dailyQuestCount || 0;
  } catch { return 0; }
}

/* ════════════════════════════════════════════════════════════
   冒險者公會系統
   ════════════════════════════════════════════════════════════ */

// 增加冒險者 XP（fire-and-forget 安全，失敗不影響主流程）
export async function addAdventurerXP(memberId, xp) {
  if (!memberId || !xp || xp <= 0) return;
  try {
    await updateDoc(doc(db, C.members, memberId), { adventurerXP: increment(xp) });
  } catch (e) { console.warn("addAdventurerXP:", e?.message); }
}

// 訂閱今日公會任務進度
export function subscribeAdventurerProgress(memberId, cb) {
  const date = todayStr();
  return onSnapshot(doc(db, C_GUILD, memberId), snap => {
    if (!snap.exists()) { cb({ date, completed: [], submittedQuests: [] }); return; }
    const d = snap.data();
    // completed 每日重置；submittedQuests 永久記錄不受換日影響
    const completed = d.date === date ? (d.completed || []) : [];
    cb({ ...d, date, completed, submittedQuests: d.submittedQuests || [], acceptedQuests: d.acceptedQuests || [] });
  }, err => { console.warn("subscribeAdventurerProgress:", err.message); cb({ date, completed: [], submittedQuests: [] }); });
}

// 完成公會任務 → 記錄 + 給 XP + 給金幣
export async function completeGuildTask(memberId, taskId, xp, coins, bonus = null) {
  const date = todayStr();
  const ref = doc(db, C_GUILD, memberId);
  const snap = await getDoc(ref);
  const d = snap.exists() ? snap.data() : {};
  const prevCompleted = d.date === date ? (d.completed || []) : [];
  if (prevCompleted.includes(taskId)) return { ok: true, already: true };
  await setDoc(ref, { date, completed: [...prevCompleted, taskId], updatedAt: serverTimestamp() });
  if (xp > 0) addAdventurerXP(memberId, xp).catch(() => {});
  if (coins > 0) addCoins(memberId, coins).catch(() => {});
  if (bonus?.type === "coins")  addCoins(memberId, bonus.amount).catch(() => {});
  if (bonus?.type === "chest")  addChests(memberId, [{
    id: `chest_guild_${taskId}_${Date.now()}`,
    type: bonus.chestType, from: "公會任務", ts: Date.now(),
  }]).catch(() => {});
  return { ok: true, bonus };
}

// 完成晉階任務 → 記錄 promotionDone + 給 bonusXP
export async function completePromotionQuest(memberId, promotionLevel, bonusXP) {
  if (!memberId) return;
  await updateDoc(doc(db, C.members, memberId), {
    adventurerXP:  increment(bonusXP),
    promotionDone: arrayUnion(promotionLevel),
  });
}

// ── 公會懸賞任務（後台發佈）─────────────────────────────────

// 訂閱目前 active 的任務（前台）
export function subscribeActiveGuildQuests(cb) {
  // orderBy 需要複合索引，改為前端排序避免 Firestore 靜默回傳空陣列
  const q = query(collection(db, C_GUILD_Q), where("status", "==", "active"));
  return onSnapshot(
    q,
    snap => cb(
      snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.publishedAt?.seconds || 0) - (a.publishedAt?.seconds || 0))
    ),
    err => { console.warn("subscribeActiveGuildQuests:", err.message); cb([]); }
  );
}

// 後台：取得所有任務（含草稿/過期）
export function subscribeAllGuildQuests(cb) {
  const q = query(collection(db, C_GUILD_Q), orderBy("publishedAt", "desc"));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => cb([]));
}

// 後台：發佈新任務
export async function publishGuildQuest(data, adminId) {
  const ref = doc(collection(db, C_GUILD_Q));
  await setDoc(ref, {
    title: data.title || "",
    desc:  data.desc  || "",
    type:  data.type  || "normal",
    badgeReward:      data.badgeReward      || null,
    badgeRequires:    data.badgeRequires    || null,
    prerequisiteQuestId: data.prerequisiteQuestId || null,
    reward: { xp: data.reward?.xp || 0, coins: data.reward?.coins || 0 },
    questSubtype:  data.questSubtype  || "general",
    requirement:   data.requirement   || {},
    status: data.status || "active",
    publishedAt: serverTimestamp(),
    createdBy: adminId,
  });
  // 特殊任務 → 廣播通知給所有會員
  if (data.type === "special") {
    await createNotification({
      type:    "promo",
      title:   `⚔️ 緊急懸賞：${data.title}`,
      content: data.desc,
      mustRead: false,
    }, adminId).catch(() => {});
  }
  return ref.id;
}

// 後台：更新任務狀態（上架/下架/草稿）
export async function updateGuildQuestStatus(questId, status) {
  await updateDoc(doc(db, C_GUILD_Q, questId), { status, updatedAt: serverTimestamp() });
}

// 後台：刪除任務
export async function deleteGuildQuest(questId) {
  await deleteDoc(doc(db, C_GUILD_Q, questId));
}

// 前台：接受任務（標記進行中，尚未完成）
export async function acceptGuildQuest(memberId, questId) {
  if (!memberId || !questId) return;
  await updateDoc(doc(db, C_GUILD, memberId), {
    acceptedQuests: arrayUnion(questId),
  }).catch(() =>
    setDoc(doc(db, C_GUILD, memberId), { acceptedQuests: [questId] }, { merge: true })
  );
}

// 前台：會員提交完成（XP/金幣立即發放；徽章待審核）
export async function submitGuildQuestCompletion(memberId, memberName, quest, note) {
  if (!memberId || !quest?.id) return;
  // 防重複：先記錄在 guildProgress
  await updateDoc(doc(db, C_GUILD, memberId), {
    submittedQuests: arrayUnion(quest.id),
  }).catch(() =>
    setDoc(doc(db, C_GUILD, memberId), { submittedQuests: [quest.id] }, { merge: true })
  );
  // 立即發放 XP + 金幣
  if ((quest.reward?.xp || 0) > 0)    addAdventurerXP(memberId, quest.reward.xp).catch(() => {});
  if ((quest.reward?.coins || 0) > 0)  addCoins(memberId, quest.reward.coins).catch(() => {});
  // 徽章任務 → 建立待審記錄；非徽章任務 → 直接記錄完成
  if (quest.badgeReward) {
    await addDoc(collection(db, C_GUILD_SUBS), {
      questId:    quest.id,
      questTitle: quest.title,
      memberId, memberName,
      badgeReward: quest.badgeReward,
      note: note || "",
      status: "pending",
      submittedAt: serverTimestamp(),
    });
  } else {
    // 非徽章任務直接 confirmed，解鎖後續串聯任務
    await updateDoc(doc(db, C.members, memberId), {
      [`completedGuildQuestsMap.${quest.id}`]: {
        questTitle: quest.title, badgeReward: null,
        status: "confirmed", completedAt: serverTimestamp(),
      },
    }).catch(() => setDoc(doc(db, C.members, memberId), {
      completedGuildQuestsMap: {
        [quest.id]: { questTitle: quest.title, badgeReward: null, status: "confirmed", completedAt: serverTimestamp() },
      },
    }, { merge: true }));
  }
}

// 後台：訂閱待審核的徽章任務提交
export function subscribeGuildSubmissions(cb) {
  // 不用 orderBy 避免需要複合索引；client 端依 submittedAt 排序
  const q = query(collection(db, C_GUILD_SUBS), where("status", "==", "pending"));
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
    cb(list);
  }, (err) => { console.error("[guild] subscribeGuildSubmissions error:", err.code, err.message); cb([]); });
}

// 後台：核准 → 直接發徽章 + 記錄 confirmed
export async function approveGuildSubmission(subId, sub, adminId) {
  const color = sub.badgeReward;
  if (color && sub.memberId) {
    await updateDoc(doc(db, C.members, sub.memberId), {
      [`achievement.${color}`]: increment(1),
      [`completedGuildQuestsMap.${sub.questId}`]: {
        questTitle: sub.questTitle, badgeReward: color,
        status: "confirmed", completedAt: serverTimestamp(),
      },
    });
  }
  await updateDoc(doc(db, C_GUILD_SUBS, subId), {
    status: "approved", approvedAt: serverTimestamp(), approvedBy: adminId,
  });
  // 發通知給射手
  if (sub.memberId) {
    await createNotification({
      type: "guild_badge_approved",
      title: `🎖️ 徽章審核通過！`,
      content: `「${sub.questTitle}」已通過，${sub.badgeReward === "silver" ? "🥈 銀章" : sub.badgeReward === "gold" ? "🥇 金章" : "⬛ 黑章"}正式發放！`,
      mustRead: false,
      targetMemberId: sub.memberId,
    }, adminId).catch(() => {});
  }
}

// 後台：拒絕 + 記錄 rejected
export async function rejectGuildSubmission(subId, sub, reason, adminId) {
  await updateDoc(doc(db, C_GUILD_SUBS, subId), {
    status: "rejected", rejectedAt: serverTimestamp(), rejectedBy: adminId,
    rejectReason: reason || "",
  });
  if (sub?.memberId && sub?.questId) {
    await updateDoc(doc(db, C.members, sub.memberId), {
      [`completedGuildQuestsMap.${sub.questId}.status`]: "rejected",
      [`completedGuildQuestsMap.${sub.questId}.rejectReason`]: reason || "",
    }).catch(() => {});
    await createNotification({
      type: "guild_badge_rejected",
      title: `❌ 徽章申請未通過`,
      content: `「${sub.questTitle}」審核未通過${reason ? `：${reason}` : ""}。可重新送審或重新挑戰。`,
      mustRead: false,
      targetMemberId: sub.memberId,
    }, adminId).catch(() => {});
  }
}

// 前台：直接挑戰下一階段（provisional 解鎖）
export async function provisionalUnlockQuest(memberId, questId, questTitle, badgeReward) {
  await updateDoc(doc(db, C.members, memberId), {
    [`completedGuildQuestsMap.${questId}`]: {
      questTitle, badgeReward: badgeReward || null,
      status: "provisional", completedAt: serverTimestamp(),
    },
  }).catch(() => setDoc(doc(db, C.members, memberId), {
    completedGuildQuestsMap: {
      [questId]: { questTitle, badgeReward: badgeReward || null, status: "provisional", completedAt: serverTimestamp() },
    },
  }, { merge: true }));
}

// 前台：重新送審（不重發 XP，只建新審核記錄）
export async function resubmitGuildBadge(memberId, memberName, questId, questTitle, badgeReward) {
  await addDoc(collection(db, C_GUILD_SUBS), {
    questId, questTitle, memberId, memberName,
    badgeReward, note: "重新送審",
    status: "pending", submittedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, C.members, memberId), {
    [`completedGuildQuestsMap.${questId}.status`]: "provisional",
    [`completedGuildQuestsMap.${questId}.rejectReason`]: deleteField(),
  }).catch(() => {});
}

// 前台：重新挑戰（清除記錄，允許重打）
export async function retryGuildQuest(memberId, questId) {
  await updateDoc(doc(db, C_GUILD, memberId), {
    submittedQuests: arrayRemove(questId),
  }).catch(() => {});
  await updateDoc(doc(db, C.members, memberId), {
    [`completedGuildQuestsMap.${questId}`]: deleteField(),
  }).catch(() => {});
}

// 診斷：取得 guildQuestSubs 全部文件（不過濾）
export async function debugGetAllGuildSubs() {
  const snap = await getDocs(collection(db, C_GUILD_SUBS));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── 教練挑戰賽 ─────────────────────────────────────────────
const C_COACH_CHALLENGES = "coachChallenges";

// 前台：射手申請與教練決鬥
export async function submitCoachChallenge(memberId, memberName, quest) {
  if (!memberId || !quest?.id) return;
  // 立即鎖定防重複申請
  await updateDoc(doc(db, C_GUILD, memberId), {
    submittedQuests: arrayUnion(quest.id),
  }).catch(() =>
    setDoc(doc(db, C_GUILD, memberId), { submittedQuests: [quest.id] }, { merge: true })
  );
  await addDoc(collection(db, C_COACH_CHALLENGES), {
    questId: quest.id, questTitle: quest.title,
    memberId, memberName,
    status: "pending",
    createdAt: serverTimestamp(),
    reward: quest.reward || {},
  });
}

// 後台：訂閱所有挑戰申請
export function subscribeCoachChallenges(cb) {
  return onSnapshot(
    query(collection(db, C_COACH_CHALLENGES), where("status", "==", "pending"), orderBy("createdAt", "desc")),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    () => cb([])
  );
}

// 後台：確認挑戰結果（won=true → 完成任務 + 獎勵；false → 失敗）
export async function resolveCoachChallenge(challengeId, won, adminId, challenge) {
  if (won) {
    const q = { id: challenge.questId, title: challenge.questTitle, reward: challenge.reward || {}, badgeReward: null };
    await submitGuildQuestCompletion(challenge.memberId, challenge.memberName, q, "教練決鬥勝出");
  }
  await updateDoc(doc(db, C_COACH_CHALLENGES, challengeId), {
    status: won ? "completed" : "failed",
    resolvedAt: serverTimestamp(),
    resolvedBy: adminId,
  });
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

// ═══════════════════════════════════════════════════════════
 
export async function deleteCheckin(checkinId) {
  await deleteDoc(doc(db, C_CHECKIN, checkinId));
}

export async function cancelCheckin(checkinId) {
  // 學生只能 update（rules: delete 限 admin），改用軟刪除
  try {
    await updateDoc(doc(db, C_CHECKIN, checkinId), { status: "cancelled", cancelledAt: serverTimestamp() });
  } catch {
    // 若 update 也失敗（例如 doc 不存在），嘗試 deleteDoc（admin 呼叫）
    try { await deleteDoc(doc(db, C_CHECKIN, checkinId)); }
    catch (e2) { console.warn("cancelCheckin:", e2?.message); }
  }
}
 
// ─── 打怪模式 ──────────────────────────────────────────────
 
const C_MONSTER_CONFIG  = "monsterConfig";
const C_MONSTER_SESSION = "monsterSessions";
const C_MONSTER_LOGS    = "monsterLogs";
const C_MONSTER_DEX     = "monsterDex";
const C_CRAFT_STATS     = "craftStats";
export function subscribeMonsterEventConfig(callback) {
  return onSnapshot(doc(db, C_MONSTER_CONFIG, "event"), snap => {
    callback(snap.exists() ? snap.data() : { active: false });
  });
}
export async function setMonsterEventConfig(cfg, operatorId) {
  try {
    await setDoc(doc(db, C_MONSTER_CONFIG, "event"), {
      ...cfg, updatedAt: serverTimestamp(), updatedBy: operatorId,
    }, { merge: true });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}
 
// 賽事模式設定
export async function getMonsterEventConfig() {
  try {
    const snap = await getDoc(doc(db, C_MONSTER_CONFIG, "event"));
    if (snap.exists()) return snap.data();
  } catch {}
  return { active: false };
}

export async function saveMonsterEventConfig(config, operatorId) {
  await setDoc(doc(db, C_MONSTER_CONFIG, "event"),
    { ...config, updatedAt: serverTimestamp(), operatorId }, { merge: true });
}

// 每日上限設定
export async function getMonsterDailyConfig() {
  try {
    const snap = await getDoc(doc(db, C_MONSTER_CONFIG, "default"));
    if (snap.exists()) return snap.data();
  } catch {}
  return { dailyMax: 5 };
}
 
export async function saveMonsterDailyConfig(config, operatorId) {
  await setDoc(doc(db, C_MONSTER_CONFIG, "default"),
    { ...config, updatedAt: serverTimestamp(), operatorId }, { merge: true });
}
 
// 日期字串（打怪用，避免與 todayStr 衝突）
function monsterTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
 
// 檢查今日剩餘次數
export async function checkMonsterDailyLimit(memberId, dailyMax) {
  try {
    const id = `${memberId}_${monsterTodayStr()}`;
    const snap = await getDoc(doc(db, C_MONSTER_SESSION, id));
    const used = snap.exists() ? (snap.data().count || 0) : 0;
    return Math.max(0, (dailyMax || 5) - used);
  } catch { return dailyMax || 5; }
}
 
// 記錄一次打怪
export async function recordMonsterSession(memberId) {
  try {
    const id = `${memberId}_${monsterTodayStr()}`;
    const ref = doc(db, C_MONSTER_SESSION, id);
    const snap = await getDoc(ref);
    const count = snap.exists() ? (snap.data().count || 0) + 1 : 1;
    await setDoc(ref, { memberId, count, date: monsterTodayStr(), updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) { console.warn("recordMonsterSession:", e?.message); }
}
 
// 取得戰鬥記錄
export async function getMonsterLogs(memberId, maxCount = 20) {
  try {
    const snap = await getDocs(query(
  collection(db, C_MONSTER_LOGS),
  where("memberId", "==", memberId),
  limit(50)
));
    return snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  .slice(0, maxCount);
  } catch { return []; }
}
 
// ─── 重置打怪每日次數（後台用）────────────────────────────
export async function resetMonsterSession(memberId) {
  try {
    const id = `${memberId}_${monsterTodayStr()}`;
    await deleteDoc(doc(db, C_MONSTER_SESSION, id));
  } catch (e) { console.warn("resetMonsterSession:", e?.message); }
}
 
// 組隊打怪每日上限（同一份文件存 partyCount 欄位，max = 5）
export async function checkPartyBattleLimit(memberId) {
  try {
    const id   = `${memberId}_${monsterTodayStr()}`;
    const snap = await getDoc(doc(db, C_MONSTER_SESSION, id));
    const used = snap.exists() ? (snap.data().partyCount || 0) : 0;
    return Math.max(0, 5 - used);
  } catch { return 5; }
}
export async function recordPartyBattleSession(memberId) {
  try {
    const id  = `${memberId}_${monsterTodayStr()}`;
    const ref = doc(db, C_MONSTER_SESSION, id);
    await updateDoc(ref, { partyCount: increment(1), updatedAt: serverTimestamp() })
      .catch(() => setDoc(ref, { memberId, partyCount: 1, date: monsterTodayStr(), updatedAt: serverTimestamp() }, { merge: true }));
  } catch (e) { console.warn("recordPartyBattleSession:", e?.message); }
}

// ─── 訪客帳號管理 ──────────────────────────────────────────
const C_GUESTS = "guestSessions";
 
export async function createGuestSession() {
  const now = Date.now();
  const expiresAt = now + 3 * 60 * 60 * 1000; // 3小時
  const ref = await addDoc(collection(db, C_GUESTS), {
    createdAt: serverTimestamp(),
    expiresAt,
    monsterLogs: [],
  });
  return { id: ref.id, expiresAt };
}
 
export async function getGuestSession(guestId) {
  try {
    const snap = await getDoc(doc(db, C_GUESTS, guestId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (Date.now() > data.expiresAt) {
      await deleteDoc(doc(db, C_GUESTS, guestId));
      return null;
    }
    return { id: snap.id, ...data };
  } catch { return null; }
}
 
export async function deleteGuestSession(guestId) {
  try { await deleteDoc(doc(db, C_GUESTS, guestId)); } catch {}
}
 
// 後台產生訪客連結（存 token → guestId 對應）
export async function generateGuestToken() {
  const session = await createGuestSession();
  const token = btoa(session.id).replace(/=/g,'');
  return { token, guestId: session.id, expiresAt: session.expiresAt };
}
 

// ─── 材料庫存 ──────────────────────────────────────────────
// 集合：materialInventory / 文件 ID = memberId
// 結構：{ items: { materialId: count, ... }, updatedAt }
 
const C_MATERIALS = "materialInventory";
 
// 批次新增材料到玩家庫存（mats = [{ id, name, ... }, ...]）
export async function addMaterials(memberId, mats) {
  if (!memberId || !mats?.length) return;
  try {
    const ref  = doc(db, C_MATERIALS, memberId);
    const snap = await getDoc(ref);
    const inventory = snap.exists() ? (snap.data().items || {}) : {};
    mats.forEach(mat => {
      inventory[mat.id] = (inventory[mat.id] || 0) + 1;
    });
    await setDoc(ref, { items: inventory, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) { console.warn("addMaterials:", e?.message); }
}
 
// 訂閱玩家材料庫存（即時）
export function subscribeMaterials(memberId, callback) {
  return onSnapshot(
    doc(db, C_MATERIALS, memberId),
    snap => callback(snap.exists() ? (snap.data().items || {}) : {}),
    err  => { console.warn("subscribeMaterials:", err.message); callback({}); }
  );
}
 
// 即時訂閱打怪紀錄
export function subscribeMonsterLogs(memberId, callback, maxCount = 100) {
  return onSnapshot(
    query(collection(db, C_MONSTER_LOGS), where("memberId", "==", memberId), limit(maxCount)),
    snap => {
      const logs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(logs);
    },
    err => { console.warn("subscribeMonsterLogs:", err.message); callback([]); }
  );
}

export async function saveMonsterLog(memberId, data) {
  try {
    await addDoc(collection(db, C_MONSTER_LOGS), {
      memberId,
      monsterName: data.monsterName || "",
      monsterId:   data.monsterId   || "",
      result:      data.result      || "lose",
      rounds:      data.rounds      || 0,
      lootName:    data.lootName    || null,
      lootIcon:    data.lootIcon    || null,
      lootType:    data.lootType    || null,
      mode:        data.mode        || "novice",
      battleMode:  data.battleMode  || "score",
      materials:   data.materials   || [],
      chestType:   data.chestType   || null,
      roundScores: data.roundScores || [],
      distance:    data.distance    || null,
      createdAt:   serverTimestamp(),
    });
    if (memberId && data.monsterId && !memberId.startsWith("guest")) {
      const totalScore = data.score || (data.roundScores || []).reduce((s, r) => s + (r.total || 0), 0);
      await updateMonsterDex(memberId, data.monsterId, data.result, totalScore, data.dmgDealt).catch(() => {});
    }
  } catch (e) { console.warn("saveMonsterLog:", e?.message); }
} 
// ─── 材料升級 ──────────────────────────────────────────────
// 5 個低階材料 → 1 個高階材料（升級鏈定義在 monsterMaterials.js）
// 回傳 { ok:true, from, to } 或 { ok:false, reason }
export async function upgradeMaterial(memberId, materialId) {
  if (!memberId || !materialId) return { ok: false, reason: "參數錯誤" };

  const mat = MATERIALS.find(m => m.id === materialId);
  if (!mat) return { ok: false, reason: "找不到這個材料" };
  if (!mat.upgradesTo || !mat.upgradeCount) return { ok: false, reason: "這個材料已是最高階，無法再升級" };

  const target = MATERIALS.find(m => m.id === mat.upgradesTo);
  if (!target) return { ok: false, reason: "找不到升級目標材料" };

  try {
    const ref  = doc(db, C_MATERIALS, memberId);
    const snap = await getDoc(ref);
    const inventory = snap.exists() ? (snap.data().items || {}) : {};
    const have = inventory[materialId] || 0;

    if (have < mat.upgradeCount) {
      return { ok: false, reason: `需要 ${mat.upgradeCount} 個「${mat.name}」，目前只有 ${have} 個` };
    }

    inventory[materialId]    = have - mat.upgradeCount;
    inventory[mat.upgradesTo] = (inventory[mat.upgradesTo] || 0) + 1;

    await setDoc(ref, { items: inventory, updatedAt: serverTimestamp() }, { merge: true });
    return { ok: true, from: mat, to: target };
  } catch (e) {
    console.warn("upgradeMaterial:", e?.message);
    return { ok: false, reason: "系統忙碌中，請稍後再試" };
  }
}
 
// ─── 寶箱庫存 ──────────────────────────────────────────────
// 集合：chestInventory / 文件 ID = memberId
// 結構：{ chests: [{ id, type, family, tier, from, ts }], updatedAt }
 
const C_CHESTS = "chestInventory";
 
// 新增寶箱（打贏怪物時呼叫，chests = [chest, ...]）
export async function addChests(memberId, chests) {
  if (!memberId || !chests?.length) return;
  try {
    const ref  = doc(db, C_CHESTS, memberId);
    const snap = await getDoc(ref);
    const list = snap.exists() ? (snap.data().chests || []) : [];
    await setDoc(ref, { chests: [...list, ...chests], updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) { console.warn("addChests:", e?.message); }
}
 
// 訂閱寶箱庫存（即時）
export function subscribeChests(memberId, callback) {
  return onSnapshot(
    doc(db, C_CHESTS, memberId),
    snap => callback(snap.exists() ? (snap.data().chests || []) : []),
    err  => { console.warn("subscribeChests:", err.message); callback([]); }
  );
}
 
// 開箱：移除寶箱 + 把抽出的內容寫進材料/藥劑/碎片庫存
// contents = { materials:[材料物件], potions:[藥劑物件], fragments:[碎片物件] }
export async function openChest(memberId, chestId, contents) {
  if (!memberId || !chestId) return { ok: false, reason: "參數錯誤" };
  try {
    const ref  = doc(db, C_CHESTS, memberId);
    const snap = await getDoc(ref);
    const list = snap.exists() ? (snap.data().chests || []) : [];
    const chest = list.find(c => c.id === chestId);
    if (!chest) return { ok: false, reason: "找不到這個寶箱（可能已開過）" };
    await setDoc(ref, { chests: list.filter(c => c.id !== chestId), updatedAt: serverTimestamp() }, { merge: true });

    if (chest.type === "coin") {
      const min   = chest.min || 20;
      const max   = chest.max || 50;
      const coins = min + Math.floor(Math.random() * (max - min + 1));
      await addCoins(memberId, coins);
      await updateChestOpenStats(memberId, "coin");
      return { ok: true, coins };
    }

    // 咪咪箱：直接開貓（在 member 自己的 session 執行，Firestore 規則不擋）
    if (contents?.isMimiBox) {
      const { openCatBox } = await import("./catDb").catch(() => ({}));
      const catRes = openCatBox ? await openCatBox(memberId, { bondOnDuplicate: 50 }) : { ok: false };
      if (chest.type) await updateChestOpenStats(memberId, chest.type);
      return { ok: true, catResult: catRes };
    }

    if (contents?.materials?.length)  await addMaterials(memberId, contents.materials);
    if (contents?.potions?.length)    await addPotions(memberId, contents.potions.map(p => ({ id: p.id, count: 1 })));
    if (contents?.fragments?.length)  await addFragments(memberId, contents.fragments);
    if (contents?.cards?.length) {
      for (const card of contents.cards) {
        await addMonsterCard(memberId, card, null);
      }
    }

    if (chest.type) await updateChestOpenStats(memberId, chest.type);
    return { ok: true };
  } catch (e) {
    console.warn("openChest:", e?.message);
    return { ok: false, reason: "系統忙碌中，請稍後再試" };
  }
}
 
// ─── 藥劑庫存 ──────────────────────────────────────────────
// 集合：potionInventory / 文件 ID = memberId
// 結構：{ items: { potionId: count }, updatedAt }
 
const C_POTIONS = "potionInventory";
 
// 批次新增藥劑（potions = [{ id, count }]）
export async function addPotions(memberId, potions) {
  if (!memberId || !potions?.length) return;
  try {
    const ref  = doc(db, C_POTIONS, memberId);
    const snap = await getDoc(ref);
    const items = snap.exists() ? (snap.data().items || {}) : {};
    potions.forEach(p => { items[p.id] = (items[p.id] || 0) + (p.count || 1); });
    await setDoc(ref, { items, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) { console.warn("addPotions:", e?.message); }
}
 
// 訂閱藥劑庫存（即時）
export function subscribePotions(memberId, callback) {
  return onSnapshot(
    doc(db, C_POTIONS, memberId),
    snap => callback(snap.exists() ? (snap.data().items || {}) : {}),
    err  => { console.warn("subscribePotions:", err.message); callback({}); }
  );
}
 
// 合成藥劑：檢查配方材料 → 扣材料 → 加 1 瓶藥
export async function craftPotion(memberId, potionId) {
  if (!memberId || !potionId) return { ok: false, reason: "參數錯誤" };
  const potion = POTIONS.find(p => p.id === potionId);
  if (!potion?.recipe?.length) return { ok: false, reason: "這個藥劑沒有合成配方" };
  try {
    // 1. 檢查並扣除材料
    const matRef  = doc(db, C_MATERIALS, memberId);
    const matSnap = await getDoc(matRef);
    const inventory = matSnap.exists() ? (matSnap.data().items || {}) : {};
    for (const r of potion.recipe) {
      if ((inventory[r.id] || 0) < r.count) {
        const mat = MATERIALS.find(m => m.id === r.id);
        return { ok: false, reason: `材料不足：「${mat?.name || r.id}」需要 ${r.count} 個，目前 ${inventory[r.id] || 0} 個` };
      }
    }
    potion.recipe.forEach(r => { inventory[r.id] = (inventory[r.id] || 0) - r.count; });
    await setDoc(matRef, { items: inventory, updatedAt: serverTimestamp() }, { merge: true });

    // 2. 加入藥劑
    await addPotions(memberId, [{ id: potionId, count: 1 }]);
    await updateCraftStats(memberId, "potion", { potionId }).catch(() => {});
    return { ok: true, potion };
  } catch (e) {
    console.warn("craftPotion:", e?.message);
    return { ok: false, reason: "系統忙碌中，請稍後再試" };
  }
}
 
// 使用藥劑（戰鬥開始時呼叫，potionIds = ["heal_s", ...] 每個扣 1 瓶）
export async function usePotions(memberId, potionIds) {
  if (!memberId || !potionIds?.length) return { ok: true };
  try {
    const ref  = doc(db, C_POTIONS, memberId);
    const snap = await getDoc(ref);
    const items = snap.exists() ? (snap.data().items || {}) : {};
    for (const pid of potionIds) {
      if ((items[pid] || 0) < 1) return { ok: false, reason: "藥劑數量不足" };
    }
    potionIds.forEach(pid => { items[pid] = (items[pid] || 0) - 1; });
    await setDoc(ref, { items, updatedAt: serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (e) {
    console.warn("usePotions:", e?.message);
    return { ok: false, reason: "系統忙碌中" };
  }
} 
// ─── 碎片庫存 ──────────────────────────────────────────────
// 集合：fragmentInventory / 文件 ID = memberId
// 結構：{ items: { fragmentId: count }, updatedAt }
// 碎片本身不計分，10個合成 → 更新 member 對應 badge 欄位
 
 
const C_FRAGS = "fragmentInventory";
 
// 批次新增碎片（frags = [{ id, ... }]，每個+1）
export async function addFragments(memberId, frags) {
  if (!memberId || !frags?.length) return;
  try {
    const ref  = doc(db, C_FRAGS, memberId);
    const snap = await getDoc(ref);
    const items = snap.exists() ? (snap.data().items || {}) : {};
    frags.forEach(f => { items[f.id] = (items[f.id] || 0) + 1; });
    await setDoc(ref, { items, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) { console.warn("addFragments:", e?.message); }
}
 
// 一次性遷移：把舊 ID 統一對應到最新 ID
export async function migrateOldFragments(memberId) {
  // materialInventory 舊 key → fragmentInventory 新 key
  const MAT_MAP = {
    "frag_fatcat":       "frag_fatcat_bronze",
    "frag_score":        "frag_score_bronze",
    "frag_achieve":      "frag_achieve_silver",
  };
  // fragmentInventory 錯誤 key → 正確 key（含 _silver 舊版 + 無後綴舊版）
  const FRAG_MAP = {
    "frag_fatcat_silver": "frag_fatcat_bronze",
    "frag_score_silver":  "frag_score_bronze",
    "frag_fatcat":        "frag_fatcat_bronze",
    "frag_score":         "frag_score_bronze",
    "frag_achieve":       "frag_achieve_silver",
  };
  try {
    const fragRef  = doc(db, C_FRAGS, memberId);
    const fragSnap = await getDoc(fragRef);

    // migratedV2 旗標：確保每位用戶只跑一次（v2 修正了 fragmentInventory 內的舊 key）
    if (fragSnap.exists() && fragSnap.data().migratedV2) return;

    const matRef   = doc(db, C_MATERIALS, memberId);
    const matSnap  = await getDoc(matRef);
    const matItems  = matSnap.exists()  ? (matSnap.data().items  || {}) : {};
    const fragItems = fragSnap.exists() ? (fragSnap.data().items || {}) : {};

    let matDirty = false;
    const matDeleteUpdates = {};

    // 從 materialInventory 搬到 fragmentInventory
    Object.entries(MAT_MAP).forEach(([old, newId]) => {
      if ((matItems[old] || 0) > 0) {
        fragItems[newId] = (fragItems[newId] || 0) + matItems[old];
        matDeleteUpdates[`items.${old}`] = deleteField();
        matDirty = true;
      }
    });
    // 在 fragmentInventory 內改名（_silver → _bronze）
    Object.entries(FRAG_MAP).forEach(([wrong, correct]) => {
      if ((fragItems[wrong] || 0) > 0) {
        fragItems[correct] = (fragItems[correct] || 0) + fragItems[wrong];
        delete fragItems[wrong];
      }
    });

    // 寫入 migratedV2: true，無論有無舊資料都標記完成，確保此函式只執行一次
    await setDoc(fragRef, { items: fragItems, migratedV2: true, updatedAt: serverTimestamp() }, { merge: true });
    if (matDirty) await updateDoc(matRef, { ...matDeleteUpdates, updatedAt: serverTimestamp() });
  } catch (e) { console.warn("migrateOldFragments:", e?.message); }
}

// 訂閱碎片庫存（即時）
export function subscribeFragments(memberId, callback) {
  return onSnapshot(
    doc(db, C_FRAGS, memberId),
    snap => callback(snap.exists() ? (snap.data().items || {}) : {}),
    err  => { console.warn("subscribeFragments:", err.message); callback({}); }
  );
}
 
// 合成碎片 → 銀章
// fragId: "frag_fatcat_silver" | "frag_score_silver" | "frag_achieve_silver"
// 成功後：扣10個碎片 + member.{badgeField}.silver += 1 + 回傳 result 供 UI 提示
export async function craftFragment(memberId, fragId) {
  if (!memberId || !fragId) return { ok: false, reason: "參數錯誤" };
  const frag = FRAGMENTS.find(f => f.id === fragId);
  if (!frag) return { ok: false, reason: "找不到碎片定義" };
  const need = frag.craftCount || 10;
  const { badgeField, badgeLevel, label } = frag.craftResult;
  try {
    // 1. 扣碎片
    const fragRef  = doc(db, C_FRAGS, memberId);
    const fragSnap = await getDoc(fragRef);
    const items    = fragSnap.exists() ? (fragSnap.data().items || {}) : {};
    const have     = items[fragId] || 0;
    if (have < need) return { ok: false, reason: `還需要 ${need - have} 個「${frag.name}」` };
    items[fragId] = have - need;
    await setDoc(fragRef, { items, updatedAt: serverTimestamp() }, { merge: true });
    // 2. 更新 member badge（badgeField = "fatCat" | "score" | "achievement"）
    const memRef = doc(db, "members", memberId);
    await updateDoc(memRef, { [`${badgeField}.${badgeLevel}`]: increment(1) });
    await updateCraftStats(memberId, "frag", { fragId }).catch(() => {});
    return { ok: true, label };
  } catch (e) {
    console.warn("craftFragment:", e?.message);
    return { ok: false, reason: "系統忙碌中，請稍後再試" };
  }
}

// ─── 怪物圖鑑 ──────────────────────────────────────────────
export function subscribeMonsterDex(memberId, callback) {
  return onSnapshot(
    doc(db, C_MONSTER_DEX, memberId),
    snap => callback(snap.exists() ? (snap.data().monsters || {}) : {}),
    err  => { console.warn("subscribeMonsterDex:", err.message); callback({}); }
  );
}

async function updateMonsterDex(memberId, monsterId, result, score, dmgDealt) {
  if (!memberId || !monsterId) return;
  const ref  = doc(db, C_MONSTER_DEX, memberId);
  const snap = await getDoc(ref);
  const monsters = snap.exists() ? (snap.data().monsters || {}) : {};
  const prev = monsters[monsterId] || { wins: 0, losses: 0, firstWin: null, bestScore: 0, totalDmgDealt: 0 };
  if (result === "win") {
    prev.wins = (prev.wins || 0) + 1;
    if (!prev.firstWin) prev.firstWin = new Date().toISOString().slice(0, 10);
    if ((score || 0) > (prev.bestScore || 0)) prev.bestScore = score;
  } else {
    prev.losses = (prev.losses || 0) + 1;
  }
  prev.totalDmgDealt = (prev.totalDmgDealt || 0) + (dmgDealt || 0);
  monsters[monsterId] = prev;
  await setDoc(ref, { monsters, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getAllMonsterDex() {
  const snap = await getDocs(collection(db, C_MONSTER_DEX));
  return snap.docs.map(d => ({ memberId: d.id, monsters: d.data().monsters || {} }));
}

// 供 partyDb 呼叫：更新怪物圖鑑（勝/敗記錄）
export async function recordBattleDex(memberId, monsterId, result, dmgDealt) {
  if (!memberId || !monsterId || memberId.startsWith("guest")) return;
  await updateMonsterDex(memberId, monsterId, result, 0, dmgDealt || 0).catch(() => {});
}

// ─── 合成統計 ──────────────────────────────────────────────
export function subscribeCraftStats(memberId, callback) {
  return onSnapshot(
    doc(db, C_CRAFT_STATS, memberId),
    snap => callback(snap.exists() ? snap.data() : {}),
    err  => { console.warn("subscribeCraftStats:", err.message); callback({}); }
  );
}

// ─── 開箱統計 ──────────────────────────────────────────────
const C_CHEST_STATS = "chestStats";

export async function updateChestOpenStats(memberId, chestType) {
  if (!memberId || !chestType) return;
  try {
    const ref = doc(db, C_CHEST_STATS, memberId);
    // updateDoc 才能正確解析 dot-notation 為 nested field；setDoc+merge 會建立字面欄位名稱
    await updateDoc(ref, { [`opens.${chestType}`]: increment(1), updatedAt: serverTimestamp() })
      .catch(() => setDoc(ref, { opens: { [chestType]: 1 }, updatedAt: serverTimestamp() }));
  } catch (e) { console.warn("updateChestOpenStats:", e?.message); }
}

export function subscribeChestStats(memberId, callback) {
  return onSnapshot(
    doc(db, C_CHEST_STATS, memberId),
    snap => callback(snap.exists() ? (snap.data().opens || {}) : {}),
    err  => { console.warn("subscribeChestStats:", err.message); callback({}); }
  );
}

// ─── 藥水使用圖鑑 ──────────────────────────────────────────
const C_POTION_DEX = "potionDex";

export function subscribePotionDex(memberId, callback) {
  return onSnapshot(
    doc(db, C_POTION_DEX, memberId),
    snap => callback(snap.exists() ? snap.data() : {}),
    err  => { console.warn("subscribePotionDex:", err.message); callback({}); }
  );
}

export async function recordPotionUsed(memberId, potionIds) {
  if (!memberId || !potionIds?.length || memberId.startsWith("guest")) return;
  const ref = doc(db, C_POTION_DEX, memberId);
  const updates = { updatedAt: serverTimestamp() };
  for (const id of potionIds) updates[`used.${id}`] = increment(1);
  await setDoc(ref, updates, { merge: true });
}

// ─── 後台給予道具 ───────────────────────────────────────────
export async function adminGiveItem(memberId, category, itemId, qty) {
  if (!memberId || !category || !itemId || qty < 1) return { ok: false, reason: "參數錯誤" };
  try {
    if (category === "material") {
      const ref = doc(db, C_MATERIALS, memberId);
      const snap = await getDoc(ref);
      const items = snap.exists() ? (snap.data().items || {}) : {};
      items[itemId] = (items[itemId] || 0) + qty;
      await setDoc(ref, { items, updatedAt: serverTimestamp() }, { merge: true });
    } else if (category === "potion") {
      const ref = doc(db, C_POTIONS, memberId);
      const snap = await getDoc(ref);
      const items = snap.exists() ? (snap.data().items || {}) : {};
      items[itemId] = (items[itemId] || 0) + qty;
      await setDoc(ref, { items, updatedAt: serverTimestamp() }, { merge: true });
    } else if (category === "fragment") {
      const ref = doc(db, C_FRAGS, memberId);
      const snap = await getDoc(ref);
      const items = snap.exists() ? (snap.data().items || {}) : {};
      items[itemId] = (items[itemId] || 0) + qty;
      await setDoc(ref, { items, updatedAt: serverTimestamp() }, { merge: true });
    } else if (category === "chest") {
      const chests = Array.from({ length: qty }, (_, i) => ({
        id: `chest_admin_${Date.now()}_${i}`,
        type: itemId, family: "admin", tier: "admin", from: "後台贈送", ts: Date.now() + i,
      }));
      await addChests(memberId, chests);
    }
    return { ok: true };
  } catch (e) {
    console.warn("adminGiveItem:", e?.message);
    return { ok: false, reason: e?.message || "系統錯誤" };
  }
}

export async function adminSetFragments(memberId, items) {
  if (!memberId) return { ok: false };
  try {
    await setDoc(doc(db, C_FRAGS, memberId), { items, migratedV2: true, updatedAt: serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export async function adminSetMemberBadge(memberId, badgeField, badgeLevel, value) {
  if (!memberId) return { ok: false };
  try {
    await updateDoc(doc(db, C.members, memberId), { [`${badgeField}.${badgeLevel}`]: Number(value) });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// ─── 金幣系統 ──────────────────────────────────────────────

export async function addCoins(memberId, amount) {
  if (!memberId || !amount || memberId.startsWith("guest")) return;
  try {
    await updateDoc(doc(db, C.members, memberId), { coins: increment(amount) });
  } catch {
    await setDoc(doc(db, C.members, memberId), { coins: amount }, { merge: true }).catch(() => {});
  }
}

// ─── 地下城次數管理 ────────────────────────────────────────
export async function markDungeonUsed(memberId) {
  if (!memberId) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  await updateDoc(doc(db, C.members, memberId), { lastDungeonDate: todayStr });
}

export async function resetDungeonUsed(memberId) {
  if (!memberId) return;
  await updateDoc(doc(db, C.members, memberId), { lastDungeonDate: deleteField() });
}

export async function resetAllDungeonUsed() {
  const snap = await getDocs(collection(db, C.members));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { lastDungeonDate: deleteField() }));
  await batch.commit();
}

export async function resetAllMonsterSessions() {
  const snap = await getDocs(collection(db, C.members));
  const todayStr = monsterTodayStr();
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    batch.delete(doc(db, C_MONSTER_SESSION, `${d.id}_${todayStr}`));
  });
  await batch.commit();
}

// ─── 圖片收集卡包 ──────────────────────────────────────────
// 給玩家一個 card_pack 卡包，存入 chestInventory，之後從背包開箱
export async function addCardPack(memberId, count = 1) {
  if (!memberId || memberId.startsWith("guest")) return;
  try {
    const packs = Array.from({ length: count }, (_, i) => ({
      id: `cardpack_${memberId}_${Date.now()}_${i}`,
      type: "card_pack",
      family: "special",
      tier: "special",
      from: "圖片收集卡包",
      ts: Date.now(),
    }));
    await addChests(memberId, packs);
  } catch (e) { console.warn("addCardPack:", e?.message); }
}

// ─── 怪物卡片收藏 ──────────────────────────────────────────
// cardCollections/{memberId} → { cards:{ [monsterId]: {...} }, equipped:[monsterId,...] }

const C_CARDS = "cardCollections";

const STAR_UPGRADE_COST = [1, 2, 3, 4, 5];

// cardData = { monsterId, name, icon, tier, family }
export async function addMonsterCard(memberId, cardData, chosenStat) {
  if (!memberId || !cardData?.monsterId || memberId.startsWith("guest")) return;
  try {
    const ref  = doc(db, C_CARDS, memberId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : { cards: {}, equipped: [] };
    const cards = { ...(data.cards || {}) };
    const key   = cardData.monsterId;
    if (cards[key]) {
      cards[key] = { ...cards[key], duplicates: (cards[key].duplicates || 0) + 1 };
    } else {
      cards[key] = {
        ...cardData, stars: 1, duplicates: 0,
        chosenStat: cardData.tier === "mythic" ? (chosenStat || null) : null,
        ts: Date.now(),
      };
    }
    await setDoc(ref, { cards, equipped: data.equipped || [], updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) { console.warn("addMonsterCard:", e?.message); }
}

export async function upgradeCard(memberId, monsterId) {
  if (!memberId || !monsterId) return { ok: false };
  try {
    const ref  = doc(db, C_CARDS, memberId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ok: false, reason: "找不到卡片" };
    const cards = { ...snap.data().cards };
    const card  = cards[monsterId];
    if (!card) return { ok: false, reason: "找不到卡片" };
    const stars = card.stars || 1;
    if (stars >= 5) return { ok: false, reason: "已達最高星級" };
    const cost  = STAR_UPGRADE_COST[stars - 1];
    if ((card.duplicates || 0) < cost) return { ok: false, reason: "張數不足" };
    cards[monsterId] = { ...card, stars: stars + 1, duplicates: card.duplicates - cost };
    await setDoc(ref, { cards, updatedAt: serverTimestamp() }, { merge: true });
    return { ok: true, newStars: stars + 1 };
  } catch (e) {
    console.warn("upgradeCard:", e?.message);
    return { ok: false, reason: "系統忙碌" };
  }
}

export async function equipCard(memberId, monsterId) {
  if (!memberId || !monsterId) return { ok: false };
  try {
    const ref  = doc(db, C_CARDS, memberId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : { cards: {}, equipped: [] };
    const equipped = data.equipped || [];
    if (equipped.includes(monsterId)) return { ok: true };
    if (equipped.length >= 5) return { ok: false, reason: "已達最大裝備數（5張）" };
    await setDoc(ref, { equipped: [...equipped, monsterId], updatedAt: serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (e) { return { ok: false, reason: "系統忙碌" }; }
}

export async function unequipCard(memberId, monsterId) {
  if (!memberId || !monsterId) return { ok: false };
  try {
    const ref  = doc(db, C_CARDS, memberId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : { cards: {}, equipped: [] };
    const equipped = (data.equipped || []).filter(id => id !== monsterId);
    await setDoc(ref, { equipped, updatedAt: serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (e) { return { ok: false, reason: "系統忙碌" }; }
}

export async function setMythicCardStat(memberId, monsterId, chosenStat) {
  if (!memberId || !monsterId || !chosenStat) return { ok: false };
  try {
    await updateDoc(doc(db, C_CARDS, memberId), { [`cards.${monsterId}.chosenStat`]: chosenStat });
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

export function subscribeCardCollection(memberId, callback) {
  if (!memberId) { callback({ cards: {}, equipped: [] }); return () => {}; }
  return onSnapshot(
    doc(db, C_CARDS, memberId),
    snap => callback(snap.exists() ? snap.data() : { cards: {}, equipped: [] }),
    err  => { console.warn("subscribeCardCollection:", err?.message); callback({ cards: {}, equipped: [] }); }
  );
}

// ──────────────────────────────────────────────────────────
async function updateCraftStats(memberId, type, data) {
  if (!memberId) return;
  const ref  = doc(db, C_CRAFT_STATS, memberId);
  const snap = await getDoc(ref);
  const stats = snap.exists() ? snap.data() : {};
  if (type === "potion") {
    stats.potionsCrafted = (stats.potionsCrafted || 0) + 1;
    stats.potionTypesCrafted = stats.potionTypesCrafted || {};
    stats.potionTypesCrafted[data.potionId] = (stats.potionTypesCrafted[data.potionId] || 0) + 1;
  } else if (type === "frag") {
    stats.fragsCrafted = (stats.fragsCrafted || 0) + 1;
    stats.fragTypesCrafted = stats.fragTypesCrafted || {};
    stats.fragTypesCrafted[data.fragId] = (stats.fragTypesCrafted[data.fragId] || 0) + 1;
  }
  await setDoc(ref, { ...stats, updatedAt: serverTimestamp() }, { merge: true });
}

// ─── 月卡系統 ─────────────────────────────────────────────────
const C_MONTHLY        = "monthlyCardRequests";
const C_MONTHLY_CONFIG = "monthlyCardConfig";
const C_MONTHLY_LOGS   = "monthlyCardLogs";   // append-only，不可修改

// 月卡設定（後台設定次數 / 天數）
export async function getMonthlyCardConfig() {
  try {
    const snap = await getDoc(doc(db, C_MONTHLY_CONFIG, "default"));
    if (snap.exists()) return snap.data();
  } catch {}
  return { sessions: 16, validDays: 60 };
}
export async function saveMonthlyCardConfig(cfg, operatorId) {
  await setDoc(doc(db, C_MONTHLY_CONFIG, "default"),
    { ...cfg, updatedAt: serverTimestamp(), operatorId }, { merge: true });
}

// 內部：寫入月卡操作記錄（append-only）
async function _logMonthlyCard(memberId, memberName, action, delta, note, operatorId) {
  try {
    await addDoc(collection(db, C_MONTHLY_LOGS), {
      memberId, memberName, action, delta, note,
      operatorId: operatorId || null,
      createdAt: serverTimestamp(),
    });
  } catch {}
}

// 訂閱某射手的月卡記錄（後台查看用）
export function subscribeMonthlyCardLogs(memberId, callback) {
  if (!memberId) { callback([]); return () => {}; }
  // 只用 where，避免需要複合索引；前端排序
  const q = query(collection(db, C_MONTHLY_LOGS), where("memberId", "==", memberId), limit(50));
  return onSnapshot(q, snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(docs);
  }, () => callback([]));
}

// 射手申請使用月卡（1或2小時）→ 送後台審核
export async function submitMonthlyCardRequest(memberId, memberName, hours) {
  if (!memberId || ![1, 2].includes(hours)) return { ok: false, reason: "參數錯誤" };
  try {
    const q = query(collection(db, C_MONTHLY), where("memberId", "==", memberId), where("status", "==", "pending"));
    const snap = await getDocs(q);
    if (!snap.empty) return { ok: false, reason: "已有待審核申請，請等待教練處理" };
    const memSnap = await getDoc(doc(db, C.members, memberId));
    const card = memSnap.exists() ? (memSnap.data().monthlyCard || null) : null;
    if (!card?.active || card.sessions <= 0) return { ok: false, reason: "月卡無效或次數不足" };
    await addDoc(collection(db, C_MONTHLY), { memberId, memberName, hours, status: "pending", createdAt: serverTimestamp() });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 後台審核通過 → 扣1次
export async function approveMonthlyCardRequest(requestId, memberId, operatorId) {
  try {
    const reqRef = doc(db, C_MONTHLY, requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists() || reqSnap.data().status !== "pending") return { ok: false, reason: "申請不存在或已處理" };
    const req = reqSnap.data();
    const memRef = doc(db, C.members, memberId);
    const memSnap = await getDoc(memRef);
    const card = memSnap.exists() ? (memSnap.data().monthlyCard || null) : null;
    const hoursUsed = req.hours || 1;
    if (!card?.active || card.sessions < hoursUsed) return { ok: false, reason: "月卡無效或點數不足" };
    await updateDoc(memRef, { "monthlyCard.sessions": increment(-hoursUsed) });
    await updateDoc(reqRef, { status: "approved", reviewedAt: serverTimestamp() });
    await _logMonthlyCard(memberId, req.memberName || memberId, "use_approved", -hoursUsed,
      `核准使用 ${hoursUsed} 小時（扣 ${hoursUsed} 點）`, operatorId);
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 後台拒絕申請
export async function rejectMonthlyCardRequest(requestId, operatorId) {
  try {
    const reqRef = doc(db, C_MONTHLY, requestId);
    const reqSnap = await getDoc(reqRef);
    if (reqSnap.exists()) {
      const req = reqSnap.data();
      await _logMonthlyCard(req.memberId, req.memberName || req.memberId, "use_rejected", 0,
        `拒絕使用 ${req.hours} 小時`, operatorId);
    }
    await updateDoc(reqRef, { status: "rejected", reviewedAt: serverTimestamp() });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 後台購買／續約月卡：次數＆天數從設定讀取
export async function grantMonthlyCard(memberId, memberName, operatorId) {
  try {
    const cfg = await getMonthlyCardConfig();
    const sessions  = cfg.sessions  || 16;
    const validDays = cfg.validDays || 60;
    const memSnap = await getDoc(doc(db, C.members, memberId));
    const prevCard = memSnap.exists() ? (memSnap.data().monthlyCard || null) : null;
    const isRenew  = prevCard?.active && prevCard?.sessions > 0;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validDays);
    await updateDoc(doc(db, C.members, memberId), {
      monthlyCard: { active: true, sessions, expiresAt: Timestamp.fromDate(expiresAt), startedAt: serverTimestamp(), bonusSessions: 0 }
    });
    const action = isRenew ? "renew" : "purchase";
    const note   = `${isRenew ? "續約" : "購買"}月卡 ${sessions} 次，有效 ${validDays} 天`;
    await _logMonthlyCard(memberId, memberName || memberId, action, sessions, note, operatorId);
    return { ok: true, sessions };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 後台贈送免費次數（無論有無月卡皆可）
export async function giftMonthlyCardSessions(memberId, memberName, sessions, operatorId) {
  try {
    const memRef = doc(db, C.members, memberId);
    const memSnap = await getDoc(memRef);
    const card = memSnap.exists() ? (memSnap.data().monthlyCard || null) : null;
    const curSessions = card?.sessions ?? 0;
    const expiresAt = card?.expiresAt ?? null;
    await updateDoc(memRef, {
      "monthlyCard.active":   true,
      "monthlyCard.sessions": curSessions + sessions,
      ...(expiresAt ? {} : { "monthlyCard.expiresAt": Timestamp.fromDate((() => { const d = new Date(); d.setDate(d.getDate()+60); return d; })()) }),
    });
    await _logMonthlyCard(memberId, memberName || memberId, "gift_sessions", sessions,
      `贈送 ${sessions} 次`, operatorId);
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 訂閱待審核月卡申請（後台）
export function subscribePendingMonthlyRequests(callback) {
  // 只用 where，不加 orderBy，避免需要複合索引
  const q = query(collection(db, C_MONTHLY), where("status", "==", "pending"));
  return onSnapshot(q, snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    callback(docs);
  }, () => callback([]));
}

// 訂閱全部月卡申請（後台，含歷史最近100筆）
export function subscribeAllMonthlyRequests(callback) {
  const q = query(collection(db, C_MONTHLY), orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => callback([]));
}

// 訂閱自己的月卡申請（前台）
export function subscribeMyMonthlyRequests(memberId, callback) {
  if (!memberId) { callback([]); return () => {}; }
  const q = query(collection(db, C_MONTHLY), where("memberId", "==", memberId), orderBy("createdAt", "desc"), limit(5));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => callback([]));
}

// 到期自動清零（前台進入時呼叫）
export async function checkExpireMonthlyCard(memberId) {
  try {
    const memRef = doc(db, C.members, memberId);
    const memSnap = await getDoc(memRef);
    if (!memSnap.exists()) return;
    const card = memSnap.data().monthlyCard;
    if (!card?.active) return;
    const expires = card.expiresAt?.toDate ? card.expiresAt.toDate() : null;
    if (expires && expires < new Date()) {
      await updateDoc(memRef, { "monthlyCard.active": false, "monthlyCard.sessions": 0 });
    }
  } catch {}
}

// ── 會計系統 ───────────────────────────────────────────────

export async function addBillingRecord(data) {
  return addDoc(collection(db, C.billingRecords), { ...data, createdAt: serverTimestamp() });
}

export async function deleteBillingRecord(id) {
  return deleteDoc(doc(db, C.billingRecords, id));
}

// 只用 year where，month 在 client 過濾，避免複合索引需求
export function subscribeBillingRecords(year, month, callback) {
  const q = query(collection(db, C.billingRecords), where("year", "==", year));
  return onSnapshot(q, snap => {
    let records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (month !== null && month !== undefined) records = records.filter(r => r.month === month);
    records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    callback(records);
  }, () => callback([]));
}

export async function getMembersForBilling() {
  const snap = await getDocs(collection(db, C.members));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.lastLoginAt?.toMillis?.() ?? 0) - (a.lastLoginAt?.toMillis?.() ?? 0));
}

// ── 版本偵測 ──────────────────────────────────────────────
const C_SYS = "sysConfig";
export function subscribeAppVersion(callback) {
  return onSnapshot(
    doc(db, C_SYS, "version"),
    snap => callback(snap.exists() ? (snap.data().current || null) : null),
    () => callback(null)
  );
}
export async function setAppVersion(version) {
  await setDoc(doc(db, C_SYS, "version"), { current: version });
}

// ─── 金幣商店 ──────────────────────────────────────────────

// 扣金幣（回傳 ok/reason）
export async function spendCoins(memberId, amount) {
  if (!memberId || amount <= 0) return { ok: false, reason: "參數錯誤" };
  try {
    const snap = await getDoc(doc(db, C.members, memberId));
    if (!snap.exists()) return { ok: false, reason: "找不到會員" };
    const coins = snap.data().coins || 0;
    if (coins < amount) return { ok: false, reason: `金幣不足（需 ${amount}，現有 ${coins}）` };
    await updateDoc(doc(db, C.members, memberId), { coins: increment(-amount) });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 金幣商店：購買裝備（花費金幣 + 裝備進槽位，保留現有品級/等級）
export async function shopBuyEquip(memberId, slotId, itemId, price) {
  try {
    const spend = await spendCoins(memberId, price);
    if (!spend.ok) return spend;
    const snap = await getDoc(doc(db, C.members, memberId));
    const cur  = snap.data()?.rpgEquip?.[slotId];
    if (cur?.itemId) {
      await updateDoc(doc(db, C.members, memberId), {
        [`rpgEquip.${slotId}.itemId`]: itemId,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, C.members, memberId), {
        [`rpgEquip.${slotId}`]: { itemId, grade: "common", plusLevel: 0 },
        updatedAt: serverTimestamp(),
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "購買失敗，請稍後再試" };
  }
}

// 金幣商店：購買消耗品
// type: "chest" | "material" | "fragment" | "potion"
export async function shopBuyConsumable(memberId, item) {
  const { price, type, payload } = item;
  const spend = await spendCoins(memberId, price);
  if (!spend.ok) return spend;
  try {
    if (type === "chest") {
      const chest = {
        id:   `chest_shop_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        type: payload.chestType, family: "shop", tier: "common",
        from: "金幣商店", ts: Date.now(),
      };
      await addChests(memberId, [chest]);
    } else if (type === "material") {
      const mats = (payload.materialIds || []).map(id => ({ id }));
      await addMaterials(memberId, mats);
    } else if (type === "fragment") {
      const ref  = doc(db, "fragmentInventory", memberId);
      const snap = await getDoc(ref);
      const items = snap.exists() ? (snap.data().items || {}) : {};
      items[payload.fragId] = (items[payload.fragId] || 0) + (payload.count || 1);
      await setDoc(ref, { items, updatedAt: serverTimestamp() }, { merge: true });
    } else if (type === "potion") {
      await addPotions(memberId, [{ id: payload.potionId, count: 1 }]);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "系統錯誤" };
  }
}

// ─── 虛擬裝備品項（後台管理）───────────────────────────────────
const C_EQUIP_ITEMS = "equipItems";

export function subscribeEquipItems(callback) {
  return onSnapshot(
    collection(db, C_EQUIP_ITEMS),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err  => { console.warn("subscribeEquipItems:", err?.message); callback([]); }
  );
}

export async function createEquipItem(data) {
  try {
    const ref = await addDoc(collection(db, C_EQUIP_ITEMS), { ...data, createdAt: serverTimestamp() });
    return { ok: true, id: ref.id };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export async function updateEquipItem(id, data) {
  try {
    await updateDoc(doc(db, C_EQUIP_ITEMS, id), { ...data, updatedAt: serverTimestamp() });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export async function deleteEquipItem(id) {
  try {
    await deleteDoc(doc(db, C_EQUIP_ITEMS, id));
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// ─── 裝備系統 ──────────────────────────────────────────────
// equipment 存在 members/{id}.equipment[slotId]
// 格式：{ itemId, grade, plusLevel }

// 裝備品項到槽位（初始 grade:common, plusLevel:0）
// 注意：使用 rpgEquip 欄位，不影響舊的 equipment 弓組記錄陣列
export async function equipItem(memberId, slotId, itemId) {
  if (!memberId || !slotId || !itemId) return { ok: false, reason: "參數錯誤" };
  try {
    await updateDoc(doc(db, C.members, memberId), {
      [`rpgEquip.${slotId}`]: { itemId, grade: "common", plusLevel: 0 },
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 只更換已裝備槽位的品牌（保留 grade/plusLevel，使用 dot notation 避免覆蓋其他槽位）
export async function changeEquipBrand(memberId, slotId, itemId) {
  if (!memberId || !slotId || !itemId) return { ok: false, reason: "參數錯誤" };
  try {
    await updateDoc(doc(db, C.members, memberId), {
      [`rpgEquip.${slotId}.itemId`]: itemId,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 卸下槽位
export async function unequipSlot(memberId, slotId) {
  if (!memberId || !slotId) return { ok: false, reason: "參數錯誤" };
  try {
    await updateDoc(doc(db, C.members, memberId), {
      [`rpgEquip.${slotId}`]: deleteField(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 升級槽位：+1 plusLevel；滿 5 → 升一品級並重置
// 回傳 { ok, upgraded, newGrade, newPlusLevel, reason }
export async function upgradeEquipSlot(memberId, slotId) {
  if (!memberId || !slotId) return { ok: false, reason: "參數錯誤" };
  try {
    const memRef  = doc(db, C.members, memberId);
    const memSnap = await getDoc(memRef);
    if (!memSnap.exists()) return { ok: false, reason: "找不到會員" };
    const data  = memSnap.data();
    const equip = data.rpgEquip?.[slotId];
    if (!equip?.itemId) return { ok: false, reason: "該槽位尚未裝備" };

    const gradeIdx = EQUIP_GRADES.findIndex(g => g.id === equip.grade);
    const isMaxGrade = gradeIdx >= EQUIP_GRADES.length - 1;
    if (isMaxGrade && (equip.plusLevel || 0) >= 4) {
      return { ok: false, reason: "已達最高品級神話+4，無法繼續升級" };
    }

    const cost = EQUIP_UPGRADE_COST[equip.grade];
    if (!cost) return { ok: false, reason: "找不到升級費用設定" };

    // 檢查金幣
    if ((data.coins || 0) < cost.gold) {
      return { ok: false, reason: `金幣不足（需 ${cost.gold}，現有 ${data.coins || 0}）` };
    }

    // 檢查材料庫存
    const matRef  = doc(db, C_MATERIALS, memberId);
    const matSnap = await getDoc(matRef);
    const matItems = matSnap.exists() ? (matSnap.data().items || {}) : {};
    for (const req of cost.materials) {
      if ((matItems[req.id] || 0) < req.count) {
        return { ok: false, reason: `材料不足（需 ${req.id} ×${req.count}）` };
      }
    }
    if (cost.keyItem && (matItems[cost.keyItem.id] || 0) < cost.keyItem.count) {
      return { ok: false, reason: `缺少關鍵材料：${cost.keyItem.note}` };
    }

    // 扣材料
    const matUpdates = { updatedAt: serverTimestamp() };
    for (const req of cost.materials) {
      matUpdates[`items.${req.id}`] = increment(-req.count);
    }
    if (cost.keyItem) {
      matUpdates[`items.${cost.keyItem.id}`] = increment(-cost.keyItem.count);
    }
    await updateDoc(matRef, matUpdates).catch(() =>
      setDoc(matRef, matUpdates, { merge: true })
    );

    // 扣金幣
    await updateDoc(memRef, { coins: increment(-cost.gold) });

    // 計算新等級
    let newPlusLevel = (equip.plusLevel || 0) + 1;
    let newGrade = equip.grade;
    let upgraded = false;
    if (newPlusLevel >= 5 && !isMaxGrade) {
      newPlusLevel = 0;
      newGrade = EQUIP_GRADES[gradeIdx + 1].id;
      upgraded = true;
    }

    await updateDoc(memRef, {
      [`rpgEquip.${slotId}.plusLevel`]: newPlusLevel,
      [`rpgEquip.${slotId}.grade`]:     newGrade,
      updatedAt: serverTimestamp(),
    });

    return { ok: true, upgraded, newGrade, newPlusLevel };
  } catch (e) {
    console.warn("upgradeEquipSlot:", e?.message);
    return { ok: false, reason: e?.message || "系統錯誤" };
  }
}
