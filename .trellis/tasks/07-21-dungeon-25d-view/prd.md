# PRD — 地下城 2.5D 顯示層改版

## 目標與使用者價值
把地下城探索地圖（目前為平面 / 斜角薄菱形）改成**正向 2.5D 房間立繪 + 鏡頭追蹤局部渲染**，
畫面更漂亮、可放大，玩家只看到自己周圍的房間，鏡頭隨移動平滑跟隨。
主要在手機使用，不得橫向爆版。

參考圖：GPT 生成的正向 2.5D 石台房間網格（`S__16416774.jpg`）。

## 確認事實（來自程式碼）
- 房間資料模型：`{ id, pos:{x,y}, type, cleared, family }`；`GRID_SIZE = 5`（5×5）。
- 房間 type（11 種）：entrance / battle / elite_battle / boss_battle / shop / event / trap / chest / rest / stairs / treasure。
- 系別 family（7 系）：ghost / mountain / insect / workplace / exam / temple / treasure（各有配色主題 `FAMILY_STYLES`）。
- 第 1-2 層 = 格子地圖 `GridMapStage`；第 3 層 = 分支樹 `BranchStage`（版式不同）。
- 地圖元件由 `DungeonExpedition`（單人）與 `TeamExpeditionBattle`（組隊）共用 → 改一次兩邊套用。
- 現有 2.5D 骨架：`DungeonStages.jsx` 的 `DungeonMap25D`（Gemini 初版，斜角 SVG）已具備迷霧 / 橋 / 玩家圖釘 / 系別配色邏輯，可保留資料層、替換繪製層。
- 圖片放置慣例：`public/assets/dungeon/*.webp`。

## 需求（已定案）
- R1 投影改為**正向 2.5D**：房間為預渲染立繪石台，靠「美術透視 + 列間重疊 + z-index」產生景深，非斜 45° 菱形 SVG。
- R2 鏡頭**純自動跟隨**：viewport 只顯示玩家周圍局部，移動時整個世界層平滑平移使當前房置中；viewport overflow hidden → 手機不橫向爆版。
- R3 每種房間用 AI 立繪（決策 A）；系別配色用 in-app 半透明 overlay，不重生圖；圖未就緒時退回 `room_empty` / 佔位。
- R4 保留現有房間資料模型與探索邏輯，只換顯示層；單人（DungeonExpedition）/ 組隊（TeamExpeditionBattle）共用。
- R5 不引入 PixiJS / 任何遊戲引擎；純 DOM/CSS `<img>` + SVG/CSS 動態層。
- R6 **第 3 層分支也改 2.5D**：入口 → 三條支線(A/B/C)全部可見 → 收斂到 boss → treasure；選定後其餘兩條變暗、**單向不可回頭**；沿用同批立繪。

## 驗收標準
- [ ] 手機（375px 寬）下地圖不橫向爆版、無破圖。
- [ ] 玩家移動時鏡頭平滑跟隨、只顯示局部（viewport 外房間看不到）。
- [ ] 立繪 z-index 依列排序正確（前排壓後排，無穿插錯位）。
- [ ] 單人與組隊模式皆正常顯示。
- [ ] 圖片缺失時退回佔位不破版（可先於全部圖就緒前上線）。
- [ ] 未探索房間顯示迷霧、可移動房間有提示、已清房間有 ✓ 標記。
- [ ] 第 3 層三條支線全部可見；選定後其餘變暗、無法回頭；鏡頭跟隨前進。
- [ ] prod build 通過、無新 lint error。

## 不在範圍
- 殭屍區（暫緩）。
- 戰鬥邏輯 / 房間掉落 / 資料結構變更。
- 手動拖曳 / 縮放地圖（僅自動跟隨；總覽按鈕另議）。

## 決策紀錄（已定案）
- Q1 美術策略 → **A：AI 立繪**（規格見 assets-spec.md）。
- Q2 範圍 → **第 1-2 層格子 ＋ 第 3 層分支都改**。
- Q3 鏡頭 → **純自動跟隨**。
