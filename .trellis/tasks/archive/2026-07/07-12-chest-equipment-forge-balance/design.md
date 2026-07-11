# Technical Design

## Boundaries

- `MemberMaterials.jsx`：僅修改開箱結果對話框的高度、捲動區與固定操作區。
- `itemData.js`：材料寶箱掉落表與描述移除藥水機率；保留 `potion` 專用分支。
- `equipData.js`：調整 RPG 裝備 `_PLUS_MAT_COUNTS`，沿用 `isMatsCurveCurrent()` 使舊需求自然重抽。
- `catData.js`：延伸既有累積強化值、加入 +50 封頂判斷，並依品質區間選擇 T1～T5 的鍛造費用。
- `CatVillage.jsx`：同時顯示品質名稱與共用計算出的累積 `+N`／MAX，鍛造流程仍寫入原有 `grade/plusLevel`。

## Cat Forge Compatibility

現有資料以六品質搭配每品質 `plusLevel 0～9` 儲存，原本即為累積強化制度。累積顯示值定義為 `gradeIndex * 10 + plusLevel`，因此普通階顯示 +0～+9，升階後顯示稀有 +10，最後顯示神話 +50。品質名稱與強化值必須同時出現在強化介面。

鍛造封頂判斷改以累積值 `>= 50` 為準。已存在的神話 +1～+9 保留原資料與原能力計算，只視為封頂，避免破壞玩家既有成果。

## Material Curve

- 同品質內九次日常強化全部使用該區間材料 T1～T5，數量採單調上升曲線。
- 第十次為升階，仍使用目前區間同 Tier 主材料，完成後進入下一個十級區間。
- 每次升品質都使用目前區間的同 T 貓毛，依 T1～T5 分別消耗 10、15、20、30、50，不再讓高階升級錯用 T1 貓毛。
- 成本計算集中在 `calcForgeCost()`，UI 不自行推導 Tier 或數量。

## Modal Behavior

對話框外層使用動態視窗高度與安全區間；結果內容成為唯一可捲動區，標題與確認按鈕留在固定區域。這可處理長材料清單、碎片、藥水與未合併卡片同時出現的情況。

## Rollback

所有變更為資料表、純函式與 UI 佈局調整，沒有資料庫 schema 變更。若回滾，只需還原相關前端檔案，已存在玩家資料仍可由舊程式讀取。
