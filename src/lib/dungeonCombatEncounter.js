import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import { applySoloVariant, toLegacyBattleMonster } from "./monsterExpansionAdapter";

export const DUNGEON_ENCOUNTER_VERSION = 1;

export function hashDungeonEncounterSeed(value = "") {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createDungeonEncounterRandom(seed) {
  let state = hashDungeonEncounterSeed(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function roomRole(roomType) {
  if (roomType === "boss" || roomType === "boss_battle") return "boss";
  if (roomType === "elite" || roomType === "elite_battle") return "elite";
  return "normal";
}

function normalizeTarget(monster, instanceId, position, primary = false) {
  const hp = Math.max(1, Math.round(Number(monster?.maxHP ?? monster?.maxHp ?? monster?.hp) || 1));
  return {
    ...monster,
    instanceId,
    position,
    currentHp: hp,
    maxHp: hp,
    hp,
    alive: true,
    isPrimary: primary,
  };
}

const FAMILY_ALIASES = Object.freeze({
  ghost: "ghost", forest: "mountain", mountain: "mountain",
  poison: "insect", insect: "insect", office: "workplace", workplace: "workplace",
  exam: "exam", western: "temple", temple: "temple", treasure: "treasure",
});

function normalizeFamily(family) {
  return FAMILY_ALIASES[family] || family || "ghost";
}

function normalPool(family, tier) {
  const normFamily = normalizeFamily(family);
  const exact = EXPANSION_MONSTERS.filter(monster => monster.family === normFamily
    && Number(monster.tierIndex) === Number(tier)
    && monster.encounter === "normal");
  return exact.length ? exact : EXPANSION_MONSTERS.filter(monster => monster.family === normFamily && monster.encounter === "normal");
}

function rollAdd(pool, random, index) {
  if (!pool.length) throw new Error("dungeon_encounter_no_add_pool");
  const source = pool[Math.floor(random() * pool.length) % pool.length];
  const rolled = applySoloVariant(toLegacyBattleMonster(source), "normal", random());
  return normalizeTarget({ ...source, ...rolled, variant:"normal", variantLabel:"普通" }, `add_${index}`, "front", false);
}

export function isDungeonCombatEncounter(value) {
  return value?.version === DUNGEON_ENCOUNTER_VERSION
    && typeof value.encounterId === "string"
    && ["single", "multi"].includes(value.kind)
    && Array.isArray(value.targets)
    && value.targets.length >= 1
    && new Set(value.targets.map(target => target.instanceId)).size === value.targets.length;
}

export function resolveDungeonCombatEncounter(input = {}) {
  const role = roomRole(input.roomType);
  const encounterId = `dungeon:${input.runId || "legacy"}:${Number(input.floorIndex) || 0}:${input.roomId || "room"}`;
  const seed = `${encounterId}:${input.family || "unknown"}:${Number(input.difficultyTier) || 1}:v${DUNGEON_ENCOUNTER_VERSION}`;
  const random = createDungeonEncounterRandom(seed);
  const kind = role === "normal" ? (random() < 0.5 ? "single" : "multi") : "multi";
  if (!input.primaryMonster) throw new Error("dungeon_encounter_primary_required");
  if (role === "boss" && !input.primaryMonster.id) throw new Error("dungeon_encounter_locked_boss_required");

  const primary = normalizeTarget(input.primaryMonster, "primary", "front", true);
  const targets = [primary];
  if (kind === "multi") {
    const pool = normalPool(input.family, input.difficultyTier);
    targets.push(rollAdd(pool, random, 1), rollAdd(pool, random, 2));
  }
  return {
    version: DUNGEON_ENCOUNTER_VERSION,
    encounterId,
    seed,
    kind,
    roomRole: role,
    primaryTargetId: primary.instanceId,
    targets,
    rewardPolicy: {
      tileRewardOnce: true,
      primarySpecialRewardOnce: true,
      perTargetMaterialAndCard: true,
    },
  };
}

export function resolveOrRestoreDungeonEncounter(input = {}) {
  if (isDungeonCombatEncounter(input.encounter)) return input.encounter;
  if (input.legacyFallback === true) return null;
  return resolveDungeonCombatEncounter(input);
}
