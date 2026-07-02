// src/lib/villageGoalData.js — 村目標（Village Goal）資料定義

// ── 目標類型 ──────────────────────────────────────────────────
export const GOAL_TYPES = [
  {
    id: "total_arrows",
    icon: "🏹",
    name: "全員累積箭數",
    desc: "全村合力累積射箭數",
    contributionLabel: "箭",
    color: "#60a5fa",
  },
  {
    id: "total_damage",
    icon: "💥",
    name: "全員累積傷害",
    desc: "全村合力累積戰鬥傷害",
    contributionLabel: "傷害",
    color: "#f87171",
  },
  {
    id: "monster_kills",
    icon: "👾",
    name: "全員累積擊殺",
    desc: "全村合力累積怪物擊殺",
    contributionLabel: "擊殺",
    color: "#a78bfa",
  },
];

export const GOAL_TYPE_MAP = Object.fromEntries(GOAL_TYPES.map(g => [g.id, g]));

// ── 目標值（依村莊等級分 4 檔）─────────────────────────────
const TIER_THRESHOLDS = [
  { minLv: 1, label: "村莊發展期" },
  { minLv: 6, label: "村莊繁榮期" },
  { minLv: 11, label: "村莊興盛期" },
  { minLv: 16, label: "村莊輝煌期" },
];

export function getGoalTier(villageLevel) {
  const t = TIER_THRESHOLDS.filter(t => villageLevel >= t.minLv).length - 1;
  return Math.max(0, Math.min(3, t));
}

export function getGoalTarget(villageLevel, goalType) {
  const tier = getGoalTier(villageLevel);
  const targets = {
    total_arrows:  [5000, 15000, 40000, 80000],
    total_damage:  [50000, 150000, 400000, 800000],
    monster_kills: [20, 50, 100, 200],
  };
  const arr = targets[goalType];
  return arr ? arr[tier] : 5000;
}

// ── 完成獎勵（人人有獎，依村莊等級遞增）─────────────────
export function getGoalReward(villageLevel) {
  const tier = getGoalTier(villageLevel);
  return {
    arrowdew:  [200, 500, 1000, 2000][tier],
    coins:     [100, 200, 400, 800][tier],
    gachaToken: [3, 5, 10, 15][tier],
  };
}

// ── 安慰獎（24h 未完成）─────────────────────────────────────
export const CONSOLATION_REWARD = {
  arrowdew: 30,
  coins:    20,
  gachaToken: 1,
};

// ── 目標描述標題產生 ────────────────────────────────────────
export function buildGoalTitle(goalType, targetValue) {
  const meta = GOAL_TYPE_MAP[goalType];
  if (!meta) return "🏡 村目標";
  const label = targetValue >= 10000
    ? (targetValue / 10000).toFixed(targetValue % 10000 === 0 ? 0 : 1) + "萬"
    : targetValue.toLocaleString();
  return `${meta.icon} 村目標：${label} ${meta.contributionLabel}`;
}

export function buildGoalDesc(goalType, targetValue) {
  const meta = GOAL_TYPE_MAP[goalType];
  if (!meta) return "";
  return `全體村民合作累積 ${targetValue.toLocaleString()} ${meta.contributionLabel}！`;
}
