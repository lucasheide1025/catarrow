# PRD：預約系統結帳串接既有會計系統

## 背景

既有流程：學生「下課」後，教練在 `會計系統`（`AdminFinance.jsx` → `BillingSystem.jsx`「記帳」分頁）手動搜尋姓名、選方案（自一/自三/單一/單三/學一/學三）、選付款方式，送出後寫入 `billingRecords` collection（`addBillingRecord()`），這是全部收支的唯一真相來源（清單/報表/CSV匯出都讀這裡）。

新預約系統上線後，教練點開一筆預約時應該能比照這個流程直接結帳，不用切換到另一個地方重新搜尋姓名——沿用同一套會計記帳邏輯，只是入口從「搜尋姓名」變成「點這筆預約就已經知道是誰、抓什麼方案」。

## 範圍

1. **`AdminBooking.jsx` 的行事曆詳情（`SlotDetailModal`）裡，每筆預約旁邊加一個「結帳」按鈕**，點擊開啟一個結帳表單（沿用 `BillingSystem.jsx`「記帳」分頁一樣的欄位：方案／早鳥折扣／付款方式／日期／備註），**預設值從這筆預約自動帶入，但每一項都還能改**：
   - 姓名/`memberId`：帶入 `booking.memberName`/`booking.memberId`
   - 方案：依 `booking.planType`（general/discount/own_equipment）＋`booking.durationHours`（1/3）自動對應到 `BillingSystem.jsx` 既有的方案代碼——`general+1→單一`、`general+3→單三`、`discount+1→學一`、`discount+3→學三`、`own_equipment+1→自一`、`own_equipment+3→自三`（價格直接沿用 `BillingSystem.jsx` 既有的 `PLANS` 常數，不要另外定義一份新的價格表）
   - 日期：帶入 `booking.date`
   - 付款方式：預設「現金」（跟 `BillingSystem.jsx` 一致），教練可改
2. **結帳完成＝呼叫既有的 `addBillingRecord()`**（`src/lib/db.js`），寫進同一個 `billingRecords` collection，會計系統的「清單」「報表」「CSV匯出」自動就看得到這筆——**不要另外做一套新的記帳collection**，這次是串接，不是重做。
3. **避免同一筆預約被結兩次帳**：`bookings/{id}` 新增 `billingRecordId` 欄位，結帳成功後把新產生的 `billingRecords` 文件 id 寫回這個欄位。行事曆詳情畫面上，已經結過帳的預約要顯示「已結帳」標記，「結帳」按鈕變成可以看/可以改（教練若真的要重新結帳，允許但要有確認提示，不強制鎖死）。

## 驗收
1. 教練點開一筆預約 → 按結帳 → 表單已經自動帶好姓名/方案/日期/付款方式(現金) → 教練可以直接送出，也可以先改掉任何一項再送出。
2. 送出後，`會計系統`（`AdminFinance.jsx`→記帳系統）的「清單」分頁能看到這筆新記錄，金額/方案/付款方式正確。
3. 這筆預約在行事曆詳情裡顯示「已結帳」，不會被誤以為還沒收費。
4. 3小時預約結帳時，方案自動對應到「X三」（3小時版本），金額是3小時的價格，不是1小時的。
5. `CI=true npx react-scripts build` 通過。

## 非目標
- 不改動 `BillingSystem.jsx` 本身的既有記帳流程（走「今日報到」快選那條路徑的既有使用方式完全不變）。
- 不做「自動結帳」（例如預約時間一到就自動產生帳單）——結帳永遠是教練手動觸發的動作，這次只是把入口接到預約系統，不改變「要教練確認」這個原則。
- 不處理團康（8人以上）的結帳——那條路徑本來就是教練後台手動建立預約，可以繼續走既有的會計系統手動記帳，不強制要求一定要從預約詳情結帳。
