# 執行計畫：全專案唯讀審查

## Checklist

1. 建立完整檔案、Git 追蹤、目錄大小、程式行數與設定盤點。
2. 將三份既有審查報告拆成可驗證主張，逐項對照目前 `HEAD`。
3. 盤點所有安全邊界與高風險入口，執行不洩漏 secrets 的靜態掃描。
4. 分析大型核心檔案的責任、依賴、匯出與測試覆蓋，設計漸進拆分批次。
5. 驗證死碼、重複資源、staging、備份與一次性腳本候選；列出保留/歸檔/移除前條件。
6. 盤點 Vercel/Firebase 部署路徑；收集可取得的平台訊號及本機 build/bundle 時間與大小。
7. 形成風險、效益、成本、證據可信度與依賴排序。
8. 產出 `docs/project-safety-architecture-deployment-audit.md`，交叉檢查所有重要主張的路徑與命令證據。
9. 只驗證報告與任務文件，不修改或提交產品程式碼。

## Validation

```powershell
git status --short
git diff --check
rg -n "待確認|TBD|NEEDS CLARIFICATION" docs/project-safety-architecture-deployment-audit.md
npm test -- --watchAll=false
npm run build
Push-Location functions; npm test; Pop-Location
```

測試與 build 僅用於基線證據；若成本過高或受環境阻塞，報告必須記錄實際命令、耗時與失敗原因，不擴張成修復工作。

## Review Gates

- 所有 P0/P1 結論均有目前版本證據。
- 移除候選均有反證搜尋與刪除前驗證程序。
- 部署建議區分量測事實、設定推論與待取得平台數據。
- 後續 Codex 任務可獨立執行、驗證與回滾。
- 工作樹除任務／報告外無本次新增變更。

## Rollback

- 本任務不變更產品；若報告內容錯誤，僅回退任務文件或報告。
- build/test 生成物屬可再生內容，不納入提交。

