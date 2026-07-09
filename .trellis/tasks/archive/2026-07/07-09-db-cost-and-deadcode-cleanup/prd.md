# PRD：資料庫讀寫次數優化與死代碼清除

## 背景

catarrow 是純前端 React + Firebase App，沒有後端伺服器——每一次 `onSnapshot`/`getDocs`/`getDoc` 都直接消耗 Firestore 讀取配額，每一次 `setDoc`/`updateDoc`/`addDoc` 都直接消耗寫入配額。老闆在計費 Firestore 方案上，希望降低不必要的讀寫量；同時要求清除確定沒人用的死代碼，減少維護負擔。

`research/firestore-cost-survey.md` 與 `research/dead-code-survey.md` 已完成盤點（`trellis-research` 產出），本 PRD 依盤點結果選出「投資報酬率高、風險可控」的項目排入本次範圍，其餘標為未來工作。

## 範圍（本次要做）

### R1 — 刪除確定死代碼（5 個函式，零呼叫點）
- `db.js::debugGetAllGuildSubs()`
- `db.js::getApprovedResults()`
- `db.js::subscribeAllMonthlyRequests()`（注意不要誤刪同名但活著的 `subscribePendingMonthlyRequests`/`subscribeMyMonthlyRequests`）
- `dungeonDb.js::updateDungeonMemberStats()`
- `dungeonDb.js::subscribeAllDungeonBroadcasts()`

**驗收**：`CI=true npx react-scripts build` 通過；grep 確認全專案零殘留引用；不影響任何現有功能。

### R2 — 最熱路徑：`addRoundArrows` → `addExcavationByArrows`/`addExcavationByCheckin`
現況：每一發箭記分（所有戰鬥模式：打怪/決鬥/組隊/地下城/議會/檢定/世界王）都會呼叫 `addRoundArrows`，內部再呼叫 `addExcavationByArrows`，共造成 **1 次 `getDoc` 讀取整份 member 文件 + 2 次獨立 `updateDoc` 寫入同一份文件**（一次寫 `totalArrowsAllTime`，一次寫 `dungeonExcavation`）。這是全專案呼叫頻率最高的路徑，任何節省會被會員總數 × 每日發箭數放大。

**目標**：
1. 把兩次 `updateDoc` 合併成一次（同一份文件沒有理由分兩次寫）。
2. 消除 `addExcavationByArrows` 內的 `getDoc(members/{id})` 全文件讀取——改由呼叫端（已經持有當前 `dungeonExcavation` 狀態的 caller）把現有進度傳進來，而不是每發箭都重讀一次整份文件（比照專案既有的 `upgradeEquipSlot`/`submitMonthlyCardRequest` "clientData 不用 getDoc" 慣例）。
3. `addExcavationByCheckin`（每人每天最多 1 次）視同一次修，但優先度低於 R2 主項。

**驗收**：所有戰鬥模式（至少手動跑一次 MonsterBattle + 一次 DungeonBattleRoom）發箭記分後，`totalArrowsAllTime` 與 `dungeonExcavation.progress` 兩個欄位都正確更新，行為與修改前一致；用瀏覽器 Network/Firestore debug 或 console.log 計數確認每發箭的讀寫次數確實下降。

### R3 — `MonsterBattle.jsx` 打怪紀錄：即時監聽換成一次性抓取
現況：`subscribeMonsterLogs(profile.id, cb, 100)` 在 MonsterBattle 元件掛載期間保持一個 100 筆即時監聽，但只拿來渲染 30 筆預覽；使用者切到「歷史」分頁時，又另外呼叫一次 `getMonsterLogs(profile.id, 20)` 覆蓋同一份 state——兩套機制重複抓同一份資料。

**目標**：拿掉掛載時的 100 筆即時監聽，預覽/歷史都改用既有的一次性 `getMonsterLogs` 抓取（依畫面需求調整筆數，如 30 筆），不需要即時性。

**驗收**：MonsterBattle 開啟後預覽清單與切到歷史分頁的清單都正常顯示，資料筆數與排序不變；DevTools 確認不再有常駐的 100 筆 onSnapshot。

### R4 — 移除 `subscribeCollectibles` 的重複監聽
現況：`DungeonDex.jsx` 呼叫 `subscribeCollectibles(memberId, cb)` 另外開一個 `members/{id}` 監聽，只為了讀 `dungeonCollectibles` 欄位——但 `useAuth.js` 已經對同一份文件開著監聽，整份文件都活在 `profile` 裡。

**目標**：`DungeonDex.jsx` 改直接讀 `profile.dungeonCollectibles`，移除自己的監聽；確認 `subscribeCollectibles` 沒有其他呼叫點後一併刪除該函式（否則併入 R1 死代碼清單）。

**驗收**：貓貓地城圖鑑頁面顯示的收藏資料不變；確認同一頁不再多開一個 `members/{id}` 監聽。

### R5 — `subscribePracticeLogs` 的兩處誤用改用 `where` 過濾
現況：`WorldBossLobby.jsx`／`PartyLobby.jsx` 都呼叫不帶 `limit` 的 `subscribePracticeLogs(memberId,...)`（等於訂閱該會員**全部歷史練習紀錄**），卻只在前端 `.filter(l => l.source==="worldboss"/"party")` 挑出一小部分。

**目標**：改成 `db.js` 提供一個帶 `where("source","==",...)` 條件（可選 `limit`）的查詢版本，或在既有函式加上可選 `source`/`limit` 參數，讓這兩處只訂閱真正需要的子集。`MemberPractice.jsx` 既有的「顯示全部練習紀錄」用法維持不變，但補上一個防禦性 `limit()` 上限。

**驗收**：世界王大廳/組隊大廳原本顯示的「我的紀錄」內容不變；`MemberPractice.jsx` 的完整練習歷史頁不變。

## 不在本次範圍（列為未來工作，附原因）

- **`subscribePendingCertTasks`（`db.js:926`）unscoped collection 監聽**：需要新增一個反正規化欄位（如 `hasPendingCertTask`）才能改成 `where` 查詢，屬於資料模型變更，風險與工作量都較高，本次先不動，記錄在 quick-ref 供之後排入。
- **AdminApp/MemberApp 頂層 ~13 個常駐 `onSnapshot`**：個別都是合理範圍（單文件或有 `where` 限制），只有「總數偏多」值得未來考慮合併成聚合文件，非本次的「明確浪費」範疇。
- **`DuelRoom`/`DuelLobby` 30 秒心跳寫入**：設計上就是有界（只在對戰中），優先度低，不動。
- **`subscribeEquipItems`/`subscribeAllGuildQuests` 全集合監聽**：後台/商店用途、集合成長慢，暫不處理。
- **`db.js` 剩餘 ~250 個 exported 函式的死代碼全面稽核**：本次只涵蓋 research 階段已 spot-check 出的高信心候選，未做全量symbol-by-symbol 掃描；之後如需要可再開一輪。

## 非目標
- 不改變任何玩家可見的行為/數值（這是純後端效能優化，不是功能變更）。
- 不引入新的第三方套件或後端服務。
- 不做自動化測試建置（專案目前的驗證關卡就是 `CI=true npx react-scripts build` + 手動跑功能）。

## 驗收總綱
1. `CI=true npx react-scripts build` 全程通過。
2. 依 R1-R5 各自的驗收標準手動驗證一輪。
3. 教練「切換射手模式」不白屏（動了 member 端元件的慣例檢查）。
4. `docs/second_brain/changelog.md`／`quick-ref.md` 更新，記錄改了什麼、為什麼、以及「不在本次範圍」的項目給未來接手的人。
