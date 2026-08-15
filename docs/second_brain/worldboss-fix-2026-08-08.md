# 世界王一致性修正（2026-08-08）

## 狀態

- 修正完成、已 commit、已 push、已部署正式環境。
- Git commit：`ffae25cbbd504e381b9ce87f5419f491991568a6`（`fix: stabilize world boss lifecycle replay`）。
- 正式前端：`https://student.catgroup.com.tw`，production deployment `catarrow-a7wxbpko8-broudes-1864s-projects.vercel.app`，已 Alias 且 Ready。
- 正式 bundle：`/static/js/main.c1ee3e9b.js`。
- Cloud Functions 已部署：`ensureWorldBossLifecycle`、`forceSpawnWorldBossFromCycle`、`worldBossLifecycleSchedule`、`contributeWorldBossSpawnProgress`（asia-east1 / Node.js 22 / v2）。
- 不修改世界王傷害、HP、獎勵、掉落、參與紀錄或其他經濟公式。
- 不新增 Firestore subscription、polling 或 collection。

## 1. 本次症狀

使用者觀察到：

1. 世界王看起來像有「新舊兩套」同時在生王，新的生成方式會被舊狀態取代。
2. 世界王登場／擊倒動畫會抓錯王或跑舊動畫。
3. 世界王明明已經死亡，重新整理／重新開 App 後仍會再次出現擊倒廣播。

## 2. 線上 Functions 稽核結果

使用 `firebase functions:list` 檢查目前已部署 Functions：

- 自動世界王排程只有 `worldBossLifecycleSchedule`。
- 沒有另一支舊 scheduled function 同時部署。

因此本次「像有兩套生王」的根因不是兩支 scheduler 同時存在，而是**多個 lifecycle 入口 + singleton status stale fields + 前端 replay race** 疊加造成。

## 3. 真正根因

### 3.1 `worldBossStatus/current` 使用 merge，舊王欄位殘留

`worldBossStatus/current` 是 singleton document，並以 `{ merge:true }` 更新。

新 lifecycle 生成新王時，原本只覆寫：

- `eventId`
- `status`
- `bossName`
- `announcement`

但沒有保證覆寫：

- `bossKey`
- `killReplay`

因此可能出現：

> 新 `eventId` + 新 `bossName` + 舊 `bossKey` + 舊 `killReplay`

這會讓前端以新王事件顯示舊王動畫／舊擊倒 payload。

### 3.2 世界王大廳仍在 mount 時呼叫 lifecycle

`WorldBossLobby.jsx` 原本仍存在：

```js
ensureWorldBossLifecycle()
```

這雖然呼叫的是同一套 Cloud lifecycle，並不是第二個 scheduler，但會讓「玩家進世界王大廳」也成為 lifecycle 觸發入口。

設計原則：

> Client/Lobby 只讀取與訂閱；自動 lifecycle 的權威只屬於 `functions/worldBossLifecycle.js`。

### 3.3 event defeated 與 killReplay 不同文件，存在 snapshot race

世界王死亡時：

1. `worldBossEvents/{eventId}` 先變成 `defeated`。
2. `worldBossStatus/current.killReplay` 隨後才可被 client snapshot 看見。

舊 Lobby 一看到 defeated 就立刻開擊倒畫面，因此可能在新 `killReplay` 尚未到達前直接落入 legacy fallback，造成動畫跑錯。

### 3.4 MemberApp 對 defeated snapshot 也會先跑登場動畫判斷

原本 intro 判定在 status guard 前，重新開 App 時若 singleton 仍是 defeated，仍可能觸發 `wb_intro_<eventId>` 的登場動畫。

### 3.5 擊倒廣播只靠記憶體 ref，重開 App 後失效

原本 `shownWbKillRef.current` 只能保護同一次 React session。

重新整理／重開 App 後 ref 歸零，同一個 defeated event 會再次被視為新擊倒事件，因此重複廣播。

後端的死亡 transition 本身已經有：

```js
const wasDefeated = fresh.status === "defeated";
const didDefeat = !wasDefeated && nextHP <= 0;
```

所以重複廣播主要是 client seen state 問題，不是後端重複發獎。

## 4. 修正內容

### 4.1 Active status 必須完整覆寫王身份並清除舊 replay

`functions/worldBossLifecycle.js` 新增：

```js
activeStatusPatch(eventId, event)
```

每次 active boss 被同步到 `worldBossStatus/current` 時，至少保證：

```text
eventId
status = active
bossKey
bossName
announcement = null
killReplay = null
```

新 spawn 與「已經存在 active boss 的 lifecycle 修復路徑」都使用同一規則。

### 4.2 手動開王同樣清除舊 killReplay

`src/lib/worldBossDb.js::createWorldBossEvent()` 建立 active status 時也明確寫入：

```js
killReplay: null
```

避免手動世界王繼承上一隻王的擊倒動畫資料。

### 4.3 Lobby 不再觸發 automatic lifecycle

`WorldBossLobby.jsx` 已移除：

```js
ensureWorldBossLifecycle()
```

Lobby 現在只：

- subscribe active/latest event
- subscribe spawn cycle read model
- subscribe worldBossStatus

不再成為自動生王入口。

### 4.4 killReplay 必須與目前 eventId 完全一致

`src/worldboss/domain/raidKill.js` 新增：

```js
isKillReplayForEvent(payload, eventId)
```

只有：

```text
killReplay.eventId === currentEventId
```

才允許播放該 replay。

上一隻王的 payload 即使因 snapshot race 或 stale singleton 暫時存在，也不會被拿來播放。

### 4.5 擊倒動畫增加短暫同步窗口

Lobby 在 event 先進入 defeated 時不再立即開舊畫面。

流程：

1. 等待同 eventId 的新 `killReplay`。
2. 若 payload 到達，立即播放新的 RaidKill cutscene。
3. 最多等待約 1.5 秒。
4. 只有真的沒有新 payload 的歷史舊事件才使用 legacy fallback。

### 4.6 Boss intro 只允許 active status

`MemberApp.jsx` 現在只有：

```js
ev.status === "active"
```

才允許設定 `bossIntroEvent`。

Defeated boss 不會因 App reload 再播放登場動畫。

### 4.7 擊倒廣播以 eventId 做永久 seen marker

新增：

```js
worldBossKillSeenKey(eventId)
```

key 格式：

```text
wb_kill_seen_<eventId>
```

使用 `localStorage` 保存。

因此：

- 同一個 event 在同 session 不會重播。
- 重新整理後不會重播。
- 關閉再開 App 不會重播。
- 新的 eventId 仍會正常播一次。

若玩家當下已經在 WorldBossLobby，Global MemberApp 不會搶播；由 Lobby 負責擊倒演出與 seen marker。

### 4.8 defeated status write 改為 await

擊倒流程中的 `writeWorldBossStatus()` 改為 `await`，降低 event/status 兩份文件之間非必要的延遲 race。

## 5. 權威規則（不可再破壞）

### Automatic spawn authority

**唯一自動 lifecycle / auto-spawn 權威：**

```text
functions/worldBossLifecycle.js
```

Client 不得重新加入：

- `beginWorldBossSpawnCycle()`
- `trySpawnWorldBossFromCycle()`
- Lobby mount 時的 `ensureWorldBossLifecycle()`
- 其他 client timer / interval 生王器

手動 Admin create/force spawn 可以保留，但必須明確是管理員操作，不可變成另一套自動排程。

### Active singleton invariant

任何 active boss status write 都必須同步：

```text
eventId
status
bossKey
bossName
announcement
killReplay = null
```

因為 `worldBossStatus/current` 使用 merge，不能只依賴未寫欄位自動消失。

### Replay invariant

```text
killReplay.eventId === displayedEvent.id
```

否則禁止播放。

### Broadcast invariant

每個 defeated 世界王只廣播一次：

```text
wb_kill_seen_<eventId>
```

不能只用 component ref / session memory 判斷。

## 6. 修改檔案

- `functions/worldBossLifecycle.js`
- `functions/worldBossLifecycle.test.js`
- `src/lib/worldBossDb.js`
- `src/worldboss/domain/raidKill.js`
- `src/worldboss/domain/raidKill.test.js`
- `src/components/worldboss/WorldBossLobby.jsx`
- `src/pages/MemberApp.jsx`

沒有修改商店、探索、傷害公式或獎勵公式。

## 7. 驗證

### Functions lifecycle

```text
node --test functions/worldBossLifecycle.test.js
```

- 4 / 4 passed

### Frontend World Boss focused tests

```text
src/worldboss/domain/raidKill.test.js
src/lib/worldBossSpawnCycle.test.js
src/lib/worldBossState.test.js
```

- 3 suites passed
- 44 / 44 tests passed

### Production build

```text
Compiled successfully
```

僅既有 CRA bundle-size warning。

### Source fingerprints

已確認：

- Lobby 不含 `ensureWorldBossLifecycle(`。
- Lifecycle active status 會 `killReplay:null`。
- MemberApp intro 有 `status === active` guard。
- Lobby / MemberApp 都使用 event-scoped replay / seen helper。

### Diff check

```text
git diff --check
```

通過；僅 Windows LF/CRLF warning。

## 8. 正式部署紀錄

### Git

```text
commit ffae25cbbd504e381b9ce87f5419f491991568a6
fix: stabilize world boss lifecycle replay
```

`origin/main` 已確認指向同一 commit。

### Firebase Functions

2026-08-09（台北時間）已部署完成：

- `ensureWorldBossLifecycle` — v2 callable / asia-east1 / nodejs22
- `forceSpawnWorldBossFromCycle` — v2 callable / asia-east1 / nodejs22
- `worldBossLifecycleSchedule` — v2 scheduled / asia-east1 / nodejs22
- `contributeWorldBossSpawnProgress` — v2 callable / asia-east1 / nodejs22

Firebase CLI 回報 `Deploy complete!`，四支函式 `functions:list` 均可見。

### Vercel / student.catgroup.com.tw

Git 自動部署一度長時間停在 Building，因此沒有直接在有大量未提交檔案的主工作區執行 `vercel --prod`。

改由 commit `ffae25cb` 的乾淨 detached worktree 執行 production deploy，避免把商店／探索等未完成工作帶上線。

結果：

```text
Production  https://catarrow-a7wxbpko8-broudes-1864s-projects.vercel.app
Aliased     https://student.catgroup.com.tw
Ready in 3m
```

正式站 HTTP 200，首頁目前引用：

```text
/static/js/main.c1ee3e9b.js
```

此 hash 與乾淨 `ffae25cb` Vercel production build 產出的 main bundle 相同。
