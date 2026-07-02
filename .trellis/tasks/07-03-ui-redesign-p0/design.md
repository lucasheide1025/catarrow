# 技術設計 — UI 改版 Phase 0-2

## 現況分析（已勘查）

- `src/index.css`：`:root` 已有 13 個 CSS 變數（bg-deep/surface/card/elevated、text 四階、border 兩階、nav 兩個），下方是一大層 `.content-area .bg-white {...}` Tailwind class 覆寫（把淺色 class 強制轉深色）。這層是要逐步淘汰的補丁，但本任務**保留**以保護未遷移頁面。
- `src/components/shared/UI.jsx`：15 個共用元件，淺色優先（`bg-white`、`text-gray-800`），Card/Btn 有 dark variant。視覺上目前靠覆寫層轉深色。
- `src/lib/theme.js`：3 組主題物件（headerBg/navActive 等 12 個 key），僅 4 檔使用：MemberApp(9)、AdminApp(8)、MemberProfile(2, 主題選擇器)、theme.js 本身。
- `MemberApp.jsx`：page state machine，5 個 nav 分組常數（ADVENTURE/TRAINING/INVENTORY/PROFILE_PAGES），NAV_PRELOADS hover 預載，View Transitions 已包 content area。

## Token 規格（index.css `:root`）

沿用現有變數名（已被引用，不改名），新增以下：

```css
:root {
  /* 既有 13 個保留原名原值（可微調值） */

  /* 語意色：fg = 文字/icon 用，bg = 淡色底 */
  --success-fg: #4ade80;  --success-bg: rgba(34,197,94,0.12);
  --warn-fg:    #fbbf24;  --warn-bg:    rgba(251,191,36,0.12);
  --danger-fg:  #f87171;  --danger-bg:  rgba(239,68,68,0.12);
  --info-fg:    #60a5fa;  --info-bg:    rgba(59,130,246,0.12);

  /* 強調 */
  --accent:      #f59e0b;          /* 金 — 品牌強調 */
  --accent-soft: rgba(245,158,11,0.15);
  --primary:     #3b82f6;          /* 藍 — 互動主色 */

  /* 圓角 / 陰影 */
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-xl: 20px;
  --shadow-card:     0 2px 12px rgba(0,0,0,0.35);
  --shadow-elevated: 0 8px 24px rgba(0,0,0,0.45);

  /* 玻璃卡 */
  --glass-bg:     rgba(30,41,59,0.72);
  --glass-border: rgba(255,255,255,0.10);
}
```

Tailwind v4 可用 `@theme` 把變數映射為 utility（如 `bg-surface`）；若現有設定不便，元件內直接 `bg-[var(--bg-surface)]` 或 inline style 讀變數皆可，**以元件封裝為主，頁面不直接碰變數**。

## 元件改造策略（UI.jsx）

原則：**改既有檔案，不開平行新檔**；deprecated 樣式值全部改讀 token。

| 元件 | 改法 |
|------|------|
| Card | `CARD_THEMES.light` 與 `.dark` 都指向同一組深色 token 樣式（玻璃卡：`--glass-bg` + `--glass-border` + backdrop-blur）。`theme` prop 保留但不再分歧。 |
| Btn | variant 保留全部 key；淺色系 variant（secondary/danger…）改為深色版視覺；`dark-*` 系列變成 alias 指向同名基礎 variant。 |
| Inp/TA/Sel/SearchBar | `bg-white` → `bg-[var(--bg-elevated)]`，文字 `--text-primary`，focus ring 用 `--primary`。 |
| Modal/ConfirmModal | 白底 → `--bg-surface` + `--border-card`，sticky header 同步。 |
| Pill | 色 map 改語意 token 淡色底版本。 |
| Spinner/Empty/ST/Toast | 顏色 token 化，結構不動。 |

新增元件（同檔 UI.jsx 或新檔 `src/components/shared/Widgets.jsx`，避免 UI.jsx 過長建議新檔）：

```jsx
SectionHeader({ icon, title, action })        // 區塊標題列
StatBar({ value, max, color, label, height }) // 通用進度條（HP/XP）
ProgressRing({ value, max, size, stroke, color, children }) // SVG 圓環
Skeleton({ h, w, className })                 // 深色 shimmer 骨架
HubTile({ icon, title, desc, badge, onClick, accent }) // hub 入口卡（CSS 漸層底）
```

⚠️ 新檔不得從 UI.jsx re-export 常數（循環 import 教訓）。

## theme.js 收斂

- `APP_THEMES` 保留陣列結構但只留 1 個主題物件（navy 深海金，值對齊新 token）。
- `getAppTheme()`/`saveAppTheme()` 簽名不變。
- MemberApp/AdminApp 讀 `appTheme.headerBg` 等仍可運作 → 之後 header 改版時直接改用 CSS 變數，theme 物件變成 fallback。
- `MemberProfile` 主題選擇器：`APP_THEMES.length <= 1` 時整個區塊不渲染（未來要復活多主題只需加回陣列元素）。

## Header / Nav / Hub / Home 設計

**Header**（MemberApp 內 inline）：
```
[頭像+等級環(ProgressRing, archerXP)] [暱稱 / 檢定pill]   [🔔紅點]
[💰金幣  ·  💧箭露  ·  🎫轉蛋幣]（一列 chips，點擊跳轉對應頁）
```
背景：`linear-gradient(135deg, var(--bg-deep), #0c4a6e)` 保留品牌感；貨幣值來源 `profile`（已訂閱，不加新讀取）。

**底部 nav**：現有 5 tab 結構與 preload 不動；視覺改 token、active 用 `--accent` 指示條 + icon 放大、`min-height:56px`。`member-nav` 的 viewTransitionName 保留。

**Hub 頁**：每頁 = `SectionHeader` + `HubTile` 2 欄格線。入口資料改成每 hub 一個常數陣列 `{ page, icon, title, desc, badgeKey }`，紅點數沿用 AdminApp/MemberApp 既有計數 state 傳入。cell-*.webp 不再引用（檔案保留不刪）。

**MemberHome 儀表板**（區塊順序）：
1. 今日卡：`subscribeMyCheckin` 狀態 + `subscribeTodayPracticeLogs` 箭數（**兩者 MemberApp/DailyQuest 已有訂閱模式，重用相同函式**）+ 里程碑進度（`arrowMilestone.js` 取下一里程碑，ProgressRing）
2. 進行中卡（條件渲染）：expeditions 3 槽倒數（讀 `profile.expeditions`，本地 setInterval 倒數）、村目標（`checkGoalStatus` 既有輪詢）、世界王入口（`subscribeActiveWorldBoss` MemberApp 已訂閱可下傳）
3. 既有：等級卡/公會 pill/收藏格/月卡/廣播 — 套新 Card 樣式重排
4. 快速入口：HubTile 小尺寸變體 4 格

**資料原則**：不新增 Firestore 讀取路徑，全部重用既有訂閱/props。

## 風險與相容

| 風險 | 對策 |
|------|------|
| Btn/Card 深色化影響 BillingSystem（自帶淺色） | 實作前 grep BillingSystem 用了哪些共用元件；若有依賴淺色 variant，該處改 local 樣式或給 `theme="light"` 真淺色逃生門（僅此處） |
| CatVillage `.no-override` | 只跳過覆寫層，不受元件改動影響；改後實測 |
| 教練「射手模式」空白 | 完成後必測（記憶中的坑）；不從 UI 元件 re-export 常數 |
| 覆寫層 + 原生深色雙重套用 | 覆寫層只針對淺色 class（bg-white 等）；元件改用 token 後不再命中覆寫規則，無疊加問題 |

## Rollout / Rollback

單一 commit 系列在 main 上（專案無 PR 流程）。每個 implement 步驟結束跑 `npm run build`；任一步驟破版可 `git revert` 單步。Vercel push 後自動部署。
