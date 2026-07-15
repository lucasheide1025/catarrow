# Design

完成上課事件建立／覆寫 `bookingReminderQueue/{memberId}`，以 completed booking ID 作 completion cycle。`dueAt` 為完成時間加 14 天，新的完成事件會開新週期。

每日 `10:00 Asia/Taipei` 的 v2 scheduled function 讀 `bookingEmailConfig/main`；若關閉立即退出，否則查詢已到期 pending queue，最多 `dailyLimit`（預設 20，允許 1–50）。每位候選寄送前再確認沒有今天起的 confirmed 預約，並用 `inactive-{memberId}-{completionCycleId}` mail ID 防重複。

歷史初始化使用 admin callable 的 dry-run/cursor 流程；每頁固定上限，狀態保存於 `bookingReminderBackfills/main`。教練明確啟動後只建立 queue，不繞過每日寄送上限。
