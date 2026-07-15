# Design

所有入口寫入相同 `bookings` schema，後端 `handleBookingEmail` 維持唯一事件通知入口。新增純函式收件規則與入口矩陣測試；trigger 先驗證 `booking.contactEmail`，若無效且存在安全的 `memberId`，只讀一次 `members/{memberId}` 並依序嘗試 `email`、`contactEmail`。

不允許 client 指定教練收件者；仍由已驗證的 `bookingEmailConfig/main` 決定 To/BCC。`walk_in` 沒有 memberId／Email 時不寄學生信，但教練信照常建立。固定 mail ID 與交易防重機制不變。
