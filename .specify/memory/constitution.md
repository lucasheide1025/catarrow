<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Added principles:
  - I. 身分、角色與資料所有權必須明確
  - II. 伺服器與安全規則是權限權威
  - III. 資料操作必須一致、冪等且成本可控
  - IV. 測試與跨層驗證是合併閘門
  - V. 漸進交付、可觀測、可回滾
- Added sections: 技術與安全限制、規格驅動開發流程
- Removed sections: none (initial ratification)
- Template review:
  - .specify/templates/plan-template.md: compatible; Constitution Check can evaluate these gates
  - .specify/templates/spec-template.md: compatible; no mandatory heading changes required
  - .specify/templates/tasks-template.md: compatible; security, tests and deployment tasks are required by plan gates
- Follow-up TODOs: none
-->

# CatArrow Constitution

## Core Principles

### I. 身分、角色與資料所有權必須明確

- 所有功能 MUST 明確區分 `admin`、`member`、`guest` 與 `kid` 的能力與資料範圍。
- 程式 MUST 使用 `profile.id`／member document ID 作為會員資料識別；除非契約明確要求，
  不得假設 document ID 等於 Firebase Auth UID。
- 舊會員缺少 `accountType` 時 MUST 視為 `official`；guest/kid 的資料、排行榜與計費查詢
  MUST 依既有契約排除。
- 共用裝置上的 localStorage/sessionStorage key MUST 包含 member ID；事件狀態另須包含 event/room ID。
- 新的匿名登入流程 MUST 隔離既有正式登入，不得讓 guest/kid 重用真實使用者的 Auth UID。

理由：CatArrow 同時服務教練、正式學員與共用裝置上的訪客。身分混淆會造成越權、錯帳與資料污染。

### II. 伺服器與安全規則是權限權威

- 隱藏 UI 不構成授權。敏感寫入 MUST 由 Firestore Security Rules、Cloud Functions 或交易再次驗證。
- `studentTier`、`accountFrozen`、管理設定、獎勵與結算等權威欄位 MUST 禁止會員自行提升或修改。
- 任何 Firestore schema、query 或寫入欄位變更 MUST 同步審查 `firestore.rules`、索引需求與所有呼叫端。
- 密鑰、service account、token 與正式環境憑證 MUST NOT 進入 Git；紀錄與文件 MUST NOT 包含其內容。
- Cloud Functions MUST 驗證呼叫者、輸入、重放風險與資源所有權，並回傳可診斷但不洩密的錯誤。

理由：前端程式可被繞過，資料庫與可信後端才是安全邊界。

### III. 資料操作必須一致、冪等且成本可控

- 金幣、獎勵、預約容量、戰鬥結算與累積進度等多方共享資料 MUST 使用 transaction、
  immutable operation marker 或同等原子機制。
- 可重試操作 MUST 使用穩定 operation ID；成功確認前不得刪除本機待同步資料。
- 熱門路徑 MUST 合併寫入、限制讀取數量並優先使用有明確即時需求的 listener；靜態預覽 SHOULD
  使用 bounded one-off fetch。
- 大量 migration/backfill MUST 是可 dry-run、可分批、可續跑、有全域 lease 的顯式管理操作，
  MUST NOT 在頁面 mount、登入或一般導覽時自動執行。
- 新 listener、批次讀寫或 Cloud Function MUST 說明最壞成本、停止條件與 cost-control gate。

理由：資料正確性與 Firestore 成本是同一項可靠性責任；重試或即時監聽不得造成重複獎勵與成本事故。

### IV. 測試與跨層驗證是合併閘門

- 每項 feature spec MUST 有可獨立驗證的 user story、Given/When/Then acceptance scenario 與成功指標。
- 純領域邏輯與 Cloud Functions MUST 有自動化測試；涉及權限、交易、角色或資料模型時 MUST 加入
  對應規則／整合／手動情境驗證。
- 變更 MUST 至少通過受影響範圍的測試與 `npm run build`；Functions 變更 MUST 通過
  `functions` 的 `npm test`。
- guest/kid 重用正式元件時 MUST 搜尋完整 render subtree 的 `useAuth()` 與所有資料寫入路徑，
  不能只檢查直接子元件。
- 測試失敗、build warning 惡化或 constitution gate 未通過時 MUST NOT 部署；例外必須記錄理由、風險與期限。

理由：CatArrow 跨越 UI、Firestore、Rules 與 Functions，單層測試無法證明完整行為。

### V. 漸進交付、可觀測、可回滾

- 功能 MUST 以最小、可獨立驗證的 user story 交付；不得把無關重構混入同一規格與部署。
- 破壞性 schema、權限、結算或部署變更 MUST 有相容策略、rollout、rollback 與資料恢復說明。
- 錯誤與管理操作 MUST 留下足夠的結構化診斷資訊；敏感資料與憑證 MUST 被遮蔽。
- 根 React 應用、Firebase Functions/Rules 與 `website/` 靜態站 MUST 視為不同部署面，
  分別驗證並明確標示部署目標。
- 程式、規格、操作手冊與 `.trellis/spec/` MUST 在同一工作項目同步；過時文件視為未完成。

理由：小步、可觀測且可回滾的改動，能降低現有大型 brownfield 系統的回歸與營運風險。

## 技術與安全限制

- 前端基線為 Create React App、React 19 canary、React Router 6、Firebase Web SDK；引入新框架或
  狀態層 MUST 先證明現有工具不能滿足需求。
- 後端基線為 Firebase Cloud Functions（Node.js 22）與 Firestore；正式部署需分開驗證 Functions、
  Rules 與 indexes。
- 時間與每日統計 MUST 明確使用 Asia/Taipei 業務日期，不得依瀏覽器隱含時區推斷。
- 對正式資料執行批次操作前 MUST 有備份、dry-run、上限、進度與失敗明細。
- React canary 與舊 CRA 工具鏈的相容性 MUST 由 clean build 證明；不得只以開發伺服器成功判定。
- 無障礙、mobile layout、reduced motion 與載入／錯誤／空狀態 MUST 納入 UI acceptance scenarios。

## 規格驅動開發流程

1. 每個工作先確認 Trellis task；一個 Trellis task SHOULD 對應一個 Spec Kit feature directory。
2. 修改全域治理時先執行 `$speckit-constitution`；一般功能不得為了方便而放寬 constitution。
3. 使用 `$speckit-specify` 定義 WHAT/WHY，再視需要執行 `$speckit-clarify`；spec 不得夾帶實作方案。
4. 使用 `$speckit-plan` 定義 HOW，完成 constitution pre/post-design gates、research、data model、contracts 與 quickstart。
5. 使用 `$speckit-tasks` 建立依 user story 排列、具有精確路徑與驗證步驟的 tasks；高風險測試置於實作前。
6. 實作前執行 `$speckit-analyze`；實作時以 `$speckit-implement` 逐項完成，並遵守 Trellis 的檢查與提交流程。
7. Definition of Done 包含：acceptance scenarios、受影響測試、build、規則與成本審查、文件同步、部署與回滾說明。

## Governance

- 本 constitution 優先於個別 feature plan、臨時提示與慣例；衝突時 MUST 修正較低層文件或提出正式修訂。
- 修訂 MUST 說明原因、影響範圍、遷移方式與模板同步結果，並由專案負責人核准。
- 版本遵循 SemVer：移除或重新定義原則為 MAJOR；新增原則或重大擴充為 MINOR；文字澄清為 PATCH。
- 每個 plan、PR 與部署前 MUST 檢查相關原則；例外需在 Complexity Tracking 中記錄並有到期日。
- 每次功能完成 MUST 評估是否把新發現的跨功能不變量寫回 constitution 或 `.trellis/spec/`。

**Version**: 1.0.0 | **Ratified**: 2026-07-22 | **Last Amended**: 2026-07-22
