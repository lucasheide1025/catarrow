// Canonical raw-archery record helpers. Combat damage is intentionally absent.
import { getTargetFaceFormat, resolveTargetHit } from "./targetFace";

export const SHOOTING_SCHEMA_VERSION = 1;

const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function spatialMetrics(arrows) {
  const plotted = arrows.filter(arrow => arrow.captureMode === "targetPlot" && Number.isFinite(arrow.position?.x) && Number.isFinite(arrow.position?.y));
  if (!plotted.length) return { targetPlotArrowCount:0 };
  const horizontalBias = mean(plotted.map(arrow => arrow.position.x));
  const verticalBias = mean(plotted.map(arrow => arrow.position.y));
  const radii = plotted.map(arrow => Math.hypot(arrow.position.x - horizontalBias, arrow.position.y - verticalBias)).sort((a, b) => a - b);
  return {
    targetPlotArrowCount:plotted.length,
    groupR50:radii[Math.max(0, Math.ceil(radii.length * 0.5) - 1)],
    meanRadialError:mean(radii),
    horizontalBias,
    verticalBias,
  };
}

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
  const spatial = spatialMetrics(arrows);
  const targetSlotMetrics = [...new Set(arrows.filter(arrow => arrow.captureMode === "targetPlot").map(arrow => arrow.targetSlot?.index ?? 0))]
    .map(targetSlotIndex => {
      const slotArrows = arrows.filter(arrow => arrow.captureMode === "targetPlot" && (arrow.targetSlot?.index ?? 0) === targetSlotIndex);
      const scores = slotArrows.map(arrow => arrow.recordedScore.score);
      return { targetSlotIndex, arrowCount:slotArrows.length, averageScore:mean(scores), ...spatialMetrics(slotArrows) };
    });
  return {
    version:1, totalScore, arrowCount:scores.length, averageArrow, xCount, missCount,
    xRate:xCount / scores.length, missRate:missCount / scores.length, hitRate:(scores.length - missCount) / scores.length,
    endAverage, endStdDev, firstThirdAverage:mean(first), lastThirdAverage:mean(last), fatigueDelta:mean(last) - mean(first),
    ...spatial, ...(targetSlotMetrics.length ? { targetSlotMetrics } : {}),
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
function normalizedDistance(value) {
  const distance = Number(value);
  return Number.isFinite(distance) && distance > 0 ? distance : undefined;
}

export function buildMonsterShootingRecord({ sessionId, memberId, capturedEnds, shootingProfile, targetFormat, arrowsPerEnd, result, monster, totalDamage, finalMonsterHp, characterSnapshot, sourceMode = "monster" }) {
  const format = getTargetFaceFormat(targetFormat);
  const ends = buildShootingEnds(capturedEnds, targetFormat);
  const metricsSnapshot = calculateSessionMetrics(ends);
  if (!metricsSnapshot?.arrowCount) return null;
  const shootingConfig = {
    bowType:shootingProfile?.bowType, equipmentProfileId:shootingProfile?.bowId || undefined,
    distanceM:normalizedDistance(shootingProfile?.distance), targetFaceCode:format.id, targetFaceVersion:1,
    targetDiameterCm:format.faceSizeCm || undefined, targetLayout:format.layout === "vertical_triple" ? "verticalTriple" : "single",
    scoringScheme:"wa", scoringSchemeVersion:1, maxScorePerArrow:format.maxScore,
    arrowsPerEnd, timingMode:"off",
  };
  const session = {
    id:sessionId, schemaVersion:SHOOTING_SCHEMA_VERSION, memberId, status:"finalized", isRealShooting:true,
    source:{ kind:"game", mode:sourceMode }, verification:{ level:"self" }, captureMode:ends.some(end => end.arrows.some(arrow => arrow.captureMode === "targetPlot")) ? "targetPlot" : "scoreInput",
    shootingConfig, countsToward:{ arrowTotal:true, performance:true, personalBest:true, officialRecord:false },
    arrowCount:metricsSnapshot.arrowCount, completedEndCount:ends.length,
    analysis:{ level:ends.some(end => end.arrows.some(arrow => arrow.captureMode === "targetPlot")) ? 3 : 2, comparable:Boolean(shootingConfig.distanceM), performanceKey:buildPerformanceKey(shootingConfig), qualityFlags:shootingConfig.distanceM ? [] : ["missingDistance"] },
    metricsSnapshot, gameResultLocked:true,
  };
  const gamePerformance = {
    id:sessionId, sessionId, memberId, mode:sourceMode, result, monster:{ id:monster?.id || "unknown", nameSnapshot:monster?.name, difficulty:monster?.tier, initialHp:monster?.hp, remainingHp:finalMonsterHp },
    rounds:ends.map(end => ({ endIndex:end.index, shootingScore:end.metrics.total })), totalDamage:Number(totalDamage) || 0,
    characterSnapshot, rulesVersion:"monster-battle-v1", locked:true,
  };
  return { session, ends, gamePerformance };
}

// Autonomous practice uses the same immutable raw-arrow structure as combat,
// but deliberately creates no GamePerformance document.
export function buildPracticeShootingRecord({ sessionId, memberId, rounds, arrowPositions, shootingProfile, targetFormat, arrowsPerEnd, timingMode = "off", source = { kind:"practice", mode:"freePractice" }, verification = { level:"self" }, countsToward = {} }) {
  const positions = new Map((arrowPositions || []).map(position => [`${position.round}-${position.arrow}`, position]));
  const capturedEnds = (rounds || []).map((round, roundIndex) => (round || []).map((label, arrowIndex) => {
    const landing = positions.get(`${roundIndex + 1}-${arrowIndex + 1}`);
    return landing ? { label, landing } : { label };
  }));
  const format = getTargetFaceFormat(targetFormat);
  const ends = buildShootingEnds(capturedEnds, targetFormat);
  const metricsSnapshot = calculateSessionMetrics(ends);
  if (!metricsSnapshot?.arrowCount) return null;
  const shootingConfig = {
    bowType:shootingProfile?.bowType, equipmentProfileId:shootingProfile?.bowId || undefined,
    distanceM:normalizedDistance(shootingProfile?.distance), targetFaceCode:format.id, targetFaceVersion:1,
    targetDiameterCm:format.faceSizeCm || undefined, targetLayout:format.layout === "vertical_triple" ? "verticalTriple" : "single",
    scoringScheme:"wa", scoringSchemeVersion:1, maxScorePerArrow:format.maxScore,
    arrowsPerEnd, timingMode,
  };
  return {
    session:{
      id:sessionId, schemaVersion:SHOOTING_SCHEMA_VERSION, memberId, status:"finalized", isRealShooting:true,
      source, verification,
      captureMode:ends.some(end => end.arrows.some(arrow => arrow.captureMode === "targetPlot")) ? "targetPlot" : "scoreInput",
      shootingConfig, countsToward:{ arrowTotal:true, performance:true, personalBest:true, officialRecord:false, ...countsToward },
      arrowCount:metricsSnapshot.arrowCount, completedEndCount:ends.length,
      analysis:{ level:ends.some(end => end.arrows.some(arrow => arrow.captureMode === "targetPlot")) ? 3 : 2, comparable:Boolean(shootingConfig.distanceM), performanceKey:buildPerformanceKey(shootingConfig), qualityFlags:shootingConfig.distanceM ? [] : ["missingDistance"] },
      metricsSnapshot,
    },
    ends,
  };
}
