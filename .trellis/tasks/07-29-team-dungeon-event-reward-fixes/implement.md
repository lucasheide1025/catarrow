# 實作計畫

1. ✅ 建立可重現測試：
   - 房主先確認不會提前推進。
   - 全員確認後才可推進。
   - ATK +10% 等事件資料能產生實際共享更新。
   - 寶箱族系、難度成長與固定種子結果。
   - 寶箱三張候選的類別與位置不固定，且不會三張完全相同。
   - 第三層七間房的順序、座標與實際觸發內容一致。
2. ✅ 抽出非戰鬥房有效成員與完成條件判斷純函式。
3. ✅ 抽出事件解析、隨機結果固定化與效果套用純函式。
4. ✅ 將組隊事件改為房主一次結算、全員讀取同一結果與個別確認。
5. ✅ 將組隊寶箱改為共享生成、個別防重領取與全員完成後推進。
6. ✅ 重整普通寶箱掉落表，使族系、T1～T6、數量與價值正確成長。
7. ✅ 修正第三層生成器與 2.5D 地圖座標，消除商人房與王房疊位。
8. ✅ 修正事件與寶箱 UI，使說明直接反映已解析的實際結果。
9. ✅ 執行：
   - 新增的事件生命週期與掉落測試。
   - 既有地下城相關測試。
   - production build。
10. ✅ 搜尋並移除診斷輸出，確認單人模式未退化。

## 高風險位置

- `src/components/dungeon/TeamExpeditionBattle.jsx`
- `src/components/dungeon/DungeonEvent.jsx`
- `src/components/dungeon/DungeonChest.jsx`
- `src/lib/dungeonDb.js`
- `src/lib/dungeonEventPool.js`
- `src/lib/dungeonChestLoot.js`
- `src/lib/expeditionGrid.js`
- `src/components/dungeon/DungeonStages.jsx`

## 回復點

事件等待、事件效果、寶箱掉落分成獨立提交單位；任何一段驗證失敗時可單獨回復，不影響地下城戰鬥流程。
