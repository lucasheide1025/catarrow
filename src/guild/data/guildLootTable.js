// src/guild/data/guildLootTable.js
// 冒險者公會「獨立戰利品設定」——與主線 lootTable 分開（掉落不混）。
// 掉三類：①擴充材料（跟主線打怪同一份，量 2~3 倍）②公會雜貨（進倉庫，玩家自己決定何時賣）③公會專屬裝備。

// 雜貨圖鑑已搬到 `guildJunkCatalog.js`（72 種、分稀有度、分族群）。
// 這裡 re-export 只為了不動舊的 import 路徑。
export { GUILD_JUNK, JUNK_RARITY, JUNK_BY_ID, junkPoolFor, drawJunk, evaluateJunk } from "./guildJunkCatalog";

// 危險度 1~6（＝怪物階級 T1~T6）→ 掉落率/量設定。
// 遞增但不暴衝：高階的價值主要來自「材料階級更高」而不是數字翻倍。
// matChance 命中後每隻怪掉 2~3 個擴充材料（見 settleExpedition.MAT_PER_MONSTER）。
export const LOOT_BY_DANGER = Object.freeze({
  1: { junkChance: 0.50, junkMax: 2, matChance: 0.60, equipChance: 0.10, catCoinBase: 5,   coinBase: 60 },
  2: { junkChance: 0.60, junkMax: 3, matChance: 0.65, equipChance: 0.15, catCoinBase: 10,  coinBase: 110 },
  3: { junkChance: 0.70, junkMax: 3, matChance: 0.70, equipChance: 0.22, catCoinBase: 18,  coinBase: 180 },
  4: { junkChance: 0.80, junkMax: 4, matChance: 0.75, equipChance: 0.30, catCoinBase: 28,  coinBase: 280 },
  5: { junkChance: 0.90, junkMax: 4, matChance: 0.80, equipChance: 0.40, catCoinBase: 42,  coinBase: 420 },
  6: { junkChance: 1.00, junkMax: 5, matChance: 0.88, equipChance: 0.52, catCoinBase: 60,  coinBase: 600 },
});
