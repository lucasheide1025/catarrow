# Implementation Plan

- [x] 建立純函式事件分類、Email 驗證、token render 與預設文案。
- [x] 在改期交易補上 `rescheduledTo`。
- [x] 建立 booking Firestore trigger 與確定性 mail IDs。
- [x] 測試建立、改期、取消、非目標更新、缺 Email 與事件重播。
- [ ] 先以設定開關關閉，部署後用測試預約驗證，再啟用。
