# AdminBattleTest.jsx 分析報告 — 下一代戰鬥 UI 引擎

> 撰寫人：Buffy (FREEBUFF AI Agent)  
> 用途：提供 CLAUDE 完整理解這個檔案的架構與改造建議

---

## 一、定位認知

`src/components/admin/AdminBattleTest.jsx` 不是後台測試工具，而是**全新的統一戰鬥介面系統**，最終目標是取代現有的：

- `MonsterBattle.jsx`（單人打怪）
- `PartyBattleRoom.jsx`（組隊打怪）
- `DungeonBattleRoom.jsx`（地下城戰鬥）
- `WorldBossAttack.jsx`（世界王戰鬥）

目前它是一個**獨立單頁元件**（~2116 行），用 `useReducer` 管理完整的戰鬥狀態機，包含從進場動畫到勝/敗結算的完整流程。

---

## 二、現有架構

### Phase 狀態機

```
IDLE → INTRO → PLAYING → SCORING → PROCESSING → ROUND_RES → VICTORY_ANIM → WON
                                                              ↘ LOST
```

| Phase | 做的事 |
|-------|--------|
| IDLE | 設定畫面，選怪物/難度/貓貓 |
| INTRO | VS 進場動畫（2.5 秒自動跳 PLAYING） |
| PLAYING | 等待玩家按「射擊」進入計分 |
| SCORING | 計分覆蓋層（鍵盤/靶面），6 箭全滿→「送出」才提交 |
| PROCESSING | 逐箭動畫（飛行音→命中浮字→扣血）+ 貓貓協戰 + 反擊，animStep 狀態機 |
| ROUND_RES | 回合結算面板（傷害/爆擊/反擊數字）+「下一回合」 |
| VICTORY_ANIM | 擊倒動畫（3 秒後自動轉 WON） |
| WON / LOST | 勝/敗覆蓋層 |

### Reducer Action

```
START          → 初始化戰鬥（設定怪物/難度，進 INTRO）
START_SCORING  → 進 SCORING
SCORE_ARROW    → 記錄一箭（不結算）
UNDO_ARROW     → 刪除上一箭
SUBMIT_ROUND   → 提交 6 箭，進 PROCESSING（算反擊但不扣血）
HIT_MONSTER    → 逐箭扣怪物 HP
MONSTER_DIED   → 怪物 HP=0，進 VICTORY_ANIM
APPLY_COUNTER  → 反擊步驟扣玩家 HP
CARRY_BUFF     → 藥水效果（ATK/DEF/回血/護盾）
THROW_DMG      → 投擲藥水傷害
DEBUFF_MONSTER → 削弱怪物
HEAL           → 回血
START_PLAYING  → INTRO→PLAYING
SHOW_WON       → VICTORY_ANIM→WON
NEXT_PHASE     → PROCESSING→ROUND_RES
NEXT_ROUND     → 下一回合
RESET          → 回到 IDLE
```

### 動畫系統

- `animStep` 狀態機（-1~9）：`useEffect` + `async/await` + `delay(ms)` 序列執行
- `cancelled` flag + cleanup：防止 StrictMode 疊加非同步序列
- 每個步驟有對應的 playBattleSound 呼叫（已整合 battleSound.js）

### 關鍵 UI 元件

| 元件 | 位置 | 說明 |
|------|------|------|
| VS 進場 | isIntro | 射手+貓貓左進場、怪物右進場、VS 中央放大、貓貓粒子特效+戰吼 |
| 怪物顯示 | 右上 | HP bar、等級、家族色 |
| 玩家卡 | 左下 | HP bar、ATK/DEF 數值、貓貓夥伴頭像、裝備卡稱號外框色 |
| 隊友格 | 左下（玩家卡上方） | 前/後衛標示、攻擊演出（crit金框/miss暗掉）、HP bar |
| 計分覆蓋層 | isScoring | 數字鍵盤 4×3 或靶面、6 箭進度格、⌫刪除 / 🏹送出 |
| 藥水面板 | isPlaying | carry/throw 雙分頁 |
| 回合結算 | isRoundRes | 傷害/爆擊/反擊數字、「下一回合」按鈕 |
| 勝利/敗北 | isWon/isLost | 全螢幕 overlay |
| 訊息列 | 左上 | 戰鬥紀錄、藥水使用提示 |
| 傷害浮字 | PROCESSING | 怪物身上浮動「-傷害」，爆擊金色+全螢幕閃光 |

---

## 三、哪些是寫死的，需要外部化

### 玩家資料（寫死在常數）

```js
const SELF = { catId:"diandian", name:"顛顛", lv:42, atk:275, def:165, hp:3180, maxHp:3180 };
```

需要改成從 props 接收真實玩家資料（來自 `useAuth` 或 `profile`）。

### 怪物清單（寫死 6 隻）

```js
const PICKED_IDS = ["ghost_6","mountain_5","insect_5","temple_6","workplace_6","exam_6"];
const MONSTERS = PICKED_IDS.map(id => getRealMonster(id));
```

需要改成接收外部傳入的怪物物件。

### 隊友假資料

```js
const MATE_DATA = [/* 8 個寫死隊友 */];
```

組隊模式需要從房間成員（Firestore）動態產生。

### 藥水清單

```js
const TEST_POTIONS = [/* 寫死 17 種藥水 */];
```

需要改成接收真實庫存（從 `potionInventory` 集合）。

### 難度倍率

```js
const DIFF_MULTS = ["normal","hard","nightmare"];
```

需要改成接收真實難度參數。

### 裝備卡稱號框架

```js
const FRAME_TIERS = { none, rare, epic, worldboss };
```

這是模擬世界王卡稱號的外框效果。正式使用需接真實裝備資料。

### 回合特殊事件

```js
const ROUND_EVENTS = [/* 5 種寫死事件 */];
```

這是模擬用，正式版可能需要從 dungeonData 或其他來源讀取。

### 貓貓資料

目前用 `calcCatCombatStats()` 真實計算中高等級貓貓資料（`catXP: 5000, bond: 50`），這是對的。但寫死了等級和羈絆值，需要改成接收真實貓貓資料。

---

## 四、與現有戰鬥系統的關鍵整合點

### 4.1 傷害公式 ✅ 已用正式

```js
import { calcStandardArrowDmg, calcStandardCounter } from "../../lib/damage";
```

傷害公式已經使用正式的 `damage.js`，與現有戰鬥系統一致。這部分不用改。

### 4.2 怪物資料 ✅ 已用正式

```js
import { MONSTERS as ALL_MONSTERS, resolveHitPart, BODY_PARTS } from "../../lib/monsterData";
```

使用真實怪物資料，殭屍靶部位系統也接對了。

### 4.3 貓貓技能 ✅ 已用正式

```js
import { calcCatSkillChance, calcCatSkillEffect } from "../../lib/catData";
import { calcCatCombatStats } from "../../lib/catCombat";
```

貓貓技能判定和效果使用正式函式。

### 4.4 藥水系統 ⚠️ 藥水資料正確但庫存寫死

藥水使用的 `POTIONS` 來自正式 `itemData.js`，效果計算也正確。但庫存是寫死的測試資料。

### 4.5 RoundController / BattleEngine ❌ 未整合

目前動畫序列是自己寫的 `async/await`，沒有用 `RoundController.js` / `useBattleRound.js` / `useMiniRoundReveal.js` 這套正式的事件播放系統。

這對單人測試來說沒問題，但要支援：
- 組隊多人同步：需要 `useFirestoreRound`
- 地下城合約效果：需要 `processDungeonRound`
- 世界王特殊規則：需要 `processWorldBossRound`

### 4.6 裝備/卡片加成 ❌ 未整合

目前 ATK/DEF 寫死，沒有接 `calcArcherStats` + `calcEquippedBonus`。

### 4.7 battleSound.js ✅ 已整合

10 個音效呼叫點全部使用 `playBattleSound()`，BattleSoundIndicator 也已掛載。

---

## 五、改造建議（給 CLAUDE 參考）

### 方案 A：逐步替換（低風險）

不直接重寫，而是：

1. **抽共用戰鬥元件**：把 AdminBattleTest 的 phase 系統和 UI 包裝成一個 `BattleScreen` 元件
2. **MonsterBattle 先接**：MonsterBattle 保留原本的選怪/設定邏輯，但戰鬥畫面改成用 `BattleScreen`
3. **逐步擴充**：接完單人後再接 party/dungeon/worldboss 模式

### 方案 B：從 AdminBattleTest 抽成通用元件

把 AdminBattleTest 的 UI/動畫邏輯抽成 props-driven 元件：

```
BattleScreen (props-driven)
├── phase 狀態機（reducer）
├── VS Intro 動畫
├── 怪物顯示（右上）
├── 玩家卡（左下）+ 貓貓
├── 隊友格
├── 計分面板（SCORING）
├── 藥水面板
├── 戰鬥動畫（PROCESSING）
├── 回合結算（ROUND_RES）
├── 擊倒動畫（VICTORY_ANIM）
├── 勝利/敗北（WON/LOST）
└── BattleSoundIndicator
```

Props 設計：

```js
<BattleScreen
  mode="single" | "party" | "dungeon" | "worldboss"
  player={playerData}
  monster={monsterData}
  allies={allyData[]}
  battleMode="score" | "zombie"
  cat={selectedCat}
  potions={potionInventory}
  bowType={bowType}
  onRoundSubmit={(arrows) => ...}     // 送出 6 箭
  onBattleEnd={(result) => ...}       // won 或 lost
/>
```

### 優先順序建議

1. **先抽 BattleScreen 元件**：把 phase/UI 從 AdminBattleTest 搬到共用元件
2. **MonsterBattle 先接**：最單純的單人模式，驗證 props 夠用
3. **然後依序接 Party → Dungeon → WorldBoss**
4. **最後補欠缺的功能**：裝備加成、真實藥水庫存、多人同步

---

## 六、已知限制

1. **沒有 Firestore 回合同步**：多人模式需要 `useFirestoreRound`
2. **裝備/卡片加成未整合**：ATK/DEF 沒有接真實角色數值
3. **藥水庫存寫死**：需要改從 `potionInventory` 讀取
4. **沒有地下城合約**：特殊計分規則（hit_count、score_gate 等）尚未實作
5. **組隊隊友是假資料**：沒有從房間成員動態產生
6. **動畫時序寫死**：沒有用 `RoundController` 的 `customDelays` 系統

---

## ⚠️ 七、落地前必讀（Claude 補充 2026-07-12）

> 這份分析大方向正確，但漏了下列 4 點，落地前務必先處理／先讀 `battle-ui-redesign.md` 交接章節，否則會跟已定案的設計打架。

### 1. 前後衛新模型（最重要，本分析完全沒提）
使用者已拍板：**組隊 + 組隊地下城統一採用新前後衛模型**，落地時不能照舊模型做。規格全文見 `battle-ui-redesign.md` 交接章節 A/B/C，重點：
- **開場全員前衛**，**取消等待室「選前/後衛」步驟**、**取消前衛 4 人上限**。
- **第一次陣亡 → 自動復活符回 50% HP → 轉後衛**（此後只做 heal/assist、不直接輸出）；**後衛再死＝真死**。
- **存活前衛歸零（全員都倒過一次）＝全體判輸**。
- UI 橘/藍框＝**狀態顯示**（橘＝未倒過的前衛、藍＝倒過的後衛），**不是選擇**。
- 牽動 `src/lib/dungeonDb.js`：line ~97（4 人上限移除）、~279（選角函式廢除）、~613（判輸），及等待室 UI 拿掉選角。**目前尚未實作。**

### 2. 舊版不並存，改「備存」策略
使用者決定：**不做新舊切換並存**，而是落地覆蓋前，先把要被取代的舊戰鬥元件（`MonsterBattle.jsx` / `PartyBattleRoom.jsx` / `DungeonBattleRoom.jsx` / `WorldBossAttack.jsx`）**另存備份**（例如複製成 `*.legacy.jsx` 或獨立 commit tag），確保線上出問題時能快速換回，再動手改。→ 落地每一個模式前，先確認該模式的舊檔已有備份。

### 3. 逐箭扣血要「串所有人的箭、以伺服器權威 HP 為準」
第 4.5 節正確標記 RoundController 未整合。補充：組隊/地下城/世界王落地時，逐箭扣血**不是各扣各的**——要串所有隊友的箭、依命中順序逐一扣王血，**以伺服器權威 HP 為準**（交接章節 D）。目前 `HIT_MONSTER` 只是單人骨架，多人要接 `useFirestoreRound`。

### 4. CRA eslint 坑（抽元件時很容易踩）
本專案在 CRA 下，加 `// eslint-disable-next-line react-hooks/exhaustive-deps` 會變成**編譯錯誤**（不是警告），別加。抽 `BattleScreen` 拆 useEffect 依賴時要特別注意。
