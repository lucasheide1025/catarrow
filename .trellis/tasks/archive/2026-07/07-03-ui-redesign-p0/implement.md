# 執行計畫 — UI 改版 Phase 0-2

依序執行，每步結束跑 `npm run build` 驗證；步驟 3、6、9 為 review gate（回報給使用者看效果）。

## Step 1 — Design tokens（index.css）
- [ ] `:root` 補齊 design.md 規格的新 token（語意色/accent/圓角/陰影/玻璃卡）
- [ ] 既有 13 個變數保留原名；`.content-area` 覆寫層完整保留不動
- 驗證：`npm run build`

## Step 2 — UI.jsx 元件 token 化（dark-first）
- [ ] 先 grep `BillingSystem` 與 `CatVillage` 對 shared/UI 元件的使用情況，記錄依賴
- [ ] Card / Btn / Inp / TA / Sel / Modal / Pill / ST / Spinner / Empty / ConfirmModal / SearchBar / Toast 依 design.md 對照表改造
- [ ] API 完全向後相容（props 不刪、variant key 不刪）
- 驗證：`npm run build` + 抽查 3 個大量使用 Card/Btn 的頁面渲染

## Step 3 — 新增 Widgets.jsx ＋ theme.js 收斂 ⛳ review gate
- [ ] 新檔 `src/components/shared/Widgets.jsx`：SectionHeader / StatBar / ProgressRing / Skeleton / HubTile（API 見 design.md）
- [ ] 不從 UI.jsx re-export 任何常數
- [ ] `theme.js` 收斂為單一主題；`MemberProfile` 主題選擇器在 `APP_THEMES.length <= 1` 時隱藏
- 驗證：`npm run build`；MemberProfile 開啟無錯

## Step 4 — MemberApp header 改版
- [ ] 頭像+等級環（ProgressRing + archerLevelFromXP）、暱稱/檢定 pill、貨幣 chips、通知鈴鐺
- [ ] 資料全部用 MemberApp 既有 state/profile，不新增訂閱
- 驗證：`npm run build`

## Step 5 — 底部 nav 視覺升級
- [ ] token 化、active 指示、觸控目標 ≥44px；保留 5 tab、NAV_PRELOADS、viewTransitionName
- 驗證：`npm run build`

## Step 6 — Hub 頁統一格線 ⛳ review gate
- [ ] AdventureHub / TrainingHub / InventoryHub / RecordsHub(或 profile 入口區) 改 HubTile 2 欄格線
- [ ] 每 hub 建入口常數陣列；紅點計數沿用既有 state 下傳
- [ ] 移除 cell-*.webp 引用（檔案不刪）
- 驗證：`npm run build`；四個 hub 頁逐一開啟

## Step 7 — MemberHome 儀表板：今日卡
- [ ] 報到狀態 + 今日箭數 + 下一里程碑 ProgressRing（重用既有訂閱函式）
- 驗證：`npm run build`

## Step 8 — MemberHome 儀表板：進行中卡＋重排＋快速入口
- [ ] 遠征 3 槽倒數 / 村目標 / 世界王入口（條件渲染）
- [ ] 既有區塊（等級卡/收藏格/月卡/廣播）套新 Card 重排
- [ ] 快速入口 4 格
- 驗證：`npm run build`

## Step 9 — 全面驗證 ⛳ review gate
- [ ] `npm run build` 最終通過
- [ ] 教練登入 → 切換射手模式 → 逐頁檢查不空白（歷史坑，必測）
- [ ] BillingSystem、CatVillage 不破版
- [ ] 未遷移頁面（比賽/練習/排行/訊息）抽查不破版
- [ ] 手機視窗寬度（390px）檢查 header/nav/home 排版

## Rollback 點
每個 Step 一個 commit；破版 revert 對應 commit 即可。

## 完工後（Phase 3 收尾，主 session 處理）
- 更新 `docs/second_brain/`（quick-ref 圖片路徑段、features、changelog）並同步 Obsidian
- commit + push（Vercel 自動部署）
