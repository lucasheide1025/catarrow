# Design

使用 Firestore `onDocumentWritten("bookings/{bookingId}")` 監聽後端已提交的預約狀態。依 before/after 分類 confirmed 建立、rescheduledFrom 建立與純取消；完成與其他欄位更新不寄狀態信。改期交易在舊文件寫入 `rescheduledTo`，新文件原有 `rescheduledFrom`，避免取消與改期雙寄。

每個事件分別以確定性 ID create 學生與教練 mail 文件。學生無有效 `contactEmail` 時只跳過學生信，教練信仍寄；教練信固定 `to:broudes@gmail.com`，`bcc:[chobitsgl1@gmail.com, beluga0109@gmail.com]`。

範本從 `bookingEmailConfig/main` 讀取並套用白名單 token，缺失或無效時使用程式內建預設值。寄信錯誤不改寫預約文件、不回滾預約交易。
