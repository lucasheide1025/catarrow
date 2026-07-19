# Design — 地下城接線：中途樓層擴充怪物池＋招牌技能引擎

## 現況地圖（調查結論）
- 中途樓層抽怪：`monsterData.drawFloorMonsters(floorIndex, difficultyTier, {family, fixedBoss})` → `drawMixedMonsterPool`（舊 60 隻表）。呼叫點：
  - `DungeonExpedition.jsx` L417（startFloor）、L623（fallback 補怪）
  - `TeamExpeditionBattle.jsx` L9 import、L62/L67/L80/L110（樓層計畫與 fallback）
- 王房已接擴充：`dungeonBossEncounter.createLockedDungeonBossEncounter`（出圖/開房鎖定，seeded）。
- 戰鬥流程：單人＋組隊地下城都走 `DungeonBattleRoom` → partyMode `BattleScreen`（純顯示）＋ host 端 `dungeonDb.processDungeonRound(roomId, room, calcDmgFn, calcCtrFn)` 權威結算。
- 技能引擎：`soloMonsterAbilityEngine.resolveSoloMonsterAbility` 包 `monsterSkillSchedule`（排程）＋`signatureAbilityEngine`/`combatSkillEngine`。底層 `calculateBreakRatio(submissions[])` **已支援多人聚合**（分子/分母合計）；缺的只是 team 呼叫路徑與 host 接線。
- 戰鬥圖：`getBattleMonsterSources(id)` → `/monsters-battle/{id}.webp`，252 隻全存在，免改。

## A. 中途樓層擴充怪物池

### 新模組 `src/lib/dungeonExpansionMonsters.js`
```
DUNGEON_DIFFICULTY_TIER_POOL = { 1:["common","rare"], 2:["fierce"], 3:["boss"], 4:["mythic"] }
  // 普通=T1-2、進階=T4、困難=T5、地獄=T6;difficulty clamp 1..4（≥4 視為地獄）
drawExpansionDungeonFloorMonsters(floorIndex, difficulty, { family, fixedBoss, random })
  → { monsters, elite, boss }   // 與 drawFloorMonsters 同形狀
drawDungeonFloorMonsters(floorIndex, difficulty, opts)
  → flag on 且擴充池有效 → expansion;否則 fallback 舊 drawFloorMonsters（唯一接線入口）
drawExpansionDungeonMonster(variant, difficulty, { family, random })
  → 單隻補怪（取代呼叫端 drawMixedMonsterPool(1, …) fallback）
```
- 抽選範圍：`EXPANSION_MONSTERS.filter(family===f && encounter==="normal" && tierPool.includes(tier))`；treasure 族同規則。
- family 經 `FAMILY_ALIASES`（dungeonBossEncounter 已有，抽出共用或複製常數）正規化（forest→mountain 等）。
- 變體倍率：沿用 adapter `applySoloVariant` 的 weak/strong 範圍——從 `monsterExpansionAdapter` export（改 export 現有私有函式，不複製數值）。
- `toLegacyBattleMonster` 轉換後怪物自帶 `signatureSkillId`/`commonSkillIds`/`tierIndex` → B 部分直接可用。
- 王房：維持現行 `fixedBoss`（來自 lockedEncounter snapshot）優先，本模組不重抽王。

### 接線
- `DungeonExpedition.jsx`：`drawFloorMonsters` → `drawDungeonFloorMonsters`；L623 fallback → `drawExpansionDungeonMonster`（flag off 走舊）。
- `TeamExpeditionBattle.jsx`：同上取代 import 與 4 個呼叫點。
- 房主產怪、成員吃 room doc snapshot → 組隊天然同步，無需額外同步機制。

## B. 地下城招牌技能（host 權威、一回合一次）

### 引擎層：`soloMonsterAbilityEngine` 加 team 入口
```
resolveTeamMonsterAbility({ battleId, monster, round, submissions, targetFmt, monsterHpRatio })
  // submissions = [{ eligible, arrows }]，與 combatSkillEngine.calculateBreakRatio 相容
  // 內部與 resolveSoloMonsterAbility 共用同一實作（solo = submissions 長度 1 的特例）
```
- 不新建引擎檔：把 `resolveSoloMonsterAbility` 主體抽成內部函式，兩個 export 包裝，避免行為分歧。

### `processDungeonRound` 插入「Step 2.5 怪物技能」
- 位置：玩家傷害彙總（Step 1）之後、反擊（Step 3）之前。
- 輸入：`submissions` = 本回合有效成員（`validSubmission`，倒地/跳過排除）的 `arrows` 分數；`monsterHpRatio` = 扣掉本回合玩家傷害後的 HP 比例。
- resolved key：引擎內建 `battleId+round` 冪等——battleId 用 `dungeon:{roomId}`；host 端 `room.processing` 鎖已防併發，log 一回合一筆為第二道防線（重試前檢查該 round 是否已有 ability 記錄）。
- 效果落地（對映現有 room 欄位）：
  - 技能傷害：`calcCtrFn(monster.atk, member.def) × skillDamageMult`；target `single`→現行反擊目標規則（前衛輪替）、`party`→全體有效成員 ×0.5、`self`→怪物增益不打人。保底：不打死，最低留 1 HP（與單人一致）。
  - 異常（poison/atkDown/defDown）：存 room doc `abilityStatuses.{memberId}[]`（`mergeCombatStatus` 規則）；下回合 Step 1 計算 effectiveAtk/def 時套用、回合末 `applySoloStatusTick` 扣毒。戰鬥房每場新 doc → 換房自動清空。
  - 怪物自身盾/減傷/回血：存 `monsterAbilityState`（shieldHp、reductionPct、healPct 即時加回 monsterHP，不超過 max）。
- log entry 加 `ability` 欄位：`{ name, skillId, breakRatio, breakTier, damageByMember, statusApplied, monsterEffect }`。

### 顯示層：`BattleScreen` party 路徑
- `partyResolution.ability` 存在時觸發既有 `skillFx` 蓋版（standalone 已有同款演出，補 partyResolution effect 分支）；四色破解結果沿用。

### 相容/回退
- flag off 或 `!monster.signatureSkillId` → Step 2.5 完全跳過，log 無 ability 欄位，UI 不觸發——與現行行為一致。
- 進行中的舊 run（房內怪是舊表）自然沒有 signatureSkillId，不受影響。

## 風險
- `processDungeonRound` 是 client-host 端大函式：插入點保持獨立區塊、純函式計算放引擎層，host 只做欄位讀寫。
- 組隊雙端顯示一致性：一切以 room doc log 為準，成員端不自行結算。
- Firestore rules：不新增 collection，只在既有 dungeon room doc 加欄位 → 免改 rules。
