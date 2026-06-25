// src/lib/archerLevel.js — 射手等級系統（獨立於冒險者公會等級）

export const MAX_ARCHER_LEVEL = 200;
export const XP_PER_LEVEL    = 20;   // 每升一級所需 XP（固定）

// 累積 XP → 等級（1–200）
export function archerLevelFromXP(totalXP) {
  const level = Math.floor((totalXP || 0) / XP_PER_LEVEL) + 1;
  return Math.min(MAX_ARCHER_LEVEL, Math.max(1, level));
}

// 當前等級在本級的 XP 進度
export function archerXPProgress(totalXP) {
  const level = archerLevelFromXP(totalXP);
  if (level >= MAX_ARCHER_LEVEL) {
    return { level: MAX_ARCHER_LEVEL, current: XP_PER_LEVEL, needed: XP_PER_LEVEL, pct: 100 };
  }
  const currentLevelXP = (level - 1) * XP_PER_LEVEL;
  const current = (totalXP || 0) - currentLevelXP;
  return { level, current, needed: XP_PER_LEVEL, pct: Math.round(current / XP_PER_LEVEL * 100) };
}

// 等級加成 { hp, atk, def }（Lv1 = 無加成，Lv200 = +995/+199/+199）
export function archerLevelBonus(level) {
  const lv = Math.max(1, Math.min(MAX_ARCHER_LEVEL, level || 1));
  return { hp: (lv - 1) * 5, atk: (lv - 1) * 1, def: (lv - 1) * 1 };
}

// ── 各模式 XP ────────────────────────────────────────────────

export const MONSTER_TIER_XP = {
  common:  5,
  rare:    10,
  elite:   20,
  fierce:  30,
  boss:    50,
  mythic:  80,
};

export const PARTY_XP_MULT      = 1.5;  // 組隊加成倍率
export const DUEL_WIN_XP        = 50;
export const DUEL_LOSE_XP       = 20;
export const DUNGEON_FLOOR_XP   = 15;   // 每通過一層
export const WORLD_BOSS_XP_CAP  = 300;  // 世界首領單場上限
export const WORLD_BOSS_XP_MULT = 2.0;  // 世界首領 XP 倍率

// 組隊寶箱額外掉落機率（30%）
export const PARTY_BONUS_CHEST_CHANCE = 0.30;
