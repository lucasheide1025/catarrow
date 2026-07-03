# 射箭場官網重製（靜態 HTML + SEO/GEO）

## Goal

以純靜態 HTML 重製「貓小隊室內射箭場」官方介紹＋預約入口網站，取代目前 SimplyBook 預設版型（catarcherycom.simplybook.asia/v2/）。新站需視覺上截然不同、吸引眼球，並符合 SEO 與 GEO（生成式引擎優化）需求。

## 使用者決策（2026-07-04 定案）

- 技術架構：**純靜態 HTML**（單頁，inline CSS/JS，零框架）
- 預約功能：**保留 SimplyBook**，CTA 連到 `https://catarcherycom.simplybook.asia/v2/#book`
- 素材：沿用舊站現有圖片（已下載至 `website/assets/`，共 11 張）
- 位置：repo 內 `website/` 資料夾，可獨立部署 Vercel

## Requirements

1. **內容完整**：涵蓋舊站所有資訊 — 品牌介紹、四大弓種、價目表、訓練/學籍/成就系統、團康模式、場地師資、真實評論、地址/電話/營業時間/停車。
2. **SEO**：語意化 HTML、單一 h1、meta description、Open Graph、JSON-LD（LocalBusiness/SportsActivityLocation + FAQPage）、sitemap.xml、robots.txt、圖片 alt、行動裝置友善。
3. **GEO**：開頭明確實體描述句（是什麼/在哪/提供什麼/多少錢）、FAQ 區直接回答常見問題、關鍵事實（價格、時間、地址）以純文字＋結構化資料雙軌呈現。
4. **視覺**：與舊站深藍＋金風格截然不同；採品牌 logo 本色（炭黑＋橘）的暖色編輯風設計，需吸引眼球。
5. **效能**：單一 HTML 檔、圖片 lazy loading、標註寬高避免 CLS。

## 關鍵事實（自舊站抓取，2026-07-04）

- 名稱：貓小隊室內射箭場（CAT ARCHERY）
- 地址：台南市中西區和緯路四段277巷8弄12號（⚠ SimplyBook footer 寫 14 號，主文寫 12 號，需向老闆確認）
- 電話/LINE：0973-770-682
- 營業：週一公休；週二 13:00–22:00；週三～週日 10:00–22:00
- 價格：單人單靶 1hr $300／2送1（3hr）$600；自備器材 1hr $200／3hr $400（限50磅內，複合弓彈弓禁止，僅場地）；兒童學生敬老 1hr $200／3hr $400（滿5歲/學生證/60歲以上）；團康8人 1hr $2250、3hr $4500，每加1人 1hr+$200、3hr+$350，上限16人（電話預約）
- 費用含器材租賃、場地、教練指導、教學課程；不綁約不推銷、射一次付一次
- 弓種：競技反曲弓(裸弓/主力)、現代傳統弓、美式獵弓、育樂彈弓(COMING SOON)；SANLIDA X9/X10、Krossen 弓身；20–34 lbs；5–18m 共 9 靶位（左新手道 5–10m 三靶、右進階道 5–18m 六靶）
- 學籍：累積 5 堂新生課＋考核 → 學籍身份，享折扣＋70m 戶外場使用權
- 師資：聖凱（主教練）、小白（助理教練）、Yumi（代理教練）
- 特色：I人友善靜心場域、貓店長隨緣陪伴（非營業項目）、免費訓練系統/積分/勳章

## Acceptance Criteria

- [ ] `website/index.html` 完成，涵蓋上列所有內容區塊
- [ ] JSON-LD 通過語法驗證（LocalBusiness + FAQPage）
- [ ] 手機寬度（375px）與桌面（1280px）皆版面正常，實際瀏覽器驗證
- [ ] 所有預約 CTA 指向 SimplyBook #book
- [ ] 圖片全部本地託管（website/assets/），皆有 alt
- [ ] robots.txt + sitemap.xml 存在
- [ ] Lighthouse 等級的基本效能習慣：lazy img、寬高標註、無外部 JS 依賴
