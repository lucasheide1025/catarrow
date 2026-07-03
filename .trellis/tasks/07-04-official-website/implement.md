# 執行清單 — 官網重製

## Steps

- [x] 0. 素材：抓取舊站全文案、價格、11 張圖片下載至 `website/assets/`（完成 2026-07-04）
- [x] 1. 建立 `website/index.html`：完整單頁（inline CSS/JS、所有區塊、JSON-LD、OG）
- [x] 2. 建立 `website/robots.txt`、`website/sitemap.xml`
- [x] 3. 本機驗證：Chrome 實測窄幅與 1568px 版面、動畫、marquee、CTA（修正手機 hero 順序、評論卡漏 div）
- [x] 4. JSON-LD 驗證：2 段皆 parse OK；h1×1；img 全有 alt
- [x] 5. 第二大腦筆記更新（features.md / changelog.md，已同步 Obsidian）
- [x] 6. Commit（待補 hash）

## 驗證指令

- 本機預覽：`npx serve website` 或直接 file:// 開啟（無 build 步驟）
- 檢查點：Chrome DevTools 手機模擬 375px；JSON-LD 用 DevTools console `JSON.parse` 驗證

## 回滾

全新資料夾 `website/`，不影響現有 App；回滾即刪除資料夾。
