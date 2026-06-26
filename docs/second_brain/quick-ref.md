# ⚡ quick-ref — Claude 工作速查表
> 讀這份，3 秒掌握上下文，不再重複掃源碼。
> 最後更新：2026-06-25

🔗 **在 Obsidian 中開啟**：`obsidian://open?vault=Obsidian%20Vault&file=catarrow%2Fquick-ref`

---

## 🔑 最重要規則（踩過的坑）

| 規則 | 原因 |
|------|------|
| `profile.id` ≠ `profile.uid` | `id`=Firestore docId，`uid`=Auth UID；混用會找不到文件 |
| 卡片加成顯示必須用 `useState` | `useRef` 不觸發重新渲染，MonsterBattle 選擇畫面曾因此不顯示加成 |
| 下課後不觸發里程碑 | `MemberPractice` 有 `classEndedRef`，下課後跳過里程碑計算 |
| `upgradeEquipSlot` 傳 clientData | 接受 `{equip, coins, matItems}`，不需 getDoc（效能優化） |
| `submitMonthlyCardRequest` 傳 clientCard | 接受 `clientCard, hasPending`，不需 getDocs |
| 音效全用 Web Audio 合成 | 不用音檔，用 `sfxTap/sfxSuccess/sfxCast/sfxBuff...` |
| 怪物/徽章全用 SVG | `MonsterSVG` / `BadgeSVG` 元件，不用圖片 |
| 新頁面補教練路由 | AdminApp 的 `memberNav` 陣列要加新頁面 |
| Firestore 規則手動貼 | CLI 有 403，到 Firebase Console 貼規則 |
| 快照比 .then() 早到 | 失敗重試鎖用 `useState` 而非 `useRef` |

---

## 📦 Firestore Collections

```js
// src/lib/db.js 頂部 const C（主要）
members / competitions / results / messages / learnLogs
practiceLogs / achievements / certRecords / badgeLogs
auditLogs / externalComps / registrations / billingRecords

// 獨立常數
checkins          C_CHECKIN       // 今日報到（docId = memberId_YYYY-MM-DD）
guildProgress     C_GUILD
guildQuests       C_GUILD_Q
guildQuestSubs    C_GUILD_SUBS
questConfig       C_QUEST_CONFIG
monsterSessions   C_MONSTER
monsterLogs       C_MONSTER_LOG
cardCollections   C_CARD_COLL     // { cards:{[monsterId]:{}}, equipped:[monsterId,...] }
monthlyCards      C_MONTHLY_CARD
monthlyCardLogs   C_MONTHLY_LOG
cardMarket        C_CARD_MARKET
```

### 關鍵 members 欄位
```
archerXP / coins / gachaCoins
village.resources.arrowdew
fatCat: { gold, silver, bronze }
achievement: { black, gold, silver }
dailyQuestCount  // 累積上課次數（下課+1）
```

---

## 🔧 db.js 函式分類速查

### 報到（新流程 2026-06-25）
```js
submitCheckin(memberId, name, nick)      // pending 狀態
approveCheckin(docId, operatorId)        // → active（教練通過）
rejectCheckin(docId, operatorId)         // → rejected（教練不通過）
subscribeMyCheckin(memberId, cb)         // 即時訂閱今日報到
subscribePendingCheckins(cb)             // 後台：所有今日待處理
submitClassEnd(memberId, docId)          // classEnded=true，dailyQuestCount+1
addArrowdew(memberId, amount)            // 增加箭露
checkinId(memberId, date)                // 產生 docId
```

### 練習紀錄
```js
subscribeTodayPracticeLogs(memberId, todayStr, cb)  // ← 用這個（只讀今日）
subscribePracticeLogs(memberId, cb)                 // 全部歷史（大量，慎用）
addPracticeLog(memberId, data, operatorId)
```

### 射手 XP
```js
addArcherXP(memberId, amount)  // 直接 increment，不需讀取
```

### 怪物卡片
```js
subscribeCardCollection(memberId, cb)
// cb 接收：{ cards: {[monsterId]: {...}}, equipped: [monsterId,...] }
// 使用方式：const equipped = coll.equipped.map(id => coll.cards[id]).filter(Boolean)
// 然後：calcEquippedBonus(equipped) → { hp, atk, def }
```

### 裝備
```js
upgradeEquipSlot(memberId, slotId, { equip, coins, matItems })  // 不需 getDoc
equipItem / unequipSlot / spendCoins / shopBuyEquip
```

### 月卡
```js
submitMonthlyCardRequest(memberId, name, hours, clientCard, hasPending)  // 不需 getDoc
approveMonthlyCardRequest / rejectMonthlyCardRequest / checkExpireMonthlyCard
```

### 村莊
```js
collectVillageResources(memberId, village)
upgradeVillageBuilding(memberId, buildingId, village)
initVillageIfNeeded(memberId, currentVillage)
adminAdjustVillageResource(memberId, resourceKey, delta)
```

### 里程碑 / 轉蛋
```js
grantArrowMilestoneRewards(memberId, milestones)
getMilestonesReached(oldArrows, newArrows)  // 從 arrowMilestone.js
drawGachaCards(memberId, type)  // "single" | "ten"
```

---

## 🎮 遊戲常數

### archerLevel.js
```js
MAX_ARCHER_LEVEL=200 / XP_PER_LEVEL=20
archerLevelFromXP(xp) / archerXPProgress(xp) / archerLevelBonus(lv)→{hp,atk,def}
每級加成：hp+5 / atk+1 / def+1

MONSTER_TIER_XP = { common:5,rare:10,elite:20,fierce:30,boss:50,mythic:80 }
PARTY_XP_MULT=1.5 / DUEL_WIN=50 / DUEL_LOSE=20 / DUNGEON_FLOOR=15
WORLD_BOSS_XP_CAP=300 / WORLD_BOSS_XP_MULT=2.0
PARTY_BONUS_CHEST_CHANCE=0.30
```

### monsterCards.js
```js
MAX_EQUIPPED_CARDS=5
calcEquippedBonus(cards[])→{hp,atk,def}
calcCardBonus(tier,stars)
FAMILY_STAT={forest:hp,dragon:atk,undead:def,beast:atk,demon:hp,machine:def}
STAR_UPGRADE_COST=[1,2,3,4,5]
```

### monsterData.js
```js
calcArcherStats({member,certification,certRecords,dexStats})→{hp,atk,def}
// HP基礎200/ATK基礎15/DEF基礎10
// 完整數值 = archerStats + archerLevelBonus + calcEquippedBonus

FAMILIES = { forest,dragon,undead,beast,demon,machine }
TIER_ORDER = ["common","rare","elite","fierce","boss","mythic"]
```

### constants.js
```js
BOW_TYPES / CERT_LEVELS / EQUIP_SLOT_DEFS / EQUIP_GRADES
calcBadgePoints(member,type) / certLevelStyle(level,variant)
fmtDate/fmtDT/today/thisYear/formatArcherNo/calcEquipBonus
```

### catLevel.js（新 2026-06-25）
```js
CAT_MAX_LEVEL=200 / CAT_XP_PER_LEVEL=20
catLevelFromXP(xp) / catXPProgress(xp) / catLevelBonus(lv)→{hp,atk,def}
CAT_TIER_XP = { common:5,rare:10,elite:20,fierce:30,boss:50,mythic:80 }
// XP 在 MonsterBattle endBattle("win") 時呼叫 saveXP(CAT_TIER_XP[tier])
```

### catData.js 新增（2026-06-25）
```js
CAT_SKILL_GROUPS = { daming/gege/meimei:"heal", niuniu/haji/baobao:"atk", youyou/xiaoan/diandian:"def" }
CAT_EQUIP_SLOTS  = 5格 [bow(atk/ore), arrow(atk/meat), armor(def/ore), herbBag(def/driedfish), potion(hp/potion)]
CAT_EQUIP_GRADE_NAMES = ["普通","稀有","精英","頭目","傳說","神話"]  // 注意非「史詩」
CAT_EQUIP_MAX_PLUS = 9
calcCatEquipBonus(equip)→{ atkBonus, defBonus, hpBonus }
calcForgeCost(slotId, grade, plusLevel)→{ [resourceKey]:amount } | null（已極限）
calcCatSkillChance(catLevel, bondLv) → 0–0.25
calcCatSkillEffect(skillGroup, catLevel, bondLv) → { healed } | { extraMult } | { reduction, blockFull }
```

### catDb.js 新增（2026-06-25）
```js
addCatXP(memberId, catId, amount)        // 戰鬥後加貓咪 XP，同步 equippedCat.catXP
upgradeCatEquip(memberId, catId, slotId, newGrade, newPlusLevel, deductMap)  // 鍛造，扣村莊資源
// equipCat 已更新：同步 catXP + equip 到 equippedCat 快取
```

### useCatCompanion.js — 三類型特化數值（更新 2026-06-26）
```js
// CAT_TYPE_BASE（export from useCatCompanion.js）
// attack:  { hp:140, atk:16, def:7  }  高傷低耐
// defense: { hp:300, atk:7,  def:16 }  高血高防
// allround:{ hp:200, atk:10, def:10 }  均衡
// CAT_COMBAT_BASE = CAT_TYPE_BASE.allround（向後相容）
//
// 羈絆技能里程碑（bondTierMult）：
//   bondLv ≥5  → 主屬性 ×1.2（技能 I）
//   bondLv ≥10 → 主屬性 ×1.4（技能 II）
//   攻擊型主屬性=ATK，防禦型=HP+DEF，全能型=全部
//
// 回傳：catLevel,catXP,skillGroup,triggerCatSkill,saveXP,hasCat,catATK,catHP,catDEF
// triggerCatSkill() → {triggered:false}|{triggered:true,skillGroup,healed/extraMult/reduction/blockFull}
```

---

## 🖼️ 圖片路徑

```
public/ui/
  page-bg.webp / login-bg.webp / dungeon-bg.webp
  profile-banner.webp / party-bar.webp / card-bg.webp
  cell-{monster|party|duel|dungeon|shop|checkin|...}.webp
  cert-{beginner|novice|intermediate|advanced|elite}.webp
  badge-frame-{black|gold|silver|bronze}.webp
  equip-slot.webp / equip-slot-filled.webp
  battle-bg/bg_{family}_{1-6}.webp   ← family: forest/dragon/undead/beast/demon/machine
  village/                            ← 貓村圖片
```

---

## 📂 元件路徑速查

```
src/pages/         MemberApp.jsx / AdminApp.jsx
src/components/member/
  MemberHome.jsx        首頁 widget（射手等級+資源）
  MemberPractice.jsx    自主練習（classEndedRef 里程碑保護）
  DailyQuest.jsx        報到狀態+下課按鈕（已無任務系統）
  MonsterBattle.jsx     打怪（cardColl: useState+useRef 雙軌）
  RPGEquipPanel.jsx     裝備升級（傳 clientData 給 upgradeEquipSlot）
src/components/admin/
  AdminDailyQuest.jsx   後台報到審核+記帳
src/lib/
  db.js / constants.js / archerLevel.js
  monsterData.js / monsterCards.js / arrowMilestone.js
  sound.js / theme.js
```
