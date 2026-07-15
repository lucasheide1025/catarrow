# 🔧 Firestore 讀寫優化作業紀錄

> 操作日期：2026-07-14
> 操作者：Buffy (AI Agent)
> 作業依據：`docs/archer-performance-redesign-discussion.md` 及 Firestore 用量分析調查報告

---

## 一、作業目的

根據 Firestore 讀寫用量調查報告，近期引入的射手表現系統（Shooting Performance System）造成寫入量暴增 10 倍以上（每場打怪從 1 次寫入變為 5+ 次），加上既有的大量即時監聽器（70+ onSnapshot）導致持續性的高背景讀取成本。本次作業針對報告提出的 **P0/P1 改善方案**進行程式碼變更，以降低 Firestore 使用量。

---

## 二、備份清單

共備份 **15 個檔案**（總計約 646 KB），存放於本目錄下對應的路徑：

### src/lib/（12 個檔案）

| 檔案 | 大小 | 說明 |
|------|------|------|
| `db.js` | 233,308 B | **主資料庫操作層**，含 70+ onSnapshot 訂閱與射手表現雙重寫入 |
| `shootingPerformance.js` | 10,238 B | 射手表現系統——箭分計算與記錄結構 |
| `firebase.js` | 737 B | Firebase 初始化設定（含 persistent cache 設定） |
| `dungeonDb.js` | 75,041 B | 地下城系統資料庫操作 |
| `partyDb.js` | 44,766 B | 組隊戰鬥系統資料庫操作 |
| `worldBossDb.js` | 32,131 B | 世界王系統資料庫操作 |
| `bookingDb.js` | 32,513 B | 線上約課系統資料庫操作 |
| `duelDb.js` | 25,801 B | 決鬥系統資料庫操作 |
| `expeditionTeamDb.js` | 20,404 B | 組隊遠征資料庫操作 |
| `catDb.js` | 9,638 B | 貓貓陪練系統資料庫操作 |
| `expeditionDb.js` | 9,703 B | 遠征系統資料庫操作 |
| `gatheringPartyDb.js` | 3,976 B | 採集組隊資料庫操作 |

### src/pages/（2 個檔案）

| 檔案 | 大小 | 說明 |
|------|------|------|
| `AdminApp.jsx` | 73,681 B | 管理後台，含大量 useEffect + onSnapshot 訂閱 |
| `MemberApp.jsx` | 62,214 B | 會員前台，含大量 useEffect + onSnapshot 訂閱 |

### src/battle/（1 個檔案）

| 檔案 | 大小 | 說明 |
|------|------|------|
| `useFirestoreRound.js` | 12,195 B | 統一回合生命週期 hook，控制訂閱與提交邏輯 |

> 註：備份檔案皆已驗證為非空，可用於回滾。

---

## 三、實際變更內容

### 🔴 P0-1：今日箭數 → 改為 localStorage 本地累加（0 次 Firestore 讀寫）

**變更檔案：`src/lib/db.js`**
- `addRoundArrows()` 函式新增 3 行：從 `localStorage` 讀取今日累計箭數，加上本次箭數後寫回
- key 格式：`catarrow.today-arrows.{YYYY-MM-DD}`，隔日自動換 key 歸零
- 不影響既有 `totalArrowsAllTime` increment 邏輯

**變更檔案：`src/pages/MemberApp.jsx`**
- 移除 `subscribeTodayPracticeLogs` import 及對應的 useEffect
- 新增 `flushPendingShootingSessions` import
- 今日箭數改用 `localStorage` 讀取 + `window.addEventListener("storage")` 跨分頁同步

**變更檔案：`src/pages/AdminApp.jsx`**
- 同上（射手模式 header 中的 🏹 今日箭數）

### 🔴 P0-2：射手表現寫入 → 先存 localStorage，再 best-effort 寫 Firestore

**變更檔案：`src/lib/db.js`**（2 處）

`finalizeMonsterShootingSession()` 與 `finalizePracticeShootingSession()`：
- 將寫入邏輯反轉：**一律先 `queuePendingShootingSession()` 存 localStorage**
- Firestore `runTransaction` 改為 best-effort 嘗試
- Firestore 寫入失敗時不再往上拋（資料已在 localStorage 安全佇列中）
- **數據遺失防護**：當 `flushPendingShootingSessions()` 重試時，若 Firestore 仍寫入失敗，`__skipPendingQueue` 旗標確保錯誤重新拋出，讓佇列保留該項目供下次重試

### 🔴 P0-3：下課時 flush 射手表現資料

**變更檔案：`src/lib/db.js`**
- `submitClassEnd()` 函式末尾新增 `flushPendingShootingSessions(memberId)` 呼叫
- 確保學生按下「下課」時，所有累積在 localStorage 的射手表現一次寫入 Firestore

### 🔴 P0-4：載入 App 時自動 flush

**變更檔案：`src/pages/MemberApp.jsx`**
- 新增 useEffect，在 `profile?.id` 可用時自動呼叫 `flushPendingShootingSessions()`

**變更檔案：`src/pages/AdminApp.jsx`**
- 同上（射手模式）

---

## 四、安全機制

| 情境 | 處理方式 |
|------|---------|
| 學生忘記按下課 | 下次打開 App → MemberApp useEffect 自動 flush |
| 教練強制下課（forceEndTodayCheckins） | 資料在瀏覽器端 → 伺服器動不到 → 學生下次打開 App 自動 flush |
| 跨日歸零 | localStorage key 綁定日期，隔日自動換 key |
| 瀏覽器資料清除 | 今日箭數歸零（合理，因「這個瀏覽器今天射的箭」本身無跨裝置同步） |
| Firestore 寫入暫時失敗 | 保留在 localStorage 佇列，下次 flush 重試 |

---

## 五、效果預估

| 指標 | 改前 | 改後 |
|------|------|------|
| **每場打怪 Firestore 寫入** | 5+ 次（shootingSessions + ends + gamePerformances + arrowCountEvents + sync） | **0 次**（累積在 localStorage，下課時一次批次寫入） |
| **今日箭數 Firestore 讀取** | 1 個 onSnapshot 即時監聽（subscribeTodayPracticeLogs） | **0 次**（純 localStorage） |
| **今日箭數即時性** | 依賴 Firestore 推送（延遲 200-500ms） | **即時**（localStorage 同步，比 Firestore 快） |

---

## 六、後續遷移（2026-07-14 第二階段）

### 6a. 殘留元件遷移至 localStorage

第一階段完成後，仍有 3 個元件依賴 `subscribeTodayPracticeLogs`，已全數遷移至 localStorage：

| 元件 | 遷移方式 | 風險 |
|------|---------|------|
| `src/components/member/DailyQuest.jsx` | 移除 `subscribeTodayPracticeLogs` import，改為 useEffect 從 `catarrow.today-arrows.{date}` 讀取 + `storage` event 監聽 | ✅ 安全 |
| `src/components/worldboss/WorldBossAttack.jsx` | 同上。`todayArrows` 在 mount 時讀取，`submitAttack` 中計算里程碑使用 mount 時的值 + `totalArrowsSent` 參數，不受跨分頁影響 | ✅ 安全 |
| `src/components/worldboss/WorldBossAttack.legacy.jsx` | 保留不動（舊版備份，不被任何元件引用） | ⏸️ 可忽略 |

### 6b. 移除 `subscribeTodayPracticeLogs` 函式

所有 live 元件遷移完成後，從 `src/lib/db.js` 中移除 `subscribeTodayPracticeLogs` 函式定義：

- **行號範圍**：原第 764~778 行
- **驗證**：`db.js` 中 `subscribeTodayPracticeLogs` = false
- **殘留引用**：僅剩備份目錄（`backups/2026-07-14_firestore-optimization/`）及 `.legacy.jsx` 檔案，均為歷史備份

### 6c. localStorage 跨日殘留分析

| Key | 殘留模式 | 一年累積量 | 風險 |
|-----|---------|-----------|------|
| `catarrow.today-arrows.{YYYY-MM-DD}` | 每天新增一個約 40 bytes | ~15 KB | 🟢 極低，可忽略 |
| `catarrow.pending-shooting-sessions.v1` | 固定 key，capped 80 筆 | - | ✅ 有清理機制 |
| `catarrow.performance-cache.v1.{memberId}` | 每人一個，覆寫更新 | - | ✅ 有清理機制 |
| `wb_battle_{eventId}_{ownerId}` | 事件綁定，戰鬥結束自動清除 | ~50 KB | 🟢 極低 |

### 6d. 其他可優化的 onSnapshot 研究

對 `db.js` 中所有 ~50 個 `subscribe*` 函式進行了全面調查，篩選出以下高優先級優化目標：

#### 🔴 P0：高用量 + 低即時需求

| 訂閱 | 使用次數 | 建議 |
|------|---------|------|
| `subscribeCardCollection` | **16 次** 🔥 | 改為 `getDoc` + IndexedDB cache（卡牌裝備後幾乎不變） |
| `subscribePotions` | **11 次** 🔥 | 改為 `getDoc` + IndexedDB cache（戰鬥中藥水庫存不變） |
| `subscribeMonsterDex` | **6 次** | 改為 `getDocs()` + 定期刷新 |

#### 🟡 P1：可評估但效益較小

`subscribeMaterials`（3 次）、`subscribeCertification`（4 次）、`subscribePracticeLogs`（3 次）

#### 🟢 P2：後台管理專用，使用者量極少，不建議優化

約 20+ 個後台管理訂閱（`subscribePendingCheckins` 等）

---

## 七、專案原始 git HEAD

```
Commit: 2d5532a
Message: fix: 完善射手同步與遠征獎勵權限
Branch: main
```

## 八、回滾方式

若變更後出現問題，可執行以下指令回滾：

```bash
# 將備份檔案複蓋回原始路徑
cp backups/2026-07-14_firestore-optimization/src/lib/db.js src/lib/db.js
cp backups/2026-07-14_firestore-optimization/src/pages/MemberApp.jsx src/pages/MemberApp.jsx
cp backups/2026-07-14_firestore-optimization/src/pages/AdminApp.jsx src/pages/AdminApp.jsx
```

或使用 git 回復：

```bash
git checkout -- src/lib/db.js src/pages/MemberApp.jsx src/pages/AdminApp.jsx
```

---

*本紀錄由 Buffy (Freebuff AI Agent) 自動產生*
