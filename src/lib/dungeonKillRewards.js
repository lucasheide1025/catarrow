// src/lib/dungeonKillRewards.js — 地下城每殺即時獎勵（2026-07-18 使用者拍板）
// 原則：金幣沿用 Tier 級距表(COIN_RANGE)、XP 依 Tier;「金幣與箭露追加五倍」。
// 箭露不每殺掉——只在通關結算,量 = 基準 × 難度倍率 × 5。數值全集中此檔。

import { rollCoins } from "./lootTable";

export const DUNGEON_COIN_MULT = 5;          // 使用者指示：金幣掉落 ×5
export const DUNGEON_DEW_EXTRA_MULT = 5;     // 使用者指示：箭露結算 ×5
// 難度 → 箭露結算倍率（普通/進階/困難/地獄;以難度數字 1-6 對映,超出取上限）
export const DUNGEON_DEW_DIFFICULTY_MULT = Object.freeze({ 1: 1, 2: 1.5, 3: 2, 4: 2.5, 5: 3, 6: 3 });

// 每殺 XP（依怪物 Tier;精英房 ×1.5 由呼叫端傳 eliteMult）
export function rollDungeonKillReward(monster, { eliteMult = 1 } = {}) {
  if (!monster) return null;
  const tierIndex = monster.tierIndex || 1;
  return {
    coins: Math.round(rollCoins(monster.tier, "student") * DUNGEON_COIN_MULT * eliteMult),
    archerXP: Math.round(tierIndex * 6 * eliteMult),
    catXP: Math.round(tierIndex * 3 * eliteMult),
  };
}

export function getDungeonDewMultiplier(difficulty) {
  const base = DUNGEON_DEW_DIFFICULTY_MULT[Math.max(1, Math.min(6, Number(difficulty) || 1))] || 1;
  return base * DUNGEON_DEW_EXTRA_MULT;
}
