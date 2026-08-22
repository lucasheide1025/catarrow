# 技術設計：地下城單怪／複數怪遭遇

## 邊界與原則

- 地圖只負責產生並保存「遭遇描述」，戰鬥引擎負責回合與演出，獎勵層負責冪等 claim；三者不可用 UI 狀態互相推導。
- 一對一分支保留現有 `DungeonBattleRoom`／`dungeonDb` 流程，以降低舊 active room 的相容風險。
- 複數分支復用現有 multi-monster v2 的目標、完整 loadout、權威回合 resolver 與 presentation event contract，新增地下城 adapter，不複製戰鬥公式。
- 地下城的地圖推進、跨房 HP、休息／商人加成、全滅及最終 claim 仍由既有單人／組隊遠征協調層管理。

## 遭遇模型

新增純函式 `resolveDungeonCombatEncounter(input)`，輸入至少包含：

- `runId`、`floorIndex`、`roomId`、`roomType`；
- dungeon `family`、`difficultyTier`；
- 已鎖定的主怪（尤其 Boss）；
- catalog/version。

輸出為可序列化且版本化的快照：

```js
{
  version: 1,
  encounterId: "dungeon:<run>:<floor>:<room>",
  seed: "...",
  kind: "single" | "multi",
  roomRole: "normal" | "elite" | "boss",
  primaryTargetId: "...",
  targets: [/* 完整且帶 instanceId 的怪物快照 */],
  rewardPolicy: {
    tileRewardOnce: true,
    primarySpecialRewardOnce: true,
    perTargetMaterialAndCard: true
  }
}
```

選擇規則：

- 一般怪物格：以 `encounterId` 派生的穩定亂數決定 50% single／50% multi。
- 一般 multi：使用既有複數遭遇生成器，怪物族系與地下城一致。
- 精英格：固定 multi，第一目標為既有精英怪，另抽兩隻同族一般怪。
- Boss 格：固定 multi，第一目標必須是地下城描述中已鎖定／預覽的 Boss，另抽兩隻同族一般怪。
- 組合一旦寫入 solo recovery map state 或 team coordination room 的 `pendingRoom.encounter`，任何重整、重連、重試都只讀快照，不重抽。

## 單人資料流

1. 玩家踩格時，以 run／floor／room seed 建立 encounter，先寫入 active expedition recovery state。
2. `kind=single` 沿用現有單怪戰鬥房建立流程。
3. `kind=multi` 建立地下城 multi battle identity，使用角色當下跨房 HP 與已鎖定卡片／裝備／貓咪／休息／商人狀態。
4. 權威 resolution 完成且 presentation queue 播完後才顯示勝敗與進行獎勵 claim。
5. 勝利後把玩家 HP／狀態與戰鬥紀錄回寫 active expedition，再標記地圖格 cleared。

## 組隊資料流與權威

1. 只有協調房 `hostId` 能為踩到的格子建立 encounter；先 transaction 寫入 `expeditionMapState.pendingRoom.encounter`。
2. 建立戰鬥房後，再把 battle room ID 與 encounter ID 原子地發布給隊員；非房主只訂閱與導頁。
3. multi 分支的回合提交、修訂、鎖定、RNG 與結算走 Functions 權威 resolver；Firestore client 對 active v2 battle 只讀。
4. 完成後由房主以 encounter／resolution ID 同步全隊 HP 與 run loot；同步操作必須冪等且不可重建已離隊成員。
5. 隊員重連時，從 coordination room 找到同一 encounter 與 battle room，不由本機再次生成。

## 獎勵契約

- 每個 target 使用 `encounterId + target.instanceId` 作素材／一般卡 claim key，各自至多一次。
- 每個怪物格使用 `encounterId + memberId + tile` 作金幣、射手經驗與收藏品 claim key，至多一次。
- 精英／Boss 特殊獎勵使用 `encounterId + primaryTargetId + memberId + primary`，只認主怪且至多一次。
- 小怪不可產生精英倍率、Boss 卡選擇、Boss 收藏品、王之印記或通關獎勵。
- 組隊最終 expedition claim 繼續以 coordination room 的 persisted loot 為真本；不得在戰鬥 client 提前重複入帳。

## 相容性與遷移

- 缺少 `encounter` 的舊 active expedition／battle room 視為 legacy single，不做資料遷移。
- 新欄位全部加法式；既有 Boss `bossEncounter` 與 `monsterSnapshot` 保留，並成為 multi 的 primary target。
- 若新 encounter schema 驗證失敗，停止建立該場戰鬥並顯示可恢復錯誤，不可靜默降級後換怪。
- 部署順序：先部署 Functions／rules（接受新 schema 且維持 legacy），再部署前端；回滾前端後舊單怪仍可運作，新 multi room 保持可讀但不可由舊前端誤處理。

## UI／演出

- 地下城 multi 使用既有手機單畫面多目標戰場、固定輸入盤、音效及不可跳過 presentation queue。
- 主精英／Boss 必須有清楚的主目標標記；兩隻小怪沿用目標選擇與擊殺演出。
- 即使某次傷害同時清空全部目標，也依事件順序播放攻擊、受傷、逐隻死亡、回合結束、勝利，完成前封鎖領獎／返回地圖。

## 主要風險

- 既有 multi party room 與 dungeon team coordination room 的生命週期不同：以 adapter 隔離，不把自由狩獵房間狀態直接塞進地圖狀態。
- 單怪獎勵目前部分為 client 即時入帳：multi 分支必須先建立共同 claim seam，否則小怪與重連會放大經濟漏洞。
- Boss 預覽與實戰曾有漂移問題：主 Boss 只能讀既有鎖定 snapshot，禁止重新抽取或重套 variant 倍率。

