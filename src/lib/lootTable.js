// src/lib/lootTable.js
// 掉寶邏輯（依帳號類型 + 難度 + 靶紙模式）

import { drawMaterial } from "./monsterMaterials";

// ── 新手帳號（訪客）掉寶表 ────────────────────────────────
// 所有模式統一，含紀念勳章
export const LOOT_TABLE_GUEST = [
  { id: "badge_memorial", name: "紀念勳章",   icon: "🏅", type: "physical",
    desc: "請向教練領取實體紀念勳章！（只能領一次）", weight: 90 },
  { id: "badge_silver",   name: "成就銀章",   icon: "🥈", type: "badge",
    desc: "恭喜獲得成就銀章！請向教練領取（只能領一次）", weight: 9 },
  { id: "discount_50",    name: "50元折價券", icon: "🎫", type: "physical",
    desc: "折抵50元！拿給教練看即可使用（限用一次）", weight: 1 },
];

// ── 射手帳號掉寶（依模式+難度）────────────────────────────
// 基礎比例（再依難度調整）
// novice + score:  90材料 8銅章 1.9銀章 0.1折價
// novice + zombie: 75材料 23銅章 1.9銀章 0.1折價
// veteran + score: 60材料 38銅章 1.9銀章 0.1折價
// veteran + zombie:50材料 43銅章 6.9銀章 0.1折價

function buildArcherTable(matWeight, bronzeWeight, silverWeight) {
  return [
    { id: "material",       name: "怪物材料",   icon: "🎒", type: "material",  weight: matWeight,   desc: "擊敗怪物掉落的材料！" },
    { id: "badge_bronze",   name: "成就銅章",   icon: "🥉", type: "badge",     weight: bronzeWeight, desc: "恭喜獲得成就銅章！教練會為你登記" },
    { id: "badge_silver",   name: "成就銀章",   icon: "🥈", type: "badge",     weight: silverWeight, desc: "稀有！恭喜獲得成就銀章！教練會為你登記" },
    { id: "discount_50",    name: "50元折價券", icon: "🎫", type: "physical",  weight: 0.1,          desc: "折抵50元！拿給教練看即可使用（限用一次）" },
  ];
}

// 依難度調整材料/銅章比例（hard/boss 銅章更多）
function diffMult(tier) {
  return { easy: 1.0, normal: 1.0, hard: 1.2, boss: 1.5 }[tier] || 1.0;
}

export function getLootTable({ isGuest, mode, battleMode, tier }) {
  if (isGuest) return LOOT_TABLE_GUEST;
  const mult = diffMult(tier);
  if (mode === "novice" && battleMode === "score") {
    return buildArcherTable(90 / mult, 8 * mult, 1.9);
  } else if (mode === "novice" && battleMode === "zombie") {
    return buildArcherTable(75 / mult, 23 * mult, 1.9);
  } else if (mode === "veteran" && battleMode === "score") {
    return buildArcherTable(60 / mult, 38 * mult, 1.9);
  } else {
    // veteran + zombie
    return buildArcherTable(50 / mult, 43 * mult, 6.9);
  }
}

// 依權重隨機抽獎
export function drawLoot(table, monsterId, tier) {
  const totalWeight = table.reduce((s, item) => s + item.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const item of table) {
    rand -= item.weight;
    if (rand <= 0) {
      // 如果抽到材料，再決定是哪種材料
      if (item.id === "material") {
        const mat = drawMaterial(monsterId, tier);
        return { ...item, name: mat.name, icon: mat.icon, desc: `獲得：${mat.name}　${mat.desc}`, materialId: mat.id, rarity: mat.rarity };
      }
      return item;
    }
  }
  return table[table.length - 1];
}

// 稀有掉落判定（觸發全場公告）
export function isRareLoot(loot) {
  if (!loot) return false;
  return loot.id === "discount_50" || loot.id === "badge_silver" ||
    (loot.id === "material" && ["rare","legendary"].includes(loot.rarity));
}
