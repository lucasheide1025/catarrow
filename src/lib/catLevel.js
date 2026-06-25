// src/lib/catLevel.js — 貓貓等級系統（公式與射手等級相同）

export const CAT_MAX_LEVEL  = 200;
export const CAT_XP_PER_LEVEL = 20;

export function catLevelFromXP(totalXP) {
  const level = Math.floor((totalXP || 0) / CAT_XP_PER_LEVEL) + 1;
  return Math.min(CAT_MAX_LEVEL, Math.max(1, level));
}

export function catXPProgress(totalXP) {
  const level = catLevelFromXP(totalXP);
  if (level >= CAT_MAX_LEVEL) {
    return { level: CAT_MAX_LEVEL, current: CAT_XP_PER_LEVEL, needed: CAT_XP_PER_LEVEL, pct: 100 };
  }
  const baseXP  = (level - 1) * CAT_XP_PER_LEVEL;
  const current = (totalXP || 0) - baseXP;
  return { level, current, needed: CAT_XP_PER_LEVEL, pct: Math.round(current / CAT_XP_PER_LEVEL * 100) };
}

// 每級加成同射手：hp+5 / atk+1 / def+1
export function catLevelBonus(level) {
  const lv = Math.max(1, Math.min(CAT_MAX_LEVEL, level || 1));
  return { hp: (lv - 1) * 5, atk: lv - 1, def: lv - 1 };
}

// 戰鬥結束後給貓咪的 XP（同 MONSTER_TIER_XP）
export const CAT_TIER_XP = {
  common: 5, rare: 10, elite: 20, fierce: 30, boss: 50, mythic: 80,
};

// 其他模式貓貓 XP
export const CAT_DUEL_WIN_XP      = 30;
export const CAT_DUEL_LOSE_XP     = 10;
export const CAT_DUNGEON_FLOOR_XP = 15;
export const CAT_BOSS_XP          = 80;  // 世界首領（mythic 等級）
export const CAT_PRACTICE_XP      = 2;   // 自主練習每次儲存
