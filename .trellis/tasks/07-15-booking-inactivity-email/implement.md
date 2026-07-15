# Implementation Plan

- [ ] 建立完成上課到 reminder queue 的冪等更新。
- [ ] 新增 queue 查詢 index 與前端完全拒絕規則。
- [ ] 建立每日排程、每日上限與 future confirmed booking 防誤寄。
- [ ] 建立 admin-only dry-run、cursor、候選名單與啟動 callable。
- [ ] 測試未滿 14 天、有未來預約、無 Email、已寄週期、新完成週期與每日上限。
- [ ] 上線只做 dry-run，經教練確認候選名單後才啟動歷史分批。
