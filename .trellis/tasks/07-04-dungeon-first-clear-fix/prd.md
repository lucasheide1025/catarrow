# 首殺通知修復（持久化+新地下城系統接軌）

## Goal

修復「首殺通知都沒有消掉、會一直重複出現」，並讓新版地下城遠征系統（family+tier 隨機生成）也能正確觸發首殺獎勵與廣播（目前完全沒接上，不是壞掉，是從沒接過）。兩個問題彼此獨立，都要修。

## 問題 A：橫幅已讀狀態沒有持久化（純前端 bug）

**確認事實**：`src/pages/MemberApp.jsx` 第136-137行，`dismissedBroadcastRef`/`lastBroadcastIdRef` 都是 `useRef(null)`，純記憶體狀態，沒有寫入 localStorage 或 Firestore。使用者在第508行點擊關閉時只設定 `dismissedBroadcastRef.current = dungeonKillAlert.id`——只要重新整理頁面或 `MemberApp` 重新掛載，這個 ref 就歸零，`subscribeLatestBroadcast()`（`dungeonDb.js`）訂閱到同一筆「最新廣播」文件時，比對邏輯（第165-167行）失效，橫幅重新彈出。

**修法**：把 `dismissedBroadcastRef` 改成持久化——用 `localStorage.getItem/setItem("dismissedBroadcastId")` 取代純 `useRef`，元件掛載時從 localStorage 讀初始值，關閉橫幅時同步寫回 localStorage。不需要跟 Firestore 同步（純裝置本地已讀狀態，符合這類「已讀提示」的一般做法，且避免額外 Firestore 讀寫成本）。

## 問題 B：新版地下城遠征系統完全沒接上首殺判斷

**確認事實**（已用 Grep+Read 逐一驗證）：
- `DungeonBattleRoom.jsx` 第474-489行，Boss房通關時的首殺檢查：`const dungeonInfo = DUNGEON_MAPS.find(d => d.id === room?.mapDungeonId);` 若找不到就 `setFirstClearBonus(false); return;`，直接跳過整段首殺邏輯。
- `expeditionTeamDb.js::createTeamExpeditionBattleRoom()` 第313行，寫入戰鬥房文件的 `mapDungeonId` 是寫死的字串常數 `"expedition"`（不是實際的地下城識別碼），永遠不可能在 `DUNGEON_MAPS`（舊版固定目錄）裡查到，所以 `dungeonInfo` 永遠是 `undefined`。
- 戰鬥房文件實際擁有的識別資訊：`expeditionDifficulty`（第310行，難度 tier，1~6數字）+ `monster.family`（第301行 `finalMonster` 展開自 `monster`，`monsterData.js` 裡每隻怪物都有 `family` 欄位，例如 `"ghost"`/`"mountain"` 等6種）。
- `TeamExpeditionBattle.jsx` 第188-196行呼叫 `<DungeonBattleRoom isMapMode={true} expeditionMode={true} roomId={roomId} .../>`——`expeditionMode` 這個 prop 目前有傳入但 `DungeonBattleRoom.jsx` 的首殺檢查區塊完全沒用到它做分支判斷。

**使用者已確認的設計決策**：新系統的首殺改用 **`family + tier` 當 key**（例如「第一次打過 ghost 族 T3 的地下城」就算首殺，不管是哪次隨機生成的具體地下城實例），不是每個隨機生成的地下城各自算一次首殺。

**修法**：
1. `DungeonBattleRoom.jsx` 第474-489行的首殺檢查區塊，改成依 `expeditionMode` prop 分支：
   - `expeditionMode === true`：不查 `DUNGEON_MAPS`，改用 `` `${room.monster?.family}_t${room.expeditionDifficulty}` `` 組出 `dungeonId`（例如 `"ghost_t3"`），`dungeonInfo` 改成用 `family` 對應的顯示名稱（可從 `monsterData.js` 既有的族系顯示名稱 map，或直接用 `room.monster.family` 首字大寫/中文對照表；若專案已有現成的族系中文名稱對照，直接沿用，不要新造一份）+ `room.monster.emoji`（若有）拼出廣播用的顯示資訊。
   - `expeditionMode` 為假（即舊版固定目錄地下城）：維持現有 `DUNGEON_MAPS.find(...)` 邏輯完全不變。
2. `trySetDungeonFirstClear(dungeonId, ...)`／`addDungeonBroadcast(dungeonId, ...)` 本身不需要修改（`dungeonId` 只是個字串 key，函式本身對格式無感知），只要呼叫端傳入正確組出的 `"family_tX"` 字串即可。
3. 確認同一個 family+tier 只要曾經被任何一次遠征（不論哪個隨機生成的具體地下城）首殺過一次，之後同 family+tier 的其他遠征就不會再觸發首殺——這是 `trySetDungeonFirstClear` 既有「查 dungeonId 是否已存在再寫入」邏輯天然支援的行為，不用額外開發，只要 key 格式改對即可。

## Out of Scope

- 舊版固定目錄地下城（`DungeonBattleRoom.jsx` 非 expedition 模式那條路徑）的首殺邏輯，維持不動
- 單人遠征（`DungeonExpedition.jsx`）如果也有觸發首殺的邏輯，需要在實作時一併確認是否有相同問題並比照修復（PRD 撰寫時間內未逐一確認單人模式是否也呼叫這段首殺邏輯，實作時請一併 Grep 確認）
- 廣播通知的其他既有機制（分類篩選、8大類等）不動

## Acceptance Criteria

- [ ] 關閉首殺橫幅後，重新整理頁面/重新登入，同一筆已讀的廣播不會再彈出
- [ ] 組隊遠征（新系統）第一次打贏某個 family+tier 組合的地下城 Boss，正確觸發首殺獎勵與全站廣播
- [ ] 同一個 family+tier 組合，不同次隨機生成的具體地下城再次打贏，不會重複觸發首殺（因為 key 相同，已經記錄過）
- [ ] 不同 family+tier 組合（例如 ghost_t3 vs ghost_t4，或 ghost_t3 vs mountain_t3）各自獨立判�120斷首殺，不會互相誤判
- [ ] 舊版固定目錄地下城的首殺邏輯行為不變（回歸測試）
- [ ] `CI=true npm run build` 編譯通過
