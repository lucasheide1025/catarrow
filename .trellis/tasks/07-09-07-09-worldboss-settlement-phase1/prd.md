# 世界王結算系統重構第一階段：修權限bug+結算畫面+獎勵均等

## Goal

使用者回報「世界王沒有戰鬥結算畫面，玩家沒看到就退出去了」。查證後發現根因跟今天已修過的村目標/市集是同一種架構問題：`distributeWorldBossRewards(eventId)` 由**打出最後一擊的玩家瀏覽器**觸發，內部迴圈幫「所有參戰者」寫入金幣/寶箱，除非最後一擊剛好是教練，否則其他人的獎勵會被 `firestore.rules` 擋掉——這不是偶發，是必現。

`WorldBossLobby.jsx` 其實**已經有**一個 `KillScreen` 元件，會對所有造訪的玩家顯示一次（sessionStorage 防重複），有擊殺者/傷害排行榜——但沒有「你自己拿到什麼獎勵」這個區塊，這正是使用者感受到「沒有結算」的地方，本質上是同一個 bug 的兩面。

使用者已確認的重新設計方向（範圍限定在第一階段，R1-R6 分級/專屬寶箱/專屬卡片是第二階段，不在本任務）：
1. 修正權限 bug，改成自行請領。
2. `KillScreen` 補上「你的獎勵」區塊。
3. 獎勵從 rank1/rank3/rankAll 傷害分層，改成**所有真實參戰者領同一份「共同獎勵」**（豐富度接近原本 rank1 最高檔）。
4. 貢獻前三名 + 最後一擊，改成額外發放**紀念收藏品**（不是更多金幣/寶箱），與共同獎勵分開發放。

## Requirements

1. `src/lib/worldBossDb.js::distributeWorldBossRewards(eventId)`：
   - 移除迴圈幫全部參戰者寫入獎勵的邏輯。
   - 改成：依 `participants` 的 `totalDmg` 排序（訪客排除）算出 `top3Ids`（前三名 memberId 陣列），寫入事件文件的 `top3Ids` 欄位。
   - `rewardDistributed` 欄位語意改為「已定案，可請領」（不改欄位名稱，維持既有呼叫端相容）。
   - 寫入 `worldBossHistory` 的邏輯不變。

2. 新增 `claimWorldBossKillReward(memberId, eventId)`：
   - 驗證：事件存在、`rewardDistributed===true`、`participants[memberId]` 存在且非訪客、`participants.{memberId}.claimed` 尚未為 true。
   - 共同獎勵：`reward.base`（保底，人人都有）+ **統一改用原本 `reward.rank1`**（最高檔，不分名次）發給每一位真實參戰者。
   - 紀念品（跟共同獎勵分開發放）：
     - 最後一擊（`event.lastHitBy.memberId===memberId`）：沿用既有 `LAST_HIT_EXTRA`（`catBoxes:1, cardPacks:1`），標記來源文字「世界王尾刀紀念」。
     - 貢獻前三名但非最後一擊（`top3Ids.includes(memberId)`）：發放 `{cardPacks:1}`，標記來源文字「世界王貢獻紀念」。
   - `grantWorldBossDungeon(memberId)`（世界王地下城獎勵）維持不變，人人都有。
   - 標記 `participants.{memberId}.claimed = true`。
   - 回傳 `{ok, reward:{coins,goldChests,catBoxes,cardChance 命中與否...}, trophy: "lastHit"|"top3"|null}` 供 UI 顯示。

3. `src/components/worldboss/WorldBossLobby.jsx`：
   - `subscribeLatestWorldBoss` 偵測到 `status==="defeated"` 時，除了現有的 `sessionStorage` 防重複顯示 `KillScreen` 外，同時呼叫 `claimWorldBossKillReward(myId, ev.id)`（不受 sessionStorage 限制，用 `participants.{myId}.claimed` 本身防重複），把回傳結果存到新的 state，傳入 `KillScreen`。
   - `KillScreen` 元件補上「🎁 你的獎勵」區塊：顯示金幣/寶箱/扭蛋卡包命中與否；若有 `trophy`，額外顯示一行「🏆 貢獻紀念／尾刀紀念」的視覺標示。
   - 訪客（`guestOverride`）不請領（訪客本來就不能有 members 文件）。

4. `src/components/admin/AdminWorldBoss.jsx` 的「手動發放獎勵」按鈕：確認呼叫的還是 `distributeWorldBossRewards`（語意改變後，這個按鈕變成「手動定案，讓大家可以請領」而不是「立刻幫大家發完」），文案需要微調避免誤導教練。

## Acceptance Criteria

- [ ] 一般會員（非 admin）觸發 Boss 死亡，所有真實參戰者（不只是最後一擊那位）最終都能各自拿到共同獎勵。
- [ ] `KillScreen` 顯示「你的獎勵」內容，不再只有排行榜沒有自己實際拿到什麼。
- [ ] 貢獻前三名/最後一擊額外拿到紀念收藏品，且明顯跟共同獎勵是分開的兩件事。
- [ ] 重複造訪世界王頁面不會重複發放（`claimed` 旗標防重複）。
- [ ] `CI=true npm run build` 成功。
- [ ] 不需要新增/修改 firestore.rules（`worldBossEvents` 本來就 `allow read,write: if isLoggedIn()`，`claimWorldBossKillReward` 只寫呼叫者自己的 `members` 文件）。

## Notes
- R1-R6 強度分級、世界王專屬寶箱、六族對應寶箱、專屬卡片是第二階段，使用者已確認先不做，需要之後再逐項設計確認。
- 舊資料（已經 `rewardDistributed:true` 但沒有 `top3Ids` 的歷史事件）不處理回溯，只影響新產生的世界王事件。
