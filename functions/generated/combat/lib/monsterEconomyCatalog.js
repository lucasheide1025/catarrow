"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VARIANT_MATERIAL_MULTIPLIER = exports.UPGRADE_CONVERSION = exports.TIER_BASE_MATERIAL = exports.SAME_TIER_CONVERSION = exports.NORMAL_MATERIALS = exports.NORMAL_DROP_MULTIPLIER = exports.MATERIAL_BY_ID = void 0;
exports.getNormalMaterialPool = getNormalMaterialPool;
exports.getNormalMonsterMaterialDrop = getNormalMonsterMaterialDrop;
exports.previewSameTierConversion = previewSameTierConversion;
exports.previewTierUpgrade = previewTierUpgrade;
exports.validateMonsterEconomyCatalog = validateMonsterEconomyCatalog;
var _monsterExpansionCatalog = require("./monsterExpansionCatalog");
const TIER_BASE_MATERIAL = exports.TIER_BASE_MATERIAL = Object.freeze([0, 1, 1, 2, 2, 3, 3]);
const NORMAL_DROP_MULTIPLIER = exports.NORMAL_DROP_MULTIPLIER = Object.freeze({
  solo: 3,
  party: 5,
  dungeonNormal: 3,
  dungeonElite: 4,
  dungeonPartyNormal: 3,
  dungeonPartyElite: 4
});
const VARIANT_MATERIAL_MULTIPLIER = exports.VARIANT_MATERIAL_MULTIPLIER = Object.freeze({
  weakened: 0.8,
  normal: 1,
  strong: 1.2
});
const SAME_TIER_CONVERSION = exports.SAME_TIER_CONVERSION = Object.freeze({
  1: {
    input: 3,
    coins: 100
  },
  2: {
    input: 3,
    coins: 200
  },
  3: {
    input: 3,
    coins: 400
  },
  4: {
    input: 4,
    coins: 800
  },
  5: {
    input: 4,
    coins: 1500
  },
  6: {
    input: 5,
    coins: 3000
  }
});
const UPGRADE_CONVERSION = exports.UPGRADE_CONVERSION = Object.freeze({
  1: {
    input: 5,
    coins: 300
  },
  2: {
    input: 5,
    coins: 600
  },
  3: {
    input: 5,
    coins: 1200
  },
  4: {
    input: 5,
    coins: 2500
  },
  5: {
    input: 5,
    coins: 5000
  }
});
const NORMAL_MATERIALS = exports.NORMAL_MATERIALS = Object.freeze(_monsterExpansionCatalog.EXPANSION_MATERIALS.filter(item => item.kind === "normal"));
const MATERIAL_BY_ID = exports.MATERIAL_BY_ID = Object.freeze(Object.fromEntries(_monsterExpansionCatalog.EXPANSION_MATERIALS.map(item => [item.id, item])));
function positiveInteger(value, code = "invalid_quantity") {
  if (!Number.isInteger(value) || value < 1) throw new Error(code);
}
function getNormalMonsterMaterialDrop({
  monsterId,
  mode,
  variant = "normal"
}) {
  const monster = _monsterExpansionCatalog.EXPANSION_MONSTER_BY_ID[monsterId];
  if (!monster || monster.encounter !== "normal") throw new Error("normal_monster_required");
  const modeMultiplier = NORMAL_DROP_MULTIPLIER[mode];
  const variantMultiplier = VARIANT_MATERIAL_MULTIPLIER[variant];
  if (!modeMultiplier) throw new Error("invalid_drop_mode");
  if (!variantMultiplier) throw new Error("invalid_variant");
  return {
    materialId: monster.material.id,
    quantity: Math.max(1, Math.ceil(TIER_BASE_MATERIAL[monster.tierIndex] * modeMultiplier * variantMultiplier))
  };
}
function previewSameTierConversion({
  sourceMaterialId,
  targetMaterialId,
  batches
}) {
  positiveInteger(batches, "invalid_batches");
  const source = MATERIAL_BY_ID[sourceMaterialId];
  const target = MATERIAL_BY_ID[targetMaterialId];
  if (!source || !target || source.kind !== "normal" || target.kind !== "normal") throw new Error("normal_material_required");
  if (source.tierIndex !== target.tierIndex) throw new Error("same_tier_required");
  if (source.id === target.id) throw new Error("different_material_required");
  const rate = SAME_TIER_CONVERSION[source.tierIndex];
  return {
    operation: "sameTier",
    source: {
      materialId: source.id,
      quantity: rate.input * batches
    },
    target: {
      materialId: target.id,
      quantity: batches
    },
    coins: rate.coins * batches,
    batches
  };
}
function previewTierUpgrade({
  sourceMaterialId,
  targetMaterialId,
  batches
}) {
  positiveInteger(batches, "invalid_batches");
  const source = MATERIAL_BY_ID[sourceMaterialId];
  const target = MATERIAL_BY_ID[targetMaterialId];
  if (!source || !target || source.kind !== "normal" || target.kind !== "normal") throw new Error("normal_material_required");
  if (source.family !== target.family) throw new Error("same_family_required");
  if (target.tierIndex !== source.tierIndex + 1) throw new Error("next_tier_required");
  const rate = UPGRADE_CONVERSION[source.tierIndex];
  if (!rate) throw new Error("t6_upgrade_forbidden");
  return {
    operation: "tierUpgrade",
    source: {
      materialId: source.id,
      quantity: rate.input * batches
    },
    target: {
      materialId: target.id,
      quantity: batches
    },
    coins: rate.coins * batches,
    batches
  };
}
function getNormalMaterialPool({
  maxTier = 6,
  family,
  exactTier
}) {
  if (!Number.isInteger(maxTier) || maxTier < 1 || maxTier > 6) throw new Error("invalid_max_tier");
  return NORMAL_MATERIALS.filter(item => item.tierIndex <= maxTier && (!exactTier || item.tierIndex === exactTier) && (!family || item.family === family));
}
function validateMonsterEconomyCatalog() {
  const errors = [];
  if (NORMAL_MATERIALS.length !== 126) errors.push("normal_material_count");
  if (_monsterExpansionCatalog.EXPANSION_MATERIALS.filter(item => item.kind === "miniBoss").length !== 84) errors.push("mini_material_count");
  if (_monsterExpansionCatalog.EXPANSION_MATERIALS.filter(item => item.kind === "boss").length !== 42) errors.push("boss_material_count");
  if (NORMAL_MATERIALS.some(item => !SAME_TIER_CONVERSION[item.tierIndex])) errors.push("conversion_rate_missing");
  return {
    ok: errors.length === 0,
    errors
  };
}
