# 技術設計

- 以 `website/index-redesign.html` 為唯一首頁施工檔，不修改正式 `index.html`。
- 延伸現有 CSS 變數與暖色紙張風格，新增靶環、箭矢、貓掌、照片拼貼及深色訓練系統段落。
- 內容分成精簡概覽區塊，詳細內容連到現有主題頁，避免回到舊版 20 段完整長文。
- 動畫只使用 CSS 與原生 JavaScript：首屏載入、IntersectionObserver 交錯進場、指標視差、數字進場與訓練畫面輪替。
- 減少動態偏好時停用位移、視差與循環動畫。
- 所有原始文字與圖片留在 DOM，確保 SEO、GEO 與 CMS 相容。
