# 🎮 game-systems — 遊戲化規格
> 最後更新：2026-06-27（合約/事件全面重設計）

🔗 **在 Obsidian 中開啟**：`obsidian://open?vault=Obsidian%20Vault&file=catarrow%2Fgame-systems`

## 完整角色數值公式

```
HP  = calcArcherStats.hp  + archerLevelBonus(lv).hp  + calcEquippedBonus(cards).hp
ATK = calcArcherStats.atk + archerLevelBonus(lv).atk + calcEquippedBonus(cards).atk
DEF = calcArcherStats.def + archerLevelBonus(lv).def + calcEquippedBonus(cards).def

calcArcherStats 需要：{ member, certification, certRecords, dexStats }
  HP 基礎 200（上限 800）/ ATK 基礎 15（上限 160）/ DEF 基礎 10（上限 120）

archerLevelBonus(level)：每級 hp+5 / atk+1 / def+1

calcEquippedBonus(cards[])：cards = equipped.map(id=>cardColl.cards[id]).filter(Boolean)
```

## 報到流程（2026-06-25 改版）

```
登入 → 浮動視窗（sessionStorage flag 防重複）
→ submitCheckin → pending
→ 教練 AdminDailyQuest 審核 → approveCheckin(→active) / rejectCheckin(→rejected)
→ active 時可累積箭數
→ 學生 DailyQuest 點下課 → submitClassEnd → classEnded=true
→ addArrowdew(今日總箭數) → getMilestonesReached → grantArrowMilestoneRewards
```

**注意**：MemberPractice 有 `classEndedRef`，下課後不觸發里程碑（防重複結算）

## 前後衛系統（地下城 + 組隊，2026-06-27 統一規格）

```
role = "front" | "rear"（每回合送箭時選擇）

【前衛】
- 正常攻擊
- 怪物反擊只打前衛（frontIds 存活時後衛免疫）
- HP 歸零 → 不立即陣亡，自動轉後衛 + 復活 50% maxHP
  → 新 role 由伺服器寫入 Firestore，前端下回合從 room.members[id].role 讀取

【後衛 - 選攻擊 (rearChoice="dmg")】
- 箭傷 × 0.5
- 反擊免疫

【後衛 - 選治癒 (rearChoice="heal")】
- 不攻擊怪物（arrowBreakdown dmg 計算但 dmgMul=... 等等，實際上後衛dmg仍計算，heal選擇下照算箭傷）
  ⚠️ 注意：heal 選擇下並沒有 dmgMul=0，箭傷照常計算（不是0傷）
- 每回合末：pool = 25% maxHP → 均分給所有存活隊友（不含自己）
- 反擊免疫
```

**實作位置**：
- `dungeonDb.js` `processDungeonRound` — 地下城版本
- `partyDb.js` `processPartyRound` — 組隊版本（2026-06-27 新增）

## 怪物人數縮放（地下城 + 組隊，2026-06-27 統一規格）

```
N = 玩家人數（含 bot），extraMembers = N - 1

monHPMult  = 1.0 + extraMembers * 0.5   (HP  每多一人 +50%)
monAtkMult = 1.0 + extraMembers * 0.15  (ATK 每多一人 +15%)
monDefMult = 1.0 + extraMembers * 0.15  (DEF 每多一人 +15%)
rewardMult = 1.0 + extraMembers * 0.2   (金幣/XP/掉落 每多一人 +20%)

• 地下城：startDungeonBattle → monster.atk/def 已縮放存入 Firestore
• 組隊：startPartyBattle → 同上；rewardMult 存入 room document
• 結算時讀取 room.rewardMult，套用於金幣/XP/collectible chanceMult
```

## 射手 XP 來源

```
打怪單人：MONSTER_TIER_XP[tier]（5/10/20/30/50/80）
組隊：    怪物 XP × 1.5
決鬥勝：  50 / 決鬥敗：20
地下城：  通過每層 × 15
世界首領：每回合 × 2.0，上限 300
```

## 卡片系統

```
MAX_EQUIPPED=5
種族→屬性：forest→hp / dragon→atk / undead→def / beast→atk / demon→hp / machine→def
升星費用：STAR_UPGRADE_COST=[1,2,3,4,5]（碎片）
cardColl 訂閱：subscribeCardCollection → { cards:{}, equipped:[] }
顯示用 useState，異步函式用 useRef（雙軌設計，MonsterBattle 已套用）
```

## 箭露與里程碑

```
下課時：addArrowdew(memberId, todayArrows)
里程碑：getMilestonesReached(old, new) → grantArrowMilestoneRewards
MemberPractice 練習結束後：classEndedRef.current === true 時跳過里程碑
```

---

## 貓貓村材料系統（2026-06-25 重新設計）

### 兩系統邊界

| 系統 | 專屬資源 | 共用資源 |
|------|---------|---------|
| 貓貓村 | 村莊材料（礦物/瓜瓜/鮮魚/動物肉/小魚乾/貓罐頭/貓薄荷/貓毛） | 六族材料包、箭露、金幣、藥水、怪物卡 |
| 打怪RPG | 六族怪物材料（common~mythic，36種） | 同上 |
| 射手遠征 | 任務特殊材料（Lv17+建築升級用） | 精英/傳說族材料包 |

### 村莊建築累積生產（高稀有度 = 低產量）

| 建築等級 | T1 | T2 | T3 | T4 | T5 |
|---------|----|----|----|----|-----|
| T1（Lv1-4） | 100% | — | — | — | — |
| T2（Lv5-8） | 70% | 30% | — | — | — |
| T3（Lv9-12） | 50% | 30% | 20% | — | — |
| T4（Lv13-16） | 40% | 30% | 20% | 10% | — |
| T5（Lv17-20） | 35% | 25% | 20% | 15% | 5% |

比例指「每小時產出分配」，高 tier 材料稀有，T5 即使到最高級也只佔 5%。

### 六族材料包（三系統橋接貨幣）

| 包等級 | 內容 | 主要來源 |
|--------|------|---------|
| 基礎包（T1-T2） | 指定族 common×5 + rare×2 | 村莊市集兌換、打怪低階掉落 |
| 進階包（T2-T3） | rare×4 + elite×2 | 村莊高階兌換、打怪中階掉落 |
| 精英包（T3-T4） | elite×3 + fierce×2 | 射手遠征回傳、打怪高階掉落 |
| 傳說包（T4-T5） | fierce×2 + boss×1 + 機率 mythic | 射手遠征限定 |

### 村莊市集兌換表

| 兌換品 | 消耗村莊材料 | 備註 |
|--------|------------|------|
| ghost族基礎包 | 礦物T1 × 40 | 其他族等比，用對應建築材料 |
| ghost族進階包 | 礦物T1 × 80 + T2 × 30 | |
| 藥水箱 | 貓薄荷藥水 × 15 | 煉金室產出的用途 |
| 怪物卡包（1抽） | 貓毛 × 20 | 隨機36種怪物卡 |
| 金幣寶箱 | 箭露 × 100 | 直接換金幣 |

### 廢料換箭露（手動點擊）

| 材料等級 | 兌換比例 |
|---------|---------|
| T1 × 200 | 箭露 × 1 |
| T2 × 100 | 箭露 × 1 |
| T3 × 50  | 箭露 × 1 |
| T4 × 20  | 箭露 × 1 |
| T5 × 5   | 箭露 × 1 |

### 打怪材料掉落（2026-06-25 提高）

```
MATERIAL_CHANCE: common 55% / rare 65% / elite 75% / fierce 85% / boss 92% / mythic 97%
getMaterialDropCount: common 1 / rare 2 / elite 3 / fierce 4 / boss 5 / mythic 7

rollMaterialDrop(monster)  → 單一材料（組隊預覽用）
rollMaterialDrops(monster) → 陣列（MonsterBattle / DungeonBattleRoom 用）
```

**踩坑提醒**：PartyBattleRoom 有 previewReward 機制（預覽時先 roll），仍使用 rollMaterialDrop 單一值，避免破壞預覽與實際領取的顯示一致性。

---

## 地下城任務類型/商店/事件重設計（2026-06-27 新版）

### 新任務類型（9 種）

```
【標準關 standard】
  六箭正常計算傷害，無特殊規則

【指定得分關 score_gate】
  每箭需 ≥6 分才計傷害，低於 6 分視同脫靶
  → param: 無（固定 6 分）

【命中關 hit_count】
  命中即固定傷害，與分數無關，必定爆擊

【精準關 all_hit】
  六箭全中才能造成傷害，任一箭 M 則全部歸零

【指定分數爆擊關 x_crit】
  param = 6~10 隨機一個分數
  射中該指定分數 → 強制爆擊（傷害 ×2）
  射中其他分數 → 傷害減半

【超越分數關 target_score】
  param = 20~50 隨機門檻
  6 箭總分（X 算 11 分）超過門檻才有傷害
  未達標 → 全部歸零

【逆轉關 reversal】
  6 分 → 爆擊
  7 分 → 必中（正常傷害）
  8 / 9 / 10 / X → 脫靶（0 傷害）

【單數關 odd_only】
  只算 7、9、X，其他分數視同脫靶

【雙數關 even_only】
  只算 6、8、10，其他分數視同脫靶
```

**實作位置**：`dungeonData.js` `calcDungeonContractDmg` function

**移除的舊類型**：無（僅改名與改邏輯）

### 商店物品（8 種，移除無用項目）

**已移除**：
- ❌ `contract_reset`（契約重置）— 不需要
- ❌ `rune_repair`（符文修復石）— 不需要

**保留 8 項**：
```
hp_potion      (50金) 回 30% HP
hp_max_boost   (100金) 永久 HP 上限 +30%（僅此局）
atk_boost      (80金)  ATK ×1.2
atk_large      (150金) ATK ×1.5
def_boost      (80金)  DEF ×1.2
def_large      (150金) DEF ×1.5
revival        (100金) 復活符（下次陣亡自動 30% 復活）
revival_front  (120金) 前衛復活藥（倒地前衛 50% HP 轉回前衛）
```

**實作位置**：
- `dungeonData.js` `DUNGEON_SHOP_ITEMS`（資料）
- `dungeonDb.js` `purchaseDungeonItem`（效果處理）
- `src/components/dungeon/DungeonShop.jsx` `SHOP_ITEM_META`（前端顯示）

### 隨機事件（21 種，含精細級距）

**已移除**：
- ❌ `scroll`（古老卷軸）
- ❌ `contract_swap`（契約轉換）
- ❌ `mysterious_altar`（神秘祭壇）

**分級 ATK debuff 範例**：
```
cursed_fog     ATK ×0.8  (輕度弱化)
cursed_spray   ATK ×0.7  (重度弱化，新增)
blessed_wind   ATK ×1.2  (強化，新增)
star_shower    ATK ×1.2  (強化，原有)
team_boost     ATK ×1.5  (單人特強，原有)
```

所有 buff/debuff 效果在換層時由 `nextFloorModifiers` 機制自動清空。

**實作位置**：
- `dungeonData.js` `DUNGEON_EVENTS`（事件資料）
- `dungeonDb.js` `confirmDungeonEvent`（效果套用）

### 修改檔案清單（給 Claude 用）

需改 3 個檔案 + 1 個前端同步：

1. **`src/lib/dungeonData.js`**
   - 替換 `CONTRACT_TYPES`（9 種新定義）
   - 更新 `assignContracts` / `rerollContract`（參數邏輯）
   - 更新 `getContractBadge`（新增 4 種 badge）
   - 更新 `calcDungeonContractDmg`（reversal/odd_only/even_only/target_score 總分檢查）
   - 替換 `DUNGEON_SHOP_ITEMS`（8 項）
   - 替換 `DUNGEON_EVENTS`（21 項）

2. **`src/lib/dungeonDb.js`**
   - `purchaseDungeonItem`：移除 `contract_reset` 和 `rune_repair` 的 case
   - `confirmDungeonEvent`：移除 `contract_reassign` 的 case

3. **`src/components/dungeon/DungeonShop.jsx`**
   - `SHOP_ITEM_META`：移除 `contract_reset` 和 `rune_repair` 的定義
