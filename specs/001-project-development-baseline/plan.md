# Implementation Plan: 專案規格驅動開發基線

**Branch**: current working branch | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/001-project-development-baseline/spec.md`

## Summary

為現有 CatArrow brownfield 系統建立可持續使用的規格驅動流程。以全域 constitution 約束身分、
安全、資料一致性、Firestore 成本、測試與部署；每項變更以獨立 Spec Kit feature 描述需求與技術設計，
外層由 Trellis 管理任務生命週期、品質檢查與提交。

## Technical Context

**Language/Version**: JavaScript/JSX；Node.js 22（Cloud Functions）

**Primary Dependencies**: React 19 canary、React Router 6、Create React App 5、Firebase Web/Admin SDK、Cloud Functions 7

**Storage**: Cloud Firestore；localStorage/sessionStorage 作為裝置端暫存與耐久待同步佇列

**Testing**: Jest/react-scripts、Node.js `node --test`、必要的 Firestore Rules 靜態／整合驗證與手動 E2E

**Target Platform**: 現代桌面與行動瀏覽器；Firebase Cloud Functions；Vercel/Firebase 部署面

**Project Type**: React SPA + Firebase serverless backend + 獨立靜態網站

**Performance Goals**: 一般互動即時回饋；高頻射箭寫入採聚合／冪等；無即時需求的歷史資料使用 bounded fetch

**Constraints**: 現有大型 brownfield、React canary + CRA、共享裝置 guest/kid、Firestore 計量成本、Asia/Taipei 業務日期

**Scale/Scope**: admin/member/guest/kid 多角色；課務、會員、射箭成績與多種遊戲模式；根應用、Functions、Rules、website 多部署面

## Constitution Check

*GATE: 設計前與設計後皆必須通過。*

| Gate | Pre-design | Post-design evidence |
|---|---|---|
| 身分、角色與所有權明確 | PASS | data model 定義 member doc ID/Auth UID 與 accountType 不變量 |
| 權限由 Rules/可信後端落實 | PASS | workflow contract 要求 Rules 與 Functions 同步審查 |
| 一致、冪等、成本可控 | PASS | research 與 contract 要求 transaction、marker、bounded reads、migration gate |
| 測試與跨層驗證 | PASS | quickstart 與 DoD 定義 root/functions/rules/手動驗證矩陣 |
| 漸進、可觀測、可回滾 | PASS | 每 feature 獨立交付，並區分三個部署面與 rollback |

## Project Structure

### Documentation (this feature)

```text
specs/001-project-development-baseline/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    └── development-workflow.md
```

### Source Code (repository root)

```text
src/                     # React SPA、角色 UI、領域與 Firebase client 存取
functions/               # Firebase Cloud Functions（Node.js 22）與 node:test
firestore.rules          # Firestore 授權與資料寫入邊界
firestore.indexes.json   # Firestore indexes
public/                  # SPA 靜態資產
website/                 # 獨立公開靜態網站與其 Vercel 部署面
scripts/                 # E2E、維運與資料操作腳本
docs/                    # 人類可閱讀的設計、runbook 與交接文件
.trellis/                # repo 工作生命週期與專案知識
.specify/                # Spec Kit 模板、scripts、constitution 與 active feature metadata
specs/                   # 按 feature 編號保存的規格與技術 artifacts
```

**Structure Decision**: 保留現有單 repo 多部署面的結構；不為導入 Spec Kit 重構產品程式。

## Delivery Strategy

1. 全域治理只更新 constitution，所有功能共同引用。
2. 每項新能力建立一個 `specs/NNN-short-name/`，不在 baseline 中累積產品需求。
3. Spec、plan、tasks 完成並通過 analyze 後才修改程式。
4. 依受影響層執行測試；先 preview/局部部署，再正式部署。
5. 失敗時回滾該部署面；資料變更依 plan 的相容與恢復策略處理。

## Complexity Tracking

無 constitution 違規。Trellis 與 Spec Kit 同時存在是刻意分工：前者管理工作生命週期，後者管理 feature artifacts。
