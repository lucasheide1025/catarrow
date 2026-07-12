# Design — 地下城系統全面重設計 Phase 1

## Phase 1 範圍

**目標**：新增固定地圖資料結構 + SVG 地圖元件，不破壞現有地下城流程。

**不動的現有程式碼**：
- `dungeonDb.js`（Firestore 操作，Phase 2 擴充）
- `DungeonLobby.jsx`（等待室，Phase 2 加入新流程入口）
- `DungeonBattleRoom.jsx`（戰鬥，Phase 2 接入前後衛）
- `dungeonData.js` 現有 exports（CONTRACT_TYPES、calcDungeonContractDmg 等全部保留）

---

## 新增資料結構（dungeonData.js 追加）

### ROOM_TYPE_META
```js
export const ROOM_TYPE_META = {
  monster:  { label:"怪物房", icon:"⚔️",  color:"#ef4444", nodeColor:"#7f1d1d" },
  elite:    { label:"精英怪", icon:"💀",  color:"#f97316", nodeColor:"#7c2d12" },
  boss:     { label:"Boss",   icon:"👑",  color:"#fbbf24", nodeColor:"#78350f" },
  chest:    { label:"寶箱",   icon:"📦",  color:"#4ade80", nodeColor:"#14532d" },
  trap:     { label:"陷阱",   icon:"🪤",  color:"#f87171", nodeColor:"#450a0a" },
  merchant: { label:"商人",   icon:"🛒",  color:"#60a5fa", nodeColor:"#1e3a5f" },
  rest:     { label:"休息",   icon:"💤",  color:"#a78bfa", nodeColor:"#2e1065" },
  teleport: { label:"傳送",   icon:"🌀",  color:"#e879f9", nodeColor:"#581c87" },
  event:    { label:"特殊",   icon:"✨",  color:"#fde68a", nodeColor:"#713f12" },
  stairs:   { label:"樓梯",   icon:"🪜",  color:"#94a3b8", nodeColor:"#1e293b" },
};
```

### 地下城地圖結構（DUNGEON_MAPS）
```js
// 每個地下城
{
  id: string,           // "shadow-crypt"
  name: string,         // "幽冥地窖"
  emoji: string,        // "💀"
  description: string,
  enabled: boolean,
  floorCount: number,
  floors: [
    {
      floor: number,      // 1-based
      startRoomId: string,
      rooms: [
        {
          id: string,     // "f1r1"（floor1 room1）
          type: string,   // ROOM_TYPE_META key
          x: number,      // 格座標（整數，0-based）
          y: number,      // 格座標（整數，0-based，y 越大越往下）
          label: string,  // 房間描述文字
          // 選填：特定房間的怪物 tier / boss id 等
          meta?: object,
        }
      ],
      connections: [[roomId, roomId], ...],  // 連通關係（無向）
    }
  ],
  loot: {
    common: string[],   // 素材 id
    rare:   string[],
    boss:   string[],   // Boss 專屬
  }
}
```

### 第一個地下城：幽冥地窖（3 層，各 7~9 間房）

樓層設計原則：
- Y 軸越大 = 越靠近出口（底部放樓梯）
- 每層至少 2 條路線可選
- Boss 只在最後一層，且只有 1 間
- 休息室放在 Boss 前一間（讓玩家能回血）

---

## DungeonMap.jsx 設計

### 位置
`src/components/dungeon/DungeonMap.jsx`

### Props
```ts
{
  floorData: {            // 當層資料（floors[i]）
    floor: number,
    startRoomId: string,
    rooms: Room[],
    connections: [string,string][],
  },
  exploredIds: Set<string>,   // 已探索的 roomId
  currentRoomId: string,      // 當前位置
  reachableIds: Set<string>,  // 可直接移動到的 roomId（currentRoom 的鄰接）
  onRoomClick: (roomId) => void,
  pendingVoteRoomId?: string, // 隊長提議投票的目標（高亮顯示）
  disabled?: boolean,         // 等待投票時禁止點擊
}
```

### SVG 繪製邏輯
- `CELL = 70`：格距離 px
- `PAD = 40`：邊距
- SVG 寬高根據 rooms 的 maxX / maxY 自動計算
- 每間房畫成圓形（radius 22），顏色依 `ROOM_TYPE_META[type].nodeColor`
- 連線：在房間圓之前畫（避免覆蓋）
- 未探索的房間：黑色填充 + 小問號
- 可移動的房間：加外圈發光 pulse 動畫
- 當前房間：金色外框 + 較大 radius
- 房間類型 icon 用 `<text>` SVG 文字渲染

### 視覺狀態優先級（高 → 低）
1. 當前位置：金色外框
2. 可移動：綠色外圈（pulse）
3. 已探索：正常顏色
4. 未探索：黑底問號（但連線仍顯示，暗示有路）

---

## DungeonExplore.jsx 設計（Phase 1 MVP）

### 位置
`src/components/dungeon/DungeonExplore.jsx`

### 功能（Phase 1）
- 接收 `dungeon` 物件 + `onBack`
- 管理本地狀態：`currentFloor`, `currentRoomId`, `exploredIds`（Set）
- 點擊可移動的房間 → 更新 currentRoomId + 加入 exploredIds
- 顯示當前房間資訊卡（類型、label、描述）
- 樓梯房 → 進入下一層
- Phase 1 無 Firestore 持久化（local state），Phase 2 再接

### 不處理（留 Phase 2）
- 投票機制
- 實際戰鬥觸發
- 商店/事件處理
- Firestore 存進度

---

## 整合入口（Phase 1 最小侵入）

在 `AdminDungeon.jsx` 新增一個「預覽新地圖」按鈕，可以直接進入 DungeonExplore 測試。
不動 DungeonLobby，等 Phase 2 再接入完整流程。

---

## 後台開關

`AdminDungeon.jsx` 已存在，Phase 1 只需在資料層新增 `enabled` 欄位，後台讀取並顯示開關即可。
