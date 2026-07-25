// src/guild/data/guildLootTable.js
// 冒險者公會「獨立戰利品設定」——與主線 lootTable 分開（掉落不混）。
// 掉三類：①通用材料(打怪/貓村可用) ②公會雜貨(帶回評估→金幣+CAT幣) ③公會專屬裝備。

// 公會專屬雜貨（收藏品）：撿到帶回公會評估價值 → 金幣 + CAT幣
export const GUILD_JUNK = Object.freeze([
  { id: "rusty_gear",       name: "生鏽齒輪", icon: "⚙️", baseValue: 20 },
  { id: "old_map_scrap",    name: "殘破地圖", icon: "🗺️", baseValue: 35 },
  { id: "monster_fang",     name: "怪物獠牙", icon: "🦷", baseValue: 50 },
  { id: "ancient_coin",     name: "古代錢幣", icon: "🪙", baseValue: 80 },
  { id: "gemstone_shard",   name: "寶石碎片", icon: "💎", baseValue: 120 },
  { id: "mysterious_relic", name: "神秘遺物", icon: "🏺", baseValue: 200 },
]);

// 危險度 → 掉落率/量設定
export const LOOT_BY_DANGER = Object.freeze({
  1: { junkChance: 0.5, junkMax: 2, matChance: 0.6, equipChance: 0.10, catCoinBase: 5,  coinBase: 60 },
  2: { junkChance: 0.7, junkMax: 3, matChance: 0.7, equipChance: 0.18, catCoinBase: 12, coinBase: 120 },
  3: { junkChance: 0.9, junkMax: 4, matChance: 0.8, equipChance: 0.30, catCoinBase: 25, coinBase: 220 },
});

// 雜貨評估：baseValue → 金幣(70%) + CAT幣(30%/10)。LUK 提升價值倍率。
export function evaluateJunk(junkItem, valuationMult = 1) {
  const val = Math.round((junkItem.baseValue || 0) * valuationMult);
  return { coins: Math.round(val * 0.7), catCoins: Math.max(1, Math.round((val * 0.3) / 10)) };
}
