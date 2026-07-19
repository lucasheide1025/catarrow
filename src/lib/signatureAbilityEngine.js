// src/lib/signatureAbilityEngine.js — 252 招牌技能共用 resolver（PRD 33-34）
// 五種模式共用：adapter 只提供 submissions/round/靶紙/持久化,不得複製規則（PRD 34）。
// 結算順序與破解語意沿用 combatSkillEngine（≥85 全免 / 70-84 ×0.35+取消狀態 / 50-69 ×0.7+狀態減半 / <50 全額）。
//
// 回傳的傷害是「倍率」而非絕對值：skillDamageMult = Tier基準 × 積木倍率 × (強化版1.1) × 破解減幅。
// 呼叫端用自己模式的反擊公式（含玩家 DEF）乘上去,確保各模式數值一致由 adapter 決定。

import { calculateBreakRatio, getBreakOutcome, makeSkillResolutionKey, reduceStatusDuration } from "./combatSkillEngine";
import { getSignatureEffect, TIER_SKILL_ATK_MULT } from "./signatureEffectCatalog";
import { getTargetFaceFormat } from "./targetFace";

// 大王第6回合「招牌強化版」倍率（PRD 54 未給數值;集中此處供調整）
export const SIGNATURE_ENHANCED_MULT = 1.1;
// 反射單次上限：最大 HP 15%（monster-skill-catalog 積木規範）
export const REFLECT_MAX_PLAYER_HP_PCT = 15;

const STATUS_DURATION_CAP = tierIndex => (tierIndex <= 2 ? 1 : tierIndex <= 4 ? 2 : 3);

function arrowScoreRatio(arrow, targetFmt) {
  const score = arrow && typeof arrow === "object" ? (arrow.score ?? arrow.value ?? 0) : arrow;
  if (score === "X" || score === "x") return 1;
  const value = Number(score);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const max = Number(getTargetFaceFormat(targetFmt)?.maxScore) || 10;
  return Math.max(0, Math.min(1, value / max));
}

function scaleStatus(status, outcome, tierIndex) {
  if (!status || outcome.cancelStatus) return null;
  const duration = Math.min(status.duration || 1, STATUS_DURATION_CAP(tierIndex));
  return {
    ...status,
    strength: typeof status.strength === "number"
      ? Math.round(status.strength * outcome.statusMultiplier * 10) / 10
      : status.strength,
    duration: reduceStatusDuration(duration, outcome.statusMultiplier),
  };
}

// 階段被動彙總（PRD 54）：HP ≤70% 啟動 p70,≤40% 疊加 p40;被動不額外攻擊,只修正本次結算參數
function sumPhaseModifiers(effect, monsterHpRatio) {
  const mods = { shieldPct: 0, damagePct: 0, reductionPct: 0, reflectPct: 0, statusPct: 0, delayedPct: 0, shieldPiercePct: 0 };
  if (!effect.phases || !Number.isFinite(monsterHpRatio)) return mods;
  const apply = phase => { for (const key of Object.keys(phase)) mods[key] += phase[key]; };
  if (monsterHpRatio <= 0.7) apply(effect.phases.p70);
  if (monsterHpRatio <= 0.4) apply(effect.phases.p40);
  return mods;
}

export function resolveSignatureAbility({
  battleId,
  round,
  monster,
  submissions,
  targetFmt = "full_110",
  ruleset = "general",
  enhanced = false,
  monsterHpRatio = 1,
}) {
  const effect = getSignatureEffect(monster?.signatureSkillId);
  if (!effect) return { ok: false, reason: "signature_not_found" };
  const resolvedKey = makeSkillResolutionKey({ battleId, round, monsterId: monster.id, skillId: effect.skillId });
  if (!resolvedKey) return { ok: false, reason: "invalid_resolution_identity" };

  const tierIndex = monster.tierIndex || 1;
  const tierMult = (TIER_SKILL_ATK_MULT[tierIndex] || TIER_SKILL_ATK_MULT[1])[monster.encounter] || 1.05;
  const breakRatio = calculateBreakRatio(submissions, targetFmt);
  const outcome = getBreakOutcome(breakRatio, ruleset);
  const pierceScale = outcome.statusMultiplier; // 部分破解同步降低穿甲/破盾（與世界王一致）
  const enhancedMult = enhanced ? SIGNATURE_ENHANCED_MULT : 1;

  const result = {
    ok: true, resolvedKey, breakRatio, outcome,
    skillId: effect.skillId, name: effect.name, enhanced,
    skillDamageMult: 0, hits: 1, pierceDefPct: 0, pierceShieldPct: 0,
    delayedMult: 0,
    statuses: [],
    selfShieldMaxHpPct: 0, selfReductionPct: 0, selfReductionDuration: 0,
    selfReflectPct: 0, selfReflectDuration: 0,
    hqMarkPct: 0,
    challenge: null,
  };

  const eligibleArrows = (Array.isArray(submissions) ? submissions : [])
    .filter(submission => submission && submission.eligible !== false)
    .flatMap(submission => Array.isArray(submission.arrows) ? submission.arrows : []);

  for (const block of effect.blocks) {
    if (block.type === "damage") {
      result.skillDamageMult = Math.round(tierMult * (block.mult || 1) * enhancedMult * outcome.damageMultiplier * 1000) / 1000;
      result.hits = block.hits || 1;
      result.pierceDefPct = Math.round((block.pierceDefPct || 0) * pierceScale);
      result.pierceShieldPct = Math.round((block.pierceShieldPct || 0) * pierceScale);
    } else if (block.type === "delayedBurst") {
      // 延遲攻擊：本回合破解即決定下一回合落地的強度（完整破解=0,取消延遲段）
      result.delayedMult = Math.round(tierMult * (block.mult || 1) * enhancedMult * outcome.damageMultiplier * 1000) / 1000;
    } else if (block.type === "playerStatus") {
      const scaled = scaleStatus({ ...block, sourceSkillId: effect.skillId }, outcome, tierIndex);
      if (scaled) result.statuses.push(scaled);
    } else if (block.type === "selfShield") {
      if (!outcome.cancelStatus) result.selfShieldMaxHpPct = Math.round((block.maxHpPct || 0) * outcome.statusMultiplier * 10) / 10;
    } else if (block.type === "selfReduction") {
      if (!outcome.cancelStatus) {
        result.selfReductionPct = Math.round((block.pct || 0) * outcome.statusMultiplier);
        result.selfReductionDuration = reduceStatusDuration(block.duration || 1, outcome.statusMultiplier);
      }
    } else if (block.type === "selfReflect") {
      if (!outcome.cancelStatus) {
        result.selfReflectPct = Math.round((block.pct || 0) * outcome.statusMultiplier);
        result.selfReflectDuration = reduceStatusDuration(block.duration || 1, outcome.statusMultiplier);
      }
    } else if (block.type === "hqMark") {
      // 風險/回報標記：即使破解也保留（對玩家有利的一半;破解取消的是怪物增幅側,由 counterSummary 敘述）
      result.hqMarkPct = block.pct || 0;
    } else if (block.type === "challenge") {
      // 指定分數挑戰：本回合「達標箭數 ≥ 一半」即完成（城隍判令語意）;光色挑戰以 70% 破解視為完成
      const threshold = (block.minScore || 8) / 10;
      const passed = block.colorPick
        ? breakRatio >= 0.7
        : eligibleArrows.length > 0
          && eligibleArrows.filter(arrow => arrowScoreRatio(arrow, targetFmt) >= threshold).length * 2 >= eligibleArrows.length;
      result.challenge = {
        minScore: block.minScore || null, colorPick: !!block.colorPick, success: passed,
        damageBuffPct: passed ? (block.onSuccessDamageBuffPct || 0) : 0,
      };
      if (!passed && block.onFail) {
        const scaled = scaleStatus({ type: "playerStatus", ...block.onFail, sourceSkillId: effect.skillId }, outcome, tierIndex);
        if (scaled) result.statuses.push(scaled);
      }
    }
  }

  // 大王階段被動（70%/40% HP）：疊加到本次結算參數;被動本身不追加攻擊
  const phaseMods = sumPhaseModifiers(effect, monsterHpRatio);
  if (phaseMods.damagePct && result.skillDamageMult > 0) result.skillDamageMult = Math.round(result.skillDamageMult * (1 + phaseMods.damagePct / 100) * 1000) / 1000;
  if (phaseMods.delayedPct && result.delayedMult > 0) result.delayedMult = Math.round(result.delayedMult * (1 + phaseMods.delayedPct / 100) * 1000) / 1000;
  if (!outcome.cancelStatus) {
    if (phaseMods.shieldPct) result.selfShieldMaxHpPct = Math.round((result.selfShieldMaxHpPct + phaseMods.shieldPct * outcome.statusMultiplier) * 10) / 10;
    if (phaseMods.reductionPct) {
      result.selfReductionPct = Math.round(result.selfReductionPct + phaseMods.reductionPct * outcome.statusMultiplier);
      result.selfReductionDuration = Math.max(result.selfReductionDuration, 1);
    }
    if (phaseMods.reflectPct) {
      result.selfReflectPct = Math.round(result.selfReflectPct + phaseMods.reflectPct * outcome.statusMultiplier);
      result.selfReflectDuration = Math.max(result.selfReflectDuration, 1);
    }
    if (phaseMods.shieldPiercePct) result.pierceShieldPct = Math.round(result.pierceShieldPct + phaseMods.shieldPiercePct * outcome.statusMultiplier);
    if (phaseMods.statusPct) result.statuses = result.statuses.map(status => ({
      ...status,
      strength: typeof status.strength === "number" ? Math.round(status.strength * (1 + phaseMods.statusPct / 100) * 10) / 10 : status.strength,
    }));
  }
  result.phaseMods = phaseMods;

  // 相容欄位：舊呼叫端讀 resolved.status（單一）與 resolved.damage（數字,由 adapter 計算後回填）
  result.status = result.statuses[0] || null;
  result.damage = 0;
  return result;
}
