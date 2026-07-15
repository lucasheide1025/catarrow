# Design

## Architecture

以 `functions/index.js` 匯出的第二代 Cloud Functions 作為唯一寄信入口：

1. `onDocumentWritten("bookings/{bookingId}")` 分類新預約、改期、取消與完成上課事件。
2. 事件通知以確定性 `mail` 文件 ID 建立，讓重試自然冪等。
3. 完成上課時更新會員專屬的 `bookingReminderQueue/{memberId}` 到期狀態。
4. `onSchedule` 每日台灣時間 10:00 查詢已到期 queue，依後台上限處理，寄信前再次確認沒有未來 confirmed 預約。
5. 後台 callable functions 提供範本驗證、測試信、dry-run 與明確啟動歷史分批處理。

## Event classification

- 文件首次建立、`status:"confirmed"`、無 `rescheduledFrom`：新預約確認。
- 文件首次建立、`status:"confirmed"`、有 `rescheduledFrom`：改期通知，以新文件為事件主體。
- `confirmed -> cancelled` 且無 `rescheduledTo`：取消通知。
- `confirmed -> cancelled` 且有 `rescheduledTo`：改期的舊紀錄，不另寄取消信。
- 非 completed -> completed：重設該會員兩週提醒週期。

`rescheduleBooking` 必須在舊文件補寫 `rescheduledTo:newBookingId`，避免舊文件取消事件與新文件改期事件重複通知。

## Idempotency

郵件文件使用確定性 ID：

- `booking-{bookingId}-{eventType}-student`
- `booking-{bookingId}-{eventType}-coaches`
- `inactive-{memberId}-{completionCycleId}`
- `test-{requestId}`

後端以 create-only 語意建立；已存在視為事件已處理。學生與教練郵件 ID 分開，任何一方失敗不會重建另一方。

## Reminder queue

`bookingReminderQueue/{memberId}`：

```js
{
  memberId,
  contactEmail,
  studentName,
  completionCycleId,
  lastCompletedAt,
  dueAt,
  state: "pending" | "sent" | "skipped_future_booking" | "invalid_email",
  sentAt,
  lastCheckedAt,
}
```

完成上課事件建立新週期並將 `dueAt` 設為完成時間加 14 天。每日排程只查 `state==pending && dueAt<=now` 並 `limit(dailyLimit)`；寄送前以有界查詢確認會員沒有今天以後的 confirmed 預約。若有則標記 skip，新的完成上課會重新建立下一週期。

歷史資料不在部署時自動全掃。後台 dry-run／初始化工作使用固定批次、持久 cursor 與最大處理量，先顯示候選名單，再由教練啟動；每日寄送仍受 1–50 上限控制。

## Templates and settings

`bookingEmailConfig/main` 只允許 admin 讀寫，後端使用 Admin SDK 讀取：

```js
{
  enabled,
  inactivityEnabled,
  dailyLimit,
  coachTo,
  coachBcc,
  templates: {
    studentConfirmed, studentRescheduled, studentCancelled, studentInactive,
    coachConfirmed, coachRescheduled, coachCancelled
  },
  updatedAt,
  updatedBy,
}
```

每個範本只有 `subject` 與 `text`。後端只替換白名單 token；未知 token、空主旨、空內文、長度超限均拒絕儲存。收件者不由範本控制。設定缺失時使用 Functions 內建預設值。

## Admin boundary

- `bookingEmailConfig`：Firestore Rules 僅 `isAdmin()` 可讀寫。
- `mail` 與 `bookingReminderQueue`：所有前端讀寫拒絕。
- dry-run、測試信、歷史初始化：callable function 驗證 Firebase Auth，並確認 `admins/{uid}` 存在。
- 後台只取得 callable 回傳的有界摘要／候選頁，不直接讀 queue 或 mail。

## Cost controls

- 每個預約事件固定最多建立兩個 mail 文件（學生一封、教練一封）。
- 排程單次只讀設定、最多 dailyLimit 個 queue 與每候選一個 bounded future-booking 查詢。
- 預設 dailyLimit 20，可調範圍 1–50；排程可關閉。
- 不使用 collection-wide listener，不在任何頁面 mount 時掃描歷史資料。

## Rollout and rollback

先部署 rules/indexes/functions，再部署後台 UI。保持 `enabled:false` 完成測試信與事件分類驗證，之後才開即時通知；歷史提醒另經 dry-run 啟動。回滾可關閉兩個 enabled 開關，不影響預約交易本身。
