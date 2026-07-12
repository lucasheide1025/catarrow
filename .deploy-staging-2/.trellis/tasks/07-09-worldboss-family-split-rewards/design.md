# Design：世界王六大族改版

## 1. `worldBossData.js` 資料模型變更

### `WORLD_BOSSES`（18→24筆）
六族既有 6 隻改名語意為「大王」，新增 6 隻「小王」：
```js
// 既有（不動數值/外觀），新增欄位：
ghost_boss: { ...現有欄位不動..., familyGroup:"ghost", familyTier:"big" }
// 新增
ghost_boss_small: {
  name:"纏身女鬼", title:"夜半哭聲",
  desc:"...", hp: <大王的 ~35%>, atk: <~40%>, def: <~40%>,
  pixelKey: "ghost_boss", // 沿用大王的圖，webp 路徑另外給小王專屬（見下方美術資產）
  family:"ghost", familyGroup:"ghost", familyTier:"small",
  bg: <沿用大王>, accent: <沿用大王>,
}
```
六族都比照這個模式（`familyGroup` 標記族別，`familyTier: "small"|"big"` 標記大小王）。**刪除 `rTier` 欄位**（改用 `familyGroup`+`familyTier` 決定寶箱/獎勵分類，不再有跨族排序）。

數值草案（大王沿用 Phase2 既有值，小王抓大王的 35~45% 區間，六族統一比例，維持族間不刻意比較）：

| 族 | 小王 HP/ATK/DEF | 大王 HP/ATK/DEF（既有） |
|---|---|---|
| ghost | 165000/60/33 | 470000/155/85 |
| forest(mountain) | 120000/45/25 | 340000/115/65 |
| poison(insect) | 100000/38/22 | 280000/95/55 |
| office(workplace) | 190000/68/37 | 550000/175/95 |
| exam | 140000/53/29 | 400000/135/75 |
| western(temple) | 230000/78/43 | 650000/200/110 |

### `WB_FAMILY_TO_DUNGEON_FAMILY` 不變（仍用於材料寶箱 family 對照）。

### 圖鑑/美術
`WorldBossSVG.jsx`：`PIXEL_MAP` 新增 6 個小王 key，直接指向同族大王的 pixel 函式（`ghost_boss_small: GhostBossPixel` 等）。真實圖片路徑 `/worldboss/${bossKey}.webp` 找不到會自動 fallback 到 pixel，所以小王在拿到新圖之前完全能正常顯示（用大王的像素圖頂著）。

新建 `docs/second_brain/worldboss-small-boss-prompts.md`：6 隻小王各自一段完整 Midjourney/GPT 圖片生成提示詞（風格需與現有 12 隻王一致：像素/CG 角色立繪，附上參考現有大王的 `bg`/`accent` 色票，方便使用者直接複製貼上生圖）。

## 2. `worldBossCards.js`（18→24張）

`buildWbCard(bossKey)` 現有邏輯不變（依 `boss.family` 分支），六族王卡沿用 `FAMILY_STAT` 對照即可自動涵蓋新的 6 張（因為 `WORLD_BOSSES` key 一多，`Object.keys(WORLD_BOSSES).reduce(...)` 自動產生對應卡片，不用改這個檔案的邏輯，只要 `WORLD_BOSSES` 資料補齊即可）。

## 3. 掉落分類與比例貨幣池（`worldBossData.js` 新增 `DROP_TABLE_BY_CATEGORY`）

```js
export const DROP_TABLE_BY_CATEGORY = {
  family_small: {
    chestFamily: "same-as-boss-family", chestTierRange: [1,3], // T1~T3 材料寶箱，取代 gold/epic/mythic 三選一邏輯
    coinsPool: 3000, arrowDewPool: 600, archerXPPool: 2000, catXPPool: 600, bondPool: 60,
    wbCardChance: 0.25, scrolls: 1,
  },
  family_big: {
    chestFamily: "same-as-boss-family", chestTierRange: [4,6],
    coinsPool: 6000, arrowDewPool: 1200, archerXPPool: 4000, catXPPool: 1200, bondPool: 120,
    wbCardChance: 0.25, scrolls: 1,
  },
  cat: {
    coinChests: { count: 5, tierRange: [1,6] },
    mimiBoxes: 1, catBoxChance: 0.15, cardPacks: [1,3],
    coinsPool: 2000, arrowDewPool: 400, archerXPPool: 1500, catXPPool: 500, bondPool: 50,
    wbCardChance: 0.20, scrolls: 1,
  },
  coach: {
    coinChests: { count: 5, tierRange: [3,6] },
    mimiBoxes: 1, catBoxChance: 0.25, cardPacks: [1,3],
    materialChests: { count: 10, tierRange: [1,6] },
    coinsPool: 10000, arrowDewPool: 2000, archerXPPool: 6000, catXPPool: 2000, bondPool: 200,
    wbCardChance: 0.10, scrolls: 1,
  },
};

export function getDropCategory(boss) {
  if (boss.family === "coach") return "coach";
  if (boss.family === "cat")   return "cat";
  return boss.familyTier === "small" ? "family_small" : "family_big";
}
```
「T1~T6 金幣寶箱」＝ `lootTable.js::COIN_CHEST_TIERS`（wood~mythic 6階，非 `itemData.js` 的材料寶箱），`makeCoinChest(tierKey)` 已存在可直接重用。「材料寶箱」＝現有 `CHEST_TYPES`（gold/epic/mythic 三階，這次改用完整 T1~T6 對照：common→wood, rare→iron, elite→gold, fierce→epic, boss→mythic, mythic→mythic，取 `chestTierRange` 對應的怪物 tier 名稱陣列 `["common","rare","elite","fierce","boss","mythic"]` 切片）。

## 4. `claimWorldBossKillReward` 重寫（`worldBossDb.js`）

流程改為：
1. 依 `getDropCategory(boss)` 取得 `dropCfg`。
2. 比例貨幣：`myDmgPct = mine.totalDmg / ev.totalDamage`（`ev.totalDamage` 需確認事件文件是否已有此欄位加總，若無則用 `Object.values(ev.participants).reduce(...)` 現算），`myShare = Math.max(1, Math.round(dropCfg.xxxPool * myDmgPct))`。分別套用在 coins/arrowDew/archerXP/catXP/bond 五項。
3. 寶箱：依 `dropCfg` 的 `chestTierRange`/`coinChests`/`materialChests` 組出寶箱陣列，一次 `addChests`。
4. 咪咪箱/貓貓箱機率/卡包數量：依 `dropCfg` 對應欄位擲骰。
5. 世界王卡：`addWorldBossCard`，若回傳 `reason==="已擁有此王卡"` → 改發等值金幣（額度沿用 `TIER_CARD_BONUS.worldboss.base * 某個係數`，初版訂 100 金幣）。
6. 召喚卷：`grantWorldBossDungeon`（既有函式，人人都有，不變）。
7. 排名加成：`isLastHit`/`isTop3`（沿用既有判斷）→ 額外呼叫 `addCoins`/`addArrowdew`/`addGachaCoins`/`addChests`（cat_box/mimi_box），數值抄 PRD 表格。
8. `addCatBond(memberId, catId, "worldboss")`：**只有裝備貓咪時**才呼叫（讀 `mine.catId` 或當下 `profile.equippedCat`——世界王事件的 participant 記錄裡有沒有存 catId 需要先確認，若沒有則用 bond 數值改發等值金幣或材料替代，避免因為沒帶貓而少一項獎勵)。

## 5. 48 件收藏獎盃 + 成就

新檔或沿用 `dungeonCollectibles.js` 的模式，在 `worldBossData.js` 新增：
```js
export const WB_TROPHY_MAP = {}; // { [trophyId]: {name, icon, desc, bossKey, kind:"lastHit"|"top3"} }
for (const [bossKey, boss] of Object.entries(WORLD_BOSSES)) {
  WB_TROPHY_MAP[`${bossKey}_lasthit_trophy`] = { name:`${boss.name}·絕殺印`, icon:"⚡", desc:`給予${boss.name}最後一擊的證明`, bossKey, kind:"lastHit" };
  WB_TROPHY_MAP[`${bossKey}_top3_trophy`]    = { name:`${boss.name}·討伐勳章`, icon:"🎖️", desc:`在${boss.name}戰役中傷害位列前三`, bossKey, kind:"top3" };
}
```
存放位置沿用 `dungeonCollectibles` 模式，寫進 `member.dungeonCollectibles.{trophyId}`（同一個收藏欄位，反正 id 前綴不會撞名，不需要為世界王另開一個欄位，降低資料模型複雜度）。`claimWorldBossKillReward` 判斷 `isLastHit`/`isTop3` 時一併 `increment` 對應 trophyId。

`achievementDex.js` 動態產生（比照地下城首通紀念章的迴圈寫法）：
```js
for (const [trophyId, t] of Object.entries(WB_TROPHY_MAP)) {
  AUTO_ACHIEVEMENTS.push({
    id: `wb_trophy_${trophyId}`, cat: "special", icon: t.icon,
    name: t.name, rarity: t.kind === "lastHit" ? "mythic" : "legendary",
    desc: t.desc,
    check: c => (c.member?.dungeonCollectibles?.[trophyId] || 0) > 0,
  });
}
```
（掛在既有的 `cat:"special"` 分類，不用新增分類；若要獨立分類可再議）

## 6. 後台（`AdminWorldBoss.jsx`）

- 移除「🥈 前3名」分頁與對應欄位（`rank3` 完全不讀，直接砍掉這個 tab，只留「保底」+「均分獎勵」兩塊）。
- 新增「三大類掉落設定」區塊，對應 `DROP_TABLE_BY_CATEGORY` 四個分類（family_small/family_big/cat/coach）的池子數值可調（金幣/箭露/經驗值/羈絆值池、王卡機率），存進 `sysConfig/worldBossDropTable`（比照這次已經做過的 `worldBossSpawn` 設定模式）。
- Boss 選單（建立活動/發放王卡兩處）：24隻清單加上 `familyTier` 標籤顯示（「🔹小王」「🔸大王」)。

## 7. 風險與待確認（已確認的結論）

- **`ev.totalDamage`不存在**，確認用 `Object.values(ev.participants||{}).reduce((s,p)=>s+(p.totalDmg||0),0)` 在 `claimWorldBossKillReward` 內現場算（participants 數量小，效能無虞）。
- **`participants.{memberId}` 沒有存 `catId`**，確認不改 `attackWorldBoss` 的寫入結構（避免動到攻擊主流程），改成在 `claimWorldBossKillReward` 結算當下額外 `getDoc(members/{memberId})` 讀取**當下**的 `profile.equippedCat.catId`——用「現在裝備哪隻貓」當作發放羈絆值/貓咪經驗的對象，是合理近似（不追溯打王當下裝備哪隻貓）。沒裝備貓咪的人，這兩項改發等值金幣（貓咪經驗池的金幣換算率初版訂 1:1）。
- 王卡機率 25%/25%/20%/10% 是每次擊殺結算「每個人」各自擲一次骰（已擁有的人重複時改發金幣），不是全團共用一次骰——沿用現有 `claimWorldBossKillReward` per-participant 呼叫的架構自然就是這個語意，不用特別處理。
