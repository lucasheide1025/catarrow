# 🔊 音效整合清單

> 戰鬥模擬器 `AdminBattleTest.jsx` 中所有音效掛載點，統一由 `src/lib/battleSound.js` 管理器管控。
> 搜尋 `playBattleSound(` 即可在程式碼中找到所有呼叫點。
> 搜尋 `🔊 [SOUND]` 可在瀏覽器 Console 中看到實際輸出。

---

## 🎮 音效管理器 API

```js
import { playBattleSound, setBattleSoundMode, toggleBattleSoundMode } from "../../lib/battleSound";

// 開發模式：console.log 輸出（預設）
setBattleSoundMode("debug");

// 上線模式：播放真實音效（未來實作後啟用）
setBattleSoundMode("live");

// 即時切換
toggleBattleSoundMode();

// 播放音效
playBattleSound("arrow_hit", {
  arrowIdx: 3, score: "X", dmg: 78, isCrit: true
});
```

每個 `playBattleSound()` 的第一個參數是音效 ID，第二個是上下文資料物件。
開發模式下 console 會輸出：
```
🔊 [SOUND] arrow_hit: 第3箭 X → 78傷害 💥爆擊
```

---

## 1. 🎬 VS 進場動畫（`isIntro` phase）

| # | 音效 ID | 時機 | Console 範例 | 行號 |
|---|---------|------|-------------|------|
| 1 | `cat_intro` | VS 動畫開始，且有選貓貓 | `大娘（治癒型）— 💚 進場特效 + 喵叫聲` | 432 |
| 2 | `sfx_cat_type_{heal\|atk\|def}` | VS 動畫開始，依類型 | `輕柔喵聲💚` / `尖銳戰吼⚡` / `低沉威嚇🛡️` | 433 |

**未來實作：**
```js
import { sfxCatHeal, sfxCatAttack, sfxCatDefend } from "../../lib/sound";
// 依 skillGroup 播放對應音效
if (hasCat) {
  if (skillGroup === "heal") sfxCatHeal();
  else if (skillGroup === "atk") sfxCatAttack();
  else sfxCatDefend();
}
```

---

## 2. 🏹 戰鬥過程動畫 — 逐箭（`isProcessing` phase, animStep 1~6）

| # | 音效 ID | 時機 | Console 範例 | 行號 |
|---|---------|------|-------------|------|
| 3 | `arrow_flight` | 每箭命中判定前 | `第3箭 飛向 temple_6 — 破風疾馳🏹` | 475 |
| 4 | `arrow_hit` | 每箭命中判定 | `第3箭 X → 78傷害 💥爆擊` | 477 |

**分數靶 vs 殭屍靶飛行音差異：**
- 🎯 分數靶 → `破風疾馳🏹`
- 🧟 殭屍靶 → `近距離穿透💨`

**未來實作：**
```js
import { sfxArrowFlight, sfxArrowHit, sfxCritBoom } from "../../lib/sound";
sfxArrowFlight();
await delay(100); // 飛行延遲
if (a.isCrit) sfxCritBoom();
else sfxArrowHit();
```

---

## 3. 🐱 戰鬥過程動畫 — 貓貓協戰（`isProcessing` phase, animStep 7）

| # | 音效 ID | 時機 | Console 範例 | 行號 |
|---|---------|------|-------------|------|
| 5 | `cat_attack` | 貓貓協戰動畫開始 | `大娘 協戰攻擊！✨ 治癒光環💚` | 486 |

**依類型音效：**
- 💚 治癒型 → `治癒光環💚`
- ⚡ 攻擊型 → `利爪破空⚡`
- 🛡️ 防禦型 → `盾牌衝擊🛡️`

**未來實作：**
```js
import { sfxCatClaw, sfxCatHealAura, sfxCatShield } from "../../lib/sound";
if (skillGroup === "heal") sfxCatHealAura();
else if (skillGroup === "atk") sfxCatClaw();
else sfxCatShield();
```

---

## 4. 💥 戰鬥過程動畫 — 怪物反擊（`isProcessing` phase, animStep 8）

| # | 音效 ID | 時機 | Console 範例 | 行號 |
|---|---------|------|-------------|------|
| 6 | `monster_counter` | 怪物反擊動畫開始 | `temple_6 反擊！造成 15 傷害 — 利爪揮擊🔪` | 495 |

**依傷害量音效：**
- 傷害 ≤ 100 → `利爪揮擊🔪`
- 傷害 > 100 → `沉重轟擊💥`

**未來實作：**
```js
import { sfxCounterHit, sfxHeavyBash } from "../../lib/sound";
if (battle.counterDmg > 100) sfxHeavyBash();
else sfxCounterHit();
```

---

## 5. 💀 擊倒動畫（`isVictoryAnim` phase）

| # | 音效 ID | 時機 | Console 範例 | 行號 |
|---|---------|------|-------------|------|
| 7 | `victory_fanfare` | 怪物 HP 歸零，進入擊倒動畫 | `temple_6 被擊倒！回合 1 總傷 320 — 凱旋號角🎺` | 443 |

**未來實作：**
```js
import { sfxVictoryFanfare, sfxMonsterDead } from "../../lib/sound";
sfxMonsterDead();
// 3 秒後：
sfxVictoryFanfare();
```

---

## 6. 🏆 勝利畫面（transition from VICTORY_ANIM to WON）

| # | 音效 ID | 時機 | Console 範例 | 行號 |
|---|---------|------|-------------|------|
| 8 | `victory_cheer` | 擊倒 3 秒後，顯示勝利畫面 | `播放勝利歡呼聲！🎉` | 445 |

**未來實作：**
```js
import { sfxSuccess, sfxVictoryFanfare } from "../../lib/sound";
sfxSuccess();
```

---

## 7. 😔 敗北畫面（`isLost` phase）

| # | 音效 ID | 時機 | Console 範例 | 行號 |
|---|---------|------|-------------|------|
| 9 | `defeat_sigh` | 玩家 HP 歸零，進入敗北畫面 | `temple_6 擊倒了 顛顛 — 在第 2 回合 — 沉重嘆息😔` | 455 |

**未來實作：**
```js
import { sfxSoftFail } from "../../lib/sound";
sfxSoftFail();
```

---

## 📦 建議的音效函式列表

以下是建議實作的真實音效函式，可直接新增到 `src/lib/sound.js`：

```js
export function sfxCatHeal()       { /* 輕柔喵聲 */ }
export function sfxCatAttack()     { /* 尖銳戰吼 */ }
export function sfxCatDefend()     { /* 低沉威嚇 */ }
export function sfxArrowFlight()   { /* 箭矢破風聲 */ }
export function sfxCatClaw()       { /* 利爪揮擊 */ }
export function sfxCatHealAura()   { /* 治癒光環 */ }
export function sfxCatShield()     { /* 盾牌撞擊 */ }
export function sfxHeavyBash()     { /* 沉重轟擊 */ }
export function sfxMonsterDead()   { /* 怪物死亡 */ }
export function sfxSuccess()       { /* 勝利歡呼 */ }
```

---

## 🔍 快速搜尋

```
🔊 [SOUND]           → 所有音效預留點（共 9 處）
// 🔊               → 音效預留註解（註記用）
```

> 最後更新：2026-07-12
> 檔案位置：`src/components/admin/AdminBattleTest.jsx`
