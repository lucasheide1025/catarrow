# 組隊遠征穩定性：結算時機+畫面卡死+斷線回房

## Goal

使用者回報的地下城遠征系統 4 個相關問題（原始清單項目 1/2/3/4）：
1. 每一場戰鬥沒有立刻結算，斷線/登出會拿不到獎勵與經驗值
2. 偶爾會出現畫面無法點擊
3. 隊友不小心點到「出去」無法回到原房間
4. 第三層確認時斷線或點出去都無法回來

調查後發現這 4 項的根因高度集中，且比原本設想的架構改動小很多（**不需要重新設計獎勵公式**，`calculateExpeditionRewards` 本來就支援部分樓層的比例結算）。已與使用者確認採用「持久化 + 斷線後自動結算」方向，四項全做。

## 已確認的根因

### 核心 bug（直接導致項目 3、4）
`src/components/dungeon/DungeonBattleRoom.jsx:1352` 戰鬥畫面右上角「離開」按鈕**完全沒有確認對話框**，點擊呼叫 `onExit({preserve:true})`。但 `TeamExpeditionBattle.jsx`（`TeamBattleRoom` 內 `onExit={onAbandon}`，約123-198行）與 `DungeonExpedition.jsx`（約586行 `onExit={onAbandon}`）都把這個 `onExit` **直接接到「整個放棄遠征」的 `handleAbandon`**，完全忽略 `{preserve:true}` 這個「只是想關掉戰鬥畫面，不是要放棄」的訊號：
- 房主誤點 → `updateTeamExpeditionRoom(...,{status:"completed",result:"abandoned"})`，全隊房間直接解散。
- 隊員誤點 → `leaveTeamExpeditionRoom(teamRoomId, myId)`，被移出 `room.members`。

**重要發現**：組隊模式其實**已經有**斷線復原機制——`src/components/dungeon/DungeonLobby.jsx` 的 `findReconnectableTeamExpedition()` + 「找到尚未完成的組隊地下城」banner（約51-61、149-166、242+行），能正確處理「重新連結進行中遠征」「返回等待室」「返回結算領獎」三種情境。但這個機制要求玩家還在 `room.members` 裡——一旦被上述 bug 誤踢出去，復原機制就救不回來了。

**另外確認**：地圖層級的「撤退」按鈕（`GridMapStage`/`BranchStage`，在 `DungeonExpedition.jsx` 130-461行，team/solo 共用）**已經有**正確的兩段式確認（先點「撤退」→ 顯示「確定撤退」二次確認才真的呼叫 `handleAbandon`），這條路徑本身沒問題，不用動。

### 項目 2（畫面卡死）
單場戰鬥本身（`DungeonBattleRoom.jsx` 358-373行）已經有 15 秒 processing 逾時自動清除保護。但 `TeamExpeditionBattle.jsx` 的**樓層間探索/事件協調層**（`activeRoomId`/`roomConfirms`/`currentEvent`，約501-599行）完全沒有這層保護——而且 `enterExplorationRoom`/`handleCellClick`/`handleDescend`/`handleChooseBranch`/`handleBranchNext`/`finishFunctionRoom` 全部是 `if (!isHost) return`，**只有房主能推進地圖**。房主卡住（網路延遲/當機）時，其他隊員的畫面點擊全部沒有反應——這正是「偶爾畫面無法點擊」的成因。

### 項目 1（結算時機）
`calculateExpeditionRewards({difficultyTier, floorsCleared, won})`（`expeditionDb.js`）本來就有處理「沒破關」的部分結算（`floorMult = floorsCleared/3`）。這條路徑在玩家能夠走到「結算畫面」時本來就會正確運作。真正的缺口跟項目 3、4 是同一個：玩家如果因為誤點/斷線而回不去，就永遠走不到結算畫面。**修好項目 3、4 之後，項目 1 在「玩家還能重新連回去」的情況下會自然解決**；本任務另外針對「單人模式完全沒有任何伺服器端進度記錄」補上持久化，讓真正連不回去的情況也至少能拿到部分結算。

### 單人模式的額外缺口
`DungeonExpedition.jsx`（單人）目前**完全沒有**寫入任何伺服器端進度記錄（`family`/`difficultyTier`/`floorsCleared` 全部只存在瀏覽器 React state），跟組隊模式的架構落差很大——組隊模式靠 `dungeonRooms` 文件的 `expeditionTeamMode:true`/`members` 支援復原，單人模式什麼都沒有，重整頁面就整個消失，沒有任何救援手段。

## Requirements

1. **`DungeonBattleRoom.jsx`**：`expeditionMode===true` 時，隱藏戰鬥畫面內的「離開」快速按鈕（1352行附近）。移除這個誤觸來源；地圖層級已有二次確認的「撤退」仍是唯一的正常離開途徑。
2. **`TeamExpeditionBattle.jsx` 卡死保護**：仿照 `DungeonBattleRoom.jsx` 既有的 15 秒逾時模式，針對樓層/房間協調狀態（`activeRoomId`/`roomConfirms`/`currentEvent`）加上偵測：
   - 房主端：狀態卡住超過設定秒數，自動清除協調欄位讓房主能重新操作。
   - 非房主端：等待房主動作超過設定秒數，顯示提示文字（例如「等待房主中，若長時間沒反應可能是連線問題」），並提供一個安全的「返回大廳」選項——**只是本地離開畫面**，不呼叫 `leaveTeamExpeditionRoom`，不影響 `room.members`，之後仍可透過 `DungeonLobby.jsx` 既有的復原 banner 重新連回來。
3. **單人模式持久化**：`DungeonExpedition.jsx` 進入遠征、每次樓層推進（`floorsCleared` 改變）時，把 `{family, difficultyTier, isHidden, floorsCleared, startedAt}` 寫入 `profile.activeExpedition`（`members/{memberId}` 新欄位，需加進 firestore.rules 的 `hasOnly` 白名單）+ 鏡射一份到 `sessionStorage`。`handleFinish`（正常結算完成）與真正的撤退確認後，清除這個欄位。
4. **單人模式復原 UI**：`DungeonLobby.jsx` 比照既有的組隊 `reconnectRoom` banner，新增偵測 `profile.activeExpedition`（非 team 模式）：由於單人遠征是 5×5 迷霧格地圖，精確復原「走到哪一格」風險高、範圍大，**本任務不做完整地圖復原**，只提供「偵測到中斷的單人遠征，結算已完成的 {floorsCleared} 層」banner，按下後用既有的 `calculateExpeditionRewards({difficultyTier, floorsCleared, won:false})` 公式一次性結算（呼叫 `grantExpeditionRewards`/`saveExpeditionRecord`），然後清除 `activeExpedition`。

## 明確排除在本任務外

- **房主永久失聯（host failover）**：如果組隊遠征的房主整個消失且不會再回來，目前的地圖推進機制仍然會卡住（因為所有推進都是 `if (!isHost) return`）。完整解法需要「房主轉移」設計，範圍更大，本任務只做「非房主可以安全離開畫面、之後能重連」，不做房主轉移。
- 不改 `calculateExpeditionRewards` 的獎勵數值/公式本身。
- 不改組隊模式既有的 `findReconnectableTeamExpedition`/`reconnectRoom` banner 邏輯（本來就是對的）。
- 不改地圖層級「撤退」的二次確認流程（本來就是對的）。

## Acceptance Criteria

- [ ] `expeditionMode` 戰鬥畫面裡看不到會誤觸全隊解散/被移出房間的「離開」按鈕。
- [ ] 隊員誤觸/斷線後，只要沒有經過地圖層級「確定撤退」二次確認，仍然能透過 `DungeonLobby.jsx` 的復原 banner 連回房間。
- [ ] `TeamExpeditionBattle.jsx` 房主端卡住時，一段時間後自動恢復可操作；非房主端有清楚提示+安全退出選項，不會被踢出隊伍。
- [ ] 單人遠征斷線/關閉瀏覽器後，重新進入地下城分頁能看到「結算已完成 X 層」的提示並正確拿到部分獎勵。
- [ ] `firestore.rules` 的 `members` update `hasOnly` 白名單加入 `activeExpedition`（若沿用 `members` 文件儲存）。
- [ ] `CI=true npm run build` 成功。

## Notes

- 這是使用者選定的第二個優先項目（8 項待辦清單之一），已確認採用「持久化+斷線後自動結算」而非「每場戰鬥立刻發錢」的重新設計方向。
- 逾時秒數比照舊系統慣例（15-20秒），實作時直接沿用，不用另外跟使用者確認精確數字。
