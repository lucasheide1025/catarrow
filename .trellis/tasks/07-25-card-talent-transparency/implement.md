# 執行計畫 — 卡片天賦透明化

> 原則：每步都是「加顯示」，不動 `cardTalents.js` 計算。分步小 commit，每步可獨立驗證。

## Step 1：顯示 metadata 與輔助函式（純資料層，無 UI）
- [ ] 新增 `src/lib/cardTalentDisplay.js`：
  - `EFFECT_DISPLAY`（key→{icon,name,pooledFrom?,kind}），cap 一律引用 `TALENT_CAPS[key]`，**不抄數字**。
  - `buildContribution(views)` → `{key: [{label, count}]}`（用 `getCardTalent` 收集）。
  - `buildSuggestion(totals, sets, views)` → 建議字串（撞頂/差一張套裝/有空間/均衡）。
- [ ] 覆蓋 `EFFECT_DISPLAY` 是否涵蓋 `TALENT_CAPS` 全 key + 套裝會產生的 key（漏 key 時面板要 fallback 顯示原始 key，不崩）。
- **驗證**：`node -e` 或臨時 test 印出幾組輸入的輸出合理；`CI=true npx react-scripts build` 過。

## Step 2：總效果面板元件
- [ ] 新增 `src/components/member/cards/TalentEffectPanel.jsx`：
  - props: `collection`（或已算好的 totals/sets/contribution）。
  - 內部（或由父層傳入）算 `enrichedViews`（含 tierIndex）→ `calcCardCombatEffects` / `calcFamilySetStatus`。
  - 畫 bars（值/cap、封頂變灰+已滿）、貢獻小字、族系套裝、主動建議、收合鈕。
  - 防呆：空收藏/null/訪客 → 顯示「尚未裝備／無生效天賦」。
- **驗證**：build 過；用假資料確認封頂、共池分類名、建議三情境都正確。

## Step 3：接進裝備頁
- [ ] `CardCollectionModern.jsx` header 內嵌 `<TalentEffectPanel .../>`；
  - 把現有只含 family 的 views mapping 換成含 tierIndex 版（或直接傳 collection 讓面板自己算）。
  - 保留現有 HP/ATK/DEF pills 與族系套裝（套裝可改由面板統一顯示，擇一避免重複）。
- **驗證**：本機開 app 進裝備頁，數值與實際戰鬥吃的一致（可對照 `MonsterBattle` 的 cardFx）。

## Step 4：卡面直接顯示天賦
- [ ] `CardCollectionPrototype.jsx` 卡片格加天賦（`getCardTalent` 的 icon+label，空間夠可加值）。
  - 世界王卡（source==="wb"）不顯示天賦。
- **驗證**：收藏格每張卡看得到天賦，不需點入。

## Step 5：詳情頁共池說明
- [ ] `CardDetailSheet.jsx` 天賦文字後補「（歸【{name}】，與同類共享上限 {cap}）」，資料取自 `EFFECT_DISPLAY` + `TALENT_CAPS`。
- **驗證**：點開有共池的卡，看得到說明。

## Step 6：全域驗證與回歸
- [ ] `CI=true npx react-scripts build` → Compiled successfully。
- [ ] **教練切「射手模式」進裝備頁不白屏**（重點回歸，見 [[feedback_admin_mode]]）。
- [ ] 訪客/兒童進卡片頁不崩。
- [ ] `git diff src/lib/cardTalents.js` 為空（零平衡佐證）。
- [ ] 更新 `docs/second_brain`：`game-systems.md` 卡片章節補「天賦透明化面板」；`changelog.md` 記一條；同步 Obsidian。

## Rollback
- 各 step 獨立 commit；面板出問題可單獨 revert Step 3 的內嵌（面板元件與 metadata 留著不影響既有）。
