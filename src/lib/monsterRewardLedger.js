const MAX_REWARD_ITEMS = 64;
const MAX_ITEM_QUANTITY = 10000;
const MAX_COINS = 1000000;

function requireIdentity(value, code) {
  if (typeof value !== "string" || !value.trim() || value.length > 240) throw new Error(code);
  return value.trim();
}

export function buildMonsterRewardClaimId({ battleId, memberId, rewardType = "battle" }) {
  const parts = [
    requireIdentity(battleId, "invalid_battle_id"),
    requireIdentity(memberId, "invalid_member_id"),
    requireIdentity(rewardType, "invalid_reward_type"),
  ];
  return parts.map(part => encodeURIComponent(part)).join("~");
}

export function normalizeMonsterReward({ battleId, memberId, rewardType = "battle", materials = [], coins = 0, metadata = {} }) {
  const claimId = buildMonsterRewardClaimId({ battleId, memberId, rewardType });
  if (!Array.isArray(materials) || materials.length > MAX_REWARD_ITEMS) throw new Error("invalid_reward_materials");
  const materialTotals = {};
  for (const material of materials) {
    const id = requireIdentity(material?.id || material?.materialId, "invalid_material_id");
    const quantity = Number(material?.quantity ?? material?.count ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) throw new Error("invalid_material_quantity");
    materialTotals[id] = (materialTotals[id] || 0) + quantity;
    if (materialTotals[id] > MAX_ITEM_QUANTITY) throw new Error("material_quantity_limit");
  }
  const normalizedCoins = Number(coins || 0);
  if (!Number.isInteger(normalizedCoins) || normalizedCoins < 0 || normalizedCoins > MAX_COINS) throw new Error("invalid_reward_coins");
  return {
    claimId,
    battleId: requireIdentity(battleId, "invalid_battle_id"),
    memberId: requireIdentity(memberId, "invalid_member_id"),
    rewardType: requireIdentity(rewardType, "invalid_reward_type"),
    materialTotals,
    coins: normalizedCoins,
    metadata: sanitizeMetadata(metadata),
  };
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const allowed = ["mode", "monsterId", "catalogVersion", "source"];
  return Object.fromEntries(allowed
    .filter(key => ["string", "number", "boolean"].includes(typeof metadata[key]))
    .map(key => [key, metadata[key]]));
}

export function applyMonsterRewardToInventory(items = {}, materialTotals = {}) {
  const next = { ...items };
  for (const [materialId, quantity] of Object.entries(materialTotals)) {
    next[materialId] = Math.max(0, Number(next[materialId]) || 0) + quantity;
  }
  return next;
}
