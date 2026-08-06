# 訪客評價邀請與審核：執行計畫

## 1. 純領域邏輯與測試

- [x] 建立評價資格、狀態轉換、輸入正規化、台灣隔日 10:00、30 天期限、token hash 與決定性 mail ID helper。
- [x] Node tests 覆蓋首次邀請、回訪不重邀、重播完成事件、多人預約一份、token 到期、5 星 Google 條件與非法狀態轉換。
- [x] 定義評價與 Email 文案長度、安全字元及 URL 驗證邊界。

## 2. 後端資料與邀請流程

- [x] 從既有 booking completion trigger 以 transaction 建立每會員唯一 `guestReviewSubjects`，只接受有有效 Email 的 guest。
- [x] 新增隔日 10:00 有界 scheduler、fail-closed 設定、冪等 mail 文件及 30 天 token。
- [x] 新增管理員補寄 callable，包含 request ID 防連點、token 輪替、寄送次數與操作者稽核。
- [x] 串接 mail extension delivery/error 狀態，讓後台能辨識已排程、已寄出與失敗。
- [x] 確認部署不掃描或寄送歷史 completed bookings。

## 3. 評價提交與身份驗證

- [x] 新增 token 預覽／提交 callable，所有資格由伺服器依 hash、booking、member 與 review 唯一性驗證。
- [x] 新增已登入訪客查詢未評價資格與提交 callable，以 Auth 身份解析會員而非相信 memberId。
- [x] 以 transaction 建立不可編輯的 `guestReviews/{memberId}` 並更新 subject。
- [x] 只在 5 星且 Google 導流啟用時回傳 Google URL，與本站公開同意無關。

## 4. 訪客評價介面

- [x] 新增 `?review=<token>` 專屬評價頁：1～5 星、留言、公開同意、匿名公開名稱與送出結果。
- [x] 未勾公開時不要求匿名名稱；勾選後必填且不預填註冊本名。
- [x] 5 星成功頁顯示 Google 評價 CTA；1～4 星完全不顯示。
- [x] 在訪客預約中心歷史區顯示唯一未完成評價入口；token 過期仍可登入後提交。
- [x] 提供撤回公開同意動作；不提供內容修改、刪除、重新送審或重新同意。

## 5. 後台評價與客訴中心

- [x] 新增待公開審核、私人回饋、客訴三個清單與必要詳情。
- [x] 導覽加入紅點及待處理數量，處理後即時更新。
- [x] 實作核准、拒絕、私人回饋已讀／轉客訴、撤銷核准與邀請補寄。
- [x] 客訴回信 UI 不接受可編輯收件地址；顯示伺服器解析的遮罩 Email。
- [x] 客訴只有寄送成功才能結案；失敗顯示錯誤並可用 request ID 安全補寄。
- [x] 新增 Google 導流總開關與 Google 直接評論 URL 設定／驗證。

## 6. 公開投影與官網

- [x] 管理員核准時以 transaction 建立去識別 `publicGuestReviews` 投影；撤回／撤銷時同步刪除。
- [x] Firestore rules 允許公開集合唯讀並禁止 client write，內部 subject/review/config 預設拒絕。
- [ ] 新增必要複合索引與 rules emulator 測試。
- [x] 官網 runtime 讀最新六筆公開評價，先驗證資料再替換既有卡片。
- [x] 新評價不足六筆時以舊留言補滿；網路或資料失敗時保留全部舊留言。
- [ ] 確認 CMS 預覽、CMS 發布與動態評價 runtime 不互相覆蓋。

## 7. 驗證與安全檢查

- [x] Functions 單元測試：`npm test`（`functions/`）。
- [ ] React 測試：評價表單條件、Google CTA、撤回、後台狀態與 badge。
- [ ] Firestore rules emulator：匿名／訪客／正式學員／管理員／公共官網矩陣。
- [x] `npm test -- --watchAll=false` 或針對性 CRA 測試。
- [x] `npm run build`。
- [ ] 本機官網測試：0、1、6、超過 6、讀取失敗、惡意欄位與窄幅版面。
- [ ] 手動端到端：完成預約 → 隔日邀請 → token 提交 → 私人／公開分流 → 核准／拒絕 → 客訴寄信 → 官網上架／下架。
- [ ] 隱私檢查：公開 REST 回應與 DOM 不含 memberId、bookingId、本名、Email、電話、拒絕原因或客訴內容。

## 8. 上線與回滾

- [x] 取得並設定 Google 評價導流連結 `https://share.google/bqXYZDlWtwruWvV69`。
- [x] 部署 rules/indexes/functions；全新設定不存在時依產品指示預設啟用，後台保存設定後仍可關閉。
- [x] 部署 App 與官網並確認 Vercel production Ready；邀請功能與 5 星 Google 導流已開啟。
- [ ] 觀察首批 mail delivery、待審核數量、公開投影與函式錯誤。
- [ ] 若有異常，先關閉邀請與 Google 導流；官網移除 runtime 即回到六則靜態留言，資料與客訴稽核紀錄保留。

## 高風險檔案／回滾點

- `functions/index.js`：與既有 booking Email trigger 共存，避免完成事件被重複處理或影響原提醒。
- `firestore.rules`：任何過寬讀權限都可能外洩內部評價或客訴。
- `src/App.jsx`：公開 token 路由必須在 Auth loading 之前處理，但不得干擾 booking／guest／admin 路由。
- `src/pages/AdminApp.jsx`：badge 聚合需避免額外常駐高成本 listener。
- `website/index.html`／runtime：任何失敗都必須保持既有留言與 CMS 行為。
