# 地下城地圖重製：輕量房 + 大地圖 + 事件投票 + 未實裝修復

## 背景

作者回報：地下城「現在的房間每次踩到都要進去選擇，其實久了會疲乏」。
查證後確認問題不是內容不夠，而是**所有房間的互動重量一致** —— 不論是「+5% ATK 的一般事件」還是「精英戰」，都要開全螢幕舞台、點兩次按鈕才能離開。

同時查出三個「事件寫了但沒實裝效果」的洞，以及樓梯位置必然落在角落的生成缺陷。

## 目標

1. 把房間拆成**重量房 / 輕量房**兩級，輕量房在探索地圖上原地即時反饋，不進全螢幕
2. 地圖擴大到兩倍，用輕量房填充密度，重量房維持原本的絕對數量
3. 修掉三個未實裝／設計錯誤
4. 事件與陷阱的決策權重新分配

## 需求

### R1 房間分級

**重量房（Stage Room，維持現狀行為）**
`battle` / `elite_battle` / `trap` / `event`(特殊) / `chest` / `shop` / `rest`

**輕量房（Inline Room，新增）** —— 站上去即結算，格子上浮動文字＋音效，不離開地圖
| 房型 | 內容 |
|---|---|
| `quick_event` 快速事件 | 從 `GENERAL_EVENTS` 抽一則直接套效果 |
| `empty` 空房間 | 無效果，顯示廢話文案 |
| `coin_pouch` 錢袋 | 直接 +金幣 |
| `mini_chest` 迷你寶箱 | 少量素材／箭露／藥水 |
| `scout` 瞭望點 | 揭開周圍 2 格迷霧（無數值效果，導航潤滑） |

**`general_event` 房型廢除**，全部併入 `quick_event`。
理由：一般事件設計上就是「踩到即結算、無選擇」，開全螢幕是純粹的疲乏來源。廢除後「進入事件」只保留給真的要做選擇的特殊事件。

### R2 地圖擴大與配額生成

- `GRID_SIZE` 5 → 7（49 格）
- `roomCount` 20~23 → 40~46
- 生成法由**純權重亂抽**改為**配額制**：先擺固定數量的重量房，剩餘格子用輕量房權重填滿
  - 純權重在大地圖上會讓戰鬥／陷阱房等比暴增，一趟要打 6 場

重量房配額：
| 房型 | 第1層 | 第2層 |
|---|---|---|
| battle | 2 | 3 |
| elite_battle | 0 | 1（保底，沿用現有邏輯） |
| trap | 3 | 2 |
| event（特殊） | 2 | 2 |
| chest | 3 | 3 |
| shop | 1 | 1 |
| rest | 2 | 2 |
| 小計 | 13 | 14 |

輕量房權重（填滿剩餘 ~26~30 格）：
`quick_event` 40 / `empty` 25 / `coin_pouch` 20 / `mini_chest` 15 / `scout` 10

第 3 層（分支王關，7 間）**不動**。結構上形成「1、2 層探索輕快 → 3 層濃度拉滿」的對比。

### R3 樓梯位置

現況：`bfsFarthest()` 取離入口最遠的格子。在 20~23/25 幾乎滿版的地圖上，最遠點**數學上必然是角落**。

改為：從「BFS 距離 ≥ maxDist × 0.75」的候選格中隨機挑一格。7×7 上約落在 8~10 步，位置每趟浮動。

### R4 事件選擇改為全員投票（方案 A）

現況：`DungeonEvent.jsx` 的選項按鈕包在 `isHost` 內，隊員只看到「等待房主選擇事件結果…」。

改為：
- 每位存活隊員各自看得到選項並各自投票
- 票多的選項套用到**全隊**（沿用事件 effect 既有的「全隊」語意）
- 平票時**房主那票算兩票**
- 全員投完才結算；房主可透過既有的 `TeamRoomVotingBar.onForceAdvance` 強制定案

沿用陷阱房既有的 `roomChoices` / tally 機制（`DungeonTrap.jsx:76-86`），非從零實作。

### R5 陷阱房改房主單獨決定

與 R4 相反方向：
- 押大小按鈕**只有房主看得到**
- 隊員畫面顯示陷阱是什麼（icon／標題／描述，header 已有）＋「房主正在判斷…」

### R6 三個未實裝／缺陷修復

**Bug 1 — 單人遠征的怪物強弱事件完全無效**
`DungeonExpedition.jsx::applyEventEffect` 處理了 hp/atk/def/dmg/gold/item/cost，**漏了 `monsterHp` 與 `monsterAtk`**。
`:786` 讀的 `floorModsRef.current` 來自 `nextFloorModsRef`（`:475`），而該 ref **從頭到尾沒有任何地方寫入**，永遠是 `{}`。
受影響事件（選了等於白選）：`s_twopaths` / `s_napnow` / `s_kittentax` / `s_luckycoin` / `s_button` / `s_twoboxes`。

**Bug 2 — 組隊模式陷阱房零傷害**
`DungeonTrap.jsx:116-127` 的效果套用**只寫在 `if (localMode)` 分支內**。線上模式只寫 `roomResolution` 並顯示「💥 閃避失敗！受到陷阱影響」，接著 `onSharedDone` 直接推進 —— 沒有扣血、沒有扣 ATK/DEF、沒有扣金幣。組隊陷阱目前是純演出。

**Bug 3 — 樓梯必然在角落**（同 R3）

### R7 怪物抽取修復（2026-08-06 追加）

**Bug 4 — 精英怪整層共用同一隻**
`TeamExpeditionBattle.jsx::attachGridMonsters` 與 `DungeonExpedition.jsx::enterRoom` 都把**同一個** `plan.elite` / `monsterPool.elite` 物件塞給該層每一間 `elite_battle` 房。第 3 層三條支線各最多 3 間精英房 → 整趟只看得到同一隻精英怪。
擴充清冊每族每階都有 3 隻可抽（已實跑驗證：insect T3 = 絲葉幼蠶／蜈蚣精／百節甲衛），所以是取用端的問題，不是資料缺口。

**Bug 5 — 舊 `drawExpeditionBoss` 尚未遷移（4 個活躍呼叫點）**
`DungeonSelectionPanel.jsx:69`（王預覽）／`GuestDungeonEntry.jsx:26`／`DungeonExpedition.jsx:345`（訪客）／`dungeonExcavation.js:46`（fallback）。
它走舊 `MONSTERS` 表且用 `MONSTERS.find()` 取**第一隻**（非隨機），完全不碰 252 隻擴充清冊。新的那套是 `dungeonBossEncounter.js::resolveDungeonBossEncounter`，兩套並存會造成「預覽一隻王、實際打到另一隻」。

### R8 怪物強度顯示改版（2026-08-06 追加）

**根因：階級名與變體名撞名撞色**
```
TIER_LABEL.fierce   = 「強悍」 #f97316   ← T4 階級
VARIANT_LABEL.strong = 「強悍」 #f97316   ← 強化變體
TIER_LABEL.common   = 「普通」            ← T1 階級
VARIANT_LABEL.normal = 「普通」            ← 一般變體
```
`DungeonBattleRoom` 的怪物名旁**並排兩顆徽章**，都可能寫「強悍」。作者因此把 T4 的晶尾小蠍誤認成 T3。

改動：
1. **階級一律用 T1~T6 數字**（`monsterTierNumber()`），中文只留給變體
2. 變體徽章顯示**實際倍率**（`variantMult`）：弱化 0.78~0.92、強悍 1.15~1.4 是隨機落點，同樣寫「強悍」的兩隻可能差 25%
3. 進場加**強度揭示**演出（大字 + 數值差 + 強悍脈動）
4. **血條外框吃強度色**（藍／灰／紅），讓強度在戰鬥全程都看得見，不只進場一次

## 驗收條件

- [ ] 走一趟第 1 層，全程不因 `quick_event`／`empty`／`coin_pouch`／`mini_chest`／`scout` 離開探索地圖
- [ ] 輕量房效果（金幣、HP、buff、道具）實際寫入，不只是浮動文字
- [ ] 第 1 層重量房總數為 13，第 2 層為 14（不隨地圖放大而增加）
- [ ] 樓梯連續生成 10 次，不會每次都在角落，距離入口 8~10 步
- [ ] 組隊事件房：非房主也看得到選項並可投票；全員投完才結算；平票時房主票重 2
- [ ] 組隊陷阱房：非房主看不到押大小按鈕，但看得到陷阱是什麼
- [ ] 組隊陷阱房閃避失敗後，隊員 HP／buff／金幣**實際變化**
- [ ] 單人遠征觸發 `s_twopaths`「衝濃霧」後，該層怪物 HP 實際 −10%
- [ ] `general_event` 房型已無任何產生路徑
- [ ] 教練切換射手模式進入地下城不空白

## 非目標

- 第 3 層分支王關結構不動
- 裝備加成公式不動（見 memory: 裝備加成公式不得改）
- 不調整既有重量房本身的演出與獎勵
