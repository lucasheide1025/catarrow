# Spec Kit 專案開發指南與基線規範

## Goal

依據 catarrow 現有程式、文件與部署架構，建立一份可直接採用的中文 Markdown 開發指南，
涵蓋 Spec Kit 的具體用法、專案原則、專案基線規範與技術實施計畫。

## Confirmed Facts

- 專案是 Create React App 單頁應用，使用 React 19 canary、React Router 6 與 Firebase Web SDK。
- 後端使用 Firebase Cloud Functions（Node.js 22）與 Firestore，並以 Firestore Security Rules 管理資料權限。
- 主要角色包含 admin、member、guest/kid；`members` 文件 ID 與 Firebase Auth UID 不可混用。
- 專案包含射箭課務、成績、會員、訪客，以及怪物戰鬥、組隊、地城等遊戲化模組。
- 部署同時涉及 Firebase 與 Vercel；根目錄應用與 `website/` 靜態網站具有不同部署面。
- 根專案以 `npm test`、`npm run build` 驗證；Functions 以 `node --test` 驗證。
- Spec Kit 0.13.2 已以 Codex skills 模式初始化，技能位於 `.agents/skills/speckit-*`。
- 專案既有 Trellis 工作流程，需說明 Trellis 與 Spec Kit 如何避免重複或衝突。

## Requirements

- 文件 MUST 使用繁體中文，命令、路徑與識別字保留原文。
- 文件 MUST 說明從 constitution、specify、clarify、plan、tasks、analyze 到 implement 的實際操作順序。
- 文件 MUST 提供適用於 catarrow 的可測試專案原則，而非通用口號。
- 文件 MUST 描述整體產品邊界、角色、核心能力、資料與安全不變量及非功能需求。
- 文件 MUST 提供符合現有 React/Firebase/Vercel 架構的技術實施基線與品質閘門。
- 文件 MUST 清楚區分「全專案基線」與「單一功能規格」，避免把整個既有產品錯當成單一 feature。
- 文件 MUST 說明敏感憑證、Firestore 成本、權限規則與交易一致性的要求。
- 文件 MUST 附上可直接複製使用的 Spec Kit 指令範例。

## Acceptance Criteria

- [ ] 產出一份結構完整、可單獨閱讀的 Markdown 文件。
- [ ] 文件中的技術棧、路徑、驗證命令均能由目前程式庫佐證。
- [ ] 專案原則均使用 MUST/SHOULD 並附可執行的檢查方法。
- [ ] 規範包含 admin、member、guest/kid 的主要使用情境與系統邊界。
- [ ] 技術計畫涵蓋前端、Functions、Firestore Rules、測試、部署與回滾。
- [ ] 說明 Trellis 與 Spec Kit 的建議分工及禁止混用方式。
- [ ] 同步建立正式 `.specify/memory/constitution.md` 與一組 `specs/` 基線規格 artifacts。
- [ ] 不修改既有產品程式碼，不部署、不推送遠端。

## Out of Scope

- 實作新的產品功能。
- 重構現有 React/Firebase 程式碼。
- 執行正式環境部署或資料遷移。
- 為每個既有功能倒填獨立的 `specs/NNN-*` 功能目錄。

## Decisions

- 同時產出中文整合指南與可由 Spec Kit 命令直接使用的正式 artifacts。

## Open Questions

- 無阻塞問題；文件位置與 feature 編號依現有 Spec Kit 慣例自動決定。
