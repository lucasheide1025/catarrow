# 鎖定戰鬥中計分模式切換

## Goal

組隊模式（Party）與組隊地下城模式（DungeonBattleRoom）進入戰鬥後，不能再切換「一般計分（分數按鈕）」與「靶面計分（點擊靶面）」——目前存在多個可以中途切換的入口，會導致送出分數按鈕被鎖死。應改為：計分方式只在每回合最開始選一次，選定後直到送出前都不可再變更。

## 確認事實（探索程式碼所得）

- **`src/components/party/PartyBattleRoom.jsx` 第 1805 行**：`BattleArrowSlots` 旁有一個**永遠可點擊**的 🎯 切換鈕：`onClick={() => setTargetMode(m => !m)}`。這個按鈕沒有任何鎖定條件，回合中任何時候都能按，是最主要的漏洞來源。
- **`src/components/dungeon/DungeonBattleRoom.jsx` 第 1670 行**：`myContract.type==="hit_count"` 合約類型時，會顯示「🎯 改用靶面點擊」按鈕，同樣是回合中途可切換（`setTargetMode(true)`），沒有鎖定。
- **`TargetFaceOverlay` 的 `onClose`**（兩檔案都有，約 `PartyBattleRoom.jsx:1856`、`DungeonBattleRoom.jsx:1703`）：`() => { setTargetMode(false); setBattleInputMode("button"); }`——關閉靶面覆蓋層即可切回按鈕模式，這是另一個中途切換的路徑。
- **`scoringModeChosen` 這個狀態本身設計正確**（`useState(false)`，只在每回合開始的 `ScoreTabContent` 選擇一次，沒有被重置回 false 的路徑），問題出在**選完之後，還有其他 UI 元件繞過這個鎖定，讓玩家中途改變 `targetMode`**。
- **推測的鎖死機制**（`PartyBattleRoom.jsx` 第 542-545 行）：
  ```js
  function handleTargetSubmit() {
    setTargetPending(true);
    setTimeout(() => { setTargetPending(false); handleSubmit(); }, 2000);
  }
  ```
  送出鈕的 `disabled` 條件包含 `targetPending`（第1861行）。若玩家在這 2 秒等待期間、或在按鈕模式已集滿箭數（`arrows.length>=arrowsPerRound`，此時箭矢物件沒有 `nx/ny` 靶面座標）之後才切到靶面模式，`TargetFaceOverlay` 內部對「是否已完成」的判斷（依賴箭矢是否帶座標）可能與外層的 `arrows.length` 判斷不一致，導致卡在某個中間狀態，送出鈕永遠 disabled。
- **與先前「RPG 打怪送出後被踢回首頁」bug 的關聯**：先前調查發現一個訊息誤導（寫「加 limit(50)」實際塞了 1285 行「共用靶面系統」大改版）的 commit，同一批把這套 `targetMode`／`TargetFaceOverlay` 機制導入 `MonsterBattle.jsx`。**這次的根因分析很可能同樣適用於單人模式**，建議這次順便檢查、一併修掉（若單人模式也有類似的中途切換入口）。

## Requirements

1. `PartyBattleRoom.jsx` 第 1805 行的永久可點擊 🎯 切換鈕，改為**只有在 `!scoringModeChosen` 時才顯示**（或乾脆移除，因為 `ScoreTabContent` 已經有專門的「選擇計分方式」畫面），一旦本回合已選定模式，這個按鈕就不該再出現/可點。
2. `DungeonBattleRoom.jsx` 第 1670 行「🎯 改用靶面點擊」按鈕（hit_count 合約專用），同樣改為只在尚未選定模式時可用；已選定後移除或 disable。
3. `TargetFaceOverlay` 的 `onClose` 行為需要重新檢視：關閉覆蓋層不應該等同於「切換回按鈕模式」。如果玩家需要暫時關閉靶面來看別的資訊，關閉後應該維持在原本選定的靶面模式（下次重新打開還是靶面），而不是隱性切換模式。若目前 `onClose` 本身還有其他必要用途（例如純粹關閉視窗但不影響選定模式），保留關閉功能但移除 `setTargetMode(false)`／`setBattleInputMode("button")` 這兩行的模式切換副作用。
4. 檢查並修正 `handleTargetSubmit`／`targetPending` 這套機制是否真的會在中途切換時卡死（依照上面的推測驗證根因），確保修掉切換入口後，`targetPending` 的 timeout 機制本身也是穩固的（不依賴玩家不能中途切換這件事才能正常運作——即使切換入口都關閉了，也要確認這段邏輯本身沒有其他邊界案例會卡死）。
5. **檢查 `MonsterBattle.jsx`（單人 RPG 打怪）是否有相同的中途切換入口**，若有，一併修掉（比照這次的修法），因為這很可能是先前「送出分數後被踢回首頁、重選怪物進不去戰鬥」bug 的真正根因。

## Out of Scope

- 不改變 `ScoreTabContent` 一開始「選擇計分方式」的畫面本身（那是正確、應保留的一次性選擇機制）
- 不改變靶面計分／按鈕計分各自的計分邏輯本身，只處理「回合中途能不能切換」這件事

## Acceptance Criteria

- [ ] 組隊模式（Party）回合開始選定計分方式後，UI 上不再出現任何可以切換到另一種計分方式的按鈕/入口
- [ ] 組隊地下城（DungeonBattleRoom）回合開始選定計分方式後，同樣不再出現切換入口（含 hit_count 合約的「改用靶面點擊」按鈕）
- [ ] 關閉靶面覆蓋層不會偷偷把模式切回按鈕模式
- [ ] 實際測試：選定靶面模式後完整輸入到送出，確認送出鈕正常可按、不會卡死
- [ ] 若 `MonsterBattle.jsx` 有相同問題，一併確認是否為先前「送出分數被踢回首頁」bug 的根因並修正
