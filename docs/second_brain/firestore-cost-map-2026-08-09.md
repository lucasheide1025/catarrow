# Firestore Cost Map（2026-08-09）

本文件以目前實際 import、route 與 Firestore 呼叫鏈為準。分類可複選；`REALTIME_REQUIRED` 不代表可以不設 query 邊界，`CACHEABLE` 也不代表可以犧牲多人同步。

## 分類定義

| 標記 | 意義 |
|---|---|
| `REALTIME_REQUIRED` | 多人共享狀態、即時戰鬥、房間、待辦通知或目前玩家 profile |
| `CACHEABLE` | 同一工作階段可短期共用，寫入後必須失效 |
| `PAGE_SCOPED` | 只在指定頁面／模式掛 listener 或發 fetch |
| `LOCAL_FIRST` | UI 先寫 browser storage，再合併同步 Firestore |
| `WRITE_DEBOUNCE` | 單人連續操作可 trailing 合併寫入 |
| `BATCHABLE` | 管理員明確操作才執行的批次工作 |
| `DEAD` | 已確認沒有 production caller，可在備份後移除 |

## Domain map

| Domain / API | Authority | 分類 | 現況與約束 |
|---|---|---|---|
| 登入會員 profile | `useAuth.js` | `REALTIME_REQUIRED` | 登入定位後直接監聽單一 `members/{id}`；不可降成輪詢或靜態快取。admin/member 初查使用並行查詢，只重試真正失敗的 member query。 |
| 全會員清單 `getMembers()` | `db.js`（待拆 member domain） | `CACHEABLE` | 30 秒 session cache + inflight dedupe；只含 official member。會員 CRUD、月卡 member 寫入後必須 `invalidateMembersCache()`。需要 guest/kid 的流程不可使用此 API。 |
| 今日箭數／累積箭數 | `db.js` + browser local storage | `LOCAL_FIRST` `BATCHABLE` | 本機立即顯示；12 箭、10 秒、下課／pagehide 等時機 flush durable operations。不可改回每回合直接寫。 |
| 單人地下城進度 | `expeditionDb.js` + `trailingWriteQueue.js` | `LOCAL_FIRST` `WRITE_DEBOUNCE` | 每步本機保存；約 5 秒無新變動才同步，pagehide flush。通關／放棄需先處理 pending save。 |
| 多人地下城房間 | `dungeonDb.js` | `REALTIME_REQUIRED` `PAGE_SCOPED` | 房間 document 是共享狀態；不得 debounce 或改成本機權威。只在房間／大廳需要時訂閱。 |
| 單人村莊棋盤 | `villageBoardDb.js` | `PAGE_SCOPED` | `members.villageBoard` writer 應逐步只留此 domain；目前多個操作仍是讀後寫，後續按流程檢查能否合併。 |
| 組隊村莊棋盤 | `villageBoardTeamDb.js` | `REALTIME_REQUIRED` `PAGE_SCOPED` | 組隊 room 與 claim/settle sequence 必須即時且維持 transaction 一致性。 |
| 世界王 status | `worldBossDb.js` | `REALTIME_REQUIRED` | 小型 `worldBossStatus/current` 供首頁、登場與擊倒演出。Member/Admin 父層資料已傳給大廳，避免同一 App 內重複 listener。 |
| 世界王 event / spawn cycle | `worldBossDb.js` | `REALTIME_REQUIRED` `PAGE_SCOPED` | event HP、參戰與 spawn cycle 僅世界王頁需要；status 與 event 不可混成同一高頻 listener。禁止在 snapshot callback 反覆呼叫 lifecycle function。 |
| 線上約課 | `bookingDb.js` | `REALTIME_REQUIRED` `PAGE_SCOPED` | 時段容量與併發預約必須 transaction；guest/kid/official 混合名單不得誤用只回 official 的 `getMembers()`。 |
| 後台待辦數字 | `AdminApp.jsx` + `db.js` subscribers | `REALTIME_REQUIRED` | 報到、月卡、留言、檢定、外賽、公會提交需要全域即時提醒。子頁必須重用父層清單，不能再開相同 listener。 |
| 後台留言 | `subscribeAllMessages()` | `REALTIME_REQUIRED` | 父層維持 bounded 150 筆 listener；`AdminMessages` 已支援傳入資料並保留獨立 fallback。 |
| 後台報到 | `subscribePendingCheckins()` | `REALTIME_REQUIRED` | 父層清單供 badge、提醒音與兩個 `AdminDailyQuest` 視圖共用。list-only 模式不讀任務設定。 |
| 後台月卡待審 | `subscribePendingMonthlyRequests()` | `REALTIME_REQUIRED` | 父層清單供 badge 與 `AdminMonthlyCard` 共用；月卡會員列表走 canonical `getMembers()`。 |
| 後台公會提交 | `subscribeGuildSubmissions()` | `REALTIME_REQUIRED` | 父層清單供 badge 與 `AdminGuildQuests` 共用。 |
| 最近歷史預覽 | 各 domain bounded getter | `PAGE_SCOPED` `CACHEABLE` | 預設一次性 bounded fetch，底層資料變更後明確 refresh；不要為靜態最近紀錄常駐 listener。 |
| 全庫 migration / repair | operational scripts / dormant exports | `BATCHABLE` | 不可從登入、mount 或 route navigation 自動執行。需要 dry-run、cursor、limit、lease 與明確管理員操作。 |

## 已完成的 listener 去重

- `AdminMessages`、`AdminMonthlyCard`、`AdminDailyQuest`、`AdminGuildQuests` 重用 `AdminApp` 已持有的即時資料。
- Member/Admin 的 `WorldBossLobby` 重用父層完整 world-boss status；guest/獨立入口仍有 fallback listener。
- 一般 Admin 模式不訂閱僅射手模式使用的公會緊急任務與射手 collection。
- `villageGoals` tracker 只在 Member/Admin App 掛載，公開頁不訂閱。

## 下一輪優先稽核

1. `db.js` 中所有直接寫 `members.*` 的函式是否應失效 `getMembers()` cache；只對會影響名單消費者的欄位補失效，避免濫用。
2. `AdminReviewCenter`、排行榜與表現頁的全會員資料是否能共享同一次 bounded fetch，保留排行榜明確 refresh。
3. `villageBoardDb.js` 的同一操作內重複 member `getDoc`／`updateDoc`，確認可否合併但不改 persisted schema。
4. `worldBossDb.js` 與 `db.js` 的 dependency direction，先畫 export/import graph 再移動 authority。
5. 所有未加 `limit()` 的 collection listener；逐一判斷資料規模與是否能在不新增脆弱 composite index 下設界線。

## 禁止事項

- 不為防作弊把一般流程改成額外 validation reads 或 server-authoritative everything。
- 不把多人房間、多人戰鬥、今日共享狀態改成 debounce。
- 不以 localStorage 作為跨使用者 migration 的完成標記。
- 不因某 API 標為 `CACHEABLE` 就忽略 writer invalidation。
