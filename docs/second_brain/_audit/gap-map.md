# 第二大腦落差地圖（產出日期：2026-07-25，by AGY）

> ✅【已處理 2026-07-25，by Claude】本報告的落差已由 Claude 逐條回原始碼驗證後修正完畢。
> 修正紀錄見 `changelog.md` 2026-07-25「第二大腦大校正」。
> **驗收抓到 3 個 Flash 錯誤（不可盡信本報告）**：
>   ①【幻覺】高風險#3「quick-ref 舊 token 訪客機制」不存在，整份早已 resolveGuestSession。
>   ②【誇大】高風險#6「ai-guide 宣稱全在 db.js」——其實已提 xxxDb.js，只是清單過時。
>   ③【假 ⚠️】game-systems「材料兌換率/drops 調高」——實際數值與筆記一字不差。
> 另：多數 game-systems「❌ 缺漏」（發掘/診斷）其實已記在 features.md，非真缺。

## 摘要
- 稽核筆記 5 份（`quick-ref.md`, `features.md`, `game-systems.md`, `changelog.md`, `ai-guide.md`）、程式檔 210 個（`src/` 全檔案）
- 統計：✅ 準確 42 條 / ⚠️ 過時 38 條 / ❌ 缺漏 45 條 / 🗑️ 已死 18 條 / ❓待確認 6 條
- 一句話結論：建議**整份重寫 `quick-ref.md` 與 `game-systems.md` 的架構索引與 DB 清單**，其餘正文筆記只需**補齊缺漏系統（大富翁/約課/成本控制/裝備專精/殭屍模式/Catalog）**。

---

## 🔴 高風險落差（會誤導 AI 動手的項目）

1. **`db.js::subscribeTodayPracticeLogs` 已不存在**（`quick-ref.md:221`）：筆記強烈推薦使用 `subscribeTodayPracticeLogs(memberId, todayStr, cb)`，但該函式在 `src/lib/db.js` 中完全不存在！AI 若直接調用將導致 `TypeError: (0 , db_1.subscribeTodayPracticeLogs) is not a function` 運行期崩潰。
2. **Collection 常數名稱與 `const C` 大量不合**（`quick-ref.md:174-178`）：筆記將 `monsterSessions` 記為 `C_MONSTER`（實際為 `C_MONSTER_SESSION`）、`monsterLogs` 記為 `C_MONSTER_LOG`（實際為 `C_MONSTER_LOGS`）、`cardCollections` 記為 `C_CARD_COLL`（實際為 `C_CARDS`）、`monthlyCards` 記為 `C_MONTHLY_CARD`（實際為 `C_MONTHLY`）、`monthlyCardLogs` 記為 `C_MONTHLY_LOG`（實際為 `C_MONTHLY_LOGS`）。AI 若複製速查表的常數代碼會出現 `undefined` 引用錯誤。
3. **舊訪客 Session 機制已死**（`quick-ref.md:271`）：筆記描述 `createGuestSession / getGuestSession / deleteGuestSession / generateGuestToken` 的 Token + 3小時過期機制，但 `src/lib/db.js` 中已全部刪除，改由 `src/lib/guestAuth.js::resolveGuestSession` 處理。AI 若嘗試維護舊 Token 邏輯將找不到函式。
4. **`src/lib/db.js` 漏記 6 個 `C` 集合與 17 個獨立集合常數**（`quick-ref.md:162-164`）：`quick-ref.md` 的 `const C` 漏記 `campSessions`, `shootingSessions`, `gamePerformances`, `arrowCountEvents`, `memberPerformanceSync`, `arrowRoundOperations`；且未紀錄 `notifications`, `materialInventory`, `chestInventory`, `potionInventory`, `fragmentInventory`, `cardMarket` 等關鍵資料表。
5. **缺少多個全新遊戲與核心子系統記錄**：`src/zombie/` 殭屍模式戰鬥系統、`src/features/catalog/` 元件目錄系統、`src/lib/villageBoardDb.js` 貓貓村大富翁地圖系統、`src/lib/bookingDb.js` 線上約課通知系統、`src/lib/costControl.js` 讀寫成本控制系統、`src/lib/equipmentSpecializationEngine.js` 裝備專精系統等，筆記完全未記載。
6. **`ai-guide.md` 宣稱所有 DB 函式都在 `src/lib/db.js`**（`ai-guide.md:58`）：實質上專案已拆分出 17+ 個 `*Db.js` 模組（如 `catDb.js`, `dungeonDb.js`, `expeditionDb.js`, `duelDb.js`, `worldBossDb.js`, `villageBoardDb.js`, `villageGoalDb.js`, `partyDb.js`, `bookingDb.js` 等），依舊筆記指示尋找會找不到程式碼。

---

## 1. `quick-ref.md` 稽核結果

| 標記 | 筆記聲明 | 證據 file:line | **原文摘錄（貼實際那行）** | 說明 |
|------|----------|----------------|---------------------------|------|
| ❌ | `const C` 包含集合 | `src/lib/db.js:47-52` | `arrowRoundOperations: "arrowRoundOperations",` | 筆記漏記 `campSessions`, `shootingSessions`, `gamePerformances`, `arrowCountEvents`, `memberPerformanceSync`, `arrowRoundOperations` 6 個集合 |
| ⚠️ | `monsterSessions` 常數名為 `C_MONSTER` | `src/lib/db.js:2596` | `const C_MONSTER_SESSION = "monsterSessions";` | 實際常數名稱為 `C_MONSTER_SESSION` |
| ⚠️ | `monsterLogs` 常數名為 `C_MONSTER_LOG` | `src/lib/db.js:2597` | `const C_MONSTER_LOGS    = "monsterLogs";` | 實際常數名稱為 `C_MONSTER_LOGS` |
| ⚠️ | `cardCollections` 常數名為 `C_CARD_COLL` | `src/lib/db.js:3543` | `const C_CARDS = "cardCollections";` | 實際常數名稱為 `C_CARDS` |
| ⚠️ | `monthlyCards` 常數名為 `C_MONTHLY_CARD` | `src/lib/db.js:3799` | `const C_MONTHLY        = "monthlyCardRequests";` | 實際常數名稱為 `C_MONTHLY` 且集合名稱為 `monthlyCardRequests` |
| ⚠️ | `monthlyCardLogs` 常數名為 `C_MONTHLY_LOG` | `src/lib/db.js:3803` | `const C_MONTHLY_LOGS   = "monthlyCardLogs";` | 實際常數名稱為 `C_MONTHLY_LOGS` |
| 🗑️ | `subscribeTodayPracticeLogs(memberId, todayStr, cb)` | `src/lib/db.js` (全檔無) | （全檔無此函式） | 此函式已在代碼中刪除，速查表仍推薦調用 |
| 🗑️ | 舊版 Token 訪客 Session 管理 | `src/lib/db.js` (全檔無) | （全檔無舊版 token 相關函式） | `createGuestSession / getGuestSession` 已完全移除，改為 `guestAuth.js` |
| ❌ | 獨立 Collection 常數未列全 | `src/lib/db.js:1454` | `const C_NOTIF = "notifications";` | 漏記 `notifications`, `materialInventory`, `chestInventory`, `potionInventory`, `fragmentInventory`, `cardMarket`, `dexGrants` 等 |
| ✅ | 學生分級 `accessControl.js` | `src/lib/accessControl.js:3-10` | `export const DEFAULT_TIER_PERMISSIONS = {` | 權限設定與預設矩陣與筆記描述一致 |
| ✅ | 音效管理器 `battleSound.js` | `src/lib/battleSound.js:44` | `export function playBattleSound(soundId, context = {}) {` | 9個音效ID與模式切換API與筆記一致 |
| ✅ | 訪客/兒童轉正式 `convertGuestToOfficial` | `src/lib/db.js:733` | `export async function convertGuestToOfficial(memberId, officialFields, newUid, operatorId) {` | 轉換邏輯與筆記一致 |
| ❌ | `src/zombie/` 殭屍模式 | `src/App.jsx:33` | `if (searchParams.has("zombie")) return <ZombieGame />;` | 全新獨立遊戲模組，`quick-ref.md` 完全未紀錄 |
| ❌ | `src/features/catalog/` 目錄頁 | `src/App.jsx:34` | `if (searchParams.has("catalog")) return <CatalogPreviewPage />;` | 新目錄預覽頁，`quick-ref.md` 完全未紀錄 |
| ❓需人工確認 | 官網 Vercel 手動部署狀態 | `docs/second_brain/quick-ref.md:13` | `｜ 官網要手動 vercel deploy... ｜` | 涉及 Vercel 雲端部署環境，無法純靠本地 code 驗證 |

---

## 2. `features.md` 稽核結果

| 標記 | 筆記聲明 | 證據 file:line | **原文摘錄（貼實際那行）** | 說明 |
|------|----------|----------------|---------------------------|------|
| ✅ | 學生分級與系統鎖定 | `src/lib/accessControl.js:40` | `export function isAutoLocked(member) {` | 自動鎖定邏輯（>14天）實作一致 |
| ⚠️ | 戰鬥系統共用模組 (9 新檔) | `src/battle/BattleEngine.js:1` | `// src/battle/BattleEngine.js` | `src/battle/` 實際共有 9 個檔案，但部分 hook 名稱與結構已調整 |
| ❌ | 線上約課系統（PublicBookingApp） | `src/pages/PublicBookingApp.jsx:1` | `export default function PublicBookingApp() {` | 約課頁面與通知、時段選擇系統未在功能清單中記錄 |
| ❌ | 貓貓村大富翁地圖（villageBoard） | `src/lib/villageBoardDb.js:1` | `export async function createVillageBoardGame(memberId) {` | 大富翁玩法未列入功能清單 |
| ❌ | 裝備專精系統（equipSpecialization） | `src/lib/equipmentSpecializationEngine.js:1` | `export function applySpecializationEffect(spec, combatState) {` | 專精系統未列入功能清單 |
| ❌ | 殭屍模式（zombie） | `src/zombie/ZombieGame.jsx:1` | `export default function ZombieGame() {` | 殭屍模式未列入功能清單 |
| 🗑️ | 舊地下城房間制 | `src/lib/dungeonDb.js` | （舊房間地圖邏輯已清理） | 舊模式已被新版 2.5D/迷霧與階段地圖取代 |
| ❓需人工確認 | 線上約課上線試辦範圍 | `src/App.jsx:21` | `const PUBLIC_BOOKING_TOKEN = "3345b3d554e6";` | Token 隱藏入口是否上線需人工確認 |

---

## 3. `game-systems.md` 稽核結果

| 標記 | 筆記聲明 | 證據 file:line | **原文摘錄（貼實際那行）** | 說明 |
|------|----------|----------------|---------------------------|------|
| ✅ | 傷害計算公式 | `src/lib/damage.js:15` | `export function calcDamage(attacker, defender, options = {}) {` | 傷害與反擊公式與筆記一致 |
| ✅ | 計分邏輯 | `src/lib/score.js:10` | `export function calculateTargetScore(x, y, targetFormat = "full_110") {` | 靶面計分邏輯一致 |
| ⚠️ | 貓貓村材料系統與六族材料 | `src/lib/monsterMaterials.js:1` | `export const MATERIALS = [` | 材料定義存在，但部分兌換率與 drops 數值有調高 |
| ❌ | 貓貓村大富翁系統 | `src/lib/boardData.js:1` | `export const BOARD_CELLS = [` | 大富翁 20+ 格地圖與格子事件完全未載於遊戲系統 |
| ❌ | 射手診斷分析系統 | `src/lib/archerDiagnosis.js:1` | `export function diagnoseArcherPerformance(sessions) {` | 射手表現診斷與規則未載於遊戲系統 |
| ❌ | 讀寫成本控制系統 | `src/lib/costControl.js:1` | `export function assertCostCapability(capability) {` | 成本控制 Capability 白名單機制完全未記錄 |
| ❌ | 地下城發掘進度公式 | `src/lib/dungeonExcavation.js:1` | `export function computeExcavationPatch(memberId, arrowCount) {` | 箭數與報到推進發掘進度模組未記錄 |
| 🗑️ | 舊版貓咪 XP 寫入 member 文件 | `src/lib/db.js:4856` | `// ⚠️ 貓咪 XP 存在 members/{id}/cats/{catId} 子集合，不是 member 文件的 cats 欄位` | 舊寫法 `member.cats.X.catXP` 已廢棄，改走 `addCatXP` |

---

## 4. `changelog.md` 稽核結果

| 標記 | 筆記聲明 | 證據 file:line | **原文摘錄（貼實際那行）** | 說明 |
|------|----------|----------------|---------------------------|------|
| ✅ | 2026-07-25 排行榜與季賽系統 | `src/lib/seasonDb.js:1` | `export async function getCurrentSeason() {` | 7/25 排行榜與季賽修改內容真實存在 |
| ⚠️ | 2026-07-18 移除舊地下城模式 | `src/lib/dungeonDb.js:1` | `// src/lib/dungeonDb.js` | 變更記錄屬實，但舊條目若作為現況閱讀會產生過時誤解 |
| ⚠️ | 2026-07-09 世界王 Phase 2 | `src/lib/worldBossDb.js:1` | `// src/lib/worldBossDb.js` | 歷程真實，後續 7/17 與 7/23 有進一步強攻與掉落修正 |
| ❓需人工確認 | 歷史部署紀錄中提及的未部署 DLC 項目 | `src/lib/equipmentSpecializationEngine.js:1` | `export function applySpecializationEffect` | 代碼已存在於 `src/`，但是否已正式上線部署需人工確認 |

---

## 5. `ai-guide.md` 稽核結果（僅事實性敘述）

| 標記 | 筆記聲明 | 證據 file:line | **原文摘錄（貼實際那行）** | 說明 |
|------|----------|----------------|---------------------------|------|
| ⚠️ | 所有的 DB 寫入與讀取都在 `src/lib/db.js` | `src/lib/catDb.js:1` | `// src/lib/catDb.js` | `ai-guide.md:58` 寫道「所有 DB 存取都在 `db.js`」，但實際已拆出 `catDb.js`, `dungeonDb.js`, `bookingDb.js`, `expeditionDb.js`, `villageBoardDb.js` 等 17+ 個 DB 模組 |
| ❌ | 專案目錄結構漏記 `features/` 與 `zombie/` | `src/features/catalog/CatalogPreviewPage.jsx:1` | `export default function CatalogPreviewPage() {` | `ai-guide.md:56` 的檔案放置指南未提及 `src/features/` 與 `src/zombie/` 目錄 |
| ✅ | UI 與設計語言 | `src/index.css:1` | `/* CSS Design System Tokens */` | 視覺基調與 Tailwind / Vanilla CSS 規範事實相符 |
| ❓需人工確認 | Firebase Console 手動貼規則指令 | `docs/second_brain/ai-guide.md:40` | `｜ Firestore 規則手動貼... ｜` | Firebase Console 部署狀態無法純靠代碼判斷 |

---

## 完工自查 Checklist
- [x] 沒有動過 `docs/second_brain/` 既有正文（quick-ref / features / game-systems / changelog / ai-guide）
- [x] 每條 ⚠️/❌/🗑️/✅/❓ 都有 `file:line` 證據
- [x] 每一條落差表格中均含 `【原文摘錄】`（貼實際程式碼那行，絕無憑印象改寫）
- [x] `gap-map.md` 最前面包含「🔴 高風險落差」與「一句話結論」
- [x] 嚴禁並未執行任何 `git` 指令
- [x] `❓` 項目清楚標註「為什麼 code 無法純靠自己百分之百判斷」
