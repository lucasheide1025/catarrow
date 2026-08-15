# 接手文件：貓貓村商店販售模擬器（Village Shop Simulator）

> 最後更新：2026-08-08，**本機 V11「exact-tier 爆倉雷達＋低庫存快速補貨」完成並通過驗證**。
> **正式站仍是 V5（commit `f89f9877`）；V6/V7/V8/V9/V10/V11 尚未 deploy、尚未 commit。**
> 工作區同時存在探索地圖／事件系統等未完成變更，未來提交商店時禁止 `git add .`。

## 0. 核心定位（最高優先）

貓貓村商店不是獨立主遊戲，而是**射箭主系統中的休閒附屬小遊戲／村莊材料 sink**。

主要目的：

1. 消耗貓貓村建築、採集、遠征與練箭相關玩法長期累積過量的分層資源。
2. 讓玩家快速看出「哪一種、哪一階」材料爆量，直接加工成商品並補貨。
3. 保留「開店後貓咪真的進店、逛貨架、排隊、結帳」的短時間觀賞與互動樂趣。
4. 不要求玩家長時間盯盤，不往高壓棄單、高頻 action log、複雜店員排班等獨立經營遊戲方向膨脹。
5. 射箭仍是主體；商店只負責讓村莊資源有地方花，而且花得有趣。

一句話：

> **村莊生產很多 → 爆倉雷達找出 exact-tier 過剩 → 工坊快速去化 → 低庫存一鍵補到安全量 → 有空時開店看貓咪買東西。**

## 1. 正式材料 sink：九種貓貓村分層資源

商店商品配方允許大量消耗：

- `ore_t1~t5`：礦物
- `melon_t1~t5`：瓜瓜
- `fish_t1~t5`：鮮魚
- `meat_t1~t5`：動物肉
- `driedfish_t1~t5`：小魚乾
- `can_t1~t5`：貓罐頭
- `potion_t1~t5`：貓薄荷藥水
- `fur_t1~t5`：貓毛
- `archer_t1~t5`：貓貓射手

其中 `archer_t1~t5` 屬於貓貓村練箭／相關產出；T3 以上已有實際商品去化出口。

### 明確排除

以下不作普通商店大量加工原料：

- `arrowdew`：箭露。
- `gachaToken`：扭蛋幣。
- 七族怪物 family materials。
- T6 / miniBoss / boss / worldboss / dungeon exclusive 材料。

七族怪物材料屬於獎勵／探索等既有經濟，不要和九種 village tiered resources 混成同一套。

## 2. 商品與 V9 加工規則

權威檔：`src/lib/shopGoodsCatalog.js`。

固定 120 件：

- 武器 40
- 裝備 40
- 料理 40
- 每類 T1～T5 各 8 件

### T1 / T2 新手保護

只使用早期六種資源：

`ore / melon / fish / meat / driedfish / can`

因此 `potion / fur / archer` 的 T1/T2 可能在 V11 雷達中顯示存量，但**沒有該階商店配方**。這是刻意的新手保護，不是資料錯誤；UI 必須如實顯示「此階無商店配方」，不可假裝可去化。

### T3～T5 後段 sink

- 武器：會使用 `archer`、`fur`。
- 裝備：會使用 `fur`、`archer`。
- 料理：會使用 `potion`。

### 加工經濟

- 不收金幣加工費：`TIER_GOLD = {1:0,2:0,3:0,4:0,5:0}`。
- 商品庫存上限：`SHOP_GOOD_STOCK_CAP = 999`。
- 工坊數量：`×1 / ×10 / ×50 / MAX`。
- MAX 同時受材料存量與商品庫存剩餘空間限制。

### 材料損失防護

`craftShopGood()` 必須先算：

```text
room = 商品庫存上限 - 現有庫存
craftCount = min(requestedCount, room)
```

所有材料扣除只能依 `craftCount`，不可依玩家原始 requestedCount 多扣。

## 3. V9/V10 去化推薦與智慧上架

### 去化推薦

純函式：

```js
getShopSinkRecommendations(resources, shop, limit, focusResourceKey?)
```

V11 仍向下相容舊呼叫：沒有 `focusResourceKey` 時維持 V9/V10 的整體 MAX 去化排序。

特性：

- 使用 CatVillage 已讀進來的 `resources`。
- 不新增 Firestore read。
- 只挑已解鎖、目前真的能製作的商品。
- 一般模式依一次 MAX 可去化的總材料量排序。
- 顯示最多指定數量的推薦方案。

### V10 智慧展示規劃

`src/lib/villageShop.js`：

```js
planQuickShopDisplay(shop, goodId, category)
```

規則：

1. 商品已在展示中 → 保持原位置，不重複佔格。
2. 料理 → 優先空 `counter`。
3. 武器／裝備 → 優先空 `cabinet`。
4. 偏好位置沒有空格 → 可退回其他現有空展示格。
5. 所有展示格都滿 → **絕不替換玩家原本陳列**；商品只加工進 stock。
6. 純函式，零 Firebase。

### Firestore 合併流程

`src/lib/villageShopDb.js`：

```js
craftShopGoodInternal(memberId, goodId, count, { quickStock })
craftShopGood(memberId, goodId, count)
craftAndStockShopGood(memberId, goodId, count)
```

`craftAndStockShopGood()` 在同一流程中完成材料扣除、stock 增加與必要的 display 更新：

- **1 次 `getDoc`**
- **1 次 `updateDoc`**
- 無新增 subscription
- 無逐件 write
- 無第二輪 arrange write

## 4. V11 exact-tier 材料爆倉雷達

### 4.1 純邏輯

`src/lib/shopGoodsCatalog.js` 新增：

```js
getShopTierOverflowEntries(resources, shop)
```

固定列出：

```text
9 種資源 × T1~T5 = 45 個 exact-tier stack
```

每筆資料包含：

- `key`：例如 `archer_t3`
- `resource`
- `tier`
- `name`
- `icon`
- `amount`
- `minUnlockLevel`
- `unlocked`
- `actionable`
- `consumerCount`

`actionable` 不是只看「有沒有這個材料」，而是檢查：

1. 該 exact key 有商品配方會消耗。
2. 至少一個消費該材料的商品已解鎖。
3. 目前其他搭配材料也足夠實際製作至少 1 件。
4. 對應商品尚有 stock 空間。

全部是純函式，只使用目前頁面已持有的 `resources` / `shop`，**沒有新增 Firebase read**。

### 4.2 exact-tier 聚焦推薦

`getShopSinkRecommendations()` V11 新增可選第 4 參數：

```js
getShopSinkRecommendations(resources, shop, limit, focusResourceKey)
```

例如：

```js
getShopSinkRecommendations(resources, shop, 4, "archer_t3")
```

此時：

- 推薦商品必須真的消耗 `archer_t3`。
- 不會拿 `archer_t2` / `archer_t4` 或同族其他階冒充。
- 新增 `focusUnits`，表示一次 MAX 真正可消耗多少指定 exact-tier 材料。
- 聚焦模式優先依 `focusUnits` 排序，再沿用原本總去化量等 tie-break。

### 4.3 工坊 UI

V11 原本「五階合計」升級為：

**📡 材料爆倉雷達**

直接顯示類似：

```text
🏹 貓貓射手 T3
3,800・點我找去化方案
```

目前取存量最高的 exact-tier stack 顯示，不再把 T1～T5 混在一起。

狀態文案：

- `點我找去化方案`
- `缺搭配材料`
- `Lv.X 解鎖`
- `此階無商店配方`

玩家點可用 stack 後，只看會消耗該 exact key 的商品；`全部推薦` 可回到整體去化模式。

若聚焦後沒有可製作方案，UI 會說明是：

- 該階根本沒有商店配方。
- 尚未到最早解鎖等級。
- 缺少搭配材料。
- 對應商品庫存已滿。

不會顯示誤導性的空推薦。

## 5. V11 已上架商品低庫存快速補貨

### 5.1 資料模型原則

**不新增「貨架庫存」第二層資料。**

目前：

- `shop.display` 只保存展示格與 `goodId`。
- 真正可販售數量仍是 `shop.stock[goodId]`。

所以 V11 的「補貨」不是倉庫搬貨到另一個 shelfStock，而是直接用該商品既有配方加工同一件已上架商品。

### 5.2 純補貨規劃

`src/lib/shopGoodsCatalog.js` 新增：

```js
SHOP_QUICK_REFILL_THRESHOLD = 10
SHOP_QUICK_REFILL_TARGET = 30
getShopQuickRefillPlan(resources, shop, goodId)
```

規則：

1. 商品必須已經在 `shop.display`。
2. 現有 stock `<= 10` 才算需要快速補貨。
3. 目標只補到 `30`，不是另一個 MAX。
4. 實際補貨量：

```text
min(
  30 - currentStock,
  目前材料實際可加工量,
  999 - currentStock
)
```

5. 材料不足時 `refillCount = 0`，UI 顯示 disabled 狀態。
6. stock > 10 不顯示快速補貨。
7. 未上架商品不顯示快速補貨。

### 5.3 UI

店內陳列頁：

- 若有低庫存展示商品，頂部顯示「有 N 個展示商品庫存偏低」。
- `stock = 0` 顯示 `售完`。
- `1~10` 顯示低庫存視覺提醒。
- 貨架主按鈕仍負責「更換展示商品」。
- 補貨按鈕是獨立 sibling button，沒有 button 包 button 的無效 HTML。

按鈕文案：

- `立即補貨 +N`：售完。
- `快速補貨 +N`：低庫存。
- `材料不足・暫時無法補貨`：disabled。

補貨仍呼叫既有：

```js
craftAndStockShopGood(memberId, goodId, refillCount)
```

因為商品已經展示，V10 `planQuickShopDisplay()` 會維持原格，因此：

- 不更換商品。
- 不覆蓋其他展示格。
- 不新增 DB schema。
- DB 成本仍是 **1 getDoc + 1 updateDoc**。

## 6. V6～V8 即時開店能力全部保留

V11 沒有改 deterministic live shop 經濟。

玩家按開店後仍是：

`進門 → 逛貨架 → 排隊 → 結帳 → 離店`

保留：

- 2～3 位顧客同場。
- 單一收銀排隊。
- x1 / x2 / x4。
- 24 位顧客個性。
- VIP、大宗採購、連續成交等任務。
- 妹妹收銀、寶寶補貨、悠悠迎賓。
- 家具影響 live timeline / 演出。
- 離線客流累積。

家具效果仍只改演出節奏，不自行改 deterministic 成交結果。

## 7. 離線客流：不可破壞

假設：

```text
lastVisitedAt = 10:00
10:30 按開店
10:32 動畫結束
```

權威結算仍只推進：

```text
lastVisitedAt = 10:30
```

10:30～10:32 新累積的顧客保留到下一輪，因此商店不要求玩家一直掛在線上。

## 8. Firestore / deterministic 安全邊界

`completeLiveShopSession()` 仍使用：

1. Firestore `runTransaction()`。
2. `expectedLastVisitedAtMs` guard。
3. `stateSignature`。
4. 同 startedAt + seed 重建 deterministic session。
5. 重算任務。
6. 一次更新 tickets / stock / lastVisitedAt / stats / log。

V11 沒有新增：

- live customer Firestore write
- subscription
- 輪詢
- 新 collection
- 新貨幣
- shelf inventory schema
- 射箭主系統讀寫
- 探索／事件系統改動

## 9. 票券經濟 v2 保持不變

共 38 項：

- 35 個 `family_mat`：7 族 × T1～T5。
- potion：40，daily 2，Lv1。
- card_pack：600，weekly 1，Lv13。
- cat_box：2000，weekly 1，Lv25。

**七族材料箱是獎勵端；九種 village tiered resources 是商品加工 sink 端。**

## 10. V11 驗證

Focused test：

```bat
set CI=true&& npx react-scripts test --watchAll=false --runInBand src/lib/villageShop.test.js
```

結果：

- ✅ 1 suite passed
- ✅ **67 / 67 tests passed**

V11 新增 5 組 regression：

1. 爆倉雷達固定 45 個 exact-tier stack，且正確標記解鎖／可去化狀態。
2. 指定 exact resource 後，只推薦真的消耗該 key 的商品，並依 `focusUnits` 排序。
3. 已上架商品 stock 7 時只補 `+23` 到 30，不會變成 MAX。
4. 快速補貨量會被實際材料能力限制。
5. 未上架、健康庫存、stock cap 狀態都不會誤提示快速補貨。

V10 的「滿格不覆蓋玩家陳列」等測試仍全部通過。

Production build：

```bat
set CI=true&& npx react-scripts build
```

- ✅ **Compiled successfully**
- 本次 build 主程式：`build/static/js/main.58709424.js`
- 僅既有 CRA bundle-size / Node deprecation warning。

Diff check：

```bat
git diff --check -- src/lib/shopGoodsCatalog.js src/lib/villageShop.js src/lib/villageShopDb.js src/lib/villageShopLive.js src/components/member/ShopSimulatorV3.jsx src/lib/villageShop.test.js
```

- ✅ 通過

Source fingerprint 也已確認實際存在：

- `getShopTierOverflowEntries`
- `getShopQuickRefillPlan`
- `材料爆倉雷達`
- `V11 exact-tier 爆倉雷達與快速補貨`

## 11. V11 實際新增範圍

V11 直接新增／修改重點：

- `src/lib/shopGoodsCatalog.js`
  - `SHOP_QUICK_REFILL_THRESHOLD`
  - `SHOP_QUICK_REFILL_TARGET`
  - `getShopGoodCraftCapacity()`
  - `getShopTierOverflowEntries()`
  - `getShopSinkRecommendations(..., focusResourceKey)`
  - `getShopQuickRefillPlan()`
- `src/components/member/ShopSimulatorV3.jsx`
  - exact-tier 爆倉雷達。
  - 聚焦推薦。
  - 全部推薦 reset。
  - 已上架低庫存提醒與快速補貨。
  - 售完／低庫存狀態。
  - 維持可讀字級與手機兩欄雷達。
- `src/lib/villageShop.test.js`
  - 5 組 V11 regression。

V11 **沒有要求新的 `villageShopDb.js` API**；直接重用 V10 `craftAndStockShopGood()`。

## 12. 後續優先順序

V11 已把「看出哪個 Tier 爆倉」與「上架商品快賣完時補回安全量」做完。

後續優先：

1. **商店美術品質**：專屬室內背景、櫃台／貨架 sprite、24 商品 archetype 真正插畫、顧客 walking / browse / checkout 動作。
2. **空展示格體驗**：在不替玩家亂選商品的前提下，提供更直覺的候選提示。
3. **材料 sink 視覺層級**：爆倉嚴重程度、Tier 色階，但不要把頁面做成資料 dashboard。
4. **短而精彩的開店演出**：維持附屬小遊戲節奏。
5. **手機實機 QA**。

不要優先做高壓棄單、長時間排班、需要一直點擊的操作系統。

## 13. Git / 部署安全

- **正式站仍是 V5 commit `f89f9877`。**
- **本機 V11 尚未 deploy / commit。**
- 工作區有其他探索地圖／事件系統修改。
- 禁止 `git add .`。
- 若未來要部署，只 stage 明確商店檔案，先重新跑 **67 tests + build + diff check** 再 push。
