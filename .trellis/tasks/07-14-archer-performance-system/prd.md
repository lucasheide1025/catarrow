# 射手表現系統重設

## Goal

建立統一的真實射箭資料層，使自主練習與所有含真實射箭的遊戲模式都能產生可分析的 `ShootingSession`；遊戲戰鬥資料則以不可回算的 `GamePerformance` 獨立保存。

## Requirements

- 維持既有資料集合與目前可見的戰鬥、獎勵、XP 行為。
- 以 sessionId 關聯真實射箭與遊戲結果；傷害、技能、裝備數值不得進入射手技術統計。
- 逐步雙寫，先接一般打怪，再依序接其他戰鬥、表現頁與歷史回填。
- 射手主頁只讀 Session 摘要；逐箭 `ends` 僅於單場明細讀取。
- 不新增常駐歷史監聽或未列出的 Firestore 複合索引。

## Child Tasks

- `07-14-shooting-core-monster-dualwrite`：核心 schema、metrics、箭數事件與一般打怪雙寫。
- 後續子任務：其他戰鬥模式接入、新射手表現頁、遊戲表現頁、資料核對與選擇性回填。

## Acceptance Criteria

- [ ] 每場一般打怪至多產生一筆 finalized/corrected ShootingSession、一筆對應 GamePerformance 與一筆 ArrowCountEvent。
- [ ] 戰敗且有真實箭時仍保存射手資料；遊戲結果永久保留當下快照。
- [ ] 逐箭、靶面座標、三連靶靶位、覆寫分數與 3/6 箭設定有相容的資料契約。
- [ ] 新資料不會改寫或刪除舊資料。
