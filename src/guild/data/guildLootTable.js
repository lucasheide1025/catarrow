// src/guild/data/guildLootTable.js
// 冒險者公會「獨立戰利品設定」——與主線 lootTable 分開（掉落不混）。
// 掉三類：①擴充材料（跟主線打怪同一份，量 2~3 倍）②公會雜貨（進倉庫，玩家自己決定何時賣）③公會專屬裝備。

// 雜貨圖鑑已搬到 `guildJunkCatalog.js`（72 種、分稀有度、分族群）。
// 這裡 re-export 只為了不動舊的 import 路徑。
export { GUILD_JUNK, JUNK_RARITY, JUNK_BY_ID, junkPoolFor, drawJunk, evaluateJunk } from "./guildJunkCatalog";

// 危險度 1~6（＝怪物階級 T1~T6）→ 掉落率/量設定。
// 遞增但不暴衝：高階的價值主要來自「材料階級更高」而不是數字翻倍。
// matChance 命中後每隻怪掉 2~3 個擴充材料（見 settleExpedition.MAT_PER_MONSTER）。
// 2026-07-25 調高報酬（作者：報酬率太低）——公會商店的定位是「**自由採購缺的素材，補打怪賺不夠的洞**」，
// 所以 CAT幣（商店貨幣）給得大方；雜貨也給更多件，讓玩家有東西可囤可賣。
// ⚠️ 2026-07-26 裝備掉落率大幅調高（作者：「一天只能刷幾次任務，掉落率過低」）。
//   一天最多 18 張委託、每張只能接一次（勝敗都結案）→ 掉落機會本來就很有限，
//   舊的 10%~52% 讓新手（只能接 3 張 T1）期望值僅 0.3 件／天，等於刷不到東西。
//   2026-07-26 二次調高（作者：「可以，畢竟還可以分解、刷詞綴」）→ T1 0.65 起跳。
//   **設計定位**：裝備本身不稀有，稀有的是「高品級 × 好詞綴」的組合。
//   掉一堆低階裝是刻意的——它們是①分解成碎片養主力裝 ②不斷重抽詞綴的來源。
export const LOOT_BY_DANGER = Object.freeze({
  1: { junkChance: 0.70, junkMax: 3, matChance: 0.70, equipChance: 0.65, catCoinBase: 14,  coinBase: 90 },
  2: { junkChance: 0.80, junkMax: 3, matChance: 0.75, equipChance: 0.72, catCoinBase: 28,  coinBase: 170 },
  3: { junkChance: 0.90, junkMax: 4, matChance: 0.80, equipChance: 0.80, catCoinBase: 50,  coinBase: 280 },
  4: { junkChance: 0.95, junkMax: 5, matChance: 0.85, equipChance: 0.88, catCoinBase: 82,  coinBase: 440 },
  5: { junkChance: 1.00, junkMax: 6, matChance: 0.90, equipChance: 0.95, catCoinBase: 125, coinBase: 660 },
  6: { junkChance: 1.00, junkMax: 7, matChance: 0.95, equipChance: 1.00, catCoinBase: 190, coinBase: 980 },
});
