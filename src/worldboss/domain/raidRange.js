// src/worldboss/domain/raidRange.js
// ─────────────────────────────────────────────────────────────
// 射程加成。
//
// 貓小隊的實況（作者 2026-07-31）：常用 **17cm 半靶**、射 **5~18 米**。
// 這比正規賽制（122cm@70m、40cm@18m）小很多——同樣射「10 環」，難度差很遠。
// 所以難度不能只看分數，要看**視角大小**：紙的直徑 ÷ 距離。
//
// 這支只回傳一個倍率，乘在整箭傷害上（弱點固定傷害與一般傷害都吃）。
// 為什麼兩者都吃：距離是「這一場的設定」，對新手老手一視同仁，
// 不會影響新老玩家的貢獻比（raidBalance.test.js 守著的那個數字）。
// ─────────────────────────────────────────────────────────────

export const RAID_MIN_DISTANCE = 5;
export const RAID_MAX_DISTANCE = 18;
export const RAID_DEFAULT_DISTANCE = 10;

// 難度指標＝距離(公尺) × 100 ÷ 靶紙直徑(公分)。無單位，跨靶紙可比。
//   17cm @ 5m  → 29.4（＝基準，×1.00）   17cm @ 18m → 105.9（×1.90）
//   40cm @ 18m → 45.0（×1.24）           122cm @ 70m → 57.4（×1.40）
// ⚠️ 基準＝**5 米 × 17cm 靶**（作者：這是新手的標準射程），倍率剛好 1.00。
//    比它近就 < 1、比它遠就 > 1，玩家一眼知道自己站的位置值多少。
export const RANGE_REFERENCE = (RAID_MIN_DISTANCE * 100) / 17;   // ≈ 29.41
export const RANGE_MIN_MULT = 0.6;
export const RANGE_MAX_MULT = 1.9;

export function angularDifficulty({ distanceM, faceSizeCm }) {
  const d = Number(distanceM);
  const face = Number(faceSizeCm);
  if (!Number.isFinite(d) || !Number.isFinite(face) || d <= 0 || face <= 0) return null;
  return (d * 100) / face;
}

/**
 * 射程倍率。開平方是刻意的——難度加倍不該讓傷害也加倍，
 * 否則大家只會一路退到 18 米，其他距離就沒人選了。
 * 靶紙沒有尺寸資料（原野靶）→ 回 1，不給也不扣。
 */
export function rangeMultiplier({ distanceM, faceSizeCm } = {}) {
  const difficulty = angularDifficulty({ distanceM, faceSizeCm });
  if (difficulty == null) return 1;
  const raw = Math.sqrt(difficulty / RANGE_REFERENCE);
  const clamped = Math.min(RANGE_MAX_MULT, Math.max(RANGE_MIN_MULT, raw));
  return Math.round(clamped * 100) / 100;
}

// UI 用：這個距離值不值得退後
export function rangeLabel(mult) {
  if (mult >= 1.7) return { text: "極遠", color: "#f472b6" };
  if (mult >= 1.4) return { text: "遠距", color: "#fbbf24" };
  if (mult > 1) return { text: "略遠", color: "#a3e635" };
  if (mult === 1) return { text: "基準（5 米）", color: "#94a3b8" };
  return { text: "近距", color: "#64748b" };
}

export const RAID_DISTANCES = Array.from(
  { length: RAID_MAX_DISTANCE - RAID_MIN_DISTANCE + 1 },
  (_, i) => RAID_MIN_DISTANCE + i,
);
