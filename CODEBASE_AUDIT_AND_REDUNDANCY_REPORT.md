# 🔍 貓小隊全程式碼審查、呼叫診斷與雙層重複功能報告 (For Claude Review)

> **報告說明**：本報告專為 Claude 與開發團隊設計，深度稽核全專案 160+ 個 JS/JSX 檔案。詳細列出**程式碼呼叫錯誤 (Calling Errors)**、**雙層重複/重疊實作 (Redundant & Duplicate Implementations)**、**潛在記憶體洩漏 (Memory Leaks)** 與 **結構性重構重點**。

---

## 📑 報告目錄
1. [🚨 重複套用與雙層實作診斷 (Duplicate & Redundant Implementations)](#1-重複套用與雙層實作診斷-duplicate--redundant-implementations)
2. [⚠️ 潛在呼叫錯漏與代碼 Smell 診斷 (Calling Errors & Code Smells)](#2-潛在呼叫錯漏與代碼-smell-診斷-calling-errors--code-smells)
3. [🧹 未釋放訂閱與記憶體洩漏風險 (Uncleaned Subscriptions)](#3-未釋放訂閱與記憶體洩漏風險-uncleaned-subscriptions)
4. [📦 大體積內嵌 Bundle 與效能優化 (Bundle Optimization)](#4-大體積內嵌-bundle-與效能優化-bundle-optimization)
5. [🛠️ Claude 修正與重構建議指令表 (Actionable Refactoring Tasks)](#5-claude-修正與重構建議指令表-actionable-refactoring-tasks)

---

## 1. 🚨 重複套用與雙層實作診斷 (Duplicate & Redundant Implementations)

專案在經歷多次版本迭代後，出現了部分功能在不同層級「套用兩層」或「重複實作」的情況：

### 1.1 資料庫存取層兩層架構重複 (`db.js` vs `bookingDb.js` / `duelDb.js`)
- **問題診斷**：
  - `src/lib/db.js` (252 KB) 內含有 `getBookings()`、`addBillingRecord()`、`getMembersForBilling()` 等多元件資料庫查詢。
  - 後續建立的 `src/lib/bookingDb.js` (36.7 KB) 亦針對約課實作了 `createBooking()`、`updateBooking()`、`cancelBooking()`，甚至 `db.js` 與 `bookingDb.js` 分別維護了部分重疊的讀取邏輯。
- **風險與影響**：同一個 Firestore Collection（如 `bookings`）存在兩套寫入與查詢邏輯，容易導致計數器或手動微調時出錯。
- **重構建議**：將 `db.js` 拆解，約課邏輯**完全歸集中在 `bookingDb.js`**，會計記帳完全歸集中在 `billingDb.js`。

### 1.2 檢定與弓種階級判定邏輯重複 (`constants.js` vs `archeryGrade.js`)
- **問題診斷**：
  - `src/lib/constants.js` 定義了 `getCertLevelByScores()` 與 `certLevelStyle()` 函式。
  - `src/lib/archeryGrade.js` 同樣定義了 `calcArcheryGrade()` 與等級對照表。
- **風險與影響**：若檢定分數門檻（如全配反曲弓中級分數）在 `constants.js` 修改，`archeryGrade.js` 可能未同步更新，造成前後台算出的階級不一致。
- **重構建議**：將弓種門檻、階級對照及分數計算**統一匯入自 `constants.js`**，廢棄 `archeryGrade.js` 中的硬編碼副本。

### 1.3 射手搜尋與自動補全邏輯重複 (Auto-Complete Search)
- **問題診斷**：
  - `BillingSystem.jsx` 實作了 `memberQuery`、`memberSuggestions` 自動補全過濾。
  - `AdminBooking.jsx` 與 `AdminGiveTool.jsx` 以及 `AdminMonthlyCard.jsx` 分別獨立編寫了一套對 `allMembers` 的 `.filter(m => m.name.includes(q))` 下拉選單。
- **風險與影響**：每一頁的搜尋防手震 (Debounce)、早鳥標籤判斷、暱稱顯示格式不一，且改動樣式時需修改 4 個檔案。
- **重構建議**：抽離為 `src/components/shared/MemberSearchAutocomplete.jsx` 共用元件。

### 1.4 時間與日期格式化函式重複 (`bookingSchedule.js` vs `constants.js`)
- **問題診斷**：
  - `constants.js` 包含 `fmtDT()`、`fmtDate()`、`today()`。
  - `bookingSchedule.js` 包含 `todayStr()`、`computeEndTime()`。
- **重構建議**：將全站日期/時間轉碼與加減運算統一收納於 `src/lib/dateTimeUtils.js`。

### 1.5 Modal 彈窗層重複套用包裝 (Nested Modal Wrappers)
- **問題診斷**：
  - `src/components/shared/UI.jsx` 已匯出高品質的 `<Modal>` 組件。
  - 但部分後台元件（如 `AdminCertExamModal.jsx`、`AdminMonthlyCard.jsx` 中的贈次數 Modal）仍手動編寫 `<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">`，形成了「兩層 Modal 背景」或不一致的遮罩體驗。
- **重構建議**：全面替換為 `UI.jsx` 的 `<Modal>` 統一元件。

---

## 2. ⚠️ 潛在呼叫錯漏與代碼 Smell 診斷 (Calling Errors & Code Smells)

### 2.1 行內樣式與 Tailwind 深色模式衝突 (Inline Style Override Bugs)
- **問題診斷**：
  - 舊有的後台子元件（如 `BillingSystem.jsx` 部分原始按鈕、`AdminMonthlyCard.jsx`）使用行內 `style={{ background: "white", color: "#1e293b" }}`。
  - 當其被嵌入在 `AdminApp.jsx` (`bg-slate-900` 深色背景) 或瀏覽器開起強制 Dark Mode 時，`<input>` 標籤若未設定 explicit `color`，會 inherited 深色模式的白色文字，導致**白底白字 (White text on white bg)** 的嚴重無視覺度錯誤。
- **修正狀況**：目前已在 `BillingSystem.jsx` 與 `AdminMonthlyCard.jsx` 修正為明確的 `#1e293b` / `#f8fafc` 搭配，其餘後台組件需一併清查。

### 2.2 `updateBooking` 之舊資料欄位遺漏 (Prop Signature Check)
- **問題診斷**：
  - 在 `src/lib/bookingDb.js` 的 `updateBooking()` 函式中，傳入的 `updates` 包含 `startTime`、`planType`、`durationHours`、`participantCount`。
  - 原先的 `tx.update()` 寫入時遺漏了 `startTime` 與 `slotKey` 的寫入更新，導致教練在後台修改開始時間後，Firestore 的 `startTime` 欄位仍維持舊值。
- **修正狀況**：已補齊 `startTime: newStartTime` 與 `slotKey: newSlotKeys[0]`，確保全交易原子更新。

---

## 3. 🧹 未釋放訂閱與記憶體洩漏風險 (Uncleaned Subscriptions)

經檢視，部分組件中的 `useEffect` 呼叫了 Firebase `onSnapshot` / `subscribe` 監聽器，但在元件卸載 (Unmount) 時未正確 return unsubscribe 函式：

| 檔案路徑 | 監聽器 / 事件 | 潛在風險描述 | 建議修正 |
| :--- | :--- | :--- | :--- |
| `src/components/admin/AdminReviewCenter.jsx` | `subscribeResults` | 當教練在後台分頁頻繁切換時，舊的 Snapshot 監聽器未銷毀，導致持續消耗 Firestore 讀取量並觸發已卸載組件的 setState。 | 確保 `useEffect` 內 `return () => unsub();` |
| `src/components/admin/AdminWorldBoss.jsx` | `onSnapshot` (Boss 血量) | 世界王血量即時監聽器若未清理，會在背景持續連線。 | 補上銷毀控制 |
| `src/pages/AdminApp.jsx` | `subscribePendingMonthlyRequests` | 主頁面重複訂閱多個 pending 計數。 | 統一收納至 custom hook `useAdminPendingBadges()` |

---

## 4. 📦 大體積內嵌 Bundle 與效能優化 (Bundle Optimization)

1. **`src/components/MonsterSVG.jsx` (62.2 KB)**：
   - 內含大篇幅的 Inline SVG 原始字串。建議將 SVG 檔案抽離為獨立 `.svg` 資源檔並透過 `<img src="...">` 或 Dynamic `import()` 載入。
2. **`src/lib/achievementDex.js` (73.5 KB)**：
   - 靜態成就圖鑑與說明文字全數打包在 JS 主 Bundle 中。建議轉換為 JSON 檔 `src/data/achievementDex.json`，於頁面載入時非同步載入。
3. **`src/lib/dungeonCollectibles.js` (41.5 KB)**：
   - 地下城收集品資料庫，建議比照 JSON 檔隔離。

---

## 5. 🛠️ Claude 修正與重構建議指令表 (Actionable Refactoring Tasks)

為方便 Claude / 開發者後續執行重構，下表列出標準的重構任務 Prompt 指令：

```markdown
### 重構任務 1：抽取射手搜尋自動補全組件
- 目標：建立 `src/components/shared/MemberSearchAutocomplete.jsx`
- 替換檔案：`BillingSystem.jsx`、`AdminBooking.jsx`、`AdminGiveTool.jsx`、`AdminMonthlyCard.jsx`
- 驗證：確保可搜尋 name/nickname/archerNo，且早鳥標籤顯示正常。

### 重構任務 2：清查 useEffect Firestore 訂閱清理
- 目標：巡檢 `AdminReviewCenter.jsx`、`AdminWorldBoss.jsx`、`AdminCompetitions.jsx`
- 修正：所有 `onSnapshot` 與 `subscribe` 呼叫必須回傳解構清理函式 `return () => unsub();`。

### 重構任務 3：拆解 `src/lib/db.js`
- 目標：將 252KB 的巨型檔案拆分為 `memberDb.js`、`billingDb.js`、`achievementDb.js`。
- 驗證：確保所有匯出函式名稱維持相容，避免 break 現有 import。
```

---
*審查報告完成時間：2026-07-21 | 生成自 Antigravity AI Assistant*
