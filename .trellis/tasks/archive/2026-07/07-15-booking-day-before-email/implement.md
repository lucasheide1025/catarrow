# 實作清單

- [x] 擴充 booking Email config、範本 metadata、預設值、驗證與向下相容合併。
- [x] 建立台灣明日日期、來源篩選、收件者、確定性 mail ID 等純函式與單元測試。
- [x] 新增每日 10:00 scheduled function，實作 fail-closed gate、有界查詢、隱私 fallback、transaction 防重寄與超量 warning。
- [x] 在 Email 後台加入獨立開關、1–100 上限、範本編輯／預覽／測試能力。
- [x] 測試來源矩陣、日期邊界、取消／改期、無效 Email、防重寄、舊 config 與上限。
- [x] 執行 Functions tests、語法檢查、前台 build 與 diff check。
- [x] 更新 booking spec，提交後只部署新增／受影響 Functions，再推送 main。

## Validation

- `npm test`（functions）
- `node --check functions/index.js`
- `npm run build`（root）
- `git diff --check`

## Rollback

- 先在後台關閉 `dayBeforeEnabled`，無須修改預約資料。
- 若 config/UI 相容性異常，舊文件缺少欄位仍會正規化為 disabled + 50。
