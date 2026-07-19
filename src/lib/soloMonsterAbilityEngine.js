import { COMMON_MONSTER_ABILITIES, getAbilityValue } from "./monsterAbilityCatalog";
import { buildRoundSkillResult } from "./combatSkillEngine";
import { getMonsterScheduledAbility } from "./monsterSkillSchedule";
import { resolveSignatureAbility } from "./signatureAbilityEngine";

const STATUS_EFFECT_BY_SKILL = Object.freeze({
  common_poison: { id: "poison", stat: "hp", unit: "maxHpPct" },
  common_weaken: { id: "atkDown", stat: "atk", unit: "pct" },
  common_shock: { id: "defDown", stat: "def", unit: "pct" },
});

export function getStatusDurationCap(tierIndex) {
  if (tierIndex <= 2) return 1;
  if (tierIndex <= 4) return 2;
  return 3;
}

// 多人版：submissions = [{ eligible, arrows }]，break 分子/分母由 combatSkillEngine 聚合（母任務 PRD §44）
export function resolveTeamMonsterAbility({ battleId, monster, round, submissions, targetFmt = "full_110", monsterHpRatio = 1 }) {
  const scheduled = getMonsterScheduledAbility(monster, round);
  if (!scheduled) return { ok: true, scheduled: null, resolved: null };
  if (scheduled.type === "signature") {
    const resolved = resolveSignatureAbility({
      battleId, round, monster,
      submissions,
      targetFmt,
      enhanced: scheduled.enhanced === true, // 大王 R6 招牌強化版（排程標記）
      monsterHpRatio, // 大王 70%/40% 階段被動（PRD 54）
    });
    return { ok: resolved.ok, scheduled, resolved: resolved.ok ? resolved : null, reason: resolved.ok ? undefined : resolved.reason };
  }
  const statusDefinition = STATUS_EFFECT_BY_SKILL[scheduled.skillId];
  const ability = COMMON_MONSTER_ABILITIES[scheduled.skillId];
  if (!ability) return { ok: true, scheduled, resolved: null, reason: "common_ability_not_found" };
  const strength = getAbilityValue(scheduled.skillId, monster.tierIndex);
  const result = buildRoundSkillResult({
    battleId,
    round,
    monsterId: monster.id,
    skillId: scheduled.skillId,
    submissions,
    status: statusDefinition ? { ...statusDefinition, sourceSkillId: scheduled.skillId, strength, duration: getStatusDurationCap(monster.tierIndex) } : null,
    targetFmt, // 破解品質按靶紙正規化（PRD 15/128）;呼叫端請帶當前靶紙
  });
  const scale = result.outcome.statusMultiplier;
  const damageScale = result.outcome.damageMultiplier;
  if (ability.effect === "nextCounterMultiplier") result.skillDamageMult = (strength || 1) * damageScale;
  if (ability.effect === "damageReductionPct") {
    result.selfReductionPct = Math.round((strength || 0) * scale);
    result.selfReductionDuration = result.selfReductionPct > 0 ? ability.duration || 1 : 0;
  }
  if (ability.effect === "healMaxHpPct" || ability.effect === "regenMaxHpPct") result.monsterHealMaxHpPct = Math.round((strength || 0) * scale * 10) / 10;
  if (ability.effect === "atkBonusPct") result.skillDamageMult = (1 + (strength || 0) / 100) * damageScale;
  if (ability.effect === "weakpointStance") result.hqMarkPct = Math.round((ability.highQualityDamageBonusPct || 0) * scale);
  if (ability.effect === "cleanseOne") result.selfCleanseCount = result.outcome.cancelStatus ? 0 : 1;
  if (ability.effect === "toggleStance") {
    result.skillDamageMult = (1 + (ability.atkBonusPct || 0) / 100) * damageScale;
    result.selfReductionPct = Math.round((ability.damageReductionPct || 0) * scale);
    result.selfReductionDuration = result.selfReductionPct > 0 ? 1 : 0;
  }
  if (ability.effect === "reflectPct") {
    result.selfReflectPct = Math.round((strength || 0) * scale);
    result.selfReflectDuration = result.selfReflectPct > 0 ? 1 : 0;
  }
  return { ok: result.ok, scheduled, resolved: result };
}

// 單人版 = submissions 長度 1 的特例（既有呼叫端介面不變）
export function resolveSoloMonsterAbility({ battleId, monster, round, arrows, targetFmt = "full_110", monsterHpRatio = 1 }) {
  return resolveTeamMonsterAbility({
    battleId, monster, round,
    submissions: [{ eligible: true, arrows }],
    targetFmt, monsterHpRatio,
  });
}

// 同能力（atk/def）總減幅上限（PRD 51）
const STAT_AGGREGATE_CAP_PCT = 40;

function capStatStrength(statuses, incoming) {
  if (incoming.unit !== "pct" || (incoming.stat !== "atk" && incoming.stat !== "def")) return incoming;
  const othersSum = statuses
    .filter(status => status.id !== incoming.id && status.stat === incoming.stat && status.unit === "pct")
    .reduce((sum, status) => sum + (status.strength || 0), 0);
  const allowed = Math.max(0, STAT_AGGREGATE_CAP_PCT - othersSum);
  return { ...incoming, strength: Math.min(incoming.strength || 0, allowed) };
}

// PRD 51：同名異常只刷新回合不疊加數值;不同異常最多 3 種;同能力總減幅 ≤40%
export function mergeCombatStatus(statuses = [], incoming, maxStatuses = 3) {
  if (!incoming) return [...statuses];
  const capped = capStatStrength(statuses, incoming);
  const existingIndex = statuses.findIndex(status => status.id === capped.id);
  if (existingIndex >= 0) {
    return statuses.map((status, index) => index === existingIndex
      ? { ...status, ...capped, strength: Math.max(status.strength || 0, capped.strength || 0), duration: capped.duration }
      : status);
  }
  if (statuses.length >= maxStatuses) return [...statuses];
  return [...statuses, capped];
}

export function applySoloStatusTick({ status, playerHp, playerMaxHp }) {
  if (!status || status.duration <= 0) return { playerHp, status: null, damage: 0 };
  let damage = 0;
  if (status.id === "poison") damage = Math.ceil(playerMaxHp * (status.strength || 0) / 100);
  const nextHp = status.id === "poison" ? Math.max(1, playerHp - damage) : playerHp;
  const nextDuration = status.duration - 1;
  return { playerHp: nextHp, status: nextDuration > 0 ? { ...status, duration: nextDuration } : null, damage: Math.max(0, playerHp - nextHp) };
}
