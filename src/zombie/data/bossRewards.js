// src/zombie/data/bossRewards.js
// ═══════════════════════════════════════════════════════════════
//  殭屍生存模式 — BOSS 獎勵資料表（Phase 5）
//  巨型殭屍王專屬掉落、獎勵計算
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {object} BossRewardItem
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} color
 * @property {string} rarity — "exclusive" | "legendary" | "epic" | "rare"
 * @property {string} type — "research" | "material" | "accessory_craft"
 * @property {string} desc
 * @property {number} [dropChance] — 掉落機率 (0-1)，預設 1
 */

/** 巨型殭屍王專屬掉落表 */
export const GIANT_KING_REWARDS = [
  {
    id: "boss_zombie_core",
    name: "殭屍王核心",
    icon: "💎",
    color: "#dc2626",
    rarity: "exclusive",
    type: "research",
    desc: "蘊含殭屍融合能量的核心。可用於跨世界研究。",
    dropChance: 1.0, // 必掉
  },
  {
    id: "boss_armor_shard",
    name: "不滅裝甲碎片",
    icon: "🛡️",
    color: "#8b5cf6",
    rarity: "legendary",
    type: "material",
    desc: "傳說級防具材料。可用於製作或升級 T5 防具。",
    dropChance: 0.8,
  },
  {
    id: "boss_dead_heart",
    name: "亡者之心",
    icon: "❤️‍🔥",
    color: "#ef4444",
    rarity: "legendary",
    type: "accessory_craft",
    desc: "特殊配件材料。可用於製作傳說級配件。",
    dropChance: 0.6,
  },
  {
    id: "boss_undead_flesh",
    name: "不潔血肉",
    icon: "🧫",
    color: "#a855f7",
    rarity: "epic",
    type: "material",
    desc: "高階強化道具材料。可用於 T3+ 強化道具製作。",
    dropChance: 0.9,
  },
  {
    id: "boss_bone_marrow",
    name: "骨髓精華",
    icon: "🧪",
    color: "#22d3ee",
    rarity: "epic",
    type: "material",
    desc: "醫療研究材料。可用於高階血清製作。",
    dropChance: 0.7,
  },
  {
    id: "boss_coin_pouch",
    name: "腐鏽錢袋",
    icon: "💰",
    color: "#fbbf24",
    rarity: "rare",
    type: "coins",
    desc: "殭屍王收集的金幣袋。",
    dropChance: 1.0,
    coinAmount: { min: 200, max: 500 },
  },
];

/**
 * 取得 BOSS 掉落物
 * @param {string} bossId
 * @returns {BossRewardItem[]}
 */
export function getBossRewards(bossId) {
  if (bossId === "giant_zombie_king") return GIANT_KING_REWARDS;
  return [];
}

/**
 * 模擬 BOSS 掉落（純函數）
 * @param {string} bossId
 * @param {function} [rand]
 * @returns {BossRewardItem[]}
 */
export function rollBossDrops(bossId, rand = Math.random) {
  const rewards = getBossRewards(bossId);
  return rewards.filter(item => !item.dropChance || rand() < item.dropChance);
}

/**
 * 計算 BOSS 總獎勵（含金幣）
 * @param {string} bossId
 * @param {function} [rand]
 * @returns {{ items: BossRewardItem[], coins: number }}
 */
export function calculateBossReward(bossId, rand = Math.random) {
  const items = rollBossDrops(bossId, rand);
  let coins = 0;

  for (const item of items) {
    if (item.type === "coins" && item.coinAmount) {
      const { min, max } = item.coinAmount;
      coins += Math.floor(rand() * (max - min + 1)) + min;
    }
  }

  // 非金幣物品也包含在 items 中
  const nonCoinItems = items.filter(item => item.type !== "coins");

  return {
    items: nonCoinItems,
    coins,
    totalItems: nonCoinItems.length,
  };
}
