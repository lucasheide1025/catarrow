# 地下城圖鑑收藏品掉落回歸調查

## 可重現訊號

暫時測試以 `createExpeditionKillLoot()` 模擬新遠征怪物擊殺，並核對寶藏房五個硬編碼珍藏品 ID 是否存在於 `COLLECTIBLE_MAP`。

結果：

- 怪物擊殺獎勵沒有 `collectibles` 欄位。
- `treasure_gem`、`golden_feather`、`crystal_skull`、`ancient_coin`、`royal_crown` 五個 ID 全部不存在於地下城圖鑑。
- 暫時測試共 6 項失敗，已在取得證據後刪除，未留下診斷程式。

## 根因

1. 舊地圖戰鬥流程 `DungeonBattleRoom.jsx` 會用 `rollFamilyDrop()` / `rollBossDrops()` 產生並以 `addCollectibles()` 寫入收藏品。
2. 新單人遠征 `DungeonExpedition.jsx` 與新組隊遠征 `TeamExpeditionBattle.jsx` 的一般怪物擊殺改走 `createExpeditionKillLoot()`，只建立材料箱、金幣箱與擊殺摘要，沒有呼叫收藏品掉落規則。
3. 新遠征目前只有首通紀念章仍會呼叫 `addCollectibles()`，因此玩家仍可能看到首通品，但一般、稀有與頭目收藏品來源實際中斷。
4. 寶藏房自行建立五種 `extraItem`，畫面會顯示且程式會寫進 `dungeonCollectibles`，但 `DungeonDex` 以 `COLLECTIBLE_MAP` 為正式目錄；未知 ID 不會成為圖鑑可見項目。

## 修復方向

- 把收藏品掉落抽成新舊地下城共用的純規則，讓單人與組隊新遠征都使用相同族系、房型與難度資料。
- 寶箱房必須從 `FAMILY_COLLECTIBLES[family]` 抽正式圖鑑 ID，不再產生圖鑑外的硬編碼珍藏品。
- 組隊每位玩家獨立判定並個別入帳，避免房主結果錯誤套給全隊。
- 收藏品結果必須進入個人領取／結算畫面，並以一次性領取鍵防止重載重複。
- 建立固定亂數的回歸測試，覆蓋普通怪、精英、寶箱與王房，以及所有產生的 ID 必須存在於 `COLLECTIBLE_MAP`。
