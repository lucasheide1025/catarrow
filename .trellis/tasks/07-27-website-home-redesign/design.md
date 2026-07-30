# 技術設計

## 邊界

- 現有官網是無建置流程的靜態 HTML，改版維持此架構。
- `website/index.html` 為受保護正式首頁，本階段不寫入。
- `website/index-redesign.html` 是可獨立開啟的完整候選首頁，資產路徑與正式首頁相同。
- 八個 SEO 情境頁、`sitemap.xml`、`robots.txt` 與 App 程式碼保持不變。

## 頁面結構

候選頁採語意化 `header > nav`、`main > section`、`footer`。主要錨點為：

1. `#first-visit`
2. `#reviews`
3. `#pricing`
4. `#features`
5. `#training`
6. `#for-who`
7. `#groups`
8. `#faq`
9. `#visit`

Hero 與卡片使用 CSS Grid/Flex，不引入第三方 UI 或動畫依賴。手機固定 CTA 以 `env(safe-area-inset-bottom)` 處理安全區域，IntersectionObserver 觀察 Footer，接近 Footer 時切換隱藏狀態。

## SEO 與資料

- 複製現有正式首頁 title、description、canonical、OG 與 LocalBusiness 事實資料，再依新版可見 FAQ 建立一份完全一致的 FAQPage JSON-LD。
- 保留文字型重要內容，不以圖片取代。
- 預約主入口沿用現有 Vercel URL；SimplyBook 僅保留在 FAQ／聯絡附近作備用說明。
- 地址仍顯示現有 12 號，但在交付報告標記 12／14 號矛盾。

## 圖片與效能

- Hero 選用既有 `01_新手教學與首頁主視覺` 真實照片，使用 `fetchpriority="high"`、固定尺寸與合適 `object-position`。
- 流程四圖、團體三至四圖、訓練二至三圖均從現有 WebP 素材挑選。
- 首屏以下一律 `loading="lazy"`、`decoding="async"`，並保留寬高。

## 回復與正式替換

- 因正式 `index.html` 未變，本階段回復只需停止使用候選頁。
- 後續若使用者核准替換，才把候選內容同步到 `index.html`，另做一次 SEO 與連結驗證。
