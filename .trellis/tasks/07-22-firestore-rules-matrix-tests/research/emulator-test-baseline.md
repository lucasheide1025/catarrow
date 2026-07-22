# Firestore Emulator security test baseline

## 本輪執行狀態（2026-07-22 hardening batch 1 更新）

使用者追加授權後，已加入 `@firebase/rules-unit-testing` 與 `firebase-tools`，並建立 `test/firestore-rules/owner-boundary.test.mjs`。本機使用 Git ignored portable Microsoft OpenJDK 21 與已校驗 SHA-256 的 Firestore Emulator v1.21.0；`npm run test:firestore-rules` 實際結果為 **29 passed、0 failed**。

本批測試證實 `memberPerformanceSync`、`chestInventory`、`potionInventory`、`fragmentInventory`、`chestStats`、`potionDex`、`cardCollections` 現在保留 owner/admin 存取，同時拒絕 authenticated-other、anonymous 與偽造 payload memberId。下列原始 baseline 保留為本批之前的研究紀錄與後續批次契約。

### Batch A：cardMarket global economy boundary

後續 Batch A 新增 `test/firestore-rules/card-market-boundary.test.mjs`，把原本任意登入者完整讀寫改為可驗證狀態機：seller 才能建立自己的 active listing 或取消；buyer 只能把 active listing 標記 sold 且不可改 seller/card/price；sold 後只有 seller 可標記 proceeds claimed；delete 限 admin。新 suite 使用獨立 demo project namespace，避免 Node test files 平行執行時 `clearFirestore()` 互相清除 seed。全套 Rules 結果為 **35 passed、0 failed**。

Batch A2 已使用 `getAfter()` 補齊付款原子性：listing 只有在同一 batch 中買方取得目標卡，並依 `arrowdew`、`gachaToken` 或交換卡三種價格精確扣除對應資產時才能進入 sold；資產不得降為負數，交換卡扣除後至少保留一張。免費直接標 sold 的 characterization regression 現在被拒絕，三種既有合法 client batch 均通過。全套 Rules 結果為 **38 passed、0 failed**，不需要新增 callable 或修改 client。

## 原始研究階段狀態

無法在「不安裝套件」限制內執行 Rules emulator tests：

- `node_modules/@firebase/rules-unit-testing` 不存在。
- `node_modules/firebase-tools` 不存在（只有使用者層級的全域 CLI）。
- 全域 Firebase CLI 在 sandbox 中讀取 `C:\Users\broud\.config\configstore\firebase-tools.json` 時回報 `EPERM`，尚未進入 emulator 啟動階段。
- `package.json` 沒有 rules test script；`firebase.json` 也沒有 emulator 設定。

因此本輪沒有新增一個必然紅燈、無法安裝/執行的假測試檔，也沒有碰 `firestore.rules`。下列是下一批可直接實作的精確測試契約。

這代表 PRD 的「Emulator 測試可重現至少數個跨使用者寫入風險」驗收條件目前**尚未通過**。本文件只能作為下一批實作基線；下列 `succeeds` / `fails` 是依 Rules 靜態推導的預期，不是本輪實測結果。

## 建議的最小測試接線

需經使用者允許安裝開發依賴後：

```text
devDependencies:
  @firebase/rules-unit-testing
  firebase-tools

package scripts:
  test:firestore-rules = firebase emulators:exec --only firestore "node --test test/firestore-rules/**/*.test.mjs"
```

測試 runner 用 Node built-in `node:test`，避免再引入 Jest/Mocha。測試以 `initializeTestEnvironment({ projectId, firestore: { rules: readFileSync('firestore.rules', 'utf8') } })` 載入工作樹 rules；每個案例用 `withSecurityRulesDisabled` seed，結束後 `clearFirestore()`。

固定 actors：

```text
admin auth uid: admin-uid; seed admins/admin-uid
owner auth uid/email: owner-uid / owner@example.test; seed members/member-a
participant: participant-uid; room participantIds contains member-b
other: other-uid / other@example.test; seed members/member-c
anonymous: unauthenticatedContext()
```

## Characterization tests（目前 rules 應通過，名稱必須明示風險）

| ID | Actor / operation | Expected under current rules | 證明的風險 |
|---|---|---|---|
| CUR-01 | other `setDoc(chestInventory/member-a, {gold:999999})` | succeeds | 跨會員背包竄改 |
| CUR-02 | other `deleteDoc(gamePerformances/session-owned-by-a)` | succeeds | 跨會員表現刪除 |
| CUR-03 | other `setDoc(memberPerformanceSync/member-a, {revision:0})` | succeeds | 同步 revision 可被破壞 |
| CUR-04 | other `updateDoc(partyRooms/room-a, {status:'finished'})` | succeeds | 非 participant 可控制房間 |
| CUR-05 | anonymous `getDoc(guestSessions/known-id)` | succeeds | public guest session read |
| CUR-06 | anonymous `deleteDoc(guestSessions/known-id)` | succeeds | public guest session delete |
| CUR-07 | anonymous `updateDoc(guestNotifications/known-id, {email:'attacker@example.test'})` | succeeds | public notification overwrite |
| CUR-08 | other `setDoc(bookingSlotCounts/2026-07-22_19:00, {count:-99})` | succeeds | 預約容量可任意覆寫 |
| CUR-09 | other `deleteDoc(worldBossHistory/event-a)` | succeeds | 全域結算可刪除 |
| CUR-10 | anonymous `setDoc(chestInventory/member-a, ...)` | fails | 基線同時證明 auth gate 存在，但它不是 ownership gate |

這些是 characterization tests，不應在未來 hardening 後繼續期待成功。每個 test title 應包含 `[current-vulnerability]`，避免 CI 綠燈被誤讀成安全。

## Desired contract tests（目前先 `test.todo`，hardening 時逐批啟用）

1. Owner 可以讀自己的 inventory；other/anonymous 不能讀寫；admin 可支援維運寫入。
2. Owner 只能建立自己的 performance，不能把 `memberId` 指向他人；完成後 owner 也不能改 immutable identity/result。
3. Room participant 只能改自己的 ready/score 欄位；other 拒絕；host 可做合法 phase transition，但不可變更 owner identity。
4. Anonymous 可以建立 schema-valid guest notification；不能讀、更新、刪除；超長或多餘欄位拒絕。
5. 若確認仍保留 `guestSessions`，其 create/read/update 必須持有對應 capability，另一匿名 context 即使知道 doc id 也拒絕；若確認已淘汰且無外部呼叫者，則改測所有 client actor 全拒絕。
6. Booking create/cancel/reschedule transaction 造成的 counter delta 成功；單獨覆寫、負數、錯誤 delta 與 delete 拒絕。
7. Global outcome/history client write 全拒絕；只有 Admin SDK/callable 路徑負責落盤（unit test 不模擬 Admin SDK rules bypass）。

## 必測的 query 規則

Firestore Rules 不是 filter。除 document get/write 外，每批至少包含：

- owner query 只查 `memberId == ownMemberId` 應成功；無 ownership constraint 的 list 應失敗。
- participant room query 的條件必須能被 Rules 靜態證明；只在 client 端 filter 不算安全。
- `members` 排行榜目前依賴 `allow list: if isLoggedIn()`；收緊前需先提供 projection collection，否則登入流程/排行榜可能一起中斷。

## 完成下一批測試基線的驗收命令

```powershell
npm run test:firestore-rules
git diff --check
```

成功標準：CUR tests 在原始 rules 上重現允許/拒絕表面；desired tests 以 todo 分批存在；任何 production rule hardening 都必須把相應 CUR success 改為 desired rejection，不能刪除案例來取得綠燈。

本輪未修改 `firebase.json` 加入 emulator 設定，因為任務限制是報告/設計且禁止安裝；也未部署或修改正式 Rules。
