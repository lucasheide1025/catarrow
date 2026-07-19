const clampLevel = level => Math.max(0, Math.min(10, Number.isFinite(level) ? Math.floor(level) : 0));

export function getSpecializationEffect(trackId, level) {
  const value = clampLevel(level);
  const effects = {
    precision: { highQualityDamagePct: value * 2 },
    armorBreak: { defenseIgnorePct: value * 1.5 },
    bossHunter: { bossDamagePct: value * 2 },
    tenacity: { finalDamageReductionPct: value },
    immunity: { statusStrengthReductionPct: value * 3, statusDurationReduction: value >= 10 ? 2 : value >= 5 ? 1 : 0 },
    guard: { hpThresholdPct: 35, finalDamageReductionPct: value * 2 },
    nutrition: { maxHpFlat: value * 3 },
    wellRested: { endRoundHeal: value },
    support: { companionAttackPct: value * 3, companionHealingPct: value * 3 },
  };
  if (!effects[trackId]) throw new Error("invalid_specialization_track");
  return effects[trackId];
}

export function applyWeaponSpecialization({ damage, monsterDefense = 0, trackId, level, highQuality = false, bossTagged = false }) {
  if (!Number.isFinite(damage) || damage < 0 || !Number.isFinite(monsterDefense) || monsterDefense < 0) throw new Error("invalid_damage_input");
  const effect = getSpecializationEffect(trackId, level);
  if (trackId === "precision") return { damage: Math.round(damage * (highQuality ? 1 + effect.highQualityDamagePct / 100 : 1)), effectiveDefense: monsterDefense };
  if (trackId === "armorBreak") return { damage: Math.round(damage), effectiveDefense: Math.max(0, monsterDefense * (1 - effect.defenseIgnorePct / 100)) };
  if (trackId === "bossHunter") return { damage: Math.round(damage * (bossTagged ? 1 + effect.bossDamagePct / 100 : 1)), effectiveDefense: monsterDefense };
  throw new Error("weapon_specialization_required");
}

export function applyArmorSpecialization({ incomingDamage, currentHp, maxHp, trackId, level, status }) {
  if (!Number.isFinite(incomingDamage) || incomingDamage < 0 || !Number.isFinite(currentHp) || !Number.isFinite(maxHp) || maxHp <= 0) throw new Error("invalid_defense_input");
  const effect = getSpecializationEffect(trackId, level);
  let reduction = 0;
  if (trackId === "tenacity") reduction = effect.finalDamageReductionPct;
  else if (trackId === "guard") reduction = currentHp / maxHp <= effect.hpThresholdPct / 100 ? effect.finalDamageReductionPct : 0;
  else if (trackId !== "immunity") throw new Error("armor_specialization_required");
  const adjustedStatus = status && trackId === "immunity" ? {
    ...status,
    strength: Math.max(0, status.strength * (1 - effect.statusStrengthReductionPct / 100)),
    duration: Math.max(1, status.duration - effect.statusDurationReduction),
  } : status || null;
  return { damage: Math.max(0, Math.round(incomingDamage * (1 - reduction / 100))), status: adjustedStatus, reductionPct: reduction };
}

export function applyAccessorySpecialization({ currentHp, maxHp, trackId, level, companionAttack = 0, companionHealing = 0, alive = true }) {
  if (!Number.isFinite(currentHp) || !Number.isFinite(maxHp) || maxHp <= 0) throw new Error("invalid_hp_input");
  const effect = getSpecializationEffect(trackId, level);
  if (trackId === "nutrition") {
    const nextMaxHp = maxHp + effect.maxHpFlat;
    return { maxHp: nextMaxHp, currentHp: Math.min(nextMaxHp, currentHp + effect.maxHpFlat), companionAttack, companionHealing };
  }
  if (trackId === "wellRested") return { maxHp, currentHp: alive ? Math.min(maxHp, currentHp + effect.endRoundHeal) : currentHp, companionAttack, companionHealing };
  if (trackId === "support") return {
    maxHp, currentHp,
    companionAttack: Math.round(companionAttack * (1 + effect.companionAttackPct / 100)),
    companionHealing: Math.round(companionHealing * (1 + effect.companionHealingPct / 100)),
  };
  throw new Error("accessory_specialization_required");
}
