# 貓貓動畫系統 — 設計規格

## 一、目標

為現有的貓貓陪練系統（`useCatCompanion`）加上**動畫反應層**，讓貓貓在戰鬥中對射箭事件做出動態視覺反應，而不只是靜態照片 + 文字泡泡。

## 二、系統架構

```
射箭事件（Arrow Hit / Miss / Crit / Monster Death …）
         │
         ▼
   CatEventBridge ───→ CatAnimator（渲染動畫狀態）
         │                     │
         ▼                     ▼
   CatMsg（文字）          SVG 動畫／Sprite Sheet
```

### 角色分工

| 層 | 負責 | 現有／新建 |
|---|------|-----------|
| **事件源** | BattleEngine 產生的射箭事件 | ✅ 已有 `EventType` |
| **事件橋接** | 將射箭事件對應到貓貓動畫狀態 + 觸發文字 | ✅ 部分已有 `triggerCatAction`／需擴充 |
| **動畫狀態機** | 管理當前動畫（idle/happy/miss/attack/victory/sleep）與切換時機 | 🆕 `CatAnimator` |
| **渲染器** | 依照動畫狀態繪製貓貓 | 🆕 Phase 1: SVG 模擬 → Phase 2: Sprite Sheet |

## 三、動畫狀態定義

| 狀態 | 觸發時機 | 持續時間 | 描述 |
|------|---------|---------|------|
| `idle` | 無事件時 | 持續 | 微微呼吸、偶爾眨眼、尾巴輕擺 |
| `happy` | 射中 X（10分） | 1.2s | 彈跳、耳朵豎起、☆ 特效 |
| `miss` | 脫靶（M） | 0.8s | 嚇到後仰、頭暈轉圈 |
| `attack` | 貓貓攻擊回合／技能發動 | 1.5s | 前撲揮爪、眼睛發光 |
| `victory` | 怪物死亡 | 2.0s | 跳高高、轉圈、🎉 特效 |
| `sleep` | 長時間無操作 | 持續 | 緩慢呼吸、Zzz 文字 |
| `alert` | Boss 登場 | 1.0s | 耳朵豎直、炸毛、瞳孔縮小 |
| `chest` | 掉落寶箱 | 1.0s | 好奇湊過去、爪子撥弄 |

### 狀態切換規則

```
idle ←→ sleep（30 秒無事件）
idle ─→ happy（射中 X）
idle ─→ miss（脫靶）
idle ─→ attack（貓貓攻擊）
idle ─→ victory（怪物死亡）
idle ─→ alert（Boss 登場）
idle ─→ chest（掉寶）

任何非 idle 狀態 → 動畫結束後 → idle
（victory 除外：完成後先維持 0.5s 再回 idle）
```

## 四、Phase 1：SVG 模擬原型

### 元件 API

```jsx
<CatAnimator
  catId="haji"        // 使用 CATS 中的貓 ID
  animation="idle"    // 目前動畫狀態
  size={80}           // 顯示尺寸（px）
  mood="happy"        // 額外表情微調（選用）
/>
```

### SVG 貓貓結構

使用 5 個可獨立動畫的 `<g>` 群組：

```
<svg>
  <!-- 尾巴：左右擺動 -->
  <g class="cat-tail">
    <path />
  </g>
  <!-- 身體：呼吸起伏 -->
  <g class="cat-body">
    <ellipse />
  </g>
  <!-- 頭 + 耳朵 -->
  <g class="cat-head">
    <!-- 左耳、右耳（可豎起/下垂） -->
    <polygon class="ear-left" />
    <polygon class="ear-right" />
    <!-- 臉 -->
    <ellipse />
    <!-- 眼睛（可開/半/閉） -->
    <circle class="eye-left" />
    <circle class="eye-right" />
    <!-- 鼻子 + 鬍鬚 -->
  </g>
  <!-- 前腳 + 後腳 -->
  <g class="cat-paws" />
  <!-- 特效層（星星、Zzz、愛心等） -->
  <g class="cat-effects" />
</svg>
```

### CSS 動畫（keyframes）

所有動畫使用 CSS `@keyframes`，不引入第三方動畫庫：

```css
/* 呼吸（idle + sleep） */
@keyframes cat-breathe {
  0%, 100% { transform: scaleY(1); }
  50%      { transform: scaleY(1.03); }
}

/* 眨眼（idle）～ 每 3 秒眨一次 */
@keyframes cat-blink {
  0%, 95%, 100% { transform: scaleY(1); }
  97%           { transform: scaleY(0.1); }
}

/* 開心彈跳 */
@keyframes cat-happy {
  0%   { transform: translateY(0) scale(1); }
  30%  { transform: translateY(-20px) scale(1.1); }
  50%  { transform: translateY(-25px) scale(1.05) rotate(-5deg); }
  70%  { transform: translateY(-8px) scale(1.08) rotate(3deg); }
  100% { transform: translateY(0) scale(1); }
}

/* 脫靶嚇到 */
@keyframes cat-miss {
  0%   { transform: translateX(0) rotate(0); }
  20%  { transform: translateX(-12px) rotate(-8deg); }
  40%  { transform: translateX(10px) rotate(6deg); }
  60%  { transform: translateX(-6px) rotate(-3deg); }
  80%  { transform: translateX(4px) rotate(2deg); }
  100% { transform: translateX(0) rotate(0); }
}

/* 攻擊撲擊 */
@keyframes cat-attack {
  0%   { transform: translateX(0) scale(1); }
  25%  { transform: translateX(30px) scale(1.2); }
  50%  { transform: translateX(35px) scale(1.15) rotate(-5deg); }
  75%  { transform: translateX(10px) scale(0.95); }
  100% { transform: translateX(0) scale(1); }
}

/* 勝利跳躍 */
@keyframes cat-victory {
  0%   { transform: translateY(0) scale(1) rotate(0); }
  25%  { transform: translateY(-35px) scale(1.2) rotate(-10deg); }
  50%  { transform: translateY(-40px) scale(1.1) rotate(5deg); }
  75%  { transform: translateY(-10px) scale(1.05) rotate(-3deg); }
  100% { transform: translateY(0) scale(1) rotate(0); }
}
```

### 配色（沿用 `CATS` palette）

```js
const CATS = {
  haji: { palette: { base: "#fef9c3", patch: "#c4a882", light: "#fffbeb" } },
  // ...
};
// 任何貓共用模板，只換顏色
```

### 替換為 Sprite Sheet 的設計

`CatAnimator` 內部維護 `animationState`，渲染函式是一個可替換的 props：

```jsx
// Phase 1：SVG
function SvgRenderer({ catId, animation, palette }) { ... }

// Phase 2：Sprite Sheet
function SpriteRenderer({ catId, animation, spriteMap }) { ... }

// 統一切換點
const Renderer = useSpriteSheet ? SpriteRenderer : SvgRenderer;
```

Sprite Sheet 格式採用 Petdex 相容的 `background-position` 切換：

```
.sprite-haji {
  background-image: url(/cats/sprites/haji.webp);
  /* 假設 sprite sheet 8 列 × 6 行 */
  /* idle    = row 0, happy  = row 1, miss  = row 2 */
  /* attack  = row 3, victory = row 4, sleep = row 5 */
}
.sprite-haji.anim-happy {
  background-position: 0 -64px; /* 第二行 */
}
```

## 五、整合點（需要在哪些戰鬥畫面加入）

| 畫面 | 整合方式 | 優先級 |
|------|---------|--------|
| `MonsterBattle.jsx` | 在怪物 HP bar 旁加入貓貓動畫區塊 | 🔴 P0 |
| `BattleScreen.jsx` | 取代現有靜態 `CatSVG`，改為 `CatAnimator` | 🔴 P0 |
| `PartyBattleRoom.jsx` | 隊員貓貓改用動畫版 | 🟡 P1 |
| `DungeonBattleRoom.jsx` | 同 MonsterBattle | 🟡 P1 |
| `WorldBossAttack.jsx` | Boss 戰專屬 alert 動畫 | 🟡 P1 |
| `CatVillage.jsx` | 貓貓村閒置 idle + sleep 動畫 | 🟢 P2 |

## 六、Phase 2：Sprite Sheet 替換

### AI 生圖提示詞範本

以哈吉為例：

```
row 0 (idle): "cute kawaii cat pixel art 32x32,
  cream-colored fluffy cat with light brown patches,
  round big eyes, sitting pose breathing animation 4 frames,
  game sprite, transparent background --ar 3:2"

row 1 (happy): "same cat jumping happily,
  ears perked up, sparkle effect, 3 frames"

row 2 (miss): "same cat startled, falling backwards,
  dizzy stars around head, 3 frames"

row 3 (attack): "same cat pouncing forward,
  paws outstretched, determined eyes, 3 frames"

row 4 (victory): "same cat celebrating,
  jumping with raised paws, 3 frames"

row 5 (sleep): "same cat curled up sleeping,
  slow breathing, zzz mark, 2 frames"
```

### 檔案規範

- 格式：WebP（有損）或 PNG（無損）
- 每幀尺寸：32×32（或 64×64）
- Spritesheet 寬度：32×6=192px（6 欄）、高度：32×6=192px（6 行）
- 置於 `public/cats/sprites/{catId}.webp`

## 七、里程碑

| 階段 | 內容 | 時程 |
|------|------|------|
| Phase 1a | `CatAnimator` SVG 元件 + 6 種動畫狀態 | 本次 |
| Phase 1b | 整合至 `MonsterBattle.jsx` 與 `BattleScreen.jsx` | 下一次 |
| Phase 1c | 整合至組隊/地下城/世界王 | 再下一次 |
| Phase 2 | AI 生圖 + Sprite Sheet 播放器替換 SVG | 待素材就緒 |

## 八、權限控制

### 顯示規則

| 角色 | 動畫顯示 | 開關可見 |
|------|---------|---------|
| admin（教練） | ✅ 可看，可開關 | ✅ |
| member（學員） | ❌ 不顯示 | ❌ |
| guest／kid | ❌ 不顯示 | ❌ |

### 實作

1. **`useCatAnimationAccess()`** hook（`src/hooks/useCatAnimationAccess.js`）
   - 檢查 `role === "admin"` 決定 `visible`
   - localStorage key `catarrow_cat_animation_enabled` 決定 `enabled`
   - 回傳 `{ visible, enabled, setEnabled, toggle }`

2. **`<CatAnimator visible={visible} enabled={enabled} />`**
   - `visible=false` → 不渲染
   - `visible=true && enabled=false` → 渲染靜態 SVG（無 CSS keyframes、無特效）
   - `visible=true && enabled=true` → 渲染完整動畫版

3. **`<CatAnimationToggle />`** 元件
   - 只有 admin 看得到
   - 顯示當前狀態 + 滑動開關
   - 可放在教練後台設定區

## 九、附錄：現有系統對照

| 系統 | 貓貓陪練 | 動畫系統 |
|------|---------|---------|
| 貓咪資料 | `catData.js` → 9 貓定義 + palette | ✅ 直接共用 |
| 戰鬥事件 | `BatleEvents.js` → `EventType` | ✅ 直接監聽 |
| 貓貓邏輯 | `useCatCompanion.js` → bond/XP/skill | ✅ 擴充 `triggerCatAction` |
| 靜態顯示 | `CatSVG.jsx` → 照片 + SVG fallback | 🆕 `CatAnimator` 取代 |
| 文字訊息 | `CatMsg.jsx` → 文字泡泡 | ✅ 保留，與動畫並行 |
| 權限控制 | `useCatAnimationAccess.js` → admin + toggle | 🆕 本次新增 |
