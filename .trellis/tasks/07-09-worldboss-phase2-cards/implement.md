# Implement：世界王 Phase 2 — R1~R6重製、專屬寶箱與卡片系統升級

## 執行順序（由底層資料 → 中層邏輯 → UI）

### Step 1 — 世界王資料層
- [ ] `worldBossData.js`：改寫 `WORLD_BOSSES`（18 筆，含 `rTier`/`catGroup`），`rewardByHP()` 改為 `getRewardTier()` 五檔設計，`WORLD_BOSS_ACHIEVEMENTS` 補齊 9 隻新貓的擊殺成就（原本 `slay_cat_orange/black/white` 三個要換成 9 個 `slay_cat_<catId>`）。
- [ ] 檢查所有引用 `cat_orange`/`cat_black`/`cat_white` 的地方（`Grep` 全專案）一併更新，含 `AdminWorldBoss.jsx` 建立王的下拉選單、`pixelKey` 對應的圖片資源（若無對應圖檔要先跟 PM 確認美術素材或先用貓咪既有頭像佔位）。
- 驗證：`node -e` 或單元測試跑 `getRewardByBossKey` 對 18 個 key 都要回傳非 undefined。

### Step 2 — 卡片系統底層（不含 UI）
- [ ] `monsterCards.js`：補 `FAMILY_STAT.treasure`、新增 `TIER_CARD_BONUS.worldboss`、`MAX_EQUIPPED_CARDS` 改名 `MAX_EQUIPPED_PER_STAT=3`（全專案搜尋舊名 import 並更新）、`calcEquippedBonus` 擴充回傳被動百分比欄位。
- [ ] 新檔 `worldBossCards.js`：18 筆 `WB_CARDS` 定義。
- [ ] `db.js`：新增 `addWorldBossCard`、改寫 `equipCard`/`unequipCard`（接受 `{key, source}`，per-stat 3 張上限，相容舊字串格式）。
- 驗證：手動在瀏覽器 console 或暫時測試腳本呼叫 `equipCard` 驗證第 4 張同分類卡會被拒絕、跨分類第 4 張允許。

### Step 3 — 寶箱與掉落
- [ ] `itemData.js`：新增 `CHEST_TYPES.wb_relic` + `openWorldBossRelic()`。
- [ ] `worldBossDb.js::claimWorldBossKillReward`：依 family 分支授予寶箱（六族→族寶箱＋`WB_FAMILY_TO_DUNGEON_FAMILY` 轉換，教練/貓→`wb_relic`）。
- 驗證：模擬呼叫 `claimWorldBossKillReward` for 一隻六族王 + 一隻貓王，確認 `chestInventory` 寫入的 `family`/`type` 正確。

### Step 4 — 傷害/治療公式接入被動
- [ ] `damage.js`：`calcRoundDamage`/`calcWorldBossArrowDmg` 加 `dmgBonusPct` 可選參數；`calcStandardCounter`/`calcWorldBossCounter`/`calcDungeonCounter`/`calcPartyCounter` 加 `dmgReducePct` 可選參數。
- [ ] `dungeonDb.js::processDungeonRound`、`partyDb.js::processPartyRound`：治療計算套用 `healBonusPct`；呼叫上述傷害函式時帶入自己的 `dmgBonusPct`/`dmgReducePct`（來自 `calcEquippedBonus`）。
- [ ] `WorldBossAttack.jsx`（或世界王傷害計算所在檔案）：同樣接入 `dmgBonusPct`/`dmgReducePct`。
- 驗證：裝備 3 張 worldboss/atk 測試卡後打同一隻怪物，傷害數字應比未裝備高約 9%（可用 console.log 比對兩次結果）。

### Step 5 — `CardCollection.jsx` 全面重寫
- [ ] 讀取 `wbCards`，合併卡片清單並標記 `source`。
- [ ] 分類籤（全部/HP/ATK/DEF/世界王）取代階級籤。
- [ ] 已裝備三欄（各3格+空格佔位）。
- [ ] 卡片列表改九宮格小卡片版型；`source==="wb"` 套全息邊框 + flavor 小字；`tier==="worldboss"` 隱藏升星 UI。
- [ ] 教練王卡開出時的選屬性流程串接（沿用現有 mythic 選屬性 UI 樣式）。
- 驗證：本地 `npm start` 手動測試——切換籤、裝備/卸下、滿3張阻擋提示、世界王卡視覺是否明顯區隔。

### Step 6 — 戰鬥畫面徽章
- [ ] 新元件 `WorldBossCardBadge.jsx`。
- [ ] 掛載到 `DungeonBattleRoom.jsx`/`PartyBattleRoom.jsx`/`WorldBossAttack.jsx` 玩家名牌旁。
- 驗證：裝備世界王卡後進三種戰鬥畫面各看一次徽章是否出現；未裝備時徽章不出現。

### Step 7 — 回歸測試（每次改完既有元件都要做）
- [ ] 教練帳號切換「射手模式」，逐一開啟：怪物卡片頁、地下城房間、組隊房間、世界王攻擊畫面、世界王結算畫面 —— 確認皆不空白、無 console error。
- [ ] 檢查 `firestore.rules`：`cardCollections`、`chestInventory`、`worldBossEvents` 現有規則已足夠開放（Step 1-3 已核對過，實作中若發現新欄位落在 `members` 才需要補白名單）。

### Step 8 — 收尾
- [ ] `docs/second_brain/changelog.md` + `quick-ref.md` 更新，`cp` 同步到 Obsidian Vault。
- [ ] `npm run build` 確認無編譯錯誤。
- [ ] 依使用者指示 push 到 GitHub（Vercel 自動部署）；若有 `firestore.rules` 變更需提醒使用者手動貼 Firebase Console（本次設計預期不需要，Step 7 若發現例外要在此標註）。

## Rollback

若 Step 4（傷害公式）或 Step 5（UI 重寫）任一階段出問題導致既有戰鬥流程壞掉，優先 revert 該 Step 對應的 commit，因為 Step 1-3（資料/寶箱層）與 Step 4-6（機制/UI 層）耦合度低，可分段回退不互相影響。
