# 貓貓村商店販售模擬器（Village Shop Simulator）設計 Spec

- 狀態：**V11 exact-tier 爆倉雷達＋低庫存快速補貨（2026-08-08）**
- 正式站：V5 已部署；V6/V7/V8/V9/V10/V11 尚未 deploy / commit
- 核心定位：**射箭主系統中的休閒附屬小遊戲。主要經濟責任是消耗貓貓村建築／採集／遠征／練箭相關玩法長期累積過量的分層資源；即時開店負責提供短時間、可愛、有生命感的演出。**

---

## 1. 最高設計原則

> **射箭是主體，商店是材料 sink。離線累積、上線短玩；不要把商店發展成需要長時間盯著操作的獨立高壓經營遊戲。**

功能優先順序：

1. 村莊材料去化效率。
2. 清楚知道哪一種、哪一階材料真正過剩。
3. 批量加工與低摩擦補貨。
4. 短而精彩的開店演出。
5. 美術品質與手機可讀性。

不優先：

- 排隊太久真的棄單。
- 高頻 action log。
- 持續安撫／快速點擊壓力玩法。
- 複雜店員排班。
- 第二套貨架庫存。
- 大量額外商店貨幣或另一套重角色養成。

---

## 2. 核心循環

```text
🏹 射箭／貓貓村活動持續產生村莊資源
   ↓
🏘️ 建築、採集、遠征、練箭相關玩法讓分層資源堆積
   ↓
📡 爆倉雷達直接顯示哪個 exact-tier stack 最大
   ↓
📋 聚焦該 exact key，列出真的會消耗它的商品
   ↓
🪚 玩家查看配方，或明確選擇 MAX 加工＋上架
   ↓
🛒 已上架商品庫存 <=10 時，可一鍵補到最多 30
   ↓
🚪 玩家有空時按「開店」
   ↓
🐱 客人進店 → 逛貨架 → 排隊 → 結帳 → 離店
   ↓
🧾 一次性 deterministic Firestore 結算
   ↓
🎟️ 少量票券回饋 → 家具與限量獎品
   ↓
📦 回頭消耗下一批村莊過剩材料
```

核心不是靠商店創造大量新資源，而是：

> **把已經產生太多的村莊資源，轉換成好玩、低摩擦的加工／陳列／開店循環。**

---

## 3. 正式材料 sink

商店可大量消耗的九種分層資源：

| key | 顯示名稱 | 主要來源 |
|---|---|---|
| `ore_t1~t5` | 礦物 | 礦山／採集／遠征 |
| `melon_t1~t5` | 瓜瓜 | 農地／採集／遠征 |
| `fish_t1~t5` | 鮮魚 | 海港／採集／遠征 |
| `meat_t1~t5` | 動物肉 | 獵場／採集／遠征 |
| `driedfish_t1~t5` | 小魚乾 | 市集／採集／遠征 |
| `can_t1~t5` | 貓罐頭 | 倉庫／採集／遠征 |
| `potion_t1~t5` | 貓薄荷藥水 | 採集／遠征等村莊活動 |
| `fur_t1~t5` | 貓毛 | 採集／遠征等村莊活動 |
| `archer_t1~t5` | 貓貓射手 | 練箭場／採集／相關村莊玩法 |

### 禁止作普通商店大量加工原料

- `arrowdew`：箭露。
- `gachaToken`：扭蛋幣。
- monster / family materials。
- T6、miniBoss、boss、worldboss、dungeon exclusive 材料。

上述資源各有原本特殊經濟用途，不應被普通商店加工大量燒掉。

---

## 4. 商品目錄與配方

權威檔：`src/lib/shopGoodsCatalog.js`。

固定：

- 120 商品。
- weapon 40。
- armor 40。
- food 40。
- 每類 T1～T5 各 8 件。
- 30 商店等級，每級解鎖 4 件。

### T1 / T2：新手保護

只使用：

`ore / melon / fish / meat / driedfish / can`

因此 `potion / fur / archer` 的 T1/T2 即使玩家持有，也可能沒有該階商店配方。V11 爆倉雷達必須直接顯示「此階無商店配方」，不可把其他 Tier 的商品當作可消耗方案。

### T3～T5：後段資源正式加入

武器 pool：

```js
["ore", "archer", "driedfish", "can", "fur"]
```

裝備 pool：

```js
["can", "ore", "fur", "fish", "archer"]
```

料理 pool：

```js
["melon", "fish", "meat", "driedfish", "can", "potion"]
```

因此 `archer`、`fur`、`potion` 在 T3～T5 都可進入正式商品去化鏈。

### 商品售價

維持原本材料價值公式，不因 V9～V11 改變營業售價模型。

---

## 5. 加工經濟

### 不收金幣加工費

```js
TIER_GOLD = { 1:0, 2:0, 3:0, 4:0, 5:0 }
```

商店的責任是消耗村莊材料，不建立第二條金幣 sink。

### 商品庫存上限

```js
SHOP_GOOD_STOCK_CAP = 999
```

### 批量選擇

工坊：

- ×1
- ×10
- ×50
- MAX

MAX 同時受現有村莊材料與商品庫存剩餘空間限制。

---

## 6. 加工安全規則

權威檔：`src/lib/villageShopDb.js`。

必須先算實際能製作數：

```text
room = SHOP_GOOD_STOCK_CAP - currentStock
craftCount = min(requestedCount, room)
```

所有材料扣除只能依 `craftCount`。

這防止「要求做 500 件，但只剩 20 格，卻扣掉 500 件材料」的舊風險。

---

## 7. V9/V10 去化推薦與智慧上架

### 7.1 一般去化推薦

純函式：

```js
getShopSinkRecommendations(resources, shop, limit, focusResourceKey?)
```

沒有 `focusResourceKey` 時維持原本 V9/V10 行為：

```text
maxCraft = min(各配方材料可做量, 庫存剩餘空間)
materialPerGood = 單件配方材料總量
sinkUnits = maxCraft × materialPerGood
```

只推薦已解鎖、目前真的可製作的商品；不新增 Firestore read。

### 7.2 V10 智慧展示

`src/lib/villageShop.js`：

```js
planQuickShopDisplay(shop, goodId, category)
```

規則：

1. 商品已展示 → 保持原位置，不重複佔格。
2. `food` → 優先空 `counter`。
3. `weapon` / `armor` → 優先空 `cabinet`。
4. 偏好類型沒有空位 → 退回其他現有空展示格。
5. 所有展示格已滿 → 回傳 full，**絕不覆蓋或替換玩家既有陳列**。
6. 純函式、零 Firebase。

### 7.3 DB 合併流程

`src/lib/villageShopDb.js`：

```js
craftShopGoodInternal(memberId, goodId, count, { quickStock })
craftShopGood(memberId, goodId, count)
craftAndStockShopGood(memberId, goodId, count)
```

`craftAndStockShopGood()` 權威流程：

1. `getDoc(member)` 一次。
2. normalize shop。
3. 驗證 unlock、材料、庫存空間。
4. 計算 `craftCount`。
5. 算資源扣除。
6. 呼叫 `planQuickShopDisplay()`。
7. 一次 `updateDoc()` 同時更新材料、stock，必要時更新 display。

維持：

- 1 getDoc。
- 1 updateDoc。
- 無新增 subscription。
- 無逐件 write。
- 無第二次 arrange write。

---

## 8. V11：exact-tier 材料爆倉雷達

### 8.1 45 個 exact-tier stack

`src/lib/shopGoodsCatalog.js`：

```js
getShopTierOverflowEntries(resources, shop)
```

固定列出：

```text
9 resource families × 5 tiers = 45 entries
```

每筆：

```js
{
  key,
  resource,
  tier,
  name,
  icon,
  amount,
  minUnlockLevel,
  unlocked,
  actionable,
  consumerCount,
}
```

例如：

```text
key = archer_t3
name = 貓貓射手
tier = 3
amount = 3800
```

排序以實際 exact stack 數量優先，因此玩家看到的不是「五階合計」，而是真正需要處理的 Tier。

### 8.2 actionable 定義

`actionable = true` 必須同時滿足：

1. amount > 0。
2. 至少有一個商品配方會消耗該 exact key。
3. 至少一個對應商品已在目前 shop level 解鎖。
4. 目前所有配方材料足以真的做至少 1 件。
5. 對應商品尚有庫存空間。

因此不能只因 `archer_t3` 很多就宣稱能去化；如果缺另外一種配方材料，UI 應顯示「缺搭配材料」。

### 8.3 exact focus 推薦

`getShopSinkRecommendations()` 第 4 參數：

```js
focusResourceKey
```

聚焦模式：

- 只保留配方真的含有該 exact key 的商品。
- 計算：

```text
focusPerGood = 單件商品消耗多少指定 exact key
focusUnits = maxCraft × focusPerGood
```

排序：

1. `focusUnits` 高者優先。
2. `sinkUnits`。
3. `sourceTotal`。
4. unlockLevel。
5. stable id。

例如聚焦 `archer_t3` 時，不得推薦只消耗 `archer_t2` 或 `archer_t4` 的商品。

### 8.4 工坊 UI

Active component：`src/components/member/ShopSimulatorV3.jsx`。

區塊名稱：

```text
📡 材料爆倉雷達
```

顯示最高存量的 exact-tier stack，例如：

```text
🏹 貓貓射手 T3
3,800・點我找去化方案
```

狀態文案：

- `點我找去化方案`
- `缺搭配材料`
- `Lv.X 解鎖`
- `此階無商店配方`

`全部推薦` 清除 focus，回到一般材料去化推薦。

若 focus 後沒有推薦，必須說明原因，而不是空白：

- 該階沒有商店配方。
- 對應配方尚未解鎖。
- 缺搭配材料。
- 對應商品庫存已滿。

---

## 9. V11：已上架商品快速補貨

### 9.1 不新增 shelf inventory

目前權威資料：

```text
shop.display = 展示格 / goodId
shop.stock = 真正可販售商品數量
```

V11 禁止新增另一套 `shelfStock` / `displayStock`。

原因：

- 沒有必要。
- 會增加同步與 Firestore 成本。
- 容易讓 live sale stock 與貨架數量不一致。

所以「快速補貨」實際是：

> **使用既有配方加工同一件已經展示的商品，直接增加權威 `shop.stock`。**

### 9.2 補貨常數

```js
SHOP_QUICK_REFILL_THRESHOLD = 10
SHOP_QUICK_REFILL_TARGET = 30
```

純函式：

```js
getShopQuickRefillPlan(resources, shop, goodId)
```

只在：

```text
商品已展示 AND currentStock <= 10
```

時視為需要補貨。

實際補貨量：

```text
desired = 30 - currentStock
craftCapacity = 配方材料目前真正可做量
room = 999 - currentStock
refillCount = min(desired, craftCapacity, room)
```

例：

```text
currentStock = 7
材料充足
→ refillCount = 23
→ 補完 = 30
```

不是 MAX，也不會因「補貨」把大量材料一次燒光。

### 9.3 材料不足

如果商品已展示且 stock <=10，但配方材料不足：

```text
needsRefill = true
refillCount = 0
canRefill = false
materialInsufficient = true
```

UI 必須顯示 disabled：

```text
材料不足・暫時無法補貨
```

### 9.4 UI 結構

店內陳列頁：

- 低庫存商品有視覺提醒。
- stock 0 明確顯示 `售完`。
- 若 N 個展示商品需要補貨，顯示一則簡短提醒。
- 原本商品 slot button 仍負責更換展示品。
- refill button 必須是 sibling，不可把 button 放在 button 裡。

文案：

- `立即補貨 +N`：售完。
- `快速補貨 +N`：低庫存。
- `材料不足・暫時無法補貨`：無法加工。

### 9.5 DB 成本與防覆蓋

UI 直接重用：

```js
craftAndStockShopGood(memberId, goodId, refillCount)
```

因為 good 已經在 display，V10 `planQuickShopDisplay()` 會回傳 alreadyDisplayed 並保留原格。

所以補貨：

- 不更換玩家商品。
- 不覆蓋其他 display。
- 不新增第二次 arrange write。
- 不新增 DB API。
- **仍是 1 getDoc + 1 updateDoc。**

---

## 10. 即時開店保持低壓附屬玩法

### 離線累積

```text
waiting = floor(ratePerMinute × elapsedMinutes)
再套 cap
```

玩家不需要停留在商店頁。

### 主動開店

玩家按開店後：

`enter → browse → queue → checkout → exit`

保留：

- 2～3 位顧客同場。
- 單一收銀點。
- x1 / x2 / x4。
- 24 位 NPC 個性。
- VIP、大宗採購、連續成交等臨時委託。

### 動畫期間新客保留

例：

```text
lastVisitedAt = 10:00
10:30 按開店
10:32 動畫結束
```

結算仍寫：

```text
lastVisitedAt = 10:30
```

10:30～10:32 新客保留到下一輪。

---

## 11. 家具與店員演出

V8 `getShopOperationsProfile(shop)` 保留。

- counter → 收銀演出速度。
- cabinet → 補貨演出速度。
- flower / sign / luckyCat / starLamp → 進店節奏。
- flag / starLamp → 2→3 人同場。
- flower / starLamp → 排隊舒適／耐性視覺回饋。

工作角色：

- 妹妹：收銀。
- 寶寶：補貨演出。
- 悠悠：迎賓。

重要：這些只改 live timeline / 演出，不自行重算成交、收入或庫存。

---

## 12. deterministic 銷售與 Firestore 結算

營業完成只呼叫：

```js
completeLiveShopSession(memberId, session)
```

transaction 仍驗證：

1. `expectedLastVisitedAtMs`。
2. `stateSignature`。
3. startedAt + seed deterministic rebuild。
4. mission replay。

然後一次更新 tickets / stock / lastVisitedAt / stats / log。

V11 沒有修改這套 live settlement。

V11 也沒有新增：

- live customer Firestore write。
- subscription。
- polling。
- collection。
- currency。
- Firestore rules。
- shelf inventory schema。
- archery scoring/combat 讀寫。
- exploration/event 讀寫。

---

## 13. 票券經濟 v2：與材料 sink 分離

票券兌換共 38 項：

- 35 × `family_mat`（7 族 × T1～T5）。
- potion：40，daily 2，Lv1。
- card_pack：600，weekly 1，Lv13。
- cat_box：2000，weekly 1，Lv25。

七族材料箱是**獎勵端**。

九種 village tiered resources 是**商品加工 sink 端**。

兩套不要混用。

禁止販售：

- T6。
- boss/worldboss/dungeon exclusive。
- mimi_box。
- generic gold。

---

## 14. V11 UI 可讀性

Active component：`src/components/member/ShopSimulatorV3.jsx`。

既有可讀性原則不可倒退：

- root 約 14px / 1.5 line-height。
- main h3 約 20px；小手機約 18px。
- 說明文字 12～13px。
- 商品主要名稱約 18px。
- primary button 約 14px。
- V11 爆倉雷達文字維持約 11～13px，不再壓成 8～10px 資料表。
- V11 refill button 約 12px、min-height 38px。
- 手機雷達改兩欄，避免三欄內容擠到不可讀。
- 後方倉庫標題已從舊的 10px 提高為 14px。

UI 仍要像商店遊戲，不要變成純數據 dashboard。

---

## 15. V11 驗證

Focused：

```bat
set CI=true&& npx react-scripts test --watchAll=false --runInBand src/lib/villageShop.test.js
```

結果：

- ✅ 1 suite passed。
- ✅ **67 / 67 tests passed**。

V11 新 regression：

1. `getShopTierOverflowEntries()` 固定 45 筆 exact-tier stack，正確標記 `archer_t3` 等資料與 actionability。
2. focus `archer_t3` 後，所有推薦都真的消耗 `archer_t3`，且 `focusUnits` 遞減。
3. stock 7 的已展示商品只補 +23 到 30。
4. 材料只能做 3 件時，補貨只 +3。
5. 未展示、stock >10、stock cap 狀態都不會誤提示補貨。

V10 regression 仍通過：

- food 優先空 counter；weapon/armor 優先空 cabinet。
- 已展示商品維持原位。
- display 全滿時不替換玩家原本陳列。

V9 regression 仍全部通過：

- 商品配方只使用九種正式 village tiered resources。
- arrowdew / gachaToken 不進配方。
- fur / potion / archer 都有實際商品用途。
- T1 / T2 不要求後段資源。
- 金幣加工費 = 0。
- `SHOP_GOOD_STOCK_CAP = 999`。
- MAX 按實際 craftCount 扣料。

Production build：

```bat
set CI=true&& npx react-scripts build
```

- ✅ **Compiled successfully**。
- 本次本機 bundle：`build/static/js/main.58709424.js`。
- 僅既有 CRA bundle-size / Node deprecation warnings。

Diff check：

```bat
git diff --check -- src/lib/shopGoodsCatalog.js src/lib/villageShop.js src/lib/villageShopDb.js src/lib/villageShopLive.js src/components/member/ShopSimulatorV3.jsx src/lib/villageShop.test.js
```

- ✅ 通過。

實際 source fingerprint 已確認：

- `getShopTierOverflowEntries`
- `getShopQuickRefillPlan`
- `材料爆倉雷達`
- `V11 exact-tier 爆倉雷達與快速補貨`

---

## 16. 版本與部署狀態

正式站：

- V5。
- commit `f89f9877 feat: launch cat village shop simulator`。

本機：

- **V11**。
- 尚未 commit。
- 尚未 deploy。

V11 直接新增／修改重點：

- `src/lib/shopGoodsCatalog.js`
- `src/components/member/ShopSimulatorV3.jsx`
- `src/lib/villageShop.test.js`

V10 尚未提交的商店邏輯仍包含：

- `src/lib/villageShop.js`
- `src/lib/villageShopDb.js`

V8/V9 既有本機商店修改另包含：

- `src/lib/villageShopLive.js`
- 上述 active UI / catalog / tests / DB 檔。

工作區另有探索地圖／事件系統未完成修改。

**部署時禁止 `git add .`，只 stage 確認過的商店檔案。**

---

## 17. 下一步優先順序

V11 已完成兩個主要操作痛點：

- 不再只看到五階合計，而能找到真正爆量的 exact Tier。
- 不必回工坊找已上架缺貨商品，可直接補到安全量 30。

後續優先：

1. **專屬商店美術／室內背景。**
2. **24 種商品 archetype 正式插畫。**
3. 貨架／櫃台分級 sprite。
4. walking / browse / checkout 顧客動畫素材。
5. 空展示格更直覺的候選商品提示，但不得自動覆蓋玩家選擇。
6. 爆倉嚴重程度與 Tier 色階視覺化，但不要做成資料 dashboard。
7. 手機實機 QA。

不應優先把商店擴充成獨立複雜經營遊戲；每個新功能都先問：

> **它有沒有幫助射箭玩家消耗貓貓村過剩資源，或讓這個材料 sink 更有趣、更容易使用？**
