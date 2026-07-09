# 📝 changelog — 變更日誌
> 每次功能完工後由 Claude 自動寫入。格式：日期 / 改了什麼 / 為什麼 / 踩坑提醒

---

## 2026-07-09（世界王自動刷新天數改為可設定，預設鎖定30天）

- `worldBossDb.js`：新增 `getWorldBossSpawnConfig()`/`saveWorldBossSpawnConfig(days, operatorId)`，存在 `sysConfig/worldBossSpawn.durationDays`（沿用既有 `sysConfig` collection 規則，讀取任何登入者可，寫入僅 admin，不用改 `firestore.rules`）。`autoSpawnWorldBoss()` 原本寫死 `durationDays: 7`，改成讀這個設定，預設值 30（等於 `BOSS_DURATION_MAX_DAYS` 上限）。
- `AdminWorldBoss.jsx`「建立活動」分頁新增一張獨立卡片可以調整這個天數（跟下面手動建立活動用的「持續天數」欄位是分開的兩件事，不要混淆——一個是系統自動開王用，一個是教練手動開王時單次用）。
- `CI=true npm run build`：Compiled successfully。

---

## 2026-07-09（世界王後台補完：獎勵表單接上分級建議 + 直接移除功能 + 自動刷新機制確認）

延續世界王 Phase 2 的部署前確認，發現後台「建立活動」表單完全沒用到 Phase 2 新寫的 5 檔獎勵分級系統。

### 改了什麼
- `AdminWorldBoss.jsx`：新增 `rewardFromBossKey(key)`，選王時（非隨機模式）用 `useEffect` 自動把 `getRewardByBossKey(bossKey)` 的建議值帶進表單（教練仍可手動覆蓋，另外加了「套用建議值」按鈕可以隨時重置），並在獎勵區塊標題旁顯示目前選中的王屬於哪個建議檔次（入門/低/中/高/頂級）。
- 新增「🗑️ 直接移除」動作：`forceEndWorldBossEvent(eventId)` 原本是完全沒有呼叫點的死函式，改成真正用途——狀態改成 `"cancelled"`（不同於「強制結束」用的 `expireWorldBossEvent`／`"expired"`，不發任何獎勵、不寫入 `worldBossHistory`），給教練在建錯王/測試用王時可以直接撤掉。`subscribeLatestWorldBoss` 補上排除 `"cancelled"` 狀態。
- 確認 `autoSpawnWorldBoss()`（玩家進世界王頁面時觸發的每日自動刷新）：`WORLD_BOSS_KEYS` 是動態算的，自動涵蓋新的 18 隻王，沒呼叫點需要改；未傳 `reward` 給 `createWorldBossEvent` 時會 fallback 到 `getRewardByBossKey`，所以自動刷新本來就吃得到新的 5 檔分級系統。**但選王邏輯本身是均勻隨機**（排除上一隻，其餘 17 隻等機率），完全沒有利用 R1~R6 的難度排序做漸進式出王——這是沿用舊有邏輯，不是這次改壞的，但如果之後想要「由弱到強」的世界王節奏，需要另外設計選王權重，目前沒做。

### 為什麼
- 使用者部署前主動確認後台是否跟上新設計，抓到「手動建立活動」這條路徑完全繞過新的分級系統——教練手動開王時獎勵永遠是同一組寫死的值，跟選哪隻王無關，等於 Phase 2 的分級設計在最常用的建立方式裡形同虛設。

### 踩坑提醒
- 世界王事件現在有 4 種終止狀態：`defeated`（擊殺）、`expired`（超時，發安慰獎）、`cancelled`（教練直接移除，不發獎勵，新增）、以及理論上還沒被排除的其他未來狀態——任何新增「排除非活躍事件」的查詢（比照 `subscribeLatestWorldBoss`）都要記得把 `cancelled` 也排除掉，不能只排 `expired`。
- `mimiBoxes` 欄位（後台表單有，但 `claimWorldBossKillReward` 從沒讀過）仍然是死欄位，這次沒有動，發現只是順便記錄。
- 世界王卡的擊殺掉落機率（`WB_CARD_DROP_CHANCE=0.10`）跟世界秘寶箱內容數值都還是寫死在 `worldBossDb.js`/`itemData.js`，後台目前看不到也調不了，這次也沒動，只是一併記錄成已知現況。

### 驗證
- `CI=true npm run build`：Compiled successfully。

---

## 2026-07-09（世界王 Phase 2：18隻王重製 + 專屬寶箱/卡片 + 卡片系統裝備改版）

Trellis 任務 `07-09-worldboss-phase2-cards`，PRD/design/implement 見 `.trellis/tasks/07-09-worldboss-phase2-cards/`。

### 改了什麼
- **世界王資料**（`worldBossData.js`）：貓貓系列從 3 隻通用貓改成 9 隻真貓（`cat_daming`~`cat_diandian`，讀 `catData.js::CATS`+`CAT_SKILL_GROUPS`），六大族新增 `rTier:1~6`（poison→forest→exam→ghost→office→western 難度遞增），教練系列數值上調成隱藏王定位。`rewardByHP()` 改成 `getRewardTier()`+5檔（entry/low/mid/high/top）取代原本3檔 HP 門檻寫死判斷。`WorldBossSVG.jsx` 新增 `CatGenericPixel`（讀 `catData.js` 的 `palette` 上色），取代原本寫死的 3 隻貓像素圖，9 隻貓共用一套版型。
- **卡片系統核心**（`monsterCards.js`）：新增 `worldboss` 卡片階級（固定 25 點加成、無升星）、`resolveEquippedCards()`（相容新舊 `equipped` 格式的統一解析函式）、`calcEquippedBonus()` 回傳值擴充 `dmgBonusPct/dmgReducePct/healBonusPct`（僅 worldboss 卡才有，每張 +3%）。裝備上限從「總共5張任意」改成「怪物卡 HP/ATK/DEF 各3張（`MAX_EQUIPPED_PER_STAT`）+ 世界王卡獨立3張（`MAX_WB_EQUIPPED`，不分屬性）」。
- **世界王卡定義**（新檔 `worldBossCards.js`）：18張，六族/貓貓卡固定屬性（沿用 `FAMILY_STAT`/分組），教練卡開卡時玩家自選屬性。
- **Firestore 層**（`db.js`）：`cardCollections/{id}` 新增 `wbCards`（世界王卡池，跟 `cards` 怪物卡池分開）；`equipCard`/`unequipCard` 簽章改成 `(memberId, key, source)`，`source==="wb"` 走獨立3格上限、`source==="monster"` 走per-stat 3格上限；新增 `addWorldBossCard`（一隻王一張，重複略過）、`setWorldBossCardStat`、`setActiveTitle`/`clearActiveTitle`（稱號＝從已裝備王卡選一張的 `title` 對外顯示）、`adminGrantWorldBossCard`（後台限定發放，不進任何掉落池）。
- **寶箱**（`itemData.js`）：新增 `wb_relic`（世界秘寶箱，教練/貓貓王掉落，開出金幣+`wb_relic_shard`世界王專屬材料，新增進 `monsterMaterials.js`）。六大族王沿用既有 `gold/epic/mythic` 家族寶箱，`chest.family` 用新的 `WB_FAMILY_TO_DUNGEON_FAMILY` 對照表轉成地城6族key（`poison→insect, forest→mountain, office→workplace, western→temple`，`ghost/exam`同名）。
- **卡片掉落機制**（`worldBossDb.js::claimWorldBossKillReward`）：世界王專屬卡片改成**擊殺結算當下直接判定機率**（`WB_CARD_DROP_CHANCE=0.10`）直接呼叫 `addWorldBossCard`，不用開箱，符合「卡片只從世界王身上掉」的需求；寶箱另外照六族/教練貓貓分支發放。
- **傷害公式**（`damage.js`）：`calcRoundDamage`/`calcWorldBossArrowDmg` 加可選 `dmgBonusPct` 參數；`calcStandardCounter`/`calcPartyCounter`/`calcWorldBossCounter`/`calcDungeonCounter` 加可選 `dmgReducePct` 參數，預設0（無加成，不影響既有呼叫點）。
- **戰鬥端接線**：`WorldBossAttack.jsx` 完整串接（傷害/減傷都套用）；`partyDb.js::processPartyRound`／`PartyBattleRoom.jsx` 完整串接（含治療加成，`updateBattleMemberStats` 新增 `wbBonus` 參數寫入 `members.{id}.wbBonus`）；`dungeonDb.js::processDungeonRound` 也接了 `m.wbBonus` 讀取（傷害/減傷/治療），但**目前是死接線**——見下方踩坑提醒。
- **UI**：`CardCollection.jsx` 全面重寫——已裝備區改三欄（HP/ATK/DEF各3格）+世界王卡獨立3格列、篩選籤改「全部/HP/ATK/DEF/世界王」、卡片列表改九宮格小卡片、世界王卡用全息動態邊框CSS+底部稱號小字、可從已裝備王卡設定「使用中稱號」。新增 `WorldBossCardBadge.jsx`（純視覺閃亮徽章），掛在 `WorldBossAttack.jsx`/`PartyBattleRoom.jsx`/`DungeonBattleRoom.jsx` 三處玩家名牌旁（裝備任一王卡才顯示）。`AdminWorldBoss.jsx` 新增「發放王卡」分頁（選會員+選王卡+可選屬性→發放，不進任何玩家掉落池）。

### 為什麼
- 貓貓系列改真貓：使用者要求世界王要對應道館真實養的九隻貓，不能沿用舊的3隻通用貓皮。
- 卡片裝備改「per-stat 3張」+「世界王卡獨立3格」：使用者明確定案，怪物卡跟世界王卡是分開的收藏池，但裝備欄位只有世界王卡自己獨立（不佔怪物卡的 HP/ATK/DEF 格），這樣才問得出「那稱號?」——因為世界王卡欄位是獨立的，才會需要一個「從裝備中選一張當稱號」的機制。
- 卡片只從世界王身上掉：使用者明確反對「打贏王→掉寶箱→開箱才可能出卡」這種間接掉落，要求擊殺當下直接判定，寶箱只保留金幣/材料用途。
- 世界王卡被動效果（±3%/張封頂9%）：使用者說「要有功效才有意義」，不能只是換皮/换數字，所以額外接了 `dmgBonusPct/dmgReducePct/healBonusPct` 進三套戰鬥系統的傷害/減傷/治療計算。

### 踩坑提醒（下次接手務必先看這段）
- **（已補上，見下方「追加修正」）** 原本地下城系統完全沒有串接怪物卡片——已修好，見「追加修正（同日）」。
- `equipped` 欄位資料格式從「字串陣列（monsterId）」改成「物件陣列（`{key,source}`）」是破壞性變更，採**漸進式相容讀取**（`resolveEquippedCards()`/`normalizeEquipped()` 兩處都判斷 `typeof item === "string"`），沒有寫遷移腳本。舊資料完全相容，新裝備一律寫新格式。
- 這次順手修掉一個潛在regression：`equipped` 格式改變後，`CouncilHall.jsx`/`PartyBattleRoom.jsx`/`MemberHome.jsx`/`MonsterBattle.jsx`/`WorldBossAttack.jsx` 五處原本各自手刻 `equipped.map(id=>cards[id])` 的邏輯全部需要改用新的 `resolveEquippedCards()`，否則卡片加成會靜默歸零。**其中 `CouncilHall.jsx` 原本的寫法本來就是錯的**（直接把 `equipped` 陣列的字串傳進 `calcEquippedBonus`，沒有先轉成卡片物件），順手一併修正。
- `AdminWorldBoss.jsx` 有個 pre-existing 的 React hooks 順序問題：`if (showBattle) return <WorldBossLobby/>` 這個提早 return 寫在一堆 `useState`/`useEffect` 宣告**之前**，理論上切換 `showBattle` 會觸發「Rendered fewer hooks than expected」。這次新增的手動發卡功能相關 hooks 也放在這個 return 之後（跟現有其他 hooks 位置一致），**沒有引入新問題但也沒有修**，因為這是完全獨立的既有問題，不在這次任務範圍內。

### 驗證
- `CI=true npm run build`：Compiled successfully，無編譯錯誤。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後實測：貓貓王正確顯示9隻＋像素圖上色正確、擊殺六族王掉對應族寶箱、擊殺教練/貓貓王掉世界秘寶箱、擊殺後有機率直接拿到王卡、卡片頁三欄裝備格運作正常、世界王卡全息邊框+稱號設定、組隊/世界王/地下城三套戰鬥系統裝備世界王卡都確實影響傷害數字。

### 追加修正（同日）：補上地下城完全沒串接卡片系統的缺口
使用者確認要修，順著地下城的實際資料流（`buildExpeditionMemberData` → `dungeonRooms/{id}.members.{id}` → `processDungeonRound` 讀 `m.atk/m.wbBonus`）一路補齊：
- `expeditionMemberData.js::buildExpeditionMemberData(profile, cardBonus)`：新增 `cardBonus` 參數（`calcEquippedBonus(resolveEquippedCards(...))` 結果），把 HP/ATK/DEF 卡片加成併入基礎值，並把 `dmgBonusPct/dmgReducePct/healBonusPct` 包成 `wbBonus` 欄位一起回傳。
- `expeditionDb.js::createExpeditionBattleRoom`／`expeditionTeamDb.js::createTeamExpeditionRoom`/`joinTeamExpeditionRoom`：member 物件都加上 `wbBonus: memberData?.wbBonus || null`。`syncTeamExpeditionMembers`（跨樓層同步）本來就是 `{...member, ...}` 展開舊物件在前，不用改就會自動帶著 `wbBonus` 走。
- `TeamExpeditionBattle.jsx`：找到一處「從房間 `members` 重新組裝陣列丟給 `createTeamExpeditionBattleRoom`」的地方**漏掉了 `wbBonus` 欄位**（這是最容易漏、也最難發現的一環——組隊模式進戰鬥房間前會重新映射一次成員陣列，任何新增欄位都要記得在這個映射也加一次）。
- `DungeonLobby.jsx`（組隊）／`DungeonExpedition.jsx`（單人）：各自新增 `subscribeCardCollection` 訂閱＋算 `cardBonus`，呼叫 `buildExpeditionMemberData` 時帶入。單人模式額外把 `wbBonus` 存進 `playerState`（跨樓層持續的本地狀態），每次建立戰鬥房間時用 `playerState.wbBonus` 覆蓋（因為裝備中途不會變，不用每層重算）。
- `CI=true npm run build`：Compiled successfully。

**教訓**：地下城/遠征系統有 3 條平行的「建立戰鬥房間」路徑（單人 `createExpeditionBattleRoom`、組隊建立 `createTeamExpeditionRoom`+`createTeamExpeditionBattleRoom`、舊版未使用的 `dungeonDb.js::createDungeonRoom`），任何要塞進 `room.members.{id}` 的新欄位都要**沿著全部路徑**一路追過去確認每個「重新組裝 member 物件」的地方都有帶到，漏一個環節就會在特定情境下（比如剛好走組隊模式）悄悄失效。

---

## 2026-07-09（寶箱族擴充：14隻怪物 + 隱藏地下城改為專屬寶箱族農場）

Trellis 任務 `07-09-07-09-treasure-family-expansion`，PRD/design/implement 見 `.trellis/tasks/07-09-07-09-treasure-family-expansion/`。

### 改了什麼
- `src/lib/monsterData.js`：
  - 新增 6 隻「真」寶箱怪（`treasure_1_real`~`treasure_6_real`，ATK=1 幾乎不會反擊，DEF 比同階「假」的更高）；既有 `treasure_1~6` 維持不變，視為「假」（有正常 ATK，需要正常應戰）。
  - 新增寶箱王 2 隻（`treasure_king_small`/`treasure_king_big`，`isKing:true`）。
  - 新增 `drawTreasureMonsterPool(count, tier)`（純寶箱族抽池，真假隨機混，排除王）、`drawTreasureKing(difficultyTier)`（≤3出小王，≥4出大王）。
  - `drawMixedMonsterPool`（一般 6 族混池）加 5% 機率把其中一個抽選結果換成同階寶箱族怪物，當一般地城的驚喜彩蛋。
  - `drawFloorMonsters` 支援 `options.family==="treasure"`：三層樓全部走寶箱族抽池+寶箱王，不再混一般 6 族。
- `src/lib/dungeonExcavation.js::revealExcavation`：`isHidden` 擲出 true 時，`family` 直接指定 `"treasure"`（不再隨機 6 族），`boss` 改用 `drawTreasureKing`。`claimAutoDig`/`useDungeonScroll` 本來就不會產生隱藏地城，沒有改。
- `src/lib/expeditionDb.js::calculateExpeditionRewards`：加 `family` 參數，`family==="treasure"` 時金幣/箭露 ×3、經驗值 ×1.3（經驗值加幅刻意較小，避免打寶箱地城變成練等最佳解）。`settleAbandonedExpedition` 也一併補上 `family`。
- `DungeonExpedition.jsx`/`TeamExpeditionBattle.jsx`：呼叫 `calculateExpeditionRewards` 補 `family`；王房通關（`won && family==="treasure"`）額外加碼金幣（300+難度×100）、3 個傳說級材料（借用既有 6 族材料池的 legendary 稀有度池，沒有另外新建寶箱族專屬材料鏈）、一個對應難度的金幣寶箱、一份符文掉落（`rollRuneDrop`/`addRune`，符文物品本身可以拿到，但符文的「使用」介面目前仍是隱藏的，那是另一個獨立項目）。組隊模式的王獎勵掛在 `handleFinish()`（每人各自呼叫自己的份，避免上一個任務才修好的「幫別人寫入」權限問題重演）。
- `DungeonBattleRoom.jsx::handleClaimSelf`（非遠征模式路徑）：`monster.family==="treasure"` 時金幣 ×3，讓一般地城 5% 彩蛋也有對應的加成獎勵。

### 為什麼
- 使用者明確定調：「隱藏地下城本身的用意並不是擊倒而是獲得大量獎勵的地方」——這不是戰鬥挑戰內容，是獎勵農場，所以核心改動集中在「讓隱藏地城 100% 是寶箱族」+「寶箱族的獎勵明顯高於一般族系」，而不是設計新的戰鬥機制。
- 真假定義（使用者原話）：「真的沒有攻擊力好打倒，假的定義是他就真的是怪物，所以會反擊有傷害」——用既有的 `applyVariant`/ATK 數值機制就能表達，不需要新的戰鬥引擎特判邏輯（ATK 接近 0 的怪物在既有傷害公式下自然幾乎不會反擊）。
- **遠征模式完全略過逐怪物掉落**（`handleClaimSelf` 的 `expeditionMode` 分支整段跳過，見上一個「組隊遠征穩定性」任務的調查），而隱藏地城 100% 走遠征系統，所以「寶箱族獎勵更豐厚」必須讓 `calculateExpeditionRewards`（run 結算層）依 family 加成，改 `rollCoins`/`rollMaterialDrops`（怪物掉落層）對隱藏地城完全沒有作用——這兩層要分開處理，是本次最容易搞混的地方。

### 踩坑提醒
- **樓層 1、2 的一般怪物池本來完全不看「整趟遠征主題 family」**，永遠是 6 族隨機混池（只有王/Boss 才看 family）——這是隱藏地下城要做到「全部都是寶箱族」時最容易漏掉的地方，`drawFloorMonsters` 現在三層樓都要判斷 `options.family==="treasure"`。
- 寶箱王材料獎勵**沒有**建立寶箱族專屬的材料鏈（`monsterMaterials.js` 的材料是依 6 族 `family` 建的，寶箱族沒有對應的 `treasure_m2~m6`），改成從既有材料池篩 `rarity==="legendary"` 隨機發 3 個，避免發出不存在的材料 id 造成庫存出現垃圾欄位。若之後想要寶箱族專屬材料外觀，需要另外設計。
- `treasure_king_small`/`treasure_king_big` 用既有 `tier:"boss"`/`tier:"mythic"` 掛欄位，靠新增的 `isKing:true` 排除在一般寶箱怪抽池外——**如果之後要再新增寶箱族怪物，記得排除條件要一起檢查 `isKing`**，否則王可能意外被抽進一般樓層。
- 一般地城 5% 彩蛋**刻意不套用**寶箱族的豐厚倍率（只是視覺驚喜換皮，非遠征模式走 `rollCoins`×3 已經有一點加成），避免一般地城的期望報酬意外暴增。
- 符文「使用」介面解鎖跟「新系統藥水無法使用」都是**獨立項目**，本次沒有處理，王掉落的符文物品本身能正常拿到、進背包，只是還不能用。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後實測：練箭挖掘刷出隱藏地城時三層樓都是寶箱族、王房正確依難度出小王/大王、結算畫面金幣數字明顯高於一般地城同難度、一般地城偶爾（不用刻意驗證機率）能遇到寶箱族怪物彩蛋。

### 追加修正（同日）
- `drawTreasureMonsterPool` 原本內部寫死套用 `applyVariant(monster,"normal")`，忽略了跟一般 6 族一樣的樓層強弱分層（第1層弱化/第2層普通+精英強化/第3層強化+王）。改成跟 `drawMixedMonsterPool` 一樣吃 `variant` 參數，`drawFloorMonsters` 呼叫處三層樓分別傳 `"weak"/"normal"/"strong"`，寶箱族現在也有跟其他族系一致的強弱分層。
- **DEF 全面調降**：原本的 DEF 是一般 6 族同階（以鬼怪族 14/24/40/68/105/155 為參考）的 2~5 倍，對照 `damage.js` 的傷害公式（`base = 8 + ATK×0.7 + 分數×1.2 − DEF×0.35`，下限 1 傷/箭）會導致一般程度射手幾乎每箭被壓到最低傷害，高階寶箱怪變成要射幾百箭。調降到跟一般族系同量級、只是略高一截：假 DEF 15/30/50/85/130/190，真 DEF 20/35/60/95/150/220。ATK/HP 數值不變。
- **寶箱王改成小王/大王各自都有 T1~T6 強度曲線**：原本 `drawTreasureKing` 是「T1-3 固定用一組小王數值、T4-6 固定用一組大王數值」，導致 T1 玩家碰到的小王強度跟 T3 玩家一樣，對 T1 太強。改成 `treasure_king_small_1~6`/`treasure_king_big_1~6` 共 12 隻，每隻對應一個難度階級，`drawTreasureKing(difficultyTier)` 先照難度選階級、再 50/50 隨機選小王或大王系列。`isKing:true` 標記維持不變，`drawTreasureMonsterPool` 排除邏輯不受影響。

---

## 2026-07-09（組隊/單人遠征穩定性：斷線回房+畫面卡死+進度不遺失）

Trellis 任務 `07-09-07-09-expedition-stability`，PRD/design/implement 見 `.trellis/tasks/07-09-07-09-expedition-stability/`。

### 改了什麼
- `src/components/dungeon/DungeonBattleRoom.jsx`：`expeditionMode===true` 時隱藏戰鬥畫面內的「離開」快速按鈕（原本無確認對話框，且被 `TeamExpeditionBattle.jsx`/`DungeonExpedition.jsx` 直接接到全隊解散/移出房間的邏輯，完全無視 `{preserve:true}` 訊號）。
- `src/lib/expeditionDb.js` 新增 `setActiveExpeditionProgress`/`clearActiveExpeditionProgress`/`settleAbandonedExpedition`：把單人遠征進度（`family`/`difficultyTier`/`isHidden`/`floorsCleared`）持久化到 `members/{id}.activeExpedition`，中斷結算沿用既有 `calculateExpeditionRewards(...,won:false)` 公式，**沒有改任何獎勵數值**。
- `src/components/dungeon/DungeonExpedition.jsx`：進入/樓層推進時同步 `activeExpedition`；正常結算 (`handleFinish`) 與確認放棄 (`handleAbandon`) 都會清除它。
- `src/components/dungeon/DungeonLobby.jsx`：新增單人遠征復原 banner（偵測 `profile.activeExpedition`，只有「結算並領取」一個按鈕，**不做**地圖位置復原，只做部分獎勵結算），跟既有的組隊 `reconnectRoom` banner 並列。
- `src/components/dungeon/TeamExpeditionBattle.jsx`：新增卡死保護——房主端 `activeRoomId` 卡住 20 秒自動清除協調欄位；非房主端等待 20 秒無變化顯示提示+「暫時返回大廳」按鈕（呼叫 `onComplete`，**不**呼叫 `leaveTeamExpeditionRoom`，不影響隊伍成員資格，之後仍可用既有復原機制連回來）。
- `firestore.rules`：`members` update 白名單新增 `"activeExpedition"`（**需手動貼到 Firebase Console**）。

### 為什麼
- **根因（已讀 code 逐一確認）**：組隊模式其實**本來就有**斷線復原機制（`DungeonLobby.jsx::findReconnectableTeamExpedition`），但被 `DungeonBattleRoom.jsx` 戰鬥畫面裡一個無確認的「離開」按鈕直接打穿——按下去呼叫 `onExit({preserve:true})`，但 `TeamExpeditionBattle.jsx`/`DungeonExpedition.jsx` 把 `onExit` 直接接到 `handleAbandon`，完全無視 `preserve` 訊號：房主誤點=全隊解散，隊員誤點=被移出 `room.members`（一旦被移出，連復原機制都救不回來，因為復原邏輯要求你還在 `members` 裡）。地圖層級的「撤退」按鈕（`GridMapStage`/`BranchStage`）本來就有正確的二次確認，這條路徑完全沒動。
- 獎勵公式 `calculateExpeditionRewards` 本來就支援「沒破關」的部分樓層結算（`floorMult=floorsCleared/3`），**不需要重新設計經濟數值**——真正缺的只是「玩家連不回去結算畫面時，怎麼讓這筆部分獎勵不要憑空消失」，所以整個修法都是持久化+復原，沒有動任何獎勵數字。
- `TeamExpeditionBattle.jsx` 的樓層/事件協調（`activeRoomId`/`roomConfirms`）全部是 `if (!isHost) return`，只有房主能推進，房主卡住時其他隊員點什麼都沒反應——這是「偶爾畫面無法點擊」的成因。單場戰鬥本身（`DungeonBattleRoom.jsx`）已經有 15 秒逾時保護，這次補的是「樓層之間」這一層。

### 踩坑提醒
- **單人遠征刻意不做地圖位置復原**：5×5 迷霧格地圖要精確還原「走到哪一格、開過哪些房間」風險高、範圍大，這次只保證「不會白打」（用既有部分結算公式），不保證能接著原本的探索進度打下去。若之後要做完整地圖復原，是全新的一塊工作。
- **房主永久失聯（host failover）沒有解**：如果組隊遠征房主整個消失不會再回來，地圖推進機制依然會卡住（所有推進都是房主專屬）。這次只做到「非房主可以安全離開畫面、之後能重連」，沒有做「房主轉移」，如果這個情境常發生，需要另開任務設計。
- `activeExpedition` 用 `updateDoc` 整包覆寫（不是 merge），每次樓層推進都是「取代」語意，不是累加。
- 20 秒逾時數字是沿用舊系統 `DungeonBattleRoom.jsx` 既有的慣例值，沒有特別跟使用者確認精確秒數。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做多裝置斷線實測（無瀏覽器環境）；建議上線後找兩個帳號實際跑一次組隊遠征，中途讓非房主裝置斷網確認能重連、讓房主裝置卡住確認 20 秒後其他人畫面恢復可操作。

---

## 2026-07-09（村目標歷史獎勵補發工具）

### 改了什麼
- `src/lib/villageGoalDb.js` 新增 `adminBackfillVillageGoalRewards()`：掃描所有 `status in [completed, expired]` 的村目標，幫尚未 `claimed` 的參與者補發獎勵（`completed` 用 `goal.rewards`，`expired` 用 `CONSOLATION_REWARD`），發完標記 `claimed:true` + `claimedByBackfill:true`。**僅限教練後台觸發**（靠 `isAdmin()` 才能寫入任意會員文件）。
- `src/components/admin/AdminVillageManager.jsx`：「🎯 村目標設定」面板內新增「🎁 補發歷史村目標獎勵」按鈕（不依賴 `activeGoal`，一直可見），點擊後跑一次補發並回報掃描了幾個目標、補發給幾人次。

### 為什麼
- 上一個任務（村目標改自行請領）修好了「以後」的發放，但舊資料的 `villageGoals` 文件從來沒有 `claimed` 欄位，代表過去很可能有玩家沒真的拿到獎勵，需要補發。

### 踩坑提醒
- **已跟使用者明確確認接受的風險**：Firestore 資料完全無法分辨「當初那次是不是剛好教練觸發、已經成功發過」，所以補發是「全部沒 `claimed` 標記的都補發」，可能讓極少數已經領過的人重複拿到一次獎勵。使用者判斷金額小（遊戲內金幣/箭露/扭蛋幣），寧可多發不要漏發，**不要**未來又改成「更精確判斷」而漏掉真正沒領到的人，除非使用者主動要求。
- 函式本身可安全重複執行（已標記 `claimed` 的會被跳過），教練可以隨時多按幾次確認沒漏網之魚。
- `where("status","in",[...])` 是單欄位 `in` 查詢，不需要額外的 Firestore 複合索引。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未實測（無瀏覽器環境）；建議教練登入後台親自按一次「掃描並補發」，確認回報的人次數字合理。

---

## 2026-07-09（村目標獎勵改自行請領，修正一般會員無法收到獎勵）

Trellis 任務 `07-09-07-09-village-goal-reward-claim`，PRD 見 `.trellis/tasks/07-09-07-09-village-goal-reward-claim/`。

### 改了什麼
- `src/lib/villageGoalDb.js`：
  - `completeGoal`/`expireGoal`：移除「觸發者瀏覽器幫全部參與者寫入獎勵」的 for-loop，只標記 `status`+`completedAt`/`expiredAt`，`completeGoal` 保留完成公告。
  - `adminForceCompleteGoal`：同樣移除發獎迴圈，只標記狀態（+`completedByAdmin`），不再跟一般完成流程走不同的發獎路徑。
  - 新增 `claimVillageGoalReward(goalId, memberId)`：參與者用自己的帳號讀目標、驗證資格（有貢獻、狀態已結束、`participants.{memberId}.claimed` 尚未為 true）、寫自己的 `members` 文件（`addCoins`/`addArrowdew`/`addGachaCoins`），再標記 `claimed:true`。
- `src/components/member/VillageGoalBanner.jsx`：訂閱改用 `subscribeLatestGoal`（原本 `subscribeActiveGoal` 只認 active，目標一完成就訂閱不到、banner 消失，永遠沒機會觸發請領）。`status==="active"` 時維持原本 banner 顯示；`completed`/`expired` 時若偵測到自己有未請領的貢獻，自動呼叫 `claimVillageGoalReward`，成功用 `useToast` 跳提示。
- `src/components/admin/AdminVillageManager.jsx`：「強制完成並發獎勵」按鈕文案改成「貢獻者下次登入時會自動領取獎勵」，反映新的非即時發放行為。

### 為什麼
- **根因（已對照 firestore.rules 驗證，非推測）**：`checkGoalStatus()` 由 `VillageGoalBanner.jsx` 每分鐘輪詢、任何會員瀏覽器都可能觸發，觸發後舊版 `completeGoal`/`expireGoal` 在該瀏覽器內迴圈幫「所有參與者」寫入獎勵。但 `firestore.rules:23-38` 的 `members` collection `allow update` 限制「只能改自己的文件（`resource.data.uid==request.auth.uid`）」，寫入別人的 `members` 文件會被拒絕，整段包在 `.catch(()=>{})` 靜默吞掉——只有恰好是教練切學生模式瀏覽（有 `isAdmin()`）時才會真的成功。跟公會懸賞系統已知的坑（見 2026-07-04 交接筆記）是同一種架構限制：專案無 Cloud Functions/cron，所有結算都是 client-triggered，凡是「一人幫多人寫入」的模式都會有這個問題。

### 踩坑提醒
- **這類「client-triggered 幫別人寫入」模式是本專案的系統性風險**，目前已知至少 3 處用過（公會懸賞自動刷新、村目標舊版發獎、地下城 team 領獎前也曾有類似疑慮）。之後若再看到「for...of participants { await addXxx(otherMemberId, ...) }」這種寫法，先假設它在非 admin 觸發時會靜默失敗，優先改成自行請領模式。
- `villageGoals` collection 的 `allow update: if isLoggedIn()` 本來就沒有欄位限制，`claimVillageGoalReward` 寫 `participants.{memberId}.claimed` 不需要改規則。
- 歷史已完成/過期的 `villageGoals` 文件（舊資料沒有 `claimed` 欄位）**沒有補發**，過去很可能有玩家沒真的拿到獎勵；是否要做後台補發工具，待使用者決定。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做多帳號實測（無瀏覽器環境）；建議上線後用兩個不同會員帳號（都非 admin）貢獻同一目標達標，確認兩人都各自拿到獎勵，且重整頁面不會重複入帳。

---

## 2026-07-09（世界王結算系統第一階段：修權限bug+結算畫面顯示獎勵+獎勵均等+紀念品）

Trellis 任務 `07-09-07-09-worldboss-settlement-phase1`。第二階段（R1-R6強度分級、專屬寶箱、六族對應寶箱、專屬卡片）使用者已確認另外排期，不在本次範圍。

### 改了什麼
- `src/lib/worldBossDb.js::distributeWorldBossRewards`：不再迴圈幫全部參戰者寫入獎勵，改成只計算 `top3Ids`（傷害排序前三，訪客排除）寫回事件文件，`rewardDistributed` 語意改為「已定案可請領」。
- 新增 `claimWorldBossKillReward(memberId, eventId)`：參戰者自己呼叫，共同獎勵**統一改用原本 `rank1`（最高檔）**發給每一位真實參戰者（不再依傷害排名分層），另外貢獻前三名/最後一擊拿**紀念品**（卡包/貓貓箱，跟共同獎勵分開發），世界王地下城维持人人都有。標記 `participants.{id}.claimed` 防重複。
- `src/components/worldboss/WorldBossLobby.jsx`：偵測到 Boss 死亡時，除了既有的 `KillScreen`（sessionStorage 防重複顯示）外，同時呼叫 `claimWorldBossKillReward` 領取（用 `claimed` 欄位防重複，不受 sessionStorage 限制）。`KillScreen` 新增「🎁 你的獎勵」區塊，顯示實際拿到的金幣/寶箱/卡包，以及紀念品標示。
- `src/components/admin/AdminWorldBoss.jsx`：「手動發放擊殺獎勵」按鈕文案改成「手動結算定案（供參戰者自行領取）」，反映新的非即時發放行為。

### 為什麼
- 使用者回報「世界王沒有戰鬥結算畫面，玩家沒看到就退出去了」。查證發現：`distributeWorldBossRewards` 由**打出最後一擊的玩家瀏覽器**觸發，內部迴圈幫全部參戰者寫入 `members` 文件，除非最後一擊剛好是教練，否則其他人的獎勵必定被規則擋掉（`.catch(()=>{})` 靜默吞掉）——跟今天稍早修過的村目標/市集是同一種架構問題。`WorldBossLobby.jsx` 其實**已經有** `KillScreen` 顯示給所有人看（排行榜+擊殺者），只是沒有「你自己拿到什麼」這塊——這正是使用者感受到「沒結算」的地方，本質是同一個 bug 的兩面，不是 UI 沒做，是獎勵發放本身在默默失敗。
- 獎勵均等+紀念品是使用者主動確認的重新設計方向：拿掉依傷害排名分層（原本第1名/2-3名/其餘），改成全員一致的豐富共同獎勵，貢獻前三名/尾刀改發專屬紀念品而非更多資源。

### 踩坑提醒
- `expireWorldBossEvent`（時間到未擊殺的安慰獎路徑）**有一模一樣的跨帳號寫入模式**，但目前**只有 `AdminWorldBoss.jsx` 後台會呼叫它**（教練觸發，`isAdmin()` 豁免），所以現況沒有壞掉，這次**沒有動它**。如果之後有人想把它改成 client-triggered 自動過期，要記得一起改成自行請領，不要重蹈覆轍。
- `AdminWorldBoss.jsx` 的「額外發放卡包給所有參戰者」（`handleGiveCardPacks`）同理，只在教練後台觸發，這次沒動。
- 舊資料（已經 `rewardDistributed:true` 但沒有 `top3Ids` 的歷史世界王事件）不會回溯處理，只影響新產生的事件。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 不需要新增/修改 firestore.rules（`worldBossEvents` 本來就 `allow read,write: if isLoggedIn()`，新函式只寫呼叫者自己的 `members` 文件）。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後找非教練帳號實測擊殺世界王，確認自己跟隊友都能在 `KillScreen` 看到「你的獎勵」且金幣/寶箱有真的入帳。

---

## 2026-07-09（組隊打怪 partyDb.js 前後衛公式同步地下城改版）

### 改了什麼
- `src/lib/partyDb.js::processPartyRound`：套用跟 `dungeonDb.js`（前後衛重構任務）一樣的公式：
  - 後衛不再直接對怪物造成傷害（原本 dmg 選項 ×0.5 傷害直接打怪）。
  - 後衛 `dmg`（助攻）改成命中分數% × 25% 當加攻池，均分給存活前衛，套用在前衛 `calcDmgFn` 的 ATK 參數上（多名後衛可疊加）。
  - 後衛 `heal` 治癒池從固定 `maxHP×25%` 改成 `maxHP×15%×命中分數%`，均分給存活隊友。
  - `playerLog` 新增 `heal`/`buffPct` 欄位。
- `src/components/party/PartyBattleRoom.jsx`：戰鬥紀錄面板的玩家傷害顯示補上治癒/助攻%的分支（原本永遠顯示 `+0`）。按鈕文案本來就沒寫死數字（「💊 治癒隊友」「⚡ 協助攻擊」），不用改。

### 為什麼
- 上一個任務只改了地下城系統，組隊打怪（`partyDb.js`）是完全獨立的一份實作，維持舊公式會造成兩套前後衛數值不一致。使用者確認要同步。

### 踩坑提醒
- `arrowsPerRound`/`frontIds`/`rearIds` 原本宣告在函式中段，這次改成提前到函式開頭（因為要在 Step 1 算傷害之前，先算出後衛的加攻池），順手移除了原本重複的宣告。
- 組隊打怪的戰鬥文字捲軸日誌（`PartyBattleRoom.jsx` 約1600行，`if((p.dmg||0)>0)` 那段）沒有一併補上治癒/助攻的文字行——後衛選 heal/助攻時 dmg 永遠是 0，會被那段邏輯跳過、不出現在捲軸文字日誌裡（但戰鬥紀錄面板本身已經正確顯示）。這是次要顯示位置，這次沒改，之後若要補齊可以參考這次戰鬥紀錄面板的寫法。

### 驗證
- `CI=true npm run build`：Compiled successfully。

---

## 2026-07-09（修正市集交換卡片 Missing or insufficient permissions）

Trellis 任務 `07-09-07-09-card-market-permission-fix`。

### 改了什麼
- `src/lib/db.js::buyCardListing`：買家端的 `writeBatch` 移除對賣家 `members` 文件的寫入，只保留買家自己的扣款/拿卡。`cardMarket` listing 更新新增 `sellerClaimed:false`（+ `offeredCardId` 供交換類型使用）。
- 新增 `claimCardSaleProceeds(sellerId, listingId)`：賣家自己呼叫，驗證後把箭露/扭蛋幣/交換卡片加到自己的文件，標記 `sellerClaimed:true`。
- `src/components/member/CatVillage.jsx::CardMarketPanel`：既有的 `myListings` 訂閱裡新增自動偵測「賣出但未請領」的掛賣，自動呼叫 `claimCardSaleProceeds`，成功後跳一個簡短提示（此檔案沒有共用 toast，做了一個本地小 banner）。

### 為什麼
- 使用者回報射手帳號市集交換卡片出現 `Missing or insufficient permissions`。根因：`buyCardListing` 原本在買家瀏覽器裡直接寫入賣家的 `members` 文件給錢/卡片，違反 `firestore.rules`「只能改自己文件」的規則，整個 `writeBatch` 被拒絕——**這是必現 bug，不是偶發**，市集交易原本完全跑不通。跟村目標獎勵（見同日稍早的變更）是同一種架構問題，改用同一套「自行請領」模式解決。

### 踩坑提醒
- 通知賣家的文案已從「已收到」改成「開啟市集頁即可領取」，因為現在是非即時到帳。
- `cancelCardListing` 本來就有 `status!=="active"` 的檢查，賣出後的掛賣如果被誤點「下架」只會跳錯誤訊息，不會出資料問題，這次沒有特別隱藏該按鈕（UI 小瑕疵，非必要範圍）。
- 不需要改 `cardMarket`/`notifications` 的 firestore.rules，兩者本來就是 `allow read, write: if isLoggedIn()`。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後用兩個帳號實測一次完整交易（掛賣→購買→賣家開市集頁確認自動收到款項）。

---

## 2026-07-09（修正貓咪遠征隊 Missing or insufficient permissions）

### 改了什麼
- `firestore.rules`：`members` collection 的 update hasOnly 白名單加入 `"expeditions"`（**需手動貼到 Firebase Console**）。

### 為什麼
- 使用者回報射手帳號「遠征隊」操作出現 `Missing or insufficient permissions`。查證：`db.js::startExpedition`/`collectExpedition`（貓咪遠征隊，2026-06-27 改版新增）寫入 `expeditions.{slotIdx}` 欄位，但 `expeditions` 這個頂層欄位名稱從改版當時就沒被加進 `members` 的 hasOnly 白名單，導致任何會員開始遠征/領取遠征獎勵都會被規則拒絕——這不是偶發，是每次都會發生的必現 bug。
- 同一次回報還有「市集交換卡片」也是同一個錯誤訊息，但根因不同（見下一則變更）。

### 驗證
- 規則語法正確（純新增陣列元素），需使用者手動部署到 Firebase Console 後才會生效，此環境無法直接驗證實際行為。

---

## 2026-07-09（地下城前後衛重構：橫向滑動 UI + 後衛加攻/治療改用命中分數）

Trellis 任務 `07-09-07-09-front-rear-guard-rework`。

### 改了什麼
- `src/components/dungeon/DungeonBattleRoom.jsx`：
  - 主排卡片寬度從「除以人數擠壓」改成固定寬度，人數 >4 時容器加 `overflowX:"auto"` 橫向滑動。
  - 戰鬥紀錄面板（含小結算彈窗）新增顯示後衛的治癒量（💚）/助攻加攻%（🛡️），不再永遠顯示 `+0` 傷害。
  - 後衛行動選擇按鈕文案更新：「治癒 (看命中%)」「助攻 (前衛加攻擊)」，配色從紅色攻擊改成藍色支援。
  - 每回合逐箭訊息：後衛（治癒/助攻）不再顯示成「脫靶了」。
- `src/lib/dungeonDb.js::processDungeonRound`：
  - 後衛**不再直接對怪物造成傷害**（原本 dmg 選項是 ×0.5 傷害直接打怪物）。
  - 後衛 `dmg`（助攻）選項改成：本回合命中分數% × 25% 當作加攻池，均分給存活前衛（多名後衛可疊加），套用在前衛的 `effectiveAtk` 計算上。
  - 後衛 `heal` 選項：治癒池從固定 `maxHP × 25%` 改成 `maxHP × 15% × 命中分數%`，一樣均分給存活隊友（不含自己）。
  - `playerLog` 新增 `heal`/`buffPct` 欄位供 UI 顯示。

### 為什麼
- 使用者回報：前衛 4 人時畫面被擠滿；後衛「攻擊」選項想改成幫前衛加攻擊力（用命中分數% 換算，不看後衛自己的能力值）；後衛「治療」選項的治癒量從沒有在畫面上顯示過。
- 治療/加攻公式使用者已確認：都用命中分數%換算、都均攤給受益人數；加攻池刻意調低且封頂 25%（`分數% × 25%`，滿分才會到 25% 上限），避免後衛變成無腦最優解。

### 踩坑提醒
- **`src/lib/partyDb.js`（組隊打怪 PartyBattleRoom 的後端）有完全獨立的一份前後衛邏輯**（沒有共用 `dungeonDb.js` 的函式），目前還是舊公式（固定 25%maxHP 治癒、0.5倍傷害的 dmg 選項）。這次**只改了地下城系統**，組隊打怪的前後衛沒有跟著改，因為使用者這次的需求脈絡是地下城，尚未確認組隊打怪要不要一致同步。
- `atkBuffPctForFront` 是所有選擇助攻的後衛「各自貢獻的池子 ÷ 存活前衛數」加總，不是取最大值——多名後衛同時助攻會疊加超過單一後衛的 25% 上限（例如兩位後衛都滿分助攻，理論上前衛拿到的加成會超過 25%，這是刻意允許的疊加，不是每人都封頂在 25% 而是「單一後衛的貢獻」封頂在 25%）。
- `calcScorePct` 用 `arrow.score`（已經是正規化後的分數，包含 target_score 等特殊合約的 X=11 等情況），用 `Math.min(1,...)` 夾住避免超過 100%。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後實測：4 人前衛橫向滑動流暢、後衛選治癒/助攻後戰鬥紀錄能看到對應數字、多名後衛同時助攻時前衛攻擊力有明顯疊加提升。

---

## 2026-07-09（地下城掉落倍率改為隨機 1~3，取代原本固定 ×2）

### 改了什麼
- `src/lib/expeditionRewards.js`：`EXPEDITION_DROP_MULTIPLIER`（固定值 2）拆成 `EXPEDITION_DROP_MULTIPLIER_MIN=1`/`_MAX=3`，新增 `rollExpeditionDropMultiplier()` 內部函式，`createExpeditionKillLoot()` 每次擊殺都重新擲骰（材料寶箱跟金幣寶箱用同一次擲骰結果，維持同步，不是各自獨立隨機）。`getExpeditionRewardPreview()` 回傳的欄位也從單一 `multiplier` 改成 `multiplierMin`/`multiplierMax` 範圍。
- `src/components/dungeon/DungeonSelectionPanel.jsx`：三處寫死的「×2」文字（含一處連數字都沒接變數、直接硬寫 `×2` 字面值）全部改成 `×{min}~{max}（隨機）`。

### 為什麼
- 使用者回報「地下城掉落的金幣、寶箱、箭露都是固定 2 倍」，希望改成每次隨機 1~3 倍，增加驚喜感。

### 驗證
- `CI=true npm run build`：Compiled successfully。

---

## 2026-07-09（修正地下城藥水無法使用——用錯資料來源的死欄位）

### 改了什麼
- `src/components/dungeon/DungeonBattleRoom.jsx`：
  - 藥水庫存訂閱改成直接 `subscribePotions(myId, setPotionInv)`（比照 `PartyBattleRoom.jsx` 的正確寫法），取代原本讀 `room?.members?.[myId]?.items` 的方式。
  - `BattleBottomBar` 的 `potionInv` prop 改傳 `potionInv`（state），原本傳的是 `me.items || {}`。

### 為什麼
- 使用者回報「新系統藥水無法使用」，查證後發現這不是新系統特有的問題，而是 `DungeonBattleRoom.jsx`（新舊地下城系統共用同一個元件）本身的 bug：藥水庫存試圖從 `room.members.{id}.items` 讀取，但 `dungeonDb.js`/`expeditionDb.js`/`expeditionTeamDb.js` 建立房間/加入房間的邏輯**從來沒有任何地方寫入過這個欄位**，是個死欄位，永遠是 `undefined`。更嚴重的是即使訂閱邏輯本身修對了，UI 元件的 prop 仍然讀著 `me.items`（同一個死欄位），畫面上永遠不會顯示任何藥水可選。

### 踩坑提醒
- 玩家真正的藥水庫存存在獨立的 `potionInventory/{memberId}` collection（`items:{potionId:count}`），**不是**存在 `members`/房間文件裡，任何戰鬥模式要正確顯示藥水都要直接 `subscribePotions(myId, cb)`，不要嘗試從房間的 member 物件讀。
- 這個死欄位 bug 影響**所有**經過 `DungeonBattleRoom.jsx` 的戰鬥（舊地下城系統 + 新遠征系統），不只是使用者一開始以為的「新系統」。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後實測：帳號有藥水庫存時，進入任何地下城戰鬥（一般/遠征都測）能在藥水頁籤看到並成功使用。

---

## 2026-07-09（BattleShootingProfile 弓種下拉帶入自建裝備名稱）

### 改了什麼
- `src/components/shared/BattleShootingProfile.jsx`：改用 `useAuth()` 讀 `profile.equipment`（`normalizeEquipment`），弓種下拉選單的**顯示文字**若玩家在「我的弓具設定」建過對應分類的裝備，改顯示「{通用分類} - {自建裝備名稱}」，沒有則維持原本通用分類名稱。

### 為什麼
- 這個共用元件被 5 種戰鬥模式（打怪/組隊/決鬥/地下城/世界王）用來標記每場戰鬥用的弓種，但一直是寫死 4 個通用分類，完全沒接到玩家自己在 `MemberBowSettings.jsx` 建立的裝備清單。

### 踩坑提醒
- **底層存值（`bowType`）刻意沒有換成自訂裝備 id**，只換了下拉選單的顯示文字。原因：`bowType` 會被寫進 `MonsterBattle`/`DungeonBattleRoom`/`PartyBattleRoom`/`DuelRoom`/`WorldBossAttack` 的戰鬥紀錄，`MemberPractice.jsx` 的箭數分析、`bowsUsed`/`combos` 分組、目標比對全部依賴這 4 個固定值（`recurve_bare/recurve_full/compound/traditional`）做 key，換成自訂 id 會整套分析壞掉。以後如果要真的儲存「用了哪一組自訂裝備」，要另外加欄位，不要動 `bowType` 本身。

### 驗證
- `CI=true npm run build`：Compiled successfully。

---

## 2026-07-09（首殺/世界王擊殺公告寫入訊息列 + 分類頁籤）

Trellis 任務 `07-09-07-09-broadcast-to-notifications`，PRD 見 `.trellis/tasks/07-09-07-09-broadcast-to-notifications/`。

### 改了什麼
- `src/lib/dungeonDb.js::addDungeonBroadcast()`：新增 `memberName` 參數（順手修正原本從未傳入、單人首殺橫幅顯示「undefined 成為首殺英雄」的小 bug），成功寫入 `dungeonBroadcasts` 後額外呼叫 `createNotification({type:"dungeon", targetMemberId:null, ...})`，非同步 `.catch(()=>{})`，不影響原本回傳值。
- `src/components/dungeon/DungeonExpedition.jsx`、`TeamExpeditionBattle.jsx`、`DungeonBattleRoom.jsx`：三個呼叫端補上 `memberName` 參數。
- `src/lib/worldBossDb.js::attackWorldBoss()`：`defeated` 分支內額外呼叫 `createNotification({type:"worldboss", targetMemberId:null, ...})`。
- `src/components/member/MemberNotifications.jsx`：`FILTERS` 新增「地下城」「世界王」兩個頁籤，`matchFilter()` 補對應條件。`TYPE_META` 本來就有 `dungeon`/`worldboss` 定義，沒改。

### 為什麼
- 首殺/世界王擊殺公告原本只是一次性頂部橫幅，消失後完全沒有紀錄可查；`MemberNotifications.jsx` 的分類系統早就預留好這兩種 type 的圖示/顏色，只是從沒有寫入端真的用過。使用者要求橫幅維持原樣（仍顯示一次），額外把同一事件寫進訊息列供事後回顧。

### 踩坑提醒
- `addDungeonBroadcast` 現在依賴上一個任務（`07-09-07-09-broadcast-race-a11y-fix`）修好的 `trySetDungeonFirstClear` transaction 保證只有一個呼叫者會真的建立廣播；如果之後又出現「一次首殺多筆通知」，先查 `trySetDungeonFirstClear` 有沒有被改回非 atomic 寫法，而不是懷疑這次新加的 `createNotification`。
- `attackWorldBoss()` 本身**還沒有** transaction 保護（`getDoc`→本地算→`updateDoc`），本次只是在既有 `defeated` 分支上掛一個通知呼叫，沒有修這個潛在 race——跟使用者之後要討論的「世界王結算」項目重疊，留到那個任務一起處理。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- Firestore 規則：`notifications` collection 本來就 `allow create: if isLoggedIn()`，不需改規則。

---

## 2026-07-09（首殺公告重複 race condition 修正 + MemberApp 兩處 a11y）

Trellis 任務 `07-09-07-09-broadcast-race-a11y-fix`，PRD/design/implement 見 `.trellis/tasks/07-09-07-09-broadcast-race-a11y-fix/`。

### 改了什麼
- `src/lib/dungeonDb.js::trySetDungeonFirstClear`：改用 `runTransaction` 包住「讀取 `dungeonFirstClear/{dungeonId}` 是否存在 → 不存在才寫入」，移除原本查詢 `dungeonBroadcasts` 判斷已廣播的錯誤邏輯。
- `src/pages/MemberApp.jsx`：`dungeonKillAlert`（507行附近）、`wbKillAlert`（523行附近）兩個 `<div onClick>` 公告補上 `role="button" tabIndex={0} onKeyDown`（Enter/Space 可關閉）；這兩個 + `specialAlert` 三個全域公告容器補 `aria-live="polite"`。

### 為什麼
- **根因（已用 code 讀取確認，非推測）**：`trySetDungeonFirstClear` 原本是「先 `getDocs` 查 `dungeonBroadcasts` 有沒有該 `dungeonId` → 空的話才 `setDoc`」，兩步之間沒有鎖。`TeamExpeditionBattle.jsx::handleFinish()`（隊伍領獎）**每個隊員各自呼叫**，不是只有房主。多名隊員幾乎同時領獎時，大家都在別人寫入完成前查到「還沒有」，導致每個人都各自建立一筆 `dungeonBroadcasts` 文件（`addDoc` 產生不同 doc id）——同一次首殺產生多筆廣播，`MemberApp.jsx` 的 localStorage 去重機制只認「單一已讀 id」，對這些「各自不同」的新 id 完全無效，因此使用者看到公告一次次跳出來。
- `firestore.rules` 裡 `dungeonFirstClear` 的規則註解本來就寫「由 trySetDungeonFirstClear **原子**寫入」，代表這是設計時就打算做成 atomic、只是實作沒做到，這次修正是把實作補齊成符合原始設計意圖。
- a11y 兩點是 `web-design-guidelines` skill 審查 `MemberApp.jsx` 時發現的可行動項目。

### 踩坑提醒
- `trySetDungeonFirstClear` 呼叫端（`DungeonExpedition.jsx:1080`、`TeamExpeditionBattle.jsx:628`、`DungeonBattleRoom.jsx:481`）**完全沒改**，因為回傳形狀 `{ok,isFirst}` 沒變，這是刻意設計成呼叫端無感知的修法。
- 判斷「是否已首殺」的唯一鍵是 `dungeonFirstClear/{dungeonId}` 這個 deterministic doc id 本身是否存在，**不要**再查 `dungeonBroadcasts` collection（那是廣播記錄，不是首殺判斷的正確依據，兩者曾經對不上）。
- 舊系統路徑（`DungeonBattleRoom.jsx`，`mapDungeonId` 查表）跟新系統（`TeamExpeditionBattle.jsx`/`DungeonExpedition.jsx`，`family+tier` key）共用同一個 `trySetDungeonFirstClear`，這次修法對兩邊都生效，不用分開處理。
- 本次**沒有**動到：訊息列 (`MemberNotifications.jsx`) 分類路由、地下城其餘 6 項已知 bug（結算時機/畫面卡死/斷線回不去房間/T1-T6獎勵沒差異/寶箱族第七族未實裝+村目標獎勵未發放）、世界王結算+玩法重新設計——這些使用者已確認排在後面，個別另開 Trellis 任務。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後手動驗證：組隊多人同時點「領取」時只出現一次首殺公告、鍵盤 Tab 可以聚焦到公告並用 Enter/Space 關閉。

---

## 2026-07-04（冒險者公會「一般懸賞任務」自動化 — 交接項目①已完成）

Trellis 任務 `07-04-guild-general-bounty`，PRD/design/implement 見 `.trellis/tasks/07-04-guild-general-bounty/`。

### 改了什麼
- `src/lib/adventurerSystem.js`：`makeSeedRand` 加 `export`（供 db.js 複用同一套日期 seed 亂數，與 `getDailyGuildTasks` 同源）。
- `src/lib/db.js` 新增：
  - `DEFAULT_BOUNTY_REWARDS`（4 難度預設獎勵 fallback）
  - 範本 CRUD：`getGuildBountyTemplates`/`subscribeGuildBountyTemplates`/`createGuildBountyTemplate`/`updateGuildBountyTemplate`/`toggleGuildBountyTemplateActive`/`deleteGuildBountyTemplate`（collection `guildBountyTemplates`）
  - 獎勵表讀寫：`getGuildBountyRewards`/`subscribeGuildBountyRewards`/`setGuildBountyRewards`（collection `guildBountyRewards`，單一文件 `config`）
  - `autoPublishDailyGeneralBounties()`：每日刷新主邏輯（下架昨天舊任務 → 讀 active 範本池+獎勵表 → 日期 seed 每難度抽 1 個 → `publishGuildQuest` 發佈 → 寫 `guildMeta/dailyGeneralBounty` 防重複）
  - `publishGuildQuest` 擴充寫入 `bountyDifficulty`/`bountySource`/`bountyDateKey` 三個新欄位（原本只有 periodTag 等）
  - `submitGuildQuestCompletion` 擴充：`quest.bountyDifficulty` 存在時，額外讀取當前 `guildBountyRewards` 取得 `chestType`，呼叫既有 `addChests` 發放對應難度寶箱
- `src/components/member/AdventurerGuild.jsx`：掛載時新增呼叫 `autoPublishDailyGeneralBounties()`（與既有 `autoPublishBountyQuests` 並列，client-triggered 模式）；懸賞卡片與確認接取頁新增 `BOUNTY_DIFF_LABEL` 難度徽章（僅 `bountySource==="daily_general"` 顯示）。
- `src/components/admin/AdminGuildQuests.jsx`：新增 tab `"bounty"`，渲染新元件。
- **新增** `src/components/admin/AdminGuildBountyTemplates.jsx`：範本池 CRUD（4 難度分組）+ 難度獎勵表編輯（xp/coins/arrowDew/gachaCoins + chestType 下拉）+「立即重新產生今日任務」測試按鈕。
- `firestore.rules`：新增 `guildBountyTemplates`/`guildBountyRewards` 兩個 collection（read: isLoggedIn，write: isAdmin）— **需手動貼到 Firebase Console**。

### 為什麼
- 與現有兩套系統（每日靶紙任務三階、雙週怪物討伐懸賞六階）明確區分，教練需要能自訂「任務範本」與「難度獎勵」而不是寫死常數，同時不修改既有兩套系統任何一行。
- 沿用既有 `publishGuildQuest`/`submitGuildQuestCompletion` 發佈與結算路徑、既有 `autoPublishBountyQuests` 的 client-triggered + `guildMeta` 防重複模式，是專案既有慣例（無 Cloud Functions/cron）。

### 踩坑提醒 / 與 design.md 的關鍵出入
- **design.md 原文寫 `questSubtype: "general"`，實作改成 `questSubtype: "kill_monster"`**：交叉檢查 `AdventurerGuild.jsx` 實際渲染邏輯後發現，「接取任務→開始狩獵→擊殺進度比對→提交完成」整套按鈕流程完全以 `questSubtype==="kill_monster"` 判斷式為準（`sub===` 系列 if-else），若照 design.md 字面寫 `"general"`，前端會直接落到 `lock.ok` 最後一個 fallback 分支（手動填說明送出，不驗證擊殺數），等於玩家不用真的打怪就能領獎，違反 PRD 決策③「比照現有雙週懸賞的判定邏輯」。改用 `bountySource==="daily_general"` + `bountyDifficulty` 兩個新欄位區分「這是每日一般懸賞」，不依賴 `questSubtype`。**日後如果要修 kill_monster 判定邏輯，記得雙週懸賞和每日一般懸賞現在共用同一段前端判斷式。**
- `publishGuildQuest` 原本白名單只寫入固定欄位（不是全量 spread `...data`），新增 `bountyDifficulty`/`bountySource`/`bountyDateKey` 三個欄位必須顯式加進該函式的 `setDoc` 內，否則會被靜默丟棄。
- `guildMeta`/`guildQuests` 這兩個 collection 在 `firestore.rules` 目前**完全沒有對應規則**（`guildQuests` write 限 `isAdmin()`，`guildMeta` 甚至整個沒出現在規則檔）——這是雙週懸賞既有的已知行為：一般會員觸發 `autoPublish*` 會 permission-denied 靜默失敗（都包了 `.catch(()=>{})`），只有「教練切換射手模式」瀏覽公會頁時（仍是 admin 身份）才會真的寫入成功。本次沿用同一機制，未新增/修改這兩個 collection 的規則（design.md 也明確指示不需要）。
- `submitGuildQuestCompletion` 內對寶箱的 `getGuildBountyRewards()` 是即時讀最新設定（不是用發佈當下 snapshot 的獎勵值），代表教練事後調整難度獎勵的 `chestType`，會影響「已上架但尚未提交」任務的寶箱結算結果——這是刻意跟隨 design.md 的行為，如果需要「發佈當下鎖定」語意需另外討論。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後手動驗證：同一天重複呼叫 `autoPublishDailyGeneralBounties()` 回傳 `already_exists`、範本池某難度為空時不影響其他難度正常上架、結算後 `chestInventory` 確實新增對應寶箱。

---

## 🔴 2026-07-04 交接筆記 — 三項未完成工作（前一位 Claude 因限流中斷，交給接手的 AI）

以下三項是同一次對話裡使用者提出、**已完整診斷根因/確認需求，但尚未建立完整任務或尚未動手實作**的項目。已完成並 commit 的工作（組隊地下城修復、鎖定計分模式切換、貓咪圖鑑101-200、archery.catgroup.com.tw重新部署）不在此列，見上方/下方其他 changelog 條目。

### 項目 1：冒險者公會「一般懸賞任務」自動化 — ✅ 已完成（2026-07-04，見上方新條目）

**現況**：Trellis 任務已建立於 `.trellis/tasks/07-04-guild-general-bounty/prd.md`，PRD 內的「已確認的需求決策」章節記錄了使用者透過 AskUserQuestion 確認的所有決策，**直接照 PRD 內容執行即可，不需要重新問使用者**：
- 4 個全新獨立難度等級（不沿用現有 6 階或 3 階系統）
- 教練後台新增的是「任務範本」，系統每天自動從範本池抽選發佈（不是教練手動逐一發佈單一任務）
- 任務達成條件先只做「擊殺指定怪物數」（`kill_monster` 型）
- 全員同一批（比照 `getDailyGuildTasks` 用日期當 seed）
- 每難度固定抽 1 個範本上架，共 4 個；範本池不夠時允許重複抽取
- 舊任務隔天直接下架失效（不给補做寬限期）
- 各難度實際獎勵數字（金幣/經驗/箭露/轉蛋幣/寶箱）**先用合理預設值上線**，之後教練再進後台調整

**現有系統參考**（PRD 裡已寫的探索結果，不用重查）：
- 保留不動：`src/lib/adventurerSystem.js::getDailyGuildTasks(date)`（克蘇魯/人質/殭屍靶每日任務）
- 可參考生成邏輯：`generateBiWeeklyBounties(periodKey, monsters)` + `BOUNTY_TIER_CONFIG`（雙週怪物討伐懸賞，6階，可作為「範本池抽選+依難度套用獎勵」寫法的參考範本，但這次要做的是全新獨立4階系統，不是複用這6階）
- 既有 CRUD 全部沿用：`publishGuildQuest`/`updateGuildQuest`/`deleteGuildQuest`/`updateGuildQuestStatus`（`src/lib/db.js`），`AdminGuildQuests.jsx` 已有 `questSubtype:"general"` 選項
- 自動刷新沿用既有 client-triggered 模式（`autoPublishBountyQuests` 用 `guildMeta/{key}` 文件防重複發佈，専案無 Cloud Functions/cron）

**下一步**：讀完 PRD 後直接寫 `design.md`（資料模型：新的範本池 collection 設計、每難度獎勵表 collection、每日抽選+發佈邏輯、教練後台新增範本管理 UI + 獎勵表調整 UI）+ `implement.md`，然後 `task.py start` 進入實作。

---

### 項目 2：箭數里程碑 bug（跨模式系統性錯誤，根因已 100% 確認，尚未建任務/尚未修）

**症狀**：不管哪個模式，每打完一次都會重複跳出「已完成6箭里程碑」的提示，即使今天早就已經領過。

**根因（已用 Grep 逐一確認，非推測）**：`src/lib/arrowMilestone.js::getMilestonesReached(oldTotal, newTotal)` 本身沒問題（純函式，正確計算門檻跨越），問題在呼叫端傳入的 `oldTotal`/`newTotal` 各模式算法不一致：

| 檔案 | 目前寫法 | 問題 |
|---|---|---|
| `src/components/member/AdventurerGuild.jsx`（約216行） | `getMilestonesReached(0, arrowCount)` | 寫死從0算，每場只要超過6箭就跳 |
| `src/components/member/CouncilBattle.jsx`（約388行） | `getMilestonesReached(0, totalArrows)` | 同上 |
| `src/components/duel/DuelRoom.jsx`（約450行） | `getMilestonesReached(0, myArrowCount)` | 同上 |
| `src/components/member/DailyQuest.jsx`（約139行） | `getMilestonesReached(0, todayArrows)` | 同上（下課結算時） |
| `src/components/member/MonsterBattle.jsx`（約905-910行） | 用 `sessionArrowsRef`（`useRef(0)`），但 `startBattle()`（約792行）會把它重設為0 | 同一天打第二場新戰鬥，ref歸零，一樣會重複跳 |

**唯二正確的參考範本**：
- `src/components/member/MemberPractice.jsx`（約2269-2272行）：`oldTodayArrows`/`newTodayArrows` 是真正累計「今天」的箭數，正確
- `src/components/worldboss/WorldBossAttack.jsx`（約705-708行）：用真實 `todayArrows` 變數，正確

**建議修法**：不要在每個檔案各自修正各自的計算方式（容易再次不一致），應該做一個**共用的單一入口函式**（例如在 `db.js` 或 `arrowMilestone.js` 新增 `checkAndGrantArrowMilestones(memberId, arrowCount)`），內部統一用同一種方式取得「今天真正累計箭數」（可能需要新增一個持久化的 `todayArrows` 欄位，比照 `dailyQuestCount` 的模式，在每次箭數送出時 increment，並在換日時重置——需要設計換日重置的判斷方式），取代掉上面 5 個檔案裡各自不一致的寫法。

**下一步**：建 Trellis 任務（例如 slug `arrow-milestone-fix`），寫 PRD（可直接引用上表）+ design（設計共用函式的資料結構與換日重置邏輯）+ implement，分派 trellis-implement 執行，範圍橫跨 5 個檔案 + 可能新增 1 個共用函式。

---

### 項目 3：首殺通知 bug（兩個獨立問題，根因已查清，尚未建任務/尚未修）

**症狀**：使用者回報「首殺通知都沒有消掉，會一直重複出現」，並指出「現在是新的地下城系統，首殺的部分應該要處理」。

**問題 A：橫幅已讀狀態沒有持久化（純前端 bug，容易修，跟新舊地下城系統無關）**
- `MemberApp.jsx` 用 `dismissedBroadcastRef`/`lastBroadcastIdRef`（約136-137行，都是 `useRef(null)`）追蹤「使用者是否已讀最新一筆首殺廣播」，純記憶體狀態，**沒有寫入 localStorage 或 Firestore**。
- 只要使用者重新整理頁面或 `MemberApp` 重新掛載，這兩個 ref 就歸零，`subscribeLatestBroadcast()`（`dungeonDb.js:1193`）立刻拿到同一筆「最新廣播」（因為在下一次首殺發生前它本來就一直是同一筆），比對失敗，橫幅重新彈出。
- **修法**：把已讀狀態換成持久化（例如 `localStorage` 存最後已讀的 broadcast id），取代純 `useRef`。這部分可以直接修，不需要額外設計決策。

**問題 B：新版地下城系統完全沒有接上首殺判斷（不是bug是功能缺口，需要的設計決策使用者已經確認）**
- 首殺判斷邏輯 `trySetDungeonFirstClear`（`dungeonDb.js`，約1094行起註解寫 `dungeonId 格式："ghost_normal", "temple_hell"`）完全綁定**舊版固定地下城目錄查表**（`DUNGEON_MAPS.find(d => d.id === room?.mapDungeonId)`）。
- 新版地下城系統（2026-07-14起的「三大來源」excavation系統）的地下城是隨機生成的 `family` + `difficultyTier`（T1~T6）組合，不是固定目錄裡的 `mapDungeonId`，所以 `DUNGEON_MAPS.find(...)` 永遠找不到、`dungeonInfo` 是 `undefined`，整段首殺判斷直接安靜跳過（`setFirstClearBonus(false)` 後 return），**新系統的地下城完全沒有首殺獎勵或廣播**——不是壞掉，是從一開始就沒接上。
- 觸發點確認在 `DungeonBattleRoom.jsx`（約470-486行，`isBossRoom && isMapMode && isHost` 時呼叫首殺檢查），`TeamExpeditionBattle.jsx`（約173-176行）呼叫 `<DungeonBattleRoom isMapMode={true} expeditionMode={true} .../>`，兩個旗標都是 true，所以確實有進到檢查區塊，只是查表查不到。
- **使用者已確認的設計決策**：新系統的「首殺」改用 **`family + tier` 當 key**（例如「第一次打過 ghost 族 T3」就算首殺，不管是哪次隨機生成的具體地下城）。
- **下一步**：需要重新設計 `dungeonId`/首殺紀錄的 key 格式（從 `"ghost_normal"` 這種固定目錄格式，改成能表示 `family+tier` 的格式，例如 `"ghost_t3"`），在 `TeamExpeditionBattle.jsx`／單人 `DungeonExpedition.jsx` 對應的 Boss 通關處接上新的判斷邏輯，不能直接沿用 `DUNGEON_MAPS` 查表。舊系統（`DungeonBattleRoom.jsx` 原本走 `mapDungeonId` 那條路徑，非 expedition 模式）應保持不動，只新增新系統的判斷路徑。

**下一步**：建 Trellis 任務（例如 slug `dungeon-first-clear-fix`），問題A可以直接修不用問使用者；問題B已有設計決策（family+tier當key），寫 PRD+design 後直接分派實作即可，不需要再問使用者。

---

## 2026-07-04（鎖定戰鬥中計分模式切換：Party/Dungeon/MonsterBattle + WorldBoss/Duel 補漏）

### 改了什麼
- `PartyBattleRoom.jsx`、`DungeonBattleRoom.jsx`、`MonsterBattle.jsx`（implement agent 已完成，見 commit 訊息誤植為「subscribeNotifications 加 limit(50)」的那次）：
  - 回合中永遠可點的 🎯 切換鈕改為只在 `!scoringModeChosen`（或 Dungeon hit_count 合約的 `arrows.length===0 && !targetMode`）時才顯示。
  - `TargetFaceOverlay` 的 `onClose={() => { setTargetMode(false); setBattleInputMode("button"); }}` 整個移除（三處呼叫都不再傳 `onClose`），避免關閉靶面覆蓋層時偷偷切回按鈕模式。
  - `handleTargetSubmit()` 開頭加 `if (targetPending) return;`，防止 2 秒 timeout 期間重複觸發疊加。
- **本次 check agent 額外發現並修復**：同一個 `TargetFaceOverlay` 共用元件在 `WorldBossAttack.jsx`（世界王）與 `DuelRoom.jsx`（決鬥）也有完全相同的漏洞，PRD 原始範圍只列了 Party/Dungeon/MonsterBattle 三個檔案，這兩個是漏網之魚：
  - `WorldBossAttack.jsx`：🎯 切換鈕加上 `arrows.length===0` 條件（該檔沒有 `scoringModeChosen` 機制，改用「本回合尚未輸入任何箭」為鎖定條件，比照 Dungeon hit_count 分支的既有寫法）；移除 `onClose` 副作用；`handleTargetSubmit` 補 `if (targetPending) return;`。
  - `DuelRoom.jsx`：🎯 切換鈕（原本完全無鎖定，任何時候都能點）同樣加上 `myArrows.length===0` 條件，並包進條件式 render；移除 `onClose` 副作用；`handleTargetSubmit` 補 `if (targetPending) return;`。

### 為什麼
- 根因：`TargetFaceOverlay` 是 5 個戰鬥模式（Party/Dungeon/MonsterBattle/WorldBoss/Duel）共用的元件，但「回合中鎖定計分模式」這件事是各檔案自己在呼叫端手動維護（`scoringModeChosen` 或 `arrows.length===0` 條件），不是元件本身強制的。這次修 3 個檔案時，另外 2 個共用同一元件、同一模式的檔案很容易被漏掉——這正是 PRD 提到「先前 RPG 打怪送出後被踢回首頁」bug 反覆出現的同一類根因。
- `DuelRoom.jsx` 的切換鈕原本是本次調查範圍外發現最嚴重的一個：完全沒有任何鎖定條件（連 `arrows.length===0` 都沒有），回合打到一半也能自由切換。

### 踩坑提醒
- 以後任何在 `TargetFaceOverlay` 呼叫端新增/修改鎖定邏輯時，務必 `grep "TargetFaceOverlay"` 找出**所有**呼叫端（目前共 5 處：Party/Dungeon/MonsterBattle/WorldBoss/Duel），逐一確認同一套鎖定條件都有套用，不要只改 PRD 列出的那幾個檔案。
- `WorldBossAttack.jsx`／`DuelRoom.jsx` 沒有 `scoringModeChosen` 這個 state，用的是「本回合箭數是否為 0」當鎖定條件（`arrows.length===0` / `myArrows.length===0`）；這與 Party/Dungeon/MonsterBattle 用的 `scoringModeChosen`（整場戰鬥只選一次，不會逐回合重置）語意不完全一樣，但都能滿足「回合中不能切換」的驗收標準，故未強行統一寫法，避免額外風險。
- `onClose` prop 在 `TargetFaceOverlay.jsx` 本身是 optional（`{onClose && (...)}`），5 個呼叫端全部移除該 prop 後，靶面覆蓋層内建的「⌨️ 換按鈕」關閉鈕就不會渲染——這是刻意的：目前沒有其他方式關閉靶面覆蓋層直到本回合送出/結束，如果之後要加「暫時關閉看其他資訊」的需求，必須新增一個不影響 `targetMode` 的獨立關閉按鈕，不能複用 `onClose` 這個名字（避免未來又被誤用去切模式）。

## 2026-07-04（組隊地下城修復：地圖崩潰＋人數上限＋前後衛選擇）

### 改了什麼
- `src/lib/expeditionGrid.js` 新增 `stripGridForSync(gridFloor)`：淺拷貝剔除 `grid`（2D 陣列，Firestore 不支援巢狀陣列）。`generateGridFloor()` 本身格式不動（單人模式仍依賴）。
- `src/components/dungeon/TeamExpeditionBattle.jsx` 新增本地 helper `stripMapStateGrid(state)`，所有 9 處把 `expeditionMapState` 寫入 `updateTeamExpeditionRoom()` 的地方一律先過這個 helper，徹底解決組隊地下城「建立→進入」時的 Firestore「Nested arrays are not supported」崩潰。
- `src/lib/expeditionTeamDb.js`：`joinTeamExpeditionRoom` 人數上限從 `>= 4` 改為 `>= 8`；新增 `setTeamExpeditionMemberRole(roomId, memberId, role)`（transaction，各角色上限 4 人，只決定進場初始 role）。
- `src/components/dungeon/DungeonTeamLobby.jsx`：人數顯示與空位佔位符改「/8」；隊員清單新增前衛/後衛選擇按鈕（僅本人可選）+ 即時「前衛 X/4 · 後衛 Y/4」提示；`handleStart()` 組出的 `memberList` 帶上 `role`。
- `src/lib/partyDb.js` 新增 `setPartyMemberRole(roomId, memberId, role)`（同上 transaction 邏輯，各上限 4）。
- `src/components/party/PartyBattleRoom.jsx` 等待室（`room.status==="waiting"`）隊員列表新增角色徽章 + 本人前衛/後衛選擇按鈕 + 計數提示。

### 為什麼
- Bug 根因：組隊遠征的 `gridFloor.grid` 從未被下游渲染用到（`GridMapStage` 只用 `rooms` 陣列自建查找表），純屬多餘且直接炸 Firestore 寫入。
- 組隊地下城人數上限寫死 4，UI 也寫死 4，與舊版「地下城經典模式」（`dungeonDb.js`，8 人）不一致。
- 前後衛過去完全沒有進場前選擇：`createTeamExpeditionBattleRoom()` 的 `role: m.role || "front"` 因為 `members` 從未帶 `role` 欄位，導致每個人都變前衛，後衛沒人。Party 模式同樣沒有初始選擇（`role` 只在 `submitArrows` 時透過本地 `myRole` state 決定，預設一律 front）。

### 踩坑提醒
- 只需在**寫入 Firestore 前**剔除 `grid`，不需要在讀取端做任何還原——因為沒有任何下游邏輯依賴它。一旦第一次寫入時就剔除乾淨，後續所有 `...mapState.gridFloor` 的 spread 都不會再帶出 `grid`。
- 前衛倒下自動轉後衛復活的既有機制（`partyDb.js::processPartyRound` 內，約行 508-518，`isCurrentlyFront` 判斷處）完全沒動；新增的角色選擇只影響**開戰當下**的初始 `role`，戰鬥中動態切換邏輯不受影響。
- Party 模式的 `role` 欄位在 `resetPartyRoom()`（下一場重置）不會被清除，所以玩家上一場結束時的角色（含自動轉後衛的結果）會帶到下一場等待室，可再自由重選。
- 組隊地下城的 `DungeonTeamLobby.jsx::handleStart()` 傳出的 `memberList` 目前只有 `DungeonLobby.jsx::handleTeamStart` 接收但實際上該參數未被使用（見 `_memberList` 命名）——真正決定戰鬥房 `role` 的資料來源是 Firestore `dungeonRooms` 房間文件裡的 `members[id].role`（透過 `setTeamExpeditionMemberRole` 寫入），並在 `TeamExpeditionBattle.jsx::startRoomBattle` 直接讀取 `teamRoom.members` 建立戰鬥房成員列表。

## 2026-07-04（學生分級與系統鎖定）

### 改了什麼
- `members` 新欄位：`studentTier`（restricted/official/retired，缺欄位→restricted）、`accountFrozen`（獨立凍結機制）、`lastCheckinDate`（報到快取，submitCheckin 即寫、approveCheckin 補寫）
- 新檔 `src/lib/accessControl.js`：純函式 `getAllowedPages/isPageAllowed/isAutoLocked` + `DEFAULT_TIER_PERMISSIONS`/`PAGE_REGISTRY`
- 新 collection `systemConfig/maintenance`（全站維護鎖）與 `systemConfig/tierPermissions`（可調權限矩陣，教練後台打勾即時生效）
- `MemberApp.jsx`：維護鎖/帳號凍結全螢幕擋下 + 單一 `pageLocked` 判斷擋下未授權頁面（`LockedFeatureCard`，不強制跳轉，導覽列不隱藏）；retired 首次登入自動導向「我的」
- `AdminMembers.jsx`：新增 `TierModal`（分級下拉 + 凍結勾選）、批次勾選一鍵設 `official`、維護鎖開關卡片
- 新頁 `AdminTierPermissions.jsx`：頁面 × 分級打勾矩陣，掛在 `hub-member` →「權限設定」
- `firestore.rules`：`members` 自寫白名單加入 `lastCheckinDate`；新增 `systemConfig/{docId}`（read: isLoggedIn，write: isAdmin）— **需手動貼到 Firebase Console**

### 為什麼
- 出席/使用規範（分級）要與技術檢定（CERT_LEVELS）、付費方案（monthlyCard）分開治理，讓教練能獨立管控誰能用系統哪些部分
- 上線初期大量既有會員需要教練手動從 restricted 升到 official，批次工具避免逐一點擊
- 權限矩陣不寫死常數，改教練後台可調，因應未來規則微調不需重新部署

### 踩坑提醒
- `lastCheckinDate` 缺欄位時 `isAutoLocked` 必須直接回傳 `false`，否則所有舊會員一上線就被誤判「14 天未報到」鎖死
- `systemConfig` 是全新 collection，與既有 `sysConfig`（版本號）不同名不共用，勿混淆
- `MemberApp.jsx` 只服務 `role==="member"`（`App.jsx` 已分流 admin 進 `AdminApp`），所以組件內完全不需要額外判斷 `role==="admin"` 豁免——教練本體永遠走 `AdminApp` 的射手模式，不受這裡任何鎖定影響
- 頁面級鎖定用「目前 `page` 是否在允許清單內」單一判斷取代逐一包裹每個 `{page==="xxx" && ...}`，效果等價（同一時間只有一個 page 生效）且大幅減少改動面

## 2026-07-04（我的裝備顯示與加成修正）

- 修正品級說明與裝備詳情漏算每品 +5 及強化值；所有單槽與總加成統一使用同一計算函式。
- 裝備頁改為槽位完成度、實際 ATK／DEF／HP 加成、公式說明及升級前後差值；品牌明確標示不影響數值。
- 補齊神話 +0～+4 的金幣與 T6 材料需求，並改善手機底部視窗、空品項與提示訊息。

## 2026-07-04（官網重製：website/ 靜態 SEO 網站）

### 改了什麼
- 新增 `website/` 資料夾（與 React App 完全獨立）：`index.html`（單頁，inline CSS/JS 零依賴）、`robots.txt`、`sitemap.xml`、`assets/`（11 張圖，自 imgbb 下載本地託管：logo + 001~009 + 015）。
- 設計：暖米紙底 `#faf6ef` + 炭墨 `#2b2926` + 品牌橘 `#e8720c`（取自 logo 本色），Noto Serif TC 大標編輯風，與 SimplyBook 舊站深藍金完全區隔。
- SEO/GEO：JSON-LD ×2（SportsActivityLocation 含價目 OfferCatalog + FAQPage 8 題）、OG tags、GEO 實體描述段（hero 下方）、語意標籤、單一 h1、全圖 alt、lazy loading。
- **SimplyBook widget 完整嵌入**：新增「09 線上預約」區塊（`#booking`），用官方 `simplybook.asia/v2/widget/widget.js` 的 `SimplybookWidget({widget_type:'iframe', container_id:'sb-widget'})` 把預約日曆內嵌頁內；捲動接近（rootMargin 800px）或點 CTA 才載入 script，不拖慢首屏；所有預約 CTA 改頁內錨點 `#booking`，widget 下保留「新視窗開啟」備援連結（外連 `.../v2/#book`）。

### 為什麼
- SimplyBook 預設版型無法自訂 SEO；靜態單頁最快最省，Vercel 可另建專案（root=website/）獨立部署。

### 踩坑提醒
- **正式網域未定**：全檔用 placeholder `https://catarchery.tw`，部署後需全域取代（index.html canonical/OG/JSON-LD + robots.txt + sitemap.xml + simplybook-home.html 官網連結）。
- **地址疑義**：舊站主文寫「8 弄 12 號」、SimplyBook footer 寫「14 號」，目前採 12 號，需向老闆確認。
- 本機預覽：`py -3 -m http.server 8899 --directory website`（file:// 會被瀏覽器工具擋）。

### 2026-07-04 續（SimplyBook 品牌整合，已驗證生效）
- **嵌入改直接 iframe**：`loadSB()` 從 `widget.js` script 改成直接建 `<iframe src=".../v2/#book">`，理由：iframe 版預約頁會吃 SimplyBook 後台的自訂 CSS，能與官網同色系；widget.js 版不吃。仍保留 IntersectionObserver 延遲載入 + CTA 點擊載入。
- **`website/simplybook-custom.css`**：貼到後台「預約首頁 CSS」＋「預約套件 CSS」兩欄（同一份）。已把 v2 版型選擇器（`.step_info_item`/`.service-item`/`.calendar`/`.slot`/`.btn` 等，實地檢查 DOM 得來）+ 舊版模板選擇器（`#events`/`#widget_container`）都填品牌色。使用者已貼上，實測：步驟列變橘、服務卡白底圓角、日曆/時段橘色選中——生效。
- **`website/simplybook-home.html`**：SimplyBook 後台首頁描述欄位用的品牌內容（暖紙橘風入口：logo＋標語＋雙 CTA＋三特色＋價格摘要＋聯絡）。⚠ 內含「認識貓小隊→官方網站」連結指向 placeholder `catarchery.tw`，部署後要換。
- **踩坑**：SimplyBook v2 首頁頂部深藍金 banner 是後台上傳的**背景圖片**，非 CSS，custom CSS 改不動；要換得進後台換圖或改用 simplybook-home.html 內容。
- **使用者決定不獨立部署**：整個新官網要留在 SimplyBook 裡（不買網域、不架站）。已誠實告知：這樣 SEO/GEO 會打折（綁 simplybook.asia 子網域，title/meta/JSON-LD/sitemap 都改不了）。`website/index.html` 那套完整 SEO 版仍保留在 repo，未來想獨立上線可直接部署。
- **`website/simplybook-home-full.html`**：把完整官網設計（hero＋為什麼＋四弓種＋價目表＋訓練＋團康＋場地師資＋評論＋FAQ＋聯絡）改寫成**一大塊可貼的自足 HTML**——全 inline 樣式、圖片用 i.ibb.co 線上網址、FAQ 用原生 `<details>`（免 JS）、無 `<script>`/`<style>`（不怕後台過濾）、響應式靠 flex-wrap。供整份貼到 SimplyBook 後台首頁內容欄位。
- **`website/_preview-sb-home.html`**：本機預覽外殼（帶 `<meta charset=UTF-8>`，fetch 注入 full 檔）。⚠ 純內容片段直接用瀏覽器開會因缺 charset 顯示中文亂碼，那是預覽假象；貼進 SimplyBook（UTF-8 頁）就正常。此外殼不需貼進 SimplyBook。

### 2026-07-04 再續（官網正式部署 Vercel，使用者改走「部署+轉址」路線）
- 使用者在 SimplyBook 發現「重新導向網址」設定 → 決定改走最佳路線：官網獨立部署，SimplyBook 轉址過去。
- **已部署**：`website/` 公開檔案（index.html/robots.txt/sitemap.xml/assets）→ Vercel 新專案 **catarrow-archery**，正式網址 **https://catarrow-archery.vercel.app**（已實測線上正常）。
  - Vercel 帳號 `broudes-1864`、team slug `broudes-1864s-projects`（與現有 React App 專案 catarrow 同 org，但**獨立專案**，root 目錄那個 `.vercel/project.json` 是 catarrow 不要動）。
  - 部署方式：把公開檔複製到 scratchpad `catarrow-archery/` 再 `vercel deploy --prod`（未接 git 自動部署；之後改內容要重跑，或未來再設 git root=website 自動化）。
- **canonical/OG/JSON-LD/sitemap/robots 已全部從占位 `catarchery.tw` 改成真實 `catarrow-archery.vercel.app`**（否則 Google 因 canonical 指死網域不收錄）。未來買自訂網域再全域替換一次。
- **待使用者操作**：SimplyBook 後台「重新導向網址」填 `https://catarrow-archery.vercel.app`。注意 iframe 迴圈風險（見上），設好要一起測預約嵌入。
- **✅ 已驗證上線（2026-07-04）**：舊站首頁自動轉址到新官網（實測 `catarcherycom.simplybook.asia` → `catarrow-archery.vercel.app`）；新站預約 iframe 正常載入無迴圈（`!inBooking` 放行 `#book`）。轉址採「重新導向網址」欄位法（純 URL，不用貼 script）；script 版曾因貼進「首頁內容」欄位被即時預覽執行、害編輯頁自我跳轉點不到套用，已加 hostname 防呆。
- **手機日曆右欄被裁修正**：SimplyBook 日曆每列 `.inner` 是 `flex + nowrap`，內含固定寬 7 個 `.name`/`.date`，窄螢幕溢出裁掉「日」欄。`simplybook-custom.css` 加 `@media(max-width:767px)` 讓 `.inner > .date/.name` 改 `flex:1 1 0; min-width:0`（1/7 均分）。同源注入實測：容器 320px 時 7 格自動 46px、`overflow:false`。⚠ 改完 CSS 使用者需重貼到 SimplyBook 後台兩個 CSS 欄位。

### 2026-07-04 定案網域 + Cookie 橫幅
- **最終網域規劃**：射箭官網 `archery.catgroup.com.tw`、學籍/學生系統 `student.catgroup.com.tw`（domain `catgroup.com.tw`，NS 在 `ns1/ns2.cyberdns.tw`）。
- 官網全站 URL（canonical/OG/JSON-LD/sitemap/robots + `simplybook-redirect.html` 轉址目標 + `simplybook-home.html` 官網連結）從 `catarrow-archery.vercel.app` 改成 `archery.catgroup.com.tw`，已重新部署。
- Vercel：`archery.catgroup.com.tw` 已指派到 `catarrow-archery` 專案（`vercel domains inspect` 確認）；**待使用者在 cyberdns.tw 加 DNS**：CNAME `archery` → `cname.vercel-dns.com`。DNS 生效後再把 SimplyBook「重新導向網址」從 vercel.app 換成 archery.catgroup.com.tw。
- **Cookie 橫幅**：SimplyBook 的 `<div id="sb_cookies_block" class="cookies sb-important">`（fixed, z1000）在手機嵌入時一直跳出——iOS 封鎖 iframe 第三方 cookie，「已接受」存不住。`simplybook-custom.css` 加 `#sb_cookies_block{display:none}` 隱藏。⚠ 需重貼 CSS。

## 2026-07-04（九隻陪練貓個體化）

- 保留 `allround` 資料鍵相容舊帳號，顯示名稱改為「治癒型」；九隻貓維持上排治癒、中排攻擊、下排防禦。
- 新增每隻貓獨立的 HP／ATK／DEF 最終配點、技能威力與觸發率特性，高等級與高裝備時仍有明顯差異。
- 戰鬥 hook、遠征與貓咪詳情統一使用 `calcCatCombatStats()`，頁面新增三排定位與個體流派介紹。

## 2026-07-04（地下城 Boss、四階出怪與獎勵結算修正）

- 組隊遠征不再使用舊版三場直戰：改與單人共用前兩層 5×5 迷霧地圖、功能房、第三層分支、Boss 與寶藏房；房主控制路線並同步全隊，前衛／後衛、HP 與 buff 跨戰鬥保留。
- 組隊等待室移除 `h-full + overflow-hidden` 導致的手機捲動死鎖，改由主內容區統一捲動；開始／解散操作列固定於底部並加入安全區。
- 戰鬥進場外框與狀態徽章統一讀取怪物 `variant`；補回擊殺演出、裝備貓咪進場與攻擊回合，並修正寶藏房怪物卡片名稱 `undefined` 及翻牌無音效。
- 組隊地下城新增斷線恢復：進入地下城首頁時查找仍包含自己的未完成協調房，可手動返回等待室、進行中的戰鬥或尚未領取的結算。
- 3／6 箭與靶紙格式改由房主在進場前設定；單人、組隊協調房及每層戰鬥房共用同一設定，開始後鎖定，移除探索遭遇與戰鬥中的切換入口。
- 地下城三個功能分頁移除 `100dvh` 子畫面與巢狀垂直捲動，統一由 `MemberApp` 主內容區滾動；分頁列改為 sticky，手機滑動不再搶手勢。
- 地下城建立時固定守關 Boss，進場畫面放大並顯示 Boss、保證寶箱與 `×2` 掉落倍率。
- 修正高難度地下城仍可能抽到 T1 Boss：所有怪物改用地下城指定 Tier，一樓 weak、二樓 normal/strong、三樓 strong、王房 boss。
- 每隻遠征怪改掉對應族系／Tier 材料寶箱 ×2 與金幣寶箱 ×2。
- 寶藏房保留金幣噴泉，後續改為玩家逐張翻牌；最終報告加入總獎勵、隊員傷害與 MVP。
- 組隊領獎改為 Firestore transaction，並修正結算同步失敗、儲存槽靜默失敗及房主退出留下戰鬥房等問題。

## 2026-07-03（Phase G：單人遠征 5×5 迷霧格子重構 — Step G1~G3）

### 改了什麼

- **新檔 `src/lib/expeditionGrid.js`**（單人／團隊共用純函式）
  - `generateGridFloor(floorIndex, difficultyTier)`：5×5 格子抽 11~13 間連通房（邊界擴張生成，保證連通）；起點隨機、樓梯 BFS 放最遠；房型 = 保底戰鬥（依 `EXCAVATION_FLOOR_CONFIG.monsterCount`）+ 第 2 層 1 精英 + 1 休息 + 權重抽（events/traps/merchants/chests）。回傳 `{ size, grid, rooms, startPos, stairsPos }`，房物件 `{ id, type, label, pos:{x,y}, cleared }`。
  - `generateBranchFloor()`：第 3 層入口 → A/B/C 各「3 隨機功能房（保底 1 戰鬥）+ 休息」→ boss → treasure。
- **`DungeonExpedition.jsx` 全面重構**
  - 第 1、2 層 `GridMapStage`：SVG 迷霧地圖（只顯示已探索＋相鄰格）、點相鄰格移動、cleared 房自由通行不再觸發、樓梯站上後底部面板確認下樓。
  - 第 3 層 `BranchStage`：A/B/C 選定即鎖 → 依序進房 → 王 → 寶箱（`DungeonTreasureRoom`）。
  - 刪除佔位 `ExpeditionRoomStage`；商人/陷阱/事件/寶箱/休息房改復用多人元件的「本地單人模式」。
  - `playerState`（hp/maxHP/atk/def/buffs）全程跨房間跨樓層帶著走；戰鬥房出場從房間快照同步回來（`??` 防 0 復活）。
  - 事件效果本地映射：hp_restore_all/atk/def/dmg mult/gold_bonus 立即生效；monster_hp_mult 存下一層、monster_atk_mult 存本層（進戰鬥時乘到怪物身上）；skip_counter 僅存欄位（單人戰鬥房尚未支援，已註記）。
- **五個多人房間元件加 `localMode` 轉接**（DungeonShop/Trap/Event/Chest/Rest）
  - `localMode=true` 時 confirm/choice 走元件內部 state，效果經 `onLocalEffect`、結束經 `onLocalDone` 回父層，完全不寫 Firestore 房間文件；**多人路徑一行未動**（僅新增 gated 分支與 gated 音效）。
  - 陷阱房保留賭大小閃避；商店由父層 `onLocalBuy` 扣真金幣＋套效果；寶箱金幣經父層發放、收藏品照常寫 member 文件。
- **`DungeonTreasureRoom.jsx`** 加選填 `onLoot(loot)`：生成獎勵時回傳一次，單人遠征據此實發金幣＋收藏品（不影響原無 prop 行為）。
- **`expeditionDb.js`**
  - 修 bug：`grantExpeditionRewards` 用了 `increment` 但沒 import → 之前獎勵靜默發放失敗，已補 import。
  - `createExpeditionBattleRoom` buffs 改帶入 `memberData.buffs`（`??` 預設），讓商店符/事件 buff 進戰鬥生效。

### 為什麼

- 前一輪 AI 重構把遠征功能房弄丟成「只有繼續按鈕」的佔位畫面；本次照 Phase G 定案恢復並升級成迷霧格子玩法。

### 踩坑提醒

- 金幣顯示直接讀 `profile.coins`（useAuth 有 onSnapshot 即時同步），**不要**另外累計 delta，會雙算。
- `finishPendingRoom` 不可在 setState updater 內呼叫其他 setState（updater 必須純函式）。
- Step G4（團隊遠征接格子）尚未做；`TeamExpeditionBattle.jsx` / `expeditionTeamDb.js` 本次完全未動。

### 驗證

- `npm run build` 通過（Compiled successfully，無 ESLint 警告）。
- expeditionGrid 生成器 500+200 次隨機驗證：連通性、房數 11~13、entrance/stairs 唯一、第 2 層必有精英、每層必有休息與戰鬥、分支必含戰鬥＋休息，全數通過。

---

## 2026-07-03（Freebuff 交接後：組隊遠征一致性收尾）

### 修正內容

- `expeditionTeamDb.js`
  - 等待室加入改用 Firestore transaction，避免兩人同時加入突破 4 人上限。
  - 離房改用 `deleteField()`，不再留下 `null` 成員佔用名額。
  - 開始遠征時原子切換為 `expedition_active`，開始後不再出現在開放列表，也不能中途加入。
  - 建戰鬥房改為顯式傳入 `hostId`，不再依 Firestore map 順序猜房主。
  - 新增樓層成員狀態同步與全員結算領取追蹤。
- `DungeonLobby.jsx` / `DungeonTeamLobby.jsx`
  - 加入碼回傳真正房主資訊；離開等待室會實際移除成員。
  - 隊員初始戰鬥數值改由 `calcArcherStats + archerLevelBonus` 計算，不再全員落到 500/10/10 預設值。
- `TeamExpeditionBattle.jsx`
  - 只有房主能推進及清理戰鬥房，避免隊員先刪房造成房主卡住。
  - 非房主可正確收到 `expeditionPhase=result`，三層之間保留 HP／死亡狀態。
  - 結算獎勵由房主抽一次並同步全隊，畫面與實際發放不再重新抽值。
  - 最後一名領獎者才清理組隊協調房，避免房主先領造成隊員失去結算。
  - 增加建房／同步失敗畫面與重試，防止靜默卡在載入中。
- `DungeonExpedition.jsx`
  - 單人結算獎勵同樣固定一次，畫面與實際發放一致。
- `firestore.rules`
  - `members.update` 白名單加入 `expeditionRecords`，修正遠征紀錄被規則靜默阻擋。

### 儲存槽重要語意

- 保存地下城時已清除上一輪 pending/progress；開始遠征只消耗選定槽位。
- 儲存槽遠征成功、失敗或離開，都不得再呼叫 complete/abandon 清掉玩家正在累積的新一輪挖掘。
- 組隊遠征只消耗房主槽位；隊員的挖掘與槽位不受影響。

### 驗證

- `npm test -- --watchAll=false --passWithNoTests`：通過（專案目前無測試檔）。
- `npm run build`：production build 通過；只有既有 bundle size 與 Node `fs.F_OK` deprecation 警告。
- 尚需兩個真實帳號實測 Firestore 多客戶端流程。

### 測試工具踩坑（2026-07-03）

- 不要在使用者正在跑 `npm start` 的專案 `node_modules` 內臨時安裝 Playwright。一次 `npm install --no-save playwright-core` 逾時，留下半安裝的 `firebase/node_modules/@firebase/auth`，造成 development server 誤報所有 `firebase/auth` exports 不存在。
- 已用原 lockfile 執行 `npm install` 修復；`package.json` / `package-lock.json` 均無變動，production build 與 development bundle 都恢復。
- 後續瀏覽器自動化應放在獨立暫存目錄，避免 npm 重排正式專案依賴。

---

## 2026-07-14（三大地下城來源系統 + 組隊遠征接 DungeonBattleRoom）

### 改了什麼

**功能 A：地下城三大來源系統**

`dungeonExcavation.js` 完整重寫，三個獨立來源並存：

**① ⏳ 定時生成（新系統）**
- `initAutoDigTimer(memberId)` — 初始化隨機 24~144 小時倒數計時器，寫入 `autoDigNextAt`
- `checkAutoDigStatus(ex)` — 純函式，回傳 `{ ready, remainingMs }`
- `claimAutoDig(memberId)` — 時間到後領取，隨機 6 族 + T1~T6 均等，產出 `pendingReveal`
- `resetAutoDigTimer(memberId)` — 領取/保存/放棄後自動重設計時器（下一輪）
- `abandonExcavation` / `saveExcavation` 自動連動計時器重置

**② ⛏️ 練箭挖掘（公式修正）**
- `addExcavationByCheckin` → +20 進度（原 +10）
- `addExcavationByArrows` → 每箭 +1 進度（原 +0.3）
- `getTierProbabilities(dailyArrows)` — 回傳 T1~T6 機率陣列：
  ```
  maxTier = min(6, 1 + floor(dailyArrows / 30))
  每 30 箭提升一級最高可開等級，各級均等機率
  ex: dailyArrows=0 → T1=100%；dailyArrows=30 → T1=50%, T2=50%
      dailyArrows=60 → T1=33%, T2=33%, T3=33%
      dailyArrows=150 → T1~T6 各 ~16.7%
  ```
- `downgradeExcavationDifficulty` — 免費降級（T6→T1，無限制）
- `revealExcavation` — 改用機率表抽難度（取代舊 fixed 稀有度骰）
- 金幣強化保留（反向升級：向上升一級）

**③ 📜 世界王卷軸（新系統）**
- `grantDungeonScroll(memberId)` / `grantWorldBossDungeon`（別名）— 擊殺後給 1 卷軸
- `useDungeonScroll(memberId)` — 檢查 `scrollCount > 0` + `savedDungeons.length < 3` → 隨機生成 T1~T6 直接存入
- `getDungeonScrollCount(memberId)` — 讀取卷軸持有數
- worldBossDb.js `distributeWorldBossRewards` 改為呼叫 `grantDungeonScroll`（非直接寫入 savedDungeons）

**DungeonExcavationTab.jsx 三卡 UI**：
- 卡 1：⏳ 定時生成 — 倒數計時器 + 就緒時「領取」按鈕
- 卡 2：⛏️ 練箭挖掘 — 進度條 + T1~T6 即時機率表 + 揭曉 overlay（含免費降級/金幣強化）
- 卡 3：📜 世界王卷軸 — 持有數顯示 + 「使用」按鈕（偵測儲存槽空位）

**功能 B：組隊遠征路由修正（接現有 DungeonBattleRoom）**

之前組隊遠征出發後錯誤地進了 `DungeonExpedition`（單人遠征），現在改接現有的多人戰鬥系統：

- `expeditionTeamDb.js`：新增 `createTeamExpeditionBattleRoom(members, monster, ...)` — 建立含所有隊員 HP/ATK/DEF 的戰鬥房間
- `DungeonBattleRoom.jsx`：新增 `expeditionMode` prop — 遠征模式跳過個人獎勵，僅 host 可呼叫 `returnToMapAfterBattle`
- **NEW** `TeamExpeditionBattle.jsx`：三層團隊戰鬥管理器 — 房主生成怪物 → 創建戰鬥房間 → 全員進 `DungeonBattleRoom` → 樓層推進 → 結算畫面
- `DungeonTeamLobby.jsx`：開始按鈕傳遞全員資料給 `onStart`
- `DungeonLobby.jsx`：組隊遠征改走 `TeamExpeditionBattle`；非房主自動訂閱組隊房間偵測戰鬥開始

### 為什麼
- 原本練箭挖掘的公式太慢（+0.3/箭）且機率不透明，玩家不知道要練多少箭才能開高等
- 世界王掉落應該要讓玩家可以選擇「何時使用」，而非直接塞入槽位（可能滿槽）
- 組隊遠征之前偷懶接了單人遠征( Expedition)，應使用現成的多人戰鬥系統

### 踩坑提醒
- `grantWorldBossDungeon` 和 `adminSetSavedDungeon` 共享 ~80% 邏輯（讀取→檢查→寫入），若有更多「幫玩家加地下城」函式出現，建議萃取共用 helper
- `getTierProbabilities` 是純函式，不直接讀 Firestore——`dailyArrows` 由上層傳入
- 組隊遠征的 `createTeamExpeditionBattleRoom` 怪物參數必須含所有戰鬥數值（HP/ATK/DEF/rewardMult），否則 `DungeonBattleRoom` 會算錯
- 非房主訂閱組隊房間的 `currentBattleRoomId`，變更時自動切換 `DungeonBattleRoom`；不需要手動清理舊房間

---

## 2026-07-03（音效/動畫批次 C：慶祝與獎勵層 — Confetti + 分階段音效）

### 改了什麼

**新元件 `src/components/shared/Confetti.jsx`**
- 全螢幕彩帶粒子（canvas、零依賴）：props `pieces/duration/colors/onDone`
- 尊重動畫開關：`<html class="no-anim">` 時直接跳過（立即 onDone）
- 播完自動停 rAF、unmount 自動清理；`pointer-events:none` 不擋點擊

**慶祝時刻接線**
- `ArrowMilestonePopup.jsx`：Big（百箭）→ `sfxVictoryFanfare` + Confetti；Small → `sfxLevelUp`（遵守「不干擾戰鬥」原則，小里程碑不用全螢幕）
- `CardCollection.jsx`：升星成功 `sfxLevelUp` / 失敗 `sfxError` / 神話選屬性 `sfxBuff`（原本全程無聲）
- `MemberMaterials.jsx`：碎片合成銀章 → Confetti；epic/legendary 藥水合成 → Confetti；開箱結果含卡片/貓/全開 → Confetti；金幣寶箱開箱 → `sfxSuccess` 後 350ms 追加 `sfxCoinDrop`
- `GachaMachine.jsx`：抽到新卡 showing 階段 → Confetti（`key` 換 idx，十連抽每張新卡各播一次）

### 為什麼
- HonorCelebration 已有自製 canvas 煙火，**不**重複疊加
- 震動回饋已內建在各 sfx 函式（批次 A 的 vibrate 閘門管制），無需另做

### 踩坑提醒
- Confetti 想「重播」要換 `key`（同 fx-bounce 的教訓）；同 key 重 render 不會重播
- Confetti 不傳 `onDone` 也安全：rAF 播完自停，canvas 留著透明直到 overlay unmount
- 待做批次 D：戰鬥層（受擊震屏、爆擊 hit-stop、怪物死亡溶解）

---

## 2026-07-03（音效/動畫批次 A+B：全域開關基礎設施 + UI 回饋層 + 亂播音效/畫面亂跑修復）

### 改了什麼

**批次 A — 基礎設施**
- `src/lib/fxSettings.js`（新檔）：音效/動畫全域開關，localStorage `fx_sound`/`fx_anim`（預設開）；動畫關閉或系統 `prefers-reduced-motion` → `<html class="no-anim">`；`initFxSettings()` 在 `index.js` render 前呼叫
- `sound.js`：`ctx()` 單點總閘門（音效關閉回 null，所有合成音效靜音）；`playAudio`（mp3）/`vibrate` 各自補 guard（震動跟隨音效開關）；新增 UI 音效家族 `sfxSwitch`/`sfxOpen`/`sfxClose`/`sfxError`
- `index.css`：`.no-anim` 全域抑制（animation/transition/scroll-behavior + View Transitions pseudo）；`fx-` 前綴通用動畫庫（pop-in/fade-up/shake/pulse-glow/float-up/bounce-once）+ utility classes（`.fx-pop`/`.fx-shake`…）
- `MemberProfile.jsx`：新增 `FxSettings` 卡（🔊 音效與震動 / ✨ 介面動畫 兩個 toggle，44px 觸控目標），放帳號設定上方

**批次 B — UI 回饋層**
- `shared/UI.jsx` Btn：全站按鈕點擊音（`sfxTap`），新增 `silent` prop 逃生門（自帶音效的按鈕可關）
- `MemberApp.jsx` 底部 nav：切換 tab 播 `sfxSwitch` + icon `fx-bounce` 彈跳（用 `key={active}` 重掛重播動畫）
- `shared/Widgets.jsx`：新增 `CountUp` 數字滾動元件（easeOutCubic，`.no-anim` 時直接跳值）；header 三個貨幣 chips 改用 CountUp；`StatBar` 滿值時 `fx-pulse` 發光

**Bug 修復（使用者回報「亂播音效、畫面亂跑」）**
- `AdminApp.jsx`：`pendingMonthlyRef` 初始 `0` → `null`——首次 Firestore 快照若已有 pending 月卡申請，開頁就播 `sfxNotify`（亂播音效根源之一）；改為首次快照只記錄不播
- `MonsterBattle` / `DungeonBattleRoom` / `PartyBattleRoom` 三處戰鬥 log 捲底：`scrollIntoView({behavior:"smooth"})` 補 `block:"nearest"`——預設 `block:"start"` 會把**所有可捲動祖先**（含整頁）捲到元素置頂，戰鬥中 log 每更新一次整頁被拉走（畫面亂跑根源）

### 為什麼
- 使用者要求全面加音效/動畫前，必須先有全域開關（否則吵到使用者無法關）與 reduced-motion 尊重
- 教練後台 12 秒提醒輪播（`pendingCheckinAwaitN`）是刻意設計（工作電腦提醒用），保留但現在受音效總開關管制

### 踩坑提醒
- **腳本生成的檔案要跑 parse check**：`monsterConfig.js` 混入 4 行 shell 指令 `echo "Phase N done"`（phase 腳本 heredoc 貼歪），造成 build 失敗；已清除。快速全樹檢查：`@babel/parser` 掃 `src/**/*.{js,jsx}`（179 檔數秒完成）
- **音效總閘門在 `ctx()` 單點**：所有直接 `const c = ctx()` 的合成函式自動被閘；日後新增音效不需個別 guard，但 mp3（`playAudio`）與 `vibrate` 是獨立路徑要記得
- **`scrollIntoView` 不加 `block:"nearest"` = 整頁亂捲**：日後任何 log 捲底一律加
- **Firestore 訂閱首次快照會觸發「計數增加」判斷**：比較型音效（n > prev）ref 初始值要用 `null` 區分「尚未收到首次快照」
- `fx-bounce` 重播靠 `key` 換值重掛元素；純 class 切換不會重播 CSS animation
- 待做批次：C（慶祝 confetti/fanfare/震動）、D（戰鬥 screen shake/hit-stop/死亡溶解）

---

## 2026-07-03（UI 全面改版 Phase 3：會員端逐頁套版完工）

### 改了什麼

Trellis 任務 `07-03-ui-redesign-p3`（commit `997c0ec` 主體 + `a340aa1` 檢查修正）：

- **Step 1-2 訓練/排行系列**：MemberComps / MemberScoring / MemberLeaderboard / MemberHistory / MemberExternalComp 淺色 class 全改 token tint；MemberPractice / DailyQuest / MemberRecordsHub 勘查後已是深色原生零改動
- **Step 3-4 我的/背包系列**：MemberProfile / MemberAchievements / MemberNotifications / MemberMessages / MemberLearn / MemberCertExam / MemberDex / MemberGuide / MemberBowSettings / CardCollection / MemberMaterials / MemberMonsterDex 共 12 檔套版；CoinShop / EquipmentPage 原生深色零改動
- **constants.js**：`COMP_TYPE_COLOR` 加 `darkText` key（additive）；`certLevelStyle` 的 `soft` 深色化 + 新增 `softLight`（原淺色）
- 品質檢查 8 項全過：build 無警告、純視覺 diff（handler/props/訂閱零改動）、無循環 import、覆寫層未動

### 踩坑提醒
- **`certLevelStyle("soft")` 深色化會讓未遷移的後台白卡上徽章隱形** → 後台（AdminApp CompDetail）改用 `softLight`；日後改共用 style 函式時要 grep 所有呼叫點確認背景色
- 刻意保留的功能性白底：MemberMaterials 慶祝彈窗 CTA、MemberProfile 宇宙星點、MemberScoring 10 分金色鈕
- UI 改版剩餘（另開任務）：後台 AdminApp 系列、shared/Equipment.jsx 內層、戰鬥頁 token 收斂 → 全部完成後才能刪 `.content-area` 覆寫層

---

## 2026-07-03（UI 全面改版 Phase 0-2：設計系統 + 導覽 + 首頁儀表板）

### 改了什麼

**Phase 0 — 設計系統**（Trellis 任務 `07-03-ui-redesign-p0`）
- `index.css`：`:root` 補齊 design tokens（語意色 success/warn/danger/info 各 fg+bg、accent/accent-soft/primary、圓角 --r-sm~xl、陰影、玻璃卡 --glass-*）；新增 `.ui-card` / `.ui-input` 元件層 CSS 類
- `shared/UI.jsx`：15 個共用元件全部深色 token 化（dark-first）；Card light/dark 都輸出玻璃卡；Btn 淺色 variant 改深色視覺、`dark-*` 變 alias、新增 `outline`；API 完全向後相容（props/variant key 零刪除）
- `shared/Widgets.jsx`（新檔）：SectionHeader / StatBar / ProgressRing / Skeleton / HubTile
- `theme.js` 收斂為單一 navy 主題（API 保留；舊 localStorage 值自動 fallback）；MemberProfile 主題選擇器以 `APP_THEMES.length > 1` 守門隱藏

**Phase 1 — 導覽**
- MemberApp header：頭像+等級環（ProgressRing + archerXPProgress）、檢定 pill、金幣/箭露/轉蛋幣 chips（點擊跳轉）、通知鈴鐺紅點
- 底部 nav：token 化、active 金色指示條、觸控目標 ≥44px（NAV_PRELOADS / viewTransitionName 保留）
- 四個 hub 頁（Adventure/Training/Inventory/Records）改 SectionHeader + HubTile 2 欄格線；入口改 module-level 常數陣列；hub 新增選用 prop `badges = {}`

**Phase 2 — 首頁儀表板**（MemberHome）
- 今日卡：報到狀態 pill + 今日箭數 + 下一每日里程碑 ProgressRing（用 `ALL_MILESTONES`）
- 進行中卡（無內容整卡隱藏）：世界王入口 / 遠征 3 槽倒數（舊 `expedition` 欄位兼容為槽 0）/ 村目標 StatBar（用既有 `subscribeActiveGoal`）
- MemberApp/AdminApp 新增下傳 props：`todayCheckin`、`worldBoss`（掛既有訂閱 callback，零新增 Firestore 讀取）
- 快速入口 4 格：打怪/自主練習/商店/排行榜；cell-*.webp 引用全數移除（檔案保留）

### 為什麼
- 原本深色 = 靠 `.content-area` 覆寫 Tailwind 淺色 class 的補丁層，顏色散落各元件難維護（後台 16 處白底事件的病根）
- 收斂 token 後元件原生深色，不再命中覆寫規則；覆寫層暫留保護未遷移頁面（比賽/練習/排行等）

### 踩坑提醒
- **Tailwind 是 CDN 版**（非 build-time）：focus/placeholder 偽類要寫在 index.css 純 CSS 類（`.ui-card`/`.ui-input`），不能靠任意 Tailwind class
- **HubTile 的 `accent` 必須傳 6 碼 hex**：內部 `${accent}26` 疊 15% 透明層，傳 `var(--xxx)` 會產生非法 CSS（預設值地雷已修為 `#f59e0b`）
- **BillingSystem / CatVillage 零依賴 shared/UI**（全自帶樣式），深色化不影響
- 全站原本沒有任何呼叫點傳 `theme` prop 給 Card → 統一深色安全
- 待實機驗證（靜態檢查無法取代）：教練切射手模式逐頁不空白、390px 手機寬 header/nav 排版

---

## 2026-07-02（Firestore 規則補 totalArrowsAllTime + dungeonClearLog + dungeonFirstKills）

### 改了什麼

**根因分析**：
- `addRoundArrows(memberId, count)` 每回合射完箭就呼叫 `increment("totalArrowsAllTime")`
- 但 Firestore 安全規則的 `members.update` 中 `hasOnly([])` 沒有包含 `totalArrowsAllTime`
- 會員自己更新 `members` 文件時，Firestore 比對 affectedKeys → 發現 `totalArrowsAllTime` 不在允許清單 → **拒絕寫入**
- 效果：終身箭數永遠不會增加，所有依賴 `totalArrowsAllTime` 的功能（里程碑、村目標貢獻、排行榜）都拿不到正確資料

**修正**（`firestore.rules`）：
- `members.update` 的 `hasOnly()` 加入 `"totalArrowsAllTime"`
- 同時補上 CLAUDE 版本中已有的 `"dungeonClearLog"` 和 `"dungeonFirstKills"`（本地檔案 vs Firebase 已同步，但跟 CLAUDE 版本有差異）

### 踩坑提醒
- **`totalArrowsAllTime` 是隱形的 bug**：`addRoundArrows` 有 `.catch(() => {})`，寫入失敗完全靜默，沒有人發現箭數沒累積
- **日後新增 member 欄位**時，若會員需要自行更新（非 only admin），務必同步加到 `hasOnly()` 列表，否則 Firestore 靜默擋掉
- **Firebase Console 部署**：CLI `firebase deploy --only firestore:rules` 有 403，需手動將 `firestore.rules` 內容貼到 Firebase Console → Firestore → 規則

---

## 2026-07-02（Firestore 規則補齊 + 射箭里程碑多回合修正）

### 改了什麼

**firestore.rules — 補 villageGoals / cardMarket**
- `villageGoals`：原本完全沒有規則 → 預設 deny，教練無法發佈村目標
- `cardMarket`：原本在 `service cloud.firestore { }` 的 **外面**（無效位置），移入正確位置
- `villageGoals` 規則：`read/create/update` 登入者皆可（autoSpawnVillageGoal 由前端觸發）；`delete` 限 admin

**MonsterBattle.jsx — 修正多回合箭數計算**
- 根本原因：`setRoundScores` 只在 `BATTLE_WIN/LOSE` 事件（最終回合）呼叫，非最終回合從未 push
- 導致：`endBattle` 裡 `roundScores = []`，`practiceRounds.flat().length = 6`（永遠只有最後一回合）
- 修正：非最終回合路徑（line ~682）補加 `setRoundScores(prev => [...prev, {round, scores: midRoundArr}])`
- 里程碑計算：加 `sessionArrowsRef`（`useRef(0)`），跨回合累積；`getMilestonesReached(oldSession, oldSession + arrowCount)` 取代舊的 `getMilestonesReached(0, arrowCount)`
- `startBattle` 時 `sessionArrowsRef.current = 0` 重置（新一場重算）

**WorldBossAttack.jsx — 補里程碑觸發**
- 世界王完全沒有里程碑邏輯
- 在 `addRoundArrows` 之後補 `getMilestonesReached(0, totalArrowsSent)` + `grantArrowMilestoneRewards`
- 加 `milestoneQueue` state + `SmallMilestonePopup` 在 result 頁面顯示

### 踩坑提醒
- **Firestore 規則在正確 service block 內部**：`match /databases/{database}/documents { }` 裡才有效；外面的規則一律被忽略（cardMarket 已修）
- **React 非同步 state**：`endBattle` 閉包捕獲的 `roundScores` 是呼叫當下的 stale value；這就是為什麼 `lastRoundArr` 要單獨傳入。但非最終回合若從未呼叫 `setRoundScores`，前幾回合分數就全丟了
- **`sessionArrowsRef` 跨打怪局累積**：同一個 session 打多隻怪時里程碑正確遞增，不會每局重從 0 算（`grantArrowMilestoneRewards` 已有每日防重複保護）
- CLI `firebase deploy --only firestore:rules` 有 403，**規則必須手動貼到 Firebase Console**

---

## 2026-07-02（BattleResultPanel 統一結算 — WB / Party / Dungeon / Duel）

### 改了什麼

**BattleResultPanel.jsx — PartySection 新增 isMvp + alive 支援**
- `isMvp === true` → 顯示 "👑 MVP" 黃色 badge（緊接在名字旁）
- `alive === false` → 顯示 "💀 陣亡" 紅色 badge，頭像半透明，傷害字體變灰
- `m.crits ?? 0` 防 undefined 爆炸

**WorldBossAttack.jsx — 結果畫面重整**
- `wbResultConfig` 追加 `showDmgDealt: true` + `showCritCount: true`
- 移除舊 "戰鬥報告" div（5 行 BattleStatRow），改成精簡的 3 行：機器人傷害（conditional）+ 本次總傷害 + Boss 剩餘 HP
- 移除 allRounds 回合 log 顯示（資訊移入 BattleResultPanel 分數分布）
- `BattleResultPanel` 現在一次顯示：傷害 + 爆擊 + 平均分 + 箭數 + 回合數 + 分數分布

**PartyBattleRoom.jsx — 戰績表統一進 BattleResultPanel**
- 在 `mvpId` 計算之後，將 `partyResultData.party` 補入隊伍成員（含 `isMvp` / `alive`）
- `partyStatsConfig` 追加 `showPartyMembers: true` + `showPartyLeader: true`
- 移除舊的 `statsList.map(...)` JSX 詳細戰績表 div
- 結算頁現在只有一個 `<BattleResultPanel>` 統一呈現（含怪物資訊、個人統計、隊伍成員）

**DungeonBattleRoom.jsx — 普通房間結算改用 BattleResultPanel**
- 新增 import `BattleResultPanel`, `RESULT_CONFIG_DUNGEON`
- 舊的「本房間獎勵」div 完全移除，改為 IIFE 計算 `dungeonRoomData` + `dungeonRoomConfig`
- drops 包含：coins / materials / arrowDew / chest（chestCount > 0 → true）
- stats：從 `room.log` 加總個人傷害，有傷害才顯示 `showDmgDealt`，沒有 log 則 stats = null
- 另加獨立「經驗獎勵」block（archerXP / catXP / gachaCoins）和收藏品 block

**DuelRoom.jsx — 結算統計改用 BattleResultPanel**
- 新增 import `BattleResultPanel`
- 計算 `duelArrowBreakdown`（從 log.attacks 過濾自己的 arrowBreakdown）→ scoreBreakdown / avgScore / critCount
- 舊的 3 個 BattleStatCard flex div 替換為 `<BattleResultPanel>` 顯示完整統計
- `duelStats` 累積戰績保留為獨立的 BattleStatCard

### 踩坑提醒
- `partyResultData.party` 要在 `mvpId` 算完後再賦值（statsList 才有 mvpId 可用）
- DuelRoom 的 `arrowBreakdown` 在 log 裡是 per-attack 層級（`entry.attacks[].arrowBreakdown`），不是 per-round
- Dungeon non-boss 的 `loot.arrowdew`（小寫 d）要對應到 `drops.arrowDew`（大寫 D）

---

## 2026-07-02（事件彈窗倒數 + banner 淡出 + 角色往上攻擊動作）

### 改了什麼

**事件彈窗：5 秒倒數 + 自動繼續（PartyBattleRoom.jsx）**
- 新增 `eventCountdown` state（預設 5）
- 新增 `useEffect` 監聽 `showEvent`：每秒 -1、5 秒後自動執行 dismiss 邏輯
- 彈窗 UI 加入圓形倒數圓環 + "點擊或等 X 秒繼續" 文字
- 自動倒數的 dismiss 邏輯直接在 effect 內執行（不呼叫 `handleDismissEvent`，避免 stale closure）

**「玩家回合」banner 先淡出再攻擊（useMiniRoundReveal.js + PartyBattleRoom.jsx）**
- `useMiniRoundReveal` 新增：在 `initialDelay - 500ms` 觸發 `setAnimPhase("bannerFadeOut")`
- `"bannerFadeOut"` 相位：banner 播 `party-banner-exit 0.5s ease forwards`（縮小淡出）
- 等 0.5s 動畫跑完，第一個 mini 才開始（攻擊開始時 banner 已消失）
- 新增 CSS `@keyframes party-banner-enter`（進場）、`party-banner-exit`（退場），取代舊的 `mb-float`（定位會跑掉）
- Banner JSX 加 `key={isCounter ? "counter" : "player"}` 讓 React 重新 mount 觸發進場動畫

**角色往上攻擊動作（PartyBattleRoom.jsx）**
- `mb-archer-attack` 改成 `translateY`：`0→-22px→-10px→0`（向上衝刺再落回）
- 時長從 0.4s 改為 0.55s
- 觸發條件不變：`isTopHit && !animCounter`（傷害最高的玩家才播）

### 踩坑提醒
- `"bannerFadeOut"` timer 要判斷 `!activeRef.current`，否則 stopReveal 後舊 timer 仍觸發
- 倒數 effect 的 auto-dismiss 直接用 `pendingRevealRef.current`（ref 永遠是最新值），不呼叫 `handleDismissEvent`（stale closure 問題）
- `party-banner-enter/exit` 的 transform 必須包含 `translate(-50%,-50%)`，否則定位錯誤（banner 使用 absolute + left:50% + translate 定位）

---

## 2026-07-02（怪物被秒殺沒看到死亡動畫）

### 改了什麼

**單人打怪（BattleAnimation.js）**
- 新增 `playBattleWin(d, p)` 函式並加入 `EVENT_DISPATCH`
- 效果：`anim.hit(true)`（怪物閃白 crit 效果）+ `sfxCritBoom()` + `await d.delay(2000)`
- 意義：以前 `BATTLE_WIN` 在 EVENT_DISPATCH 沒有對應動畫，擊殺後幾乎瞬間跳結算；現在有 2 秒停頓讓玩家看到擊殺

**組隊打怪（PartyBattleRoom.jsx）**
- 新增 `isKillingRound` 判斷：`entry.miniRounds.some(m => m.monsterHPAfter <= 0)`
- 擊殺回合 `entryEndExtra: 3500`（一般 1500ms）
- `onEntryEnd` 播 `sfxMonsterDead()` + 600ms 後 `sfxSuccess()`
- 新增 `sfxMonsterDead` import
- 新增「💀 擊倒！」全畫面 overlay：當 `liveEntry !== null && displayHP <= 0` 時出現，持續到結算畫面
- `handleDismissEvent` 也加入 `isKillingRound` 邏輯（事件觸發死亡的情況）

### 踩坑提醒
- `entryEndExtra` 只影響最後一個 mini 結束 → `setLiveEntry(null)` 的等待時間，並非動畫速度
- `displayHP` = `curMini?.monsterHPAfter ?? room.monsterHP`；殺死那一箭的 mini HP after = 0，overlay 在那瞬間出現
- 擊殺 overlay `zIndex:44`，比事件彈窗（50）低，不會擋住隨機事件確認

---

## 2026-07-02（「玩家回合」banner 與攻擊同時顯示）

### 改了什麼

**`src/battle/useMiniRoundReveal.js`**
- 玩家攻擊 mini 觸發時，`setAnimPhase("attacking")`（原本是 `"player"`）
- 現在 `animPhase` 語意：
  - `"player"` = initialDelay 預備期（banner 顯示，還沒開打）
  - `"attacking"` = 玩家實際攻擊中（banner 消失）
  - `"cat"` = 貓貓攻擊中
  - `"counter"` = 怪物反擊中

**`src/components/party/PartyBattleRoom.jsx`**
- Banner 條件從 `animPhase === "player" && liveMiniRoundIdx === 0 && !curMini?.isCounter` 簡化為 `animPhase === "player"`
- `initialDelay` 從 1200ms 改為 2000ms（兩個 startReveal 呼叫點都改）

### 踩坑提醒
- 舊條件 `liveMiniRoundIdx === 0` 是錯的：第一個 mini 開始後 idx 仍為 0，導致 banner 和攻擊同時顯示
- `"attacking"` 是新加的相位值，不出現在 banner 判斷裡（直接忽略）

---

## 2026-07-02（隨機事件彈窗暫停後續動畫）

### 改了什麼

**問題**：事件彈窗出現後，後面的箭矢/反擊動畫繼續跑，玩家無法在彈窗出現時暫停觀看。

**單人打怪（MonsterBattle + RoundController）：**
- `RoundController.playEvents` 第 4 步改為 `await handlers.onRandomEventEnd?.()`（加 await）
- `onRandomEventEnd` 現在回傳 Promise，把 `resolve` 存進 `randomEventResolveRef`
- 事件卡 UI 改為點擊才能繼續：點擊後清 `currentEvent`、還原 `battlePhase`、呼叫 `resolve()`
- 效果：箭矢動畫等玩家點事件卡才開始

**組隊打怪（PartyBattleRoom）：**
- 有 `entry.event` 時：不立即呼叫 `startReveal`，改把 entry 存進 `pendingRevealRef`，顯示彈窗
- 新增 `handleDismissEvent()`：玩家點彈窗後清 `showEvent`、讀 `pendingRevealRef`、才呼叫 `startReveal`
- 彈窗改為 `cursor:pointer`、移除 `pointerEvents:none`，顯示「點擊繼續 ▶」提示

### 踩坑提醒
- `onRandomEventEnd` 必須回傳 Promise，否則 `await` 會立即通過（undefined 被 await 視為 resolved）
- Party mode：`startReveal` 必須在 `handleDismissEvent` 裡呼叫，才能拿到最新的 `room?.members`
- 組隊事件彈窗原本有 `pointerEvents:"none"` — 要刪掉才能接收點擊事件

---

## 2026-07-02（BattleEngine 隨機事件重排：Phase 0 先行）

### 改了什麼

`src/battle/BattleEngine.js` 回合順序重整：

**舊**：箭矢 → 隨機事件 → 貓貓 → 怪物反擊

**新**：Phase 0 隨機事件 → Phase 1 玩家箭矢 → Phase 2 貓貓回合 → Phase 3 怪物回合

技術重點：
- `const effATK` 改 `let`，Phase 0 更新 `curATKMod` 後立即重算，讓 ATK buff/debuff 影響本回合箭傷
- Phase 0 若直接擊殺怪物提前返回 `BATTLE_WIN`
- MonsterBattle 的 `RANDOM_EVENT` handler 不需修改：事件在列的第一個 → UI 自動先彈 popup，確認後才播箭矢動畫

兩種「隨機事件」釐清：
- **狀態隨機事件**（`RANDOM_EVENTS`）→ Phase 0，影響 ATK/HP/skipCounter
- **貓貓反應訊息**（`triggerCatAction()`）→ 每箭命中觸發，純 UI 文字，不動

### 踩坑提醒

- ATK 修正在 Phase 0 後必須同步更新 `effATK`，否則箭傷用舊值
- Phase 0 結束若 monsterHP ≤ 0，`processedArrowScores` 為空，BATTLE_WIN handler 從組件 `arrows` state 讀已輸入分數

---

## 2026-07-02（移除報到限制 + 下課里程碑全覽板）

### 改了什麼

**邏輯調整：移除「需報到才能累積箭數」限制**
- `MonsterBattle.jsx`：`addRoundArrows` 和 `addPracticeLog` 的呼叫條件從 `checkinActive && profile?.id` 改為只要 `profile?.id && !isGuest`，即不管有沒有報到，射箭都會記錄
- 箭露和里程碑獎勵仍需點「下課」才兌換

**DailyQuest.jsx 大改版**
1. `subscribeTodayPracticeLogs` 移除 `DIRECT_SOURCES` 過濾 → 全模式射箭都計入「今日箭數」
2. 「今日 X 箭」卡片：只要 `todayArrows > 0` 就顯示（不限狀態）
3. 下課確認對話框新增「今日里程碑全覽板（`MilestoneBoard`）」：全部 11 個門檻，解鎖=亮色，未解鎖=暗色 35%，附帶進度條
4. `arrowMilestone.js` 新增 `export const ALL_MILESTONES`（原本未導出）

### 為什麼

射手不知道射箭里程碑有獎勵，每次只看到 6 箭 popup。改成在「下課」時一次顯示全覽板，讓學生清楚今天解鎖了哪些、還差多少到下一個。

### 踩坑提醒

- `addPracticeLog` 的 `totalArrows` 用於 `subscribeTodayPracticeLogs` 計算今日總量；`addRoundArrows` 只更新 `totalArrowsAllTime`，兩者不重疊
- DIRECT_SOURCES 移除後，party/duel/dungeon 的 session-end log 也計入 todayArrows，但這些在戰鬥結束後才寫，中途不會立即反映
- `MilestoneBoard` 是純 UI 預覽；`grantArrowMilestoneRewards` 在 `confirmClassEnd` 才實際寫 Firestore

---

## 2026-07-02（戰鬥回合大重構：大回合制 + 箭數選擇）

### 總覽

將地下城（`dungeonDb.js`）和組隊（`partyDb.js`）的回合邏輯從「每 2 箭中途反擊」改為「全箭打完後大回合末唯一一次反擊」，並新增 3/6 箭數選擇 UI。

### 改了什麼

- **`src/battle/BattleConfig.js`**：移除 `COUNTER_INTERVAL`，新增 `ARROWS_OPTIONS = [3, 6]` 和 `ARROWS_PER_ROUND_DEFAULT = 6`
- **`src/lib/dungeonDb.js` `processDungeonRound`**：`ARROWS_PER_CTR` 移除，迴圈改用 `room.arrowsPerRound || 6`，反擊移至貓貓攻擊後（大回合末唯一一次）
- **`src/lib/partyDb.js` `processPartyRound`**：三輪雙箭迴圈改為每位玩家一個 mini-round 含全部箭矢（`arrowsPerRound` 箭）
- **`src/components/dungeon/DungeonBattleRoom.jsx`**：`status === "waiting"` 顯示 3/6 箭選擇 UI（房主可設定，他人唯讀）；戰鬥中各箭數相關 hardcode 6 改為讀 `room.arrowsPerRound || 6`
- **`src/components/party/PartyBattleRoom.jsx`**：等待室加入 3/6 箭選擇 UI（同樣邏輯）

### 為什麼

玩家反映「每 2 箭反擊」節奏太快、多人局搞混不清楚傷害輸出，改成大回合末反擊可讓玩家先看到全部攻擊動畫再承受一次反擊，節奏更清晰。

### 踩坑提醒

- `ctrAccum` 累積保留（dungeonDb 用於 `ctrHitsThisFloor` 難度追蹤）
- `partyDb.js` 新循環中 `totalDmgP` 是 block-scoped，不衝突外層的 `totalDmg`
- `DungeonBattleRoom` 的 `status === "waiting"` 在地圖模式下幾乎不會被到達（DungeonController 只對 active/completed/path_select/floor_transition 顯示 DungeonBattleRoom）；但保留此 UI 確保非地圖模式兼容
- `BattleEngine.js` 不需修改（已是大回合末單次反擊結構，且未使用 `COUNTER_INTERVAL`）

---

## 2026-07-02（角色系統修正 + 統一箭數更新）

### 改了什麼

**修正 1：PartyBattleRoom 移除「自由選擇前後衛」按鈕**
- 原本在輸入區域有一組 ⚔️前衛 / 🛡後衛 toggle button，讓玩家可以在戰鬥中途自由切換，脫離原本設計
- **根本原因**：`myRole` 已由 Firestore 透過 `useEffect` 同步（`if (serverRole) { setMyRole(serverRole); }`），只要前後衛分配在遊戲開始時確定，玩家就不應再手動切換
- **修正**：移除前衛/後衛 toggle buttons；改為只在 `myRole === "rear"` 時顯示「後衛行動選擇」（heal/dmg），附加「後衛」提示標題，與 DungeonBattleRoom 的設計一致
- **踩坑提醒**：DungeonBattleRoom 的角色鎖定設計一直是正確的（只在 `me.role === "rear"` 時顯示後衛選項），PartyBattleRoom 是後來寫的時候誤加了 toggle

**修正 2：統一每回合箭數更新（totalArrowsAllTime）**
- **背景問題**：`addPracticeLog` 是在戰鬥結束後才批次更新 `totalArrowsAllTime`，若連線中斷或 Firestore 規則問題會導致整局箭數遺失
- **修正**：
  - `db.js` 新增 `addRoundArrows(memberId, count)` — 只更新 `members/{id}.totalArrowsAllTime: increment(count)`，輕量且即時
  - `db.js` 從 `addPracticeLog` 移除 `totalArrowsAllTime` 更新（避免雙重計算）
  - `useFirestoreRound.js` 新增 `onSubmitSuccess(...extraArgs)` callback（用 ref 存，避免 stale closure），submit 成功後立即呼叫
  - **Party** / **Dungeon** / **Duel**：在 `useFirestoreRound` 的 `onSubmitSuccess` 呼叫 `addRoundArrows(myId, arrows.length)`
  - **MonsterBattle**：在 `submitRound` 開頭（引擎前）呼叫 `addRoundArrows(profile.id, arrowsPerRound)`，只有 `!isGuest && checkinActive` 時才執行
  - **WorldBossAttack** / **CouncilBattle**：在 `addPracticeLog` 呼叫前加 `addRoundArrows(myId/memberId, totalArrows)`

### 踩坑提醒

- `addPracticeLog` 現在**不再**更新 `totalArrowsAllTime`；所有模式必須自己呼叫 `addRoundArrows`，否則終身箭數不會累計
- `onSubmitSuccess` 的參數是 `...extraArgs`（即 `handleSubmit` 的參數），DuelRoom 的 extraArgs 是 `(team, arrows, target)`，所以 callback 要 `(_team, submittedArrows) => ...`
- CouncilBattle 的 `logCouncilArrows` 是在戰鬥結束後才呼叫（不是每回合），所以它的 `addRoundArrows` 是一次補計整場所有箭數，仍屬於「結束時更新」——若要改成真正每回合更新，需要在 Council 的回合 submit 處理

---

## 2026-07-02（Check Agent 補丁：PartyBattleRoom + DungeonBattleRoom 修正）

### 改了什麼

**`src/components/party/PartyBattleRoom.jsx`（3 項修正）**：
1. 移除 `const [room, setRoom] = useState(null)` — 此 state 從未被更新（訂閱已由 `useFirestoreRound` hook 內部處理），導致 `room` 永遠是 `null`，畫面永遠顯示「載入中…」
2. 改為從 `useFirestoreRound` 的返回值解構取得 `room`（`const { room, handleSubmit, ... } = useFirestoreRound(...)`）
3. 將 `const myId = ...` 移到 `useFirestoreRound` hook 呼叫之前（原在第 185 行，hook 在第 119 行）— 避免 `const` 時間死區（TDZ）錯誤，`myId` 在 hook 呼叫時必須已初始化

**`src/components/dungeon/DungeonBattleRoom.jsx`（1 項修正）**：
1. 第 1469 行：`setSubmitted(false)` → `setFsSubmitted(false)` — `setSubmitted` 已在解構時別名為 `setFsSubmitted`（`setSubmitted: setFsSubmitted`），直接呼叫 `setSubmitted` 會拋出 ReferenceError

### 為什麼

這兩個 bug 是在 `useFirestoreRound` hook 整合時引入的——hook 的訂閱結果（`room`）沒有被組件使用，且變數別名沒有同步更新呼叫端。

### 踩坑提醒

- `useFirestoreRound` 回傳 `{ room, setRoom, submitted, setSubmitted, handleSubmit, localProcessing }`，呼叫端若需要 `room` 必須明確解構
- 解構時使用別名（如 `setSubmitted: setFsSubmitted`）後，呼叫端所有地方都要用別名，不可再用原名

---

## 2026-07-01（Phase 1-6 戰鬥系統全面模組化重構）

### 總覽

將 5 個戰鬥模式（MonsterBattle / PartyBattleRoom / DuelRoom / DungeonBattleRoom / CouncilBattle / WorldBossAttack）中的重複程式碼萃取為 8 個共用模組，歸納至 `src/battle/` 與 `src/lib/`。

**統計**：+2242 / −833 行（淨 +1409 行），8 新檔 + 7 檔修改

---

### Phase 1: 統一傷害公式 (`src/lib/damage.js`, +235 行)

**為什麼**：5 個戰鬥模式各自內聯計算箭矢傷害/反擊/貓貓攻擊，公式不一致（爆擊倍率、DEX 加成、前後衛修飾等細節各異）。

**改了什麼**：
- `calcArrowDamage(score, atk, def, dex, options)` — 共用的單箭傷害公式（含爆擊×1.5、DEX+1、隨機±10%）
- `calcCounterDamage(monAtk, def)` — 反擊傷害
- `calcStandardArrowDmg` / `calcStandardCounter` — 標準戰鬥模式封裝
- `calcWorldBossArrowDmg` — 世界王專用（含助攻縮放）
- `calcCatDamage` — 貓貓攻擊

**踩坑提醒**：`options.forceCrit` 用於 `hit_count` 合約強制爆擊；CouncilBattle 與 WorldBossAttack 仍使用自己的公式，尚未遷移。

---

### Phase 2: 統一計分邏輯 (`src/lib/score.js`, +201 行)

**為什麼**：分數 label↔value 轉換（X/11 → 6/0）、SCORE_MAP、COLORS 散落在各元件中。

**改了什麼**：
- `SCORE_MAP` / `SCORE_COLORS` / `SCORE_MAP_REVERSE` — 集中管理
- `scoreLabel(score)` / `scoreValue(label)` — 轉換函式
- `SCORE_ROW_A/B` — 折疊計分板兩頁定義
- 5 個戰鬥模式改用 `score.value` 取代硬編碼

**踩坑提醒**：`score.js` 的 `scoreValue("X")` 回傳 11，`scoreValue("M")` 回傳 0；各模式務必使用回傳值而非再自定義映射。

---

### Phase 3: 戰鬥引擎 (`src/battle/BattleEvents.js` / `BattleConfig.js` / `BattleEngine.js`, +682 行)

**為什麼**：MonsterBattle 的 50 行 event loop 耦合了事件產生、動畫播放、音效、狀態更新，難以在其他模式複用。

**改了什麼**：
- **`BattleEvents.js`** — 22 個 EventType（`arrow_hit` / `arrow_crit` / `counter` / `random_event` / `battle_win` 等）+ `createXxxEvent` builder
- **`BattleConfig.js`** — 戰鬥模式參數（箭數、距離、倍率、機率）統一管理
- **`BattleEngine.js`** — 單人戰鬥事件產生器（`generateRoundEvents`），接收 `roundResult` → 產生完整事件陣列

**踩坑提醒**：EventType 字串值用 camelCase（`arrow_hit`），不要在元件中再自創 type；用 `EventType.ARROW_HIT` 引用。

---

### Phase 4: 動畫派遣器 (`src/battle/BattleAnimation.js`, +234 行)

**為什麼**：19 個 `playXxx` 動畫函式散布在 MonsterBattle 內，需要拆出讓所有模式共用。

**改了什麼**：
- `playSoundEffect(type)` / `playHitAnimation(type)` / `playVisualEffect(type)` — 動畫三層封裝
- `addRoundLog(phase, msg)` / `addEventLog(...)` — log 系統標準化
- **`EVENT_DISPATCH`** — 事件→動畫映射表（22 個 EventType 各自對應 `playXxx`）
- `createDispatch()` — 工廠函式，回傳 `{ playSoundEffect, playHitAnimation, playVisualEffect, dispatch, ...addLog }`

**踩坑提醒**：`EVENT_DISPATCH` 的 handler 簽名為 `(payload, eventCtx, dispatch)`，請勿改變順序；`dispatch.animate()` 回傳 Promise 讓 RoundController 可以 await。

---

### Phase 5: Firestore 回合抽象層 (`src/battle/useFirestoreRound.js`, +183 行；3 元件重構)

**為什麼**：PartyBattleRoom / DuelRoom / DungeonBattleRoom 三模式的 Firestore 訂閱+提交+房主處理邏輯高度重複（每人約 30~50 行），且都有卡死 bug 歷史。

**改了什麼**：
- **`useFirestoreRound(config)`** — 統一 hook，參數：
  - `subscribe` / `submit` — Firestore 訂閱/提交箭分
  - `processRound` — 房主處理回合邏輯
  - `getMembers` / `isProcessing` / `canProcess` / `getBotsUnready` / `submitBotArrows` / `getExtraProcessArgs` / `processDelayMs` / `maxRetries`
  - `onBeforeSubmit` / `onSubmitError` — 生命週期回呼
  - 回傳：`{ room, submitted, submitting, handleSubmit, fsHandleSubmit, setFsSubmitted, retryCount }`
- 自動管理：subscribe lifecycle、submitted state、submitting guard、all-ready detection、delay、host processing、retry

**重構的元件**：
| 模式 | 關鍵變更 |
|------|---------|
| PartyBattleRoom (Pilot) | 36 行 handleSubmit → 5 行；host processing effect 移除 |
| DuelRoom (Bot 支援) | subscribe + host processing effects 移除；getBotsUnready + submitBotArrows 移至 hook config |
| **DungeonBattleRoom (最複雜)** | subscribe callback 4 職責 split；35 行 host processing（含 1s delay + 8s safety-net）→ hook config；5 個 ref 移除（processingRef, lastProcessedRef, allReadyTimerRef, forceProcessTimerRef, submitFallbackRef）；dead code `loading` state 清理 |

**踩坑提醒**：
- `submit` config 必須封裝 team 參數（DuelRoom 需要傳 team A/B）
- `getBotsUnready` 必須回傳 `{ id, team, m }` 結構
- `processDelayMs: 1000` 保留地下城原有的 1 秒延遲（防 Firestore 快照競爭）
- non-host processing timeout 20s 保留在 hook 內部（永不遺忘）

---

### Phase 6: RoundController (`src/battle/RoundController.js` / `useBattleRound.js`, +179 行；3 元件重構)

**為什麼**：MonsterBattle 的 50 行 event loop（for + switch + 15 case）需要抽象為共用控制器，讓 CouncilBattle 與 WorldBossAttack 也能使用。

**改了什麼**：
- **`RoundController` class** — `playEvents(events, eventCtx, handlers)` 方法：
  - 事件迭代 loop（for...of）
  - 動畫派遣（透過 EVENT_DISPATCH）
  - 計時管理：箭矢事件 1500ms 延遲，其他 0ms（可自訂）
  - BATTLE_WIN / BATTLE_LOSE 自動中斷
  - RANDOM_EVENT 清理回呼
  - 回傳 `{ battleEnded, battleResult }`
  - 建構子接受 `options.customDelays` 覆寫延遲

- **`useBattleRound` hook** — 封裝 RoundController、管理 `isPlaying` 狀態

**重構的元件**：

| 模式 | 事件迴圈 | Handlers |
|------|---------|----------|
| **MonsterBattle** | 50 行 for+switch → `controller.playEvents(events, ctx, handlers)` | 15 per-type handlers |
| **CouncilBattle** | 自訂 CB_EVT（Arrow/Counter/Result/End）→ playEvents + 4 handlers | 箭矢動畫、反擊動畫、結果顯示、戰鬥結束 |
| **WorldBossAttack** | 25 行 for+600ms delay → events 陣列 + playEvents | WB_EVT（Arrow/CatMsg/Support）自訂型別 + customDelays 600ms |

**踩坑提醒**：
- CouncilBattle 與 WorldBossAttack 使用自訂 EventType（`CB_EVT` / `WB_EVT`），不在 BattleAnimation 中，dispatch 會跳過 animate step（只跑 handler）
- WorldBossAttack 的 `processingIdx` 在事件預先計算時 batch 為同步，不會觸發 re-render → 修復為播放前一次性 `setProcessingIdx(totalEvents-1)`
- `customDelays` 向後相容，不傳 options 的既有呼叫（MonsterBattle, CouncilBattle）不受影響

---

### Phase 7: 共用 mini-round 動畫 hook (`useMiniRoundReveal.js`)

**為什麼**：PartyBattleRoom 與 DungeonBattleRoom 的 mini-round 逐箭動畫邏輯 ~85% 相同（setTimeout 鏈管理 liveEntry/animHit/animMonsterCharge/floatDmg 等 8 個 state），但寫在兩個元件中各 80+ 行，導致維護雙倍成本。

**改了什麼**：
- **`src/battle/useMiniRoundReveal.js`**（新增，+134 行）— 共用 mini-round 動畫 hook：
  - 管理 8 個動畫 state：`liveEntry` / `liveMiniIdx` / `animHit` / `animMonsterCharge` / `animScreenShake` / `floatCounterDmgs` / `localHpOverride` / `floatDmg` / `attackingIds`
  - `startReveal(entry, opts)` — 啟動 setTimeout 鏈播放 mini-round：
    - `key` — 去重 key（防止 F5 重整重播）
    - `attackDelay` / `counterDelay` / `entryEndExtra` — 可自訂計時（預設 1400/2700/1500ms）
    - `members` — 用於反擊 HP lock 計算
    - `onMiniTick(mini, idx)` — 每 mini-round 開始時回呼（sfx/attackingIds）
    - `onCounterHit(mini, idx)` — 反擊命中時回呼（sfxCounter/vibrate）
    - `onEntryEnd(entry)` — 全部播放完時回呼（擊殺動畫/回合結算）
  - `stopReveal()` — 清除計時器 + 重置所有 state
  - 自動 `clearTimers` 在下次 `startReveal` 時清理前一輪 timer

**重構的元件**：

| 元件 | 行數變化 | 關鍵變更 |
|------|---------|---------|
| **PartyBattleRoom.jsx** | +245/−245 | 80+ 行 inline setTimeout 鏈 → `reveal.startReveal()` + 回呼；移除 `isAnimating` 手動 state（hook 直接提供） |
| **DungeonBattleRoom.jsx** | +366/−366 | 90+ 行 inline setTimeout 鏈 → `reveal.startReveal()` + onMiniTick/onCounterHit/onEntryEnd；移除 8 個 animation state + `revealTimersRef` |

**踩坑提醒**：
- `setAttackingIds` 需暴露給 `onMiniTick` 回呼使用 → hook 回傳值中加 `setAttackingIds`（向後相容）
- DungeonBattleRoom 保留 `lastAnimKeyRef` 作為 render guard（`hasNewAnim` 檢查），確保完成畫面不會在動畫開始前閃爍
- DuelRoom 的動畫架構（逐箭揭露 12 步 + cross-referencing attacks[]）與 mini-round 不同，不適用此 hook
- 計時差異：hook 預設 `entryEndExtra: 1500ms`，原本 DungeonBattleRoom 是 `delay + 500 + minDelay` → 回合結果 overlay 約晚 1 秒顯示

---

### 最終架構關係（Phases 1-7）

```
src/lib/
  damage.js          ← 各模式共用傷害公式
  score.js           ← 各模式共用計分邏輯

src/battle/
  BattleEvents.js    ← 22 種標準事件型別 + builder
  BattleConfig.js    ← 戰鬥模式參數集中管理
  BattleEngine.js    ← 單人戰鬥事件產生器
  BattleAnimation.js ← 19 個 playXxx + EVENT_DISPATCH
  useFirestoreRound.js ← Firestore 回合 hook（Party/Duel/Dungeon）
  RoundController.js ← 通用事件播放控制器（Monster/Council/WorldBoss）
  useBattleRound.js  ← React hook 封裝 RoundController
  useMiniRoundReveal.js ← 共用 mini-round 動畫 hook（Party/Dungeon）
```

---

### Phase 8: 逐箭揭露 hook (`useDuelReveal.js`) + damage.js 公式補完

**為什麼**：
- DuelRoom 的 12 步逐箭揭露邏輯（~170 行 inline useEffect + 11 個 state + 4 個 effect）無法被 `useMiniRoundReveal` 共用（架構不同——逐箭揭露 vs mini-round 離散回合）
- CouncilBattle 的 `getPartMult()` 與 damage.js 的 `getCouncilPartMult()` 重複
- CouncilBattle 的 `scoreVal()` 與 score.js 的 `labelToValue()` 重複
- WorldBossAttack 的 `calcArrowDmg`/`calcCounterDmg` wrapper 只是 damage.js 的傳遞函式

**改了什麼**：

#### 新檔：`src/battle/useDuelReveal.js`（~190 行）

封裝 DuelRoom 的逐箭揭露邏輯：
- 管理 11 個 state：`revealEntry`, `revealIdx`, `displayHp`, `floats`, `flashIds`, `attackingIds`, `hittingIds`, `eventPhase`, `showCatRound`, `duelCatCats`, `revealPhaseBanner`
- 4 個內部 effect：log 偵測 → 事件暫停/揭露 → 逐箭計時器（1000ms）→ 揭露完成（貓貓 overlay + 清理）
- 對外 callback：`onSoundEffect(hasCrit, hasHit)`、`onComplete(entry)`
- 方法：`skipEvent()`（跳過事件暫停）、`stopReveal()`（清理重置）

#### 修改：`src/components/duel/DuelRoom.jsx`

```
Before (4 effects, ~170 行):          After (~10 行 hook + callbacks):
 log 偵測 effect                       useDuelReveal({ room,
 逐一揭露計時器 effect                    onSoundEffect,
 事件暫停 effect                        onComplete })
 完成清理 effect                       + skipEvent → skipEvent
 + 11 個 state 宣告                    + resetLocalState → stopReveal()
 + lastLogLen ref
 + startReveal()
```

#### 修改：`src/components/member/CouncilBattle.jsx`

```
Before:                               After:
 getPartMult(label, fmt)  (內聯)       getCouncilPartMult(label, fmt)  (damage.js)
 scoreVal(label)          (內聯)       labelToValue(label)              (score.js)
 getMappedScore (內聯 parseInt)        getMappedScore 使用 labelToValue
```

#### 修改：`src/components/worldboss/WorldBossAttack.jsx`

```
Before:                               After:
 calcArrowDmg(s, a, b, p) → wrapper   wbArrowDmg(s, a, b, p) → direct call
 calcCounterDmg(a, d) → wrapper        wbCounter(a, d) → direct call
```

**踩坑提醒**：
- `useDuelReveal` 只在 DuelRoom 使用（無跨模式複用價值），抽取是為了隔離程式碼而非複用
- `revealEntry` 和 `revealIdx` 使用 ref 同步防止閉包陳舊（timers 中的 callback 讀最新的值）
- 完成 effect 必須依賴 `room` 物件來計算貓貓攻擊（`room.teamA`/`room.teamB` 找 `allMembersMap`）
- CouncilBattle 的 `getCouncilPartMult` 比舊 `getPartMult` 多處理 `"M"` label（但不影響 CouncilBattle 的 `"0"` 標籤）
- WorldBossAttack 的 `scoreVal`/`scoreLabel` 包裝保留（大量 JSX 使用，移除成本 > 收益）

---

### 最終架構關係（Phases 1-8）

```
src/lib/
  damage.js          ← 各模式共用傷害公式
  score.js           ← 各模式共用計分邏輯
  itemData.js        ← 藥水資料（9 攜帶型 + 7 投擲型 + 村莊配方）
  villageData.js     ← 煉金室產出箭露（arrowdew，微量）

src/battle/
  BattleEvents.js    ← 22 種標準事件型別 + builder
  BattleConfig.js    ← 戰鬥模式參數集中管理
  BattleEngine.js    ← 單人戰鬥事件產生器
  BattleAnimation.js ← 19 個 playXxx + EVENT_DISPATCH
  useFirestoreRound.js ← Firestore 回合 hook（Party/Duel/Dungeon）
  RoundController.js ← 通用事件播放控制器（Monster/Council/WorldBoss）
  useBattleRound.js  ← React hook 封裝 RoundController
  useMiniRoundReveal.js ← mini-round 動畫 hook（Party/Dungeon）
  useDuelReveal.js   ← 決鬥逐箭揭露 hook（DuelRoom）
```

### Phases 1-8 總覽

```
Phase 1  Damage Engine     ██████████████████████████████ ✅
Phase 2  Score Engine      ██████████████████████████████ ✅
Phase 3  Battle Engine     ██████████████████████████████ ✅
Phase 4  Animation Manager ██████████████████████████████ ✅
Phase 5  Firestore 回合     ██████████████████████████████ ✅
Phase 6  RoundController   ██████████████████████████████ ✅
Phase 7  Mini-Round Reveal ██████████████████████████████ ✅
Phase 8  Duel Reveal +     ██████████████████████████████ ✅
         damage.js 補完
```

---

---

## 2026-06-29（佈署 Bug 修正 3 連）

### Bug 1：MonsterBattle 進場報 `ReferenceError: n is not defined`
- **根因**：`MonsterBattle.jsx` 第 464 行在 `useCarryPotion` 函式上方多了一個孤立的 `n` 字元，被 JS 當成未宣告變數執行
- **修正**：刪除該 `n` 字元（`n  // 🧪 使用攜帶型藥水...` → `  // 🧪 使用攜帶型藥水...`）
- **踩坑**：minified bundle 的 `n is not defined` 指向的是源碼中的孤立識別字，不一定是某個真實變數名稱

### Bug 2：進場後 HP NaN/100、ATK 0（DEF 正常）
- **根因**：`calcPotionBuffs`（`itemData.js`）重設計時把回傳格式從 `{ hpMult, atkMult }` 改成 `{ hpPct, atkPct }`，但 `MonsterBattle.jsx` 計算 `bStats` 仍讀 `buffs.hpMult` / `buffs.atkMult`，取到 `undefined`，乘法結果變 `NaN`
- **DEF 正常原因**：`def = baseStats.def + ... `（加法，不乘 buffs）
- **HP 顯示 NaN**：`archerHP` 初始化為 `bStats.hp = NaN`
- **ATK 顯示 0**：UI 有 `||0` fallback，`NaN || 0 = 0`
- **修正**：在 `calcPotionBuffs` 結尾補算 `buffs.hpMult = 1 + hpPct/100`、`buffs.atkMult = 1 + atkPct/100`，兩種格式並存向後相容

### Bug 3：Push 失敗——`codebase-memory-mcp.exe` 超過 GitHub 100MB 限制
- **根因**：`codebase-ui-extracted/` 資料夾含 257MB `.exe` 被 git 追蹤
- **修正**：`.gitignore` 加入 `codebase-ui-extracted/`、`codebase-ui.zip`、`install.ps1`
- **踩坑**：大型二進位工具資料夾務必在第一次 `git add` 前就加進 `.gitignore`

**重要架構提醒**：`calcPotionBuffs` 現在同時輸出 `hpPct/atkPct`（百分比數字）和 `hpMult/atkMult`（倍率）。未來修改此函式時，兩種格式都要維護，否則會影響 MonsterBattle 的開戰數值計算。

---

## 2026-06-28（地下城 7 Bug 修正批次）

### Bug 1：商店 revival_front 復活目標錯誤
- **根因**：`handleResolve` 檢查購買者自身 `role==="rear"`，應找隊伍中任何 `role==="rear"` 的成員
- **修正**：改為掃描 `shopPurchases` 確認有人購買後，取 `members` 中第一個 `alive && role==="rear"` 的成員復活
- `hasFallenFront` 計算移到元件頂層，供按鈕 disabled 和 handleBuy 共用

### Bug 2：休息區全員狀態確認
- `handleResolve` fallback（無人倒地時投票 revive → 全體回 50% HP）原本即正確，保留
- 加入全員狀態小卡（Bug 4 合併）

### Bug 3：計分板折疊 + 視角切換
- **3a 分數折疊**：新增 `scoreRowPage` state；`SCORE_ROW_A=["X","10","9","8","7","6","M"]` / `SCORE_ROW_B=["6","5","4","3","2","1","M"]`；7顆 repeat(7,1fr) + 外部 ▼/▲ 切換按鈕
- **3b 視角切換**：新增 `viewRearInInput` state；`displayedRowMembers` 在非動畫/非送出時允許切換後衛視角；角色列標頭右側加小按鈕

### Bug 4：商店/休息區全員狀態小卡
- 兩個元件 header 下方加 `overflowX:auto` 橫排小卡，顯示 HP 條 + 存活狀態 + 角色

### Bug 5：商店購買限制
- 移除 `bought` state，改為只依賴 Firestore `myPurchases`
- `revival_front` 購買前需 `hasFallenFront === true`，否則 block + 顯示 ⚠️ 無前衛倒地

### Bug 6：關卡機制修改
- **6a all_hit → M懲罰關**：移除「有M全歸零」早回，改為回合結束後 `totalDmg *= max(0, 1 - mCount * 0.1)`；不再限制靶面/按鈕（全分數有意義）；icon 改 ⚠️
- **6b score_gate 比例懲罰**：移除「低於門檻全0」邏輯，改為每箭 `d *= max(0, 1 - (threshold - effectiveScore) * 0.1)`；X/10 視同 9；contractParam cap 9；`_roomMeta` 改 `Math.min(6+tier, 9)`

### Bug 7：後台白底框
- AdminReviewCenter：三個 toggle 按鈕、統計卡、兩個 input 欄位、外賽審核決定區、category badge 改深色
- AdminMembers：MemberCard 主框、EquipTabs 非選中、爭議 Modal 修正區、歷程統計卡、檢定卡 改深色
- AdminFinance：tab 按鈕非選中 改深色
- QR Code 白框保留（掃碼必需）

**踩坑提醒**：
- `score_gate` 的 score_gate penalty 在 dmgMult 之前套用（讓 buff 可以再補救）
- `all_hit` 的 M 計數用 `arrows.filter(a=>(a.score??0)===0)` 而非 breakdown 中的脫靶（breakdown 裡的脫靶還包含 part 未命中的情況）
- `SCORE_GATE_LABELS.slice(0,5)` = ["9","8","7","6","5"]，`slice(5)` = ["4","3","2","1","M"]

---

## 2026-06-27（地下城前後衛顯示重設計 + 死亡轉後衛時機修正）

### Bug A：前衛死亡後在動畫開始前就被移到後排
- **根因**：`processDungeonRound` 一次寫入 `log` 和 `members.role`；客戶端收到快照時動畫剛啟動但 role 已是 post-round 值 → 分排計算立即改變
- **修正**：在 `dungeonDb.js` 新增 `displayGroup` 欄位（`DEFAULT_MEMBER` + `joinDungeonRoom`），並在 `logEntry` 加入 `displayGroupsBefore`；客戶端動畫期間改用 `liveEntry.displayGroupsBefore[id]` 決定分排，動畫結束後才反映新 `displayGroup`

### Bug B：前後兩排同時顯示，怪物畫面被遮住
- **設計調整**：改為「視角分排」——每人只看自己的排（前衛看前衛排，後衛看後衛排）
  - 平時（等待輸入/已送出）：只顯示 `myRowMembers`（完整卡）
  - 動畫進行中：上方補顯 `otherRowMembers` 緊湊小卡（讓後衛看到前衛出手/讓前衛看到後衛支援）
- **displayGroup 規則**：
  - 加入時 `displayGroup = defaultRole`（和 `role` 同步）
  - 前衛死亡：`role → "rear"`；若當前後衛顯示位置 < 4 → `displayGroup → "rear"`（真正移動）；否則 `displayGroup` 保持 "front"（只改狀態標籤）
  - 死亡後留在前排的成員：紫色邊框（`rgba(168,85,247,0.45)`）+ 顯示 "🛡後衛" 標籤

### 實作細節
- `dungeonDb.js`：`DEFAULT_MEMBER` 加 `displayGroup:"front"`；`joinDungeonRoom` 加 `displayGroup:defaultRole`；`processDungeonRound` Step 5b 前計算 `displayGroupsBefore` 並寫入 `logEntry`；死亡邏輯中判斷後衛座位數（`<4`）再決定是否更新 `displayGroup`
- `DungeonBattleRoom.jsx`：新增 `dgOf(m)` 函式（動畫中用 `displayGroupsBefore`，否則用 `displayGroup??role`）；新增 `myRowMembers`/`otherRowMembers`/`myDisplayGroup`/`myRowW`/`otherRowW`；角色列改單排顯示 + 動畫時補顯緊湊他排

**踩坑提醒**：
- `displayGroupsBefore` 是 `aliveIds` 在 Step 5b **之前**快照，確保包含死亡前的分組
- `curRearDisplayCount` 要用 `members`（原始資料）而非 `memberUpd`（已有 patch 但尚未寫入），否則同一回合多人死亡時計數會不準
- 動畫期間 `dgOf` 讀 `liveEntry.displayGroupsBefore`，結束後 `liveEntry = null` → 自動切回 `m.displayGroup`，不需額外清理

---

## 2026-06-27（地下城隊員卡住修復 + 全員 ready 延遲 2 秒）

### DungeonBattleRoom.jsx — 兩個並發競速 Bug

**問題 1：非房主隊員卡住**
- 房主有 20 秒超時清除 `processing` flag，但非房主隊員若 Firestore 快照沒收到 flag 清除，會永遠停留在「等待中」
- **修復**：新增非房主專用 useEffect，監聽 `room.processing`；20 秒未解除 → 自動 `setSubmitted(false)` + 寫 Firestore 清除 `ready/arrows`，讓玩家重新輸入箭分

**問題 2：全員 ready 後瞬間結算（Firestore 快照尚未傳播到房主）**
- 最後一個玩家按送出 → 房主可能在其他成員快照更新前就跑 `handleProcess`
- **修復**：all-ready useEffect 改用 `allReadyTimerRef` 計時 2 秒再呼叫 `handleProcess`；若期間有人取消 ready，timer 即清除；若 timer 已在跑則不重新啟動（防重複）

**踩坑提醒**：
- `allReadyTimerRef` 宣告在 useEffect 同層（hook 頂層），不能放在 useEffect 內（違反 Hooks 規則）
- cleanup fn 在 React StrictMode 下可能被呼叫兩次，ref guard (`if (allReadyTimerRef.current)`) 防重複
- 非房主 reset 要同時清 Firestore 的 `ready` 和 `arrows`，否則 Firestore 仍顯示已送出

---

## 2026-06-27（Bug 修正 + 首頁/成就/怪物卡改版）

### Bug 1：商店購買記憶 + 藥水重購
- `dungeonDb.js`：`enterNonCombatRoom` / `resolveNonCombatRoom` 不再重置 `shopPurchases`
- `purchaseDungeonItem`：`hp_potion` 跳過記入 bought 清單 → 允許重複購買
- `DungeonShop.jsx`：本地 `bought` 也跳過 `hp_potion`

### Bug 2：進場動畫 + 樓層顯示
- `DungeonBattleRoom.jsx`：地圖模式用 `mapCurrentRoomId` 作動畫 key（而非 floor 始終不變）
- `dungeonDb.js`：`enterMapCombatRoom` 的 `currentFloor` 改從 `mapFloorIndex + 1` 計算

### Bug 3：今日箭數同步
- `DailyQuest.jsx`：改用 `subscribeTodayPracticeLogs`（Firestore 側限日期），排除 party/duel/dungeon source

### Bug 4：地下城事件效果驗證
- `dungeonDb.js`：新增 `def_mult_all` case（守護結界事件之前缺失）
- `dungeonData.js`：修正 `reversal` 合約的 `arrowBreakdown.push` 中 `dmg` → `dmg: d` 拼寫錯誤
- `DungeonBattleRoom.jsx`：`CONTRACT_HEX` 補上 reversal/odd_only/even_only 顏色

### Bug 5：成就通知系統
- `MemberDex.jsx`：
  - 成就 useEffect deps 補上 `monsterDex, craftStats, chestStats, potionDex, cardData`（原先缺失導致部分成就無法即時偵測）
  - `createNotification` 改為個人通知（`targetMemberId: profile.id`）而非全頻廣播，防止每次進頁就廣播
  - 通知 type 改為 `"achievement"`

### Bug 6：首頁等級卡改版（MemberHome.jsx）
- 移除 `bg-white/15` 個人資訊列（徽章總覽/賽事積分/月卡），改放到等級卡
- 名字旁加入公會等級 pill（`adventurerXP` + `levelFromXP`）
- 等級卡新增：地下城圖鑑/成就圖鑑/貓貓卡片收藏進度小格
- 月卡移入等級卡（月卡剩餘次數 + 申請按鈕）
- 移除「年度檢定摘要」與「最近成績」區塊
- 引入 `COLLECTIBLE_MAP` from dungeonCollectibles 計算地下城圖鑑總量

### Bug 7：怪物卡片改版（CardCollection.jsx）
- 改為條列式（`flex-col` 取代 `grid-cols-2`）
- 每列顯示：icon/名稱/階級/星數/加成 + 直接顯示「✨ 可升星」提示（inline，無需展開）
- 右側快速裝備/卸下按鈕（inline，無需展開）
- 展開只剩升星操作與 mythic 屬性選擇

### Bug 8：廣播訊息改版（MemberHome.jsx）
- 移除 `msg-scroll-bg.webp` 底圖，改為半透明深色背景
- 新增分類篩選：全部|優惠|重要|考證|成就|地下城|世界王|一般|掉寶
- 廣播文字顏色改為白色系（深色背景相容）

---

## 2026-06-27（地下城 + 組隊模式前後衛分排統一為 role-based）

### DungeonBattleRoom.jsx + PartyBattleRoom.jsx — role-based 分排顯示
- **變更前**：前排 = `memberList.slice(0,4)`，後排 = `memberList.slice(4)`（依加入順序，與 role 無關）
- **變更後**：
  ```
  rearRoleMembers   = memberList.filter(m => m.role === "rear")
  frontRoleMembers  = memberList.filter(m => m.role !== "rear")
  frontMembers = [...frontRoleMembers, ...rearRoleMembers.slice(4)]  // 後衛滿4時溢位到前排
  backMembers  = rearRoleMembers.slice(0, 4)                        // 最多4人後排
  ```
- **溢位後衛**：role="rear" 但後排已滿4人 → 顯示在前排格子，青色邊框（`rgba(20,184,166,0.4)`）區分
- **後排邊框**：改為青色（`#14b8a6` 系列），與前衛的紅色形成對比
- **排頭標籤**：有後排成員時顯示「⚔️ 前衛 / 🛡 後衛」小標（只在有後排時出現）
- **後排寬度**：地下城改用 `backW`（獨立計算，不再硬借 `frontW`）

### dungeonDb.js + partyDb.js — 攻擊順序統一前衛優先
```js
const orderedAliveIds = [
  ...frontIds.filter(id => aliveIds.includes(id)),
  ...rearIds.filter(id => aliveIds.includes(id)),
];
// 攻擊 pass 改用 orderedAliveIds（前衛先動，後衛後動）
```
- miniRounds 中前衛的攻擊動畫先播，後衛後播，再接怪物反擊
- 反擊仍只打 frontIds（後衛全程免疫，前衛全滅才打後衛）

**踩坑提醒**：
- `backW` 要獨立計算（`backMembers.length` 分母），地下城舊版錯用 `frontW` 導致後排卡片過寬

---

## 2026-06-27（組隊模式前後衛系統 + 怪物人數縮放）

### partyDb.js — 前後衛戰鬥邏輯
- **`submitArrows`**：新增 `role="front"|"rear"` 與 `rearChoice="heal"|"dmg"|null` 參數，每次送箭時寫入 Firestore
- **`processPartyRound` Step 1**：後衛選「攻擊」者，所有箭傷 ×0.5（arrowBreakdown 也同步縮放）
- **前後衛分類**：`frontIds`（role 未定義或 "front"）/ `rearIds`（role="rear"）
- **反擊邏輯**：只打存活 `frontIds`；前衛全滅時才打所有存活成員
- **後衛治癒**：選擇 "heal" → pool = 25% maxHP，均分給所有存活隊友（不含自己）
- **前衛復活機制**：前衛 HP 歸零 → 不立即陣亡，改為轉後衛 + 復活至 50% HP；後衛 HP 歸零才真正陣亡

### partyDb.js — 怪物人數縮放（補完）
- `genPartyHPMult` 改為確定性公式：`1.0 + (playerCount-1) * 0.5`（HP 每多一人 +50%）
- `startPartyBattle` 加入 `monAtkMult = 1+(N-1)*0.15`、`monDefMult = 1+(N-1)*0.15`、`rewardMult = 1+(N-1)*0.2`
- `rewardMult` 存入 Firestore room document，結算時讀取用

### PartyBattleRoom.jsx — 角色選擇 UI
- 計分前顯示「⚔️前衛 / 🛡後衛」選擇按鈕
- 選後衛後出現「💊治癒隊友 / ⚡協助攻擊」策略按鈕
- 後衛未選策略時送出按鈕鎖住（顯示「請先選擇後衛策略」）
- 新回合時從 Firestore 讀取 role（捕捉前衛轉後衛通知），否則重置為 "front"
- 玩家名牌顯示 ⚔️/🛡 角色標籤

**踩坑提醒**：
- `allPlayerData` 在 Step 1 即縮放，miniRounds 的 pairDmg 自動正確
- 前衛轉後衛由伺服器寫入 `role="rear"`，下回合 `useEffect([room?.round])` 讀取後更新本地 state

---

## 2026-06-27（地下城/組隊怪物人數縮放 + 後衛機制修正 + 等待室 Bug）

### dungeonDb.js — 後衛機制重設計
- 後衛傷害倍率：×1.5 → **×0.5**（後衛本應保護，不是輸出強化）
- 後衛治癒：原「自己回 25% HP」→ **25% maxHP pool 均分給存活隊友（不含自己）**
  - `receivedHeal` 物件累計，HP update 時套用

### dungeonDb.js — 怪物人數縮放
- `startDungeonBattle`：新增 `monHPMult = 1+(N-1)*0.5`、`monAtkMult = 1+(N-1)*0.15`、`monDefMult = 1+(N-1)*0.15`、`rewardMult = 1+(N-1)*0.2`
- 廢除 `memberAtkMult`（玩家 ATK 加成移除）

### DungeonLobby.jsx — 等待室卡死修復 + 按鈕並排
- **問題**：等待室按鈕被 `overflow-hidden` 截掉，無法點擊「開始地下城」
- **根因**：House 設定 `div` 用了 `shrink-0`，把 footer 推到視區外
- **修復**：將地下城設定移到 `flex-1 overflow-y-auto` 捲動區內；footer 改為 `flex gap-2`，「離開」與「開始」並排顯示

---

## 2026-06-27（地下城收藏品圖鑑全面重設計）

### dungeonCollectibles.js — 完整重寫（216 件）
- **規格**：6 族系 × (20 普通 + 10 稀有 + 5 首領 + 1 超稀有) = 216 件，加上原有 24 首殺限定
- **掉落邏輯**：
  - 普通怪物房 15%（原 10%）
  - 精英房 20% 稀有 + 25% 普通（原 35%+30%）
  - 寶箱房 15% 稀有 + 40% 普通（原 20%+50%）
  - Boss 房：`rollBossDrops(family, difficulty)` 回傳陣列，65% Boss 物品 + 難度依比超稀有（normal 1% / hard 2% / elite 3% / nightmare 5%）
- **API 變更**：`rollBossDrop` → `rollBossDrops`，回傳 `[{itemId}]` 陣列而非單一物件

### DungeonBattleRoom.jsx — 三處 Bug 修復
1. **family 偵測**：`room?.dungeonId` → `room?.mapDungeonId || room?.dungeonId`（地圖模式用 mapDungeonId）
2. **首殺 trophy**：同上，共三個地方（line ~500, ~506, ~893）全改為 mapDungeonId
3. **collectible → collectibles**：`claimLootRef.current` 改用陣列格式，UI 支援同時顯示多件掉落

### DungeonDex.jsx — 新增超稀有稀有度
- `RARITY_LABEL` / `RARITY_COLOR` 加入 `superRare`（金黃色 #fde047）
- `allFamilyItems` 加入 `tiers.superRare`

**踩坑提醒**：
- `rollBossDrops` 可能回傳空陣列（Boss 沒掉），UI 需做 length 判斷
- superRare 物品的 rarity 字串是 `"superRare"`（camelCase），RARITY_COLOR 也用同名 key

---

## 2026-06-27（地下城等待室重整持久化）

### 地下城等待室：重整後不再跳出
- **問題**：在等待室（DungeonLobby）重整後，用戶回到初始建立/加入畫面，失去等待室狀態
- **分析**：`dungeon-room` 頁面（戰鬥中）早已透過 `member_page` + `dungeon_room` 兩個 sessionStorage key 正確持久化；但等待室是 `page="dungeon"` + 無 roomId 記錄，重整後無法還原
- **修復**：`DungeonLobby.jsx` — 加入 `dungeon_waiting_room` sessionStorage key（`{roomId, isHost}`）：
  - `handleCreate` 成功後 → `setItem`
  - `handleJoinRoom` 成功後 → `setItem`；訂閱到 active/map_explore → `removeItem` 後跳轉
  - `handleStart`（房主開始）→ `removeItem` 後跳轉
  - 「離開等待室」按鈕 → `removeItem`
  - mount `useEffect`（`[myId]`）→ 讀取存檔、重新訂閱房間；房間已 active 則直接跳轉；房間不存在則清除存檔
- **坑**：恢復訂閱的 `sub` 變數在 callback 內用 `sub?.()` 取消，因 Firestore `onSnapshot` 同步回傳 unsub，callback 執行前 `sub` 已被賦值，安全

---

## 2026-06-27（地下城全面 bug 修復 — 透明度/卡死/投票/後排/合約顏色）

### 1. 地下城大廳透明度 & 底部導航遮擋
- **問題**：大廳背景太透明（無暗色疊層）、資訊框透明度過高可讀性差；等待室 `h-[100dvh]` 未計入底部導航高度，開始戰鬥按鈕被遮住
- **修復**：`DungeonLobby.jsx` — 背景加 `rgba(0,0,0,0.6)` 疊層；amber 資訊框 `/10→/20`、文字 `text-slate-300→200`；等待室外層 `h-[100dvh]→h-full`（正確填滿 MemberApp flex 容器）
- **8人支援**：`dungeonDb.js` `joinDungeonRoom` 限制 `>=4→>=8`

### 2. 地下城結算改為各自領取獎勵
- **問題**：打完首領後必須等房主按領取，隊員無法各自拿獎勵；且自動存檔 useEffect 和按鈕領取可能雙重加 XP
- **修復**：`DungeonBattleRoom.jsx` — 新增 `handleClaimSelf()` 每人點自己的按鈕領獎（金幣/寶箱/素材/圖鑑/XP/箭露/扭蛋幣/符文/收藏品）；移除舊 `handleClaim()`（房主代領）和自動存檔 `useEffect`；清除無用 `xpSavedRef`
- **坑**：`xpSavedRef` 是舊自動存檔的 guard，移除後記得也刪掉變數宣告

### 3. 投票顯示中文房間名 + 全員同意自動前進
- **問題**：投票文字顯示房間代碼（如 `f0c1r0`）而非中文名（如「幽暗走廊」）；全部人同意後仍要等 30 秒
- **修復**：`DungeonExplore.jsx` — `VoteOverlay` 接收 `floorData` prop，用 `proposal.targetRoomId` 查 `floorData.rooms[].label` 顯示中文名；自動結算條件從 `voteCount >= totalVotes`（全部投同一房）改為 `totalVoteCast >= totalVotes`（全部有投票即可），並補上 `onResolve` 到 useEffect deps 避免閉包過時

### 4. 後排角色卡完整顯示 + 玩家高亮
- **問題**：超過 4 人時後排角色只在戰鬥動畫期間短暫顯示，且資訊精簡（只有名字+HP條）
- **修復**：`DungeonBattleRoom.jsx` — `showBackRow` 條件改為 `backMembers.length > 0`（永遠顯示）；後排卡改用 `frontW` 寬度，加入完整資訊（角色圖像85px、前衛/後衛徽章、ATK/DEF、合約圖標、就緒狀態、跳過按鈕）；自己→金色邊框+光暈+頭像描邊；後衛→紫色邊框+光暈
- **後衛機制驗證**：`processDungeonRound`（`dungeonDb.js`）邏輯正確 — 治癒：傷害歸零+回合末回25%HP；攻擊：傷害×1.5倍；反擊只打前衛（`frontIds`），後衛完全免疫

### 5. 合約文字黑色看不見
- **問題**：進場關卡合約名稱在深色背景上顯示黑色，完全看不到
- **根因**：`CONTRACT_TYPES.color` 存的是 Tailwind class（如 `text-yellow-300`），但在 HUD 的 `BattleStatusTags` 中被當作 inline `color` 值使用，瀏覽器無法解析 → 預設黑色
- **修復**：`DungeonBattleRoom.jsx` — 加入 `CONTRACT_HEX` 映射表（`all_hit→#fde047` 等），HUD 改用 hex 色值

### 6. 地下城卡死全面修復（核心）
- **問題**：全員送出箭分後常卡住需重整；重整後無法輸入分數（按鈕沒反應）；房主強制重置按鈕不見或不 work
- **根因分析**：
  - `handleProcess` 無 try/finally — `processDungeonRound` 拋例外或 Firestore 超時時 `processingRef.current` 永遠卡在 `true`，阻擋所有後續結算嘗試
  - 重整後 `me.ready` 仍為 `true`，但本地 `submitted` 重置為 `false` — 玩家可看到輸入畫面但 Firestore 不認
  - 強制重置按鈕只出現在 `submitted===true` 時，房主重整後看不到
- **修復（`DungeonBattleRoom.jsx`）**：
  1. **try/finally**：`handleProcess` 的 `processDungeonRound` 呼叫包在 `try/catch/finally` 中，`finally` 保證重置 `processingRef.current=false` + `setLoading(false)`
  2. **重整自動同步**：新增 `useEffect`，當 `me.ready===true` 但本地 `submitted===false` 時自動寫 Firestore 清除 `ready` + `arrows`（用 `readySyncedRef` 確保只執行一次）
  3. **房主強制重置常駐**：HUD 區域新增 `position:fixed` 的 ⚙️ 強制重置按鈕，戰鬥中永遠可見（呼叫 `clearDungeonProcessing` 清除 Firestore `processing` flag）
  4. **重新輸入按鈕**：`submitted` 狀態下非房主可點「重新輸入」清掉 Firestore `ready/arrows` + 本地 `submitted`，重新輸入箭分
  5. **5秒安全網**：房主送出後若未全員 `ready`，5 秒後用 `roomRef.current`（最新 room 資料）重新檢查並強制結算（避免 Firestore 同步延遲造成的卡住）
- **坑**：fallback timeout 不能用 `handleProcess()`（閉包中的 `room` 已過時），必須用 `roomRef.current` 直接呼叫 `processDungeonRound`；`lastProcessedRef.current` 要先鎖定再解鎖，和 `handleProcess` 一致

---

## 2026-06-27（全系統深藍主題改造）

### 改造目標
全站（射手模式 + 教練模式 + 後台）從淺色背景改為深藍色主題，提升夜間使用舒適度與視覺一致性。貓貓村保留原始淺色風格不受影響。

### 架構設計
採用 **CSS specificity 三層分級**控制，不使用 `!important`（inline override 例外）：

| 層級 | 選擇器 | Specificity | 作用 |
|------|--------|-------------|------|
| Tailwind 原始值 | `.bg-white` | 0,1,0 | 預設樣式 |
| 深藍覆寫 | `.content-area .bg-white` | **0,2,0** | 子頁面變深藍 |
| 貓貓村保護 | `.content-area .no-override .bg-white` | **0,3,0** | 還原原始值 |

### 修改檔案

**`src/index.css`**
- 新增 CSS 變數（`--bg-deep: #0f172a`、`--bg-surface: #1e293b`、`--bg-card: #1e293b`、`--text-primary: #f1f5f9` 等）
- body 全域深藍背景 + 自訂滾動條
- **56 行 `.content-area` 覆寫**：背景（bg-white→#1e293b、bg-gray-50→#1e293b 等）、文字（text-gray-900→#f1f5f9、text-gray-600→#94a3b8 等）、邊框（border-gray-200→rgba(255,255,255,0.08)）、陰影
- **34 行 `.no-override` 重置**：完全還原 Tailwind 原始顏色保護貓貓村
- **Attribute selector + `!important` 層**：蓋掉後台 inline styles（`background:"white"` → `background:#1e293b !important`、`color:"#1e293b"` → `color:#f1f5f9 !important`），因為 inline style 優先級高於 CSS class

**`src/pages/MemberApp.jsx`**
- 頁面內容區加入 `className="content-area"`
- 貓貓村用 `<div className="no-override">` 包裹
- 底部導覽列：白底黑字 → `#0f172a` 深藍 + `#94a3b8` 淺灰文字（active 用 `#60a5fa` 藍高亮、`#f59e0b` 金色指示條）
- 小紅點邊框：白 → `#0f172a` 無縫融入

**`src/pages/AdminApp.jsx`**
- **射手模式容器**：`#f8fafc` 淺灰 → `#0f172a` 深藍，改為 `height:100dvh` flex 布局
- **後台容器**：`#f8fafc` → `#0f172a`
- **後台 Header**：白底黑字 → 深藍漸層 `#0f172a→#0c4a6e` + 淺色文字
- **兩個模式的底部導覽列**：白底 → 深藍 + 淺色文字
- **Hub 卡片**：白底 → `#1e293b`，深色標題 → `#f1f5f9`
- 頁面內容區加入 `className="content-area"`

### 踩坑提醒
1. **CSS class 無法蓋掉 inline style**：`BillingSystem.jsx` 用 `background:"white"` inline 語法，CSS `.bg-white` 覆寫完全無效 → 改用 `[style*="background: white"] { background: #1e293b !important; }` attribute selector
2. **`unset` 會讓背景變透明**：初始 `.no-override` 用 `background-color: unset` → 貓貓村白底變透明 → 改為顯式指定 `background-color: #fff` 才能正確還原
3. **`!important` 是必要之惡**：只用在 inline override 層（attribute selector），class-based 覆寫全不用 `!important`

🔗 **在 Obsidian 中開啟**：`obsidian://open?vault=Obsidian%20Vault&file=catarrow%2Fchangelog`

---

## 2026-07-14（世界王噴地下城 + 3 槽固定顯示 + 後台測試工具簡化）

### 改了什麼

**功能 A：世界王擊殺掉落地下城**
- `dungeonExcavation.js`：新增 `grantWorldBossDungeon(memberId)` — 隨機挑選 6 族 + 難度 2~4（稀有~強悍），標記 `fromWorldBoss: true`，寫入 `savedDungeons`（max 3 自動跳過）
- `worldBossDb.js` `distributeWorldBossRewards`：擊殺獎勵 loop 中對每位真實參與者（不含訪客）呼叫 `grantWorldBossDungeon`，放在 `rewardDistributed` 標記前（失敗可重試）

**功能 B：🌍 世界王掉落標示 UI**
- `DungeonStorageTab.jsx`：已保存卡片旁邊顯示 🌍 世界王掉落（橘色 #fb923c）badge
- `DungeonSelectionPanel.jsx`：資訊卡 + 確認 overlay 兩處都顯示該 badge

**功能 C：3 槽固定顯示**
- `DungeonStorageTab.jsx`：改為固定 3 槽卡片設計（`Array.from({length:3}).map`），空格顯示 🕳️ 空槽 placeholder，已滿顯示族系卡片

**功能 D：後台測試工具簡化**
- `AdminDungeon.jsx`：移除地下城次數重置功能（`resetDungeonUsed`/`resetAllDungeonUsed` import、`busy`/`showReset`/`loading` state、`handleResetOne`/`handleResetAll`、重置 JSX 區塊）
- 現在專注於：挑玩家 → 選種族/難度 → 存入選單 → 檢視/刪除槽位

### 為什麼
- 世界王擊殺後缺乏實質獎勵，掉落地下城讓參與者有長期目標
- 儲存槽固定 3 格視覺化，空槽可視讓玩家知道還有空間
- 地下城已無每日次數限制（改為挖掘進度制），重置功能不再需要

### 踩坑提醒
- `grantWorldBossDungeon` 和 `adminSetSavedDungeon` 共享 ~80% 邏輯（讀取→檢查→寫入），若有更多「幫玩家加地下城」函式出現，建議萃取 `_pushSavedDungeon(memberId, entry)` 共用 helper
- 世界王掉落只發給真實參與者（`!isGuest`），訪客無此獎勵

---

## 2026-07-14（地下城選單系統 + 組隊遠征 + Phase E 獎勵結算）

### 改了什麼

**功能 A：地下城選單系統（儲存槽 + 選擇面板）**
- `dungeonExcavation.js`：新增 `saveExcavation(memberId)` — 揭曉時保存到 `savedDungeons` 陣列（最多 3 個）；`removeSavedDungeon` / `getSavedDungeons`
- `DungeonExcavationTab.jsx`：揭曉後改為「📦 保存到地下城選單」，滿 3 個時紅字提示並禁用挖掘
- `DungeonStorageTab.jsx`（新）：即時訂閱已保存地下城清單（族系 emoji + 難度徽章 + 隱藏標記），支援單個移除
- `DungeonSelectionPanel.jsx`（新）：選定地下城後顯示單人確認 overlay / 組隊探索入口
- `DungeonLobby.jsx`：分頁改為「⛏️ 挖掘探索 | 🗺️ 進入地下城 | 🔮 圖鑑」，加入地下城面板含「加入地下城」入口
- `DungeonExpedition.jsx`：支援 `fromStorage` 標記，啟動時自動釋放槽位

**功能 B：組隊遠征系統（建立房間 + 等待 + 加入）**
- `expeditionTeamDb.js`（新）：Firestore 操作層 — `createTeamExpeditionRoom`（含地下城資訊）、`joinTeamExpeditionRoom`（6 碼邀請碼）、`subscribeOpenTeamExpeditionRooms`（開放房間列表）、`disbandTeamExpeditionRoom` / `cleanupTeamExpeditionRoom`
- `DungeonTeamLobby.jsx`（新）：等待室 — 地下城資訊卡 + 隊員清單（最多 4 人）+ 房主可複製邀請碼 + 「開始遠征」/「解散」按鈕；成員顯示「等待房主」+「離開」
- 路由整合至 `DungeonLobby.jsx`：選地城→組隊→建立房間→分享邀請碼→夥伴輸入代碼或從開放列表加入→房主開始
- 加入地下城分頁：輸入邀請碼 + 顯示開放中房間列表

**功能 C（Phase E）：遠征獎勵結算 + 紀錄保存**
- `expeditionDb.js`：新增 `calculateExpeditionRewards`（6 級難度獎勵表金幣/箭露/XP）、`saveExpeditionRecord`（最多保留 20 筆）、`grantExpeditionRewards`（Firestore increment）
- `DungeonExpeditionResult.jsx`（新）：三階段進場動畫 + 成功/失敗配色 + 獎勵明細 + 「🎊 領取獎勵」按鈕
- `DungeonExpedition.jsx`：追蹤 `floorsCleared` 和 `wonLast`，完成/失敗統一顯示結算畫面，領取時自動發放獎勵 + 儲存紀錄 + 重置挖掘
- 清理：移除無用 `ExpeditionFailed` 元件、`resultRewards` state、`showRewards` state；恢復 `broadcastExpeditionFailure` 失敗廣播

### 為什麼
- 原本地下城挖掘後直接進入遠征，缺乏選單管理與組隊功能
- 玩家需要能儲存多個地下城、選擇何時出發、與夥伴組隊
- Phase E 補齊獎勵回饋閉環（打怪→獎勵→紀錄），讓遠征有完整結束感

### 踩坑提醒
- `saveExcavation` 最多存 3 個，滿時 Disable 挖掘（`storageFull` 狀態驅動）
- 組隊遠征使用 6 碼代碼加入，與舊 `dungeonDb` 的代碼空間不衝突
- `DungeonExpedition` mount 時自動 `removeSavedDungeon` 釋放槽位
- `broadcastExpeditionFailure` 仍在 `handleBattleDone` 失敗分支中呼叫（`useCallback` 加入 `profile` 依賴）
- `floorsCleared` 計算：改用 `floorIndex`（0-based）而非 `Math.max(1, floorIndex)`，更精確

---

## 2026-07-14（地下城終戰模式設計定稿）

### 設計完成

地下城全新模式定稿，記錄於 Trellis task `07-14-dungeon-expedition` 的 `prd.md`。

**核心機制**：
- 發掘進度（登入+10、報到+10、每箭+0.3）→ 100% 時手動揭曉
- 金幣強化（隨機 500~2000 強化一級）
- 三層固定結構（探索層→戰鬥層→王關層）
- 六級難度 × 七族（含寶箱族）
- 混種怪物（每層從六族隨機抽不同種）
- 失敗處理：已獲獎勵不收回，進度歸零＋全區廣播

### 第二大腦更新
- `features.md`：新增地下城終戰模式條目
- `quick-ref.md`：新增發掘進度 / 寶箱族 / 難度表速查

---

## 2026-07-14（Phase C：難度擴增 4→6 級 + 混種抽怪 + 寶箱族資料）

### 改了什麼

**Phase C** 為地下城終戰模式建立資料基礎，涵蓋 Trellis task `07-14-dungeon-expedition` 的 Phase C。

**`src/lib/monsterData.js`**
- `FAMILIES` 新增第 7 族 `treasure`（寶箱族 📦）
- 新增 6 隻寶箱怪（寶箱怪 → 神話寶箱巨像，設計為高防低攻型）
- 新增 `drawMixedMonsterPool(count, variant, tier)` — 從六族隨機抽不同種怪物
- 新增 `drawFloorMonsters(floorIndex, difficultyTier)` — 依三層結構生成怪物組合

**`src/lib/monsterRegistry.js`**
- `FAMILY_LOOT` 新增 `treasure` 族掉落表（金幣 ×5、高寶箱率、專屬收藏品）

**`src/lib/dungeonData.js`**
- `EXCAVATION_DIFFICULTIES` — 6 級難度（普通級→神話級，對應 monster tier 1-6）
- `EXCAVATION_FLOOR_CONFIG` — 三層房間類型權重定義（第1層探索/第2層戰鬥/第3層王關）
- `MIXED_FAMILY_WEIGHTS` — 六族均等權重
- `UPGRADE_COIN_RANGE` — 強化金幣 500~2000 隨機
- `EXCAVATION_RARITY_WEIGHTS` — 稀有度骰子權重（依練箭量調整）

**`src/components/dungeon/DungeonTreasureRoom.jsx`** — NEW
- 寶箱族獎勵房元件：金幣噴泉、材料卡、寶箱、收藏品、箭露
- 四階段動畫（enter → fountain → loot → done）
- 使用 `rollBattleLoot` 生成獎勵（金幣 ×5 加成）

### 踩坑提醒
- `drawFloorMonsters` 每次呼叫生成隨機怪物，Phase D 需用 `useMemo` 或 state 快取結果
- 寶箱族怪物掉落的 `rollBattleLoot` 使用 `COIN_RANGE[treasureMonster.tier]`，tier 字串映射需與 `monsterData.js` 的 `TIER_ORDER` 一致

---

## 2026-06-27（修正 Boss 通關 React crash）

### Bug：Boss 結算畫面 `TIER_LABEL` 物件當 React child
- **Bug**：首領通關後畫面卡住並噴 `Error #31: object with keys {label, color, bg}`，且連帶導致組隊模式也無法開房
- **根因**：`DungeonBattleRoom.jsx` Boss 結算畫面中 `{TIER_LABEL[room.monster.tier] || room.monster.tier}` — `TIER_LABEL[tier]` 回傳的是 `{label, color, bg}` 整個物件，React 無法渲染物件 → 擲回 Error #31 → 整個 React 樹掛掉 → 所有依賴同一個 App 殼的頁面都無法運作
- **修復**：改為 `{TIER_LABEL[room.monster.tier]?.label || room.monster.tier}`（只取 label 字串）
- **坑記錄**：HUD 區的 TIER_LABEL 使用模式正確（`const tl = TIER_LABEL[...]; ...tl.label`），但 Boss 結算區直接用 `TIER_LABEL[...]` 作為 JSX child，兩處不一致導致漏修

---

## 2026-06-27（地下城任務類型重設計 + 商店/事件清理 + 方型地圖）

### 任務類型 6→9 種
- **新增 3 種**：`reversal`（逆轉關：6↔X, 7↔10, 8↔9 分數映射）、`odd_only`（單數關：只算 7/9/X）、`even_only`（雙數關：只算 6/8/10）
- **`assignContracts`/`rerollContract`** 參數改為 `x_crit` 6~10、`target_score` 20~50
- **`calcDungeonContractDmg`**：加入 reversal 分數映射邏輯、odd_only/even_only 過濾、target_score 總分門檻檢查（6箭總分 > param 才有傷害）
- **`getContractBadge`**：新增 reversal(橘)/odd_only(青)/even_only(粉) badge

### 商店清理（DUNGEON_SHOP_ITEMS 5→8 項）
- **移除**：`contract_reset`（契約重置）、`rune_repair`（符文修復石）— 功能不需要
- **新增**：`hp_max_boost`（HP上限+30%）、`atk_large`（ATK×1.5）、`def_large`（DEF×1.5）、`revival_front`（前衛復活藥）
- **`dungeonDb.js` `purchaseDungeonItem`**：移除 contract_reset / rune_repair case
- **`DungeonShop.jsx` `SHOP_ITEM_META`**：同步移除對應定義

### 隨機事件豐富化（DUNGEON_EVENTS 10→18 項）
- **移除**：`scroll`（古老卷軸）、`contract_swap`（契約轉換）
- **新增精細級距事件**：`cursed_spray`（ATK×0.7 重度）、`blessed_wind`（ATK×1.2 強化）、`fairy_blessing`（回40%HP）、`dark_ritual`（單人ATK×0.5）、`golden_fountain`（80金幣）、`time_warp` / `sleepy_dust`（怪物不反擊）、`defense_boost`（DEF×1.5）、`wish_well`（單人ATK×2）

### 地圖方形房間改造
- **`DungeonMap.jsx` 完整重寫**：圓形節點 → SVG 方形房間（`<rect>` 圓角矩形），加入斜線網底（未探索）、發光濾鏡（當前房間）、脈衝外框（可移動）、房間標籤+合約 badge
- **`DungeonLobby.jsx` 選擇畫面加大**：難度按鈕 `flex` → `grid-cols-2` 大按鈕、地下城卡片放大（`py-5 px-4`）、加入樓層 badge + 地圖序號

### 修正 reversal 關
- 分數映射：6↔X(11), 7↔10, 8↔9 後走正常傷害公式，非特殊爆擊規則

**踩坑提醒**：
- `target_score` 的 CONTRACT_TYPES desc 需保持與 spec 一致（超越分數關：總分門檻）
- calcDungeonContractDmg 的 reversal 是分數映射而非特殊 crit/miss 規則

---

## 2026-06-27（組隊開房自動清除舊房間）

### 新增：createPartyRoom 自動清除該使用者的舊 waiting 房間
- **為什麼**：前次 React crash 後舊房間殘留在「waiting」狀態，導致使用者無法新建房間
- **改了什麼**：`partyDb.js` `createPartyRoom` 開頭加入查詢該 hostId + status=waiting 的舊房間，`deleteDoc` 全部清除後再建立新房間
- **坑記錄**：如果 dungeon room 也有相同問題，可到 `dungeonDb.js` 的 `createDungeonRoom` 加入相同邏輯

---

## 2026-06-27（地下城地圖模式成員復活 Bug 修復）

### 地下城組隊：跨房間死亡 Bug（`enterMapCombatRoom` 未重置 alive）
- **Bug**：玩家在地圖模式某個戰鬥房間死亡（alive=false），進入下一個房間後仍保持死亡狀態，永遠被排除在戰鬥之外（表現為「被踢掉」）
- **根因**：`enterMapCombatRoom` 沒有像 `startDungeonFloor` 一樣重置 `alive=true`
- **修復**：`dungeonDb.js` `enterMapCombatRoom` 的 member 更新迴圈中加入：
  - `revived: false`（每間房間重置復活旗標，讓復活符重新生效）
  - 若 `!m.alive`：`alive=true` + `hp = max(1, maxHP*0.3)`（以 30% HP 復活）
- **坑記錄**：`startDungeonFloor`（舊地下城模式）有重置 alive，但地圖模式的 `enterMapCombatRoom` 是後來寫的，漏掉了這個重置

---

## 2026-06-27（遠征隊 3 槽 + 遠征獎勵重構 + 村莊三修）

### 遠征隊：3 槽位同時派遣
- **Firestore 欄位**：`members/{id}.expedition`（舊，單一）→ `members/{id}.expeditions.{0|1|2}`（新，map）
- `db.js`：`startExpedition(memberId, slotIdx, ...)` / `collectExpedition(memberId, slotIdx, ...)` 加 `slotIdx` 參數
- `ExpeditionPanel.jsx` 全量重寫：頂部 3 張槽位卡片（空置/進行中/完成）；點空槽展開派遣表單；已在遠征的貓不出現在選貓清單
- 向後兼容：若 `expeditions` 為空但存在舊 `expedition`，UI 自動顯示為 slot 0
- **坑**：Firestore map 更新用 `expeditions.${slotIdx}` 路徑，不能用陣列 index 更新

### 遠征獎勵重構
- `expeditionData.js`：各 T 加入建築材料（ore/melon/fish/meat/driedfish/can），覆蓋 T1-T5
- 稀有獎勵統一 **30% 機率**（T1 arrowdew 5-10 / T2 5-15 / T3 10-30 / T4 15-50 / T5 25-75；扭蛋幣 T1 1 / T2 1-2 / T3 1-3 / T4 1-4 / T5 1-5）
- 倍率從 `catLevelMult(catLevel)` 改為 `catPowerMult(catATK)`
  - `calcCatFullStats(catData)` 純函式：鏡像 useCatCompanion 計算（類型基底+等級+裝備+羈絆）→ 放在 `expeditionData.js` 避免 lib→hook 反向引用
  - `catPowerMult(catATK) = min(3.0, max(1.0, 1 + (atk-10)/100))`：攻擊型貓、高裝備、高羈絆天然得更高獎勵倍率
- `calcExpeditionRewards(tier, catData)` 接收完整 catData（不再只傳 catLevel）
- `handleCollect` 傳 `myCats[exp.catId]`（完整物件）

### 貓貓村三項修正
1. **扭蛋幣小數**：ResourceRow 改 `Math.floor(gachaCoins || 0)`
2. **市集掛賣到期**：`listCardForSale` 寫入 `expiredAt`（+7天）；`subscribeCardMarket` 客戶端過濾過期；UI 顯示「⏳ N天後下架」（1天內紅字警告）
3. **賣家售出通知**：`buyCardListing` 成交後 `createNotification({ targetMemberId: listing.sellerId, type:"market_sale" })`

---

## 2026-06-27（地下城收藏品 + 入口房修正）

### 地下城收藏品系統（全新）
- `src/lib/dungeonCollectibles.js`（新建）：6族系 × 7件 = 42普通 + 24首殺限定 = 66件
- `src/lib/dungeonDb.js`：新增 `addCollectible / addCollectibles / subscribeCollectibles`
- DungeonBattleRoom 結算：Boss 必掉 boss 族系收藏品；普通/精英/寶箱房依機率掉；首殺額外掉限定品
- `src/components/dungeon/DungeonDex.jsx`（新建）：圖鑑元件，進度條 + 族系篩選 + 首殺限定切換
- DungeonLobby：加第三個 Tab「🔮 圖鑑」

### 地下城入口房修正
- `dungeonData.js`：入口格 (0,0) 改為 `entrance` 類型（不再是 monster），`ROOM_TYPE_META` 補 entrance 定義
- 樓梯改放 `row≥1` 隨機位置，避免跟入口同行
- `DungeonExplore.jsx`：entrance 房靜默通過（自動清除），已清除房再次踩不觸發（商人除外）

### Firestore 欄位
- `members/{id}.dungeonCollectibles = { [itemId]: qty }` （increment，不需額外規則）

---

## 2026-06-27（符文系統 + 貓咪修正 + 世界王 + 報到修復）

### 符文系統（地下城專屬）
- `src/lib/runeData.js`（新建）：13類型 × 4階段 = 52種符文，`calcRuneBonus()` 計算加成
- `src/lib/runeDb.js`（新建）：Firestore 操作（getRuneInventory, addRune, equipRunesToDungeon）
- DungeonLobby 等待室加入符文槽 UI，開始時套用 ATK/DEF/HP 加成
- DungeonBattleRoom Boss 通關後掉符文，金幣/XP 獎勵套符文倍數
- Firestore：`members/{id}.runeInventory`、`dungeonRooms/{id}.memberRunes.{memberId}`

### 貓咪系統
- **羈絆每級連續加成**：攻/防型 `+5%/Lv`，全能型 `+2.5%/Lv`（移除 Lv5/Lv10 里程碑制）
- 移除 CatCollection.jsx 手動類型選擇器，改顯示 `CAT_TYPE_MAP` 固定類型
- 修正 PartyBattleRoom catOverlayCats 中 catId 錯誤取了 archerStyle

### 世界王
- `simulateBotRound(bot, bossAtk, bossDef, playerAtk=80)` — 機器人 ATK 改用玩家實際數值

### 報到修復
- rejected 狀態可重新報到：`submitCheckin` 允許覆蓋、按鈕改為「🔄 重新報到」

---

## 2026-06-26（24 地下城 + 首殺系統 + 成就 + 全系統公告）

### 核心設計
- **24 個地下城**（6族 × 4難度），從舊版 `shadow-crypt` 原型升級為完整地下城矩陣
- **首殺系統**：Boss 房通關 → 寫入 `dungeonFirstClears/{dungeonId}`（Firestore），紀錄保持一年後重整，首殺 host 獲得 `dungeonFirstKills` 陣列條目
- **成就圖鑑**：新增「地下城」類別 + 11 個成就（首通關 / 累積次數 / 各難度全族 / 地獄勇者 / 首殺英雄 / 征服者）
- **全系統公告**：首殺後寫入 `systemBroadcasts`，MemberApp + AdminApp 訂閱 30 分鐘內播報，顯示橫幅 toast

### 難度設計
| 難度 | 層數 | 怪物 Tier | Boss Modifier |
|------|------|-----------|---------------|
| 普通 | 2層  | T1-T2     | HP×1.5, ATK×1.5, DEF×1.5 |
| 進階 | 3層  | T3-T4     | HP×1.5, ATK×1.2, DEF×1.2 |
| 困難 | 3層  | T4-T5     | HP×1.4 only |
| 地獄 | 4層  | T5-T6     | 無（原始數值）|

### Tier 映射（mapRoomTier 1→6）
`common / rare / elite / fierce / boss / mythic`

### Firestore 新 Collections
- `dungeonFirstClears/{dungeonId}` — 首殺紀錄（memberId, memberName, clearedAt, teamNames...）
- `systemBroadcasts/{id}` — 全系統播報（type, dungeonId, dungeonName, memberName...）
- `members/{id}.dungeonClearLog.${dungeonId}.{count,lastAt}` — 個人通關記錄
- `members/{id}.dungeonFirstKills[]` — 首殺地下城 ID 陣列（用於成就）

⚠️ **注意**：`dungeonFirstClears` 與 `systemBroadcasts` 需在 Firebase Console 手動新增 Firestore 安全規則：
```
match /dungeonFirstClears/{id} { allow read, write: if request.auth != null; }
match /systemBroadcasts/{id} { allow read: if request.auth != null; allow write: if request.auth != null; }
```

### 修改檔案
- `src/lib/dungeonData.js`：DUNGEON_MAPS 改為 24 個，新增 `DIFFICULTY_CONFIGS`、`FAMILY_CONFIGS` exports，4 個 floor 模板函式
- `src/lib/dungeonDb.js`：新增 6 個函式（`trySetDungeonFirstClear`, `getDungeonFirstClear`, `updateMemberDungeonLog`, `addMemberFirstKill`, `publishDungeonFirstKill`, `subscribeLatestBroadcast`）
- `src/lib/achievementDex.js`：新增 dungeon 類別 + 11 個成就
- `src/components/dungeon/DungeonExplore.jsx`：`mapRoomTier` 支援 tier 1-6
- `src/components/dungeon/DungeonLobby.jsx`：難度 tab + 六族 2×3 格子選單
- `src/components/dungeon/DungeonBattleRoom.jsx`：handleClaim 加入 Boss 房偵測、首殺邏輯、首殺橫幅 overlay
- `src/pages/MemberApp.jsx` / `AdminApp.jsx`：訂閱 `subscribeLatestBroadcast` 顯示首殺橫幅

### 踩坑
- `setFirstKillData(killMeta)` 是非同步的，同一個 handleClaim 函式內不能用 `if (!firstKillData)` 判斷——改用 `wasFirstKill` local 變數
- 管理員 AdminApp 已加 `useRef` import，不需重複加

---

## 2026-06-26（地下城地圖探索模式 Phase 1-3 完整實作）

### 核心設計
地下城模式全面重設計：從「單調樓層」改為「SVG 地圖探索 → 戰鬥 → 返回地圖」循環。

### 新增檔案
- `src/lib/dungeonData.js`：`DUNGEON_MAPS`（幽冥地窖 3 層 24 房）、`ROOM_TYPE_META`（10 種房型）、`getReachableRooms`、合約標籤 helpers
- `src/lib/runeData.js`：7 種符文（復活/強攻/守護/貓靈/暴烈/生命 + 多重復活），3 個稀有度
- `src/components/dungeon/DungeonController.jsx`：根據 Firestore `status` 路由（map_explore→DungeonExplore，active/completed→DungeonBattleRoom）
- `src/components/dungeon/DungeonMap.jsx`：SVG 地圖，5 種節點狀態（未探索黑底問號、已探索彩色、當前金框、可移動脈衝動畫、已清除打勾）
- `src/components/dungeon/DungeonExplore.jsx`：探索 UI + 投票系統 + 前後衛/符文多步驟選擇 modal

### 修改檔案
- `dungeonDb.js`：新增 `initDungeonMapRun`、`saveMapExploration`、`proposeMapMove`、`castMapVote`、`resolveMapVote`、`advanceMapFloor`、`enterMapCombatRoom`（含怪物+陣型+符文注入）、`returnToMapAfterBattle`
- `DungeonBattleRoom.jsx`：加 `isMapMode/onReturnToMap` props；地圖模式 win 畫面顯示「房間通關！」，host 領獎後呼叫 `returnToMapAfterBattle`，Firestore 訂閱自動路由回地圖
- `DungeonLobby.jsx`：新增「地圖探索 / 經典樓層」切換 + 地下城選擇 UI
- `MemberApp.jsx`：DungeonBattleRoom → DungeonController

### 踩坑記錄
- `enterMapCombatRoom` 未設 `totalFloors`，`processDungeonRound` defaults 到 7 → 殺怪進 `path_select` 而非 `completed`；修正：明確設 `totalFloors:1, currentFloor:1`
- DungeonExplore 早期版本含巢狀 DungeonBattleRoom，與 DungeonController 路由衝突；已移除，改由 Firestore status 驅動路由
- `returnToMapAfterBattle` 後不需要呼叫 `onReturnToMap?.()`，Firestore 訂閱自動觸發 DungeonController 重渲染

### 待做（Phase 4+）
- 前後衛傷害規則（前衛全傷/後衛 -30%）接入 `processDungeonRound`
- 後衛每回合「攻擊 vs 治療」選擇 UI（DungeonBattleRoom）
- 非 host 成員的陣型/符文選擇（DungeonBattleRoom 進場前 modal）
- 掉寶清單（dungeonLoot.js）
- 通關結算通知（通知中心）

---

## 2026-06-26（UI 一致性修復 — 組隊死亡動畫 + 地下城HP條 + 世界王CatMsg/CatRoundOverlay）

### 組隊打怪怪物死亡畫面增強
**為什麼**：組隊打死怪物後只有一個單調的黃底文字畫面，遠不如打怪模式的華麗擊殺動畫，玩家感受落差大。
**改了什麼**：`PartyBattleRoom.jsx` `pending_confirm` 區段：
- 加入 `pbr-die-*` CSS keyframes（怪物變黑白+發光 → 討伐印章彈出 → 討伐成功文字 → 戰績統計）
- 使用 `PartyMonsterImg` 顯示怪物大圖 + 擊殺濾鏡動畫
- 新增「討伐」印章 overlay（旋轉彈入，半透明黑底紅字）
- 新增戰績統計三欄：最終傷害 / 回合數 / 參戰人數
- 確認按鈕加入金色發光陰影 `boxShadow` 和進場動畫
- `disabled` 狀態補上 `pointerEvents: none` 防止雙擊
**踩坑提醒**：`pbr-die-*` 前綴避免與打怪模式的 `mb-*` 動畫命名衝突。

### 地下城怪物 HP 條統一
**為什麼**：地下城的 HP 條高度（16px）與打怪/組隊（21px）不一致，邊框顏色也不同。
**改了什麼**：`DungeonBattleRoom.jsx`：`height: 16` → `height: 21`、邊框統一 `1.5px solid #7f1d1d`、背景 `#1e293b`、圓角 20。

### 世界王 CatMsg 改用共享元件
**為什麼**：`WorldBossAttack.jsx` 自定義了一個 `CatMsg` 本地元件，與 `cat/CatMsg` 共享元件功能相同但樣式不同。
**改了什麼**：
- 移除本地 `CatMsg` 函式定義
- 加入 `import CatMsg from "../cat/CatMsg"` 使用共享元件

### 世界王加入貓咪回合視覺覆蓋（CatRoundOverlay）

---

## 2026-06-26（SharedBattleComponents 共用元件庫 — HP條/箭槽/分數按鈕/狀態標籤）

### 建立共用元件庫
**為什麼**：MonsterBattle、PartyBattleRoom、DungeonBattleRoom、WorldBossAttack 四個戰鬥模式各自實作了怪物 HP 條、箭槽、分數按鈕、狀態標籤，程式碼高度重複（每組約 20~40 行），且樣式細節有微小差異。
**改了什麼**：
- 新增 `src/components/shared/SharedBattleComponents.jsx`，包含 4 個元件：
  - **`BattleHPBar`** — 怪物 HP 條（支援 height/21px、showBorder、label、compact 模式）
  - **`BattleArrowSlots`** — 箭槽顯示（支援 slotSize/26~36px、highlightNext、processing 箭號高亮、extraContent 自訂按鈕）
  - **`BattleScoreButtons`** — 分數按鈕（支援三種 variant：`image`/`minimal`/`tailwind`，btnSize）
  - **`BattleStatusTags`** — 狀態標籤列（支援自訂 tags 陣列）
- 修改 4 個檔案導入共用元件：
  - `MonsterBattle.jsx` — HP條→BattleHPBar，狀態標籤→BattleStatusTags，箭槽→BattleArrowSlots，分數按鈕→BattleScoreButtons
  - `PartyBattleRoom.jsx` — 同上
  - `DungeonBattleRoom.jsx` — 同上（分數按鈕使用 tailwind variant）
  - `WorldBossAttack.jsx` — HP條→BattleHPBar(compact模式)，箭槽→BattleArrowSlots，分數按鈕→BattleScoreButtons
**踩坑提醒**：
- WorldBossAttack 箭槽需要傳 `processingIdx` 才能正確顯示逐箭處理動畫
- tailwind variant 的分數按鈕直接用 `SCORE_COLORS` class 陣列，以保持 DungeonBattleRoom 現有風格
- import 路徑 `../shared/SharedBattleComponents` — 注意是從各戰鬥模式的目錄相對路徑

### 世界王加入貓咪回合視覺覆蓋（CatRoundOverlay）
**為什麼**：世界王有貓貓每回合攻擊輸出，但完全沒有視覺回饋。
**改了什麼**：`WorldBossAttack.jsx`：
- 加入 `import CatRoundOverlay` 和狀態變數（`showCatRound`、`catRoundCats`、`catRoundTotalDmg`）
- 戰鬥階段 JSX 中渲染 `<CatRoundOverlay>`
- 貓貓攻擊後設定 overlay 資料並顯示 1800ms

---

## 2026-06-26（結算畫面共用元件 — BattleResultHeader/StatCard/StatRow/RewardItem）

### 新增結算畫面共用元件
**為什麼**：4 個戰鬥模式的結算畫面各自實作，標題區塊、統計卡片、獎勵列表的視覺風格不一致。
**改了什麼**：
- `SharedBattleComponents.jsx` 新增：
  - **`BattleResultHeader`** — 結果標題（emoji + title + subtitle，5 種主題色，內嵌 result-pop 動畫）
  - **`BattleStatCard`** — 卡片式統計（icon + label + value，支援 highlight）
  - **`BattleStatRow`** — 列式統計（icon + label + value，支援 borderTop）
  - **`BattleRewardItem`** — 獎勵品項（icon + name + desc + tier badge）
- 修改 4 個戰鬥模式：
  - `MonsterBattle.jsx` — 戰績統計區 → `BattleStatCard`
  - `PartyBattleRoom.jsx` — 結算標題 → `BattleResultHeader`
  - `WorldBossAttack.jsx` — 標題/戰鬥報告/獎勵 → `BattleResultHeader` + `BattleStatRow`
  - `DuelRoom.jsx` — 結果大字/個人統計 → `BattleResultHeader` + `BattleStatCard`
**踩坑提醒**：`result-pop` keyframe 內嵌在共用元件；DungeonBattleRoom 因即將大更新暫跳過。

---

## 2026-06-26（第 4~5 輪：總射箭里程 + 首頁重整 + 教練射手模式統一 + 全部遺漏修復）

### 總射箭里程系統
**為什麼**：首頁等級卡缺少長期成長回饋，射手想知道自己總共射了多少箭。
**改了什麼**：
- `db.js`：`addPracticeLog` 自動累計 `totalArrowsAllTime`（increment）
- `MemberHome.jsx`：等級卡新增「🏹 總射箭里程」里程碑進度條（100→500→1000→5000→10000→50000 箭）

### 首頁重整 Part 1：徽章精簡 + 貓貓等級加入
**為什麼**：首頁與「我的」重複區塊過多；射手等級卡沒有貓貓資訊。
**改了什麼**：
- `MemberHome.jsx`：
  - 射手狀態卡徽章三色從完整展開（3 行）改為一行「🐱 ⭐ 🏆」總數摘要
  - 等級卡加入完整貓夥伴資訊（頭像/名稱/類型/等級XP/羈絆/技能群組/裝備加成）
  - 清理未使用的 `BadgePip` import

### 教練射手模式統一（AdminApp archerMode）
**為什麼**：教練切換射手模式時，介面仍用固定深藍色 Header，缺少報到視窗、主題色、今日箭數等。
**改了什麼**：
- `AdminApp.jsx`：
  - Import：加入 `subscribeTodayPracticeLogs / subscribeMyCheckin / submitCheckin`
  - 狀態：`todayArrowsGlobal / todayCheckin / showCheckinPopup / checkinBusy / checkinPopupShownRef`
  - Effects：報到訂閱（首次進入自動彈窗）+ 今日箭數訂閱
  - Header：從固定 `#1e3a5f` → `appTheme` 主題色（含 🪙💧🏹👤 資源列 + 返回後台按鈕）
  - 報到浮動視窗：與 MemberApp 完全一致
  - 底部導覽：加入 `appTheme.navActive / navIndicator` 顏色 + active 指示條
  - 補傳 `todayArrows={todayArrowsGlobal}` 給 MemberHome
**踩坑提醒**：handleCheckinSubmit 必須定義在 archerMode render 之前（已在元件層級定義）。

### 教練射手模式遺漏功能全部修復（11 項）
**為什麼**：比對 AdminApp 與 MemberApp，發現共 11 項功能不一致。
**改了什麼**：
1. **Header 射手等級** — 加入 `⚔️Lv.{archerLevelFromXP}`
2. **決鬥 reconnect banner** — 離開決鬥時顯示「⚔️ 決鬥進行中 — 點此回到戰場」
3. **地下城 reconnect banner** — 同上，🏰 地下城
4. **決鬥/地下城 sessionStorage 重整恢復** — `admin_duel_room` / `admin_dungeon_room`
5. **MonsterBattle props** — 補傳 `monsterDex/craftStats/chestStats/potionDex/duelStats`
6. **CatCollection onOpenForge** — 可從貓收藏跳到鍛造
7. **CatVillage initialTab+key** — 鍛造連結可直接定位
8. **版本更新提醒** — `subscribeAppVersion` + `needsUpdate` 彈窗
9. **CompDetail 報名偵測** — 用 `isMemberRegistered` 確認報名
10. **組隊 reconnect 顏色** — 改為 `appTheme.partyBg`
11. **地下城 → DungeonController** — 支援地圖探索模式
**踩坑提醒**：`DungeonController` 是 `DungeonBattleRoom` 的包裝層（含地圖探索路由），需同步替換 `DungeonBattleRoom` import。

### 首頁重整 Part 2：年度檢定精簡
**為什麼**：首頁與「我的」都顯示完整三欄檢定卡片，重複且佔空間。
**改了什麼**：
- `MemberHome.jsx`：年度檢定從 3 欄完整卡片（含背景圖/等級樣式/分數）→ 單行弓種摘要（弓種·分數·等級標籤） + 「查看詳細 →」導向 profile 頁面
- 清理未使用的 `CERT_BG` 常數
**踩坑提醒**：`onPageChange("profile")` 導向的是 MemberProfile，該頁有完整歷年檢定（含展開收合）。

### 首頁重整 Part 3：「我的」快捷連結重新排列
**為什麼**：原分組過多零散（5 組），部分組只有 1 個連結，視覺碎片化。
**改了什麼**：
- `MemberProfile.jsx`：quickLinkGroups 從 5 組 → 3 組：
  - 📌 **常用功能**：學習紀錄・成績歷史・訊息中心（最常用的 3 個）
  - 🎖️ **檢定與申報**：射手證考試・對外比賽
  - ✉️ **溝通與設定**：留言教練・我的弓具・使用說明
- 所有 8 個連結保留，3 欄網格剛好裝滿

### 其他小型修復
- `AdminApp.jsx`：`ADMIN_INVENTORY` 補上 `"gacha"`（與 MemberApp 的 `INVENTORY_PAGES` 一致）

---

### 打怪模式不再掉落徽章碎片與貓貓箱
**為什麼**：36 隻怪物打怪後給徽章碎片（frag_*）與貓貓箱（cat type chest）不符合設計方向。
**改了什麼**：`MonsterBattle.jsx`：
- `makeChests` 解構移除 `catChest`，不加入 mainChests
- 移除 catChest log 行
- `rollMaterialDrops` 結果 `.filter(m => !m.id?.startsWith("frag_"))` 過濾碎片
- 移除 `addFragments` 呼叫與 import
**踩坑提醒**：frags 已被獨立分出來（`mats.filter(frag_)`），直接在 rollMaterialDrops 後過濾更乾淨。

### 貓貓在決鬥模式（DuelRoom）傷害
**為什麼**：貓貓只存了名字，沒有真正參戰。
**改了什麼**：
- `duelDb.js` 新增 `calcCatDmg(catAtk, targetDef)` helper（6箭合算，0.5~2.0倍隨機）
- `applyPlayerCatToRoom` 加 `catAtk` 參數，存到 `team${team}.${memberId}.catAtk`
- `processDuelRound` 在 attacks 加總前插入貓貓攻擊段（effAliveA/B 各選目標，isCat:true）
- `DuelRoom.jsx`：從 hook 取 `catATK`，傳入 `applyPlayerCatToRoom`

### 貓貓在地下城模式（DungeonBattleRoom）傷害
**為什麼**：同上。
**改了什麼**：
- `dungeonDb.js` 新增 `calcCatDmg` helper
- `updateDungeonMemberStats` 加 `catAtk` 參數，存到 `members.${memberId}.catAtk`
- `processDungeonRound` Step 3 結束後插入「貓貓攻擊」mini round（isCat:true）
- `DungeonLobby.jsx`：import `useCatCompanion`，取 `myCatATK`，傳入兩個 updateDungeonMemberStats 呼叫

### 村莊累積生產模型（T2 → T1+T2 同時產出）
**為什麼**：高等建築應同時產出低階材料，方便玩家管理資源，升級更有感。
**改了什麼**：
- `villageData.js` `calcPendingResources`：tiered 資源改為 loop tier 1~maxTier，各自以同速率計算
- `db.js` `collectVillageResources`：同樣邏輯，非分層資源（箭露/射手等）維持原邏輯
**踩坑提醒**：non-tiered 資源（arrowdew、archer、gachaToken）不進 loop，避免 fracKey 衝突。

### 市集重設計（6 種族材料包 + 藥水箱 + 怪物卡包 + 黃金寶箱）
**為什麼**：原本 4 種通用寶箱不夠明確，玩家無法選擇要哪族材料。
**改了什麼**：
- `CatVillage.jsx` `BATTLE_EXCHANGE`：6 族材料包（ghost/mountain/exam/insect/workplace/temple）各消耗對應建築 T1 資源 ×30，加藥水箱/卡包/黃金寶箱
- `doBattleExchange` 加 `family` 參數，傳入 `exchangeMaterialsForChest`
- `db.js` `exchangeMaterialsForChest` 加 `family` 可選參數，加入寶箱 object
**踩坑提醒**：`gotThis` key 改為 `type + family`（否則不同族包 justGot 無法區分）。

---

## 2026-06-25（貓貓等級+裝備+技能系統）

### 舊 catStatMult 被動加成移除（設計簡化）
**為什麼**：TYPE × 羈絆等級的被動加成（射手 ATK/DEF 百分比）與新的 ID 群組主動技能重疊，且 catStatMult 雖有計算但從未真正套用到戰鬥傷害。簡化為「TYPE 只決定基礎 ATK 倍率，羈絆等級只影響技能觸發機率與效果幅度」。
**改了什麼**：
- `catData.js` CAT_TYPES skills 全部改為搞笑貓咪行為敘事（無任何數字加成）
- `useCatCompanion.js` 移除 `getCatStatMult` import 和 `catStatMult` return
- `DungeonBattleRoom.jsx`：移除 catStatMult，光環顯示改為「陪戰中」
- `DuelRoom.jsx`：`applyPlayerCatToRoom` 固定傳 1.0
- `PartyBattleRoom.jsx`：`getArcherStats` catStatMult 參數全換成 1.0
**踩坑提醒**：catData.js 的 `getCatStatMult` / `getCatBattleBonus` 函式保留（以防 UI 有用），但已不被 hook 呼叫。

## 2026-07-03（地下城探索/戰鬥介面修整）

### 進度
**為什麼**：實測發現地下城現在缺少原本想要的「逐房探索地圖」感，而且戰鬥輸入列太早展開，容易卡到點擊。

**改了什麼**：
- `DungeonExpedition.jsx`：新增遠征地圖過場，房間會一格一格往前推進，不再只剩純文字跳轉
- `DungeonBattleRoom.jsx` / `BattleBottomBar.jsx`：戰鬥改成先按「開始計分」，再展開「計分｜藥水｜隊友」
- `DungeonBattleRoom.jsx`：地下城戰鬥預設直接給分數按鈕，移除戰前的額外模式選擇

**踩坑提醒**：
- 剛把地圖過場做完時，`ExpeditionMapStage` 出現 runtime error，原因是新地圖頁面用了未穩定的元件路徑；後來改成內嵌 SVG 地圖，避免再碰到 import / HMR 的 undefined 問題。
- 這次遠征獎勵流程仍維持原本的單人/組隊分流，沒有動到地下城資料結構。

### 進度
**為什麼**：實測遠征還有三個核心問題：不小心退出後回不去、探索流程太系統自動化、以及進場素質沒正確帶入。

**改了什麼**：
- `MemberApp.jsx` / `AdminApp.jsx`：地下城離開時改成「暫離保留房號」，只有房間真的不存在或結束時才清掉 `activeDungeon`
- `DungeonController.jsx` / `DungeonBattleRoom.jsx`：把「暫時離開」和「房間失效」分流，避免誤刪重連資料
- `DungeonExpedition.jsx`：遠征改為手動推進，每一房都要玩家點確認，不再自動跳房
- `expeditionMemberData.js`：抽出遠征戰鬥素質組裝共用 helper，避免 single-player 與 lobby 算法分裂
- `expeditionDb.js`：建立戰鬥房時改用 `??` 預設值，避免 0 值被 `||` 誤判成缺值

**踩坑提醒**：
- `DungeonController` 的 `not_found / completed` 一定要清掉房號，不然 banner 會一直掛著死房。
- 暫離時不能再呼叫 `leaveDungeonRoom()`，否則 host 會被直接結束房間、隊友會被標成離場。

### 貓貓等級 / 裝備 / 技能 三系統實作
**為什麼**：從輔助型升為「真正陪伴玩家的戰鬥夥伴」，與射手等級系統平行。

**改了什麼**：
- `src/lib/catLevel.js`（新）：200級、XP公式與射手相同，`CAT_TIER_XP` 戰鬥後給 XP
- `catData.js` 新增：`CAT_SKILL_GROUPS`（前三補血/中三攻擊/後三防禦）、`CAT_EQUIP_SLOTS`（5格）、`calcCatEquipBonus`、`calcForgeCost`、`calcCatSkillChance/Effect`
- `catDb.js` 新增：`addCatXP`、`upgradeCatEquip`（同步 equippedCat 快取）；`equipCat` 更新同步 `catXP+equip`
- `useCatCompanion.js` 重寫：戰鬥數值整合等級+裝備加成；新增 `triggerCatSkill()`、`saveXP()`
- `MonsterBattle.jsx`：
  - ATK技能：貓咪攻擊後追加 XX%~翻倍傷害
  - HEAL技能：回復射手 HP
  - DEF技能：`catDefShieldRef` 保護下回合計數器攻擊（減傷/完全格擋）
  - 勝利後呼叫 `saveXP(CAT_TIER_XP[monster.tier])`
- `CatVillage.jsx` 新增「🔨 鍛造」TAB：`ForgePanel` 顯示 5 格裝備、費用（村莊材料）、升強化/升階按鈕

**踩坑提醒**：
- 計數器攻擊用 `let cdmg` 才能被貓盾修改（原本是 const）
- `equippedCat.equip` 可能是 `undefined`（舊資料），預設 `{}` → 所有格位視為「普通 +0」
- `calcForgeCost` 回傳 null 代表已達神話+5（極限）

---

## 2026-06-25

### 報到系統改為教練審核制（刪除日常任務）
**為什麼**：舊系統讓學生自己做任務（三選一），太複雜且難以管理；新流程改為教練手動確認出席。
**改了什麼**：
- `db.js`：`submitCheckin` 改建 `pending`；新增 `approveCheckin`/`rejectCheckin`；`subscribePendingCheckins` 加 `pending` filter
- `DailyQuest.jsx`：**完整重寫**，移除任務/施法/Buff，改為 pending/rejected/active/classEnded 狀態顯示 + 下課按鈕
- `MemberApp.jsx`：新增浮動報到視窗（`sessionStorage("checkin_popup_shown")` 防本 session 重複彈）
- `AdminDailyQuest.jsx`：「待施法」→「待審核」，通過/不通過按鈕；inProgress 改用 `!classEnded` 判斷；done 改用 `classEnded` 判斷
**踩坑提醒**：舊 `done` 是 `questDone`，新 `done` 是 `classEnded`。歷史資料的 `questDone` 欄位不影響新邏輯（篩掉了）。

### 修復：下課後不再觸發里程碑 popup
**為什麼**：下課時已結算箭露，若再去練習還會觸發里程碑，導致重複獎勵。
**改了什麼**：`MemberPractice.jsx` 加 `classEndedRef`（useRef）+ `subscribeMyCheckin` 訂閱；saveRound 前檢查 `!classEndedRef.current`。
**踩坑提醒**：用 useRef 而非 useState，避免訂閱更新觸發不必要的重新渲染。

### 首頁射手等級 widget 擴展
**為什麼**：玩家需要在首頁快速看到自己的完整數值與資源狀況。
**改了什麼**：`MemberHome.jsx` 新增 `calcEquippedBonus/calcArcherStats/archerLevelBonus` import；widget 顯示實際 HP/ATK/DEF（三層加成相加）；新增資源列（金幣/箭露/轉蛋幣/今日箭數）。
**踩坑提醒**：`calcArcherStats` 需要 `dexStats`，而 `computeDexStats` 在同一元件已有呼叫，直接複用即可。

### 修復：怪物卡片效果在選擇畫面不顯示
**為什麼**：原本 `cardCollRef`（useRef）不觸發重新渲染，選擇畫面讀到的永遠是初始空值。
**改了什麼**：`MonsterBattle.jsx` 改成 `useState + useRef` 雙軌——`useState` 給渲染用，`useRef` 給 `startBattle` 異步函式同步讀取。
**踩坑提醒**：這是 React closure stale 問題的標準解法，其他元件若有同樣情境可參考此模式。

---

## 2026-06-22（前次 session）

### 效能優化（3 個函式）
**為什麼**：買裝備/升級裝備/申請月卡 UI 卡住，因為有多次串行 Firestore getDoc 讀取。
- `upgradeEquipSlot`：5 次 ops → 2 次平行（接受 clientData，不需 getDoc）
- `submitMonthlyCardRequest`：移除 getDocs/getDoc，接受 `clientCard/hasPending`
- `MemberApp` practice logs：改用 `subscribeTodayPracticeLogs`（只讀今日）
- `MemberHome`：`useState(false)` 移除阻塞 spinner
**設計依據**：CLAUDE.md 規則「優先瀏覽器計算，不需防作弊」

### 射手等級系統（新檔案 archerLevel.js）
**為什麼**：讓射箭練習有長期成長感，各戰鬥模式都需要回饋。
**改了什麼**：新增 `archerLevel.js`；5 種戰鬥模式加 `addArcherXP`；4 處顯示等級（Header/MemberHome/MonsterBattle選擇/MemberProfile）。
**踩坑提醒**：Header 顯示的是 Lv.X，首頁 widget 顯示的是完整 HP/ATK/DEF（三層加成）。

### 組隊打怪靶紙選擇器修復
**為什麼**：`TargetFmtPicker` 出現在戰鬥每一回合，應只在設定時選一次。
**改了什麼**：`PartyBattleRoom.jsx` 移除戰鬥階段的 `TargetFmtPicker` block。
