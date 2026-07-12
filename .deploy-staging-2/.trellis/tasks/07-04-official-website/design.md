# 設計文件 — 官網重製

## 視覺概念：「暖紙靜心 × 運動編輯風」

與舊站（深藍底＋金字、置中排版）徹底區隔：

- **配色**：暖米紙色底 `#faf6ef`、炭墨黑 `#2b2926`（logo 貓色）、品牌橘 `#e8720c`（logo 弓色）點綴、輔以淡橘 `#fdeedd`。深色僅用於少數反差區塊（hero 或 footer）。
- **字體**：標題 Noto Serif TC（襯線、超大級距、編輯感）；內文 Noto Sans TC。Google Fonts 載入，`font-display: swap`。
- **版式**：非置中對稱 — 大字報式標題、左右錯落的圖文、區塊編號（01–08）、大量留白；靶環同心圓與箭矢線條作裝飾 motif（純 CSS/SVG）。
- **動態**：IntersectionObserver 進場淡入上移；評論用無限 marquee 水平滾動；hero 有微視差或呼吸動畫。尊重 `prefers-reduced-motion`。
- **吸睛點**：超大中文襯線標題（如「射箭，本來就該這麼純粹」）、貓咪插圖出血排版、橘色圓形「立即預約」浮動按鈕（手機常駐）。

## 頁面結構（單頁 index.html）

1. **Sticky Nav**：logo＋錨點連結＋橘色預約按鈕
2. **Hero**：大標「城市喧囂外的靜心起點」＋副標＋006 耳機貓＋預約 CTA＋四個 tag（新式團康/新手友善/室內環境/運動紓壓）
3. **01 為什麼選擇我們**：三卡 — 不綁約(005)、I人友善(006)、貓店長(007)
4. **02 四種弓道**：001–004 四卡（彈弓標 COMING SOON），含裸弓詳細規格
5. **03 價目表**：表格式清楚價格（GEO 關鍵區）＋「全部免費」清單
6. **04 訓練系統**：015 App 截圖＋學籍三階段＋成就勳章
7. **05 團康與遊戲模式**：四模式＋8–16人方案＋電話 CTA
8. **06 場地與師資**：008 實景照＋左右射道規格＋三位教練
9. **07 學員評論**：精選 8–10 則真實評論 marquee
10. **08 FAQ**：6–8 題（GEO 核心：價格？新手可以嗎？要預約嗎？停車？貓？年齡限制？）
11. **聯絡資訊**：地址/電話/時間/停車＋Google Maps 連結＋結尾 CTA
12. **Footer**：NAP 資訊重複（SEO local signal）

## SEO / GEO 技術規格

- `<title>`：貓小隊室內射箭場｜台南射箭體驗・新手教學・免預約器材全包 — CAT ARCHERY
- meta description：含 台南、射箭、體驗、價格、中西區 等關鍵字，155 字內
- JSON-LD ×2：`SportsActivityLocation`（name/address/geo/telephone/openingHoursSpecification/priceRange/hasOfferCatalog/aggregateRating）＋ `FAQPage`
- OG/Twitter card：og:image 用 008 實景照
- canonical：placeholder（正式網域待定，部署後更新）
- 開頭段落 GEO 實體句：「貓小隊室內射箭場是位於台南市中西區的室內射箭場，提供競技反曲弓…每小時 300 元…」
- `sitemap.xml`、`robots.txt`
- 語意標籤：header/nav/main/section/article/footer；h1 唯一

## 檔案結構

```
website/
├── index.html      （inline CSS + inline JS，零外部依賴除 Google Fonts）
├── robots.txt
├── sitemap.xml
└── assets/         （11 張圖，已下載完成）
```

## 風險與備註

- 地址 12 號 vs 14 號待確認（先用主文 12 號）
- 正式網域未定 → canonical/sitemap 先用 placeholder，部署後替換
- 不動現有 CRA 專案任何檔案；Vercel 另建專案 root=website/
