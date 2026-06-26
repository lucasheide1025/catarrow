# 🎮 game-systems — 遊戲化規格
> 最後更新：2026-06-25

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
