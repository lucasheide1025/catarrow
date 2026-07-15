# Implementation Plan

- [x] 完成所有子任務的需求、設計、context 與驗收標準。
- [x] 先實作預約狀態 Email：事件分類、冪等 mail ID、教練 To/BCC、改期關聯欄位與測試。
- [x] 實作後台範本管理：安全規則、預設範本、token 驗證、預覽、測試信與設定 UI。
- [x] 實作兩週提醒：完成事件 queue、每日排程、有界 future booking 檢查、dry-run/cursor/分批控制與測試。
- [x] 部署 Firestore Rules 與必要 indexes，確認建置完成。
- [x] 部署 Functions，先保持通知關閉並寄測試信。
- [x] 部署前端，人工驗證建立、改期、取消與後台設定。
- [x] 啟用正式通知並保留各提醒的獨立開關與分批控制。
- [x] 檢查 Firestore/Functions 用量與 Gmail 投遞狀態，保留關閉開關作為回滾。
