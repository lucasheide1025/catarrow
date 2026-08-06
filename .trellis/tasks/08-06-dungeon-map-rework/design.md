# 技術設計

## 一、模組邊界

新增一支純函式模組，把「輕量房是什麼、踩到會發生什麼」跟 UI 完全隔開，讓單人與組隊兩套系統共用同一份規則。

```
src/lib/dungeonInlineRooms.js   ← 新檔（純函式，零副作用，可測）
  INLINE_ROOM_TYPES             ← Set，判斷房型是否為輕量房
  INLINE_ROOM_WEIGHTS           ← 生成用權重表
  isInlineRoom(type)            ← 給 UI 分流用
  resolveInlineRoom(room, ctx)  ← 抽內容 + 算效果，回傳 { effect, toast, revealRadius }
```

`resolveInlineRoom()` 回傳形狀：

```js
{
  effect: { hp?, atk?, def?, dmg?, gold?, item?, materials? },  // 與 GENERAL_EVENTS 的 effect 同構
  toast:  { icon, title, badges: string[] },                    // 浮動反饋文案
  revealRadius: 0 | 2,                                          // scout 專用
}
```

**為什麼 effect 要與 `GENERAL_EVENTS` 同構**：單人端的 `applyEventEffect()`（`DungeonExpedition.jsx:589`）與組隊端的 `buildTeamEventResolution()`（`dungeonEventResolution.js:29`）都已經吃這個形狀。輕量房沿用同構就不必寫第二套效果套用邏輯，只要把 `resolveInlineRoom().effect` 餵進去即可。

⚠️ 但 `buildTeamEventResolution` 目前**不處理 `gold` / `item`**（那兩項是在 `TeamExpeditionBattle.jsx:958-975` 的 `resolveTeamEvent` 裡另外用 `addCoins` / `addPotions` 做的）。輕量房走組隊路徑時要沿用同一條線，不要在 `buildTeamEventResolution` 裡加寫入副作用（它是純函式，測試依賴這點）。

## 二、生成層改動（`src/lib/expeditionGrid.js`）

### 2.1 尺寸
```js
export const GRID_SIZE = 7;              // 5 → 7
const roomCount = 40 + Math.floor(Math.random() * 7);   // 20~23 → 40~46
```
`growRegion()` 邏輯不動（生成樹式擴張，保證連通）。

### 2.2 樓梯位置
`bfsFarthest()` 改寫成 `pickStairs(cells, start)`：
1. BFS 算出所有格子的距離 `dist`
2. `maxDist = max(dist)`
3. 候選 = `dist >= Math.ceil(maxDist * 0.75)` 的格子
4. 從候選中隨機挑一格

**為什麼不是取最遠點**：現行 `bfsFarthest` 在 20~23/25 幾乎滿版的方形上，最遠點數學上必然落在角落 —— 這不是隨機性不足，是幾何必然。放大到 7×7 後這個性質只會更明顯（角落更遠）。

### 2.3 配額式房型分配（取代 `pickWeightedKey` 亂抽）

```
STAGE_ROOM_QUOTA = [
  { battle:2, elite_battle:0, trap:3, event:2, chest:3, shop:1, rest:2 },  // floor 0
  { battle:3, elite_battle:1, trap:2, event:2, chest:3, shop:1, rest:2 },  // floor 1
]
```

流程：
1. 依樓層取配額，展開成重量房陣列（13 或 14 項）
2. 剩餘格子數 = `otherCells.length - 重量房數量`
3. 用 `INLINE_ROOM_WEIGHTS` 抽滿剩餘格子
4. `shuffle()` 全部後配位
5. 既有的「戰鬥房不相鄰」修復迴圈保留不動

**邊界**：若某次 `growRegion` 只長出比配額還少的格子（理論上不會，40+ 遠大於 14），配額要能自動截斷，不可產生負數長度陣列。

### 2.4 `general_event` 廢除
`WEIGHT_ROOM_MAP` 移除 `general_events` 項；`EXCAVATION_FLOOR_CONFIG.roomTypes`（`dungeonData.js:299`）由權重表改為配額表。

⚠️ 舊存檔相容：`members.activeExpedition` / `dungeonRooms.expeditionMapState` 可能存有 `type:"general_event"` 的房間。UI 分流時要把 `general_event` 視為 `quick_event` 處理，不可讓它掉進 `default: return null` 變成卡死的空白畫面。

## 三、單人端（`DungeonExpedition.jsx`）

### 3.1 `enterRoom` 加輕量房分流
在 `enterRoom`（`:764`）最前面插入：

```
if (isInlineRoom(r.type)) {
  const res = resolveInlineRoom(r, { floorIndex, difficultyTier, family });
  applyEventEffect({ effect: res.effect });     // 沿用既有效果套用
  if (res.revealRadius) revealAround(r.pos, res.revealRadius);
  pushInlineToast(res.toast);
  markRoomCleared(r.id);                        // 不 setPendingRoom / 不 setPhase
  return;
}
```

**關鍵**：不呼叫 `setPhase("func_room")`。玩家停留在 `phase === "grid"`，`GridMapStage` 持續掛載。

### 3.2 `applyEventEffect` 補 `monsterHp` / `monsterAtk`（Bug 1）
在 `:636` 的 `dmg` 分支之後補上：

```
if (finalEff.monsterHp)  nextFloorModsRef.current.monsterHpMult  = 1 + finalEff.monsterHp;
if (finalEff.monsterAtk) nextFloorModsRef.current.monsterAtkMult = 1 + finalEff.monsterAtk;
```

⚠️ **語意陷阱**：事件文案寫的是「**本層**怪 HP −10%」，但 `nextFloorModsRef` 在 `startFloor`（`:482`）才被搬進 `floorModsRef`。也就是說寫進 `nextFloorModsRef` 會延到**下一層**才生效，與文案不符。
→ 正確做法是寫進 `floorModsRef.current`（當層立即生效），`nextFloorModsRef` 維持給跨層用途。組隊端 `buildTeamEventResolution` 寫的是 `nextFloorModifiers`，但 `TeamExpeditionBattle.jsx:678` 是在**本層**讀它 —— 組隊端實際行為是「本層生效」，與文案相符。單人端要對齊組隊端。

### 3.3 `scout` 的迷霧揭開
`visitedIds` 目前只在 `handleCellClick`（`:812`）加入玩家踩過的房間。`scout` 要把半徑 2 內的房間 id 一併加進 `visitedIds`。

⚠️ 這會讓那些房間在地圖上顯示為「已探索」但 `cleared` 仍為 false —— 需確認 `DungeonMapView` 的 `fog` 判定（`DungeonStages.jsx:456`）不會因此讓玩家跳格移動。`handleCellClick` 用的是 `isAdjacent` 檢查，與 `visitedIds` 無關，所以安全。

## 四、地圖浮動反饋層（`DungeonStages.jsx`）

`GridMapStage` 新增 `inlineToast` prop 與一層絕對定位的浮動層：
- 定位在玩家目前格子的等角座標上方（`cellCenter(playerPos.x, playerPos.y)` 已有現成函式）
- CSS keyframe 上浮淡出，1.6s 後自動消失
- 音效分流：`quick_event` → `sfxBuff` / `sfxDebuff`（依 effect 正負）、`coin_pouch` → `sfxCoinDrop`、`mini_chest` → `sfxOpenChest`、`scout` → `sfxOpen`、`empty` → `sfxTap`

toast 佇列用單一 state 即可（一次只會踩一間房），不需要陣列。

## 五、組隊端（`TeamExpeditionBattle.jsx`）

地圖移動權完全在房主（`handleCellClick:897` 需 `isHost`），所以輕量房**不需要投票**：

`enterExplorationRoom`（`:837`）加輕量房分流 → 房主本地算出 `resolveInlineRoom()` → 寫進 Firestore：
```
roomResolution: { kind:"inline_room", roomType, toast, effect }
+ buildTeamEventResolution 產出的 members.* updates
+ gold / item 沿用 resolveTeamEvent 既有的 addCoins / addPotions 迴圈（排除 guest/kid）
+ 直接標記 cleared 並推進，不進 func_room
```
隊員端訂閱到 `roomResolution.kind === "inline_room"` 就播同一個浮動反饋。

## 六、事件投票（R4，`DungeonEvent.jsx` + `TeamExpeditionBattle.jsx`）

沿用陷阱房的 `roomChoices` 機制：
- `confirmNonCombatRoom(roomId, memberId, choiceIndex)` 寫入自己的票（陷阱房存的是 `"big"`/`"small"`，事件房存 choice index）
- 計票：`tally[idx]++`；最高票勝；**平票時房主的票 +1 權重**
- 全員投完（`isTeamRoomReadyToAdvance`）→ 房主端自動呼叫 `resolveTeamEvent(winningChoice, idx)`
- 房主可用既有的 `TeamRoomVotingBar.onForceAdvance` 提前定案

UI：`DungeonEvent.jsx:170` 的 `isHost` 條件移除，改為「已投票則按鈕鎖定並顯示目前票數」。

⚠️ `resolveTeamEvent` 已有防重入（`teamRoom?.roomResolution?.kind === "team_event"` 就直接回傳既有結果），投票制下多人同時觸發也安全。

## 七、陷阱房（R5 + Bug 2，`DungeonTrap.jsx`）

### 7.1 決策權收回房主
`handleChooseBet` 的按鈕區塊（`:170-196`）包進 `isHost`；非房主顯示陷阱資訊 + 「房主正在判斷…」。
`allConfirmed` 判定改為「房主已下注」而非全員。

### 7.2 線上模式補上效果（Bug 2）
`handleRollAndResolve` 的線上分支（`:131`）在寫 `roomResolution` 的同一次 `updateDoc` 裡，附帶 `buildTeamEventResolution({ event:{ effect: trapType.effect }, members })` 產出的 `members.*` updates。
金幣類（`category:"gold"`）沿用 `addCoins` 迴圈，排除 guest/kid。

⚠️ 現在這段是直接 `import("firebase/firestore")` 動態組 `updateDoc`，繞過 `dungeonDb` 的 helper。改動時要確認寫入欄位有在 `firestore.rules` 的白名單內（見 memory: 新欄位漏加 hasOnly 會靜默 permission-denied）。

## 八、風險與相容

| 風險 | 對策 |
|---|---|
| 舊存檔含 `general_event` 房 | UI 分流時視同 `quick_event`，不可掉進 `default: null` |
| 舊存檔是 5×5 座標 | `restoredMapState.gridFloor` 直接沿用存檔的 grid，不重生成；7×7 只影響新開的樓層 |
| `firestore.rules` 白名單 | `roomResolution.kind:"inline_room"` 是既有欄位的新值，不需改 rules；但若新增欄位要同步貼 Console |
| 教練射手模式空白 | 改完必須實測教練切射手模式進地下城（見 memory: Admin Mode Blank） |
| `no-undef` 漏網 | `react-scripts build` 不擋 no-undef，改完要另跑 ESLint（見 memory） |
