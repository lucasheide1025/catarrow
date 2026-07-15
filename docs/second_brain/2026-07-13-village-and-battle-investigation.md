# 2026-07-13｜貓貓村舊帳號礦坑與玩家擊倒演出調查

## 1. 舊帳號礦坑不產生資源

### 結論

這是程式相容性缺口，舊帳號很可能因為保留了舊型態的
`village.allocations.mine` 而完全不產礦。

### 已確認的流程

- 收集入口：`src/lib/db.js` 的 `collectVillageResources`。
- 礦坑是分層資源；收集器只讀取 `allocations.mine["1"]`、`["2"]` 等百分比。
- 新帳號沒有 `allocations.mine` 時，會使用 `getDefaultAllocation(level)`，故能正常產出。
- 但只要舊帳號存在一個「真值但格式不相容」的 allocation（例如舊欄位名、空物件，或百分比不是數字），程式會直接採用它；每層讀到的百分比皆為 0，迴圈全部 `continue`，不建立任何資源更新。
- 因此收集會更新 `lastCollectedAt`，卻不寫入任何 `ore_t1` 等礦石，表面上就是「礦坑不產生物資」。

### 次要相容性缺口

- `lastCollectedAt` 目前只接受 Firestore Timestamp 的 `.toMillis()`；舊帳號若是數字、字串或 Date，會被當作不存在。
- `ensureVillage`／初始化邏輯只判斷 `village` 是否存在；舊的「部分 village 物件」會被視為已初始化，沒有補齊新欄位或遷移 allocation。
- UI 使用預設值補畫面，因此畫面看似正常，但收集器實際收到的資料仍可能不完整。

### 待修方案（尚未實作）

1. 建立單一 `normalizeVillage`／`normalizeAllocation`，同時供 UI 預覽與實際收集使用。
2. allocation 僅接受目前格式的數字鍵 `"1" ... "N"`；總和為 0、欄位不合法或格式過期時，改用 `getDefaultAllocation(level)`。
3. 正規化 `lastCollectedAt`（Firestore Timestamp／number／Date／ISO 字串），並在下次收集時寫回目前格式。
4. 初始化改為「補齊與遷移 partial village」，不可只因物件存在就跳過。
5. 加入舊資料回歸測試：`allocations.mine = { t1: 100 }` 與空物件時，下次收集必須得到 `ore_t1`。

## 2. 玩家被怪物打死直接跳失敗、沒有擊倒演出

### 結論

組隊後端在怪物反擊後，直接把房間寫成 `completed`；前端因此先收到失敗狀態、卸載戰鬥流程，擊倒演出沒有機會播完。

### 已確認的流程

- `src/lib/partyDb.js`：怪物反擊會將 `memberHPNow[id]` 壓至 0，並建立 counter mini-round。
- 接著前衛倒下會被標記為轉後衛、HP 回復到最大值 50%。
- 但 `frontLiveAfter` 仍讀取未同步的 `memberHPNow`（仍為 0），所以所有前衛本回合倒下時即使已經被轉後衛，也會立刻判定 `result = "lose"` 並寫入 `status = "completed"`。
- 前端沒有獨立的「敗北演出完成後才結算」狀態，因此收到 completed 後會直達戰鬥失敗畫面。

### 正確的演出與狀態順序（待實作）

1. 怪物反擊動畫。
2. 受擊玩家卡片震動；爆擊使用紅色震動。
3. HP 降為 0 的玩家播放「擊倒」與名稱提示。
4. 若為首次前衛倒下：明示「轉為後衛」，並呈現轉位與 50% HP 恢復。
5. 只有真正全滅／沒有可戰鬥前衛時，才在擊倒演出結束後進入失敗結算。
6. 後端保存可重播的 `defeatedMembers`／`demotedMembers` 結果；前端以結果序列完成演出後再導向結算。

## 3. 同一輪順手修正事項

- 後衛不得產生攻擊 mini-round；僅能先執行治療或助攻，且不對怪物造成任何傷害。
- 前衛順序：後衛治療（綠光）→ 等 3 秒 → 後衛助攻（紅光）→ 房主前衛先攻 → 其他前衛 → 全部貓貓協戰 → 怪物反擊。
- 怪物只在實際承受正傷害時搖晃。
- 第一回合不得生成事件；後續事件僅出現一次，事件提示結束後再進入本輪。

## 4. 本輪已實作的延伸修正

- 每次開新戰鬥與回到等待室都將成員重置為 `front`、清除 `rearChoice`、`skipped` 與戰鬥 HP 狀態；被擊倒而轉為後衛的資料不能帶進下一場。
- 房主在開始戰鬥時決定背景圖並寫入 `partyRooms.battleBackground`；所有隊員只讀取房間背景。
- 怪物反擊紀錄每位目標的獨立傷害與爆擊旗標；前端逐人顯示名稱、傷害、爆擊紅震，不再只說全隊總傷害。
- 採集列顯示：累積時間、距離 24 小時滿額的剩餘時間、依目前分配計算的各項待收材料。
- 舊 allocation 資料會在下次收集時自動遷移為目前的數字 tier 格式。
