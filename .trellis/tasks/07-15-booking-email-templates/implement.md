# Implementation Plan

- [ ] 定義七個預設範本與每種範本的 token 白名單。
- [ ] 新增 admin-only Firestore 規則與設定資料層。
- [ ] 建立 Email 設定分頁、編輯器、token 插入、預覽與恢復預設。
- [ ] 建立 admin callable：驗證／儲存、寄測試信、dry-run 與分批啟動。
- [ ] 測試非 admin 拒絕、未知 token、空白／超長內容、預設 fallback 與測試信不改預約狀態。
