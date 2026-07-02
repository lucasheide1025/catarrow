// src/battle/BattleConfig.js
// 戰鬥模式設定 — 每種模式的參數集中管理

/** 每回合箭數 */
export const ARROWS_PER_ROUND = 6;

/** 玩家可選的每回合箭數 */
export const ARROWS_OPTIONS = [3, 6];

/** 預設每回合箭數（若未選擇） */
export const ARROWS_PER_ROUND_DEFAULT = 6;

/** 決鬥箭數 */
export const DUEL_ARROWS = 6;

/** 世界王總回合數 */
export const WORLD_BOSS_TOTAL_ROUNDS = 5;

/** 世界王每回合箭數 */
export const WORLD_BOSS_ARROWS_PER = 6;

/** 新手距離預設值 */
export const PRESET_DISTANCES_NOVICE = [5, 7, 10];

/** 學生/老手距離選項 */
export const PRESET_DISTANCES = [5, 7, 10, 13.5, 15, 18];

/** 動態距離起始 */
export const DISTANCE_START = 15;

// ── 怪物倍率設定 ────────────────────────────────────────────

export const MODE_MONSTER_MULT = {
  novice:  { hp: 1.0,  atk: 1,   def: 1 },
  student: { hp: 1.0,  atk: 1,   def: 1 },
  veteran: { hp: 1.5,  atk: 1.25, def: 1.25 },
  match:   { hp: 1.5,  atk: 1.25, def: 1.25 },
};

/** 射手最低 HP（老手模式鎖定 600） */
export const MIN_ARCHER_HP = {
  novice:  0,    // 不強制
  student: 0,
  veteran: 600,
  match:   600,
};

// ── 爆擊機率計算 ────────────────────────────────────────────

/**
 * 依距離計算學生模式反擊爆擊率
 * @param {number} dist - 當前距離
 * @param {number} startDist - 起始距離
 * @returns {number} 爆擊率 0~1
 */
export function studentCounterCritChance(dist, startDist = DISTANCE_START) {
  return Math.max(0, (startDist - dist) / startDist * 0.3);
}

/**
 * 依距離計算老手模式反擊爆擊率
 * @param {number} dist - 當前距離
 * @param {number} startDist - 起始距離
 * @returns {number} 爆擊率 0~1
 */
export function veteranCounterCritChance(dist, startDist = DISTANCE_START) {
  return Math.max(0, (startDist - dist) / startDist * 0.5);
}

// ── 動態距離步進 ────────────────────────────────────────────

/** 隨機距離變化步數（1~5 米） */
export function randomDistStep() {
  return Math.floor(Math.random() * 5) + 1;
}

// ── 冒險者 XP ──────────────────────────────────────────────

export const ADVENTURER_XP_PER_TIER = {
  common: 15, rare: 30, elite: 50, fierce: 75, boss: 100, mythic: 150,
};

// ── 物品掉落機率（模式修正）────────────────────────────────

export const COIN_CHEST_CHANCE_BY_MODE = {
  novice:  0.2,
  student: 0.5,
  veteran: 1.0,
  match:   1.0,
};
