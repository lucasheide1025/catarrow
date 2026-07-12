# Implement：官網 SEO/GEO 內容實作

分 4 個 Step（對應原策略文件 G 段的 4 個階段），每個 Step 是獨立可上線的單位，做完就檢查一次再進下一個。

## Step 1 — B + C：首頁情境區塊 + 新增 FAQ
- [ ] 首頁新增「什麼時候適合來貓小隊射箭？」8 張情境卡片區塊（design.md 第3節），先用 `#` 錨點或先連回首頁佔位也可以，等 Step 2-3 對應頁面上線後再把連結換成真實路徑
- [ ] 首頁 FAQPage schema 追加 10 題新 FAQ（design.md 第4節逐字內容），`.faq-list` 視覺清單同步新增
- [ ] `JSON.parse` 驗證 schema 合法、`node --check` 驗證 script 區塊語法完整
- [ ] 手動確認：新區塊視覺跟現有 `.rv`/卡片風格一致，FAQ 手風琴展開正常

## Step 2 — D：雨天／大太陽／新手指南 三頁上線
- [ ] 建立 `website/rainy-day/index.html`、`website/sunny-day/index.html`、`website/beginner-guide/index.html`（design.md 第1節模板複製法 + 第5節①②③規格）
- [ ] 首頁 B 段對應卡片連結換成真實路徑
- [ ] 三頁互相內部連結、連回 `/beginner-guide/`
- [ ] 各頁 FAQPage schema、meta/title 逐一核對

## Step 3 — D：親子頁上線
- [ ] 建立 `website/family/index.html`（design.md 第5節④規格）
- [ ] 首頁對應卡片連結換成真實路徑，跟雨天/大太陽頁互相連結

## Step 4 — D：情侶／朋友聚會／企業團康／I人 四頁上線
- [ ] 建立 `website/couple/index.html`、`website/friends-group/index.html`、`website/corporate-team-building/index.html`、`website/solo-friendly/index.html`（design.md 第5節⑤⑥⑦⑧規格）
- [ ] 首頁 B 段剩餘卡片連結全部換成真實路徑
- [ ] 企業團康頁 CTA 要用 `07-10-website-visual-interactive-refresh` 剛加的 LINE 連結 `https://line.me/ti/p/UJXIAt1s0O`
- [ ] I人頁的紓壓段落逐字比對 design.md 第6節措辭檢查，不能有療效宣稱

## 收尾
- [ ] 全部 8 張首頁情境卡片連結都指向真實頁面（不再有任何 `#` 佔位連結遺留）
- [ ] 7 支新頁面互相之間、與首頁之間的內部連結都跟 design.md 第5節規格一致
- [ ] `docs/second_brain/features.md` 官網條目更新，列出新增的 7 支頁面與首頁新區塊
- [ ] 同步複製到 `C:\Users\broud\Documents\Obsidian Vault\catarrow\`
- [ ] git commit（只涉及 `website/` 目錄與 `features.md`）→ push
- [ ] **不要自動部署**——PRD 已明確排除，等使用者確認內容後再手動跑 `catarrow-archery` 那個獨立 Vercel 專案的部署流程

## Rollback
每個 Step 是獨立單位，7 支新頁面互不依賴既有頁面的程式邏輯（純靜態內容），若某頁有問題可以只回退該頁對應的 commit，不影響其他頁面或首頁既有內容。
