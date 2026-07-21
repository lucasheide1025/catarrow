var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/archeryGrade.js
var archeryGrade_exports = {};
__export(archeryGrade_exports, {
  GRADE_ORDER: () => GRADE_ORDER,
  GRADE_STYLE: () => GRADE_STYLE,
  buildArcheryAdvice: () => buildArcheryAdvice,
  gradeArcheryPerformance: () => gradeArcheryPerformance,
  pickArcheryMvp: () => pickArcheryMvp
});
module.exports = __toCommonJS(archeryGrade_exports);

// src/lib/targetFace.js
var TARGET_COLORS = {
  10: { fill: "#facc15", stroke: "#ca8a04" },
  9: { fill: "#facc15", stroke: "#ca8a04" },
  8: { fill: "#ef4444", stroke: "#b91c1c" },
  7: { fill: "#ef4444", stroke: "#b91c1c" },
  6: { fill: "#38bdf8", stroke: "#0284c7" },
  5: { fill: "#38bdf8", stroke: "#0284c7" },
  4: { fill: "#171717", stroke: "#525252" },
  3: { fill: "#171717", stroke: "#525252" },
  2: { fill: "#f5f5f4", stroke: "#a8a29e" },
  1: { fill: "#f5f5f4", stroke: "#a8a29e" }
};
var FIELD_COLORS = {
  6: { fill: "#facc15", stroke: "#ca8a04" },
  5: { fill: "#facc15", stroke: "#ca8a04" },
  4: { fill: "#171717", stroke: "#525252" },
  3: { fill: "#171717", stroke: "#525252" },
  2: { fill: "#171717", stroke: "#525252" },
  1: { fill: "#171717", stroke: "#525252" }
};
var TARGET_FACE_FORMATS = [
  {
    id: "full_110",
    label: "122cm \u5341\u74B0\u5168\u9776",
    shortLabel: "122cm \u5168\u9776",
    sub: "1-10 \u74B0",
    faceSizeCm: 122,
    minScore: 1,
    maxScore: 10,
    layout: "single",
    innerTenRatio: 0.05,
    colors: TARGET_COLORS
  },
  {
    id: "compound_510",
    label: "80cm \u516D\u74B0\u9776",
    shortLabel: "80cm \u516D\u74B0",
    sub: "5-10 \u74B0",
    faceSizeCm: 80,
    minScore: 5,
    maxScore: 10,
    layout: "single",
    // The visible edge is the 5-ring (48 cm diameter); X is 4 cm.
    innerTenRatio: 1 / 12,
    colors: TARGET_COLORS
  },
  {
    id: "indoor_40",
    label: "40cm \u5341\u74B0\u55AE\u9776",
    shortLabel: "40cm \u55AE\u9776",
    sub: "1-10 \u74B0",
    faceSizeCm: 40,
    minScore: 1,
    maxScore: 10,
    layout: "single",
    innerTenRatio: 0.05,
    colors: TARGET_COLORS
  },
  {
    id: "half_610",
    label: "40cm \u4E94\u74B0\u55AE\u9776",
    shortLabel: "40cm \u4E94\u74B0",
    sub: "6-10 \u74B0",
    faceSizeCm: 40,
    minScore: 6,
    maxScore: 10,
    layout: "single",
    // Combined indoor face: compound inner ten inside the recurve ten.
    innerTenRatio: 0.1,
    colors: TARGET_COLORS
  },
  {
    id: "triple",
    label: "40cm \u76F4\u5F0F\u4E09\u9023\u9776",
    shortLabel: "40cm \u4E09\u9023\u9776",
    sub: "6-10 \u74B0",
    faceSizeCm: 40,
    minScore: 6,
    maxScore: 10,
    layout: "vertical_triple",
    innerTenRatio: 0.1,
    colors: TARGET_COLORS
  },
  {
    id: "field_16",
    label: "\u539F\u91CE\u9776",
    shortLabel: "\u539F\u91CE\u9776",
    sub: "X\u30011-5 \u74B0",
    faceSizeCm: null,
    minScore: 1,
    maxScore: 5,
    layout: "single",
    innerTenRatio: 0.1,
    colors: FIELD_COLORS
  }
];
var LEGACY_TARGET_ALIASES = {
  indoor_610: "half_610"
};
function normalizeTargetFormatId(formatId) {
  const normalized = LEGACY_TARGET_ALIASES[formatId] || formatId;
  return TARGET_FACE_FORMATS.some((format) => format.id === normalized) ? normalized : "full_110";
}
function getTargetFaceFormat(formatId) {
  const normalized = normalizeTargetFormatId(formatId);
  return TARGET_FACE_FORMATS.find((format) => format.id === normalized) || TARGET_FACE_FORMATS[0];
}

// src/lib/archeryGrade.js
var GRADE_ORDER = Object.freeze(["E", "D", "C", "B", "A", "S", "SS", "SSS"]);
var GRADE_THRESHOLDS = Object.freeze([
  { grade: "SSS", min: 92 },
  { grade: "SS", min: 85 },
  { grade: "S", min: 78 },
  { grade: "A", min: 70 },
  { grade: "B", min: 60 },
  { grade: "C", min: 50 },
  { grade: "D", min: 38 },
  { grade: "E", min: 0 }
]);
var WEIGHTS = Object.freeze({ hitRate: 0.4, stability: 0.3, highRate: 0.3 });
var GRADE_STYLE = Object.freeze({
  SSS: { color: "#fbbf24", label: "SSS" },
  SS: { color: "#f59e0b", label: "SS" },
  S: { color: "#a78bfa", label: "S" },
  A: { color: "#4ade80", label: "A" },
  B: { color: "#60a5fa", label: "B" },
  C: { color: "#94a3b8", label: "C" },
  D: { color: "#a8a29e", label: "D" },
  E: { color: "#f87171", label: "E" }
});
function toLabel(arrow) {
  if (arrow == null) return null;
  if (typeof arrow === "string" || typeof arrow === "number") return String(arrow);
  return arrow.label != null ? String(arrow.label) : arrow.score != null ? String(arrow.score) : null;
}
function isPotionArrow(arrow) {
  if (arrow && typeof arrow === "object" && (arrow.potion || arrow.isPotion)) return true;
  const label = toLabel(arrow);
  if (!label) return true;
  return !/^(X|M|\d+)$/i.test(label);
}
function labelScore(label, maxScore) {
  if (label == null) return null;
  const text = String(label).toUpperCase();
  if (text === "X") return maxScore;
  if (text === "M") return 0;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}
function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
function gradeArcheryPerformance(arrows, { targetFmt = "full_110" } = {}) {
  const format = getTargetFaceFormat(targetFmt);
  const maxScore = format?.maxScore || 10;
  const minScore = format?.minScore ?? 1;
  const scored = (Array.isArray(arrows) ? arrows : []).filter((arrow) => !isPotionArrow(arrow)).map((arrow) => ({ label: String(toLabel(arrow)).toUpperCase(), score: labelScore(toLabel(arrow), maxScore) })).filter((entry) => entry.score != null);
  const arrowCount = scored.length;
  const empty = {
    grade: "E",
    score: 0,
    hitRate: 0,
    stability: 0,
    highRate: 0,
    arrowCount: 0,
    hits: 0,
    misses: 0,
    avgScore: 0,
    distribution: {}
  };
  if (!arrowCount) return empty;
  const distribution = scored.reduce((acc, entry) => {
    acc[entry.label] = (acc[entry.label] || 0) + 1;
    return acc;
  }, {});
  const hitEntries = scored.filter((entry) => entry.score > 0);
  const hits = hitEntries.length;
  const misses = arrowCount - hits;
  const hitRate = hits / arrowCount;
  const ringCount = Math.max(1, maxScore - minScore + 1);
  const highRingCount = Math.max(1, Math.round(ringCount * 0.2));
  const highThreshold = Math.max(minScore, maxScore - highRingCount + 1);
  const highRate = scored.filter((entry) => entry.score >= highThreshold).length / arrowCount;
  const spread = Math.max(1, (maxScore - minScore) / 2);
  const stability = hits >= 2 ? Math.max(0, 1 - stdDev(hitEntries.map((entry) => entry.score)) / spread) : hits === 1 ? 1 : 0;
  const avgScore = arrowCount ? scored.reduce((sum, entry) => sum + entry.score, 0) / arrowCount : 0;
  const score = Math.round(
    (hitRate * WEIGHTS.hitRate + stability * WEIGHTS.stability + highRate * WEIGHTS.highRate) * 100
  );
  return {
    grade: GRADE_THRESHOLDS.find((entry) => score >= entry.min)?.grade || "E",
    score,
    hitRate,
    stability,
    highRate,
    arrowCount,
    hits,
    misses,
    avgScore: Math.round(avgScore * 100) / 100,
    distribution
  };
}
function pickArcheryMvp(members, { targetFmt = "full_110" } = {}) {
  const graded = (members || []).map((member) => ({ ...member, performance: gradeArcheryPerformance(member.arrows, { targetFmt }) })).filter((member) => member.performance.arrowCount > 0);
  if (!graded.length) return null;
  return graded.reduce((best, current) => {
    if (current.performance.score !== best.performance.score) {
      return current.performance.score > best.performance.score ? current : best;
    }
    return current.performance.arrowCount > best.performance.arrowCount ? current : best;
  });
}
function buildArcheryAdvice(performance) {
  if (!performance || !performance.arrowCount) return ["\u9019\u5834\u6C92\u6709\u8A08\u5206\u7BAD\uFF0C\u5148\u7D2F\u7A4D\u5E7E\u652F\u518D\u770B\u5206\u6790\u3002"];
  const advice = [];
  const { hitRate, stability, highRate, avgScore } = performance;
  if (hitRate < 0.7) advice.push("\u812B\u9776\u504F\u591A\uFF0C\u5148\u628A\u7BC0\u594F\u653E\u6162\u3001\u78BA\u8A8D\u6492\u653E\u524D\u7684\u6EFF\u5F13\u505C\u9813\u3002");
  else if (hitRate < 0.9) advice.push("\u547D\u4E2D\u7387\u4E0D\u932F\uFF0C\u5269\u4E0B\u7684\u812B\u9776\u591A\u534A\u4F86\u81EA\u8D95\u62CD\uFF0C\u6CE8\u610F\u6BCF\u652F\u4E4B\u9593\u7684\u547C\u5438\u91CD\u7F6E\u3002");
  if (stability < 0.5) advice.push("\u843D\u9EDE\u5206\u6563\uFF0C\u5EFA\u8B70\u6AA2\u67E5\u7784\u6E96\u9EDE\u8207\u5F13\u81C2\u7A69\u5B9A\u5EA6\uFF0C\u5148\u6C42\u96C6\u4E2D\u518D\u6C42\u9AD8\u5206\u3002");
  else if (stability < 0.75) advice.push("\u96C6\u4E2D\u5EA6\u4E2D\u4E0A\uFF0C\u53EF\u7528\u540C\u4E00\u59FF\u52E2\u9023\u5C04\u4E09\u652F\u78BA\u8A8D\u91CD\u8907\u6027\u3002");
  else advice.push("\u843D\u9EDE\u5F88\u96C6\u4E2D\uFF0C\u9019\u662F\u597D\u5E95\u5B50\uFF1B\u82E5\u5747\u5206\u504F\u4F4E\uFF0C\u8ABF\u6574\u7784\u6E96\u9EDE\u5373\u53EF\u6574\u7D44\u4E0A\u79FB\u3002");
  if (highRate < 0.3) advice.push("\u9AD8\u5206\u74B0\u4F54\u6BD4\u504F\u4F4E\uFF0C\u7DF4\u7FD2\u6642\u628A\u76EE\u6A19\u653E\u5728\u300C\u591A\u4E00\u652F\u9032 9 \u74B0\u300D\u800C\u4E0D\u662F\u62DA X\u3002");
  else if (highRate >= 0.6) advice.push("\u9AD8\u5206\u74B0\u4F54\u6BD4\u5F88\u9AD8\uFF0C\u7DAD\u6301\u73FE\u5728\u7684\u7BC0\u594F\u5C31\u597D\u3002");
  if (avgScore >= 9) advice.push("\u5747\u5206\u5DF2\u9054 9 \u74B0\u4EE5\u4E0A\uFF0C\u53EF\u4EE5\u958B\u59CB\u6311\u6230\u66F4\u5C0F\u7684\u9776\u9762\u3002");
  return advice.slice(0, 3);
}
