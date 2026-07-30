"use strict";

const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");

const DEFAULTS = Object.freeze({
  restHours: 8,
  deadlineHours: 48,
  targets: Object.freeze({ arrows:10000, dungeonClears:30, monsterKills:500, villageDice:300 }),
});
const TYPES = new Set(Object.keys(DEFAULTS.targets));
const TYPE_LIMITS = Object.freeze({ arrows:100, dungeonClears:1, monsterKills:8, villageDice:20 });

function toMillis(value) {
  return value?.toMillis?.() || Number(value) || 0;
}

function normalizedConfig(raw = {}) {
  const restHours = Math.max(0, Math.min(48, Number(raw.restHours) || DEFAULTS.restHours));
  const deadlineHours = Math.max(restHours, Math.min(48, Number(raw.deadlineHours) || DEFAULTS.deadlineHours));
  const targets = {};
  for (const key of TYPES) targets[key] = Math.max(1, Math.floor(Number(raw.targets?.[key]) || DEFAULTS.targets[key]));
  return { restHours, deadlineHours, targets };
}

function buildCycle(eventId, event, nowMs, config) {
  const defeatedAtMs = toMillis(event.defeatedAt) || nowMs;
  return {
    status: nowMs < defeatedAtMs + config.restHours * 3600000 ? "resting" : "charging",
    previousEventId:eventId,
    previousBossKey:event.bossKey || null,
    restEndsAtMs:defeatedAtMs + config.restHours * 3600000,
    deadlineAtMs:defeatedAtMs + config.deadlineHours * 3600000,
    progress:{ arrows:0, dungeonClears:0, monsterKills:0, villageDice:0 },
    targets:config.targets,
    createdAt:FieldValue.serverTimestamp(),
    updatedAt:FieldValue.serverTimestamp(),
  };
}

function evaluate(cycle, nowMs) {
  if (!cycle || ["spawning", "spawned"].includes(cycle.status)) return null;
  if (nowMs < Number(cycle.restEndsAtMs || 0)) return null;
  for (const type of TYPES) {
    if (Number(cycle.progress?.[type] || 0) >= Number(cycle.targets?.[type] || Infinity)) return type;
  }
  return nowMs >= Number(cycle.deadlineAtMs || Infinity) ? "deadline" : null;
}

async function ensureCycle(db) {
  const cycleRef = db.doc("worldBossSpawnCycles/current");
  const latest = await db.collection("worldBossEvents").orderBy("createdAt", "desc").limit(1).get();
  if (latest.empty) return null;
  const latestDoc = latest.docs[0];
  const latestEvent = latestDoc.data();
  if (latestEvent.status !== "defeated") return null;
  const configSnap = await db.doc("sysConfig/worldBossSpawn").get();
  const config = normalizedConfig(configSnap.data());
  await db.runTransaction(async tx => {
    const [eventSnap, cycleSnap] = await Promise.all([tx.get(latestDoc.ref), tx.get(cycleRef)]);
    if (!eventSnap.exists || eventSnap.data().status !== "defeated") return;
    if (Number(eventSnap.data().bossCurrentHP) !== 0) tx.update(latestDoc.ref, { bossCurrentHP:0 });
    if (!cycleSnap.exists || cycleSnap.data().previousEventId !== latestDoc.id) {
      tx.set(cycleRef, buildCycle(latestDoc.id, eventSnap.data(), Date.now(), config));
    }
  });
  return (await cycleRef.get()).data() || null;
}

async function pickBossTemplate(db, previousBossKey) {
  const snapshot = await db.collection("worldBossEvents").orderBy("createdAt", "desc").limit(50).get();
  const byKey = new Map();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.bossKey && data.bossData && !byKey.has(data.bossKey)) byKey.set(data.bossKey, data);
  }
  const pool = [...byKey.values()].filter(item => item.bossKey !== previousBossKey);
  const available = pool.length ? pool : [...byKey.values()];
  return available[Math.floor(Math.random() * available.length)] || null;
}

async function trySpawn(db, forcedBy = null) {
  await ensureCycle(db);
  const cycleRef = db.doc("worldBossSpawnCycles/current");
  const lock = await db.runTransaction(async tx => {
    const cycleSnap = await tx.get(cycleRef);
    if (!cycleSnap.exists) return null;
    const cycle = cycleSnap.data();
    const reason = forcedBy || evaluate(cycle, Date.now());
    if (!reason || ["spawning", "spawned"].includes(cycle.status)) return null;
    tx.update(cycleRef, { status:"spawning", triggeredBy:reason, spawnLockedAt:FieldValue.serverTimestamp() });
    return { ...cycle, reason };
  });
  if (!lock) return { ok:false, reason:"not_ready" };
  try {
    const active = await db.collection("worldBossEvents").where("status", "==", "active").limit(1).get();
    if (!active.empty) {
      await cycleRef.update({ status:"spawned", spawnedEventId:active.docs[0].id, spawnedAt:FieldValue.serverTimestamp() });
      return { ok:true, eventId:active.docs[0].id, existing:true };
    }
    const template = await pickBossTemplate(db, lock.previousBossKey);
    if (!template) throw new Error("world_boss_template_missing");
    const configSnap = await db.doc("sysConfig/worldBossSpawn").get();
    const durationDays = Math.max(1, Math.min(30, Number(configSnap.data()?.durationDays) || 30));
    const endAt = Timestamp.fromMillis(Date.now() + durationDays * 86400000);
    const eventRef = db.collection("worldBossEvents").doc();
    await db.runTransaction(async tx => {
      const latestCycle = await tx.get(cycleRef);
      if (!latestCycle.exists || latestCycle.data().status !== "spawning") throw new Error("spawn_lock_lost");
      tx.create(eventRef, {
        bossKey:template.bossKey,
        bossData:template.bossData,
        bossMaxHP:Number(template.bossMaxHP) || Number(template.bossData?.hp) || 1,
        bossCurrentHP:Number(template.bossMaxHP) || Number(template.bossData?.hp) || 1,
        status:"active",
        startAt:FieldValue.serverTimestamp(),
        endAt,
        durationDays,
        reward:template.reward || null,
        lastHitBy:null,
        announcement:null,
        totalParticipants:0,
        participants:{},
        createdBy:"world_boss_lifecycle",
        createdAt:FieldValue.serverTimestamp(),
        autoSpawned:true,
      });
      tx.set(db.doc("worldBossStatus/current"), {
        eventId:eventRef.id, status:"active", bossName:template.bossData?.name || "",
        announcement:null, updatedAt:FieldValue.serverTimestamp(),
      }, { merge:true });
      tx.update(cycleRef, {
        status:"spawned", spawnedEventId:eventRef.id, spawnedBossKey:template.bossKey,
        spawnedAt:FieldValue.serverTimestamp(),
      });
    });
    return { ok:true, eventId:eventRef.id, bossKey:template.bossKey };
  } catch (error) {
    await cycleRef.update({ status:"charging", spawnError:String(error.message || error), updatedAt:FieldValue.serverTimestamp() });
    throw error;
  }
}

async function contribute(db, request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "login_required");
  const memberId = String(request.data?.memberId || "");
  const type = String(request.data?.type || "");
  const operationId = String(request.data?.operationId || "");
  if (!memberId || memberId.includes("/") || !TYPES.has(type) || !operationId || operationId.length > 240) {
    throw new HttpsError("invalid-argument", "invalid_world_boss_contribution");
  }
  const requestedAmount = Math.max(0, Math.floor(Number(request.data?.amount) || 0));
  const amount = Math.min(TYPE_LIMITS[type], requestedAmount);
  if (!amount) throw new HttpsError("invalid-argument", "invalid_world_boss_contribution_amount");
  const memberSnap = await db.doc(`members/${memberId}`).get();
  const member = memberSnap.data();
  if (!memberSnap.exists || !(member.uid === request.auth.uid || (request.auth.token.email && member.email === request.auth.token.email))) {
    throw new HttpsError("permission-denied", "owner_mismatch");
  }
  await ensureCycle(db);
  const cycleRef = db.doc("worldBossSpawnCycles/current");
  const opId = encodeURIComponent(`${memberId}:${operationId}`).slice(0, 500);
  const opRef = db.doc(`worldBossSpawnOps/${opId}`);
  const result = await db.runTransaction(async tx => {
    const [cycleSnap, opSnap] = await Promise.all([tx.get(cycleRef), tx.get(opRef)]);
    if (!cycleSnap.exists) return { ok:false, reason:"cycle_missing" };
    if (opSnap.exists) return { ok:true, duplicate:true };
    const cycle = cycleSnap.data();
    if (Date.now() < Number(cycle.restEndsAtMs || 0)) return { ok:true, ignored:true, reason:"resting" };
    tx.update(cycleRef, {
      status:"charging",
      [`progress.${type}`]:FieldValue.increment(amount),
      updatedAt:FieldValue.serverTimestamp(),
    });
    tx.create(opRef, {
      memberId, authUid:request.auth.uid, type, amount, operationId,
      cyclePreviousEventId:cycle.previousEventId, createdAt:FieldValue.serverTimestamp(),
    });
    return { ok:true, amount };
  });
  if (result.ok && !result.duplicate && !result.ignored) await trySpawn(db).catch(() => {});
  return result;
}

module.exports = { DEFAULTS, normalizedConfig, evaluate, ensureCycle, trySpawn, contribute };
