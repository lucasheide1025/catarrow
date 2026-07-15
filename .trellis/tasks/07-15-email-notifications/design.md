# Design

## Architecture and boundary

Firebase 官方 Trigger Email 擴充套件監聽 `mail` collection，使用 Gmail SMTP 投遞郵件。網頁端完全不能存取 `mail`；未來只有受信任的 Cloud Function Admin SDK 可以建立白名單事件的郵件文件。

## Security contract

- Firestore Rules 對 `/mail/{document}` 設定 `allow read, write: if false`。
- SMTP 使用 Gmail 應用程式密碼，憑證只輸入 Firebase 安裝流程並由 Secret Manager 管理。
- 不接受前端傳入任意收件者、主旨或 HTML。
- 第一階段測試由可信任的 Firebase Console／Admin SDK 建立一次性文件。

## Configuration

- Collection: `mail`
- SMTP host: `smtp.gmail.com`
- SMTP port: `465`（TLS）
- SMTP user: `broudes@gmail.com`
- Default FROM: `broudes@gmail.com`（Gmail SMTP 不使用自訂寄件者顯示名稱）
- Default REPLY-TO: `broudes@gmail.com`

## Rollback

若測試失敗或不再需要，停用／解除安裝擴充套件並撤銷 Gmail 應用程式密碼；Firestore 的 deny 規則保留也不影響其他功能。
