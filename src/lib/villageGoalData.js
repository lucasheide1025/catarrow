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
    id: "exploration_completions",
    icon: "🗺️",
    name: "完成貓咪探險地圖",
    desc: "全村一起完成指定次數的貓咪探險地圖",
    contributionLabel: "次",
    color: "#fb923c",
  },
];

export const GOAL_TYPE_MAP = Object.fromEntries(GOAL_TYPES.map(g => [g.id, g]));
GOAL_TYPE_MAP.board_laps = GOAL_TYPE_MAP.exploration_completions;

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
  { key: "potion_t1", label: "貓薄荷藥水 T1" },
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
  // ⚠️ **階級 2/3 於 2026-08-03 下修**（作者：「2 跟 3 的總數需求有點高了」）。
  //    舊值每階 ×2.7 一路翻上去，tier3 是 tier1 的 5.3 倍——
  //    以一間道館的規模，一個月射 80,000 箭等於每天 2,667 箭，打不到。
  //    現在收斂成每階約 ×1.6，tier3 約 tier1 的 2.5 倍。
  //    ⚠️ tier0/tier1 **刻意不動**，作者只反映高階偏高。
  //    ⚠️ 獎勵沒有跟著下修——高階村莊人多，門檻降低＝更容易拿到，這是有意的。
  const targets = {
    total_arrows:  [5000, 15000, 25000, 38000],
    total_damage:  [50000, 150000, 250000, 380000],
    monster_kills: [40, 100, 160, 240],
    gathering_progress: [1500, 4000, 6500, 10000],
    gathering_participants: [20, 45, 70, 100],
    gathering_material: [80, 180, 280, 400],
    gathering_resource: [60, 140, 220, 320],
    exploration_completions: [30, 70, 105, 150],
    board_laps: [30, 70, 105, 150],
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

// ── 安慰獎（時間到還沒完成）──────────────────────────────────
// ⚠️ 期限**不再是固定 24h**（2026-08-03）：自然刷出的目標依村莊階級給
//    3~6 天，且教練可在後台調整。見 villageGoalSchedule.js。
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
  return `${meta.icon} ${meta.name}：${label} ${meta.contributionLabel}`;
}

export function buildGoalDesc(goalType, targetValue) {
  const meta = GOAL_TYPE_MAP[goalType];
  if (!meta) return "";
  return `全體村民合作累積 ${targetValue.toLocaleString()} ${meta.contributionLabel}！`;
}

export function resolveGoalDisplay(goal = {}) {
  const canonicalType = goal.goalType === "board_laps" ? "exploration_completions" : goal.goalType;
  const meta = GOAL_TYPE_MAP[canonicalType] || GOAL_TYPE_MAP[goal.goalType];
  const target = Number(goal.targetValue || 0);
  return {
    goalType: canonicalType,
    meta,
    title: goal.customTitle || goal.title || buildGoalTitle(canonicalType, target),
    description: goal.customDescription || goal.description || buildGoalDesc(canonicalType, target),
  };
}
