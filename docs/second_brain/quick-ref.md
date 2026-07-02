# ⚡ quick-ref — Claude 工作速查表
> 讀這份，3 秒掌握上下文，不再重複掃源碼。
> 最後更新：2026-06-29

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
| `calcPotionBuffs` 輸出兩種格式 | 同時有 `hpPct/atkPct`（%數字）和 `hpMult/atkMult`（倍率）；MonsterBattle 讀 Mult；修改時兩者都要維護 |
| 孤立字元 = 運行期 ReferenceError | 源碼多一個字母（如 `n`）在函式外，minified 後報 `n is not defined`；症狀難以追蹤 |
| 大型二進位不進 git | `codebase-ui-extracted/`（含 .exe）超過 GitHub 100MB；務必先加 `.gitignore` 再 `git add` |

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
dungeonRooms      "dungeonRooms"  // 地下城房間（含 memberRunes 欄位）
dungeonFirstClears"dungeonFirstClears"
systemBroadcasts  "systemBroadcasts"
```

### 關鍵 members 欄位
```
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
