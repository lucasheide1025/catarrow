# BattleScreen 抽取計畫（給 CLAUDE 審查）

> ⚠️ 在動手寫 code 之前，先確認這份 plan 的方向正確。

---

## 背景

`AdminBattleTest.jsx`（~2116 行）是下一代統一戰鬥 UI 的原型，包含：

- **完整的 9-phase 戰鬥狀態機**（IDLE→INTRO→PLAYING→SCORING→PROCESSING→ROUND_RES→VICTORY_ANIM→WON/LOST）
- **VS 進場動畫**（射手 + 貓貓彈入、粒子特效、戰吼）
- **雙計分模式**（數字鍵盤 / 靶面點擊）
- **逐箭動畫序列**（飛行音→命中浮字→爆擊閃光→怪物震動）
- **貓貓協戰系統**（技能判定 + 反擊傷害 + 治療/追加/減傷）
- **怪物反擊動畫**（反擊面板 + 玩家 hurt 動畫）
- **藥水面板**（carry/throw 雙分頁）
- **組隊視覺**（隊友格 + 攻擊演出 crit/normal/miss）
- **勝利/敗北覆蓋層**
- **battleSound.js 已整合**

### 目標

把 AdminBattleTest.jsx 抽成一個 props-driven 的 `BattleScreen` 共用元件，然後先接入 `MonsterBattle.jsx`（單人打怪）。

---

## Props 介面設計

```jsx
<BattleScreen
  // ── 必要資料 ──
  player={playerData}        // { id, name, atk, def, hp, maxHp, catId?, catName? }
  monster={monsterData}      // { id, name, family, hp, atk, def, tier, icon? }
  
  // ── 戰鬥設定 ──
  battleMode="score"|"zombie"
  scoreInput="keypad"|"target"
  difficulty={{ hp:1.0, atk:1.0, def:1.0 }}
  
  // ── 選填資料 ──
  allies={[]}                // 隊友陣列（單人傳空陣列）
  cat={catData|null}         // { catId, catName, catXP, bond, type } | null
  potions={potionInventory}  // 藥水庫存
  cardFrame="none"           // 裝備卡稱號外框色
  
  // ── 回呼 ──
  onRoundSubmit={(arrows, skipCounter, counterReduce) => Promise}
  // 接收 6 箭資料，回傳 { ok, monsterHpAfter, playerHpAfter, counterDmg, won, lost }
  // 若是 Firestore 模式，此處接 useFirestoreRound 的 submit
  // 若是本地模擬，此處就地算傷害
  
  onBattleEnd={(result) => void}
  // result: "won" | "lost" | "disconnected"
  
  onPotionUsed={(potionId) => void}
  // 通知外部扣除藥水庫存
/>
```

### 資料結構

```typescript
interface PlayerData {
  id: string;
  name: string;
  lv?: number;
  atk: number;
  def: number;
  hp: number;
  maxHp: number;
  catId?: string;      // 頭像
  catName?: string;    // 貓貓夥伴（顯示在玩家卡右側）
  cardFrame?: string;  // 玩家卡外框色
}

interface MonsterData {
  id: string;
  name: string;
  family: string;
  hp: number;
  atk: number;
  def: number;
  tier: number | string;
  icon?: string;
}

interface AllyData {
  id: string;
  name: string;
  catId: string;
  atk: number;
  def: number;
  hp: number;
  maxHp: number;
  role: "front" | "rear";
  ready: boolean;
  alive: boolean;
}

interface ArrowData {
  score: number | string;  // "X" | "10".."1" | "M"
  dmg: number;
  isCrit: boolean;
  part?: {                // 殭屍靶用
    id: string;
    icon: string;
    name: string;
    mult: number;
  };
  nx?: number;             // 靶面座標
  ny?: number;
  faceIndex?: number;
  targetFormat?: string;
}
```

---

## 抽取步驟

### Step 1: 建立 BattleScreen 元件

新增 `src/components/battle/BattleScreen.jsx`：

1. 從 AdminBattleTest.jsx 複製 reducer、phase 常數、動畫系統、UI
2. 移除以下「測試專用」的寫死資料：
   - `SELF` 常數 → 改成 props.player
   - `MONSTERS` 常數 → 改成 props.monster
   - `MATE_DATA` 常數 → 改成 props.allies
   - `TEST_POTIONS` 常數 → 改成 props.potions
   - `DIFF_MULTS` 常數 → 改成 props.difficulty
   - `FRAME_TIERS` 常數 → 改成 props.cardFrame
3. 保留以下「共用邏輯」：
   - `battleReducer` 狀態機（9 phase）
   - `animStep` 動畫序列（async/await）
   - `computeUnlocked`（殭屍靶部位解鎖）
   - `TargetFace` 靶面 SVG
   - 貓貓協戰邏輯（calcCatSkillChance / calcCatSkillEffect）
   - 所有 animation keyframes
4. 修改 `handleSubmit` → 呼叫 `props.onRoundSubmit` 而非直接 dispatch SUBMIT_ROUND
5. 修改 `handlePotionUsed` → 呼叫 `props.onPotionUsed`
6. 勝利/敗北時呼叫 `props.onBattleEnd`

### Step 2: 修改 AdminBattleTest.jsx

保持現狀，但改成使用 BattleScreen 元件：

```jsx
// AdminBattleTest.jsx 簡化成：
function AdminBattleTest() {
  // ...保留控制面板、怪物選擇、難度選擇...
  return (
    <>
      <BattleScreen
        player={SELF}
        monster={MONSTERS[mIdx]}
        difficulty={DIFF_MULTS[dIdx]}
        battleMode={battleMode}
        scoreInput={scoreInput}
        allies={team}
        cat={selectedCat ? { ... } : null}
        potions={TEST_POTIONS}
        cardFrame={cardFrame}
        onRoundSubmit={async (arrows) => {
          // 本地模擬：就地算傷害、反擊
          // 這是目前的 SUBMIT_ROUND + HIT_MONSTER + APPLY_COUNTER 邏輯
        }}
        onBattleEnd={(result) => { /* 記錄 */ }}
      />
      {/* 控制面板 */}
    </>
  );
}
```

### Step 3: 接入 MonsterBattle.jsx

MonsterBattle 保持：
- 選怪/選難度邏輯 ✅
- Firestore 回合同步（useFirestoreRound）✅
- 藥水庫存管理 ✅
- 裝備/卡片加成 ✅
- 訪客模式 ✅

MonsterBattle 的戰鬥畫面改用 BattleScreen：

```jsx
// MonsterBattle.jsx 的戰鬥階段
<BattleScreen
  player={{
    id: myId,
    name: profile?.name,
    atk: playerStats.atk,
    def: playerStats.def,
    hp: playerStats.hp,
    maxHp: playerStats.maxHp,
    catId: catId,
    catName: hasCat ? catName : undefined,
  }}
  monster={{
    id: monster.id,
    name: monster.name,
    family: monster.family,
    hp: monster.hp,
    atk: monster.atk,
    def: monster.def,
    tier: monster.tier,
  }}
  battleMode={targetMode === "zombie" ? "zombie" : "score"}
  scoreInput={targetMode ? "target" : "keypad"}
  allies={[]} // 單人模式為空
  cat={hasCat ? { catId, catName, catXP, bond, type: catType } : null}
  potions={potionInventory}
  onRoundSubmit={async (arrows, skipCounter, counterReduce) => {
    // 呼叫 fsHandleSubmit(arrows, role, rearChoice) →
    // 讓 Firestore 處理回合
    // 回傳最新的 monsterHP / playerHP / counterDmg
  }}
  onPotionUsed={(potionId) => {
    // 扣除庫存
    usePotions(myId, [potionId]);
  }}
  onBattleEnd={(result) => {
    if (result === "won") playBattleSound("victory_cheer", {});
    if (result === "lost") playBattleSound("soft_fail", {});
  }}
/>
```

---

## 與 onRoundSubmit 的整合

這裡是最大困難點。BattleScreen 目前算傷害的方式是：

```
SUBMIT_ROUND → 本地用 calcStandardArrowDmg 算每箭傷害
HIT_MONSTER → 逐箭扣本地 monsterHp（動畫用）
APPLY_COUNTER → 算反擊、扣玩家 HP
```

但 **MonsterBattle 的真實流程是 Firestore 回合制**：

```
submitArrows() → 寫入 Firestore
processRound() → 伺服器算傷害、回寫 log
useMiniRoundReveal() → 從 log 播放動畫
```

**方案 A（推薦）：BattleScreen 專注 UI，不碰資料邏輯**

BattleScreen 的 `onRoundSubmit` 只做一件事：
1. 接收 6 箭資料
2. 交給外部處理（Firestore 或本地模擬）
3. 外部處理完後回傳「動畫資料」給 BattleScreen

動畫資料結構：
```js
{
  totalDmg: number,
  crits: number,
  counterDmg: number,
  monsterHpAfter: number,
  playerHpAfter: number,
  won: boolean,
  lost: boolean,
  arrowBreakdown: [{ dmg, isCrit, score, part? }],
  catDamage?: number,
  catHeal?: number,
}
```

這樣 BattleScreen 就不需要知道資料是來自 Firestore 還是本地計算。

**方案 B（更簡單）：BattleScreen 自己算動畫資料**

BattleScreen 保留 `calcStandardArrowDmg` / `calcStandardCounter`，`onRoundSubmit` 只做同步：
- 回傳目前的 `{ monsterHp, playerHp }` 讓 BattleScreen 做動畫
- 真正的資料寫入（Firestore）由外部自行處理

---

## 風險與注意

### 1. CRA eslint 限制

本專案下 `// eslint-disable-next-line react-hooks/exhaustive-deps` 會變成**編譯錯誤**。
抽取 reducer + useEffect 時，相依陣列一定要手動寫對。

### 2. MonsterBattle 的三種使用情境

| 情境 | 位置 | 傳入的 props |
|------|------|-------------|
| 正式會員 | MemberApp.jsx | `onBack`, `questContext`, `onKillForQuest`, `monsterDex`... |
| 教練射手模式 | AdminApp.jsx archer mode | 同上 |
| 訪客/兒童 | GuestApp.jsx | `isGuest`, `kidMode`, `guestProfile`, `onImmersiveChange` |

BattleScreen 的 props 設計要同時滿足這三種情境。

### 3. onImmersiveChange（訪客模式）

GuestApp.jsx 需要知道戰鬥何時進入全螢幕模式（隱藏 topbar + bottom nav）。
BattleScreen 需要提供 `isImmersive` 狀態或回呼。

### 4. 藥水庫存

AdminBattleTest 的藥水是「無限測試庫存」。
MonsterBattle 的藥水來自 Firestore `potionInventory`。
BattleScreen 只顯示藥水列表、觸發使用，不負責讀取庫存。

### 5. 保留哪些東西（不要砍）

- AdminBattleTest.jsx 保留作為「後台測試畫面」，改用 BattleScreen 元件
- 控制面板（怪物選擇/難度/人數/貓貓）保留在 AdminBattleTest
- 戰鬥畫面本體全部移到 BattleScreen

### 6. BattleScreen 不負責

- ❌ 不接 Firestore（只透過 onRoundSubmit 回呼）
- ❌ 不讀取藥水庫存（只透過 props.potions 接收）
- ❌ 不算裝備/卡片加成（由外部算好傳入 player stats）
- ❌ 不處理訪客模式邏輯（由外部判斷）

---

## 優先順序

```
Week 1: BattleScreen 元件抽取（src/components/battle/BattleScreen.jsx）
        → 不含修改任何現有檔案
        → 獨立驗證：AdminBattleTest 改用 BattleScreen 且功能不變

Week 2: MonsterBattle 接入
        → MonsterBattle 改 props，戰鬥畫面改 BattleScreen
        → 保留原有選怪/設定/結算邏輯
        → 先上 MemberApp，再上 AdminApp + GuestApp

Week 3: 穩定測試
        → 並存觀察
        → 確認無回歸
```

---

## CLAUDE 想確認的問題

1. **onRoundSubmit 的設計**：方案 A（純視覺，外部提供動畫資料）vs 方案 B（自含傷害計算，外部只做同步）— 哪個比較適合？

2. **Props 是否夠全面**：目前定義的 props 夠 cover MonsterBattle + PartyBattleRoom 嗎？還是要先預留一些將來組隊/地下城的欄位？

3. **MonsterBattle 是否該先簡化**：抽出 BattleScreen 之前，是否應該先把 MonsterBattle 減肥（例如把選怪/結算抽成子元件），降低接 BattleScreen 時的複雜度？

4. **AdminBattleTest 角色**：改成用 BattleScreen 之後，控制面板要不要保留？還是變成獨立於 BattleScreen 之外的選項設定器？

---

# ✅ CLAUDE 審查回覆（2026-07-12）

> 結論：**方向對、結構清楚**，缺口已補，**可以動工**。

### 修正後的核心設計

1. **BattleScreen 的動畫層 = 資料驅動播放**（方案 A 的資料結構）
   - 吃一份 `RoundResult` 資料來播動畫
   - 單人模式：BattleScreen 內部用 `calcStandardArrowDmg` 本地產生那份資料
   - 組隊/地下城/世界王：外部（Firestore）產資料餵進來

2. **動畫資料結構要能多人交錯**：`arrowBreakdown` 改成 `[{memberId, dmg, isCrit, score, part?, heal?, assist?}]`

3. **AllyData 的 role 是動態的**（戰鬥中會因陣亡從 front→rear），不是靜態 prop

### 已修的缺口

✅ `arrowsPerRound` prop 補上
✅ `cardFrame` 統一放在 PlayerData 內
✅ 備份 MonsterBattle.jsx 補進 Week 2 步驟
✅ `skipCounter`/`counterReduce` 來源註明
✅ 前後衛動態、heal/assist 欄、多人交錯的資料結構

---

## 🚀 修正版抽取計畫

### Props 介面（修正版）

```jsx
<BattleScreen
  // ── 必要資料 ──
  player={playerData}
  monster={monsterData}
  
  // ── 戰鬥設定 ──
  battleMode="score"|"zombie"
  scoreInput="keypad"|"target"
  difficulty={{ hp:1.0, atk:1.0, def:1.0 }}
  arrowsPerRound={6}               // ← 補上（MonsterBattle 可調）
  
  // ── 選填資料 ──
  allies={[]}                      // 隊友陣列，role 戰鬥中會動態變化
  cat={catData|null}
  potions={potionInventory}
  
  // ── 回呼 ──
  onRoundSubmit={async (arrows, context) => Promise<RoundResult>}
  // context = { skipCounter, counterReduce }（BattleScreen 藥水計算）
  // 單人模式：不傳 onRoundSubmit，BattleScreen 自動本地計算
  // 多人模式：傳 onRoundSubmit，外部處理後回傳 RoundResult
  
  onBattleEnd={(result) => void}
  onPotionUsed={(potionId) => void}
/>
```

### RoundResult（多模式共用）

```typescript
interface RoundResult {
  totalDmg: number;
  crits: number;
  counterDmg: number;
  monsterHpAfter: number;
  playerHpAfter: number;
  won: boolean;
  lost: boolean;
  arrowBreakdown: ArrowEvent[];     // 可交錯多位玩家的箭
  catDamage?: number;
  catHeal?: number;
  healGiven?: Record<string, number>; // 後衛治療量
  assistGiven?: Record<string, number>; // 後衛助攻量
}

interface ArrowEvent {
  memberId: string;    // 允許多人交錯
  dmg: number;
  isCrit: boolean;
  score: string;
  part?: { id, icon, name, mult };
  nx?: number; ny?: number;
  faceIndex?: number;
  targetFormat?: string;
}
```

### 資料結構（修正版）

```typescript
interface PlayerData {
  id: string;
  name: string;
  lv?: number;
  atk: number;
  def: number;
  hp: number;
  maxHp: number;
  catId?: string;
  catName?: string;
  cardFrame?: string;  // 玩家卡外框色（統一放這裡）
}

interface AllyData {
  id: string;
  name: string;
  catId: string;
  atk: number;
  def: number;
  hp: number;
  maxHp: number;
  role: "front" | "rear";     // 戰鬥中會變（陣亡→後衛）
  hasDied: boolean;             // ← 新增：是否已倒過一次
  rearChoice?: "heal" | "dmg"; // 後衛策略
  ready: boolean;
  alive: boolean;
}
```

### 抽取步驟（修正版）

#### Step 1: 建立 BattleScreen 元件

新增 `src/components/battle/BattleScreen.jsx`：

1. 從 AdminBattleTest.jsx 複製 reducer、phase 常數、動畫系統、UI
2. **動畫層改為資料驅動**：接收 `RoundResult` 播放逐箭→貓貓→反擊動畫
3. **單人模式維持本地計算**：當 `onRoundSubmit` 未傳入時，自動用 `calcStandardArrowDmg` 算傷害
4. 移除測試專用寫死常數（SELF/MONSTERS/MATE_DATA/TEST_POTIONS/DIFF_MULTS/FRAME_TIERS）
5. 保留共用邏輯：reducer（9 phase）、animStep、computeUnlocked、TargetFace、貓貓協戰、keyframes
6. 加入 `arrowsPerRound` prop（取代寫死 6）
7. 修改藥水處理 → 呼叫 `props.onPotionUsed`
8. `supportsImmersive` 回呼告知訪客模式何時進全螢幕

#### Step 2: 修改 AdminBattleTest.jsx

保留控制面板，戰鬥畫面改用 BattleScreen。AdminBattleTest 變成 BattleScreen 的「測試母版」。

#### Step 3: 接入 MonsterBattle.jsx

1. **先備份**：`MonsterBattle.jsx → MonsterBattle.legacy.jsx`（`src/components/member/`）
2. MonsterBattle 保留選怪/設定/結算邏輯
3. 戰鬥畫面階段改成 `<BattleScreen>`，不傳 `onRoundSubmit` 啟用本地計算模式
4. 既有 props（onBack、questContext、isGuest、kidMode 等）保持不變

---

## 實作順序

1. ✅ 後台戰鬥模擬器（AdminBattleTest）— 已存在
2. ⏳ BattleScreen 元件抽取（本任務）
3. ⏳ MonsterBattle 接入（先備份舊檔）
4. ⏳ PartyBattleRoom / DungeonBattleRoom / WorldBossAttack 逐步接入
