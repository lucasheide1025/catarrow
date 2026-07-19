export const COMMON_MONSTER_ABILITIES = Object.freeze({
  common_charge: { id: "common_charge", name: "蓄力", target: "self", minTier: 1, effect: "nextCounterMultiplier", values: [1.25, 1.3, 1.35] },
  common_armor: { id: "common_armor", name: "護甲", target: "self", minTier: 1, effect: "damageReductionPct", values: [15, 20, 25], duration: 1 },
  common_heal: { id: "common_heal", name: "回復", target: "self", minTier: 1, effect: "healMaxHpPct", values: [5, 7, 9], maxUses: 1 },
  common_rage: { id: "common_rage", name: "狂暴", target: "self", minTier: 1, effect: "atkBonusPct", values: [10, 15, 20], duration: 2, hpThresholdPct: 40 },
  common_weakpoint: { id: "common_weakpoint", name: "弱點姿態", target: "self", minTier: 1, effect: "weakpointStance", highQualityDamageBonusPct: 25, failedBreakCounterBonusPct: 20 },
  common_poison: { id: "common_poison", name: "毒素", target: "single", minTier: 1, effect: "dotMaxHpPct", values: [2, 3, 4], nonLethal: true },
  common_weaken: { id: "common_weaken", name: "虛弱", target: "single", minTier: 1, effect: "atkDownPct", values: [10, 15, 20] },
  common_shock: { id: "common_shock", name: "震盪", target: "single", minTier: 1, effect: "defDownPct", values: [10, 15, 20] },
  common_cleanse: { id: "common_cleanse", name: "淨化", target: "self", minTier: 3, effect: "cleanseOne", cooldownRounds: 3 },
  common_stance: { id: "common_stance", name: "戰鬥姿態", target: "self", minTier: 1, effect: "toggleStance", atkBonusPct: 15, damageReductionPct: 15 },
  common_reflect: { id: "common_reflect", name: "有限反射", target: "self", minTier: 3, effect: "reflectPct", values: [null, 8, 10], maxPlayerHpPct: 15, nonLethal: true },
  common_regen: { id: "common_regen", name: "再生", target: "self", minTier: 3, effect: "regenMaxHpPct", values: [null, 6, 8], duration: 2, highQualityHitsToBreak: 2 },
});

export const EFFECT_PRIMITIVES = Object.freeze([
  "direct_hit", "multi_hit", "pierce_def", "pierce_shield", "self_shield",
  "damage_reduction", "atk_down", "def_down", "heal_down", "accuracy_mark",
  "delayed_burst", "lifesteal", "bind_mark", "target_scope", "cleanse_one", "phase_aura",
]);

export function getTierBandIndex(tierIndex) {
  if (tierIndex <= 2) return 0;
  if (tierIndex <= 4) return 1;
  return 2;
}

export function getAbilityValue(abilityId, tierIndex) {
  const ability = COMMON_MONSTER_ABILITIES[abilityId];
  if (!ability || tierIndex < ability.minTier || !ability.values) return null;
  return ability.values[getTierBandIndex(tierIndex)] ?? null;
}

export function validateMonsterAbilityCatalog() {
  const abilities = Object.values(COMMON_MONSTER_ABILITIES);
  const errors = [];
  if (abilities.length !== 12) errors.push("common_ability_count");
  if (new Set(abilities.map(item => item.id)).size !== abilities.length) errors.push("common_ability_id_unique");
  if (COMMON_MONSTER_ABILITIES.common_reflect.minTier !== 3) errors.push("reflect_tier_boundary");
  if (COMMON_MONSTER_ABILITIES.common_cleanse.minTier !== 3) errors.push("cleanse_tier_boundary");
  if (COMMON_MONSTER_ABILITIES.common_regen.minTier !== 3) errors.push("regen_tier_boundary");
  return { ok: errors.length === 0, errors };
}
