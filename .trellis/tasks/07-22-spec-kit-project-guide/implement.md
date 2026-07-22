# 執行計畫：Spec Kit 專案基線

## Implementation Checklist

1. 讀取 constitution、spec、plan、tasks 模板與現有 `.specify` 設定。
2. 以現有程式庫為證據整理技術棧、角色、資料邊界、測試與部署面。
3. 完成 `.specify/memory/constitution.md`，加入 Sync Impact Report 並檢查無殘留 placeholder。
4. 建立 `specs/001-project-development-baseline/spec.md` 與 requirements checklist。
5. 建立 plan、research、data-model、workflow contract 與 quickstart artifacts。
6. 更新 `.specify/feature.json` 指向 baseline feature。
7. 建立 `docs/spec-kit-project-development-guide.md`，連結所有正式 artifacts 並提供命令範例。
8. 交叉檢查 constitution、spec、plan 與總覽內容一致。
9. 執行 Markdown/placeholder/path 檢查，以及專案既有 build/test 驗證中與文件變更風險相稱的部分。
10. 依 Trellis Phase 3 完成 spec-update 判斷並提出 commit 計畫，不自行推送。

## Validation Commands

```powershell
rg -n '\[[A-Z][A-Z0-9_]+\]|NEEDS CLARIFICATION|TBD' .specify/memory/constitution.md specs/001-project-development-baseline docs/spec-kit-project-development-guide.md
npm test -- --watchAll=false
npm run build
Push-Location functions; npm test; Pop-Location
git diff --check
```

## Review Gates

- Constitution 原則皆可被 PR 或驗證命令檢查。
- Spec 不包含 React、Firebase 等實作細節；技術細節只出現在 plan/research。
- 所有規格品質 checklist 項目均通過。
- `.specify/feature.json` 指向存在的目錄。
- 總覽中的命令與已安裝的 skills 名稱一致。
- 不修改產品程式碼與現有使用者未追蹤檔。

## Rollback Points

- Constitution 完成後先做 placeholder 與模板一致性檢查。
- Feature artifacts 完成後先獨立驗證，再撰寫總覽。
- 若現有 build/test 失敗，記錄為基線狀態；不在本文件任務中擴張為產品程式修復。
