import { COMMON_MONSTER_ABILITIES, getAbilityValue } from "./monsterAbilityCatalog";
import { buildRoundSkillResult } from "./combatSkillEngine";
import { getMonsterScheduledAbility } from "./monsterSkillSchedule";
import { getStatusDurationCap } from "./soloMonsterAbilityEngine";
import { mergeCombatStatus } from "./soloMonsterAbilityEngine";
import { resolveSignatureAbility } from "./signatureAbilityEngine";

const STATUS_EFFECT_BY_SKILL = Object.freeze({
  common_poison: { id: "poison", stat: "hp", unit: "maxHpPct" },
  common_weaken: { id: "atkDown", stat: "atk", unit: "pct" },
  common_shock: { id: "defDown", stat: "def", unit: "pct" },
});

export function selectPartyAbilityTarget(members = {}) {
  const alive = Object.entries(members)
    .filter(([, member]) => member?.alive !== false)
    .sort(([aId, a], [bId, b]) => {
      const aRear = (a.role || "front") === "rear" ? 1 : 0;
      const bRear = (b.role || "front") === "rear" ? 1 : 0;
      return aRear - bRear || aId.localeCompare(bId);
    });
  return alive[0]?.[0] || null;
}

export function buildPartyAbilityPreview({ monster, round, members }) {
  const scheduled = getMonsterScheduledAbility(monster, round);
  if (!scheduled) return null;
  const ability = scheduled.type === "common" ? COMMON_MONSTER_ABILITIES[scheduled.skillId] : null;
  return { ...scheduled, round, targetId: ability?.target === "single" ? selectPartyAbilityTarget(members) : null };
}

export function resolvePartyMonsterAbility({ roomId, monster, round, members, targetFmt = "full_110" }) {
  const scheduled = buildPartyAbilityPreview({ monster, round, members });
  if (!scheduled) return { ok: true, scheduled: null, resolved: null, targetId: null };
  if (scheduled.type === "signature") {
    // 招牌預設 single：指向現行單體目標;破解分母只算被指定成員（PRD 44 single 語意）
    const targetId = selectPartyAbilityTarget(members);
    const submissions = Object.entries(members || {})
      .filter(([memberId, member]) => member?.alive !== false && memberId === targetId)
      .map(([memberId, member]) => ({ memberId, eligible: member.ready === true, arrows: member.arrows || [] }));
    const resolved = resolveSignatureAbility({
      battleId: `party:${roomId}`, round, monster,
      submissions, targetFmt,
      enhanced: scheduled.enhanced === true,
      monsterHpRatio: Number.isFinite(monster.hp) && Number.isFinite(monster.maxHp) && monster.maxHp > 0
        ? Math.max(0, monster.hp / monster.maxHp) : 1,
    });
    return { ok: resolved.ok, scheduled, resolved: resolved.ok ? resolved : null, targetId };
  }

  const ability = COMMON_MONSTER_ABILITIES[scheduled.skillId];
  const statusDefinition = STATUS_EFFECT_BY_SKILL[scheduled.skillId];
  if (!ability) return { ok: true, scheduled, resolved: null, targetId: null, reason: "common_ability_not_found" };

  const targetId = ability.target === "single" ? selectPartyAbilityTarget(members) : null;
  const submissions = Object.entries(members || {})
    .filter(([memberId, member]) => member?.alive !== false && (!targetId || memberId === targetId))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([memberId, member]) => ({ memberId, eligible: member.ready === true, arrows: member.arrows || [] }));
  const strength = getAbilityValue(scheduled.skillId, monster.tierIndex);
  const resolved = buildRoundSkillResult({
    battleId: `party:${roomId}`,
    round,
    monsterId: monster.id,
    skillId: scheduled.skillId,
    submissions,
    status: statusDefinition ? { ...statusDefinition, sourceSkillId: scheduled.skillId, strength, duration: getStatusDurationCap(monster.tierIndex) } : null,
    targetFmt, // 破解品質按靶紙正規化（PRD 15/128）;呼叫端請帶 room.targetFormat
  });
  const scale = resolved.outcome.statusMultiplier;
  const damageScale = resolved.outcome.damageMultiplier;
  if (ability.effect === "nextCounterMultiplier") resolved.skillDamageMult = (strength || 1) * damageScale;
  if (ability.effect === "damageReductionPct") {
    resolved.selfReductionPct = Math.round((strength || 0) * scale);
    resolved.selfReductionDuration = resolved.selfReductionPct > 0 ? ability.duration || 1 : 0;
  }
  if (ability.effect === "healMaxHpPct" || ability.effect === "regenMaxHpPct") resolved.monsterHealMaxHpPct = Math.round((strength || 0) * scale * 10) / 10;
  if (ability.effect === "atkBonusPct") resolved.skillDamageMult = (1 + (strength || 0) / 100) * damageScale;
  if (ability.effect === "weakpointStance") resolved.hqMarkPct = Math.round((ability.highQualityDamageBonusPct || 0) * scale);
  if (ability.effect === "cleanseOne") resolved.selfCleanseCount = resolved.outcome.cancelStatus ? 0 : 1;
  if (ability.effect === "toggleStance") {
    resolved.skillDamageMult = (1 + (ability.atkBonusPct || 0) / 100) * damageScale;
    resolved.selfReductionPct = Math.round((ability.damageReductionPct || 0) * scale);
    resolved.selfReductionDuration = resolved.selfReductionPct > 0 ? 1 : 0;
  }
  if (ability.effect === "reflectPct") {
    resolved.selfReflectPct = Math.round((strength || 0) * scale);
    resolved.selfReflectDuration = resolved.selfReflectPct > 0 ? 1 : 0;
  }
  return { ok: resolved.ok, scheduled, resolved, targetId };
}

export function applyPartyStatusesForRound(member = {}) {
  const maxHp = Math.max(1, member.maxHP || member.hp || 1);
  let hp = Math.max(0, member.hp ?? maxHp);
  let atkMultiplier = 1;
  let defMultiplier = 1;
  const ticks = [];
  const remainingStatuses = [];
  for (const status of member.combatStatuses || []) {
    if (!status || status.duration <= 0) continue;
    if (status.id === "poison") {
      const damage = Math.min(Math.max(0, hp - 1), Math.ceil(maxHp * (status.strength || 0) / 100));
      hp -= damage;
      ticks.push({ id:status.id, damage });
    } else if (status.id === "atkDown") {
      atkMultiplier *= Math.max(0, 1 - (status.strength || 0) / 100);
      ticks.push({ id:status.id, strength:status.strength || 0 });
    } else if (status.id === "defDown") {
      defMultiplier *= Math.max(0, 1 - (status.strength || 0) / 100);
      ticks.push({ id:status.id, strength:status.strength || 0 });
    }
    if (status.duration > 1) remainingStatuses.push({ ...status, duration:status.duration - 1 });
  }
  return { hp, atkMultiplier, defMultiplier, ticks, remainingStatuses };
}

export function addPartyCombatStatus(statuses, incoming) {
  return mergeCombatStatus(statuses, incoming, 3);
}
