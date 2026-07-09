# Implement Checklist

1. `firestore.rules`
   - [ ] `members` update hasOnly 加入 `"activeExpedition"`（需手動貼到 Firebase Console，CLI 無法部署規則）

2. `src/components/dungeon/DungeonBattleRoom.jsx`
   - [ ] `expeditionMode===true` 時隱藏「離開」快速按鈕

3. `src/lib/expeditionDb.js`
   - [ ] 新增 `setActiveExpeditionProgress` / `clearActiveExpeditionProgress` / `settleAbandonedExpedition`

4. `src/components/dungeon/DungeonExpedition.jsx`
   - [ ] 進入時寫入 `activeExpedition`
   - [ ] 樓層推進時更新 `activeExpedition.floorsCleared`
   - [ ] `handleFinish` 成功後清除
   - [ ] `handleAbandon`（真正撤退確認後）清除

5. `src/components/dungeon/DungeonLobby.jsx`
   - [ ] 新增單人遠征復原 banner（偵測 `profile.activeExpedition`，「結算並領取」按鈕）

6. `src/components/dungeon/TeamExpeditionBattle.jsx`
   - [ ] 房主端 20 秒卡住自動清除協調欄位
   - [ ] 非房主端 20 秒無回應顯示提示 + 安全返回大廳按鈕（不呼叫 leave/abandon）

7. 驗證
   - [ ] `CI=true npm run build` 成功
   - [ ] 更新 changelog + quick-ref
