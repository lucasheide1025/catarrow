# Implementation Plan

1. 調整大量開箱結果 modal，建立受限高度的內容捲動區與固定確認按鈕。
2. 從所有一般材料寶箱設定、說明及普通掉落流程移除藥水，保留藥水箱專用流程。
3. 將 RPG 裝備五段材料數量全部提高 50% 並更新曲線註解與舊資料判定測試。
4. 在貓裝資料層延伸既有累積制度至 +50，加入封頂 helper 並重排 T1～T5 鍛造材料曲線。
5. 更新鍛造 UI 的下一階、成功訊息、品質名稱、累積強化值與 MAX 判斷，維持原 Firestore 寫入格式。
6. 補足純函式測試，涵蓋材料寶箱不掉藥水、RPG 材料曲線、貓裝 +10/+20/+50 邊界與舊高階資料。
7. 執行相關測試、lint/build，檢查 git diff 僅包含本任務檔案。

## Validation

- `npm test -- --watchAll=false`
- `npm run lint`
- `npm run build`
- 行動裝置尺寸人工檢查大量開箱 modal 可捲動且按鈕可按。

## Review Gates

- 實作前確認 PRD 對 +50 與 T1～T5 的解讀。
- 完成後核對既有 `grade/plusLevel` 不需遷移，且超過 +50 的舊裝備未被覆寫。

## Rollback Point

- 若貓裝相容性檢查失敗，保留寶箱與 RPG 材料調整，單獨還原貓裝資料層及 UI 變更。
