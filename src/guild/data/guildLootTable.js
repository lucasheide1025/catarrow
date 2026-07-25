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

// 危險度 1~6（＝怪物階級 T1~T6）→ 掉落率/量設定。
// 遞增但不暴衝：高階的價值主要來自「材料階級更高」而不是數字翻倍。
export const LOOT_BY_DANGER = Object.freeze({
  1: { junkChance: 0.50, junkMax: 2, matChance: 0.60, equipChance: 0.10, catCoinBase: 5,   coinBase: 60 },
  2: { junkChance: 0.60, junkMax: 3, matChance: 0.65, equipChance: 0.15, catCoinBase: 10,  coinBase: 110 },
  3: { junkChance: 0.70, junkMax: 3, matChance: 0.70, equipChance: 0.22, catCoinBase: 18,  coinBase: 180 },
  4: { junkChance: 0.80, junkMax: 4, matChance: 0.75, equipChance: 0.30, catCoinBase: 28,  coinBase: 280 },
  5: { junkChance: 0.90, junkMax: 4, matChance: 0.80, equipChance: 0.40, catCoinBase: 42,  coinBase: 420 },
  6: { junkChance: 1.00, junkMax: 5, matChance: 0.88, equipChance: 0.52, catCoinBase: 60,  coinBase: 600 },
});

// 雜貨評估：baseValue → 金幣(70%) + CAT幣(30%/10)。LUK 提升價值倍率。
export function evaluateJunk(junkItem, valuationMult = 1) {
  const val = Math.round((junkItem.baseValue || 0) * valuationMult);
  return { coins: Math.round(val * 0.7), catCoins: Math.max(1, Math.round((val * 0.3) / 10)) };
}
