# 預約 Email 通知系統

## Goal

讓有有效 Email 的學生在預約確認、改期、取消時收到清楚且不重複的通知，並以安全排程提醒長時間未再預約的學生。

## Deliverables

- `07-15-booking-status-emails`：預約建立、改期、取消的事件通知。
- `07-15-booking-inactivity-email`：超過兩週未預約的回訪提醒。
- `07-15-booking-email-templates`：教練後台調整郵件主旨與內容。
- `07-15-booking-email-entrypoints`：驗證訪客、學生與教練手動建立課程的通知收件規則。
- `07-15-booking-day-before-email`：每天台灣時間 10:00 寄送隔日學生課程提醒。

## Confirmed Facts

- `bookings` 文件已有 `contactEmail`、日期、起訖時間、狀態與改期關聯資料。
- 所有預約變更集中於 `src/lib/bookingDb.js` 的交易流程。
- Email 擴充功能監聽 `mail` collection，且 Firestore Rules 已禁止所有前端讀寫。
- `members.bookingStats.lastBookingAt` 是預約建立／改期時間，不能代表最後上課日。

## Requirements

- 寄信必須由受信任的後端建立 mail 文件，前端不得直接觸發任意郵件。
- 同一個預約事件只寄一次，即使 Cloud Function 重試也不得重複寄信。
- 新預約、改期、取消除了通知學生，也要通知教練。
- 教練通知收件者為 `chobitsgl1@gmail.com`、`beluga0109@gmail.com`、`broudes@gmail.com`。
- 沒有有效 Email 的帳號跳過並留下可診斷紀錄，不影響預約交易成功。
- 寄信失敗不能回滾或破壞已成功的預約交易。
- 兩週提醒從最後一次實際完成上課起算；滿 14 天且沒有未來預約時只寄一次，直到學生再次完成上課才開啟下一週期。
- 歷史符合者先 dry-run 顯示人數與名單，經教練確認後分批寄送，避免短時間大量寄信被 Gmail 判定為垃圾郵件。
- 教練可從後台調整各通知的信件內容。

## Acceptance Criteria

- [x] 建立、改期、取消各有正確郵件內容與一次性投遞保護。
- [x] 兩週未預約判斷依實際預約／上課資料，而非 `lastBookingAt` 誤判。
- [x] 已有未來 confirmed 預約者不收到回訪提醒。
- [x] 所有寄信寫入均由後端 Admin SDK 執行。
- [x] 成本有界：排程不做無界全站掃描，且同一學生不會每日重寄。

## Scope Decision

- 兩週提醒不以帳號類型篩選；有 `memberId`、有效 Email、曾完成上課且符合時間條件者均可收到。
- `memberId:null` 的現場散客不寄。

## Completion Record — 2026-07-16

預約 Email 通知系統已完成開發、測試與正式部署。涵蓋預約確認、改期、取消、三位教練通知、兩週未預約提醒、課程前一天提醒、後台範本／開關／寄送上限，以及訪客、學籍學生、教練代約與現場散客的來源邊界。

課前一天提醒正式版本為 commit `0afd63b`；Functions 測試 45/45、Node 語法檢查、production build 與 diff check 均通過。Firebase 已部署 `processBookingDayBeforeReminders`、`saveBookingEmailConfig`、`sendBookingEmailTest`，main 已推送並觸發 Vercel 正式發布。所有提醒均具 fail-closed 開關、確定性 mail ID 與有界讀取設計。
