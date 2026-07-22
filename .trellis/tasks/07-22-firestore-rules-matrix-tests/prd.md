# Firestore Rules 權限矩陣與測試

## Goal

依既有安全審查建立 Firestore collection 權限矩陣與 Emulator Rules 測試基線，並在使用者追加授權後，以最小批次修正 doc ID 已確定等於 memberId 的跨使用者讀寫風險；不部署 Rules。

## Requirements

- 逐 collection 記錄 admin、owner、participant、authenticated-other、anonymous 的 read/create/update/delete 預期。
- 優先覆蓋 members、progress/performance、inventory、shared battle、guest、booking counters。
- 對本批 owner-bound collections 建立 owner、other、anonymous、admin 的可執行回歸測試。
- 只修正客戶端既有資料契約已確認的個人文件；共享房間、guest、booking counter 與 global outcomes 另批處理。
- 不部署、不修改正式資料。

## Acceptance Criteria

- [x] 權限矩陣涵蓋 P0 collection 群。
- [x] 已建立 Emulator 回歸測試，涵蓋本批七個 owner-bound collections；本機因缺少 Java 尚未實際啟動 Emulator，不得視為測試通過。
- [x] `memberPerformanceSync`、背包、統計與卡片 collection 拒絕 authenticated-other 與 anonymous 跨會員讀寫，同時保留 owner/admin 流程。
- [x] 提出分批 hardening 順序與客戶端依賴。
- [x] 未部署 Rules。

## Out of Scope

- shared rooms/battles、legacy guest collections、booking counters、global outcomes/economy 的規則收緊。
- 部署或正式資料變更。
