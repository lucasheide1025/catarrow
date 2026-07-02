# 貓小隊射箭場 — 專案開發狀態說明（給 Claude 看）

> 這份文件供新對話的 Claude 快速建立上下文，避免重複探索。
> 最後更新：2026-06-13

---

## 一、專案概覽

**名稱**：貓小隊射箭場積分系統（catarrow）  
**性質**：射箭道館管理 Web App，含積分、比賽、打怪、決鬥、組隊等遊戲化系統  
**部署**：Vercel（push 到 GitHub 自動部署）  
**技術棧**：React 18、React Router v6、Firebase Auth + Firestore、Tailwind CSS v4

---

## 二、身份與路由邏輯（src/App.jsx）

| 條件 | 進入 |
|------|------|
| URL 有 `?guest=TOKEN` | `GuestBattle`（訪客，3 小時有效） |
| role === "admin" | `AdminApp` |
| role === "member" | `MemberApp` |
| 未登入 | `LoginPage` |

訪客 token = `btoa(guestId)`，Firestore `guestSessions` 存活期 3 小時。  
訪客進入後會做 Firebase 匿名登入，讓 Firestore 寫入可通過權限驗證。

---

## 三、身份驗證關鍵設計（src/hooks/useAuth.js）

- `profile.id` = `members` collection 的 **document ID**（自訂，非 Firebase Auth UID）
- `profile.uid` = Firebase Auth UID
- admin 也有自己的 `members` 文件（用 uid 查詢），確保背包、打怪等功能正常
- `admins/{uid}` 存在即為教練身份，以 auth uid 為 docId

**操作會員資料一律用 `profile.id`，不要用 `profile.uid`。**

---

## 四、Firestore Collections

| Collection | 用途 |
|-----------|------|
| `members/{docId}` | 會員資料：uid、name、nickname、score、fatCat、achievement、certRecords、equipment 等 |
| `admins/{uid}` | 教練身份識別，存在即為 admin |
| `competitions/{id}` | 比賽資料（title、date、arrowCount、roundCount、status 等） |
| `results/{id}` | 比賽成績（memberId、compId、total、rank、certLevel 等） |
| `registrations/{id}` | 報名記錄 |
| `messages/{id}` | 教練←→射手訊息 |
| `learnLogs/{id}` | 學習記錄（教練填寫） |
| `practiceLogs/{id}` | 練習記錄（射手自填） |
| `badgeLogs/{id}` | 徽章發放記錄 |
| `certRecords/{id}` | 檢定記錄 |
| `achievements/{id}` | 成就資料 |
| `externalComps/{id}` | 外部比賽記錄 |
| `auditLogs/{id}` | 操作稽核日誌 |
| `monthlyCardRequests/{id}` | 月卡請求 |
| `monthlyCardLogs/{id}` | 月卡使用記錄 |
| `monthlyCardConfig/{id}` | 月卡設定（預設次數等） |
| `checkins/{id}` | 打卡記錄 |
| `dailyQuestConfig/{id}` | 每日任務設定 |
| `monsterConfig/{id}` | 怪物難度設定 |
| `monsterSessions/{id}` | 打怪進行中的 session |
| `monsterLogs/{id}` | 打怪歷史記錄 |
| `monsterDex/{id}` | 怪物圖鑑（擊殺紀錄） |
| `craftStats/{id}` | 合成統計 |
| `duelRooms/{id}` | 決鬥房間（teamA/teamB map、log、result、processing、lastSeen） |
| `duelStats/{id}` | 決鬥統計（wins/losses/draws/flawless 等，以 memberId 為 docId） |
| `partyRooms/{id}` | 組隊房間 |
| `partyConfig/{id}` | 組隊設定 |
| `guestSessions/{id}` | 訪客 session（3 小時 TTL） |

---

## 五、已完成功能清單

### 基礎系統
- [x] Firebase Auth 登入 / 登出
- [x] Admin / Member / Guest 三種身份
- [x] Firestore 安全規則（firestore.rules）

### 教練後台（AdminApp）
- [x] 會員管理（新增、編輯、停用）
- [x] 比賽管理（建立、編輯、狀態控制）
- [x] 成績審核（年度檢定 → 教練審核）
- [x] 徽章發放
- [x] 學習記錄填寫
- [x] 訊息系統（教練←→射手）
- [x] 月卡審核
- [x] 紅點通知計數
- [x] 射手模式切換（教練可模擬會員介面）
- [x] 訪客連結產生器
- [x] 背包管理

### 射手前台（MemberApp）
底部導覽五個分頁：首頁 / 比賽 / 練習 / 排行 / 我的

**首頁**：通知彙整、快捷入口、組隊進行中提示  
**比賽**：比賽列表、比賽詳情（報名名單、成績排行）、計分、打怪、決鬥  
**練習**：自填練習記錄  
**排行**：全員積分排行榜  
**我的**：個人資料、主題切換、各功能入口

**我的** 底下的子頁：
- 學習記錄（教練填，我看）
- 訊息（教練←→我）
- 歷史成績
- 外部比賽記錄
- 成就系統
- 年度檢定申請
- 通知中心
- 成就圖鑑（Dex）
- 背包素材
- 卡牌收集
- 怪物圖鑑
- 組隊系統

### 遊戲化系統
- [x] 打怪（MonsterBattle）：難度選擇、傷害計算、掉寶、素材收集
- [x] 決鬥（DuelLobby + DuelRoom）：1v1、組隊、不對等戰鬥、斷線偵測、5分鐘踢除
- [x] 組隊（PartyLobby + PartyQuestRoom + PartyBattleRoom）：日常任務組隊、組隊打怪
- [x] 成就系統：打怪成就 + 決鬥成就（13個決鬥成就含 flawless、勝率等）
- [x] 怪物圖鑑（MemberMonsterDex）
- [x] 卡牌收集（CardCollection）

### 訪客模式（GuestBattle）
- [x] 打怪、練習記錄、組隊（PartyBattleRoom）、決鬥
- [x] 3 小時後自動過期

---

## 六、主要工具函式 / 常數檔

| 檔案 | 重要內容 |
|------|---------|
| `src/lib/db.js` | 所有 Firestore 讀寫，Collection 名稱用頂部 `C` 常數管理 |
| `src/lib/constants.js` | BOW_TYPES、CERT_LEVELS、calcBadgePoints()、certLevelStyle()、fmtDate() |
| `src/lib/monsterBattle.jsx` | 打怪核心邏輯 |
| `src/lib/monsterData.js` | 怪物資料表 |
| `src/lib/monsterMaterials.js` | 素材定義 |
| `src/lib/itemData.js` | 道具資料（藥水、碎片） |
| `src/lib/lootTable.js` | 掉寶機率 |
| `src/lib/buffPool.js` | 增益效果池 |
| `src/lib/achievementDex.js` | 成就圖鑑（含 13 個決鬥成就） |
| `src/lib/randomEvents.js` | 隨機事件 |
| `src/lib/duelDb.js` | 決鬥 Firestore 操作 |
| `src/lib/partyDb.js` | 組隊 Firestore 操作 |
| `src/lib/sound.js` | 音效工具 |
| `src/lib/cohort.js` | 同期夥伴功能 |
| `src/lib/theme.js` | APP_THEMES、getAppTheme()、saveAppTheme() |

---

## 七、決鬥系統技術細節

**傷害公式**：
```
base = 8 + atk*0.7 + score*1.2 - targetDef*0.35
隨機倍率 0.85~1.15，>1.05 視為爆擊
resolveHitPart() 套用部位加成
```

**Firestore 結構（duelRooms）**：
- `teamA` / `teamB`：map（memberId → { name, hp, atk, def }）
- `log`：戰鬥日誌陣列
- `result`：{ winner: "A"|"B"|"draw" }
- `processing`：boolean（防止重複結算）
- `lastSeen`：{ memberId: timestamp }（斷線偵測用）

**斷線偵測**：每 30 秒更新 lastSeen，>90 秒未更新視為斷線，host 可手動踢除。

---

## 八、備份腳本

`backup.js`（專案根目錄）：
- 執行：`node backup.js`
- 需要：`serviceAccountKey.json`（從 Firebase Console 下載，已在 .gitignore）
- 輸出：`backup_YYYY-MM-DDTHH-MM-SS.json`

---

## 九、開發注意事項

1. **不要把 `profile.uid` 傳給需要 memberId 的地方**，一律用 `profile.id`
2. Firestore 安全規則 `isAdmin()` 用 `exists()` 查 admins collection，`admins` 的 read rule 不能設成 `if isAdmin()`（循環依賴），目前正確設定為 `if request.auth.uid == uid`
3. 打怪、決鬥、組隊邏輯盡量在瀏覽器端計算，Firestore 只存最終結果
4. 教練也有 `members` 文件（以 uid 查詢），這是刻意設計，確保背包等功能正常

---

## 十、戰鬥系統架構交接（2026-07-02）

> 以下為 Phase 1-8 戰鬥系統重構後的架構，給後續開發者。

### 核心架構：src/battle/（9 個模組，勿刪除）

| 檔案 | 職責 |
|------|------|
| BattleConfig.js | 所有戰鬥參數（ARROWS_OPTIONS=[3,6]、距離、倍率） |
| BattleEvents.js | 22 種 EventType + builder 函式 |
| BattleEngine.js | 單人戰鬥事件產生器（generateRoundEvents） |
| BattleAnimation.js | 動畫派遣器（EVENT_DISPATCH + playXxx） |
| RoundController.js | 通用事件播放控制器（playEvents） |
| useBattleRound.js | React hook 封裝 RoundController |
| useFirestoreRound.js | 多人房間回合生命週期 hook（含 onSubmitSuccess） |
| useMiniRoundReveal.js | 共用 mini-round 動畫 hook（Party/Dungeon） |
| useDuelReveal.js | 決鬥逐箭揭露 hook |

### 重要設計決策

1. **src/battle/ 目錄不能刪**，所有戰鬥模式都 import 這裡的模組
2. **大回合制**（取代舊的小回合每 2 箭反擊）：
   - arrowsPerRound: 3 | 6，存在 Firestore room document
   - 所有箭打完後才反擊一次，無中途反擊
   - dungeonDb.js → processDungeonRound：改用 room.arrowsPerRound || 6 控制迴圈，反擊移到貓貓之後
   - partyDb.js → processPartyRound：每位玩家一個 mini-round 含全部箭矢
   - COUNTER_INTERVAL 已移除，勿重新加回去
3. **統一計箭**：
   - db.js 新增 addRoundArrows(memberId, count)（更新 totalArrowsAllTime）
   - addPracticeLog 已移除 totalArrowsAllTime increment（防雙重計算）
   - useFirestoreRound 新增 onSubmitSuccess callback，submit 成功後即時呼叫
4. **processDungeonRound 和 processPartyRound 的大回合邏輯已重構**，改動前請先讀完這兩個函式
5. **path_select 處理**：地圖模式非最後層擊殺後 status 為 path_select，DungeonBattleRoom 會跳過中間 UI 直接顯示完成畫面
