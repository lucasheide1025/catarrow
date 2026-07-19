export const SPECIALIZATION_UNLOCK_COST = 10000;

export const SPECIALIZATION_TRACKS = Object.freeze([
  { id: "precision", slot: "weapon", name: "精準" },
  { id: "armorBreak", slot: "weapon", name: "破甲" },
  { id: "bossHunter", slot: "weapon", name: "獵王" },
  { id: "tenacity", slot: "armor", name: "堅韌" },
  { id: "immunity", slot: "armor", name: "免疫" },
  { id: "guard", slot: "armor", name: "守勢" },
  { id: "nutrition", slot: "accessory", name: "營養" },
  { id: "wellRested", slot: "accessory", name: "睡飽" },
  { id: "support", slot: "accessory", name: "應援" },
]);

const LEVELS = Object.freeze([
  null,
  { tiers: [20, 10, 0, 0, 0, 0], coins: 1000, successRate: 0.45 },
  { tiers: [30, 15, 8, 0, 0, 0], coins: 1500, successRate: 0.425 },
  { tiers: [40, 20, 12, 6, 0, 0], coins: 2500, successRate: 0.4 },
  { tiers: [50, 30, 18, 10, 5, 0], coins: 4000, successRate: 0.375 },
  { tiers: [60, 40, 25, 15, 8, 4], coins: 6000, successRate: 0.35 },
  { tiers: [80, 55, 35, 22, 12, 6], coins: 9000, successRate: 0.325 },
  { tiers: [100, 70, 45, 30, 18, 9], coins: 13000, successRate: 0.3 },
  { tiers: [125, 90, 60, 40, 24, 12], coins: 18000, successRate: 0.275, bossMaterial: { kind: "miniBoss", quantity: 1 } },
  { tiers: [160, 120, 80, 55, 32, 16], coins: 25000, successRate: 0.25, bossMaterial: { kind: "miniBoss", quantity: 2 } },
  { tiers: [200, 150, 100, 70, 45, 25], coins: 35000, successRate: 0.2, bossMaterial: { kind: "boss", quantity: 1 } },
]);

function splitThree(total, rotation) {
  if (!total) return [0, 0, 0];
  const weights = [0.4, 0.35, 0.25];
  const result = [0, 0, 0];
  const rows = weights.map((weight, rank) => {
    const exact = total * weight;
    return { index: (rank + rotation) % 3, value: Math.floor(exact), remainder: exact % 1, rank };
  });
  let remaining = total - rows.reduce((sum, row) => sum + row.value, 0);
  rows.sort((a, b) => b.remainder - a.remainder || a.rank - b.rank).forEach(row => {
    if (remaining > 0) { row.value += 1; remaining -= 1; }
    result[row.index] = row.value;
  });
  return result;
}

export function getSpecializationUpgradeCost({ trackId, targetLevel }) {
  const trackIndex = SPECIALIZATION_TRACKS.findIndex(item => item.id === trackId);
  if (trackIndex < 0) throw new Error("invalid_specialization_track");
  if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > 10) throw new Error("invalid_target_level");
  const level = LEVELS[targetLevel];
  return {
    trackId,
    targetLevel,
    coins: level.coins,
    tierMaterials: level.tiers.map((total, index) => ({ tierIndex: index + 1, total, split: splitThree(total, trackIndex % 3) })).filter(item => item.total > 0),
    bossMaterial: level.bossMaterial || null,
    baseSuccessRate: level.successRate,
  };
}

export function getSpecializationAttemptChance({ trackId, targetLevel, consecutiveFailures = 0 }) {
  if (!Number.isInteger(consecutiveFailures) || consecutiveFailures < 0) throw new Error("invalid_failure_count");
  const cost = getSpecializationUpgradeCost({ trackId, targetLevel });
  return consecutiveFailures >= 3 ? 1 : Math.min(1, cost.baseSuccessRate + consecutiveFailures * 0.15);
}

export function resolveSpecializationAttempt({ trackId, targetLevel, consecutiveFailures = 0, roll }) {
  const successRate = getSpecializationAttemptChance({ trackId, targetLevel, consecutiveFailures });
  if (typeof roll !== "number" || roll < 0 || roll >= 1) throw new Error("invalid_roll");
  const succeeded = roll < successRate;
  return {
    succeeded,
    successRate,
    nextLevel: succeeded ? targetLevel : targetLevel - 1,
    nextConsecutiveFailures: succeeded ? 0 : consecutiveFailures + 1,
    consumed: true,
    guaranteed: consecutiveFailures >= 3,
  };
}

export function validateSpecializationCatalog() {
  const errors = [];
  if (SPECIALIZATION_TRACKS.length !== 9) errors.push("track_count");
  if (new Set(SPECIALIZATION_TRACKS.map(item => item.id)).size !== 9) errors.push("track_id_unique");
  for (const track of SPECIALIZATION_TRACKS) {
    for (let level = 1; level <= 10; level += 1) {
      const cost = getSpecializationUpgradeCost({ trackId: track.id, targetLevel: level });
      if (cost.tierMaterials.some(item => item.split.reduce((sum, value) => sum + value, 0) !== item.total)) errors.push("material_split_total");
    }
  }
  return { ok: errors.length === 0, errors };
}
