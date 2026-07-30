# Design：地下城首次通關與世界王誕生系統重構

## 1. 領域鍵值

### 地下城類型鍵

所有紀錄統一使用穩定鍵：

```text
familyTierKey = "{family}_t{difficultyTier}"
```

例如 `ghost_t3`。禁止再用一次性 `savedDungeon.id`、`roomId`、`bossRunId` 或其他執行個體 ID 當作首殺鍵。

### 三種通關結果

```js
{
  cleared: true,
  personalFirstClear: boolean,
  globalFirstClear: boolean,
  globalFirstClearOwnerId: hostId
}
```

- `cleared` 是每次合法通關。
- `personalFirstClear` 是每位玩家自己的首次完成。
- `globalFirstClear` 只由房主在全服紀錄交易成功時成立。

## 2. 地下城資料契約

### 全服首殺

沿用 `dungeonFirstClear` collection，但文件 ID 改為穩定的 `familyTierKey`。內容至少包含：

```js
{
  key, family, difficultyTier,
  ownerId, ownerName,
  teamMemberIds, teamNames,
  runId, clearedAt
}
```

用 Firestore transaction 的「文件不存在才 create」保證唯一。

### 個人首次通關

寫入玩家文件的 map：

```js
dungeonFirstClears.{familyTierKey} = {
  clearedAt,
  runId,
  rewardClaimed: true
}
```

首次通關紀錄與限定收藏品增量必須在同一 transaction 完成，避免紀錄成功但道具遺失，或反過來重複領取。

若 Firestore 規則不允許這些欄位，需同步加進官方會員自更新白名單；訪客／兒童不寫正式首次通關。

### 組隊結算

房主負責：

1. 確認本次通關已完成；
2. 嘗試建立全服首殺；
3. 寫入全服公告一次。

每位隊員負責 self-claim：

1. 以自己的帳號交易判斷 `dungeonFirstClears.{key}`；
2. 第一次時寫紀錄與收藏品；
3. 非第一次只領一般通關獎勵。

這保持現有「玩家只寫自己的 member」安全邊界。

## 3. 進場提示

新增純函式 `buildDungeonFirstClearState(profile, dungeon)`，輸出：

```js
{
  key,
  eligible,
  completed,
  trophy,
  label,
  reason
}
```

入口元件只讀登入狀態中已有的 member 文件，不為每張地下城卡另開 listener。若 profile 尚未載入該欄位，顯示中性載入／未知，不直接宣稱未通關。

## 4. 收藏品圖片

為 36 個「六族 × T1～T6」首次通關收藏品準備 WebP 小圖：

```text
public/ui/dungeon/first-clear/{family}_t{tier}.webp
```

共用 `DungeonCollectibleArt` 元件負責：

1. WebP；
2. 既有圖示 fallback；
3. 固定 aspect ratio；
4. 圖片錯誤後不重複重試。

一般收藏品先沿用既有素材／圖示；本次優先把首次通關必掉道具從 SVG／emoji 升級為圖片。

## 5. 世界王單一真相

新增世界王正規化函式：

```js
normalizeWorldBossState(event)
```

規則：

- `status === "defeated"` 時 `currentHP` 永遠為 0；
- `currentHP <= 0` 且不是 cancelled/expired 時視為 defeated；
- active 必須有 `currentHP > 0`；
- UI 只使用正規化結果，不自行各算一套。

寫入端 `attackWorldBoss` 的 transaction 同時更新 HP、status、lastHitBy、defeatedAt。精簡 `worldBossStatus/current` 只在交易成功後鏡像狀態。

對舊矛盾文件提供管理員／安全的一次性修復函式：

```js
repairWorldBossTerminalState(eventId)
```

只允許把 `status=defeated` 的 HP 修成 0，不允許反向復活或重寫排名。

## 6. 待領獎勵索引

歷史文件只作展示快照，不再是領獎資格來源。

新增 bounded query：

```js
getPendingWorldBossRewards(memberId, limit = 20)
```

查最近的 defeated 事件，篩選：

- `participants.{memberId}` 存在；
- 非 guest；
- `claimed !== true`。

由於動態 map 欄位無法合理建立查詢索引，先使用 `status == defeated + createdAt desc + limit(20)` 的 bounded query，避免全 collection 掃描。若 Firestore 現有索引不足，退化為最近 20 筆 createdAt query 並在客戶端篩選，不新增需要人工 Console 操作的複合索引。

請領改成交易式 claim marker。經濟獎勵若仍由多個 client helper 分段寫入，存在部分成功風險；本次優先新增 `worldBossRewardClaims/{eventId}_{memberId}` 冪等文件，或搬至 callable transaction。正式實作時以現有規則允許且能單次原子提交的方案為準。

## 7. 世界王降臨進度

collection：

```text
worldBossSpawnCycles/{cycleId}
```

文件形狀：

```js
{
  status: "resting" | "charging" | "spawning" | "spawned",
  previousEventId,
  previousBossKey,
  restEndsAt,
  deadlineAt,
  progress: {
    arrows,
    dungeonClears,
    monsterKills,
    villageDice
  },
  targets: {
    arrows: 10000,
    dungeonClears: 30,
    monsterKills: 500,
    villageDice: 300
  },
  triggeredBy,
  spawnedEventId,
  createdAt,
  updatedAt
}
```

名稱採「世界王降臨進度」，狀態文案：

- 休整期：「異界正在沉寂」；
- 累積期：「世界王降臨進度」；
- 達標時：「異界之門開啟」。

### 貢獻入口

沿用目前成功結算點：

- 箭數：耐久箭數 operation 成功提交時；
- 地下城：合法最終房結算成功時，每次 run 只算一次；
- 怪物：合法擊殺 claim 成功時；
- 骰子：村地圖移動 transaction 實際扣骰成功時。

每次貢獻使用 stable operation ID 寫 marker，避免重試重複累積。

### 召喚

任一進度達標，或 `deadlineAt` 到期後，執行 `trySpawnWorldBossFromCycle(cycleId)`：

1. transaction 將 cycle 從 charging 改成 spawning；
2. 建立隨機世界王事件並鎖死獎勵快照；
3. 回寫 spawnedEventId 與 spawned；
4. 更新 `worldBossStatus/current`。

純前端無法在沒有人開 App 時可靠執行 48 小時 deadline。若專案沒有 Scheduler，採「任何合法 App 活動或世界王頁開啟時檢查 deadline」的惰性觸發；後台保留手動召喚。若要精準到秒的無人觸發，需要另部署 Cloud Scheduler，列為部署階段選項。

## 8. 世界王獎勵

建立王時生成 `rewardSnapshot`，固定該場：

- shared base：全員相同；
- participation floor：只要合法參戰就有；
- contribution pool：依傷害比率分配但有最小值；
- top3 bonuses；
- last hit bonus；
- 既有卡片、召喚卷與收藏品。

預覽與實際請領必須讀同一份 snapshot，不能預覽一套、領取時重新擲另一套。隨機王卡若保留抽取，結果也要在 claim marker 第一次建立時鎖死。

## 9. 相容與回滾

- 舊 `dungeonFirstClear` 文件不刪除；新鍵不與舊 run ID 混用。
- 舊玩家沒有 `dungeonFirstClears` 時視為未知／尚未建立紀錄；不得依現有收藏品反推並覆寫，除非另做管理員遷移。
- 舊世界王事件讀取時正規化；只做單向 terminal repair。
- 舊自動生成函式保留無副作用回傳一段版本，確保舊 import 不炸掉。
- 新世界王降臨進度可由 feature flag／設定停用，停用時仍保留後台手動建立。

