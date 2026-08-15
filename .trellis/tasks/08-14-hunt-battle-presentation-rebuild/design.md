# 狩獵戰鬥演示與結算重建設計

## 問題根因

目前單箭輸入、正式戰鬥結算、動畫與獎勵展示沒有清楚邊界：

- `BattleScreen` 的 `SCORE_ARROW` 同時建立輸入資料、計算隨機爆擊並直接合併怪物異常；`UNDO_ARROW` 只刪箭，無法撤銷已產生的狀態。
- 單機由 `BattleScreen` reducer 執行部分戰鬥邏輯，`MonsterBattle` 又在結束回呼執行獎勵與持久化。
- 組隊由 Firestore `processPartyRound` 產生權威 log，但 `BattleScreen` 與 `PartyBattleRoom` 都有演示／勝負副作用。
- 組隊領獎前先在客戶端預抽，權威 claim 後又混用預抽與回傳結果；單機保留 callable 與舊直接 `add*` 兩條路徑。

## 核心不變量

1. 單箭輸入只屬於可變草稿。
2. 正式提交後的完整箭組是不可變資料。
3. 每個 `{battleId, round, actorId}` 最多產生一筆正式回合結果。
4. 戰鬥計算產生事件；動畫只消費事件，不能反向改變戰鬥結果。
5. 貓咪效果是正式回合結果中的一個事件，不是獨立計時器再次計算。
6. 獎勵 claim 產生收據；結算 UI 只讀收據。

## 模組邊界

### BattleDraft

管理尚未提交的箭：

```js
{
  battleId,
  round,
  actorId,
  arrows: [{ label, score, landing, faceIndex }]
}
```

增加、刪除、切換輸入方式只改草稿。UI 可用純函式顯示「預估傷害範圍」，但不得抽 RNG、寫異常或消耗一次性效果。

### RoundSubmission

正式提交時從草稿建立：

```js
{
  submissionId: `${battleId}:${round}:${actorId}`,
  battleId,
  round,
  actorId,
  arrows,
  submittedAt,
  loadoutSnapshotId
}
```

提交端鎖定後不可修改。同 submission ID 的重試必須回傳同一結果或已處理狀態。

### RoundResolution

單機與組隊採同一展示契約；計算權威位置可以不同：單機共用決定性 resolver，組隊仍由 Firestore transaction／房主權威流程寫入。

```js
{
  resolutionId,
  submissionIds,
  round,
  before,
  events: [
    { id, type: "player_attack", actorId, damage, crits, arrows },
    { id, type: "status_applied" | "status_resisted", sourceId, targetId, status },
    { id, type: "cat_action", actorId, catId, outcome },
    { id, type: "monster_action", targetId, damage, shieldAbsorbed, statuses },
    { id, type: "resource_change", targetId, hpDelta, shieldDelta }
  ],
  after,
  outcome: "continue" | "win" | "lose"
}
```

所有隨機結果只在 resolver 建立一次並寫入事件。演示重播只按 event ID 播放。

### BattlePresentationController

唯一管理演示階段：

```text
input
  → submitted_waiting（組隊）
  → player_actions
  → triggered_effects
  → cat_actions
  → monster_actions
  → round_summary
  → rest
  → input（自動）
  → victory / defeat
```

- 單機略過 `submitted_waiting`。
- 沒有事件的段落立即通過。
- 每段落只更新播放游標，不呼叫傷害、異常、領獎或 Firestore 寫入。
- 等待／休息時間保留；下一回合自動開始。

### BattleBonusSheet

- 怪物區不再承載完整玩家效果清單。
- 戰鬥畫面提供一個不遮擋怪物的「本場加成」按鈕。
- 點擊後由底部抽屜顯示分組資料：能力來源、卡片／專精、傷害加成、可施加異常、抗性、防護與限時效果。
- 單機與組隊共用資料 adapter、中文詞彙與元件。

### BattleRewardReceipt

結算展示的唯一資料模型：

```js
{
  claimId,
  battleId,
  mode: "solo" | "party",
  status: "syncing" | "confirmed" | "failed_retryable",
  confirmedAt,
  items: [{ id, kind, name, icon, quantity, tier, source }],
  progression: [{ kind, name, amount }]
}
```

- `items` 由權威 claim 回傳正規化，禁止 UI 再抽掉落。
- pending queue 保存完整 claim 輸入、claim ID 與必要的戰果摘要；重試永遠使用相同 ID。
- 收據存於戰鬥恢復資料或伺服器可重讀位置，重整後可恢復同一畫面。
- 組隊 callable 的現有 reward 回應需轉成收據；單機 callable 需成為全部正式帳號掉落的唯一入口，淘汰舊直接 `addCoins/addMaterials/addChests/addMonsterCard` 分支。

## 結算 UI

共用手機版結構：

1. 勝利／失敗主視覺與怪物資訊。
2. 本場摘要（回合、箭數、傷害、承傷；組隊追加隊伍貢獻）。
3. 獎勵收據：同步中骨架或已確認項目卡。
4. 射箭表現摘要。
5. 主要操作「返回狩獵」，次要操作「查看詳細紀錄」；再戰必須建立新 battle ID。

視覺採深色手機版「狩獵戰報」：戰果主視覺保留怪物辨識度，資訊區按重要性垂直排列。權威收據確認時只播放短暫亮光與入袋動畫，不生成滿版寶箱或散落物品，以免獎勵較多時失去可讀性。

獎勵項目依 `kind + id + tier` 合併數量，使用目錄 adapter 翻成中文。空值、零數量與不在收據中的預覽不顯示。

## 相容與遷移

- 保留既有戰鬥數值與掉落機率；只移除客戶端重抽與舊顯示來源。
- 組隊房的舊 `rewardPending` 可作為 claim 資格輸入，但不可直接當結算內容；新房寫入 receipt schema。
- 遇到無收據的舊已完成戰鬥，只顯示戰鬥摘要與「舊戰鬥無法還原獎勵明細」，不得查背包或舊 log 猜測。
- `BattleResultPanel` 可保留舊模式相容層供地下城／世界王使用；自由狩獵切到新收據版元件，待後續獨立遷移其他模式。

## 風險與回復

- 最大風險是改動 reducer 與組隊同步時造成回合卡住。按「草稿防副作用 → 演示控制器 → 收據 → UI」分段，每段都有契約測試。
- 單機 callable 若尚未涵蓋所有舊獎勵種類，先擴充伺服器回傳與冪等寫入，再刪除客戶端分支。
- 組隊自動 claim 由每位玩家自己的客戶端呼叫現有冪等 callable；失敗只進 pending，不阻擋房主完成戰鬥。
