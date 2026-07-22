# 技術設計：Spec Kit 專案基線

## Deliverables

1. `docs/spec-kit-project-development-guide.md`
   - 給人閱讀的繁體中文操作指南。
   - 整合專案原則、產品基線規範、技術實施基線與逐步命令範例。
2. `.specify/memory/constitution.md`
   - Spec Kit 的正式治理來源。
   - 版本從模板初始化為 `1.0.0`，制定日與修訂日使用 `2026-07-22`。
3. `specs/001-project-development-baseline/spec.md`
   - 將「建立可重複、可驗證的專案開發基線」視為一個 enablement feature。
   - 聚焦使用者價值、流程要求與可衡量結果，不放實作細節。
4. `specs/001-project-development-baseline/checklists/requirements.md`
   - Spec Kit 規格品質驗證結果。
5. `specs/001-project-development-baseline/plan.md`
   - 記錄 React/Firebase/Vercel 技術背景、constitution gates、真實目錄與執行策略。
6. `specs/001-project-development-baseline/research.md`
   - 記錄從程式庫確認的技術決策、理由與替代方案。
7. `specs/001-project-development-baseline/data-model.md`
   - 描述既有核心領域實體與識別碼不變量，作為新功能設計基線。
8. `specs/001-project-development-baseline/contracts/development-workflow.md`
   - 定義規格、實作、驗證與部署之間的交付契約。
9. `specs/001-project-development-baseline/quickstart.md`
   - 提供可執行的端到端使用與驗證步驟。
10. `.specify/feature.json`
    - 指向上述基線 feature，讓後續 Spec Kit 指令可以解析作用目錄。

## Boundaries

- 本任務只建立文件與 Spec Kit metadata，不改動 `src/`、`functions/`、Firestore rules 或部署設定。
- Constitution 是全專案的強制治理來源；baseline spec 描述導入這套流程的需求。
- 未來每項產品功能仍建立自己的 `specs/NNN-feature/`，不把所有產品需求累積到 baseline spec。
- Trellis 負責本 repo 的工作階段、任務生命週期與提交規範；Spec Kit 負責需求、設計與可驗證 artifacts。
- 同一項工作以 Trellis task 包住一個 Spec Kit feature；不要平行維護內容互相矛盾的兩份 PRD。

## Constitution Shape

核心原則預計涵蓋：

1. 使用者角色與識別碼正確性。
2. Firestore 安全規則與伺服器權威性。
3. 資料一致性、冪等性與成本控制。
4. 測試先行的品質閘門與跨層驗證。
5. 漸進式變更、效能、可回滾部署與文件同步。

額外章節定義技術限制與開發工作流程；治理章節定義版本、修訂與合規審查。

## Compatibility

- 保留 Spec Kit 模板要求的標題層級與 Sync Impact Report。
- 文件使用專案相對路徑，實際工具操作以 PowerShell 為主。
- 不新增 Git branch；現有 Trellis 任務與使用者工作樹保持不變。
- 不把目前未追蹤的 `.claude/settings.local.json` 納入修改或提交範圍。

## Risks and Mitigations

- **兩套流程重複**：總覽中提供唯一分工與交接點。
- **把現況誤寫成理想狀態**：明確標記「既有事實」「新治理要求」「後續改善」。
- **整體規格過度龐大**：baseline spec 僅規範開發流程，產品功能另立 feature。
- **敏感檔案外洩**：constitution 明定憑證不得提交，並在指南列出檢查方式。
- **文件迅速過時**：將文件同步列為 Definition of Done 與 constitution gate。

## Rollback

所有變更均為新增或更新的 Markdown/JSON 文件；若不採用，可逐一移除本任務新增的
`docs/spec-kit-project-development-guide.md`、`specs/001-project-development-baseline/`，並將 constitution
恢復為模板。不得以清除整個 `.specify/` 的方式回滾，因其屬已安裝工具基礎設施。
