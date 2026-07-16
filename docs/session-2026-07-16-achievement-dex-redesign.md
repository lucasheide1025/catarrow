# 🎖️ Session Log: 圖鑑系統重整 — Phase 1

> **日期**: 2026-07-16
> **狀態**: ✅ Phase 1 實作完成（未部署，僅變更檔案）
> **目標**: 建立階段式成就系統基礎架構 + DexDetailModal 進度條 UI

---

## ✅ 已完成

### 📋 規劃文件

1. **`docs/achievement-dex-redesign-plan.md`** — 全系統分析 + 5 階段計劃
2. **`docs/dex-detail-modal-progress-ui-design.md`** — 進度條 UI 細節設計

### 🔍 調研

3. **死成就調查** — 確認 `card_first`/`card_renew`（月卡）、`drop_rare`~`drop_mythic`（掉寶無統計）永遠無法完成

### 💻 實作內容

#### `src/lib/achievementDex.js` — 新增

- **`TIERED_ACHIEVEMENTS`** — 8 個階段式成就定義：
  | ID | 分類 | 取代舊成就數 | 里程碑 |
  |---|---|---|---|
  | `checkin` | start | 7 | 1/5/10/15/20/25/30 次 |
  | `monster_kills` | monster | 4 | 1/5/10/30 次 |
  | `monster_boss` | monster | 2 | 1/10 次 |
  | `brew` | forge | 3 | 1/5/10 次 |
  | `potion_usage` | forge | 4 | 1/10/30/50 次 |
  | `card_collect` | card | 5 | 1/5/10/15/20 張 |
  | `duel_wins` | duel | 4 | 1/5/10/25 勝 |
  | `collectible_progress` | dungeon | 4 | 1/10/60/150 件 |

- **每個 tiered 成就含 `replacesIds`** — 正確過濾被取代的舊成就
- **`computeTierProgress()`** — 計算當前 tier、下一個目標、進度百分比、差距、里程碑列表

#### `src/components/member/MemberDex.jsx` — 修改

- **`cellsFor()`** — 串接 tier progress，正確過濾已取代的舊成就
- **`DexDetailModal`** — 分流階段式 vs 一次性成就
- **`TieredDetailContent`** — 全新元件：
  - 進度條（彩色漸層、里程碑圓點標記）
  - 差距激勵文字（差1步：「🔥 就差一步！」~ 差10+：「🏹 繼續努力」）
  - 里程碑列表（展開/收起 + ✅已達/▶進行中/🔒未解鎖 三種狀態）

### 🐛 Bug 修正

1. **cellsFor 過濾邏輯** — 原本用 `t.id` 比對 `a.id`（但 `checkin` ≠ `checkin_1`），修正為用 `replacesIds` 收集被取代的 ID 再過濾
2. **移除未使用的 `iconAlt` 欄位**

---

## 📌 Next Steps

### ✅ Phase 2 完成（2026-07-16 續作）
- [x] 將巨量動態系列加入 `TIERED_ACHIEVEMENTS`：`kill_{monster}`(36)、`chest_{type}`(7)、`potion_{id}`(每藥水)、`dex_{fam}`(6 族)——見 changelog 2026-07-16 條目
- [x] 更新 `computeDexStats`：排除被 `replacesIds` 取代的舊成就、改用 tiered 里程碑計數
- [x] 附帶修 `MemberDex.jsx` 卡片 ctx 恆為 0 的既有 bug（cardCount/mythicCards/cardFamilies）
- [x] `CI=true npx react-scripts build` 通過

### ⏳ 仍待辦
- [ ] 修正死成就（`drop_rare` ~ `drop_mythic`）：需在戰鬥端補掉寶統計寫入，超出圖鑑重構範圍
- [ ] 本地 `npm start` 測試所有狀態畫面（尤其新增的 kill/chest/potion/dex_fam 格與進度條）
- [ ] 部署

---

## 🔗 修改檔案一覽

| 檔案 | 變更類型 | 說明 |
|------|---------|------|
| `docs/achievement-dex-redesign-plan.md` | ✨ 新增 | 完整重設計劃 |
| `docs/dex-detail-modal-progress-ui-design.md` | ✨ 新增 | 進度條 UI 設計 |
| `docs/session-2026-07-16-achievement-dex-redesign.md` | ✨ 新增 | 本 session 記錄 |
| `src/lib/achievementDex.js` | ✏️ 修改 | 新增 TIERED_ACHIEVEMENTS + computeTierProgress |
| `src/components/member/MemberDex.jsx` | ✏️ 修改 | 新增 TieredDetailContent + cellsFor 串接 |
