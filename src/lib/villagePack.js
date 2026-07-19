// src/lib/villagePack.js — 貓貓村建築包（T1~T4）
//
// 2026-07-19 使用者規格：練箭里程碑新增「建築包」獎勵，開啟後隨機獲得對應等級的
// 貓貓村材料。九種材料就是 villageData.RESOURCE_NAMES 裡的可產出資源。
//
// 曲線由實作端決定，設計原則：
//   ① 逐階明顯放大（T1 → T4 大約每階 2.5~3 倍），讓後段里程碑值得撐下去
//   ② 分層解鎖：T1 只有基礎材料，T2 起加入中階，**貓貓射手只在 T4 出現**
//      —— archer 是練箭場產物、最稀缺，保留給最後一個里程碑段才有驚喜感
//   ③ 每包抽「幾種」而不是固定給滿，開起來才有隨機性
//
// ⚠️ 這裡只負責 roll 出內容；實際入帳（village.resources.*）由 db.js 負責。

// 基礎四種：礦物／瓜瓜／鮮魚／動物肉
const BASE_MATERIALS = Object.freeze(["ore", "melon", "fish", "meat"]);
// 中階四種：小魚乾／貓罐頭／貓薄荷藥水／貓毛
const MID_MATERIALS = Object.freeze(["driedfish", "can", "potion", "fur"]);
// 高階：貓貓射手（只有 T4 給）
const TOP_MATERIAL = "archer";

// pick: 從池中抽 count 種；range: 每種的數量區間
export const VILLAGE_PACKS = Object.freeze({
  1: {
    id: "village_pack_t1", tier: 1, name: "T1 建築包", icon: "🧱",
    desc: "開啟後隨機獲得基礎建材",
    rolls: [{ pool: BASE_MATERIALS, pick: 2, min: 2,  max: 5  }],
  },
  2: {
    id: "village_pack_t2", tier: 2, name: "T2 建築包", icon: "🧰",
    desc: "開啟後隨機獲得基礎與加工建材",
    rolls: [
      { pool: BASE_MATERIALS, pick: 2, min: 5,  max: 10 },
      { pool: MID_MATERIALS,  pick: 1, min: 2,  max: 4  },
    ],
  },
  3: {
    id: "village_pack_t3", tier: 3, name: "T3 建築包", icon: "🏗️",
    desc: "開啟後隨機獲得大量建材",
    rolls: [
      { pool: BASE_MATERIALS, pick: 2, min: 12, max: 20 },
      { pool: MID_MATERIALS,  pick: 2, min: 5,  max: 10 },
    ],
  },
  4: {
    id: "village_pack_t4", tier: 4, name: "T4 建築包", icon: "🏛️",
    desc: "開啟後隨機獲得頂級建材，可能含貓貓射手",
    rolls: [
      { pool: BASE_MATERIALS,  pick: 2, min: 25, max: 40 },
      { pool: MID_MATERIALS,   pick: 2, min: 12, max: 20 },
      { pool: [TOP_MATERIAL],  pick: 1, min: 1,  max: 2  },
    ],
  },
});

export const VILLAGE_PACK_TIERS = Object.freeze([1, 2, 3, 4]);

export function getVillagePack(tier) {
  return VILLAGE_PACKS[Math.max(1, Math.min(4, Math.floor(Number(tier) || 1)))];
}

// 從池中不重複抽 count 種
function pickDistinct(pool, count, random) {
  const remaining = [...pool];
  const picked = [];
  const total = Math.min(count, remaining.length);
  for (let index = 0; index < total; index += 1) {
    const at = Math.min(remaining.length - 1, Math.floor(random() * remaining.length));
    picked.push(remaining.splice(at, 1)[0]);
  }
  return picked;
}

/**
 * 開一個建築包，回傳 { [resourceKey]: count }。
 * 同一種材料被不同 roll 抽中時數量會累加。
 */
export function openVillagePack(tier, { random = Math.random } = {}) {
  const pack = getVillagePack(tier);
  const result = {};
  for (const roll of pack.rolls) {
    for (const key of pickDistinct(roll.pool, roll.pick, random)) {
      const amount = roll.min + Math.floor(random() * (roll.max - roll.min + 1));
      result[key] = (result[key] || 0) + amount;
    }
  }
  return result;
}

/**
 * 一次開多包並合併（里程碑一次給 5 包時用）。
 */
export function openVillagePacks(tier, count = 1, { random = Math.random } = {}) {
  const merged = {};
  for (let index = 0; index < Math.max(1, count); index += 1) {
    for (const [key, amount] of Object.entries(openVillagePack(tier, { random }))) {
      merged[key] = (merged[key] || 0) + amount;
    }
  }
  return merged;
}
