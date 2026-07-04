// src/lib/score.js — 統一 Score Engine
// 所有戰鬥模式的計分常數、工具函數集中管理
import { getTargetScoreLabels } from "./targetFace";

// ─── 標籤 → 數值映射 ──────────────────────────────────────────
export const SCORE_MAP = { X: 10, 10: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2, 1: 1, M: 0 };

// 全靶標籤順序
export const SCORE_LABELS = ["X", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "M"];

// 得分關合約專用標籤（reversal 關卡從 9 開始）
export const SCORE_GATE_LABELS = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "M"];

// Tailwind 色票（用於顯示已射箭分）
export const SCORE_COLORS = {
  X: "bg-yellow-400 text-yellow-900",
  10: "bg-yellow-300 text-yellow-900",
  9: "bg-red-400 text-white",
  8: "bg-red-300 text-white",
  7: "bg-blue-400 text-white",
  6: "bg-blue-300 text-white",
  5: "bg-gray-500 text-white",
  4: "bg-gray-400 text-white",
  3: "bg-gray-300 text-gray-800",
  2: "bg-gray-200 text-gray-700",
  1: "bg-gray-100 text-gray-600",
  M: "bg-black/30 text-gray-300",
};

// 十六進位色票（用於 inline style / BattleRecords）
export const SCORE_HEX_COLORS = {
  X: "#fbbf24",
  10: "#fbbf24",
  9: "#ef4444",
  8: "#f87171",
  7: "#3b82f6",
  6: "#60a5fa",
  5: "#6b7280",
  4: "#9ca3af",
  3: "#d1d5db",
  2: "#e5e7eb",
  1: "#f3f4f6",
  0: "#475569",
  M: "#475569",
};

// ─── 半靶樣式陣列（MonsterBattle 風格，含色值與 Tailwind class）─
export const HALF_SCORES = [
  { label: "X",  val: 10, color: "#fbbf24", cls: "bg-yellow-400 text-yellow-900" },
  { label: "10", val: 10, color: "#fbbf24", cls: "bg-yellow-300 text-yellow-900" },
  { label: "9",  val: 9,  color: "#ef4444", cls: "bg-red-400 text-white" },
  { label: "8",  val: 8,  color: "#ef4444", cls: "bg-red-300 text-white" },
  { label: "7",  val: 7,  color: "#3b82f6", cls: "bg-blue-400 text-white" },
  { label: "6",  val: 6,  color: "#3b82f6", cls: "bg-blue-300 text-white" },
  { label: "5",  val: 5,  color: "#6b7280", cls: "bg-gray-500 text-white" },
  { label: "4",  val: 4,  color: "#9ca3af", cls: "bg-gray-400 text-white" },
  { label: "3",  val: 3,  color: "#d1d5db", cls: "bg-gray-300 text-gray-800" },
  { label: "2",  val: 2,  color: "#e5e7eb", cls: "bg-gray-200 text-gray-700" },
  { label: "1",  val: 1,  color: "#f3f4f6", cls: "bg-gray-100 text-gray-600" },
  { label: "M",  val: 0,  color: "#64748b", cls: "bg-slate-600 text-gray-200" },
];

// ─── 分數按鈕陣列（DuelRoom / WorldBoss 風格）──────────────
export const SCORE_BTNS = [
  { label: "X",  score: 10 },
  { label: "10", score: 10 },
  { label: "9",  score: 9  },
  { label: "8",  score: 8  },
  { label: "7",  score: 7  },
  { label: "6",  score: 6  },
  { label: "5",  score: 5  },
  { label: "4",  score: 4  },
  { label: "3",  score: 3  },
  { label: "2",  score: 2  },
  { label: "1",  score: 1  },
  { label: "M",  score: 0  },
];

export const SCORE_BTN_LABELS = ["X", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "M"];

// ─── 工具函數 ────────────────────────────────────────────────

/**
 * 將標籤轉換為數值
 * "X" → 10, "M" → 0, "10" → 10, 數字字串 → parseInt
 */
export function labelToValue(label) {
  if (label === "M") return 0;
  if (label === "X") return 10;
  const n = parseInt(label, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * 將數值轉回標籤字串（反向 labelToValue）
 */
export function valueToLabel(val) {
  if (val === 10) return "X";
  if (val === 0) return "M";
  return String(val);
}

/**
 * 將標籤轉為分數，並處理靶面格式映射
 * @param {string} label    - 標籤（X/10/9/.../M）
 * @param {string} targetFmt - 靶面格式（"full_110"/"half_610"/"field_16"）
 * @returns {number} 分數值（0-10）
 */
export function scoreToValue(label, targetFmt) {
  const raw = labelToValue(label);
  if (targetFmt === "field_16" && raw > 0) {
    return Math.min(raw + 5, 10);
  }
  return raw;
}

/**
 * 根據標籤取得 hex 顏色
 * @param {string} label
 * @param {'hex'|'tailwind'} [variant='hex']
 * @returns {string}
 */
export function getScoreColor(label, variant = "hex") {
  if (variant === "tailwind") {
    return SCORE_COLORS[label] || "bg-slate-600 text-white";
  }
  return SCORE_HEX_COLORS[label] || "#94a3b8";
}

/**
 * 判斷該分數是否爆擊（打怪世界王用）
 * @param {number} score
 * @param {string} [targetFmt]
 * @returns {boolean}
 */
export function isCritScore(score, targetFmt) {
  if (targetFmt === "field_16") return score >= 6;
  return score >= 10;
}

/**
 * 對應 targetFmt 回傳可用標籤列表
 */
export function getScoreLabels(targetFmt) {
  return getTargetScoreLabels(targetFmt);
}

/**
 * 計算箭數統計（MonsterBattle 的 calcStats）
 * @param {number[]} allArrows - 數值陣列（非標籤）
 * @returns {{ total, count, avg, tens, misses, dist }|null}
 */
export function calcArrowStats(allArrows) {
  if (!allArrows?.length) return null;
  const total = allArrows.reduce((s, v) => s + v, 0);
  const count = allArrows.length;
  const avg   = (total / count).toFixed(1);
  const tens  = allArrows.filter(v => v === 10).length;
  const misses = allArrows.filter(v => v === 0).length;
  const dist = {};
  allArrows.forEach(v => { dist[v] = (dist[v] || 0) + 1; });
  return { total, count, avg, tens, misses, dist };
}

/**
 * 計算分數分布
 * @param {number[]} arrows
 * @returns {Object<number, number>}
 */
export function calcDistribution(arrows) {
  const dist = { 10: 0, 9: 0, 8: 0, 7: 0, 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
  arrows.forEach(v => {
    if (v in dist) dist[v]++;
  });
  return dist;
}

/**
 * 計算穩定性（標準差法）
 * @param {number[]} arrows
 * @returns {number|null} 0-100 百分比，null 表示樣本不足
 */
export function calcStability(arrows) {
  if (arrows.length < 2) return null;
  const avg = arrows.reduce((s, v) => s + v, 0) / arrows.length;
  const variance = arrows.reduce((s, v) => s + (v - avg) ** 2, 0) / arrows.length;
  const sigma = Math.sqrt(variance);
  return Math.max(0, Math.min(100, Math.round((1 - sigma / 5) * 100)));
}

/**
 * 從不同格式的 log 取出所有箭分陣列（BattleRecords 用）
 * @param {Object} log - 戰鬥紀錄物件
 * @returns {number[]}
 */
export function extractArrowValues(log) {
  if (log.roundScores?.length)
    return log.roundScores.flatMap(r => (r.scores || []).filter(v => typeof v === "number" && !isNaN(v)));
  if (Array.isArray(log.rounds))
    return log.rounds.flat().filter(v => typeof v === "number" && !isNaN(v));
  return [];
}
