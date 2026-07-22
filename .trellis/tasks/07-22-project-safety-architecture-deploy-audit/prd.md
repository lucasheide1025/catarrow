# 全專案安全、架構與部署效能審查

## Goal

接手 Gemini 對整個 catarrow 專案的既有審查工作，確認已完成與未完成範圍，並以程式碼、設定、文件與版本紀錄為證據，產出一份供 Codex 後續執行的安全優化、核心檔案拆分減肥、目錄重整、不必要檔案候選，以及部署時間優化報告。

本任務只做唯讀分析與報告；不得修改產品程式碼、移動或刪除檔案、安裝套件、部署或推送遠端。

## Confirmed Intent

- 審查範圍涵蓋整個專案的程式碼與文件。
- 必須先盤點 Gemini 已做到哪裡，再接續缺口，避免重做或漏做。
- 報告要能讓 Codex 後續按風險與依賴順序執行。
- 主要關注：程式碼安全、核心大型檔案分離與瘦身、檔案配置、可移除檔案候選、部署耗時。
- 所有移除、搬移、重構與部署行為均不在本任務授權範圍內。

## Confirmed Repository Facts

- 已找到三份既有審查產物：`CODEBASE_AUDIT_AND_REDUNDANCY_REPORT.md`、`PROJECT_REFACTORING_AND_CLEANUP_REPORT.md`、`dead-code-audit-report-2026-07-19.md`。
- 前兩份標示為 2026-07-21 Antigravity AI Assistant 產物；第三份為 2026-07-19 的死碼與瘦身調查。
- 既有報告已提出大型檔案、重複邏輯、訂閱清理、靜態資源、一次性腳本與部署殘留等候選，但尚未形成可追溯的逐項當前版本驗證矩陣。
- 目前前端為 Create React App／React SPA；Vercel 使用 `npm ci --prefer-offline --no-audit --no-fund` 與 `npm run build`，輸出 `build/`。
- `.vercelignore` 已排除文件、scripts、Trellis、舊 build 與部署 staging 等大量非部署內容。
- Firebase 設定包含 Functions、Firestore Rules 與 indexes，Functions 使用 Node.js 22 並有獨立 lockfile。
- `vercel-optimize` 對 Create React App 不提供完整 route-to-source 指標映射，只能在使用者接受後進行有限的 Vercel 平台／建置與程式碼掃描審查。
- Git `main` 相對 `origin/main` ahead 2；目前另有使用者未追蹤 `.claude/settings.local.json` 與本審查任務目錄。

## Requirements

- MUST 搜尋 Gemini 留下的報告、對話轉存、任務、規格、工作日誌與未提交變更，標示其完成度及證據位置。
- MUST 盤點專案技術棧、套件邊界、部署面、建置流程與主要高風險入口。
- MUST 以靜態唯讀方式檢視安全風險，包括憑證暴露、授權邊界、Firestore Rules、Functions、輸入驗證、依賴與部署設定。
- MUST 找出高複雜度或過大的核心檔案，提出可漸進驗證的拆分邊界，不直接重構。
- MUST 找出目錄錯置、重複、生成物或疑似不必要檔案；只列候選並說明刪除前驗證方式，不執行移除。
- MUST 分析部署耗時的可驗證原因，區分 Firebase、Functions、Firestore Rules、根應用與 `website/`／Vercel 等部署面。
- MUST 將發現依嚴重度、證據可信度、預估效益、實作成本與依賴關係排序。
- MUST 明確區分已證實問題、需量測假設與無法由儲存庫判定的項目。
- MUST 產出單一主報告，並在必要時附機器可讀或分區盤點附件。
- MUST 保留使用者現有未提交或未追蹤檔案，不將其視為可移除項目。

## Acceptance Criteria

- [ ] Gemini 既有工作的完成度、產物位置與缺口有清楚對照。
- [ ] 報告涵蓋安全、核心檔案拆分、目錄重整、移除候選及部署效能五個面向。
- [ ] 每項重要發現均附檔案路徑、設定或命令輸出等證據。
- [ ] 部署優化建議能對應到實際 build/deploy 設定，且包含建議量測方法。
- [ ] 建議按優先順序切成可獨立執行與驗證的後續任務。
- [ ] 未修改產品程式碼、未移動或刪除檔案、未安裝套件、未部署、未推送。
- [ ] 主報告以繁體中文撰寫，技術名稱、命令與路徑保留原文。

## Out of Scope

- 實作任何安全修補、重構、拆檔或目錄搬移。
- 刪除任何檔案或依賴。
- 執行 Firebase／Vercel 正式或預覽部署。
- 修改正式環境資料、Rules、Functions 或環境變數。
- 僅憑檔名判定檔案無用，或在缺乏依賴證據時建議直接刪除。

## Open Questions

- 是否接受 Create React App 專案只能進行有限的 Vercel 平台／建置與程式碼掃描審查，無法保證 route-level 指標映射。

## Notes

- 本任務屬複雜、全專案、唯讀審查，需要 `design.md` 與 `implement.md` 後才可進入執行階段。
