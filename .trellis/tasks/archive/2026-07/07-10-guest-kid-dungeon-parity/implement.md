# Implement：訪客/兒童地下城比照正式系統

依 design.md §8 施工順序，切 4 個 Step。**每個 Step 動到正式系統元件後，都要先確認正式學生路徑沒壞掉才能繼續下一步**——這是本次最高風險，寧可慢一點也不要最後才發現正式學生的地下城被動壞了。

## Step 1 — 正式元件加可選 guest 參數（風險最高，最先做且要最仔細）
- [ ] `DungeonLobby.jsx`：新增 `{ guestProfile, isGuest, tierCap }` 參數，`useAuth()` 的 profile 改用 fallback（`guestProfile || authProfile`）
- [ ] `isGuest` 時：分頁排除「挖掘探索」（比照 `MonsterBattle.jsx` 的 `{!isGuest && ...}` 寫法，不渲染分頁按鈕本身）
- [ ] `EquipmentPage.jsx`：同樣模式新增可選 `guestProfile` 參數
- [ ] `DungeonSelectionPanel.jsx`：`isGuest` 時不渲染組隊按鈕
- [ ] **驗證（regression，最重要的一步）**：不傳任何新參數的情況下，正式學生登入跑一次完整地下城流程（挖掘→選地下城→單人遠征→戰鬥→結算）、跑一次裝備頁，確認行為跟改動前完全一樣。教練切換射手模式也要測。

## Step 2 — 新元件與難度封頂
- [ ] `src/components/dungeon/GuestDungeonEntry.jsx`（新）：T1/T2 選擇畫面（預設T1），選完用 `drawExpeditionBoss(tier,family)` 就地組出 dungeon 物件，不寫入 `pendingReveal`/`savedDungeons`
- [ ] `DungeonExpedition.jsx` 難度封頂第二層防禦（design.md §3 逐字實作，`isGuest` 時用 `Math.min(dungeon.difficulty, tierCap)`，不讀 `excavation.difficulty`）
- [ ] `DungeonLobby.jsx` 的「進入地下城」分頁在 `isGuest` 時 render `GuestDungeonEntry` 而不是原本讀 saved 清單的畫面
- [ ] 驗證：訪客測試帳號選 T1、選 T2 各跑一次，確認怪物/王的難度真的對應（不是隨機出現T3+內容）；程式碼複查確認封頂邏輯兩層都在

## Step 3 — 串接 `GuestApp.jsx` + 掉落物路徑確認
- [ ] `GuestApp.jsx` 地下城分頁改成 `<DungeonLobby guestProfile={guestProfile} isGuest tierCap={2} .../>`，拿掉 `<GuestDungeonSimple>` 的呼叫（先不刪檔案，等 Step 4 驗證完再刪）
- [ ] 逐一檢查地下城戰鬥結算路徑（`DungeonBattleRoom`/相關結算函式）有沒有任何 `if (!isGuest)` 守衛擋住材料/金幣寫入——**這次要留存，不是要跳過**，跟 `MonsterBattle.jsx` 刻意跳過的方向相反，找到的話要移除或改條件，且要確認不影響 `MonsterBattle.jsx` 自己那條（那個不動）
- [ ] 驗證：訪客/兒童帳號完整跑一場地下城遠征，戰鬥結束後檢查 `members/{id}` 文件的材料/金幣欄位有正確增加

## Step 4 — 收尾與清理
- [ ] 訪客/兒童完整跑一次裝備頁：能看到、能升級裝備
- [ ] Grep 確認 `GuestDungeonSimple.jsx` 沒有其他呼叫點後刪除
- [ ] `CI=true npx react-scripts build` 通過
- [ ] `docs/second_brain/quick-ref.md`／`changelog.md`／`game-systems.md` 更新（新的 guest 整合模式、tierCap 兩層防禦設計、刪除了 `GuestDungeonSimple.jsx`）
- [ ] 同步複製到 `C:\Users\broud\Documents\Obsidian Vault\catarrow\`
- [ ] git commit → push（這個任務沒有「先不要push」的限制，比照今天其他 App 功能任務的慣例走完整流程）

## Rollback
Step 1 改動的是正式系統本體元件（`DungeonLobby`/`EquipmentPage`/`DungeonSelectionPanel`），如果 regression 測試發現正式學生路徑壞掉，優先回退到 Step 1 之前的版本，不要在壞掉的地基上繼續疊 Step 2-4。Step 2-4 的改動（新元件、`GuestApp.jsx` 接線）相對獨立，個別出問題可以只回退對應 commit。
