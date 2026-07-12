# 執行計畫 — UI 改版 Phase 3

設計規格見 `docs/second_brain/quick-ref.md` 的「🎨 設計系統」段（tokens、.ui-card/.ui-input、Widgets 元件、HubTile accent 限 hex）與歸檔任務 `.trellis/tasks/archive/2026-07/07-03-ui-redesign-p0/design.md`。

每 Step：先讀目標檔案 → grep 淺色 class 盤點 → 套版 → `npm run build` → 下一步。每 Step 一個 commit（主 session 收尾時處理）。

## Step 1 — 訓練系列
- [ ] MemberPractice.jsx（⚠️ classEndedRef 里程碑保護邏輯不碰）
- [ ] MemberComps.jsx / MemberScoring.jsx
- [ ] DailyQuest.jsx（⚠️ 訂閱與下課結算邏輯不碰）

## Step 2 — 排行與紀錄
- [ ] MemberLeaderboard.jsx / MemberHistory.jsx / MemberExternalComp.jsx
- [ ] MemberRecordsHub.jsx 殘留淺色區塊

## Step 3 — 我的系列
- [ ] MemberProfile / MemberAchievements / MemberNotifications / MemberMessages
- [ ] MemberLearn / MemberCertExam / MemberDex / MemberGuide / MemberBowSettings
- 注意：射手卡分享圖與 QR code 若有功能性白底，保留

## Step 4 — 背包系列
- [ ] CardCollection / MemberMaterials / CoinShop / EquipmentPage / MemberMonsterDex

## Step 5 — 全面驗證（trellis-check）
- [ ] build 無警告；4 批檔案淺色 class grep 檢查
- [ ] 教練射手模式逐頁 props 相容核對
- [ ] 功能邏輯 diff 審查（確認純視覺改動）
