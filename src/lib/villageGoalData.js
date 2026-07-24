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
  {
    id: "gathering_progress",
    icon: "🏹",
    name: "採集總進度",
    desc: "全村累積貓村採集進度",
    contributionLabel: "%",
    color: "#22c55e",
  },
  {
    id: "gathering_participants",
    icon: "🐾",
    name: "採集參與人次",
    desc: "全村一起完成採集委託",
    contributionLabel: "人次",
    color: "#f97316",
  },
  {
    id: "gathering_material",
    icon: "🧩",
    name: "採集指定怪物素材",
    desc: "透過採集取得指定怪物素材",
    contributionLabel: "個",
    color: "#38bdf8",
  },
  {
    id: "gathering_resource",
    icon: "📦",
    name: "採集指定村資源",
    desc: "透過採集取得指定貓村資源",
    contributionLabel: "個",
    color: "#facc15",
  },
  {
    id: "board_laps",
    icon: "🎲",
    name: "探索地圖繞圈",
    desc: "全村在大富翁探索地圖累積繞圈數",
    contributionLabel: "圈",
    color: "#fb923c",
  },
];

export const GOAL_TYPE_MAP = Object.fromEntries(GOAL_TYPES.map(g => [g.id, g]));

export const GATHERING_GOAL_MATERIALS = [
  { id: "mountain_m1", label: "山岳族 T1素材" },
  { id: "mountain_m2", label: "山岳族 T2素材" },
  { id: "insect_m1", label: "昆蟲族 T1素材" },
  { id: "insect_m2", label: "昆蟲族 T2素材" },
  { id: "ghost_m1", label: "幽靈族 T1素材" },
  { id: "ghost_m2", label: "幽靈族 T2素材" },
  { id: "workplace_m1", label: "職場族 T1素材" },
  { id: "exam_m1", label: "考試族 T1素材" },
  { id: "temple_m1", label: "神殿族 T1素材" },
];

export const GATHERING_GOAL_RESOURCES = [
  { key: "ore_t1", label: "礦石 T1" },
  { key: "melon_t1", label: "瓜果 T1" },
  { key: "fish_t1", label: "鮮魚 T1" },
  { key: "meat_t1", label: "獸肉 T1" },
  { key: "driedfish_t1", label: "小魚乾 T1" },
  { key: "can_t1", label: "罐頭 T1" },
  { key: "fur_t1", label: "陪練貓毛 T1" },
  { key: "potion_t1", label: "貓草藥水材料 T1" },
];

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
    gathering_progress: [1500, 4000, 9000, 18000],
    gathering_participants: [20, 45, 90, 160],
    gathering_material: [80, 180, 360, 720],
    gathering_resource: [60, 140, 280, 560],
    board_laps: [30, 70, 150, 300],
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
