"use strict";

const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { buildWorldBossRewardSnapshot, rewardCategoryForBoss } = require("./worldBossRewardSnapshot");
const { WORLD_BOSS_CATALOG } = require("./worldBossCatalog");

const DEFAULTS = Object.freeze({
  restHours: 8,
  deadlineHours: 48,
  targets: Object.freeze({ arrows:10000, dungeonClears:30, monsterKills:500, villageDice:300 }),
});
const TYPES = new Set(Object.keys(DEFAULTS.targets));
// 抽籤池：哪幾種可以被抽中當「這一輪的條件」。教練可在後台調整。
const DEFAULT_ENABLED_TYPES = Object.freeze([...TYPES]);
const TYPE_LIMITS = Object.freeze({ arrows:100, dungeonClears:1, monsterKills:8, villageDice:20 });

function toMillis(value) {
  return value?.toMillis?.() || Number(value) || 0;
}

function normalizedConfig(raw = {}) {
  const restHours = Math.max(0, Math.min(48, Number(raw.restHours) || DEFAULTS.restHours));
  const deadlineHours = Math.max(restHours, Math.min(48, Number(raw.deadlineHours) || DEFAULTS.deadlineHours));
  const targets = {};
  for (const key of TYPES) targets[key] = Math.max(1, Math.floor(Number(raw.targets?.[key]) || DEFAULTS.targets[key]));
  // 抽籤池：過濾掉不認識的值；全部關掉就退回全開（不然永遠開不出王）
  return { restHours, deadlineHours, targets, enabledTypes:normalizedEnabledTypes(raw.enabledTypes) };
}

function normalizedEnabledTypes(raw) {
  const list = Array.isArray(raw) ? raw.filter(type => TYPES.has(type)) : [];
  return list.length ? list : [...DEFAULT_ENABLED_TYPES];
}

function buildCycle(eventId, event, nowMs, config) {
  const endedAtMs = toMillis(event.defeatedAt)
    || toMillis(event.expiredAt)
    || toMillis(event.cancelledAt)
    || nowMs;
  return {
    status: nowMs < endedAtMs + config.restHours * 3600000 ? "resting" : "charging",
    previousEventId:eventId,
    previousBossKey:event.bossKey || null,
    restEndsAtMs:endedAtMs + config.restHours * 3600000,
    deadlineAtMs:endedAtMs + config.deadlineHours * 3600000,
    progress:{ arrows:0, dungeonClears:0, monsterKills:0, villageDice:0 },
    targets:config.targets,
    // ⚠️ 這一輪**只認一種**條件，開週期時抽一次就定了。
    //    抽籤結果一定要**存進文件**——每次評估重抽的話，玩家看到的條件會一直跳，
    //    而且進度推到一半條件就換了。
    requiredType:config.enabledTypes[Math.floor(Math.random() * config.enabledTypes.length)],
    enabledTypes:config.enabledTypes,
    createdAt:FieldValue.serverTimestamp(),
    updatedAt:FieldValue.serverTimestamp(),
  };
}

function evaluate(cycle, nowMs) {
  if (!cycle || ["spawning", "spawned"].includes(cycle.status)) return null;
  if (nowMs < Number(cycle.restEndsAtMs || 0)) return null;
  // ⚠️ 只看抽中的那一種。舊版是「任一達標」，等於四條路同時開——
  //    作者 2026-08-03 改成隨機挑一種，每一輪的目標才有變化。
  //    舊的週期文件沒有 requiredType，退回舊行為（任一），不然它們會永遠卡住。
  const required = TYPES.has(cycle.requiredType) ? [cycle.requiredType] : [...TYPES];
  for (const type of required) {
    if (Number(cycle.progress?.[type] || 0) >= Number(cycle.targets?.[type] || Infinity)) return type;
  }
  // 世界王不再因時間到自動降臨；只允許有效條件完成或教練後台強制召喚。
  return null;
}

function cycleAfterCancellation(currentCycle, eventId, event, nowMs, config) {
  const required = TYPES.has(currentCycle?.requiredType)
    ? [currentCycle.requiredType]
    : [...TYPES];
  const targetReached = required.some(type =>
    Number(currentCycle?.progress?.[type] || 0) >= Number(currentCycle?.targets?.[type] || Infinity));
  const canResumeAdminCycle = currentCycle?.spawnedEventId === eventId
    && currentCycle?.triggeredBy === "admin"
    && !targetReached;

  if (!canResumeAdminCycle) return buildCycle(eventId, event, nowMs, config);
  return {
    ...currentCycle,
    status:"charging", previousEventId:eventId, previousBossKey:event.bossKey || null,
    spawnedEventId:null, spawnedBossKey:null, spawnedAt:null, triggeredBy:null,
    updatedAt:FieldValue.serverTimestamp(),
  };
}

function activeStatusPatch(eventId, event = {}) {
  return {
    eventId,
    status:"active",
    bossKey:event.bossKey || null,
    bossName:event.bossData?.name || "",
    announcement:null,
    // worldBossStatus/current is merged in place. Explicitly clear the
    // previous boss replay whenever a different event becomes active.
    killReplay:null,
  };
}

async function ensureCycle(db) {
  const cycleRef = db.doc("worldBossSpawnCycles/current");
  const latest = await db.collection("worldBossEvents").orderBy("createdAt", "desc").limit(1).get();
  if (latest.empty) return null;
  const latestDoc = latest.docs[0];
  const latestEvent = latestDoc.data();
  if (!["defeated", "expired", "cancelled"].includes(latestEvent.status)) return null;
  const configSnap = await db.doc("sysConfig/worldBossSpawn").get();
  const config = normalizedConfig(configSnap.data());
  await db.runTransaction(async tx => {
    const [eventSnap, cycleSnap] = await Promise.all([tx.get(latestDoc.ref), tx.get(cycleRef)]);
    if (!eventSnap.exists || !["defeated", "expired", "cancelled"].includes(eventSnap.data().status)) return;
    const latestData = eventSnap.data();
    if (latestData.status === "defeated" && Number(latestData.bossCurrentHP) !== 0) {
      tx.update(latestDoc.ref, { bossCurrentHP:0 });
    }
    const currentCycle = cycleSnap.exists ? cycleSnap.data() : null;
    if (latestData.status === "cancelled" && currentCycle?.spawnedEventId === latestDoc.id) {
      // 只有教練提早強制召喚、且條件尚未達標時才恢復舊進度。
      // 條件達標後生成的王若被移除，必須開全新週期，否則排程會無限重生並重複發獎。
      tx.set(cycleRef, cycleAfterCancellation(currentCycle, latestDoc.id, latestData, Date.now(), config));
    } else if (!cycleSnap.exists || currentCycle.previousEventId !== latestDoc.id) {
      tx.set(cycleRef, buildCycle(latestDoc.id, latestData, Date.now(), config));
    }
  });
  return (await cycleRef.get()).data() || null;
}

async function pickBossTemplate(db, previousBossKey) {
  const all=Object.entries(WORLD_BOSS_CATALOG).map(([bossKey,bossData])=>({bossKey,bossData,bossMaxHP:bossData.hp}));
  const pool=all.filter(item=>item.bossKey!==previousBossKey),available=pool.length?pool:all;
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
      const activeDoc = active.docs[0];
      await db.doc("worldBossStatus/current").set({
        ...activeStatusPatch(activeDoc.id, activeDoc.data()),
        updatedAt:FieldValue.serverTimestamp(),
      }, { merge:true });
      await cycleRef.update({ status:"spawned", spawnedEventId:activeDoc.id, spawnedAt:FieldValue.serverTimestamp() });
      return { ok:true, eventId:activeDoc.id, existing:true };
    }
    const template = await pickBossTemplate(db, lock.previousBossKey);
    if (!template) throw new Error("world_boss_template_missing");
    const configSnap = await db.doc("sysConfig/worldBossSpawn").get();
    const durationDays = Math.max(1, Math.min(30, Number(configSnap.data()?.durationDays) || 30));
    const endAt = Timestamp.fromMillis(Date.now() + durationDays * 86400000);
    const eventRef = db.collection("worldBossEvents").doc();
    const family=template.bossData?.family;
    const category = rewardCategoryForBoss(template);
    const rewardSnapshot = buildWorldBossRewardSnapshot({ category, bossFamily:template.bossData?.family || null });
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
        rewardSnapshot,
        lastHitBy:null,
        announcement:null,
        totalParticipants:0,
        participants:{},
        createdBy:"world_boss_lifecycle",
        createdAt:FieldValue.serverTimestamp(),
        autoSpawned:true,
      });
      tx.set(db.doc("worldBossStatus/current"), {
        ...activeStatusPatch(eventRef.id, template),
        updatedAt:FieldValue.serverTimestamp(),
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

module.exports = { DEFAULTS, normalizedConfig, buildCycle, cycleAfterCancellation, evaluate, activeStatusPatch, ensureCycle, trySpawn, contribute };
