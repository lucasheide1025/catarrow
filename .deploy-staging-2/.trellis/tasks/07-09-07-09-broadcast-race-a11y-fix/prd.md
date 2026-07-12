# 首殺公告 race condition 修正 + MemberApp a11y 修正

## Goal

1. 修正地下城「首殺全系統廣播」在組隊模式下因非 atomic 判斷而重複觸發的 bug（使用者回報：「首殺公告會一直重複出現，他只會顯示一次」）。
2. 修正 `web-design-guidelines` skill 審查 `src/pages/MemberApp.jsx` 時發現的兩項可行動 a11y 問題（div onClick 無鍵盤支援、動態公告缺少 aria-live）。

範圍明確限定在這兩項；訊息列分類路由（把首殺/世界王擊殺改存進 `notifications` 讓 `MemberNotifications.jsx` 分類顯示）、地下城其餘 6 項已知 bug、世界王結算+玩法重新設計，都是使用者已確認、故意排除在本任務外的後續項目，會另外開 Trellis 任務處理。

## 已確認的根因（讀 code 得出，非推測）

### 問題 1：首殺公告重複

- `src/lib/dungeonDb.js:1095` `trySetDungeonFirstClear(dungeonId, ...)` 是「先 `getDocs` 查詢 `dungeonBroadcasts` 是否已有該 `dungeonId` → 空的話才 `setDoc` 寫入 `dungeonFirstClear/{dungeonId}`」，**兩步之間沒有 transaction 鎖**。
- `src/components/dungeon/TeamExpeditionBattle.jsx:605` `handleFinish()`（隊伍領獎流程）**每個隊員各自呼叫**，不是只有房主呼叫（「全員領取後才清房」是既有設計，見 `claimTeamExpeditionResult`）。
- 當多名隊員幾乎同時點擊「領取」，每個人各自的 `trySetDungeonFirstClear` 呼叫都在別人寫入完成前查到「還沒有廣播」，導致每個人都判斷 `isFirst:true`，各自呼叫 `addDungeonBroadcast()`（`dungeonDb.js:1112`，用 `addDoc` 產生新文件）——同一次首殺產生多筆 `dungeonBroadcasts` 文件，各有不同 doc id。
- `MemberApp.jsx` 的 `subscribeLatestBroadcast` 訂閱只認「目前最新一筆」，用 `localStorage.dismissedBroadcastId` 去重（此機制本身已於 2026-07-05 修好，能正確記住「已讀的那個 id」）——但因為每個隊員各自產生了「不同 id」的廣播，去重機制對「新 id」完全無效，因此使用者會看到公告一次次跳出來（其實是好幾筆不同的廣播文件，不是同一筆重複顯示）。
- 同樣的 race 也存在於單人模式 (`DungeonExpedition.jsx:1080`) 與舊系統 (`DungeonBattleRoom.jsx:481`) 呼叫路徑，但機率遠低於組隊模式（單人不會有多個併發呼叫者；舊系統路徑目前已知很少被觸發）。

### 問題 2：a11y（web-design-guidelines skill 審查結果）

- `MemberApp.jsx:507`：`dungeonKillAlert` 公告用 `<div onClick>` 關閉，無 `role`/`tabIndex`/鍵盤事件。
- `MemberApp.jsx:523`：`wbKillAlert` 公告同樣是 `<div onClick>`。
- 這兩個全域公告（連同 `specialAlert`）動態插入畫面時沒有 `aria-live="polite"`，螢幕報讀器使用者不會被告知。

## Requirements

1. `trySetDungeonFirstClear` 改用 Firestore `runTransaction`：在單一 transaction 內讀取 `dungeonFirstClear/{dungeonId}` 是否存在，不存在才在同一 transaction 內寫入，確保同一個 `dungeonId` 全域只有一個呼叫者能拿到 `isFirst:true`。呼叫端（`DungeonExpedition.jsx`/`TeamExpeditionBattle.jsx`/`DungeonBattleRoom.jsx`）**不需修改**，仍然依照回傳的 `isFirst` 決定要不要呼叫 `addDungeonBroadcast`。
2. `trySetDungeonFirstClear` 內「已廣播」的判斷來源改成以 `dungeonFirstClear/{dungeonId}`（deterministic doc id）為準，不要再查 `dungeonBroadcasts`（collection 查詢無法放進同一個 transaction 的 read-before-write 保證裡，且語意上 `dungeonFirstClear` 才是唯一鍵）。
3. `MemberApp.jsx:507`、`523` 的 `<div onClick>` 改成可鍵盤操作的關閉方式（例如加 `role="button" tabIndex={0}` + `onKeyDown` 處理 Enter/Space，或直接把可點擊的關閉區域改用 `<button>` 包裹，視覺樣式不變）。
4. `dungeonKillAlert`/`wbKillAlert`/`specialAlert` 三個公告容器加上 `aria-live="polite"`（`specialAlert` 用 `OverlayModal` 包裹，只需在其可視文字容器補上屬性，不需大改結構）。
5. 不影響現有視覺樣式與既有行為（公告內容、8 秒自動消失、team 領獎流程本身都不變，只改「誰能寫入首殺記錄+廣播」的判斷方式）。

## Acceptance Criteria

- [ ] 模擬多個 team member 同時呼叫 `trySetDungeonFirstClear(dungeonId,...)`，只有一個回傳 `isFirst:true`，其餘回傳 `isFirst:false`（可用手動 code review + 邏輯走查確認 transaction 正確性，專案無自動化測試框架）。
- [ ] `dungeonBroadcasts` 不再因為組隊多人同時領獎而產生同一次首殺的重複文件。
- [ ] `MemberApp.jsx:507`、`523` 的公告可用鍵盤（Tab 移到關閉區 + Enter/Space）關閉，視覺不變。
- [ ] 三個全域公告容器有 `aria-live="polite"`。
- [ ] `CI=true npm run build` 成功。
- [ ] 不修改 `dungeonFirstClear`/`dungeonBroadcasts` 以外的 collection、不修改訊息列 (`MemberNotifications.jsx`) 分類邏輯（那是下一個任務的範圍）。

## Notes

- 訊息列分類路由、地下城其餘 6 項 bug、世界王結算+重新設計，使用者已確認優先順序放在本任務之後，個別另開 Trellis 任務並先做設計確認，不在本次 implement 範圍內。
- Firestore 規則：`dungeonFirstClear`/`dungeonBroadcasts` 的讀寫規則本次不變動（沿用既有規則），若 transaction 寫入方式觸發規則層的意外拒絕需另外排查並記錄進 changelog。
