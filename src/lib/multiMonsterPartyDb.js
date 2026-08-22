import {
  doc, onSnapshot, runTransaction, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import app from "./firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { generateMultiMonsterEncounter } from "./multiMonsterEncounter";
import {
  createMultiPartyRandom,
  hashMultiPartySeed,
  multiPartyTargetsToMap,
  resolveMultiMonsterPartyRound,
} from "./multiMonsterPartyBattle";
import { stripUndefinedDeep } from "./firestoreSafeWrite";

const PARTY = "partyRooms";
const VALID_SCORES = new Set(["X","10","9","8","7","6","5","4","3","2","1","M"]);
const functions = getFunctions(app, "asia-east1");
const callV2 = async (name, data) => {
  try { return (await httpsCallable(functions, name)(data)).data; }
  catch (error) { return { ok:false, reason:error?.message?.split(" ").pop() || error?.details || "server_authority_failed" }; }
};

function roomRef(roomId, dungeonMode = false) { return doc(db, dungeonMode ? "dungeonRooms" : PARTY, roomId); }

function normalizeMemberForBattle(member = {}) {
  const maxHp = Math.max(1, Number(member.maxHp ?? member.maxHP ?? member.hp) || 200);
  const hpRaw = Number(member.hp);
  const hp = hpRaw > 0 ? Math.min(maxHp, hpRaw) : maxHp;
  const baseAtk = Math.max(0, Number(member.baseAtk ?? member.atk) || 15);
  const baseDef = Math.max(0, Number(member.baseDef ?? member.def) || 10);
  return {
    ...member,
    hp,
    maxHp,
    maxHP:maxHp,
    atk:baseAtk,
    def:baseDef,
    baseAtk,
    baseDef,
    atkMult: Number(member.atkMult ?? 1) || 1,
    defMult: Number(member.defMult ?? 1) || 1,
    atkFlat: Number(member.atkFlat) || 0,
    defFlat: Number(member.defFlat) || 0,
    statuses:Array.isArray(member.statuses) ? member.statuses : [],
    alive:true,
    ready:false,
    submission:null,
    rewardClaimed:false,
  };
}

function normalizeScore(raw) {
  const value = raw && typeof raw === "object" ? (raw.score ?? raw.label) : raw;
  const label = String(value ?? "M").toUpperCase();
  if (!VALID_SCORES.has(label)) throw new Error("invalid_arrow_score");
  return label;
}

export function subscribeMultiMonsterPartyRoom(roomId, callback, { dungeonMode = false } = {}) {
  if (!roomId) { callback(null); return () => {}; }
  return onSnapshot(roomRef(roomId, dungeonMode), snap => callback(snap.exists() ? { id:snap.id, ...snap.data() } : null));
}

export async function updateMultiMonsterPartyMemberStats(roomId, memberId, stats = {}) {
  if (!roomId || !memberId) return { ok:false, reason:"missing_member" };
  try {
    return await runTransaction(db, async tx => {
      const ref = roomRef(roomId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return { ok:false, reason:"room_not_found" };
      const room = snap.data();
      if (room.huntType !== "multi" || room.multiMonster !== true) return { ok:false, reason:"not_multi_room" };
      if (!room.members?.[memberId]) return { ok:false, reason:"not_member" };
      if (room.status !== "waiting") return { ok:true, skipped:"battle_started" };
      const maxHp = Math.max(1, Number(stats.maxHp ?? stats.maxHP ?? stats.hp) || 200);
      const baseAtk = Math.max(0, Number(stats.baseAtk ?? stats.atk) || 15);
      const baseDef = Math.max(0, Number(stats.baseDef ?? stats.def) || 10);
      const next = {
        ...room.members[memberId],
        hp:maxHp,
        maxHp,
        maxHP:maxHp,
        atk:baseAtk,
        def:baseDef,
        baseAtk,
        baseDef,
        atkMult:Number(stats.atkMult ?? 1) || 1,
        defMult:Number(stats.defMult ?? 1) || 1,
        atkFlat:Number(stats.atkFlat) || 0,
        defFlat:Number(stats.defFlat) || 0,
        statuses:Array.isArray(stats.statuses) ? stats.statuses : [],
        alive:true,
        avatarId:typeof stats.avatarId === "string" ? stats.avatarId : (room.members[memberId]?.avatarId || ""),
        catId:typeof stats.catId === "string" ? stats.catId : (room.members[memberId]?.catId || ""),
        catName:typeof stats.catName === "string" ? stats.catName : (room.members[memberId]?.catName || ""),
        catType:typeof stats.catType === "string" ? stats.catType : (room.members[memberId]?.catType || ""),
        bondLv:Math.max(0, Number(stats.bondLv ?? room.members[memberId]?.bondLv) || 0),
        catLevel:Math.max(0, Number(stats.catLevel) || 0),
        catHP:Math.max(0, Number(stats.catHP) || 0),
        catATK:Math.max(0, Number(stats.catATK) || 0),
        catDEF:Math.max(0, Number(stats.catDEF) || 0),
        combatVersion:Number(stats.combatVersion) === 2 ? 2 : 1,
        loadoutSnapshot:stats.loadoutSnapshot?.version === 2 ? stats.loadoutSnapshot : null,
      };
      tx.update(ref, { [`members.${memberId}`]:stripUndefinedDeep(next) });
      return { ok:true };
    });
  } catch (error) { return { ok:false, reason:error.message }; }
}

export async function setMultiMonsterPartyArrowsPerRound(roomId, memberId, count) {
  const arrowsPerRound = Number(count);
  if (![3,6].includes(arrowsPerRound)) return { ok:false, reason:"invalid_arrow_count" };
  try {
    return await runTransaction(db, async tx => {
      const ref = roomRef(roomId); const snap = await tx.get(ref);
      if (!snap.exists()) return { ok:false, reason:"room_not_found" };
      const room = snap.data();
      if (room.hostId !== memberId) return { ok:false, reason:"host_only" };
      if (room.status !== "waiting") return { ok:false, reason:"battle_started" };
      tx.update(ref, { arrowsPerRound });
      return { ok:true };
    });
  } catch (error) { return { ok:false, reason:error.message }; }
}

export async function startMultiMonsterPartyBattle(roomId, hostId, { dungeonMode = false } = {}) {
  return callV2("startMultiMonsterPartyBattleV2", { roomId, memberId:hostId, dungeonMode });
  /* istanbul ignore next -- retained below as the v1 room compatibility implementation */
  // eslint-disable-next-line no-unreachable
  try {
    return await runTransaction(db, async tx => {
      const ref = roomRef(roomId); const snap = await tx.get(ref);
      if (!snap.exists()) return { ok:false, reason:"room_not_found" };
      const room = { id:snap.id, ...snap.data() };
      if (room.huntType !== "multi" || room.multiMonster !== true) return { ok:false, reason:"not_multi_room" };
      if (room.hostId !== hostId) return { ok:false, reason:"host_only" };
      if (room.status === "active" && room.targets) return { ok:true, alreadyStarted:true };
      if (room.status !== "waiting") return { ok:false, reason:"room_not_waiting" };
      const waitingMembers = Object.values(room.members || {});
      const statsReady = waitingMembers.length > 0 && waitingMembers.every(member =>
        Number.isFinite(Number(member?.maxHp ?? member?.maxHP)) &&
        Number.isFinite(Number(member?.baseAtk)) &&
        Number.isFinite(Number(member?.baseDef))
      );
      if (!statsReady) return { ok:false, reason:"member_stats_pending" };
      const family = room.multiFamily;
      const tier = Number(room.multiTier);
      if (!family || !tier) return { ok:false, reason:"missing_encounter" };
      const encounterSeed = Number(room.encounterSeed) || hashMultiPartySeed(`${roomId}:${family}:${tier}`);
      const encounter = generateMultiMonsterEncounter(family, tier, { rand:createMultiPartyRandom(encounterSeed) });
      const targets = multiPartyTargetsToMap(encounter.monsters.map(target => ({ ...target, statuses:Array.isArray(target.statuses) ? target.statuses : [] })));
      const targetOrder = encounter.monsters.map(target => target.instanceId);
      const members = Object.fromEntries(Object.entries(room.members || {}).map(([id, member]) => [id, normalizeMemberForBattle(member)]));
      tx.update(ref, stripUndefinedDeep({
        encounterSeed,
        targets,
        targetOrder,
        members,
        arrowsPerRound:[3,6].includes(Number(room.arrowsPerRound)) ? Number(room.arrowsPerRound) : 6,
        round:1,
        status:"active",
        processing:false,
        lastResolution:null,
        combatVersion:2,
        roundPhase:"input",
        battleStartedAt:serverTimestamp(),
      }));
      return { ok:true, encounterSeed };
    });
  } catch (error) { return { ok:false, reason:error.message }; }
}

export async function submitMultiMonsterPartyRound(roomId, memberId, expectedRound, input = {}, { dungeonMode = false } = {}) {
  return callV2("submitMultiMonsterPartyRoundV2", { roomId, memberId, round:expectedRound, dungeonMode, ...input });
  /* istanbul ignore next -- retained below as the v1 room compatibility implementation */
  // eslint-disable-next-line no-unreachable
  try {
    return await runTransaction(db, async tx => {
      const ref = roomRef(roomId); const snap = await tx.get(ref);
      if (!snap.exists()) return { ok:false, reason:"room_not_found" };
      const room = snap.data();
      if (room.huntType !== "multi" || room.multiMonster !== true || room.status !== "active") return { ok:false, reason:"battle_not_active" };
      if ((Number(room.round) || 1) !== Number(expectedRound)) return { ok:false, reason:"stale_round" };
      const member = room.members?.[memberId];
      if (!member || member.alive === false || Number(member.hp) <= 0) return { ok:false, reason:"member_down" };
      const arrowsPerRound = [3,6].includes(Number(room.arrowsPerRound)) ? Number(room.arrowsPerRound) : 6;
      if (!Array.isArray(input.arrows) || input.arrows.length !== arrowsPerRound) return { ok:false, reason:"invalid_arrow_count" };
      const arrows = input.arrows.map(normalizeScore);
      const attackMode = input.attackMode === "all" ? "all" : "focus";
      const targets = multiPartyTargetsToMap(room.targets);
      const targetId = input.targetId || null;
      if (attackMode === "focus") {
        const target = targets[targetId];
        if (!target || target.alive === false || Number(target.currentHp) <= 0) return { ok:false, reason:"invalid_target" };
      }
      if (room.roundPhase && room.roundPhase !== "input") return { ok:false, reason:"round_locked" };
      const previousRevision = Math.max(0, Number(member.submission?.revision) || 0);
      const revision = Math.max(previousRevision + 1, Number(input.revision) || 0);
      const submission = stripUndefinedDeep({ submissionId:`${roomId}:${expectedRound}:${memberId}`, round:Number(expectedRound), arrows, attackMode, targetId:attackMode === "focus" ? targetId : null, revision, submittedAt:Date.now() });
      tx.update(ref, { [`members.${memberId}.submission`]:submission, [`members.${memberId}.ready`]:true });
      return { ok:true, revision };
    });
  } catch (error) { return { ok:false, reason:error.message }; }
}

export async function reviseMultiMonsterPartyRound(roomId, memberId, expectedRound, { dungeonMode = false } = {}) {
  return callV2("reviseMultiMonsterPartyRoundV2", { roomId, memberId, round:expectedRound, dungeonMode });
  /* istanbul ignore next -- retained below as the v1 room compatibility implementation */
  // eslint-disable-next-line no-unreachable
  try {
    return await runTransaction(db, async tx => {
      const ref = roomRef(roomId); const snap = await tx.get(ref);
      if (!snap.exists()) return { ok:false, reason:"room_not_found" };
      const room = snap.data();
      if (room.status !== "active" || Number(room.round) !== Number(expectedRound)) return { ok:false, reason:"stale_round" };
      if (room.roundPhase && room.roundPhase !== "input") return { ok:false, reason:"round_locked" };
      if (!room.members?.[memberId]) return { ok:false, reason:"not_member" };
      tx.update(ref, { [`members.${memberId}.ready`]:false });
      return { ok:true, revision:Math.max(0, Number(room.members[memberId]?.submission?.revision) || 0) };
    });
  } catch (error) { return { ok:false, reason:error.message }; }
}

export async function processMultiMonsterPartyRound(roomId, hostId, expectedRound) {
  try {
    return await runTransaction(db, async tx => {
      const ref = roomRef(roomId); const snap = await tx.get(ref);
      if (!snap.exists()) return { ok:false, reason:"room_not_found" };
      const room = { id:snap.id, ...snap.data() };
      if (room.hostId !== hostId) return { ok:false, reason:"host_only" };
      if (room.status !== "active") return { ok:false, reason:"battle_not_active" };
      if ((Number(room.round) || 1) !== Number(expectedRound)) return { ok:false, reason:"stale_round" };
      const living = Object.values(room.members || {}).filter(member => member?.alive !== false && Number(member?.hp) > 0);
      if (!living.length || living.some(member => !member.ready || Number(member.submission?.round) !== Number(expectedRound))) return { ok:false, reason:"not_all_ready" };
      const resolved = resolveMultiMonsterPartyRound({ room, expectedRound:Number(expectedRound) });
      tx.update(ref, stripUndefinedDeep(resolved));
      return { ok:true, status:resolved.status, round:resolved.round, resolutionId:resolved.lastResolution?.resolutionId };
    });
  } catch (error) { return { ok:false, reason:error.message }; }
}

export async function leaveMultiMonsterPartyRoom(roomId, memberId, { dungeonMode = false } = {}) {
  return callV2("leaveMultiMonsterPartyRoomV2", {roomId,memberId,dungeonMode});
  // eslint-disable-next-line no-unreachable
  try {
    return await runTransaction(db, async tx => {
      const ref = roomRef(roomId); const snap = await tx.get(ref);
      if (!snap.exists()) return { ok:true };
      const room = snap.data();
      const members = { ...(room.members || {}) };
      if (!members[memberId]) return { ok:true };
      delete members[memberId];
      const remainingIds = Object.keys(members).sort();
      if (!remainingIds.length) {
        tx.update(ref, { members:{}, status:"completed", processing:false });
        return { ok:true, completed:true };
      }
      const update = { members };
      if (room.hostId === memberId) update.hostId = remainingIds[0];
      tx.update(ref, update);
      return { ok:true, newHostId:update.hostId || room.hostId };
    });
  } catch (error) { return { ok:false, reason:error.message }; }
}

export async function markMultiMonsterPartyRewardClaimed(roomId, memberId) {
  try {
    return await runTransaction(db, async tx => {
      const ref = roomRef(roomId); const snap = await tx.get(ref);
      if (!snap.exists()) return { ok:false, reason:"room_not_found" };
      const room = snap.data();
      if (!room.members?.[memberId]) return { ok:false, reason:"not_member" };
      if (room.status !== "victory") return { ok:false, reason:"not_victory" };
      tx.update(ref, { [`members.${memberId}.rewardClaimed`]:true, [`members.${memberId}.rewardClaimedAt`]:serverTimestamp() });
      return { ok:true };
    });
  } catch (error) { return { ok:false, reason:error.message }; }
}

export async function cleanupMultiMonsterPartyRoom(roomId, memberId, { force = false, dungeonMode = false } = {}) {
  return callV2("cleanupMultiMonsterPartyRoomV2", {roomId,memberId,force,dungeonMode});
  // eslint-disable-next-line no-unreachable
  try {
    return await runTransaction(db, async tx => {
      const ref = roomRef(roomId); const snap = await tx.get(ref);
      if (!snap.exists()) return { ok:true };
      const room = snap.data();
      if (room.hostId !== memberId) return { ok:false, reason:"host_only" };
      if (!["victory","defeat","completed"].includes(room.status)) return { ok:false, reason:"battle_not_finished" };
      const allClaimed = room.status !== "victory" || Object.values(room.members || {}).every(member => member?.rewardClaimed === true);
      if (!allClaimed && !force) return { ok:false, reason:"rewards_pending" };
      tx.delete(ref);
      return { ok:true };
    });
  } catch (error) { return { ok:false, reason:error.message }; }
}
