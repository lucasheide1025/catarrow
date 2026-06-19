// src/lib/adventurerSystem.js — 冒險者公會等級系統

// ── 六大階級 ──────────────────────────────────────────────────
export const RANKS = [
  { name: "青銅", icon: "🥉", color: "#b45309", mult: 1.0, gradient: "linear-gradient(135deg,#92400e,#78350f)" },
  { name: "白銀", icon: "🥈", color: "#94a3b8", mult: 1.3, gradient: "linear-gradient(135deg,#475569,#1e293b)" },
  { name: "黃金", icon: "🥇", color: "#fbbf24", mult: 1.6, gradient: "linear-gradient(135deg,#d97706,#92400e)" },
  { name: "白金", icon: "💎", color: "#e2e8f0", mult: 1.9, gradient: "linear-gradient(135deg,#334155,#0f172a)" },
  { name: "傳說", icon: "🔥", color: "#f87171", mult: 2.2, gradient: "linear-gradient(135deg,#991b1b,#7f1d1d)" },
  { name: "神話", icon: "⚡", color: "#a78bfa", mult: 2.5, gradient: "linear-gradient(135deg,#4c1d95,#2e1065)" },
];

// 每個等級所需 XP（依階級）
const XP_PER_LEVEL = [200, 400, 700, 1100, 1600, 2200];

// 到達 level 所需累積 XP（Lv1 = 0 XP）
export function xpToReachLevel(level) {
  let total = 0;
  for (let l = 1; l < Math.min(level, 61); l++) {
    total += XP_PER_LEVEL[Math.min(Math.floor((l - 1) / 10), 5)];
  }
  return total;
}

// 由累積 XP 計算當前等級（1-60）
export function levelFromXP(totalXP) {
  const tx = totalXP || 0;
  for (let lv = 60; lv >= 1; lv--) {
    if (tx >= xpToReachLevel(lv)) return lv;
  }
  return 1;
}

// 由等級取得階級索引（0-5）
export function rankIdxFromLevel(level) {
  return Math.min(Math.floor((level - 1) / 10), 5);
}

// 由等級取得階級物件
export function rankFromLevel(level) {
  return RANKS[rankIdxFromLevel(level)];
}

// 等級在當前階級內的位置（1-10）
export function levelInRank(level) {
  return ((level - 1) % 10) + 1;
}

// 當前等級 XP 進度
export function xpProgress(totalXP, level) {
  if (level >= 60) return { current: 0, needed: 0, pct: 100 };
  const atLevel = xpToReachLevel(level);
  const needed  = XP_PER_LEVEL[rankIdxFromLevel(level)];
  const current = Math.max(0, (totalXP || 0) - atLevel);
  return { current, needed, pct: Math.min(100, Math.round(current / needed * 100)) };
}

// 是否為晉階等級（Lv10/20/30/40/50）
export function isPromotionLevel(level) {
  return [10, 20, 30, 40, 50].includes(level);
}

// ── 靶紙分數按鈕設定 ──────────────────────────────────────────
export const TARGET_ZONES = {
  cthulhu: [
    { label: "12", val: 12, color: "#fbbf24" },
    { label: "11", val: 11, color: "#fbbf24" },
    { label: "10", val: 10, color: "#ef4444" },
    { label: "9",  val: 9,  color: "#ef4444" },
    { label: "8",  val: 8,  color: "#3b82f6" },
    { label: "7",  val: 7,  color: "#3b82f6" },
    { label: "6",  val: 6,  color: "#475569" },
    { label: "M",  val: 0,  color: "#1e293b" },
  ],
  hostage: [
    { label: "20 討伐",  val: 20,  color: "#ef4444" },
    { label: "10",       val: 10,  color: "#3b82f6" },
    { label: "5",        val: 5,   color: "#10b981" },
    { label: "人質 −50", val: -50, color: "#1e293b", penalty: true },
  ],
  zombie: [
    { label: "11 爆頭", val: 11, color: "#fbbf24" },
    { label: "10 頭部", val: 10, color: "#ef4444" },
    { label: "5 身體",  val: 5,  color: "#3b82f6" },
    { label: "2 脫靶",  val: 2,  color: "#475569" },
  ],
};

export const TARGET_NAME = {
  cthulhu: "克蘇魯靶",
  hostage: "人質靶",
  zombie:  "殭屍靶",
};

// ── 原野射箭標準分數按鈕 ────────────────────────────────────────
export const STANDARD_ZONES = [
  { label: "X", val: 10, color: "#fbbf24" },
  { label: "9", val: 9,  color: "#ef4444" },
  { label: "8", val: 8,  color: "#ef4444" },
  { label: "7", val: 7,  color: "#3b82f6" },
  { label: "6", val: 6,  color: "#3b82f6" },
  { label: "5", val: 5,  color: "#475569" },
  { label: "4", val: 4,  color: "#475569" },
  { label: "3", val: 3,  color: "#64748b" },
  { label: "2", val: 2,  color: "#64748b" },
  { label: "1", val: 1,  color: "#94a3b8" },
  { label: "M", val: 0,  color: "#1e293b" },
];

// ── 晉階任務設定（Lv10/20/30/40/50 各一場原野射箭）────────────
export const PROMOTION_QUESTS = {
  10: { level: 10, fromRank: "青銅", toRank: "白銀", dist: 8,  arrowCount: 6, goal: 25, bonusXP: 400  },
  20: { level: 20, fromRank: "白銀", toRank: "黃金", dist: 10, arrowCount: 6, goal: 32, bonusXP: 600  },
  30: { level: 30, fromRank: "黃金", toRank: "白金", dist: 13, arrowCount: 6, goal: 38, bonusXP: 900  },
  40: { level: 40, fromRank: "白金", toRank: "傳說", dist: 15, arrowCount: 6, goal: 42, bonusXP: 1200 },
  50: { level: 50, fromRank: "傳說", toRank: "神話", dist: 18, arrowCount: 6, goal: 48, bonusXP: 1800 },
};

// ── 任務驗收 ──────────────────────────────────────────────────
export function checkTaskPass(task, arrows) {
  const total = arrows.reduce((s, a) => s + a, 0);
  switch (task.type) {
    case "score":          return total >= task.goal;
    case "hits":           return arrows.filter(a => a > 0).length >= task.goal;
    case "protected_score":return total >= task.goal && !arrows.includes(-50);
    case "headshot":       return arrows.filter(a => a >= 10).length >= task.goal;
    case "one_shot":       return arrows[0] === 20;
    default:               return total >= task.goal;
  }
}

// 任務目標描述
export function taskDesc(task) {
  switch (task.type) {
    case "score":          return `總分達 ${task.goal} 分`;
    case "hits":           return `命中 ${task.goal} 箭以上`;
    case "protected_score":return `保護人質，得分達 ${task.goal} 分`;
    case "headshot":       return `爆頭（10/11分區）${task.goal} 箭以上`;
    case "one_shot":       return `一箭討伐（命中 20 分區）`;
    default:               return `達到目標 ${task.goal}`;
  }
}

// ── 每日任務生成（依日期 seed，全員同一批）──────────────────────
function makeSeedRand(seed) {
  let s = ((seed * 1664525) + 1013904223) >>> 0;
  return () => {
    s = ((s * 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function getDailyGuildTasks(date) {
  const seed = parseInt(date.replace(/-/g, ""), 10);
  const rand = makeSeedRand(seed);
  const ri = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

  return [
    // 難度一（一般）
    { id: 0, target: "cthulhu", type: "score",    arrowCount: 6, goal: ri(30, 48), dist: ri(5, 8),  difficulty: 1, label: "克蘇魯・得分",   xp: 50,  coins: 80  },
    { id: 1, target: "cthulhu", type: "hits",     arrowCount: 6, goal: ri(4, 5),   dist: ri(5, 8),  difficulty: 1, label: "克蘇魯・命中",   xp: 50,  coins: 80  },
    { id: 2, target: "zombie",  type: "score",    arrowCount: 6, goal: ri(20, 35), dist: ri(5, 8),  difficulty: 1, label: "殭屍・清場",    xp: 50,  coins: 80  },
    // 難度二（挑戰）
    { id: 3, target: "cthulhu", type: "score",    arrowCount: 6, goal: ri(48, 60), dist: ri(8, 13), difficulty: 2, label: "克蘇魯・中距",   xp: 100, coins: 150 },
    { id: 4, target: "hostage", type: "protected_score", arrowCount: 6, goal: ri(30, 50), dist: ri(7, 12), difficulty: 2, label: "人質・保護作戰", xp: 100, coins: 150 },
    { id: 5, target: "zombie",  type: "headshot", arrowCount: 6, goal: ri(2, 4),   dist: ri(7, 12), difficulty: 2, label: "殭屍・爆頭",    xp: 100, coins: 150 },
    { id: 6, target: "zombie",  type: "score",    arrowCount: 6, goal: ri(35, 50), dist: ri(8, 13), difficulty: 2, label: "殭屍・進階清場", xp: 100, coins: 150 },
    // 難度三（精英）
    { id: 7, target: "hostage", type: "one_shot", arrowCount: 1, goal: 20,         dist: ri(10, 15), difficulty: 3, label: "人質・一箭討伐", xp: 150, coins: 250 },
    { id: 8, target: "cthulhu", type: "score",    arrowCount: 6, goal: ri(60, 72), dist: ri(12, 18), difficulty: 3, label: "克蘇魯・精英",   xp: 150, coins: 250 },
    { id: 9, target: "hostage", type: "protected_score", arrowCount: 6, goal: ri(60, 80), dist: ri(12, 18), difficulty: 3, label: "人質・狙擊手",   xp: 150, coins: 250 },
  ];
}
