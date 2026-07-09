# 首殺/世界王擊殺公告寫入訊息列 + 分類頁籤

## Goal

地下城首殺、世界王擊殺目前只用 `dungeonKillAlert`/`wbKillAlert` 顯示成一次性頂部橫幅，橫幅消失後這筆事件就沒有任何紀錄可查。使用者確認的方向：**橫幅仍照舊顯示一次（不拿掉），同時把同一筆事件寫進 `notifications` collection**，讓射手事後可以在「訊息中心」用分類頁籤回顧。

`MemberNotifications.jsx` 的 `TYPE_META` 已經預先定義好 `dungeon`（🗺️ 地下城）、`worldboss`（👑 世界王）兩個分類的圖示與顏色，只是 `FILTERS`（頁籤）沒有對應項目、也從來沒有任何地方真的用這兩個 type 呼叫 `createNotification`。本任務把這兩塊接起來。

## Requirements

1. `src/lib/dungeonDb.js::addDungeonBroadcast()`：在既有 `addDoc(dungeonBroadcasts, ...)` 成功後，額外呼叫 `createNotification({ type:"dungeon", title, content, targetMemberId:null })`（沿用 `village_goal`/`village_goal_complete` 的「全體廣播」寫法：`targetMemberId:null`）。失敗不應影響 `addDungeonBroadcast` 原本的回傳值（notification 呼叫包 `.catch(()=>{})`，比照現有 codebase 對次要通知呼叫的既有慣例）。
2. `addDungeonBroadcast` 需要新增 `memberName` 參數（順帶修正既有小 bug：目前簽章完全沒有收 `memberName`，但橫幅畫面卻讀 `dungeonKillAlert.memberName` 當 `teamNames` 為空時的 fallback；因為從未真的傳入，單人首殺的橫幅文字會變成「undefined 成為首殺英雄」）。三個呼叫端（`DungeonExpedition.jsx`、`TeamExpeditionBattle.jsx`、`DungeonBattleRoom.jsx`）要跟著補上這個參數。
3. `src/lib/worldBossDb.js::attackWorldBoss()`：在 `defeated` 分支（既有 `upd.status = "defeated"` 那段）額外呼叫 `createNotification({ type:"worldboss", title, content, targetMemberId:null })`，內容比照橫幅現有文案（`⚔️ 世界王擊殺！{bossName} 已倒下！` / `{lastHitBy.memberName} 給予最後一擊！全員功勛已發放 🎁`）。同樣用 `.catch(()=>{})` 包住，不影響原本的擊殺結算流程。
4. `src/components/member/MemberNotifications.jsx`：`FILTERS` 新增兩個頁籤 `dungeon`（🗺️ 地下城）、`worldboss`（👑 世界王），並在 `matchFilter()` 補上對應的比對條件（`n.type === "dungeon"` / `n.type === "worldboss"`）。`TYPE_META` 已經有這兩個 key，不用改。
5. **不動**：`dungeonKillAlert`/`wbKillAlert` 橫幅本身的顯示、8 秒自動消失、localStorage 去重、上一個任務已修好的 race condition 全部維持原樣。這個任務只是「額外多寫一筆持久化通知」，不改橫幅行為。

## 已知但刻意不在本任務處理的相鄰問題

- `attackWorldBoss()` 本身是「`getDoc` 讀 → 本地算 `defeated` → `updateDoc` 寫」，沒有用 transaction，理論上多名學員在同一堂課幾乎同時攻擊時也可能有類似上一個任務修過的 race condition（可能導致擊殺判斷不準或獎勵重複結算）。這跟使用者稍後要討論的「世界王結算」項目重疊，本任務**不修**，只在既有的 `defeated` 分支上掛一個 notification 呼叫。

## Acceptance Criteria

- [ ] 地下城首殺發生後，`notifications` collection 多一筆 `type:"dungeon"` 的全體通知，`MemberNotifications.jsx` 選「地下城」頁籤能看到。
- [ ] 世界王被擊倒後，`notifications` collection 多一筆 `type:"worldboss"` 的全體通知，選「世界王」頁籤能看到。
- [ ] 單人地下城首殺的橫幅文字正確顯示玩家名字（不再是 undefined）。
- [ ] 橫幅顯示行為（顯示一次、8秒消失、可鍵盤關閉）完全不變。
- [ ] `CI=true npm run build` 成功。

## Notes

- `createNotification` 簽章與既有全體廣播寫法（`village_goal`/`village_goal_complete`/`cert_pass`）保持一致，`targetMemberId:null`。
- 這是使用者主動選擇要先做的項目（優先於地下城 6 bug、世界王結算+重新設計）。
