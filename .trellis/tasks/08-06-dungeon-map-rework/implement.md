# 執行計畫

分四階段。每階段結束都是一個可獨立驗證、可獨立回退的點。
先做風險最低、與地圖生成無關的 bug 修復，再動生成層，最後才是 UI 分流。

---

## 階段 0：三個 bug 修復（與地圖重製無耦合，可先上線）

- [ ] **0.1** `DungeonExpedition.jsx::applyEventEffect` 補 `monsterHp` / `monsterAtk`
  - 寫進 `floorModsRef.current`（當層生效）而非 `nextFloorModsRef`，對齊文案與組隊端行為
  - 驗：單人觸發 `s_twopaths` 選「衝濃霧」→ 該層下一隻怪 HP 少 10%
- [ ] **0.2** `DungeonTrap.jsx` 線上模式補上效果套用（Bug 2）
  - 在既有 `updateDoc` 同一次寫入附帶 `members.*` updates；gold 類走 `addCoins` 排除 guest/kid
  - 驗：組隊陷阱閃避失敗 → 隊員 HP / ATK / DEF / 金幣實際變化
- [ ] **0.3** `expeditionGrid.js::bfsFarthest` → `pickStairs`（距離 ≥ maxDist×0.75 隨機挑）
  - 驗：連生成 10 層，樓梯不再每次都在角落
- [x] **0.4** 精英怪每間房各自抽（Bug 4）
  - `TeamExpeditionBattle.jsx` 格子層與分支層、`DungeonExpedition.jsx::enterRoom` 三處
  - 抽不到才退回 `plan.elite` / `monsterPool.elite`
- [x] **0.5** 怪物階級改 T 數字 + 變體顯示實際倍率（R8 前兩項）
  - `monsterData.js`：新增 `monsterTierNumber()`、`applyVariant` 回傳 `variantMult`
  - `monsterExpansionAdapter.js`：`applySoloVariant` 回傳 `variantMult`
  - `DungeonBattleRoom.jsx`：新增 `MonsterTierBadge`，`MonsterVariantBadge` 吃 `mult`
- [x] **0.6** 強度揭示演出 + 血條外框強度色（R8 後兩項）
  - `MonsterStrengthReveal` + `db-strength-reveal` / `db-strength-pulse` keyframes
- [x] **驗證關卡**：ESLint 0 error、`npm test` 314 pass、`npm run build` 成功

- [x] **0.7** 訪客王遷移到擴充清冊（Bug 5，範圍已修正）
  - **調查更正**：原本記為「4 個未遷移呼叫點」講重了。實際上 `DungeonSelectionPanel:69`（第三順位）、
    `dungeonExcavation:46`（catch 內）、`DungeonExpedition:345`（訪客且 runId 為 null 時）都是**合法的最後手段**，
    真正沒遷移的只有 `GuestDungeonEntry.jsx`。
  - **連鎖根因**：`GuestDungeonEntry` 回傳的 dungeon 物件 `id`/`savedId` 都是 null，
    `resolveDungeonBossRunId()` 四個來源全落空 → `resolveDungeonBossEncounter()` 必回 null
    → 訪客路線**永遠**退回 `drawExpeditionBoss`（舊 MONSTERS 表 + `find()` 取第一隻、非隨機）。
  - 修法：產生穩定 `bossRunId`，改呼叫 `createLockedDungeonBossEncounter`，把 `bossRunId` + `bossEncounter` 一併往下傳。
    `id` 刻意維持 null（訪客不寫 savedDungeons），靠 `bossRunId` 在優先序中排在 `id` 之前。
  - 順手更正 `dungeonExcavation.js:46` 的過期註解：實測 7 族 × 6 階共 42 組**全部**都是 2 小王 + 1 大王
    （含 treasure），該 catch 已是保險絲而非常態路徑。
- [x] **驗證**：ESLint 0 error、`npm test` 647 pass、`npm run build` Compiled successfully

**階段 0 剩餘（未做）**
- [ ] **0.8** 教練切射手模式進地下城實測（memory: Admin Mode Blank）—— 需真實登入，無法自動驗
- [ ] **0.9** 訪客實走一趟，確認預覽的王與第 3 層打到的王是同一隻擴充王

---

## 階段 1：輕量房規則層（純函式，不接 UI）

- [x] **1.1** 新建 `src/lib/dungeonInlineRooms.js`
  - `INLINE_ROOM_TYPES`、`INLINE_ROOM_WEIGHTS`、`isInlineRoom()`、`resolveInlineRoom()`
  - `quick_event` 從 `GENERAL_EVENTS` 抽（排除 `effect:{}` 的純劇情，那些留給 `empty` 用）
  - `empty` 從 `GENERAL_EVENTS` 裡 `effect:{}` 的 8 則廢話文案抽（一顆石頭、凝視虛空、牆壁研討會…）
  - `coin_pouch` 20~60 隨機金幣
  - `mini_chest` 少量素材／箭露／`carry_heal_basic`
  - `scout` 無效果，`revealRadius: 2`
- [x] **1.2** 新建 `src/lib/dungeonInlineRooms.test.js`（19 個測試全過）
  - effect 形狀與 `GENERAL_EVENTS` 同構、`empty` 必為空物件
  - 權重加總 110、五種都抽得到、分布順序正確
  - 邊界：random 回 0 / 趨近 1、未知型別、room 為 null
  - 舊存檔 `general_event` → `quick_event` 別名
- [x] **驗證關卡**：`npm test -- dungeonInlineRooms` 19 pass、ESLint 0 error

**階段 1 決策記錄**
- `empty` 的台詞直接沿用 `GENERAL_EVENTS` 裡 `effect:{}` 的那 11 則（一顆石頭、凝視虛空、
  牆壁研討會…）。它們本來就沒有任何數值，拿來當空房間台詞比硬寫「這裡什麼都沒有」有味道，
  也不必新增文案資產。`quick_event` 則只抽剩下 58 則有效果的。
- `mini_chest` **給素材**（作者拍板 2026-08-06，推翻先前的「不給素材」）：
  素材 50%／回復藥 25%／箭露 25%。抽不到素材（族系不存在）就往下退，不讓玩家開到空箱。
- **迷你寶箱素材一律降一階、最低 T1**（`miniChestMaterialTier()`）——
  這是**寶箱房的價值保護**：寶箱房（重量房、開全螢幕有稀有度演出）給**同階**素材，
  是唯一的同階來源；迷你寶箱踩到就結算、不進畫面，就不該搶它的定位。
  T1→T1、T2→T1、T3→T2…，且**永遠發不出 mythic**（T6 素材只能從 T6 寶箱房拿）。
  數量是 `tier+1`（低一階但給得多，對照寶箱房的「同階 × tier 數量」）。
- 素材資料源刻意用 `monsterMaterials.js::MATERIALS`，**與寶箱房同一份** ——
  發出打造系統不認得的 id 會變成玩家背包裡的死素材（測試有守這條，七族 × 六階全掃）。
- ⚠️ **第 7 族寶箱族（treasure）沒有素材鏈**：`MATERIALS` 只涵蓋 6 個一般族系
  （外加 `all` / `worldboss` 兩個非地下城族）。隱藏地下城 100% 是寶箱族，
  所以迷你寶箱在那裡會退回藥水／箭露。
  **這不是缺漏**：寶箱房（`dungeonChestLoot.js`）用的是同一份 `MATERIALS`，
  它在隱藏地下城本來就發不出素材，補償走 `calculateExpeditionRewards` 的 ×3 金幣／箭露。
  兩者行為一致，已寫成測試。
- `arrowDew` 與 `material` 是唯二超出 GENERAL_EVENTS 形狀的鍵，階段 3 接線時呼叫端要
  另外接 `addArrowdew()` / `addMaterials()`，並排除 guest/kid
  （見 memory: 正式資料層用 accountType 排除體驗帳號）。
  ⚠️ `addMaterials(memberId, mats)` 每個元素只加 1，要給 N 個就把同一個物件放進陣列 N 次。

---

## 階段 2：生成層擴大與配額制

- [ ] **2.1** `expeditionGrid.js`：`GRID_SIZE` 7、`roomCount` 40~46
- [ ] **2.2** `dungeonData.js`：`EXCAVATION_FLOOR_CONFIG.roomTypes` 權重表 → 配額表 `STAGE_ROOM_QUOTA`
- [ ] **2.3** `expeditionGrid.js::generateGridFloor` 改配額式分配
  - 先展開重量房配額 → 剩餘用 `INLINE_ROOM_WEIGHTS` 填滿 → shuffle → 配位
  - 保留既有「戰鬥房不相鄰」修復迴圈
  - 移除 `WEIGHT_ROOM_MAP.general_events`
  - 配額大於可用格子時要能截斷（防呆）
- [ ] **2.4** 更新 `expeditionGrid.test.js`
  - 第1層重量房恰 13、第2層恰 14（不隨 roomCount 浮動）
  - 產物不含 `general_event`
  - 樓梯距離落在合理區間
- [ ] **驗證關卡**：`npm test -- expeditionGrid`
- [ ] ⚠️ **回退點**：此階段結束若體感不對（一趟太長／太空），只需調 `STAGE_ROOM_QUOTA` 與 `roomCount` 兩個常數，不必動程式碼

---

## 階段 3：UI 分流與浮動反饋 ✅（2026-08-06 補完）

- [x] **3.1** `DungeonStages.jsx::GridMapStage` 加 `inlineToast` prop 與浮動反饋層
  - 定位用既有的 `cellCenter(playerPos.x, playerPos.y)`（rendered 在 DungeonMapView 世界層內）
  - CSS keyframe `inline-toast-pop` 上浮淡出 1.6s，父層 2s 後清 state
  - 音效依房型分流（quick_event→sfxBuff/sfxDebuff 依正負、coin_pouch→sfxCoinDrop、
    mini_chest→sfxOpenChest、scout→sfxOpen、empty→sfxTap）——單人與組隊同規格
  - ⚠️ 輕量房排除在 `canEnter` 之外（不顯示「進入」按鈕），踩到即結算
- [x] **3.2** `DungeonExpedition.jsx` 加輕量房分流
  - **踩到即結算**：`handleCellClick` 移到輕量房時直接 `resolveInlineStep`（比 design 的
    enterRoom 分流更早——完全不會出現「進入」按鈕）；`enterRoom` 也加了回退分流（舊存檔）
  - `resolveInlineStep`：applyEventEffect（hp/atk/def/dmg/gold/item 同構）＋ arrowDew/addMaterials
    另接 ＋ `scout` 半徑 2 揭迷霧 ＋ markRoomCleared ＋ 浮動 toast
  - `general_event` 舊存檔視同 `quick_event`（isInlineRoom 有別名）
- [x] **3.3** `TeamExpeditionBattle.jsx::enterExplorationRoom` / `handleCellClick` 加輕量房分流
  - 房主本地算 → 寫 `roomResolution:{ kind:"inline_room", roomType, toast, effect, timestamp }`
    + members updates（buildTeamEventResolution）+ 地圖 cleared + scout visitedIds
  - gold / item / arrowDew / material 沿用 addCoins / addPotions 迴圈，另接 addArrowdew / addMaterials
    （全部排除 guest/kid）
  - 隊員端（含房主自己）訂閱 `roomResolution.kind === "inline_room"` 就播同一個浮動反饋
- [ ] **驗證關卡**：單人跑滿一層 ✅（程式碼路徑驗證）＋ 組隊雙裝置實測 ❌（需真人）

---

## 階段 4：事件投票與陷阱決策權 ✅（2026-08-06 補完）

- [x] **4.1** `DungeonEvent.jsx` 移除選項的 `isHost` 限制，改投票 UI
  - 每人一票（`confirmNonCombatRoom(roomId, memberId, idx)` 同時寫 roomConfirms + roomChoices）
  - 已投票鎖定按鈕並顯示「🗳️ N 票」；全員投完顯示「等待結算…」
  - 單人（localMode）維持「直接選擇」不受影響
  - 一般事件的「接受效果」按鈕也解除 isHost（舊存檔相容路徑）
- [x] **4.2** `TeamExpeditionBattle.jsx` 加計票邏輯
  - 最高票勝；平票時房主票權重 2（`tallyEventVotes`）
  - 全員投完 → 房主端 effect 自動 `resolveTeamEvent(winningChoice, idx)`
  - ⚠️ **結算後清 `roomConfirms`**：讓大家看完結果再按「繼續探索」二次確認，結果面板不會一閃即逝
  - `TeamRoomVotingBar.onForceAdvance` → 事件房改成 `forceAdvanceFunctionRoom`（先以最高票結算再推進）
  - 防重入：`eventResolvingRef` 在途鎖（全員投完瞬間多個快照不會 roll 兩次）
- [x] **4.3** 新增計票純函式與測試（`src/lib/dungeonEventVotes.js`，13 測）
  - 平票偏房主、單人房、有人倒下（`alive:false`）不計票、選項鍵數字/字串都相容
- [x] **4.4** `DungeonTrap.jsx` 押大小按鈕收回房主，隊員顯示「👑 房主正在判斷…」
  - `allConfirmed` 改為「房主已下注」（`roomConfirms[hostId] === true`）
- [ ] **驗證關卡**：組隊雙裝置實測投票與強制定案 ❌（需真人）

---

## 最終驗收

- [x] 跑 `npm test`（全專案 1829 pass）
- [x] 跑 ESLint 檢 no-undef（`react-scripts build` 不擋）
- [x] `npm run build` 成功
- [ ] **教練切換射手模式進地下城不空白**（memory: Admin Mode Blank，需真人登入）
- [x] `git status` 確認沒有漏加的未追蹤相依檔
- [x] 逐條對照 `prd.md` 驗收條件（程式碼層面全數符合；需真人實測的列在驗證關卡）
- [x] 更新 `docs/second_brain/`（changelog.md）並同步 Obsidian

## 注意事項（來自過往踩坑）

- 平行 agent 同 working tree 時**禁用 `git add -A`**，只加自己明確改的檔
- Firestore 規則若有新欄位要**手動貼 Console**（CLI 403）
- 刪除 `general_event` 相關程式碼時，搜函式名之外也要搜變數名，避免留下 no-undef
- 裝備加成公式不得改；調難度只能動配額與怪物材料需求
