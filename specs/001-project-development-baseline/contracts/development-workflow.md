# Contract: CatArrow 規格驅動開發工作流

## Inputs

- 使用者核准的需求與範圍
- 目前 Trellis task 的 `prd.md`、必要時的 `design.md` / `implement.md`
- `.specify/memory/constitution.md`
- 現有程式、測試、設定、`.trellis/spec/` 與相關 runbook

## Required Sequence

1. **Govern**：全域原則有變更時更新 constitution，否則讀取現有版本。
2. **Specify**：建立單一 feature spec；只描述 WHAT/WHY，通過 requirements checklist。
3. **Clarify**：僅處理會改變範圍、安全或 UX 且沒有合理預設的問題。
4. **Plan**：記錄技術背景、research、data model、contracts、quickstart；constitution gate 必須前後通過。
5. **Tasks**：每項 task 含 ID、user story、精確路徑、依賴與驗證。
6. **Analyze**：檢查需求覆蓋、矛盾、遺漏與 constitution 違規。
7. **Implement**：依 task 順序小步完成，不把額外範圍塞入當前 feature。
8. **Check**：執行受影響測試、build、Rules/Functions/角色/成本檢查與 quickstart。
9. **Finish**：同步文件與 `.trellis/spec/`，依 Trellis 提交與歸檔。

## Quality Gates

| Change surface | Mandatory evidence |
|---|---|
| React UI | acceptance scenario、mobile/empty/loading/error、`npm run build`、相關測試 |
| Auth/roles | admin/member/guest/kid matrix、owner ID、同 tab/shared device 情境 |
| Firestore data | Rules、index、query callers、transaction/idempotency、cost upper bound |
| Cloud Functions | auth/input/ownership/replay tests、`functions` 的 `npm test`、部署與回滾 |
| Migration/bulk operation | dry-run、lease、version、cursor、batch limit、progress、failure details |
| Deployment | 明確目標（root app / Functions+Rules / website）、驗證 URL、rollback |

## Failure Contract

- Spec checklist 未通過：不得進入 plan。
- Constitution gate 未通過且未記錄例外：不得建立 implementation tasks。
- Analyze 發現未覆蓋需求或衝突：回到 spec/plan 修正。
- 測試或 build 失敗：不得部署；既有基線失敗需明確區分，另立修復工作。
- 部署或資料操作需要新權限：停止並取得使用者確認。

## Completion Contract

- 所有 requirements 可追溯至 acceptance scenarios、tasks 與驗證結果。
- 無未解 placeholder、`NEEDS CLARIFICATION` 或未說明的 constitution violation。
- 文件、規格與實際程式行為一致。
- 提交範圍不包含未識別的使用者檔案、憑證或無關 WIP。
