# 🎖️ 圖鑑系統重整規劃書

> **檔案位置**: `docs/achievement-dex-redesign-plan.md`
> **相關檔案總覽**: 
> - `src/lib/achievementDex.js` — 成就定義、自動判定邏輯、統計
> - `src/components/member/MemberDex.jsx` — 圖鑑前端顯示元件
> - `src/components/member/BadgeEarnPopup.jsx` — 徽章獲得動畫彈窗
> - `src/components/BadgeSVG.jsx` — 徽章 SVG 框架元件
> - `src/lib/constants.js` — 徽章權重、檢定等級等常數
> - `src/components/admin/AdminDexGrant.jsx` — 後台授予系統
> - `src/components/admin/AdminAchievements.jsx` — 成就章任務管理

---

## 📋 目錄

1. [現狀分析](#1-現狀分析)
2. [死成就清單（永遠無法完成）](#2-死成就清單永遠無法完成)
3. [核心問題](#3-核心問題)
4. [重設計劃](#4-重設計劃)
5. [分階段實作步驟](#5-分階段實作步驟)
6. [檔案連結索引](#6-檔案連結索引)

---

## 1. 現狀分析

### 1.1 成就總量爆炸

`AUTO_ACHIEVEMENTS` 陣列目前包含**數百筆**成就，透過動態產生（for loop）在模組載入時 push 進去。包括：

| 類別 | 數量估算 | 說明 |
|------|---------|------|
| 啟程 (start) | ~10 | 報到、月卡 |
| 射手證 (cert) | ~11 | 藍/金證、編號成就 |
| 檢定 (level) | ~21 | 裸弓/獵弓/傳統 各5級 + 跨弓組合 |
| 收藏 (collect) | ~9 | 肥貓/積分/成就章 + 組合章 |
| 實體賽 (physical) | 依設定 | 每屆一個格子 |
| 積分賽 (point) | 依設定 | 每屆一個格子 |
| 特殊 (special) | ~7 + 48 | 擊敗教練 + 世界王獎盃 |
| 打怪 (monster) | **數百** | 36怪各5殺 = 180 + 寶箱成就(28) + 動態各族分級(36) + 其他 |
| 決鬥 (duel) | ~16 | 勝場、勝率、完美決鬥 |
| 煉製/藥水 (forge) | ~7 + 藥水每支 | 合成 + 藥水使用 |
| 怪物卡 (card) | ~8 | 卡片收集 |
| 冒險者公會 (guild) | ~8 | XP、晉階、滿等 |
| 地下城 (dungeon) | ~70+ | 拾獲數、各族分階、首通章 |

**影響**: 每個分類頁面 grid 顯示 4 欄，會超長捲動！

### 1.2 畫面顯示問題

- `MemberDex.jsx` 使用 `grid-cols-4` 顯示所有成就格
- 同一系列的成就（如 checkin_1 ~ checkin_30）全部同時顯示 -> **7 個獨立格子佔畫面**
- 使用者無法直觀知道「下一個里程碑還差多少」
- `DexDetailModal` 只顯示「已解鎖/未解鎖」，缺少進度資訊

---

## 2. 死成就清單（永遠無法完成）

以下成就的 `check` 函式永遠回傳 `false`，**永遠無法解鎖**：

| 成就 ID | 名稱 | 原因 |
|---------|------|------|
| `card_first` | 月卡初啟 | 月卡功能尚未實裝，`check: _c => false` |
| `card_renew` | 月卡續射 | 月卡功能尚未實裝，`check: _c => false` |
| `drop_rare` | 初嚐甜頭 | 打怪掉寶系統尚未連結成就統計，`check: _c => false` |
| `drop_epic` | 奇蹟降臨 | 同上 |
| `drop_legendary` | 傳說之物 | 同上 |
| `drop_mythic` | 神話現世 | 同上 |
| `brew_all` | 全能藥師 | 需要製作全部消耗品，但 `futureFeature` 的藥水不存在（隱藏） |
| `potion_all_9` | 全種藥師 | 同上（隱藏） |

**建議處理**:
- `card_first` / `card_renew`：保留但保持 `check: false`，待月卡實裝後再啟用
- `drop_rare` ~ `drop_mythic`：若掉寶統計已實裝（`lootTable.js`），應改為檢查 `c.lootStats?.rarityCounts?.rare >= 1` 等
- `brew_all` / `potion_all_9`：已正確排除 `futureFeature` 藥水，但需確認 `POTIONS` 陣列沒有被污染

### 2.1 潛在死成就（極難達成）

| 成就 ID | 名稱 | 問題 |
|---------|------|------|
| `dex_all36` | 圖鑑完成 | 需要擊敗全部 36 隻怪物，但匹配系統可能不會出所有怪物 |
| `mythic_all` | 封神之路 | 需要擊敗全部 6 隻神話怪物，同上 |
| `collectible_master` | 圖鑑大師 | 需要 240 件收藏品全部收集，極度困難 |

這些不是死成就，而是「終局內容」，可以保留但標示清楚。

---

## 3. 核心問題

### 3.1 ❌ 階段式成就沒有合併顯示

**目前**: 報到成就佔 7 個格子：checkin_1, checkin_5, checkin_10, checkin_15, checkin_20, checkin_25, checkin_30

**期望**: 只顯示一個「報到」成就格，根據當前次數自動升級圖示和顏色。點擊後彈窗顯示「目前進度: 12/15 次 → 下一個里程碑: 勢如破竹 (15次)」

影響範圍（需要合併的系列）：
| 系列 | 現有數量 | 合併後 | 里程碑 |
|------|---------|--------|--------|
| 報到 checkin | 7 | 1 | 1, 5, 10, 15, 20, 25, 30 |
| 怪物擊殺 monster_* | 4 | 1 | 1, 5, 10, 30 |
| 頭目擊殺 monster_mvp* | 2 | 1 | 1, 10 |
| 決鬥勝場 duel_win* | 4 | 1 | 1, 5, 10, 25 |
| 藥水合成 brew_* | 3 | 1 | 1, 5, 10 |
| 藥水使用 potion_any_* | 4 | 1 | 1, 10, 30, 50 |
| 卡片收集 card_* | 5 | 1 | 1, 5, 10, 15, 20 |
| 寶箱開啟 chest_*_open_* | 28 | 7 | 每種寶箱整合為 1 格 |
| 怪物擊殺次數 kill_* | 180 | 36 | 每種怪物整合為 1 格 |
| 藥水使用 potion_* | 各藥水分開 | 每藥水 1 格 | 依藥水稀有度 |
| 地下城 collectible_* | 5 | 1 | 1, 10, 60, 150, 全收集 |

### 3.2 ❌ 詳細彈窗缺少進度條

目前 `DexDetailModal` 對未解鎖成就只顯示「🔒 尚未解鎖」，沒有告訴使用者距離解鎖還差多少。

### 3.3 ❌ 動態產生的成就導致計數混亂

`computeDexStats` 需要計算所有成就總數，但動態成就（如殺怪次數、各族分級）會隨資料量變動。

### 3.4 ❌ 部分成就分類不準確

- `chest_*` 開箱成就被歸類在 `monster` 類別，但開箱不限於打怪模式
- `wb_trophy_*` 世界王獎盃被歸類在 `special` 但內容與世界王相關

---

## 4. 重設計劃

### 4.1 階段式成就系統（里程碑系統）

**新資料結構** — `TIERED_ACHIEVEMENTS`：

```javascript
// 每個階段式成就只需要佔 1 格
{
  id: "checkin",
  cat: "start",
  icon: "📍",  // 基本圖示
  name: "累積報到",
  desc: "完成今日任務報到，累積次數",
  tiers: [
    { count: 1,  rarity: "common",   icon: "📍", name: "初次報到",    desc: "完成第一次今日任務報到" },
    { count: 5,  rarity: "common",   icon: "🌤️", name: "漸入佳境",    desc: "累積報到 5 次" },
    { count: 10, rarity: "uncommon", icon: "🔥", name: "持之以恆",    desc: "累積報到 10 次" },
    { count: 15, rarity: "uncommon", icon: "⚡", name: "勢如破竹",    desc: "累積報到 15 次" },
    { count: 20, rarity: "rare",     icon: "💎", name: "鍛鍊有成",    desc: "累積報到 20 次" },
    { count: 25, rarity: "rare",     icon: "🌟", name: "百練成鋼",    desc: "累積報到 25 次" },
    { count: 30, rarity: "epic",     icon: "💪", name: "風雨無阻",    desc: "累積報到 30 次" },
  ],
  // 計算當前值
  getValue: c => c.checkinCount || 0,
}
```

**顯示邏輯**:
- 只顯示**最高已達到的 tier**（或未解鎖時顯示最低 tier 的灰色版本）
- 圖示、稀有度邊框隨當前 tier 變化（直接替換，不是全部顯示）
- 點擊後彈窗顯示進度條

**彈窗進度條顯示**:
```
🎖️ 累積報到

當前進度: 12 次

[████████░░░░░░░░░░░░] 12/15

下一個里程碑: 勢如破竹（15 次）🔥
差 3 次即可解鎖！

里程碑列表:
✅ 初次報到 (1次)     📍
✅ 漸入佳境 (5次)     🌤️
✅ 持之以恆 (10次)    🔥
⬜ 勢如破竹 (15次)    ⚡  ← 下一個
⬜ 鍛鍊有成 (20次)    💎
⬜ 百練成鋼 (25次)    🌟
⬜ 風雨無阻 (30次)    💪
```

### 4.2 資料結構遷移

```
Before:                    After:
AUTO_ACHIEVEMENTS  ──>    TIERED_ACHIEVEMENTS (階段式)
                            + 
                           SINGLE_ACHIEVEMENTS (一次性，如編號成就、晉階成就)
                            +
                           SPECIAL_GRANTS (後台授予，不變)
```

**一次性成就**（不屬於階段系列，保持原樣）：
- 射手證相關 (cert_blue, cert_gold, cert_*_perfect)
- 射手證編號 (archer_no_20 ~ 500)
- 跨弓組合 (multi_*, all_*)
- 收藏組合章 (set_lowest, set_mid, set_top)
- 六族征服、圖鑑完成 (dex_all6, dex_all36)
- 神話相關 (mythic_first, mythic_all)
- 決鬥特殊 (duel_flawless, duel_flawless5)
- 冒險者公會晉階 (guild_*)
- 地下城成就 (collectible_*)
- 屆數成就 (physical/point rounds)
- 期數成就 (cohort)
- 特殊成就 (SPECIAL_GRANTS)

### 4.3 需要合併的系列一覽

#### Phase 1 — 明顯可合併的系列

| 合併後 ID | 分類 | 目前格子數 | 合併後格數 | 里程碑值 |
|-----------|------|-----------|-----------|---------|
| `checkin` | start | 7 → **1** | -90% | 1,5,10,15,20,25,30 |
| `monster_kills` | monster | 4 → **1** | -75% | 1,5,10,30 |
| `boss_kills` | monster | 2 → **1** | -50% | 1,10 |
| `duel_wins` | duel | 4 → **1** | -75% | 1,5,10,25 |
| `brew` | forge | 3 → **1** | -67% | 1,5,10 |
| `potion_usage` | forge | 4 → **1** | -75% | 1,10,30,50 |
| `card_collect` | card | 5 → **1** | -80% | 1,5,10,15,20 |

#### Phase 2 — 動態產生的巨量系列

這些需要更謹慎處理，因為是 for loop 動態生成的：

| 系列 | 目前數量 | 合併後 | 策略 |
|------|---------|--------|------|
| `kill_{monster}_*` | 36×5=180 | 每怪1格=36 | 每種怪物只顯示最高殺數 |
| `chest_{type}_open_*` | 7×4=28 | 每箱1格=7 | 每種寶箱只顯示最高里程碑 |
| `potion_{id}_*` | 各藥水 | 每藥水1格 | 依稀有度不同里程碑數 |
| `dex_{fam}_t*` | 6×6=36 | 每族1格=6 | 各族整合為1格，顯示最高級 |
| `dungeon_{fam}_*` | 每族6個 | 每族1格=6 | 各族整合 |

#### 合併總效果

| 指標 | 目前 | 合併後 | 節省 |
|------|-----|-------|------|
| 啟程 (start) | ~10 | ~5 | 50% |
| 打怪 (monster) | ~280+ | ~60 | 79% |
| 決鬥 (duel) | ~16 | ~12 | 25% |
| 煉製/藥水 (forge) | ~30+ | ~15 | 50% |
| 怪物卡 (card) | ~8 | ~4 | 50% |
| 地下城 (dungeon) | ~70+ | ~20 | 71% |
| 小計自動成就 | ~414 | ~116 | **72% 減量** |

---

## 5. 分階段實作步驟

### Phase 1 — 資料結構改造（`src/lib/achievementDex.js`）

1. **新增 `TIERED_ACHIEVEMENTS` 陣列**
   - 定義階段式成就的通用介面
   - 包含 `tiers[]`、`getValue`、`currentTier()` 方法

2. **保留 `SINGLE_ACHIEVEMENTS` 為一次性成就**
   - 將非階段性的成就從 AUTO_ACHIEVEMENTS 搬過來

3. **新增工具函式**
   - `getCurrentTier(tieredAch, ctx)` — 回傳當前達到的 tier
   - `getNextTier(tieredAch, ctx)` — 回傳下一個里程碑
   - `getProgress(tieredAch, ctx)` — 回傳 { current, next, progress% }

4. **更新 `computeDexStats`**
   - 納入階段式成就的計算邏輯

### Phase 2 — 前端合併顯示（`src/components/member/MemberDex.jsx`）

1. **修改 `DexCell` 元件**
   - 階段式成就：顯示當前最高 tier 的外觀（圖示+稀有度）
   - 點擊時傳入完整 tier 資訊

2. **改造 `DexDetailModal`**
   - 階段式成就：顯示進度條、下一個里程碑、差距
   - 里程碑列表可展開查看

3. **進度條視覺設計**
   ```
   [████████░░░░░░░░░░░░] 12/15
   ⚡ 差 3 次達「勢如破竹」
   ```

### Phase 3 — 修復死成就

1. 掉落成就 (`drop_rare` ~ `drop_mythic`)
   - 確認 `lootTable.js` 是否有紀錄掉寶統計
   - 若無，新增統計欄位後修正 check

2. 保留月卡成就標記為 `futureFeature`

### Phase 4 — 分類優化

1. 將 `chest_*` 從 `monster` 搬到新的 `loot` 分類或留在 `monster`
2. 將 `wb_trophy_*` 從 `special` 搬到新的 `worldboss` 分類

### Phase 5 — 統計與回饋增強

1. 進度提示 Toast：當接近里程碑時（如報到 13/15）提示
2. 分類頁面加入該分類完成進度條

---

## 6. 核心實作關聯圖

```
users/                          ← Firestore
└── members/{id}
    ├── certification           ← 射手證資料
    ├── certRecords[]           ← 年度檢定紀錄
    ├── dailyQuestCount         ← 報到次數
    ├── dungeonCollectibles{}   ← 地下城收藏品
    ├── fatCat/score/achievement ← 徽章資料
    ├── adventurerXP            ← 冒險者經驗
    ├── promotionDone[]         ← 晉階紀錄
    └── ...                     ← 其他

achievementDex.js               ← 成就定義層
├── TIERED_ACHIEVEMENTS[]       ← 階段式成就（新建）
├── SINGLE_ACHIEVEMENTS[]       ← 一次性成就（從 AUTO_ACHIEVEMENTS 拆分）
├── AUTO_ACHIEVEMENTS[]         ← 棄用，改由上面兩個取代
├── SPECIAL_GRANTS[]            ← 後台授予成就（保留）
├── computeDexStats()           ← 統計計算
└── helper functions            ← bowAtLeast, etc.

db.js                           ← Firestore 讀寫層
├── subscribeMonsterDex()
├── subscribeCraftStats()
├── subscribeChestStats()
├── subscribePotionDex()
└── subscribeCardCollection()

MemberDex.jsx                   ← 前端顯示層
├── DexCell (成就格)             ← 改造為支援階段式顯示
├── DexDetailModal (詳情彈窗)    ← 加入進度條+里程碑列表
├── DexToast (解鎖提示)
└── RoundGrid (屆數格)
```

---

## 7. 檔案連結索引

> 以下為其他 AI Agent 可以直接讀取的檔案路徑：

### 核心定義檔
- [`src/lib/achievementDex.js`](../src/lib/achievementDex.js) — **主要修改對象**：成就定義、統計計算
- [`src/lib/constants.js`](../src/lib/constants.js) — BADGE_WEIGHTS、檢定等級計算
- [`src/lib/itemData.js`](../src/lib/itemData.js) — POTIONS 陣列（煉製成就用）

### 前端元件
- [`src/components/member/MemberDex.jsx`](../src/components/member/MemberDex.jsx) — **主要修改對象**：圖鑑顯示、DexCell、DexDetailModal
- [`src/components/member/BadgeEarnPopup.jsx`](../src/components/member/BadgeEarnPopup.jsx) — 徽章獲得動畫
- [`src/components/BadgeSVG.jsx`](../src/components/BadgeSVG.jsx) — 徽章 SVG 框架

### 後台管理
- [`src/components/admin/AdminDexGrant.jsx`](../src/components/admin/AdminDexGrant.jsx) — 成就授予管理
- [`src/components/admin/AdminAchievements.jsx`](../src/components/admin/AdminAchievements.jsx) — 成就章任務管理

### 資料庫層
- [`src/lib/db.js`](../src/lib/db.js) — Firestore 訂閱/寫入函式（subscribeMonsterDex 等）
- [`src/lib/duelDb.js`](../src/lib/duelDb.js) — 決鬥統計讀取
- [`src/lib/dungeonCollectibles.js`](../src/lib/dungeonCollectibles.js) — 地下城收藏品定義
- [`src/lib/worldBossData.js`](../src/lib/worldBossData.js) — 世界王獎盃定義

### 相關系統
- [`src/lib/monsterData.js`](../src/lib/monsterData.js) — MONSTERS 陣列 + calcArcherStats
- [`src/lib/adventurerSystem.js`](../src/lib/adventurerSystem.js) — levelFromXP
- [`src/lib/cohort.js`](../src/lib/cohort.js) — 期數計算
- [`src/lib/lootTable.js`](../src/lib/lootTable.js) — 掉寶系統（掉落成就相關）

---

## 8. 總結

### 預期成效

| 指標 | 改善前 | 改善後 |
|------|-------|-------|
| 成就總格數 | ~400+ | ~120 |
| 頁面捲動長度 | 非常長 | 適中 |
| 使用者理解度 | 低（不知道還差多少） | 高（進度條+差距提示） |
| 可完成性 | 部分永遠無法完成 | 全部可完成或明確標示 |
| 維護性 | 低（動態產生混亂） | 高（結構化 tier 系統） |

### 優先級建議

1. **P0** — 合併明顯階段系列（Phase 1+2）：checkin, monster_kills, duel_wins, brew, card 等
2. **P0** — DexDetailModal 加入進度條（Phase 2）
3. **P1** — 修復掉落系列死成就（Phase 3）
4. **P1** — 合併動態巨量系列：kill_*, chest_*, potion_*, dex_fam_*（Phase 1+2）
5. **P2** — 分類優化（Phase 4）
6. **P3** — 進度提示 Toast（Phase 5）

---

*規劃日期: 2026-07-16*
*作者: Buffy (AI Assistant)*
