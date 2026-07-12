// src/lib/db.js
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  setDoc, query, where, orderBy, limit, serverTimestamp, onSnapshot,
  increment, arrayUnion, arrayRemove, Timestamp, deleteField, writeBatch, runTransaction
} from "firebase/firestore";
import { db } from "./firebase";
import { MATERIALS } from "./monsterMaterials";
import { POTIONS, FRAGMENTS } from "./itemData";
import { migratePotionInventory } from "./consumableSystem";
import { makeCoinChest } from "./lootTable";
import { EQUIP_GRADES, EQUIP_SLOT_DEFS } from "./constants";
import { EQUIP_UPGRADE_COST, generateRandomMats } from "./equipData";
import { SHOP_PRODUCT_MAP, getShopPeriodKey, getShopDailyKey } from "./shopData";
import { levelFromXP, xpToReachLevel, makeSeedRand } from "./adventurerSystem";
import { BUILDING_LIST, BUILDINGS as VB, getProductionRate, getUpgradeRequirements, DEFAULT_VILLAGE, MAX_COLLECT_HOURS, isBuildingUnlocked, getBuildingStage, getStageMultiplier, getDefaultAllocation, getResourceKey, TIERED_RESOURCES } from "./villageData";
import { getCardStat, MAX_EQUIPPED_PER_STAT, MAX_WB_EQUIPPED } from "./monsterCards";
import { WB_CARDS } from "./worldBossCards";
import { getMilestonesReached, getRewardsForMilestone } from "./arrowMilestone";
import { addCatBond, addCatXP } from "./catDb";

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
  campSessions: "campSessions",
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

// 訪客/兒童帳號排除（design.md §6 稽核）：field 缺省一律視為 official，
// 所以用 JS filter 而非 Firestore where（避免漏掉沒有 accountType 欄位的舊資料）
const isOfficial = m => m.accountType !== "guest" && m.accountType !== "kid";

async function isGuestOrKidMember(memberId) {
  if (!memberId) return true;
  if (memberId.startsWith("guest")) return true;
  try {
    const snap = await getDoc(doc(db, C.members, memberId));
    const type = snap.exists() ? snap.data()?.accountType : null;
    return type === "guest" || type === "kid";
  } catch {
    return false;
  }
}

export async function getMembers() {
  const snap = await getDocs(collection(db, C.members));
  return sortByLastLogin(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(isOfficial));
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
    studentTier: "restricted",   // 學生分級：新建會員一律受限，教練後台再手動升級
    accountFrozen: false,
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

// ─── 訪客/兒童帳號（兒童模式後台，2026-07-09）─────────────────
export function subscribeKidAccounts(callback) {
  return onSnapshot(
    collection(db, C.members),
    snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.accountType === "guest" || m.accountType === "kid");
      callback(sortByLastLogin(list));
    }
  );
}

// 轉正式：同一份文件原地改寫（不建立新文件）。docId 不需要等於 uid——
// useAuth.js 用 where("uid","==",...) 查會員，不是靠 doc ID 對應，所以安全。
export async function convertGuestToOfficial(memberId, officialFields, newUid, operatorId) {
  const before = await getMember(memberId);
  if (!before) throw new Error("找不到該訪客/兒童記錄");
  if (before.accountType !== "guest" && before.accountType !== "kid") {
    throw new Error("此帳號已不是訪客/兒童，不能重複轉正式");
  }
  const patch = {
    ...officialFields,
    uid: newUid,
    accountType: "official",
    contactHash: deleteField(),
    createdViaQR: deleteField(),
    fatCat: before.fatCat || { gold: 0, silver: 0, bronze: 0 },
    score: before.score || { gold: 0, silver: 0, bronze: 0 },
    achievement: before.achievement || { black: 0, gold: 0, silver: 0 },
    eventPoints: before.eventPoints || 0,
    studentTier: before.studentTier || "restricted",
    accountFrozen: !!before.accountFrozen,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, C.members, memberId), patch);
  // deleteField() 是 update() 專用 sentinel，不能出現在 addDoc()/新文件裡（會丟例外）——
  // 稽核紀錄跟回傳值都要用「已清掉的值」取代，不能直接沿用 patch 本體
  const logged = { ...patch, contactHash: null, createdViaQR: null };
  await writeAuditLog("CONVERT_TO_OFFICIAL", memberId, "member", before, logged, operatorId);
  return { id: memberId, ...before, ...logged };
}

// ─── 夏令營場次（campSessions）─────────────────────────────
export async function getCampSessions() {
  const snap = await getDocs(collection(db, C.campSessions));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

export function subscribeCampSessions(callback) {
  return onSnapshot(collection(db, C.campSessions), snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    callback(list);
  });
}

export async function createCampSession(data, operatorId) {
  const ref = await addDoc(collection(db, C.campSessions), {
    name: data.name || "",
    startDate: data.startDate || "",
    endDate: data.endDate || "",
    active: data.active !== undefined ? data.active : true,
    createdBy: operatorId || null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCampSession(id, patch) {
  await updateDoc(doc(db, C.campSessions, id), patch);
}

export async function deleteCampSession(id) {
  await deleteDoc(doc(db, C.campSessions, id));
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
export function subscribePracticeLogs(memberId, callback, maxCount = 300) {
  return onSnapshot(query(collection(db, C.practiceLogs), where("memberId", "==", memberId), orderBy("date", "desc"), limit(maxCount)), snap => {
    const logs = snap.docs.map(d => {
      const res = { id: d.id, ...d.data() };
      if (res.roundsString && typeof res.roundsString === "string") { try { res.rounds = JSON.parse(res.roundsString); } catch (e) { res.rounds = []; } }
      if (!Array.isArray(res.rounds)) res.rounds = [];
      return res;
    });
    callback(logs);
  });
}

// 只訂閱今日練習紀錄（用於 header 練箭數計數，避免讀取全部歷史）
export function subscribeTodayPracticeLogs(memberId, todayStr, callback) {
  return onSnapshot(
    query(collection(db, C.practiceLogs),
      where("memberId", "==", memberId),
      where("date", "==", todayStr)
    ),
    snap => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(logs);
    },
    () => callback([])
  );
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

  // 注意：totalArrowsAllTime 已改為由 addRoundArrows() 在每回合送出時即時更新，
  // 此處不再重複累加（防止雙重計算）。

  return ref.id;
}

// ── 每回合送出箭後立刻更新終身箭數 ─────────────────────────────
// 統一由各模式的 submit handler 呼叫，取代 addPracticeLog 的批次更新。
export async function addRoundArrows(memberId, count) {
  if (!memberId || !count || count <= 0 || await isGuestOrKidMember(memberId)) return;
  // 把 totalArrowsAllTime 與地下城發掘進度（dungeonExcavation）合併成同一次 updateDoc，
  // 避免每回合對同一份 members/{id} 文件寫兩次。
  const patch = { totalArrowsAllTime: increment(count) };
  try {
    const { computeExcavationPatch } = await import("./dungeonExcavation");
    const excav = await computeExcavationPatch(memberId, count);
    if (excav) Object.assign(patch, excav.patch);
  } catch (e) { /* ignore，退回只寫 totalArrowsAllTime */ }
  await updateDoc(doc(db, C.members, memberId), patch).catch(() => {});
  // 村目标贡献 hook（非同步，不阻塞）
  try {
    const { contributeArrowsToGoal } = await import("./villageGoalDb");
    await contributeArrowsToGoal(memberId, count);
  } catch (e) { /* ignore */ }
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

// 純上課：建立上課紀錄，等待學生點「下課」才計次
export async function submitSimpleCheckin(memberId, memberName, memberNickname) {
  const date = todayStr();
  const id = checkinId(memberId, date);
  const ref = doc(db, C_CHECKIN, id);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id, already: true };
  await setDoc(ref, {
    memberId, memberName: memberName || "", memberNickname: memberNickname || "",
    date, type: "simple", status: "done", finalConfirmed: false, classEnded: false,
    createdAt: serverTimestamp(),
  });
  return { id, already: false };
}

// 學生點報到 → 建立 pending 紀錄（等待教練審核）
export async function submitCheckin(memberId, memberName, memberNickname) {
  const date = todayStr();
  const id = checkinId(memberId, date);
  const ref = doc(db, C_CHECKIN, id);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().status !== "cancelled" && snap.data().status !== "rejected") return { id, already: true, data: snap.data() };
  await setDoc(ref, {
    memberId, memberName: memberName || "", memberNickname: memberNickname || "",
    date,
    status: "pending",
    finalConfirmed: false,
    classEnded: false,
    createdAt: serverTimestamp(),
  }, { merge: false });
  try {
    const { linkCurrentBookingToCheckin } = await import("./bookingDb");
    await linkCurrentBookingToCheckin(memberId, date, id);
  } catch (e) { console.warn("linkCurrentBookingToCheckin:", e?.message); }
  // 學生分級：報到當下立即更新最後報到日期（不等教練審核），確保 14 天自動鎖定能即時解鎖
  try { await updateDoc(doc(db, C.members, memberId), { lastCheckinDate: date }); } catch (e) { /* ignore */ }
  // 地下城發掘進度 +10
  try {
    const { addExcavationByCheckin } = await import("./dungeonExcavation");
    addExcavationByCheckin(memberId);
  } catch (e) { /* ignore */ }
  return { id, already: false };
}

// 教練審核通過
export async function approveCheckin(checkinDocId, operatorId) {
  await updateDoc(doc(db, C_CHECKIN, checkinDocId), {
    status: "active",
    approvedAt: serverTimestamp(),
    approvedBy: operatorId,
  });
  // 地下城發掘進度 +10 + 學生分級最後報到日期（保險：即使 submitCheckin 當下寫入失敗，審核通過時再補寫一次）
  try {
    const snap = await getDoc(doc(db, C_CHECKIN, checkinDocId));
    const memberId = snap.data()?.memberId;
    if (memberId) {
      const { addExcavationByCheckin } = await import("./dungeonExcavation");
      addExcavationByCheckin(memberId);
      await updateDoc(doc(db, C.members, memberId), { lastCheckinDate: todayStr() });
    }
  } catch (e) { /* ignore */ }
}

// 教練審核不通過
export async function rejectCheckin(checkinDocId, operatorId) {
  await updateDoc(doc(db, C_CHECKIN, checkinDocId), {
    status: "rejected",
    rejectedAt: serverTimestamp(),
    rejectedBy: operatorId,
  });
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
        .filter(c => (c.status === "pending" || c.status === "active" || c.type === "simple") && c.status !== "cancelled" && !c.adminDismissed && !(c.classEnded && c.billingRecordId));
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

// 學生點「下課」→ 計入本次上課次數 +1
export async function submitClassEnd(memberId, checkinDocId) {
  await updateDoc(doc(db, C_CHECKIN, checkinDocId), {
    classEnded: true,
    classEndedAt: serverTimestamp(),
    finalConfirmed: true,
  });
  try {
    const member = await getMember(memberId);
    const newCount = (member?.dailyQuestCount || 0) + 1;
    await updateDoc(doc(db, C.members, memberId), { dailyQuestCount: increment(1), eventPoints: increment(1) });
    const config = await getDailyQuestConfig();
    const rewardEvery = config?.rewardEvery || 10;
    if (newCount % rewardEvery === 0) {
      await addBadge(memberId, "achievement", "silver", 1, memberId, `上課累積 ${newCount} 次`);
    }
  } catch (e) { console.warn("submitClassEnd:", e?.message); }
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

// 強制結束今日所有仍在上課中（active、尚未 classEnded）的報到
export async function forceEndTodayCheckins() {
  const q = query(
    collection(db, C_CHECKIN),
    where("date", "==", todayStr()),
    where("status", "==", "active"),
    where("classEnded", "==", false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return 0;
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    batch.update(d.ref, {
      classEnded: true,
      classEndedAt: serverTimestamp(),
      forcedEndByAdmin: true,
    });
  });
  await batch.commit();
  return snap.size;
}

// 重置單一會員的報到累積次數
export async function resetCheckinCount(memberId) {
  await updateDoc(doc(db, C.members, memberId), { dailyQuestCount: 0 });
}

// 重置所有會員的報到累積次數（先強制下課再歸零）
export async function resetAllCheckinCounts(memberIds) {
  // 先強制結束今日未下課的報到
  await forceEndTodayCheckins();
  // 批次歸零（Firestore 每批最多 500 筆）
  for (let i = 0; i < memberIds.length; i += 499) {
    const batch = writeBatch(db);
    memberIds.slice(i, i + 499).forEach(id => {
      batch.update(doc(db, C.members, id), { dailyQuestCount: 0 });
    });
    await batch.commit();
  }
}

/* ════════════════════════════════════════════════════════════
   冒險者公會系統
   ════════════════════════════════════════════════════════════ */

const PROMO_LEVELS = [10, 20, 30, 40, 50];
const PROMO_RANK_NAME = { 10:"青銅→白銀", 20:"白銀→黃金", 30:"黃金→白金", 40:"白金→傳說", 50:"傳說→神話" };

const C_PROMO_CONFIG = "promotionQuestConfig";
export const PROMO_QUEST_DEFAULTS = {
  10: { dist: "8",  arrowCount: 6, goal: 25, bonusXP: 400  },
  20: { dist: "10", arrowCount: 6, goal: 32, bonusXP: 600  },
  30: { dist: "13", arrowCount: 6, goal: 38, bonusXP: 900  },
  40: { dist: "15", arrowCount: 6, goal: 42, bonusXP: 1200 },
  50: { dist: "18", arrowCount: 6, goal: 48, bonusXP: 1800 },
};
export async function getPromotionQuestConfig() {
  try {
    const snap = await getDoc(doc(db, C_PROMO_CONFIG, "default"));
    if (snap.exists()) return { ...PROMO_QUEST_DEFAULTS, ...snap.data() };
  } catch (e) { console.warn("getPromotionQuestConfig:", e?.message); }
  return PROMO_QUEST_DEFAULTS;
}
export function subscribePromotionQuestConfig(cb) {
  return onSnapshot(doc(db, C_PROMO_CONFIG, "default"),
    snap => cb(snap.exists() ? { ...PROMO_QUEST_DEFAULTS, ...snap.data() } : { ...PROMO_QUEST_DEFAULTS }),
    () => cb({ ...PROMO_QUEST_DEFAULTS })
  );
}
export async function savePromotionQuestConfig(data, adminId) {
  await setDoc(doc(db, C_PROMO_CONFIG, "default"), { ...data, updatedAt: serverTimestamp(), updatedBy: adminId }, { merge: true });
}

// 增加冒險者 XP（含晉階封頂：達到晉階等級上限前須完成晉階任務）
export async function addAdventurerXP(memberId, xp) {
  if (!memberId || !xp || xp <= 0) return;
  try {
    const snap = await getDoc(doc(db, C.members, memberId));
    const data = snap.exists() ? snap.data() : {};
    const currentXP = data.adventurerXP || 0;
    const promotionDone = new Set(data.promotionDone || []);
    const currentLevel = levelFromXP(currentXP);
    const newXP = currentXP + xp;

    // 找出當前阻擋的晉階等級
    let blocker = null;
    if (PROMO_LEVELS.includes(currentLevel) && !promotionDone.has(currentLevel)) {
      blocker = currentLevel;
    } else {
      const newLevel = levelFromXP(newXP);
      blocker = PROMO_LEVELS.find(pl => pl > currentLevel && pl <= newLevel && !promotionDone.has(pl)) ?? null;
    }

    if (blocker !== null) {
      // 最多累積到「晉階等級滿 XP 但差 1 點無法升下一級」
      const cap = xpToReachLevel(blocker + 1) - 1;
      const cappedXP = Math.min(newXP, cap);
      if (cappedXP > currentXP) {
        await updateDoc(doc(db, C.members, memberId), { adventurerXP: cappedXP });
      }
      // 第一次觸頂才發通知（currentXP < 觸頂門檻 && cappedXP 已到達）
      const threshold = xpToReachLevel(blocker);
      if (currentXP < threshold && cappedXP >= threshold) {
        createNotification({
          type: "promo_unlock",
          title: "⚔️ 晉階任務解鎖！",
          content: `你已達到 Lv${blocker}（${PROMO_RANK_NAME[blocker]}）！前往冒險者公會完成晉階任務才能繼續累積經驗值。`,
          mustRead: false,
          targetMemberId: memberId,
        }, "system").catch(() => {});
      }
    } else {
      await updateDoc(doc(db, C.members, memberId), { adventurerXP: increment(xp) });
    }
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

// 完成公會任務 → 記錄 + 給 XP + 給金幣 + 給箭露
export async function completeGuildTask(memberId, taskId, xp, coins, bonus = null, arrowDew = 0) {
  const date = todayStr();
  const ref = doc(db, C_GUILD, memberId);
  const snap = await getDoc(ref);
  const d = snap.exists() ? snap.data() : {};
  const prevCompleted = d.date === date ? (d.completed || []) : [];
  if (prevCompleted.includes(taskId)) return { ok: true, already: true };
  await setDoc(ref, { date, completed: [...prevCompleted, taskId], updatedAt: serverTimestamp() });
  if (xp > 0) addAdventurerXP(memberId, xp).catch(() => {});
  if (coins > 0) addCoins(memberId, coins).catch(() => {});
  if (arrowDew > 0) addArrowdew(memberId, arrowDew).catch(() => {});
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
    badgeReward:         data.badgeReward         || null,
    prerequisiteQuestId: data.prerequisiteQuestId || null,
    reward: {
      xp:         data.reward?.xp         || 0,
      coins:      data.reward?.coins       || 0,
      arrowDew:   data.reward?.arrowDew    || 0,
      gachaCoins: data.reward?.gachaCoins  || 0,
    },
    questSubtype:  data.questSubtype  || "general",
    requirement:   data.requirement   || {},
    deadline:      data.deadline      || null,
    periodTag:     data.periodTag     || null,
    bountyDifficulty: data.bountyDifficulty ?? null,
    bountySource:     data.bountySource     || null,
    bountyDateKey:    data.bountyDateKey    || null,
    autoGenerated: data.autoGenerated ?? false,
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

// 後台：編輯任務內容（全欄位覆寫）
export async function updateGuildQuest(questId, data, adminId) {
  await updateDoc(doc(db, C_GUILD_Q, questId), {
    title: data.title || "",
    desc:  data.desc  || "",
    type:  data.type  || "normal",
    badgeReward:         data.badgeReward         || null,
    prerequisiteQuestId: data.prerequisiteQuestId || null,
    reward: { xp: data.reward?.xp || 0, coins: data.reward?.coins || 0 },
    questSubtype:  data.questSubtype  || "general",
    requirement:   data.requirement   || {},
    deadline:      data.deadline      || null,
    updatedAt: serverTimestamp(),
    updatedBy: adminId,
  });
}

// 後台：刪除任務
export async function deleteGuildQuest(questId) {
  await deleteDoc(doc(db, C_GUILD_Q, questId));
}

// 系統：每兩週自動發佈懸賞任務（前台進入公會頁時呼叫，內部防重複）
export async function autoPublishBountyQuests(monsters) {
  try {
    const { getBiWeeklyPeriodKey, generateBiWeeklyBounties } = await import("./adventurerSystem");
    const periodKey = getBiWeeklyPeriodKey();
    // 用 guildMeta/bountyPeriod 文件防重複，避免需要 Firestore 複合索引
    const metaRef  = doc(db, "guildMeta", "bountyPeriod");
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data().periodKey === periodKey) {
      return { ok: true, reason: "already_exists" };
    }
    const bounties = generateBiWeeklyBounties(periodKey, monsters);
    for (const b of bounties) {
      await publishGuildQuest(b, "system").catch(() => {});
    }
    await setDoc(metaRef, { periodKey, generatedAt: serverTimestamp() });
    return { ok: true, count: bounties.length };
  } catch (e) { return { ok: false, reason: e.message }; }
}

/* ════════════════════════════════════════════════════════════
   一般懸賞任務（每日刷新，教練可調整範本池與難度獎勵）
   ════════════════════════════════════════════════════════════ */

const C_BOUNTY_TEMPLATES = "guildBountyTemplates";
const C_BOUNTY_REWARDS   = "guildBountyRewards";

// 4 個難度的預設獎勵（教練後台尚未設定 guildBountyRewards/config 時的 fallback）
// chestType 對應既有 CHEST_TYPES（wood/iron/gold/epic）
export const DEFAULT_BOUNTY_REWARDS = {
  1: { xp: 60,  coins: 100, arrowDew: 20,  gachaCoins: 1, chestType: "wood" },
  2: { xp: 150, coins: 250, arrowDew: 50,  gachaCoins: 2, chestType: "iron" },
  3: { xp: 300, coins: 450, arrowDew: 90,  gachaCoins: 3, chestType: "gold" },
  4: { xp: 500, coins: 700, arrowDew: 150, gachaCoins: 5, chestType: "epic" },
};

// ── 範本 CRUD（後台管理）───────────────────────────────────
export async function getGuildBountyTemplates() {
  const snap = await getDocs(collection(db, C_BOUNTY_TEMPLATES));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeGuildBountyTemplates(cb) {
  return onSnapshot(collection(db, C_BOUNTY_TEMPLATES),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.warn("subscribeGuildBountyTemplates:", err.message); cb([]); }
  );
}

export async function createGuildBountyTemplate(data, adminId) {
  const ref = await addDoc(collection(db, C_BOUNTY_TEMPLATES), {
    title: data.title || "",
    desc:  data.desc  || "",
    difficulty: Number(data.difficulty) || 1,
    requirement: {
      type: "kill_monster",
      monsterId: data.requirement?.monsterId || "",
      killCount: Number(data.requirement?.killCount) || 1,
    },
    active: data.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: adminId,
  });
  return ref.id;
}

export async function updateGuildBountyTemplate(id, data, adminId) {
  await updateDoc(doc(db, C_BOUNTY_TEMPLATES, id), {
    title: data.title || "",
    desc:  data.desc  || "",
    difficulty: Number(data.difficulty) || 1,
    requirement: {
      type: "kill_monster",
      monsterId: data.requirement?.monsterId || "",
      killCount: Number(data.requirement?.killCount) || 1,
    },
    active: data.active !== false,
    updatedAt: serverTimestamp(),
    updatedBy: adminId,
  });
}

export async function toggleGuildBountyTemplateActive(id, active, adminId) {
  await updateDoc(doc(db, C_BOUNTY_TEMPLATES, id), {
    active: !!active, updatedAt: serverTimestamp(), updatedBy: adminId,
  });
}

export async function deleteGuildBountyTemplate(id) {
  await deleteDoc(doc(db, C_BOUNTY_TEMPLATES, id));
}

// ── 難度獎勵表（後台管理，單一文件 config）─────────────────
export async function getGuildBountyRewards() {
  try {
    const snap = await getDoc(doc(db, C_BOUNTY_REWARDS, "config"));
    if (snap.exists()) return { ...DEFAULT_BOUNTY_REWARDS, ...snap.data() };
  } catch (e) { console.warn("getGuildBountyRewards:", e?.message); }
  return DEFAULT_BOUNTY_REWARDS;
}

export function subscribeGuildBountyRewards(cb) {
  return onSnapshot(doc(db, C_BOUNTY_REWARDS, "config"),
    snap => cb(snap.exists() ? { ...DEFAULT_BOUNTY_REWARDS, ...snap.data() } : { ...DEFAULT_BOUNTY_REWARDS }),
    () => cb({ ...DEFAULT_BOUNTY_REWARDS })
  );
}

export async function setGuildBountyRewards(rewardsObj, adminId) {
  await setDoc(doc(db, C_BOUNTY_REWARDS, "config"),
    { ...rewardsObj, updatedAt: serverTimestamp(), updatedBy: adminId }, { merge: true });
}

// ── 每日自動刷新一般懸賞（前台進公會頁時呼叫，內部防重複）──────
// 注意：實際發佈的 guildQuests 文件 questSubtype 沿用既有 "kill_monster"
// （前端擊殺判定/接任/狩獵流程皆以 questSubtype === "kill_monster" 為準，
//  沿用 design.md 原字面值 "general" 會導致無法正確判定擊殺進度）。
// 用 bountySource:"daily_general" + bountyDifficulty 區分於雙週懸賞。
export async function autoPublishDailyGeneralBounties() {
  try {
    const dateKey = todayStr();
    const metaRef = doc(db, "guildMeta", "dailyGeneralBounty");
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data().dateKey === dateKey) {
      return { ok: true, reason: "already_exists" };
    }

    // 1. 下架昨天的舊一般懸賞任務
    const oldSnap = await getDocs(query(collection(db, C_GUILD_Q),
      where("bountySource", "==", "daily_general"), where("status", "==", "active")));
    await Promise.all(oldSnap.docs.map(d => updateDoc(d.ref, { status: "expired" }).catch(() => {})));

    // 2. 讀範本池（僅啟用中）+ 獎勵表
    const templatesSnap = await getDocs(query(collection(db, C_BOUNTY_TEMPLATES), where("active", "==", true)));
    const templates = templatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const rewards = await getGuildBountyRewards();

    // 3a. 讀取每日懸賞設定（已關閉的難度不發任務）
    const settings = await getDailyGeneralSettings();
    const disabledDifficulties = settings.disabledDifficulties || [];

    // 4. 用日期當 seed
    const seed = parseInt(dateKey.replace(/-/g, ""), 10);
    const rand = makeSeedRand(seed);

    // 5. 先從範本池抽選（每個難度最多抽 1 個）
    const templatePicks = [1, 2, 3, 4].map(diff => {
      const pool = templates.filter(t => t.difficulty === diff);
      if (!pool.length) return null;
      return pool[Math.floor(rand() * pool.length)];
    });

    // 6. 對每個難度：有範本用範本，無範本則自動生成（一次生成全部自動任務，避免重複計算）
    const questsToPublish = [];
    const { generateDailyGeneralBounties } = await import("./adventurerSystem");
    const { MONSTERS } = await import("./monsterData");
    const autoGenerated = generateDailyGeneralBounties(dateKey, rewards, rand, MONSTERS);

    [1, 2, 3, 4].forEach(difficulty => {
      if (disabledDifficulties.includes(difficulty)) return;
      const tpl = templatePicks[difficulty - 1];
      if (tpl) {
        const r = rewards[difficulty] || DEFAULT_BOUNTY_REWARDS[difficulty];
        questsToPublish.push({
          title: tpl.title, desc: tpl.desc, type: "normal", questSubtype: "kill_monster",
          requirement: { monsterId: tpl.requirement?.monsterId, killCount: tpl.requirement?.killCount || 1 },
          reward: { xp: r.xp, coins: r.coins, arrowDew: r.arrowDew, gachaCoins: r.gachaCoins },
          bountyDifficulty: difficulty,
          bountySource: "daily_general",
          bountyDateKey: dateKey,
        });
      } else {
        const match = autoGenerated.find(q => q.bountyDifficulty === difficulty);
        if (match) questsToPublish.push(match);
      }
    });

    // 7. 發佈
    for (const q of questsToPublish) {
      await publishGuildQuest(q, "system").catch(() => {});
    }

    await setDoc(metaRef, { dateKey, generatedAt: serverTimestamp() });
    return { ok: true, count: questsToPublish.length };
  } catch (e) { return { ok: false, reason: e.message }; }
}// 前台：接受任務（標記進行中；kill_monster 任務記錄接任時的擊殺基準值）
export async function acceptGuildQuest(memberId, questId, baselineKills = null) {
  if (!memberId || !questId) return;
  const updates = { acceptedQuests: arrayUnion(questId) };
  if (baselineKills !== null) updates[`acceptedKillCounts.${questId}`] = baselineKills;
  await updateDoc(doc(db, C_GUILD, memberId), updates).catch(() =>
    setDoc(doc(db, C_GUILD, memberId), { acceptedQuests: [questId] }, { merge: true })
  );
}

// 前台：會員提交完成（XP/金幣立即發放；徽章待審核）
export async function submitGuildQuestCompletion(memberId, memberName, quest, note, rankMult = 1) {
  if (!memberId || !quest?.id) return;
  // 防重複：先記錄在 guildProgress
  await updateDoc(doc(db, C_GUILD, memberId), {
    submittedQuests: arrayUnion(quest.id),
  }).catch(() =>
    setDoc(doc(db, C_GUILD, memberId), { submittedQuests: [quest.id] }, { merge: true })
  );
  // 立即發放 XP + 金幣 + 箭露 + 扭蛋幣（金幣依階級倍率加成）
  if ((quest.reward?.xp || 0) > 0)         addAdventurerXP(memberId, quest.reward.xp).catch(() => {});
  if ((quest.reward?.coins || 0) > 0)       addCoins(memberId, Math.round(quest.reward.coins * (rankMult || 1))).catch(() => {});
  if ((quest.reward?.arrowDew || 0) > 0)    addArrowdew(memberId, quest.reward.arrowDew).catch(() => {});
  if ((quest.reward?.gachaCoins || 0) > 0)  addGachaCoins(memberId, quest.reward.gachaCoins).catch(() => {});
  // 一般懸賞任務（依當前難度獎勵表固定寶箱）→ 額外發放對應寶箱
  if (quest.bountyDifficulty) {
    (async () => {
      try {
        const rewards = await getGuildBountyRewards();
        const chestType = rewards[quest.bountyDifficulty]?.chestType
          || DEFAULT_BOUNTY_REWARDS[quest.bountyDifficulty]?.chestType;
        if (chestType) {
          await addChests(memberId, [{
            id: `bounty_${quest.id}_${Date.now()}`,
            type: chestType, family: "guild", tier: quest.bountyDifficulty,
            from: "公會懸賞", ts: Date.now(),
          }]);
        }
      } catch (e) { console.warn("bounty chest:", e?.message); }
    })();
  }
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

export async function adminDismissCheckin(checkinId) {
  await updateDoc(doc(db, C_CHECKIN, checkinId), { adminDismissed: true });
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

// ─── 訪客帳號管理已改版（2026-07-09）───────────────────────
// 舊的 token+3小時過期 session 機制（createGuestSession/getGuestSession/
// deleteGuestSession/generateGuestToken）已整個淘汰，改用 guestAuth.js::resolveGuestSession
// （信箱/電話 hash 跨次接續 members 文件）。


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
    if (memberId && data.monsterId && !(await isGuestOrKidMember(memberId))) {
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
    if (contents?.coins) await addCoins(memberId, contents.coins);

    if (chest.type) await updateChestOpenStats(memberId, chest.type);
    return { ok: true, coins: contents?.coins };
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
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      const migrated = migratePotionInventory(snap.exists() ? snap.data() : {});
      const items = { ...migrated.items };
      potions.forEach(p => { items[p.id] = (items[p.id] || 0) + (p.count || 1); });
      tx.set(ref, { items, catalogVersion: migrated.catalogVersion, updatedAt: serverTimestamp() }, { merge: true });
    });
  } catch (e) { console.warn("addPotions:", e?.message); }
}
 
// 訂閱藥劑庫存（即時）
export function subscribePotions(memberId, callback) {
  return onSnapshot(
    doc(db, C_POTIONS, memberId),
    snap => {
      const data = snap.exists() ? snap.data() : {};
      const migrated = migratePotionInventory(data);
      callback(migrated.items);
      if (migrated.migrated) {
        setDoc(doc(db, C_POTIONS, memberId), {
          items: migrated.items,
          catalogVersion: migrated.catalogVersion,
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(e => console.warn("migratePotionInventory:", e?.message));
      }
    },
    err  => { console.warn("subscribePotions:", err.message); callback({}); }
  );
}
 
// 合成藥劑：檢查配方材料（村莊資源）→ 扣材料 + 扣金幣 → 加 1 瓶藥
// 2026-06-30 修正：改從 members/{id}.village.resources 讀取材料（非 materialInventory）
export async function craftPotion(memberId, potionId, craftCount = 1) {
  if (!memberId || !potionId) return { ok: false, reason: "參數錯誤" };
  const potion = POTIONS.find(p => p.id === potionId);
  if (!potion?.recipe?.length) return { ok: false, reason: "這個藥劑沒有合成配方" };
  const executions = Math.max(1, Math.min(999, Math.floor(Number(craftCount) || 1)));
  try {
    const memRef = doc(db, C.members, memberId);
    const invRef = doc(db, C_POTIONS, memberId);
    const outputCount = executions * (potion.craftYield || 1);
    const result = await runTransaction(db, async tx => {
      const [memSnap, invSnap] = await Promise.all([tx.get(memRef), tx.get(invRef)]);
      if (!memSnap.exists()) throw new Error("找不到會員資料");
      const memData = memSnap.data();
      const resources = memData.village?.resources || {};
      const coins = memData.coins || 0;
      for (const r of potion.recipe) {
        const need = r.count * executions;
        const have = Math.floor(resources[r.id] || 0);
        if (have < need) throw new Error(`材料不足：「${r.id}」需要 ${need} 個，目前 ${have} 個`);
      }
      const goldCost = (potion.gold || 0) * executions;
      if (coins < goldCost) throw new Error(`金幣不足：需要 ${goldCost} 金幣，目前 ${Math.floor(coins)} 金幣`);

      const resourceUpdates = {};
      potion.recipe.forEach(r => { resourceUpdates[`village.resources.${r.id}`] = increment(-r.count * executions); });
      resourceUpdates.coins = increment(-goldCost);
      tx.update(memRef, resourceUpdates);

      const migrated = migratePotionInventory(invSnap.exists() ? invSnap.data() : {});
      const items = { ...migrated.items, [potionId]: (migrated.items[potionId] || 0) + outputCount };
      tx.set(invRef, { items, catalogVersion: migrated.catalogVersion, updatedAt: serverTimestamp() }, { merge: true });
      return { outputCount, goldCost };
    });
    await updateCraftStats(memberId, "potion", { potionId, count: outputCount }).catch(() => {});
    return { ok: true, potion, executions, ...result };
  } catch (e) {
    console.warn("craftPotion:", e?.message);
    return { ok: false, reason: e?.message || "系統忙碌中，請稍後再試" };
  }
}
// 使用藥劑（戰鬥開始時呼叫，potionIds = ["heal_s", ...] 每個扣 1 瓶）
export async function usePotions(memberId, potionIds) {
  if (!memberId || !potionIds?.length) return { ok: true };
  try {
    const ref = doc(db, C_POTIONS, memberId);
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      const migrated = migratePotionInventory(snap.exists() ? snap.data() : {});
      const items = { ...migrated.items };
      const needed = potionIds.reduce((out, id) => ({ ...out, [id]: (out[id] || 0) + 1 }), {});
      for (const [pid, count] of Object.entries(needed)) {
        if ((items[pid] || 0) < count) throw new Error("藥劑數量不足");
      }
      Object.entries(needed).forEach(([pid, count]) => { items[pid] -= count; });
      tx.set(ref, { items, catalogVersion: migrated.catalogVersion, updatedAt: serverTimestamp() }, { merge: true });
    });
    return { ok: true };
  } catch (e) {
    console.warn("usePotions:", e?.message);
    return { ok: false, reason: e?.message || "系統忙碌中" };
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
  if (!memberId || !monsterId || await isGuestOrKidMember(memberId)) return;
  await updateMonsterDex(memberId, monsterId, result, 0, dmgDealt || 0).catch(() => {});
}

export async function getRecentCheckinMembers(days = 14) {
  try {
    const start = new Date();
    start.setDate(start.getDate() - Math.max(1, days) + 1);
    const startDate = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}`;
    const snap = await getDocs(query(collection(db, C_CHECKIN), where("date", ">=", startDate)));
    const latest = new Map();
    snap.docs.forEach(d => {
      const data = d.data();
      if (!data.memberId || data.status === "cancelled" || data.status === "rejected") return;
      const current = latest.get(data.memberId);
      if (!current || (data.date || "") > current.date) latest.set(data.memberId, {
        memberId:data.memberId, memberName:data.memberNickname || data.memberName || "", date:data.date,
      });
    });
    return [...latest.values()].sort((a,b) => b.date.localeCompare(a.date));
  } catch (e) { console.warn("getRecentCheckinMembers:", e?.message); return []; }
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
  const ids = Array.isArray(potionIds) ? potionIds : [potionIds].filter(Boolean);
  if (!memberId || !ids.length || await isGuestOrKidMember(memberId)) return;
  const ref = doc(db, C_POTION_DEX, memberId);
  const updates = { updatedAt: serverTimestamp() };
  for (const id of ids) updates[`used.${id}`] = increment(1);
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

export async function recordGuestBattleStats(memberId, entry = {}) {
  if (!memberId) return { ok: false, reason: "missing_member" };
  try {
    const isGuestMember = await isGuestOrKidMember(memberId);
    if (!isGuestMember) return { ok: false, reason: "not_guest" };
    const arrows = Math.max(0, Number(entry.arrows || 0));
    const damage = Math.max(0, Math.round(Number(entry.damage || 0)));
    const score = Math.max(0, Number(entry.score || 0));
    const wins = entry.result === "win" ? 1 : 0;
    const mode = entry.mode || "battle";
    const last = {
      mode,
      result: entry.result || "done",
      arrows,
      damage,
      score,
      avgScore: arrows > 0 ? Math.round((score / arrows) * 10) / 10 : 0,
      target: entry.target || null,
      at: Date.now(),
    };
    await updateDoc(doc(db, C.members, memberId), {
      "guestBattleStats.totalBattles": increment(1),
      "guestBattleStats.totalWins": increment(wins),
      "guestBattleStats.totalArrows": increment(arrows),
      "guestBattleStats.totalDamage": increment(damage),
      "guestBattleStats.totalScore": increment(score),
      "guestBattleStats.last": last,
      "guestBattleStats.recent": arrayUnion(last),
      "guestBattleStats.updatedAt": serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "record_failed" };
  }
}

// ─── 地下城次數管理 ────────────────────────────────────────
export async function markDungeonUsed(memberId) {
  if (!memberId) return;
  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
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
  if (!memberId || await isGuestOrKidMember(memberId)) return;
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
// cardCollections/{memberId} → {
//   cards:{ [monsterId]: {...} },      // 怪物卡（含寶箱怪）
//   wbCards:{ [bossKey]: {...} },      // 世界王卡（獨立卡池）
//   equipped:[ {key,source} | monsterId(舊格式字串), ... ],
// }

const C_CARDS = "cardCollections";

const STAR_UPGRADE_COST = [1, 2, 3, 4, 5];

const EMPTY_COLLECTION = { cards: {}, wbCards: {}, equipped: [] };

// 相容讀取：equipped 陣列元素可能是舊格式字串（monsterId）或新格式 {key,source}
function normalizeEquipped(item) {
  if (typeof item === "string") return { key: item, source: "monster" };
  return item;
}

function normalizeWorldBossCard(key, card = {}) {
  const def = WB_CARDS[key] || {};
  const merged = { ...def, ...card, bossKey: card.bossKey || def.bossKey || key, tier: "worldboss", stars: card.stars || 1 };
  if (merged.statMode === "fixed") {
    merged.stat = merged.stat || def.stat || "atk";
  }
  if (merged.statMode === "choose") {
    merged.stat = null;
    merged.chosenStat = merged.chosenStat || null;
  }
  return merged;
}

function normalizeWorldBossCards(wbCards = {}) {
  return Object.fromEntries(
    Object.entries(wbCards || {}).map(([key, card]) => [key, normalizeWorldBossCard(key, card)])
  );
}

// 依 equipped 項目 + 卡池，解析出實際卡片物件（供計算屬性/被動時使用）
function resolveEquippedCard(item, cards, wbCards) {
  const { key, source } = normalizeEquipped(item);
  return source === "wb" ? wbCards?.[key] : cards?.[key];
}

// cardData = { monsterId, name, icon, tier, family }
export async function addMonsterCard(memberId, cardData, chosenStat) {
  if (!memberId || !cardData?.monsterId || await isGuestOrKidMember(memberId)) return;
  try {
    const ref  = doc(db, C_CARDS, memberId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : EMPTY_COLLECTION;
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
    await setDoc(ref, { cards, wbCards: data.wbCards || {}, equipped: data.equipped || [], updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) { console.warn("addMonsterCard:", e?.message); }
}

// 世界王卡：一隻王一張，沒有重複張數概念。已擁有則直接略過（呼叫端可另外轉換材料）。
// statMode==="choose"（教練系列）時 chosenStat 必填；statMode==="fixed" 直接用 WB_CARDS 內建的 stat。
export async function addWorldBossCard(memberId, bossKey, chosenStat) {
  if (!memberId || !bossKey || await isGuestOrKidMember(memberId)) return { ok: false };
  const cardDef = WB_CARDS[bossKey];
  if (!cardDef) return { ok: false, reason: "找不到世界王卡定義" };
  try {
    const ref  = doc(db, C_CARDS, memberId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : EMPTY_COLLECTION;
    if (data.wbCards?.[bossKey]) return { ok: false, reason: "已擁有此王卡" };
    const wbCards = normalizeWorldBossCards(data.wbCards || {});
    wbCards[bossKey] = {
      ...cardDef, tier: "worldboss", stars: 1,
      stat: cardDef.statMode === "fixed" ? cardDef.stat : null,
      chosenStat: cardDef.statMode === "choose" ? (chosenStat || null) : null,
      ts: Date.now(),
    };
    await setDoc(ref, { cards: data.cards || {}, wbCards, equipped: data.equipped || [], updatedAt: serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (e) { console.warn("addWorldBossCard:", e?.message); return { ok: false, reason: "系統忙碌" }; }
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

// key/source：source==="wb" 為世界王卡，否則為怪物卡（monsterId 即 key）
export async function equipCard(memberId, key, source = "monster") {
  if (!memberId || !key) return { ok: false };
  try {
    const ref  = doc(db, C_CARDS, memberId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : EMPTY_COLLECTION;
    const cards   = data.cards   || {};
    const wbCards = normalizeWorldBossCards(data.wbCards || {});
    const equipped = (data.equipped || []).map(normalizeEquipped);

    if (equipped.some(e => e.key === key && e.source === source)) return { ok: true };

    const targetCard = source === "wb" ? normalizeWorldBossCard(key, wbCards[key]) : cards[key];
    if (!targetCard) return { ok: false, reason: "找不到卡片" };
    if (targetCard.statMode === "choose" && !targetCard.chosenStat) {
      return { ok: false, reason: "請先為這張王卡選擇屬性" };
    }
    if (targetCard.tier === "mythic" && !targetCard.chosenStat) {
      return { ok: false, reason: "請先為這張神話卡選擇屬性" };
    }

    // 世界王卡：獨立欄位，最多 3 張，不分屬性
    if (source === "wb") {
      const wbCount = equipped.filter(e => e.source === "wb").length;
      if (wbCount >= MAX_WB_EQUIPPED) {
        return { ok: false, reason: `世界王卡欄位已達上限（${MAX_WB_EQUIPPED}張），請先卸下一張` };
      }
      await setDoc(ref, { equipped: [...equipped, { key, source }], updatedAt: serverTimestamp() }, { merge: true });
      return { ok: true };
    }

    // 怪物卡：HP/ATK/DEF 各自最多 3 張
    const stat = getCardStat(targetCard);
    const sameStatCount = equipped.filter(e => {
      if (e.source === "wb") return false;
      const c = resolveEquippedCard(e, cards, wbCards);
      return c && getCardStat(c) === stat;
    }).length;
    if (sameStatCount >= MAX_EQUIPPED_PER_STAT) {
      return { ok: false, reason: `${stat.toUpperCase()} 分類已達上限（${MAX_EQUIPPED_PER_STAT}張），請先卸下同分類的卡` };
    }

    await setDoc(ref, { equipped: [...equipped, { key, source }], updatedAt: serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (e) { return { ok: false, reason: "系統忙碌" }; }
}

export async function unequipCard(memberId, key, source = "monster") {
  if (!memberId || !key) return { ok: false };
  try {
    const ref  = doc(db, C_CARDS, memberId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : EMPTY_COLLECTION;
    const equipped = (data.equipped || []).map(normalizeEquipped)
      .filter(e => !(e.key === key && e.source === source));
    const patch = { equipped, updatedAt: serverTimestamp() };
    // 卸下的剛好是目前設定的稱號卡 → 一併清掉稱號
    if (source === "wb" && data.activeTitleBossKey === key) patch.activeTitleBossKey = deleteField();
    await setDoc(ref, patch, { merge: true });
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

// 稱號：從「已裝備的世界王卡」中選一張的 title 當作對外顯示的稱號
export async function setActiveTitle(memberId, bossKey) {
  if (!memberId || !bossKey) return { ok: false };
  try {
    const ref  = doc(db, C_CARDS, memberId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : EMPTY_COLLECTION;
    const equipped = (data.equipped || []).map(normalizeEquipped);
    const isEquipped = equipped.some(e => e.source === "wb" && e.key === bossKey);
    if (!isEquipped) return { ok: false, reason: "這張王卡尚未裝備，無法設為稱號" };
    await updateDoc(ref, { activeTitleBossKey: bossKey, updatedAt: serverTimestamp() });
    return { ok: true };
  } catch (e) { return { ok: false, reason: "系統忙碌" }; }
}

export async function clearActiveTitle(memberId) {
  if (!memberId) return { ok: false };
  try {
    await updateDoc(doc(db, C_CARDS, memberId), { activeTitleBossKey: deleteField() });
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

// 後台限定：手動發放世界王卡（不進任何玩家可觸發的掉落池，只能教練發）
// statMode==="choose" 的教練王卡可由教練直接指定 chosenStat，也可以留空讓玩家自己選
export async function adminGrantWorldBossCard(memberId, bossKey, chosenStat, operatorId) {
  const res = await addWorldBossCard(memberId, bossKey, chosenStat);
  if (res.ok) {
    await createNotification({
      type: "worldboss", targetMemberId: memberId,
      title: "🎁 教練發放了世界王卡片！", content: "你獲得了世界王專屬卡片，快去卡片收藏查看吧！",
      subjectInfo: { bossKey },
    }, operatorId).catch(() => {});
  }
  return res;
}

export async function setWorldBossCardStat(memberId, bossKey, chosenStat) {
  if (!memberId || !bossKey || !chosenStat) return { ok: false };
  try {
    await updateDoc(doc(db, C_CARDS, memberId), { [`wbCards.${bossKey}.chosenStat`]: chosenStat });
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

export function subscribeCardCollection(memberId, callback) {
  if (!memberId) { callback(EMPTY_COLLECTION); return () => {}; }
  return onSnapshot(
    doc(db, C_CARDS, memberId),
    snap => {
      const data = snap.exists() ? { ...EMPTY_COLLECTION, ...snap.data() } : EMPTY_COLLECTION;
      callback({ ...data, wbCards: normalizeWorldBossCards(data.wbCards || {}) });
    },
    err  => { console.warn("subscribeCardCollection:", err?.message); callback(EMPTY_COLLECTION); }
  );
}

// ──────────────────────────────────────────────────────────
async function updateCraftStats(memberId, type, data) {
  if (!memberId) return;
  const ref  = doc(db, C_CRAFT_STATS, memberId);
  const snap = await getDoc(ref);
  const stats = snap.exists() ? snap.data() : {};
  if (type === "potion") {
    const count = Math.max(1, Math.floor(data.count || 1));
    stats.potionsCrafted = (stats.potionsCrafted || 0) + count;
    stats.potionTypesCrafted = stats.potionTypesCrafted || {};
    stats.potionTypesCrafted[data.potionId] = (stats.potionTypesCrafted[data.potionId] || 0) + count;
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
// clientCard: profile.monthlyCard — 從 client 傳入，避免 getDoc
// hasPending: 從 subscribeMyMonthlyRequests 的現有資料判斷
export async function submitMonthlyCardRequest(memberId, memberName, hours, clientCard = null, hasPending = false) {
  if (!memberId || ![1, 2].includes(hours)) return { ok: false, reason: "參數錯誤" };
  try {
    if (hasPending) return { ok: false, reason: "已有待審核申請，請等待教練處理" };
    const card = clientCard;
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
    .filter(isOfficial)
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

// 商品白名單購買：扣款、發貨與限購計數必須在同一交易完成。
export async function shopBuyProduct(memberId, productId) {
  if (!memberId || !productId) return { ok:false, reason:"商品參數錯誤" };
  const product = SHOP_PRODUCT_MAP.get(productId);
  if (!product) return { ok:false, reason:"這項商品未開放販售" };

  const periodKey = getShopPeriodKey(product);
  const memberRef = doc(db, C.members, memberId);
  const destination = product.kind === "chest"
    ? doc(db, C_CHESTS, memberId)
    : product.kind === "material"
      ? doc(db, C_MATERIALS, memberId)
      : null;

  try {
    await runTransaction(db, async transaction => {
      const memberSnap = await transaction.get(memberRef);
      if (!memberSnap.exists()) throw new Error("找不到會員資料");
      const destinationSnap = destination ? await transaction.get(destination) : null;
      const member = memberSnap.data();
      const coins = Math.floor(member.coins || 0);
      const purchases = member.coinShopPurchases || {};
      const periodPurchases = purchases[periodKey] || {};
      const purchased = periodPurchases[product.id] || 0;

      if (purchased >= product.limit) throw new Error("本期已達購買上限");
      if (coins < product.price) throw new Error(`金幣不足（需要 ${product.price.toLocaleString()}）`);

      const memberUpdate = {
        coins: coins - product.price,
        coinShopPurchases: {
          ...purchases,
          [periodKey]: { ...periodPurchases, [product.id]: purchased + 1 },
        },
        updatedAt: serverTimestamp(),
      };

      if (product.kind === "gachaCoins") {
        memberUpdate.gachaCoins = Math.floor(member.gachaCoins || 0) + product.amount;
      } else if (product.kind === "dungeonScroll") {
        memberUpdate.dungeonScrollCount = Math.floor(member.dungeonScrollCount || 0) + product.amount;
      } else if (product.kind === "chest") {
        const current = destinationSnap?.exists() ? (destinationSnap.data().chests || []) : [];
        const chest = {
          id:`chest_shop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type:product.chestType, family:"shop", tier:"common", from:"金幣商店", ts:Date.now(),
        };
        transaction.set(destination, { chests:[...current, chest], updatedAt:serverTimestamp() }, { merge:true });
      } else if (product.kind === "material") {
        const items = destinationSnap?.exists() ? (destinationSnap.data().items || {}) : {};
        transaction.set(destination, {
          items:{ ...items, [product.materialId]:(items[product.materialId] || 0) + product.amount },
          updatedAt:serverTimestamp(),
        }, { merge:true });
      } else {
        throw new Error("尚未支援這種商品");
      }

      transaction.update(memberRef, memberUpdate);
    });
    return { ok:true, product, periodKey };
  } catch (error) {
    console.warn("shopBuyProduct:", error?.message);
    return { ok:false, reason:error?.message || "購買失敗，請稍後再試" };
  }
}

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
    const memberRef = doc(db, C.members, memberId);
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(memberRef);
      if (!snap.exists()) throw new Error("找不到會員資料");
      const data = snap.data();
      const coins = Math.floor(data.coins || 0);
      if (coins < price) throw new Error(`金幣不足（需要 ${price.toLocaleString()}）`);
      const cur = data.rpgEquip?.[slotId];
      transaction.update(memberRef, {
        coins:coins - price,
        unlockedEquipItems:{ ...(data.unlockedEquipItems || {}), [itemId]:true },
        [`rpgEquip.${slotId}`]:cur?.itemId
          ? { ...cur, itemId }
          : { itemId, grade:"common", plusLevel:0 },
        updatedAt:serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "購買失敗，請稍後再試" };
  }
}

export async function shopUnlockEquipAppearance(memberId, itemId) {
  if (!memberId || !itemId) return { ok:false, reason:"外觀參數錯誤" };
  try {
    const memberRef = doc(db, C.members, memberId);
    const itemRef = doc(db, C_EQUIP_ITEMS, itemId);
    let paid = 0;
    await runTransaction(db, async transaction => {
      const [memberSnap, itemSnap] = await Promise.all([
        transaction.get(memberRef),
        transaction.get(itemRef),
      ]);
      if (!memberSnap.exists() || !itemSnap.exists()) throw new Error("找不到這個裝備外觀");
      const member = memberSnap.data();
      if (member.unlockedEquipItems?.[itemId]) throw new Error("已經解鎖這個外觀");
      const item = itemSnap.data();
      const slot = EQUIP_SLOT_DEFS.find(entry => entry.id === item.slotId);
      const price = slot?.stat === "atk" ? 1500 : slot?.stat === "def" ? 1300 : 1000;
      const coins = Math.floor(member.coins || 0);
      if (coins < price) throw new Error(`金幣不足（需要 ${price.toLocaleString()}）`);
      paid = price;
      transaction.update(memberRef, {
        coins:coins - price,
        unlockedEquipItems:{ ...(member.unlockedEquipItems || {}), [itemId]:true },
        updatedAt:serverTimestamp(),
      });
    });
    return { ok:true, price:paid };
  } catch (error) {
    return { ok:false, reason:error?.message || "解鎖失敗，請稍後再試" };
  }
}

export async function shopRecycleMaterial(memberId, materialId, amount = 1) {
  const material = MATERIALS.find(item => item.id === materialId);
  const tier = Number(materialId?.match(/_m([1-3])$/)?.[1]);
  if (!memberId || !material || !tier || amount < 1) return { ok:false, reason:"這項素材不能回收" };
  const unitPrice = { 1:10, 2:25, 3:60 }[tier];
  const dailyKey = getShopDailyKey();
  try {
    let earned = 0;
    await runTransaction(db, async transaction => {
      const memberRef = doc(db, C.members, memberId);
      const inventoryRef = doc(db, C_MATERIALS, memberId);
      const [memberSnap, inventorySnap] = await Promise.all([
        transaction.get(memberRef), transaction.get(inventoryRef),
      ]);
      if (!memberSnap.exists()) throw new Error("找不到會員資料");
      const member = memberSnap.data();
      const items = inventorySnap.exists() ? (inventorySnap.data().items || {}) : {};
      const recycled = member.coinShopRecycle?.[dailyKey] || 0;
      const allowed = Math.min(amount, 20 - recycled);
      if (allowed <= 0) throw new Error("今日素材回收已達 20 個上限");
      if ((items[materialId] || 0) < allowed) throw new Error("素材數量不足");
      earned = allowed * unitPrice;
      transaction.set(inventoryRef, {
        items:{ ...items, [materialId]:items[materialId] - allowed },
        updatedAt:serverTimestamp(),
      }, { merge:true });
      transaction.update(memberRef, {
        coins:Math.floor(member.coins || 0) + earned,
        coinShopRecycle:{ ...(member.coinShopRecycle || {}), [dailyKey]:recycled + allowed },
        updatedAt:serverTimestamp(),
      });
    });
    return { ok:true, earned };
  } catch (error) {
    return { ok:false, reason:error?.message || "回收失敗，請稍後再試" };
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
    const memberSnap = await getDoc(doc(db, C.members, memberId));
    const member = memberSnap.data() || {};
    const currentItemId = member.rpgEquip?.[slotId]?.itemId;
    if (currentItemId !== itemId && !member.unlockedEquipItems?.[itemId]) {
      return { ok:false, reason:"請先到金幣商店永久解鎖這個外觀" };
    }
    await updateDoc(doc(db, C.members, memberId), {
      [`rpgEquip.${slotId}.itemId`]: itemId,
      unlockedEquipItems:{
        ...(member.unlockedEquipItems || {}),
        ...(currentItemId ? { [currentItemId]:true } : {}),
        [itemId]:true,
      },
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 卸下槽位
export async function unequipSlot(memberId, slotId) {
  if (!memberId || !slotId) return { ok: false, reason: "參數錯誤" };
  try {
    const memberRef = doc(db, C.members, memberId);
    const memberSnap = await getDoc(memberRef);
    const member = memberSnap.data() || {};
    const currentItemId = member.rpgEquip?.[slotId]?.itemId;
    await updateDoc(doc(db, C.members, memberId), {
      [`rpgEquip.${slotId}`]: deleteField(),
      ...(currentItemId ? {
        unlockedEquipItems:{ ...(member.unlockedEquipItems || {}), [currentItemId]:true },
      } : {}),
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 升級槽位：+1 plusLevel；滿 5 → 升一品級並重置
// 回傳 { ok, upgraded, newGrade, newPlusLevel, reason }
// clientData: { equip, coins, matItems, nextMats } — 從 client 訂閱資料傳入，避免 getDoc 讀取
export async function upgradeEquipSlot(memberId, slotId, clientData = {}) {
  if (!memberId || !slotId) return { ok: false, reason: "參數錯誤" };
  try {
    const equip = clientData.equip;
    if (!equip?.itemId) return { ok: false, reason: "該槽位尚未裝備" };

    const gradeIdx = EQUIP_GRADES.findIndex(g => g.id === equip.grade);
    const isMaxGrade = gradeIdx >= EQUIP_GRADES.length - 1;
    if (isMaxGrade && (equip.plusLevel || 0) >= 4) {
      return { ok: false, reason: "已達最高品級神話+4，無法繼續升級" };
    }

    const cost = EQUIP_UPGRADE_COST[equip.grade];
    if (!cost) return { ok: false, reason: "找不到升級費用設定" };

    const coins    = clientData.coins ?? 0;
    const matItems = clientData.matItems ?? {};
    const mats     = clientData.nextMats || {};

    // 檢查金幣
    if (coins < cost.gold) {
      return { ok: false, reason: `金幣不足（需 ${cost.gold}，現有 ${coins}）` };
    }

    // 檢查材料庫存（用隨機 nextMats）
    for (const req of (mats.materials || [])) {
      if ((matItems[req.id] || 0) < req.count) {
        return { ok: false, reason: `材料不足（需 ${req.id} ×${req.count}）` };
      }
    }
    if (mats.keyItem && (matItems[mats.keyItem.id] || 0) < mats.keyItem.count) {
      return { ok: false, reason: `缺少關鍵材料：${mats.keyItem.note || mats.keyItem.id}` };
    }

    // 計算新等級
    let newPlusLevel = (equip.plusLevel || 0) + 1;
    let newGrade = equip.grade;
    let upgraded = false;
    if (newPlusLevel >= 5 && !isMaxGrade) {
      newPlusLevel = 0;
      newGrade = EQUIP_GRADES[gradeIdx + 1].id;
      upgraded = true;
    }

    const memRef = doc(db, C.members, memberId);
    const matRef = doc(db, C_MATERIALS, memberId);

    // 扣材料（用隨機 nextMats）
    const matUpdates = { updatedAt: serverTimestamp() };
    for (const req of (mats.materials || [])) {
      matUpdates[`items.${req.id}`] = increment(-req.count);
    }
    if (mats.keyItem) {
      matUpdates[`items.${mats.keyItem.id}`] = increment(-mats.keyItem.count);
    }

    // 升級完成後產生下一輪隨機材料（材料需求隨 newPlusLevel 遞增，見 equipData.generateRandomMats 曲線）
    const newNextMats = generateRandomMats(newGrade, newPlusLevel);

    // 材料 + 會員（金幣＋裝備＋nextMats）兩個文件同時寫入
    await Promise.all([
      updateDoc(matRef, matUpdates).catch(() => setDoc(matRef, matUpdates, { merge: true })),
      updateDoc(memRef, {
        coins: increment(-cost.gold),
        [`rpgEquip.${slotId}.plusLevel`]: newPlusLevel,
        [`rpgEquip.${slotId}.grade`]:     newGrade,
        [`rpgEquip.${slotId}.nextMats`]:  newNextMats,
        updatedAt: serverTimestamp(),
      }),
    ]);

    return { ok: true, upgraded, newGrade, newPlusLevel };
  } catch (e) {
    console.warn("upgradeEquipSlot:", e?.message);
    return { ok: false, reason: e?.message || "系統錯誤" };
  }
}

// 初始化或刷新裝備槽位的隨機材料需求
export async function saveEquipNextMats(memberId, slotId, mats) {
  if (!memberId || !slotId || !mats) return;
  try {
    await updateDoc(doc(db, C.members, memberId), {
      [`rpgEquip.${slotId}.nextMats`]: mats,
      updatedAt: serverTimestamp(),
    });
  } catch (e) { console.warn("saveEquipNextMats:", e?.message); }
}

// ─── 遠征隊 ────────────────────────────────────────────────

// 派遣遠征：扣射手資源、寫入 expeditions.{slotIdx} 狀態
// archerCost: { archer_t1: 50, archer_t2: 30, ... }（從客戶端傳入）
export async function startExpedition(memberId, slotIdx, catId, catName, missionTier, hours, archerCost) {
  if (!memberId || !catId || !missionTier) return { ok: false, reason: "參數錯誤" };
  try {
    const endsAt = new Date(Date.now() + hours * 3600000);
    const updates = {
      [`expeditions.${slotIdx}`]: {
        catId, catName, missionTier, hours,
        startedAt: serverTimestamp(),
        endsAt: Timestamp.fromDate(endsAt),
        status: "active",
        archerCost,
      },
      updatedAt: serverTimestamp(),
    };
    for (const [key, count] of Object.entries(archerCost)) {
      updates[`village.resources.${key}`] = increment(-count);
    }
    await updateDoc(doc(db, C.members, memberId), updates);
    return { ok: true };
  } catch (e) {
    console.warn("startExpedition:", e?.message);
    return { ok: false, reason: e?.message || "系統錯誤" };
  }
}

// 領取遠征獎勵：寫入資源、清除 expeditions.{slotIdx}
// rewards: { fur_t1: 3, potion_t2: 2, arrowdew: 20, catXP: 400, catBond: 8, ... }
// catId：本趟出征的貓，用來發 catXP/catBond（沒傳則跳過貓獎勵）
export async function collectExpedition(memberId, slotIdx, rewards, catId = null) {
  if (!memberId || !rewards) return { ok: false, reason: "參數錯誤" };
  try {
    const updates = {
      [`expeditions.${slotIdx}`]: null,
      updatedAt: serverTimestamp(),
    };
    for (const [key, count] of Object.entries(rewards)) {
      if (!count) continue;
      // catXP/catBond 不是村莊資源，另外處理（見下方），這裡略過
      if (key === "catXP" || key === "catBond") continue;
      if (key === "gachaToken") {
        updates["gachaCoins"] = increment(count);
      } else {
        updates[`village.resources.${key}`] = increment(count);
      }
    }
    await updateDoc(doc(db, C.members, memberId), updates);

    // 貓咪 XP / 羈絆：導向專用寫入函式（clamp 與採集結算一致）
    if (catId) {
      const catXP = Math.max(0, Math.min(800, Math.round(Number(rewards.catXP) || 0)));
      const catBond = Math.max(0, Math.min(15, Math.round(Number(rewards.catBond) || 0)));
      const catPromises = [];
      if (catXP > 0) catPromises.push(addCatXP(memberId, catId, catXP));
      if (catBond > 0) catPromises.push(addCatBond(memberId, catId, "expedition", catBond));
      if (catPromises.length) await Promise.all(catPromises);
    }
    return { ok: true };
  } catch (e) {
    console.warn("collectExpedition:", e?.message);
    return { ok: false, reason: e?.message || "系統錯誤" };
  }
}

// ─── 練箭里程碑獎勵 ────────────────────────────────────────
// 唯一的實際發獎函式：milestones 是 getMilestonesReached() 回傳的陣列，
// 內部會依 arrowMilestoneDone 自行去重，呼叫端不需要自己先過濾。
// 2026-07-09：修掉 checkAndGrantArrowMilestones 曾經讀 r.rewards（該欄位根本不存在，
// 恆為 undefined）導致轉蛋幣/貓貓箱永遠沒發、但又把門檻標記成已領的 bug——
// 現在統一只有這一個函式真正發獎，checkAndGrantArrowMilestones 改成委派給它。
export async function grantArrowMilestoneRewards(memberId, milestones) {
  if (!memberId || !milestones?.length) return;

  // 防重複：今日已發過的門檻直接跳過
  const today = new Date().toISOString().slice(0, 10);
  const memberSnap = await getDoc(doc(db, C.members, memberId));
  const done = memberSnap.data()?.arrowMilestoneDone || {};
  const toGrant = milestones.filter(ms => done[String(ms.arrows)] !== today);
  if (!toGrant.length) return;

  for (const ms of toGrant) {
    const r = getRewardsForMilestone(ms);

    // 貓貓箱（存入 chestInventory）
    if ((r.catBoxes || 0) > 0) {
      const chests = Array.from({ length: r.catBoxes }, (_, i) => ({
        id: `arrow_cat_${memberId}_${ms.arrows}_${i}_${Date.now()}`,
        type: "cat_box", family: "practice", tier: "common",
        from: `練箭里程碑（${ms.arrows}箭）`, ts: Date.now(),
      }));
      await addChests(memberId, chests).catch(() => {});
    }

    // 扭蛋幣 + 標記今日已發
    const updates = { [`arrowMilestoneDone.${ms.arrows}`]: today };
    if ((r.gachaCoins || 0) > 0) updates.gachaCoins = increment(r.gachaCoins);
    await updateDoc(doc(db, C.members, memberId), updates).catch(() => {});
  }
}

// ●● 使用者共用箭數里程碑檢查（取代各模式各自傳入 0 導致每日重複跳出的 bug）●●
// 自動查詢今日練習紀錄的實際累計箭數，正確計算穿越了哪些門檻，實際發獎交給 grantArrowMilestoneRewards。
export async function checkAndGrantArrowMilestones(memberId, sessionArrowCount) {
  if (!memberId || !sessionArrowCount || sessionArrowCount <= 0 || await isGuestOrKidMember(memberId)) {
    return { milestones: [] };
  }
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  let newTotal = 0;
  try {
    const snap = await getDocs(query(
      collection(db, C.practiceLogs),
      where("memberId", "==", memberId),
      where("date", "==", today)
    ));
    for (const logDoc of snap.docs) {
      const n = logDoc.data()?.totalArrows;
      if (typeof n === "number") newTotal += n;
    }
  } catch (_) {}
  // newTotal 是這次查詢當下 practiceLogs 加總的今日箭數。呼叫端通常在 addPracticeLog
  // 沒等待完成（fire-and-forget）的情況下緊接著呼叫這裡，這筆查詢可能剛好還沒撈到
  // 本次剛寫入的那筆紀錄——用「newTotal 反推 oldTotal」而不是「查到的 oldTotal 再加一次
  // sessionArrowCount」，避免本次箭數被重複計算兩次。
  const oldTotal = Math.max(0, newTotal - sessionArrowCount);
  const effectiveNewTotal = Math.max(newTotal, sessionArrowCount);

  const milestones = getMilestonesReached(oldTotal, effectiveNewTotal);
  if (milestones.length === 0) return { milestones: [] };

  try {
    const memberSnap = await getDoc(doc(db, C.members, memberId));
    const done = memberSnap.data()?.arrowMilestoneDone || {};
    const toGrant = milestones.filter(m => done[String(m.arrows)] !== today);
    if (toGrant.length === 0) return { milestones: [] };

    await grantArrowMilestoneRewards(memberId, toGrant);
    return { milestones: toGrant };
  } catch (_) {
    return { milestones: [] };
  }
}

// ─── 扭蛋機：抽卡 ──────────────────────────────────────────
export async function drawGachaCards(memberId, type = "single") {
  const count = type === "single" ? 1 : 11;
  const cost  = type === "single" ? 1 : 10;

  const member = await getMember(memberId);
  const coins  = member?.gachaCoins || 0;
  if (coins < cost) return { ok: false, reason: `需要 ${cost} 枚扭蛋幣` };

  const { rollGacha } = await import("./catCardData");
  const drawn = Array.from({ length: count }, () => rollGacha());

  const updates = { gachaCoins: increment(-cost) };
  const prevCards = member?.catCards || {};
  const results = drawn.map(id => {
    const isNew = !prevCards[id];
    updates[`catCards.${id}`] = increment(1);
    return { id, isNew };
  });

  await updateDoc(doc(db, C.members, memberId), updates);
  return { ok: true, results };
}

// ─── 貓貓村 ────────────────────────────────────────────────
export async function collectVillageResources(memberId, village) {
  var now = Date.now();
  var lastMs = village?.lastCollectedAt?.toMillis?.() || (now - 3600000);
  var hours = Math.min((now - lastMs) / 3600000, MAX_COLLECT_HOURS);
  if (hours < 0.05) return { collected: {}, hours: 0 };

  var buildings    = village?.buildings    || {};
  var allocations  = village?.allocations  || {};
  var collected    = {};
  var updates      = { "village.lastCollectedAt": serverTimestamp() };

  for (var id of BUILDING_LIST) {
    if (!isBuildingUnlocked(id, buildings)) continue;
    var lv     = buildings[id] || 1;
    var res    = VB[id]?.resource;
    if (!res) continue;

    // Gacha: accumulate to top-level gachaCoins
    if (id === "gacha") {
      var fracKey  = "gachaTokenFrac";
      var prevFrac = village?.resources?.[fracKey] || 0;
      var rawAmt   = getProductionRate(id, lv) * hours + prevFrac;
      var amt      = Math.floor(rawAmt);
      var remain   = Math.round((rawAmt - amt) * 1000) / 1000;
      updates["village.resources." + fracKey] = remain;
      if (amt > 0) {
        updates.gachaCoins = increment(amt);
        collected.gachaCoins = (collected.gachaCoins || 0) + amt;
      }
      continue;
    }

    var rate    = getProductionRate(id, lv);
    var maxTier = getBuildingStage(lv);

    if (!TIERED_RESOURCES.has(res)) {
      // Non-tiered resources (arrowdew etc.)
      var resKey  = res;
      var fracKey = resKey + "Frac";
      var prevFrac = village?.resources?.[fracKey] || 0;
      var rawAmt   = rate * hours + prevFrac;
      var amt      = Math.floor(rawAmt);
      var remain   = Math.round((rawAmt - amt) * 1000) / 1000;
      updates["village.resources." + fracKey] = remain;
      if (amt > 0) {
        updates["village.resources." + resKey] = increment(amt);
        collected[resKey] = (collected[resKey] || 0) + amt;
      }
    } else {
      // Tiered resources: pool * stageMult, split by allocation%
      var stageMult = getStageMultiplier(lv);
      var pool      = rate * stageMult * hours;
      var alloc     = allocations[id] || getDefaultAllocation(lv);

      // Calculate per-tier raw values (including fraction carryover)
      var tierRaw = {};
      for (var tier = 1; tier <= maxTier; tier++) {
        var pct    = alloc[String(tier)] || 0;
        if (pct <= 0) continue;
        var resKey2  = getResourceKey(res, tier);
        var fracKey2 = resKey2 + "Frac";
        var prevFrac2 = village?.resources?.[fracKey2] || 0;
        var rawAmt2   = pool * (pct / 100) + prevFrac2;
        tierRaw[String(tier)] = { resKey: resKey2, fracKey: fracKey2, rawAmt: rawAmt2 };
      }

      // Write updates
      var tierKeys = Object.keys(tierRaw);
      for (var ti = 0; ti < tierKeys.length; ti++) {
        var t = tierKeys[ti];
        var item = tierRaw[t];
        var amt2 = Math.floor(item.rawAmt);
        var remain2 = Math.round((item.rawAmt - amt2) * 1000) / 1000;
        updates["village.resources." + item.fracKey] = remain2;
        if (amt2 > 0) {
          updates["village.resources." + item.resKey] = increment(amt2);
          collected[item.resKey] = (collected[item.resKey] || 0) + amt2;
        }
      }
    }
  }

  await updateDoc(doc(db, C.members, memberId), updates);
  var curResources = Object.assign({}, village?.resources || {});
  Object.keys(collected).forEach(function(k) { curResources[k] = (curResources[k] || 0) + collected[k]; });
  return { collected: collected, resources: curResources, hours: hours };
}

// ── Set per-building allocation ────────────────────────────
export async function setBuildingAllocation(memberId, buildingId, allocation) {
  if (!memberId || !buildingId || !allocation) return;
  await updateDoc(doc(db, C.members, memberId), {
    [`village.allocations.${buildingId}`]: allocation,
  });
}

export async function upgradeVillageBuilding(memberId, buildingId, village) {
  const buildings = village?.buildings || DEFAULT_VILLAGE.buildings;
  const resources = { ...(village?.resources || DEFAULT_VILLAGE.resources) };
  const currentLevel = buildings[buildingId] || 1;
  if (currentLevel >= 20) throw new Error("已達最高等級");

  const req = getUpgradeRequirements(buildingId, currentLevel + 1);
  if (!req) throw new Error("無法升級");

  if ((resources.arrowdew || 0) < req.arrowdew) throw new Error("箭露不足");
  for (const mat of req.materials) {
    const resKey = getResourceKey(mat.resource, mat.tier);
    if ((resources[resKey] || 0) < mat.count) throw new Error("材料不足");
  }

  const deductUpdates = {
    [`village.buildings.${buildingId}`]: currentLevel + 1,
    "village.resources.arrowdew": increment(-req.arrowdew),
  };
  for (const mat of req.materials) {
    const resKey = getResourceKey(mat.resource, mat.tier);
    deductUpdates[`village.resources.${resKey}`] = increment(-mat.count);
  }

  await updateDoc(doc(db, C.members, memberId), deductUpdates);

  resources.arrowdew = (resources.arrowdew || 0) - req.arrowdew;
  for (const mat of req.materials) {
    const resKey = getResourceKey(mat.resource, mat.tier);
    resources[resKey] = (resources[resKey] || 0) - mat.count;
  }
  return { newLevel: currentLevel + 1, resources };
}

// 市集材料換算：升階 5T(n)→1T(n+1)，降階 1T(n)→3T(n-1)
export async function exchangeVillageMaterial(memberId, resource, fromTier, direction) {
  if (!TIERED_RESOURCES.has(resource)) throw new Error('不支援此材料');
  const fromKey = `${resource}_t${fromTier}`;
  if (direction === 'up') {
    if (fromTier >= 5) throw new Error('已是最高階');
    const toKey = `${resource}_t${fromTier + 1}`;
    await updateDoc(doc(db, C.members, memberId), {
      [`village.resources.${fromKey}`]: increment(-5),
      [`village.resources.${toKey}`]:   increment(1),
    });
  } else {
    if (fromTier <= 1) throw new Error('已是最低階');
    const toKey = `${resource}_t${fromTier - 1}`;
    await updateDoc(doc(db, C.members, memberId), {
      [`village.resources.${fromKey}`]: increment(-1),
      [`village.resources.${toKey}`]:   increment(3),
    });
  }
}

export async function addArrowdew(memberId, amount) {
  if (!memberId || !amount) return;
  await updateDoc(doc(db, C.members, memberId), {
    "village.resources.arrowdew": increment(amount),
  });
}

export async function addArcherXP(memberId, amount) {
  if (!memberId || !amount || amount <= 0) return;
  await updateDoc(doc(db, C.members, memberId), {
    archerXP: increment(Math.round(amount)),
  });
}

export async function addGachaCoins(memberId, amount) {
  if (!memberId || !amount || amount <= 0) return;
  await updateDoc(doc(db, C.members, memberId), {
    gachaCoins: increment(Math.round(amount)),
  });
}

// costs = [{ resource, tier, count }, ...]
export async function exchangeMaterialsForChest(memberId, chestType, costs, family = null) {
  const snap = await getDoc(doc(db, C.members, memberId));
  const village = snap.data()?.village || {};
  const RES_CN = { ore:'礦物', melon:'瓜瓜', fish:'鮮魚', meat:'動物肉', driedfish:'小魚乾', can:'貓罐頭', potion:'貓薄荷藥水', fur:'貓毛' };
  for (const { resource, tier, count } of costs) {
    const have = Math.floor(village?.resources?.[`${resource}_t${tier}`] || 0);
    if (have < count) throw new Error(`${RES_CN[resource] || resource} T${tier} 不足（需 ${count}，目前 ${have}）`);
  }
  const updates = {};
  costs.forEach(({ resource, tier, count }) => {
    updates[`village.resources.${resource}_t${tier}`] = increment(-count);
  });
  await updateDoc(doc(db, C.members, memberId), updates);
  const chest = { id: `vmarket_${Date.now()}`, type: chestType, from: "village_market", ts: Date.now() };
  if (family) chest.family = family;
  await addChests(memberId, [chest]);
}

// ── 卡片掛賣市集 ─────────────────────────────────────────────
const C_CARD_MARKET = "cardMarket";

export function subscribeCardMarket(callback) {
  const nowSec = Date.now() / 1000;
  return onSnapshot(
    query(collection(db, C_CARD_MARKET), where("status", "==", "active")),
    snap => callback(
      snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(l => !l.expiredAt || l.expiredAt.seconds > nowSec)
        .sort((a,b) => (b.listedAt?.seconds||0)-(a.listedAt?.seconds||0))
    ),
    () => callback([])
  );
}

export async function listCardForSale(memberId, memberName, cardId, cardData, priceType, priceAmount) {
  const memberRef = doc(db, C.members, memberId);
  const snap = await getDoc(memberRef);
  const cnt = snap.data()?.catCards?.[cardId] || 0;
  if (cnt < 2) throw new Error('需要擁有 2 張以上同張卡片才能掛賣');
  const batch = writeBatch(db);
  batch.update(memberRef, { [`catCards.${cardId}`]: increment(-1) });
  const listingRef = doc(collection(db, C_CARD_MARKET));
  batch.set(listingRef, {
    sellerId: memberId, sellerName: memberName,
    cardId, cardName: cardData.name, cardEmoji: cardData.emoji,
    cardBg: cardData.bg, cardCat: cardData.cat,
    priceType, priceAmount,
    status: "active",
    listedAt: serverTimestamp(),
    expiredAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 3600000)),
  });
  await batch.commit();
}

// offeredCardId：priceType==="card" 時，買家選擇要提供的重複卡片 ID
// 買家只寫自己的文件（扣款+拿到卡片），賣家的款項改成事後自行請領（見 claimCardSaleProceeds），
// 避免買家瀏覽器直接寫入賣家文件被 firestore.rules 擋掉（members 只能改自己的文件）
export async function buyCardListing(buyerId, buyerName, listing, offeredCardId = null) {
  if (!buyerId || !listing?.id) throw new Error('參數錯誤');
  if (listing.sellerId === buyerId) throw new Error('不能購買自己的掛賣');
  const listingRef = doc(db, C_CARD_MARKET, listing.id);
  const [lSnap, bSnap] = await Promise.all([getDoc(listingRef), getDoc(doc(db, C.members, buyerId))]);
  if (!lSnap.exists() || lSnap.data()?.status !== "active") throw new Error('此掛賣已下架');
  const bData = bSnap.data() || {};
  const batch = writeBatch(db);

  if (listing.priceType === "arrowdew") {
    const have = bData?.village?.resources?.arrowdew || 0;
    if (have < listing.priceAmount) throw new Error(`箭露不足（需要 ${listing.priceAmount}）`);
    batch.update(doc(db, C.members, buyerId), { "village.resources.arrowdew": increment(-listing.priceAmount) });
  } else if (listing.priceType === "gachaToken") {
    const have = bData?.gachaCoins || 0;
    if (have < listing.priceAmount) throw new Error(`扭蛋幣不足（需要 ${listing.priceAmount}）`);
    batch.update(doc(db, C.members, buyerId), { gachaCoins: increment(-listing.priceAmount) });
  } else if (listing.priceType === "card") {
    if (!offeredCardId) throw new Error('請選擇要提供的交換卡片');
    const buyerCnt = bData?.catCards?.[offeredCardId] || 0;
    if (buyerCnt < 2) throw new Error('你需要擁有 2 張以上此卡片才能用於交換');
    // 賣家是否已擁有這張卡片，留給賣家請領時（claimCardSaleProceeds）再次確認，避免這裡多讀一次賣家文件
    batch.update(doc(db, C.members, buyerId), { [`catCards.${offeredCardId}`]: increment(-1) });
  }

  batch.update(doc(db, C.members, buyerId), { [`catCards.${listing.cardId}`]: increment(1) });
  batch.update(listingRef, {
    status: "sold", buyerId, buyerName, soldAt: serverTimestamp(),
    sellerClaimed: false,
    offeredCardId: listing.priceType === "card" ? offeredCardId : null,
  });
  await batch.commit();

  // 查詢交換卡片名稱（card 交換時）
  let offeredCardName = "";
  if (listing.priceType === "card" && offeredCardId) {
    const { CAT_CARDS } = await import("./catCardData");
    offeredCardName = CAT_CARDS.find(c => c.id === offeredCardId)?.name || offeredCardId;
  }

  // 通知賣家（款項待開啟市集頁自動請領，不是已經到帳）
  const priceText = listing.priceType === "arrowdew"
    ? `箭露 ×${listing.priceAmount}`
    : listing.priceType === "gachaToken"
      ? `扭蛋幣 ×${listing.priceAmount}`
      : `「${offeredCardName}」（卡片交換）`;
  await createNotification({
    type: "market_sale",
    title: `🎉 卡片已售出！`,
    content: `${buyerName} 購買了你的「${listing.cardName}」，開啟市集頁即可領取 ${priceText}`,
    targetMemberId: listing.sellerId,
    subjectMemberId: buyerId,
    subjectInfo: { cardName: listing.cardName, priceType: listing.priceType, priceAmount: listing.priceAmount, offeredCardName },
  }, buyerId);

  // 通知買家（告知收到了哪張卡）
  const fromText = listing.priceType === "card"
    ? `以「${offeredCardName}」交換`
    : `以 ${priceText} 購得`;
  await createNotification({
    type: "market_sale",
    title: `🛒 卡片入手！`,
    content: `${fromText}「${listing.cardName}」，已加入你的卡片收藏`,
    targetMemberId: buyerId,
    subjectMemberId: listing.sellerId,
    subjectInfo: { cardName: listing.cardName },
  }, buyerId);
}

// 賣家自行請領已售出的款項/交換卡片（見 buyCardListing 的權限修正說明）
export async function claimCardSaleProceeds(sellerId, listingId) {
  if (!sellerId || !listingId) return { ok: false, reason: '參數錯誤' };
  try {
    const listingRef = doc(db, C_CARD_MARKET, listingId);
    const snap = await getDoc(listingRef);
    if (!snap.exists()) return { ok: false, reason: '掛賣紀錄不存在' };
    const listing = snap.data();
    if (listing.sellerId !== sellerId) return { ok: false, reason: '這不是你的掛賣' };
    if (listing.status !== 'sold') return { ok: false, reason: '尚未售出' };
    if (listing.sellerClaimed) return { ok: false, reason: 'already_claimed' };

    const updates = {};
    let proceeds = { type: listing.priceType, amount: listing.priceAmount, cardId: listing.offeredCardId };
    if (listing.priceType === 'arrowdew') {
      updates['village.resources.arrowdew'] = increment(listing.priceAmount);
    } else if (listing.priceType === 'gachaToken') {
      updates.gachaCoins = increment(listing.priceAmount);
    } else if (listing.priceType === 'card' && listing.offeredCardId) {
      updates[`catCards.${listing.offeredCardId}`] = increment(1);
    }
    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, C.members, sellerId), updates);
    }
    await updateDoc(listingRef, { sellerClaimed: true, sellerClaimedAt: serverTimestamp() });
    return { ok: true, proceeds };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function cancelCardListing(memberId, listingId, cardId) {
  const ref = doc(db, C_CARD_MARKET, listingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('找不到掛賣');
  const d = snap.data();
  if (d?.sellerId !== memberId) throw new Error('不是你的掛賣');
  if (d?.status !== "active") throw new Error('已下架');
  const batch = writeBatch(db);
  batch.update(doc(db, C.members, memberId), { [`catCards.${cardId}`]: increment(1) });
  batch.update(ref, { status: "cancelled" });
  await batch.commit();
}

// ── 市集兌換設定（後台可調整）──────────────────────────────
export function subscribeVillageMarketConfig(callback) {
  return onSnapshot(
    doc(db, "sysConfig", "villageMarket"),
    snap => callback(snap.exists() ? snap.data() : null),
    () => callback(null)
  );
}

export async function saveVillageMarketConfig(battleExchange) {
  await setDoc(doc(db, "sysConfig", "villageMarket"),
    { battleExchange, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function initVillageIfNeeded(memberId, currentVillage) {
  if (currentVillage) return;
  await updateDoc(doc(db, C.members, memberId), {
    village: {
      ...DEFAULT_VILLAGE,
      lastCollectedAt: serverTimestamp(),
    },
  });
}

// ─── 後台：村莊調試 ────────────────────────────────────────

export async function adminSetVillageBuilding(memberId, buildingId, level) {
  const lv = Math.max(1, Math.min(20, Number(level)));
  await updateDoc(doc(db, C.members, memberId), {
    [`village.buildings.${buildingId}`]: lv,
  });
}

export async function adminAdjustVillageResource(memberId, resourceKey, delta) {
  const d = Number(delta);
  if (d === 0) return;
  // 頂層欄位：arrowdew, archer, gachaCoins；其餘放 village.resources
  const topLevel = ['gachaCoins'];
  if (topLevel.includes(resourceKey)) {
    await updateDoc(doc(db, C.members, memberId), {
      [resourceKey]: increment(d),
    });
  } else {
    await updateDoc(doc(db, C.members, memberId), {
      [`village.resources.${resourceKey}`]: increment(d),
    });
  }
}

export async function adminResetVillage(memberId) {
  await updateDoc(doc(db, C.members, memberId), {
    village: { ...DEFAULT_VILLAGE, lastCollectedAt: serverTimestamp() },
  });
}

// ─── 議會廳 ───────────────────────────────────────────────

const C_COUNCIL_SESSION = "councilSessions";

function councilTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export async function checkCouncilDailyLimit(memberId) {
  try {
    const id = `${memberId}_${councilTodayStr()}`;
    const snap = await getDoc(doc(db, C_COUNCIL_SESSION, id));
    const used = snap.exists() ? (snap.data().count || 0) : 0;
    return Math.max(0, 5 - used);
  } catch { return 5; }
}

export async function recordCouncilSession(memberId) {
  const id = `${memberId}_${councilTodayStr()}`;
  const ref = doc(db, C_COUNCIL_SESSION, id);
  await setDoc(ref, { count: increment(1), updatedAt: serverTimestamp() }, { merge: true });
}

export async function resetCouncilDailyLimit(memberId) {
  const id = `${memberId}_${councilTodayStr()}`;
  await deleteDoc(doc(db, C_COUNCIL_SESSION, id));
}

export async function resetAllCouncilDailyLimits(memberIds) {
  await Promise.all(memberIds.map(id => resetCouncilDailyLimit(id)));
}

// 議會廳戰鬥結算：依過關/失敗 tier 分層給予獎勵
export async function completeCouncilSession(memberId, {
  race,
  clearedTier,
  failedTier,
  contractVersion,
  checkpointsCleared = 0,
  rewardMultiplier = 0,
  gatheringRewards = null,
  catId = null,
  totalArrows = 0,
}) {
  const TIER_ORDER = ['common','rare','elite','fierce','boss','mythic'];
  const TO_CHEST   = { common:'wood', rare:'iron', elite:'gold', fierce:'epic', boss:'mythic', mythic:'mythic' };
  const MAT_SUFFIX = { common:'m1', rare:'m2', elite:'m3', fierce:'m4', boss:'m5', mythic:'m6' };
  const mat1Id     = `${race}_m1`;
  const promises   = [];

  if (contractVersion >= 2) {
    const rewards = gatheringRewards || {};
    const materialCount = Math.max(0, Math.min(80, Math.round(Number(rewards.materialCount) || 0)));
    const goalVillageResources = { ...(rewards.villageResources || {}) };
    if (rewards.materialId && materialCount > 0) {
      promises.push(addMaterials(memberId, Array(materialCount).fill({ id: rewards.materialId })));
    }

    const villageUpdates = {};
    Object.entries(rewards.villageResources || {}).forEach(([key, amount]) => {
      const count = Math.max(0, Math.min(150, Math.round(Number(amount) || 0))); // 採集村材料大幅提高，上限 50→150
      if (key && count > 0) villageUpdates[`village.resources.${key}`] = increment(count);
    });

    (rewards.rareRewards || []).forEach(item => {
      const count = Math.max(0, Math.min(20, Math.round(Number(item?.count) || 0)));
      if (count <= 0) return;
      if (item.type === "villageResource" && item.resourceKey) {
        villageUpdates[`village.resources.${item.resourceKey}`] = increment(count);
        goalVillageResources[item.resourceKey] = (goalVillageResources[item.resourceKey] || 0) + count;
      } else if (item.type === "gachaCoins") {
        villageUpdates.gachaCoins = increment(Math.min(3, count));
      } else if (item.type === "material" && item.materialId) {
        promises.push(addMaterials(memberId, Array(count).fill({ id: item.materialId })));
      }
    });

    if (Object.keys(villageUpdates).length > 0) {
      promises.push(updateDoc(doc(db, C.members, memberId), villageUpdates));
    }

    if (catId) {
      const catXP = Math.max(0, Math.min(800, Math.round(Number(rewards.catXP) || 0)));   // 採集大量貓XP，上限 500→800
      const catBond = Math.max(0, Math.min(15, Math.round(Number(rewards.catBond) || 0))); // 採集較多羈絆，上限 10→15
      if (catXP > 0) promises.push(addCatXP(memberId, catId, catXP));
      if (catBond > 0) promises.push(addCatBond(memberId, catId, "gathering", catBond));
    }
    const arrowCount = Math.max(0, Math.min(18, Math.round(Number(totalArrows) || 0)));
    if (arrowCount > 0) promises.push(addRoundArrows(memberId, arrowCount));

    await Promise.all(promises);
    try {
      const { contributeGatheringToGoal } = await import("./villageGoalDb");
      await contributeGatheringToGoal(memberId, {
        progressPct: rewards.progressPct || 0,
        participants: rewards.goalParticipants || rewards.participants || 1,
        materialId: rewards.materialId || "",
        materialCount,
        villageResources: goalVillageResources,
      });
    } catch (e) {
      console.warn("contributeGatheringToGoal:", e?.message);
    }
    return;
  }

  if (contractVersion >= 1) {
    const cleared = Math.max(0, Math.min(3, Number(checkpointsCleared) || 0));
    if (cleared > 0 && clearedTier) {
      const mult = Math.max(1, Number(rewardMultiplier) || 1);
      const materialId = `${race}_${MAT_SUFFIX[clearedTier] || 'm1'}`;
      const materialCount = Math.max(1, Math.round(4 * cleared * mult));
      promises.push(addMaterials(memberId, Array(materialCount).fill({ id: materialId })));
      const raceChests = Array.from({ length: cleared }, (_, index) => ({
        id: `chest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_g${index}`,
        type: TO_CHEST[clearedTier],
        family: race,
        tier: clearedTier,
        from: '貓貓村採集委託',
        ts: Date.now() + index,
      }));
      promises.push(addChests(memberId, raceChests));
      promises.push(addChests(
        memberId,
        Array.from({ length: cleared }, () => makeCoinChest(clearedTier, '貓貓村採集委託')),
      ));
    } else if (failedTier) {
      promises.push(addMaterials(memberId, Array(3).fill({ id: mat1Id })));
    }
    await Promise.all(promises);
    return;
  }

  if (clearedTier) {
    const n = TIER_ORDER.indexOf(clearedTier) + 1;
    // T1素材 × (5 + n*5)
    promises.push(addMaterials(memberId, Array(5 + n * 5).fill({ id: mat1Id })));
    // 種族寶箱 × n（T1~Tn）
    const raceChests = TIER_ORDER.slice(0, n).map((t, i) => ({
      id: `chest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_r${i}`,
      type: TO_CHEST[t], family: race, tier: t, from: '議會廳採集', ts: Date.now() + i,
    }));
    promises.push(addChests(memberId, raceChests));
    // 金幣寶箱 × n（T1~Tn）
    const coinChests = TIER_ORDER.slice(0, n).map(t => makeCoinChest(t, '議會廳採集'));
    promises.push(addChests(memberId, coinChests));
  }

  if (failedTier) {
    const n = TIER_ORDER.indexOf(failedTier) + 1;
    // T1素材 ×5
    promises.push(addMaterials(memberId, Array(5).fill({ id: mat1Id })));
    // 機率 +1~n 扭蛋幣
    if (Math.random() < 0.10 + n * 0.05) {
      const coins = 1 + Math.floor(Math.random() * n);
      promises.push(updateDoc(doc(db, C.members, memberId), { gachaCoins: increment(coins) }));
    }
  }

  await Promise.all(promises);
}

/* ════════════════════════════════════════════════════════════
   學生分級與系統鎖定（2026-07-04）
   詳見 .trellis/tasks/07-04-student-tier-lock/design.md
   ════════════════════════════════════════════════════════════ */

const C_SYSTEM_CONFIG = "systemConfig";

// ── 教練工具：分級 / 帳號凍結（只能經 admin 寫入，見 firestore.rules）──
export async function setStudentTier(memberId, tier, operatorId) {
  const before = await getMember(memberId);
  await updateDoc(doc(db, C.members, memberId), { studentTier: tier, updatedAt: serverTimestamp() });
  await writeAuditLog("SET_STUDENT_TIER", memberId, "member", { studentTier: before?.studentTier }, { studentTier: tier }, operatorId);
}

export async function setAccountFrozen(memberId, frozen, operatorId) {
  const before = await getMember(memberId);
  await updateDoc(doc(db, C.members, memberId), { accountFrozen: !!frozen, updatedAt: serverTimestamp() });
  await writeAuditLog("SET_ACCOUNT_FROZEN", memberId, "member", { accountFrozen: before?.accountFrozen }, { accountFrozen: !!frozen }, operatorId);
}

// 批次設定分級（上線初期教練逐一手動處理大量既有會員用）
export async function bulkSetStudentTier(memberIds, tier, operatorId) {
  const ids = Array.isArray(memberIds) ? memberIds : [];
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach(id => batch.update(doc(db, C.members, id), { studentTier: tier, updatedAt: serverTimestamp() }));
  await batch.commit();
  await writeAuditLog("BULK_SET_STUDENT_TIER", ids.join(","), "member", null, { studentTier: tier, count: ids.length }, operatorId);
}

// ── 系統維護鎖 ──────────────────────────────────────────────
export async function setMaintenanceMode(enabled, message, operatorId) {
  await setDoc(doc(db, C_SYSTEM_CONFIG, "maintenance"), {
    enabled: !!enabled, message: message || "", updatedAt: serverTimestamp(), operatorId,
  }, { merge: true });
}

export function subscribeMaintenanceConfig(callback) {
  return onSnapshot(
    doc(db, C_SYSTEM_CONFIG, "maintenance"),
    snap => callback(snap.exists() ? snap.data() : { enabled: false, message: "" }),
    () => callback({ enabled: false, message: "" })
  );
}

// ── 權限矩陣（可調整設定，教練後台勾選）──────────────────────
export async function setTierPermissions(permissions, operatorId) {
  await setDoc(doc(db, C_SYSTEM_CONFIG, "tierPermissions"), {
    ...permissions, updatedAt: serverTimestamp(), operatorId,
  }, { merge: false });
}

export function subscribeTierPermissions(callback) {
  return onSnapshot(
    doc(db, C_SYSTEM_CONFIG, "tierPermissions"),
    snap => callback(snap.exists() ? snap.data() : null),
    () => callback(null)
  );
}

// �w�w�w �����~�[��ܵ���
// �x�s���a���n��������������ܵ��š]�u��� <= ��ڧ������š^
// level = null/undefined �M�����n�A�אּ���H��ڵ���
export async function setDisplayVillageLv(memberId, level) {
  if (!memberId) return;
  try {
    if (level == null) {
      await updateDoc(doc(db, C.members, memberId), { displayVillageLv: deleteField() });
    } else {
      await updateDoc(doc(db, C.members, memberId), { displayVillageLv: Number(level) });
    }
  } catch (e) { console.warn("setDisplayVillageLv:", e?.message); }
}
// ── 每日一般懸賞設定（教練可關閉特定難度的自動生成）────────────────
export async function getDailyGeneralSettings() {
  try {
    const snap = await getDoc(doc(db, "guildMeta", "dailyGeneralSettings"));
    if (snap.exists()) return snap.data();
  } catch (e) { console.warn("getDailyGeneralSettings:", e?.message); }
  return { disabledDifficulties: [] };
}

export async function saveDailyGeneralSettings(settings, adminId) {
  await setDoc(doc(db, "guildMeta", "dailyGeneralSettings"), {
    ...settings,
    updatedAt: serverTimestamp(),
    updatedBy: adminId,
  }, { merge: true });
}


