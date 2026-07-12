# 執行清單 — 公會一般懸賞任務自動化

## Steps

- [ ] 1. `src/lib/adventurerSystem.js`：新增 `GENERAL_BOUNTY_TIER_DEFAULTS`、`getDailyPeriodKey`、`generateDailyGeneralBounties`
- [ ] 2. `src/lib/db.js`：新增 `autoPublishDailyGeneralBounties`、`getGeneralBountyTierConfig`、`subscribeGeneralBountyTierConfig`、`saveGeneralBountyTierConfig`
- [ ] 3. **確認 `acceptGuildQuest`/`submitGuildQuestCompletion` 對 `questSubtype==="kill_monster"` 有沒有寫死判斷**——若有，需放寬讓 `requirement.monsterId/killCount` 形狀相同的 `"general"` 任務也能走同一驗收路徑
- [ ] 4. `submitGuildQuestCompletion` 加上 `quest.bonusChest` 存在時的固定寶箱發放（`addChests` + `makeChest`）
- [ ] 5. `AdventurerGuild.jsx`：進場呼叫 `autoPublishDailyGeneralBounties`；訂閱 `subscribeGeneralBountyTierConfig`
- [ ] 6. `AdminGuildQuests.jsx`：新增「一般懸賞設定」卡片（4 階可編輯表單，仿現有晉階任務設定 UI）
- [ ] 7. 手動驗證（見下方）
- [ ] 8. 第二大腦筆記更新
- [ ] 9. Commit

## 驗證方式

- 教練後台開「一般懸賞設定」，調整某一階獎勵數值後儲存
- 會員登入公會頁，確認當天出現 4~8 個「📋 一般」標籤任務，數量分佈符合各階 count 設定
- 接受一個一般懸賞任務、實際擊殺目標怪物達標、送出，確認 xp/coins/arrowDew/gachaCoins 正確入帳，且對應難度的固定寶箱進背包
- 隔天（或修改 `guildMeta/dailyGeneralBounty` 的 periodKey 模擬跨日）確認任務批次重新生成，且套用教練剛才調整的新數值
- 確認 `getDailyGuildTasks`（克蘇魯/人質/殭屍靶）畫面與雙週怪物討伐懸賞完全沒有變化

## 風險 / Rollback

- 全新函式與新 Firestore 文件，未修改任何既有函式簽名；若有問題，教練後台可直接刪除當天 `guildQuests` 裡 `periodTag` 相符的一般懸賞文件，不影響其他任務。
