// src/lib/lootTable.js
// 掉寶邏輯 v2：材料（機率）+ 金幣（固定）+ 怪物卡片（1%）

import { drawMaterial } from "./monsterMaterials";

// ── 訪客掉寶表（第一次勝利：紀念獎勵）────────────────────
export const LOOT_TABLE_GUEST = [
  { id: "badge_memorial", name: "紀念勳章",   icon: "🏅", type: "physical",
    desc: "請向教練領取實體紀念勳章！（只能領一次）", weight: 90 },
  { id: "badge_silver",   name: "成就銀章",   icon: "🥈", type: "badge",
    desc: "恭喜獲得成就銀章！請向教練領取（只能領一次）", weight: 9 },
  { id: "discount_50",    name: "50元折價券", icon: "🎫", type: "physical",
    desc: "折抵50元！拿給教練看即可使用（限用一次）", weight: 1 },
];

// ── 金幣掉落範圍（依怪物階級）────────────────────────────
const COIN_RANGE = {
  common:  { min: 3,  max: 8   },
  rare:    { min: 6,  max: 15  },
  elite:   { min: 12, max: 25  },
  fierce:  { min: 20, max: 40  },
  boss:    { min: 35, max: 65  },
  mythic:  { min: 60, max: 100 },
};

// 模式倍率
const MODE_COIN_MULT = { novice: 1.0, student: 1.5, veteran: 2.0 };

// ── 材料掉落機率（依怪物階級）────────────────────────────
const MATERIAL_CHANCE = {
  common: 0.40, rare: 0.50, elite: 0.60,
  fierce: 0.70, boss: 0.75, mythic: 0.80,
};

// ── 怪物卡片掉落（統一 1%）──────────────────────────────
const CARD_CHANCE = 0.01;

// ─────────────────────────────────────────────────────────

// 金幣獎勵（勝利必掉）
export function rollCoins(tier, mode) {
  const range = COIN_RANGE[tier] || COIN_RANGE.common;
  const mult  = MODE_COIN_MULT[mode] || 1.0;
  const raw   = range.min + Math.floor(Math.random() * (range.max - range.min + 1));
  return Math.round(raw * mult);
}

// 材料掉落（機率，回傳材料物件或 null）
export function rollMaterialDrop(monster) {
  const chance = MATERIAL_CHANCE[monster?.tier] || 0.40;
  if (Math.random() > chance) return null;
  return drawMaterial(monster.id, monster.tier) || null;
}

// 怪物卡片掉落（1%，回傳卡片基本資訊或 null）
export function rollCardDrop(monster) {
  if (Math.random() > CARD_CHANCE) return null;
  return {
    monsterId: monster.id,
    name:      monster.name,
    icon:      monster.icon,
    tier:      monster.tier,
    family:    monster.family,
  };
}

// ── 以下供訪客模式使用（drawLoot 從 LOOT_TABLE_GUEST 抽）──
export function drawLoot(table, monsterId, tier) {
  const total = table.reduce((s, item) => s + item.weight, 0);
  let rand = Math.random() * total;
  for (const item of table) {
    rand -= item.weight;
    if (rand <= 0) return item;
  }
  return table[table.length - 1];
}

export function isRareLoot(loot) {
  if (!loot) return false;
  return loot.id === "discount_50" || loot.id === "badge_silver";
}
