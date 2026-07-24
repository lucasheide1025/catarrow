# Feature Specification: 弓箭專用商品型錄 (Archery Product Catalog)

## 1. 概述 (Overview)
本功能為全新的**弓箭器材專用商品型錄**系統。專為處理弓箭器材龐大的分類樹、多維度專業規格（如磅數、手別、撓度/Spine、介面系統等）與高頻率進口商品定價需求而設計。

系統具備**雙互動體驗視圖**（電子畫冊模式 Flipbook 與 現代網格/列表模式 Grid View），並內建**外匯匯率即時連動換算引擎**。

> **隔離與預覽原則**：
> 本功能初期採完全隔離開發，**不設置任何公開入口**（如 Main Navigation 或 Footer 連結），僅保留內部開發與測試使用的預覽路由 (`/catalog-preview`)。

---

## 2. 使用者故事 (User Stories)

1. **弓箭愛好者 / 採購者**：
   - 作為使用者，希望透過樹狀目錄快速選取「反曲弓 > 弓身」或「箭枝 > 碳針箭」等精細分類。
   - 作為使用者，希望能依據專業規格（例如：拉重 30~40lb、左手/右手 RH/LH、ILF 介面）動態篩選商品。
   - 作為使用者，希望能切換「電子畫冊模式 (Flipbook)」觀看雜誌畫冊風格的圖片與熱點標籤，或切換「網格視圖 (Grid View)」進行比對與搜尋。
   - 作為使用者，希望能即時切換幣別（TWD / USD / JPY / EUR），查看依照最新外匯匯率換算後的台幣或外幣售價。

2. **店家 / 系統管理員**：
   - 作為管理員，希望以美金 (USD) 或日幣 (JPY) 設定進口弓箭底價，系統能自動根據匯率與加成率算出現行台幣售價。
   - 作為管理員，希望能靈活設定電子畫冊頁面與商品熱點 (Hotspots)。

---

## 3. 核心功能規範 (Functional Requirements)

### 3.1 分類與多維屬性篩選 (Archery Categories & Facets)
- **多層級樹狀目錄**：
  - **反曲弓 (Recurve)**: 弓身 (Riser), 弓臂 (Limbs), 瞄準器 (Sight), 安定桿/平衡桿 (Stabilizer), 箭台/響片/壓力鈕 (Rest/Clicker/Plunger)
  - **傳統弓/裸弓/獵弓 (Traditional & Barebow)**: 弓體, 護指/護臂, 弓弦
  - **箭枝配件 (Arrows & Parts)**: 箭桿 (Shaft - Spine 300~1000), 箭頭 (Point), 箭尾 (Nock), 箭羽 (Vane)
  - **護具周邊 (Gear & Accessories)**: 护胸, 箭袋 (Quiver), 弓箱 (Bow Case), 靶盤 (Target)
- **動態過濾器 (Dynamic Faceted Filters)**：
  - 價格區間 (Price Slider)
  - 品牌 (Brand: Hoyt, Win&Win, Shibuya, Easton, WNS, etc.)
  - 手別 (Handedness: RH 右手 / LH 左手 / Ambidextrous 雙手)
  - 介面規格 (Interface: ILF / Grand Prix / Formula / Thread Size)
  - 撓度 (Spine Range: 300 ~ 1200)
  - 磅數 (Draw Weight: 18 lbs ~ 60 lbs)

### 3.2 雙模式展示 (Dual View Modes)
1. **電子畫冊模式 (Flipbook / Lookbook Mode)**
   - 精美翻頁效果與畫冊佈局。
   - 畫冊頁面上設有商品熱點 (Hotspots)，懸浮或點擊可顯示商品摘要與快速預覽。
2. **現代網格/列表模式 (Grid / List View Mode)**
   - 支援 Grid (大圖導向) 與 List (規格明細對照導向) 切換。
   - 包含快速預覽彈窗 (Quick View Modal)。
   - 包含多商品比對欄位 (Product Comparison Drawer)。

### 3.3 外匯動態計價引擎 (Exchange Rate Pricing Engine)
- **多幣別儲存**：每件商品記錄 `baseCurrency` (如 USD, JPY, EUR) 與 `basePrice`。
- **匯率 API 整合**：預設介接第三方即時匯率 API，提供系統級與用戶級匯率轉換。
- **動態切換器**：前台提供幣別選擇器，可動態將原廠價格換算為 `TWD` (預設)、`USD`、`JPY` 或 `EUR`。
- **加成與稅率計算 (Markup Rate)**：支援在換算時引入 `(basePrice * exchangeRate) * markupFactor` 計算最終建議零售價。

### 3.4 獨立預覽與入口隔離 (Isolated Entry & Route)
- **非公開入口**：現有網站選單、頁首、頁尾均不顯示任何商品型錄入口。
- **獨立預覽路由**：透過特定的專用開發路由 `/catalog-preview` (或專屬 Preview Component) 訪問與驗證型錄。

---

## 4. 非功能性需求 (Non-Functional Requirements)

- **效能 (Performance)**：
  - 商品數量龐大時（1,000+品項），網格視圖必須採用 DOM Virtualization (虛擬化列表) 確保滑動幀率 > 50 FPS。
  - 匯率 API 呼叫必須設立 Cache (快取時間預設 1~6 小時)，避免過度呼叫與請求延遲。
- **響應式設計 (Responsive)**：
  - 手機端自動調整為單欄 Card 視圖；電子畫冊模式在手機端切換為單頁滑動體驗。
