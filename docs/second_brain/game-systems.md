# 🎮 game-systems — 遊戲化規格
> 最後更新：2026-07-10（訪客/兒童地下城比照正式系統）

🔗 **在 Obsidian 中開啟**：`obsidian://open?vault=Obsidian%20Vault&file=catarrow%2Fgame-systems`

## 訪客/兒童地下城（2026-07-10，整合正式系統）

訪客/兒童模式的地下城不再是獨立簡化版（`GuestDungeonSimple.jsx` 已刪除），改成直接重用正式系統元件
（`DungeonLobby`/`DungeonSelectionPanel`/`DungeonExpedition`/`DungeonBattleRoom`），只是入口換成新元件
`GuestDungeonEntry.jsx`（T1/T2 難度選擇，跳過挖掘機制，就地生成 dungeon 物件）。

- **難度封頂**：固定 T1-T2（`tierCap=2`），兩層防禦——入口 UI 只給 2 個選項 + `DungeonExpedition.jsx` 內
  再次用 `Math.min(difficulty, tierCap)` 夾住樓層怪物池，**且** boss 物件本身也用封頂後的 tier 重新抽取
  （不能只夾數字不夾 boss 物件，否則王關戰鬥可能仍是高難度怪物）。
- **不開放**：挖掘探索分頁（賺解鎖機率的機制對訪客沒意義，整個不渲染）、組隊地下城（只做單人）。
- **開放**：裝備系統（`EquipmentPage`/`RPGEquipPanel`）、真實掉落物（材料/金幣/收藏品持久化寫回
  `members/{id}`，跟正式學生走同一條結算路徑，跟 `MonsterBattle.jsx` 訪客首勝勳章流程完全獨立無關）。
- 完整技術細節（prop 傳遞設計、兩層封頂逐字實作、`useAuth()` 資料外洩踩坑）見 `quick-ref.md`
  「🎈 訪客/兒童地下城整合」章節與 `changelog.md` 2026-07-10 條目。

## 完整角色數值公式

```
HP  = calcArcherStats.hp  + archerLevelBonus(lv).hp  + calcEquippedBonus(cards).hp
ATK = calcArcherStats.atk + archerLevelBonus(lv).atk + calcEquippedBonus(cards).atk
DEF = calcArcherStats.def + archerLevelBonus(lv).def + calcEquippedBonus(cards).def

calcArcherStats 需要：{ member, certification, certRecords, dexStats }
  HP 基礎 200（上限 800）/ ATK 基礎 15（上限 160）/ DEF 基礎 10（上限 120）

archerLevelBonus(level)：每級 hp+5 / atk+1 / def+1

calcEquippedBonus(cards[])：cards = equipped.map(id=>cardColl.cards[id]).filter(Boolean)
```

## 報到流程（2026-06-25 改版）

```
登入 → 浮動視窗（sessionStorage flag 防重複）
→ submitCheckin → pending
→ 教練 AdminDailyQuest 審核 → approveCheckin(→active) / rejectCheckin(→rejected)
→ active 時可累積箭數
→ 學生 DailyQuest 點下課 → submitClassEnd → classEnded=true
→ addArrowdew(今日總箭數) → getMilestonesReached → grantArrowMilestoneRewards
```

**注意**：MemberPractice 有 `classEndedRef`，下課後不觸發里程碑（防重複結算）

## 前後衛系統（地下城 + 組隊，2026-06-27 統一規格）

```
role = "front" | "rear"（每回合送箭時選擇）

【前衛】
- 正常攻擊
- 怪物反擊只打前衛（frontIds 存活時後衛免疫）
- HP 歸零 → 不立即陣亡，自動轉後衛 + 復活 50% maxHP
  → 新 role 由伺服器寫入 Firestore，前端下回合從 room.members[id].role 讀取

【後衛 - 選攻擊 (rearChoice="dmg")】
- 箭傷 × 0.5
- 反擊免疫

【後衛 - 選治癒 (rearChoice="heal")】
- 不攻擊怪物（arrowBreakdown dmg 計算但 dmgMul=... 等等，實際上後衛dmg仍計算，heal選擇下照算箭傷）
  ⚠️ 注意：heal 選擇下並沒有 dmgMul=0，箭傷照常計算（不是0傷）
- 每回合末：pool = 25% maxHP → 均分給所有存活隊友（不含自己）
- 反擊免疫
```

**實作位置**：
- `dungeonDb.js` `processDungeonRound` — 地下城版本
- `partyDb.js` `processPartyRound` — 組隊版本（2026-06-27 新增）

## 怪物人數縮放（地下城 + 組隊，2026-06-27 統一規格）

```
N = 玩家人數（含 bot），extraMembers = N - 1

monHPMult  = 1.0 + extraMembers * 0.5   (HP  每多一人 +50%)
monAtkMult = 1.0 + extraMembers * 0.15  (ATK 每多一人 +15%)
monDefMult = 1.0 + extraMembers * 0.15  (DEF 每多一人 +15%)
rewardMult = 1.0 + extraMembers * 0.2   (金幣/XP/掉落 每多一人 +20%)

• 地下城：startDungeonBattle → monster.atk/def 已縮放存入 Firestore
• 組隊：startPartyBattle → 同上；rewardMult 存入 room document
• 結算時讀取 room.rewardMult，套用於金幣/XP/collectible chanceMult
```

## 射手 XP 來源

```
打怪單人：MONSTER_TIER_XP[tier]（5/10/20/30/50/80）
組隊：    怪物 XP × 1.5
決鬥勝：  50 / 決鬥敗：20
地下城：  通過每層 × 15
世界首領：每回合 × 2.0，上限 300
```

## 🏗️ 戰鬥系統架構（2026-07-01 Phase 1-8）

### 資料流

```
傷害引擎 (damage.js)
  ↓
事件產生器 (BattleEngine.js) 或 自訂回合邏輯
  ↓
標準化事件陣列 (EventType 22 種)
  ↓
動畫派遣器 (BattleAnimation.js → EVENT_DISPATCH)
  ↓
RoundController.playEvents() 排程播放
  ↓
per-event-type handlers 更新 React state
```

### 核心模組

#### `src/lib/damage.js` — 統一傷害公式

```
calcArrowDamage(score, atk, def, dex, options)
  → { dmg, isCrit }
  → 爆擊 ×1.5、DEX +1 分、±10% 隨機
  → options: { forceCrit, isRear, monHPMult, monDefMult, extraDmgMult }

calcCounterDamage(monAtk, def)
  → counterDmg

calcStandardArrowDmg(roundResult, state)  → [arrowResults]
  → 封裝 MonsterBattle 的完整箭矢計算

calcStandardCounter(state)  → counterResults
  → 封裝 MonsterBattle 的反擊計算

calcWorldBossArrowDmg(score, atk, def, bossAtk, bossDef, assistSum)
  → { dmg, isCrit }
  → 世界王專用：支援助攻縮放

calcCatDamage(catAtk, targetDef, isDuelVariant=false)
  → { dmg }
```

#### `src/lib/score.js` — 統一計分邏輯

```
SCORE_MAP = { X: 11, "10": 10, "9": 9, ..., M: 0 }
SCORE_MAP_REVERSE = { 11: "X", 10: "10", ..., 0: "M" }
SCORE_COLORS = { X: amber, "10": green, ... }
SCORE_ROW_A = ["X", "10", "9", "8", "7", "6", "M"]
SCORE_ROW_B = ["6", "5", "4", "3", "2", "1", "M"]

scoreLabel(score)  → string
scoreValue(label)  → number
```

#### `src/battle/BattleEvents.js` — 標準化事件型別

22 個 EventType（字串值）：
```
ARROW_HIT / ARROW_CRIT / ARROW_ORGAN_HIT / ARROW_MISS / ARROW_SCORE_POTION / ARROW_THROW_POTION
COUNTER_PHYSICAL / COUNTER_TOTAL / COUNTER_SKIPPED / COUNTER_BLOCKED
CAT_ATTACK / CAT_HEAL / CAT_DEFEND / CAT_HIT / REVIVE / ROUND_RESULT
RANDOM_EVENT / DISTANCE_CHANGE / BATTLE_WIN / BATTLE_LOSE / THROW_DISPLAY / DEATH
```

每個 EventType 有對應的 `createXxxEvent()` builder 函式。

#### `src/battle/BattleConfig.js` — 戰鬥參數

```
ARROWS_PER_ROUND = 6          // MonsterBattle 預設箭數
ARROWS_OPTIONS = [3, 6]        // 地下城/組隊可選箭數（2026-07-02 新增）
ARROWS_PER_ROUND_DEFAULT = 6   // fallback（2026-07-02 新增）
FIGHT_DISTANCE = 20
FIGHT_MAX_RANGE = 40
HEAL_POOL_PCT = 0.25
REAR_NERF = 0.5      // 後衛傷害 ×0.5
COUNTER_NERF = 0.5    // 反擊傷害 ×0.5
// COUNTER_INTERVAL 已移除（2026-07-02 大回合制重構）

getConfig(mode)  → { arrows, distance, ... }
```

#### 地下城/組隊回合流程（2026-07-02 大回合制重構）

```
大回合流程（dungeonDb + partyDb）：
1. 所有箭矢攻擊 mini-rounds（arrowsPerRound 箭，每箭一個 miniRound entry）
2. 貓貓攻擊（若存在）
3. 怪物反擊 1 次（大回合末，isCounter: true）

arrowsPerRound 來源：room.arrowsPerRound || 6（房主在等待室設定，存入 Firestore）
選項：3 箭 或 6 箭

舊制（已廢棄）：每 2 箭反擊 1 次（ARROWS_PER_CTR = 2），共 3 次反擊/大回合
```

#### `src/battle/BattleEngine.js` — 事件產生器

```
generateRoundEvents(roundResult, state)
  → events: Array<{ type: EventType, payload: {...} }>
```

用於 MonsterBattle 模式。事件順序（2026-07-02 重排）：
- **Phase 0**：隨機事件（先決定 ATK/HP 修正，可能直接 BATTLE_WIN）
- **Phase 1**：玩家箭矢（ARROW_HIT / ARROW_CRIT / ARROW_MISS / ARROW_THROW_POTION）
- **Phase 2**：貓貓回合（CAT_ATTACK / CAT_HEAL / CAT_DEFEND）
- **Phase 3**：怪物反擊（COUNTER / COUNTER_CRIT / COUNTER_SKIPPED…）
- **Phase 4/5**：ROUND_RESULT / BATTLE_WIN / BATTLE_LOSE

#### `src/battle/BattleAnimation.js` — 動畫派遣器

```
createDispatch()  → {
  playSoundEffect(type, ctx),
  playHitAnimation(type, ctx),
  playVisualEffect(type, ctx),
  dispatch(eventType, payload, context),  // ← 主要入口
  addRoundLog(phase, msg),
  addEventLog(arrowResult, monsterIdx),
  addBattleLog(entry),
  ...helpers
}

EVENT_DISPATCH = {
  [EventType.ARROW_HIT]:      animateArrowHit,
  [EventType.ARROW_CRIT]:     animateArrowCrit,
  [EventType.COUNTER_...]:    animateCounter,
  ...全部 22 個 EventType
}
```

dispatch 會自動查表執行對應的 playXxx，若找不到對應 handler（如自訂 EventType），則跳過 animate step。

#### `src/battle/useFirestoreRound.js` — Firestore 回合 hook

```
useFirestoreRound({
  roomId, myId, isHost,
  subscribe,         // (roomId, cb) => unsub
  submit,            // (roomId, memberId, ...args) => { ok, reason }
  processRound,      // (roomId, room, ...extraArgs) => void
  getMembers,        // (room) => Member[]
  isProcessing,      // (room) => boolean
  canProcess,        // (room) => boolean
  getBotsUnready,    // (room) => { id, team, m }[]      (DuelRoom)
  submitBotArrows,   // (roomId, team, id, m) => void   (DuelRoom)
  getExtraProcessArgs, // (room) => any[]               (DungeonBattleRoom)
  onBeforeSubmit,    // (memberId, room) => void
  onSubmitError,     // (error) => void
  processDelayMs,    // default 0 (Dungeon: 1000)
  maxRetries,        // default 4
}) → {
  room,              // Firestore room document
  submitted,         // boolean — 是否有提交
  submitting,        // boolean — 提交中
  handleSubmit,      // (...args) => submit + setSubmitted(true)
  fsHandleSubmit,    // 不自動 setSubmitted 的 submit
  setFsSubmitted,    // 重置 submitted
  retryCount,        // 當前重試次數
}
```

**內部管理**：
- subscribe lifecycle（auto cleanup on unmount）
- submitted / submitting state
- all-ready detection（每當 room 變更時檢查）
- host processing delay + retry（含 maxRetries 安全網）
- bot arrows submission（DuelRoom）
- non-host processing timeout（20s 自動重置）

#### `src/battle/RoundController.js` — 通用事件播放控制器

```
new RoundController({ customDelays })  // customDelays: { [type]: ms }

controller.playEvents(events, eventCtx, handlers)
  → Promise<{ battleEnded: boolean, battleResult: string | null }>
```

**處理流程**（每個 event）：
1. EVENT_DISPATCH animation handler（若存在）
2. per-event-type state handler（從 handlers 映射查表）
3. Delay（箭矢類 1500ms，其他 0ms，可自訂）
4. `await handlers.onRandomEventEnd?.()` — RANDOM_EVENT 後**等待 Promise resolve**（玩家點擊彈窗才繼續）
5. BATTLE_WIN/LOSE 自動中斷 loop

**預設延遲映射**：
- `arrow_hit` / `arrow_crit` / `arrow_organ_hit` / `arrow_miss` / `arrow_throw_potion` → 1500ms
- 其他 EventType → 0ms
- `customDelays` 優先級最高，可用於覆寫（如 WorldBossAttack 用 600ms）

**per-event-type handlers**：每個 handler 簽名為 `(payload, eventCtx) => void`

#### `src/battle/useMiniRoundReveal.js` — 共用 mini-round 動畫 hook（Phase 7）

```
useMiniRoundReveal() → {
  liveEntry,           // 當前播放中的 log entry（null = 無動畫）
  liveMiniIdx,         // 當前播放到的 mini-round index
  animHit,             // 怪物閃白動畫
  animMonsterCharge,   // 怪物蓄力狀態
  animScreenShake,     // 螢幕震動
  floatCounterDmgs,    // 反擊浮動傷害 [{ id, memberId, text }]
  localHpOverride,     // 反擊期間 HP 暫存 { [memberId]: hp }
  floatDmg,            // 攻擊浮動傷害 { dmg, isCrit }
  attackingIds,        // 當前攻擊中的 memberId Set
  animPhase,           // "player"|"attacking"|"cat"|"counter"|null（2026-07-02 新增）
  isPlaying,           // !!liveEntry
  startReveal(entry, opts),
  stopReveal(),
  clearTimers(),
}

// animPhase 語意（2026-07-02）：
//   "player"    = initialDelay 預備期（還未攻擊，顯示「玩家回合」banner）
//   "attacking" = 玩家攻擊 mini 進行中（banner 消失）← 舊版是 "player"，已修正
//   "cat"       = 貓貓 mini
//   "counter"   = 怪物反擊 mini（顯示「怪物反擊！」banner）

// opts 參數：
//   key           — 去重 key（相同 key 不重播）
//   initialDelay  — 第一個 mini 前的預備期（預設 0ms；PartyBattleRoom 用 2000ms）
//   attackDelay   — 每攻擊 mini 間隔（預設 1400ms）
//   counterDelay  — 每反擊 mini 間隔（預設 2700ms）
//   entryEndExtra — 最後一個 mini 結束後額外停留（預設 1500ms；擊殺回合用 3500ms）
//   members       — room.members（反擊 HP lock 用）
//   onMiniTick(mini, idx)   — 每個 mini 開始時
//   onCounterHit(mini, idx) — 反擊命中時
//   onEntryEnd(entry)       — 全部播完 + entryEndExtra 後（此時 liveEntry 已清為 null）
```

#### `src/battle/useDuelReveal.js` — 決鬥逐箭揭露 hook（Phase 8）

```
useDuelReveal({ room, onSoundEffect, onComplete, opts? })
  → { revealEntry, revealIdx, displayHp, floats, flashIds,
      attackingIds, hittingIds, eventPhase, showCatRound,
      duelCatCats, revealPhaseBanner, isRevealing,
      hasRevealed, skipEvent, stopReveal }

// 內部 effect 流程：
// room?.log?.length 改變 → 計算 preHp → 設定 displayHp/revealEntry
//   └─ 有 event? → eventPhase=true（等待 skipEvent 或 4s 自動）
//   └─ 無 event? → revealIdx=0
// revealIdx 0~5  → A 隊 6 箭（每 1000ms 揭露一步）
// revealIdx 6    → 換邊橫幅「隊伍 B 反擊！」（900ms）
// revealIdx 7~11 → B 隊 6 箭（每 1000ms 揭露一步）
// revealIdx >= 12 → 貓貓 overlay + 清理 displayHp + onComplete

// opts 可選項：
//   arrowDelayMs: 1000,     // 每箭延遲
//   phaseBannerDelay: 900,  // 換邊橫幅延遲
//   eventPauseMs: 4000,     // 事件暫停時間
//   catOverlayMs: 2500,     // 貓貓 overlay 時間

// callbacks：
//   onSoundEffect(hasCrit, hasHit) → 音效處理（sfxCritBoom / sfxArrowHit）
//   onComplete(entry) → 揭露完成後清理（sfxMonsterDead 檢查）
```

**三種 hook 對比**：

| 特性 | RoundController (Phase 6) | useMiniRoundReveal (Phase 7) | useDuelReveal (Phase 8) |
|------|--------------------------|-----------------------------|-------------------------|
| 適用場景 | 事件驅動、EVENT_DISPATCH 動畫 | mini-round 離散回合動畫 | 逐箭揭露（A 隊→B 隊） |
| 播放單位 | EventType 陣列 + per-type handlers | miniRounds 陣列 + callbacks | 12 步 revealIdx 計時器 |
| 動畫派遣 | 自動透過 EVENT_DISPATCH | 由 callbacks 自行處理 | 內部管理 floats/flashIds |
| 計時管理 | 依 EventType 映射延遲 | 依 mini-round 類型（攻擊/反擊）延遲 | 依步數（1000ms/箭） |
| 使用模式 | Monster/Council/WorldBossAttack | PartyBattleRoom/DungeonBattleRoom | DuelRoom |
| 狀態管理 | 外部 eventCtx | hook 內部管理 8 個 state | hook 內部管理 11 個 state |

## 卡片系統

```
MAX_EQUIPPED=5
種族→屬性：forest→hp / dragon→atk / undead→def / beast→atk / demon→hp / machine→def
升星費用：STAR_UPGRADE_COST=[1,2,3,4,5]（碎片）
cardColl 訂閱：subscribeCardCollection → { cards:{}, equipped:[] }
顯示用 useState，異步函式用 useRef（雙軌設計，MonsterBattle 已套用）
```

## 箭露與里程碑

```
下課時：addArrowdew(memberId, todayArrows)
里程碑：getMilestonesReached(old, new) → grantArrowMilestoneRewards
MemberPractice 練習結束後：classEndedRef.current === true 時跳過里程碑
```

---

## 貓貓村材料系統（2026-06-25 重新設計）

### 兩系統邊界

| 系統 | 專屬資源 | 共用資源 |
|------|---------|---------|
| 貓貓村 | 村莊材料（礦物/瓜瓜/鮮魚/動物肉/小魚乾/貓罐頭/貓薄荷/貓毛） | 六族材料包、箭露、金幣、藥水、怪物卡 |
| 打怪RPG | 六族怪物材料（common~mythic，36種） | 同上 |
| 射手遠征 | 任務特殊材料（Lv17+建築升級用） | 精英/傳說族材料包 |

### 村莊建築累積生產（高稀有度 = 低產量）

| 建築等級 | T1 | T2 | T3 | T4 | T5 |
|---------|----|----|----|----|-----|
| T1（Lv1-4） | 100% | — | — | — | — |
| T2（Lv5-8） | 70% | 30% | — | — | — |
| T3（Lv9-12） | 50% | 30% | 20% | — | — |
| T4（Lv13-16） | 40% | 30% | 20% | 10% | — |
| T5（Lv17-20） | 35% | 25% | 20% | 15% | 5% |

比例指「每小時產出分配」，高 tier 材料稀有，T5 即使到最高級也只佔 5%。

**2026-07-12 平衡調整**（鍛造上限 50 級、一格 ~18,450 材料，決策：成本不砍、改灌產出）：
- 建築 `STAGE_MULTIPLIERS [1,1,1.1,1.2,1.4]→[1.2,1.4,1.7,2,2.5]`。只作用於**分層材料**（礦/肉/小魚乾/藥水），**不影響箭露/扭蛋幣** → 鍛造料產能提高但**建築升級門檻不變**。
- **貓貓圖鑑生產加乘預留** `CATDEX_PRODUCTION_MULT = 1.0`（`villageData.js`），`calcPendingResources(village, { catDexMult })` 傳入，未實裝前恆為 1。
- **貓貓遠征隊改為主力產出**：材料 ×4（`EXPEDITION_MATERIAL_BOOST`）、T3~T5 補齊高階 matKey tier（打通貓草包=driedfish 死路）、每趟發 catXP（×貓戰力、上限 800）＋catBond（上限 15）。見 [[cat_card_system]] / changelog。

### 六族材料包（三系統橋接貨幣）

| 包等級 | 內容 | 主要來源 |
|--------|------|---------|
| 基礎包（T1-T2） | 指定族 common×5 + rare×2 | 村莊市集兌換、打怪低階掉落 |
| 進階包（T2-T3） | rare×4 + elite×2 | 村莊高階兌換、打怪中階掉落 |
| 精英包（T3-T4） | elite×3 + fierce×2 | 射手遠征回傳、打怪高階掉落 |
| 傳說包（T4-T5） | fierce×2 + boss×1 + 機率 mythic | 射手遠征限定 |

### 村莊市集兌換表

| 兌換品 | 消耗村莊材料 | 備註 |
|--------|------------|------|
| ghost族基礎包 | 礦物T1 × 40 | 其他族等比，用對應建築材料 |
| ghost族進階包 | 礦物T1 × 80 + T2 × 30 | |
| 藥水箱 | 貓薄荷藥水 × 15 | 煉金室產出的用途 |
| 怪物卡包（1抽） | 貓毛 × 20 | 隨機36種怪物卡 |
| 金幣寶箱 | 箭露 × 100 | 直接換金幣 |

### 廢料換箭露（手動點擊）

| 材料等級 | 兌換比例 |
|---------|---------|
| T1 × 200 | 箭露 × 1 |
| T2 × 100 | 箭露 × 1 |
| T3 × 50  | 箭露 × 1 |
| T4 × 20  | 箭露 × 1 |
| T5 × 5   | 箭露 × 1 |

### 打怪材料掉落（2026-06-25 提高）

```
MATERIAL_CHANCE: common 55% / rare 65% / elite 75% / fierce 85% / boss 92% / mythic 97%
getMaterialDropCount: common 1 / rare 2 / elite 3 / fierce 4 / boss 5 / mythic 7

rollMaterialDrop(monster)  → 單一材料（組隊預覽用）
rollMaterialDrops(monster) → 陣列（MonsterBattle / DungeonBattleRoom 用）
```

**踩坑提醒**：PartyBattleRoom 有 previewReward 機制（預覽時先 roll），仍使用 rollMaterialDrop 單一值，避免破壞預覽與實際領取的顯示一致性。

---

## 地下城任務類型/商店/事件重設計（2026-06-27 新版）

### 新任務類型（9 種）

```
【標準關 standard】
  六箭正常計算傷害，無特殊規則

【指定得分關 score_gate】
  每箭需 ≥6 分才計傷害，低於 6 分視同脫靶
  → param: 無（固定 6 分）

【命中關 hit_count】
  命中即固定傷害，與分數無關，必定爆擊

【精準關 all_hit】
  六箭全中才能造成傷害，任一箭 M 則全部歸零

【指定分數爆擊關 x_crit】
  param = 6~10 隨機一個分數
  射中該指定分數 → 強制爆擊（傷害 ×2）
  射中其他分數 → 傷害減半

【超越分數關 target_score】
  param = 20~50 隨機門檻
  6 箭總分（X 算 11 分）超過門檻才有傷害
  未達標 → 全部歸零

【逆轉關 reversal】
  6 分 → 爆擊
  7 分 → 必中（正常傷害）
  8 / 9 / 10 / X → 脫靶（0 傷害）

【單數關 odd_only】
  只算 7、9、X，其他分數視同脫靶

【雙數關 even_only】
  只算 6、8、10，其他分數視同脫靶
```

**實作位置**：`dungeonData.js` `calcDungeonContractDmg` function

**移除的舊類型**：無（僅改名與改邏輯）

### 商店物品（8 種，移除無用項目）

**已移除**：
- ❌ `contract_reset`（契約重置）— 不需要
- ❌ `rune_repair`（符文修復石）— 不需要

**保留 8 項**：
```
hp_potion      (50金) 回 30% HP
hp_max_boost   (100金) 永久 HP 上限 +30%（僅此局）
atk_boost      (80金)  ATK ×1.2
atk_large      (150金) ATK ×1.5
def_boost      (80金)  DEF ×1.2
def_large      (150金) DEF ×1.5
revival        (100金) 復活符（下次陣亡自動 30% 復活）
revival_front  (120金) 前衛復活藥（倒地前衛 50% HP 轉回前衛）
```

**實作位置**：
- `dungeonData.js` `DUNGEON_SHOP_ITEMS`（資料）
- `dungeonDb.js` `purchaseDungeonItem`（效果處理）
- `src/components/dungeon/DungeonShop.jsx` `SHOP_ITEM_META`（前端顯示）

### 隨機事件（21 種，含精細級距）

**已移除**：
- ❌ `scroll`（古老卷軸）
- ❌ `contract_swap`（契約轉換）
- ❌ `mysterious_altar`（神秘祭壇）

**分級 ATK debuff 範例**：
```
cursed_fog     ATK ×0.8  (輕度弱化)
cursed_spray   ATK ×0.7  (重度弱化，新增)
blessed_wind   ATK ×1.2  (強化，新增)
star_shower    ATK ×1.2  (強化，原有)
team_boost     ATK ×1.5  (單人特強，原有)
```

所有 buff/debuff 效果在換層時由 `nextFloorModifiers` 機制自動清空。

**實作位置**：
- `dungeonData.js` `DUNGEON_EVENTS`（事件資料）
- `dungeonDb.js` `confirmDungeonEvent`（效果套用）

### 修改檔案清單（給 Claude 用）

需改 3 個檔案 + 1 個前端同步：

1. **`src/lib/dungeonData.js`**
   - 替換 `CONTRACT_TYPES`（9 種新定義）
   - 更新 `assignContracts` / `rerollContract`（參數邏輯）
   - 更新 `getContractBadge`（新增 4 種 badge）
   - 更新 `calcDungeonContractDmg`（reversal/odd_only/even_only/target_score 總分檢查）
   - 替換 `DUNGEON_SHOP_ITEMS`（8 項）
   - 替換 `DUNGEON_EVENTS`（21 項）

2. **`src/lib/dungeonDb.js`**
   - `purchaseDungeonItem`：移除 `contract_reset` 和 `rune_repair` 的 case
   - `confirmDungeonEvent`：移除 `contract_reassign` 的 case

3. **`src/components/dungeon/DungeonShop.jsx`**
   - `SHOP_ITEM_META`：移除 `contract_reset` 和 `rune_repair` 的定義
