# 🎯 DexDetailModal 進度條 UI 設計方案

> **檔案位置**: `docs/dex-detail-modal-progress-ui-design.md`
> **主要修改對象**: `src/components/member/MemberDex.jsx` — `DexDetailModal` 元件
> **輔助工具**: `src/lib/achievementDex.js` — 新增 `computeTierProgress()` 等工具函式
> **相關 CSS**: `src/index.css` — 設計 token 變數

---

## 📋 目錄

1. [設計總覽](#1-設計總覽)
2. [三種狀態畫面](#2-三種狀態畫面)
3. [進度條設計](#3-進度條設計)
4. [里程碑列表互動](#4-里程碑列表互動)
5. [動畫與微互動](#5-動畫與微互動)
6. [CSS 設計 Token](#6-css-設計-token)
7. [資料結構與 Props](#7-資料結構與-props)
8. [關鍵實作策略](#8-關鍵實作策略)

---

## 1. 設計總覽

### 設計目標

- **一眼看懂**: 打開彈窗馬上知道「目前在第幾階」、「下一個還要多少」
- **段落感清楚**: 已達成 / 未達成 / 目前進行中 三種狀態用顏色明確區分
- **不佔空間**: 里程碑列表預設收起，展開才顯示全部
- **延續像素風**: 與 `MemberDex.jsx` 原有的 `PIXEL_BADGE_STYLE` 視覺語言一致

### 版面配置（由上而下）

```
┌──────────────────────────────────┐
│           🏹 [稀有]               │  ← 成就圖示（rarity ring 外框）
│       累積報到                    │  ← 成就名稱
│     📍 風雨無阻 · 傳說            │  ← 當前 tier 名稱 + 稀有度標籤
│                                  │
│  ┌──────────────────────────┐    │
│  │  ██████████░░░░░░░░░░   │    │  ← ★ 進度條（彩色動畫）
│  │              12 / 15     │    │     當前值 / 下一個門檻
│  └──────────────────────────┘    │
│                                  │
│  ⚡ 再 3 次即可達成 「勢如破竹」!  │  ← 激勵文字（動態）
│                                  │
│  ── 里程碑 ──────────────────    │
│  [▼ 展開里程碑列表 (3/7)]        │  ← ★ 可展開/收起
│                                  │
│        🏆 完美達成！              │  ← 全部完成時顯示
│        🔒 關閉                    │
└──────────────────────────────────┘
```

---

## 2. 三種狀態畫面

### 2.1 進行中 — 未達最終階（最常見）

**適用**: 使用者還有下一個里程碑可以挑戰

```
┌──────────────────────────────────┐
│                                  │
│      (光環)  📍 (大型圖示)        │  ← 目前 tier 的圖示，有 rarity glow
│                                  │
│        累積報到                   │  ← 成就總名稱
│      📍 初次報到 · 普通           │  ← 已達到的最高 tier
│                                  │
│  ┌──────────────────────────┐    │
│  │  ██████████░░░░░░░░░░   │    │  ← 進度條，已達到的部分著色
│  │              12 / 15     │    │     顯示: 當前值 / 下一個門檻值
│  └──────────────────────────┘    │
│                                  │
│  ⚡ 再 3 次即可達成「勢如破竹」!  │  ← 差距提示
│                                  │
│  ────────────────────────────    │
│                                  │
│  [▼ 展開里程碑列表 (3/7)]        │  ← 3個已解鎖，共7個里程碑
│                                  │
│  ✅  初次報到      📍   1 次     │
│  ✅  漸入佳境      🌤️   5 次     │
│  ✅  持之以恆      🔥   10 次    │
│  ▶  勢如破竹      ⚡   15 次     │  ← ★ 目前目標，高亮
│  🔒  鍛鍊有成      💎   20 次     │
│  🔒  百練成鋼      🌟   25 次     │
│  🔒  風雨無阻      💪   30 次     │
│                                  │
│         🔒 關閉                  │
└──────────────────────────────────┘
```

### 2.2 全部完成 — 完美達成

**適用**: 使用者已達到最終里程碑

```
┌──────────────────────────────────┐
│       (光彩奪目動畫)              │
│      💪  (中大型圖示)             │  ← 最終 tier 圖示 + 最高稀有度光效
│                                  │
│        累積報到                   │
│      💪 風雨無阻 · 神話           │  ← 最終稀有度標籤
│                                  │
│  ┌──────────────────────────┐    │
│  │  ████████████████████   │    │  ← 進度條 100% 全滿+閃爍
│  │          🏆               │    │     顯示獎盃圖示
│  └──────────────────────────┘    │
│                                  │
│  🎉 完美達成！全部 7 個里程碑！   │  ← 慶祝文字
│                                  │
│  ────────────────────────────    │
│                                  │
│  [▼ 回顧里程碑列表 (7/7)]        │  ← 全部已解鎖
│                                  │
│  ✅  初次報到      📍   1 次     │
│  ✅  漸入佳境      🌤️   5 次     │
│  ✅  持之以恆      🔥   10 次    │
│  ✅  勢如破竹      ⚡   15 次     │
│  ✅  鍛鍊有成      💎   20 次     │
│  ✅  百練成鋼      🌟   25 次     │
│  ✅  風雨無阻      💪   30 次     │
│                                  │
│         🎉 太棒了！              │
└──────────────────────────────────┘
```

### 2.3 未開始 / 隱藏成就

**適用**: 使用者尚未達成任何里程碑

```
┌──────────────────────────────────┐
│                                  │
│      ？  (半透明/灰階)            │  ← 未解鎖圖示
│                                  │
│        累積報到                   │
│      🔒 尚未解鎖                 │
│                                  │
│  ┌──────────────────────────┐    │
│  │  ░░░░░░░░░░░░░░░░░░░░   │    │  ← 灰色空進度條
│  │          0 / 1            │    │     0 / 第一個門檻
│  └──────────────────────────┘    │
│                                  │
│  🎯 完成 1 次報到即可解鎖！       │
│                                  │
│  ────────────────────────────    │
│                                  │
│  [▼ 展開里程碑列表 (0/7)]        │
│                                  │
│  ▶  初次報到      📍   1 次     │  ← 全部尚未解鎖，第一個高亮
│  🔒  漸入佳境      🌤️   5 次     │
│  🔒  持之以恆      🔥   10 次    │
│  🔒  勢如破竹      ⚡   15 次     │
│  🔒  鍛鍊有成      💎   20 次     │
│  🔒  百練成鋼      🌟   25 次     │
│  🔒  風雨無阻      💪   30 次     │
│                                  │
│         🔒 關閉                  │
└──────────────────────────────────┘
```

### 2.4 隱藏成就（riddle 模式）

**適用**: `hidden: true` 且未解鎖的成就

```
┌──────────────────────────────────┐
│                                  │
│      ❓  (大型問號 + 迷霧效果)    │
│                                  │
│        ??? 隱藏成就               │
│      🔒 尚未解鎖                 │
│                                  │
│  ┌──────────────────────────┐    │
│  │  ❓❓❓❓❓❓❓❓❓❓❓❓❓    │    │  ← 特殊問號進度條
│  └──────────────────────────┘    │
│                                  │
│  💬  "三道試煉，缺一不可"         │  ← 謎語提示（riddle）
│                                  │
│  （此為隱藏成就，達成條件保密）    │
│                                  │
│         🔒 關閉                  │
└──────────────────────────────────┘
```

---

## 3. 進度條設計

### 3.1 外觀規格

| 屬性 | 值 | 說明 |
|------|-----|------|
| 高度 | `8px` | 纖細優雅 |
| 圓角 | `999px` | 全圓角 |
| 底色 | `rgba(255,255,255,0.1)` | 深色半透明 |
| 前景漸層 | 依 rarity 從暗到亮 | example: `#3b82f6 → #60a5fa` |
| 標記點 | 每道 milestone 下方有「⚪」記號 | 顯示所有里程碑位置 |

### 3.2 漸層配色（依稀有度）

```
common:    #64748b → #94a3b8   (灰色漸層)
uncommon:  #16a34a → #4ade80   (綠色漸層)
rare:      #2563eb → #60a5fa   (藍色漸層)
epic:      #7c3aed → #a78bfa   (紫色漸層)
legendary: #b45309 → #fbbf24   (金色漸層)
mythic:    #dc2626 → #ef4444   (紅色漸層，加上 pulse 動畫)
```

### 3.3 里程碑標記

進度條下方有等距的小圓點，代表每個里程碑位置：

```
  ┌──────────────────────────────────┐
  │  ██████████░░░░░░░░░░░░░░░░░░  │  8px 高度
  └──────────────────────────────────┘
      ●  ●  ●  ○  ○  ○  ○           ← 小圓點（4px）
      ✅ ✅ ✅ ▶ 🔒 🔒 🔒            ← 下方對齊的簡短狀態
```

- **●** 已達成的里程碑（實心，和進度條同色系）
- **○** 未達成的里程碑（空心，灰色）
- **▶** 當前目標里程碑（發光，加上微動畫）

### 3.4 完全解鎖時的進度條

當所有里程碑都達成時：
- 進度條 100% 填滿
- 加上掃光動畫（shimmer）
- 中央顯示 🏆 圖示

---

## 4. 里程碑列表互動

### 4.1 展開/收起動畫

```
[▼ 展開里程碑列表 (3/7)]
         ↓ 點擊
[▲ 收起里程碑列表 (3/7)]
  ✅ 初次報到      📍   1 次
  ✅ 漸入佳境      🌤️   5 次
  ✅ 持之以恆      🔥   10 次
  ▶ 勢如破竹      ⚡   15 次   ← 目標高亮
  🔒 鍛鍊有成      💎   20 次
  🔒 百練成鋼      🌟   25 次
  🔒 風雨無阻      💪   30 次
```

**動畫**: 
- 展開時：`max-height` 從 `0` → `500px`，配合 `opacity: 0 → 1`，時長 `0.3s ease-out`
- 收起時：反向，時長 `0.2s ease-in`
- 列表項逐條 `stagger` 延遲 `0.03s` 依次淡入

### 4.2 每一行里程碑的設計

```
┌────────────────────────────────────────┐
│  ✅ │ 📍 │ 初次報到    │ 普通  │ 1 次  │  ← 已完成
│  ✅ │ 🌤️ │ 漸入佳境    │ 普通  │ 5 次  │
│  ▶ │ 🔥 │ 持之以恆    │ 非凡  │ 10 次 │  ← ★ 進行中目標
│  🔒 │ 💎 │ 鍛鍊有成    │ 稀有  │ 20 次 │  ← 未達成
└────────────────────────────────────────┘
```

**三種行樣式**:

| 狀態 | 左側圖示 | 背景 | 邊框 |
|------|---------|------|------|
| ✅ 已完成 | 綠色的 check | `rgba(34,197,94,0.08)` | 無 |
| ▶ 進行中 | 藍色播放/箭頭 | `rgba(59,130,246,0.12)` | 左側 3px 藍色邊條 |
| 🔒 未達成 | 鎖頭 | 透明 | 無 |

### 4.3 預設展開邏輯

| 情況 | 預設狀態 | 原因 |
|------|---------|------|
| 進行中（1~N-1） | **展開** | 使用者最關心還差多少 |
| 全部完成 | **收起** | 不需要再看細節 |
| 未開始（0） | **展開** | 需要知道第一個門檻 |
| 隱藏成就 | **收起** | 沒有里程碑可顯示 |

### 4.4 按鈕文字變化

```
里程碑數量變化時的文字：

(0/7)  → [▼ 查看里程碑 (7 階)]
(1/7)  → [▲ 里程碑列表 (1/7)]
(3/7)  → [▲ 里程碑列表 (3/7)]    ← 已解鎖數量
(7/7)  → [▲ 全部完成！ (7/7)]    ← 全部完成
```

---

## 5. 動畫與微互動

### 5.1 進度條動畫

```
載入時：
  寬度從 0 → 目標百分比，時長 0.8s cubic-bezier(0.34,1.56,0.64,1)

里程碑達成瞬間：
  進度條閃爍一次 → 解鎖的里程碑圓點亮起 → 煙花粒子效果

鎖定狀態：
  進度條微微 pulse（透明度 0.5 ↔ 0.7）
```

### 5.2 當前目標標示動畫

```
▶ 圖示：左右輕微晃動 + 呼吸光效
  動畫: @keyframes breathe-target 
  0% { opacity: 0.7; transform: translateX(0) }
  50% { opacity: 1; transform: translateX(2px) }
  100% { opacity: 0.7; transform: translateX(0) }
```

### 5.3 激勵文字動態

```
根據差距動態變換文字，增加趣味性：

差距 1:  "🔥 再 1 次！就差一步了！"
差距 2~3: "⚡ 再 {n} 次即可達成「{name}」!"
差距 4~9: "🎯 再 {n} 次就能解鎖「{name}」"
差距 10+: "🏹 繼續努力，離「{name}」還有 {n} 次"
全部完成: "🎉 完美達成！全部 {n} 個里程碑！"
未開始:   "🎯 完成 {first} 即可解鎖第一個里程碑！"
```

### 5.4 彈窗進出動畫

```
開啟：
  backdrop: opacity 0 → 1, 0.2s
  modal: scale(0.9 → 1) + translateY(20px → 0)
         時長 0.35s cubic-bezier(0.34,1.56,0.64,1)

關閉：
  backdrop: opacity 1 → 0, 0.15s
  modal: scale(1 → 0.95) + opacity 1 → 0
         時長 0.15s ease-in
```

---

## 6. CSS 設計 Token

```css
/* 沿用 PIXEL_BADGE_STYLE 的設計語言，新增以下樣式 */

/* ── 進度條 ── */
.dex-progress-track {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
  position: relative;
}

.dex-progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
}

/* 稀有度漸層 */
.dex-progress-fill.rarity-common    { background: linear-gradient(90deg, #64748b, #94a3b8); }
.dex-progress-fill.rarity-uncommon  { background: linear-gradient(90deg, #16a34a, #4ade80); }
.dex-progress-fill.rarity-rare      { background: linear-gradient(90deg, #2563eb, #60a5fa); }
.dex-progress-fill.rarity-epic      { background: linear-gradient(90deg, #7c3aed, #a78bfa); }
.dex-progress-fill.rarity-legendary { background: linear-gradient(90deg, #b45309, #fbbf24); }
.dex-progress-fill.rarity-mythic    { background: linear-gradient(90deg, #dc2626, #ef4444); }

/* 100% 時的 shimmer 掃光 */
.dex-progress-fill.complete::after {
  content: "";
  position: absolute;
  top: 0; left: -40%;
  width: 40%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: dex-shimmer 2s ease-in-out infinite;
}

/* 里程碑標記點 */
.dex-milestone-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  position: absolute;
  top: -1px;
  transform: translateX(-50%);
  z-index: 2;
}
.dex-milestone-dot.done  { background: currentColor; opacity: 1; }
.dex-milestone-dot.next  { 
  background: currentColor; 
  opacity: 1; 
  box-shadow: 0 0 6px currentColor;
  animation: dex-dot-pulse 1.5s ease-in-out infinite;
}
.dex-milestone-dot.locked { 
  background: rgba(255,255,255,0.2); 
  border: 1.5px solid rgba(255,255,255,0.15); 
}

/* ── 里程碑列表展開/收起 ── */
.dex-milestone-list {
  overflow: hidden;
  transition: max-height 0.3s ease-out, opacity 0.25s ease-out;
}
.dex-milestone-list.collapsed {
  max-height: 0 !important;
  opacity: 0;
}
.dex-milestone-list.expanded {
  max-height: 500px;
  opacity: 1;
}

/* 行 item stagger 入場 */
.dex-milestone-item {
  animation: dex-item-in 0.3s ease-out both;
}
.dex-milestone-item:nth-child(1) { animation-delay: 0.02s; }
.dex-milestone-item:nth-child(2) { animation-delay: 0.04s; }
.dex-milestone-item:nth-child(3) { animation-delay: 0.06s; }
/* ... 依此類推（JS 直接 inline style 設定 delay） */

.dex-milestone-item.current {
  border-left: 3px solid #3b82f6;
  background: rgba(59, 130, 246, 0.12);
  border-radius: 6px;
}

/* ── 動畫 keyframes ── */
@keyframes dex-shimmer {
  0%   { left: -40%; }
  100% { left: 110%; }
}
@keyframes dex-dot-pulse {
  0%, 100% { box-shadow: 0 0 4px currentColor; }
  50%      { box-shadow: 0 0 10px currentColor, 0 0 20px currentColor; }
}
@keyframes dex-item-in {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes dex-breathe-target {
  0%, 100% { opacity: 0.7; transform: translateX(0); }
  50%      { opacity: 1; transform: translateX(3px); }
}

/* ── 彈窗進出 ── */
@keyframes dex-modal-in {
  from { opacity: 0; transform: scale(0.92) translateY(16px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes dex-modal-out {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0.95); }
}
```

---

## 7. 資料結構與 Props

### 7.1 `tieredAch` 物件（階段式成就的資料源）

```javascript
// 由 achievementDex.js 的 computeTierProgress() 產生
// 傳入 DexDetailModal 作為 props

const TIERED_PROGRESS = {
  // 成就基本資訊
  id: "checkin",
  name: "累積報到",
  desc: "完成今日任務報到，累積次數",
  icon: "📍",
  cat: "start",

  // 當前進度
  currentValue: 12,    // 目前的數值（報到 12 次）
  currentTierIndex: 2,  // 已達到的最高 tier index (0-based)
  currentTier: {        // 當前展現的 tier 資料
    count: 10, icon: "🔥", name: "持之以恆",
    rarity: "uncommon", desc: "累積報到 10 次",
  },
  nextTier: {           // 下一個目標（null 代表全部完成）
    count: 15, icon: "⚡", name: "勢如破竹",
    rarity: "uncommon", desc: "累積報到 15 次",
  },
  progress: {           // 進度條計算
    current: 12,         // 當前值（從上一 tier 的門檻起算）
    currentLabel: "12",  // 顯示用文字
    next: 15,            // 下一個門檻值
    nextLabel: "15",
    percent: 40,         // 進度百分比 0~100
    percentLabel: "40%",
    gap: 3,              // 差距（next - current）
    isComplete: false,   // 是否已達最終里程碑
  },

  // 里程碑列表
  tiers: [
    { count: 1,  icon: "📍", name: "初次報到", rarity: "common",
      desc: "完成第一次今日任務報到", unlocked: true, isCurrent: false },
    { count: 5,  icon: "🌤️", name: "漸入佳境", rarity: "common",
      desc: "累積報到 5 次", unlocked: true, isCurrent: false },
    { count: 10, icon: "🔥", name: "持之以恆", rarity: "uncommon",
      desc: "累積報到 10 次", unlocked: true, isCurrent: false },
    { count: 15, icon: "⚡", name: "勢如破竹", rarity: "uncommon",
      desc: "累積報到 15 次", unlocked: false, isCurrent: true },  // ← 目標
    { count: 20, icon: "💎", name: "鍛鍊有成", rarity: "rare",
      desc: "累積報到 20 次", unlocked: false, isCurrent: false },
    { count: 25, icon: "🌟", name: "百練成鋼", rarity: "rare",
      desc: "累積報到 25 次", unlocked: false, isCurrent: false },
    { count: 30, icon: "💪", name: "風雨無阻", rarity: "epic",
      desc: "累積報到 30 次", unlocked: false, isCurrent: false },
  ],

  // 統計
  totalTiers: 7,
  unlockedCount: 3,
};
```

### 7.2 `DexDetailModal` 的 Props

```javascript
function DexDetailModal({ 
  a,            // 成就資料（維持原有格式，新增 tierProgress 屬性）
  onClose,      // 關閉 callback
}) {
  // a.tierProgress 存在 → 階段式成就，顯示進度條+里程碑列表
  // a.tierProgress 不存在 → 一次性成就，維持現有顯示
}
```

### 7.3 `computeTierProgress()` 工具函式

```javascript
// src/lib/achievementDex.js — 新增

/**
 * 計算階段式成就的當前進度
 * @param {Object} tieredAch - TIERED_ACHIEVEMENTS 中的定義
 * @param {Object} ctx - 上下文（含 member, monsterDex 等）
 * @returns {Object} tierProgress - 供 DexDetailModal 使用的格式
 */
export function computeTierProgress(tieredAch, ctx) {
  const value = tieredAch.getValue(ctx);
  const tiers = tieredAch.tiers;
  
  // 找到已達到的最高 tier index
  let currentTierIdx = -1;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (value >= tiers[i].count) { currentTierIdx = i; break; }
  }
  
  const nextTierIdx = currentTierIdx + 1;
  const isComplete = nextTierIdx >= tiers.length;
  
  // 計算進度百分比
  const prevThreshold = currentTierIdx >= 0 ? tiers[currentTierIdx].count : 0;
  const nextThreshold = isComplete ? tiers[tiers.length - 1].count : tiers[nextTierIdx].count;
  const range = nextThreshold - prevThreshold;
  const progress = range > 0 ? (value - prevThreshold) / range : 1;
  
  // 組裝里程碑列表
  const tierList = tiers.map((t, i) => ({
    ...t,
    unlocked: i <= currentTierIdx,
    isCurrent: i === nextTierIdx && !isComplete,
  }));
  
  return {
    currentValue: value,
    currentTierIndex: currentTierIdx,
    currentTier: currentTierIdx >= 0 ? tiers[currentTierIdx] : null,
    nextTier: isComplete ? null : tiers[nextTierIdx],
    progress: {
      current: value,
      currentLabel: String(value),
      next: nextThreshold,
      nextLabel: String(nextThreshold),
      percent: Math.round(progress * 100),
      gap: isComplete ? 0 : nextThreshold - value,
      isComplete,
    },
    tiers: tierList,
    totalTiers: tiers.length,
    unlockedCount: currentTierIdx + 1,
  };
}
```

---

## 8. 關鍵實作策略

### 8.1 MemberDex.jsx 修改要點

```javascript
// 在 DexDetailModal 中判斷是否為階段式成就
function DexDetailModal({ a, onClose }) {
  const [milestonesOpen, setMilestonesOpen] = useState(true);
  
  // 預設展開邏輯
  useEffect(() => {
    if (!a.tierProgress) return;
    // 全部完成 → 收起；未開始或進行中 → 展開
    setMilestonesOpen(!a.tierProgress.progress.isComplete);
  }, [a.tierProgress]);
  
  // 階段式成就的 UI
  if (a.tierProgress) {
    return <TieredDetailContent 
      progress={a.tierProgress}
      milestonesOpen={milestonesOpen}
      setMilestonesOpen={setMilestonesOpen}
      onClose={onClose}
    />;
  }
  
  // 原有一次性成就的 UI（round / special / cohort / 一般）
  return <SingleAchievementDetail a={a} onClose={onClose} />;
}
```

### 8.2 子元件拆分

```
DexDetailModal
├── TieredDetailContent       ← 階段式成就主體
│   ├── TierBadge             ← 大圖示（rarity ring）
│   ├── TierName              ← 當前 tier 名稱
│   ├── ProgressBar           ← 進度條（含里程碑圓點）
│   ├── GapMessage            ← 差距提示文字
│   ├── MilestoneToggle       ← 展開/收起按鈕
│   └── MilestoneList         ← 里程碑列表（含 stagger 動畫）
│       └── MilestoneItem × N
│
└── SingleAchievementDetail   ← 一次性成就（現有邏輯保留）
    ├── BadgeIcon
    ├── AchievementName
    ├── RarityLabel
    ├── Description
    └── CloseButton
```

### 8.3 一次性成就相容性

對於**非階段式成就**（如：
- `cert_blue`、`archer_no_20` 等一次性成就
- 屆數格子（round grid）
- 特殊成就（special grants）
- 期數成就（cohort）

維持現有 `DexDetailModal` 顯示邏輯**完全不變**。只需在 `a.tierProgress === undefined` 時走原路徑。

### 8.4 資料傳遞流程

```
MemberDex.jsx (cellsFor)
  │
  ├── AUTO_ACHIEVEMENTS.filter(...)
  │   └── 每個成就 a
  │       ├── a.tierProgress = computeTierProgress(a, ctx)  ← 新增
  │       └── a.unlocked = a.check(ctx)
  │
  ├── DexCell(a)
  │   └── onTap → setDetail(a)
  │
  └── detail && DexDetailModal(a, onClose)
```

---

## 9. 開發時程估算

| 步驟 | 內容 | 預估工時 |
|------|------|---------|
| 1 | `achievementDex.js` 新增 `computeTierProgress()` | ~15 行 / 15 分鐘 |
| 2 | `MemberDex.jsx` 在 `cellsFor()` 中呼叫 `computeTierProgress` | ~5 行 / 5 分鐘 |
| 3 | 新增 `TieredDetailContent` 元件 + 子元件 | ~120 行 / 45 分鐘 |
| 4 | 新增 CSS（進度條、里程碑列表動畫） | ~60 行 / 20 分鐘 |
| 5 | 整合至現有 `DexDetailModal` | ~10 行 / 10 分鐘 |
| 6 | 測試各狀態（進行中/完成/未開始/隱藏） | ~15 分鐘 |
| | **總計** | **~110 分鐘** |

---

## 10. 視覺對照：Before vs After

| 項目 | Before | After |
|------|--------|-------|
| 未解鎖顯示 | 🔒 尚未解鎖 | 進度條 0/n + 差距提示 + 下一個里程碑 |
| 已解鎖顯示 | ✅ 已解鎖 | 進度條 + 當前 tier + 下一個目標 |
| 多階成就 | 7 個獨立格子 | 1 格 + 彈窗內里程碑列表 |
| 進度反饋 | 無 | 百分比 + 差距數字 + 動畫 |
| 使用者行動誘因 | 無 | 「再 3 次即可達成」 |
| 全部完成 | 無特別處理 | 100% 進度條 + 慶祝文字 |

---

*設計日期: 2026-07-16*
*設計者: Buffy (AI Assistant)*
