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

---

# Phase G｜5×5 格子遠征重構（2026-07-03 定案）

## 背景與已修項目

- ✅ 已修：`expeditionDb.js:153` `coinBase` → `coinBase: coinsBase`（結算 crash）。
- 前一個 AI 工具重構時把遠征功能房弄丟：`DungeonExpedition.jsx` 的商人/陷阱/事件/寶箱房全部進 `ExpeditionRoomStage` 佔位畫面（只有繼續按鈕，無任何效果）。
- 原功能元件完好：`DungeonShop` / `DungeonTrap`（賭大小閃避）/ `DungeonEvent` / `DungeonChest` / `DungeonRest` / `DungeonTreasureRoom`，皆為多人 Firestore confirm→resolve 設計。

## 使用者定案決策

1. **範圍**：單人遠征（DungeonExpedition.jsx）與團隊遠征（TeamExpeditionBattle.jsx + expeditionTeamDb.js）都改。
2. **第 1、2 層**：5×5 格子、部分空格（牆）＋迷霧。約 11~13 間房，生成樹保證連通；起點隨機；樓梯房放離起點最遠處；上下左右移動；只顯示已探索＋相鄰格；走過的房間標記清除、再經過不再觸發。
3. **第 3 層**：固定入口 → A/B/C 三選一（選定即鎖）→ 每條 3 間隨機功能房 → 休息區 → 王房 → 寶箱房（最終獎勵）。
4. **團隊移動**：房主移動、全員跟隨；進房後沿用既有多人 confirm→resolve。

## 實作步驟

### Step G1｜`src/lib/expeditionGrid.js`（新檔，單人/團隊共用）
- `generateGridFloor(floorIndex, difficultyTier)` → `{ grid, startPos, rooms }`
  - 5×5；隨機漫步/生成樹挑 11~13 格連通房間，其餘 null（牆）
  - 房型分配：入口(start)、樓梯(stairs, BFS 距起點最遠)、battle×N、elite（第2層1隻）、event/trap/shop/chest/rest 按樓層權重（參考 `EXCAVATION_FLOOR_CONFIG.roomTypes`）
  - 房物件：`{ id, type, label, pos:{x,y}, cleared:false }`
- `generateBranchFloor(difficultyTier)` → `{ entrance, branches:{A,B,C}, boss, treasure }`
  - 每分支：3 間隨機功能房（battle/event/trap/shop/chest 混合）+ 1 休息區

### Step G2｜單人 `DungeonExpedition.jsx` 重構
- 第1、2層：`GridMapStage` 取代現有 `ExpeditionMapStage`——SVG 5×5 網格、迷霧（未探索相鄰格半透明、不相鄰不顯示）、點擊相鄰格移動、cleared 房可自由通過
- 第3層：`BranchStage`——入口選 A/B/C 鎖定 → 依序房間 → 王 → 寶箱
- 進房觸發改依房型分流（見 G3），刪除 `ExpeditionRoomStage` 佔位
- 樓梯房進入 → 下一層（重新 generateGridFloor）

### Step G3｜功能房單人本地接入
- 原元件加「本地單人模式」轉接：以 props 傳入單人 member 狀態與 onResolve callback，不寫 Firestore；**不得改動多人模式行為**
- 陷阱房保留賭大小閃避；商人房用遠征金幣；事件房接 buff/debuff；寶箱房隨機獎勵；休息房回血
- 房間效果補動畫與音效（`sound.js` Web Audio 合成，參考 noiseBurst/distTone 慣例）
- HP/buff 需在單人遠征全程持續（跨房間、跨樓層帶著走），戰鬥房進出時同步

### Step G4｜團隊遠征接格子
- 協調房存 `floorLayout`（generateGridFloor 結果序列化）+ `currentPos`；房主寫移動、成員 onSnapshot 跟隨
- 非戰鬥房建房間文件走既有 confirm→resolve；戰鬥房沿用現有流程
- 遵守 spec：host authority、floor carry-over 用 `??`、獎勵只算一次存 `expeditionResult.rewards`

## 驗收清單

- [ ] 單人第1/2層為隨機 5×5 迷霧地圖、起點隨機、可自由移動、cleared 不重複觸發
- [ ] 樓梯房 → 下一層重新生成
- [ ] 第3層 A/B/C 三選一鎖定 → 3房+休息 → 王 → 寶箱
- [ ] 商人/陷阱(賭大小)/事件/寶箱/休息房在單人遠征實際生效，含音效動畫
- [ ] 最終寶箱房結算不 crash（coinBase 已修）、獎勵只計算一次
- [ ] 團隊遠征同格子玩法、房主移動全員跟隨、多人房間功能正常
- [ ] 原多人地下城（DungeonController 流程）行為不變
