# Implement：世界王六大族改版

## Step 1 — 資料層
- [ ] `worldBossData.js`：`WORLD_BOSSES` 六族既有6隻加 `familyGroup`/`familyTier:"big"`；新增6隻小王（`familyTier:"small"`，數值抓大王 35~45%）；移除 `rTier`／`REWARD_TIER_BY_RTIER`／`getRewardTier` 裡對 `rTier` 的依賴。
- [ ] 新增 `DROP_TABLE_BY_CATEGORY`／`getDropCategory(boss)`（依 design.md 數值）。
- [ ] `getRewardByBossKey`/`REWARD_TABLE`/`getRewardTier` 這一整套 5 檔獎勵系統確認是否還需要保留（它是「均分保底獎勵」base/rank1 那部分，跟這次新增的 `DROP_TABLE_BY_CATEGORY` 是互補而非取代——保底金幣/寶箱沿用舊系統，比例貨幣/寶箱/王卡走新系統）。
- [ ] 新增 `WB_TROPHY_MAP`（48件，lastHit+top3 ×24隻）。
- 驗證：`Object.keys(WORLD_BOSSES).length === 24`。

## Step 2 — 世界王卡
- [ ] `worldBossCards.js` 確認 `WB_CARDS` 自動長出 24 張（依賴 Step1 的 `WORLD_BOSSES`，程式邏輯不用改）。
- 驗證：`Object.keys(WB_CARDS).length === 24`。

## Step 3 — 美術資產 fallback + GPT 提示詞
- [ ] `WorldBossSVG.jsx`：`PIXEL_MAP` 6個小王 key 指向對應大王的 pixel 函式。
- [ ] 新建 `docs/second_brain/worldboss-small-boss-prompts.md`：6隻小王的完整生圖提示詞。
- 驗證：手動檢查 `WorldBossSVG bossKey="ghost_boss_small"` 在無 webp 時能正確 render 出鬼怪族大王的像素圖。

## Step 4 — 掉落與結算邏輯（`worldBossDb.js::claimWorldBossKillReward`）
- [ ] 依 `getDropCategory` 分支處理四類掉落（family_small/family_big/cat/coach）。
- [ ] 比例貨幣：`totalDamage` 現場計算、`myShare` 各項計算＋下限1。
- [ ] 寶箱：金幣寶箱（`makeCoinChest`）／材料寶箱（`CHEST_TYPES` T1~T6 對照）／貓貓箱／咪咪箱／怪物卡包（`addCardPack`）依 `dropCfg` 組裝。
- [ ] 世界王卡：`addWorldBossCard` 失敗且 `reason==="已擁有此王卡"` → 改發金幣。
- [ ] `addCatBond`：讀取結算當下 `profile.equippedCat.catId`，有裝備才呼叫，沒裝備改發等值金幣。
- [ ] 排名加成（1st/2nd/3rd/尾刀）：依 PRD 表格數值疊加發放，跟均分獎勵分開的區塊。
- [ ] 收藏獎盃：`isLastHit`/`isTop3` 時 `increment(member.dungeonCollectibles.{trophyId})`。
- 驗證：針對四類各挑一隻王模擬呼叫（可用暫時測試腳本或手動在瀏覽器 console 呼叫），確認回傳的 summary 內容符合 PRD 掉落表。

## Step 5 — 成就圖鑑
- [ ] `achievementDex.js`：迴圈產生 48 個獎盃成就（`cat:"special"`）。
- 驗證：`npm run build` + 手動檢查 `AUTO_ACHIEVEMENTS` 新增數量。

## Step 6 — 後台
- [ ] `AdminWorldBoss.jsx`：移除「前3名」分頁與相關欄位。
- [ ] 新增「三大類掉落設定」可調區塊，存 `sysConfig/worldBossDropTable`（比照 `worldBossSpawn` 模式：`getWorldBossDropConfig`/`saveWorldBossDropConfig`）。
- [ ] Boss 選單（建立活動/發放王卡）補上 `familyTier` 標籤顯示。
- 驗證：後台手動檢查 24 隻王都能選、掉落設定存讀正常。

## Step 7 — 回歸測試
- [ ] `npm run build` 全綠。
- [ ] 教練切換射手模式，開世界王頁面/後台確認不空白。
- [ ] 確認舊有 12 隻王（含既有教練/貓貓）的既有數值/行為沒被這次改動破壞。

## Step 8 — 收尾
- [ ] `docs/second_brain/changelog.md`＋`quick-ref.md` 更新，同步 Obsidian。
- [ ] 依使用者指示 commit（不主動 push，等待明確指示）。

## Rollback
Step 1（資料層）壞掉會牽動全部——資料層先獨立驗證（build + 手動印出 WORLD_BOSSES keys 數量）過了再進 Step 4。Step 4（結算邏輯）風險最高，改動前先看一次現有 `claimWorldBossKillReward` 全文，用大範圍 diff 一次寫完再測，避免分次改動導致中間態邏輯矛盾。
