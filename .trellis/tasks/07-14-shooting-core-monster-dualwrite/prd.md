# 射手表現核心與一般打怪雙寫

## Goal

建立新射手表現的 Firestore 寫入服務，並讓一般打怪完成時在既有 `practiceLogs` / `monsterLogs` 不變的前提下，同步建立射箭、遊戲與箭數資料。

## Requirements

- 新集合：`shootingSessions`、其 `ends` 子集合、`gamePerformances`、`arrowCountEvents`。
- 一般計分每箭獨立保存；靶面輸入保存原始正規化座標、靶位與當下判分。
- Metrics 只用真實射箭資料；GamePerformance 固定保存當場傷害與怪物 HP。
- `arrowCountEvents/{sessionId}` 使用固定 ID，重送不可重複計箭。
- 僅完成的箭會保存；沒有箭的戰鬥不建立射手表現資料。
- 支援 3 / 6 箭回合，且 performance key 區分射擊條件。

## Acceptance Criteria

- [ ] 核心轉換、performance key、metrics 都是可重用的純函式。
- [ ] 一般打怪勝敗都會雙寫，不影響既有結算；失敗的新增寫入只記錄錯誤，不阻擋原流程。
- [ ] 同一 session 寫入可安全重試，不會重複 arrowCountEvent。
- [ ] production build 通過。
