// Canonical raw-archery record helpers. Combat damage is intentionally absent.
import { getTargetFaceFormat, resolveTargetHit } from "./targetFace";

export const SHOOTING_SCHEMA_VERSION = 1;

const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function buildPerformanceKey(config = {}) {
  return [
    config.bowType || "unknown",
    Number.isFinite(config.distanceM) ? config.distanceM : "unknown",
    config.targetFaceCode || "unknown",
    config.targetFaceVersion || 1,
    config.scoringScheme || "wa",
    config.arrowsPerEnd || "unknown",
    config.timingMode || "off",
  ].join("|");
}

export function makeScoreInputArrow(value, index) {
  const label = String(value?.label ?? value ?? "M");
  const isX = label === "X";
  const score = isX ? 10 : label === "M" ? 0 : Math.max(0, Number(label) || 0);
  return { index, captureMode:"scoreInput", score, label, isX, isMiss:score === 0 };
}

export function makeTargetPlotArrow(value, index, targetFormat) {
  const nx = Number(value?.nx);
  const ny = Number(value?.ny);
  const derived = Number.isFinite(nx) && Number.isFinite(ny)
    ? resolveTargetHit(targetFormat, nx, ny)
    : { label:"M", rawScore:0 };
  const label = String(value?.label ?? derived.label);
  const score = label === "X" ? 10 : label === "M" ? 0 : Math.max(0, Number(label) || 0);
  return {
    index,
    captureMode:"targetPlot",
    targetSlot:{ index:Number.isInteger(value?.faceIndex) ? value.faceIndex : 0 },
    position:{ x:nx, y:ny },
    derivedScore:{ score:derived.rawScore, label:derived.label, isX:derived.label === "X", isMiss:derived.rawScore === 0, targetFaceVersion:1, scoringSchemeVersion:1 },
    recordedScore:{ score, label, isX:label === "X", isMiss:score === 0 },
  };
}

export function calculateSessionMetrics(ends = []) {
  const arrows = ends.flatMap(end => end.arrows || []);
  const scores = arrows.map(arrow => arrow.captureMode === "targetPlot" ? arrow.recordedScore.score : arrow.score);
  if (!scores.length) return null;
  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  const averageArrow = totalScore / scores.length;
  const xCount = arrows.filter(arrow => arrow.captureMode === "targetPlot" ? arrow.recordedScore.isX : arrow.isX).length;
  const missCount = scores.filter(score => score === 0).length;
  const endTotals = ends.map(end => (end.arrows || []).reduce((sum, arrow) => sum + (arrow.captureMode === "targetPlot" ? arrow.recordedScore.score : arrow.score), 0));
  const endAverage = mean(endTotals);
  const endStdDev = Math.sqrt(mean(endTotals.map(total => (total - endAverage) ** 2)));
  const first = scores.slice(0, Math.ceil(scores.length / 3));
  const last = scores.slice(Math.floor(scores.length * 2 / 3));
  const plotted = arrows.filter(arrow => arrow.captureMode === "targetPlot" && Number.isFinite(arrow.position?.x) && Number.isFinite(arrow.position?.y));
  const horizontalBias = plotted.length ? mean(plotted.map(arrow => arrow.position.x)) : undefined;
  const verticalBias = plotted.length ? mean(plotted.map(arrow => arrow.position.y)) : undefined;
  return {
    version:1, totalScore, arrowCount:scores.length, averageArrow, xCount, missCount,
    xRate:xCount / scores.length, missRate:missCount / scores.length, hitRate:(scores.length - missCount) / scores.length,
    endAverage, endStdDev, firstThirdAverage:mean(first), lastThirdAverage:mean(last), fatigueDelta:mean(last) - mean(first),
    targetPlotArrowCount:plotted.length, ...(plotted.length ? { horizontalBias, verticalBias } : {}),
  };
}

export function buildShootingEnds(capturedEnds, targetFormat = "full_110") {
  return (capturedEnds || []).map((captured, endIndex) => {
    const arrows = (captured || []).map((arrow, arrowIndex) => arrow?.landing
      ? makeTargetPlotArrow({ ...arrow.landing, label:arrow.label }, arrowIndex + 1, targetFormat)
      : makeScoreInputArrow(arrow?.label, arrowIndex + 1));
    const scores = arrows.map(arrow => arrow.captureMode === "targetPlot" ? arrow.recordedScore.score : arrow.score);
    return { id:`end-${String(endIndex + 1).padStart(3, "0")}`, index:endIndex + 1, status:"complete", arrows,
      metrics:{ total:scores.reduce((sum, score) => sum + score, 0), arrowCount:scores.length, averageArrow:mean(scores), xCount:arrows.filter(arrow => arrow.captureMode === "targetPlot" ? arrow.recordedScore.isX : arrow.isX).length, missCount:scores.filter(score => score === 0).length } };
  }).filter(end => end.arrows.length);
}

export function buildMonsterShootingRecord({ sessionId, memberId, capturedEnds, shootingProfile, targetFormat, arrowsPerEnd, result, monster, totalDamage, finalMonsterHp, characterSnapshot, sourceMode = "monster" }) {
  const format = getTargetFaceFormat(targetFormat);
  const ends = buildShootingEnds(capturedEnds, targetFormat);
  const metricsSnapshot = calculateSessionMetrics(ends);
  if (!metricsSnapshot?.arrowCount) return null;
  const shootingConfig = {
    bowType:shootingProfile?.bowType, equipmentProfileId:shootingProfile?.bowId || undefined,
    distanceM:Number(shootingProfile?.distance), targetFaceCode:format.id, targetFaceVersion:1,
    targetDiameterCm:format.faceSizeCm || undefined, targetLayout:format.layout === "vertical_triple" ? "verticalTriple" : "single",
    scoringScheme:"wa", scoringSchemeVersion:1, maxScorePerArrow:format.maxScore,
    arrowsPerEnd, timingMode:"off",
  };
  const session = {
    id:sessionId, schemaVersion:SHOOTING_SCHEMA_VERSION, memberId, status:"finalized", isRealShooting:true,
    source:{ kind:"game", mode:sourceMode }, verification:{ level:"self" }, captureMode:ends.some(end => end.arrows.some(arrow => arrow.captureMode === "targetPlot")) ? "targetPlot" : "scoreInput",
    shootingConfig, countsToward:{ arrowTotal:true, performance:true, personalBest:true, officialRecord:false },
    arrowCount:metricsSnapshot.arrowCount, completedEndCount:ends.length,
    analysis:{ level:ends.some(end => end.arrows.some(arrow => arrow.captureMode === "targetPlot")) ? 3 : 2, comparable:true, performanceKey:buildPerformanceKey(shootingConfig), qualityFlags:[] },
    metricsSnapshot, gameResultLocked:true,
  };
  const gamePerformance = {
    id:sessionId, sessionId, memberId, mode:sourceMode, result, monster:{ id:monster?.id || "unknown", nameSnapshot:monster?.name, difficulty:monster?.tier, initialHp:monster?.hp, remainingHp:finalMonsterHp },
    rounds:ends.map(end => ({ endIndex:end.index, shootingScore:end.metrics.total })), totalDamage:Number(totalDamage) || 0,
    characterSnapshot, rulesVersion:"monster-battle-v1", locked:true,
  };
  return { session, ends, gamePerformance };
}
