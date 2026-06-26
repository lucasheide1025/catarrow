# Implement — 地下城系統 Phase 1

## 執行順序

### Step 1｜dungeonData.js 追加地圖資料
**檔案**：`src/lib/dungeonData.js`（尾端追加，不修改現有 exports）

新增：
- `ROOM_TYPE_META` — 10 種房間類型 metadata
- `DUNGEON_MAPS` — 至少 1 個地下城（幽冥地窖，3 層）
- `getRoomMeta(type)` — 查詢 ROOM_TYPE_META，找不到回傳 monster
- `getReachableRooms(floorData, currentRoomId)` — 從 connections 找鄰接 roomId，回傳 Set<string>
- `getDungeonFloor(dungeon, floorIndex)` — 取 floors[floorIndex]

幽冥地窖第 1 層房間佈局（7 間）：
```
(2,0) 入口通道 [monster]
(0,1) 隱藏儲藏室 [chest]   (2,1) 陷阱走廊 [trap]   (4,1) 守衛室 [monster]
(1,2) 休息室 [rest]        (3,2) 流浪商人 [merchant]
(2,3) 通往二層 [stairs]
```
connections：r1-r2, r1-r3, r1-r4, r2-r5, r3-r5, r3-r6, r4-r6, r5-r7, r6-r7

驗收：`getReachableRooms(floor, "f1r1")` 回傳 Set{"f1r2","f1r3","f1r4"}

---

### Step 2｜DungeonMap.jsx 建立
**新檔**：`src/components/dungeon/DungeonMap.jsx`

實作要點：
- `CELL_SIZE = 70`, `PAD = 40`, `NODE_R = 22`, `NODE_R_CURRENT = 26`
- 先算 SVG 尺寸：`width = (maxX+1)*CELL_SIZE + PAD*2`
- 畫連線（`<line>`）before 畫節點
- 未探索房間：fill="#1e1e1e", `<text>?</text>`
- 已探索 + 非當前：`ROOM_TYPE_META[type].nodeColor` fill
- 可移動：額外 `<circle>` 外圈，`opacity: 0.5 + sin(t)*0.4`（用 CSS animation）
- 當前位置：金色邊框（stroke="#fbbf24", strokeWidth=3）
- 圖示：`<text>` fontSize=18 置中
- CSS keyframe `@keyframes dm-pulse { 0%{r:26} 50%{r:30} 100%{r:26} }` 套在可移動節點

---

### Step 3｜DungeonExplore.jsx 建立
**新檔**：`src/components/dungeon/DungeonExplore.jsx`

狀態：
- `floorIndex` (0-based) 初始 0
- `currentRoomId` 初始 `dungeon.floors[0].startRoomId`
- `exploredIds` (Set) 初始包含 startRoomId
- `showRoomCard` bool

事件處理：
- `handleRoomClick(roomId)` — 只接受 reachableIds 裡的 id；更新 currentRoomId、把 roomId 加入 exploredIds、setShowRoomCard(true)
- 房間卡片顯示當前房間的 type / label / icon
- 若 type === "stairs" 且點確認 → `setFloorIndex(i+1)`，重設 currentRoomId / exploredIds

UI 佈局（深色背景）：
- 頂部：地下城名稱 + 樓層 F1/F2...
- 中央：`<DungeonMap>` 可滾動（overflow-x: auto）
- 底部：當前房間資訊卡（浮出）

---

### Step 4｜AdminDungeon.jsx 新增預覽入口
**檔案**：`src/components/admin/AdminDungeon.jsx`（讀取後追加）

在 AdminDungeon 頂部加一個「🗺️ 預覽新地圖」按鈕，
state `showMapPreview` → 顯示 `<DungeonExplore dungeon={DUNGEON_MAPS[0]} onBack={...} />`

---

## 驗收檢查清單

- [ ] `DUNGEON_MAPS[0]` 有正確的 3 層結構
- [ ] `getReachableRooms` 從 r1 出發只回傳 {r2, r3, r4}
- [ ] DungeonMap SVG 正確顯示房間節點和連線
- [ ] 未探索房間顯示黑底問號
- [ ] 當前房間顯示金色外框
- [ ] 可移動房間有 pulse 動畫
- [ ] 點擊可移動房間 → currentRoomId 更新 → 地圖重渲染
- [ ] 點擊不可移動/未連通房間 → 無反應
- [ ] 走到 stairs 房 → 進入下一層，地圖重置
- [ ] AdminDungeon 可以點開地圖預覽不白屏

## 備注

- Phase 1 全 local state，無 Firestore 寫入
- SVG `<text>` 的 emoji 在部分 Android 可能 fallback 到文字，可接受
- 地圖若超出螢幕寬度，容器加 `overflow-x: auto`
