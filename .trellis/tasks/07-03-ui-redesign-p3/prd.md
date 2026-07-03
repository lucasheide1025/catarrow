# UI 改版 Phase 3：會員端逐頁套版

## Goal

把 Phase 0 建立的設計系統（tokens + 深色原生共用元件）套用到所有尚未遷移的會員端頁面，讓這些頁面不再依賴 `.content-area` 淺色覆寫層，全站視覺一致。

## Requirements

按使用頻率分 4 批，每批一個 Step：

1. **訓練系列**：MemberPractice / MemberComps / MemberScoring / DailyQuest
2. **排行與紀錄**：MemberLeaderboard / MemberHistory / MemberExternalComp / MemberRecordsHub 殘留區塊
3. **我的系列**：MemberProfile / MemberAchievements / MemberNotifications / MemberMessages / MemberLearn / MemberCertExam / MemberDex / MemberGuide / MemberBowSettings
4. **背包系列**：CardCollection / MemberMaterials / CoinShop / EquipmentPage / MemberMonsterDex

每頁的套版標準：
- 淺色 Tailwind class（bg-white / bg-gray-* / text-gray-* 深字色 / border-gray-*）改為 token 或共用元件（Card/`.ui-card`、`.ui-input`、SectionHeader、StatBar…）
- 區塊標題統一用 SectionHeader；空狀態用 Empty；載入用 Skeleton 或 Spinner
- 觸控目標 ≥44px、手機優先（390px）
- **只改視覺與排版，功能邏輯/資料流零改動**

## Constraints

- `.content-area` 覆寫層仍保留（AdminApp 後台頁還沒遷移）
- 戰鬥相關頁（MonsterBattle/Party/Duel/Dungeon/WorldBoss/議會廳）**不在本任務範圍**（已自帶深色，另案處理）
- CatVillage / BillingSystem 不動
- MemberPractice 的 `classEndedRef` 里程碑保護、DailyQuest 的訂閱邏輯等功能機制不得觸碰
- 不從 UI 元件檔 re-export 常數（循環 import 坑）
- 教練射手模式 render 同一批元件，props 不得改出 breaking change

## Acceptance Criteria

- [ ] `npm run build` 通過無警告
- [ ] 4 批頁面淺色 class 清除（grep `bg-white|bg-gray-50|text-gray-8` 在這些檔案應趨近零命中，QR code 等功能性白底除外）
- [ ] 教練射手模式逐頁不空白
- [ ] 功能行為與改版前一致（純視覺改動）
