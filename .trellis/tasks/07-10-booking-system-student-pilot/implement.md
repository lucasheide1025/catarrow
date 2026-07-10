# Implement：線上約課預約系統（學生試用版）

依 design.md 施工順序，切 6 個 Step，每個 Step 結束都要能獨立驗證。**全部做完前不要 push main**（PRD「上線策略」）。

## Step 1 — 資料層 + 規則（地基）
- [ ] `src/lib/bookingDb.js`：`createBooking`／`cancelBooking`／`rescheduleBooking`／`blockSlot`／`unblockSlot`／`getBookingsForMember`／`getBookingsForDateRange`（教練行事曆用，帶日期範圍 `where` 限制）
- [ ] 容量 transaction 依 design.md §2 逐字實作，改期用單一 transaction 同時處理舊釋放+新鎖定
- [ ] 30 分鐘最短前置時間檢查依 design.md §3.1 實作在 `createBooking`/`rescheduleBooking` 函式本體內（不是只做在UI）
- [ ] `bookingStats`（`totalBookings`/`lastBookingAt`/`firstBookingAt`）依 design.md §3 邏輯，在 create/cancel/reschedule 的同一個 transaction 內更新
- [ ] `firestore.rules` 新增 `bookings`／`bookingSlotCounts` 規則（依 design.md §5.1 邏輯，比對現有 `isAdmin()`/`isLoggedIn()` helper 語法補齊）
- [ ] **明確提醒使用者手動貼規則進 Firebase Console**（CLI 403，這個專案的已知限制）
- [ ] 驗證：手動測試容量 transaction——用兩個瀏覽器分頁（或簡單腳本）同時對同一個 8/8 已滿前一位的時段搶最後一位，確認只有一邊成功；測試30分鐘規則、測試取消後 `totalBookings` 有扣回去

## Step 2 — 教練後台
- [ ] `src/components/admin/AdminBooking.jsx`（新）：行事曆週/日視圖切換、點時段格看詳情/建立預約
- [ ] 建立預約 Modal：顧客搜尋（email/電話比對既有 `members`）或新建（電話進線三欄位表單），呼叫 `createBooking(source:"phone")`
- [ ] 封鎖時段功能
- [ ] `bookingBetaAccess` 開關（design.md §5，掛在會員列表或新頁面，讓教練勾選開放哪些學生試用）
- [ ] 掛進 `AdminApp.jsx`（比照 `AdminKidMode.jsx` 的 lazy import + Hub 掛法）
- [ ] 驗證：教練能建立、看到、取消、封鎖一輪；能切換某個學生的 `bookingBetaAccess`

## Step 3 — 學生前台
- [ ] `MemberApp.jsx` 新增「線上約課」分頁，**只在 `profile?.bookingBetaAccess===true || role==="admin"` 時顯示入口**（design.md §4.1）
- [ ] 選日期→時段格（依營業時間+容量+封鎖+30分鐘規則顯示可選/不可選）→方案類別→送出
- [ ] 「我的預約」清單：讀自己的 `bookings`，改期/取消按鈕（無時間緩衝限制，但改期新時段一樣要過30分鐘檢查）
- [ ] 教練切換射手模式後這個新分頁不能白屏（既有慣例檢查）
- [ ] 驗證：學生（先用有開 `bookingBetaAccess` 的測試帳號）完整跑一次選時段→送出→看到→改期→取消；沒開旗標的帳號應該完全看不到這個分頁入口

## Step 4 — 新生隱藏入口
- [ ] `src/pages/PublicBookingApp.jsx`（新，比照 `GuestApp.jsx` 獨立頂層模式）：姓名/email/電話表單 → 呼叫既有 `resolveGuestSession(contact,"guest",null)` → 選時段（複用 Step 3 的時段選擇邏輯/元件）→ `createBooking(source:"online_public")`
- [ ] `App.jsx` 新增路由，用不易猜測的 query 參數值進入（design.md §4.2）
- [ ] `<head>` 加 `<meta name="robots" content="noindex,nofollow">`
- [ ] **驗證：grep 全專案（`src/`＋`website/`）確認沒有任何地方寫死或連結到這個新網址**——它只能透過教練手動告知的方式流出，不能被程式碼裡任何導覽/連結意外曝光
- [ ] 驗證：完整跑一次新生自助註冊+預約流程

## Step 5 — 收費分類報表
- [ ] 新報表元件，依日期區間查詢（**不能無界查詢**），依 `planType` × `paymentMethod` 分組統計
- [ ] 教練標記單筆預約的 `paymentMethod`（到店/事後標記用的小操作，掛在行事曆詳情或預約列表上）
- [ ] 驗證：報表數字跟手動建立的幾筆測試預約對得起來

## Step 6 — 顧客摘要欄位顯示（更多紀錄）
- [ ] 顧客列表頁（教練後台，若還沒有可以先簡單做一版）顯示 `bookingStats` 三欄位，**確認是直接讀 `members` 文件本身，沒有對 `bookings` 額外查詢**
- [ ] 驗證：建立/取消幾筆不同顧客的測試預約，確認三欄位數字正確反映（含取消扣回去）

## 收尾
- [ ] `CI=true npx react-scripts build` 通過
- [ ] PRD 驗收項目 1-9 逐一手動過一輪（含 Google/FB/LINE 登入**確認沒有做**——這次刻意不做，檢查沒有殘留半成品程式碼）
- [ ] `docs/second_brain/quick-ref.md`／`changelog.md` 更新（新 collection、容量 transaction 設計、30分鐘規則、`bookingBetaAccess` 機制、隱藏網址機制、規則待貼提醒）
- [ ] 同步複製到 `C:\Users\broud\Documents\Obsidian Vault\catarrow\`
- [ ] **全部做完、使用者確認測試沒問題之前，不要 git push main**——先 commit 到本地即可（或問使用者要不要開一個獨立分支），push 這個動作本身要等使用者明確說可以才做
- [ ] 完工回報時，跟使用者複述一次新生隱藏入口的實際網址，確認雙方都知道目前只有教練自己知道這個網址

## Rollback
`bookings`/`bookingSlotCounts` 是全新 collection，沒有動到任何既有 collection 的資料或規則，出問題可以直接回退整批 commit，不影響 SimplyBook 那條既有預約路徑（完全獨立）也不影響任何既有 App 功能。
