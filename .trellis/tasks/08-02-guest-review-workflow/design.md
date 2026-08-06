# 訪客評價邀請與審核：技術設計

## 問題與設計原則

現有首頁評價是靜態內容，系統也已能確認預約完成並寄送預約 Email，但兩者之間沒有可信任的評價流程。新模組必須讓「曾完成來訪」成為唯一評價資格，以伺服器控制邀請、提交、審核、客訴與公開投影，並讓官網永遠只能讀到去識別且已核准的資料。

設計採以下原則：

- 以現有 `bookings.status === "completed"` 與訪客 `members.accountType === "guest"` 驗證資格。
- 每位訪客只自動邀請一次、也只保留一份本站評價；多人預約仍是一份。
- 前端不能直接決定資格、收件者、審核狀態或公開內容。
- 內部文件與官網公開快照完全分離；公開集合不保存會員、預約或聯絡識別碼。
- 所有寄信以具決定性的 mail ID 和交易寫入達成冪等。
- Google 評價導流是可停用的附加出口，不影響本站核心流程。

## 模組邊界

### Cloud Functions

新增獨立 `functions/guestReviews.js`，由 `functions/index.js` 匯出下列入口：

- 完成預約觸發器的評價資格／邀請佇列建立邏輯。
- 每日 `10:00 Asia/Taipei` 處理到期邀請的 scheduler。
- 公開 token 查詢與提交 callable。
- 已登入訪客查詢資格、提交及撤回公開同意 callable。
- 管理員核准、拒絕、私人回饋轉客訴、客訴回信、撤銷核准與補寄 callable。
- 管理員儲存評價設定 callable。

純規則、狀態轉換、token hash、Email 內容與寄送 ID 放在可由 Node test 直接測試的 helper，不把判斷全部塞進 Firebase handler。

### CRA 前台與後台

- `App.jsx` 在一般身份路由前識別 `?review=<token>`，載入不依賴 `AuthProvider` 身份的專屬評價頁。
- `PublicBookingApp.jsx` 的歷史預約區透過受保護 API 顯示唯一未完成的評價資格；逾期 token 不影響登入後填寫。
- 新增訪客評價資料存取模組，UI 不直接寫評價或審核集合。
- 後台統一審核中心加入訪客評價入口與 badge，分為待公開審核、私人回饋、客訴三類。

### 靜態官網

- 新增獨立 runtime，使用 Firestore REST 只讀公開快照。
- 首頁以最新核准評價優先補入現有六張卡；不足六則以既有 HTML 留言補位。
- 請求失敗、資料不合法或空集合時保持原始 HTML，不讓 CMS runtime 與評價 runtime 互相覆蓋。

## 資料模型

### `guestReviewSubjects/{memberId}`（伺服器專用）

每位訪客一份資格鎖，避免同時完成多筆預約時重複邀請：

```js
{
  memberId,
  bookingId,
  state: "scheduled" | "invited" | "submitted" | "invite_failed",
  dueAt,
  tokenHash,
  tokenExpiresAt,
  inviteMailId,
  inviteQueuedAt,
  inviteDeliveredAt,
  lastInviteError,
  manualInviteCount,
  lastManualInviteAt,
  lastManualInviteBy,
  createdAt,
  updatedAt
}
```

文件 ID 直接使用 `memberId` 是伺服器內部唯一性鎖，不對客戶端開放。完成預約觸發器以 transaction `create` 第一份合法 subject；若已存在或訪客已有評價，後續完成預約不排程。

### `guestReviews/{memberId}`（內部原始評價）

```js
{
  memberId,
  bookingId,
  rating: 1 | 2 | 3 | 4 | 5,
  message,
  publicAlias,          // consentToPublish=true 時必填
  consentToPublish,
  state: "pending" | "private_unread" | "private_read" |
         "approved" | "complaint_open" | "complaint_sending" |
         "complaint_send_failed" | "complaint_closed" | "approval_revoked" |
         "publication_withdrawn",
  submittedAt,
  reviewedAt,
  reviewedBy,
  rejectionReason,
  publicConsentWithdrawnAt,
  publicConsentWithdrawnBy,
  complaint: {
    replyText,
    mailId,
    queuedAt,
    deliveredAt,
    deliveryError,
    closedAt,
    operatorId
  } | null
}
```

內容送出後不可編輯。未同意公開者初始為 `private_unread`；同意公開者為 `pending`。訪客唯一可變更的欄位是撤回公開同意，且只允許 `true → false`。拒絕公開評價直接轉 `complaint_open`；私人回饋可標記已讀或轉客訴。

內部文件需要保留 member／booking 關聯以查核資格及取得收件者，但只有伺服器與管理員可讀；訪客本人的呈現透過 callable 回傳最小欄位。

### `publicGuestReviews/{reviewId}`（公開投影）

```js
{
  rating,
  message,
  publicAlias,
  approvedAt,
  displayOrderAt
}
```

只有管理員核准 callable 能建立。`reviewId` 使用不可反推 memberId／bookingId 的隨機公開 ID，內部文件保存其對應值。撤回同意或撤銷核准時，在同一 transaction 刪除公開投影。集合允許公共唯讀、禁止所有 client write。

### `guestReviewConfig/main`（管理設定）

```js
{
  enabled,
  googlePromptEnabled,
  googleReviewUrl,
  inviteSubject,
  inviteText,
  complaintSubject,
  updatedAt,
  updatedBy
}
```

因產品方明確要求部署後立即開啟，全新環境在設定文件不存在時預設啟用評價邀請與 5 星 Google 導流。`googleReviewUrl` 預設使用產品方提供的 Google 官方短連結 `https://share.google/bqXYZDlWtwruWvV69`；後台保存明確設定後仍可更換或關閉任一開關。

## 關鍵資料流

### 1. 建立首次邀請資格

1. 既有 booking trigger 看見 `非 completed → completed`。
2. 讀取會員並驗證 `accountType === "guest"`、有效 Email、預約與會員相符。
3. 在 transaction 中確認 `guestReviewSubjects/{memberId}` 與 `guestReviews/{memberId}` 均不存在。
4. subject 的 `dueAt` 設為完成日隔天 10:00 台灣時間；此時尚不產生 token，避免無法在寄送時重建原文。
5. 重播事件、重複結帳或另一筆完成預約因唯一 subject 而不會產生第二份資格。

歷史資料不上線即回補，避免部署後突然寄信。只有功能啟用後新產生的完成事件會自動建立；如需要歷史邀請，另做管理員明確選取的後續工具，不含於本 MVP。

### 2. 自動邀請與補寄

1. scheduler 有界查詢 `scheduled/invite_failed` 且 `dueAt <= now` 的 subject。
2. scheduler 產生高熵 token，在交易內只把 hash 與 30 天期限保存到 subject；同一交易以 `guest-review-invite-{memberId}` 建立包含原始 token 連結的 mail 文件並更新 `invited`。token 原文在函式返回後不另行保存。
3. Email 連結只帶原始 token；伺服器用 hash 比對 subject。token 自寄送日起 30 天失效。
4. 後台顯示 subject 與 mail extension 的 queued/delivered/error 狀態。
5. 管理員補寄會輪替 token、延長 30 天、使用含補寄序號的冪等 mail ID，並記錄操作者；重複按同一次 request ID 不會多寄。

### 3. 提交本站評價

免登入路徑以 token 定位 subject；登入路徑以 Firebase Auth Email／UID 解析會員，不能接受前端指定 memberId。伺服器共同驗證：

- subject 綁定 booking 仍為 completed；
- 會員仍是 guest；
- token 未過期（免登入路徑）；
- `guestReviews/{memberId}` 不存在；
- rating 是 1～5 整數、留言和匿名名稱符合長度及控制字元限制；
- consent=true 時匿名名稱必填，且不自動帶入帳戶本名。

transaction 建立唯一內部評價並把 subject 轉 `submitted`。回應只在 `rating === 5 && config.googlePromptEnabled` 時帶回 Google URL；是否同意本站公開不影響此條件。

### 4. 審核、公開與撤回

- `pending → approved`：管理員 callable 建立隨機 ID 的公開投影並記錄操作者。
- `pending → complaint_open`：拒絕理由必填，不建立公開投影。
- `private_unread → private_read`：只記已讀。
- `private_* → complaint_open`：管理員主動轉客訴。
- `approved → approval_revoked`：管理員刪除公開投影，不改原文。
- `approved → publication_withdrawn`：訪客撤回同意並刪除公開投影；不可由管理員恢復，也沒有重新同意流程。

所有轉換由伺服器檢查合法來源狀態，使用 transaction 同步內部狀態與公開投影，避免官網殘留。

### 5. 客訴回信

管理員輸入回信原文並送出。伺服器由 review → member／booking 解析帳號 Email，前端不得指定 `to`。現有註冊資料沒有可靠的 `emailVerified` 持久欄位，因此後端只驗證 Email 格式與帳號關聯，UI 不把它描述為已驗證信箱。以 request ID 和案件版本組成 mail ID，交易建立 mail 並設 `complaint_sending`。另以受限的 mail 文件觸發器觀察 Firebase Trigger Email extension 寫回的 delivery/error 欄位；只有成功後狀態才能成為 `complaint_closed`，失敗則轉 `complaint_send_failed` 並允許補寄。每次嘗試的回信原文、mail ID、寄送狀態、時間與操作者以歷史陣列永久留在內部案件，不因補寄覆蓋。

## 權限與隱私

- `guestReviewSubjects`：所有 client read/write 禁止。
- `guestReviews`：所有 client write 禁止；管理員可讀，訪客本人透過 callable 讀最小投影。
- `publicGuestReviews`：公共 read；所有 client write 禁止。
- `guestReviewConfig`：管理員 read/write 經 callable；若官網需要 Google URL，由提交 API 回傳，不把內部 Email 範本公開。
- token 原文不進 Firestore、log、analytics 或錯誤訊息；只保存雜湊。
- 官網公開投影禁止 memberId、bookingId、帳戶本名、Email、電話、內部狀態、拒絕原因與客訴內容。

## 首頁展示

`website/index.html` 保留六則既有 blockquote 作為靜態 fallback。runtime 取得最新六筆 `publicGuestReviews`，驗證欄位後由最新到最舊替換前 N 張卡；其餘卡保留舊留言。失敗時完全不動 DOM。首頁不得從 `guestReviews` 讀資料。

## Google 評價導流與風險

產品決策為只對本站 5 星提交者顯示 Google 評價連結，包含未授權本站公開的 5 星私人回饋。1～4 星不顯示。此選擇性導流存在平台政策風險，因此：

- `googlePromptEnabled` 可由管理員立即關閉。
- Google URL 只來自伺服器設定，前端不硬編碼決策。
- 不提供折扣、贈品、獎勵或代發；文案不得要求特定分數。
- 設計文件保留風險決策，若政策或商家狀態出現警示即可關閉。

## 相容性、上線與回滾

- 部署不會回補歷史完成預約；只會處理啟用後新產生且符合條件的完成事件。
- 先部署 rules/indexes/functions，再部署 App，最後部署官網 runtime；未啟用前 UI 可隱藏。
- 啟用前以測試 guest 完成預約，確認只產生一份 subject、隔日排程與 mail 狀態。
- 回滾先關閉 `guestReviewConfig.enabled` 與 `googlePromptEnabled`，停止新邀請；保留內部評價與客訴紀錄。官網 runtime 可移除而自然回到六則靜態留言。

## 主要取捨

- 使用伺服器 callable 而非 client 直接寫 Firestore，增加函式數量，但能同時支援 token 與已登入身份並鎖住資格／狀態轉換。
- 使用每會員唯一 subject/review，而非每 booking 一份，直接滿足「一位訪客只需評價一次」並消除回訪寄信疲勞。
- 使用公開投影集合會多一次寫入，但大幅縮小官網資料外洩與規則誤設風險。
