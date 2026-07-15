# Implementation Plan

- [x] 在 Firestore Rules 加入完全封鎖 `mail` collection 的明確規則並驗證。
- [x] 部署 Firestore Rules。
- [x] 建立 Gmail 應用程式密碼，不讓密碼進入對話或版本控制。
- [x] 在 `catgroup-8d0bb` 安裝 Firebase 官方 Trigger Email 擴充套件。
- [x] 建立單封測試郵件並檢查 delivery/error 狀態與收件匣。
- [x] 確認沒有任何業務事件或前端程式被接到寄信佇列。
- [ ] 檢查版本差異並只提交本任務相關檔案。
