# 村目標獎勵改為自行請領模式（修正權限導致獎勵未發放）

## Goal

使用者回報：「村目標完成了，但是參加的人沒有拿到設定好的獎勵」。根因已確認：`src/lib/villageGoalDb.js` 的 `completeGoal()`/`expireGoal()` 由**任何一個會員瀏覽器**觸發（`VillageGoalBanner.jsx` 每分鐘輪詢 `checkGoalStatus`），觸發後在該瀏覽器內用 `for...of participants` 迴圈幫**所有參與者**寫入獎勵（`addCoins(mid,...)`/`addArrowdew(mid,...)`），但 `firestore.rules:28-37` 的 `members` collection 規則是「一般會員只能 `update` 自己的文件（`resource.data.uid==request.auth.uid`）」，寫入別人的 `members` 文件會被規則拒絕，整段被 `.catch(()=>{})` 吞掉——只有恰好由教練切換學生模式瀏覽（有 `isAdmin()` 權限）時才會真的成功發放。這跟公會懸賞系統已知的坑（changelog 2026-07-04 記錄過）是同一種架構限制：專案沒有 Cloud Functions/cron，所有結算都是 client-triggered。

## Requirements

1. **改成自行請領模式**（比照專案既有的 `claimDungeonReward`/`claimTeamExpeditionResult` 慣例）：
   - `completeGoal(goalId, reward)`：移除 for-loop 幫參與者寫入獎勵的邏輯，只做「標記 `status:"completed"`、`completedAt`」+ 發送既有的 `village_goal_complete` 全體通知。**保留** `rewardDistributed` 欄位語意但改用途（見下）或直接移除，改用逐人 `participants.{memberId}.claimed` 追蹤。
   - `expireGoal(goalId)`：同樣移除 for-loop，只標記 `status:"expired"`。
   - `adminForceCompleteGoal(goalId, rewardOverride)`：**也移除**其獎勵發放迴圈（即使目前因為 `isAdmin()` 而技術上會成功，但保留兩套不同的發獎路徑容易造成重複發放或行為不一致），一律走同一個自行請領流程。
   - 新增 `claimVillageGoalReward(goalId, memberId)`：讀取目標文件，檢查 `status` 是 `"completed"` 或 `"expired"`、`participants[memberId]?.contributed > 0`、且 `!participants[memberId]?.claimed`；符合才依 `status` 決定用 `goal.rewards`（完成）或 `CONSOLATION_REWARD`（過期安慰獎），呼叫 `addCoins`/`addArrowdew`/`addGachaCoins`（寫自己的 `members` 文件，符合現有規則），成功後 `updateDoc(villageGoals/goalId, {[\`participants.${memberId}.claimed\`]:true})`（`villageGoals` 規則是 `allow update: if isLoggedIn()`，不需改規則）。回傳 `{ok:true, reward}` 供前端提示，不符合資格回傳 `{ok:false, reason}`。

2. **前端自動觸發請領**：`src/components/member/VillageGoalBanner.jsx` 目前用 `subscribeActiveGoal`（只訂閱 `status==="active"`），目標一旦完成/過期就訂閱不到、banner 也消失——這個元件不會是「事後補領」的觸發點。改成用既有的 `subscribeLatestGoal`（訂閱最新一筆，不限狀態）：
   - `status==="active"` 時維持現有 banner 顯示邏輯（進度條、倒數、`checkGoalStatus` 輪詢）不變。
   - 任何狀態下，只要 `goal.participants[myId]?.contributed > 0 && !claimed && status in [completed, expired]`，自動呼叫 `claimVillageGoalReward`，成功後用既有 `useToast`（`shared/UI.jsx`）跳一個小提示（例如「🎁 村目標獎勵已入帳：+50 金幣 +30 箭露」）。

3. **不動**：`contributeArrowsToGoal`/`contributeDamageToGoal`/`contributeKillToGoal`（貢獻累積邏輯）、`autoSpawnVillageGoal`/`adminCreateCustomGoal`（目標建立）、`adminUpdateGoal`/`adminCancelGoal`（後台管理）全部維持原樣。

## 已知但刻意不在本任務處理的問題

- **歷史已完成/過期目標的補發**：舊資料的 `villageGoals` 文件（`status` 已是 `completed`/`expired`，`rewardDistributed:true`）裡的參與者從來沒有 `claimed` 欄位，理論上他們過去很可能沒真的拿到獎勵（除非那次剛好是教練觸發）。**是否要做一個後台補發工具/腳本，讓這些人補領過去漏發的獎勵**，這是遊戲經濟/公平性的判斷，需要使用者決定要不要做、範圍多大，不在本任務自動處理。

## Acceptance Criteria

- [ ] 一般會員（非 admin）身份觸發目標完成，自己的帳號能正確拿到獎勵（金幣/箭露/扭蛋幣都有 increment）。
- [ ] 同一目標的其他參與者，各自登入後也能各自拿到獎勵（不用等特定人觸發）。
- [ ] 重複進入貓村/重整頁面不會重複發放（`claimed` 旗標正確防重複）。
- [ ] `status==="active"` 時 banner 顯示邏輯（進度條/倒數/貢獻數字）完全不變。
- [ ] `adminForceCompleteGoal` 觸發後，參與者一樣要透過自行請領才拿到獎勵（不再由後台直接發放）——若這點使用者不接受（例如覺得後台強制完成應該要「立即」發放），需要另外討論，先照此設計實作並在完工後跟使用者確認這個行為變化是否可接受。
- [ ] `CI=true npm run build` 成功。

## Notes

- 這是使用者選定要優先處理的一項（8 項待辦中的第一項）。
- 不需要改 firestore.rules（`villageGoals` 的 `allow update: if isLoggedIn()` 已足夠寬鬆）。
