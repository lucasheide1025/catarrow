# 公會一般懸賞任務自動化

## Goal

在冒險者公會（`AdventurerGuild.jsx`）新增一種「一般懸賞任務」批次，每天隨機自動刷新，共 4 個難度階層，獎勵（金幣/經驗值/寶箱/箭露/扭蛋幣）依難度調整，且教練後台可調整難度對應的獎勵表與任務池。**不修改**現有「每日克蘇魯/人質/殭屍靶任務」（`getDailyGuildTasks`），那套維持原樣。

## 確認事實（探索程式碼所得）

- **`questSubtype: "general"`** 這個任務子類型欄位已經存在於現有 schema（`AdminGuildQuests.jsx` 的 `EMPTY_FORM`／`SUBTYPE_LABEL`），教練現在只能透過表單**手動一筆一筆**新增，沒有自動批次生成機制。
- **現有雙週懸賞（`generateBiWeeklyBounties`，`src/lib/adventurerSystem.js`）已經是幾乎相同形狀的系統**，可直接參考/改造：
  - 6 個怪物階級（common/rare/elite/fierce/boss/mythic），每階隨機抽怪、隨機擊殺數區間、固定該階獎勵（xp/coins/arrowDew/gachaCoins）
  - 用日期/週期 seed 產生決定性亂數（`makeSeedRand`），確保同一批次全員看到相同任務（不用每人各自存一份）
  - `autoPublishBountyQuests(monsters)`（`db.js`）：前台進公會頁時呼叫，用 `guildMeta/bountyPeriod` 文件防重複發佈，把生成的任務逐一 `publishGuildQuest` 寫進 `guildQuests` collection
  - 任務完成走既有 `acceptGuildQuest`（記錄接任時的擊殺基準值）→ `submitGuildQuestCompletion`（發獎勵）路徑，**不需要新的驗收機制**
- **教練後台已有「設定可即時調整＋onSnapshot＋程式碼預設值 fallback」的成熟模式**可直接複用：`PROMO_QUEST_DEFAULTS` / `getPromotionQuestConfig` / `subscribePromotionQuestConfig` / `savePromotionQuestConfig`（晉階任務設定），本次「難度對應獎勵表」直接照抄這個模式。
- **寶箱系統（`src/lib/itemData.js` `CHEST_TYPES`）已有 5 階材料寶箱**：wood/iron/gold/epic/mythic，**4 個難度可直接一一對應前 4 階**（wood→iron→gold→epic），不需要新增寶箱類型。

## 使用者決策（已確認）

1. **任務內容**：先做「指定擊殺」（沿用 `questSubtype:"kill_monster"` 既有機制，跟雙週懸賞完全同一套驗收邏輯）。其他任務型態（射分數/命中率等）本次不做。
2. **每日數量**：每階難度派發 1~2 個，一天共 4~8 個。
3. **寶箱獎勵**：4 個難度對應 4 種固定寶箱（wood/iron/gold/epic），**不走機率**，達標必定附贈。

## Requirements

### 資料模型

- `src/lib/adventurerSystem.js` 新增 `GENERAL_BOUNTY_TIER_DEFAULTS`（4 階陣列，結構比照 `BOUNTY_TIER_CONFIG` 但改 4 階）：`{ tier, label, killMin, killMax, xp, coins, arrowDew, gachaCoins, chestType, count }`
- 新 Firestore 設定文件（比照 `C_PROMO_CONFIG` 模式）：`guildConfig/generalBountyTiers`，教練可覆寫任一階的數值，缺欄位 fallback 用 `GENERAL_BOUNTY_TIER_DEFAULTS`
- 新函式 `generateDailyGeneralBounties(dateKey, monsters, tierConfig)`（比照 `generateBiWeeklyBounties`，但週期改「每日」、階層改 4 階、寶箱改固定非機率）
- `autoPublishBountyQuests` 需求要能同時處理「雙週怪物討伐」與「每日一般懸賞」兩條批次（各自獨立的 period key／防重複文件，互不干擾）；或拆成獨立函式 `autoPublishDailyGeneralBounties`，前台頁面兩個都呼叫

### 教練後台

- `AdminGuildQuests.jsx` 新增「一般懸賞設定」區塊（比照現有「晉階任務設定」卡片樣式）：4 階難度的擊殺數區間、獎勵數值、寶箱類型可編輯儲存
- 教練仍可透過既有表單手動新增/編輯/下架個別「一般」任務（此路徑不變）

### 前台

- `AdventurerGuild.jsx` 進入頁面時，除了現有的 `autoPublishBountyQuests`，新增呼叫每日一般懸賞的自動發佈
- 任務清單 UI 需要能區分顯示「一般懸賞（每日）」與「怪物討伐（雙週）」批次（沿用現有 `questSubtype` 標籤系統即可，`SUBTYPE_LABEL.general` 已存在）

## Out of Scope

- 現有「每日克蘇魯/人質/殭屍靶任務」（`getDailyGuildTasks`）— 完全不動
- 除「指定擊殺」以外的任務型態（射分數/命中率/一擊必殺等）— 本次不做，未來可擴充
- 寶箱機率化 — 本次固定對應，不做機率

## Acceptance Criteria

- [ ] 每天固定時間（或每日第一次進公會頁）自動生成 4~8 個「一般懸賞」任務，4 個難度各 1~2 個
- [ ] 同一天內所有會員看到相同的一般懸賞任務批次（日期 seed 決定性生成）
- [ ] 任務完成沿用既有 `acceptGuildQuest`/`submitGuildQuestCompletion` 流程正確發獎（xp/coins/arrowDew/gachaCoins + 固定寶箱）
- [ ] 教練後台可調整 4 個難度各自的擊殺數區間、獎勵數值、寶箱類型，儲存後下一批次生效
- [ ] 教練仍可用既有表單手動新增/編輯個別一般任務，不受自動化影響
- [ ] 不影響 `getDailyGuildTasks`（克蘇魯/人質/殭屍靶）與現有雙週怪物討伐懸賞的既有行為
