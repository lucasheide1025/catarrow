# 🎯 貓小隊專案架構分析與重構清理報告 (For Claude Code Review)

> **報告說明**：本報告專為後續由 Claude / 開發團隊進行代碼與檔案重構設計。內容涵蓋專案架構分析、大型檔案拆解建議、可抽離之共用 UI 與邏輯元件、未使用圖檔與廢棄資源掃描，以及模組化優化建議。

---

## 📑 報告目錄
1. [專案整體架構概覽](#1-專案整體架構概覽)
2. [大型單體檔案拆解建議 (Monolithic Files)](#2-大型單體檔案拆解建議-monolithic-files)
3. [可拆解與抽離之共用元件 (Candidate Shared Components)](#3-可拆解與抽離之共用元件-candidate-shared-components)
4. [資源與圖檔清理建議 (Unused & Duplicate Assets)](#4-資源與圖檔清理建議-unused--duplicate-assets)
5. [代碼與架構優化建議 (Architecture & Quality Standards)](#5-代碼與架構優化建議-architecture--quality-standards)
6. [建議重構執行路線圖 (Refactoring Roadmap)](#6-建議重構執行路線圖-refactoring-roadmap)

---

## 1. 專案整體架構概覽

專案 `catarrow`（貓小隊射箭場系統）採用 React 19 + TailwindCSS + Firebase Firestore 打造，包含前台射手端 (`MemberApp.jsx`)、教練管理後台 (`AdminApp.jsx`)、訪客與體驗端 (`GuestApp.jsx`) 以及線上約課前台 (`PublicBookingApp.jsx`)。

- **`src/pages/`**：包含 6 個主要入口頁面，包含大量狀態管理與路由導覽。
- **`src/components/`**：包含 12 個子目錄，管理 admin、booking、dungeon、worldboss、battle、shared 等模組。
- **`src/lib/`**：包含 160+ 個數據邏輯模組與 Firestore 操作函式。
- **`public/`**：存放 15+ 個靜態圖檔與音效目錄（包含 monsters、art、items、sounds、ui 等）。

---

## 2. 大型單體檔案拆解建議 (Monolithic Files)

以下檔案體積龐大（部分超過 40KB~250KB），包含了過多的業務邏輯、UI 渲染與狀態管理，建議優先進行模組化拆解：

| 檔案路徑 | 目前大小 | 主要職責與拆解建議 |
| :--- | :--- | :--- |
| `src/lib/db.js` | **252 KB** | **核心資料庫層過重**：包含了會員、成就、商店、裝備、每日任務、報到等多個不同領域的數據讀寫。建議按 Domain 拆分為 `memberDb.js`、`achievementDb.js`、`itemDb.js`、`learnDb.js`。 |
| `src/pages/AdminApp.jsx` | **78.7 KB** | **後台主頁面過大**：包含 4 大主選單導覽、次級 Tab 邏輯、地下城首殺廣播、全域審核彈窗。建議將 4 大分頁之導覽視圖抽離為 `src/components/admin/layout/AdminNav.jsx` 及獨立的 `Section` 元件。 |
| `src/components/admin/AdminBooking.jsx` | **66.5 KB** | **約課後台模組過重**：包含日曆容量計算、格數封鎖 Modal、修改預約 Modal (`EditBookingModal`)、結帳模組、今日課表小卡發起器。建議將彈窗與日曆繪製拆成獨立檔案。 |
| `src/pages/MemberApp.jsx` | **63.6 KB** | **射手前台主頁面**：包含主導覽、經驗條、等級提升慶祝彈窗、每日任務 Toast、簽到彈窗。建議拆出 `MemberHeader.jsx` 與 `LevelUpModal.jsx`。 |
| `src/pages/PublicBookingApp.jsx` | **50.2 KB** | **學生線上約課前台**：包含 Step 1 日期時段選擇、Step 2 方案時數人數選擇、Step 3 身份驗證與個人資料填寫、Step 4 預約確認。建議按步驟拆解為 `BookingStepDate.jsx`、`BookingStepPlan.jsx`、`BookingStepForm.jsx`。 |
| `src/components/admin/AdminMembers.jsx` | **45.6 KB** | **會員管理後台**：包含會員清單、搜尋過濾、稱號/稱號權限給予、點數/資源調整彈窗。建議拆解出 `MemberDetailModal.jsx` 與 `MemberSearchHeader.jsx`。 |
| `src/components/admin/AdminGuildQuests.jsx` | **41.6 KB** | **公會任務管理**：包含任務列表、發布 Modal、審核視圖、獎勵設定。建議抽離 `GuildQuestCreateModal.jsx` 與 `GuildQuestReviewTab.jsx`。 |

---

## 3. 可拆解與抽離之共用元件 (Candidate Shared Components)

專案中多處存在重複出現的 UI 樣式、搜尋邏輯與狀態徽章，建議抽取為 `src/components/shared/` 內的可重用元件：

### 3.1 射手搜尋自動補全選單 (`MemberSearchAutocomplete.jsx`)
- **重複出現位置**：`BillingSystem.jsx`、`AdminBooking.jsx`、`AdminGiveTool.jsx`、`AdminMonthlyCard.jsx`。
- **拆解內容**：統一射手姓名/暱稱/射手編號的搜尋輸入框、Debounce 搜尋、下拉選單展示（含早鳥標籤 `#archerNo <= 123`）與選取/清除事件。

### 3.2 狀態標籤與徽章 (`StatusBadge.jsx`)
- **重複出現位置**：`AdminBooking.jsx`、`BookingScheduleCard.jsx`、`BillingSystem.jsx`、`AdminReviewCenter.jsx`、`AdminMonthlyCard.jsx`。
- **拆解內容**：統一 `新生 (amber)`、`舊生 (blue)`、`待審核 (yellow/amber)`、`有效/無效 (emerald/slate)`、`已取消 (red)` 之顏色、字級與圖示渲染。

### 3.3 數據統計與營收卡片 (`StatCard.jsx` / `StatSummaryBanner.jsx`)
- **重複出現位置**：`BillingSystem.jsx`、`AdminFinance.jsx`、`AdminCompetitions.jsx`、`AdminDailyQuest.jsx`。
- **拆解內容**：漸層背景、大字體金額/筆數展示、小標題與副標題組件。

### 3.4 通用篩選列與日期區間選擇器 (`FilterBar.jsx` & `DateRangePicker.jsx`)
- **重複出現位置**：`BillingSystem.jsx`、`AdminMembers.jsx`、`AdminCompetitions.jsx`、`AdminDailyQuest.jsx`。
- **拆解內容**：年份、單月、今日切換按鈕組與日期選擇器。

### 3.5 約課方案人數選擇器組件 (`PlanPickerGroup.jsx`)
- **重複出現位置**：`PublicBookingApp.jsx`、`AdminBooking.jsx` (EditBookingModal)。
- **拆解內容**：`PlanDurationPicker` 與 `ParticipantCountPicker` 可進一步封裝成包含價格即時試算的統一組合元件。

---

## 4. 資源與圖檔清理建議 (Unused & Duplicate Assets)

經掃描專案檔案結構，以下圖檔與靜態資源存在目錄重複或疑為廢棄備份情況，建議進行安全檢視與清理：

### 4.1 目錄重複與資源位置整理
1. **`public/assets/dungeon` 與 `src/assets/dungeon` 重複**：
   - 目前地下城地圖/道具圖案同時出現在 `public/assets/dungeon` 與 `src/assets/dungeon` 中。
   - **建議**：透過 `<img>` 載入的靜態圖片統一歸納至 `public/assets/dungeon/`；若由 JS `import` 引用，則統一留在 `src/assets/`，刪除另一方的重複檔案。
2. **`public/archery-poc/` 檔案檢視**：
   - 包含早期的 POC (Proof of Concept) 測試圖片與 HTML。若 `AdminArchery.jsx`（射箭辨識功能）已正式上線且不再引用 POC 目錄，可安全歸檔或移除。

### 4.2 疑為廢棄/測試專用的代碼與檔案
1. **`src/lib/` 內的部分微型測試檔**：
   - `dungeonExpansionSmoke.test.js`
   - `stripUndefinedDeep.test.js`
   - `fxSettings.test.js`
   - **建議**：檢視是否仍包含在 CI 自動測試流程中，若為個人開發臨時建立的測試腳本，可整理至 `tests/` 或進行清理。
2. **內嵌大容量 SVG/JSON 數據檔案**：
   - `src/components/MonsterSVG.jsx` (62.2 KB)：內含極長之 inline SVG 與路徑字串。
   - `src/lib/achievementDex.js` (73.5 KB) & `src/lib/dungeonCollectibles.js` (41.5 KB)：靜態資料庫表。
   - **建議**：可考慮移至 `src/data/` 或透過動態 JSON `import()` 載入，減少主要 bundle 體積。

---

## 5. 代碼與架構優化建議 (Architecture & Quality Standards)

1. **全面統一暗黑模式 (Dark Mode) 樣式 Token**：
   - 專案中部分舊元件（如 `BillingSystem.jsx`、`AdminMonthlyCard.jsx`）原先使用行內 `style={{ background: "white" }}`，在深色背景下易產生高對比或白底白字問題。
   - **建議**：統一使用 TailwindCSS 類別（例如 `bg-slate-900` / `bg-slate-800` / `text-slate-100` / `border-slate-700`），並禁用未定顏色值的純 `input` 標籤。
2. **JSDoc / TypeScript 類型標註**：
   - `bookingDb.js`（約課系統）、`dungeonDb.js`（地下城系統）包含複雜的事務處理（Transactions）與型別假設。
   - **建議**：為核心交易函式補上 JSDoc `@param` 與 `@returns` 標註，降低維護門檻。
3. **避免 Props 深度傳遞 (Prop Drilling)**：
   - `AdminApp.jsx` 中將多個待審核數據、使用者 profile 跨多層傳遞給子 Hub 與視圖。
   - **建議**：可擴充 `AdminContext` 或專用 Context Provider，簡化 state 存取。

---

## 6. 建議重構執行路線圖 (Refactoring Roadmap)

### Phase 1: 高效益共用元件抽取 (Low Risk, High Gain)
- [ ] 抽離 `MemberSearchAutocomplete.jsx`（射手自動搜尋）
- [ ] 抽離 `StatusBadge.jsx`（狀態徽章）
- [ ] 抽離 `StatCard.jsx`（數據統計卡片）

### Phase 2: 大型頁面與組件模組化 (Medium Risk)
- [ ] 拆解 `AdminBooking.jsx`（將 `EditBookingModal` 與 `BookingScheduleCard` 正式獨立至元件檔）
- [ ] 拆解 `PublicBookingApp.jsx`（按約課 Step 1~4 拆分）
- [ ] 拆解 `AdminApp.jsx` 頂部與選單導覽

### Phase 3: 資料庫邏輯層解耦 (High Risk, Need Tests)
- [ ] 將 `src/lib/db.js` (252 KB) 拆分為獨立的 Domain DB 檔案
- [ ] 清理與歸檔 `public/archery-poc/` 及重複圖檔目錄

---
*報告完成時間：2026-07-21 | 生成自 Antigravity AI Assistant*
