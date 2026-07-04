# 組隊地下城修復：地圖崩潰＋人數上限＋前後衛選擇

## Goal

修復組隊地下城「建立→進入」時的 Firestore 崩潰（無法建立探索地圖）、把地下城組隊人數上限從 4 人修正為 8 人，並讓組隊模式與組隊地下城模式都能在**進場前**選擇前衛/後衛初始角色（目前完全沒有選擇機制或直接壞掉）。

## 確認事實（探索程式碼所得）

### Bug 1：地圖崩潰（Nested arrays are not supported）

- 根因：`src/lib/expeditionGrid.js::generateGridFloor()` 回傳的 `gridFloor` 物件包含 `grid` 欄位，是**literal 2D 陣列**（`Array.from({length:5},()=>Array(5).fill(null))`，第 155-156 行），Firestore 完全不支援陣列中包陣列。
- `src/components/dungeon/TeamExpeditionBattle.jsx` 在多處（約 69-70、455-457、563-565 行等，凡是包含 `gridFloor` 的 state 更新）直接把整個 `gridFloor`（含 `grid`）透過 `updateTeamExpeditionRoom()` → Firestore `updateDoc()` 寫入，觸發崩潰。
- **關鍵發現：`grid` 這個 2D 陣列在渲染端完全沒被用到**——共用渲染元件 `GridMapStage`（`src/components/dungeon/DungeonExpedition.jsx` 第 129 行起）只用 `gridFloor.rooms`（陣列包物件，Firestore 合法）自己建立 `roomByPos` 查找表（第 139-144 行），從未讀取 `.grid`。單人模式（`DungeonExpedition.jsx` 第 729 行）唯一用到 `gridFloor.grid[y][x]` 的地方，是純本地 state、從不寫入 Firestore，因此單人模式從未觸發過這個 bug。
- **修法方向**：`grid` 對組隊流程是完全多餘的資料。在 `TeamExpeditionBattle.jsx` 每一處把 `gridFloor` 寫入 Firestore 之前，把 `grid` 欄位剔除即可，不需要在讀取端做任何還原（因為沒有任何下游邏輯依賴它）。不要更動 `expeditionGrid.js::generateGridFloor()` 的回傳格式本身（單人模式仍依賴現有格式，屬共用純函式）。

### Bug 2：組隊地下城人數上限錯誤（4 人應為 8 人）

- `src/lib/expeditionTeamDb.js` 第 98 行：`if (Object.keys(members).length >= 4) throw new Error("房間已滿（最多 4 人）");` —— 寫死 4 人上限。
- `src/components/dungeon/DungeonTeamLobby.jsx` 第 189 行 `👥 隊員（{memberCount}/4）` 與第 217 行 `Array.from({ length: Math.max(0, 4 - memberCount) })`（空位佔位符數量）——UI 顯示也寫死 4。
- 對照組：舊版「地下城經典模式」`src/lib/dungeonDb.js` 第 92-96 行已經正確支援 8 人上限，且有「前 4 人為前衛、之後預設後衛」的自動分配邏輯，可作為人數上限寫法的參考基準（但角色分配邏輯要換成使用者選擇，見下）。

### Bug 3：前後衛沒有進場前選擇機制

- **組隊地下城（新版遠征系統）**：完全沒有角色選擇 UI。`DungeonTeamLobby.jsx::handleStart()`（第 77-93 行）組出的 `memberList` 沒有帶 `role` 欄位；`expeditionTeamDb.js::createTeamExpeditionBattleRoom()` 第 253 行 `role: m.role || "front"` 因此**每個人都預設變成前衛**，後衛完全沒人。這是真正的 bug（不是設計選擇）。
- **組隊模式（既有 PartyBattleRoom 系統）**：目前的「後衛」不是玩家自由選擇，而是**戰鬥中前衛角色倒下時，伺服器自動把該玩家轉為後衛並回復 50% HP 復活**（既有復活機制，`role` 欄位在戰鬥中動態變化，非進場前固定）。
- **使用者已確認**：兩個模式都要新增「進場前選擇前衛/後衛」的 UI，但**只決定戰鬥開始時的初始角色**，既有的「前衛倒下→自動轉後衛復活」機制原封不動保留、不受影響。

## Requirements

1. `TeamExpeditionBattle.jsx` 所有把 `gridFloor` 寫入 Firestore 的地方，寫入前剔除 `grid` 欄位（可寫一個小工具函式統一處理，例如 `expeditionGrid.js` 新增 `stripGridForSync(gridFloor)`，回傳去掉 `grid` 的淺拷貝）。
2. `expeditionTeamDb.js` 加入房間人數上限從 `>= 4` 改為 `>= 8`；`DungeonTeamLobby.jsx` 對應的「/4」顯示與空位佔位符數量改為「/8」。
3. `DungeonTeamLobby.jsx`（組隊地下城等待室）新增前衛/後衛選擇 UI：每位成員可選擇初始角色，前衛與後衛各上限 4 人；選定結果隨隊員資料一起帶入 `handleStart()` 組出的 `memberList`，讓 `createTeamExpeditionBattleRoom()` 依照玩家實際選擇設定 `role`（而非全部預設 front）。
4. 找到組隊模式（Party）對應的等待室元件（`PartyLobby.jsx` 或其子元件），新增同樣的前衛/後衛進場前選擇 UI，各上限 4 人；選定的角色作為戰鬥開始時的初始 `role`，**不影響**既有「前衛倒下→自動轉後衛復活」的戰鬥中機制。
5. 兩處 UI 都要有「已選 X/4 前衛、Y/4 後衛」之類的即時提示，避免超過上限。

## Out of Scope

- 修改前衛倒下自動轉後衛復活的既有戰鬥邏輯
- 修改 `expeditionGrid.js::generateGridFloor()` 的回傳格式（單人模式共用，不動）
- 舊版「地下城經典模式」（`dungeonDb.js`）的人數/角色邏輯（已經是對的，不用改）

## Acceptance Criteria

- [ ] 組隊地下城建立→進入不再出現 Firestore「Nested arrays are not supported」錯誤，探索地圖正常建立與顯示
- [ ] 組隊地下城房間可加入到 8 人，UI 顯示「/8」
- [ ] 組隊地下城等待室可讓每位成員選擇前衛或後衛（各上限 4），送出後戰鬥房內每個人的初始 `role` 正確反映選擇
- [ ] 組隊模式（Party）等待室同樣新增前衛/後衛進場前選擇（各上限 4）
- [ ] 組隊模式既有「前衛倒下自動轉後衛復活」機制驗證仍正常運作（初始角色選擇不影響這個機制）
