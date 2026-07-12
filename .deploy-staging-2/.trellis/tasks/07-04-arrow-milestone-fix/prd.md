# 箭數里程碑跨模式重複觸發修復

## Goal

修復「每打完一次就重複跳出已完成里程碑」的 bug。根因是 5 個戰鬥/報到模式各自用不一致（且錯誤）的方式計算「今日累計箭數」，統一改成單一共用、持久化的今日箭數來源。

## 確認事實（已用 Grep 逐一驗證，非推測）

`src/lib/arrowMilestone.js::getMilestonesReached(oldTotal, newTotal)` 本身是正確的純函式（正確計算門檻跨越，每個門檻只算一次）。問題出在呼叫端傳入的 `oldTotal`/`newTotal`：

| 檔案 | 目前行號 | 目前寫法 | 問題 |
|---|---|---|---|
| `src/components/member/AdventurerGuild.jsx` | 220 | `getMilestonesReached(0, arrowCount)` | 寫死從0算，每場只要超過6箭就跳 |
| `src/components/member/CouncilBattle.jsx` | 426 | `getMilestonesReached(0, totalArrows)` | 同上 |
| `src/components/duel/DuelRoom.jsx` | 459 | `getMilestonesReached(0, myArrowCount)` | 同上 |
| `src/components/member/DailyQuest.jsx` | 139 | `getMilestonesReached(0, todayArrows)` | 同上（下課結算時觸發） |
| `src/components/member/MonsterBattle.jsx` | 424/797/919-921 | 用 `sessionArrowsRef`（`useRef(0)`），但 `startBattle()`（797行）每次開新戰鬥就重設為0 | 同一天打第二場新戰鬥，ref歸零，一樣會重複跳 |

**正確參考範本**（不用修，但邏輯要參考/統一）：
- `src/components/member/MemberPractice.jsx`（約2317-2321行）：`oldTodayArrows` 用當下已載入的 `logs`（今日的 practiceLogs）加總 `totalArrows` 算出——但這個算法**只加總 MemberPractice 自己載入的 logs**，如果 `logs` 沒有涵蓋其他模式（打怪/組隊/決鬥等）今天寫入的 practiceLogs，一樣會低估今日總箭數。不是本次bug的主因（本次bug主因是完全沒算/歸零），但修復時要一併考慮，不要重蹈覆轍。
- `src/components/worldboss/WorldBossAttack.jsx`（約705-708行）：用一個 `todayArrows` 變數，來源需在實作時追查其計算方式是否可靠。

## 建議修法（不需要再問使用者，已足夠明確可直接執行）

**不要在 5 個檔案裡各自修正各自的計算方式**（容易再次不一致，未來新模式也會重蹈覆轍）。改成：

1. `members` collection 新增兩個持久化欄位：`todayArrowCount`（今日累計箭數）、`todayArrowDate`（"YYYY-MM-DD"，最後更新日期，用來判斷是否跨日需要歸零）。
2. 新增一個共用純函式（例如 `arrowMilestone.js::computeTodayMilestones(profile, arrowCount)`）：
   ```js
   export function computeTodayMilestones(profile, arrowCount) {
     const today = todayStr(); // 需要有這個小工具，或從既有 db.js 匯入
     const oldTotal = profile?.todayArrowDate === today ? (profile.todayArrowCount || 0) : 0;
     const newTotal = oldTotal + arrowCount;
     return { oldTotal, newTotal, milestones: getMilestonesReached(oldTotal, newTotal) };
   }
   ```
   **關鍵設計**：`oldTotal` 直接從呼叫端已經即時同步的 `profile`（`useAuth()` 或 props 傳入的 profile，已經是 Firestore onSnapshot 即時同步的資料）讀取，**不用額外發一次 Firestore 讀取**，符合專案既有「相信即時同步的 profile」慣例。
3. 新增一個共用的 db.js 函式（例如 `grantArrowMilestoneRewardsForToday(memberId, profile, arrowCount)`），內部呼叫上面的純函式算出 `newTotal`/`milestones`，然後：
   - `updateDoc(members/{memberId}, {todayArrowCount: newTotal, todayArrowDate: today})`
   - 若 `milestones.length > 0`，呼叫既有 `grantArrowMilestoneRewards(memberId, milestones)`
   - 回傳 `milestones`（給呼叫端顯示彈窗用，跟現有各檔案的用法一致）
4. **5 個檔案全部改用這個新函式**，取代掉各自原本的 `getMilestonesReached(0, ...)` 或 `sessionArrowsRef` 邏輯。呼叫端只需要傳入 `profile`（大部分元件本來就有）跟本次箭數即可。
5. `firestore.rules`：`members` 自寫白名單加入 `todayArrowCount`、`todayArrowDate`（這兩個欄位需要由會員自己的 client 在每次戰鬥送出時更新）。

## 風險與注意事項

- `profile` 若在極短時間內連續觸發多次（例如同一回合內誤觸發兩次），有可能讀到還沒更新的 `oldTotal` 造成短暫誤差；一般戰鬥節奏（回合間有使用者操作間隔）風險低，但實作時可以觀察是否需要加防重入判斷（可參考 `07-04-lock-scoring-mode` 任務裡 `targetPending` 的 `if (targetPending) return;` 防重入寫法）。
- 不要修改 `getMilestonesReached()` 本身（純函式已經是對的）。
- 不要修改 `ALL_MILESTONES` 門檻定義。

## Out of Scope

- 不改變里程碑獎勵內容本身（`getRewardsForMilestone`）
- 不改變 `MemberPractice.jsx`／`WorldBossAttack.jsx` 的既有邏輯（除非統一改用新共用函式時發現這兩個檔案也需要一併換過去，以求全站一致——若時間允許建議也一併換掉，減少未來維護時「這個模式用共用函式、那個模式用自己的」的混亂）

## Acceptance Criteria

- [ ] 5 個檔案（AdventurerGuild/CouncilBattle/DuelRoom/DailyQuest/MonsterBattle）都改用共用的今日累計箭數判斷方式
- [ ] 同一天內連續打多場（不同模式或同模式都算），里程碑只在真正第一次跨越門檻時觸發一次，不會重複跳
- [ ] 跨日後，今日箭數正確歸零重新累計
- [ ] `CI=true npm run build` 編譯通過
