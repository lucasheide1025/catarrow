# 設計

`MemberPerformance` 在掛載和使用者變更時，以 `Promise.all` 平行讀取有限筆數的 Session 與 GamePerformance。Firestore 查詢只使用 `memberId` 單欄位篩選和 `limit`，再在客戶端依 timestamp 排序，避免引入需人工部署的複合索引。

射箭區只使用 `metricsSnapshot`：總分、箭數、X、M 與每箭平均。近期統計由最新完整 Session 累積至至少目標箭數，因此可能超過 30／60／90，UI 以「完整場次近似」標示。
遊戲區只使用 `GamePerformance` 當次鎖定的傷害與結果。

新入口由 `MemberRecordsHub` 導向 `performance`，`MemberApp` 以 lazy import 掛載，避免把新頁面的程式碼加入初始 bundle。
