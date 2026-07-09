# Design：資料庫讀寫次數優化與死代碼清除

## 總體原則

- 全部改動**不得改變任何玩家可見行為**——這是效能優化，不是功能變更。
- 優先選擇「零新 Firestore 索引、零新規則」的做法，因為索引/規則變更都需要老闆手動到 Firebase Console 操作（CLI 會 403，這是本專案既有限制），任何需要新索引的方案都要额外承擔「忘記手動建索引 → 正式環境功能直接壞掉」的風險，能避免就避免。
- 每個 R 項目都是獨立可驗證、可個別回退的最小改動單位，比照 guest-kid-mode-overhaul 任務的分 Phase 慣例。

---

## R1 — 刪除死代碼

單純刪除以下 5 個函式定義（含其 JSDoc 註解），刪除前再各自 grep 一次確認零呼叫點（研究階段已確認，實作時再複查一次避免研究後又有新增呼叫點）：

| 函式 | 檔案 |
|---|---|
| `debugGetAllGuildSubs` | `src/lib/db.js:1778` |
| `getApprovedResults` | `src/lib/db.js:620` |
| `subscribeAllMonthlyRequests` | `src/lib/db.js:2992` |
| `updateDungeonMemberStats` | `src/lib/dungeonDb.js:113` |
| `subscribeAllDungeonBroadcasts` | `src/lib/dungeonDb.js:1246` |

**注意**：`subscribeAllMonthlyRequests` 与 `subscribePendingMonthlyRequests`/`subscribeMyMonthlyRequests` 只是名字像，後兩者是活的，不要刪錯。

---

## R2 — 合併發箭寫入 + 消除每箭一次的整份文件讀取

### 現況資料流
```
每發一箭記分（7 個呼叫端：MonsterBattle/DuelRoom/PartyBattleRoom/DungeonBattleRoom/CouncilBattle/MemberCertExam/WorldBossAttack）
  → db.js::addRoundArrows(memberId, count)
      → updateDoc(members/{id}, {totalArrowsAllTime: increment(count)})        // 寫入 #1
      → contributeArrowsToGoal(memberId, count)                                // 不同 collection，本次不動
      → dungeonExcavation.js::addExcavationByArrows(memberId, count)
          → getDoc(members/{id})                                              // 讀取（每次都重讀整份文件）
          → updateDoc 或 setDoc(members/{id}, {...dungeonExcavation 欄位})      // 寫入 #2
```
`addExcavationByArrows` 在全專案**只有這一個呼叫點**（已用 grep 確認），因此可以自由改它的內部實作與呼叫方式，不用擔心其他呼叫端。

### 改法

**A. 合併兩次寫入成一次**：讓 `addExcavationByArrows` 不再自己呼叫 `updateDoc`/`setDoc`，改成回傳「這次要 merge 的欄位物件」，由 `addRoundArrows` 統一組成一個物件、只呼叫一次 `updateDoc`（或視情況 `setDoc(..., {merge:true})`）寫入。

**B. 用 session 級記憶體快取消除「每箭一次 getDoc」**：在 `dungeonExcavation.js` 內加一個模組層級的 cache：

```js
// dungeonExcavation.js 頂部
const _excavCache = new Map(); // memberId -> { progress, lastActiveDate, dailyArrowsUsed, ts }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分鐘安全網，主要靠 lastActiveDate 換日比對保正確性，不是靠TTL撐正確性

async function readExcavationCached(memberId) {
  const cached = _excavCache.get(memberId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached;
  const snap = await getDoc(doc(db, "members", memberId));
  if (!snap.exists()) return null;
  const fresh = { ...(snap.data().dungeonExcavation || {}), ts: Date.now() };
  _excavCache.set(memberId, fresh);
  return fresh;
}
```

- `addExcavationByArrows` 改用 `readExcavationCached(memberId)` 取代直接 `getDoc`；算完新的 progress/dailyArrowsUsed/lastActiveDate 之後，**同時更新 `_excavCache`**（不是刪除快取逼下次重讀，而是直接把算好的新值寫回快取），這樣同一場戰鬥（很多發箭）只有第一發箭觸發一次真正的 `getDoc`，後面每一發都只讀記憶體。
- 這個檔案裡**其他**會寫 `dungeonExcavation` 的函式（`resetAutoDigTimer`／`claimAutoDig`／`initDailyExcavation`／手動揭曉…）維持原樣**自己 `getDoc`**，但寫入成功後要 `_excavCache.delete(memberId)` 讓快取失效——避免它們的寫入被 `addExcavationByArrows` 的舊快取蓋掉。這是唯一需要「順手改」的地方，其餘邏輯不動。
- 快取是**單一分頁記憶體內**的，重新整理頁面/切分頁就會清空重讀一次，不會有跨裝置資料錯亂的風險；5 分鐘 TTL 只是防止同一分頁開超久沒重整時徹底不同步的保險。

**C. `addExcavationByCheckin`**（報到觸發，每人每天最多 1-2 次）：優先度低，若時間允許可以套用同一個 `readExcavationCached` 減少一次 getDoc，但不是本次的重點，做不做都不影響驗收。

### 契約變更

```js
// dungeonExcavation.js —— 內部函式，改成「計算 patch，不自己寫入」
// 舊：export async function addExcavationByArrows(memberId, arrowCount) → void（自己 updateDoc/setDoc）
// 新：export async function computeExcavationPatch(memberId, arrowCount) → { patch: object, needsSetDoc: bool } | null
//     patch 是要 merge 進 members/{id} 的欄位物件（dot-path 或巢狀皆可，由呼叫端決定怎麼合併）

// db.js
export async function addRoundArrows(memberId, count) {
  if (!memberId || !count || count <= 0 || memberId.startsWith("guest")) return;
  const patch = { totalArrowsAllTime: increment(count) };
  try {
    const { computeExcavationPatch } = await import("./dungeonExcavation");
    const excav = await computeExcavationPatch(memberId, count);
    if (excav) Object.assign(patch, excav.patch);
  } catch (e) { /* ignore，退回只寫 totalArrowsAllTime */ }
  await updateDoc(doc(db, C.members, memberId), patch).catch(() => {});
  try {
    const { contributeArrowsToGoal } = await import("./villageGoalDb");
    await contributeArrowsToGoal(memberId, count);
  } catch (e) { /* ignore */ }
}
```

保留原本「任何一步失敗都不能讓箭數計分中斷」的容錯風格（try/catch 吞掉錯誤），這點跟現有程式碼慣例一致。

### 風險與檢查點
- 這是全站呼叫頻率最高的函式，任何寫壞都會**立刻大範圍影響所有玩家**。實作後必須手動跑過至少 MonsterBattle + DungeonBattleRoom 各一次完整回合，確認 `totalArrowsAllTime` 與 `dungeonExcavation.progress`/`dailyArrowsUsed`/`lastActiveDate` 都正確變化，且跟修改前的行為一致（可以在改之前先手動記一組數字，改完後比對）。
- `setDoc(..., {merge:true})` 分支（換日時）跟 `updateDoc` 分支（同一天內）合併寫入的邏輯要各自測到——換日邏輯建議用瀏覽器 devtools 改系統日期，或直接讀程式碼確認欄位計算正確即可，不強求真的等到隔天測。

---

## R3 — MonsterBattle 打怪紀錄改用一次性抓取

`src/components/member/MonsterBattle.jsx`：

- 第 363 行 `subscribeMonsterLogs(profile.id, v => setHistory(v), 100)` 整行移除（含 cleanup 的 `unsubLogs()`）。
- 改成掛載時呼叫一次 `getMonsterLogs(profile.id, 30).then(setHistory)`（既有函式，`db.js:1988`，本來就有 `limit(50)` 內部保底＋外部 slice）。
- **關鍵**：目前 `saveMonsterLog` 在戰鬥勝/敗結算時（第 941 行、996 行）是 fire-and-forget，靠 `subscribeMonsterLogs` 的即時推送讓「近期戰鬥紀錄」預覽自動更新。拿掉即時監聽後，這兩處都要在 `saveMonsterLog(...).catch(()=>{})` 之後串一個 `.then(() => getMonsterLogs(profile.id, 30).then(setHistory))`（或包成一個 `refreshHistory()` helper 兩處共用），維持「打完一場之後預覽清單立刻看得到新紀錄」的既有體驗。
- 第 1124 行既有的「歷史」分頁一次性抓取（`getMonsterLogs(profile.id, 20)`）維持不動；建議統一成跟 mount 時一樣用 30 筆，避免同一份資料因為兩個不同呼叫點筆數不一致造成觀感落差（非必要，但顺手做）。

**驗收對照**：改完後開 MonsterBattle → 首頁應該看到跟改之前一樣的「近期戰鬥紀錄」；打完一場（不管輸贏）→ 預覽清單要包含剛剛那一場；切到「歷史」分頁 → 清單要正常。

---

## R4 — 移除 `subscribeCollectibles` 重複監聽

`src/components/dungeon/DungeonDex.jsx`：
- 刪除 `import { subscribeCollectibles } from "../../lib/dungeonDb"`。
- 刪除 `const [collectibles, setCollectibles] = useState({})` 與對應的 `useEffect(() => subscribeCollectibles(myId, setCollectibles), [myId])`。
- 改成 `const collectibles = profile?.dungeonCollectibles || {};`（`profile` 已經由 `useAuth()` 取得，且 `useAuth.js` 本身已經對 `members/{id}` 開著即時監聽，`profile` 內容本來就是即時的）。

確認 `subscribeCollectibles`（`dungeonDb.js:1309`）在全專案只有這一個呼叫點後，一併刪除該函式定義（併入死代碼清單，等同 R1 的延伸項）。

**驗收對照**：貓貓地城收藏圖鑑頁面顯示內容不變；拿到新收藏品後頁面數字要跟改之前一樣會即時更新（因為還是靠 `profile` 的即時性）。

---

## R5 — `subscribePracticeLogs` 加上 `limit()` 防止無界讀取

**不做**「加 `where("source","==",...)` 做伺服器端過濾」——那需要新增一個 `(memberId, source, date)` 複合索引，索引跟規則一樣需要老闆手動到 Firebase Console 建立，一旦忘記建立會直接讓世界王大廳/組隊大廳在正式環境噴錯（`FirebaseError: The query requires an index`）。這個風險大於本次要省的讀取量，選擇不做。

**改做**：在 `db.js::subscribePracticeLogs` 加一個可選的 `maxCount` 參數（維持向後相容，預設值給一個寬鬆但有界的數字，避免真的極端老玩家的歷史紀錄把單次 onSnapshot payload 撐爆）：

```js
export function subscribePracticeLogs(memberId, callback, maxCount = 300) {
  return onSnapshot(
    query(collection(db, C.practiceLogs), where("memberId", "==", memberId),
          orderBy("date", "desc"), limit(maxCount)),
    snap => { /* 內容不變 */ },
  );
}
```
`limit()` 不會觸發新的複合索引需求（既有的 `where + orderBy` 索引已經在正式環境跑著，加 `limit` 只是縮小回傳筆數，索引需求不變）。

三個呼叫端各自傳入符合情境的 `maxCount`：
- `WorldBossLobby.jsx:202`／`PartyLobby.jsx:37`：只需要「最近的」worldboss/party 紀錄，傳小一點，例如 `subscribePracticeLogs(myId, cb, 60)`。
- `MemberPractice.jsx:2309`（完整練習歷史頁）：維持大一點的上限當防禦性天花板，例如 `subscribePracticeLogs(profile.id, cb, 500)`（不傳等於用預設 300 也可以，視覺上跟老玩家真實資料量對一下再決定數字）。

**驗收對照**：三個頁面顯示內容跟改之前一致（除非某玩家紀錄數超過新設的上限，這種邊界情況本來就在 PRD 的可接受風險範圍內——是刻意的「有界」取捨）。

---

## 施工順序建議

1. R1（最低風險，純刪除，先做建立信心）
2. R4（範圍最小，單一元件）
3. R5（單一函式加參數 + 3 個呼叫端傳值）
4. R3（MonsterBattle 改動，需要仔細顧到 saveMonsterLog 之後的刷新）
5. R2（風險最高、影響面最廣，放最後做，且做完要跑最多手動測試）

每做完一個 R 就跑一次 `CI=true npx react-scripts build`，不要累積到最後才一次驗證。
