# 預約 Email 通知系統

## Goal

讓有有效 Email 的學生在預約確認、改期、取消時收到清楚且不重複的通知，並以安全排程提醒長時間未再預約的學生。

## Deliverables

- `07-15-booking-status-emails`：預約建立、改期、取消的事件通知。
- `07-15-booking-inactivity-email`：超過兩週未預約的回訪提醒。
- `07-15-booking-email-templates`：教練後台調整郵件主旨與內容。

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

- [ ] 建立、改期、取消各有正確郵件內容與一次性投遞保護。
- [ ] 兩週未預約判斷依實際預約／上課資料，而非 `lastBookingAt` 誤判。
- [ ] 已有未來 confirmed 預約者不收到回訪提醒。
- [ ] 所有寄信寫入均由後端 Admin SDK 執行。
- [ ] 成本有界：排程不做無界全站掃描，且同一學生不會每日重寄。

## Scope Decision

- 兩週提醒不以帳號類型篩選；有 `memberId`、有效 Email、曾完成上課且符合時間條件者均可收到。
- `memberId:null` 的現場散客不寄。
