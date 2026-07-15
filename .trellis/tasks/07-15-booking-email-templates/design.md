# Design

在 `AdminBooking` 增加 Email 設定分頁，讀寫 `bookingEmailConfig/main`。設定包含兩個開關、dailyLimit、三位教練收件者與七個純文字範本。

前端提供範本切換、subject/text 編輯、白名單 token 插入、範例預覽、恢復預設、儲存與寄測試信。前端驗證只改善 UX；後端 callable 對 token、長度、Email、dailyLimit 與 admin 身分再次驗證。

Firestore Rules 將 `bookingEmailConfig` 限為 admin；`mail`、queue、backfill 狀態保持前端不可存取。設定不存在或損壞時 Functions 使用版本內建預設值。
