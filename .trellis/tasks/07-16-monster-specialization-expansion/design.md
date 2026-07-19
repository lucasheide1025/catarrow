# Technical design

## 1. 發佈邊界

完整功能只先建立於本機分支並由 `monsterExpansionV1` feature flag 隔離。不得部署 Vercel、正式 Firestore、rules、index 或遠端 backfill；使用者完成本機驗收並另行明確說「部署」後，才建立獨立發佈階段。

## 2. 分層架構

```text
catalogs (pure data)
  monster / material / ability / signature / card / specialization / loot
                         ↓ validateCatalogs()
domain resolvers (pure + deterministic)
  combatRound / ability / companion / status / loot / conversion / upgrade
                         ↓
mode adapters
  solo / party / dungeonSolo / dungeonParty / worldBoss
                         ↓
persistence gateways
  existing db.js / partyDb.js / dungeonDb.js / worldBossDb.js
                         ↓
UI presenters
  telegraph / shooting / break / cat / monster / status / reward
```

UI 不決定隨機、傷害、掉落或保底。資料 catalog 不直接讀寫 Firestore。所有 resolver 接受明確 context 與已鎖定 RNG seed，回傳可序列化事件。

## 3. Catalog 邊界

- `monsterCatalog`: 252 monsters；舊60 ID原封不動，新192 ID依名冊。
- `materialCatalog`: 每個 monster 一個 material reference；一般／mini／boss分類決定轉換與箱池資格。
- `abilityCatalog`: 12 common skills、effect primitives、Tier band。
- `signatureCatalog`: 252 unique signature definitions，由 `signature-skill-mappings.md` 生成靜態資料。
- `cardCatalog`: 與 monster ID 一對一；效果使用族系／角色公式。
- `specializationCatalog`: 9 tracks ×10 levels，成本、成功率、效果與啟用槽。
- `lootCatalog`: 各 mode／room／chest 的 pool、Tier cap、amount、pity、exclusion。

建置前 `validateCatalogs()` 必須失敗即阻止啟動開發模式與測試：

1. 7 families×6 tiers×6 roles=252且ID唯一。
2. 每隻 monster 都有 material、signature、card、asset key。
3. 一般素材126種可轉換；mini84與boss42全部不可轉換／不可進普通箱。
4. 共用技能引用存在且符合Tier限制。
5. T6無向上合成；配方沒有負數、零數量與缺失引用。
6. 舊60 monster/card/material ID與基準快照完全相同。

## 4. 權威戰鬥狀態

```js
combatState = {
  version, battleId, mode, monsterId, monsterSnapshot,
  combatRound, phase, pendingTelegraph,
  skillState, skillHistory, statusEffects,
  companionState, submissions,
  resolvedSkillKeys, resolvedCompanionKeys,
  rngSeed, updatedAt
}
```

完整 phase：`telegraph → shooting → playerDamage → breakResult → companion → monsterAbility → statuses → counter → endHeal → completed/nextTelegraph`。

- 單人一次合法射箭提交推進一輪。
- 組隊只有權威交易確認所有有效成員已提交或依既有超時規則排除後，才推進一輪。
- 動畫、snapshot、訂閱、刷新不改 round；UI只依 phase 播放。
- 技能鍵：`battleId:round:monsterId:skillId`。
- 貓咪鍵：`battleId:round:memberId:companionId`。
- 任何鍵已存在即回傳先前結果，不重算。

## 5. 組隊與重連

- 遭遇開始時快照 monster、技能排程、有效成員、靶紙、箭數、難度與房間獎勵 seed。
- 隊員斷線不重建房間、不重抽王怪、不改靶紙或箭數；重連讀取 snapshot 與未完成 phase。
- 貓咪固定前／中／後排後按 member ID 排序，每位合格成員每輪最多一次。
- 隊伍怪物數值不再依人數縮放；世界王維持既有獨立模型。
- 房主必須有選擇目標資格；隊員可加入尚未自行解鎖的內容並獲完整個人獎勵，但不因此解鎖自己的下一難度。

## 6. 能力解析順序

1. 讀取鎖定 skill definition 與 telegraph。
2. 正規化玩家分數並計算 breakRatio。
3. 套完整／大幅／部分／未破解級距。
4. 貓咪依序行動；若怪物死亡，寫入技能取消事件。
5. 解析怪物技能 primitives。
6. 套玩家防禦、護盾、專精、最低1HP規則。
7. 寫入狀態、歷史與 resolved key。
8. 處理反擊、回合末治療、下一回合預告。

世界王使用同一分數正規化 helper，但第2／4回合走獨立 `worldBossPowerAttackResolver` 與×0／×0.4／×0.7／×1.0傷害級距；第2回合最低保留1HP，第4回合可擊倒，任何世界王不得回復全域HP。

## 7. 掉落與交易

- 戰鬥結算建立 immutable reward result，再由 persistence gateway 原子寫入。
- RNG 使用 `hash(battleId|roomId|memberId|rewardSlot|catalogVersion)`，重試得到同結果。
- 王房選擇箱先寫 options，再由玩家選擇；不可在選擇時重抽。
- 素材轉換、5換1、專精升級、開箱全部使用交易；先驗證版本、庫存、金幣與 resolved key，再一次扣寫。

## 8. 專精狀態

```js
equipment.specializations = {
  version: 1,
  weapon: { activeTrackId, tracks: { precision:{level,failCount}, ... } },
  armor: { activeTrackId, tracks: {...} },
  accessory: { activeTrackId, tracks: {...} }
}
```

舊裝備缺欄位視為全部Lv0／未解鎖，不需批次 backfill。第一次讀寫時補預設值。升級交易以 `equipmentId+trackId+targetLevel+attemptNonce` 冪等，伺服端重新計算成本與成功率，不信任UI傳入值。

## 9. 向後相容

- 不更名舊60 monster IDs、既有卡片 key、素材 key、裝備 key與圖鑑 key。
- 舊卡收藏與裝備狀態原樣讀取；新欄位皆有預設值。
- 舊 `nextMats` 加 `recipeVersion:0`，允許一次舊制；下一張配方為version1。
- 舊未開普通箱使用新版一般池，但箱子 instance ID不變。
- 現有地下城 run 若無 expansion snapshot，整場沿用舊版規則；只有更新後新建 run 使用version1，避免進行中地圖半套遷移。

## 10. UI與資產

- 技能演出由事件資料映射到短動畫，不允許技能定義注入任意元件。
- 預設技能音效與震動分開開啟，進入地下城前可個別關閉；設定持久化。震動需檢查瀏覽器支援。
- reduced motion 移除震屏、位移與粒子，只保留≤150ms亮框、圖示、數值。
- 卡片／圖鑑分組後懶載入；素材清單使用虛擬化或分組，不一次渲染252張圖片。
- 圖片命名以 monster ID，提供WebP/AVIF及手機尺寸；缺圖時使用安全 fallback，不阻塞戰鬥。

## 11. Rollback

- 本機 feature flag 關閉時沿用舊 catalog 與舊戰鬥UI。
- Catalog version與戰鬥 snapshot綁定；回滾不重解讀進行中version1戰鬥。
- 沒有遠端部署前不做破壞性資料遷移。正式發佈計畫需另建備份、rules/index與分批啟用文件。
