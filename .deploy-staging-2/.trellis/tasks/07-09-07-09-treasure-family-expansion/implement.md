# Implement Checklist

1. `src/lib/monsterData.js`
   - [ ] 新增 6 隻「真」寶箱怪（ATK≈1，DEF 高於同階假的）
   - [ ] 新增 2 隻寶箱王（`isKing:true`）
   - [ ] `drawTreasureMonsterPool(count, tier)`
   - [ ] `drawTreasureKing(difficultyTier)`
   - [ ] `drawMixedMonsterPool` 加 5% 寶箱族彩蛋
   - [ ] `drawFloorMonsters` 支援 `options.family==="treasure"` 全樓層走寶箱池+王

2. `src/lib/dungeonExcavation.js::revealExcavation`
   - [ ] `isHidden` 時 `family` 強制 `"treasure"`，`boss` 用 `drawTreasureKing`
   - [ ] import `drawTreasureKing`

3. `src/lib/expeditionDb.js::calculateExpeditionRewards`
   - [ ] 加 `family` 參數 + 寶箱族倍率（金幣/箭露×3，經驗×1.3）

4. `src/components/dungeon/DungeonExpedition.jsx` / `TeamExpeditionBattle.jsx`
   - [ ] 呼叫 `calculateExpeditionRewards` 處補 `family`
   - [ ] 王房通關（`isTreasureRun` 且 boss room）加碼材料/寶箱/符文物品獎勵

5. `src/components/dungeon/DungeonBattleRoom.jsx`
   - [ ] `handleClaimSelf` 非遠征模式：`monster.family==="treasure"` 時 coins×3

6. 驗證
   - [ ] `CI=true npm run build` 成功
   - [ ] 更新 changelog + quick-ref
