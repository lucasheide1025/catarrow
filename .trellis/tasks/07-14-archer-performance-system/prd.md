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

## Current UI Findings

- The data boundary is already substantially implemented: `shootingSessions` stores real-shooting summaries/ends and `gamePerformances` stores locked game outcomes.
- The current `MemberPerformance` page places every audience and task in one long scroll: member/coach selection, coach summary, full-history loading, six filters, real-shooting KPIs, training advice, session detail/correction, game records, and device synchronization.
- The resulting complexity is primarily an information-architecture problem, not a need for more metrics or another data model rewrite.
- Technical synchronization controls and full-history transfer are shown with equal visual weight to the student's progress and next training action.
- Game performance is correctly excluded from technical averages, but its large section competes visually with the real-shooting progress story.

## Proposed Product Direction

- Make the default view answer two student questions: “Am I improving?” and “What should I practice next?”
- Keep only recent trend, 30/60/90-arrow comparison, one training recommendation, and a few recent sessions on the overview.
- Move complete session history/filtering, game records, and device/data synchronization into separate secondary views.
- Preserve coach member selection and correction tools, but present them as coach-specific controls rather than student dashboard content.

## Open Product Decision

- Confirm the primary job of the default Shooting Performance landing view before choosing final navigation and content priority.
