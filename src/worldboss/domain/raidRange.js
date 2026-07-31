// src/worldboss/domain/raidRange.js
// ─────────────────────────────────────────────────────────────
// 射程加成。
//
// 貓小隊的實況（作者 2026-07-31）：射 5~18 米。
// **基準＝5 米（新手的標準射程）＝ ×1.00**，往後退就加成。
//
// ⚠️ 距離倍率**不看靶紙尺寸**——靶紙的難度改由 raidFaces 的固定倍率表示
//    （半靶 1.0 / 全靶 1.2 / 原野靶 1.4 / 三連靶 1.5，作者直接指定）。
//    兩者相乘＝這一場的環境倍率。分開的好處：想調距離就調這支、
//    想調靶紙就調 raidFaces，不會互相牽連。
// ─────────────────────────────────────────────────────────────

import { faceMultiplier } from "./raidFaces";

export const RAID_MIN_DISTANCE = 5;
export const RAID_MAX_DISTANCE = 18;
export const RAID_DEFAULT_DISTANCE = 10;

export const RANGE_MAX_MULT = 2.0;

/**
 * 距離倍率。開平方是刻意的——難度加倍不該讓傷害也加倍，
 * 否則大家只會一路退到 18 米，其他距離就沒人選了。
 *   5m → ×1.00   10m → ×1.41   18m → ×1.90
 */
export function distanceMultiplier(distanceM) {
  const d = Number(distanceM);
  if (!Number.isFinite(d) || d <= 0) return 1;
  const raw = Math.sqrt(Math.max(RAID_MIN_DISTANCE, d) / RAID_MIN_DISTANCE);
  return Math.round(Math.min(RANGE_MAX_MULT, raw) * 100) / 100;
}

/**
 * 環境倍率 ＝ 距離倍率 × 靶紙倍率。乘在整箭傷害上，對所有人一視同仁。
 */
export function rangeMultiplier({ distanceM, targetFmt } = {}) {
  return Math.round(distanceMultiplier(distanceM) * faceMultiplier(targetFmt) * 100) / 100;
}

// UI 用：這個距離值不值得退後
export function rangeLabel(mult) {
  if (mult >= 2.2) return { text: "極遠", color: "#f472b6" };
  if (mult >= 1.6) return { text: "遠距", color: "#fbbf24" };
  if (mult > 1) return { text: "略遠", color: "#a3e635" };
  return { text: "基準（5 米・半靶）", color: "#94a3b8" };
}

export const RAID_DISTANCES = Array.from(
  { length: RAID_MAX_DISTANCE - RAID_MIN_DISTANCE + 1 },
  (_, i) => RAID_MIN_DISTANCE + i,
);
