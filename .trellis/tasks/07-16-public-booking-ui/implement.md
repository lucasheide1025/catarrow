# 實作清單

- [x] 將 DateSlotPicker 加入公開可用性顯示模式與台灣一個月日期邊界／7 日導覽。
- [x] 補齊時段、摘要、登入確認、成功、會員中心、取消與改期的完整起訖／時數顯示。
- [x] 重構 PublicBookingApp 為精品射箭館手機優先版面與清楚步驟。
- [x] 在手機首屏提供立即預約與會員登入／我的預約入口。
- [x] 將選填問卷收合並改善表單 labels、autocomplete、錯誤、focus、safe area 與 reduced motion。
- [x] 驗證既有註冊、Google 登入、電話補填、送出、取消、改期與會員中心流程。
- [x] 執行相關測試、production build、web-design-guidelines review 與 diff check。
- [ ] 更新 booking spec、提交、部署學生系統並推送 main。

## Validation

- Root `npm test -- --watchAll=false`
- Root `npm run build`
- `git diff --check`
- 360px、390px、桌面寬度檢查

## Rollback

共用選擇器新 props 預設維持舊模式；若公開版有問題，可回退 PublicBookingApp 版面而不影響預約資料。
