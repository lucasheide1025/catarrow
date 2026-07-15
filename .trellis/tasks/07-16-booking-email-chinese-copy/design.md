# 預約 Email 全中文化技術設計

## Copy and value formatting

在 `functions/bookingEmail.js` 集中提供純函式，將 `planType`、`source`、ISO date、24 小時制時間與人數轉成安全中文顯示值。`bookingVariables()`、課前一天 variables 與測試預覽共用相同語意契約，未知代碼一律使用中文 fallback，不輸出 raw value。

八種預設範本改為簡潔、友善、可行動的繁體中文。教練信以「已新增／已改期／已取消」的完整句子開頭，再列上課日期、時間、方案、人數、預約方式與聯絡信箱。學生信保留稱呼、事件說明、課程資料與必要操作提示。

## Safe stored-template migration

新增 `copyVersion: 2`。後端 `normalizeConfig()` 遇到缺少或低於版本 2 的設定時，對八種模板使用新版安全預設值；其他收件者、開關與上限照常保留。前端 `mergeBookingEmailConfig()` 同樣在舊版本時顯示新版預設範本。管理員下一次儲存時會寫入版本 2，之後尊重其自訂內容，不再覆蓋。

`validateConfig()` 必須要求目前版本並繼續驗證 token、長度、Email、開關與上限。測試寄信使用同一份版本化 config。

## Compatibility and rollout

不修改 Firestore schema 的其他欄位，不需要 index 或 rules。部署受影響 Functions 後即時寄信會先使用新版 copy；前端上線後後台會顯示新版並可儲存。回滾時舊 config 仍存在，但不影響預約交易。

Firebase Trigger Email 官方支援 mail 文件頂層 `from` 欄位；若未指定才使用擴充功能的 Default FROM。所有預約相關 mail 建立路徑共用常數 `貓小隊室內射箭場 <broudes@gmail.com>` 並明確寫入 `from`，涵蓋即時學生／教練信、課前一天、兩週提醒及後台測試信，不需重新設定 SMTP 帳號。
