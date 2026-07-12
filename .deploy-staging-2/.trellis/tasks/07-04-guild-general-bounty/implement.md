# 執行清單 — 冒險者公會一般懸賞任務自動化

## ⚠️ 環境提醒

工作目錄目前有其他並行工作在進行（`.trellis/tasks/07-04-battle-shot-analysis/`、`07-04-cat-village-gathering-rework/` 等，`src/lib/db.js`、`AdventurerGuild.jsx` 等共用檔案可能已有未提交的變更）。**只新增程式碼，不要刪除/覆寫看起來跟本任務無關的既有內容**；修改 `db.js` 前務必先 `Read` 抓最新內容，用小範圍 `Edit` 插入新函式，不要整段重寫。

## Steps

- [ ] 1. **`adventurerSystem.js`**：把 `makeSeedRand`（約159行，目前沒有 `export`）加上 `export`，供 `db.js` 匯入使用。
- [ ] 2. **`db.js` 新增**：
  - `DEFAULT_BOUNTY_REWARDS` 常數（4 個難度的預設獎勵，見 design.md）
  - `getGuildBountyTemplates()` / `createGuildBountyTemplate(data, adminId)` / `updateGuildBountyTemplate(id, data, adminId)` / `toggleGuildBountyTemplateActive(id, active, adminId)`（範本 CRUD，collection `guildBountyTemplates`）
  - `getGuildBountyRewards()` / `setGuildBountyRewards(rewardsObj, adminId)`（獎勵表讀寫，collection `guildBountyRewards`，文件id固定`config`）
  - `autoPublishDailyGeneralBounties()`（見 design.md 完整邏輯：下架昨天舊任務 → 讀範本池+獎勵表 → 用日期seed各難度抽1個 → 依獎勵表組裝發佈 → 寫 `guildMeta/dailyGeneralBounty` 防重複）
  - `submitGuildQuestCompletion` 擴充：若 `quest.bountyDifficulty` 存在，額外呼叫 `addChests(memberId, [chest])` 發放對應難度的寶箱
- [ ] 3. **`src/components/member/AdventurerGuild.jsx`**：元件掛載時呼叫一次 `autoPublishDailyGeneralBounties()`（比照既有 `autoPublishBountyQuests` 的呼叫慣例，找現有呼叫點旁邊加一行，不要動到既有那行）；任務卡片顯示 `bountyDifficulty` 難度徽章（`bountySource==="daily_general"` 時顯示）。
- [ ] 4. **`src/components/admin/AdminGuildQuests.jsx`**：新增一個 tab（例如 `tab==="bounty"`），底下渲染新元件 `AdminGuildBountyTemplates.jsx`。
- [ ] 5. **新增 `src/components/admin/AdminGuildBountyTemplates.jsx`**：
  - 範本清單（4 個難度分組），新增/編輯/停用範本表單
  - 難度獎勵表編輯區（4 組 xp/coins/arrowDew/gachaCoins + chestType 下拉）
  - 「立即重新產生今日任務」按鈕（呼叫 `autoPublishDailyGeneralBounties()`）
- [ ] 6. **`firestore.rules`**：新增 `guildBountyTemplates`、`guildBountyRewards` 兩個 collection 規則（read: isLoggedIn，write: isAdmin），提醒使用者需要手動貼到 Firebase Console。
- [ ] 7. 跑 `CI=true npm run build` 確認編譯通過。
- [ ] 8. 更新第二大腦筆記（quick-ref.md 補公會懸賞新函式速查、features.md 補功能項、changelog.md 補當次改動）。
- [ ] 9. 不要 git commit（交給後續 check + 使用者確認）。

## 驗證方式

- 手動檢查：`autoPublishDailyGeneralBounties()` 第二次呼叫（同一天）應該回傳 `{ok:true, reason:"already_exists"}`，不重複發佈。
- 手動檢查：範本池某難度為空時，`picks` 陣列該難度被跳過，不會噴錯誤，也不會少了其他難度的任務。
- 手動檢查：`submitGuildQuestCompletion` 對一般懸賞任務結算時，`chestInventory/{memberId}` 確實新增一筆對應 `chestType` 的寶箱。
- 若有瀏覽器可測試：進冒險者公會頁面，確認出現 4 個新的「一般懸賞」任務卡片，難度徽章正確；教練後台能新增範本、調整獎勵、看到「立即重新產生」正常運作。

## 風險與回滾

- 全新 collection + 全新函式，不修改任何現有函式簽名（`submitGuildQuestCompletion` 只是新增可選欄位判斷，原本呼叫端不受影響）。
- 若新功能有問題，教練可以直接把 `guildBountyTemplates` 全部設 `active:false`，`autoPublishDailyGeneralBounties()` 就不會發佈任何新任務，不影響既有兩套系統運作。
