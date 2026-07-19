import { getTargetFaceFormat } from "./targetFace";

export const BATTLE_BOW_OPTIONS = [
  { value:"recurve_bare", label:"裸弓" },
  { value:"recurve_full", label:"反曲弓" },
  { value:"compound", label:"複合弓" },
  { value:"traditional", label:"傳統弓" },
];

export const BATTLE_DISTANCE_OPTIONS = [5, 10, 13.5, 15, 18, 20, 30, 50, 70];

const PROFILE_VERSION = 2;

// ── 高品質命中（跨靶紙正規化的唯一權威定義） ─────────────────
// 10 分制靶（全環/三聯）高分 = ≥8；其餘靶（如 field_16 的 X、1-5 環）= maxScore - 1。
// 武器「精準」專精、弱點姿態、再生中斷等所有需要「高品質命中」判定之處,
// 一律呼叫這兩個函式,禁止各自 inline 門檻（PRD 128：不可寫死 9 分）。
export function highQualityThreshold(targetFormat = "full_110") {
  const format = getTargetFaceFormat(targetFormat);
  return format.maxScore >= 10 ? 8 : Math.max(format.minScore, format.maxScore - 1);
}
export function isHighQualityHit(score, targetFormat = "full_110") {
  return Number(score) >= highQualityThreshold(targetFormat);
}
const DEFAULT_PROFILE = {
  version:PROFILE_VERSION,
  bowType:"recurve_bare",
  bowId:"",
  distance:18,
};

function profileKey(memberId) {
  return `catarchery:battle-shooting-profile:v${PROFILE_VERSION}:${memberId || "guest"}`;
}

export function loadBattleShootingProfile(memberId) {
  if (typeof window === "undefined") return { ...DEFAULT_PROFILE };
  try {
    const value = JSON.parse(window.localStorage.getItem(profileKey(memberId)));
    if (value?.version !== PROFILE_VERSION) return { ...DEFAULT_PROFILE };
    return {
      version:PROFILE_VERSION,
      bowType:BATTLE_BOW_OPTIONS.some(option => option.value === value.bowType)
        ? value.bowType
        : DEFAULT_PROFILE.bowType,
      bowId:typeof value.bowId === "string" ? value.bowId : "",
      distance:Number(value.distance) > 0 ? Number(value.distance) : DEFAULT_PROFILE.distance,
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveBattleShootingProfile(memberId, patch) {
  const next = { ...loadBattleShootingProfile(memberId), ...patch, version:PROFILE_VERSION };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(profileKey(memberId), JSON.stringify(next));
    } catch {}
  }
  return next;
}

export function battleBowLabel(bowType) {
  return BATTLE_BOW_OPTIONS.find(option => option.value === bowType)?.label || "未記錄";
}

export function normalizePracticeArrow(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return { label:String(value), score:Math.max(0, value), isX:false };
  }

  const label = typeof value === "object"
    ? String(value.label ?? value.rawLabel ?? "")
    : String(value);
  if (label === "X") return { label:"X", score:10, isX:true };
  if (label === "M") return { label:"M", score:0, isX:false };

  const labelNumber = label.match(/\d+/)?.[0];
  if (labelNumber != null) {
    return { label, score:Number(labelNumber), isX:false };
  }

  if (typeof value === "object") {
    const rawScore = Number.isFinite(value.rawScore) ? value.rawScore : value.score;
    if (Number.isFinite(rawScore)) {
      return { label:label || String(rawScore), score:Math.max(0, rawScore), isX:false };
    }
  }
  return null;
}

export function normalizePracticeRounds(rounds) {
  if (!Array.isArray(rounds)) return [];
  return rounds.map(round => {
    const values = Array.isArray(round)
      ? round
      : Array.isArray(round?.scores)
        ? round.scores
        : Array.isArray(round?.arrows)
          ? round.arrows
          : [];
    return values.map(normalizePracticeArrow).filter(Boolean);
  }).filter(round => round.length > 0);
}

export function analyzeBattlePractice(rounds, targetFormat = "full_110", arrowPositions = []) {
  const normalizedRounds = normalizePracticeRounds(rounds);
  const arrows = normalizedRounds.flat();
  if (!arrows.length) return null;

  const format = getTargetFaceFormat(targetFormat);
  const scores = arrows.map(arrow => arrow.score);
  const count = scores.length;
  const total = scores.reduce((sum, score) => sum + score, 0);
  const average = total / count;
  const misses = scores.filter(score => score === 0).length;
  const xCount = arrows.filter(arrow => arrow.isX).length;
  const tenCount = arrows.filter(arrow => !arrow.isX && arrow.score === 10).length;
  const highThreshold = highQualityThreshold(targetFormat);
  const highCount = scores.filter(score => score >= highThreshold).length;
  const variance = scores.reduce((sum, score) => sum + (score - average) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);
  const stability = Math.max(0, Math.min(100, 100 - (stdDev / format.maxScore) * 100));
  const splitAt = Math.ceil(count / 2);
  const firstScores = scores.slice(0, splitAt);
  const secondScores = scores.slice(splitAt);
  const mean = values => values.length
    ? values.reduce((sum, score) => sum + score, 0) / values.length
    : 0;
  const firstHalfAvg = mean(firstScores);
  const secondHalfAvg = mean(secondScores);
  const perRound = normalizedRounds.map((round, index) => {
    const roundTotal = round.reduce((sum, arrow) => sum + arrow.score, 0);
    return {
      round:index + 1,
      arrows:round.length,
      total:roundTotal,
      average:roundTotal / round.length,
    };
  });

  const validPositions = (arrowPositions || []).filter(position =>
    Number.isFinite(position?.nx) && Number.isFinite(position?.ny)
    && position.score !== "M" && position.label !== "M"
  );
  let landing = null;
  if (validPositions.length) {
    const centerX = validPositions.reduce((sum, position) => sum + position.nx, 0) / validPositions.length;
    const centerY = validPositions.reduce((sum, position) => sum + position.ny, 0) / validPositions.length;
    const groupRadii = validPositions.map(position =>
      Math.sqrt((position.nx - centerX) ** 2 + (position.ny - centerY) ** 2)
    );
    landing = {
      count:validPositions.length,
      centerX,
      centerY,
      centerOffset:Math.sqrt(centerX ** 2 + centerY ** 2),
      averageSpread:mean(groupRadii),
    };
  }

  return {
    normalizedRounds,
    count,
    total,
    average,
    hitRate:(count - misses) / count * 100,
    misses,
    xCount,
    tenCount,
    highCount,
    highRate:highCount / count * 100,
    highThreshold,
    stdDev,
    stability,
    firstHalfAvg,
    secondHalfAvg,
    halfDelta:secondHalfAvg - firstHalfAvg,
    perRound,
    landing,
  };
}
