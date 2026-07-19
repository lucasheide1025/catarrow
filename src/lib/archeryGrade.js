// src/lib/archeryGrade.js — 射箭表現評價（E~SSS）與 MVP
//
// 2026-07-19 使用者拍板：**評價只看射箭表現，不看遊戲內表現。**
// 不採計傷害／坦度／治療 —— 那些吃裝備與等級，裝備強的人會永遠 SSS，
// 而這是射箭道館的系統，評價就該回歸射箭本身。
//
// 三個指標（權重見 WEIGHTS）：
//   命中率  hitRate    非 M 的箭 ÷ 總箭數
//   穩定性  stability  命中箭分數的標準差，越集中越高分
//   高分率  highRate   打進最高兩環（X/10/9）的比例
//
// ⚠️ 藥水箭要濾掉：丟藥水那一箭沒有分數，算進去會被當 0 分箭，
// 把命中率和穩定性一起拖垮（破解率也踩過同一個坑）。

import { getTargetFaceFormat } from "./targetFace";

export const GRADE_ORDER = Object.freeze(["E", "D", "C", "B", "A", "S", "SS", "SSS"]);

// 門檻是「該級的下限分數」，由高到低比對
const GRADE_THRESHOLDS = Object.freeze([
  { grade:"SSS", min:92 },
  { grade:"SS",  min:85 },
  { grade:"S",   min:78 },
  { grade:"A",   min:70 },
  { grade:"B",   min:60 },
  { grade:"C",   min:50 },
  { grade:"D",   min:38 },
  { grade:"E",   min:0  },
]);

const WEIGHTS = Object.freeze({ hitRate:0.4, stability:0.3, highRate:0.3 });

export const GRADE_STYLE = Object.freeze({
  SSS:{ color:"#fbbf24", label:"SSS" },
  SS: { color:"#f59e0b", label:"SS"  },
  S:  { color:"#a78bfa", label:"S"   },
  A:  { color:"#4ade80", label:"A"   },
  B:  { color:"#60a5fa", label:"B"   },
  C:  { color:"#94a3b8", label:"C"   },
  D:  { color:"#a8a29e", label:"D"   },
  E:  { color:"#f87171", label:"E"   },
});

// 箭可能是 "X" / "10" / {label:"9"} / {score:9}；藥水箭帶 potion 或非計分 label
function toLabel(arrow) {
  if (arrow == null) return null;
  if (typeof arrow === "string" || typeof arrow === "number") return String(arrow);
  return arrow.label != null ? String(arrow.label) : (arrow.score != null ? String(arrow.score) : null);
}

// 藥水箭沒有分數，必須整支排除（不是當 0 分）
function isPotionArrow(arrow) {
  if (arrow && typeof arrow === "object" && (arrow.potion || arrow.isPotion)) return true;
  const label = toLabel(arrow);
  if (!label) return true;
  return !/^(X|M|\d+)$/i.test(label);
}

function labelScore(label, maxScore) {
  if (label == null) return null;
  const text = String(label).toUpperCase();
  if (text === "X") return maxScore;   // X 視為滿環
  if (text === "M") return 0;          // 未命中
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * 計算一位射手本場的射箭評價。
 * @param {Array} arrows 箭序列（label 字串／數字／{label}／{score}）
 * @param {{ targetFmt?:string }} options
 * @returns {{ grade, score, hitRate, stability, highRate, arrowCount, hits, misses, avgScore, distribution }}
 */
export function gradeArcheryPerformance(arrows, { targetFmt = "full_110" } = {}) {
  const format = getTargetFaceFormat(targetFmt);
  const maxScore = format?.maxScore || 10;
  const minScore = format?.minScore ?? 1;

  const scored = (Array.isArray(arrows) ? arrows : [])
    .filter(arrow => !isPotionArrow(arrow))
    .map(arrow => ({ label:String(toLabel(arrow)).toUpperCase(), score:labelScore(toLabel(arrow), maxScore) }))
    .filter(entry => entry.score != null);

  const arrowCount = scored.length;
  const empty = {
    grade:"E", score:0, hitRate:0, stability:0, highRate:0,
    arrowCount:0, hits:0, misses:0, avgScore:0, distribution:{},
  };
  if (!arrowCount) return empty;

  const distribution = scored.reduce((acc, entry) => {
    acc[entry.label] = (acc[entry.label] || 0) + 1;
    return acc;
  }, {});

  const hitEntries = scored.filter(entry => entry.score > 0);
  const hits = hitEntries.length;
  const misses = arrowCount - hits;
  const hitRate = hits / arrowCount;

  // 高分線取「最高的 20% 環數」，不能寫死成 maxScore-1：
  // 原野靶只有 X/5/4/3/2/1，maxScore-1 會讓 4 和 5 都算高分（占 40% 的環），
  // 中階射手因此輕鬆拿 S，跟十環靶完全不對等。改用環數比例後：
  //   十環靶(1-10) → 9 以上；原野靶(1-5) → 只有 5(X)；複合靶(5-10) → 只有 10(X)
  const ringCount = Math.max(1, maxScore - minScore + 1);
  const highRingCount = Math.max(1, Math.round(ringCount * 0.2));
  const highThreshold = Math.max(minScore, maxScore - highRingCount + 1);
  const highRate = scored.filter(entry => entry.score >= highThreshold).length / arrowCount;

  // 穩定性只看命中的箭：把 M 算進標準差會讓「偶爾脫靶」被重複懲罰（命中率已經扣過一次）。
  // 正規化基準取該靶制分數全距的一半 —— 標準差達到全距一半已經是非常發散。
  const spread = Math.max(1, (maxScore - minScore) / 2);
  const stability = hits >= 2
    ? Math.max(0, 1 - stdDev(hitEntries.map(entry => entry.score)) / spread)
    : (hits === 1 ? 1 : 0); // 只有一箭命中無從談離散，不倒扣

  const avgScore = arrowCount ? scored.reduce((sum, entry) => sum + entry.score, 0) / arrowCount : 0;
  const score = Math.round(
    (hitRate * WEIGHTS.hitRate + stability * WEIGHTS.stability + highRate * WEIGHTS.highRate) * 100,
  );

  return {
    grade: GRADE_THRESHOLDS.find(entry => score >= entry.min)?.grade || "E",
    score,
    hitRate, stability, highRate,
    arrowCount, hits, misses,
    avgScore: Math.round(avgScore * 100) / 100,
    distribution,
  };
}

/**
 * 從多位成員的箭序列挑出 MVP（射箭表現最好的人）。
 * 同分時箭數多者優先 —— 打得多又維持水準比只射兩箭更有代表性。
 * @param {Array<{ id, name, arrows }>} members
 */
export function pickArcheryMvp(members, { targetFmt = "full_110" } = {}) {
  const graded = (members || [])
    .map(member => ({ ...member, performance: gradeArcheryPerformance(member.arrows, { targetFmt }) }))
    .filter(member => member.performance.arrowCount > 0);
  if (!graded.length) return null;
  return graded.reduce((best, current) => {
    if (current.performance.score !== best.performance.score) {
      return current.performance.score > best.performance.score ? current : best;
    }
    return current.performance.arrowCount > best.performance.arrowCount ? current : best;
  });
}

/**
 * 規則式射箭建議（不呼叫外部 API：免費、離線、即時）。
 * 依命中率／穩定性／高分率各自的弱點挑句子，最多回三條。
 */
export function buildArcheryAdvice(performance, { targetFmt = "full_110" } = {}) {
  if (!performance || !performance.arrowCount) return ["這場沒有計分箭，先累積幾支再看分析。"];
  const advice = [];
  const { hitRate, stability, highRate, avgScore } = performance;
  // 門檻用「滿環的 9 成」而不是寫死 9 分：原野靶滿分只有 5，寫死的話永遠觸發不了。
  const maxScore = getTargetFaceFormat(targetFmt)?.maxScore || 10;
  const masteryScore = maxScore * 0.9;

  if (hitRate < 0.7) advice.push("脫靶偏多，先把節奏放慢、確認撒放前的滿弓停頓。");
  else if (hitRate < 0.9) advice.push("命中率不錯，剩下的脫靶多半來自趕拍，注意每支之間的呼吸重置。");

  if (stability < 0.5) advice.push("落點分散，建議檢查瞄準點與弓臂穩定度，先求集中再求高分。");
  else if (stability < 0.75) advice.push("集中度中上，可用同一姿勢連射三支確認重複性。");
  else advice.push("落點很集中，這是好底子；若均分偏低，調整瞄準點即可整組上移。");

  if (highRate < 0.3) advice.push("高分環佔比偏低，練習時把目標放在「多一支進 9 環」而不是拚 X。");
  else if (highRate >= 0.6) advice.push("高分環佔比很高，維持現在的節奏就好。");

  // 均分接近滿環 = 這個距離已經吃透了，下一步是把距離拉長（不是換小靶面）
  if (avgScore >= masteryScore) advice.push("均分接近滿環，這個距離已經穩了，可以考慮往後增長距離。");
  return advice.slice(0, 3);
}
