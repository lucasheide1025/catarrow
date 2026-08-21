# Implementation Plan

1. 為預約會員中心新增入口契約測試，固定新版文案、`/?arcade` 路由與無 `guest_prefill` 寫入。
2. 修改 `PublicBookingApp` 的入口處理與按鈕文案。
3. 檢查 `App.jsx` 的 `?arcade`／`?guest=1` 分流，以及 Arcade 大廳三種地下城入口。
4. 執行入口契約測試、Arcade 測試與 production build。
5. 進行 Trellis 品質檢查，確認沒有誤納工作區中其他未提交變更。

## Rollback point

本次功能變更集中在預約入口及其契約測試；若驗證失敗，只回退本任務新增／修改的檔案，不處理工作區其他既有變更。
