# 執行計畫

- [x] 記錄正式首頁雜湊，建立 `website/index-redesign.html`。
- [x] 建立新版 Header、Hero 與手機固定預約入口。
- [x] 建立新手四步驟、評論／專業證明與三組價格卡。
- [x] 建立四張特色卡、訓練系統、八種情境與團體活動。
- [x] 建立八題 FAQ、交通、聯絡與 Footer。
- [x] 加入並核對 LocalBusiness／FAQ JSON-LD、canonical、OG、圖片 alt。
- [x] 驗證全部內部與外部 CTA，確認團體／個人預約分流。
- [x] 執行 HTML、JSON-LD、JavaScript、圖片路徑與橫向溢出檢查。
- [x] 執行專案 lint、TypeScript、production build、自動化測試，記錄不適用或既有失敗。
- [x] 比對 `website/index.html` 與基準分支，證明原檔未變。
- [x] 建立本機預覽；經使用者允許後才推送功能分支並建立 Vercel Preview。
- [x] 回報修改摘要、區塊合併、檔案、SEO 保留、測試、待確認資料與預覽網址。

## 驗證紀錄

- Production build：成功。
- 自動化測試：專案沒有測試檔，`react-scripts test` 回報 `No tests found`。
- Lint：`package.json` 沒有 lint script，專案也沒有獨立 ESLint 設定。
- TypeScript：專案沒有 `tsconfig.json`，候選頁為靜態 HTML/CSS/JavaScript。
- Playwright：1440×1000、820×1180、390×844 均無橫向溢出、破圖或小於 44px 的可見主要按鈕。
- axe WCAG 2 A/AA/2.1 AA：桌面與手機皆 0 violations。
- FAQ JSON-LD：與畫面八題逐字一致。
- 正式首頁與 SEO 資產：相對 `main` 零差異。
