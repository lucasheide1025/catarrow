# Implement：官網真實照片整合

依 design.md 施工順序，逐步驗證。

## Step 1 — 壓縮/搬移腳本
- [ ] 寫 Node 腳本（用既有 `sharp` 依賴），依 prd.md 的完整清單，把每個區塊指定的照片從 `public/images/archery/real/` 複製壓縮輸出到 `website/assets/images/archery/real/`（維持分類子資料夾）
- [ ] 超過800KB的自動降quality重壓，直到<800KB或quality降到50為止
- [ ] 跑完後 `du -sh` 確認每個輸出檔都 <800KB，回報壓縮前後的總大小對比

## Step 2 — 12 區塊 HTML
- [ ] 依 prd.md 逐區塊寫入 `website/index.html`（Hero／新手教學／場地器材代購／弓種展示／親子兒童／團康活動／長期練習／戶外進階／學籍系統App／貓咪安全／校外合作賽事／活動相簿），標題文字逐字照 prd.md
- [ ] Hero 圖片 `fetchpriority="high"`、無 lazy；其餘全部 `loading="lazy"`
- [ ] 所有 img 都有 width/height（或 aspect-ratio 容器）+ 具體 alt
- [ ] 不使用輪播，純 CSS grid/flex

## Step 3 — 活動相簿「查看更多」
- [ ] 手機版（`max-width:640px`）預設只顯示前 9-12 張，其餘用 class 隱藏
- [ ] 「查看更多」按鈕用既有 vanilla JS 風格（比照 FAQ 手風琴/跑馬燈暫停的既有寫法慣例）純前端展開，不做分頁載入

## 收尾
- [ ] 本機開啟 `website/index.html`（`file://`）視覺檢查全部12區塊
- [ ] 瀏覽器開發者工具切手機寬度，確認排版正常、圖片不變形、活動相簿「查看更多」正常運作
- [ ] Grep 確認沒有動到 `website/rainy-day/`等既有8支情境頁
- [ ] 更新 `docs/second_brain/features.md` 官網條目
- [ ] 同步複製到 Obsidian Vault
- [ ] git commit（這是純靜態網站內容，不是 App 功能，可以直接commit——不像預約系統那個有push限制；但**不要自動部署**，部署是使用者確認內容後自己執行的動作）

## Rollback
只新增了 `website/assets/images/archery/real/` 這個新資料夾＋修改 `website/index.html`，`public/images/archery/real/` 原始檔完全沒動，出問題可以直接回退這次 commit。
