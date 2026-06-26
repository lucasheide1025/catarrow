// src/lib/expeditionData.js — 遠征隊任務定義與獎勵計算

export const EXPEDITION_MISSIONS = [
  {
    tier: 1,
    label: "探索之旅",
    emoji: "🌿",
    hours: 8,
    desc: "周邊林地採集，8小時輕鬆回來。",
    archerCost: { archer_t1: 50 },
    baseRewards: [
      { resource: "fur",    tier: 1, min: 2, max: 4 },
      { resource: "potion", tier: 1, min: 1, max: 2 },
    ],
    bonusChance: { arrowdew: 0, gachaToken: 0 },
  },
  {
    tier: 2,
    label: "採集遠征",
    emoji: "🏕️",
    hours: 16,
    desc: "深入山區採集，16小時中等難度。",
    archerCost: { archer_t1: 50, archer_t2: 30 },
    baseRewards: [
      { resource: "fur",    tier: 1, min: 2, max: 3 },
      { resource: "fur",    tier: 2, min: 1, max: 3 },
      { resource: "potion", tier: 1, min: 1, max: 2 },
      { resource: "potion", tier: 2, min: 1, max: 2 },
    ],
    bonusChance: { arrowdew: 0, gachaToken: 0 },
  },
  {
    tier: 3,
    label: "深林探索",
    emoji: "🌲",
    hours: 24,
    desc: "進入神秘深林，需要一整天。",
    archerCost: { archer_t1: 50, archer_t2: 30, archer_t3: 20 },
    baseRewards: [
      { resource: "fur",    tier: 2, min: 2, max: 4 },
      { resource: "fur",    tier: 3, min: 1, max: 3 },
      { resource: "potion", tier: 2, min: 2, max: 3 },
      { resource: "potion", tier: 3, min: 1, max: 2 },
    ],
    bonusChance: { arrowdew: 0.5, gachaToken: 0 },
    bonusAmount: { arrowdew: [10, 30] },
  },
  {
    tier: 4,
    label: "秘境遠征",
    emoji: "🏔️",
    hours: 48,
    desc: "挑戰險峻秘境，兩天的艱困旅途。",
    archerCost: { archer_t2: 50, archer_t3: 30, archer_t4: 20 },
    baseRewards: [
      { resource: "fur",    tier: 3, min: 3, max: 5 },
      { resource: "fur",    tier: 4, min: 1, max: 3 },
      { resource: "potion", tier: 3, min: 2, max: 4 },
      { resource: "potion", tier: 4, min: 1, max: 2 },
    ],
    bonusChance: { arrowdew: 1.0, gachaToken: 0.1 },
    bonusAmount: { arrowdew: [20, 50], gachaToken: [1, 1] },
  },
  {
    tier: 5,
    label: "傳說遠征",
    emoji: "⚡",
    hours: 72,
    desc: "三天三夜的傳說級任務，高風險高回報。",
    archerCost: { archer_t3: 50, archer_t4: 30, archer_t5: 20 },
    baseRewards: [
      { resource: "fur",    tier: 4, min: 2, max: 4 },
      { resource: "fur",    tier: 5, min: 1, max: 3 },
      { resource: "potion", tier: 4, min: 2, max: 3 },
      { resource: "potion", tier: 5, min: 1, max: 2 },
    ],
    bonusChance: { arrowdew: 1.0, gachaToken: 0.3 },
    bonusAmount: { arrowdew: [30, 80], gachaToken: [1, 2] },
  },
];

// 貓咪等級加成倍率：Lv1=1.0x → Lv100=2.0x → Lv200=3.0x
export function catLevelMult(catLevel) {
  return 1 + Math.min(2, (catLevel - 1) / 100);
}

// 計算遠征獎勵（客戶端隨機，結果傳給 db 存入）
export function calcExpeditionRewards(missionTier, catLevel) {
  const mission = EXPEDITION_MISSIONS.find(m => m.tier === missionTier);
  if (!mission) return {};
  const mult = catLevelMult(catLevel);
  const rewards = {};

  for (const r of mission.baseRewards) {
    const raw = r.min + Math.random() * (r.max - r.min + 1);
    const count = Math.max(1, Math.round(raw * mult));
    const key = `${r.resource}_t${r.tier}`;
    rewards[key] = (rewards[key] || 0) + count;
  }

  // 額外稀有獎勵
  const { bonusChance = {}, bonusAmount = {} } = mission;
  if (bonusChance.arrowdew && Math.random() < bonusChance.arrowdew) {
    const [min, max] = bonusAmount.arrowdew;
    rewards.arrowdew = Math.round((min + Math.random() * (max - min)) * mult);
  }
  if (bonusChance.gachaToken && Math.random() < bonusChance.gachaToken) {
    const [min, max] = bonusAmount.gachaToken;
    rewards.gachaToken = min + Math.floor(Math.random() * (max - min + 1));
  }

  return rewards;
}

// 格式化剩餘時間
export function fmtCountdown(msLeft) {
  if (msLeft <= 0) return "已完成！";
  const h = Math.floor(msLeft / 3600000);
  const m = Math.floor((msLeft % 3600000) / 60000);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const hr = h % 24;
    return `${d}天 ${hr}小時`;
  }
  return `${h}小時 ${m}分`;
}
