// src/guild/domain/guildExpeditionStats.js
// 新版公會遠征的永久累積統計正規化。
// 僅整理 guildProfiles.expeditions 既有欄位，不讀寫 Firestore。

export const EMPTY_GUILD_EXPEDITION_STATS = Object.freeze({
  total: 0,
  won: 0,
  hardWon: 0,
  deadlyWon: 0,
  mythicWon: 0,
});

function safeCount(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

export function normalizeGuildExpeditionStats(expeditions = {}) {
  const dangerEntries = Object.entries(expeditions?.byDanger || {})
    .map(([danger, count]) => [Number(danger), safeCount(count)])
    .filter(([danger]) => Number.isFinite(danger));

  const winsAtOrAbove = minDanger => dangerEntries.reduce(
    (sum, [danger, count]) => danger >= minDanger ? sum + count : sum,
    0,
  );

  return {
    total: safeCount(expeditions?.total),
    won: safeCount(expeditions?.won),
    hardWon: winsAtOrAbove(3),
    deadlyWon: winsAtOrAbove(5),
    mythicWon: dangerEntries.reduce(
      (sum, [danger, count]) => danger === 6 ? sum + count : sum,
      0,
    ),
  };
}
