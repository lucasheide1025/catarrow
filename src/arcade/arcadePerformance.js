// src/arcade/arcadePerformance.js — 訪客 Arcade 射擊表現（純函式）
// 命中：>=5 分；穩定性沿用專案標準差概念：100 - (stdDev / 5 * 100)。

export const ARCADE_PRAISE_LINES = Object.freeze([
  "箭路又穩又準，這一場的節奏非常漂亮！",
  "每一輪都抓得很準，這份穩定度很有水準！",
  "命中和節奏一起拉滿，射感保持得非常好！",
  "漂亮的集中度，整場幾乎沒有明顯掉速！",
  "這場射得俐落又穩定，值得把手感記住！",
  "整體節奏很穩，高分箭也有持續出現！",
  "命中表現很扎實，再多一點集中就更漂亮！",
  "射箭節奏掌握得很好，整場維持得很完整！",
  "這場的穩定度很不錯，手感已經抓起來了！",
  "分數分布很漂亮，繼續維持這個出箭節奏！",
  "有不少好箭，整體表現正在穩定往上走！",
  "命中基礎很扎實，下一場很有機會再突破！",
  "節奏已經建立起來了，把好箭的感覺延續下去！",
  "這場有抓到幾輪漂亮手感，值得繼續累積！",
  "表現有亮點，穩住動作後分數會更集中！",
  "每一箭都是有效練習，已經累積出自己的節奏！",
  "有命中、有調整，這就是進步最快的練習方式！",
  "這場完成得很完整，下一輪把好箭再複製一次！",
  "射感正在建立，不急著追分，穩住就會越來越準！",
  "願意把每一箭射完就是進步，下一場繼續挑戰！",
]);

const PRAISE_BY_GRADE = Object.freeze({
  S: ARCADE_PRAISE_LINES.slice(0, 5),
  A: ARCADE_PRAISE_LINES.slice(5, 10),
  B: ARCADE_PRAISE_LINES.slice(10, 15),
  C: ARCADE_PRAISE_LINES.slice(15, 20),
});

function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
function round1(n) { return Math.round(n * 10) / 10; }

export function normalizeArcadeScore(value) {
  if (value && typeof value === "object" && Number.isFinite(value.score)) return clamp(Number(value.score), 0, 10);
  if (!Number.isFinite(Number(value))) return 0;
  // 11 是 Arcade 的 X 內十標記，計分仍為 10。
  return clamp(Number(value), 0, 10);
}

function gradeOf(composite) {
  if (composite >= 85) return "S";
  if (composite >= 72) return "A";
  if (composite >= 58) return "B";
  return "C";
}

function stablePraiseIndex(perf, seed = "") {
  let hash = 0;
  const text = String(seed || "");
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return (hash + perf.shots + perf.hitRate + perf.stability + Math.round(perf.avgScore * 10)) % 5;
}

export function performanceFromAggregates({ shots = 0, hitCount = 0, score = 0, scoreSqSum = 0 } = {}, seed = "") {
  const safeShots = Math.max(0, Math.floor(Number(shots) || 0));
  const safeScore = Math.max(0, Number(score) || 0);
  const safeHits = clamp(Math.floor(Number(hitCount) || 0), 0, safeShots);
  const safeSq = Math.max(0, Number(scoreSqSum) || 0);
  if (!safeShots) {
    const empty = { shots: 0, hitCount: 0, hitRate: 0, avgScore: 0, stability: 0, stdDev: 0, composite: 0, grade: "C" };
    return { ...empty, praise: PRAISE_BY_GRADE.C[stablePraiseIndex(empty, seed)] };
  }
  const mean = safeScore / safeShots;
  const variance = Math.max(0, safeSq / safeShots - mean * mean);
  const stdDev = Math.sqrt(variance);
  const hitRate = Math.round((safeHits / safeShots) * 100);
  const stability = Math.round(clamp(100 - (stdDev / 5) * 100, 0, 100));
  const avgScore = round1(mean);
  const composite = Math.round(clamp(hitRate * 0.42 + stability * 0.33 + clamp(mean * 10, 0, 100) * 0.25, 0, 100));
  const grade = gradeOf(composite);
  const perf = { shots: safeShots, hitCount: safeHits, hitRate, avgScore, stability, stdDev: round1(stdDev), composite, grade };
  return { ...perf, praise: PRAISE_BY_GRADE[grade][stablePraiseIndex(perf, seed)] };
}

export function analyzeArcadeShots(scores = [], seed = "") {
  const normalized = (Array.isArray(scores) ? scores : []).map(normalizeArcadeScore);
  return performanceFromAggregates({
    shots: normalized.length,
    hitCount: normalized.filter((v) => v >= 5).length,
    score: normalized.reduce((s, v) => s + v, 0),
    scoreSqSum: normalized.reduce((s, v) => s + v * v, 0),
  }, seed);
}
