# Design — 組隊遠征收尾

## 邊界

- `dungeonRooms/{teamRoomId}` 是組隊協調房，保存房主、隊員、地下城與目前戰鬥房。
- 每一層另建一個 `dungeonRooms/{battleRoomId}`，交給既有 `DungeonBattleRoom` 處理。
- 組隊房主是唯一的流程協調者：建戰鬥房、推進樓層、寫最終結果、清理戰鬥房及廣播失敗。
- 所有客戶端訂閱組隊房，依 `currentBattleRoomId` 與 `expeditionPhase` 路由。

## 狀態流程

```
expedition_waiting
  -> expedition_active
  -> currentBattleRoomId (floor 0..2)
  -> expeditionPhase=result
  -> completed / deleted
```

## 一致性規則

- 加入／離開使用 transaction 或 `deleteField()`，避免 null 成員佔名額。
- 建立戰鬥房時顯式傳入 `hostId`。
- 每層結束由房主從戰鬥房快照擷取隊員 HP／存活狀態，寫回組隊房後再建立下一層。
- 最終獎勵由房主計算一次並寫入 `expeditionResult.rewards`；每位成員領取同一份已固定數值。
- 儲存槽在開始時由房主消耗；儲存時已結束上一輪發掘，因此遠征完成／失敗不得再重置任何人的當前發掘狀態。

## 相容性

- 不改既有地圖探索與經典地下城資料格式。
- `DungeonBattleRoom.expeditionMode` 僅關閉該房原本的個人掉寶，遠征獎勵仍由上層發放。

## 怪物生成合約

- `difficulty` 直接映射到 `common/rare/elite/fierce/boss/mythic`，所有樓層都使用同一基礎 Tier。
- 地下城描述物件保存 `boss`，UI、單人與組隊流程共用該物件，不得各自重抽。
- `drawFloorMonsters` 只決定變體與族系：
  - floor 0: weak
  - floor 1: normal + strong elite
  - floor 2: strong encounters + persisted boss
- 舊儲存資料沒有 `boss` 時允許建立一次相容 fallback；新生成資料必須持久化。

## 遠征掉落與結算

- 每次擊殺產生兩個對應 Tier／族系材料寶箱與兩個金幣寶箱描述。
- 單人流程將擊殺掉落加入背包並累積本次報告；組隊流程由房主把掉落描述與戰鬥統計寫回協調房。
- 組隊最終結果固定保存 rewards、loot、stats 與 party；每位玩家在同一個 Firestore transaction 內完成 claim 標記、資源增加、紀錄與寶箱寫入。
- 寶藏房的動畫只控制揭露節奏，獎勵資料只生成一次。
