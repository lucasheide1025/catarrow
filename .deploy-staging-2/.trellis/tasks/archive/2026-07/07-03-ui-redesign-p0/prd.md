# UI 改版 Phase 0-2：設計系統+導覽+首頁

## Goal

建立全站統一的深色設計系統（design tokens + token 驅動共用元件），並套用到會員端導覽（header/底部 nav/hub 頁）與首頁儀表板，取代目前「淺色元件 + `.content-area` CSS 覆寫層」的補丁式深色方案。

## Requirements

### Phase 0 — 設計系統地基
1. `src/index.css` 的 `:root` tokens 擴充為完整 design token 集：色彩（bg/surface/elevated/text 三階/accent/gold + 語意色 success/warn/danger/info 各含 fg 與 bg 淡色版）、圓角（sm/md/lg/xl）、陰影（card/elevated）、間距節奏。
2. `src/components/shared/UI.jsx` 全部元件改為 token 驅動、深色原生（dark-first）：Card、Btn、Inp、TA、Sel、Modal、Pill、ST、Spinner、Empty、ConfirmModal、SearchBar、Toast。**API 向後相容**：既有 props（`theme`、`v`、`size`…）不得移除，`theme="light"` 呼叫點視覺上也要輸出深色 token 樣式（全站已無真正淺色頁面需求）。
3. 新增共用元件：`SectionHeader`（區塊標題列，含 icon/action slot）、`StatBar`（HP/XP 類進度條）、`ProgressRing`（圓環進度）、`Skeleton`（載入骨架）、`HubTile`（hub 入口卡，含 icon/標題/描述/紅點）。
4. `theme.js` 收斂為單一深色主題：`getAppTheme()` 永遠回傳唯一主題（API 保留不炸呼叫點）；`MemberProfile` 的主題選擇 UI 移除或改為「即將推出」隱藏。

### Phase 1 — 導覽重整
5. `MemberApp` header 重新設計：頭像+射手等級環｜暱稱+檢定級別｜金幣/箭露/轉蛋幣一列｜通知鈴鐺（含紅點）。
6. 底部 nav 視覺升級（token 化、active 指示、觸控目標 ≥44px），保留現有 5 tab 分組與 preload 邏輯。
7. 四個 hub 頁（AdventureHub/TrainingHub/InventoryHub + profile 的入口區）改用統一 `HubTile` 格線，取代 cell-*.webp 底圖卡。

### Phase 2 — 首頁儀表板
8. `MemberHome` 重構為儀表板：
   - 今日卡：報到狀態、今日箭數、下一個箭數里程碑進度
   - 進行中卡：遠征倒數（expeditions 3 槽）、村目標進度、世界王入口（有活動才顯示）
   - 保留既有：等級卡、公會等級 pill、收藏進度格、月卡、廣播分類
   - 快速入口格（常用功能捷徑）

## Constraints

- **不動任何戰鬥邏輯、Firestore 讀寫、資料結構**。純 UI 表現層。
- webp 圖片：`battle-bg/` 戰鬥背景與 badge-frame 保留；cell-*.webp 入口卡底圖以 CSS 漸層取代。
- `.content-area` 覆寫層**暫時保留**（保護未遷移頁面），不得刪除。
- `BillingSystem`（自帶淺色主題）與 `CatVillage`（`.no-override`）不得破版 — 改元件預設樣式前先確認這兩處的使用方式。
- 共用常數不放 UI 元件再 re-export（會循環 import）。
- Mobile-first：主要使用裝置為手機。
- 保留 View Transitions 與 lazy loading/preload 既有機制。

## Acceptance Criteria

- [ ] `npm run build` 通過
- [ ] 會員端首頁、header、底部 nav、四個 hub 頁為新設計系統，視覺一致
- [ ] 教練切換「射手模式」所有會員頁面正常顯示（不空白）
- [ ] BillingSystem、CatVillage 不破版
- [ ] 未遷移的舊頁面（比賽/練習/排行等）不破版（覆寫層仍生效）
- [ ] 主題選擇收斂後 `MemberProfile` 不報錯
