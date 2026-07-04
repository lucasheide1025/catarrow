# 學生分級與系統鎖定

## Goal

為 `members` 帳號導入「學生分級」狀態機（受限／正式學生／退休中），並實作依分級的功能鎖定、教練可手動的「帳號凍結」機制、以及全站系統維護鎖。目的是讓帳號的「出席/使用規範」與現有「弓種技術檢定（CERT_LEVELS）」和「月卡付費方案（monthlyCard）」分開治理，讓教練能用分級管理誰能用系統的哪些部分。

## 確認事實（探索程式碼所得，非待確認）

- **現有 `CERT_LEVELS`**（`src/lib/constants.js`）是 6 等級 × 3 弓種的技術檢定，走藍書/金書考試任務、教練審核。這是「技術水平」軸線，與本次「帳號分級」是不同概念，**不合併、不取代**。
- **現有 `monthlyCard`**（`members.monthlyCard = {active, sessions, expiresAt}`）是付費方案的堂數/到期追蹤，與本次分級無關，**視為獨立軸線**。
- **訪客（Guest）已有獨立入口**：`App.jsx` 的 `?guest=TOKEN` 路由直接進 `GuestBattle`，完全不經過 `members` 帳號機制。本次分級系統**不影響**這條路徑，資料模型上不需要 `"guest"` 這個 tier 值。
- **「報到」UI 掛在「首頁」頁面**（`MemberApp.jsx` `page==="home"` → `MemberHome` 元件），**不是全域浮動視窗**。因此鎖定邏輯必須讓 `"home"` 頁面在受限/自動鎖定狀態下維持可進入，否則使用者無法自行報到解鎖。
- **報到寫入獨立 `checkins` collection**（docId=`memberId_日期`），**members 文件目前沒有「最後報到日期」快取欄位**，需新增 `lastCheckinDate` 欄位並在報到動作時更新，才能低成本判斷「幾天沒報到」。
- **導覽列結構**（`MemberApp.jsx` / `AdminApp.jsx`）：會員底部導覽 6 個 hub —— `home`／`adventure-hub`／`training-hub`（含子頁 `practice`／`comps`／`comp-detail`）／`gacha`（標籤「貓村」）／`inventory-hub`／`profile`（含子頁 `achievements`／`msgs`／`leaderboard`／`certexam`／`history`／`dex`／`guide`／`bowsetting`／`learn`／`external`／`notifications`）。鎖定需要在「頁面 id」細粒度上做，不能只鎖 hub——例如「受限」只開放 `profile` 基礎頁，但同屬 profile 底下的 `msgs`（公告）、`leaderboard`（排行榜）仍須鎖住。
- **教練本身也有 members 文件**（切換「射手模式」時用）。

## 權限矩陣（已確認）

| 狀態 | 允許的頁面 id |
|---|---|
| `restricted`（受限） | `home`、`training-hub`、`practice`、`profile` |
| `official`（正式學生，未觸發自動鎖定） | 全部功能，不受限制 |
| `official` → 14 天未報到觸發自動鎖定 | `home`、`training-hub`、`practice`、`gacha`、`profile`、`achievements` |
| `retired`（退休中） | 僅 `profile`（唯讀查看歷史/成就/射手卡；預設登入頁改導向 `profile`，因為 `home` 本身也鎖住） |
| `accountFrozen = true`（帳號凍結，獨立機制，優先權最高） | 無——全螢幕凍結提示頁，連報到都不行 |
| 系統維護鎖啟用 | 一般會員前台（MemberApp）全部無法使用，顯示維護提示頁 |
| `role === "admin"` | **完全豁免**上述所有限制（含維護鎖與凍結），射手模式永遠全功能 |

## Requirements

### 資料模型（`members` collection 新欄位）

- `studentTier: "restricted" | "official" | "retired"`
  - **新建會員**：明確寫入 `"restricted"`
  - **舊會員（欄位不存在/undefined）**：程式讀取時視為 `"restricted"`（不做批次資料遷移，教練上線後逐一手動改為 `official`）
  - 升級/降級：僅教練後台手動操作，無任何自動判定或綁定官網「5 堂新生課」邏輯
- `accountFrozen: boolean`（獨立於 `studentTier` 的更嚴重機制，教練手動觸發，用於停權/違規/欠費等情境）
- `lastCheckinDate: "YYYY-MM-DD"`（快取欄位，`submitCheckin` 與 `approveCheckin` 時更新為當日日期；若欄位不存在，视为「尚未有記錄」，見 Open Design Note）

### 系統維護鎖

- 新增全域設定文件（如 `systemConfig/maintenance = { enabled: boolean, message?: string }`）
- 教練後台一鍵開關
- 啟用時：一般會員（`role !== "admin"`）進入 MemberApp 一律看到維護提示頁，無法使用任何功能
- 教練後台（AdminApp）與教練本人的射手模式**不受影響**

### 功能/頁面鎖定（依分級/狀態，見上方權限矩陣）

- 導覽列（底部 nav）維持全部顯示，不隱藏任何項目
- 點擊/進入未被允許的頁面時，該處顯示「🔒 尚未開放」概念提示卡，附原因說明（例如：「此功能需正式學生身份，請洽詢教練」），不強制跳轉

### 帳號凍結（獨立於分級的嚴重機制）

- 教練後台可對特定會員設定 `accountFrozen = true/false`
- 凍結中：登入後看到全螢幕「帳號已凍結」提示頁（可附聯絡方式），無法使用任何功能，含報到
- 優先權高於 `studentTier`（即使是 `official` 也一樣被擋）

### 教練工具

- 會員管理頁需能設定/檢視每位會員的 `studentTier`、`accountFrozen`
- 因決定「不做批次自動遷移，教練逐一手動設定」，上線初期會有大量會員需要教練手動處理，**建議提供批次勾選會員 → 一鍵設為 `official` 的工具**，避免教練必須一筆一筆點擊（此為實作面優化，非新的產品範圍決策，將在 design.md 具體化）

## Out of Scope

- 訪客模式（GuestBattle）本身的任何修改
- CERT_LEVELS 檢定制度的任何修改
- monthlyCard 付費方案邏輯的任何修改
- `restricted`/`retired` 狀態沒有額外的「更久不報到會怎樣」的自動降級規則（只有 `official` 才有 14 天自動鎖定機制）
- 官網「5 堂新生課」文案與分級系統的自動綁定判斷（明確排除，教練人工把關）

## Acceptance Criteria

- [ ] 新建會員 `studentTier` 明確寫入 `"restricted"`
- [ ] 缺少 `studentTier` 欄位的舊會員，行為等同 `"restricted"`
- [ ] `official` 狀態會員超過 14 天未報到（依 `lastCheckinDate` 判斷），自動進入鎖定狀態，允許頁面限縮為 `home/training-hub/practice/gacha/profile/achievements`
- [ ] 鎖定狀態下報到成功後，立即（下次渲染）恢復全功能，不需等教練介入
- [ ] `restricted` 只能進 `home/training-hub/practice/profile`
- [ ] `retired` 只能進 `profile`，預設登入頁改導向 `profile`
- [ ] `accountFrozen=true` 時，全螢幕凍結頁擋下一切，包含報到，且優先權高於 `studentTier`
- [ ] 系統維護鎖啟用時，一般會員前台全被擋下；AdminApp 與教練射手模式不受影響
- [ ] `role==="admin"` 帳號在任何情境下（維護鎖/凍結/分級）都完全豁免
- [ ] 教練後台可設定/檢視每位會員 `studentTier` 與 `accountFrozen`，且有批次工具可加速上線初期的大量手動設定
- [ ] Firestore 規則：`studentTier`/`accountFrozen` 不可由會員自己的 client 寫入，只能經教練操作；`lastCheckinDate` 允許在報到流程中由會員自己觸發更新
- [ ] 被鎖定的頁面顯示「🔒 尚未開放」提示卡與原因說明，不強制跳轉，導覽列不隱藏項目
