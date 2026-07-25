# 技術設計 — 冒險者公會重生

## 總原則
1. **獨立遊戲模組**：做成 `src/guild/`（DDD 分層，比照 `src/zombie/`），與主線 RPG 解耦。
2. **只帶入兩個主線輸入**：射手等級（`archerLevel.js`）+ 貓貓陪練（貓系統）。**不帶**怪物卡/主線裝備/檢定/圖鑑/`calcArcherStats`。
3. **公會有自己的戰鬥模式（與主線打怪區隔）**：作者拍板——公會戰鬥**不共用 MonsterBattle**，而是**獨立一套戰鬥 UI/流程**（比照 zombie 的 `ZombieBattleArena`）。只重用**函式庫層**：`damage.js`/`score.js`/`src/battle/` 事件與動畫工具、`src/zombie/domain/backpackEngine` 補給。戰力用公會自己的 `calcGuildExpeditionStats`（射手等級+貓貓+公會裝），不碰主線卡片戰力。這也讓公會戰鬥可以有自己的節奏/規則/呈現，做出差異化。
4. **隔離是架構天生的**：公會戰力 = f(射手等級 + 貓貓 + 公會裝)，根本不 import 主線卡片/裝備，故主線平衡零風險。

## 1. 委託遠征（核心玩法）

### 資料流
```
接委託(accept) → rollExpedition(contract, rank):
    → 依 client/family + 危險星等，隨機 roll N 場怪物陣容（N: 一般3/危險4/極危5）
    → 產生 expedition 物件 { contractId, waves:[monsterId...], hp, supplies, guildEquip loadout }
出發(depart) → 逐 wave：
    wave 戰鬥 = 重用 MonsterBattle（單怪），戰力用「公會遠征戰力」(見 §3)
    每 wave 結束 consumeNodeSupplies(inventory,{hasFought:true}) 消耗食/水
       → foodShortage/waterShortage → 減益（如無法回血、ATK↓）
    HP 跨 wave 延續；可用背包內醫療包/食物短休回復
    任一 wave 陣亡 or 補給耗盡被迫撤退 → 委託失敗（當天不可重接同一張）
全 wave 通過 → 凱旋回報 settleExpedition：聲望 + 公會幣 + 公會裝掉落 + 戰利品機率
```

### 重用點
- **每場戰鬥**：MonsterBattle 現有單怪流程，傳入 `expeditionMode` flag + 公會遠征戰力（不改主線呼叫）。
- **背包/補給**：`src/zombie/domain/backpackEngine.js` 的 `calculateBackpackWeight`/`isOverweight`/`addItem`/`consumeItem`/`consumeNodeSupplies`、`ITEM_WEIGHTS`、`INITIAL_BACKPACK_CAPACITY`。供給品 `supply_food`/`supply_water`/`supply_medical_kit` 等直接沿用。
- 若 zombie backpack 與 zombie 狀態耦合，抽出純函數層共用；不共用則複製精簡版到 `src/lib/guildExpedition/`（避免反向依賴 zombie UI）。

## 2. 階級系統重做（廢舊立新）

- **廢除**：`adventurerSystem.js` 的 `RANKS`/`XP_PER_LEVEL`/`rank.mult`「公會金幣加乘」與相關等級顯示邏輯（舊 `adventurerXP` 欄位保留不刪，僅停用其升級意義）。
- **新聲望** `guildRep`（member 欄位）：完成委託遠征累積。
- **新階級表**（提案，實作可調）：見習 → 銅牌 → 銀牌 → 金牌 → 白金 → 傳說 冒險者，各階需聲望遞增。
- 階級**解鎖**（非戰力）：可接的**危險星等上限**、**公會商店層級**、**稱號**、**冒險者證(可分享卡)**、**獨占外觀**。
- `src/lib/guildRank.js`（新）：`repToRank`/`rankUnlocks`/`nextRankRep` 等純函數。

## 3. 公會專屬裝備（獨立戰力，隔離）

### 隔離架構（最重要）
- **儲存**：獨立，`members/{id}.guildEquip`（或 `guildEquipment` collection），與 `cardCollections`/主線裝備完全分離。
- **計算**：新 `src/lib/guildExpedition/guildStats.js` 的 `calcGuildExpeditionStats(member, guildEquip)` → 產出**僅供公會遠征**的 HP/ATK/DEF。
- **鐵律**：此函式與 `guildEquip` **只被** guild expedition 戰鬥呼叫；**禁止** import 進 `monsterCards`/`constants.calcArcherStats`/MonsterBattle 主線/dungeonDb/partyDb/worldBoss。完工 grep 佐證。
- 槽位提案：主武/防具/飾品/斗篷。取得：委託獎勵 + 公會商店（花公會幣/聲望），可強化。
- **與背包重量的張力**：公會裝有 `weight`，與補給共用背包容量 → 出發前抉擇「帶裝變強 vs 帶補給撐久」。這是核心策略深度。

## 4. 資料模型（Firestore）

| 欄位/集合 | 用途 | 誰寫入 |
|-----------|------|--------|
| `members/{id}.guildRep` | 聲望（升階） | 本人（完成遠征） |
| `members/{id}.guildRank` | 快取階級（可由 rep 算，存快取供查詢） | 本人 |
| `members/{id}.guildEquip` | 公會裝備狀態（槽位/強化） | 本人 |
| `members/{id}.guildBackpack` | 補給庫存（食/水/醫療…） | 本人 |
| `guildExpeditions/{id}` 或 member 子欄位 | 進行中遠征狀態（waves/hp/supplies） | 本人 |
| 每日委託板 | 沿用現有 daily bounty 機制，改成遠征型委託 | 系統/日期 seed |

> 新 member 欄位全部要進 `firestore.rules` hasOnly 白名單，並**提醒老闆手動貼 Console**。

## 4.5 戰鬥呈現與模型：2.5D 鳥瞰 + 槽位距離推進（作者拍板）

**戰鬥模型（＝殭屍模式那套，重用其引擎）**
- **輸入**：射真實的箭、輸入分數（比照現有計分）。
- **目標**：**手動選擇**要射哪隻怪；畫面**最多 4 個目標（4 槽）**。
- **推進＝距離倒數，非實體走位（作者拍板，簡化）**：每隻怪顯示一個**距離值**（如「距離 4」），每回合 **−1**；**歸零即發動攻擊**打你/貓貓。**不做尋路/移動格**，等距位置只是裝飾呈現。（概念同殭屍 `distanceM` 遞減，但表現成一個倒數數字/條。）
- **模型 = A「距離區帶/槽位」**（非格子戰棋）：只有遠近，無左右走位。
- **重用**：`src/zombie/domain/encounterResolver.js` 的 `processRound`（槽位 + 距離 + 命中結算）、arrow 提交結構、`ZombieBattleArena` 的瞄準互動。公會版**換戰力來源**（`calcGuildExpeditionStats` = 射手等級+貓+公會裝）、**加入貓貓為場上單位**、**每回合消耗補給**。

**呈現（2.5D 等距回合制隊伍戰，參考彩虹冒險類 MMO）**
- 版式參考：左上**隊伍頭像列**（英雄+貓，各 HP 條）＋ 頂部「第 N 回合／攻擊」指示；等距綠地戰場，敵怪散佈、每隻下方 **Lv + HP 條 + 距離倒數**。
- 你的隊伍（弓手英雄 + 貓貓 sprite）在**近端（右下）**，敵怪在**遠端（左/中）**——**手動點要射哪隻**（最多 4 個可鎖定目標）。
- 箭矢拋物線飛向被點的怪、命中閃白/浮傷；怪距離歸零時播「發動攻擊」。
- 借鏡 `src/zombie/ui/ZombieMapIsometric.jsx` 的等距繪製。
- **ComfyUI 生圖**：等距地磚（依委託換地形）、俯視角怪物/弓手英雄/貓 sprite。先靜態 + 簡單受擊/攻擊特效，幀動畫後加。

## 5. 大廳 / NPC / 美術（ComfyUI）

沿用 `scripts/gen-*.py` 管線（本機 ComfyUI）。資產清單：
- 公會大廳底圖（委託板/火把/酒館氛圍，深色）
- 公會長貓 NPC（立繪，依階級可換台詞不換圖）
- 委託單/通緝令羊皮紙底
- 階級徽章 ×6（見習→傳說）
- 冒險者證卡背景
- 公會裝備圖示 ×槽位×稀有度
- 戰利品/首級圖示
- **2.5D 戰鬥**：等距地磚組（不同委託地形）、俯視角 sprite（玩家/貓/各族怪物）、受擊/命中特效

UI：公會畫面重構成「大廳」→ 委託板（羊皮紙卡，含故事+☠️星等+隨機陣容預覽）→ 出發前備包畫面（裝備+補給 vs 容量）→ 遠征逐 wave → 凱旋回報。

## 6. 風險 / 注意
- **隔離驗證**（最關鍵）：公會裝/`calcGuildExpeditionStats` 不得被主線戰鬥引用；完工 `grep` 佐證，且主線 build/數值不變。
- **admin 射手模式白屏**（[[feedback_admin_mode]]）：公會是 member 元件；新常數放 `src/lib/`，勿放 UI 再 re-export（循環 import）。
- **重用戰鬥引擎**：以 flag 掛回 MonsterBattle，勿另寫戰鬥迴圈（ai-guide）。
- **zombie backpack 解耦**：若其純函數與 zombie 狀態耦合，抽共用層或複製精簡版到 `src/lib/guildExpedition/`，勿讓 lib 反依賴 `src/zombie/ui`。
- **client-triggered 跨帳號寫入禁忌**：遠征獎勵一律「自己請領」，勿幫別人寫（[[feedback_firestore_rules]]）。
- **規則手動貼**：新欄位不貼 Console 會 permission-denied。
