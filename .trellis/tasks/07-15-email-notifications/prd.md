# 安裝 Email 通知基礎設施

## Goal

以低成本、安全且可驗證的方式，為 catGROUP 建立管理員 Email 通知基礎設施。

## Confirmed facts

- Firebase 專案為 `catgroup-8d0bb`，已啟用付費方案。
- 寄件帳號使用 `broudes@gmail.com` 的 Gmail SMTP。
- 第一階段只建立官方 Trigger Email 擴充套件、受保護的寄信佇列與測試信。
- Gmail 應用程式密碼不得貼入原始碼、Git、Firestore 文件或對話。

## Requirements

- 使用 Firebase 官方 Trigger Email 擴充套件與 Gmail SMTP。
- Firestore 寄信佇列不得允許任何網頁端使用者讀取或寫入。
- 預設寄件者與回覆地址使用 `broudes@gmail.com`。
- 完成一封寄往 `broudes@gmail.com` 的測試信，確認實際投遞結果。
- 保持第一階段寄信量極低，不接入預約、學生或大量事件。

## Acceptance Criteria

- [x] Trigger Email 擴充套件成功安裝在 `catgroup-8d0bb`。
- [x] Gmail SMTP 憑證由 Secret Manager／擴充套件安全保存，未進入版本控制。
- [x] `mail` collection 的用戶端讀寫均被 Firestore Rules 拒絕。
- [x] 測試信成功送交 `broudes@gmail.com`（accepted: 1、rejected: 0、pending: 0）。
- [x] 未新增任何自動大量寄信觸發器。

## Out of Scope

- 預約、學生、行銷或其他業務事件通知。
- 群發、電子報、退訂管理與郵件範本管理介面。
