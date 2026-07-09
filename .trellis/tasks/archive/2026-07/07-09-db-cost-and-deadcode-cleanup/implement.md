# Implement：資料庫讀寫次數優化與死代碼清除

依 design.md 的施工順序，切成 5 個獨立可驗證單位，每個做完都要跑一次 build。全部不改變玩家可見行為。

## Step 1 — R1 刪除死代碼
- [ ] 刪除 `src/lib/db.js::debugGetAllGuildSubs`（各先 grep 全專案確認零呼叫點再刪）
- [ ] 刪除 `src/lib/db.js::getApprovedResults`
- [ ] 刪除 `src/lib/db.js::subscribeAllMonthlyRequests`（注意不要動到 `subscribePendingMonthlyRequests`/`subscribeMyMonthlyRequests`）
- [ ] 刪除 `src/lib/dungeonDb.js::updateDungeonMemberStats`
- [ ] 刪除 `src/lib/dungeonDb.js::subscribeAllDungeonBroadcasts`
- [ ] `CI=true npx react-scripts build` 通過

## Step 2 — R4 移除 `subscribeCollectibles` 重複監聽
- [ ] `src/components/dungeon/DungeonDex.jsx`：改讀 `profile.dungeonCollectibles`，移除自己的 `useState`/`useEffect`/import
- [ ] 確認 `subscribeCollectibles`（`dungeonDb.js:1309`）全專案零其他呼叫點後刪除該函式
- [ ] 手動測：貓貓地城圖鑑頁面顯示內容跟改之前一致，拿到新收藏品後數字仍會更新
- [ ] `CI=true npx react-scripts build` 通過

## Step 3 — R5 `subscribePracticeLogs` 加 `limit()`
- [ ] `src/lib/db.js::subscribePracticeLogs` 加 `maxCount=300` 參數與 `limit(maxCount)`
- [ ] `WorldBossLobby.jsx:202` 呼叫傳 `maxCount=60`
- [ ] `PartyLobby.jsx:37` 呼叫傳 `maxCount=60`
- [ ] `MemberPractice.jsx:2309` 視資料量決定要不要傳大一點的上限（或用預設 300）
- [ ] 手動測：三個頁面顯示內容跟改之前一致
- [ ] `CI=true npx react-scripts build` 通過

## Step 4 — R3 MonsterBattle 打怪紀錄改一次性抓取
- [ ] 移除 `MonsterBattle.jsx:363` 的 `subscribeMonsterLogs(...,100)` 即時監聽與對應 cleanup
- [ ] mount 時改呼叫一次 `getMonsterLogs(profile.id, 30).then(setHistory)`
- [ ] 在勝利結算（~941 行）與落敗結算（~996 行）的 `saveMonsterLog(...).catch(()=>{})` 之後，各自串接重新抓取歷史（可包成共用 `refreshHistory()` helper）
- [ ] 手動測：開 MonsterBattle 預覽清單正常；打完一場（贏一次、輸一次都測）後預覽清單有出現新紀錄；切到「歷史」分頁清單正常
- [ ] `CI=true npx react-scripts build` 通過

## Step 5 — R2 合併發箭寫入 + session 快取消除重複 getDoc（風險最高，最後做）
- [ ] `dungeonExcavation.js`：加入 `_excavCache` 模組級快取 + `readExcavationCached(memberId)`
- [ ] `addExcavationByArrows` 改名/改造為 `computeExcavationPatch(memberId, arrowCount)`，回傳要 merge 的 patch 物件，自己不再呼叫 `updateDoc`/`setDoc`；計算完同步寫回 `_excavCache`
- [ ] 該檔案其他會寫 `dungeonExcavation` 欄位的函式（`resetAutoDigTimer`/`claimAutoDig`/`initDailyExcavation`/手動揭曉…）在各自寫入成功後補一行 `_excavCache.delete(memberId)`
- [ ] `db.js::addRoundArrows` 改成組合 `{totalArrowsAllTime: increment(count), ...excavPatch}` 後只呼叫一次 `updateDoc`
- [ ] `addExcavationByCheckin` 視時間允許可套用同一個 `readExcavationCached`（非必要，不影響驗收）
- [ ] 手動測（至少各跑一輪）：
  - MonsterBattle 打完一場完整戰鬥，確認 `totalArrowsAllTime` 有正確累加、`dungeonExcavation.progress`/`dailyArrowsUsed` 有正確累加（可在 Firebase Console 或用 console.log 改前改後各記一次數字比對）
  - DungeonBattleRoom（地下城）跑一輪，同樣確認上述欄位正確
  - 確認換日分支（`lastActiveDate !== today` 的 setDoc 路徑）程式邏輯正確（讀程式碼複查即可，不強求真的等到隔天）
- [ ] `CI=true npx react-scripts build` 通過

## 收尾（每個 Step 都做完後）
- [ ] 教練後台「切換射手模式」不白屏（動了 member 端元件的慣例檢查，尤其 Step 4/5）
- [ ] `docs/second_brain/changelog.md` 新增條目：改了什麼、為什麼、踩坑提醒（尤其 R2 的快取設計與「其他寫入函式要記得清快取」這個容易忘記的細節）
- [ ] `docs/second_brain/quick-ref.md` 補一條「PRD 不在本次範圍」清單，方便未來接手的人知道 `subscribePendingCertTasks` 等項目還沒處理
- [ ] 同步複製到 `C:\Users\broud\Documents\Obsidian Vault\catarrow\`
- [ ] git commit（可以每個 Step 一個 commit，也可以全部做完一次 commit，視改動大小彈性決定）→ push `main`

## Rollback
每個 Step 是獨立可回退的最小單位。若 Step 5（R2）上線後發現箭數/發掘進度計算異常，優先單獨回退該 commit，不影響前面已上線的 Step 1-4。
