// src/worldboss/domain/matchRewards.js
// ─────────────────────────────────────────────────────────────
// 🎁 比賽模式的獎勵（作者 2026-08-01）。
//
// ⚠️ 獎勵**不是即時發的**，是比賽結束後由教練按一次發放。
//    理由有兩個：
//      ① 逐箭發＝每射一箭就要寫 5 個 collection，射箭場的網路撐不住
//      ② 比賽當天教練需要「先確認成績沒問題，再發」的權力
//
// ⚠️ 給多少**跟名次無關**，看的是「射了多少、射得多穩」——
//    比賽已經有排行榜當榮譽了，獎勵再綁名次會讓後段班沒有動力射完。
//    名次獎勵留給教練自己另外發（發放面板可以單獨加碼）。
// ─────────────────────────────────────────────────────────────

/** 預設值。教練可以在後台改，改完存在該場比賽的文件上。 */
export const DEFAULT_MATCH_REWARD = Object.freeze({
  archerXPPerArrow: 3,        // 每一箭的射手經驗
  catXPPerArrow: 3,           // 每一箭的貓貓經驗
  coinsPerPoint: 2,           // 每一分的金幣
  arrowsPerChest: 12,         // 幾箭給一個材料寶箱
  chestType: "iron",          // 材料寶箱等級（六族通用箱）
  arrowsPerCoinChest: 12,     // 幾箭給一個金幣寶箱
  coinChestTier: "rare",      // 金幣寶箱等級
  maxChests: 8,               // 單場上限，避免射一整天爆量
  maxCoinChests: 8,
  minArrows: 3,               // 至少射滿一輪才有獎勵
  accuracyBonus: true,        // 平均 8 環以上，寶箱 +1
});

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** 把教練填的設定補齊（缺的、壞的一律用預設） */
export function normalizeRewardConfig(cfg) {
  const c = { ...DEFAULT_MATCH_REWARD, ...(cfg || {}) };
  return {
    archerXPPerArrow: Math.max(0, num(c.archerXPPerArrow, 3)),
    catXPPerArrow: Math.max(0, num(c.catXPPerArrow, 3)),
    coinsPerPoint: Math.max(0, num(c.coinsPerPoint, 2)),
    arrowsPerChest: Math.max(1, num(c.arrowsPerChest, 12)),
    chestType: c.chestType || "iron",
    arrowsPerCoinChest: Math.max(1, num(c.arrowsPerCoinChest, 12)),
    coinChestTier: c.coinChestTier || "rare",
    maxChests: Math.max(0, num(c.maxChests, 8)),
    maxCoinChests: Math.max(0, num(c.maxCoinChests, 8)),
    minArrows: Math.max(0, num(c.minArrows, 3)),
    accuracyBonus: c.accuracyBonus !== false,
  };
}

/**
 * 一位選手拿多少。
 * @param player { arrows, score }
 */
export function matchRewardFor(player, cfg) {
  const c = normalizeRewardConfig(cfg);
  const arrows = Math.max(0, Math.floor(num(player?.arrows)));
  const score = Math.max(0, Math.floor(num(player?.score)));

  if (arrows < c.minArrows) {
    return {
      eligible: false, arrows, score,
      archerXP: 0, catXP: 0, coins: 0, chests: 0, coinChests: 0,
      chestType: c.chestType, coinChestTier: c.coinChestTier, accurate: false,
    };
  }

  const average = arrows ? score / arrows : 0;
  // ⚠️ 準度加碼給的是**寶箱**不是經驗：經驗照箭數給，
  //    才不會變成「射得準的人連練習量都算比較多」。
  const accurate = c.accuracyBonus && average >= 8;
  const bonus = accurate ? 1 : 0;

  return {
    eligible: true, arrows, score, average,
    archerXP: arrows * c.archerXPPerArrow,
    catXP: arrows * c.catXPPerArrow,
    coins: score * c.coinsPerPoint,
    chests: Math.min(c.maxChests, Math.floor(arrows / c.arrowsPerChest) + bonus),
    coinChests: Math.min(c.maxCoinChests, Math.floor(arrows / c.arrowsPerCoinChest) + bonus),
    chestType: c.chestType,
    coinChestTier: c.coinChestTier,
    accurate,
  };
}

/** 全場預覽——教練按下發放之前要看得到總共要發多少 */
export function matchRewardPreview(players = {}, cfg) {
  const rows = Object.entries(players || {})
    .filter(([, p]) => p)
    .map(([memberId, p]) => ({
      memberId,
      name: p.name || memberId,
      rewarded: !!p.rewarded,
      ...matchRewardFor(p, cfg),
    }))
    .sort((a, b) => b.score - a.score);

  const pending = rows.filter(r => r.eligible && !r.rewarded);
  return {
    rows,
    pending: pending.length,
    already: rows.filter(r => r.rewarded).length,
    skipped: rows.filter(r => !r.eligible).length,
    totals: pending.reduce((t, r) => ({
      archerXP: t.archerXP + r.archerXP,
      catXP: t.catXP + r.catXP,
      coins: t.coins + r.coins,
      chests: t.chests + r.chests,
      coinChests: t.coinChests + r.coinChests,
    }), { archerXP: 0, catXP: 0, coins: 0, chests: 0, coinChests: 0 }),
  };
}

/** 一句話說明這場的設定——教練改完要能一眼確認 */
export function describeRewardConfig(cfg) {
  const c = normalizeRewardConfig(cfg);
  return `每箭 射手XP+${c.archerXPPerArrow}・貓XP+${c.catXPPerArrow}｜每分 ${c.coinsPerPoint} 金幣｜`
    + `每 ${c.arrowsPerChest} 箭 1 材料箱（上限 ${c.maxChests}）｜`
    + `每 ${c.arrowsPerCoinChest} 箭 1 金幣箱（上限 ${c.maxCoinChests}）`;
}
