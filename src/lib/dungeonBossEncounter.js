import { EXPANSION_MONSTERS, MONSTER_EXPANSION_VERSION } from "./monsterExpansionCatalog";
import { toLegacyBattleMonster } from "./monsterExpansionAdapter";
import { selectBossRoomEncounter } from "./monsterLootEngine";

export const DUNGEON_EXPANSION_RUN_VERSION = 1;

const FAMILY_ALIASES = Object.freeze({
  ghost: "ghost",
  forest: "mountain",
  mountain: "mountain",
  poison: "insect",
  insect: "insect",
  office: "workplace",
  workplace: "workplace",
  exam: "exam",
  western: "temple",
  temple: "temple",
  treasure: "treasure",
});

const TIER_ORDER = Object.freeze(["common", "rare", "elite", "fierce", "boss", "mythic"]);

function hashSeed(value) {
  let hash = 2166136261;
  const text = String(value || "dungeon-boss");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed, salt) {
  let value = hashSeed(`${seed}|${salt}`);
  value += 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function normalizeTier(difficultyTier) {
  if (typeof difficultyTier === "string" && TIER_ORDER.includes(difficultyTier)) return difficultyTier;
  const index = Math.max(0, Math.min(5, Math.floor(Number(difficultyTier) || 1) - 1));
  return TIER_ORDER[index];
}

export function isLockedDungeonBossEncounter(value) {
  return value?.runVersion === DUNGEON_EXPANSION_RUN_VERSION
    && value?.catalogVersion === MONSTER_EXPANSION_VERSION
    && typeof value?.monsterId === "string"
    && ["miniBoss", "boss"].includes(value?.encounter);
}

export function createLockedDungeonBossEncounter({
  runId,
  roomId = "boss",
  family,
  difficultyTier,
  consecutiveNonBoss = 0,
  lockedEncounter = null,
}) {
  if (isLockedDungeonBossEncounter(lockedEncounter)) return lockedEncounter;
  if (!runId) throw new Error("missing_dungeon_run_id");

  const normalizedFamily = FAMILY_ALIASES[family] || family;
  const tier = normalizeTier(difficultyTier);
  const candidates = EXPANSION_MONSTERS.filter(monster =>
    monster.family === normalizedFamily
    && monster.tier === tier
    && ["miniBoss", "boss"].includes(monster.encounter),
  );
  const miniBosses = candidates.filter(monster => monster.encounter === "miniBoss");
  const bosses = candidates.filter(monster => monster.encounter === "boss");
  if (miniBosses.length !== 2 || bosses.length !== 1) {
    throw new Error(`invalid_dungeon_boss_pool:${normalizedFamily}:${tier}`);
  }

  const seed = `${runId}|${roomId}|${normalizedFamily}|${tier}|${MONSTER_EXPANSION_VERSION}`;
  const selection = selectBossRoomEncounter({
    roll:seededUnit(seed, "encounter"),
    consecutiveNonBoss,
  });
  const selected = selection.role === "boss"
    ? bosses[0]
    : miniBosses[selection.role === "miniB" ? 1 : 0];

  return Object.freeze({
    runVersion: DUNGEON_EXPANSION_RUN_VERSION,
    catalogVersion: MONSTER_EXPANSION_VERSION,
    resolvedKey: `dungeonBoss:${runId}:${roomId}`,
    roomId,
    family: normalizedFamily,
    tier,
    encounter: selected.encounter,
    role:selection.role,
    guaranteed:selection.guaranteed,
    nextConsecutiveNonBoss:selection.nextConsecutiveNonBoss,
    monsterId: selected.id,
    monsterSnapshot: toLegacyBattleMonster(selected),
  });
}
