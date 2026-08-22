"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CAT_TIER_XP = exports.CAT_PRACTICE_XP = exports.CAT_MAX_LEVEL = exports.CAT_DUNGEON_FLOOR_XP = exports.CAT_DUEL_WIN_XP = exports.CAT_DUEL_LOSE_XP = exports.CAT_BOSS_XP = void 0;
exports.catLevelBonus = catLevelBonus;
exports.catLevelFromXP = catLevelFromXP;
exports.catXPForLevel = catXPForLevel;
exports.catXPProgress = catXPProgress;
// src/lib/catLevel.js — 貓貓等級系統（每 10 等增加 25 XP 門檻，與射手等級同規則）

const CAT_MAX_LEVEL = exports.CAT_MAX_LEVEL = 500;

// 每級所需 XP：tier = ceil(level/10)，cost = 50 + (tier-1)*25
function catXPForLevel(level) {
  const lv = Math.max(1, Math.min(CAT_MAX_LEVEL, level));
  return 50 + (Math.ceil(lv / 10) - 1) * 25;
}

// 預計算累計 XP 表
const _CUM = (() => {
  const t = [0];
  for (let lv = 1; lv < CAT_MAX_LEVEL; lv++) {
    t.push(t[lv - 1] + catXPForLevel(lv));
  }
  return t;
})();
function catLevelFromXP(totalXP) {
  const xp = Math.max(0, totalXP || 0);
  let lv = 1;
  for (let i = 1; i < CAT_MAX_LEVEL; i++) {
    if (xp >= _CUM[i]) lv = i + 1;else break;
  }
  return lv;
}
function catXPProgress(totalXP) {
  const level = catLevelFromXP(totalXP);
  if (level >= CAT_MAX_LEVEL) {
    const needed = catXPForLevel(CAT_MAX_LEVEL);
    return {
      level: CAT_MAX_LEVEL,
      current: needed,
      needed,
      pct: 100
    };
  }
  const baseXP = _CUM[level - 1];
  const needed = catXPForLevel(level);
  const current = (totalXP || 0) - baseXP;
  return {
    level,
    current,
    needed,
    pct: Math.round(current / needed * 100)
  };
}

// 每級加成同射手：每 1 級 +5 HP，每 5 級 +1 ATK/+1 DEF
function catLevelBonus(level) {
  const lv = Math.max(1, Math.min(CAT_MAX_LEVEL, level || 1));
  return {
    hp: (lv - 1) * 5,
    atk: Math.floor(lv / 5),
    def: Math.floor(lv / 5)
  };
}

// 戰鬥結束後給貓咪的 XP（同 MONSTER_TIER_XP）
const CAT_TIER_XP = exports.CAT_TIER_XP = {
  common: 5,
  rare: 10,
  elite: 20,
  fierce: 30,
  boss: 50,
  mythic: 80
};

// 其他模式貓貓 XP
const CAT_DUEL_WIN_XP = exports.CAT_DUEL_WIN_XP = 30;
const CAT_DUEL_LOSE_XP = exports.CAT_DUEL_LOSE_XP = 10;
const CAT_DUNGEON_FLOOR_XP = exports.CAT_DUNGEON_FLOOR_XP = 15;
const CAT_BOSS_XP = exports.CAT_BOSS_XP = 80; // 世界首領（mythic 等級）
const CAT_PRACTICE_XP = exports.CAT_PRACTICE_XP = 2; // 自主練習每次儲存
