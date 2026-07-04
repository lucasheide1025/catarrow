# ⚡ quick-ref — Claude 工作速查表
> 讀這份，3 秒掌握上下文，不再重複掃源碼。
> 最後更新：2026-07-03

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
| Firestore 規則手動貼 | CLI 有 403，到 Firebase Console 貼規則；規則必須在 `match /databases/{database}/documents { }` **內部**，放外面一律無效 |
| **`totalArrowsAllTime` 要在 hasOnly 列表** | `addRoundArrows` 用 `increment("totalArrowsAllTime")` 但規則沒放行 → Firestore 靜默擋掉，終身箭數永遠不增加；**所有會員自己更新的新欄位都要加進 hasOnly** |
| 快照比 .then() 早到 | 失敗重試鎖用 `useState` 而非 `useRef` |
| MonsterBattle roundScores 非最終回合 | `setRoundScores` 只在 BATTLE_WIN/LOSE 事件（最終回合）呼叫；非最終回合要在 `!battleEnded` 路徑手動 push，否則 `endBattle` 看到 `roundScores=[]` |
| `calcPotionBuffs` 輸出兩種格式 | 同時有 `hpPct/atkPct`（%數字）和 `hpMult/atkMult`（倍率）；MonsterBattle 讀 Mult；修改時兩者都要維護 |
| 孤立字元 = 運行期 ReferenceError | 源碼多一個字母（如 `n`）在函式外，minified 後報 `n is not defined`；症狀難以追蹤 |
| 大型二進位不進 git | `codebase-ui-extracted/`（含 .exe）超過 GitHub 100MB；務必先加 `.gitignore` 再 `git add` |
| Tailwind 是 CDN 版 | 偽類（focus/placeholder）樣式寫 index.css 純 CSS 類（`.ui-card`/`.ui-input`），不能靠任意 Tailwind class |
| HubTile `accent` 只吃 hex | 內部 `${accent}26` 疊透明層，傳 `var(--xxx)` 產生非法 CSS |
| 主題已收斂單一 navy | `theme.js` 只剩 1 組；要加主題就往 `APP_THEMES` 加元素，MemberProfile 選擇器自動出現（`length > 1` 守門） |

---

## 🎓 學生分級與系統鎖定（2026-07-04）

```js
// src/lib/accessControl.js（純函式，無 UI 依賴）
DEFAULT_TIER_PERMISSIONS = { restricted:[...], autoLocked:[...], retired:[...] }
PAGE_REGISTRY            // 分組頁面清單，供權限設定頁打勾矩陣用
isAutoLocked(member)                              // official 且 lastCheckinDate 存在且 >14 天
getAllowedPages(member, role, tierPermissions)    // null=全開；[]=凍結全鎖；否則允許頁面 id 陣列
isPageAllowed(member, role, pageId, tierPermissions)

// db.js 新函式
setStudentTier(memberId, tier, operatorId)
setAccountFrozen(memberId, frozen, operatorId)
bulkSetStudentTier(memberIds[], tier, operatorId)   // batch write，上線初期教練批次工具用
setMaintenanceMode(enabled, message, operatorId)    // systemConfig/maintenance
subscribeMaintenanceConfig(cb)
setTierPermissions(permissions, operatorId)         // systemConfig/tierPermissions（整份覆寫）
subscribeTierPermissions(cb)                        // cb(null) 時前端 fallback 用 DEFAULT_TIER_PERMISSIONS

// members 新欄位（缺欄位時的預設行為）
studentTier     // 缺欄位 → 視為 "restricted"
accountFrozen   // 缺欄位 → 視為 false
lastCheckinDate // "YYYY-MM-DD"，submitCheckin 當下 + approveCheckin 補寫；缺欄位 → isAutoLocked 直接 false（不誤鎖）

// MemberApp.jsx 掛載點（role==="admin" 天然豁免，因為 MemberApp 只服務 member）
// 優先權：maintenanceConfig.enabled → 全螢幕 MaintenanceScreen
//        → profile.accountFrozen   → 全螢幕 FrozenScreen
//        → pageLocked（目前 page 不在 getAllowedPages 清單內）→ LockedFeatureCard（不強制跳轉）
// retired 狀態：page state 初次載入時若為 "home" 自動轉 "profile"（一次性 ref 守門，不重複跳轉）

// 教練後台
// AdminMembers.jsx：每列 TierModal（studentTier 下拉 + accountFrozen 勾選）
//   + 批次勾選 checkbox → bulkSetStudentTier(...,"official") + 維護鎖開關卡片
// AdminTierPermissions.jsx（新頁，hub-member →「權限設定」）：PAGE_REGISTRY 打勾矩陣，儲存整份覆寫 tierPermissions
```

⚠️ 踩坑提醒：
- `systemConfig` 是全新 collection，與既有 `sysConfig`（版本號用）**不同名、不共用**，design.md 明確指定新名稱
- `lastCheckinDate` 缺欄位時 `isAutoLocked` 必須直接回傳 false，否則所有舊會員一上線就被誤判「很久沒報到」而鎖死
- `getAllowedPages` 對 `!member`（profile 尚未載入）回傳 `null`（全開），避免登入瞬間畫面被誤鎖一下

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
guildBountyTemplates "guildBountyTemplates"  // 一般懸賞任務範本池（2026-07-04）
guildBountyRewards   "guildBountyRewards"    // 一般懸賞難度獎勵表，單一文件 config（2026-07-04）
questConfig       C_QUEST_CONFIG
monsterSessions   C_MONSTER
monsterLogs       C_MONSTER_LOG
cardCollections   C_CARD_COLL     // { cards:{[monsterId]:{}}, equipped:[monsterId,...] }
monthlyCards      C_MONTHLY_CARD
monthlyCardLogs   C_MONTHLY_LOG
cardMarket        C_CARD_MARKET   // ★ 規則移到正確 block（2026-07-02 修）
villageGoals      "villageGoals"  // 村目標（由 villageGoalDb.js 管理，2026-07-02 補規則）
dungeonRooms      "dungeonRooms"  // 地下城房間（含 memberRunes 欄位）
dungeonFirstClears"dungeonFirstClears"
systemBroadcasts  "systemBroadcasts"
```

### 關鍵 members 欄位
```
totalArrowsAllTime  // 終身箭數（由 addRoundArrows increment，需在 firestore.rules hasOnly 中）
archerXP / coins / gachaCoins  // gachaCoins 顯示用 Math.floor
village.resources.arrowdew
fatCat: { gold, silver, bronze }
achievement: { black, gold, silver }
dailyQuestCount  // 累積上課次數（下課+1）
runeInventory: { [runeId]: qty }  // 符文背包（2026-06-27）
expeditions: {                    // 遠征隊（2026-06-27）3 槽 map
  "0": { catId, catName, missionTier, hours, startedAt, endsAt, status, archerCost },
  "1": { ... },
  "2": { ... },
}
// 舊欄位 expedition（單一物件）仍可能存在，UI 向後兼容顯示為 slot 0
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

### 遠征隊（2026-06-27 改版）
```js
// 3 槽位同時：Firestore members/{id}.expeditions.{0|1|2}
// 舊欄位 members/{id}.expedition 向後兼容（UI 自動顯示為 slot 0）
startExpedition(memberId, slotIdx, catId, catName, missionTier, hours, archerCost)
collectExpedition(memberId, slotIdx, rewards)  // rewards 由客戶端 calcExpeditionRewards 計算

// expeditionData.js
calcCatFullStats(catData)         // catData: {catXP,type,bond,equip} → {catATK,catHP,catDEF,catLevel}
catPowerMult(catATK)              // Lv1全能ATK10→1.0x；Lv200→3.0x；類型/裝備/羈絆影響ATK
calcExpeditionRewards(missionTier, catData)  // 接收完整 catData，用 catPowerMult 計算倍率

// 卡片市集
listCardForSale(...)   // expiredAt = 上架+7天（新欄位）
buyCardListing(...)    // 成交後自動 createNotification 給賣家（targetMemberId=sellerId）
subscribeCardMarket(cb) // 客戶端過濾已過期掛賣
```

### 公會一般懸賞（每日刷新，2026-07-04 新增）
```js
// db.js（新增，沿用既有 publishGuildQuest/submitGuildQuestCompletion 發佈+結算路徑）
DEFAULT_BOUNTY_REWARDS  // 4 難度預設獎勵 {xp,coins,arrowDew,gachaCoins,chestType}，guildBountyRewards/config 不存在時 fallback
getGuildBountyTemplates() / subscribeGuildBountyTemplates(cb)
createGuildBountyTemplate(data, adminId) / updateGuildBountyTemplate(id, data, adminId)
toggleGuildBountyTemplateActive(id, active, adminId) / deleteGuildBountyTemplate(id)
getGuildBountyRewards() / subscribeGuildBountyRewards(cb) / setGuildBountyRewards(rewardsObj, adminId)
autoPublishDailyGeneralBounties()
// client-triggered（比照 autoPublishBountyQuests），AdventurerGuild.jsx 掛載時呼叫，內部用 guildMeta/dailyGeneralBounty 的 dateKey 防重複
// 流程：下架昨天 bountySource==="daily_general" 的 active 任務 → 讀 active 範本池 + 獎勵表
//      → 用日期當 seed（adventurerSystem.js::makeSeedRand，已改 export）每難度固定抽 1 個範本（允許重複）
//      → publishGuildQuest 發佈，帶 bountyDifficulty/bountySource:"daily_general"/bountyDateKey

// ⚠️ 關鍵踩坑：guildQuests 文件的 questSubtype 寫的是 "kill_monster"（不是 design.md 字面的 "general"！）
// 原因：AdventurerGuild.jsx 的擊殺進度判定/接任/狩獵按鈕流程完全以 questSubtype==="kill_monster" 為準
// （見 canAcceptQuest 之後的 sub===判斷式），若寫 "general" 會導致前端跳過擊殺驗證、直接可提交
// 用 bountySource==="daily_general" + bountyDifficulty 這兩個額外欄位區分於雙週懸賞，不靠 questSubtype 區分

// submitGuildQuestCompletion 擴充：quest.bountyDifficulty 存在時，async 讀 getGuildBountyRewards()
// 取得對應 chestType，額外 addChests(memberId, [{...,family:"guild",tier:bountyDifficulty}])

// 教練後台：AdminGuildQuests.jsx 新增 tab="bounty" → AdminGuildBountyTemplates.jsx
//   範本清單（4 難度分組 CRUD）+ 難度獎勵表編輯 + 「立即重新產生今日任務」按鈕（測試用，內部仍會防重複）
// 會員端：AdventurerGuild.jsx 懸賞告示卡片 + 確認接取頁都加 bountyDifficulty 徽章顯示（BOUNTY_DIFF_LABEL）
```

### 里程碑 / 轉蛋
```js
grantArrowMilestoneRewards(memberId, milestones)
getMilestonesReached(oldArrows, newArrows)  // 從 arrowMilestone.js，每日防重複由 arrowMilestoneDone 保護
drawGachaCards(memberId, type)  // "single" | "ten"

// MonsterBattle 里程碑正確用法（2026-07-02 修）：
// 用 sessionArrowsRef（useRef(0)）跨回合累積；startBattle 時重置為 0
// getMilestonesReached(sessionArrowsRef.current, sessionArrowsRef.current + arrowCount)
// ★ 不可用 getMilestonesReached(0, arrowCount)，否則每場都從 0 算，跨局里程碑全錯

// villageGoalDb.js（村目標）
contributeArrowsToGoal(memberId, count)   // 由 addRoundArrows 自動 hook 呼叫
adminCreateCustomGoal({goalType, targetValue, rewards, ...})  // 後台發布村目標
autoSpawnVillageGoal(villageLevel)        // 前端自動觸發（24h 冷卻）
checkGoalStatus(goal)                     // 前端每分鐘輪詢（完成或過期）
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
// 羈絆連續加成（bondTierMult）：
//   攻/防型：+5%/bondLv；全能型：+2.5%/bondLv（無里程碑制，每級都有效）
//   攻擊型主屬性=ATK；防禦型=HP+DEF；全能型=全部
//
// 回傳：catLevel,catXP,bondLv,skillGroup,triggerCatSkill,saveXP,hasCat,catATK,catHP,catDEF
// triggerCatSkill() → {triggered:false}|{triggered:true,skillGroup,healed/extraMult/reduction/blockFull}
//
// ⚠️ CAT_TYPE_BASE 只在 useCatCompanion.js（hook），不在 lib
//    純函式版本 calcCatFullStats() 在 expeditionData.js（內嵌相同常數）
```

### 地下城收藏品（2026-06-27 新增）
```js
// src/lib/dungeonCollectibles.js
FAMILY_COLLECTIBLES  // {ghost/mountain/insect/workplace/exam/temple: {common/rare/boss: [{id,name,icon,desc}]}}
COLLECTIBLE_MAP      // { [itemId]: {id, name, icon, desc, family, rarity} }
rollFamilyDrop(family, roomType)  // "chest"|"elite"|"monster" → {itemId} | null
rollBossDrop(family)              // 必掉 boss 池隨機一件
getFirstClearTrophy(dungeonId)    // → {itemId:"ghost_normal_trophy"} | null

// src/lib/dungeonDb.js 新增
addCollectible(memberId, itemId, qty=1)
addCollectibles(memberId, drops=[{itemId,qty}])
subscribeCollectibles(memberId, cb)  // cb({[itemId]: qty})

// Firestore: members/{id}.dungeonCollectibles = {[itemId]: qty}
// 掉落率：chest 50%普+20%稀 / elite 35%稀+30%普 / monster 10%普 / boss 必掉1
```

---

## ⚙️ 戰鬥系統快速速查（2026-07-02 更新）

### 檔案一覽

| 檔案 | 職責 |
|------|------|
| `src/lib/damage.js` | 統一傷害公式（箭矢/反擊/貓貓/世界王） |
| `src/lib/score.js` | 統一計分邏輯（label↔value） |
| `src/battle/BattleEvents.js` | 22 種 EventType + builder |
| `src/battle/BattleConfig.js` | 戰鬥參數集中管理 |
| `src/battle/BattleEngine.js` | 單人戰鬥事件產生器（Phase 0=隨機事件，1=箭矢，2=貓貓，3=反擊） |
| `src/battle/BattleAnimation.js` | playXxx + EVENT_DISPATCH（含 playBattleWin） |
| `src/battle/useFirestoreRound.js` | Firestore 回合 hook（支援 onSubmitSuccess 回呼） |
| `src/battle/RoundController.js` | 通用事件播放控制器（RANDOM_EVENT await 等玩家確認） |
| `src/battle/useBattleRound.js` | React hook 封裝 RoundController |
| `src/battle/useMiniRoundReveal.js` | mini-round 動畫 hook（animPhase / initialDelay / entryEndExtra） |
| `src/battle/useDuelReveal.js` | 決鬥逐箭揭露 hook |

### 使用模式速查

**PartyBattleRoom / DungeonBattleRoom**（mini-round 動畫播放）：
```js
import { useMiniRoundReveal } from "../battle/useMiniRoundReveal";

const {
  liveEntry, liveMiniIdx, animHit, animMonsterCharge, animPhase,
  startReveal, stopReveal, ...
} = useMiniRoundReveal();

// animPhase 語意（2026-07-02）：
//   "player"    = initialDelay 預備期，尚未攻擊（顯示「玩家回合」banner）
//   "attacking" = 玩家攻擊 mini 進行中（banner 消失）
//   "cat"       = 貓貓攻擊 mini
//   "counter"   = 怪物反擊 mini（顯示「怪物反擊！」banner）
//   null        = 無動畫

// 擊殺回合偵測（PartyBattleRoom 標準做法）
const isKillingRound = (entry.miniRounds || []).some(m => (m.monsterHPAfter ?? Infinity) <= 0);

startReveal(entry, {
  key: `party-${entry.round}`,
  initialDelay: 2000,                              // 預備期（玩家回合 banner）
  entryEndExtra: isKillingRound ? 3500 : 1500,    // 擊殺後多停 3.5s
  members: room?.members || {},
  onMiniTick: (mini, idx) => { sfxArrowShoot(); },
  onCounterHit: (mini, idx) => { sfxCounter(); },
  onEntryEnd: (entry) => {
    if (isKillingRound) { sfxMonsterDead(); setTimeout(() => sfxSuccess(), 600); }
  },
});

// 有隨機事件時：不立即 startReveal，等玩家點擊彈窗確認（handleDismissEvent 才呼叫）
// 擊殺 overlay：{liveEntry && displayHP <= 0 && <div>💀 擊倒！</div>}
```

**MonsterBattle / CouncilBattle / WorldBossAttack**（單人回合動畫）：
```js
import { createDispatch } from "../battle/BattleAnimation";
import { RoundController } from "../battle/RoundController";

const dispatchRef = useRef(null);
const controllerRef = useRef(null);
if (!dispatchRef.current) dispatchRef.current = createDispatch({ animate, sfx, vis, log });
if (!controllerRef.current) controllerRef.current = new RoundController({ customDelays: { [MY_EVT]: 600 } });

// 構建事件陣列
const events = [...];
// 播放
const { battleResult } = await controllerRef.current.playEvents(events, eventCtx, {
  [EventType.ARROW_HIT]: (p, ctx) => { /* 更新 state */ },
  [EventType.ARROW_CRIT]: ...
});
```

**DuelRoom**（逐箭揭露 A→B 隊 12 步）：
```js
import { useDuelReveal } from "../battle/useDuelReveal";

const duelReveal = useDuelReveal({
  room,
  onSoundEffect: (hasCrit, hasHit) => {
    if (hasCrit) sfxCritBoom();
    else if (hasHit) sfxArrowHit();
  },
  onComplete: () => { /* sfxMonsterDead if anyone dead */ },
});
const { revealEntry, revealIdx, displayHp, floats, flashIds,
        attackingIds, hittingIds, eventPhase, isRevealing,
        skipEvent, stopReveal } = duelReveal;

// hook 內部自動監聽 room?.log?.length，不需 useEffect 手動處理
// 事件暫停畫面：{eventPhase && revealEntry?.event && <EventOverlay onSkip={skipEvent} />}
// 貓貓回合：<CatRoundOverlay open={duelReveal.showCatRound} cats={duelReveal.duelCatCats} />
// 重置：resetLocalState() { stopReveal(); /* 清除 component state */ }
// 揭露完成檢查：{revealIdx >= 12 ? <結果按鈕/> : <結算中/>}
```

**PartyBattleRoom / DuelRoom / DungeonBattleRoom**（Firestore 多人房間）：
```js
import { useFirestoreRound } from "../battle/useFirestoreRound";

const { room, submitted, submitting, handleSubmit, setFsSubmitted } = useFirestoreRound({
  roomId, myId, isHost,
  subscribe: (id, cb) => subscribeFirestoreRoom(id, cb),
  submit: (id, memberId, ...args) => submitToFirestore(id, ...args),
  processRound: async (id, room) => { await processMyRound(id, room); },
  getMembers: (r) => Object.values(r.members || {}),
  isProcessing: (r) => r.processing,
  processDelayMs: 1000,  // 地下城市需要 1s delay
  maxRetries: 4,
});
```

### 踩坑提醒

- **CouncilBattle/WorldBossAttack 自訂 EventType**（`CB_EVT` / `WB_EVT`）：這些不在 `EVENT_DISPATCH` 中，dispatch 會跳過 animate step（只跑 handler）
- **`submit` config 參數順序**：DuelRoom 的 submit 是 `(roomId, team, memberId, arrows, target)`，其他模式是 `(roomId, memberId, arrows, choice)`
- **`customDelays`**：只影響 getDelayMs 的查表，不影響 EVENT_DISPATCH 的行為
- **`useFirestoreRound` 的 `setFsSubmitted(false)`**：重設 submitted 讓玩家可以重新輸入箭分（用於 undo、new round restart、非房主卡住 recovery）
- **RoundController `onRandomEventEnd` 必須回傳 Promise**：2026-07-02 起加了 `await`，若回傳 undefined（非 Promise）await 會立即 resolve，等同沒暫停
- **組隊隨機事件彈窗**：有事件時不呼叫 `startReveal`，存 `pendingRevealRef.current = entry`；`handleDismissEvent` 點擊後才啟動。彈窗 div 原本有 `pointerEvents:"none"` — 必須刪掉才能接收點擊
- **`animPhase = "player"` 只在 initialDelay 期**：mini 開始時立即變 `"attacking"`；banner 判斷只用 `animPhase === "player"`，不檢查 liveMiniIdx
- **擊殺 overlay 與 pending_confirm 衝突**：`liveEntry !== null` 時不會跳出結算畫面（pending_confirm 判斷需 `!liveEntry`），3.5s entryEndExtra 期間兩者安全共存
- **`useDuelReveal` 只服務 DuelRoom**：無跨模式複用價值，抽取是為了隔離程式碼（−165 行 inline logic）
- **DuelRoom 的 `skipEvent`**：取代舊的 `startReveal()` 手動設定 eventPhase+revealIdx
- **`TargetFaceOverlay`（`src/components/shared/TargetFaceOverlay.jsx`）共用元件（2026-07-04 鎖定計分模式修正）**：目前 5 個呼叫端 Party/Dungeon/MonsterBattle/WorldBoss/Duel，「回合中不能切換按鈕↔靶面計分」的鎖定邏輯**是各呼叫端自己維護**，元件本身不強制。改任何一處鎖定條件時務必 `grep "TargetFaceOverlay"` 檢查全部 5 處是否同步。`onClose` prop 全部呼叫端已移除（該 prop 只用來「關閉覆蓋層」，舊寫法誤把它跟 `setTargetMode(false)` 綁在一起，變成中途切換模式的漏洞）；Party/Dungeon/MonsterBattle 用 `scoringModeChosen` state（整場只選一次，不逐回合重置）鎖定，WorldBoss/Duel 沒有這個 state，改用「本回合箭數是否為 0」（`arrows.length===0`）當鎖定條件。

---

## 🖼️ 圖片路徑

```
public/ui/
  page-bg.webp / login-bg.webp / dungeon-bg.webp
  profile-banner.webp / party-bar.webp / card-bg.webp
  cell-{monster|party|duel|dungeon|shop|checkin|...}.webp  ← ★ 2026-07-03 起已無程式引用（hub/首頁改 CSS 漸層），檔案保留
  cert-{beginner|novice|intermediate|advanced|elite}.webp
  badge-frame-{black|gold|silver|bronze}.webp
  equip-slot.webp / equip-slot-filled.webp
  battle-bg/bg_{family}_{1-6}.webp   ← family: forest/dragon/undead/beast/demon/machine
  village/                            ← 貓村圖片
```

---

## 🔊 音效/動畫開關（2026-07-03 批次 A+B）

```
src/lib/fxSettings.js
  getSoundEnabled/setSoundEnabled、getAnimEnabled/setAnimEnabled
  initFxSettings()  ← index.js render 前呼叫；動畫關 → <html class="no-anim">
  localStorage: fx_sound / fx_anim（"0"=關，預設開）
sound.js 總閘門在 ctx()（合成音效）；playAudio(mp3)/vibrate 另有 guard
  新 UI 音效：sfxSwitch(tab切換)/sfxOpen/sfxClose/sfxError
index.css 動畫庫：.fx-pop/.fx-fade-up/.fx-shake/.fx-pulse/.fx-float-up/.fx-bounce
  .no-anim 抑制所有 animation/transition + View Transitions
Widgets.jsx：CountUp（數字滾動）；StatBar 滿值自動 fx-pulse
UI.jsx Btn：全站點擊音 sfxTap；<Btn silent> 可關（自帶音效按鈕用）
設定 UI：MemberProfile 的 FxSettings 卡
⚠️ scrollIntoView 一律加 block:"nearest"，否則整頁亂捲（已修3處戰鬥log）
⚠️ 比較型音效（n>prev）ref 初始用 null，首次快照不播（AdminApp 月卡已修）
```

---

## 🎨 設計系統（2026-07-03 UI 改版）

```
tokens：index.css :root
  既有：--bg-deep/surface/card/elevated、--text-primary/secondary/muted/accent/gold、--border-subtle/card、--nav-active/indicator
  新增：--success/warn/danger/info-{fg,bg}、--accent/--accent-soft/--primary、--r-{sm,md,lg,xl}、--shadow-{card,elevated}、--glass-{bg,border}
元件層 CSS 類（index.css）：.ui-card（玻璃卡）/ .ui-input / .ui-input-error
共用元件：
  shared/UI.jsx      15 元件全深色 token 化；Btn 有 outline variant；dark-* 為 alias
  shared/Widgets.jsx SectionHeader / StatBar / ProgressRing / Skeleton / HubTile（accent 傳 hex！）
覆寫層：.content-area .bg-white{...} 暫留保護未遷移頁（比賽/練習/排行/訊息）；元件 token 化後不再命中
MemberHome 新 props：todayCheckin / worldBoss（MemberApp+AdminApp 下傳，掛既有訂閱）
hub 頁新 props：badges = {}（badgeKey→count）
BillingSystem / CatVillage 不用 shared/UI（自帶樣式），改元件不影響
```

---

## 🚧 地下城三大來源系統速查（2026-07-14 實作）

### 資料結構

```js
// members/{memberId}.dungeonExcavation
{
  progress: 0,                  // 0~100（練箭挖掘進度）
  dailyArrowsUsed: 0,           // 今日練箭量（用於 T1~T6 機率計算）
  lastActiveDate: "2026-07-14",
  pendingReveal: null,          // 100%時鎖定 { family, difficulty, isHidden, fromAutoDig?, source }
  revealedAt: null,             // ISO string
  completed: false,
  autoDigNextAt: null,          // ⏳ 定時生成：下次可領取的 timestamp
  savedDungeons: [],            // 儲存槽：最多 3 個 [{ id, family, difficultyTier, isHidden, savedAt, fromWorldBoss? }]
  dungeonScrollCount: 0,        // 📜 世界王卷軸持有數
}
```

### ① ⏳ 定時生成（新系統）

```js
// 自動計時器（隨機 24~144 小時）
initAutoDigTimer(memberId)           // 初始化 timer（寫入 autoDigNextAt = Date.now() + random(24~144h ms)）
resetAutoDigTimer(memberId)          // 重設計時器（下一輪隨機）
claimAutoDig(memberId)               // 時間到領取 → 隨機 6 族 + T1~T6 均等 → pendingReveal
checkAutoDigStatus(ex)               // 純函式 → { ready: boolean, remainingMs: number }

// 連動重設
abandonExcavation(memberId)          // 放棄後自動 resetAutoDigTimer（若來源是 fromAutoDig）
saveExcavation(memberId)             // 保存後自動 resetAutoDigTimer
```

### ② ⛏️ 練箭挖掘（公式修正）

```js
// 進度累積（2026-07-14 修正公式）
initDailyExcavation(memberId)        // 登入時初始化（換日 +10 舊進度）
addExcavationByCheckin(memberId)     // 報到 +20（原 +10，db.js submitCheckin/approveCheckin 中呼叫）
addExcavationByArrows(memberId, n)   // 每箭 +1（原 +0.3，db.js addRoundArrows 中呼叫）

// T1~T6 機率系統（取代舊稀有度骰子）
getTierProbabilities(dailyArrows)    // 純函式 → [{ tier, label, icon, pct, color }]
// maxTier = min(6, 1 + floor(dailyArrows / 30))
// 每日箭數  |  最高等級  |  各級機率
// ----------|-----------|-------------
//      0    |    T1     |  T1=100%
//     30    |    T2     |  T1=50%,  T2=50%
//     60    |    T3     |  T1=33%,  T2=33%,  T3=33%
//     90    |    T4     |  T1~T4 各 25%
//    120    |    T5     |  T1~T5 各 20%
//    150+   |    T6     |  T1~T6 各 ~16.7%

// 難度調整（揭曉 overlay）
downgradeExcavationDifficulty(memberId, targetTier)  // 免費無限降級（min T1）
revealExcavation(memberId, difficultyTier, isHidden)  // 揭曉 → 用機率表抽難度
upgradeExcavationDifficulty(memberId)                 // 金幣強化（反向升級，隨機 500~2000）
```

### ③ 📜 世界王卷軸（新系統）

```js
// 世界王擊殺獎勵
grantDungeonScroll(memberId)         // +1 卷軸（dungeonScrollCount）
grantWorldBossDungeon(memberId)      // 別名（向後相容）

// 使用卷軸
useDungeonScroll(memberId)           // 檢查 scrollCount>0 + savedDungeons.length<3
// → 成功：隨機 6 族 + T1~T6 均等 → 直接存入 savedDungeons（跳過 pendingReveal）
// → 失敗：{ ok:false, reason: "儲存槽已滿"|"沒有卷軸" }

// 查詢
getDungeonScrollCount(memberId)      // 讀取 scrollCount
```

### UI 元件

```js
// DungeonExcavationTab.jsx — 三卡並排
// 卡 1：⏳ 定時生成 - countdown timer + claim button
// 卡 2：⛏️ 練箭挖掘 - progress bar + T1~T6 table + reveal overlay
// 卡 3：📜 世界王卷軸 - scroll count + use button
//
// DungeonStorageTab.jsx — 固定 3 槽（Array.from({length:3})）
// 空格：🕳️ 空槽 placeholder
// 已滿：族系色卡 + 難度徽章 + 🌍 世界王掉落 badge（橘色）
//
// DungeonSelectionPanel.jsx — 選地城 → 單人 / 組隊
//
// AdminDungeon.jsx — 後台測試（6 項：搜尋/種族/難度/隱藏/存入/檢視刪除）
```

### 組隊遠征 → DungeonBattleRoom（2026-07-14 路由修正）

```js
// expeditionTeamDb.js
startTeamExpeditionRoom(roomId, hostId) // waiting → active；開始後禁止加入
createTeamExpeditionBattleRoom({ members, hostId, monster, difficultyTier, floorIndex })
syncTeamExpeditionMembers(roomId, battleMembers) // 樓層間保存 HP/alive
claimTeamExpeditionResult(roomId, memberId)       // 全員領取後才清房
updateTeamExpeditionRoom(roomId, data)             // 協調欄位更新

// TeamExpeditionBattle.jsx（新元件）
// HOST：generate 3 floors → create battle room for each floor → manage transitions
// ALL：subscribe team room → render DungeonBattleRoom via TeamBattleRoom wrapper
// Result：房主只抽一次 rewards，寫入 expeditionResult 後全員共用
//
// DungeonBattleRoom.jsx 新增 expeditionMode prop
// expeditionMode=true 時 handleClaimSelf 跳過獎勵，僅呼叫 returnToMapAfterBattle（host）
//
// 關鍵：
// - 戰鬥房 hostId 必須顯式使用 teamRoom.hostId，不能取 Object.entries(members)[0]
// - 只有 host 清理每層 battle room
// - 儲存槽在開戰時消耗；遠征結束不得清除目前新一輪 excavation progress
```

### 單人遠征 5×5 迷霧格子（2026-07-03 Phase G，G1~G3）

```js
// expeditionGrid.js（新檔，純函式）
generateGridFloor(floorIndex, difficultyTier)
//   → { size:5, grid[y][x]=roomId|null, rooms[], startPos, stairsPos }
//   房物件 { id, type, label, pos:{x,y}, cleared }
//   type: entrance|battle|elite_battle|shop|event|trap|chest|rest|stairs
generateBranchFloor()
//   → { entrance, branches:{A|B|C:{rooms[4]（3功能+rest）}}, boss, treasure }
isAdjacent(a, b) / getAdjacentPositions(pos) / GRID_SIZE=5

// DungeonExpedition.jsx 流程
// 第1、2層 GridMapStage（迷霧：只顯示已探索+相鄰格）→ 樓梯下樓
// 第3層 BranchStage：A/B/C 選定即鎖 → 3房 → 休息 → boss → DungeonTreasureRoom
// playerState（hp/buffs）跨房跨樓層；戰鬥房出場用 ?? 同步回快照

// 功能房「本地單人模式」共用 props（DungeonShop/Trap/Event/Chest/Rest）：
// localMode + onLocalEffect(effect) + onLocalDone()（Shop 另有 onLocalBuy(item)）
// localMode=true → confirm 走內部 state、不寫 Firestore 房間文件；多人行為不變
// onLocalEffect payload：hp_loss / buff_mult / heal_pct / cure / coins / event
// DungeonTreasureRoom 新增選填 onLoot(loot)：生成時回傳一次供實發

// 坑：
// - 金幣直接讀 profile.coins（useAuth onSnapshot 即時），勿自己累 delta
// - grantExpeditionRewards 曾漏 import increment → 獎勵靜默失敗（已修）
// - Step G4 團隊接格子未做，TeamExpeditionBattle/expeditionTeamDb 未動
```

### 地下城探索/戰鬥 UI 修整（2026-07-03）

```js
// DungeonExpedition.jsx
// - 進入遠征後顯示逐房探索地圖過場
// - 進入下一房前先看見方格房間與目前位置
// - 遠征結果仍由 DungeonExpeditionResult 統一發放

// DungeonBattleRoom.jsx + BattleBottomBar.jsx
// - 先按「開始計分」再展開計分 / 藥水 / 隊友
// - 地下城戰鬥預設直接顯示分數按鈕
// - 移除戰前額外模式選擇，減少誤觸與遮擋

// 遠征 / 斷線重連
// - `DungeonExpedition.jsx` 改成玩家手動點房間，不再系統自動推進
// - `expeditionMemberData.js` 是遠征進場素質的共用來源
// - `expeditionDb.js` 建戰鬥房改用 `??`，避免 `0` 被誤覆蓋成預設值
// - `MemberApp.jsx` / `AdminApp.jsx` 的地下城離開改成暫離保留房號；只有房間失效時才清除

// runtime 失敗記錄
// - 早期版本的 ExpeditionMapStage 曾因元件匯入問題觸發 undefined render error
// - 最終改成內嵌 SVG 地圖，避免對外部 DungeonMap 元件依賴
```

### 選單系統（地下城儲存槽）

```js
// members/{memberId}.dungeonExcavation.savedDungeons = [
//   { id, family, difficulty, isHidden, revealedAt, fromAutoDig?, fromWorldBoss? }
// ]
// 最多 3 個，已滿時挖掘暫停（storageFull）
// 固定 3 槽視覺顯示（DungeonStorageTab），空格 🕳️ 空槽 1/2/3

// dungeonExcavation.js
saveExcavation(memberId)                // pendingReveal → savedDungeons (push, max 3)
removeSavedDungeon(memberId, id)        // filter out by id
getSavedDungeons(memberId)              // 讀 savedDungeons 陣列
grantWorldBossDungeon(memberId)         // grantDungeonScroll 的向後相容別名
adminSetSavedDungeon(memberId, entry)    // 後台直接寫入（支援取代特定 index）

// DungeonSelectionPanel 流程：
// 選地城 → 單人：確認 overlay → 出發（fromStorage:true）
//        → 組隊：createTeamExpeditionRoom → 6 碼邀請碼
// 加入地下城：輸入邀請碼 或 從開放房間列表點擊加入
// 世界王掉落標示：卡片上顯示 🌍 世界王掉落（橘色 badge）
```

### 三層結構

```
第1層 — 探索層：2-3 弱化怪（六族隨機）+ 大量事件/陷阱/商人
第2層 — 戰鬥層：3-4 普通/強悍怪（六族隨機）+ 陷阱/寶箱
第3層 — 王關層：強悍精英 → 休息 → 商人 → Boss → 🎁 寶箱族獎勵房
```

### 6 級難度

| 級別 | Tier | 命名 |
|-----|------|------|
| 1 | common | 普通級 |
| 2 | rare | 稀有級 |
| 3 | elite | 精英級 |
| 4 | fierce | 強悍級 |
| 5 | boss | 頭目級 |
| 6 | mythic | 神話級 |

### 寶箱族（第 7 族）
- FAMILIES.treasure = { label:"寶箱族", icon:"🎁", color:"#fbbf24" }
- 6 階寶箱怪（common→mythic）HP:100 ATK:5 DEF:50
- 掉落：金幣×3、寶箱率100%、材料全稀有

### 失敗處理
- 全滅/房主關閉 → 全區廣播「XXX 挑戰地下城失敗」
- 儲存槽模式只消耗已選槽位，不清除正在累積的新一輪挖掘進度
- 已獲獎勵不回收

### 選單系統（地下城儲存槽）
```js
// members/{memberId}.dungeonExcavation.savedDungeons = [
//   { id, family, difficulty, isHidden, revealedAt, fromAutoDig?, fromWorldBoss? }
// ]
// 最多 3 個，已滿時挖掘暫停（storageFull）
// 固定 3 槽視覺顯示（DungeonStorageTab），空格 🕳️ 空槽 1/2/3

// dungeonExcavation.js
saveExcavation(memberId)                // pendingReveal → savedDungeons (push, max 3)
removeSavedDungeon(memberId, id)        // filter out by id
getSavedDungeons(memberId)              // 讀 savedDungeons 陣列
grantWorldBossDungeon(memberId)         // grantDungeonScroll 的向後相容別名
adminSetSavedDungeon(memberId, entry)    // 後台直接寫入（支援取代特定 index）

// DungeonSelectionPanel 流程：
// 選地城 → 單人：確認 overlay → 出發（fromStorage:true）
//        → 組隊：createTeamExpeditionRoom → 6 碼邀請碼
// 加入地下城：輸入邀請碼 或 從開放房間列表點擊加入
// 世界王掉落標示：卡片上顯示 🌍 世界王掉落（橘色 badge）
```

### 後台測試工具（AdminDungeon.jsx）
```js
// 功能（2026-07-14 簡化版）：
// 1. 🔍 玩家搜尋（文字過濾 members list）
// 2. 🎲 種族選擇（6 族網格按鈕，選中高亮族系色）
// 3. 📊 難度選擇（1~6 級，按鈕式）
// 4. 🌟 隱藏開關
// 5. 📦 存入玩家儲存槽（寫入 dungeonExcavation.savedDungeons）
// 6. 📋 當前儲存槽檢視 + ✕ 刪除
//
// 已移除：地下城次數重置（resetDungeonUsed/resetAllDungeonUsed）
// 原因：地下城已無每日次數限制，改為挖掘進度制
```

### 組隊遠征（expeditionTeamDb.js）
```js
// 集合：dungeonRooms（與舊 dungeon rooms 共用集合）
// 欄位：{ hostId, hostName, dungeonFamily, dungeonDifficulty,
//         dungeonIsHidden, members:{...}, status:"expedition_waiting", code }

createTeamExpeditionRoom({ hostId, hostName, dungeon, memberData })
  // → { ok:true, roomId, code }
joinTeamExpeditionRoom(code, memberId, memberName, memberData)
  // transaction 檢查 max 8（2026-07-04 前誤寫 4，已修正）與 waiting；→ { ok:true, roomId, dungeon, hostId }
subscribeTeamExpeditionRoom(roomId, cb)
leaveTeamExpeditionRoom(roomId, memberId) // deleteField，不能寫 null
startTeamExpeditionRoom(roomId, hostId)   // 原子鎖定 active
setTeamExpeditionMemberRole(roomId, memberId, role) // 2026-07-04 新增：等待室選前衛/後衛，各上限4，transaction 防超額
disbandTeamExpeditionRoom(roomId)     // status="completed"
cleanupTeamExpeditionRoom(roomId)     // deleteDoc
subscribeOpenTeamExpeditionRooms(cb)  // 開放房間列表（供加入面板）
```

**2026-07-04 崩潰修正**：`expeditionGrid.js::generateGridFloor()` 回傳的 `gridFloor.grid` 是 2D 陣列（Firestore 不支援巢狀陣列）。`TeamExpeditionBattle.jsx` 每次把 `expeditionMapState` 寫入 Firestore 前，一律先呼叫本地 helper `stripMapStateGrid()`（內部呼叫 `expeditionGrid.js::stripGridForSync(gridFloor)` 剔除 `grid` 欄位）。`grid` 只是本地渲染輔助，`GridMapStage` 只用 `rooms` 重建查找表，讀取端不需還原。單人模式 `expeditionGrid.js` 本身格式不動（仍含 `grid`，因為單人模式從不寫入 Firestore）。

### 遠征獎勵結算（expeditionDb.js Phase E）
```js
EXPEDITION_REWARD_TABLE  // 6 級難度 × { coins, arrowDew, archerXP }

calculateExpeditionRewards({ difficultyTier, floorsCleared, won })
  // → { coins, arrowDew, archerXP }
  // won=true: 全額 floorsCleared=3；won=false: × floorMult

saveExpeditionRecord(memberId, record)
  // record: { won, family, difficultyTier, floorsCleared, rewards, completedAt }
  // members.{id}.expeditionRecords 陣列，最多保留 20 筆
  // firestore.rules members.update 白名單必須包含 expeditionRecords

grantExpeditionRewards(memberId, rewards)
  // Firestore increment: coins, arrowDew, archerXP
```

---

## 🎮 地下城系統速查（2026-06-27 重設計）

### 合約類型（CONTRACT_TYPES in dungeonData.js）（2026-06-28 修改）
```js
// 9 種合約
standard       // 基本傷害；按鈕：X 10 9 8 7 6 M（折疊兩頁）
score_gate     // 低於 param 分（上限9）每差1分 -10% 傷害（比例懲罰）
               // 按鈕：9 8 7 6 5 4 3 2 1 M（無 X/10，太難）
               // param cap: Math.min(6 + tier, 9)
hit_count      // 命中即固定傷害（M=0傷）；按鈕：命中 / M
all_hit        // ← 改「M懲罰關」：每發 M 扣 10% 總傷害（可疊加至0）
               // 按鈕：完整分數（X 10 9...M），不再是命中/M
x_crit         // 只有X算爆擊，其他傷害減半；按鈕：完整分數
target_score   // 6箭總分 < param 則全輪清零
reversal       // 分數倒轉（6↔X，7↔10，8↔9）後正常計算
odd_only       // 只算 7/9/X，其餘視同脫靶
even_only      // 只算 6/8/10，其餘視同脫靶
```

### 合約 UI 顏色（CONTRACT_HEX in DungeonBattleRoom.jsx）
```js
{ standard:"#cbd5e1", score_gate:"#93c5fd", hit_count:"#86efac",
  all_hit:"#fde047", x_crit:"#d8b4fe", target_score:"#fbbf24",
  reversal:"#fb923c", odd_only:"#67e8f9", even_only:"#f9a8d4" }
```

### 商店商品（DUNGEON_SHOP_ITEMS in dungeonData.js）
```js
hp_potion / hp_max_boost / atk_boost / def_boost
atk_large / def_large / revival / revival_front
// hp_potion 可重複購買；其他每次進商店各限一件
```

### 事件效果類型（effect.type → confirmDungeonEvent 處理）
```js
hp_restore_all  // 所有人 +value*maxHP
atk_debuff_all  // 所有人 atkMult *= value（>1 為 buff）
atk_buff_one    // 隨機一人 atkMult *= value
dmg_mult_all    // 所有人 dmgMult *= value
def_mult_all    // 所有人 defMult *= value  ← 2026-06-27 補實裝
gold_bonus      // 每人 +value 金幣（即時）
gold_mult       // nextFloor goldMult = value
monster_hp_mult // nextFloor monsterHpMult = value
monster_atk_mult// nextFloor monsterAtkMult = value
skip_counter    // 怪物不反擊（processDungeonRound 讀 currentEvent）
```

### 商店購買記憶（shopPurchases）（2026-06-28 修正）
```js
// Firestore: dungeonRooms/{id}.shopPurchases = { [memberId]: [itemId,...] }
// hp_potion 不記錄，允許重複購買
// enterNonCombatRoom / resolveNonCombatRoom 不再重置 shopPurchases
// ⚠️ 不要用 local `bought` state 判斷已購，只用 myPurchases（Firestore 側）
//    local state 在 component 重掛時會清除，導致重複購買

// revival_front 購買條件（2026-06-28）：
const hasFallenFront = Object.values(members).some(m => m.alive && m.role === "rear");
// !hasFallenFront → 按鈕 disabled，顯示「⚠️ 無前衛倒地」
```

### 復活邏輯（revival_front）— 踩過的坑（2026-06-28）
```js
// ❌ 錯誤：檢查購買者本身的 role（購買者幾乎都是前衛，邏輯永遠不觸發）
if (choice === "revive_front") {
  const m = members[id]; // id = 購買者
  if (m && m.role === "rear") { /* 永遠不執行 */ }
}

// ✅ 正確：掃描隊伍中所有 alive && role==="rear" 的成員
const fallenFronters = Object.entries(members)
  .filter(([, m]) => m.alive && m.role === "rear");
if (fallenFronters.length > 0) {
  const [targetId, targetM] = fallenFronters[0];
  upd[`members.${targetId}.role`] = "front";
  upd[`members.${targetId}.hp`] = Math.round((targetM.maxHP || 100) * 0.5);
}
```

### 前後衛顯示系統（displayGroup）
```js
// DEFAULT_MEMBER 有兩個角色欄位：
// role         = "front"|"rear"  → 戰鬥邏輯（反擊免疫、heal/dmg 選擇）
// displayGroup = "front"|"rear"  → 視覺分排（只在有空位時才隨死亡移動）

// 規則：前衛死亡時
// 若當前後衛 displayGroup=="rear" 人數 < 4 → displayGroup 改 "rear"（真正移位）
// 若 >= 4 → displayGroup 保持 "front"（紫框 + 🛡後衛標籤，不移動）

// 客戶端 DungeonBattleRoom.jsx：
const dgOf = (m) =>
  (liveEntry?.displayGroupsBefore?.[m.id]) ?? (m.displayGroup ?? m.role ?? "front");
// 動畫中（liveEntry != null）讀 displayGroupsBefore（回合開始前快照）
// 動畫結束後 liveEntry = null，自動切到最新 displayGroup

// logEntry 結構（dungeonDb.js processDungeonRound）：
// displayGroupsBefore: { [memberId]: "front"|"rear" }  ← Step 5b 前快照

// 視角分排（每人只看自己那排）：
// myRowMembers    = 我的 displayGroup 那排（完整卡片）
// otherRowMembers = 對方排（動畫時顯示緊湊小卡，平時隱藏）
```

### 地下城多人廣播設計（2026-06-28 修正）
```js
// 問題1：非房主點「領取獎勵」→ returnToMapAfterBattle 把所有人拖出戰鬥
// ✅ 解法：只有 isHost 才呼叫 returnToMapAfterBattle；非房主設 localClaimed=true 顯示 overlay
if (isHost) {
  await returnToMapAfterBattle(...);
} else {
  setLocalClaimed(true); // 等 Firestore status 自然切換
}

// 問題2：房主走到怪物房→modal 是 local state，隊員看不到任何東西
// ✅ 解法：房主寫 mapPendingRoom 到 Firestore；隊員 subscribe 顯示唯讀 modal
// dungeonDb: proposeMapBattle(roomId, roomData) → updateDoc({ mapPendingRoom: roomData })
// dungeonDb: clearMapPendingRoom(roomId)        → updateDoc({ mapPendingRoom: deleteField() })
// 觸發時機：
//   handleRoomClick → proposeMapBattle（房主選怪物房時）
//   handleEnterBattle → clearMapPendingRoom（進戰前清除）
//   撤退按鈕 → clearMapPendingRoom（退出清除）
// 非房主：讀 room.mapPendingRoom 顯示「⏳ 等待隊長決定是否出戰…」
```

### 卡死預防機制
```js
// 房主：processing 超時 20 秒 → clearDungeonProcessing(roomId)
// 非房主：processing 超時 20 秒 → setSubmitted(false) + Firestore 清 ready/arrows
// 全員 ready → 延遲 2 秒（allReadyTimerRef）再呼叫 handleProcess
//   ↑ 防止最後一人送出後，房主在快照傳播前就觸發結算
```

---

## 📂 元件路徑速查

```
src/pages/         MemberApp.jsx / AdminApp.jsx
src/components/member/
  MemberHome.jsx        首頁（等級卡+公會等級+收藏格+月卡+廣播分類）
  MemberPractice.jsx    自主練習（classEndedRef 里程碑保護）
  DailyQuest.jsx        報到狀態+下課按鈕（subscribeTodayPracticeLogs）
  MonsterBattle.jsx     打怪（cardColl: useState+useRef 雙軌）
  CardCollection.jsx    怪物卡片（條列式，inline 升星提示）
  MemberDex.jsx         成就圖鑑（個人通知，不再全頻廣播）
  RPGEquipPanel.jsx     裝備升級（傳 clientData 給 upgradeEquipSlot）
src/components/admin/
  AdminDailyQuest.jsx   後台報到審核+記帳
src/components/dungeon/
  DungeonBattleRoom.jsx 戰鬥（前後衛顯示 + buff 指示器）
  DungeonShop.jsx       商店（購買記憶 + hp_potion 重購）
  DungeonRest.jsx       ← 新元件（2026-06-27）
  DungeonTrap.jsx       ← 新元件（2026-06-27）
src/lib/
  db.js / constants.js / archerLevel.js
  monsterData.js / monsterCards.js / arrowMilestone.js
  dungeonData.js / dungeonDb.js / dungeonCollectibles.js
  adventurerSystem.js   levelFromXP(adventurerXP) / rankFromLevel(lv) → {name,icon,color}
  sound.js / theme.js
```
