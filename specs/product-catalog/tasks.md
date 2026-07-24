# Task List: 弓箭專用商品型錄 (Archery Product Catalog Implementation)

## Phase 1: 資料層與外匯服務準備 (Data & Exchange Rate Core)
- [ ] **Task 1.1**: 建立弓箭專用 मॉक (Mock) 大資料集 `src/features/catalog/data/mockArcheryProducts.js`
  - 涵蓋反曲弓身/弓臂、複合弓、箭桿(Spine)、瞄具與護具等 50+ 項完整規格商品。
  - 每項商品設定原廠 `baseCurrency` (USD / JPY / EUR) 與 `basePrice`。
- [ ] **Task 1.2**: 開發外匯匯率服務 `src/features/catalog/api/exchangeRateService.js`
  - 支援從 API (或 Mock 實時數據) 獲取最新匯率。
  - 實現 LocalStorage 快取與匯率加成率 (Markup) 換算公式。
- [ ] **Task 1.3**: 建立型錄 State Context `src/features/catalog/context/CatalogContext.jsx`
  - 集中管理：`viewMode` ('grid' | 'flipbook'), `selectedCategory`, `filters`, `selectedCurrency` (TWD, USD, JPY, EUR)。

---

## Phase 2: 組件與視覺層開發 (UI Components)
- [ ] **Task 2.1**: 開發外匯價格渲染組件 `PriceDisplay.jsx` & 幣別切換器 `CurrencySelector.jsx`
  - 自動格式化貨幣符號 (NT$, $, ¥, €)，支援滑鼠 Hover 查看原始計價幣別。
- [ ] **Task 2.2**: 開發弓箭專業多級分類與 Faceted 屬性過濾器 `CatalogFilterSidebar.jsx`
  - 樹狀目錄 (Recurve > Riser, Bow > Limb, Arrows > Spine)。
  - 磅數/Spine/手別 (RH/LH)/介面系統特化動態篩選列。
- [ ] **Task 2.3**: 開發現代網格視圖 `ProductGrid.jsx` 與商品卡片 `ProductCard.jsx`
  - Hover 效果、規格標籤、快速預覽觸發按鈕、比對勾選。
- [ ] **Task 2.4**: 開發快速預覽彈窗 `QuickViewModal.jsx` 與規格比對列 `CompareDrawer.jsx`
- [ ] **Task 2.5**: 開發電子畫冊模式 `FlipbookViewer.jsx` 與頁面熱點 `HotspotOverlay.jsx`
  - 翻頁動畫、畫冊導航與點擊 Hotspot 彈出商品面板。

---

## Phase 3: 獨立預覽整合與驗證 (Isolated Route & Verification)
- [ ] **Task 3.1**: 建立獨立預覽總頁面 `CatalogPreviewPage.jsx`
  - 整合頂部導覽 (含 View Switcher & Currency Selector)、左側篩選列與主要內容區。
- [ ] **Task 3.2**: 配置非公開預覽路由 (`/catalog-preview`)
  - 確保主網站入口不顯示此功能，僅能透過 `/catalog-preview` 進入檢視與測試。
- [ ] **Task 3.3**: 效能與功能實測驗證
  - 測試大量商品篩選反應速度、幣別即時切換正確性、畫冊翻頁體驗。
