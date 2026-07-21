# Design — 地下城 2.5D 顯示層

## 核心思路
「2.5D」的立體感**全部來自預渲染立繪本身的透視**，不用任何等角座標數學。
程式只做三件事：**把立繪貼到 2D 網格 → 列間重疊 → 依列 z-index 排序**。
鏡頭 = 一個 overflow:hidden 的 viewport 包一個大 world 層，用 `transform: translate` 平移使當前房置中。

## 元件結構（都在 DungeonStages.jsx）
- `RoomTile`（新）：單一房間立繪。
  - `<img src="/assets/dungeon/room_${type}.webp" onError={退回 room_empty / SVG 佔位}>`。
  - 上層疊：家族色 overlay、迷霧遮罩、可移動脈動框、✓ 徽章、當前房高亮。
  - `style.zIndex = row`（gridY；越靠前越大）。絕對定位於 `left = col*CELL_W`, `top = row*CELL_ROW`。
- `MapViewport`（新，共用）：
  - 外層 viewport：`width:100%`, 固定高（約 `min(56vh, 460px)`）, `overflow:hidden`, `position:relative`。
  - 內層 world：絕對定位、寬高 = 整張地圖 px；`transform: translate(camX, camY)` + `transition: transform 320ms`。
  - `camX/camY` 由 viewport 實測寬高（ref）與當前房座標算出：讓當前房中心對齊 viewport 中心。
  - 背景層：`map_bg.webp`（固定在 viewport，不隨 world 移動，做淺 parallax 或完全固定）。
- `GridMapStage`（改）：第 1-2 層，用 MapViewport + RoomTile；沿用 Gemini 的 fog / bridge / visited 推導邏輯（保留資料函式，丟棄斜角 SVG 繪製）。
- `BranchStage`（改）：第 3 層，用同一套 RoomTile + MapViewport，套「分支固定座標表」。

## 座標系
### 第 1-2 層（格子）
- `col = pos.x`, `row = pos.y`（沿用 5×5）。
- `CELL_W`（約 200px）、`CELL_ROW`（約 150px，< 立繪高 → 製造列間重疊景深）。
- 房間立繪寬約 200~240px，錨點 = 平台頂面中心。
- 橋 / 連接：相鄰已探索房間之間用 SVG 或細長 div 連接（沿用 bridges 推導）。

### 第 3 層（分支）— 固定座標表
```
                 entrance (col 1,row 0)
     A(col0)         B(col1)        C(col2)   ← 三條各往下 4 房 (row 1..4)
                 boss (col1,row 5)
               treasure (col1,row 6)
```
- 三條支線並排、全部渲染 → 「看得到三條」。
- `branchChoice` 為 null 時：三條皆可點（點某條的第一房 = onChoose(key)）。
- 選定後：未選兩條 `opacity:0.3 + grayscale`，不可點；選定條照 branchStep 逐房前進（onEnterNext），鏡頭跟隨當前房下移；**無回頭**（已過房不可點）。
- boss / treasure 永遠可見（迷霧化直到抵達）。

## 動態層規則（疊在立繪上）
| 狀態 | 呈現 |
|---|---|
| 未探索但相鄰(fog) | `room_empty` + 深色遮罩 + 「?」 |
| 未探索且不相鄰 | 不渲染（或極淡輪廓） |
| 可移動(相鄰+canControl) | 綠色脈動外框 |
| 當前房 | 金色高亮 + 玩家圖釘（浮動動畫） |
| 已清除 cleared | ✓ 徽章、立繪稍降透明 |
| 家族 family | 半透明色 overlay（沿用 FAMILY_STYLES.glow/fog/primary）tint 中性灰立繪 |

## 資產與 fallback（支援漸進上線）
- 讀取：`/assets/dungeon/room_${type}.webp`；缺失 → `onError` 換 `room_empty.webp`；再缺 → SVG 灰台 + emoji（現有 TYPE_ICONS）。
- 因此**架構可先上線（佔位）**，圖生一張換一張，符合先前議定的 C 執行節奏。

## 相容性 / 風險
- 資料模型、探索 / 移動 / Firestore 邏輯**完全不動**（只換 render 層）；單人 / 組隊共用同元件 → 一次到位。
- 教練切射手模式需驗證不空白（見 memory feedback_admin_mode）。
- 大型元件檔跨檔匯入 TDZ 坑：新常數 / 元件都放 DungeonStages.jsx 內、由它 export，勿在 UI 元件間 re-export（見 memory debug_prod_only_tdz）。
- 立繪 z-index：務必依 row 排序，否則加高立繪後前後穿插（驗收項）。
- viewport 高度 + 安全區：保留 `env(safe-area-inset-bottom)`，底部導覽不遮地圖。

## 回滾
- 全部集中在 DungeonStages.jsx 的 render 層；保留 git 還原點即可退回 Gemini 斜角版 / 原平面版。
