// src/lib/expeditionData.js — 遠征隊任務定義與獎勵計算
import { calcCatCombatStats } from "./catCombat";

// 計算貓咪完整戰力（同 useCatCompanion 邏輯，純函式版）
export function calcCatFullStats(catData = {}) {
  return calcCatCombatStats(catData);
}

// 遠征獎勵倍率：Lv1全能 ATK≈10→1.0x；Lv100 ATK≈109→2.0x；Lv200 ATK≈209→3.0x
// 類型、裝備、羈絆讓 ATK 更高，自然得到更高倍率
export function catPowerMult(catATK) {
  return Math.min(3.0, Math.max(1.0, 1 + (catATK - 10) / 100));
}

export const EXPEDITION_MISSIONS = [
  {
    tier: 1,
    label: "探索之旅",
    emoji: "🌿",
    image: "/ui/village/expedition/mission-t1.webp",
    hours: 8,
    desc: "周邊林地採集，8小時輕鬆回來。",
    archerCost: { archer_t1: 50 },
    baseRewards: [
      { resource: "fur",   tier: 1, min: 2, max: 4 },
      { resource: "potion",tier: 1, min: 1, max: 2 },
      { resource: "ore",   tier: 1, min: 1, max: 3 },
      { resource: "melon", tier: 1, min: 1, max: 2 },
    ],
    bonusChance: { arrowdew: 0.3, gachaToken: 0.3 },
    bonusAmount: { arrowdew: [5, 10], gachaToken: [1, 1] },
  },
  {
    tier: 2,
    label: "採集遠征",
    emoji: "🏕️",
    image: "/ui/village/expedition/mission-t2.webp",
    hours: 16,
    desc: "深入山區採集，16小時中等難度。",
    archerCost: { archer_t1: 50, archer_t2: 30 },
    baseRewards: [
      { resource: "fur",   tier: 1, min: 2, max: 3 },
      { resource: "fur",   tier: 2, min: 1, max: 3 },
      { resource: "potion",tier: 1, min: 1, max: 2 },
      { resource: "potion",tier: 2, min: 1, max: 2 },
      { resource: "ore",   tier: 1, min: 2, max: 4 },
      { resource: "melon", tier: 1, min: 1, max: 3 },
      { resource: "ore",   tier: 2, min: 1, max: 2 },
    ],
    bonusChance: { arrowdew: 0.3, gachaToken: 0.3 },
    bonusAmount: { arrowdew: [5, 15], gachaToken: [1, 2] },
  },
  {
    tier: 3,
    label: "深林探索",
    emoji: "🌲",
    image: "/ui/village/expedition/mission-t3.webp",
    hours: 24,
    desc: "進入神秘深林，需要一整天。",
    archerCost: { archer_t1: 50, archer_t2: 30, archer_t3: 20 },
    baseRewards: [
      { resource: "fur",   tier: 2, min: 2, max: 4 },
      { resource: "fur",   tier: 3, min: 1, max: 3 },
      { resource: "potion",tier: 2, min: 2, max: 3 },
      { resource: "potion",tier: 3, min: 1, max: 2 },
      { resource: "ore",   tier: 2, min: 2, max: 3 },
      { resource: "fish",  tier: 1, min: 1, max: 3 },
      { resource: "meat",  tier: 1, min: 1, max: 2 },
    ],
    bonusChance: { arrowdew: 0.3, gachaToken: 0.3 },
    bonusAmount: { arrowdew: [10, 30], gachaToken: [1, 3] },
  },
  {
    tier: 4,
    label: "秘境遠征",
    emoji: "🏔️",
    image: "/ui/village/expedition/mission-t4.webp",
    hours: 48,
    desc: "挑戰險峻秘境，兩天的艱困旅途。",
    archerCost: { archer_t2: 50, archer_t3: 30, archer_t4: 20 },
    baseRewards: [
      { resource: "fur",      tier: 3, min: 3, max: 5 },
      { resource: "fur",      tier: 4, min: 1, max: 3 },
      { resource: "potion",   tier: 3, min: 2, max: 4 },
      { resource: "potion",   tier: 4, min: 1, max: 2 },
      { resource: "fish",     tier: 2, min: 1, max: 3 },
      { resource: "meat",     tier: 2, min: 1, max: 3 },
      { resource: "driedfish",tier: 1, min: 1, max: 2 },
    ],
    bonusChance: { arrowdew: 0.3, gachaToken: 0.3 },
    bonusAmount: { arrowdew: [15, 50], gachaToken: [1, 4] },
  },
  {
    tier: 5,
    label: "傳說遠征",
    emoji: "⚡",
    image: "/ui/village/expedition/mission-t5.webp",
    hours: 72,
    desc: "三天三夜的傳說級任務，高風險高回報。",
    archerCost: { archer_t3: 50, archer_t4: 30, archer_t5: 20 },
    baseRewards: [
      { resource: "fur",      tier: 4, min: 2, max: 4 },
      { resource: "fur",      tier: 5, min: 1, max: 3 },
      { resource: "potion",   tier: 4, min: 2, max: 3 },
      { resource: "potion",   tier: 5, min: 1, max: 2 },
      { resource: "fish",     tier: 3, min: 1, max: 3 },
      { resource: "meat",     tier: 3, min: 1, max: 3 },
      { resource: "driedfish",tier: 2, min: 1, max: 2 },
      { resource: "can",      tier: 1, min: 1, max: 2 },
    ],
    bonusChance: { arrowdew: 0.3, gachaToken: 0.3 },
    bonusAmount: { arrowdew: [25, 75], gachaToken: [1, 5] },
  },
];

// 計算遠征獎勵（客戶端隨機，結果傳給 db 存入）
// catData: subscribeMyCats 回傳的貓咪物件（含 catXP/type/bond/equip）
export function calcExpeditionRewards(missionTier, catData) {
  const mission = EXPEDITION_MISSIONS.find(m => m.tier === missionTier);
  if (!mission) return {};
  const { catATK } = calcCatFullStats(catData);
  const mult = catPowerMult(catATK);
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
