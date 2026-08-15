# 程式碼新舊並存清查報告（給 CODEX 重整用）

- 產出日期：2026-08-09（盤點基準：HEAD = `b7e68b35`）
- 目的：整頓/優化前，先確認「哪些是現役、哪些是孤兒、哪些是死碼、哪些文件已過時」，避免重整時誤刪現役邏輯或保留兩套實作。
- 方法：git status/diff/log + 全 src/functions 引用追蹤（誰 import 誰、誰呼叫誰）。

---

## 0. 一句話結論

Repo 目前有三批未提交工作並存（**商店 V6~V11＋CODEX 場景化**、**探索地圖 08-08 事件卡**、**背包/音效小改**），加上一批孤兒與死碼（V2 商店 UI、舊兌換函式、市集兌換設定）與**已過時的文件**（V1 spec、V2 交接文件）。重整的最大風險不是刪錯檔，而是 **commit 時混批** 與 **拿過時文件當真相源**。

---

## 1. 商店系統：版本演進與現況

| 世代 | 檔案 | 狀態 | 說明 |
|---|---|---|---|
| V1 兌換面板 | `CatVillage.jsx` 內 `MarketExchangePanel` / `BATTLE_EXCHANGE` | ✅ 已移除（f89f9877） | 舊「材料兌換」整塊刪除，nav 改「🏪 商店」 |
| V1 兌換 DB | `db.js:5244 exchangeVillageMaterial`、`db.js:5286 exchangeMaterialsForChest` | ⛔ **死碼** | 全 repo 無呼叫端，只剩定義 |
| V1 市集設定 | `db.js getVillageMarketConfig/saveVillageMarketConfig/subscribeVillageMarketConfig` ＋ `AdminVillageManager.jsx` 的 `DEFAULT_BATTLE_EXCHANGE` 兌換設定編輯器 | ⛔ **孤兒** | 寫入 `battleExchange` 設定但**已無任何讀取端**（CatVillage 的消費端在 V2 整合時移除） |
| V2 商店 UI | `src/components/member/ShopSimulator.jsx`（833 行，場景式遊戲 UI） | ⛔ **孤兒** | **從未被 commit、無人 import**（唯一引用者是它自己）。內含可參考的 V2 遊戲化動畫手法 |
| V3 商店 UI（現役） | `src/components/member/ShopSimulatorV3.jsx`（794 行） | ✅ **現役**（未 commit 修改中） | `CatVillage.jsx:30` import 它。f89f9877 曾 commit 287 行版本，現在工作樹 +474 行＝CODEX 場景化進行中 |
| V6~V11 經濟 | `villageShop.js` / `villageShopDb.js` / `shopGoodsCatalog.js`（未 commit 改動） | ✅ 現役 | 旺季(rush)、離線自動販售、特殊券兌換、V9 金幣成本歸零（見 §1.2） |
| V7 即時營運 | `src/lib/villageShopLive.js` | ✅ 新檔現役 | 可重播營運時間軸、三種速度 profile、顧客演出、臨時委託 |
| 美術 manifest | `src/lib/shopArt.js` | ✅ 新檔現役 | 24 顧客／商品原型／店長 manifest；元件不再拼魔法路徑 |
| 生成美術 | `public/assets/shop/`（53 檔 webp） | ✅ 新檔未 commit | 24 顧客＋商品美術（要 commit 的部分） |
| 舊但**獨立** | `src/lib/shopData.js`（金幣商店 `DAILY_SHOP_PRODUCTS` / `SPECIAL_TICKET_META`） | ✅ 仍用 | 這是**另一個商店**（背包→金幣商店 coinshop），非貓貓村商店。`villageShop.js` 有 import 它的 `SPECIAL_TICKET_META` 重用票券 meta |
| 舊但**獨立** | `src/lib/materialConversionDb.js` ＋ `ExpansionMaterialsPanel.jsx` | ✅ 仍用 | 冒險素材轉換（MemberMaterials 內、monster expansion 相關），不是貓貓村兌換，別誤刪 |

### 1.1 死碼明細（可安全刪除，但先確認無外部依賴）

| 目標 | 位置 | 證據 |
|---|---|---|
| `serveShop` | `villageShopDb.js` | 唯一呼叫端是孤兒 `ShopSimulator.jsx`；現役 V3 用 `settleVillageShopAutoSales`＋`completeLiveShopSession` |
| `exchangeVillageMaterial` | `db.js:5244` | 無呼叫端 |
| `exchangeMaterialsForChest` | `db.js:5286` | 無呼叫端 |
| 市集兌換設定（admin 編輯器＋db 三函式） | `AdminVillageManager.jsx`＋`db.js:5485-5492` | 寫入無人讀。**二選一**：刪除，或幫它接回讀取端（若想保留線上可調兌換率） |

### 1.2 ⚠️ V9 之後與 V1 spec 的重大分歧（改 code 前必讀）

- **製作金幣成本歸零**：`shopGoodsCatalog.js` 的 `TIER_GOLD` 全部改為 `0`（註解：商店是「貓貓村材料去化器」，不是金幣消耗線）；真正成本只來自 `village.resources`。
- **庫存上限 99 → 999**：`SHOP_GOOD_STOCK_CAP = 999`。
- **新增機制**：旺季秒數（10 箭/分鐘、上限 30 分鐘、冪等發放）、離店自動販售（rate 0.2 vs 手動 0.5 vs 旺季 1.0）、特殊券每日獨立額度（`exchange.daily.specialTickets`）、店長（`selectVillageShopManager`）。
- **資料契約**：`shop.level` 真相源是 `stats.totalRevenue`（別直接改 level）；新欄位（`rushSeconds`、`rushArrowRemainder`、`rushClaimedArrowTotal`、`lastAutoSaleAt`、`exchange.daily.specialTickets`）由 `normalizeShop()` 補預設，舊存檔相容。

### 1.3 📄 文件過時（別再拿它們當規格）

| 文件 | 世代 | 問題 |
|---|---|---|
| `docs/second_brain/village-shop-simulator-spec.md` | V1 | 假設金幣成本、庫存上限 99、純兌換循環——與 V9 金幣歸零、V6~V11 旺季/離線/特殊券、CODEX 場景化全都不符 |
| `docs/second_brain/handoff-village-shop-gpt.md` | V2 世代 | 交接時點是 V2 遊戲化 UI，同樣過時 |
| **現行真相源** | — | `.trellis/tasks/08-09-fix-new-village-shop/{prd,design,implement}.md`（CODEX 任務文件）|

### 1.4 命名混淆提醒

「**金幣商店**」（coinshop，背包入口，`shopData.js`）與「**貓貓村商店**」（village shop，`villageShop*.js`）是兩個不同系統但共用「商店」字眼；重整時用詞與資料夾命名要區分清楚（建議 `src/lib/shop/` vs `src/lib/coinshop/` 或保留 `shopData.js` 原位並註明）。

---

## 2. 探索地圖：事件卡系統（08-08 恢復）

| 項目 | 狀態 |
|---|---|
| `src/components/member/EventScene.jsx`（3:4 直立事件卡＋場景圖） | ✅ 新檔現役，solo＋team 都接 |
| `src/lib/boardEvents.js` 新增 `eventSceneOf` / `describeEventEffect` / `drawBoardEvent(deck, {movement})` | ✅ 現役 |
| `public/assets/board/event_*.webp` ×19 | ✅ 新檔未 commit（正式美術） |
| `scripts/gen-event-scenes.py` | ✅ 新檔未 commit（事件圖生成腳本，建議保留） |
| 舊「純金幣不翻卡」邏輯 | ✅ **已完全清除**（全 repo 搜無殘留字串） |
| solo vs team 差異 | ⚠️ **刻意設計**：team 只抽資源類事件（`movement:false` 排除 move/teleport/trigger/multiplier，共享棋不動）；solo 用完整事件池。重整時別「統一」掉 |

---

## 3. 其他進行中改動（非商店）

| 檔案 | 改動 | 注意 |
|---|---|---|
| `DailyQuest.jsx` | 下課成功後呼叫 `claimVillageShopRushTime`，toast 顯示旺季秒數 | 商店機能接線 |
| `MemberInventoryHub.jsx`＋`MemberInventoryHub.test.jsx` | **方向逆轉**：把「文字按鈕」改回「圖片磁磚」（從 git 歷史 `fbe814be^` 回復五張 HubTile webp） | 這是**刻意**回復（CODEX implement.md 第 7 步），重整時別再改回去 |
| `src/lib/sound.js` | `SFX_VERSION` 1→2、SAMPLE_NAMES 加 `shop_buy` | 換音檔後版本號要 +1（檔案頭註解有寫） |
| `public/sounds/shop_buy.mp3` | 新收銀音效 | 要 commit |
| `CatVillageBoard.jsx` / `CatVillageBoardTeam.jsx` / `villageBoardDb.js` / `villageBoardTeamDb.js` | EventScene 接線＋事件效果套用 | 探索地圖批次 |

---

## 4. 暫存／生成物／工具檔（commit 時要排除或分類）

| 路徑 | 內容 | 建議 |
|---|---|---|
| `tmp-*.html` ×4（cardgacha/event-cards-v2/event-scenes/tile preview） | 本機 preview 頁 | 排除（歷史慣例） |
| `tmp/` 整包（數百張 PNG） | imagegen 來源圖（怪獸/商店 manager/顧客 source）、`cat.cjs`/`eco.cjs` 等 | ⚠️ **未進 .gitignore**，建議加入後再重整；`tmp/customer-check-*.png`、`tmp/imagegen/shop-managers/`、`shop-source/` 都是生成暫存 |
| `.coding-tools/` | CODEX 工具狀態（performance/task json） | 工具檔，勿 commit |
| `.trellis/tasks/08-09-fix-new-village-shop/`、`08-09-fix-world-boss-home-ranking/` | CODEX 任務文件（**現行商店設計真相源**） | 歷史慣例 task 文件不 commit；但 design.md 內容很關鍵，重整前請先讀 |
| `.trellis/workspace/your-name/*`、`.trellis/spec/frontend/cat-village-gathering.md` | CODEX workspace 筆記（被修改） | 勿混進功能 commit |
| `public/assets/shop/`、`public/assets/board/event_*.webp`、`public/sounds/shop_buy.mp3` | 正式美術/音效 | ✅ 要 commit（跟各自功能批次） |

---

## 5. 已知被修復的「重複定義」類 bug（重整時要防範）

- `functions/index.js` 曾把 `requireAdmin` 定義兩次，後定義蓋前定義 → 所有管理動作的 `adminId` 變 `undefined`、Firestore 寫入靜默失敗（commit `a0e02970` 已修）。
- 重整時建議加入檢查：`grep -oE "^(async )?function [a-zA-Z_]+" <file> | sort | uniq -d` 與 `exports.` 重複檢查（目前 functions/index.js 已無重複）。

---

## 6. 驗證現況（重整前後都要跑）

| 項目 | 現況 |
|---|---|
| 前端 build | ✅ 通過（`CI=true npx react-scripts build`） |
| 前端測試 | ✅ 2015+ tests 全過（含商店 focused tests、ShopSimulatorV3 module smoke、MemberInventoryHub.test） |
| functions 測試 | ✅ 71/71（`cd functions && node --test`） |
| 部署 | ❌ 商店/探索地圖全部未 commit 未部署（只有訪客評價兩批已上線） |

---

## 7. CODEX 重整建議（依優先級）

### P0 安全（必做）
1. **絕不用 `git add -A`**。至少三批未提交工作並存，必須分批 commit：
   - 批①商店：`villageShop*.js`、`shopGoodsCatalog.js`、`villageShopLive.js`、`shopArt.js`＋test、`ShopSimulatorV3.jsx`＋test、`public/assets/shop/`、`public/sounds/shop_buy.mp3`、`DailyQuest.jsx`、`sound.js`、`CatVillage.jsx`（若本次有動）
   - 批②探索地圖：`EventScene.jsx`、`boardEvents.js`、`CatVillageBoard*.jsx`、`villageBoard*Db.js`、`event_*.webp`、`scripts/gen-event-scenes.py`
   - 批③背包/其他：`MemberInventoryHub.jsx`＋test
   - 批④訪客評價：已 commit（`b7e68b35` 前兩筆）
2. **排除**：`tmp-*.html`、`tmp/`、`.coding-tools/`、`.trellis/tasks/*/`。建議把 `tmp/` 加進 `.gitignore`。

### P1 刪死碼（減半理解成本）
- 刪 `ShopSimulator.jsx`（V2 孤兒；若要留動畫參考，先複製到 docs 或刪前截圖）。
- 刪 `serveShop`（villageShopDb）。
- 刪 `exchangeVillageMaterial` / `exchangeMaterialsForChest`（db.js）。
- 市集兌換設定：**二選一**（刪 admin 編輯器＋db 函式，或接回讀取端）。

### P2 對齊文件與命名
- 把 `village-shop-simulator-spec.md`／`handoff-village-shop-gpt.md` 標 deprecated 並指向 `.trellis/tasks/08-09-fix-new-village-shop/design.md`（或直接更新）。
- 統一「金幣商店」vs「貓貓村商店」用詞與資料夾。

### P3 結構（等商店場景化完成後再動）
- 考慮把商店模組收進 `src/lib/shop/` 子資料夾；`ShopSimulatorV3` 在 CODEX 場景化收尾後可正名 `ShopSimulator`（先別改，避免與孤兒 V2 混淆時 commit 錯檔）。
- 美術路徑維持走 `shopArt.js` manifest，別在元件拼路徑。

### P4 測試
- 保留 `villageShop.test.js`（574 行新增：rush/特殊券/normalize 舊存檔 fixture）與 `ShopSimulatorV3.test.jsx`（module-load 回歸，防 `SHOP_VILLAGE_RESOURCE_META` 那類入口崩潰再犯）。
- 刪死碼時同步清理引用它的測試與 import。

---

## 8. 資料契約速查（動商店 code 前必讀）

- `village.shop` 走既有 `village` 白名單欄位 → **firestore.rules 不用改**。
- `shop.level` 由 `stats.totalRevenue` 推導（`getShopLevel`），勿直接寫 `shop.level`。
- 旺季欄位冪等鍵：`rushClaimedArrowTotal` checkpoint（＋transaction 防重）。
- 離線販售：`lastAutoSaleAt` 游標，進店時重放/聚合，受庫存與安全時間上限約束；只扣 `shop.stock`，缺貨即停。
- 兌換每日限量：`exchange.daily`（含 `specialTickets` 三種券獨立額度）。
