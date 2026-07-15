# 驗證所有預約入口 Email 通知

## Goal

確認訪客公開預約、學生自行約課及教練手動新增課程都會產生正確且不重複的學生／教練通知。

## Entry Matrix

- `online_public`：訪客公開預約，Email 必填；通知訪客與三位教練。
- `online`：學生自行約課；優先使用預約快照 Email，無效時回查會員 Email；通知學生與三位教練。
- `phone`：教練替既有會員手動新增；同樣使用快照＋會員 Email fallback；通知學生與三位教練。
- `walk_in`：教練新增無會員現場散客；沒有 Email 時只通知三位教練，不偽造學生信。

## Requirements

- 三個主要入口均沿用同一 `createBooking` 與 `bookings` trigger，不另建平行寄信路徑。
- 有 `memberId` 但預約快照 Email 無效時，後端最多額外讀取一份會員文件取得有效 Email。
- 公開訪客的必填 Email 仍由現有預約驗證保證。
- 教練通知不因學生 Email 缺失而跳過。
- 入口、來源與收件結果需有自動測試矩陣。

## Acceptance Criteria

- [x] `online_public`、`online`、`phone` 都建立學生與教練兩份確定性 mail 任務。
- [x] `walk_in` 無 Email 時只建立教練通知。
- [x] 快照 Email 無效但會員 Email 有效時仍建立學生通知。
- [x] 學生 Email 兩處都無效時安全跳過學生信，教練信保留。
- [x] 改期與取消延續原預約來源並套用相同收件規則。
- [ ] 正式通知開關與三位教練收件者完成營運確認。
