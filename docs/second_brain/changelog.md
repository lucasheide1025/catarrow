# 📝 changelog — 變更日誌
> 每次功能完工後由 Claude 自動寫入。格式：日期 / 改了什麼 / 為什麼 / 踩坑提醒

---

## 2026-07-02（事件彈窗倒數 + banner 淡出 + 角色往上攻擊動作）

### 改了什麼

**事件彈窗：5 秒倒數 + 自動繼續（PartyBattleRoom.jsx）**
- 新增 `eventCountdown` state（預設 5）
- 新增 `useEffect` 監聽 `showEvent`：每秒 -1、5 秒後自動執行 dismiss 邏輯
- 彈窗 UI 加入圓形倒數圓環 + "點擊或等 X 秒繼續" 文字
- 自動倒數的 dismiss 邏輯直接在 effect 內執行（不呼叫 `handleDismissEvent`，避免 stale closure）

**「玩家回合」banner 先淡出再攻擊（useMiniRoundReveal.js + PartyBattleRoom.jsx）**
- `useMiniRoundReveal` 新增：在 `initialDelay - 500ms` 觸發 `setAnimPhase("bannerFadeOut")`
- `"bannerFadeOut"` 相位：banner 播 `party-banner-exit 0.5s ease forwards`（縮小淡出）
- 等 0.5s 動畫跑完，第一個 mini 才開始（攻擊開始時 banner 已消失）
- 新增 CSS `@keyframes party-banner-enter`（進場）、`party-banner-exit`（退場），取代舊的 `mb-float`（定位會跑掉）
- Banner JSX 加 `key={isCounter ? "counter" : "player"}` 讓 React 重新 mount 觸發進場動畫

**角色往上攻擊動作（PartyBattleRoom.jsx）**
- `mb-archer-attack` 改成 `translateY`：`0→-22px→-10px→0`（向上衝刺再落回）
- 時長從 0.4s 改為 0.55s
- 觸發條件不變：`isTopHit && !animCounter`（傷害最高的玩家才播）

### 踩坑提醒
- `"bannerFadeOut"` timer 要判斷 `!activeRef.current`，否則 stopReveal 後舊 timer 仍觸發
- 倒數 effect 的 auto-dismiss 直接用 `pendingRevealRef.current`（ref 永遠是最新值），不呼叫 `handleDismissEvent`（stale closure 問題）
- `party-banner-enter/exit` 的 transform 必須包含 `translate(-50%,-50%)`，否則定位錯誤（banner 使用 absolute + left:50% + translate 定位）

---

## 2026-07-02（怪物被秒殺沒看到死亡動畫）

### 改了什麼

**單人打怪（BattleAnimation.js）**
- 新增 `playBattleWin(d, p)` 函式並加入 `EVENT_DISPATCH`
- 效果：`anim.hit(true)`（怪物閃白 crit 效果）+ `sfxCritBoom()` + `await d.delay(2000)`
- 意義：以前 `BATTLE_WIN` 在 EVENT_DISPATCH 沒有對應動畫，擊殺後幾乎瞬間跳結算；現在有 2 秒停頓讓玩家看到擊殺

**組隊打怪（PartyBattleRoom.jsx）**
- 新增 `isKillingRound` 判斷：`entry.miniRounds.some(m => m.monsterHPAfter <= 0)`
- 擊殺回合 `entryEndExtra: 3500`（一般 1500ms）
- `onEntryEnd` 播 `sfxMonsterDead()` + 600ms 後 `sfxSuccess()`
- 新增 `sfxMonsterDead` import
- 新增「💀 擊倒！」全畫面 overlay：當 `liveEntry !== null && displayHP <= 0` 時出現，持續到結算畫面
- `handleDismissEvent` 也加入 `isKillingRound` 邏輯（事件觸發死亡的情況）

### 踩坑提醒
- `entryEndExtra` 只影響最後一個 mini 結束 → `setLiveEntry(null)` 的等待時間，並非動畫速度
- `displayHP` = `curMini?.monsterHPAfter ?? room.monsterHP`；殺死那一箭的 mini HP after = 0，overlay 在那瞬間出現
- 擊殺 overlay `zIndex:44`，比事件彈窗（50）低，不會擋住隨機事件確認

---

## 2026-07-02（「玩家回合」banner 與攻擊同時顯示）

### 改了什麼

**`src/battle/useMiniRoundReveal.js`**
- 玩家攻擊 mini 觸發時，`setAnimPhase("attacking")`（原本是 `"player"`）
- 現在 `animPhase` 語意：
  - `"player"` = initialDelay 預備期（banner 顯示，還沒開打）
  - `"attacking"` = 玩家實際攻擊中（banner 消失）
  - `"cat"` = 貓貓攻擊中
  - `"counter"` = 怪物反擊中

**`src/components/party/PartyBattleRoom.jsx`**
- Banner 條件從 `animPhase === "player" && liveMiniRoundIdx === 0 && !curMini?.isCounter` 簡化為 `animPhase === "player"`
- `initialDelay` 從 1200ms 改為 2000ms（兩個 startReveal 呼叫點都改）

### 踩坑提醒
- 舊條件 `liveMiniRoundIdx === 0` 是錯的：第一個 mini 開始後 idx 仍為 0，導致 banner 和攻擊同時顯示
- `"attacking"` 是新加的相位值，不出現在 banner 判斷裡（直接忽略）

---

## 2026-07-02（隨機事件彈窗暫停後續動畫）

### 改了什麼

**問題**：事件彈窗出現後，後面的箭矢/反擊動畫繼續跑，玩家無法在彈窗出現時暫停觀看。

**單人打怪（MonsterBattle + RoundController）：**
- `RoundController.playEvents` 第 4 步改為 `await handlers.onRandomEventEnd?.()`（加 await）
- `onRandomEventEnd` 現在回傳 Promise，把 `resolve` 存進 `randomEventResolveRef`
- 事件卡 UI 改為點擊才能繼續：點擊後清 `currentEvent`、還原 `battlePhase`、呼叫 `resolve()`
- 效果：箭矢動畫等玩家點事件卡才開始

**組隊打怪（PartyBattleRoom）：**
- 有 `entry.event` 時：不立即呼叫 `startReveal`，改把 entry 存進 `pendingRevealRef`，顯示彈窗
- 新增 `handleDismissEvent()`：玩家點彈窗後清 `showEvent`、讀 `pendingRevealRef`、才呼叫 `startReveal`
- 彈窗改為 `cursor:pointer`、移除 `pointerEvents:none`，顯示「點擊繼續 ▶」提示

### 踩坑提醒
- `onRandomEventEnd` 必須回傳 Promise，否則 `await` 會立即通過（undefined 被 await 視為 resolved）
- Party mode：`startReveal` 必須在 `handleDismissEvent` 裡呼叫，才能拿到最新的 `room?.members`
- 組隊事件彈窗原本有 `pointerEvents:"none"` — 要刪掉才能接收點擊事件

---

## 2026-07-02（BattleEngine 隨機事件重排：Phase 0 先行）

### 改了什麼

`src/battle/BattleEngine.js` 回合順序重整：

**舊**：箭矢 → 隨機事件 → 貓貓 → 怪物反擊

**新**：Phase 0 隨機事件 → Phase 1 玩家箭矢 → Phase 2 貓貓回合 → Phase 3 怪物回合

技術重點：
- `const effATK` 改 `let`，Phase 0 更新 `curATKMod` 後立即重算，讓 ATK buff/debuff 影響本回合箭傷
- Phase 0 若直接擊殺怪物提前返回 `BATTLE_WIN`
- MonsterBattle 的 `RANDOM_EVENT` handler 不需修改：事件在列的第一個 → UI 自動先彈 popup，確認後才播箭矢動畫

兩種「隨機事件」釐清：
- **狀態隨機事件**（`RANDOM_EVENTS`）→ Phase 0，影響 ATK/HP/skipCounter
- **貓貓反應訊息**（`triggerCatAction()`）→ 每箭命中觸發，純 UI 文字，不動

### 踩坑提醒

- ATK 修正在 Phase 0 後必須同步更新 `effATK`，否則箭傷用舊值
- Phase 0 結束若 monsterHP ≤ 0，`processedArrowScores` 為空，BATTLE_WIN handler 從組件 `arrows` state 讀已輸入分數

---

## 2026-07-02（移除報到限制 + 下課里程碑全覽板）

### 改了什麼

**邏輯調整：移除「需報到才能累積箭數」限制**
- `MonsterBattle.jsx`：`addRoundArrows` 和 `addPracticeLog` 的呼叫條件從 `checkinActive && profile?.id` 改為只要 `profile?.id && !isGuest`，即不管有沒有報到，射箭都會記錄
- 箭露和里程碑獎勵仍需點「下課」才兌換

**DailyQuest.jsx 大改版**
1. `subscribeTodayPracticeLogs` 移除 `DIRECT_SOURCES` 過濾 → 全模式射箭都計入「今日箭數」
2. 「今日 X 箭」卡片：只要 `todayArrows > 0` 就顯示（不限狀態）
3. 下課確認對話框新增「今日里程碑全覽板（`MilestoneBoard`）」：全部 11 個門檻，解鎖=亮色，未解鎖=暗色 35%，附帶進度條
4. `arrowMilestone.js` 新增 `export const ALL_MILESTONES`（原本未導出）

### 為什麼

射手不知道射箭里程碑有獎勵，每次只看到 6 箭 popup。改成在「下課」時一次顯示全覽板，讓學生清楚今天解鎖了哪些、還差多少到下一個。

### 踩坑提醒

- `addPracticeLog` 的 `totalArrows` 用於 `subscribeTodayPracticeLogs` 計算今日總量；`addRoundArrows` 只更新 `totalArrowsAllTime`，兩者不重疊
- DIRECT_SOURCES 移除後，party/duel/dungeon 的 session-end log 也計入 todayArrows，但這些在戰鬥結束後才寫，中途不會立即反映
- `MilestoneBoard` 是純 UI 預覽；`grantArrowMilestoneRewards` 在 `confirmClassEnd` 才實際寫 Firestore

---

## 2026-07-02（戰鬥回合大重構：大回合制 + 箭數選擇）

### 總覽

將地下城（`dungeonDb.js`）和組隊（`partyDb.js`）的回合邏輯從「每 2 箭中途反擊」改為「全箭打完後大回合末唯一一次反擊」，並新增 3/6 箭數選擇 UI。

### 改了什麼

- **`src/battle/BattleConfig.js`**：移除 `COUNTER_INTERVAL`，新增 `ARROWS_OPTIONS = [3, 6]` 和 `ARROWS_PER_ROUND_DEFAULT = 6`
- **`src/lib/dungeonDb.js` `processDungeonRound`**：`ARROWS_PER_CTR` 移除，迴圈改用 `room.arrowsPerRound || 6`，反擊移至貓貓攻擊後（大回合末唯一一次）
- **`src/lib/partyDb.js` `processPartyRound`**：三輪雙箭迴圈改為每位玩家一個 mini-round 含全部箭矢（`arrowsPerRound` 箭）
- **`src/components/dungeon/DungeonBattleRoom.jsx`**：`status === "waiting"` 顯示 3/6 箭選擇 UI（房主可設定，他人唯讀）；戰鬥中各箭數相關 hardcode 6 改為讀 `room.arrowsPerRound || 6`
- **`src/components/party/PartyBattleRoom.jsx`**：等待室加入 3/6 箭選擇 UI（同樣邏輯）

### 為什麼

玩家反映「每 2 箭反擊」節奏太快、多人局搞混不清楚傷害輸出，改成大回合末反擊可讓玩家先看到全部攻擊動畫再承受一次反擊，節奏更清晰。

### 踩坑提醒

- `ctrAccum` 累積保留（dungeonDb 用於 `ctrHitsThisFloor` 難度追蹤）
- `partyDb.js` 新循環中 `totalDmgP` 是 block-scoped，不衝突外層的 `totalDmg`
- `DungeonBattleRoom` 的 `status === "waiting"` 在地圖模式下幾乎不會被到達（DungeonController 只對 active/completed/path_select/floor_transition 顯示 DungeonBattleRoom）；但保留此 UI 確保非地圖模式兼容
- `BattleEngine.js` 不需修改（已是大回合末單次反擊結構，且未使用 `COUNTER_INTERVAL`）

---

## 2026-07-02（角色系統修正 + 統一箭數更新）

### 改了什麼

**修正 1：PartyBattleRoom 移除「自由選擇前後衛」按鈕**
- 原本在輸入區域有一組 ⚔️前衛 / 🛡後衛 toggle button，讓玩家可以在戰鬥中途自由切換，脫離原本設計
- **根本原因**：`myRole` 已由 Firestore 透過 `useEffect` 同步（`if (serverRole) { setMyRole(serverRole); }`），只要前後衛分配在遊戲開始時確定，玩家就不應再手動切換
- **修正**：移除前衛/後衛 toggle buttons；改為只在 `myRole === "rear"` 時顯示「後衛行動選擇」（heal/dmg），附加「後衛」提示標題，與 DungeonBattleRoom 的設計一致
- **踩坑提醒**：DungeonBattleRoom 的角色鎖定設計一直是正確的（只在 `me.role === "rear"` 時顯示後衛選項），PartyBattleRoom 是後來寫的時候誤加了 toggle

**修正 2：統一每回合箭數更新（totalArrowsAllTime）**
- **背景問題**：`addPracticeLog` 是在戰鬥結束後才批次更新 `totalArrowsAllTime`，若連線中斷或 Firestore 規則問題會導致整局箭數遺失
- **修正**：
  - `db.js` 新增 `addRoundArrows(memberId, count)` — 只更新 `members/{id}.totalArrowsAllTime: increment(count)`，輕量且即時
  - `db.js` 從 `addPracticeLog` 移除 `totalArrowsAllTime` 更新（避免雙重計算）
  - `useFirestoreRound.js` 新增 `onSubmitSuccess(...extraArgs)` callback（用 ref 存，避免 stale closure），submit 成功後立即呼叫
  - **Party** / **Dungeon** / **Duel**：在 `useFirestoreRound` 的 `onSubmitSuccess` 呼叫 `addRoundArrows(myId, arrows.length)`
  - **MonsterBattle**：在 `submitRound` 開頭（引擎前）呼叫 `addRoundArrows(profile.id, arrowsPerRound)`，只有 `!isGuest && checkinActive` 時才執行
  - **WorldBossAttack** / **CouncilBattle**：在 `addPracticeLog` 呼叫前加 `addRoundArrows(myId/memberId, totalArrows)`

### 踩坑提醒

- `addPracticeLog` 現在**不再**更新 `totalArrowsAllTime`；所有模式必須自己呼叫 `addRoundArrows`，否則終身箭數不會累計
- `onSubmitSuccess` 的參數是 `...extraArgs`（即 `handleSubmit` 的參數），DuelRoom 的 extraArgs 是 `(team, arrows, target)`，所以 callback 要 `(_team, submittedArrows) => ...`
- CouncilBattle 的 `logCouncilArrows` 是在戰鬥結束後才呼叫（不是每回合），所以它的 `addRoundArrows` 是一次補計整場所有箭數，仍屬於「結束時更新」——若要改成真正每回合更新，需要在 Council 的回合 submit 處理

---

## 2026-07-02（Check Agent 補丁：PartyBattleRoom + DungeonBattleRoom 修正）

### 改了什麼

**`src/components/party/PartyBattleRoom.jsx`（3 項修正）**：
1. 移除 `const [room, setRoom] = useState(null)` — 此 state 從未被更新（訂閱已由 `useFirestoreRound` hook 內部處理），導致 `room` 永遠是 `null`，畫面永遠顯示「載入中…」
2. 改為從 `useFirestoreRound` 的返回值解構取得 `room`（`const { room, handleSubmit, ... } = useFirestoreRound(...)`）
3. 將 `const myId = ...` 移到 `useFirestoreRound` hook 呼叫之前（原在第 185 行，hook 在第 119 行）— 避免 `const` 時間死區（TDZ）錯誤，`myId` 在 hook 呼叫時必須已初始化

**`src/components/dungeon/DungeonBattleRoom.jsx`（1 項修正）**：
1. 第 1469 行：`setSubmitted(false)` → `setFsSubmitted(false)` — `setSubmitted` 已在解構時別名為 `setFsSubmitted`（`setSubmitted: setFsSubmitted`），直接呼叫 `setSubmitted` 會拋出 ReferenceError

### 為什麼

這兩個 bug 是在 `useFirestoreRound` hook 整合時引入的——hook 的訂閱結果（`room`）沒有被組件使用，且變數別名沒有同步更新呼叫端。

### 踩坑提醒

- `useFirestoreRound` 回傳 `{ room, setRoom, submitted, setSubmitted, handleSubmit, localProcessing }`，呼叫端若需要 `room` 必須明確解構
- 解構時使用別名（如 `setSubmitted: setFsSubmitted`）後，呼叫端所有地方都要用別名，不可再用原名

---

## 2026-07-01（Phase 1-6 戰鬥系統全面模組化重構）

### 總覽

將 5 個戰鬥模式（MonsterBattle / PartyBattleRoom / DuelRoom / DungeonBattleRoom / CouncilBattle / WorldBossAttack）中的重複程式碼萃取為 8 個共用模組，歸納至 `src/battle/` 與 `src/lib/`。

**統計**：+2242 / −833 行（淨 +1409 行），8 新檔 + 7 檔修改

---

### Phase 1: 統一傷害公式 (`src/lib/damage.js`, +235 行)

**為什麼**：5 個戰鬥模式各自內聯計算箭矢傷害/反擊/貓貓攻擊，公式不一致（爆擊倍率、DEX 加成、前後衛修飾等細節各異）。

**改了什麼**：
- `calcArrowDamage(score, atk, def, dex, options)` — 共用的單箭傷害公式（含爆擊×1.5、DEX+1、隨機±10%）
- `calcCounterDamage(monAtk, def)` — 反擊傷害
- `calcStandardArrowDmg` / `calcStandardCounter` — 標準戰鬥模式封裝
- `calcWorldBossArrowDmg` — 世界王專用（含助攻縮放）
- `calcCatDamage` — 貓貓攻擊

**踩坑提醒**：`options.forceCrit` 用於 `hit_count` 合約強制爆擊；CouncilBattle 與 WorldBossAttack 仍使用自己的公式，尚未遷移。

---

### Phase 2: 統一計分邏輯 (`src/lib/score.js`, +201 行)

**為什麼**：分數 label↔value 轉換（X/11 → 6/0）、SCORE_MAP、COLORS 散落在各元件中。

**改了什麼**：
- `SCORE_MAP` / `SCORE_COLORS` / `SCORE_MAP_REVERSE` — 集中管理
- `scoreLabel(score)` / `scoreValue(label)` — 轉換函式
- `SCORE_ROW_A/B` — 折疊計分板兩頁定義
- 5 個戰鬥模式改用 `score.value` 取代硬編碼

**踩坑提醒**：`score.js` 的 `scoreValue("X")` 回傳 11，`scoreValue("M")` 回傳 0；各模式務必使用回傳值而非再自定義映射。

---

### Phase 3: 戰鬥引擎 (`src/battle/BattleEvents.js` / `BattleConfig.js` / `BattleEngine.js`, +682 行)

**為什麼**：MonsterBattle 的 50 行 event loop 耦合了事件產生、動畫播放、音效、狀態更新，難以在其他模式複用。

**改了什麼**：
- **`BattleEvents.js`** — 22 個 EventType（`arrow_hit` / `arrow_crit` / `counter` / `random_event` / `battle_win` 等）+ `createXxxEvent` builder
- **`BattleConfig.js`** — 戰鬥模式參數（箭數、距離、倍率、機率）統一管理
- **`BattleEngine.js`** — 單人戰鬥事件產生器（`generateRoundEvents`），接收 `roundResult` → 產生完整事件陣列

**踩坑提醒**：EventType 字串值用 camelCase（`arrow_hit`），不要在元件中再自創 type；用 `EventType.ARROW_HIT` 引用。

---

### Phase 4: 動畫派遣器 (`src/battle/BattleAnimation.js`, +234 行)

**為什麼**：19 個 `playXxx` 動畫函式散布在 MonsterBattle 內，需要拆出讓所有模式共用。

**改了什麼**：
- `playSoundEffect(type)` / `playHitAnimation(type)` / `playVisualEffect(type)` — 動畫三層封裝
- `addRoundLog(phase, msg)` / `addEventLog(...)` — log 系統標準化
- **`EVENT_DISPATCH`** — 事件→動畫映射表（22 個 EventType 各自對應 `playXxx`）
- `createDispatch()` — 工廠函式，回傳 `{ playSoundEffect, playHitAnimation, playVisualEffect, dispatch, ...addLog }`

**踩坑提醒**：`EVENT_DISPATCH` 的 handler 簽名為 `(payload, eventCtx, dispatch)`，請勿改變順序；`dispatch.animate()` 回傳 Promise 讓 RoundController 可以 await。

---

### Phase 5: Firestore 回合抽象層 (`src/battle/useFirestoreRound.js`, +183 行；3 元件重構)

**為什麼**：PartyBattleRoom / DuelRoom / DungeonBattleRoom 三模式的 Firestore 訂閱+提交+房主處理邏輯高度重複（每人約 30~50 行），且都有卡死 bug 歷史。

**改了什麼**：
- **`useFirestoreRound(config)`** — 統一 hook，參數：
  - `subscribe` / `submit` — Firestore 訂閱/提交箭分
  - `processRound` — 房主處理回合邏輯
  - `getMembers` / `isProcessing` / `canProcess` / `getBotsUnready` / `submitBotArrows` / `getExtraProcessArgs` / `processDelayMs` / `maxRetries`
  - `onBeforeSubmit` / `onSubmitError` — 生命週期回呼
  - 回傳：`{ room, submitted, submitting, handleSubmit, fsHandleSubmit, setFsSubmitted, retryCount }`
- 自動管理：subscribe lifecycle、submitted state、submitting guard、all-ready detection、delay、host processing、retry

**重構的元件**：
| 模式 | 關鍵變更 |
|------|---------|
| PartyBattleRoom (Pilot) | 36 行 handleSubmit → 5 行；host processing effect 移除 |
| DuelRoom (Bot 支援) | subscribe + host processing effects 移除；getBotsUnready + submitBotArrows 移至 hook config |
| **DungeonBattleRoom (最複雜)** | subscribe callback 4 職責 split；35 行 host processing（含 1s delay + 8s safety-net）→ hook config；5 個 ref 移除（processingRef, lastProcessedRef, allReadyTimerRef, forceProcessTimerRef, submitFallbackRef）；dead code `loading` state 清理 |

**踩坑提醒**：
- `submit` config 必須封裝 team 參數（DuelRoom 需要傳 team A/B）
- `getBotsUnready` 必須回傳 `{ id, team, m }` 結構
- `processDelayMs: 1000` 保留地下城原有的 1 秒延遲（防 Firestore 快照競爭）
- non-host processing timeout 20s 保留在 hook 內部（永不遺忘）

---

### Phase 6: RoundController (`src/battle/RoundController.js` / `useBattleRound.js`, +179 行；3 元件重構)

**為什麼**：MonsterBattle 的 50 行 event loop（for + switch + 15 case）需要抽象為共用控制器，讓 CouncilBattle 與 WorldBossAttack 也能使用。

**改了什麼**：
- **`RoundController` class** — `playEvents(events, eventCtx, handlers)` 方法：
  - 事件迭代 loop（for...of）
  - 動畫派遣（透過 EVENT_DISPATCH）
  - 計時管理：箭矢事件 1500ms 延遲，其他 0ms（可自訂）
  - BATTLE_WIN / BATTLE_LOSE 自動中斷
  - RANDOM_EVENT 清理回呼
  - 回傳 `{ battleEnded, battleResult }`
  - 建構子接受 `options.customDelays` 覆寫延遲

- **`useBattleRound` hook** — 封裝 RoundController、管理 `isPlaying` 狀態

**重構的元件**：

| 模式 | 事件迴圈 | Handlers |
|------|---------|----------|
| **MonsterBattle** | 50 行 for+switch → `controller.playEvents(events, ctx, handlers)` | 15 per-type handlers |
| **CouncilBattle** | 自訂 CB_EVT（Arrow/Counter/Result/End）→ playEvents + 4 handlers | 箭矢動畫、反擊動畫、結果顯示、戰鬥結束 |
| **WorldBossAttack** | 25 行 for+600ms delay → events 陣列 + playEvents | WB_EVT（Arrow/CatMsg/Support）自訂型別 + customDelays 600ms |

**踩坑提醒**：
- CouncilBattle 與 WorldBossAttack 使用自訂 EventType（`CB_EVT` / `WB_EVT`），不在 BattleAnimation 中，dispatch 會跳過 animate step（只跑 handler）
- WorldBossAttack 的 `processingIdx` 在事件預先計算時 batch 為同步，不會觸發 re-render → 修復為播放前一次性 `setProcessingIdx(totalEvents-1)`
- `customDelays` 向後相容，不傳 options 的既有呼叫（MonsterBattle, CouncilBattle）不受影響

---

### Phase 7: 共用 mini-round 動畫 hook (`useMiniRoundReveal.js`)

**為什麼**：PartyBattleRoom 與 DungeonBattleRoom 的 mini-round 逐箭動畫邏輯 ~85% 相同（setTimeout 鏈管理 liveEntry/animHit/animMonsterCharge/floatDmg 等 8 個 state），但寫在兩個元件中各 80+ 行，導致維護雙倍成本。

**改了什麼**：
- **`src/battle/useMiniRoundReveal.js`**（新增，+134 行）— 共用 mini-round 動畫 hook：
  - 管理 8 個動畫 state：`liveEntry` / `liveMiniIdx` / `animHit` / `animMonsterCharge` / `animScreenShake` / `floatCounterDmgs` / `localHpOverride` / `floatDmg` / `attackingIds`
  - `startReveal(entry, opts)` — 啟動 setTimeout 鏈播放 mini-round：
    - `key` — 去重 key（防止 F5 重整重播）
    - `attackDelay` / `counterDelay` / `entryEndExtra` — 可自訂計時（預設 1400/2700/1500ms）
    - `members` — 用於反擊 HP lock 計算
    - `onMiniTick(mini, idx)` — 每 mini-round 開始時回呼（sfx/attackingIds）
    - `onCounterHit(mini, idx)` — 反擊命中時回呼（sfxCounter/vibrate）
    - `onEntryEnd(entry)` — 全部播放完時回呼（擊殺動畫/回合結算）
  - `stopReveal()` — 清除計時器 + 重置所有 state
  - 自動 `clearTimers` 在下次 `startReveal` 時清理前一輪 timer

**重構的元件**：

| 元件 | 行數變化 | 關鍵變更 |
|------|---------|---------|
| **PartyBattleRoom.jsx** | +245/−245 | 80+ 行 inline setTimeout 鏈 → `reveal.startReveal()` + 回呼；移除 `isAnimating` 手動 state（hook 直接提供） |
| **DungeonBattleRoom.jsx** | +366/−366 | 90+ 行 inline setTimeout 鏈 → `reveal.startReveal()` + onMiniTick/onCounterHit/onEntryEnd；移除 8 個 animation state + `revealTimersRef` |

**踩坑提醒**：
- `setAttackingIds` 需暴露給 `onMiniTick` 回呼使用 → hook 回傳值中加 `setAttackingIds`（向後相容）
- DungeonBattleRoom 保留 `lastAnimKeyRef` 作為 render guard（`hasNewAnim` 檢查），確保完成畫面不會在動畫開始前閃爍
- DuelRoom 的動畫架構（逐箭揭露 12 步 + cross-referencing attacks[]）與 mini-round 不同，不適用此 hook
- 計時差異：hook 預設 `entryEndExtra: 1500ms`，原本 DungeonBattleRoom 是 `delay + 500 + minDelay` → 回合結果 overlay 約晚 1 秒顯示

---

### 最終架構關係（Phases 1-7）

```
src/lib/
  damage.js          ← 各模式共用傷害公式
  score.js           ← 各模式共用計分邏輯

src/battle/
  BattleEvents.js    ← 22 種標準事件型別 + builder
  BattleConfig.js    ← 戰鬥模式參數集中管理
  BattleEngine.js    ← 單人戰鬥事件產生器
  BattleAnimation.js ← 19 個 playXxx + EVENT_DISPATCH
  useFirestoreRound.js ← Firestore 回合 hook（Party/Duel/Dungeon）
  RoundController.js ← 通用事件播放控制器（Monster/Council/WorldBoss）
  useBattleRound.js  ← React hook 封裝 RoundController
  useMiniRoundReveal.js ← 共用 mini-round 動畫 hook（Party/Dungeon）
```

---

### Phase 8: 逐箭揭露 hook (`useDuelReveal.js`) + damage.js 公式補完

**為什麼**：
- DuelRoom 的 12 步逐箭揭露邏輯（~170 行 inline useEffect + 11 個 state + 4 個 effect）無法被 `useMiniRoundReveal` 共用（架構不同——逐箭揭露 vs mini-round 離散回合）
- CouncilBattle 的 `getPartMult()` 與 damage.js 的 `getCouncilPartMult()` 重複
- CouncilBattle 的 `scoreVal()` 與 score.js 的 `labelToValue()` 重複
- WorldBossAttack 的 `calcArrowDmg`/`calcCounterDmg` wrapper 只是 damage.js 的傳遞函式

**改了什麼**：

#### 新檔：`src/battle/useDuelReveal.js`（~190 行）

封裝 DuelRoom 的逐箭揭露邏輯：
- 管理 11 個 state：`revealEntry`, `revealIdx`, `displayHp`, `floats`, `flashIds`, `attackingIds`, `hittingIds`, `eventPhase`, `showCatRound`, `duelCatCats`, `revealPhaseBanner`
- 4 個內部 effect：log 偵測 → 事件暫停/揭露 → 逐箭計時器（1000ms）→ 揭露完成（貓貓 overlay + 清理）
- 對外 callback：`onSoundEffect(hasCrit, hasHit)`、`onComplete(entry)`
- 方法：`skipEvent()`（跳過事件暫停）、`stopReveal()`（清理重置）

#### 修改：`src/components/duel/DuelRoom.jsx`

```
Before (4 effects, ~170 行):          After (~10 行 hook + callbacks):
 log 偵測 effect                       useDuelReveal({ room,
 逐一揭露計時器 effect                    onSoundEffect,
 事件暫停 effect                        onComplete })
 完成清理 effect                       + skipEvent → skipEvent
 + 11 個 state 宣告                    + resetLocalState → stopReveal()
 + lastLogLen ref
 + startReveal()
```

#### 修改：`src/components/member/CouncilBattle.jsx`

```
Before:                               After:
 getPartMult(label, fmt)  (內聯)       getCouncilPartMult(label, fmt)  (damage.js)
 scoreVal(label)          (內聯)       labelToValue(label)              (score.js)
 getMappedScore (內聯 parseInt)        getMappedScore 使用 labelToValue
```

#### 修改：`src/components/worldboss/WorldBossAttack.jsx`

```
Before:                               After:
 calcArrowDmg(s, a, b, p) → wrapper   wbArrowDmg(s, a, b, p) → direct call
 calcCounterDmg(a, d) → wrapper        wbCounter(a, d) → direct call
```

**踩坑提醒**：
- `useDuelReveal` 只在 DuelRoom 使用（無跨模式複用價值），抽取是為了隔離程式碼而非複用
- `revealEntry` 和 `revealIdx` 使用 ref 同步防止閉包陳舊（timers 中的 callback 讀最新的值）
- 完成 effect 必須依賴 `room` 物件來計算貓貓攻擊（`room.teamA`/`room.teamB` 找 `allMembersMap`）
- CouncilBattle 的 `getCouncilPartMult` 比舊 `getPartMult` 多處理 `"M"` label（但不影響 CouncilBattle 的 `"0"` 標籤）
- WorldBossAttack 的 `scoreVal`/`scoreLabel` 包裝保留（大量 JSX 使用，移除成本 > 收益）

---

### 最終架構關係（Phases 1-8）

```
src/lib/
  damage.js          ← 各模式共用傷害公式
  score.js           ← 各模式共用計分邏輯
  itemData.js        ← 藥水資料（9 攜帶型 + 7 投擲型 + 村莊配方）
  villageData.js     ← 煉金室產出箭露（arrowdew，微量）

src/battle/
  BattleEvents.js    ← 22 種標準事件型別 + builder
  BattleConfig.js    ← 戰鬥模式參數集中管理
  BattleEngine.js    ← 單人戰鬥事件產生器
  BattleAnimation.js ← 19 個 playXxx + EVENT_DISPATCH
  useFirestoreRound.js ← Firestore 回合 hook（Party/Duel/Dungeon）
  RoundController.js ← 通用事件播放控制器（Monster/Council/WorldBoss）
  useBattleRound.js  ← React hook 封裝 RoundController
  useMiniRoundReveal.js ← mini-round 動畫 hook（Party/Dungeon）
  useDuelReveal.js   ← 決鬥逐箭揭露 hook（DuelRoom）
```

### Phases 1-8 總覽

```
Phase 1  Damage Engine     ██████████████████████████████ ✅
Phase 2  Score Engine      ██████████████████████████████ ✅
Phase 3  Battle Engine     ██████████████████████████████ ✅
Phase 4  Animation Manager ██████████████████████████████ ✅
Phase 5  Firestore 回合     ██████████████████████████████ ✅
Phase 6  RoundController   ██████████████████████████████ ✅
Phase 7  Mini-Round Reveal ██████████████████████████████ ✅
Phase 8  Duel Reveal +     ██████████████████████████████ ✅
         damage.js 補完
```

---

---

## 2026-06-29（佈署 Bug 修正 3 連）

### Bug 1：MonsterBattle 進場報 `ReferenceError: n is not defined`
- **根因**：`MonsterBattle.jsx` 第 464 行在 `useCarryPotion` 函式上方多了一個孤立的 `n` 字元，被 JS 當成未宣告變數執行
- **修正**：刪除該 `n` 字元（`n  // 🧪 使用攜帶型藥水...` → `  // 🧪 使用攜帶型藥水...`）
- **踩坑**：minified bundle 的 `n is not defined` 指向的是源碼中的孤立識別字，不一定是某個真實變數名稱

### Bug 2：進場後 HP NaN/100、ATK 0（DEF 正常）
- **根因**：`calcPotionBuffs`（`itemData.js`）重設計時把回傳格式從 `{ hpMult, atkMult }` 改成 `{ hpPct, atkPct }`，但 `MonsterBattle.jsx` 計算 `bStats` 仍讀 `buffs.hpMult` / `buffs.atkMult`，取到 `undefined`，乘法結果變 `NaN`
- **DEF 正常原因**：`def = baseStats.def + ... `（加法，不乘 buffs）
- **HP 顯示 NaN**：`archerHP` 初始化為 `bStats.hp = NaN`
- **ATK 顯示 0**：UI 有 `||0` fallback，`NaN || 0 = 0`
- **修正**：在 `calcPotionBuffs` 結尾補算 `buffs.hpMult = 1 + hpPct/100`、`buffs.atkMult = 1 + atkPct/100`，兩種格式並存向後相容

### Bug 3：Push 失敗——`codebase-memory-mcp.exe` 超過 GitHub 100MB 限制
- **根因**：`codebase-ui-extracted/` 資料夾含 257MB `.exe` 被 git 追蹤
- **修正**：`.gitignore` 加入 `codebase-ui-extracted/`、`codebase-ui.zip`、`install.ps1`
- **踩坑**：大型二進位工具資料夾務必在第一次 `git add` 前就加進 `.gitignore`

**重要架構提醒**：`calcPotionBuffs` 現在同時輸出 `hpPct/atkPct`（百分比數字）和 `hpMult/atkMult`（倍率）。未來修改此函式時，兩種格式都要維護，否則會影響 MonsterBattle 的開戰數值計算。

---

## 2026-06-28（地下城 7 Bug 修正批次）

### Bug 1：商店 revival_front 復活目標錯誤
- **根因**：`handleResolve` 檢查購買者自身 `role==="rear"`，應找隊伍中任何 `role==="rear"` 的成員
- **修正**：改為掃描 `shopPurchases` 確認有人購買後，取 `members` 中第一個 `alive && role==="rear"` 的成員復活
- `hasFallenFront` 計算移到元件頂層，供按鈕 disabled 和 handleBuy 共用

### Bug 2：休息區全員狀態確認
- `handleResolve` fallback（無人倒地時投票 revive → 全體回 50% HP）原本即正確，保留
- 加入全員狀態小卡（Bug 4 合併）

### Bug 3：計分板折疊 + 視角切換
- **3a 分數折疊**：新增 `scoreRowPage` state；`SCORE_ROW_A=["X","10","9","8","7","6","M"]` / `SCORE_ROW_B=["6","5","4","3","2","1","M"]`；7顆 repeat(7,1fr) + 外部 ▼/▲ 切換按鈕
- **3b 視角切換**：新增 `viewRearInInput` state；`displayedRowMembers` 在非動畫/非送出時允許切換後衛視角；角色列標頭右側加小按鈕

### Bug 4：商店/休息區全員狀態小卡
- 兩個元件 header 下方加 `overflowX:auto` 橫排小卡，顯示 HP 條 + 存活狀態 + 角色

### Bug 5：商店購買限制
- 移除 `bought` state，改為只依賴 Firestore `myPurchases`
- `revival_front` 購買前需 `hasFallenFront === true`，否則 block + 顯示 ⚠️ 無前衛倒地

### Bug 6：關卡機制修改
- **6a all_hit → M懲罰關**：移除「有M全歸零」早回，改為回合結束後 `totalDmg *= max(0, 1 - mCount * 0.1)`；不再限制靶面/按鈕（全分數有意義）；icon 改 ⚠️
- **6b score_gate 比例懲罰**：移除「低於門檻全0」邏輯，改為每箭 `d *= max(0, 1 - (threshold - effectiveScore) * 0.1)`；X/10 視同 9；contractParam cap 9；`_roomMeta` 改 `Math.min(6+tier, 9)`

### Bug 7：後台白底框
- AdminReviewCenter：三個 toggle 按鈕、統計卡、兩個 input 欄位、外賽審核決定區、category badge 改深色
- AdminMembers：MemberCard 主框、EquipTabs 非選中、爭議 Modal 修正區、歷程統計卡、檢定卡 改深色
- AdminFinance：tab 按鈕非選中 改深色
- QR Code 白框保留（掃碼必需）

**踩坑提醒**：
- `score_gate` 的 score_gate penalty 在 dmgMult 之前套用（讓 buff 可以再補救）
- `all_hit` 的 M 計數用 `arrows.filter(a=>(a.score??0)===0)` 而非 breakdown 中的脫靶（breakdown 裡的脫靶還包含 part 未命中的情況）
- `SCORE_GATE_LABELS.slice(0,5)` = ["9","8","7","6","5"]，`slice(5)` = ["4","3","2","1","M"]

---

## 2026-06-27（地下城前後衛顯示重設計 + 死亡轉後衛時機修正）

### Bug A：前衛死亡後在動畫開始前就被移到後排
- **根因**：`processDungeonRound` 一次寫入 `log` 和 `members.role`；客戶端收到快照時動畫剛啟動但 role 已是 post-round 值 → 分排計算立即改變
- **修正**：在 `dungeonDb.js` 新增 `displayGroup` 欄位（`DEFAULT_MEMBER` + `joinDungeonRoom`），並在 `logEntry` 加入 `displayGroupsBefore`；客戶端動畫期間改用 `liveEntry.displayGroupsBefore[id]` 決定分排，動畫結束後才反映新 `displayGroup`

### Bug B：前後兩排同時顯示，怪物畫面被遮住
- **設計調整**：改為「視角分排」——每人只看自己的排（前衛看前衛排，後衛看後衛排）
  - 平時（等待輸入/已送出）：只顯示 `myRowMembers`（完整卡）
  - 動畫進行中：上方補顯 `otherRowMembers` 緊湊小卡（讓後衛看到前衛出手/讓前衛看到後衛支援）
- **displayGroup 規則**：
  - 加入時 `displayGroup = defaultRole`（和 `role` 同步）
  - 前衛死亡：`role → "rear"`；若當前後衛顯示位置 < 4 → `displayGroup → "rear"`（真正移動）；否則 `displayGroup` 保持 "front"（只改狀態標籤）
  - 死亡後留在前排的成員：紫色邊框（`rgba(168,85,247,0.45)`）+ 顯示 "🛡後衛" 標籤

### 實作細節
- `dungeonDb.js`：`DEFAULT_MEMBER` 加 `displayGroup:"front"`；`joinDungeonRoom` 加 `displayGroup:defaultRole`；`processDungeonRound` Step 5b 前計算 `displayGroupsBefore` 並寫入 `logEntry`；死亡邏輯中判斷後衛座位數（`<4`）再決定是否更新 `displayGroup`
- `DungeonBattleRoom.jsx`：新增 `dgOf(m)` 函式（動畫中用 `displayGroupsBefore`，否則用 `displayGroup??role`）；新增 `myRowMembers`/`otherRowMembers`/`myDisplayGroup`/`myRowW`/`otherRowW`；角色列改單排顯示 + 動畫時補顯緊湊他排

**踩坑提醒**：
- `displayGroupsBefore` 是 `aliveIds` 在 Step 5b **之前**快照，確保包含死亡前的分組
- `curRearDisplayCount` 要用 `members`（原始資料）而非 `memberUpd`（已有 patch 但尚未寫入），否則同一回合多人死亡時計數會不準
- 動畫期間 `dgOf` 讀 `liveEntry.displayGroupsBefore`，結束後 `liveEntry = null` → 自動切回 `m.displayGroup`，不需額外清理

---

## 2026-06-27（地下城隊員卡住修復 + 全員 ready 延遲 2 秒）

### DungeonBattleRoom.jsx — 兩個並發競速 Bug

**問題 1：非房主隊員卡住**
- 房主有 20 秒超時清除 `processing` flag，但非房主隊員若 Firestore 快照沒收到 flag 清除，會永遠停留在「等待中」
- **修復**：新增非房主專用 useEffect，監聽 `room.processing`；20 秒未解除 → 自動 `setSubmitted(false)` + 寫 Firestore 清除 `ready/arrows`，讓玩家重新輸入箭分

**問題 2：全員 ready 後瞬間結算（Firestore 快照尚未傳播到房主）**
- 最後一個玩家按送出 → 房主可能在其他成員快照更新前就跑 `handleProcess`
- **修復**：all-ready useEffect 改用 `allReadyTimerRef` 計時 2 秒再呼叫 `handleProcess`；若期間有人取消 ready，timer 即清除；若 timer 已在跑則不重新啟動（防重複）

**踩坑提醒**：
- `allReadyTimerRef` 宣告在 useEffect 同層（hook 頂層），不能放在 useEffect 內（違反 Hooks 規則）
- cleanup fn 在 React StrictMode 下可能被呼叫兩次，ref guard (`if (allReadyTimerRef.current)`) 防重複
- 非房主 reset 要同時清 Firestore 的 `ready` 和 `arrows`，否則 Firestore 仍顯示已送出

---

## 2026-06-27（Bug 修正 + 首頁/成就/怪物卡改版）

### Bug 1：商店購買記憶 + 藥水重購
- `dungeonDb.js`：`enterNonCombatRoom` / `resolveNonCombatRoom` 不再重置 `shopPurchases`
- `purchaseDungeonItem`：`hp_potion` 跳過記入 bought 清單 → 允許重複購買
- `DungeonShop.jsx`：本地 `bought` 也跳過 `hp_potion`

### Bug 2：進場動畫 + 樓層顯示
- `DungeonBattleRoom.jsx`：地圖模式用 `mapCurrentRoomId` 作動畫 key（而非 floor 始終不變）
- `dungeonDb.js`：`enterMapCombatRoom` 的 `currentFloor` 改從 `mapFloorIndex + 1` 計算

### Bug 3：今日箭數同步
- `DailyQuest.jsx`：改用 `subscribeTodayPracticeLogs`（Firestore 側限日期），排除 party/duel/dungeon source

### Bug 4：地下城事件效果驗證
- `dungeonDb.js`：新增 `def_mult_all` case（守護結界事件之前缺失）
- `dungeonData.js`：修正 `reversal` 合約的 `arrowBreakdown.push` 中 `dmg` → `dmg: d` 拼寫錯誤
- `DungeonBattleRoom.jsx`：`CONTRACT_HEX` 補上 reversal/odd_only/even_only 顏色

### Bug 5：成就通知系統
- `MemberDex.jsx`：
  - 成就 useEffect deps 補上 `monsterDex, craftStats, chestStats, potionDex, cardData`（原先缺失導致部分成就無法即時偵測）
  - `createNotification` 改為個人通知（`targetMemberId: profile.id`）而非全頻廣播，防止每次進頁就廣播
  - 通知 type 改為 `"achievement"`

### Bug 6：首頁等級卡改版（MemberHome.jsx）
- 移除 `bg-white/15` 個人資訊列（徽章總覽/賽事積分/月卡），改放到等級卡
- 名字旁加入公會等級 pill（`adventurerXP` + `levelFromXP`）
- 等級卡新增：地下城圖鑑/成就圖鑑/貓貓卡片收藏進度小格
- 月卡移入等級卡（月卡剩餘次數 + 申請按鈕）
- 移除「年度檢定摘要」與「最近成績」區塊
- 引入 `COLLECTIBLE_MAP` from dungeonCollectibles 計算地下城圖鑑總量

### Bug 7：怪物卡片改版（CardCollection.jsx）
- 改為條列式（`flex-col` 取代 `grid-cols-2`）
- 每列顯示：icon/名稱/階級/星數/加成 + 直接顯示「✨ 可升星」提示（inline，無需展開）
- 右側快速裝備/卸下按鈕（inline，無需展開）
- 展開只剩升星操作與 mythic 屬性選擇

### Bug 8：廣播訊息改版（MemberHome.jsx）
- 移除 `msg-scroll-bg.webp` 底圖，改為半透明深色背景
- 新增分類篩選：全部|優惠|重要|考證|成就|地下城|世界王|一般|掉寶
- 廣播文字顏色改為白色系（深色背景相容）

---

## 2026-06-27（地下城 + 組隊模式前後衛分排統一為 role-based）

### DungeonBattleRoom.jsx + PartyBattleRoom.jsx — role-based 分排顯示
- **變更前**：前排 = `memberList.slice(0,4)`，後排 = `memberList.slice(4)`（依加入順序，與 role 無關）
- **變更後**：
  ```
  rearRoleMembers   = memberList.filter(m => m.role === "rear")
  frontRoleMembers  = memberList.filter(m => m.role !== "rear")
  frontMembers = [...frontRoleMembers, ...rearRoleMembers.slice(4)]  // 後衛滿4時溢位到前排
  backMembers  = rearRoleMembers.slice(0, 4)                        // 最多4人後排
  ```
- **溢位後衛**：role="rear" 但後排已滿4人 → 顯示在前排格子，青色邊框（`rgba(20,184,166,0.4)`）區分
- **後排邊框**：改為青色（`#14b8a6` 系列），與前衛的紅色形成對比
- **排頭標籤**：有後排成員時顯示「⚔️ 前衛 / 🛡 後衛」小標（只在有後排時出現）
- **後排寬度**：地下城改用 `backW`（獨立計算，不再硬借 `frontW`）

### dungeonDb.js + partyDb.js — 攻擊順序統一前衛優先
```js
const orderedAliveIds = [
  ...frontIds.filter(id => aliveIds.includes(id)),
  ...rearIds.filter(id => aliveIds.includes(id)),
];
// 攻擊 pass 改用 orderedAliveIds（前衛先動，後衛後動）
```
- miniRounds 中前衛的攻擊動畫先播，後衛後播，再接怪物反擊
- 反擊仍只打 frontIds（後衛全程免疫，前衛全滅才打後衛）

**踩坑提醒**：
- `backW` 要獨立計算（`backMembers.length` 分母），地下城舊版錯用 `frontW` 導致後排卡片過寬

---

## 2026-06-27（組隊模式前後衛系統 + 怪物人數縮放）

### partyDb.js — 前後衛戰鬥邏輯
- **`submitArrows`**：新增 `role="front"|"rear"` 與 `rearChoice="heal"|"dmg"|null` 參數，每次送箭時寫入 Firestore
- **`processPartyRound` Step 1**：後衛選「攻擊」者，所有箭傷 ×0.5（arrowBreakdown 也同步縮放）
- **前後衛分類**：`frontIds`（role 未定義或 "front"）/ `rearIds`（role="rear"）
- **反擊邏輯**：只打存活 `frontIds`；前衛全滅時才打所有存活成員
- **後衛治癒**：選擇 "heal" → pool = 25% maxHP，均分給所有存活隊友（不含自己）
- **前衛復活機制**：前衛 HP 歸零 → 不立即陣亡，改為轉後衛 + 復活至 50% HP；後衛 HP 歸零才真正陣亡

### partyDb.js — 怪物人數縮放（補完）
- `genPartyHPMult` 改為確定性公式：`1.0 + (playerCount-1) * 0.5`（HP 每多一人 +50%）
- `startPartyBattle` 加入 `monAtkMult = 1+(N-1)*0.15`、`monDefMult = 1+(N-1)*0.15`、`rewardMult = 1+(N-1)*0.2`
- `rewardMult` 存入 Firestore room document，結算時讀取用

### PartyBattleRoom.jsx — 角色選擇 UI
- 計分前顯示「⚔️前衛 / 🛡後衛」選擇按鈕
- 選後衛後出現「💊治癒隊友 / ⚡協助攻擊」策略按鈕
- 後衛未選策略時送出按鈕鎖住（顯示「請先選擇後衛策略」）
- 新回合時從 Firestore 讀取 role（捕捉前衛轉後衛通知），否則重置為 "front"
- 玩家名牌顯示 ⚔️/🛡 角色標籤

**踩坑提醒**：
- `allPlayerData` 在 Step 1 即縮放，miniRounds 的 pairDmg 自動正確
- 前衛轉後衛由伺服器寫入 `role="rear"`，下回合 `useEffect([room?.round])` 讀取後更新本地 state

---

## 2026-06-27（地下城/組隊怪物人數縮放 + 後衛機制修正 + 等待室 Bug）

### dungeonDb.js — 後衛機制重設計
- 後衛傷害倍率：×1.5 → **×0.5**（後衛本應保護，不是輸出強化）
- 後衛治癒：原「自己回 25% HP」→ **25% maxHP pool 均分給存活隊友（不含自己）**
  - `receivedHeal` 物件累計，HP update 時套用

### dungeonDb.js — 怪物人數縮放
- `startDungeonBattle`：新增 `monHPMult = 1+(N-1)*0.5`、`monAtkMult = 1+(N-1)*0.15`、`monDefMult = 1+(N-1)*0.15`、`rewardMult = 1+(N-1)*0.2`
- 廢除 `memberAtkMult`（玩家 ATK 加成移除）

### DungeonLobby.jsx — 等待室卡死修復 + 按鈕並排
- **問題**：等待室按鈕被 `overflow-hidden` 截掉，無法點擊「開始地下城」
- **根因**：House 設定 `div` 用了 `shrink-0`，把 footer 推到視區外
- **修復**：將地下城設定移到 `flex-1 overflow-y-auto` 捲動區內；footer 改為 `flex gap-2`，「離開」與「開始」並排顯示

---

## 2026-06-27（地下城收藏品圖鑑全面重設計）

### dungeonCollectibles.js — 完整重寫（216 件）
- **規格**：6 族系 × (20 普通 + 10 稀有 + 5 首領 + 1 超稀有) = 216 件，加上原有 24 首殺限定
- **掉落邏輯**：
  - 普通怪物房 15%（原 10%）
  - 精英房 20% 稀有 + 25% 普通（原 35%+30%）
  - 寶箱房 15% 稀有 + 40% 普通（原 20%+50%）
  - Boss 房：`rollBossDrops(family, difficulty)` 回傳陣列，65% Boss 物品 + 難度依比超稀有（normal 1% / hard 2% / elite 3% / nightmare 5%）
- **API 變更**：`rollBossDrop` → `rollBossDrops`，回傳 `[{itemId}]` 陣列而非單一物件

### DungeonBattleRoom.jsx — 三處 Bug 修復
1. **family 偵測**：`room?.dungeonId` → `room?.mapDungeonId || room?.dungeonId`（地圖模式用 mapDungeonId）
2. **首殺 trophy**：同上，共三個地方（line ~500, ~506, ~893）全改為 mapDungeonId
3. **collectible → collectibles**：`claimLootRef.current` 改用陣列格式，UI 支援同時顯示多件掉落

### DungeonDex.jsx — 新增超稀有稀有度
- `RARITY_LABEL` / `RARITY_COLOR` 加入 `superRare`（金黃色 #fde047）
- `allFamilyItems` 加入 `tiers.superRare`

**踩坑提醒**：
- `rollBossDrops` 可能回傳空陣列（Boss 沒掉），UI 需做 length 判斷
- superRare 物品的 rarity 字串是 `"superRare"`（camelCase），RARITY_COLOR 也用同名 key

---

## 2026-06-27（地下城等待室重整持久化）

### 地下城等待室：重整後不再跳出
- **問題**：在等待室（DungeonLobby）重整後，用戶回到初始建立/加入畫面，失去等待室狀態
- **分析**：`dungeon-room` 頁面（戰鬥中）早已透過 `member_page` + `dungeon_room` 兩個 sessionStorage key 正確持久化；但等待室是 `page="dungeon"` + 無 roomId 記錄，重整後無法還原
- **修復**：`DungeonLobby.jsx` — 加入 `dungeon_waiting_room` sessionStorage key（`{roomId, isHost}`）：
  - `handleCreate` 成功後 → `setItem`
  - `handleJoinRoom` 成功後 → `setItem`；訂閱到 active/map_explore → `removeItem` 後跳轉
  - `handleStart`（房主開始）→ `removeItem` 後跳轉
  - 「離開等待室」按鈕 → `removeItem`
  - mount `useEffect`（`[myId]`）→ 讀取存檔、重新訂閱房間；房間已 active 則直接跳轉；房間不存在則清除存檔
- **坑**：恢復訂閱的 `sub` 變數在 callback 內用 `sub?.()` 取消，因 Firestore `onSnapshot` 同步回傳 unsub，callback 執行前 `sub` 已被賦值，安全

---

## 2026-06-27（地下城全面 bug 修復 — 透明度/卡死/投票/後排/合約顏色）

### 1. 地下城大廳透明度 & 底部導航遮擋
- **問題**：大廳背景太透明（無暗色疊層）、資訊框透明度過高可讀性差；等待室 `h-[100dvh]` 未計入底部導航高度，開始戰鬥按鈕被遮住
- **修復**：`DungeonLobby.jsx` — 背景加 `rgba(0,0,0,0.6)` 疊層；amber 資訊框 `/10→/20`、文字 `text-slate-300→200`；等待室外層 `h-[100dvh]→h-full`（正確填滿 MemberApp flex 容器）
- **8人支援**：`dungeonDb.js` `joinDungeonRoom` 限制 `>=4→>=8`

### 2. 地下城結算改為各自領取獎勵
- **問題**：打完首領後必須等房主按領取，隊員無法各自拿獎勵；且自動存檔 useEffect 和按鈕領取可能雙重加 XP
- **修復**：`DungeonBattleRoom.jsx` — 新增 `handleClaimSelf()` 每人點自己的按鈕領獎（金幣/寶箱/素材/圖鑑/XP/箭露/扭蛋幣/符文/收藏品）；移除舊 `handleClaim()`（房主代領）和自動存檔 `useEffect`；清除無用 `xpSavedRef`
- **坑**：`xpSavedRef` 是舊自動存檔的 guard，移除後記得也刪掉變數宣告

### 3. 投票顯示中文房間名 + 全員同意自動前進
- **問題**：投票文字顯示房間代碼（如 `f0c1r0`）而非中文名（如「幽暗走廊」）；全部人同意後仍要等 30 秒
- **修復**：`DungeonExplore.jsx` — `VoteOverlay` 接收 `floorData` prop，用 `proposal.targetRoomId` 查 `floorData.rooms[].label` 顯示中文名；自動結算條件從 `voteCount >= totalVotes`（全部投同一房）改為 `totalVoteCast >= totalVotes`（全部有投票即可），並補上 `onResolve` 到 useEffect deps 避免閉包過時

### 4. 後排角色卡完整顯示 + 玩家高亮
- **問題**：超過 4 人時後排角色只在戰鬥動畫期間短暫顯示，且資訊精簡（只有名字+HP條）
- **修復**：`DungeonBattleRoom.jsx` — `showBackRow` 條件改為 `backMembers.length > 0`（永遠顯示）；後排卡改用 `frontW` 寬度，加入完整資訊（角色圖像85px、前衛/後衛徽章、ATK/DEF、合約圖標、就緒狀態、跳過按鈕）；自己→金色邊框+光暈+頭像描邊；後衛→紫色邊框+光暈
- **後衛機制驗證**：`processDungeonRound`（`dungeonDb.js`）邏輯正確 — 治癒：傷害歸零+回合末回25%HP；攻擊：傷害×1.5倍；反擊只打前衛（`frontIds`），後衛完全免疫

### 5. 合約文字黑色看不見
- **問題**：進場關卡合約名稱在深色背景上顯示黑色，完全看不到
- **根因**：`CONTRACT_TYPES.color` 存的是 Tailwind class（如 `text-yellow-300`），但在 HUD 的 `BattleStatusTags` 中被當作 inline `color` 值使用，瀏覽器無法解析 → 預設黑色
- **修復**：`DungeonBattleRoom.jsx` — 加入 `CONTRACT_HEX` 映射表（`all_hit→#fde047` 等），HUD 改用 hex 色值

### 6. 地下城卡死全面修復（核心）
- **問題**：全員送出箭分後常卡住需重整；重整後無法輸入分數（按鈕沒反應）；房主強制重置按鈕不見或不 work
- **根因分析**：
  - `handleProcess` 無 try/finally — `processDungeonRound` 拋例外或 Firestore 超時時 `processingRef.current` 永遠卡在 `true`，阻擋所有後續結算嘗試
  - 重整後 `me.ready` 仍為 `true`，但本地 `submitted` 重置為 `false` — 玩家可看到輸入畫面但 Firestore 不認
  - 強制重置按鈕只出現在 `submitted===true` 時，房主重整後看不到
- **修復（`DungeonBattleRoom.jsx`）**：
  1. **try/finally**：`handleProcess` 的 `processDungeonRound` 呼叫包在 `try/catch/finally` 中，`finally` 保證重置 `processingRef.current=false` + `setLoading(false)`
  2. **重整自動同步**：新增 `useEffect`，當 `me.ready===true` 但本地 `submitted===false` 時自動寫 Firestore 清除 `ready` + `arrows`（用 `readySyncedRef` 確保只執行一次）
  3. **房主強制重置常駐**：HUD 區域新增 `position:fixed` 的 ⚙️ 強制重置按鈕，戰鬥中永遠可見（呼叫 `clearDungeonProcessing` 清除 Firestore `processing` flag）
  4. **重新輸入按鈕**：`submitted` 狀態下非房主可點「重新輸入」清掉 Firestore `ready/arrows` + 本地 `submitted`，重新輸入箭分
  5. **5秒安全網**：房主送出後若未全員 `ready`，5 秒後用 `roomRef.current`（最新 room 資料）重新檢查並強制結算（避免 Firestore 同步延遲造成的卡住）
- **坑**：fallback timeout 不能用 `handleProcess()`（閉包中的 `room` 已過時），必須用 `roomRef.current` 直接呼叫 `processDungeonRound`；`lastProcessedRef.current` 要先鎖定再解鎖，和 `handleProcess` 一致

---

## 2026-06-27（全系統深藍主題改造）

### 改造目標
全站（射手模式 + 教練模式 + 後台）從淺色背景改為深藍色主題，提升夜間使用舒適度與視覺一致性。貓貓村保留原始淺色風格不受影響。

### 架構設計
採用 **CSS specificity 三層分級**控制，不使用 `!important`（inline override 例外）：

| 層級 | 選擇器 | Specificity | 作用 |
|------|--------|-------------|------|
| Tailwind 原始值 | `.bg-white` | 0,1,0 | 預設樣式 |
| 深藍覆寫 | `.content-area .bg-white` | **0,2,0** | 子頁面變深藍 |
| 貓貓村保護 | `.content-area .no-override .bg-white` | **0,3,0** | 還原原始值 |

### 修改檔案

**`src/index.css`**
- 新增 CSS 變數（`--bg-deep: #0f172a`、`--bg-surface: #1e293b`、`--bg-card: #1e293b`、`--text-primary: #f1f5f9` 等）
- body 全域深藍背景 + 自訂滾動條
- **56 行 `.content-area` 覆寫**：背景（bg-white→#1e293b、bg-gray-50→#1e293b 等）、文字（text-gray-900→#f1f5f9、text-gray-600→#94a3b8 等）、邊框（border-gray-200→rgba(255,255,255,0.08)）、陰影
- **34 行 `.no-override` 重置**：完全還原 Tailwind 原始顏色保護貓貓村
- **Attribute selector + `!important` 層**：蓋掉後台 inline styles（`background:"white"` → `background:#1e293b !important`、`color:"#1e293b"` → `color:#f1f5f9 !important`），因為 inline style 優先級高於 CSS class

**`src/pages/MemberApp.jsx`**
- 頁面內容區加入 `className="content-area"`
- 貓貓村用 `<div className="no-override">` 包裹
- 底部導覽列：白底黑字 → `#0f172a` 深藍 + `#94a3b8` 淺灰文字（active 用 `#60a5fa` 藍高亮、`#f59e0b` 金色指示條）
- 小紅點邊框：白 → `#0f172a` 無縫融入

**`src/pages/AdminApp.jsx`**
- **射手模式容器**：`#f8fafc` 淺灰 → `#0f172a` 深藍，改為 `height:100dvh` flex 布局
- **後台容器**：`#f8fafc` → `#0f172a`
- **後台 Header**：白底黑字 → 深藍漸層 `#0f172a→#0c4a6e` + 淺色文字
- **兩個模式的底部導覽列**：白底 → 深藍 + 淺色文字
- **Hub 卡片**：白底 → `#1e293b`，深色標題 → `#f1f5f9`
- 頁面內容區加入 `className="content-area"`

### 踩坑提醒
1. **CSS class 無法蓋掉 inline style**：`BillingSystem.jsx` 用 `background:"white"` inline 語法，CSS `.bg-white` 覆寫完全無效 → 改用 `[style*="background: white"] { background: #1e293b !important; }` attribute selector
2. **`unset` 會讓背景變透明**：初始 `.no-override` 用 `background-color: unset` → 貓貓村白底變透明 → 改為顯式指定 `background-color: #fff` 才能正確還原
3. **`!important` 是必要之惡**：只用在 inline override 層（attribute selector），class-based 覆寫全不用 `!important`

🔗 **在 Obsidian 中開啟**：`obsidian://open?vault=Obsidian%20Vault&file=catarrow%2Fchangelog`

---

## 2026-06-27（修正 Boss 通關 React crash）

### Bug：Boss 結算畫面 `TIER_LABEL` 物件當 React child
- **Bug**：首領通關後畫面卡住並噴 `Error #31: object with keys {label, color, bg}`，且連帶導致組隊模式也無法開房
- **根因**：`DungeonBattleRoom.jsx` Boss 結算畫面中 `{TIER_LABEL[room.monster.tier] || room.monster.tier}` — `TIER_LABEL[tier]` 回傳的是 `{label, color, bg}` 整個物件，React 無法渲染物件 → 擲回 Error #31 → 整個 React 樹掛掉 → 所有依賴同一個 App 殼的頁面都無法運作
- **修復**：改為 `{TIER_LABEL[room.monster.tier]?.label || room.monster.tier}`（只取 label 字串）
- **坑記錄**：HUD 區的 TIER_LABEL 使用模式正確（`const tl = TIER_LABEL[...]; ...tl.label`），但 Boss 結算區直接用 `TIER_LABEL[...]` 作為 JSX child，兩處不一致導致漏修

---

## 2026-06-27（地下城任務類型重設計 + 商店/事件清理 + 方型地圖）

### 任務類型 6→9 種
- **新增 3 種**：`reversal`（逆轉關：6↔X, 7↔10, 8↔9 分數映射）、`odd_only`（單數關：只算 7/9/X）、`even_only`（雙數關：只算 6/8/10）
- **`assignContracts`/`rerollContract`** 參數改為 `x_crit` 6~10、`target_score` 20~50
- **`calcDungeonContractDmg`**：加入 reversal 分數映射邏輯、odd_only/even_only 過濾、target_score 總分門檻檢查（6箭總分 > param 才有傷害）
- **`getContractBadge`**：新增 reversal(橘)/odd_only(青)/even_only(粉) badge

### 商店清理（DUNGEON_SHOP_ITEMS 5→8 項）
- **移除**：`contract_reset`（契約重置）、`rune_repair`（符文修復石）— 功能不需要
- **新增**：`hp_max_boost`（HP上限+30%）、`atk_large`（ATK×1.5）、`def_large`（DEF×1.5）、`revival_front`（前衛復活藥）
- **`dungeonDb.js` `purchaseDungeonItem`**：移除 contract_reset / rune_repair case
- **`DungeonShop.jsx` `SHOP_ITEM_META`**：同步移除對應定義

### 隨機事件豐富化（DUNGEON_EVENTS 10→18 項）
- **移除**：`scroll`（古老卷軸）、`contract_swap`（契約轉換）
- **新增精細級距事件**：`cursed_spray`（ATK×0.7 重度）、`blessed_wind`（ATK×1.2 強化）、`fairy_blessing`（回40%HP）、`dark_ritual`（單人ATK×0.5）、`golden_fountain`（80金幣）、`time_warp` / `sleepy_dust`（怪物不反擊）、`defense_boost`（DEF×1.5）、`wish_well`（單人ATK×2）

### 地圖方形房間改造
- **`DungeonMap.jsx` 完整重寫**：圓形節點 → SVG 方形房間（`<rect>` 圓角矩形），加入斜線網底（未探索）、發光濾鏡（當前房間）、脈衝外框（可移動）、房間標籤+合約 badge
- **`DungeonLobby.jsx` 選擇畫面加大**：難度按鈕 `flex` → `grid-cols-2` 大按鈕、地下城卡片放大（`py-5 px-4`）、加入樓層 badge + 地圖序號

### 修正 reversal 關
- 分數映射：6↔X(11), 7↔10, 8↔9 後走正常傷害公式，非特殊爆擊規則

**踩坑提醒**：
- `target_score` 的 CONTRACT_TYPES desc 需保持與 spec 一致（超越分數關：總分門檻）
- calcDungeonContractDmg 的 reversal 是分數映射而非特殊 crit/miss 規則

---

## 2026-06-27（組隊開房自動清除舊房間）

### 新增：createPartyRoom 自動清除該使用者的舊 waiting 房間
- **為什麼**：前次 React crash 後舊房間殘留在「waiting」狀態，導致使用者無法新建房間
- **改了什麼**：`partyDb.js` `createPartyRoom` 開頭加入查詢該 hostId + status=waiting 的舊房間，`deleteDoc` 全部清除後再建立新房間
- **坑記錄**：如果 dungeon room 也有相同問題，可到 `dungeonDb.js` 的 `createDungeonRoom` 加入相同邏輯

---

## 2026-06-27（地下城地圖模式成員復活 Bug 修復）

### 地下城組隊：跨房間死亡 Bug（`enterMapCombatRoom` 未重置 alive）
- **Bug**：玩家在地圖模式某個戰鬥房間死亡（alive=false），進入下一個房間後仍保持死亡狀態，永遠被排除在戰鬥之外（表現為「被踢掉」）
- **根因**：`enterMapCombatRoom` 沒有像 `startDungeonFloor` 一樣重置 `alive=true`
- **修復**：`dungeonDb.js` `enterMapCombatRoom` 的 member 更新迴圈中加入：
  - `revived: false`（每間房間重置復活旗標，讓復活符重新生效）
  - 若 `!m.alive`：`alive=true` + `hp = max(1, maxHP*0.3)`（以 30% HP 復活）
- **坑記錄**：`startDungeonFloor`（舊地下城模式）有重置 alive，但地圖模式的 `enterMapCombatRoom` 是後來寫的，漏掉了這個重置

---

## 2026-06-27（遠征隊 3 槽 + 遠征獎勵重構 + 村莊三修）

### 遠征隊：3 槽位同時派遣
- **Firestore 欄位**：`members/{id}.expedition`（舊，單一）→ `members/{id}.expeditions.{0|1|2}`（新，map）
- `db.js`：`startExpedition(memberId, slotIdx, ...)` / `collectExpedition(memberId, slotIdx, ...)` 加 `slotIdx` 參數
- `ExpeditionPanel.jsx` 全量重寫：頂部 3 張槽位卡片（空置/進行中/完成）；點空槽展開派遣表單；已在遠征的貓不出現在選貓清單
- 向後兼容：若 `expeditions` 為空但存在舊 `expedition`，UI 自動顯示為 slot 0
- **坑**：Firestore map 更新用 `expeditions.${slotIdx}` 路徑，不能用陣列 index 更新

### 遠征獎勵重構
- `expeditionData.js`：各 T 加入建築材料（ore/melon/fish/meat/driedfish/can），覆蓋 T1-T5
- 稀有獎勵統一 **30% 機率**（T1 arrowdew 5-10 / T2 5-15 / T3 10-30 / T4 15-50 / T5 25-75；扭蛋幣 T1 1 / T2 1-2 / T3 1-3 / T4 1-4 / T5 1-5）
- 倍率從 `catLevelMult(catLevel)` 改為 `catPowerMult(catATK)`
  - `calcCatFullStats(catData)` 純函式：鏡像 useCatCompanion 計算（類型基底+等級+裝備+羈絆）→ 放在 `expeditionData.js` 避免 lib→hook 反向引用
  - `catPowerMult(catATK) = min(3.0, max(1.0, 1 + (atk-10)/100))`：攻擊型貓、高裝備、高羈絆天然得更高獎勵倍率
- `calcExpeditionRewards(tier, catData)` 接收完整 catData（不再只傳 catLevel）
- `handleCollect` 傳 `myCats[exp.catId]`（完整物件）

### 貓貓村三項修正
1. **扭蛋幣小數**：ResourceRow 改 `Math.floor(gachaCoins || 0)`
2. **市集掛賣到期**：`listCardForSale` 寫入 `expiredAt`（+7天）；`subscribeCardMarket` 客戶端過濾過期；UI 顯示「⏳ N天後下架」（1天內紅字警告）
3. **賣家售出通知**：`buyCardListing` 成交後 `createNotification({ targetMemberId: listing.sellerId, type:"market_sale" })`

---

## 2026-06-27（地下城收藏品 + 入口房修正）

### 地下城收藏品系統（全新）
- `src/lib/dungeonCollectibles.js`（新建）：6族系 × 7件 = 42普通 + 24首殺限定 = 66件
- `src/lib/dungeonDb.js`：新增 `addCollectible / addCollectibles / subscribeCollectibles`
- DungeonBattleRoom 結算：Boss 必掉 boss 族系收藏品；普通/精英/寶箱房依機率掉；首殺額外掉限定品
- `src/components/dungeon/DungeonDex.jsx`（新建）：圖鑑元件，進度條 + 族系篩選 + 首殺限定切換
- DungeonLobby：加第三個 Tab「🔮 圖鑑」

### 地下城入口房修正
- `dungeonData.js`：入口格 (0,0) 改為 `entrance` 類型（不再是 monster），`ROOM_TYPE_META` 補 entrance 定義
- 樓梯改放 `row≥1` 隨機位置，避免跟入口同行
- `DungeonExplore.jsx`：entrance 房靜默通過（自動清除），已清除房再次踩不觸發（商人除外）

### Firestore 欄位
- `members/{id}.dungeonCollectibles = { [itemId]: qty }` （increment，不需額外規則）

---

## 2026-06-27（符文系統 + 貓咪修正 + 世界王 + 報到修復）

### 符文系統（地下城專屬）
- `src/lib/runeData.js`（新建）：13類型 × 4階段 = 52種符文，`calcRuneBonus()` 計算加成
- `src/lib/runeDb.js`（新建）：Firestore 操作（getRuneInventory, addRune, equipRunesToDungeon）
- DungeonLobby 等待室加入符文槽 UI，開始時套用 ATK/DEF/HP 加成
- DungeonBattleRoom Boss 通關後掉符文，金幣/XP 獎勵套符文倍數
- Firestore：`members/{id}.runeInventory`、`dungeonRooms/{id}.memberRunes.{memberId}`

### 貓咪系統
- **羈絆每級連續加成**：攻/防型 `+5%/Lv`，全能型 `+2.5%/Lv`（移除 Lv5/Lv10 里程碑制）
- 移除 CatCollection.jsx 手動類型選擇器，改顯示 `CAT_TYPE_MAP` 固定類型
- 修正 PartyBattleRoom catOverlayCats 中 catId 錯誤取了 archerStyle

### 世界王
- `simulateBotRound(bot, bossAtk, bossDef, playerAtk=80)` — 機器人 ATK 改用玩家實際數值

### 報到修復
- rejected 狀態可重新報到：`submitCheckin` 允許覆蓋、按鈕改為「🔄 重新報到」

---

## 2026-06-26（24 地下城 + 首殺系統 + 成就 + 全系統公告）

### 核心設計
- **24 個地下城**（6族 × 4難度），從舊版 `shadow-crypt` 原型升級為完整地下城矩陣
- **首殺系統**：Boss 房通關 → 寫入 `dungeonFirstClears/{dungeonId}`（Firestore），紀錄保持一年後重整，首殺 host 獲得 `dungeonFirstKills` 陣列條目
- **成就圖鑑**：新增「地下城」類別 + 11 個成就（首通關 / 累積次數 / 各難度全族 / 地獄勇者 / 首殺英雄 / 征服者）
- **全系統公告**：首殺後寫入 `systemBroadcasts`，MemberApp + AdminApp 訂閱 30 分鐘內播報，顯示橫幅 toast

### 難度設計
| 難度 | 層數 | 怪物 Tier | Boss Modifier |
|------|------|-----------|---------------|
| 普通 | 2層  | T1-T2     | HP×1.5, ATK×1.5, DEF×1.5 |
| 進階 | 3層  | T3-T4     | HP×1.5, ATK×1.2, DEF×1.2 |
| 困難 | 3層  | T4-T5     | HP×1.4 only |
| 地獄 | 4層  | T5-T6     | 無（原始數值）|

### Tier 映射（mapRoomTier 1→6）
`common / rare / elite / fierce / boss / mythic`

### Firestore 新 Collections
- `dungeonFirstClears/{dungeonId}` — 首殺紀錄（memberId, memberName, clearedAt, teamNames...）
- `systemBroadcasts/{id}` — 全系統播報（type, dungeonId, dungeonName, memberName...）
- `members/{id}.dungeonClearLog.${dungeonId}.{count,lastAt}` — 個人通關記錄
- `members/{id}.dungeonFirstKills[]` — 首殺地下城 ID 陣列（用於成就）

⚠️ **注意**：`dungeonFirstClears` 與 `systemBroadcasts` 需在 Firebase Console 手動新增 Firestore 安全規則：
```
match /dungeonFirstClears/{id} { allow read, write: if request.auth != null; }
match /systemBroadcasts/{id} { allow read: if request.auth != null; allow write: if request.auth != null; }
```

### 修改檔案
- `src/lib/dungeonData.js`：DUNGEON_MAPS 改為 24 個，新增 `DIFFICULTY_CONFIGS`、`FAMILY_CONFIGS` exports，4 個 floor 模板函式
- `src/lib/dungeonDb.js`：新增 6 個函式（`trySetDungeonFirstClear`, `getDungeonFirstClear`, `updateMemberDungeonLog`, `addMemberFirstKill`, `publishDungeonFirstKill`, `subscribeLatestBroadcast`）
- `src/lib/achievementDex.js`：新增 dungeon 類別 + 11 個成就
- `src/components/dungeon/DungeonExplore.jsx`：`mapRoomTier` 支援 tier 1-6
- `src/components/dungeon/DungeonLobby.jsx`：難度 tab + 六族 2×3 格子選單
- `src/components/dungeon/DungeonBattleRoom.jsx`：handleClaim 加入 Boss 房偵測、首殺邏輯、首殺橫幅 overlay
- `src/pages/MemberApp.jsx` / `AdminApp.jsx`：訂閱 `subscribeLatestBroadcast` 顯示首殺橫幅

### 踩坑
- `setFirstKillData(killMeta)` 是非同步的，同一個 handleClaim 函式內不能用 `if (!firstKillData)` 判斷——改用 `wasFirstKill` local 變數
- 管理員 AdminApp 已加 `useRef` import，不需重複加

---

## 2026-06-26（地下城地圖探索模式 Phase 1-3 完整實作）

### 核心設計
地下城模式全面重設計：從「單調樓層」改為「SVG 地圖探索 → 戰鬥 → 返回地圖」循環。

### 新增檔案
- `src/lib/dungeonData.js`：`DUNGEON_MAPS`（幽冥地窖 3 層 24 房）、`ROOM_TYPE_META`（10 種房型）、`getReachableRooms`、合約標籤 helpers
- `src/lib/runeData.js`：7 種符文（復活/強攻/守護/貓靈/暴烈/生命 + 多重復活），3 個稀有度
- `src/components/dungeon/DungeonController.jsx`：根據 Firestore `status` 路由（map_explore→DungeonExplore，active/completed→DungeonBattleRoom）
- `src/components/dungeon/DungeonMap.jsx`：SVG 地圖，5 種節點狀態（未探索黑底問號、已探索彩色、當前金框、可移動脈衝動畫、已清除打勾）
- `src/components/dungeon/DungeonExplore.jsx`：探索 UI + 投票系統 + 前後衛/符文多步驟選擇 modal

### 修改檔案
- `dungeonDb.js`：新增 `initDungeonMapRun`、`saveMapExploration`、`proposeMapMove`、`castMapVote`、`resolveMapVote`、`advanceMapFloor`、`enterMapCombatRoom`（含怪物+陣型+符文注入）、`returnToMapAfterBattle`
- `DungeonBattleRoom.jsx`：加 `isMapMode/onReturnToMap` props；地圖模式 win 畫面顯示「房間通關！」，host 領獎後呼叫 `returnToMapAfterBattle`，Firestore 訂閱自動路由回地圖
- `DungeonLobby.jsx`：新增「地圖探索 / 經典樓層」切換 + 地下城選擇 UI
- `MemberApp.jsx`：DungeonBattleRoom → DungeonController

### 踩坑記錄
- `enterMapCombatRoom` 未設 `totalFloors`，`processDungeonRound` defaults 到 7 → 殺怪進 `path_select` 而非 `completed`；修正：明確設 `totalFloors:1, currentFloor:1`
- DungeonExplore 早期版本含巢狀 DungeonBattleRoom，與 DungeonController 路由衝突；已移除，改由 Firestore status 驅動路由
- `returnToMapAfterBattle` 後不需要呼叫 `onReturnToMap?.()`，Firestore 訂閱自動觸發 DungeonController 重渲染

### 待做（Phase 4+）
- 前後衛傷害規則（前衛全傷/後衛 -30%）接入 `processDungeonRound`
- 後衛每回合「攻擊 vs 治療」選擇 UI（DungeonBattleRoom）
- 非 host 成員的陣型/符文選擇（DungeonBattleRoom 進場前 modal）
- 掉寶清單（dungeonLoot.js）
- 通關結算通知（通知中心）

---

## 2026-06-26（UI 一致性修復 — 組隊死亡動畫 + 地下城HP條 + 世界王CatMsg/CatRoundOverlay）

### 組隊打怪怪物死亡畫面增強
**為什麼**：組隊打死怪物後只有一個單調的黃底文字畫面，遠不如打怪模式的華麗擊殺動畫，玩家感受落差大。
**改了什麼**：`PartyBattleRoom.jsx` `pending_confirm` 區段：
- 加入 `pbr-die-*` CSS keyframes（怪物變黑白+發光 → 討伐印章彈出 → 討伐成功文字 → 戰績統計）
- 使用 `PartyMonsterImg` 顯示怪物大圖 + 擊殺濾鏡動畫
- 新增「討伐」印章 overlay（旋轉彈入，半透明黑底紅字）
- 新增戰績統計三欄：最終傷害 / 回合數 / 參戰人數
- 確認按鈕加入金色發光陰影 `boxShadow` 和進場動畫
- `disabled` 狀態補上 `pointerEvents: none` 防止雙擊
**踩坑提醒**：`pbr-die-*` 前綴避免與打怪模式的 `mb-*` 動畫命名衝突。

### 地下城怪物 HP 條統一
**為什麼**：地下城的 HP 條高度（16px）與打怪/組隊（21px）不一致，邊框顏色也不同。
**改了什麼**：`DungeonBattleRoom.jsx`：`height: 16` → `height: 21`、邊框統一 `1.5px solid #7f1d1d`、背景 `#1e293b`、圓角 20。

### 世界王 CatMsg 改用共享元件
**為什麼**：`WorldBossAttack.jsx` 自定義了一個 `CatMsg` 本地元件，與 `cat/CatMsg` 共享元件功能相同但樣式不同。
**改了什麼**：
- 移除本地 `CatMsg` 函式定義
- 加入 `import CatMsg from "../cat/CatMsg"` 使用共享元件

### 世界王加入貓咪回合視覺覆蓋（CatRoundOverlay）

---

## 2026-06-26（SharedBattleComponents 共用元件庫 — HP條/箭槽/分數按鈕/狀態標籤）

### 建立共用元件庫
**為什麼**：MonsterBattle、PartyBattleRoom、DungeonBattleRoom、WorldBossAttack 四個戰鬥模式各自實作了怪物 HP 條、箭槽、分數按鈕、狀態標籤，程式碼高度重複（每組約 20~40 行），且樣式細節有微小差異。
**改了什麼**：
- 新增 `src/components/shared/SharedBattleComponents.jsx`，包含 4 個元件：
  - **`BattleHPBar`** — 怪物 HP 條（支援 height/21px、showBorder、label、compact 模式）
  - **`BattleArrowSlots`** — 箭槽顯示（支援 slotSize/26~36px、highlightNext、processing 箭號高亮、extraContent 自訂按鈕）
  - **`BattleScoreButtons`** — 分數按鈕（支援三種 variant：`image`/`minimal`/`tailwind`，btnSize）
  - **`BattleStatusTags`** — 狀態標籤列（支援自訂 tags 陣列）
- 修改 4 個檔案導入共用元件：
  - `MonsterBattle.jsx` — HP條→BattleHPBar，狀態標籤→BattleStatusTags，箭槽→BattleArrowSlots，分數按鈕→BattleScoreButtons
  - `PartyBattleRoom.jsx` — 同上
  - `DungeonBattleRoom.jsx` — 同上（分數按鈕使用 tailwind variant）
  - `WorldBossAttack.jsx` — HP條→BattleHPBar(compact模式)，箭槽→BattleArrowSlots，分數按鈕→BattleScoreButtons
**踩坑提醒**：
- WorldBossAttack 箭槽需要傳 `processingIdx` 才能正確顯示逐箭處理動畫
- tailwind variant 的分數按鈕直接用 `SCORE_COLORS` class 陣列，以保持 DungeonBattleRoom 現有風格
- import 路徑 `../shared/SharedBattleComponents` — 注意是從各戰鬥模式的目錄相對路徑

### 世界王加入貓咪回合視覺覆蓋（CatRoundOverlay）
**為什麼**：世界王有貓貓每回合攻擊輸出，但完全沒有視覺回饋。
**改了什麼**：`WorldBossAttack.jsx`：
- 加入 `import CatRoundOverlay` 和狀態變數（`showCatRound`、`catRoundCats`、`catRoundTotalDmg`）
- 戰鬥階段 JSX 中渲染 `<CatRoundOverlay>`
- 貓貓攻擊後設定 overlay 資料並顯示 1800ms

---

## 2026-06-26（結算畫面共用元件 — BattleResultHeader/StatCard/StatRow/RewardItem）

### 新增結算畫面共用元件
**為什麼**：4 個戰鬥模式的結算畫面各自實作，標題區塊、統計卡片、獎勵列表的視覺風格不一致。
**改了什麼**：
- `SharedBattleComponents.jsx` 新增：
  - **`BattleResultHeader`** — 結果標題（emoji + title + subtitle，5 種主題色，內嵌 result-pop 動畫）
  - **`BattleStatCard`** — 卡片式統計（icon + label + value，支援 highlight）
  - **`BattleStatRow`** — 列式統計（icon + label + value，支援 borderTop）
  - **`BattleRewardItem`** — 獎勵品項（icon + name + desc + tier badge）
- 修改 4 個戰鬥模式：
  - `MonsterBattle.jsx` — 戰績統計區 → `BattleStatCard`
  - `PartyBattleRoom.jsx` — 結算標題 → `BattleResultHeader`
  - `WorldBossAttack.jsx` — 標題/戰鬥報告/獎勵 → `BattleResultHeader` + `BattleStatRow`
  - `DuelRoom.jsx` — 結果大字/個人統計 → `BattleResultHeader` + `BattleStatCard`
**踩坑提醒**：`result-pop` keyframe 內嵌在共用元件；DungeonBattleRoom 因即將大更新暫跳過。

---

## 2026-06-26（第 4~5 輪：總射箭里程 + 首頁重整 + 教練射手模式統一 + 全部遺漏修復）

### 總射箭里程系統
**為什麼**：首頁等級卡缺少長期成長回饋，射手想知道自己總共射了多少箭。
**改了什麼**：
- `db.js`：`addPracticeLog` 自動累計 `totalArrowsAllTime`（increment）
- `MemberHome.jsx`：等級卡新增「🏹 總射箭里程」里程碑進度條（100→500→1000→5000→10000→50000 箭）

### 首頁重整 Part 1：徽章精簡 + 貓貓等級加入
**為什麼**：首頁與「我的」重複區塊過多；射手等級卡沒有貓貓資訊。
**改了什麼**：
- `MemberHome.jsx`：
  - 射手狀態卡徽章三色從完整展開（3 行）改為一行「🐱 ⭐ 🏆」總數摘要
  - 等級卡加入完整貓夥伴資訊（頭像/名稱/類型/等級XP/羈絆/技能群組/裝備加成）
  - 清理未使用的 `BadgePip` import

### 教練射手模式統一（AdminApp archerMode）
**為什麼**：教練切換射手模式時，介面仍用固定深藍色 Header，缺少報到視窗、主題色、今日箭數等。
**改了什麼**：
- `AdminApp.jsx`：
  - Import：加入 `subscribeTodayPracticeLogs / subscribeMyCheckin / submitCheckin`
  - 狀態：`todayArrowsGlobal / todayCheckin / showCheckinPopup / checkinBusy / checkinPopupShownRef`
  - Effects：報到訂閱（首次進入自動彈窗）+ 今日箭數訂閱
  - Header：從固定 `#1e3a5f` → `appTheme` 主題色（含 🪙💧🏹👤 資源列 + 返回後台按鈕）
  - 報到浮動視窗：與 MemberApp 完全一致
  - 底部導覽：加入 `appTheme.navActive / navIndicator` 顏色 + active 指示條
  - 補傳 `todayArrows={todayArrowsGlobal}` 給 MemberHome
**踩坑提醒**：handleCheckinSubmit 必須定義在 archerMode render 之前（已在元件層級定義）。

### 教練射手模式遺漏功能全部修復（11 項）
**為什麼**：比對 AdminApp 與 MemberApp，發現共 11 項功能不一致。
**改了什麼**：
1. **Header 射手等級** — 加入 `⚔️Lv.{archerLevelFromXP}`
2. **決鬥 reconnect banner** — 離開決鬥時顯示「⚔️ 決鬥進行中 — 點此回到戰場」
3. **地下城 reconnect banner** — 同上，🏰 地下城
4. **決鬥/地下城 sessionStorage 重整恢復** — `admin_duel_room` / `admin_dungeon_room`
5. **MonsterBattle props** — 補傳 `monsterDex/craftStats/chestStats/potionDex/duelStats`
6. **CatCollection onOpenForge** — 可從貓收藏跳到鍛造
7. **CatVillage initialTab+key** — 鍛造連結可直接定位
8. **版本更新提醒** — `subscribeAppVersion` + `needsUpdate` 彈窗
9. **CompDetail 報名偵測** — 用 `isMemberRegistered` 確認報名
10. **組隊 reconnect 顏色** — 改為 `appTheme.partyBg`
11. **地下城 → DungeonController** — 支援地圖探索模式
**踩坑提醒**：`DungeonController` 是 `DungeonBattleRoom` 的包裝層（含地圖探索路由），需同步替換 `DungeonBattleRoom` import。

### 首頁重整 Part 2：年度檢定精簡
**為什麼**：首頁與「我的」都顯示完整三欄檢定卡片，重複且佔空間。
**改了什麼**：
- `MemberHome.jsx`：年度檢定從 3 欄完整卡片（含背景圖/等級樣式/分數）→ 單行弓種摘要（弓種·分數·等級標籤） + 「查看詳細 →」導向 profile 頁面
- 清理未使用的 `CERT_BG` 常數
**踩坑提醒**：`onPageChange("profile")` 導向的是 MemberProfile，該頁有完整歷年檢定（含展開收合）。

### 首頁重整 Part 3：「我的」快捷連結重新排列
**為什麼**：原分組過多零散（5 組），部分組只有 1 個連結，視覺碎片化。
**改了什麼**：
- `MemberProfile.jsx`：quickLinkGroups 從 5 組 → 3 組：
  - 📌 **常用功能**：學習紀錄・成績歷史・訊息中心（最常用的 3 個）
  - 🎖️ **檢定與申報**：射手證考試・對外比賽
  - ✉️ **溝通與設定**：留言教練・我的弓具・使用說明
- 所有 8 個連結保留，3 欄網格剛好裝滿

### 其他小型修復
- `AdminApp.jsx`：`ADMIN_INVENTORY` 補上 `"gacha"`（與 MemberApp 的 `INVENTORY_PAGES` 一致）

---

### 打怪模式不再掉落徽章碎片與貓貓箱
**為什麼**：36 隻怪物打怪後給徽章碎片（frag_*）與貓貓箱（cat type chest）不符合設計方向。
**改了什麼**：`MonsterBattle.jsx`：
- `makeChests` 解構移除 `catChest`，不加入 mainChests
- 移除 catChest log 行
- `rollMaterialDrops` 結果 `.filter(m => !m.id?.startsWith("frag_"))` 過濾碎片
- 移除 `addFragments` 呼叫與 import
**踩坑提醒**：frags 已被獨立分出來（`mats.filter(frag_)`），直接在 rollMaterialDrops 後過濾更乾淨。

### 貓貓在決鬥模式（DuelRoom）傷害
**為什麼**：貓貓只存了名字，沒有真正參戰。
**改了什麼**：
- `duelDb.js` 新增 `calcCatDmg(catAtk, targetDef)` helper（6箭合算，0.5~2.0倍隨機）
- `applyPlayerCatToRoom` 加 `catAtk` 參數，存到 `team${team}.${memberId}.catAtk`
- `processDuelRound` 在 attacks 加總前插入貓貓攻擊段（effAliveA/B 各選目標，isCat:true）
- `DuelRoom.jsx`：從 hook 取 `catATK`，傳入 `applyPlayerCatToRoom`

### 貓貓在地下城模式（DungeonBattleRoom）傷害
**為什麼**：同上。
**改了什麼**：
- `dungeonDb.js` 新增 `calcCatDmg` helper
- `updateDungeonMemberStats` 加 `catAtk` 參數，存到 `members.${memberId}.catAtk`
- `processDungeonRound` Step 3 結束後插入「貓貓攻擊」mini round（isCat:true）
- `DungeonLobby.jsx`：import `useCatCompanion`，取 `myCatATK`，傳入兩個 updateDungeonMemberStats 呼叫

### 村莊累積生產模型（T2 → T1+T2 同時產出）
**為什麼**：高等建築應同時產出低階材料，方便玩家管理資源，升級更有感。
**改了什麼**：
- `villageData.js` `calcPendingResources`：tiered 資源改為 loop tier 1~maxTier，各自以同速率計算
- `db.js` `collectVillageResources`：同樣邏輯，非分層資源（箭露/射手等）維持原邏輯
**踩坑提醒**：non-tiered 資源（arrowdew、archer、gachaToken）不進 loop，避免 fracKey 衝突。

### 市集重設計（6 種族材料包 + 藥水箱 + 怪物卡包 + 黃金寶箱）
**為什麼**：原本 4 種通用寶箱不夠明確，玩家無法選擇要哪族材料。
**改了什麼**：
- `CatVillage.jsx` `BATTLE_EXCHANGE`：6 族材料包（ghost/mountain/exam/insect/workplace/temple）各消耗對應建築 T1 資源 ×30，加藥水箱/卡包/黃金寶箱
- `doBattleExchange` 加 `family` 參數，傳入 `exchangeMaterialsForChest`
- `db.js` `exchangeMaterialsForChest` 加 `family` 可選參數，加入寶箱 object
**踩坑提醒**：`gotThis` key 改為 `type + family`（否則不同族包 justGot 無法區分）。

---

## 2026-06-25（貓貓等級+裝備+技能系統）

### 舊 catStatMult 被動加成移除（設計簡化）
**為什麼**：TYPE × 羈絆等級的被動加成（射手 ATK/DEF 百分比）與新的 ID 群組主動技能重疊，且 catStatMult 雖有計算但從未真正套用到戰鬥傷害。簡化為「TYPE 只決定基礎 ATK 倍率，羈絆等級只影響技能觸發機率與效果幅度」。
**改了什麼**：
- `catData.js` CAT_TYPES skills 全部改為搞笑貓咪行為敘事（無任何數字加成）
- `useCatCompanion.js` 移除 `getCatStatMult` import 和 `catStatMult` return
- `DungeonBattleRoom.jsx`：移除 catStatMult，光環顯示改為「陪戰中」
- `DuelRoom.jsx`：`applyPlayerCatToRoom` 固定傳 1.0
- `PartyBattleRoom.jsx`：`getArcherStats` catStatMult 參數全換成 1.0
**踩坑提醒**：catData.js 的 `getCatStatMult` / `getCatBattleBonus` 函式保留（以防 UI 有用），但已不被 hook 呼叫。

### 貓貓等級 / 裝備 / 技能 三系統實作
**為什麼**：從輔助型升為「真正陪伴玩家的戰鬥夥伴」，與射手等級系統平行。

**改了什麼**：
- `src/lib/catLevel.js`（新）：200級、XP公式與射手相同，`CAT_TIER_XP` 戰鬥後給 XP
- `catData.js` 新增：`CAT_SKILL_GROUPS`（前三補血/中三攻擊/後三防禦）、`CAT_EQUIP_SLOTS`（5格）、`calcCatEquipBonus`、`calcForgeCost`、`calcCatSkillChance/Effect`
- `catDb.js` 新增：`addCatXP`、`upgradeCatEquip`（同步 equippedCat 快取）；`equipCat` 更新同步 `catXP+equip`
- `useCatCompanion.js` 重寫：戰鬥數值整合等級+裝備加成；新增 `triggerCatSkill()`、`saveXP()`
- `MonsterBattle.jsx`：
  - ATK技能：貓咪攻擊後追加 XX%~翻倍傷害
  - HEAL技能：回復射手 HP
  - DEF技能：`catDefShieldRef` 保護下回合計數器攻擊（減傷/完全格擋）
  - 勝利後呼叫 `saveXP(CAT_TIER_XP[monster.tier])`
- `CatVillage.jsx` 新增「🔨 鍛造」TAB：`ForgePanel` 顯示 5 格裝備、費用（村莊材料）、升強化/升階按鈕

**踩坑提醒**：
- 計數器攻擊用 `let cdmg` 才能被貓盾修改（原本是 const）
- `equippedCat.equip` 可能是 `undefined`（舊資料），預設 `{}` → 所有格位視為「普通 +0」
- `calcForgeCost` 回傳 null 代表已達神話+5（極限）

---

## 2026-06-25

### 報到系統改為教練審核制（刪除日常任務）
**為什麼**：舊系統讓學生自己做任務（三選一），太複雜且難以管理；新流程改為教練手動確認出席。
**改了什麼**：
- `db.js`：`submitCheckin` 改建 `pending`；新增 `approveCheckin`/`rejectCheckin`；`subscribePendingCheckins` 加 `pending` filter
- `DailyQuest.jsx`：**完整重寫**，移除任務/施法/Buff，改為 pending/rejected/active/classEnded 狀態顯示 + 下課按鈕
- `MemberApp.jsx`：新增浮動報到視窗（`sessionStorage("checkin_popup_shown")` 防本 session 重複彈）
- `AdminDailyQuest.jsx`：「待施法」→「待審核」，通過/不通過按鈕；inProgress 改用 `!classEnded` 判斷；done 改用 `classEnded` 判斷
**踩坑提醒**：舊 `done` 是 `questDone`，新 `done` 是 `classEnded`。歷史資料的 `questDone` 欄位不影響新邏輯（篩掉了）。

### 修復：下課後不再觸發里程碑 popup
**為什麼**：下課時已結算箭露，若再去練習還會觸發里程碑，導致重複獎勵。
**改了什麼**：`MemberPractice.jsx` 加 `classEndedRef`（useRef）+ `subscribeMyCheckin` 訂閱；saveRound 前檢查 `!classEndedRef.current`。
**踩坑提醒**：用 useRef 而非 useState，避免訂閱更新觸發不必要的重新渲染。

### 首頁射手等級 widget 擴展
**為什麼**：玩家需要在首頁快速看到自己的完整數值與資源狀況。
**改了什麼**：`MemberHome.jsx` 新增 `calcEquippedBonus/calcArcherStats/archerLevelBonus` import；widget 顯示實際 HP/ATK/DEF（三層加成相加）；新增資源列（金幣/箭露/轉蛋幣/今日箭數）。
**踩坑提醒**：`calcArcherStats` 需要 `dexStats`，而 `computeDexStats` 在同一元件已有呼叫，直接複用即可。

### 修復：怪物卡片效果在選擇畫面不顯示
**為什麼**：原本 `cardCollRef`（useRef）不觸發重新渲染，選擇畫面讀到的永遠是初始空值。
**改了什麼**：`MonsterBattle.jsx` 改成 `useState + useRef` 雙軌——`useState` 給渲染用，`useRef` 給 `startBattle` 異步函式同步讀取。
**踩坑提醒**：這是 React closure stale 問題的標準解法，其他元件若有同樣情境可參考此模式。

---

## 2026-06-22（前次 session）

### 效能優化（3 個函式）
**為什麼**：買裝備/升級裝備/申請月卡 UI 卡住，因為有多次串行 Firestore getDoc 讀取。
- `upgradeEquipSlot`：5 次 ops → 2 次平行（接受 clientData，不需 getDoc）
- `submitMonthlyCardRequest`：移除 getDocs/getDoc，接受 `clientCard/hasPending`
- `MemberApp` practice logs：改用 `subscribeTodayPracticeLogs`（只讀今日）
- `MemberHome`：`useState(false)` 移除阻塞 spinner
**設計依據**：CLAUDE.md 規則「優先瀏覽器計算，不需防作弊」

### 射手等級系統（新檔案 archerLevel.js）
**為什麼**：讓射箭練習有長期成長感，各戰鬥模式都需要回饋。
**改了什麼**：新增 `archerLevel.js`；5 種戰鬥模式加 `addArcherXP`；4 處顯示等級（Header/MemberHome/MonsterBattle選擇/MemberProfile）。
**踩坑提醒**：Header 顯示的是 Lv.X，首頁 widget 顯示的是完整 HP/ATK/DEF（三層加成）。

### 組隊打怪靶紙選擇器修復
**為什麼**：`TargetFmtPicker` 出現在戰鬥每一回合，應只在設定時選一次。
**改了什麼**：`PartyBattleRoom.jsx` 移除戰鬥階段的 `TargetFmtPicker` block。
