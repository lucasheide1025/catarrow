# Research: CatArrow 開發基線

## Decision 1：維持既有 React/Firebase 架構

**Decision**: 新規格預設沿用 React SPA、Firebase Auth/Firestore、Cloud Functions 與現有部署面。

**Rationale**: `package.json`、`functions/package.json`、`firebase.json` 與現有模組已形成可運作系統；本次目標是建立規格流程，不是平台遷移。

**Alternatives considered**: 改用 Next.js 或獨立 API server；未被已知需求要求，會擴大相容、部署與資料遷移風險。

## Decision 2：Trellis task 包住一個 Spec Kit feature

**Decision**: Trellis 管理 consent、planning、check、commit 與 session；Spec Kit 管理 constitution、spec、plan、tasks 與 feature design artifacts。

**Rationale**: 兩者優勢不同。建立一對一對應可保留既有 repo 規則，又避免兩份互相矛盾的執行計畫。

**Alternatives considered**: 完全以 Spec Kit 取代 Trellis；會違反現有 AGENTS.md 與工作生命週期。完全不使用 Spec Kit；則無法使用新安裝的 skills 與 feature artifacts。

## Decision 3：安全與資料正確性為 constitution 核心

**Decision**: 把角色／ID、不可信前端、Rules/Functions 權威、冪等交易列為不可協商原則。

**Rationale**: 專案已有 admin/member/guest/kid、多個共享資料與獎勵路徑；既有 spec 記錄過匿名 Auth UID 重用、`deleteField()` 誤用與自我提升權限等實際風險。

**Alternatives considered**: 僅列一般 code quality 原則；不足以防止已發生過的跨層事故。

## Decision 4：Firestore 成本是架構 gate

**Decision**: 每個 listener、熱門寫入、migration 與 Cloud Function 都需記錄成本上限與停止條件。

**Rationale**: 現有成本規範已定義 bounded fetch、寫入聚合、operation marker、central cost-control 與禁止 page-mount migration。

**Alternatives considered**: 事後只看帳單；無法阻止錯誤 listener 或 migration 在短時間內耗盡 quota。

## Decision 5：文件基線不觸發產品重構

**Decision**: 本 feature 只建立 Markdown 與 `.specify/feature.json`。

**Rationale**: 可獨立驗證、可快速回滾，且不把導入流程與產品風險混在一起。

**Alternatives considered**: 同時整理 source tree、補測試或升級 CRA；都是獨立工作，應另立 feature。
