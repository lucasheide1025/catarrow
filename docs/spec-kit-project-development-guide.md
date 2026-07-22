# CatArrow Spec Kit 專案開發指南

> 適用版本：Spec Kit 0.13.2｜建立日期：2026-07-22｜環境：Windows PowerShell + Codex

## 先做這件事：重新啟動終端與 Codex

你安裝 Spec Kit 後**還沒有重開終端**。安裝程式已把 `C:\Users\broud\.local\bin` 加入 PATH，
但舊終端不會自動載入。請關閉目前終端，重新開啟後進入專案，再啟動 Codex：

```powershell
cd C:\Users\broud\Desktop\catarrow
specify --version
```

預期顯示 `specify 0.13.2`。尚未重開時可用完整路徑：

```powershell
& 'C:\Users\broud\.local\bin\specify.exe' --version
```

Codex 的技能安裝在 `.agents/skills/speckit-*`。重新啟動 Codex 後才會重新掃描並穩定載入技能。

## 這套流程解決什麼

CatArrow 是既有的 React/Firebase brownfield 專案，不是空白新專案。Spec Kit 的用途不是重新產生整個產品，
而是讓每一次修改都留下可核准、可追蹤、可測試的需求與設計證據。

本專案同時保留 Trellis：

| 工具 | 負責內容 | 主要 artifacts |
|---|---|---|
| Trellis | 工作同意、任務生命週期、規劃審閱、品質檢查、提交與歸檔 | `.trellis/tasks/`、`.trellis/spec/` |
| Spec Kit | 全域原則、單一功能需求、技術計畫、設計契約、實作任務 | `.specify/memory/constitution.md`、`specs/` |

建議規則：**一個 Trellis task 對應一個主要 Spec Kit feature**。Trellis PRD 保存使用者核准的工作範圍；
Spec Kit `spec.md` 將它整理成 user stories、requirements 與成功指標。兩者不得保存互相矛盾的需求。

## 每次開發的標準順序

```text
需求
  -> Trellis task / PRD 核准
  -> $speckit-specify
  -> $speckit-clarify（有重大歧義時）
  -> $speckit-plan
  -> $speckit-tasks
  -> $speckit-analyze
  -> $speckit-implement
  -> tests / build / rules / cost / quickstart
  -> $speckit-converge（需要檢查剩餘差距時）
  -> Trellis check / spec update / commit / finish
```

只有全域開發原則需要修改時才使用 `$speckit-constitution`。一般 feature 不應為了方便而改 constitution。

## 各技能的具體用法

### 1. `$speckit-constitution`：確立不可協商的專案原則

使用時機：第一次建立治理、改變安全邊界、加入新的全域品質要求。

```text
$speckit-constitution
加入規則：所有 guest/kid 的瀏覽器狀態必須以 memberId 與 eventId 隔離；
所有獎勵結算必須使用可重試且冪等的 operation marker。
```

它會更新 `.specify/memory/constitution.md`、調整版本並檢查 templates 是否仍一致。

### 2. `$speckit-specify`：描述 WHAT 與 WHY

輸入要包含使用者、問題、價值、範圍與成功結果，不要先指定 React component 或 Firestore API。

```text
$speckit-specify
讓正式學員可以查看最近 30 天的射箭進步趨勢；教練可切換學員查看，guest/kid 不顯示此功能。
學員需在 10 秒內理解分數與命中分布的變化，不新增公開排行榜。
```

輸出通常位於 `specs/NNN-short-name/spec.md`，並包含 requirements checklist。

### 3. `$speckit-clarify`：只處理高影響歧義

適用於範圍、安全、角色或 UX 有多個合理答案時。技術細節若能從 repo 判斷，不應詢問使用者。

```text
$speckit-clarify
```

完成條件是 spec 不再有未解的 `[NEEDS CLARIFICATION]`。

### 4. `$speckit-plan`：描述 HOW

在這裡才寫 React/Firebase 技術方案。CatArrow 的 plan 至少檢查：

- `profile.id` 與 Auth UID 的使用是否正確。
- admin/member/guest/kid 權限矩陣與 Firestore Rules。
- transaction、operation marker、retry 與離線佇列。
- listener 數量、bounded query、寫入頻率與最壞成本。
- root app、Functions/Rules、`website/` 哪個部署面受影響。
- 自動化測試、手動情境、rollout 與 rollback。

```text
$speckit-plan
沿用 React SPA 與 Firebase。趨勢資料使用既有射箭紀錄的一次性 bounded query，
不新增永久 listener；查詢限制 30 天，guest/kid 在 UI 與資料存取層都排除。
```

### 5. `$speckit-tasks`：產生可執行任務

```text
$speckit-tasks
```

每個 task 應包含：ID、所屬 user story、精確檔案路徑、依賴與驗證命令。安全／交易測試要放在實作前，
不能只寫「完成後測試」。

### 6. `$speckit-analyze`：實作前找矛盾與缺口

```text
$speckit-analyze
```

必須處理：未被 tasks 覆蓋的 requirement、相互矛盾的 acceptance scenarios、constitution 違規與模糊 task。

### 7. `$speckit-implement`：依 tasks 實作

```text
$speckit-implement
```

它不是放寬範圍的授權。遇到新增需求時先回到 spec/plan，修改並重新 analyze。

### 8. `$speckit-converge`：檢查規格與現況差距

```text
$speckit-converge
```

適合 brownfield 或分段實作後檢查剩餘工作；它應追加可追蹤 tasks，不應靜默改變原始需求。

## CatArrow 已確立的專案原則

正式全文見 [constitution](../.specify/memory/constitution.md)。摘要如下：

1. **身分與所有權明確**：`memberDocId` 與 Auth UID 不可互換；guest/kid 共用裝置狀態必須隔離。
2. **可信後端是權限權威**：隱藏 UI 不是授權，Rules/Functions 必須驗證角色、owner 與輸入。
3. **資料一致且成本可控**：共享狀態使用 transaction/marker；熱門路徑聚合寫入；migration 不得在 mount 執行。
4. **測試是合併閘門**：跨 UI、Firestore、Rules、Functions 與角色流程驗證，失敗不得部署。
5. **漸進且可回滾**：單一 user story 小步交付，區分部署面並記錄 rollout/rollback。

## 專案產品與技術基線

### 使用者與主要能力

- `admin`：會員、課務、審核、系統設定、權限與營運管理。
- `member`：訓練、比賽、成績、個人資料與遊戲化進度。
- `guest/kid`：QR／免登入體驗，使用受限功能，資料不得混入正式排行與計費。
- 核心領域：射箭訓練、成績與認證、課務／預約、怪物戰鬥、組隊、決鬥、地城與獎勵。

### 技術架構

```text
Browser
├── React SPA (src/)
│   ├── Admin / Member / Guest-Kid UI
│   ├── Domain/game logic
│   └── Firebase client access
├── Firestore + Security Rules
├── Firebase Cloud Functions (functions/, Node.js 22)
└── Local/session storage（只作隔離暫存與耐久待同步，不是權限來源）

Deploy surfaces
├── Root React app
├── Firebase Functions / Rules / Indexes
└── website/ static site
```

### 必守的不變量

- `members/{docId}` 的 doc ID 是產品資料 identity；Auth UID 只用於登入解析與授權契約。
- 舊會員沒有 `accountType` 時視為 `official`；不得用會漏掉缺欄位文件的錯誤 query。
- guest/kid 匿名 Auth 不得重用已登入的正式帳戶。
- `studentTier`、`accountFrozen` 與管理設定不得加入 member self-write allowlist。
- 獎勵、金幣、預約容量與進度重試不得重複套用。
- Asia/Taipei 是每日統計與日期 key 的明確業務時區。
- 憑證、service account 與 token 不得進入 Git 或文件。

## 技術實施計畫模板

新 feature 的 `plan.md` 至少回答：

```markdown
## Summary
- 使用者需求與選定方案

## Technical Context
- 受影響的 React modules、Firestore collections、Functions、Rules、indexes
- 目標平台、效能、成本與規模

## Constitution Check
- Identity/role gate
- Server/Rules authority gate
- Atomicity/idempotency/cost gate
- Test/cross-layer gate
- Rollout/rollback gate

## Data and Contracts
- Entities、field invariants、state transitions
- UI/data/function contracts
- Error、retry、offline 與 concurrency matrix

## Validation
- Unit、integration、Rules、manual E2E、build
- 成本上限與 listener/write 檢查

## Delivery
- 受影響部署面
- Preview/staging/prod 順序
- Rollback 與資料恢復
```

## Definition of Done

- Spec checklist 全數通過，沒有未解 placeholder 或 clarification。
- Constitution pre/post-design gates 通過，例外已記錄替代方案與期限。
- 每個 requirement 可追溯到 user story、task 與驗證結果。
- 受影響測試、build、Rules/Functions 與手動角色情境通過。
- Firestore read/write 上限、listener lifecycle 與 migration gate 已審查。
- 文件、`.trellis/spec/`、runbook 與程式行為同步。
- 部署目標、驗證方式與 rollback 清楚；未取得權限時不得部署。
- 未識別的使用者檔案與憑證不進入 commit。

## 常用驗證命令

```powershell
# Spec Kit 狀態
specify --version
Get-Content .specify\feature.json
Get-ChildItem -Recurse specs

# 文件品質
rg -n 'NEEDS CLARIFICATION|TBD|\[[A-Z][A-Z0-9_]+\]' .specify\memory specs docs\spec-kit-project-development-guide.md
git diff --check

# React app
npm test -- --watchAll=false
npm run build

# Cloud Functions
Push-Location functions
npm test
Pop-Location
```

## 本次建立的正式 artifacts

- [Project Constitution](../.specify/memory/constitution.md)
- [Baseline Specification](../specs/001-project-development-baseline/spec.md)
- [Requirements Checklist](../specs/001-project-development-baseline/checklists/requirements.md)
- [Implementation Plan](../specs/001-project-development-baseline/plan.md)
- [Research](../specs/001-project-development-baseline/research.md)
- [Data Model](../specs/001-project-development-baseline/data-model.md)
- [Development Workflow Contract](../specs/001-project-development-baseline/contracts/development-workflow.md)
- [Quickstart](../specs/001-project-development-baseline/quickstart.md)

下一次新增功能時，不要改寫 `001-project-development-baseline`；使用 `$speckit-specify` 建立下一個編號的 feature。
