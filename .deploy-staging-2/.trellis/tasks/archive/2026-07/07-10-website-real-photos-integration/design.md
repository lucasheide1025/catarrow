# Design：官網真實照片整合

## 1. 檔案搬移＋壓縮流程

- `sharp` 已經是這個 repo 的既有依賴（`node_modules/sharp` 已存在，不用額外安裝），直接寫一個 Node 腳本做搬移+壓縮，不依賴系統層級的 `cwebp`（這台機器沒裝）。
- 腳本邏輯：讀 PRD 指定的圖片清單（每個區塊的相對路徑）→ 從 `public/images/archery/real/<分類資料夾>/<檔名>` 讀取 → 用 `sharp(input).resize({width: 1600, withoutEnlargement:true}).webp({quality:80}).toFile(...)` 輸出到 `website/assets/images/archery/real/<分類資料夾>/<檔名>` → 檢查輸出檔案大小，超過 800KB 就降低 quality（例如逐步降到70/60）重新輸出，直到 <800KB 或 quality 降到 50 為止（50 已經是畫質底線，不要再往下）。
- 這個壓縮腳本跑完即可刪除（暫存工具，不用留在 repo 裡），或留在 scratchpad。

## 2. HTML 整合模式

- 每個區塊沿用 `website/index.html` 現有的 section 結構慣例（`<section id="...">` + `.sec-head`/`.sec-num`/`.sec-en` + `<h2 class="rv">` + `.rv` 滾動淡入，這個站台既有的視覺語言，不要重新發明）。
- 圖片統一寫法：
  ```html
  <div style="aspect-ratio:4/3;overflow:hidden;border-radius:16px">
    <img src="assets/images/archery/real/01_新手教學與首頁主視覺/AAA00001-2.webp"
         alt="具體描述畫面內容" width="1600" height="1200" loading="lazy"
         style="width:100%;height:100%;object-fit:cover">
  </div>
  ```
  Hero 圖片是唯一的例外：不加 `loading="lazy"`，改用 `fetchpriority="high"`（比照現有 `assets/006.png` 的既有寫法）。
- 弓種展示區（3張）、貓咪安全區（1張）用單張大圖排版；其餘多圖區塊用 CSS grid（`grid-template-columns:repeat(2,1fr)` 手機、桌機可以3-4欄）排列，不用輪播套件。
- 學籍系統與訓練App區：用既有 `#training` 區塊那種手機 mockup 外框樣式（圓角+陰影模擬手機邊框），4張截圖用小尺寸並排或格線排列，不要滿版大圖。
- 活動相簿區（12區）：手機版（`@media(max-width:640px)`）預設只顯示前 9-12 張（用 CSS 或簡單 JS 隱藏其餘），「查看更多」按鈕點擊後移除隱藏 class 展開其餘照片——純前端展開，不是分頁載入，不需要額外的 JS 框架，比照現有站台的 vanilla JS 風格（例如 FAQ 手風琴、跑馬燈暫停都是原生寫法）。

## 3. 施工順序
1. 寫壓縮/搬移腳本，跑一次，確認 `website/assets/images/archery/real/` 底下的檔案都 <800KB
2. 依序寫入 12 個區塊的 HTML（可以照使用者給的順序一區一區加）
3. 「查看更多」的展開邏輯（活動相簿區）
4. 本機開啟 `website/index.html` 視覺檢查（含手機寬度模擬）
5. 確認 8 支情境頁沒有被動到
