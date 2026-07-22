# Firestore P0 權限矩陣

## 判讀方式

- `A`：允許；`D`：拒絕；`F`：只允許限定欄位或限定狀態轉移。
- 每格順序都是 `read / create / update / delete`。
- 「目前」是 `firestore.rules` 在 2026-07-22 的實際規則表面，不代表安全目標。
- 「未來」是 hardening 目標；其中 owner 是文件所屬會員、participant 是共享房間或活動的成員，other 是已登入但不具關係的帳號。
- Admin SDK/Cloud Functions 會繞過 Rules，不在矩陣的 client actor 內。

## P0 collection matrix

| Collection / 資料類型 | Admin 目前 | Owner 目前 | Participant 目前 | Other 目前 | Anonymous 目前 | Desired future behavior |
|---|---|---|---|---|---|---|
| `members/{memberId}` 正式會員 | A/A/A/A | A/D/F/D | D/D/D/D（但 list 可列舉） | D/D/D/D（但 list 可列舉） | D/D/D/D | admin 全權；本人只讀自己並限欄位更新；other 不得讀全文，排行榜改讀去識別化 projection |
| `members/{memberId}` guest/kid | A/A/A/A | A/D/A/D | A/D/A/D | A/D/A/D | D/D/D/D | 每次造訪需可驗證且不可跨訪客寫入；若無持久 owner token，將敏感進度移到可信後端 |
| `practiceLogs`, `learnLogs`, `monsterLogs` | A/A/A/A | A/A/D/D（monsterLogs 為 A/A/A/A） | 同 owner（無 ownership check） | 同 owner | D/D/D/D | owner 只讀/建立自己的 immutable log；admin 可管理；other 全拒絕 |
| `shootingSessions` + `ends`, `gamePerformances`, `arrowCountEvents` | A/A/A/A | A/A/A/A | A/A/A/A | A/A/A/A | D/D/D/D | owner 建立自己的 session；finalized/locked 後不可改；participant 僅在共享 session 寫自己的 contribution；other 拒絕 |
| `memberPerformanceSync/{memberId}` | A/A/A/A | A/A/A/A | A/A/A/A | A/A/A/A | D/D/D/D | doc id 必須是 owner memberId；revision 單調遞增且只允許同步欄位；other 拒絕 |
| `materialInventory`, `equipSpecializations` | A/A/A/A | A/A/A/A | D/D/D/D | D/D/D/D | D/D/D/D | 保持 owner/admin 邊界，但增加 schema、非負數與合法轉移；高價值獎勵改由 callable/function 寫入 |
| `chestInventory`, `potionInventory`, `fragmentInventory`, `chestStats`, `potionDex`, `cardCollections` | A/A/A/A | A/A/A/A | A/A/A/A | A/A/A/A | D/D/D/D | doc id 對應 owner；client 僅能執行可驗證消耗，獎勵/鑄造由可信後端；other 拒絕 |
| `monsterDex`, `craftStats`, `certifications`, `guildProgress`, `councilSessions` | A/A/A/A | A/A/A/A | A/A/A/A | A/A/A/A | D/D/D/D | owner doc 或 membership-bound doc；限制可變欄位、計數器與狀態轉移；other 拒絕 |
| `duelRooms`, `partyRooms`, `dungeonRooms`, `zombieRooms` 與 zombie 子集合 | A/A/A/A | A/A/A/A | A/A/A/A | A/A/A/A | D/D/D/D | read 限 participant（公開 lobby 另建摘要）；host 才能改房間狀態；participant 只能改自己的 ready/score/event；不可改 participant/owner identity |
| `worldBossEvents`, `worldBossHistory`, `dungeonFirstClear`, `dungeonBroadcasts` | A/A/A/A | A/A/A/A | A/A/A/A | A/A/A/A（broadcast update/delete 除外） | D/D/D/D | event/history/first-clear 結算由可信後端；client 只建立可驗證 attack intent 或只讀；broadcast immutable |
| `villageGoals` | A/A/A/A | A/A/A/A | A/A/A/A | A/A/A/A | D/D/D/D | goal 建立/結算限 admin/backend，會員只能原子貢獻 |
| `cardMarket`（Batch A2 後） | A/A/A/A | A/F/F/D | A/D/F/D | A/D/F/D | D/D/D/D | seller create/cancel、buyer sold、seller claim 已限制角色與 immutable 欄位；buyer sold 另以 `getAfter()` 驗證同 batch 付款與收卡的精確資產 delta |
| `results`, `competitions`, `checkins`, `notifications` | A/A/A/A | A/A/A/D | A/A/A/D | A/A/A/D | D/D/D/D | create 必須綁 owner；競賽 participants 只允許 self join/leave；checkin/result immutable ownership；notification 僅 recipient 可讀/ack |
| `guestSessions` | A/A/A/A | A/A/A/A | A/A/A/A | A/A/A/A | A/A/A/A | 使用不可猜 session token/owner capability；匿名僅 create，後續讀寫需 ownership token、TTL 與欄位限制，或移入 callable |
| `guestNotifications` | D/A/A/A | D/A/A/A | D/A/A/A | D/A/A/A | D/A/A/A | 匿名只允許 create；禁止 update/delete；限制 email/內容長度、欄位集合、rate/App Check，後端消費 |
| `bookings` | A/A/A/D | A/A/F/D | D/D/D/D | D/D/D/D | D/D/D/D | 現有 owner 綁定方向正確；補 schema、合法 status transition、時間/方案 immutable 與完整 query tests |
| `bookingSlotCounts` | A/A/A/A | A/A/A/A | A/A/A/A | A/A/A/A | D/D/D/D | client 可讀；寫入移到可信 booking transaction/callable，或以 `getAfter()` 綁同 transaction 的合法 booking delta；禁止任意覆寫/負數 |

## 已證實的代表性風險

以下不是推測；每一項都由目前 rule expression 直接導出：

1. 任一登入者可對 `chestInventory/{victimMemberId}` 執行 create/update/delete，因規則只有 `isLoggedIn()`。
2. 任一登入者可覆寫或刪除其他會員的 `gamePerformances/{sessionId}` 與 `memberPerformanceSync/{victimMemberId}`。
3. 任一登入者可修改非 participant 的共享房間，包括 `partyRooms`、`dungeonRooms`、`zombieRooms`，也能寫 zombie event 子集合。
4. 未登入者可讀、建立、覆寫與刪除任意 `guestSessions/{docId}`。
5. 未登入者可覆寫或刪除 `guestNotifications/{docId}`；註解說「免登入可寫」但沒有把 write 限為 create。
6. 任一登入者可把 `bookingSlotCounts/{slotKey}` 設成任意值或刪除；client transaction 只能避免正常流程競態，不能阻止惡意 client。
7. 任一登入者可建立、修改、刪除 `worldBossHistory`、`dungeonFirstClear`，可破壞全域結算與首殺資料。

## Current-rule evidence anchors

下列行號以本輪工作樹的 `firestore.rules` 為準；它們是上述矩陣與代表性風險的直接證據：

| Surface | Rule evidence |
|---|---|
| actor helpers | `firestore.rules:9-23`（admin、logged-in、member ownership） |
| `members` get/list/create/update/delete | `firestore.rules:35-61`；特別注意 guest/kid update 只要求登入與既有 account type（60-61） |
| performance/session/sync | `firestore.rules:240-250`, `271-278`，均以 `isLoggedIn()` 授予整體 read/write |
| shared rooms | `firestore.rules:290-291`, `419-420`, `428-438`，沒有 host/participant 條件 |
| guest public surface | `firestore.rules:335-342`；session 對所有 actor read/write，notification 對所有 actor write 且只拒絕 read |
| owner-bounded inventory baseline | `firestore.rules:352-357`（`materialInventory`、`equipSpecializations` 已使用 admin/owner 邊界） |
| broad inventory surface | `firestore.rules:375-393`（chest/potion/fragment/stats/dex/cards 僅要求登入） |
| global outcomes | `firestore.rules:443-463`；history/first-clear 對登入者開放 write，broadcast 僅 create 對登入者開放 |
| bookings and counters | `firestore.rules:539-575` 有 owner/欄位/transition 邊界；`581-582` counter 仍僅要求登入 |

矩陣中的 `A/D/F` 是靜態規則判讀，不是 Emulator 實測結果。Rules 測試尚未執行，原因與下一批接線契約記錄於 `research/emulator-test-baseline.md`。

## Client dependency map

| Hardening batch | 已知 client dependency | 收緊前必要工作 |
|---|---|---|
| Performance ownership | `src/lib/db.js` 直接 transaction 寫 `shootingSessions`, `ends`, `gamePerformances`, `arrowCountEvents`, `memberPerformanceSync` | 確認所有 payload 都帶 immutable `memberId`；共享戰鬥 contribution 與個人 performance 分開 |
| Inventory ownership | `src/lib/db.js` 以 `memberId` 作 `chest/potion/fragmentInventory` doc id；`src/lib/expeditionTeamDb.js` 也寫 chest | 加 owner helper 後逐一驗證 transaction；獎勵/交易型寫入遷移 callable，不能只做欄位 allowlist |
| Shared battle rooms | `src/zombie/db/zombieDb.js` 與 party/dungeon/world-boss UI 由 client 改完整 room doc | 定義 `hostMemberId`, `participantIds` 與每 actor 可改欄位；必要時拆 command/event collection |
| Booking counters | `src/lib/bookingDb.js` 在預約、取消、改期 transaction 中讀寫一或三個 slot docs | 先建 callable 或用 `getAfter()` 驗證 booking 與 counter delta；保留 admin block/unblock 流程 |
| Guest member flow | `src/pages/GuestApp.jsx` 與 `src/lib/guestAuth.js` 目前讀寫 `members` guest/kid 文件，並以 session storage/contact lookup 支援回訪；匿名 uid 可能改變 | 收緊 `members` guest/kid 前先決定持久 capability 或 callable profile API；App Check/rate limit 不能取代 ownership |
| Legacy guest collections | 全庫搜尋未找到產品程式碼讀寫 `guestSessions` 或 `guestNotifications`；現有命中只有 Rules、文件與舊 changelog | 先確認正式資料/外部呼叫者與保留需求；若確為淘汰面，優先關閉 Rules，而不是為未使用 collection 新建 capability 流程 |

## 建議 hardening 順序

1. **Batch 0 — 測試基礎設施**：加入官方 rules unit testing 套件，先把本文的「目前允許」案例寫成 characterization tests；另建 desired tests 並標為 skipped/todo，避免把漏洞當成正確需求。
2. **Batch 1 — 一人一文件**：`memberPerformanceSync`、inventory、dex/stats/collections。這些多數可由 doc id = memberId 套 owner helper，客戶端相依面最清楚。
3. **Batch 2 — append-only performance**：sessions/logs/ends；驗證 immutable owner、locked/finalized transition。
4. **Batch 3 — booking counters**：與 `bookingDb.js` transaction 或 callable 同批交付，不能單獨封鎖造成預約失效。
5. **Batch 4 — shared rooms/battles**：逐模式建立 host/participant/field transition contract；不要用一條全域 helper 猜測不同遊戲狀態。
6. **Batch 5 — guest public surface**：分開處理現役 `members` guest/kid 回訪流程與疑似淘汰的 `guestSessions`/`guestNotifications`。前者先補 capability/callable、TTL、rate limit；後者先查正式資料與外部呼叫者，確認無依賴後關閉 Rules。
7. **Batch 6 — global outcomes/economy**：world boss、first clear、village goal、market 的 authoritative mutation 移到後端。

每批都應獨立部署、保留上一版 rules、跑 owner/other/admin/anonymous matrix 與對應 UI smoke test；本任務沒有執行任何部署。

## 本輪變更邊界

本任務只產出研究與測試設計文件。未修改 `firestore.rules`、`firebase.json`、產品程式碼或正式資料；未安裝依賴、啟動 Emulator、部署 Rules、刪除檔案、推送或提交。
