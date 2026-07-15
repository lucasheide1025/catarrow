# 課程前一天 Email 提醒技術設計

## Architecture

新增 Asia/Taipei 每日 10:00 的 v2 scheduled function。函式先讀取 `bookingEmailConfig/main`，只有 `dayBeforeEnabled === true` 才查詢 `bookings` 中 `status == confirmed` 且 `date == 台灣明日日期` 的文件，並以獨立 `dayBeforeDailyLimit` 加一筆探測文件判斷是否超量。

查詢沿用既有 `status + date` 複合索引，在記憶體中只保留正規化來源為 `online_public` 或 `online` 的文件。`phone`、`walk_in`、未知來源一律跳過。這避免為來源集合查詢增加另一個索引，也讓正式讀取量有明確上限。

## Recipient and privacy boundary

- `online_public`：只使用 booking snapshot 的有效 `contactEmail`，絕不讀會員文件。
- `online`：先用 snapshot Email；無效時最多安全讀取一次 `members/{memberId}` fallback。
- 無有效 Email：跳過，不建立 mail。
- 不建立 coach audience mail。

## Idempotency and timing

Mail 文件 ID 使用 `booking-day-before-{bookingId}-{bookingDate}` 的安全確定性編碼，並在 transaction 中以 create semantics 建立。排程重試、重疊執行或重複讀取不會重寄。

排程只處理執行當下仍為 confirmed 的隔日課程。取消文件不在查詢結果；改期舊文件為 cancelled，新文件只有在其新日期等於隔日才符合。10:00 之後建立或改期到隔日的文件不補寄。

## Configuration and templates

擴充既有 config：

- `dayBeforeEnabled: boolean`，預設 false。
- `dayBeforeDailyLimit: integer 1–100`，預設 50。
- `templates.studentDayBefore`，允許 `studentName`、`date`、`startTime`、`endTime`、`planName`、`participantCount`、`source`、`bookingUrl`。

後台沿用目前的合併、驗證、預覽、測試寄送與儲存流程，新增開關、上限與範本選項。舊 config 缺少新欄位時必須以安全預設值合併，避免部署即寄信。

## Cost and operations

查詢最多讀取 `dayBeforeDailyLimit + 1` 份隔日 confirmed booking；多出的 1 份只用於判斷是否超量。達上限後不分頁、不繼續掃描，並輸出 structured warning。每個 `online` 候選最多一筆會員 fallback read。Email extension 後續負責分批實際投遞。

部署順序：先部署函式與前台後台 UI，保持新開關 false；測試範本後由管理員啟用。回滾只需關閉 `dayBeforeEnabled`。
