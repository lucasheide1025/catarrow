# 組隊戰鬥 UI 修復

## Goal

TBD.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
# PRD — 組隊戰鬥 UI 修復

## 目標

修復 `PartyBattleRoom` 被後續改動破壞的組隊戰鬥畫面與互動。以既有單人戰鬥的固定版型為基準，但保留組隊專屬的隊員狀態、前／後衛與送分流程；不得更動組隊戰鬥的傷害、結算、Firebase 房間或獎勵邏輯。

## 已確認的畫面契約

- 左上固定為戰鬥資訊／狀態列，不能被隊員列表取代。
- 右上固定為敵人卡與 HP／ATK／DEF 狀態；敵人不放在中央。
- 中央以場景與戰鬥氛圍為主，不能被大型隊員卡或其他控制項遮蔽。
- 左側中段放組隊隊員頭像與本回合狀態。
- 左下固定為玩家自己的詳細角色卡。
- 右下固定為主要操作：射擊、藥水，以及未來的「離開戰鬥」；第三項不得再稱為重置。

## 隊員互動與狀態

- 點擊隊員頭像，顯示該隊員名稱、攜帶貓貓、目前 HP、ATK、DEF 與前／後衛。
- 頭像的勾選只代表該隊員本回合已完成分數輸出／送出；未勾選代表仍在輸入分數。不可把它改成準備、在線或其他語意。
- 前／後衛資訊必須持續可見，且原有前／後衛策略／行為不應在修復時消失。
- 既有單人戰鬥版型的視線層級要保留，但組隊 UI 不可退化成純單人 `BattleScreen`。

## 範圍與限制

- 主要調整 `src/components/party/PartyBattleRoom.jsx` 及必要的局部展示元件／樣式。
- 可將 `PartyBattleRoom.legacy.jsx` 作為互動與版型行為的對照，但不可盲目整檔覆蓋，避免回退後續已修正的資料／資產處理。
- 保留既有房主開始、計分輸入、送分、隊員等待、前／後衛、藥水、結算、重連與獎勵行為。
- 「離開戰鬥」先只完成正確的 UI 文案與既有安全離開流程的接線；若需要新的退出規則，另立需求，不在此任務猜測。

## 驗收條件

- [ ] 組隊戰鬥畫面符合固定區塊位置，不再以底部寬卡片堆疊隊員而破壞戰場。
- [ ] 右上敵人卡、左上資訊列、左下自身卡、右下操作均可清楚辨識。
- [ ] 隊員頭像可點擊並顯示完整指定狀態。
- [ ] 勾選／未勾選正確反映本回合送分／輸入狀態。
- [ ] 前／後衛資訊與既有策略功能可用。
- [ ] 主動作保有射擊與藥水；第三操作顯示「離開戰鬥」。
- [ ] 單人戰鬥、組隊結算、房主權限、送分與獎勵不回歸。
