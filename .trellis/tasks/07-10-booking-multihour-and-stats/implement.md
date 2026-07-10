# Implement：預約系統擴充

依 design.md §7 施工順序。**沿用上一個任務的規則：全部做完前不要 push main。**

## Step 1 — `bookingDb.js` 多時段交易改造（風險最高）
- [ ] `slotKeysFor(date, startTime, durationHours)` 工具函式（design.md §2）
- [ ] `readCounter` 補上 `newCount`/`returningCount` 安全預設值
- [ ] `createBooking` 簽章加 `durationHours`/`isNewStudent` 參數，改成對 `slotKeys` 陣列做「全部讀取→逐格檢查→全部通過才逐格寫入」（design.md §3）
- [ ] `cancelBooking`／`rescheduleBooking` 推廣成處理 `slotKeys` 陣列（design.md §4），注意向後相容舊資料只有單數 `slotKey` 的 fallback
- [ ] 驗證：程式碼逐行走一次「9點3小時預約→10點時段格是否正確算入→12點是否正確不再算入」這個情境（design.md驗收項目2），不需要即時連Firestore也能靠邏輯推演確認正確
- [ ] `CI=true npx react-scripts build` 通過

## Step 2 — 讀取端 + UI 表單
- [ ] `bookingSchedule.js` 補上 `newCount`/`returningCount` 讀取
- [ ] `MemberBooking.jsx`／`PublicBookingApp.jsx`／`AdminBooking.jsx` 三個入口的建立預約表單都加上：時數選擇（1/3小時）＋「是否為第一次來體驗」勾選框
- [ ] 三個入口呼叫 `createBooking` 時正確傳入新增的參數

## Step 3 — 前後台時段格顯示
- [ ] 學生前台選時段畫面、教練後台行事曆畫面，時段格都顯示「新X／舊X（共Y/8）」
- [ ] 確認兩邊讀的是同一份 `bookingSlotCounts` 資料，數字會一致

## Step 4 — 測試腳本補充
- [ ] `test-booking-concurrency.js` 補上3小時跨格併發測試案例（design.md驗收項目3的併發版本：兩人搶最後一格3小時空檔）
- [ ] 實際執行仍待 Firestore 額度恢復，這次先確保腳本邏輯正確、build通過

## 收尾
- [ ] `CI=true npx react-scripts build` 通過
- [ ] `docs/second_brain/quick-ref.md`／`changelog.md`／`.trellis/spec/frontend/booking-system.md` 更新（多時段鎖定設計、新舊生統計欄位、已知限制章節要更新或移除，因為這次就是在補那個已知限制）
- [ ] 同步複製到 Obsidian Vault
- [ ] git commit（**不要push**，比照 `07-10-booking-system-student-pilot` 的既有限制）

## Rollback
只改動 `bookingDb.js`/`bookingSchedule.js`/三個入口表單/顯示，都是在上一個任務的既有檔案基礎上擴充，沒有新增 collection。出問題可以整批回退這次 commit，退回到「統一1小時」的上一個版本，不影響其他功能。
