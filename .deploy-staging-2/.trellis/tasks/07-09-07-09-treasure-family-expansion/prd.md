# 寶箱族擴充：14隻新怪物 + 隱藏地下城改為專屬寶箱族

## Goal

寶箱族（第 7 族，`monsterData.js` 已有 `treasure_1~6` 六隻雛形但從未被排進任何隨機池）擴充為完整玩法：14 隻怪物、隱藏地下城規則改變、專屬豐厚獎勵。核心定位（使用者原話）：「隱藏地下城本身的用意並不是擊倒而是獲得大量獎勵的地方」——這不是戰鬥挑戰內容，是獎勵農場。

## 已確認的設計決策

1. **14 隻怪物組成**：T1~T6 各一隻「假」+ 各一隻「真」= 12 隻，加上寶箱王 2 隻（小King、大King）。
2. **真假定義**（使用者原話確認）：「真的沒有攻擊力好打倒，假的定義是他就真的是怪物，所以會反擊有傷害」。
   - 假：沿用現有 `treasure_1~6`（HP/ATK/DEF 數值不變，只是改名／加註記為「假」）。
   - 真：新增 6 隻，ATK 設接近 0，DEF 比同階假的更高。
3. **寶箱王觸發**：低階地城（T1-T3）出小King，高階地城（T4-T6）出大King，比照其他族系既有的難度分級慣例。
4. **獎勵/掉落/經驗值全部跟標準 6 族分開設計**（不共用 `lootTable.js` 既有的階級對照表）：
   - 金幣：明顯高於同階正常怪物（起點：3 倍，可調）
   - 材料：保底稀有以上
   - 經驗值：也調高，但幅度比金幣/材料保守（避免打寶箱地城變成練等最佳解）
   - 假（有攻擊力）報酬 > 真（不會反擊），風險對應報酬
   - 寶箱王：大量金幣 + 材料 + 符文道具（符文功能目前是隱藏的，這次只需要讓王正常掉落符文物品本身，解鎖符文功能是另一個獨立項目）
5. **隱藏地下城規則**：以後「開出隱藏」= 100% 寶箱族（不會再有「隱藏幽冥系」這種組合）。
6. **一般（非隱藏）地城**：每場戰鬥 5% 機率讓其中一隻怪換成寶箱族，當驚喜彩蛋（沿用一般族系的獎勵，不套用寶箱族專屬豐厚倍率——彩蛋的價值在於「遇到寶箱族視覺驚喜」本身，若同時疊加豐厚獎勵會讓一般地城的期望值意外暴增，此點若使用者不同意可回饋調整）。

## 已確認的技術現況（讀 code 得出）

- `monsterData.js` 的 `FAMILY_KEYS`（`drawMixedMonsterPool`/`drawExpeditionBoss` 隨機抽怪用）寫死排除 `treasure`。
- `dungeonExcavation.js` 有 3 處各自寫死的 `FAMILIES` 陣列（`claimAutoDig`/`revealExcavation`/`useDungeonScroll`），**只有 `revealExcavation`（練箭挖掘來源）真的會擲出 `isHidden:true`**（另外兩個來源固定寫死 `isHidden:false`），所以只需要改這一處的 family 選取邏輯。
- 地下城的「整趟遠征主題 family」目前只決定 Boss 與地城命名/首殺廣播文案；樓層 1、2 的一般怪物池（`drawFloorMonsters`→`drawMixedMonsterPool`）目前完全不看主題 family，永遠是 6 族隨機混池——若隱藏地下城要做到「全部都是寶箱族」，樓層 1、2 的怪物池也要跟著改，不能只換 Boss。
- **遠征模式（`expeditionMode`）完全略過逐怪物的 `rollCoins`/`rollMaterialDrops` 個別掉落**（見上一個「組隊遠征穩定性」任務的調查），實際獎勵來自 run 結束時的 `calculateExpeditionRewards({difficultyTier, floorsCleared, won})`——這是純 tier 對照表，不分族系。而隱藏地下城 100% 從 `dungeonExcavation.js` 產生、100% 走遠征系統，所以「寶箱族獎勵更豐厚」必須讓 `calculateExpeditionRewards`（或新的姊妹函式）**依 family 加成**，而不是去改 `rollCoins`/`rollMaterialDrops`（那套只有非遠征模式的舊系統在用）。
- 舊系統（非遠征，`DungeonBattleRoom.jsx` `expeditionMode=false`）路徑會用到 `rollCoins`/`rollMaterialDrops`——一般地城 5% 彩蛋機率換成寶箱族時，若剛好是走這條舊路徑，也需要讓這兩個函式對 `monster.family==="treasure"` 給提高的掉落（本任務一併處理，避免彩蛋出現時完全沒有對應的加成獎勵）。

## Requirements

1. `monsterData.js`：
   - 新增 6 隻「真」寶箱怪（`id` 例如 `treasure_1_real`~`treasure_6_real`），ATK 接近 0、DEF 高於同階假怪。
   - 既有 `treasure_1~6` 標記為「假」（不改 id，避免動到既有引用；可加註解/新增 `isFake:true` 之類欄位供區分，不強制）。
   - 新增寶箱王 2 隻（小King、大King），家族 `treasure`，另加一個標記區分王與一般寶箱怪（例如沿用既有 `tier` 概念或新增欄位，設計時再定）。
   - 新增 `drawTreasureMonsterPool(count, tier)`：只從寶箱族抽（真假隨機混）。
   - 新增 `drawTreasureKing(difficultyTier)`：`difficultyTier<=3` 回小King，`>=4` 回大King。
   - `drawMixedMonsterPool`：加 5% 機率把其中一個抽選結果換成同階寶箱族怪物（真假隨機）。
   - `drawFloorMonsters`：接受 `options.family==="treasure"` 時，樓層 1、2 的怪物池也改用 `drawTreasureMonsterPool`（不再呼叫標準 6 族混池），王房改用 `drawTreasureKing`。

2. `dungeonExcavation.js::revealExcavation`：`isHidden` 擲出 true 時，`family` 直接指定 `"treasure"`（不再走隨機 6 族），`boss` 改呼叫 `drawTreasureKing(difficulty)`。`claimAutoDig`/`useDungeonScroll` 不用改（本來就不會產生隱藏地城）。

3. `expeditionDb.js::calculateExpeditionRewards`：加 `family` 參數，`family==="treasure"` 時套用獨立的豐厚倍率（金幣/材料/經驗值倍率各自可調，經驗值幅度小於金幣/材料）。呼叫端（`DungeonExpedition.jsx`/`TeamExpeditionBattle.jsx`）補上傳入 `family`。

4. `lootTable.js`（或 `DungeonBattleRoom.jsx` 呼叫處）：`rollCoins`/`rollMaterialDrops` 對 `monster.family==="treasure"` 給提高的掉落，供非遠征模式路徑的一般地城彩蛋使用。

5. UI 顯示：`monsterData.js` 的 `FAMILIES.treasure` 標籤/圖示已存在，寶箱王另外需要在 `TIER_LABEL` 或戰鬥畫面上有王等級的視覺區分（比照其他族系王房呈現方式，不需要新設計系統，沿用既有 boss variant 樣式）。

## Acceptance Criteria

- [ ] 隱藏地下城 100% 是寶箱族（樓層 1、2、王房全部是寶箱族怪物），不再出現混族的隱藏地城。
- [ ] 真寶箱怪 ATK 接近 0，戰鬥中幾乎不會受到反擊傷害；假寶箱怪維持既有數值需要正常應戰。
- [ ] 寶箱族的遠征結算金幣/材料/經驗值明顯高於一般族系同難度（金幣/材料倍率大於經驗值倍率）。
- [ ] 低階隱藏地城（T1-T3）王房是小King，高階（T4-T6）是大King。
- [ ] 一般非隱藏地城仍以 6 族為主，只有低機率（5%）出現寶箱族怪物彩蛋。
- [ ] `CI=true npm run build` 成功。

## Notes

- 符文功能解鎖是獨立項目（使用者已提出但明確排在後面），本任務只需要讓寶箱王掉落符文道具本身，不用管符文的使用介面。
- 「新系統藥水無法使用」是獨立 bug，不在本任務範圍。
- 3倍金幣/5%機率/低高階King分界都是提案的起點數字，實作時直接採用，使用者事後在遊戲內試玩覺得數值不對可以再回饋調整（不需要現在逐一確認每個數字）。
