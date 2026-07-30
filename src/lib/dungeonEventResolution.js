const round2 = value => Math.round(value * 100) / 100;

function resolveRandomEffect(effect = {}, random = Math.random) {
  if (!Array.isArray(effect.random) || effect.random.length === 0) return { ...effect };
  const index = Math.min(effect.random.length - 1, Math.floor(random() * effect.random.length));
  return { ...(effect.random[index] || {}) };
}

function signedPercent(value) {
  const amount = Math.round(Number(value || 0) * 100);
  return `${amount > 0 ? "+" : ""}${amount}%`;
}

export function formatResolvedEventBadges(effect = {}, cost = {}) {
  const badges = [];
  if (cost.hp) badges.push(`全隊 HP -${Math.round(cost.hp * 100)}%`);
  if (cost.gold) badges.push(`每人金幣 -${cost.gold}`);
  if (effect.hp) badges.push(`全隊 HP ${signedPercent(effect.hp)}`);
  if (effect.atk) badges.push(`全隊 ATK ${signedPercent(effect.atk)}`);
  if (effect.def) badges.push(`全隊 DEF ${signedPercent(effect.def)}`);
  if (effect.dmg) badges.push(`全隊傷害 ${signedPercent(effect.dmg)}`);
  if (effect.monsterHp) badges.push(`後續怪物 HP ${signedPercent(effect.monsterHp)}`);
  if (effect.monsterAtk) badges.push(`後續怪物 ATK ${signedPercent(effect.monsterAtk)}`);
  if (effect.gold) badges.push(`每人金幣 ${effect.gold > 0 ? "+" : ""}${effect.gold}`);
  if (effect.item) badges.push(`獲得道具：${effect.item}`);
  return badges.length ? badges : ["沒有發生屬性變化"];
}

export function buildTeamEventResolution({ event, choice = null, members = {}, random = Math.random } = {}) {
  const source = choice || event || {};
  const cost = { ...(source.cost || {}) };
  const effect = resolveRandomEffect(source.effect || {}, random);
  const updates = {};

  for (const [memberId, member] of Object.entries(members || {})) {
    if (!member || member.alive === false) continue;
    const maxHP = Number(member.maxHP) || 100;
    const currentHP = Number(member.hp) || maxHP;
    if (cost.hp || effect.hp) {
      const hpDelta = maxHP * ((effect.hp || 0) - (cost.hp || 0));
      updates[`members.${memberId}.hp`] = Math.max(1, Math.min(maxHP, Math.round(currentHP + hpDelta)));
    }
    if (effect.atk) updates[`members.${memberId}.buffs.atkMult`] = round2((member.buffs?.atkMult || 1) * (1 + effect.atk));
    if (effect.def) updates[`members.${memberId}.buffs.defMult`] = round2((member.buffs?.defMult || 1) * (1 + effect.def));
    if (effect.dmg) updates[`members.${memberId}.buffs.dmgMult`] = round2((member.buffs?.dmgMult || 1) * (1 + effect.dmg));
  }

  if (effect.monsterHp) updates["nextFloorModifiers.monsterHpMult"] = round2(1 + effect.monsterHp);
  if (effect.monsterAtk) updates["nextFloorModifiers.monsterAtkMult"] = round2(1 + effect.monsterAtk);

  return {
    eventId: event?.id || null,
    title: event?.title || "",
    choiceLabel: choice?.label || null,
    cost,
    effect,
    badges: formatResolvedEventBadges(effect, cost),
    updates,
  };
}
