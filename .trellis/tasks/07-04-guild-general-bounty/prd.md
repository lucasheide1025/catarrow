# 冒險者公會一般懸賞任務自動化

## Goal

在冒險者公會導入新的「一般懸賞任務」類別：每天隨機刷新、共 4 個難度等級、獎勵（金幣/經驗/寶箱/箭露/轉蛋幣）依難度調整，且教練後台可以新增/調整任務範本與各難度獎勵。與現有兩套系統明確區分、互不影響。

## 確認事實（探索程式碼所得）

- **現有系統①「每日靶紙任務」**（`src/lib/adventurerSystem.js::getDailyGuildTasks(date)`）：用日期當 seed 產生全員相同的一批任務，使用克蘇魯靶/人質靶/殭屍靶（`TARGET_ZONES`），純前端函式、無 Firestore 儲存、教練後台無法調整內容。**使用者明確要求保留，不動它**。
- **現有系統②「雙週怪物討伐懸賞」**（`generateBiWeeklyBounties` + `autoPublishBountyQuests`）：`questSubtype:"kill_monster"`，6 階（common~mythic，對應怪物 FAMILIES/TIER），雙週（14天）刷新一次，用 `guildMeta/bountyPeriod` 文件防重複發佈，發佈後寫入 Firestore `guildQuests` collection，可用既有 `updateGuildQuest`/`deleteGuildQuest`/`updateGuildQuestStatus` 管理**單筆已發佈的任務實例**，但生成規則（歸屬階級、獎勵倍率）寫死在 `BOUNTY_TIER_CONFIG` 常數，教練無法調整生成規則本身。
- **教練後台已有的公會任務管理**（`AdminGuildQuests.jsx`）：手動發佈單一任務表單已支援 `questSubtype:"general"`（📋 一般，`SUBTYPE_LABEL` 已定義），可個別發佈/編輯/刪除/上下架，但**沒有「範本池」概念、沒有自動刷新機制**。
- **`publishGuildQuest`／`submitGuildQuestCompletion`（db.js）**：既有的任務發佈與完成獎勵發放流程（XP/金幣/箭露/轉蛋幣直接發放，徽章任務另走審核），本次新系統應該沿用這條既有發佈/完成/發獎路徑，不用重新發明。
- **自動刷新的既有模式**：`autoPublishBountyQuests(monsters)` 是「前台進入公會頁時呼叫，用 `guildMeta/{key}` 文件防重複」的 client-triggered 模式（專案無 Cloud Functions/cron，這是既有慣例）。新的每日刷新應該沿用同一種模式，不引入新的排程機制。

## 已確認的需求決策

1. ✅ 難度等級：**全新獨立 4 級**（不沿用現有六階或三階系統，自己一套命名與獎勵表）
2. ✅ 教練後台新增的是「**任務範本**」（描述+目標類型+所屬難度），系統每天從範本池自動抽選、依所屬難度套用當前設定的獎勵，發佈上架
3. ✅ 任務達成條件：**先只做「擊殺指定怪物數」**（`kill_monster` 型，比照現有雙週懸賞的判定邏輯），之後有需要再擴充
4. ✅ 刷新範圍：**全員同一批**（比照 `getDailyGuildTasks` 用日期當 seed，最簡單、無重複發佈風險）

## 待確認的需求細節

5. 教練調整「各難度獎勵」的欄位範圍：金幣/經驗/箭露/轉蛋幣/寶箱，寶箱要包含寶箱類型（木/鐵/金）還是機率骰、或保底掉落？
6. 舊任務沒完成時，隔天新一批上架，舊的怎麼處理（直接下架失效、或允許補做到期限）？
7. 每天要從範本池抽幾個上架（每難度各抽幾個、還是總數固定）？範本池數量不足某難度時怎麼辦？

## Out of Scope

- 每日靶紙任務（`getDailyGuildTasks`）與雙週怪物討伐懸賞（`generateBiWeeklyBounties`）的任何修改
- 徽章審核流程的變動
