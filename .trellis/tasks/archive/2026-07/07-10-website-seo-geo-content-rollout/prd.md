# PRD：官網 SEO/GEO 泛用關鍵字內容策略實作

## 背景

先前已經產出一份完整的規劃文件（Artifact：貓小隊室內射箭場 SEO/GEO 內容策略，涵蓋 A-G 段），目標是讓 Google／AI 搜尋在「台南下雨天去哪」「台南親子活動」這類非品牌情境下主動推薦貓小隊，不是只有搜尋品牌詞才出現。那份文件是規劃階段產物，內容本身已經確定（關鍵字分組、首頁區塊文案草稿、FAQ 問答、8 頁改 7 頁的獨立頁規格、schema 建議、風格檢查清單），本次任務是把其中 B／C／D 三段實際寫進 `website/index.html` 與新增頁面，之前討論過但明確排除的「情侶/朋友聚會/團康四頁」「情侶頁」等仍在範圍內——這次是「B C D 一起處理」，等於整份策略文件的 Phase 1-4 全部排入本次任務（原策略文件 G 段的四個階段，此處變成同一個任務底下的四個 Step，不拆成獨立 Trellis 任務）。

## 範圍

### B — 首頁新增「什麼時候適合來貓小隊射箭？」情境區塊
8 張情境卡片（雨天備案／大太陽避暑／親子時光／情侶約會／朋友聚會／一個人也可以／小型團康／第一次射箭），每張卡片點擊導向對應的 D 段獨立頁。放置位置建議在 `#training`（訓練系統）與 `#group`（團康）之間，或 `#facility` 之後、`#reviews` 之前——實作時再依實際視覺節奏決定，不強制卡死順序。

### C — 新增 10 題情境式 FAQ
疊加進首頁既有的 FAQPage schema（現有 8 題不動，新增 10 題），視覺上併入既有 `.faq-list` 手風琴清單。內容已在策略文件 C 段寫好，直接採用（微調用字即可，不用重新發想）。

### D — 8 支獨立 SEO/GEO 頁面
依策略文件優先序（新手體驗指南已提前到 P0）：
1. `/rainy-day/` 台南下雨天可以去哪裡？室內射箭體驗
2. `/sunny-day/` 台南大太陽去哪玩？冷氣室內射箭體驗
3. `/beginner-guide/` 台南新手射箭體驗指南
4. `/family/` 台南親子室內活動推薦
5. `/couple/` 台南情侶室內約會推薦
6. `/friends-group/` 台南朋友聚會室內活動
7. `/corporate-team-building/` 台南企業團康活動
8. `/solo-friendly/` 台南 I 人友善活動推薦（含身心紓壓段落）

每頁的 SEO title／meta description／H1／H2 架構／目標關鍵字／頁面專屬 FAQ／內部連結／CTA 文案，全部採用策略文件 D 段已經寫好的規格，不重新設計。

## 技術決策（見 design.md 詳細說明）
- `website/` 沒有建置流程、沒有樣板系統，是純手寫靜態 HTML。新頁面採「資料夾＋`index.html`」結構（例如 `website/rainy-day/index.html`），對應 `archery.catgroup.com.tw/rainy-day/` 這種乾淨網址，不依賴任何 Vercel rewrite 設定（部署流程是把 `website/` 檔案複製到另一個獨立 Vercel 專案，不能假設會套用這個 repo 根目錄的 `vercel.json`）。
- 每頁的 `<head>`（meta/schema）、header 導覽列、footer 要素完全複製自 `index.html`，只替換頁面專屬內容——因為沒有 include 機制，這是唯一可行做法，也是這個站台既有的做事方式（`simplybook-home.html` 等既有檔案也是各自獨立自足）。
- LocalBusiness schema **只留在首頁**，不要在 7 支新頁面重複宣告。每支新頁面各自帶一份**頁面專屬**的 FAQPage schema（3-4題，不跟首頁 FAQ 重複文字）。

## 驗收
1. 首頁 B 段 8 張情境卡片全部連得到對應頁面，D 段 7 頁全部可從首頁與彼此之間互相導流（依策略文件內部連結建議）。
2. C 段 10 題新 FAQ 正確疊加進首頁 FAQPage schema（用 `JSON.parse` 驗證合法）、視覺上跟既有 8 題呈現一致。
3. 每支 D 頁面：`<title>`／meta description／H1／FAQPage schema 齊全且內容跟策略文件規格一致；跟首頁一樣有 `prefers-reduced-motion` 相容的既有 `.rv` 效果（複製首頁機制即可，不用重新設計動效，這次重點是內容而非視覺）。
4. 全部 7 個新資料夾 + `index.html` 都在 `website/` 目錄下，且沒有任何一頁需要 build 流程或外部依賴，直接開檔案就能看。
5. 內容風格符合策略文件 F 段的檢查清單（尤其颱風天、兒童年齡、紓壓三處措辭，不能寫成過度宣稱）。
6. `docs/second_brain/features.md` 官網條目更新反映本次新增頁面。

## 非目標
- 不重新設計視覺——沿用剛做完的 `07-10-website-visual-interactive-refresh` 任務留下的品牌視覺語言與既有 CSS，新頁面直接複用同一份 `<style>`。
- 不處理 sitemap.xml/robots.txt/BreadcrumbList schema 的更新——策略文件把這個放在 G 段最後一個 phase（schema 補強／sitemap／Search Console），等本次 B/C/D 內容全部上線、內部連結都對了之後再排下一個任務處理，避免 sitemap 提交了結果頁面內容還沒定案。
- 不部署——本次任務完成的定義是「程式碼/檔案就緒、commit」，正式部署到 `archery.catgroup.com.tw`（獨立 Vercel 專案手動部署流程）是使用者確認過內容之後才進行的動作，不在本任務自動執行範圍內。
