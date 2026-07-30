# 重整貓小隊官網首頁

## Goal

重整貓小隊室內射箭場官網首頁，讓 1～4 位、第一次接觸射箭且正在考慮預約的新客，在第一屏與精簡內容中快速理解地點、價格、參加門檻、器材、適合對象與預約方式。

## Requirements

- 保留現有技術架構、圖片素材、SEO 情境頁、URL、metadata、JSON-LD、sitemap、robots、預約系統與會員登入。
- 本階段不得修改或覆蓋 `website/index.html`；新版只建立為 `website/index-redesign.html`。
- 不修改 Firebase、會員資料、射箭 App 或遊戲邏輯。
- 新版首頁依使用者指定的 10 個主要區塊排序，取消 01～20 連續編號並合併重複內容。
- Hero 使用現有真實學員或場地照片，貓咪插畫只作品牌裝飾。
- 個人價格以手機友善的直向方案卡呈現；團體價格與個人預約分流。
- 首頁 FAQ 僅保留 8 題，畫面答案與 FAQ JSON-LD 必須一致。
- 保留 LocalBusiness JSON-LD、canonical、Open Graph、圖片 alt 與八個情境 SEO 頁內部連結。
- 預約入口沿用現有正式主入口 `https://catarrow.vercel.app/?bk=3345b3d554e6`；SimplyBook 維持備用入口，不批次更換其他頁。
- 手機版保留安全區域友善的固定預約列，到 Footer 附近縮小或隱藏。
- 圖片只使用專案內既有真實素材，首屏優先載入，以下 lazy loading，均提供尺寸或比例。
- 不新增大型輪播、動畫套件或 AI 陌生場地照片。
- 地址目前沿用既有頁面的 12 號，但因專案筆記記載 12／14 號待確認，必須列為待人工確認，不自行改成 14 號。
- 八個靶位、5 堂新生課、器材限制、70 米戶外場、8～16 人團康價格與營業時間若新版需要呈現，只能沿用現有正式頁面資訊；不可推導或擴寫。
- 完成後只提供本機或 Vercel Preview，不部署 production、不合併 main、不修改正式網域。

## Acceptance Criteria

- [ ] `website/index.html` 與基準分支內容完全相同。
- [ ] 新版候選頁位於 `website/index-redesign.html`，桌面、平板與手機均無橫向溢出。
- [ ] Header、Hero、體驗流程、評論與證明、價目、選擇理由、訓練系統、適合對象、團體活動、FAQ／交通／Footer 全部完成。
- [ ] Hero 第一屏直接顯示指定五項關鍵資訊與兩個 CTA。
- [ ] 八個既有 SEO 情境頁、sitemap 與 robots 未刪除、未改名。
- [ ] 個人預約、會員登入、LINE、電話、Google 地圖與情境頁連結可達。
- [ ] 團體 CTA 不導向一般個人預約流程。
- [ ] FAQ 畫面與 JSON-LD 題目、答案逐字一致。
- [ ] LocalBusiness、FAQ JSON-LD 可解析，canonical 與 OG 保留。
- [ ] 鍵盤可操作導覽、手機選單、FAQ 與主要 CTA，焦點樣式可見，點擊高度至少 44px。
- [ ] 首屏圖片具優先載入設定，首屏以下圖片 lazy loading 且有尺寸。
- [ ] 專案既有 lint、TypeScript、build、test 與靜態網站檢查完成；不適用項目需明確說明。
- [ ] 只產生 Preview，不發布 production。

## Notes

- 首頁正式替換屬於後續獨立核准事項，不在本階段範圍。
- 待人工確認：正式門牌為 12 或 14 號。
