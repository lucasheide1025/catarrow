// src/lib/lootTable.js
// 打怪掉寶邏輯

// 新手模式掉寶表
export const LOOT_TABLE_NOVICE = [
  { id: "badge_memorial", name: "紀念徽章",   icon: "🏅", type: "physical", desc: "請向教練領取實體紀念徽章！",        weight: 90  },
  { id: "badge_silver",   name: "成就銀章",   icon: "🥈", type: "badge",    desc: "恭喜獲得成就銀章！教練會為你登記", weight: 9   },
  { id: "discount_9",     name: "本日9折券",  icon: "🎫", type: "physical", desc: "本日射箭費用9折，現場向教練抵免！", weight: 1   },
];

// 學生/老手模式掉寶表（之後擴充）
export const LOOT_TABLE_VETERAN = [
  { id: "badge_memorial", name: "紀念徽章",   icon: "🏅", type: "physical", desc: "請向教練領取實體紀念徽章！",        weight: 60  },
  { id: "badge_silver",   name: "成就銀章",   icon: "🥈", type: "badge",    desc: "恭喜獲得成就銀章！教練會為你登記", weight: 25  },
  { id: "badge_fatcat",   name: "肥貓銅章",   icon: "🐱", type: "badge",    desc: "恭喜獲得肥貓銅章！教練會為你登記", weight: 10  },
  { id: "discount_9",     name: "本日9折券",  icon: "🎫", type: "physical", desc: "本日射箭費用9折，現場向教練抵免！", weight: 4   },
  { id: "discount_5",     name: "本日5折券",  icon: "🎟️", type: "physical", desc: "本日射箭費用5折！現場向教練抵免！", weight: 1   },
];

// 依權重隨機抽獎
export function drawLoot(table) {
  const totalWeight = table.reduce((s, item) => s + item.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const item of table) {
    rand -= item.weight;
    if (rand <= 0) return item;
  }
  return table[table.length - 1];
}

// 稀有度判定（用於公告）
export function isRareLoot(loot) {
  return loot.id === "discount_9" || loot.id === "discount_5" || loot.id === "badge_silver";
}
