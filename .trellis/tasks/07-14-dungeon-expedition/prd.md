# 地下城終戰模式（發掘→三層探險→Boss）

> 建立日期：2026-07-14
> 狀態：規劃中

---

## 概述

全新地下城玩法，與現有地圖探索模式並存。玩家日常自動累積發掘進度（練箭加速），進度 100% 時手動揭曉地下城，進入固定三層結構探險，最後挑戰 Boss 並獲得獎勵。

---

## 核心流程

```
每天登入 +10 / 報到 +10 / 每箭 +0.3
         ↓
   發掘進度 0% → ... → 100%
         ↓
   🔍 手動點擊揭曉（決定難度 + 種族）
   🔧 可花隨機 500~2000 金幣強化一級
         ↓
   ⚔️ 三層探險
         ↓
   🎁 打贏 Boss → 寶箱族獎勵房
   ❌ 全滅/關閉 → 進度歸零，全區廣播「XXX 挑戰地下城失敗」
```

---

## 一、發掘階段

### 進度累積

| 觸發點 | 增加量 | 位置 |
|--------|--------|------|
| 每日首次登入 | +10 | MemberApp 登入 init |
| 報到（checkin） | +10 | `submitCheckin` / `approveCheckin` |
| 每射一箭 | +0.3 | `addRoundArrows` hook |

- 純登入+報到：5 天滿 100%
- 有練箭（30箭）：最快 2-3 天滿

### 資料結構：`members/{memberId}.dungeonExcavation`

```js
{
  progress: 0,                // 0~100
  dailyArrowsUsed: 0,         // 今日用於稀有度骰的箭數
  lastActiveDate: "2026-07-03", // 每日重置
  pendingReveal: null,        // 100%時鎖定 { family, difficulty, isHidden }
  revealedAt: null,           // 揭曉時間戳
  completed: false,           // 打完後 true，重置進度
}
```

### 稀有度骰子（難度決定）

練箭越多 → 高難度機率越高：

```js
let weights = { common: 60, rare: 30, hidden: 10 };
if (dailyArrowsUsed >= 30) { common -= 10; rare += 10; }
if (dailyArrowsUsed >= 60) { rare -= 5;   hidden += 15; }
if (dailyArrowsUsed >= 90) { rare -= 5;   hidden += 10; }
```

| 稀有度 | 對應難度 |
|--------|---------|
| common | T1 普通級 |
| rare | T2~T4 |
| hidden | T6 神話級 or 寶藏地下城 |

### 金幣強化

揭曉時可花費隨機金幣（500~2000）強化一級：
- 費用取決於運氣（每次 random）
- 可連續強化，費用重新 random
- 不可降級

---

## 二、三層探險結構（取代地圖探索）

```
第1層 — 探索層
  少量怪物（2-3 種，弱化版，從六族隨機抽不同種）
  大量事件 / 陷阱 / 商人

第2層 — 戰鬥層
  較多怪物（3-4 種，普通/強悍版，從六族隨機抽不同種）
  陷阱 / 寶箱 / 少量事件

第3層 — 王關層
  精英（強悍版，從六族隨機抽一種）
  → 休息區
  → 商人
  → Boss（Boss 版，從六族隨機抽一種）
  → 🎁 寶箱族獎勵房
```

### 每層怪物的 variant 規則

| 難度級別 | Tier | 第1層 | 第2層 | 精英 | Boss |
|---------|------|-------|-------|------|------|
| 普通級 | T1 | 弱化T1 | 普通T1 | 強悍T1 | Boss級T1 |
| 稀有級 | T2 | 弱化T2 | 普通T2 | 強悍T2 | Boss級T2 |
| 精英級 | T3 | 弱化T3 | 普通T3 | 強悍T3 | Boss級T3 |
| 強悍級 | T4 | 弱化T4 | 普通T4 | 強悍T4 | Boss級T4 |
| 頭目級 | T5 | 弱化T5 | 普通T5 | 強悍T5 | Boss級T5 |
| 神話級 | T6 | 弱化T6 | 普通T6 | 強悍T6 | Boss級T6 |

---

## 三、寶箱族（第 7 族）

### 定位
- 非戰鬥用的獎勵種族
- 出現在第 3 層獎勵房（Boss 打完後）
- 外觀：經典寶箱怪（巨大寶箱 + 眼睛 + 舌頭）

### 怪物資料

```js
FAMILIES.treasure = { label:"寶箱族", icon:"🎁", color:"#fbbf24" }

treasure_1: 寶箱怪（common）HP:100 ATK:5 DEF:50
treasure_2: 黃金寶箱怪（rare）
treasure_3: 鑽石寶箱怪（elite）
treasure_4: 祕銀寶箱怪（fierce）
treasure_5: 遠古寶箱怪（boss）
treasure_6: 神話寶箱怪（mythic）
```

### 掉落特色
- 金幣倍率 ×3
- 寶箱率 100%
- 材料池全稀有
- 不攻擊，只會防禦

---

## 四、難度擴增：4 級 → 6 級

| 級別 | Tier | 命名 | 說明 |
|-----|------|------|------|
| 1 | common | 普通級 | 現有 normal |
| 2 | rare | 稀有級 | 🆕 新增 |
| 3 | elite | 精英級 | 現有 advanced |
| 4 | fierce | 強悍級 | 現有 hard |
| 5 | boss | 頭目級 | 🆕 新增 |
| 6 | mythic | 神話級 | 現有 hell（重新命名） |

- 保留現有 4 難度資料（向後相容地圖探索模式）
- 終戰模式使用全新的 6 級難度系統

---

## 五、失敗處理

| 情況 | 處理 |
|------|------|
| 全滅（所有成員 HP=0） | 刪除地下城，進度歸零，全區廣播 |
| 玩家自行關閉 | 同上 |
| 已獲得獎勵 | 不回收（打到哪層的獎勵都保留） |

---

## 六、與現有系統關係

| 項目 | 關係 |
|------|------|
| 地圖探索模式 | 保留不動，從 DungeonLobby 分頁切換 |
| 首殺系統 | 終戰模式不觸發首殺（地圖模式保留） |
| 收藏品 | 終戰模式掉落收藏品（與地圖模式一致） |
| 符文/合約 | 探索模式保留，終戰模式簡化或移除 |
| 多人組隊 | 初期為單人模式，未來可擴充 |

---

## 七、實作 Phase 規劃

### Phase A：發掘進度資料層
- `src/lib/dungeonExcavation.js`（新檔）
- `db.js` addRoundArrows hook
- `firestore.rules` 更新

### Phase B：發掘 UI
- `DungeonExcavationTab.jsx`（新檔，進度條）
- `DungeonRevealOverlay.jsx`（新檔，揭曉動畫）
- `DungeonLobby.jsx` 分頁修改

### Phase C：資料擴增
- `dungeonData.js` 難度 4→6 級
- `monsterData.js` 混種抽怪函式 + 寶箱族
- `monsterRegistry.js` 寶箱族掉落表
- `DungeonTreasureRoom.jsx`（新檔）

### Phase D：三層流程
- `DungeonExpedition.jsx`（新檔，主流程）
- `DungeonController.jsx` 路由
- `dungeonDb.js` 失敗廣播

### Phase E：整合與測試
- MemberApp/AdminApp 登入 init
- 全面測試 + 平衡調整

---

## 八、修改/新增檔案總清單

### 新檔案（5 個）

| 檔案 | 用途 |
|------|------|
| `src/lib/dungeonExcavation.js` | 發掘進度核心邏輯（累積/骰子/強化/揭曉） |
| `src/components/dungeon/DungeonExpedition.jsx` | 三層探險主流程 |
| `src/components/dungeon/DungeonRevealOverlay.jsx` | 進度100%揭曉動畫 overlay |
| `src/components/dungeon/DungeonExcavationTab.jsx` | DungeonLobby 發掘分頁 |
| `src/components/dungeon/DungeonTreasureRoom.jsx` | 寶箱族獎勵房 |

### 修改檔案（10 個）

| 檔案 | 修改內容 |
|------|---------|
| `src/lib/dungeonData.js` | 難度 4→6 級、三層結構設定、混種權重表 |
| `src/lib/monsterData.js` | 第7族寶箱族、混種抽怪函式 |
| `src/lib/monsterRegistry.js` | 寶箱族掉落表（高金幣、高寶箱率） |
| `src/lib/db.js` | `addRoundArrows` 內 hook 發掘進度 |
| `src/lib/dungeonDb.js` | 失敗廣播函式 |
| `src/lib/score.js` | 可能的新計分需求 |
| `src/components/dungeon/DungeonLobby.jsx` | 分頁切換 + 發掘分頁入口 |
| `src/components/dungeon/DungeonController.jsx` | 終戰模式路由 |
| `src/components/dungeon/DungeonBattleRoom.jsx` | 簡化或適配終戰模式需求 |
| `src/pages/MemberApp.jsx` | 登入 init 發掘進度 |
| `src/pages/AdminApp.jsx` | 登入 init 發掘進度 |
| `firestore.rules` | 新欄位規則 |

---

## 九、UI 示意

### DungeonLobby 分頁

```
┌──────────────────────────────────────────┐
│  [🏹 終戰模式]     [🗺️ 地圖探索]          │
├──────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  發掘進度                        │   │
│  │  ████████████░░░░░░░░  60%      │   │
│  │  📅 每日自動 +10                │   │
│  │  ✅ 報到 +10                    │   │
│  │  🏹 今日已射 45 箭（+13.5）     │   │
│  │  稀有度骰子機率 ↑               │   │
│  │                                  │   │
│  │  [✨ 出發！]（100% 時可點擊）    │   │
│  └──────────────────────────────────┘   │
│                                          │
│  💡 練箭越多，發現高難度的機率越高       │
│  目前可發現最高：精英級（T3）            │
│  再射 15 箭可解鎖強悍級（T4）           │
└──────────────────────────────────────────┘
```

### 揭曉動畫

```
┌──────────────────────────────────────────┐
│                                          │
│                                          │
│         ✨ 地下城揭曉！ ✨               │
│                                          │
│       🏔️ 山嶺族 · 強悍級（T4）         │
│                                          │
│         🔧 花 1,247 金幣強化一級        │
│                                          │
│         [⚔️ 出發]  [❌ 放棄]            │
│                                          │
│                                          │
└──────────────────────────────────────────┘
```
