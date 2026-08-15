export function canAutoStartStandaloneBattle({ memberId, cardEffects }) {
  return !memberId || cardEffects !== undefined;
}

export function resolvePlayerShieldHit({ hp = 0, shield = 0, damage = 0, piercePct = 0 }) {
  const incoming = Math.max(0, Math.round(Number(damage) || 0));
  const currentShield = Math.max(0, Math.round(Number(shield) || 0));
  const pierce = Math.max(0, Math.min(100, Number(piercePct) || 0));
  const blockableDamage = Math.max(0, Math.round(incoming * (1 - pierce / 100)));
  const absorbed = Math.min(currentShield, blockableDamage);
  const hpDamage = incoming - absorbed;
  return { hp:Math.max(0, Math.round(Number(hp) || 0) - hpDamage), shield:currentShield - absorbed, absorbed, hpDamage };
}

export function resolveMonsterShieldHit({ hp = 0, shield = 0, damage = 0, piercePct = 0 }) {
  return resolvePlayerShieldHit({ hp, shield, damage, piercePct });
}

export function resolveReflectDamage({ incomingDamage = 0, reflectPct = 0 }) {
  return Math.max(0, Math.round((Number(incomingDamage) || 0) * Math.max(0, Number(reflectPct) || 0) / 100));
}
