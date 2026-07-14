# 多人與首領戰鬥射擊雙寫

## Goal

將已建立的射手表現資料契約接入地下城、組隊戰鬥、世界王與決鬥，不改變原有房間同步、獎勵或傷害結算。

## Requirements

- 每個戰鬥模式都保留其既有集合與結算流程，同步建立自己的 ShootingSession 與 GamePerformance。
- 多人模式只寫入本人的真實箭；隊伍傷害、他人箭分與房間狀態不得混入個人射手資料。
- 地下城／世界王未完成、敗北或離開時，已有真實箭仍需以 abandoned/lose 保存。
- 僅接入已有逐箭資料的流程；缺乏逐箭資料時不虛構射手紀錄。

## Acceptance Criteria

- [ ] 四種模式有可追蹤 sessionId 與不重複的 ArrowCountEvent。
- [ ] 遊戲歷史數值維持當時快照，後續修正射擊資料不回算傷害或獎勵。
- [ ] production build 通過，既有多人結算不變。
