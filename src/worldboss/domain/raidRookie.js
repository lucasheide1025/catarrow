// src/worldboss/domain/raidRookie.js
// ─────────────────────────────────────────────────────────────
// 新手扶助加成。
//
// 作者 2026-07-31 定案：**戰鬥模型保持中性，不要在裡面偷偷照顧新手**，
// 補償一律放在外面這一層——50 級以下才有，隨等級遞減到 0。
//
// 為什麼要分開：把補償塞進弱點的傷害/破防數值裡，數字會失去意義
// （會出現「紅點最難但破防最少」這種沒人看得懂的設定），
// 之後想調整也分不清哪個數字是玩法、哪個數字是補償。
//
// 這一層獨立之後：
//   ・想調新手體驗 → 只動這支
//   ・想調戰鬥手感 → 只動 weakPoints / raidFlow
// ─────────────────────────────────────────────────────────────

export const ROOKIE_LEVEL_CAP = 50;    // 這個等級以上就沒有加成了
export const ROOKIE_MAX_BONUS = 1.2;   // 1 級時的額外倍率（總倍率 = 1 + 這個）

/**
 * 新手扶助倍率。
 *   1 級   → ×2.18
 *   25 級  → ×1.60
 *   49 級  → ×1.02
 *   50 級+ → ×1（完全沒有）
 * 線性遞減：不會有「升到 50 級突然變弱」的斷崖。
 */
export function rookieMultiplier(archerLevel = 1) {
  const level = Math.max(1, Math.floor(Number(archerLevel) || 1));
  if (level >= ROOKIE_LEVEL_CAP) return 1;
  const remaining = (ROOKIE_LEVEL_CAP - level) / (ROOKIE_LEVEL_CAP - 1);
  return Math.round((1 + ROOKIE_MAX_BONUS * remaining) * 1000) / 1000;
}

// UI 用：要不要顯示「新手扶助」標章
export function rookieBadge(archerLevel = 1) {
  const mult = rookieMultiplier(archerLevel);
  if (mult <= 1) return null;
  return {
    label: "新手扶助",
    icon: "🌱",
    color: "#4ade80",
    text: `傷害 ×${mult.toFixed(2)}（${ROOKIE_LEVEL_CAP} 級後取消）`,
    mult,
  };
}
