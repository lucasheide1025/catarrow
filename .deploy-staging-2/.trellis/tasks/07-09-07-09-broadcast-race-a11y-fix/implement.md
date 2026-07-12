# Implement Checklist

1. `src/lib/dungeonDb.js`
   - [x] import 加入 `runTransaction`（第 3-7 行的 firebase/firestore import block）
   - [x] 改寫 `trySetDungeonFirstClear`（1095-1109 行）為 transaction 版本，見 design.md
   - [x] 移除原本查詢 `dungeonBroadcasts` 判斷已廣播的邏輯

2. `src/pages/MemberApp.jsx`
   - [x] 507 行 `dungeonKillAlert` 容器補 `role="button" tabIndex={0} onKeyDown` + `aria-live="polite"`
   - [x] 523 行 `wbKillAlert` 容器補同上
   - [x] 561 行 `specialAlert`（`OverlayModal` 內卡片）補 `aria-live="polite"`

3. 驗證
   - [x] `CI=true npm run build` 成功
   - [x] 走查 `TeamExpeditionBattle.jsx:605` / `DungeonExpedition.jsx:1080` / `DungeonBattleRoom.jsx:481` 三個呼叫端，確認回傳形狀 `{ok,isFirst}` 沒變、不需要跟著改
   - [x] 更新 `docs/second_brain/changelog.md`（本次修法 + race condition 根因，供未來查閱）
   - [x] 更新 `docs/second_brain/quick-ref.md` 踩坑提醒（trySetDungeonFirstClear 已改 transaction）
