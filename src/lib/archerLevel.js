// src/lib/archerLevel.js — 射手等級系統（每 10 等增加 25 XP 門檻）

export const MAX_ARCHER_LEVEL = 500;

// 每級所需 XP：tier = ceil(level/10)，cost = 50 + (tier-1)*25
export function archerXPForLevel(level) {
  const lv = Math.max(1, Math.min(MAX_ARCHER_LEVEL, level));
  return 50 + (Math.ceil(lv / 10) - 1) * 25;
}

// 預計算累計 XP 表：_CUM[n] = 升到第 n+1 級所需的累計 XP
const _CUM = (() => {
  const t = [0];
  for (let lv = 1; lv < MAX_ARCHER_LEVEL; lv++) {
    t.push(t[lv - 1] + archerXPForLevel(lv));
  }
  return t;
})();

// 累積 XP → 等級（1–500）
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

// 升到滿級所需的累計 XP（供 UI 顯示「還差多少到 500 級」）
export const TOTAL_XP_TO_MAX = _CUM[MAX_ARCHER_LEVEL - 1];

// 等級加成 { hp, atk, def }（每 1 級 +5 HP，每 5 級 +1 ATK/+1 DEF）
export function archerLevelBonus(level) {
  const lv = Math.max(1, Math.min(MAX_ARCHER_LEVEL, level || 1));
  return { hp: (lv - 1) * 5, atk: Math.floor(lv / 5), def: Math.floor(lv / 5) };
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

// ── 等級外觀樣式定義 (1 ~ 500) ──────────────────────────────
export function getLevelStyle(level) {
  const lv = Number(level) || 1;
  if (lv < 100) {
    return {
      background: "linear-gradient(135deg, #9ca3af, #6b7280)",
      color: "#ffffff",
      border: "1px solid rgba(255,255,255,0.2)",
      textShadow: "none",
      boxShadow: "none",
    };
  }
  if (lv < 200) {
    return {
      background: "linear-gradient(135deg, #2dd4bf, #0f766e)",
      color: "#ffffff",
      border: "1.5px solid #2dd4bf",
      textShadow: "0 1px 2px rgba(0,0,0,0.3)",
      boxShadow: "0 0 6px rgba(45, 212, 191, 0.3)",
    };
  }
  if (lv < 300) {
    return {
      background: "linear-gradient(135deg, #fbbf24, #b45309)",
      color: "#ffffff",
      border: "1.5px solid #fbbf24",
      boxShadow: "0 0 8px rgba(251, 191, 36, 0.4)",
      textShadow: "0 1px 2px rgba(0,0,0,0.3)",
    };
  }
  if (lv < 400) {
    return {
      background: "linear-gradient(135deg, #c084fc, #6b21a8)",
      color: "#ffffff",
      border: "1.5px solid #c084fc",
      boxShadow: "0 0 10px rgba(192, 132, 252, 0.5)",
      textShadow: "0 1px 2px rgba(0,0,0,0.3)",
    };
  }
  return {
    background: "linear-gradient(135deg, #f87171, #991b1b)",
    color: "#ffffff",
    border: "2px solid #ef4444",
    boxShadow: "0 0 15px rgba(239, 68, 68, 0.7)",
    textShadow: "0 1px 3px rgba(0,0,0,0.4)",
    animation: "levelPulse 1.5s infinite alternate",
  };
}
