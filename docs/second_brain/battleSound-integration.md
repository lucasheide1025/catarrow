# 🔊 battleSound.js 統一音效管理器 — 整合架構與使用

> **最後更新**：2026-07-12  
> **相關檔案**：`src/lib/battleSound.js`（管理器核心）、`src/components/shared/BattleSoundIndicator.jsx`（UI 指示器）  
> **已整合檔案**：5 個（AdminBattleTest + 4 個正式戰鬥系統）

---

## 📋 目錄

1. [架構概覽](#1-架構概覽)
2. [API 參考](#2-api-參考)
3. [音效定義表](#3-音效定義表)
4. [整合一覽](#4-整合一覽)
5. [BattleSoundIndicator 元件](#5-battlesoundindicator-元件)
6. [新增音效定義](#6-新增音效定義)
7. [多實例隔離](#7-多實例隔離)
8. [整合檢查清單](#8-整合檢查清單)
9. [踩坑記錄](#9-踩坑記錄)

---

## 1. 架構概覽

```
                   ┌──────────────────────┐
                   │    battleSound.js     │
                   │  (統一音效管理器)     │
                   │                      │
                   │   playBattleSound()   │
                   │   initBattleSound()   │
                   │   toggleBattleSound() │
                   │   createInstance()    │
                   └──────┬───────┬───────┘
                          │       │
           debug 模式     │       │  live 模式
      ┌───────────────────┘       └───────────────┐
      │                                            │
      ▼                                            ▼
  console.log(...)                           src/lib/sound.js
  🔊 [SOUND] arrow_hit: ...                  sfxArrowHit() / sfxCritBoom() ...
```

### 設計原則

| 原則 | 說明 |
|------|------|
| **敘事音效 vs UI 音效分離** | `battleSound.js` 只管理「敘事性」音效（進場、勝利、敗北、貓貓協戰），UI 互動音效（`sfxTap`、`sfxPotionDrink`）與內部動畫回呼音效（`sfxArrowShoot`、`sfxCounter`）保留直接呼叫 `sound.js` |
| **debug / live 雙模式** | debug 模式只印 console.log，不發出真實聲音；live 模式播放真實音效。預設為 debug |
| **localStorage 持久化** | 重整後自動恢復上次選擇的模式，記憶在 `buff_battle_sound_mode` key |
| **實例隔離** | `createBattleSoundInstance()` 工廠函式支援多戰鬥實例各自獨立模式（目前未用到） |

---

## 2. API 參考

### 2.1 核心函式（模組級）

```js
import { playBattleSound, setBattleSoundMode, getBattleSoundMode,
         toggleBattleSoundMode, initBattleSound, SOUND_IDS } from "../../lib/battleSound";

// 初始化（在 index.js 或 App.jsx 啟動時呼叫一次）
initBattleSound();   // 從 localStorage 恢復上次模式

// 播放音效
playBattleSound("victory_cheer", {});                                // 無上下文
playBattleSound("arrow_hit", { arrowIdx:3, score:"X", dmg:78, isCrit:true });

// 切換模式
setBattleSoundMode("live");          // 設為播放模式
setBattleSoundMode("debug");         // 設為除錯模式
toggleBattleSoundMode();             // 即時切換
const mode = getBattleSoundMode();   // "debug" | "live"

// 取得所有有效音效 ID
console.log(SOUND_IDS);  // ["cat_intro", "cat_type_sound", "arrow_flight", ...]
```

### 2.2 實例工廠（多戰鬥隔離）

```js
import { createBattleSoundInstance } from "../../lib/battleSound";

const inst = createBattleSoundInstance("debug");

inst.playBattleSound("arrow_hit", { score:"X", dmg:78 });
inst.setBattleSoundMode("live");
inst.toggleBattleSoundMode();
inst.getBattleSoundMode();  // "live"
```

---

## 3. 音效定義表

以下為 `SOUND_DEFS` 中定義的所有音效 ID、debug 訊息範本與 live 播放對應。

| ID | 情境 | debug 訊息範本 | live 播放 |
|----|------|---------------|-----------|
| `cat_intro` | 貓貓進場 | `{catName}（{typeLabel}）— {typeIcon} 進場特效 + 喵叫聲` | `sfxBattleIntro()` |
| `cat_type_sound` | 貓貓類型音 | 依 `skillGroup`：heal→輕柔喵聲💚 / atk→尖銳戰吼⚡ / def→低沉威嚇🛡️ | heal→`sfxBuff()` / atk→`sfxCast()` / def→`sfxDebuff()` |
| `arrow_flight` | 箭矢飛行 | `第{arrowIdx}箭 飛向{monsterName} — 破風疾馳🏹/近距離穿透💨` | `sfxArrowShoot()` |
| `arrow_hit` | 箭矢命中 | `第{arrowIdx}箭 {score} → {dmg}傷害{isCrit?💥爆擊}` | 爆擊→`sfxCritBoom()` / 一般→`sfxArrowHit()` |
| `cat_attack` | 貓貓協戰 | `{catName} 協戰攻擊！{particle} {heal/atk/def對應文字}` | heal→`sfxBuff()` / atk→`sfxCast()` / def→`sfxDebuff()` |
| `monster_counter` | 怪物反擊 | `{monsterName} 反擊！造成 {counterDmg} 傷害 — 利爪揮擊🔪/沉重轟擊💥` | >100→`sfxCounterCrit()` / ≤100→`sfxCounter()` |
| `victory_fanfare` | 凱旋號角 | `{monsterName} 被擊倒！回合 {round} 總傷 {roundDmg} — 凱旋號角🎺` | `sfxVictoryFanfare()` |
| `victory_cheer` | 勝利歡呼 | `播放勝利歡呼聲！🎉` | `sfxSuccess()` |
| `defeat_sigh` | 敗北嘆息 | `{monsterName} 擊倒了 {playerName} — 在第 {round} 回合 — 沉重嘆息😔` | `sfxDefeat()` |
| `battle_intro` | 戰鬥進場 | `{monsterName} VS {playerName} — 戰鬥進場⚔️` | `sfxBattleIntro()` |
| `monster_death` | 怪物死亡 | `{monsterName} 被擊殺 — 死亡效果💀` | `sfxMonsterDead()` |
| `soft_fail` | 失敗音效 | `{monsterName} 擊敗了玩家 — 失敗音效😵` | `sfxSoftFail()` |

**共 12 個音效 ID**（原始 9 個 + 整合期間新增 `battle_intro`、`monster_death`、`soft_fail`）。

---

## 4. 整合一覽

### 4.1 各檔案使用匯總

| 檔案 | 用途 | 使用音效 ID | BattleSoundIndicator |
|------|------|------------|---------------------|
| `AdminBattleTest.jsx` | 戰鬥模擬器（FREEBUFF 開發中） | `cat_intro`, `cat_type_sound`, `arrow_flight`, `arrow_hit`, `cat_attack`, `monster_counter`, `victory_fanfare`, `victory_cheer`, `defeat_sigh` | ✅ 控制面板（完整）+ 怪物名稱列（compact） |
| `MonsterBattle.jsx` | **單人打怪** | `battle_intro`, `victory_fanfare`, `monster_death`, `victory_cheer`, `soft_fail` | ✅ 怪物 Lv 徽章旁（compact） |
| `PartyBattleRoom.jsx` | **組隊打怪** | `victory_cheer`, `soft_fail` | ✅ 怪物名稱旁（compact） |
| `DungeonBattleRoom.jsx` | **地下城戰鬥** | `victory_cheer` ×2, `soft_fail` | ✅ 怪物名稱旁（compact） |
| `WorldBossAttack.jsx` | **世界王戰鬥** | `victory_cheer` ×2 | ✅ Boss 名稱旁（compact） |

### 4.2 保留為直接 `sfx*()` 呼叫的音效

各檔案的以下類型音效**維持**直接呼叫 `sound.js`，不經 `battleSound.js`：

| 類別 | 包含 | 原因 |
|------|------|------|
| **UI 互動** | `sfxTap`, `sfxPotionDrink`, `sfxCast` | 不受戰鬥音效模式影響 |
| **內部動畫回呼** | `sfxArrowShoot`, `sfxCounter`, `sfxCounterCrit`, `sfxMonsterDead`, `sfxRoundEnd` | 屬於 RoundController / useMiniRoundReveal 內部機制，與敘事音效分離 |
| **事件音效** | `sfxBuff`, `sfxDebuff` | Dungeon/Party 事件處理 useEffect 內部 |

---

## 5. BattleSoundIndicator 元件

**路徑**：`src/components/shared/BattleSoundIndicator.jsx`

一個輕量級的音效模式指示器 + 切換按鈕：

```jsx
import BattleSoundIndicator from "../shared/BattleSoundIndicator";

// 完整版（帶文字標籤）
<BattleSoundIndicator />

// 緊湊版（只有圖示，適合戰鬥 HUD）
<BattleSoundIndicator compact />
```

### props

| prop | 型別 | 預設 | 說明 |
|------|------|------|------|
| `compact` | `boolean` | `false` | 緊湊模式，只顯示圖示 |

### 顯示狀態

| 模式 | 緊湊版 | 完整版 |
|------|--------|--------|
| 🔧 debug（除錯） | 灰色邊框 + 🔧 | 「🔧 除錯」 |
| 🎵 live（播放） | 綠色邊框 + 🎵 | 「🎵 播放中」 |

### 已掛載位置

| 畫面 | 位置 | 版本 |
|------|------|------|
| AdminBattleTest 戰鬥模擬器 | 怪物名稱列 + 控制面板 | compact + 完整 |
| MonsterBattle 單人打怪 | 怪物 Lv 徽章旁 | compact |
| PartyBattleRoom 組隊打怪 | 怪物名稱旁 | compact |
| DungeonBattleRoom 地下城戰鬥 | 怪物名稱旁 | compact |
| WorldBossAttack 世界王 | Boss 名稱旁 | compact |

---

## 6. 新增音效定義

### 6.1 在 battleSound.js 新增

```js
// 1. 在 SOUND_DEFS 物件內新增項目
SOUND_DEFS["forest_ambient"] = {
  label: "森林背景音",
  debugMsg: (ctx) => `森林場景音效 — ${ctx.family || "一般"}族`,
  livePlay: () => sfxForestAmbient(),  // 需從 sound.js 匯入
};

// 2. 若 livePlay 使用新的 sfx* 函式，要匯入
import { sfxForestAmbient } from "./sound";

// 3. SOUND_IDS 自動包含新 ID（由 Object.keys() 產生）
```

### 6.2 在整合檔案中呼叫

```js
import { playBattleSound } from "../../lib/battleSound";

// 在適當的位置呼叫
playBattleSound("forest_ambient", { family: "forest" });
```

---

## 7. 多實例隔離

目前所有正式戰鬥使用**模組級**單一實例（`_mode` 變數），透過 `initBattleSound()` 初始化。

若未來需要多戰鬥實例同時存在（例如同時開多個分頁或多個戰鬥畫面），可使用 `createBattleSoundInstance()`：

```js
const inst1 = createBattleSoundInstance("live");
const inst2 = createBattleSoundInstance("debug");

inst1.playBattleSound("arrow_hit", {});  // 播放真實音效
inst2.playBattleSound("arrow_hit", {});  // 只印 console
```

**目前所有整合檔案**（MonsterBattle / PartyBattleRoom / DungeonBattleRoom / WorldBossAttack / AdminBattleTest）皆使用**模組級** API，未使用實例工廠。若未來要改為 instance-scoped，需要：

1. 建立 `createBattleSoundInstance()` 取代模組級匯入
2. 將 instance 傳遞給各個戰鬥元件（透過 props 或 context）
3. 改寫 `battleSound.js` 以支援兩種模式並存

---

## 8. 整合檢查清單

整合一個新的戰鬥檔案到 `battleSound.js` 時，按以下步驟：

- [ ] **搜尋**：`grep "sfx[A-Z]"` 找出所有 `sound.js` 的直接呼叫點
- [ ] **分類**：區分「敘事音效」（進場、勝利、敗北）vs「UI/動畫回呼音效」
- [ ] **檢查 SOUND_DEFS**：確認需要的音效 ID 已在 `battleSound.js` 定義，沒有的話新增
- [ ] **匯入**：新增 `import { playBattleSound } from "../../lib/battleSound"`
- [ ] **匯入指示器**：新增 `import BattleSoundIndicator from "../shared/BattleSoundIndicator"`
- [ ] **替換**：將敘事音效的 `sfxXxx()` 改成 `playBattleSound("xxx", { ...context })`
- [ ] **放置指示器**：在戰鬥 HUD 的怪物/Boss 名稱列加上 `<BattleSoundIndicator compact />`
- [ ] **檢查死匯入**：確認替換掉的 `sfx*` 不再被使用（可保留，tree-shaking 會處理）
- [ ] **Build 驗證**：`npm run build` 確認編譯成功
- [ ] **實機測試**：切換 debug/live 模式，確認音效正確播放/靜音

---

## 9. 踩坑記錄

### 9.1 `_mode` 是模組級變數

`_mode` 儲存在模組作用域，所有從 `battleSound.js` 匯入的消費者共用同一個模式。若未來需要多戰鬥實例各自獨立模式，需改用 `createBattleSoundInstance()` 實例工廠。

### 9.2 `initBattleSound()` 只執行一次

`initBattleSound()` 內部有 `_initialized` 旗標，重複呼叫只會執行第一次。若需手動重設（例如測試），目前無公開 API，可考慮新增 `resetBattleSound()`。

### 9.3 localStorge 在隱私模式可能不可用

`localStorage` 在 Safari 無痕模式 / 某些瀏覽器隱私模式下可能擲回例外，所有 `try/catch` 已涵蓋此情況。

### 9.4 `createBattleSoundInstance` 與 `SOUND_DEFS` 的 TDZ 安全

`createBattleSoundInstance` 在原始碼中定義於 `SOUND_DEFS` **之前**，但因為函式內部只在**呼叫時**（而非定義時）才存取 `SOUND_DEFS`，所以不會有 Temporal Dead Zone（TDZ）問題。模組載入完成後才有人呼叫 `play()` 方法，此時 `SOUND_DEFS` 已初始化完畢。

### 9.5 多處 `sfxSuccess()` 替換為 `victory_cheer`

原始的 `sfxSuccess()` 在 MonsterBattle/PartyBattleRoom/DungeonBattleRoom/WorldBossAttack 中有不同的使用語意：
- 有些是勝利歡呼（`sfxSuccess()`）
- 有些是擊殺後的附加音效（`sfxMonsterDead()` 後的 `sfxSuccess()`）

全部對應到 `playBattleSound("victory_cheer")` 是同一個音效 ID，debug 訊息統一為「播放勝利歡呼聲！🎉」。若未來需要區分這兩種情境，需新增另一個 SOUND_DEF（如 `victory_chime`）。

### 9.6 四個整合統一的 import 位置

所有已整合檔案都將 `playBattleSound` 和 `BattleSoundIndicator` 的 import 加在原有 `sound.js` import 之後：

```js
import { sfxTap, sfxArrowHit, ... } from "../../lib/sound";
import { playBattleSound } from "../../lib/battleSound";   // ← 新增
import BattleSoundIndicator from "../shared/BattleSoundIndicator"; // ← 新增
```

### 9.7 保留的 `sfxEpic()` 不一致

在 PartyBattleRoom.jsx，勝利後 `sfxEpic()`（350ms 延遲）維持直接呼叫 `sound.js`，不經 `battleSound.js`。這代表使用者切到 debug 模式時，`victory_cheer` 會靜音但 `sfxEpic()` 仍會發出聲音。這是刻意的——`sfxEpic` 不屬於敘事音效範疇，但可能導致使用者困惑。之後可考慮新增 `epic_cheer` SOUND_DEF 統一行為。

---

## 📁 相關檔案

```
src/lib/
  battleSound.js           ← 核心管理器（12 個 SOUND_DEFS、debug/live 雙模式、多實例工廠）
  sound.js                  ← 底層 Web Audio 合成音效（所有 sfx* 函式）

src/components/shared/
  BattleSoundIndicator.jsx ← 音效模式指示器 + 切換按鈕（compact / 完整版）

docs/
  sound-effect-checklist.md  ← 原始音效清單（較舊，僅記錄 AdminBattleTest.jsx）
```
