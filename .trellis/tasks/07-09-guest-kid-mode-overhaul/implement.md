# Implement：訪客模式全新UI＋兒童模式＋跨帳號共戰＋帳號轉移系統

範圍極大，切成 5 個 Phase，每個 Phase 結束都要能獨立驗證，不強求一次做完。

## Phase 1 — 資料與規則基礎（地基，其餘都依賴這個）
- [ ] `firestore.rules`：`members` 新增 create/update/get 的 guest/kid 分支（見 design.md §2）。
- [ ] `src/lib/guestAuth.js`：`resolveGuestSession()`、`normalizeContact()`、sha256 hash 工具。
- [ ] `campSessions` collection + 對應規則。
- [ ] 驗證：手動測試匿名登入→輸入信箱→建立記錄→重新整理（新的匿名uid）→輸入同信箱→接續到同一筆記錄，確認 `uid` 有被更新、遊戲資料還在。

## Phase 2 — 訪客模式新 UI（不含地下城/結算卡）
- [ ] `src/pages/GuestApp.jsx`：入口畫面 + 打怪/組隊/決鬥/世界王/商店分頁，接上 `resolveGuestSession`。
- [ ] `App.jsx` 路由改接新的 `GuestApp`（`GuestRoute` 邏輯調整或並存）。
- [ ] 舊 `GuestBattle.jsx` 確認沒有其他地方引用後刪除。
- [ ] 驗證：完整跑一次訪客體驗流程（入口→打怪→組隊→決鬥）。

## Phase 3 — 簡化版地下城 + 結算分享卡
- [ ] `GuestDungeonSimple.jsx`：固定3層+固定王，重用 `DungeonBattleRoom.jsx`（`simpleMode` prop）。
- [ ] `GuestShareCard.jsx`：沿用 `SHARE_THEMES`，串接 session 統計。
- [ ] session 統計累積機制（今日箭數/擊敗清單/地城層數/金幣，寫回訪客自己的 `members` 文件或本地 state 皆可，決定時要考慮轉正式後這些紀錄要不要保留）。
- [ ] 驗證：跑完整體驗流程後在結算頁看到正確統計、可存圖。

## Phase 4 — 兒童模式
- [ ] `KidApp.jsx`：兒童向主題 UI 外殼。
- [ ] `MonsterBattle.jsx` 加 `kidMode` prop（大按鈕/簡化文字/保底命中率/鼓勵動畫），不重寫整個戰鬥引擎。
- [ ] 組隊/地下城直接 render 既有 `PartyLobby`/`DungeonLobby`（沿用房號機制，確認 guest/kid/official 混房不受阻擋）。
- [ ] 驗證：兒童模式單人打怪操作明顯比一般模式簡單；正式學生帳號能用房號加入兒童模式開的房間。

## Phase 5 — 後台管理
- [ ] `AdminKidMode.jsx`：場次CRUD、帳號列表、QR產生。
- [ ] 轉正式流程：串接既有「新增會員」表單，完成後原地改寫來源記錄的 `uid`/`accountType`。
- [ ] 稽核清單（design.md §6）：`getMembers()`/`getMembersForBilling()`/排行榜/檢定報名等既有查詢補上 `accountType=="official"` 過濾。
- [ ] 驗證：後台建立場次→產生QR→模擬掃碼建立兒童帳號→後台看得到→轉正式成功→原本正式端的排行榜/名冊沒有訪客/兒童帳號混入。

## Rollback
每個 Phase 是獨立可上線的單位，若某 Phase 出問題可以只回退該 Phase 的 commit，不影響前面已經上線的 Phase（因為都是新增功能，沒有大幅修改既有正式會員路徑，`official` 帳號的規則/行為完全沒變動）。
