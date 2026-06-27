// src/lib/archerLevel.js — 射手等級系統（每 10 等增加 25 XP 門檻）

export const MAX_ARCHER_LEVEL = 200;

// 每級所需 XP：tier = ceil(level/10)，cost = 50 + (tier-1)*25
// Lv1-10: 50 / Lv11-20: 75 / ... / Lv191-200: 525
export function archerXPForLevel(level) {
  const lv = Math.max(1, Math.min(MAX_ARCHER_LEVEL, level));
  return 50 + (Math.ceil(lv / 10) - 1) * 25;
}

// 預計算累計 XP 表：_CUM[n] = 升到第 n+1 級所需的累計 XP
// _CUM[0] = 0（1 級起點），_CUM[1] = 50（升到 2 級需 50 XP）
const _CUM = (() => {
  const t = [0];
  for (let lv = 1; lv < MAX_ARCHER_LEVEL; lv++) {
    t.push(t[lv - 1] + archerXPForLevel(lv));
  }
  return t;
})();

// 累積 XP → 等級（1–200）
export function archerLevelFromXP(totalXP) {
  const xp = Math.max(0, totalXP || 0);
  let lv = 1;
  for (let i = 1; i < MAX_ARCHER_LEVEL; i++) {
    if (xp >= _CUM[i]) lv = i + 1;
    else break;
  }
  return lv;
}

// 當前等級在本級的 XP 進度
export function archerXPProgress(totalXP) {
  const level = archerLevelFromXP(totalXP);
  if (level >= MAX_ARCHER_LEVEL) {
    const needed = archerXPForLevel(MAX_ARCHER_LEVEL);
    return { level: MAX_ARCHER_LEVEL, current: needed, needed, pct: 100 };
  }
  const baseXP  = _CUM[level - 1];
  const needed  = archerXPForLevel(level);
  const current = (totalXP || 0) - baseXP;
  return { level, current, needed, pct: Math.round(current / needed * 100) };
}

// 升到滿級所需的累計 XP（供 UI 顯示「還差多少到 200 級」）
export const TOTAL_XP_TO_MAX = _CUM[MAX_ARCHER_LEVEL - 1];

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

// 自主練習射手 XP（最低速率）
export const PRACTICE_ARCHER_XP_PER_ARROW = 1;
