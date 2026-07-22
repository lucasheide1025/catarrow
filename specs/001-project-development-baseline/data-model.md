# Data Model: 專案開發基線

本文件描述規格與開發流程會依賴的核心概念，不取代 Firestore schema 文件。

## Governance Entities

### Project Constitution

- `version`: SemVer
- `ratifiedDate`: 原始採用日期
- `lastAmendedDate`: 最近修訂日期
- `principles`: 可測試、可在 plan/PR 檢查的全域規則
- 狀態：draft -> ratified -> amended；不允許無版本覆寫

### Trellis Task

- `path`: `.trellis/tasks/MM-DD-slug/`
- `status`: planning -> in_progress -> completed/archive
- `prd`: 使用者需求與 acceptance criteria
- `design` / `implement`: 複雜工作設計與執行計畫
- 關係：一個 task SHOULD 對應一個主要 Spec Kit Feature

### Spec Kit Feature

- `featureDirectory`: `specs/NNN-short-name/`
- `spec`: WHAT/WHY、user stories、requirements、success criteria
- `plan`: HOW、constitution gates 與 source structure
- `research` / `dataModel` / `contracts` / `quickstart`: 設計證據
- `tasks`: 實作單元與需求追蹤
- 狀態：draft -> clarified -> planned -> tasked -> analyzed -> implemented -> converged

## Product Identity Invariants

### Member

- `memberDocId`: Firestore `members/{id}` 的 document ID；產品資料關聯的主要 identity
- `authUid`: Firebase Auth identity；登入解析欄位，不保證與 `memberDocId` 相等
- `role`: `admin` 或 `member`
- `accountType`: `official`、`guest`、`kid`；舊文件缺值視為 `official`
- `studentTier`: 功能權限級別，與技術認證／月卡狀態分離
- `accountFrozen`: 獨立 kill switch

### Guest/Kid Session

- `memberId`: 必須對應目前使用者
- `sessionSourceId`: camp/session 來源
- `authUid`: 僅可使用匿名或隔離 Firebase App 建立的 identity
- browser storage key: 至少包含 `memberId`；事件狀態另含 event/room ID

### Durable Operation

- `operationId`: 裝置 ID + 單調 sequence 或同等穩定 ID
- `ownerMemberId`: 資料所有者
- `count/payload`: 不可變操作內容
- `createdAt`: 建立時間
- 狀態：pending local -> committed marker -> local cleanup；重試不得產生新 ID

## Validation Rules

- `memberDocId` 與 `authUid` 不可互換。
- guest/kid 不得出現在 official-only 清單、排行榜與計費資料。
- 權威欄位只能由 admin/Rules/Functions 核准的路徑改動。
- 高價值共享狀態不得使用無 marker 的 read-modify-write。
- migration 不能由一般 UI lifecycle 觸發。
