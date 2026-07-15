# 實作清單

- [x] 建立方案、來源、日期、時間、人數的安全中文格式化純函式與測試。
- [x] 重寫八種後端與前端預設範本，統一自然繁體中文語氣。
- [x] 將 booking、課前一天與測試預覽 variables 改為中文顯示值。
- [x] 加入 `copyVersion: 2` 的後端／前端相容遷移與驗證測試。
- [x] 所有 booking mail 建立路徑加入共用中文寄件者顯示名稱並測試。
- [x] 確認舊版預設自動升級、新版自訂內容保留，收件者與排程行為不變。
- [x] 執行 Functions tests、Node 語法檢查、production build、diff check。
- [ ] 更新 booking spec、提交、部署受影響 Functions 並推送 main。

## Validation

- Functions `npm test`
- `node --check functions/index.js`
- Root `npm run build`
- `git diff --check`
