import { EXPANSION_MONSTER_BY_ID } from "./monsterExpansionCatalog";
import { getNormalMaterialPool, TIER_BASE_MATERIAL } from "./monsterEconomyCatalog";

export const BOSS_ROOM_ODDS = Object.freeze({ miniA: 0.35, miniB: 0.35, boss: 0.3 });
const BOSS_MARKS = Object.freeze([0, 1, 1, 2, 3, 5, 8]);
const BOSS_COINS = Object.freeze([0, 300, 600, 1200, 2400, 4800, 8000]);

function normalizeRoll(roll) {
  if (typeof roll !== "number" || roll < 0 || roll >= 1) throw new Error("invalid_roll");
  return roll;
}

function hashIndex(value, length) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % length;
}

export function selectBossRoomEncounter({ roll, consecutiveNonBoss = 0 }) {
  if (!Number.isInteger(consecutiveNonBoss) || consecutiveNonBoss < 0) throw new Error("invalid_pity");
  if (consecutiveNonBoss >= 3) return { role: "boss", nextConsecutiveNonBoss: 0, guaranteed: true };
  const value = normalizeRoll(roll);
  const role = value < 0.35 ? "miniA" : value < 0.7 ? "miniB" : "boss";
  return { role, nextConsecutiveNonBoss: role === "boss" ? 0 : consecutiveNonBoss + 1, guaranteed: false };
}

export function resolveBossCardDrop({ encounter, firstDefeat = false, misses = 0, roll = 0 }) {
  if (!["miniBoss", "boss"].includes(encounter)) throw new Error("boss_encounter_required");
  if (firstDefeat) return { dropped: true, nextMisses: 0, guaranteed: true, reason: "firstDefeat" };
  const threshold = encounter === "miniBoss" ? 5 : 8;
  if (misses >= threshold - 1) return { dropped: true, nextMisses: 0, guaranteed: true, reason: "pity" };
  const dropped = normalizeRoll(roll) < (encounter === "miniBoss" ? 0.2 : 0.1);
  return { dropped, nextMisses: dropped ? 0 : misses + 1, guaranteed: false, reason: dropped ? "roll" : "miss" };
}

export function splitMaterialTotal({ materials, total, rotationKey }) {
  if (!Array.isArray(materials) || materials.length !== 3) throw new Error("three_materials_required");
  if (!Number.isInteger(total) || total < 0) throw new Error("invalid_total");
  const offset = hashIndex(rotationKey, 3);
  const weights = [0.4, 0.35, 0.25];
  const ranked = weights.map((weight, index) => {
    const exact = total * weight;
    return { index: (index + offset) % 3, quantity: Math.floor(exact), remainder: exact - Math.floor(exact), rank: index };
  });
  let remaining = total - ranked.reduce((sum, item) => sum + item.quantity, 0);
  [...ranked].sort((a, b) => b.remainder - a.remainder || a.rank - b.rank).forEach(item => {
    if (remaining > 0) { item.quantity += 1; remaining -= 1; }
  });
  return ranked.map(item => ({ materialId: materials[item.index].id, quantity: item.quantity })).filter(item => item.quantity > 0);
}

export function buildBossReward({ monsterId }) {
  const monster = EXPANSION_MONSTER_BY_ID[monsterId];
  if (!monster || !["miniBoss", "boss"].includes(monster.encounter)) throw new Error("boss_monster_required");
  const isBoss = monster.encounter === "boss";
  const tier = monster.tierIndex;
  const materials = getNormalMaterialPool({ family: monster.family, exactTier: tier });
  const generalTotal = TIER_BASE_MATERIAL[tier] * (isBoss ? 8 : 5);
  return {
    bossMaterial: { materialId: monster.material.id, quantity: 1 },
    generalMaterials: splitMaterialTotal({ materials, total: generalTotal, rotationKey: monster.id }),
    bossMarks: BOSS_MARKS[tier] * (isBoss ? 2 : 1),
    runeFragments: (tier + 2) * (isBoss ? 2 : 1),
    coins: BOSS_COINS[tier] * (isBoss ? 2 : 1),
    choiceCount: isBoss ? 2 : 1,
  };
}

export function buildChoiceChestReward({ type, monsterId, roll = 0 }) {
  const monster = EXPANSION_MONSTER_BY_ID[monsterId];
  if (!monster || !["miniBoss", "boss"].includes(monster.encounter)) throw new Error("boss_monster_required");
  const fixed = buildBossReward({ monsterId });
  if (type === "material") {
    const materials = getNormalMaterialPool({ family: monster.family, exactTier: monster.tierIndex });
    return { type, materials: splitMaterialTotal({ materials, total: TIER_BASE_MATERIAL[monster.tierIndex] * 5, rotationKey: `${monster.id}:choice` }) };
  }
  if (type === "coins") return { type, coins: Math.floor(fixed.coins * 1.5) };
  if (type === "exploration") {
    const value = normalizeRoll(roll);
    return value < 0.6 ? { type, rarity: "common", quantity: 3 }
      : value < 0.95 ? { type, rarity: "rare", quantity: 2 }
        : { type, rarity: "boss", quantity: 1 };
  }
  throw new Error("invalid_choice_chest");
}

export function buildRewardKey({ battleId, memberId, rewardType }) {
  if (!battleId || !memberId || !rewardType) throw new Error("invalid_reward_identity");
  return `${battleId}:${memberId}:${rewardType}`;
}
