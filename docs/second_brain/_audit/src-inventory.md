# 第二大腦現況母體清單（src-inventory.md）
> 產出日期：2026-07-25
> 產出模型：AGY (Gemini Flash)
> 說明：本檔案為 `src/` 程式碼現況母體盤點，作為 `gap-map.md` 反向稽核筆記之權威依據。

---

## 1. `src/` 實際檔案樹

```text
src/
├── App.jsx
├── index.css
├── index.js
├── battle/
│   ├── BattleAnimation.js
│   ├── BattleConfig.js
│   ├── BattleEngine.js
│   ├── BattleEvents.js
│   ├── RoundController.js
│   ├── useBattleRound.js
│   ├── useDuelReveal.js
│   ├── useFirestoreRound.js
│   └── useMiniRoundReveal.js
├── components/
│   ├── BadgeSVG.jsx
│   ├── MonsterSVG.jsx
│   ├── admin/
│   ├── battle/
│   ├── booking/
│   ├── cat/
│   ├── duel/
│   ├── dungeon/
│   ├── member/
│   ├── party/
│   ├── react-bits/
│   ├── shared/
│   ├── story/
│   └── worldboss/
├── data/
│   └── monsterExpansionCatalog.json
├── features/
│   └── catalog/
│       ├── CatalogPreviewPage.jsx
│       ├── api/
│       ├── components/
│       ├── context/
│       └── data/
├── hooks/
│   ├── useAuth.js
│   ├── useCatAnimationAccess.js
│   ├── useCatCompanion.js
│   ├── useCheckinActive.js
│   └── useCostControl.js
├── lib/ (共 186 個檔案，詳見第 3 節)
├── pages/
│   ├── AdminApp.jsx
│   ├── GuestApp.jsx
│   ├── LoginPage.jsx
│   ├── MemberApp.jsx
│   ├── PublicBookingApp.css
│   └── PublicBookingApp.jsx
└── zombie/
    ├── ZombieGame.jsx
    ├── ZombieTestApp.jsx
    ├── bridge/
    ├── data/
    ├── db/
    ├── domain/
    ├── style/
    ├── target/
    └── ui/
```

---

## 2. `src/lib/db.js` 完整資料結構與 Export 清單

### 2.1 Collection 清單 (`C` 物件，lines 33-53)

| 鍵名 | 集合名稱 (Collection Name) | 程式碼位置 (file:line) | 原文摘錄 |
|------|---------------------------|------------------------|----------|
| `members` | `"members"` | `src/lib/db.js:34` | `members:       "members",` |
| `competitions` | `"competitions"` | `src/lib/db.js:35` | `competitions: "competitions",` |
| `results` | `"results"` | `src/lib/db.js:36` | `results:      "results",` |
| `messages` | `"messages"` | `src/lib/db.js:37` | `messages:     "messages",` |
| `learnLogs` | `"learnLogs"` | `src/lib/db.js:38` | `learnLogs:    "learnLogs",` |
| `practiceLogs` | `"practiceLogs"` | `src/lib/db.js:39` | `practiceLogs: "practiceLogs",` |
| `achievements` | `"achievements"` | `src/lib/db.js:40` | `achievements: "achievements",` |
| `certRecords` | `"certRecords"` | `src/lib/db.js:41` | `certRecords:  "certRecords",` |
| `badgeLogs` | `"badgeLogs"` | `src/lib/db.js:42` | `badgeLogs:    "badgeLogs",` |
| `auditLogs` | `"auditLogs"` | `src/lib/db.js:43` | `auditLogs:    "auditLogs",` |
| `externalComps` | `"externalComps"` | `src/lib/db.js:44` | `externalComps:"externalComps",` |
| `registrations` | `"registrations"` | `src/lib/db.js:45` | `registrations:"registrations",` |
| `billingRecords` | `"billingRecords"` | `src/lib/db.js:46` | `billingRecords:"billingRecords",` |
| `campSessions` | `"campSessions"` | `src/lib/db.js:47` | `campSessions: "campSessions",` |
| `shootingSessions` | `"shootingSessions"` | `src/lib/db.js:48` | `shootingSessions: "shootingSessions",` |
| `gamePerformances` | `"gamePerformances"` | `src/lib/db.js:49` | `gamePerformances: "gamePerformances",` |
| `arrowCountEvents` | `"arrowCountEvents"` | `src/lib/db.js:50` | `arrowCountEvents: "arrowCountEvents",` |
| `memberPerformanceSync` | `"memberPerformanceSync"` | `src/lib/db.js:51` | `memberPerformanceSync: "memberPerformanceSync",` |
| `arrowRoundOperations` | `"arrowRoundOperations"` | `src/lib/db.js:52` | `arrowRoundOperations: "arrowRoundOperations",` |

### 2.2 獨立 Collection 常數 (Independent Constants)

| 常數名稱 | 集合名稱 (Collection Name) | 程式碼位置 (file:line) | 原文摘錄 |
|----------|---------------------------|------------------------|----------|
| `C_GUILD` | `"guildProgress"` | `src/lib/db.js:611` | `const C_GUILD      = "guildProgress";` |
| `C_GUILD_Q` | `"guildQuests"` | `src/lib/db.js:612` | `const C_GUILD_Q    = "guildQuests";` |
| `C_GUILD_SUBS` | `"guildQuestSubs"` | `src/lib/db.js:613` | `const C_GUILD_SUBS = "guildQuestSubs";` |
| `CERT_CERTIFICATIONS` | `"certifications"` | `src/lib/db.js:1328` | `const CERT_CERTIFICATIONS = "certifications";` |
| `CERT_CONFIG` | `"certConfig"` | `src/lib/db.js:1329` | `const CERT_CONFIG = "certConfig";` |
| `C_NOTIF` | `"notifications"` | `src/lib/db.js:1454` | `const C_NOTIF = "notifications";` |
| `C_QUEST_CONFIG` | `"dailyQuestConfig"` | `src/lib/db.js:1645` | `const C_QUEST_CONFIG = "dailyQuestConfig";` |
| `C_CHECKIN` | `"checkins"` | `src/lib/db.js:1646` | `const C_CHECKIN = "checkins";` |
| `C_PROMO_CONFIG` | `"promotionQuestConfig"` | `src/lib/db.js:1916` | `const C_PROMO_CONFIG = "promotionQuestConfig";` |
| `C_BOUNTY_TEMPLATES` | `"guildBountyTemplates"` | `src/lib/db.js:2140` | `const C_BOUNTY_TEMPLATES = "guildBountyTemplates";` |
| `C_BOUNTY_REWARDS` | `"guildBountyRewards"` | `src/lib/db.js:2141` | `const C_BOUNTY_REWARDS   = "guildBountyRewards";` |
| `C_COACH_CHALLENGES` | `"coachChallenges"` | `src/lib/db.js:2466` | `const C_COACH_CHALLENGES = "coachChallenges";` |
| `C_DEX_GRANT` | `"dexGrants"` | `src/lib/db.js:2507` | `const C_DEX_GRANT = "dexGrants";` |
| `C_DEX_CONFIG` | `"dexConfig"` | `src/lib/db.js:2508` | `const C_DEX_CONFIG = "dexConfig";` |
| `C_MONSTER_CONFIG` | `"monsterConfig"` | `src/lib/db.js:2595` | `const C_MONSTER_CONFIG  = "monsterConfig";` |
| `C_MONSTER_SESSION` | `"monsterSessions"` | `src/lib/db.js:2596` | `const C_MONSTER_SESSION = "monsterSessions";` |
| `C_MONSTER_LOGS` | `"monsterLogs"` | `src/lib/db.js:2597` | `const C_MONSTER_LOGS    = "monsterLogs";` |
| `C_MONSTER_DEX` | `"monsterDex"` | `src/lib/db.js:2598` | `const C_MONSTER_DEX     = "monsterDex";` |
| `C_CRAFT_STATS` | `"craftStats"` | `src/lib/db.js:2599` | `const C_CRAFT_STATS     = "craftStats";` |
| `C_MATERIALS` | `"materialInventory"` | `src/lib/db.js:2720` | `const C_MATERIALS = "materialInventory";` |
| `C_CHESTS` | `"chestInventory"` | `src/lib/db.js:2822` | `const C_CHESTS = "chestInventory";` |
| `C_POTIONS` | `"potionInventory"` | `src/lib/db.js:3005` | `const C_POTIONS = "potionInventory";` |
| `C_FRAGS` | `"fragmentInventory"` | `src/lib/db.js:3104` | `const C_FRAGS = "fragmentInventory";` |
| `C_CHEST_STATS` | `"chestStats"` | `src/lib/db.js:3348` | `const C_CHEST_STATS = "chestStats";` |
| `C_POTION_DEX` | `"potionDex"` | `src/lib/db.js:3369` | `const C_POTION_DEX = "potionDex";` |
| `C_CARDS` | `"cardCollections"` | `src/lib/db.js:3543` | `const C_CARDS = "cardCollections";` |
| `C_MONTHLY` | `"monthlyCardRequests"` | `src/lib/db.js:3799` | `const C_MONTHLY        = "monthlyCardRequests";` |
| `C_MONTHLY_CONFIG` | `"monthlyCardConfig"` | `src/lib/db.js:3801` | `const C_MONTHLY_CONFIG = "monthlyCardConfig";` |
| `C_MONTHLY_LOGS` | `"monthlyCardLogs"` | `src/lib/db.js:3803` | `const C_MONTHLY_LOGS   = "monthlyCardLogs";` |
| `C_SYS` | `"sysConfig"` | `src/lib/db.js:4018` | `const C_SYS = "sysConfig";` |
| `C_EQUIP_ITEMS` | `"equipItems"` | `src/lib/db.js:4209` | `const C_EQUIP_ITEMS = "equipItems";` |
| `C_CARD_MARKET` | `"cardMarket"` | `src/lib/db.js:4981` | `const C_CARD_MARKET = "cardMarket";` |
| `C_COUNCIL_SESSION` | `"councilSessions"` | `src/lib/db.js:5200` | `const C_COUNCIL_SESSION = "councilSessions";` |
| `C_SYSTEM_CONFIG` | `"systemConfig"` | `src/lib/db.js:5367` | `const C_SYSTEM_CONFIG = "systemConfig";` |

---

### 2.3 `src/lib/db.js` 所有 Export 函式與常數全量清單

| 類別 / 功能分類 | Export 名稱 | 程式碼位置 (file:line) | **原文摘錄** |
|----------------|------------|------------------------|--------------|
| re-export | `dailyArrowStorageKey, getLocalTodayArrows, subscribeLocalTodayArrows, taipeiDateKey` | `src/lib/db.js:30` | `export { dailyArrowStorageKey, getLocalTodayArrows, subscribeLocalTodayArrows, taipeiDateKey } from "./arrowProgress";` |
| 今日箭數初始化 | `initializeTodayArrows(memberId)` | `src/lib/db.js:56` | `export async function initializeTodayArrows(memberId) {` |
| 射擊場次同步 | `flushPendingShootingSessions(memberId)` | `src/lib/db.js:173` | `export async function flushPendingShootingSessions(memberId) {` |
| 射擊場次寫入 | `finalizeMonsterShootingSession(input)` | `src/lib/db.js:203` | `export async function finalizeMonsterShootingSession(input) {` |
| 射擊場次寫入 | `finalizeGameShootingSession(input)` | `src/lib/db.js:243` | `export async function finalizeGameShootingSession(input) {` |
| 射擊場次寫入 | `finalizePracticeShootingSession(input)` | `src/lib/db.js:247` | `export async function finalizePracticeShootingSession(input) {` |
| 舊資料遷移 | `migrateLegacyPracticeLogs(memberId, maxCount)` | `src/lib/db.js:281` | `export async function migrateLegacyPracticeLogs(memberId, maxCount = 120) {` |
| 舊資料遷移 | `migrateAllLegacyPracticeLogs()` | `src/lib/db.js:362` | `export async function migrateAllLegacyPracticeLogs() {` |
| 舊資料遷移 | `migrateLegacyMonsterLogs(memberId, maxCount)` | `src/lib/db.js:384` | `export async function migrateLegacyMonsterLogs(memberId, maxCount = 120) {` |
| 舊資料遷移 | `migrateAllLegacyMonsterLogs()` | `src/lib/db.js:411` | `export async function migrateAllLegacyMonsterLogs() {` |
| 表現快取 | `getShootingSessionSummaries(memberId, maxCount)` | `src/lib/db.js:435` | `export async function getShootingSessionSummaries(memberId, maxCount = 120) {` |
| 表現快取 | `getLocalPerformanceCacheMeta(memberId)` | `src/lib/db.js:446` | `export function getLocalPerformanceCacheMeta(memberId) {` |
| 表現快取 | `setLocalPerformanceCacheMeta(memberId, meta)` | `src/lib/db.js:449` | `export function setLocalPerformanceCacheMeta(memberId, meta) {` |
| 表現快取 | `getCachedShootingSessionSummaries(memberId)` | `src/lib/db.js:455` | `export async function getCachedShootingSessionSummaries(memberId) {` |
| 表現快取 | `getMemberPerformanceSync(memberId)` | `src/lib/db.js:463` | `export async function getMemberPerformanceSync(memberId) {` |
| 表現快取 | `ensureMemberPerformanceSync(memberId)` | `src/lib/db.js:468` | `export async function ensureMemberPerformanceSync(memberId) {` |
| 表現快取 | `getChangedShootingSessionSummaries(memberId, afterRevision)` | `src/lib/db.js:478` | `export async function getChangedShootingSessionSummaries(memberId, afterRevision) {` |
| 表現快取 | `getChangedGamePerformanceSummaries(memberId, afterRevision)` | `src/lib/db.js:484` | `export async function getChangedGamePerformanceSummaries(memberId, afterRevision) {` |
| 表現快取 | `bootstrapRecentPerformanceCache(memberId, months, onProgress)` | `src/lib/db.js:492` | `export async function bootstrapRecentPerformanceCache(memberId, months = 3, onProgress) {` |
| 表現快取 | `bootstrapRecentPerformanceSummaries(memberId, months)` | `src/lib/db.js:511` | `export async function bootstrapRecentPerformanceSummaries(memberId, months = 3) {` |
| 表現快取 | `getGamePerformanceSummaries(memberId, maxCount)` | `src/lib/db.js:525` | `export async function getGamePerformanceSummaries(memberId, maxCount = 120) {` |
| 表現快取 | `getShootingSessionHistory(memberId, maxCount)` | `src/lib/db.js:537` | `export async function getShootingSessionHistory(memberId, maxCount = 300) {` |
| 表現快取 | `getCachedGamePerformanceSummaries(memberId)` | `src/lib/db.js:547` | `export async function getCachedGamePerformanceSummaries(memberId) {` |
| 表現快取 | `getShootingSessionEnds(sessionId)` | `src/lib/db.js:557` | `export async function getShootingSessionEnds(sessionId) {` |
| 表現快取 | `getCachedShootingSessionEnds(sessionId)` | `src/lib/db.js:565` | `export async function getCachedShootingSessionEnds(sessionId) {` |
| 靶面修正 | `correctTargetPlotArrow({...})` | `src/lib/db.js:576` | `export async function correctTargetPlotArrow({ sessionId, memberId, endId, arrowIndex, label, reason = "lineCutter", correctedBy }) {` |
| 稽核日誌 | `writeAuditLog(action, targetId, targetType, before, after, operatorId)` | `src/lib/db.js:616` | `export async function writeAuditLog(action, targetId, targetType, before, after, operatorId) {` |
| 會員管理 | `getMembers()` | `src/lib/db.js:653` | `export async function getMembers() {` |
| 會員管理 | `subscribeMembers(callback)` | `src/lib/db.js:658` | `export function subscribeMembers(callback) {` |
| 會員管理 | `getMember(id)` | `src/lib/db.js:665` | `export async function getMember(id) {` |
| 會員管理 | `createMember(data, operatorId)` | `src/lib/db.js:670` | `export async function createMember(data, operatorId) {` |
| 會員管理 | `updateMember(id, data, operatorId)` | `src/lib/db.js:693` | `export async function updateMember(id, data, operatorId) {` |
| 會員管理 | `deleteMember(id, operatorId)` | `src/lib/db.js:705` | `export async function deleteMember(id, operatorId) {` |
| 會員管理 | `updateLastLogin(id)` | `src/lib/db.js:711` | `export async function updateLastLogin(id) {` |
| 兒童模式 | `subscribeKidAccounts(callback)` | `src/lib/db.js:719` | `export function subscribeKidAccounts(callback) {` |
| 帳號轉正 | `convertGuestToOfficial(memberId, officialFields, newUid, operatorId)` | `src/lib/db.js:733` | `export async function convertGuestToOfficial(memberId, officialFields, newUid, operatorId) {` |
| 夏令營 | `getCampSessions()` | `src/lib/db.js:762` | `export async function getCampSessions() {` |
| 夏令營 | `subscribeCampSessions(callback)` | `src/lib/db.js:768` | `export function subscribeCampSessions(callback) {` |
| 夏令營 | `createCampSession(data, operatorId)` | `src/lib/db.js:776` | `export async function createCampSession(data, operatorId) {` |
| 夏令營 | `updateCampSession(id, patch)` | `src/lib/db.js:788` | `export async function updateCampSession(id, patch) {` |
| 夏令營 | `deleteCampSession(id)` | `src/lib/db.js:792` | `export async function deleteCampSession(id) {` |
| 徽章 | `addBadge(memberId, badgeType, color, count, operatorId, note)` | `src/lib/db.js:797` | `export async function addBadge(memberId, badgeType, color, count, operatorId, note = "") {` |
| 徽章 | `claimBadge(logId, memberId)` | `src/lib/db.js:810` | `export async function claimBadge(logId, memberId) {` |
| 徽章 | `reportBadgeError(logId, memberId, reason)` | `src/lib/db.js:814` | `export async function reportBadgeError(logId, memberId, reason) {` |
| 練習紀錄 | `subscribePracticeLogs(memberId, callback, maxCount)` | `src/lib/db.js:828` | `export function subscribePracticeLogs(memberId, callback, maxCount = 300) {` |
| 練習紀錄 | `addPracticeLog(memberId, data, operatorId)` | `src/lib/db.js:840` | `export async function addPracticeLog(memberId, data, operatorId) {` |
| 箭數操作 | `getPendingArrowOperationCount(memberId)` | `src/lib/db.js:935` | `export function getPendingArrowOperationCount(memberId) {` |
| 箭數操作 | `flushPendingArrowProgress(memberId)` | `src/lib/db.js:939` | `export async function flushPendingArrowProgress(memberId) {` |
| 箭數操作 | `addRoundArrows(memberId, count, options)` | `src/lib/db.js:977` | `export function addRoundArrows(memberId, count, options) {` |
| 徽章爭議 | `resolveBadgeDispute(logId, operatorId, newCount, note)` | `src/lib/db.js:981` | `export async function resolveBadgeDispute(logId, operatorId, newCount, note) {` |
| 徽章日誌 | `subscribeBadgeLogs(memberId, callback)` | `src/lib/db.js:985` | `export function subscribeBadgeLogs(memberId, callback) {` |
| 賽事 | `getCompetitions()` | `src/lib/db.js:989` | `export async function getCompetitions() {` |
| 賽事 | `subscribeCompetitions(callback)` | `src/lib/db.js:994` | `export function subscribeCompetitions(callback) {` |
| 賽事 | `createCompetition(data, operatorId)` | `src/lib/db.js:998` | `export async function createCompetition(data, operatorId) {` |
| 賽事 | `updateCompetition(id, data, operatorId)` | `src/lib/db.js:1004` | `export async function updateCompetition(id, data, operatorId) {` |
| 成績 | `getResults(compId)` | `src/lib/db.js:1011` | `export async function getResults(compId) {` |
| 成績 | `subscribeResults(compId, callback)` | `src/lib/db.js:1016` | `export function subscribeResults(compId, callback) {` |
| 成績 | `submitResult(compId, memberId, data)` | `src/lib/db.js:1020` | `export async function submitResult(compId, memberId, data) {` |
| 結算 | `settleCompetition(compId, operatorId)` | `src/lib/db.js:1063` | `export async function settleCompetition(compId, operatorId) {` |
| 成績 | `getMemberResults(memberId)` | `src/lib/db.js:1080` | `export async function getMemberResults(memberId) {` |
| 報名 | `register(compId, memberData)` | `src/lib/db.js:1085` | `export async function register(compId, memberData) {` |
| 報名 | `getRegistrations(compId)` | `src/lib/db.js:1100` | `export async function getRegistrations(compId) {` |
| 報名 | `isMemberRegistered(compId, memberId)` | `src/lib/db.js:1105` | `export async function isMemberRegistered(compId, memberId) {` |
| 學習筆記 | `addLearnLog(memberId, data)` | `src/lib/db.js:1110` | `export async function addLearnLog(memberId, data) {` |
| 學習筆記 | `updateLearnLog(id, data, operatorId)` | `src/lib/db.js:1118` | `export async function updateLearnLog(id, data, operatorId) {` |
| 學習筆記 | `markLearnLogsRead(memberId)` | `src/lib/db.js:1127` | `export async function markLearnLogsRead(memberId) {` |
| 學習筆記 | `subscribeLearnLogs(memberId, callback)` | `src/lib/db.js:1131` | `export function subscribeLearnLogs(memberId, callback) {` |
| 檢定紀錄 | `upsertCertRecord(memberId, year, half, bowType, score, operatorId)` | `src/lib/db.js:1135` | `export async function upsertCertRecord(memberId, year, half, bowType, score, operatorId) {` |
| 檢定紀錄 | `getCertRecords(memberId)` | `src/lib/db.js:1140` | `export async function getCertRecords(memberId) {` |
| 檢定紀錄 | `subscribeCertRecords(memberId, callback)` | `src/lib/db.js:1145` | `export function subscribeCertRecords(memberId, callback) {` |
| 成就 | `getAchievements()` | `src/lib/db.js:1153` | `export async function getAchievements() {` |
| 成就 | `createAchievement(data, operatorId)` | `src/lib/db.js:1158` | `export async function createAchievement(data, operatorId) {` |
| 外部比賽 | `addExternalComp(memberId, data)` | `src/lib/db.js:1163` | `export async function addExternalComp(memberId, data) {` |
| 外部比賽 | `reviewExternalComp(id, approved, badgeType, badgeColor, badgeCount, operatorId)` | `src/lib/db.js:1168` | `export async function reviewExternalComp(id, approved, badgeType, badgeColor, badgeCount, operatorId) {` |
| 外部比賽 | `subscribeExternalComps(memberId, callback)` | `src/lib/db.js:1177` | `export function subscribeExternalComps(memberId, callback) {` |
| 訊息 | `sendMessage(memberId, content)` | `src/lib/db.js:1181` | `export async function sendMessage(memberId, content) {` |
| 訊息 | `replyMessage(id, reply, operatorId)` | `src/lib/db.js:1185` | `export async function replyMessage(id, reply, operatorId) {` |
| 訊息 | `markMessagesRead(memberId)` | `src/lib/db.js:1194` | `export async function markMessagesRead(memberId) {` |
| 訊息 | `subscribeMessages(memberId, callback)` | `src/lib/db.js:1200` | `export function subscribeMessages(memberId, callback) {` |
| 訊息 | `subscribeAllMessages(callback)` | `src/lib/db.js:1204` | `export function subscribeAllMessages(callback) {` |
| 稽核 | `getAuditLogs(targetId)` | `src/lib/db.js:1208` | `export async function getAuditLogs(targetId) {` |
| 爭議 | `subscribeAllDisputes(callback)` | `src/lib/db.js:1213` | `export function subscribeAllDisputes(callback) {` |
| 賽事 | `subscribeCompResults(compId, callback)` | `src/lib/db.js:1221` | `export function subscribeCompResults(compId, callback) {` |
| 檢定審核 | `subscribePendingCertResults(callback)` | `src/lib/db.js:1225` | `export function subscribePendingCertResults(callback) {` |
| 檢定審核 | `approveCertResult(resultId, operatorId, finalTotal, certLevel)` | `src/lib/db.js:1229` | `export async function approveCertResult(resultId, operatorId, finalTotal, certLevel) {` |
| 檢定審核 | `rejectCertResult(resultId, operatorId)` | `src/lib/db.js:1287` | `export async function rejectCertResult(resultId, operatorId) {` |
| 賽事 | `getMyCompResult(compId, memberId)` | `src/lib/db.js:1293` | `export async function getMyCompResult(compId, memberId) {` |
| 檢定紀錄 | `getAllCertRecords()` | `src/lib/db.js:1299` | `export async function getAllCertRecords() {` |
| 檢定紀錄 | `deleteCertRecord(memberId, year, half, bowType, operatorId)` | `src/lib/db.js:1305` | `export async function deleteCertRecord(memberId, year, half, bowType, operatorId) {` |
| 射手證考驗 | `CERT_PASS_DEFAULT` | `src/lib/db.js:1331` | `export const CERT_PASS_DEFAULT = {` |
| 射手證考驗 | `certBowGroup(bowType)` | `src/lib/db.js:1346` | `export function certBowGroup(bowType) {` |
| 射手證考驗 | `getCertConfig()` | `src/lib/db.js:1352` | `export async function getCertConfig() {` |
| 射手證考驗 | `saveCertConfig(config, operatorId)` | `src/lib/db.js:1360` | `export async function saveCertConfig(config, operatorId) {` |
| 射手證考驗 | `getCertification(memberId)` | `src/lib/db.js:1364` | `export async function getCertification(memberId) {` |
| 射手證考驗 | `subscribeCertification(memberId, callback)` | `src/lib/db.js:1372` | `export function subscribeCertification(memberId, callback) {` |
| 射手證考驗 | `submitCertTask(memberId, tier, task, payload, bowType, equipLabels)` | `src/lib/db.js:1380` | `export async function submitCertTask(memberId, tier, task, payload, bowType, equipLabels) {` |
| 射手證考驗 | `reviewCertTask(memberId, tier, task, approve, operatorId)` | `src/lib/db.js:1411` | `export async function reviewCertTask(memberId, tier, task, approve, operatorId) {` |
| 通知 | `createNotification(data, operatorId)` | `src/lib/db.js:1458` | `export async function createNotification(data, operatorId) {` |
| 通知 | `subscribeNotifications(memberId, callback, memberCreatedAt)` | `src/lib/db.js:1478` | `export function subscribeNotifications(memberId, callback, memberCreatedAt) {` |
| 通知 | `markNotificationRead(notifId, memberId)` | `src/lib/db.js:1514` | `export async function markNotificationRead(notifId, memberId) {` |
| 通知 | `deleteNotificationForMe(notifId, memberId)` | `src/lib/db.js:1521` | `export async function deleteNotificationForMe(notifId, memberId) {` |
| 通知 | `addCongrats(notifId, fromName, anon, text)` | `src/lib/db.js:1527` | `export async function addCongrats(notifId, fromName, anon, text) {` |
| 通知 | `maybeSendCertHonor({...})` | `src/lib/db.js:1542` | `export async function maybeSendCertHonor({ memberId, bowType, bowLabel, year, half, score, prevLevel, newLevel, operatorId }) {` |
| 通知 | `sendCertExamHonor({ memberId, tier, operatorId })` | `src/lib/db.js:1584` | `export async function sendCertExamHonor({ memberId, tier, operatorId }) {` |
| 射手證審核 | `subscribePendingCertTasks(callback)` | `src/lib/db.js:1602` | `export function subscribePendingCertTasks(callback) {` |
| 射手證後台 | `adminUpdateCertification(memberId, data, operatorId)` | `src/lib/db.js:1625` | `export async function adminUpdateCertification(memberId, data, operatorId) {` |
| 射手證後台 | `deleteCertification(memberId, operatorId)` | `src/lib/db.js:1634` | `export async function deleteCertification(memberId, operatorId) {` |
| 每日任務 | `DAILY_QUEST_DEFAULT` | `src/lib/db.js:1649` | `export const DAILY_QUEST_DEFAULT = {` |
| 每日任務 | `getDailyQuestConfig()` | `src/lib/db.js:1661` | `export async function getDailyQuestConfig() {` |
| 每日任務 | `saveDailyQuestConfig(config, operatorId)` | `src/lib/db.js:1669` | `export async function saveDailyQuestConfig(config, operatorId) {` |
| 報到 | `checkinId(memberId, date)` | `src/lib/db.js:1681` | `export function checkinId(memberId, date) {` |
| 報到 | `submitSimpleCheckin(memberId, memberName, memberNickname)` | `src/lib/db.js:1686` | `export async function submitSimpleCheckin(memberId, memberName, memberNickname) {` |
| 報到 | `submitCheckin(memberId, memberName, memberNickname)` | `src/lib/db.js:1701` | `export async function submitCheckin(memberId, memberName, memberNickname) {` |
| 報到 | `approveCheckin(checkinDocId, operatorId)` | `src/lib/db.js:1730` | `export async function approveCheckin(checkinDocId, operatorId) {` |
| 報到 | `rejectCheckin(checkinDocId, operatorId)` | `src/lib/db.js:1748` | `export async function rejectCheckin(checkinDocId, operatorId) {` |
| 報到 | `subscribeMyCheckin(memberId, callback)` | `src/lib/db.js:1757` | `export function subscribeMyCheckin(memberId, callback) {` |
| 報到 | `getTodayCheckinMembers()` | `src/lib/db.js:1766` | `export async function getTodayCheckinMembers() {` |
| 報到 | `subscribePendingCheckins(callback)` | `src/lib/db.js:1774` | `export function subscribePendingCheckins(callback) {` |
| Buff | `castBuff(checkinId, operatorId)` | `src/lib/db.js:1788` | `export async function castBuff(checkinId, operatorId) {` |
| Buff | `rerollCheckinBuff(checkinId, newBuff, newFailCount)` | `src/lib/db.js:1800` | `export async function rerollCheckinBuff(checkinId, newBuff, newFailCount) {` |
| 每日任務 | `markQuestDone(checkinId, questResult, memberId, chestType)` | `src/lib/db.js:1808` | `export async function markQuestDone(checkinId, questResult, memberId = null, chestType = null) {` |
| 下課 | `submitClassEnd(memberId, checkinDocId)` | `src/lib/db.js:1830` | `export async function submitClassEnd(memberId, checkinDocId) {` |
| 報到獎勵 | `confirmCheckinReward(checkinId, memberId, operatorId, chestType)` | `src/lib/db.js:1856` | `export async function confirmCheckinReward(checkinId, memberId, operatorId, chestType = "iron") {` |
| 每日任務 | `getDailyQuestCount(memberId)` | `src/lib/db.js:1861` | `export async function getDailyQuestCount(memberId) {` |
| 報到 | `forceEndTodayCheckins()` | `src/lib/db.js:1869` | `export async function forceEndTodayCheckins() {` |
| 報到 | `resetCheckinCount(memberId)` | `src/lib/db.js:1891` | `export async function resetCheckinCount(memberId) {` |
| 報到 | `resetAllCheckinCounts(memberIds)` | `src/lib/db.js:1896` | `export async function resetAllCheckinCounts(memberIds) {` |
| 晉階任務 | `PROMO_QUEST_DEFAULTS` | `src/lib/db.js:1918` | `export const PROMO_QUEST_DEFAULTS = {` |
| 晉階任務 | `getPromotionQuestConfig()` | `src/lib/db.js:1925` | `export async function getPromotionQuestConfig() {` |
| 晉階任務 | `subscribePromotionQuestConfig(cb)` | `src/lib/db.js:1932` | `export function subscribePromotionQuestConfig(cb) {` |
| 晉階任務 | `savePromotionQuestConfig(data, adminId)` | `src/lib/db.js:1938` | `export async function savePromotionQuestConfig(data, adminId) {` |
| 冒險者 XP | `addAdventurerXP(memberId, xp)` | `src/lib/db.js:1943` | `export async function addAdventurerXP(memberId, xp) {` |
| 公會 | `subscribeAdventurerProgress(memberId, cb)` | `src/lib/db.js:1987` | `export function subscribeAdventurerProgress(memberId, cb) {` |
| 公會任務 | `completeGuildTask(memberId, taskId, xp, coins, bonus, arrowDew)` | `src/lib/db.js:1999` | `export async function completeGuildTask(memberId, taskId, xp, coins, bonus = null, arrowDew = 0) {` |
| 晉階任務 | `completePromotionQuest(memberId, promotionLevel, bonusXP)` | `src/lib/db.js:2019` | `export async function completePromotionQuest(memberId, promotionLevel, bonusXP) {` |
| 公會懸賞 | `subscribeActiveGuildQuests(cb)` | `src/lib/db.js:2030` | `export function subscribeActiveGuildQuests(cb) {` |
| 公會懸賞 | `subscribeAllGuildQuests(cb)` | `src/lib/db.js:2045` | `export function subscribeAllGuildQuests(cb) {` |
| 公會懸賞 | `publishGuildQuest(data, adminId)` | `src/lib/db.js:2051` | `export async function publishGuildQuest(data, adminId) {` |
| 公會懸賞 | `updateGuildQuestStatus(questId, status)` | `src/lib/db.js:2090` | `export async function updateGuildQuestStatus(questId, status) {` |
| 公會懸賞 | `updateGuildQuest(questId, data, adminId)` | `src/lib/db.js:2095` | `export async function updateGuildQuest(questId, data, adminId) {` |
| 公會懸賞 | `deleteGuildQuest(questId)` | `src/lib/db.js:2112` | `export async function deleteGuildQuest(questId) {` |
| 公會懸賞 | `autoPublishBountyQuests(monsters)` | `src/lib/db.js:2117` | `export async function autoPublishBountyQuests(monsters) {` |
| 一般懸賞 | `DEFAULT_BOUNTY_REWARDS` | `src/lib/db.js:2145` | `export const DEFAULT_BOUNTY_REWARDS = {` |
| 一般懸賞 | `getGuildBountyTemplates()` | `src/lib/db.js:2153` | `export async function getGuildBountyTemplates() {` |
| 一般懸賞 | `subscribeGuildBountyTemplates(cb)` | `src/lib/db.js:2158` | `export function subscribeGuildBountyTemplates(cb) {` |
| 一般懸賞 | `createGuildBountyTemplate(data, adminId)` | `src/lib/db.js:2165` | `export async function createGuildBountyTemplate(data, adminId) {` |
| 一般懸賞 | `updateGuildBountyTemplate(id, data, adminId)` | `src/lib/db.js:2182` | `export async function updateGuildBountyTemplate(id, data, adminId) {` |
| 一般懸賞 | `toggleGuildBountyTemplateActive(id, active, adminId)` | `src/lib/db.js:2199` | `export async function toggleGuildBountyTemplateActive(id, active, adminId) {` |
| 一般懸賞 | `deleteGuildBountyTemplate(id)` | `src/lib/db.js:2205` | `export async function deleteGuildBountyTemplate(id) {` |
| 一般懸賞 | `getGuildBountyRewards()` | `src/lib/db.js:2210` | `export async function getGuildBountyRewards() {` |
| 一般懸賞 | `subscribeGuildBountyRewards(cb)` | `src/lib/db.js:2218` | `export function subscribeGuildBountyRewards(cb) {` |
| 一般懸賞 | `setGuildBountyRewards(rewardsObj, adminId)` | `src/lib/db.js:2225` | `export async function setGuildBountyRewards(rewardsObj, adminId) {` |
| 一般懸賞 | `autoPublishDailyGeneralBounties()` | `src/lib/db.js:2235` | `export async function autoPublishDailyGeneralBounties() {` |
| 公會任務 | `acceptGuildQuest(memberId, questId, baselineKills)` | `src/lib/db.js:2303` | `export async function acceptGuildQuest(memberId, questId, baselineKills = null) {` |
| 公會任務 | `submitGuildQuestCompletion(memberId, memberName, quest, note, rankMult)` | `src/lib/db.js:2313` | `export async function submitGuildQuestCompletion(memberId, memberName, quest, note, rankMult = 1) {` |
| 公會任務 | `subscribeGuildSubmissions(cb)` | `src/lib/db.js:2370` | `export function subscribeGuildSubmissions(cb) {` |
| 公會任務 | `approveGuildSubmission(subId, sub, adminId)` | `src/lib/db.js:2381` | `export async function approveGuildSubmission(subId, sub, adminId) {` |
| 公會任務 | `rejectGuildSubmission(subId, sub, reason, adminId)` | `src/lib/db.js:2408` | `export async function rejectGuildSubmission(subId, sub, reason, adminId) {` |
| 公會任務 | `provisionalUnlockQuest(memberId, questId, questTitle, badgeReward)` | `src/lib/db.js:2429` | `export async function provisionalUnlockQuest(memberId, questId, questTitle, badgeReward) {` |
| 公會任務 | `resubmitGuildBadge(memberId, memberName, questId, questTitle, badgeReward)` | `src/lib/db.js:2442` | `export async function resubmitGuildBadge(memberId, memberName, questId, questTitle, badgeReward) {` |
| 公會任務 | `retryGuildQuest(memberId, questId)` | `src/lib/db.js:2456` | `export async function retryGuildQuest(memberId, questId) {` |
| 教練挑戰 | `submitCoachChallenge(memberId, memberName, quest)` | `src/lib/db.js:2469` | `export async function submitCoachChallenge(memberId, memberName, quest) {` |
| 教練挑戰 | `subscribeCoachChallenges(cb)` | `src/lib/db.js:2487` | `export function subscribeCoachChallenges(cb) {` |
| 教練挑戰 | `resolveCoachChallenge(challengeId, won, adminId, challenge)` | `src/lib/db.js:2496` | `export async function resolveCoachChallenge(challengeId, won, adminId, challenge) {` |
| 圖鑑成就 | `getDexConfig()` | `src/lib/db.js:2512` | `export async function getDexConfig() {` |
| 圖鑑成就 | `saveDexConfig(config, operatorId)` | `src/lib/db.js:2520` | `export async function saveDexConfig(config, operatorId) {` |
| 圖鑑成就 | `getDexGrants(memberId)` | `src/lib/db.js:2527` | `export async function getDexGrants(memberId) {` |
| 圖鑑成就 | `subscribeDexGrants(memberId, callback)` | `src/lib/db.js:2535` | `export function subscribeDexGrants(memberId, callback) {` |
| 圖鑑成就 | `grantRoundAchievement(memberId, type, round, rank, operatorId)` | `src/lib/db.js:2543` | `export async function grantRoundAchievement(memberId, type, round, rank, operatorId) {` |
| 圖鑑成就 | `revokeRoundAchievement(memberId, type, round, operatorId)` | `src/lib/db.js:2552` | `export async function revokeRoundAchievement(memberId, type, round, operatorId) {` |
| 圖鑑成就 | `grantSpecialAchievement(memberId, specialId, operatorId)` | `src/lib/db.js:2559` | `export async function grantSpecialAchievement(memberId, specialId, operatorId) {` |
| 圖鑑成就 | `revokeSpecialAchievement(memberId, specialId, operatorId)` | `src/lib/db.js:2566` | `export async function revokeSpecialAchievement(memberId, specialId, operatorId) {` |
| 報到 | `deleteCheckin(checkinId)` | `src/lib/db.js:2574` | `export async function deleteCheckin(checkinId) {` |
| 報到 | `adminDismissCheckin(checkinId)` | `src/lib/db.js:2578` | `export async function adminDismissCheckin(checkinId) {` |
| 報到 | `cancelCheckin(checkinId)` | `src/lib/db.js:2582` | `export async function cancelCheckin(checkinId) {` |
| 打怪模式 | `subscribeMonsterEventConfig(callback)` | `src/lib/db.js:2600` | `export function subscribeMonsterEventConfig(callback) {` |
| 打怪模式 | `setMonsterEventConfig(cfg, operatorId)` | `src/lib/db.js:2605` | `export async function setMonsterEventConfig(cfg, operatorId) {` |
| 打怪模式 | `getMonsterEventConfig()` | `src/lib/db.js:2615` | `export async function getMonsterEventConfig() {` |
| 打怪模式 | `saveMonsterEventConfig(config, operatorId)` | `src/lib/db.js:2623` | `export async function saveMonsterEventConfig(config, operatorId) {` |
| 打怪模式 | `getMonsterDailyConfig()` | `src/lib/db.js:2629` | `export async function getMonsterDailyConfig() {` |
| 打怪模式 | `saveMonsterDailyConfig(config, operatorId)` | `src/lib/db.js:2637` | `export async function saveMonsterDailyConfig(config, operatorId) {` |
| 打怪模式 | `checkMonsterDailyLimit(memberId, dailyMax)` | `src/lib/db.js:2643` | `export async function checkMonsterDailyLimit(memberId, dailyMax) {` |
| 打怪模式 | `recordMonsterSession(memberId)` | `src/lib/db.js:2658` | `export async function recordMonsterSession(memberId) {` |
| 打怪模式 | `getMonsterLogs(memberId, maxCount)` | `src/lib/db.js:2669` | `export async function getMonsterLogs(memberId, maxCount = 20) {` |
| 打怪模式 | `resetMonsterSession(memberId)` | `src/lib/db.js:2685` | `export async function resetMonsterSession(memberId) {` |
| 組隊打怪 | `checkPartyBattleLimit(memberId)` | `src/lib/db.js:2693` | `export async function checkPartyBattleLimit(memberId) {` |
| 組隊打怪 | `recordPartyBattleSession(memberId)` | `src/lib/db.js:2701` | `export async function recordPartyBattleSession(memberId) {` |
| 材料 | `addMaterials(memberId, mats)` | `src/lib/db.js:2723` | `export async function addMaterials(memberId, mats) {` |
| 材料 | `subscribeMaterials(memberId, callback)` | `src/lib/db.js:2736` | `export function subscribeMaterials(memberId, callback) {` |
| 打怪日誌 | `subscribeMonsterLogs(memberId, callback, maxCount)` | `src/lib/db.js:2746` | `export function subscribeMonsterLogs(memberId, callback, maxCount = 100) {` |
| 打怪日誌 | `saveMonsterLog(memberId, data)` | `src/lib/db.js:2759` | `export async function saveMonsterLog(memberId, data) {` |
| 材料升級 | `upgradeMaterial(memberId, materialId)` | `src/lib/db.js:2787` | `export async function upgradeMaterial(memberId, materialId) {` |
| 寶箱 | `addChests(memberId, chests)` | `src/lib/db.js:2825` | `export async function addChests(memberId, chests) {` |
| 寶箱 | `subscribeChests(memberId, callback)` | `src/lib/db.js:2836` | `export function subscribeChests(memberId, callback) {` |
| 寶箱 | `openChestsBulk(memberId, chests, contentsOf)` | `src/lib/db.js:2860` | `export async function openChestsBulk(memberId, chests, contentsOf) {` |
| 寶箱 | `openChest(memberId, chestId, contents)` | `src/lib/db.js:2955` | `export async function openChest(memberId, chestId, contents) {` |
| 藥劑 | `addPotions(memberId, potions)` | `src/lib/db.js:3008` | `export async function addPotions(memberId, potions) {` |
| 藥劑 | `subscribePotions(memberId, callback)` | `src/lib/db.js:3023` | `export function subscribePotions(memberId, callback) {` |
| 藥劑合成 | `craftPotion(memberId, potionId, craftCount)` | `src/lib/db.js:3041` | `export async function craftPotion(memberId, potionId, craftCount = 1) {` |
| 藥劑使用 | `usePotions(memberId, potionIds)` | `src/lib/db.js:3082` | `export async function usePotions(memberId, potionIds) {` |
| 碎片 | `addFragments(memberId, frags)` | `src/lib/db.js:3107` | `export async function addFragments(memberId, frags) {` |
| 碎片 | `migrateOldFragments(memberId)` | `src/lib/db.js:3124` | `export async function migrateOldFragments(memberId) {` |
| 碎片 | `subscribeFragments(memberId, callback)` | `src/lib/db.js:3177` | `export function subscribeFragments(memberId, callback) {` |
| 碎片合成 | `craftFragment(memberId, fragId)` | `src/lib/db.js:3188` | `export async function craftFragment(memberId, fragId) {` |
| 刷新輔助 | `refreshMaterials(memberId, callback)` | `src/lib/db.js:3215` | `export function refreshMaterials(memberId, callback) {` |
| 刷新輔助 | `refreshFragments(memberId, callback)` | `src/lib/db.js:3221` | `export function refreshFragments(memberId, callback) {` |
| 刷新輔助 | `refreshPotions(memberId, callback)` | `src/lib/db.js:3227` | `export function refreshPotions(memberId, callback) {` |
| 怪物圖鑑 | `subscribeMonsterDex(memberId, callback)` | `src/lib/db.js:3247` | `export function subscribeMonsterDex(memberId, callback) {` |
| 怪物圖鑑 | `getAllMonsterDex()` | `src/lib/db.js:3273` | `export async function getAllMonsterDex() {` |
| 卡片收藏 | `getAllCardCollections()` | `src/lib/db.js:3279` | `export async function getAllCardCollections() {` |
| 排行榜埋點 | `addVillageLap(memberId, n)` | `src/lib/db.js:3288` | `export async function addVillageLap(memberId, n = 1) {` |
| 排行榜埋點 | `addDungeonClear(memberId, family, n)` | `src/lib/db.js:3294` | `export async function addDungeonClear(memberId, family, n = 1) {` |
| 排行榜埋點 | `addPartyDamage(memberId, dmg)` | `src/lib/db.js:3300` | `export async function addPartyDamage(memberId, dmg = 0) {` |
| 排行榜埋點 | `saveDexSummary(memberId, totalUnlocked, totalAll)` | `src/lib/db.js:3307` | `export async function saveDexSummary(memberId, totalUnlocked, totalAll) {` |
| 打怪圖鑑 | `recordBattleDex(memberId, monsterId, result, dmgDealt)` | `src/lib/db.js:3314` | `export async function recordBattleDex(memberId, monsterId, result, dmgDealt) {` |
| 報到 | `getRecentCheckinMembers(days)` | `src/lib/db.js:3319` | `export async function getRecentCheckinMembers(days = 14) {` |
| 合成統計 | `subscribeCraftStats(memberId, callback)` | `src/lib/db.js:3339` | `export function subscribeCraftStats(memberId, callback) {` |
| 開箱統計 | `updateChestOpenStats(memberId, chestType)` | `src/lib/db.js:3350` | `export async function updateChestOpenStats(memberId, chestType) {` |
| 開箱統計 | `subscribeChestStats(memberId, callback)` | `src/lib/db.js:3360` | `export function subscribeChestStats(memberId, callback) {` |
| 藥水圖鑑 | `subscribePotionDex(memberId, callback)` | `src/lib/db.js:3371` | `export function subscribePotionDex(memberId, callback) {` |
| 藥水圖鑑 | `recordPotionUsed(memberId, potionIds)` | `src/lib/db.js:3379` | `export async function recordPotionUsed(memberId, potionIds) {` |
| 後台發道具 | `adminGiveItem(memberId, category, itemId, qty)` | `src/lib/db.js:3388` | `export async function adminGiveItem(memberId, category, itemId, qty) {` |
| 後台發道具 | `adminSetFragments(memberId, items)` | `src/lib/db.js:3424` | `export async function adminSetFragments(memberId, items) {` |
| 後台發道具 | `adminSetMemberBadge(memberId, badgeField, badgeLevel, value)` | `src/lib/db.js:3432` | `export async function adminSetMemberBadge(memberId, badgeField, badgeLevel, value) {` |
| 金幣 | `addCoins(memberId, amount)` | `src/lib/db.js:3442` | `export async function addCoins(memberId, amount) {` |
| 訪客戰績 | `recordGuestBattleStats(memberId, entry)` | `src/lib/db.js:3451` | `export async function recordGuestBattleStats(memberId, entry = {}) {` |
| 地下城次數 | `markDungeonUsed(memberId)` | `src/lib/db.js:3488` | `export async function markDungeonUsed(memberId) {` |
| 地下城次數 | `resetDungeonUsed(memberId)` | `src/lib/db.js:3495` | `export async function resetDungeonUsed(memberId) {` |
| 地下城次數 | `resetAllDungeonUsed()` | `src/lib/db.js:3500` | `export async function resetAllDungeonUsed() {` |
| 打怪次數 | `resetAllMonsterSessions()` | `src/lib/db.js:3508` | `export async function resetAllMonsterSessions() {` |
| 卡包 | `addCardPack(memberId, count)` | `src/lib/db.js:3521` | `export async function addCardPack(memberId, count = 1) {` |
| 卡片 | `addMonsterCard(memberId, cardData, chosenStat)` | `src/lib/db.js:3583` | `export async function addMonsterCard(memberId, cardData, chosenStat) {` |
| 王卡 | `addWorldBossCard(memberId, bossKey, chosenStat)` | `src/lib/db.js:3606` | `export async function addWorldBossCard(memberId, bossKey, chosenStat) {` |
| 卡片 | `upgradeCard(memberId, monsterId)` | `src/lib/db.js:3625` | `export async function upgradeCard(memberId, monsterId) {` |
| 卡片 | `equipCard(memberId, key, source)` | `src/lib/db.js:3648` | `export async function equipCard(memberId, key, source = "monster") {` |
| 卡片 | `unequipCard(memberId, key, source)` | `src/lib/db.js:3692` | `export async function unequipCard(memberId, key, source = "monster") {` |
| 卡片 | `setMythicCardStat(memberId, monsterId, chosenStat)` | `src/lib/db.js:3708` | `export async function setMythicCardStat(memberId, monsterId, chosenStat) {` |
| 稱號 | `setActiveTitle(memberId, bossKey)` | `src/lib/db.js:3717` | `export async function setActiveTitle(memberId, bossKey) {` |
| 稱號 | `clearActiveTitle(memberId)` | `src/lib/db.js:3731` | `export async function clearActiveTitle(memberId) {` |
| 王卡後台 | `adminGrantWorldBossCard(memberId, bossKey, chosenStat, operatorId)` | `src/lib/db.js:3741` | `export async function adminGrantWorldBossCard(memberId, bossKey, chosenStat, operatorId) {` |
| 王卡 | `setWorldBossCardStat(memberId, bossKey, chosenStat)` | `src/lib/db.js:3753` | `export async function setWorldBossCardStat(memberId, bossKey, chosenStat) {` |
| 卡片 | `subscribeCardCollection(memberId, callback)` | `src/lib/db.js:3761` | `export function subscribeCardCollection(memberId, callback) {` |
| 卡片 | `refreshCardCollection(memberId, callback)` | `src/lib/db.js:3772` | `export function refreshCardCollection(memberId, callback) {` |
| 月卡 | `getMonthlyCardConfig()` | `src/lib/db.js:3809` | `export async function getMonthlyCardConfig() {` |
| 月卡 | `saveMonthlyCardConfig(cfg, operatorId)` | `src/lib/db.js:3823` | `export async function saveMonthlyCardConfig(cfg, operatorId) {` |
| 月卡 | `subscribeMonthlyCardLogs(memberId, callback)` | `src/lib/db.js:3855` | `export function subscribeMonthlyCardLogs(memberId, callback) {` |
| 月卡 | `submitMonthlyCardRequest(memberId, memberName, hours, clientCard, hasPending)` | `src/lib/db.js:3869` | `export async function submitMonthlyCardRequest(memberId, memberName, hours, clientCard = null, hasPending = false) {` |
| 月卡 | `approveMonthlyCardRequest(requestId, memberId, operatorId)` | `src/lib/db.js:3881` | `export async function approveMonthlyCardRequest(requestId, memberId, operatorId) {` |
| 月卡 | `rejectMonthlyCardRequest(requestId, operatorId)` | `src/lib/db.js:3901` | `export async function rejectMonthlyCardRequest(requestId, operatorId) {` |
| 月卡 | `grantMonthlyCard(memberId, memberName, operatorId)` | `src/lib/db.js:3916` | `export async function grantMonthlyCard(memberId, memberName, operatorId) {` |
| 月卡 | `giftMonthlyCardSessions(memberId, memberName, sessions, operatorId)` | `src/lib/db.js:3937` | `export async function giftMonthlyCardSessions(memberId, memberName, sessions, operatorId) {` |
| 月卡 | `subscribePendingMonthlyRequests(callback)` | `src/lib/db.js:3956` | `export function subscribePendingMonthlyRequests(callback) {` |
| 月卡 | `subscribeMyMonthlyRequests(memberId, callback)` | `src/lib/db.js:3967` | `export function subscribeMyMonthlyRequests(memberId, callback) {` |
| 月卡 | `checkExpireMonthlyCard(memberId)` | `src/lib/db.js:3974` | `export async function checkExpireMonthlyCard(memberId) {` |
| 會計 | `addBillingRecord(data)` | `src/lib/db.js:3990` | `export async function addBillingRecord(data) {` |
| 會計 | `deleteBillingRecord(id)` | `src/lib/db.js:3994` | `export async function deleteBillingRecord(id) {` |
| 會計 | `subscribeBillingRecords(year, month, callback)` | `src/lib/db.js:3999` | `export function subscribeBillingRecords(year, month, callback) {` |
| 會計 | `getMembersForBilling()` | `src/lib/db.js:4009` | `export async function getMembersForBilling() {` |
| 版本 | `subscribeAppVersion(callback)` | `src/lib/db.js:4019` | `export function subscribeAppVersion(callback) {` |
| 版本 | `setAppVersion(version)` | `src/lib/db.js:4026` | `export async function setAppVersion(version) {` |
| 商店 | `shopBuyProduct(memberId, productId)` | `src/lib/db.js:4033` | `export async function shopBuyProduct(memberId, productId) {` |
| 金幣 | `spendCoins(memberId, amount)` | `src/lib/db.js:4100` | `export async function spendCoins(memberId, amount) {` |
| 商店裝備 | `shopBuyEquip(memberId, slotId, itemId, price)` | `src/lib/db.js:4113` | `export async function shopBuyEquip(memberId, slotId, itemId, price) {` |
| 商店外觀 | `shopUnlockEquipAppearance(memberId, itemId)` | `src/lib/db.js:4138` | `export async function shopUnlockEquipAppearance(memberId, itemId) {` |
| 商店回收 | `shopRecycleMaterial(memberId, materialId, amount)` | `src/lib/db.js:4170` | `export async function shopRecycleMaterial(memberId, materialId, amount = 1) {` |
| 裝備品項 | `subscribeEquipItems(callback)` | `src/lib/db.js:4211` | `export function subscribeEquipItems(callback) {` |
| 裝備品項 | `createEquipItem(data)` | `src/lib/db.js:4219` | `export async function createEquipItem(data) {` |
| 裝備品項 | `updateEquipItem(id, data)` | `src/lib/db.js:4226` | `export async function updateEquipItem(id, data) {` |
| 裝備品項 | `deleteEquipItem(id)` | `src/lib/db.js:4233` | `export async function deleteEquipItem(id) {` |
| 裝備操作 | `equipItem(memberId, slotId, itemId)` | `src/lib/db.js:4246` | `export async function equipItem(memberId, slotId, itemId) {` |
| 裝備操作 | `changeEquipBrand(memberId, slotId, itemId)` | `src/lib/db.js:4258` | `export async function changeEquipBrand(memberId, slotId, itemId) {` |
| 裝備操作 | `unequipSlot(memberId, slotId)` | `src/lib/db.js:4281` | `export async function unequipSlot(memberId, slotId) {` |
| 裝備強化 | `upgradeEquipSlot(memberId, slotId, clientData)` | `src/lib/db.js:4312` | `export async function upgradeEquipSlot(memberId, slotId, clientData = {}) {` |
| 裝備強化 | `saveEquipNextMats(memberId, slotId, mats)` | `src/lib/db.js:4400` | `export async function saveEquipNextMats(memberId, slotId, mats) {` |
| 練習紀錄 | `getPracticeLogs(memberId, maxCount)` | `src/lib/db.js:4410` | `export async function getPracticeLogs(memberId, maxCount = 120) {` |
| 符文孔 | `trySocketEquip(memberId, slotId)` | `src/lib/db.js:4435` | `export async function trySocketEquip(memberId, slotId) {` |
| 符文孔 | `setEquipSocketRune(memberId, slotId, socketIndex, runeId)` | `src/lib/db.js:4461` | `export async function setEquipSocketRune(memberId, slotId, socketIndex, runeId = null) {` |
| 符文合成 | `craftEquipmentRune(memberId, runeId)` | `src/lib/db.js:4482` | `export async function craftEquipmentRune(memberId, runeId) {` |
| 符文合成 | `combineEquipmentRune(memberId, runeId)` | `src/lib/db.js:4510` | `export async function combineEquipmentRune(memberId, runeId) {` |
| 寶庫獎勵 | `grantKingVaultReward(memberId, reward)` | `src/lib/db.js:4537` | `export async function grantKingVaultReward(memberId, reward = {}) {` |
| 遠征隊 | `startExpedition(memberId, slotIdx, catId, catName, missionTier, hours, archerCost)` | `src/lib/db.js:4567` | `export async function startExpedition(memberId, slotIdx, catId, catName, missionTier, hours, archerCost) {` |
| 遠征隊 | `collectExpedition(memberId, slotIdx, rewards, catId)` | `src/lib/db.js:4599` | `export async function collectExpedition(memberId, slotIdx, rewards, catId = null) {` |
| 里程碑 | `grantArrowMilestoneRewards(memberId, milestones)` | `src/lib/db.js:4646` | `export async function grantArrowMilestoneRewards(memberId, milestones) {` |
| 里程碑 | `checkAndGrantArrowMilestones(memberId, sessionArrowCount)` | `src/lib/db.js:4696` | `export async function checkAndGrantArrowMilestones(memberId, sessionArrowCount) {` |
| 轉蛋 | `drawGachaCards(memberId, type)` | `src/lib/db.js:4738` | `export async function drawGachaCards(memberId, type = "single") {` |
| 村莊 | `collectVillageResources(memberId, village, opts)` | `src/lib/db.js:4762` | `export async function collectVillageResources(memberId, village, opts) {` |
| 村莊 | `setBuildingAllocation(memberId, buildingId, allocation)` | `src/lib/db.js:4878` | `export async function setBuildingAllocation(memberId, buildingId, allocation) {` |
| 村莊升級 | `upgradeVillageBuilding(memberId, buildingId, village)` | `src/lib/db.js:4885` | `export async function upgradeVillageBuilding(memberId, buildingId, village) {` |
| 村莊市集 | `exchangeVillageMaterial(memberId, resource, fromTier, direction)` | `src/lib/db.js:4920` | `export async function exchangeVillageMaterial(memberId, resource, fromTier, direction) {` |
| 村莊資源 | `addArrowdew(memberId, amount)` | `src/lib/db.js:4940` | `export async function addArrowdew(memberId, amount) {` |
| 射手 XP | `addArcherXP(memberId, amount)` | `src/lib/db.js:4947` | `export async function addArcherXP(memberId, amount) {` |
| 轉蛋幣 | `addGachaCoins(memberId, amount)` | `src/lib/db.js:4954` | `export async function addGachaCoins(memberId, amount) {` |
| 市集寶箱 | `exchangeMaterialsForChest(memberId, chestType, costs, family)` | `src/lib/db.js:4962` | `export async function exchangeMaterialsForChest(memberId, chestType, costs, family = null) {` |
| 卡片市集 | `subscribeCardMarket(callback)` | `src/lib/db.js:4983` | `export function subscribeCardMarket(callback) {` |
| 卡片市集 | `listCardForSale(memberId, memberName, cardId, cardData, priceType, priceAmount)` | `src/lib/db.js:4997` | `export async function listCardForSale(memberId, memberName, cardId, cardData, priceType, priceAmount) {` |
| 卡片市集 | `buyCardListing(buyerId, buyerName, listing, offeredCardId)` | `src/lib/db.js:5020` | `export async function buyCardListing(buyerId, buyerName, listing, offeredCardId = null) {` |
| 卡片市集 | `claimCardSaleProceeds(sellerId, listingId)` | `src/lib/db.js:5090` | `export async function claimCardSaleProceeds(sellerId, listingId) {` |
| 卡片市集 | `cancelCardListing(memberId, listingId, cardId)` | `src/lib/db.js:5123` | `export async function cancelCardListing(memberId, listingId, cardId) {` |
| 市集設定 | `subscribeVillageMarketConfig(callback)` | `src/lib/db.js:5137` | `export function subscribeVillageMarketConfig(callback) {` |
| 市集設定 | `getVillageMarketConfig()` | `src/lib/db.js:5145` | `export async function getVillageMarketConfig() {` |
| 市集設定 | `saveVillageMarketConfig(battleExchange)` | `src/lib/db.js:5150` | `export async function saveVillageMarketConfig(battleExchange) {` |
| 村莊初始化 | `initVillageIfNeeded(memberId, currentVillage)` | `src/lib/db.js:5157` | `export async function initVillageIfNeeded(memberId, currentVillage) {` |
| 村莊後台 | `adminSetVillageBuilding(memberId, buildingId, level)` | `src/lib/db.js:5169` | `export async function adminSetVillageBuilding(memberId, buildingId, level) {` |
| 村莊後台 | `adminAdjustVillageResource(memberId, resourceKey, delta)` | `src/lib/db.js:5176` | `export async function adminAdjustVillageResource(memberId, resourceKey, delta) {` |
| 村莊後台 | `adminResetVillage(memberId)` | `src/lib/db.js:5192` | `export async function adminResetVillage(memberId) {` |
| 議會廳 | `checkCouncilDailyLimit(memberId)` | `src/lib/db.js:5207` | `export async function checkCouncilDailyLimit(memberId) {` |
| 議會廳 | `recordCouncilSession(memberId)` | `src/lib/db.js:5216` | `export async function recordCouncilSession(memberId) {` |
| 議會廳 | `resetCouncilDailyLimit(memberId)` | `src/lib/db.js:5222` | `export async function resetCouncilDailyLimit(memberId) {` |
| 議會廳 | `resetAllCouncilDailyLimits(memberIds)` | `src/lib/db.js:5227` | `export async function resetAllCouncilDailyLimits(memberIds) {` |
| 議會廳 | `completeCouncilSession(memberId, {...})` | `src/lib/db.js:5233` | `export async function completeCouncilSession(memberId, {` |
| 學生分級 | `setStudentTier(memberId, tier, operatorId)` | `src/lib/db.js:5370` | `export async function setStudentTier(memberId, tier, operatorId) {` |
| 學生凍結 | `setAccountFrozen(memberId, frozen, operatorId)` | `src/lib/db.js:5376` | `export async function setAccountFrozen(memberId, frozen, operatorId) {` |
| 學生分級 | `bulkSetStudentTier(memberIds, tier, operatorId)` | `src/lib/db.js:5383` | `export async function bulkSetStudentTier(memberIds, tier, operatorId) {` |
| 系統維護 | `setMaintenanceMode(enabled, message, operatorId)` | `src/lib/db.js:5394` | `export async function setMaintenanceMode(enabled, message, operatorId) {` |
| 系統維護 | `subscribeMaintenanceConfig(callback)` | `src/lib/db.js:5400` | `export function subscribeMaintenanceConfig(callback) {` |
| 權限矩陣 | `setTierPermissions(permissions, operatorId)` | `src/lib/db.js:5409` | `export async function setTierPermissions(permissions, operatorId) {` |
| 權限矩陣 | `subscribeTierPermissions(callback)` | `src/lib/db.js:5415` | `export function subscribeTierPermissions(callback) {` |
| 村莊等級顯示 | `setDisplayVillageLv(memberId, level)` | `src/lib/db.js:5426` | `export async function setDisplayVillageLv(memberId, level) {` |
| 懸賞設定 | `getDailyGeneralSettings()` | `src/lib/db.js:5437` | `export async function getDailyGeneralSettings() {` |
| 懸賞設定 | `saveDailyGeneralSettings(settings, adminId)` | `src/lib/db.js:5445` | `export async function saveDailyGeneralSettings(settings, adminId) {` |
| 村莊工人 | `assignVillageWorker(memberId, buildingId, catId)` | `src/lib/db.js:5456` | `export async function assignVillageWorker(memberId, buildingId, catId) {` |

---

## 3. `src/lib/` 186 個檔案全量盤點與主要 Export 說明

| 序號 | 檔案路徑 | 大小 (Bytes) | 主要 Export 函式 / 常數 / 系統說明 | 筆記記載狀態 |
|------|----------|--------------|------------------------------------|--------------|
| 1 | `src/lib/accessControl.js` | 4,858 | `DEFAULT_TIER_PERMISSIONS`, `PAGE_REGISTRY`, `isAutoLocked`, `getAllowedPages`, `isPageAllowed` | ✅ `quick-ref.md:118` 有記 |
| 2 | `src/lib/achievementDex.js` | 73,511 | `ACHIEVEMENTS_DEX`, `getAchievementList`, `calcAchievementBonus` (成就圖鑑系統) | ⚠️ 部分載於 `changelog.md` |
| 3 | `src/lib/adventurerSystem.js` | 17,527 | `levelFromXP`, `xpToReachLevel`, `makeSeedRand`, `getBiWeeklyPeriodKey`, `generateBiWeeklyBounties` | ✅ `quick-ref.md:16` 有記 |
| 4 | `src/lib/archerDiagnosis.js` | 7,805 | `diagnoseArcherPerformance`, `DIAGNOSIS_RULES` (射手診斷分析系統) | ❌ 筆記完全沒記 |
| 5 | `src/lib/archerLevel.js` | 4,064 | `MAX_ARCHER_LEVEL`, `XP_PER_LEVEL`, `archerLevelFromXP`, `archerXPProgress`, `archerLevelBonus` | ✅ `quick-ref.md:335` 有記 |
| 6 | `src/lib/archeryGrade.js` | 8,376 | `calculateArcheryGrade`, `GRADE_DEFINITIONS` | ⚠️ 筆記僅部分提及 |
| 7 | `src/lib/archeryGrade.test.js` | 5,571 | 單元測試檔 | - |
| 8 | `src/lib/arrowMilestone.js` | 7,736 | `MILESTONES`, `getMilestonesReached`, `getRewardsForMilestone` | ✅ `quick-ref.md:20` 有記 |
| 9 | `src/lib/arrowMilestone.test.js` | 6,611 | 單元測試檔 | - |
| 10 | `src/lib/arrowProgress.js` | 3,046 | `createRoundArrowRecorder`, `dailyArrowStorageKey`, `getLocalTodayArrows`, `setLocalTodayArrows`, `subscribeLocalTodayArrows`, `taipeiDateKey` | ✅ `quick-ref.md:27` 有記 |
| 11 | `src/lib/arrowProgress.test.js` | 4,165 | 單元測試檔 | - |
| 12 | `src/lib/battleAssets.js` | 387 | `BATTLE_ASSETS` (戰鬥靜態資源) | ⚠️ 筆記僅部分提及 |
| 13 | `src/lib/battlePractice.js` | 6,623 | `createPracticeSession`, `recordPracticeArrow` | ❌ 筆記完全沒記 |
| 14 | `src/lib/battlePractice.test.js` | 2,490 | 單元測試檔 | - |
| 15 | `src/lib/battleScreenSnapshot.js` | 1,817 | `takeBattleScreenSnapshot` | ❌ 筆記完全沒記 |
| 16 | `src/lib/battleScreenSnapshot.test.js` | 1,547 | 單元測試檔 | - |
| 17 | `src/lib/battleSound.js` | 6,679 | `playBattleSound`, `setBattleSoundMode`, `toggleBattleSoundMode`, `SOUND_IDS` | ✅ `quick-ref.md:41` 有記 |
| 18 | `src/lib/battleSound.test.js` | 7,911 | 單元測試檔 | - |
| 19 | `src/lib/boardData.js` | 9,618 | `BOARD_CELLS`, `BOARD_CONFIG` (貓貓村大富翁棋盤資料) | ❌ 筆記完全沒記 |
| 20 | `src/lib/boardEvents.js` | 17,371 | `triggerBoardEvent`, `BOARD_EVENT_TYPES` (大富翁突發事件) | ❌ 筆記完全沒記 |
| 21 | `src/lib/bookingDb.js` | 36,758 | `subscribeBookings`, `createBooking`, `cancelBooking`, `linkCurrentBookingToCheckin` (線上約課 DB) | ❌ 筆記完全沒記 |
| 22 | `src/lib/bookingEmailConfig.js` | 6,086 | `sendBookingConfirmationEmail`, `BOOKING_EMAIL_TEMPLATES` | ❌ 筆記完全沒記 |
| 23 | `src/lib/bookingSchedule.js` | 8,556 | `getAvailableTimeSlots`, `generateScheduleGrid` | ❌ 筆記完全沒記 |
| 24 | `src/lib/bookingSeen.js` | 3,239 | `markBookingSeen`, `subscribeUnreadBookings` | ❌ 筆記完全沒記 |
| 25 | `src/lib/bossRewardAdvance.js` | 2,268 | `calculateBossRewardAdvance` | ⚠️ 筆記僅部分提及 |
| 26 | `src/lib/bossRewardAdvance.test.js` | 3,067 | 單元測試檔 | - |
| 27 | `src/lib/botUtils.js` | 1,986 | `generateBotProfile`, `simulateBotTurn` | ❌ 筆記完全沒記 |
| 28 | `src/lib/buffPool.js` | 7,233 | `BUFF_POOL`, `getRandomBuff`, `applyBuffEffect` | ✅ `game-systems.md:680` 有記 |
| 29 | `src/lib/campSessionsDb.js` | 1,391 | `getCampSessions`, `createCampSession` | ⚠️ 僅 db.js 轉發提及 |
| 30 | `src/lib/campSessionsDb.test.js` | 2,593 | 單元測試檔 | - |
| 31 | `src/lib/cardEquipRules.test.js` | 4,217 | 單元測試檔 | - |
| 32 | `src/lib/cardTalents.js` | 7,947 | `CARD_TALENTS`, `getCardTalentEffects` | ⚠️ 載於 `changelog.md` |
| 33 | `src/lib/cardTalents.test.js` | 2,167 | 單元測試檔 | - |
| 34 | `src/lib/catAssignment.js` | 3,283 | `catBusyElsewhere`, `catBusyReason` | ✅ `quick-ref.md:23` 有記 |
| 35 | `src/lib/catCardData.js` | 21,122 | `CAT_CARDS`, `rollGacha` | ✅ `quick-ref.md:4747` 有記 |
| 36 | `src/lib/catCombat.js` | 1,463 | `calcCatCombatStats` | ⚠️ 筆記僅部分提及 |
| 37 | `src/lib/catData.js` | 29,209 | `CATS`, `getCatById`, `getCatStatBonus` | ✅ `quick-ref.md:381` 有記 |
| 38 | `src/lib/catDb.js` | 11,510 | `addCatBond`, `addCatXP`, `openCatBox` | ✅ `quick-ref.md:393` 有記 |
| 39 | `src/lib/catLevel.js` | 1,890 | `CAT_MAX_LEVEL`, `catLevelFromXP`, `catXPProgress`, `catLevelBonus` | ✅ `quick-ref.md:373` 有記 |
| 40 | `src/lib/catVillageGathering.js` | 8,772 | `getGatheringPartyBonus`, `calcGatheringYield` | ✅ `quick-ref.md:70` 有記 |
| 41 | `src/lib/chunkReload.js` | 1,968 | `registerChunkErrorReload` | ❌ 筆記完全沒記 |
| 42 | `src/lib/cohort.js` | 1,459 | `getCohortByDate` | ⚠️ 筆記僅部分提及 |
| 43 | `src/lib/combatRoundState.js` | 5,379 | `initCombatRoundState`, `updateRoundState` | ⚠️ 載於 `game-systems.md:186` |
| 44 | `src/lib/combatRoundState.test.js` | 3,620 | 單元測試檔 | - |
| 45 | `src/lib/combatSkillEngine.js` | 4,276 | `executeCombatSkill`, `SKILL_EFFECTS` | ⚠️ 載於 `game-systems.md` |
| 46 | `src/lib/combatSkillEngine.test.js` | 5,363 | 單元測試檔 | - |
| 47 | `src/lib/constants.js` | 10,275 | `BOW_TYPES`, `CERT_LEVELS`, `EQUIP_SLOT_DEFS`, `EQUIP_GRADES`, `calcBadgePoints` | ✅ `quick-ref.md:366` 有記 |
| 48 | `src/lib/consumableSystem.js` | 3,915 | `migratePotionInventory`, `useConsumableInBattle` | ✅ `quick-ref.md:10` 有記 |
| 49 | `src/lib/consumableSystem.test.js` | 3,188 | 單元測試檔 | - |
| 50 | `src/lib/costAlertAudio.js` | 2,697 | `playCostAlertSound` | ❌ 筆記完全沒記 |
| 51 | `src/lib/costAlertAudio.test.js` | 1,799 | 單元測試檔 | - |
| 52 | `src/lib/costControl.js` | 3,874 | `assertCostCapability`, `COST_CAPABILITIES`, `isCostCapabilityAllowed` | ❌ 筆記完全沒記 |
| 53 | `src/lib/costControl.test.js` | 1,876 | 單元測試檔 | - |
| 54 | `src/lib/councilMonsters.js` | 9,435 | `COUNCIL_MONSTERS`, `getCouncilMonsterData` | ✅ `quick-ref.md:70` 有記 |
| 55 | `src/lib/damage.js` | 12,046 | `calcDamage`, `calcMonsterCounterDamage` | ✅ `game-systems.md:120` 有記 |
| 56 | `src/lib/db.js` | 258,926 | Firestore 主資料庫存取庫 (詳見第 2 節) | ⚠️ 筆記多處過時/缺漏/殘留已死函式 |
| 57 | `src/lib/dexSeen.js` | 3,657 | `markDexSeen`, `getUnseenDexCount` | ⚠️ 載於 `changelog.md:525` |
| 58 | `src/lib/duelDb.js` | 25,801 | `createDuelRoom`, `subscribeDuelRoom`, `submitDuelArrow` | ✅ `game-systems.md:336` 有記 |
| 59 | `src/lib/dungeonAbilityRound.js` | 6,429 | `processDungeonRoundAbilities` | ⚠️ 載於 `game-systems.md` |
| 60 | `src/lib/dungeonAbilityRound.test.js` | 6,381 | 單元測試檔 | - |
| 61 | `src/lib/dungeonBossEncounter.js` | 5,076 | `triggerDungeonBossEncounter` | ⚠️ 載於 `game-systems.md` |
| 62 | `src/lib/dungeonBossEncounter.test.js` | 4,803 | 單元測試檔 | - |
| 63 | `src/lib/dungeonBossReward.js` | 4,003 | `calcDungeonBossRewards` | ⚠️ 載於 `game-systems.md` |
| 64 | `src/lib/dungeonBossReward.test.js` | 2,489 | 單元測試檔 | - |
| 65 | `src/lib/dungeonBossRewardDb.js` | 890 | `saveDungeonBossReward` | ⚠️ 載於 `game-systems.md` |
| 66 | `src/lib/dungeonBossRewardDb.test.js` | 1,972 | 單元測試檔 | - |
| 67 | `src/lib/dungeonChestLoot.js` | 1,359 | `rollDungeonChestLoot` | ✅ `quick-ref.md:95` 有記 |
| 68 | `src/lib/dungeonCollectibles.js` | 41,563 | `DUNGEON_COLLECTIBLES`, `getDungeonRelicBonus` | ✅ `quick-ref.md:419` 有記 |
| 69 | `src/lib/dungeonData.js` | 43,494 | `DUNGEONS`, `getDungeonFloorData` | ✅ `quick-ref.md:659` 有記 |
| 70 | `src/lib/dungeonDb.js` | 57,277 | `createDungeonRoom`, `subscribeDungeonRoom`, `trySetDungeonFirstClear` | ✅ `quick-ref.md:90` 有記 |
| 71 | `src/lib/dungeonEventPool.js` | 19,979 | `DUNGEON_EVENTS`, `triggerDungeonEvent` | ✅ `game-systems.md:533` 有記 |
| 72 | `src/lib/dungeonExcavation.js` | 38,995 | `revealExcavation`, `computeExcavationPatch`, `addExcavationByCheckin` | ❌ 筆記完全沒記專用模組 |
| 73 | `src/lib/dungeonExpansionMonsters.js` | 6,735 | `EXPANSION_MONSTERS` | ⚠️ 載於 `changelog.md:359` |
| 74 | `src/lib/dungeonExpansionMonsters.test.js` | 6,989 | 單元測試檔 | - |
| 75 | `src/lib/dungeonExpansionSmoke.test.js` | 3,400 | 單元測試檔 | - |
| 76 | `src/lib/dungeonKillRewards.js` | 1,358 | `calcDungeonKillRewards` | ⚠️ 載於 `game-systems.md` |
| 77 | `src/lib/dungeonRunSettings.js` | 810 | `getDungeonRunSettings` | ⚠️ 載於 `game-systems.md` |
| 78 | `src/lib/dungeonRunSettings.test.js` | 956 | 單元測試檔 | - |
| 79 | `src/lib/dungeonTrapPool.js` | 4,935 | `DUNGEON_TRAPS`, `triggerTrap` | ✅ `game-systems.md` 有記 |
| 80 | `src/lib/equipData.js` | 22,179 | `EQUIP_UPGRADE_COST`, `generateRandomMats`, `KING_SEAL_BREAKTHROUGH_COST` | ✅ `quick-ref.md:13` 有記 |
| 81 | `src/lib/equipGradeCurve.js` | 1,631 | `getEquipGradeMultiplier` | ⚠️ 載於 `changelog.md:270` |
| 82 | `src/lib/equipRefineCost.test.js` | 3,989 | 單元測試檔 | - |
| 83 | `src/lib/equipRefineCurve.test.js` | 10,111 | 單元測試檔 | - |
| 84 | `src/lib/equipSpecializationDb.js` | 9,470 | `saveEquipSpecialization`, `subscribeEquipSpecialization` | ❌ 筆記完全沒記 |
| 85 | `src/lib/equipmentRuneData.js` | 2,541 | `getEquipmentRune`, `getNextEquipmentRune`, `EQUIPMENT_RUNES` | ✅ `quick-ref.md:14` 有記 |
| 86 | `src/lib/equipmentRuneData.test.js` | 2,857 | 單元測試檔 | - |
| 87 | `src/lib/equipmentSpecializationCatalog.js` | 4,405 | `EQUIPMENT_SPECIALIZATIONS`, `getSpecializationData` | ❌ 筆記完全沒記 |
| 88 | `src/lib/equipmentSpecializationCatalog.test.js` | 1,857 | 單元測試檔 | - |
| 89 | `src/lib/equipmentSpecializationEngine.js` | 3,803 | `applySpecializationEffect` | ❌ 筆記完全沒記 |
| 90 | `src/lib/equipmentSpecializationEngine.test.js` | 2,265 | 單元測試檔 | - |
| 91 | `src/lib/expansionChestMaterials.test.js` | 2,464 | 單元測試檔 | - |
| 92 | `src/lib/expeditionData.js` | 7,950 | `calcCatFullStats`, `catPowerMult`, `calcExpeditionRewards` | ✅ `quick-ref.md:269` 有記 |
| 93 | `src/lib/expeditionDb.js` | 10,095 | `setActiveExpeditionProgress`, `clearActiveExpeditionProgress` | ✅ `quick-ref.md:94` 有記 |
| 94 | `src/lib/expeditionGrid.js` | 8,469 | `EXPEDITION_GRID_MAP`, `getGridCellData` | ✅ `quick-ref.md:775` 有記 |
| 95 | `src/lib/expeditionMemberData.js` | 2,888 | `getExpeditionMemberStats` | ⚠️ 載於 `quick-ref.md:262` |
| 96 | `src/lib/expeditionRewards.js` | 7,146 | `rollExpeditionLoot` | ✅ `quick-ref.md:95` 有記 |
| 97 | `src/lib/expeditionTeamDb.js` | 25,438 | `createExpeditionTeamRoom`, `subscribeExpeditionTeamRoom` | ✅ `quick-ref.md:88` 有記 |
| 98 | `src/lib/firebase.js` | 737 | `app`, `auth`, `db` (Firebase 初始化) | ⚠️ 筆記僅提及語法 |
| 99 | `src/lib/firestoreSafeWrite.js` | 1,262 | `safeUpdateDoc`, `safeSetDoc` | ⚠️ 筆記僅提及概念 |
| 100 | `src/lib/fxSettings.js` | 2,389 | `getFxSettings`, `saveFxSettings` | ✅ `quick-ref.md:621` 有記 |
| 101 | `src/lib/fxSettings.test.js` | 746 | 單元測試檔 | - |
| 102 | `src/lib/gameBalance.test.js` | 2,934 | 單元測試檔 | - |
| 103 | `src/lib/gatheringContracts.js` | 3,013 | `GATHERING_CONTRACTS`, `getContractDetails` | ✅ `quick-ref.md:70` 有記 |
| 104: | `src/lib/gatheringContracts.test.js` | 1,697 | 單元測試檔 | - |
| 105 | `src/lib/gatheringPartyDb.js` | 3,976 | `createGatheringPartyRoom`, `subscribeGatheringPartyRoom` | ✅ `quick-ref.md:71` 有記 |
| 106 | `src/lib/guestAuth.js` | 30,958 | `resolveGuestSession`, `generateGuestContactHash` (訪客持久登入/學籍分流) | ❌ 筆記誤記載為 Token 舊制 |
| 107 | `src/lib/guestContentPolicy.js` | 1,252 | `getGuestContentRestrictions` | ✅ `quick-ref.md:15` 有記 |
| 108 | `src/lib/guestContentPolicy.test.js` | 1,404 | 單元測試檔 | - |
| 109 | `src/lib/guestEntryRoute.js` | 366 | `resolveGuestEntry` | ✅ `quick-ref.md:18` 有記 |
| 110 | `src/lib/guestEntryRoute.test.js` | 923 | 單元測試檔 | - |
| 111 | `src/lib/guestEquipmentCatalog.js` | 691 | `GUEST_EQUIPMENT_PACK` | ✅ `quick-ref.md:33` 有記 |
| 112 | `src/lib/guestEquipmentDb.js` | 456 | `getGuestEquipment` | ⚠️ 載於 `quick-ref.md:31` |
| 113 | `src/lib/guestEquipmentDb.test.js` | 375 | 單元測試檔 | - |
| 114 | `src/lib/guestShellState.js` | 1,020 | `getGuestShellState` | ⚠️ 載於 `quick-ref.md:16` |
| 115 | `src/lib/guestShellState.test.js` | 1,239 | 單元測試檔 | - |
| 116 | `src/lib/itemData.js` | 35,516 | `POTIONS`, `FRAGMENTS`, `EQUIPMENT_ITEMS` | ✅ `quick-ref.md:9` 有記 |
| 117 | `src/lib/kingVaultRewards.js` | 1,186 | `rollKingVaultRewards` | ⚠️ 載於 `changelog.md:456` |
| 118 | `src/lib/leaderboardData.js` | 9,759 | `getLeaderboardRankings`, `RANKING_TYPES` | ⚠️ 載於 `changelog.md:6` (07-25 改版) |
| 119 | `src/lib/lootTable.js` | 7,177 | `makeCoinChest`, `COIN_CHEST_TIERS`, `rollMonsterLoot` | ✅ `quick-ref.md:11` 有記 |
| 120 | `src/lib/materialConversionDb.js` | 2,251 | `convertMaterials`, `MATERIAL_CONVERSION_RATES` | ⚠️ 載於 `changelog.md:456` |
| 121 | `src/lib/monsterAbilityCatalog.js` | 3,213 | `MONSTER_ABILITIES`, `getMonsterAbility` | ⚠️ 載於 `changelog.md:359` |
| 122 | `src/lib/monsterBattleSnapshot.js` | 1,754 | `createBattleSnapshot` | ❌ 筆記完全沒記 |
| 123 | `src/lib/monsterBattleSnapshot.test.js` | 1,507 | 單元測試檔 | - |
| 124 | `src/lib/monsterCards.js` | 8,877 | `MAX_EQUIPPED_CARDS`, `getCardStat`, `maxEquippedForStat`, `MAX_WB_EQUIPPED` | ✅ `quick-ref.md:18` 有記 |
| 125 | `src/lib/monsterConfig.js` | 14,281 | `MONSTER_DIFFICULTIES`, `MONSTER_VARIATIONS` | ✅ `quick-ref.md:667` 有記 |
| 126 | `src/lib/monsterData.js` | 33,169 | `MONSTERS`, `FAMILIES`, `TIER_ORDER`, `calcArcherStats` | ✅ `quick-ref.md:356` 有記 |
| 127 | `src/lib/monsterEconomyCatalog.js` | 4,438 | `MONSTER_ECONOMY` | ❌ 筆記完全沒記 |
| 128 | `src/lib/monsterEconomyCatalog.test.js` | 1,765 | 單元測試檔 | - |
| 129 | `src/lib/monsterExpansionAdapter.js` | 5,553 | `adaptExpansionMonster` | ❌ 筆記完全沒記 |
| 130 | `src/lib/monsterExpansionAdapter.test.js` | 1,705 | 單元測試檔 | - |
| 131 | `src/lib/monsterExpansionCatalog.js` | 2,623 | `EXPANSION_CATALOG` | ⚠️ 載於 `changelog.md:245` |
| 132 | `src/lib/monsterExpansionCatalog.test.js` | 1,829 | 單元測試檔 | - |
| 133 | `src/lib/monsterExpansionFeature.js` | 1,180 | `isExpansionFeatureEnabled` | ❌ 筆記完全沒記 |
| 134 | `src/lib/monsterExpansionFeature.test.js` | 856 | 單元測試檔 | - |
| 135 | `src/lib/monsterLootEngine.js` | 4,757 | `generateMonsterLoot` | ⚠️ 載於 `changelog.md:25` |
| 136 | `src/lib/monsterLootEngine.test.js` | 2,449 | 單元測試檔 | - |
| 137 | `src/lib/monsterMaterials.js` | 12,014 | `MATERIALS`, `MATERIAL_CATEGORIES` | ✅ `game-systems.md:396` 有記 |
| 138 | `src/lib/monsterRegistry.js` | 14,875 | `MONSTER_REGISTRY`, `getMonsterFromRegistry` | ❌ 筆記完全沒記專用登錄檔 |
| 139 | `src/lib/monsterRewardDb.js` | 2,535 | `saveMonsterReward` | ⚠️ 載於 `changelog.md:25` |
| 140 | `src/lib/monsterRewardLedger.js` | 2,578 | `recordRewardLedger` | ❌ 筆記完全沒記 |
| 141 | `src/lib/monsterRewardLedger.test.js` | 1,509 | 單元測試檔 | - |
| 142 | `src/lib/monsterSkillSchedule.js` | 2,073 | `getNextMonsterSkill` | ⚠️ 載於 `changelog.md:414` |
| 143 | `src/lib/monsterSkillSchedule.test.js` | 1,490 | 單元測試檔 | - |
| 144 | `src/lib/partyBattleSettings.js` | 669 | `getPartyBattleSettings` | ⚠️ 載於 `game-systems.md` |
| 145 | `src/lib/partyBattleSettings.test.js` | 809 | 單元測試檔 | - |
| 146 | `src/lib/partyDb.js` | 53,999 | `createPartyRoom`, `subscribePartyRoom`, `submitPartyRound` | ✅ `quick-ref.md:23` 有記 |
| 147 | `src/lib/partyMonsterAbilityEngine.js` | 6,470 | `processPartyMonsterAbilities` | ⚠️ 載於 `game-systems.md` |
| 148 | `src/lib/partyMonsterAbilityEngine.test.js` | 3,635 | 單元測試檔 | - |
| 149 | `src/lib/partyMonsterPayload.test.js` | 3,706 | 單元測試檔 | - |
| 150 | `src/lib/partyRewardEngine.js` | 845 | `calcPartyRewards` | ⚠️ 載於 `game-systems.md` |
| 151 | `src/lib/partyRewardEngine.test.js` | 988 | 單元測試檔 | - |
| 152 | `src/lib/partyStatusStats.test.js` | 2,298 | 單元測試檔 | - |
| 153 | `src/lib/randomEvents.js` | 10,545 | `RANDOM_EVENTS`, `triggerRandomEvent` | ✅ `game-systems.md:533` 有記 |
| 154 | `src/lib/score.js` | 6,878 | `calculateTargetScore`, `calculateRoundScore` | ✅ `game-systems.md:145` 有記 |
| 155 | `src/lib/seasonDb.js` | 2,724 | `getCurrentSeason`, `subscribeSeasonData` (季賽系統 DB，07-25 新增) | ⚠️ 載於 `changelog.md:6` (07-25 新增) |
| 156 | `src/lib/shootingPerformance.js` | 10,238 | `SHOOTING_SCHEMA_VERSION`, `buildMonsterShootingRecord`, `buildPracticeShootingRecord`, `calculateSessionMetrics` | ✅ `quick-ref.md:24` 有記 |
| 157 | `src/lib/shopData.js` | 4,353 | `SHOP_PRODUCTS`, `SHOP_PRODUCT_MAP`, `getShopPeriodKey`, `getShopDailyKey` | ✅ `quick-ref.md:15` 有記 |
| 158 | `src/lib/signatureAbilityEngine.js` | 8,798 | `processSignatureAbility` | ❌ 筆記完全沒記引擎檔 |
| 159 | `src/lib/signatureAbilityEngine.test.js` | 6,598 | 單元測試檔 | - |
| 160 | `src/lib/signatureEffectCatalog.js` | 10,188 | `SIGNATURE_EFFECTS` | ❌ 筆記完全沒記目錄檔 |
| 161 | `src/lib/signatureEffectCatalog.test.js` | 3,043 | 單元測試檔 | - |
| 162 | `src/lib/soloMonsterAbilityEngine.js` | 5,831 | `processSoloMonsterAbilities` | ⚠️ 載於 `game-systems.md` |
| 163 | `src/lib/soloMonsterAbilityEngine.test.js` | 3,626 | 單元測試檔 | - |
| 164 | `src/lib/soloRewardEngine.js` | 840 | `calcSoloRewards` | ⚠️ 載於 `game-systems.md` |
| 165 | `src/lib/soloRewardEngine.test.js` | 859 | 單元測試檔 | - |
| 166 | `src/lib/sound.js` | 24,028 | Web Audio 合成音效：`sfxTap`, `sfxSuccess`, `sfxCast`, `sfxBuff` 等 | ✅ `quick-ref.md:79` 有記 |
| 167 | `src/lib/storyData.js` | 14,511 | `STORY_CHAPTERS`, `getStoryChapter` | ✅ `quick-ref.md` 僅提及部分 |
| 168 | `src/lib/storyDb.js` | 3,120 | `saveStoryProgress`, `subscribeStoryProgress` | ✅ `quick-ref.md` 僅提及部分 |
| 169 | `src/lib/stripUndefinedDeep.test.js` | 2,030 | 單元測試檔 | - |
| 170 | `src/lib/targetFace.js` | 4,614 | `TARGET_FACES`, `calculateTargetRing` | ⚠️ 載於 `changelog.md:613` |
| 171 | `src/lib/targetFace.test.js` | 1,446 | 單元測試檔 | - |
| 172 | `src/lib/theme.js` | 1,121 | `APP_THEMES`, `getAppTheme` | ✅ `quick-ref.md:110` 有記 |
| 173 | `src/lib/version.js` | 130 | `APP_VERSION` | ✅ `quick-ref.md` 僅提及部分 |
| 174 | `src/lib/villageBoardDb.js` | 12,097 | `createVillageBoardGame`, `subscribeVillageBoardGame`, `rollBoardDice` | ❌ 筆記完全沒記貓村大富翁 DB |
| 175 | `src/lib/villageBoardTeamDb.js` | 20,578 | `createVillageBoardTeamRoom`, `subscribeVillageBoardTeamRoom` | ❌ 筆記完全沒記組隊大富翁 DB |
| 176 | `src/lib/villageData.js` | 14,344 | `BUILDING_LIST`, `BUILDINGS`, `getProductionRate`, `getUpgradeRequirements`, `DEFAULT_VILLAGE` | ✅ `quick-ref.md:17` 有記 |
| 177 | `src/lib/villageGoalData.js` | 5,162 | `VILLAGE_GOAL_TYPES`, `getGoalRewards` | ✅ `quick-ref.md:319` 有記 |
| 178 | `src/lib/villageGoalDb.js` | 21,091 | `initGoalTracker`, `contributeDamageToGoal`, `claimVillageGoalReward` | ✅ `quick-ref.md:318` 有記 |
| 179 | `src/lib/villagePack.js` | 3,878 | `openVillagePacks` | ✅ `quick-ref.md:21` 有記 |
| 180 | `src/lib/worldBossCards.js` | 3,579 | `WB_CARDS`, `getWorldBossCardDef` | ✅ `quick-ref.md:19` 有記 |
| 181 | `src/lib/worldBossData.js` | 25,494 | `WORLD_BOSSES`, `getWorldBossData` | ✅ `quick-ref.md:439` 有記 |
| 182 | `src/lib/worldBossDb.js` | 32,445 | `attackWorldBoss`, `subscribeWorldBossLobby`, `distributeWorldBossRewards` | ✅ `quick-ref.md:26` 有記 |
| 183 | `src/lib/worldBossSkillData.js` | 9,697 | `WORLD_BOSS_SKILLS`, `getBossSkill` | ✅ `quick-ref.md:439` 有記 |
| 184 | `src/lib/worldBossSkillData.test.js` | 2,786 | 單元測試檔 | - |
| 185 | `src/lib/worldBossStrikeEngine.js` | 7,144 | `processWorldBossStrike` (世界王強攻引擎) | ❌ 筆記完全沒記強攻引擎 |
| 186 | `src/lib/worldBossStrikeEngine.test.js` | 6,699 | 單元測試檔 | - |
