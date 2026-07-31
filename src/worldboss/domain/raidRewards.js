// src/worldboss/domain/raidRewards.js
// ─────────────────────────────────────────────────────────────
// **每場出擊**的結算獎勵——就算沒有擊倒也要給（作者 2026-07-31）。
//
// ⚠️ 這是**新的一層**，跟既有的擊倒獎勵是兩回事，不要混：
//
//   ① 擊倒分配（既有，`worldBossDb.js:543` + `DROP_TABLE_BY_CATEGORY`）：
//      王死掉時才發，池子很大（金幣 3000~10000），依「傷害佔全團％」分。
//   ② **出擊獎勵（本檔）**：每次出擊結束就發，金額小得多，
//      依「這一場打掉王多少血」＋參與保底。
//
//   兩者刻意不重疊：出擊獎勵是「你今天有來射箭」的即時回饋，
//   擊倒分配是「這隻王終於倒了」的大獎。把出擊獎勵開太大就會壓掉擊倒的份量。
//
// 純函數、亂數可注入，所以平衡調整都可以用測試守住。
// ─────────────────────────────────────────────────────────────

import { COIN_CHEST_TIERS } from "../../lib/lootTable";
import { getDropCategory } from "../../lib/worldBossData";
import { FAMILIES } from "../../lib/monsterData";

// 出擊獎勵的基準池。刻意只有擊倒分配的零頭——它是即時回饋，不是主獎勵。
const SORTIE_POOL = Object.freeze({
  family_small: { coins: 120, archerXP: 90, catXP: 40 },
  family_big:   { coins: 200, archerXP: 140, catXP: 60 },
  cat:          { coins: 90,  archerXP: 70, catXP: 35 },
  coach:        { coins: 320, archerXP: 220, catXP: 90 },
});

// 參與保底：就算一箭都沒中，只要有出擊就拿得到這個比例
export const PARTICIPATION_FLOOR = 0.35;

// 打掉王多少血 → 貢獻係數。滿分是「一場打掉 4% 的王血」（8 人局的合理上限）
export const CONTRIBUTION_FULL_PCT = 0.04;

// ⚠️ 世界王卡：作者指定 **1%**。跟擊倒分配的 wbCardChance（10~25%）是兩回事。
export const SORTIE_WB_CARD_CHANCE = 0.01;

// 材料寶箱的階級：依王的定位給範圍（比照 DROP_TABLE_BY_CATEGORY.chestTierRange）
const CHEST_TIER_RANGE = Object.freeze({
  family_small: [1, 3], family_big: [3, 5], cat: [1, 2], coach: [4, 6],
});
const TIER_NAMES = ["common", "rare", "elite", "fierce", "boss", "mythic"];

// 隨機族（含寶箱族——公會那邊 2026-07-18 已經把第七族放進輪替）
const FAMILY_IDS = Object.keys(FAMILIES);

/**
 * 這一場的貢獻係數（0~1）。
 * 打得越多拿越多，但一箭沒中也有保底——來射箭這件事本身就該有回饋。
 */
export function contributionRatio({ damage = 0, bossMaxHp = 1 } = {}) {
  const pct = Math.max(0, Number(damage) || 0) / Math.max(1, Number(bossMaxHp) || 1);
  const earned = Math.min(1, pct / CONTRIBUTION_FULL_PCT);
  return PARTICIPATION_FLOOR + (1 - PARTICIPATION_FLOOR) * earned;
}

/**
 * 一場出擊的獎勵。
 * totals 來自 raidFlow 的 state.totals（damage / breakPoints / weakHits / bullseyes / interrupts）。
 */
export function rollSortieRewards({
  boss,
  totals = {},
  bossMaxHp = 1,
  defeated = false,
  hasCat = false,
  rand = Math.random,
} = {}) {
  const category = getDropCategory(boss);
  const pool = SORTIE_POOL[category] || SORTIE_POOL.family_big;
  const ratio = contributionRatio({ damage: totals.damage, bossMaxHp });

  // 破防貢獻另外加成——那是團隊資源，值得獨立獎勵（新手推得動的那條路）
  const breakBonus = 1 + Math.min(0.5, (Number(totals.breakPoints) || 0) * 0.01);
  // 擊倒的人多一份（不取代擊倒分配，只是出擊獎勵也沾光）
  const killBonus = defeated ? 1.5 : 1;
  const mult = ratio * breakBonus * killBonus;

  const coins = Math.max(1, Math.round(pool.coins * mult));
  const archerXP = Math.max(1, Math.round(pool.archerXP * mult));
  // 沒帶貓就不給貓經驗（比照既有的 WB_NO_CAT_COIN_RATE 精神，換算交給呼叫端）
  const catXP = hasCat ? Math.max(1, Math.round(pool.catXP * mult)) : 0;

  // ── 材料寶箱：隨機族 × 依王定位的階級 ──
  const [tMin, tMax] = CHEST_TIER_RANGE[category] || [1, 3];
  const tierIdx = tMin + Math.floor(rand() * (tMax - tMin + 1));
  const family = FAMILY_IDS[Math.floor(rand() * FAMILY_IDS.length)];
  const materialChest = {
    family,
    familyLabel: FAMILIES[family]?.label || family,
    icon: FAMILIES[family]?.icon || "📦",
    tier: Math.min(6, Math.max(1, tierIdx)),
  };

  // ── 金幣寶箱：階級跟著材料寶箱走，開出來的金額用既有的 COIN_CHEST_TIERS ──
  const coinTierName = TIER_NAMES[materialChest.tier - 1] || "common";
  const info = COIN_CHEST_TIERS[coinTierName] || COIN_CHEST_TIERS.common;
  const coinChest = {
    tier: coinTierName,
    name: info.name, icon: info.icon, color: info.color,
    coins: info.min + Math.floor(rand() * (info.max - info.min + 1)),
  };

  // ── 世界王卡：1%（作者指定）──
  const wbCard = rand() < SORTIE_WB_CARD_CHANCE;

  return {
    category, ratio: Math.round(ratio * 100) / 100,
    coins, archerXP, catXP,
    materialChest, coinChest, wbCard,
    totalCoins: coins + coinChest.coins,
  };
}

// 結算頁用：把獎勵攤成一行一行
export function rewardRows(reward) {
  if (!reward) return [];
  const rows = [
    { key: "coins", icon: "💰", label: "金幣", value: reward.coins },
    { key: "archerXP", icon: "🏹", label: "射手經驗", value: reward.archerXP },
  ];
  if (reward.catXP > 0) rows.push({ key: "catXP", icon: "🐾", label: "貓貓經驗", value: reward.catXP });
  rows.push({
    key: "materialChest", icon: reward.materialChest.icon,
    label: `${reward.materialChest.familyLabel}材料寶箱`, value: `T${reward.materialChest.tier}`,
  });
  rows.push({
    key: "coinChest", icon: reward.coinChest.icon,
    label: reward.coinChest.name, value: `+${reward.coinChest.coins}`,
  });
  if (reward.wbCard) {
    rows.push({ key: "wbCard", icon: "👑", label: "世界王卡", value: "稀有掉落！", rare: true });
  }
  return rows;
}
