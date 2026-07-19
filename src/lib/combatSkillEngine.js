import { getTargetFaceFormat } from "./targetFace";

export const BREAK_LEVELS = Object.freeze({
  FULL: "full",
  MAJOR: "major",
  PARTIAL: "partial",
  NONE: "none",
});

export const BREAK_THRESHOLDS = Object.freeze({ full: 0.85, major: 0.7, partial: 0.5 });

export function getBreakRuleText() {
  return "本回合箭矢平均品質達 85% 完全破解、70% 大幅破解、50% 部分破解；分數越高，技能效果越弱。";
}

// 破解品質按「該靶紙最大環」正規化（PRD 15/128：禁止寫死 9/10 分門檻）。
// 10 分制靶維持原始分段（10→1、9→0.9、8→0.75、7→0.55、其餘→0.3）;
// field_16(X、1-5環) 依比例落在同一曲線：5→1、4→0.75、3以下→0.3。
export function scoreToBreakQuality(score, targetFmt = "full_110") {
  if (score === "X" || score === "x") return 1;
  const value = Number(score);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const max = Number(getTargetFaceFormat(targetFmt)?.maxScore) || 10;
  if (value > max) return 0; // 超過該靶紙最大環＝非法輸入
  const ratio = value / max;
  if (ratio >= 1) return 1;
  if (ratio >= 0.9) return 0.9;
  if (ratio >= 0.8) return 0.75;
  if (ratio >= 0.7) return 0.55;
  return 0.3;
}

function extractScore(arrow) {
  if (arrow && typeof arrow === "object") return arrow.score ?? arrow.value ?? 0;
  return arrow;
}

export function calculateBreakRatio(submissions, targetFmt = "full_110") {
  const eligible = (Array.isArray(submissions) ? submissions : [])
    .filter(submission => submission && submission.eligible !== false)
    .flatMap(submission => Array.isArray(submission.arrows) ? submission.arrows : []);
  if (!eligible.length) return 0;
  const earned = eligible.reduce((sum, arrow) => sum + scoreToBreakQuality(extractScore(arrow), targetFmt), 0);
  return Math.max(0, Math.min(1, earned / eligible.length));
}

export function getBreakOutcome(ratio, ruleset = "general") {
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const worldBoss = ruleset === "worldBoss";
  if (safeRatio >= BREAK_THRESHOLDS.full) return { level: BREAK_LEVELS.FULL, damageMultiplier: 0, cancelStatus: true, statusMultiplier: 0 };
  if (safeRatio >= BREAK_THRESHOLDS.major) return {
    level: BREAK_LEVELS.MAJOR,
    damageMultiplier: worldBoss ? 0.4 : 0.35,
    cancelStatus: true,
    statusMultiplier: 0,
  };
  if (safeRatio >= BREAK_THRESHOLDS.partial) return {
    level: BREAK_LEVELS.PARTIAL,
    damageMultiplier: 0.7,
    cancelStatus: false,
    statusMultiplier: 0.5,
  };
  return { level: BREAK_LEVELS.NONE, damageMultiplier: 1, cancelStatus: false, statusMultiplier: 1 };
}

export function reduceStatusDuration(duration, multiplier) {
  if (!duration || multiplier <= 0) return 0;
  return Math.max(1, Math.ceil(duration * multiplier));
}

export function makeSkillResolutionKey({ battleId, round, monsterId, skillId }) {
  if (!battleId || !monsterId || !skillId || !Number.isInteger(round) || round < 1) return null;
  return `${battleId}:${round}:${monsterId}:${skillId}`;
}

export function makeCompanionResolutionKey({ battleId, round, memberId, companionId }) {
  if (!battleId || !memberId || !companionId || !Number.isInteger(round) || round < 1) return null;
  return `${battleId}:${round}:${memberId}:${companionId}`;
}

export function buildRoundSkillResult({
  battleId,
  round,
  monsterId,
  skillId,
  submissions,
  ruleset = "general",
  baseDamage = 0,
  status = null,
  targetFmt = "full_110",
}) {
  const resolvedKey = makeSkillResolutionKey({ battleId, round, monsterId, skillId });
  if (!resolvedKey) return { ok: false, reason: "invalid_resolution_identity" };
  const breakRatio = calculateBreakRatio(submissions, targetFmt);
  const outcome = getBreakOutcome(breakRatio, ruleset);
  const damage = Math.max(0, Math.round(Math.max(0, baseDamage) * outcome.damageMultiplier));
  const resolvedStatus = !status || outcome.cancelStatus ? null : {
    ...status,
    strength: typeof status.strength === "number" ? status.strength * outcome.statusMultiplier : status.strength,
    duration: reduceStatusDuration(status.duration, outcome.statusMultiplier),
  };
  return { ok: true, resolvedKey, breakRatio, outcome, damage, status: resolvedStatus };
}
