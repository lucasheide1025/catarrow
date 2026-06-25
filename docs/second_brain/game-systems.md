# 🎮 game-systems — 遊戲化規格
> 最後更新：2026-06-25

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
