# 🎮 game-systems — 遊戲化規格
> 最後更新：2026-07-25（補記大富翁/裝備專精/殭屍三系統，實查原始碼；成本控制歸 ai-guide 鐵律）

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

## 🔎 其他公式/系統速查（2026-07-25 補指標，函式細節見原始碼）

> 這兩個系統的「功能面」已記在 `features.md`，這裡只補 game-systems 找得到的函式入口。

- **地下城發掘 `src/lib/dungeonExcavation.js`**：儲存槽 `MAX_SAVED_DUNGEONS=6`。核心函式 `computeExcavationPatch(memberId, arrowCount)`（箭數推進發掘進度）、`getTierProbabilities(dailyArrows)`（當日箭數→T1~T6 機率表）、`addExcavationByCheckin`（報到+進度）、`assignDigCat`/`revealCatExcavation`（貓咪挖掘，`CAT_DIG_SPECIALTIES`）、`upgrade/downgradeExcavationDifficulty`、`save/abandon/completeExcavation`。三大來源總覽見 `features.md`。
- **射手表現診斷 `src/lib/archerDiagnosis.js`**：`buildArcherDiagnosis({ arrows, sessions })` → 從箭矢/場次資料產生表現診斷。搭配本機快取的射手表現資料使用（見 quick-ref 射手表現章節）。

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
MAX_EQUIPPED_BY_STAT = { hp:5, atk:3, def:3 } → 總共可裝 11 張（⚠️舊筆記誤記 MAX_EQUIPPED=5，2026-07-25 修正）
種族→屬性：forest→hp / dragon→atk / undead→def / beast→atk / demon→hp / machine→def
升星費用：STAR_UPGRADE_COST=[1,2,3,4,5]（碎片）
cardColl 訂閱：subscribeCardCollection → { cards:{}, equipped:[] }
顯示用 useState，異步函式用 useRef（雙軌設計，MonsterBattle 已套用）
```

### 卡片天賦系統（`src/lib/cardTalents.js`）

- **天賦「零手工」**：每張怪物卡的天賦由 `getSignatureEffect(sig_<monsterId>)` 的積木**自動映射**（`TALENT_RULES` 取第一個命中），tier 放大（T1-2×1 / T3-4×1.5 / T5-6×2）。世界王卡不參與。
- **隱形上限 `TALENT_CAPS`**（2026-08-02 現值）：`armorPiercePct/shieldPiercePct` 20、`critRatePct/damagePct` 15、`openingShieldPct/monsterAtkDownPct/monsterDefDownPct` 12、`damageReductionPct/reflectPct` 10、`endRoundHeal/firstStrikePct/finisherPct` 25、`hqDamagePct` 18、`venomPct` 30。彙總後砍上限，防疊加失衡。
- ~~**共池陷阱**~~ **（2026-08-02 已拆）**：蓄勁→`firstStrikePct`、淬毒→`venomPct`、挑戰者→`finisherPct` 各自獨立 key 與上限。
  「淬毒」也從**假的傷害加成**改成**真的施加中毒**——見下面的異常狀態系統。
- **族系套裝 `FAMILY_SET_BONUSES`**：同族怪物卡裝 2/4 張觸發兩階加成。
- **戰鬥端只吃 `calcCardCombatEffects` 的彙總結果**（各鍵有 cap＋套裝）。

### 天賦透明化面板（2026-07-25，純顯示零平衡）

> 玩家反映「裝上去跟顯示有落差、不知道怎麼搭」＝上面三個隱形機制沒攤開。第一段做純顯示，不動任何數值。

- `src/lib/cardTalentDisplay.js`：顯示 metadata（`EFFECT_DISPLAY`，cap 一律引用 `TALENT_CAPS` 不抄數字）＋ `buildContribution`（key→貢獻卡片）＋ `buildSuggestion`（主動搭配建議）。
- `TalentEffectPanel.jsx`（裝備頁 header）：實際生效值進度條（x/上限、封頂「已滿」變灰）、每條下方「來自：卡片名」、族系套裝、主動建議、可收合。**顯示＝戰鬥實際吃的**。
- `CardMiniCell`：卡面直接顯示天賦（不用點進詳情）。`CardDetailSheet`：補「歸【分類】共享上限」說明。
- ⚠️ 零平衡：`cardTalents.js` 唯一改動是把 `TALENT_CAPS` 加 `export`，數值一個沒動。
- ~~**第二段（未做）**~~ **拆分共池 key 已於 2026-08-02 完成**；套裝 vs 天賦流派重設計仍未做。

## 🧪 異常狀態系統（2026-08-02 實裝）

> 作者回報「裝了施毒卡片也沒有實際效果」。查下去發現卡片天賦幾乎都只換算成傷害％，
> 異常根本沒有實體，玩家不知道自己裝了什麼、也感覺不到差別。

### 兩支核心模組

| 檔案 | 管什麼 |
|------|--------|
| `src/lib/combatModifiers.js` | **玩家側加成的統一管線**：進場 → 出手 → 受擊 → 中狀態 → 回合末 |
| `src/lib/monsterStatus.js` | **玩家→怪物的 7 種異常**：施加、合併、結算、tick |

### 7 種異常（`MONSTER_STATUSES`）

| id | 名稱 | 類型 | 效果 | 上限回合 |
|----|------|------|------|----------|
| `poison` | ☠️ 中毒 | dot | 每回合失去**最大生命%**，`nonLethal`：**不會把怪打死** | 3 |
| `burn` | 🔥 灼燒 | dot | 每回合依**玩家 ATK%**，**可以補最後一刀** | 2 |
| `bleed` | 🩸 流血 | dot | 依 ATK%，`scalesWithHits`：**命中越多層數越高** | 3 |
| `defBreak` | 🔨 破防 | statDown | 怪物 DEF 下降，**全隊算傷害都吃得到** | 2 |
| `weaken` | 😱 虛弱 | statDown | 怪物 ATK 下降，反擊變不痛 | 2 |
| `freeze` | ❄️ 冰凍 | control | 怪物這回合**放不出技能** | 1 |
| `paralyze` | ⚡ 麻痺 | control | 怪物這回合**有機率無法反擊** | 1 |

### 族群綁定（`FAMILY_STATUS`）

`insect`→中毒｜`temple`→灼燒｜`ghost`→虛弱｜`workplace`→破防｜`exam`→麻痺｜`mountain`→流血｜`treasure`→冰凍

⚠️ 這個對應**要跟怪物的族性一致**，玩家才記得住「打毒蟲要用什麼、毒蟲給我什麼」。

### ⚠️ 三條平衡鐵則（改之前先看這裡）

1. **要射得準才觸發**：`PROC_MIN_SCORE = 9`（9 環以上／X）。
   這是射箭遊戲的身分認同——**射得好換成戰術優勢，不是抽獎**。
2. **強度不隨卡片數成長，只有觸發率會**（`FAMILY_INFLICT_BASE` 固定、`STATUS_STRENGTH` 固定）。
   否則滿編毒隊會變成純傷害流派。
3. **觸發率有上限**：一般 `PROC_CAP = 35`、控場類 `CONTROL_PROC_CAP = 12`。
   ⚠️ `chancePct: 100` **也會被夾**——測試想「一定觸發」必須注入 `rand`，不能靠機率碰運氣。

其他規則：同種異常**不疊加**，`mergeMonsterStatus` 刷新回合數並取較強的那個；
`monsterStatMods` 的減益總和上限 60%。

### 五種模式怎麼接

| 模式 | 算傷害的地方 | 接法 |
|------|--------------|------|
| 單人打怪 | 前端 | `BattleScreen.jsx` 直接 `rollInflict` |
| 地下城單人 | 前端 | 同上 |
| 組隊打怪 | **權威端** | `partyDb.js` |
| 地下城組隊 | **權威端** | `dungeonDb.js` |
| 世界王 | **權威端** | `raidFlow.js`（`state.bossStatuses`） |

⚠️ 權威端三支的**順序必須一致**：
`合併全隊施加 → 破防先削防禦 → 算傷害 → 回合末 tick → 存回房間文件`。
組隊模式 `previewDamage: !partyMode`，前端那條施加路徑根本不會跑——
所以權威端漏接就是**整個模式的卡片專精全部失效**，而且不會報錯。

⚠️ `rollInflict` / `resolveRaidRound` 一定要把 `rand` 傳下去，漏傳就不可重現（測試偶發、線上重播不出同一場）。

### 玩家感知（缺一不可）

作者原話：「最正確讓玩家有感的就是有顯示出異常、加成等等的傷害顯示與告知」。

- 左上**戰鬥紀錄**推施加／持續傷害訊息（`state.messages`，畫面取 `slice(-4)`）
- 怪物血條下方的**異常膠囊**
- 右上**加成 chip**：所有生效的修正值＋各異常的觸發率

### 驗證方式

後台**戰鬥模擬沙盒**（`cardFxOverride` prop）——不用開真房間、也不用找高血量怪，
直接灌任意卡片效果跑一場。作者原話：「你還不如快速地搭建一個模擬系統」。

---

## 🌍 世界王：獎勵三層 + 重生週期（2026-08-03 重新設計）

### 獎勵三層（`src/lib/worldBossRewards.js`，23 測）

> 作者的理念：**「上場幫忙打得都能有不錯的獎勵，努力打得又有更好的獎勵」**

| 層 | 給誰 | 怎麼算 |
|----|------|--------|
| **出席保底** participation | 有造成傷害就給 | 固定值，**不看傷害多寡、不被人數稀釋** |
| **努力分潤** effort | 依貢獻 | `pool = 每人份 × 人數`，權重 `√傷害 × 出席天數加成` |
| **名次榮譽** rank | 前三＋尾刀 | 獎盃／抽獎幣／貓貓箱，**刻意不給大量金幣** |

⚠️ **三條不能破的設計**：
1. **√ 壓縮**：傷害差 4 倍，獎勵只差 2 倍。線性的話一個滿裝老手吃掉整鍋。
2. **鍋子隨人數變大**（不是把每片切小）。舊版池子固定＝**在懲罰上場幫忙**。
3. **出席天數也算努力**。否則「努力」實際上只是「裝備好」，新手再拚也追不上。

實測（六族大王，傷害差 15 倍）：幫忙 532 金幣 → 拚第一 1056（約 2 倍）；
同傷害但多來兩天的（897）贏過只來一天的（715）。

⚠️ 舊的 `REWARD_TABLE` / `RANK_BONUS` 已停用，`DROP_TABLE_BY_CATEGORY` **只剩物品**。
**改貨幣請去 `worldBossRewards.js`，改舊表沒有任何效果。**

### 強度：血量用「幾人次」推

```
bossHp = TARGET_ATTACKS[分類] × EXPECTED_DAMAGE_PER_ATTACK(12,000)
cat 8 人次 / family_small 14 / family_big 28 / coach 45
```
12,000 是 `raidBalance` 模擬器實測（新手 7.2k／中階 8.6k／114 級 22.5k）。
⚠️ 舊版教練王 1,100,000 ＝ **92 人次，根本打不死**。有護欄測試鎖 ±60%。

### 重生週期（權威＝雲端 `functions/worldBossLifecycle.js`）

```
擊倒 → 休息（預設 8h）→ 蓄力 → 生成
蓄力：開週期時從抽籤池**隨機抽一種**當門檻（requiredType）
      推滿它就提早降臨；沒推滿最晚 deadlineHours（預設 48h）也會出
抽籤池四種：arrows / dungeonClears / monsterKills / villageDice（後台勾選）
```

⚠️ **客戶端只有唯讀顯示**（`src/lib/worldBossSpawnCycle.js`）。
   以前客戶端也有一份寫入實作，在擊倒當下用**寫死的預設值**搶先寫，
   雲端看到 `previousEventId` 對上就跳過 → **後台設定從來沒生效過**。
   **不要再在客戶端寫生成邏輯。**

⚠️ **抽籤在開週期時抽一次並存進文件**。評估時抽／客戶端抽 → 條件一直跳、
   推到一半換題目、不同人看到不同答案。

⚠️ **抽籤池不能空**——空了世界王再也不會出現，而且沒有任何錯誤訊息。兩層都擋。

⚠️ 舊週期文件沒有 `requiredType` → 兩邊都退回「任一達標」，否則會永遠卡住。

---

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

---

## 🎲 貓貓村大富翁（villageBoard，2026-07-25 補記，實查原始碼）

> 資料：`src/lib/boardData.js`｜資料層：`src/lib/villageBoardDb.js`（單人）＋`villageBoardTeamDb.js`（組隊）

- **棋盤**：`BOARD_LAYOUT` 固定 28 格環形（`BOARD_SIZE=28`），index 0 = 起點，順時針。同類格子刻意分散。
- **骰子**：`DAILY_DICE=15`，每日補滿至 15、**不囤積**（`ensureDailyDice`/`refillBoardDice`）。
- **格子類型 `TILE_TYPES`（12 種）**：start/material/mining/monster/arrowdew/coins/gacha/potion/chest/catbond/fate(命運)/opp(機會)。
  其中 **`mining`/`monster`/`chest` 是 `shooting:true`**——踩到要**實際射箭**，射箭完成度會影響獎勵。
- **射箭完成度分帶**：`scoreToBand(scoreRatio)`（命中總分/滿分，6 箭）→ `{ band, monsterMult, miningMult, chestCount }`；≥0.85 給 S 帶（怪物 ×3.0、挖礦 ×1.8、寶箱 3 個）。**這是「射箭表現連動獎勵」的核心**。
- **模式與難度**：`BOARD_MODES` 由採集地圖 `GATHERING_SITES` 衍生；`getModeTierCap(modeId, villageBuildings)`——**難度上限受村莊建築等級控制**（村蓋得越高，大富翁能跑的 tier 越高）。
- **核心流程函式**：`rollAndMove`（擲骰移動）→ `settleBoardTile`（結算落點，傳 villageBuildings/catId/partyMult/scoreRatio）→ `applyBoardReward`／`applyEventEffect`（命運/機會格效果）。
- ⚠️ 設計連動：獎勵吃 `villageBuildings`（村莊建築）＋`catId`（貓咪）＋`partyMult`（組隊）＋`scoreRatio`（射箭）四個輸入，改任一來源前先確認 `settleBoardTile` 有沒有在讀。

## 🛡️ 裝備專精（equipmentSpecialization，2026-07-25 補記，實查原始碼）

> 引擎：`src/lib/equipmentSpecializationEngine.js`｜資料/公式：`equipmentSpecializationCatalog.js`｜資料層：`equipSpecializationDb.js`

- **9 條專精軌** `SPECIALIZATION_TRACKS`（`validateSpecializationCatalog` 強制 length===9、id 不重複）。
- **解鎖成本** `SPECIALIZATION_UNLOCK_COST = 10000`。
- **三類部位效果**（各自套用時機不同）：
  - `applyWeaponSpecialization({ damage, monsterDefense, trackId, level, highQuality, bossTagged })` — 攻擊時
  - `applyArmorSpecialization({ incomingDamage, currentHp, maxHp, trackId, level, status })` — 受擊時
  - `applyAccessorySpecialization({ currentHp, maxHp, trackId, level, companionAttack, companionHealing, alive })` — 貓咪/續戰相關
- **升級機制（機率制，含保底）**：`getSpecializationUpgradeCost` → `getSpecializationAttemptChance({ ..., consecutiveFailures })`（**連續失敗會提升成功率**）→ `resolveSpecializationAttempt({ ..., roll })`。
- ⚠️ `getSpecializationEffect(trackId, level)` 是所有效果的查表源頭，改數值先看誰在讀它。

## 🧟 殭屍生存模式（zombie，2026-07-25 補記，實查原始碼）

> 完全獨立的 DDD 模組 `src/zombie/`，**不走 `src/lib/db.js`**，自帶 `db/zombieDb.js`。入口：網址帶 `?zombie` → `App.jsx` render `ZombieGame.jsx`。
>
> 🚧 **測試中，禁止建立玩家可點入口**（2026-07-25）：只保留 `?zombie` 隱藏網址供測試，**不要**在 MemberApp 底部導覽/首頁/任何選單加按鈕連進來。等正式上線再另行處理入口。

- **遊戲循環**：地圖探索 → 遭遇戰 → 戰鬥 → 結算 → 下一回合 → 撤離/勝利（`gameStateMachine.js` 的 `GAME_PHASE` 狀態機驅動）。
- **分層架構**（跟主專案風格不同，是刻意的 domain-driven 隔離）：
  - `domain/`：純函數引擎——`infectionEngine`（🦠 感染進程狀態機，`LIFE_STATE`、`FULLY_INFECTED` 完全感染）、`fullyInfectedSupportEngine`（完全感染後的支援玩法）、`baseEngine`（基地）、`bossEngine`（王）、`mapEngine`、`encounterResolver`、`eventEngine`、`backpackEngine`、`partyEngine`（組隊）
  - `data/`：`zombieArchetypes` / `itemData` / `baseData` / `bossRewards`
  - `ui/`：`ZombieGame` 下的 HUD/Lobby/Map/BattleArena/BossArena/Backpack… 一整套獨立 UI
  - `bridge/crossWorldAdapter.js`：**與主世界（貓射箭）連動的橋接層**——要串殭屍↔主系統的資源時看這裡
  - `target/ZombieTargetSVG.jsx`：殭屍版靶面
- **有單元測試**：`domain/*.test.js`（infection/encounter/base/boss/party/gameStateMachine 都有），改 domain 引擎後跑對應 test。
- ⚠️ 這是 self-contained 模組，別把它的邏輯跟主戰鬥引擎（`src/battle/`）搞混，兩套是分開的。

## 🏛️ 冒險者公會遠征（guild，2026-07-25 P1+P1.5）

> 舊公會（任務清單/懸賞，`AdventurerGuild.jsx`）被判定「雞肋」，重做成**獨立的 2.5D 鳥瞰 ARPG 遠征遊戲**＝貓村×打怪的融合。獨立模組 `src/guild/`（比照 zombie DDD）。完整企劃：`.trellis/tasks/07-25-adventurer-guild-rework/`。
>
> 🚧 **測試中，禁止建立玩家可點入口**：只走 `?guild` 隱藏網址（`App.jsx`）。前台舊入口已鎖「改建中」（射手鎖／教練 admin 可測，見 `MemberApp.jsx` page==="guild"）。

- **隔離鐵律（最重要）**：只帶入 **射手等級**（`archerLevel.js`）＋怪物**資料**（`monsterData`/`monsterMaterials`）。**不帶**怪物卡、主線裝備、`calcArcherStats`。公會六維與公會裝**永不進主線**（主線平衡零風險，改動前 `grep -rn "guild/" src` 佐證只有 App.jsx 路由）。
- **六維**（`domain/guildStats.js`）：HP 生命／ATK 箭傷／AGI 額外箭+閃避／DEF 減傷／VIT 省補給+負重／LUK 掉寶+爆擊+雜貨價值。＝基底 + 射手等級(hp/atk/def) + 公會裝(六維)。
- **裝備**（`data/guildEquipCatalog.js`）：5 槽（弓/箭/護具/箭袋/藥水袋）× 多基礎裝 × 6 品級（common→mythic，`GRADE_MULT` 放大六維）。每件有 `weight`，**與補給搶背包容量**＝出發前「帶裝變強 vs 帶糧撐久」的核心抉擇。
- **委託板**（`domain/guildContracts.js` + `data/guildContractPool.js`，公會的主入口）：每日 **18 張**（6 危險度 × 3）委託單，一排三張的委託牆（委託人 NPC ＋故事＋族群＋☠️星等＋獎勵預覽）。**seed = 日期＋memberId** → 同一天同一人固定同一批（**重整不能刷新委託**），但每個人的板不同。**危險度 1~6 ＝ 怪物階級 T1~T6**（每級 3 張）：低階玩家永遠有三張能接，也永遠看得到接不了的那些。接過的**勝敗都結案**、當天不能重刷（存 `guildProfiles.contracts = {dateKey, done[]}`，跨日自動換板）。文案要加就往 `guildContractPool` 那張表加，不用改邏輯。
- **怪物來源＝擴充圖鑑 252 隻**（`monsterExpansionCatalog`，不是舊的 36 隻 `MONSTERS`）。危險度 3~4 最後一波有小首領、5~6 有大首領（`encounter`）。⚠️ **公會版縮放 `GUILD_TIER_SCALE`**：擴充怪 HP 是主線長期養成的規格（T6 有 1700~3240），公會直接搬打不動 → 依「該階級預期公會裝下雜兵約 5 箭解決」反推係數（HP 0.50→0.30、ATK 0.90→0.75，DEF 不動）。公會自己的數字，主線不受影響。
- **階級一階開一個危險度**：見習 T1／銅牌 T2／銀牌 T3／金牌 T4／白金 T5／傳說 T6。
- **一趟遠征**：委託板接委託 → 備包（`GuildLoadout`）→ `rollExpedition` 依委託的族群/危險度抽 3~5 波怪 → 2.5D 戰鬥（`GuildBattle`：選目標射真實箭、貓貓自動助攻、怪距離倒數歸零就攻擊、每回合吃補給）→ `settleExpedition` 凱旋結算。
- **存檔／經濟**（P1.5）：`guildProfiles/{memberId}`（CAT幣/聲望/裝備/倉庫/雜貨圖鑑/場次），規則見 quick-ref。**公會獨佔**＝CAT幣、聲望、公會裝；**回饋主線**＝金幣寫 `members.coins`、材料寫 `materialInventory`（`ghost_t3`→`ghost_m3` 同族同階）。聲望 ＝ 危險度×10（`REP_PER_DANGER`），倉庫上限 60。
- **階級**（`domain/guildRank.js`，P2）：見習0／銅牌100／銀牌300／金牌700／白金1500／傳說3000（聲望）。**階級零戰力加成**（舊 `RANKS.mult` 已廢除），只解鎖 ①可接危險度上限（見習☠️1／銅銀☠️2／金牌以上☠️3）②商店貨架層級。理由：進度感來自「能去更深的地方」，公會強度永遠不外溢主線。測試有斷言階級表不得出現 `mult`/`atk`/`hp`。
- **公會商店**（`data/guildShop.js`，CAT幣唯一去處）：①主線材料六族 t1~t3（10/25/60，高階不賣）②公會裝 3 個貨架層級（35~380）。調價只改這張表；購買驗證在 `domain/guildShopPurchase.js` 純函數。
- **貓貓參戰**（`domain/guildCats.js`）：真貓（`members/{id}/cats`）→ 戰鬥單位，**沿用主線 `calcCatCombatStats`**（貓村養貓＝遠征變強，這就是融合點）。一趟最多 3 隻，存 `guildProfiles.partyCats`；**`null`=未設定→自動帶最強前3隻、`[]`=刻意不帶貓**（兩者不可混用，否則取消最後一隻會被自動補回）。公會**只讀貓不寫貓**（不呼叫 `addCatBond`/`addCatXP`）。
- **未做（下次接）**：稱號/可分享冒險者證、大廳+委託板+公會長貓（P4）、ComfyUI 2.5D 美術（目前全是 emoji 佔位）、公會裝強化/詞綴。
