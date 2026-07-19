// src/lib/worldBossStrikeEngine.js
// 世界王強攻 resolver（垂直切片,純函式無 Firestore）。
// 依 research/claude-worldboss-skill-spec.md（PRD 11-21 結構化）：
//   R2 強攻 1.6x（不可擊倒,保 1 HP,可帶一個較輕異常）
//   R4 終結 2.2x（可擊倒;不追加持續傷害;完全破解仍播非傷害演出）
//   結算順序（PRD 19）：基礎反擊 × 倍率 → 射擊破解減幅 → 防禦/專精抗性 → 護盾 → HP
//   once-only：resolvedKey = {sortieId}:{round}:{bossKey}:{skillId},重複結算只回演出
// UI/持久化由呼叫端（Codex 接線）處理;本模組只做決定性結算。

import { calculateBreakRatio, getBreakOutcome, makeSkillResolutionKey, reduceStatusDuration } from "./combatSkillEngine";

export const WB_STRIKE_ROUND = 2;
export const WB_FINISHER_ROUND = 4;
export const WB_STRIKE_MULTIPLIER = 1.6;          // PRD 17：教練＋貓王
export const WB_FINISHER_MULTIPLIER = 2.2;        // PRD 18
export const WB_FAMILY_STRIKE_MULTIPLIER = 1.3;   // PRD 17：六族 12 王偏弱
export const WB_FAMILY_FINISHER_MULTIPLIER = 1.8;

// bossClass → 期望倍率（config 資料層宣告 bossClass:"prime"|"family",未宣告視為 prime）
const EXPECTED_MULTIPLIERS = {
  prime:  { strike: WB_STRIKE_MULTIPLIER,        finisher: WB_FINISHER_MULTIPLIER },
  family: { strike: WB_FAMILY_STRIKE_MULTIPLIER, finisher: WB_FAMILY_FINISHER_MULTIPLIER },
};

// 排程：世界王不用一般怪循環（PRD 50）,只有 R2/R4 兩擊。
export function getWorldBossScheduledStrike(config, round) {
  if (!config || !Number.isInteger(round)) return null;
  if (round === WB_STRIKE_ROUND) return config.r2Strike || null;
  if (round === WB_FINISHER_ROUND) return config.r4Finisher || null;
  return null;
}

// 預告：R1 結束預告 R2、R3 結束預告 R4（PRD 12）;其餘回合無預告。
export function getWorldBossTelegraph(config, roundJustEnded) {
  const next = getWorldBossScheduledStrike(config, roundJustEnded + 1);
  if (!next) return null;
  return {
    round: roundJustEnded + 1,
    skillId: next.skillId,
    name: next.name,
    counterText: next.counterText || "",
    color: next.color || "#f43f5e",
    isFinisher: roundJustEnded + 1 === WB_FINISHER_ROUND,
  };
}

// 單一世界王 config 驗證（24 王上線前逐一跑;PRD 17/20-21）
// 倍率依 bossClass：教練/貓王(prime) 1.6/2.2、六族(family) 1.3/1.8。
export function validateWorldBossSkillConfig(config) {
  const errors = [];
  const expected = EXPECTED_MULTIPLIERS[config?.bossClass === "family" ? "family" : "prime"];
  const r2 = config?.r2Strike;
  const r4 = config?.r4Finisher;
  if (!r2?.skillId || !r2?.name) errors.push("r2_identity");
  if (!r4?.skillId || !r4?.name) errors.push("r4_identity");
  if (r2 && r4 && r2.skillId === r4.skillId) errors.push("skill_id_not_unique");
  if (r2 && !r2.counterText) errors.push("r2_counter_text"); // PRD 12 預告必含破解方式
  if (r4 && !r4.counterText) errors.push("r4_counter_text");
  if (r2 && r2.baseMultiplier !== expected.strike) errors.push("r2_multiplier");
  if (r4 && r4.baseMultiplier !== expected.finisher) errors.push("r4_multiplier");
  if (r4 && r4.status) errors.push("r4_must_not_carry_status"); // PRD 20 終結技不追加持續傷害
  if (r2 && r2.canKnockOut) errors.push("r2_must_not_knock_out"); // PRD 17
  if (r4 && r4.canKnockOut !== true) errors.push("r4_must_knock_out_flag");
  return { ok: errors.length === 0, errors };
}

// 強攻結算（決定性）。重複 resolvedKey → 只回演出,不改任何數值（PRD 13/16）。
export function resolveWorldBossStrike({
  sortieId,
  round,
  bossKey,
  skill,                     // r2Strike | r4Finisher（見 spec schema）
  arrows = [],               // 該回合全部有效箭（label/score 皆可）
  targetFmt = "full_110",    // 玩家當前靶紙（PRD 15 正規化,必帶）
  baseCounterDamage = 0,     // 標準反擊傷害（呼叫端算好）
  playerHp,
  playerMaxHp,
  shield = 0,
  damageReductionPct = 0,    // 防具/專精合計減傷（呼叫端依 PRD 順序先算好堅韌/守勢）
  resolvedSkillKeys = [],
}) {
  const resolvedKey = makeSkillResolutionKey({ battleId: sortieId, round, monsterId: bossKey, skillId: skill?.skillId });
  if (!resolvedKey) return { ok: false, reason: "invalid_strike_identity" };
  if (!Number.isFinite(playerHp) || !Number.isFinite(playerMaxHp) || playerMaxHp <= 0) {
    return { ok: false, reason: "invalid_player_state" };
  }
  // once-only：已結算 → 純演出,不再改血/異常（動畫重播/重連重送安全）
  if (resolvedSkillKeys.includes(resolvedKey)) {
    return { ok: true, resolvedKey, alreadyResolved: true, spectacleOnly: true, damage: 0, playerHp, shieldRemaining: shield, status: null, knockedOut: false };
  }

  // 1) 基礎反擊 × 強攻倍率
  const raw = Math.max(0, baseCounterDamage) * (skill.baseMultiplier || 1);
  // 2) 射擊破解減幅（worldBoss ruleset：≥85 全免 / 70-84 ×0.4 / 50-69 ×0.7 / <50 全額）
  const breakRatio = calculateBreakRatio([{ eligible: true, arrows }], targetFmt);
  const outcome = getBreakOutcome(breakRatio, "worldBoss");
  const afterBreak = raw * outcome.damageMultiplier;
  // 穿甲/破盾副效果（寶寶/妞妞/師母/YUMI/六族部分王）。
  // PRD 24：部分破解同步降低穿甲、破盾強度 → 與異常同用 statusMultiplier 縮放。
  const pierceScale = outcome.statusMultiplier;
  const clampPct = value => Math.max(0, Math.min(100, value || 0));
  const armorPierce = clampPct((skill.armorPiercePct || 0) * pierceScale);
  const shieldPierce = clampPct((skill.shieldPiercePct || 0) * pierceScale);
  // 3) 防禦/專精抗性（穿甲=無視其中 X%）
  const effReduction = Math.max(0, damageReductionPct) * (1 - armorPierce / 100);
  const afterResist = afterBreak * Math.max(0, 1 - effReduction / 100);
  // 4) 護盾（破盾=護盾只擋 (100-X)% 傷害;護盾本體消耗量不超過實際吸收）
  const shieldAbsorbed = Math.min(shield, afterResist * (1 - shieldPierce / 100));
  const toHp = Math.round(afterResist - shieldAbsorbed);
  // 5) HP：R2 保 1、R4 可歸零（PRD 17/18）
  const floor = skill.canKnockOut ? 0 : 1;
  const nextHp = Math.max(floor, playerHp - toHp);
  const knockedOut = skill.canKnockOut === true && nextHp <= 0;

  // 異常：完全破解=無;部分破解依級距降低強度/回合（PRD 20）;R4 無 status(config 驗證擋)
  const status = !skill.status || outcome.cancelStatus ? null : {
    ...skill.status,
    strength: typeof skill.status.strength === "number" ? skill.status.strength * outcome.statusMultiplier : skill.status.strength,
    duration: reduceStatusDuration(skill.status.duration, outcome.statusMultiplier),
  };

  return {
    ok: true,
    resolvedKey,
    alreadyResolved: false,
    breakRatio,
    outcome,
    damage: Math.max(0, playerHp - nextHp),
    playerHp: nextHp,
    shieldRemaining: shield - shieldAbsorbed,
    status,
    knockedOut,
    // 完全破解仍可播非傷害演出（PRD 16）;結算與演出分離
    spectacleOnly: outcome.damageMultiplier === 0,
  };
}
