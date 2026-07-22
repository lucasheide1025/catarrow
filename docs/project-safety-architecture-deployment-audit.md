# catarrow 全專案安全、架構與部署效能接手審查

日期：2026-07-22  
基線：`HEAD 4a49590`  
範圍：唯讀分析與報告；未修改產品程式碼、未移動或刪除檔案、未安裝套件、未部署、未推送。

## 執行摘要

Gemini／Antigravity 已完成初步大型檔案、重複邏輯、訂閱與死碼候選掃描，但沒有完成目前版本的安全邊界稽核，也沒有用量測拆解部署時間。部分結論已過時或證據不足，不能直接交給 Codex 刪除。

目前建議順序：

1. **P0：先修 Firestore Rules。** 多個 collection 允許所有已登入帳號跨使用者讀寫，部分 guest 資料甚至公開寫入。這是資料完整性與隱私問題。
2. **P1：降低部署來源與輸出體積。** Git pack 為 734.33 MiB，Git index 仍追蹤 3,252 個 `.deploy-*` 路徑、合計約 673.12 MiB；本機 production build 雖只需 18.36 秒，輸出卻達 476.63 MiB。
3. **P1：隔離 Vercel 不需要的根依賴。** `@google/genai`、`firebase-admin`、`sharp` 只供 scripts／維運用途，仍會被根目錄 `npm ci` 安裝。
4. **P1：分流處理相依套件弱點。** 根專案 `npm audit --omit=dev` 回報 94 個弱點；Functions 回報 13 個。必須依瀏覽器、建置工具、Functions 執行面分批處理。
5. **P2：漸進拆分核心單體檔案。** 先建立匯出與測試契約，再以相容 facade 逐 domain 抽離 `db.js`；不要同時混入行為修正。
6. **P2：移除候選另立任務驗證。** 無 import 不等於可安全刪除，需檢查字串註冊、資料驅動路徑、生成器、Git 歷史與產品用途。

## 量測基線

| 項目 | 觀察值 | 判讀 |
|---|---:|---|
| 本機 `npm run build` | 18.36 秒 | 編譯本身不是目前最強的分鐘級嫌疑 |
| `build/` | 476.63 MiB、1,794 檔 | 產物處理、快取與上傳成本高 |
| `public/` | 約 458 MiB、1,650 檔 | build 會直接複製，為產物大的主要來源 |
| 主 JS bundle | 830.55 KiB gzip | CRA 明確警告超過建議大小 |
| `.deploy-staging-2/` | 約 694 MiB，2,262 tracked | 已被 `.vercelignore` 排除，但仍膨脹 Git checkout/history |
| `.deploy-static-home/` | 約 332 MiB，990 tracked | 同上；需先判定是否仍是營運產物 |
| tracked `.deploy-*` 合計 | 3,252 paths、673.12 MiB | Git-index 口徑；目錄本機大小含額外內容，不能把上兩列 MiB 相加當成 tracked bytes |
| Git pack | 734.33 MiB | clone/fetch/source acquisition 的高影響候選 |
| Functions 非 `node_modules` source | 約 0.44 MiB、17 檔 | Functions 自有原始碼體積不是主要上傳瓶頸 |
| 前端測試 | 62/63 suites 通過；599/601 tests 通過 | `gameBalance.test.js` 有 2 個既有期望值不一致 |
| Functions 測試 | 56/56 通過，約 0.55 秒 | Functions 測試基線正常 |

Vercel 專案已由 `.vercel/project.json` 識別為 `catarrow`，但 CLI 沒有登入憑證，因此本次無法取得線上 `Cloning`、`Installing`、`Building`、`Uploading` 各階段時間。表中的 build、test、audit 數字是本審查任務先前執行階段留下的量測紀錄；最終核對沒有重跑可能寫入 build/cache 的命令。這些資料只支持候選排序，不支持宣稱可節省幾分鐘或百分比。

## Gemini／Antigravity 接手矩陣

| 原主張 | 目前狀態 | 接手判定 |
|---|---|---|
| `db.js` 與大型頁面需要拆分 | 成立 | 大小仍高，但需依責任、耦合與測試拆，不可只按行數切 |
| `updateBooking` 漏寫時間欄位 | 已完成 | `bookingDb.js` 現已寫入 `startTime`、`slotKey`、`slotKeys` |
| `AdminReviewCenter`／`AdminWorldBoss` 訂閱未清理 | 過時 | 目前被點名位置沒有該未清理呼叫；`AdminApp` 已統一 cleanup |
| `constants.js` 與 `archeryGrade.js` 重複 | 過時 | 目前沒有 `src/lib/archeryGrade.js` |
| `.vercelignore` 未排除 staging/scripts/docs | 過時 | 現已排除；但被 Git 追蹤的歷史與 checkout 體積仍存在 |
| 7 個元件可安全刪除 | 證據不足 | 只能列候選；需補查動態引用、資料註冊、歷史與產品意圖 |
| 測試檔沒有同名 production 檔即可刪 | 錯誤 | 測試可驗證跨模組契約；CRA 仍會執行 `*.test.js` |
| `public/assets` 與 `src/assets` 可依目錄名去重 | 證據不足 | 必須先做 hash、引用與生成來源清單 |
| 大 JS 資料改成 JSON 可減 bundle | 部分成立 | 同步 import JSON 不會自然減小 bundle；必須建立 lazy fetch/import 邊界 |
| 部署 staging 約 1 GiB 可清理 | 成立但不可直接刪 | 需先區分營運快照、可重建產物與 Git 歷史處理策略 |

## P0：Firestore 授權邊界

`firestore.rules` 的核心問題不是 API key，而是大量規則只檢查 `isLoggedIn()`，沒有檢查 document owner、participant、允許欄位與狀態轉移。

高風險面包括：

- `monsterSessions`、`monsterLogs`、`shootingSessions`、`gamePerformances`、`memberPerformanceSync`。
- `monsterDex`、`craftStats`、多種 inventory、`cardCollections`。
- duel、party、dungeon、zombie、world boss、first clear、guild progress、council、village、card market。
- `bookingSlotCounts` 對所有登入者開放讀寫。
- `guestSessions` 允許公開讀寫；`guestNotifications` 允許公開建立。
- 多處 competition、result、checkin、notification 規則允許登入者做過寬更新。

可能影響：普通帳號修改其他會員的進度或資源、偽造共享戰鬥狀態、枚舉會員資料、破壞預約計數或遊戲結算。

Codex 後續任務：

1. 逐 collection 建立「讀者、建立者、可更新者、不可變欄位、合法狀態轉移」矩陣。
2. 為 owner、member、participant、admin 建立 Rules helpers。
3. 先加入 Firebase Emulator Rules tests，涵蓋本人、他人、admin、匿名與欄位竄改。
4. 分 collection 漸進收緊；每批先驗證客戶端實際寫入路徑。
5. Rules 部署與客戶端調整分批、可回滾；不得一次全域封鎖。

## P1：相依套件安全

### 根專案

`npm audit --omit=dev` 回報 94 個弱點：4 low、37 moderate、53 high。重要原因是 `react-scripts` 被列在 production dependencies，因此 CRA/Webpack/Jest 工具鏈也進入此結果。另有 Firebase 與 Google SDK 的間接依賴。

處理方式：

1. 產生 production browser bundle 的實際 dependency inventory，分離 build-only 與 runtime SDK。
2. 規劃 CRA 遷移或可控的 build-tool 升級，不直接執行無差別 `npm audit fix`。
3. 對 `firebase`、`@google/genai`、`firebase-admin` 分別確認最新相容版本與實際執行面。
4. 每批更新後執行 601 個前端測試、production build 與 Auth/Firestore smoke flows。

### Functions

Functions 回報 13 個弱點：9 moderate、4 high，主要位於 `firebase-admin`／Google Cloud Storage 的 `fast-xml-parser`、`uuid` 間接鏈。其中部分目前標示沒有直接修正版。

處理方式：追蹤上游版本、確認 Functions 是否實際使用受影響解析路徑、以 emulator/測試保護升級；不要用 force upgrade 跨 major。

## P1：部署時間

### 已證實

- `vercel.json` 使用 `npm ci --prefer-offline --no-audit --no-fund`，再執行 `npm run build`。
- `.vercelignore` 已排除 docs、scripts、Trellis、build、staging、備份等內容。
- `.vercelignore` 不會自動把已提交的大檔從 Git index、checkout 或歷史移除；目前 index 中的 `.deploy-*` 為 3,252 paths／673.12 MiB。
- 本機 build 只需 18.36 秒，但產物為 476.63 MiB；因此應先量測 clone、install、build output processing/upload，而不是盲目微調 Webpack。
- `public/images` 約 141 MiB、`cards` 80 MiB、`ui` 75 MiB、`cats` 63 MiB、`monsters-battle` 47 MiB，是優先盤點區。

### 建議批次

1. **先取一筆 Vercel phase baseline。** 登入正確 team 後記錄最近三次部署各階段時間、cache hit 與輸出大小。
2. **移除目前 tree 中的 tracked staging 快照。** 另立核准任務；先外部封存或 tag 所需快照，再以一般 commit 停止追蹤。第一階段不改寫 Git history。
3. **建立資產 manifest。** 對 `public/` 做 hash、尺寸、格式、引用與生成來源分類；先處理重複原圖、展示相簿原始大圖及未壓縮資源。
4. **把大量相簿／非首屏資產移出 SPA deployment artifact。** 使用受控的物件儲存/CDN 與版本化 URL；保留必要 fallback。先做一小批量測，不整批搬移。
5. **隔離 tooling dependencies。** 將生成圖片、備份等 scripts 放入獨立、具 lockfile 的 tooling workspace；Vercel 根安裝只保留 build 所需套件。
6. **縮小主 bundle。** 依 React Router 頁面及大型遊戲模組建立 lazy boundaries。`MonsterSVG`、成就與地城資料只有在非同步載入時才會降低初始 bundle。
7. **Firebase 分目標部署。** Rules、特定 Function 與前端部署分開，避免每次變更都做全量部署；每個命令需明確 `--only` target。

### 驗證指標

- Vercel：`Cloning`、`Restoring cache`、`Installing`、`Building`、`Uploading` 各階段秒數。
- Repository：fresh clone 大小與時間、Git pack 大小、tracked `.deploy-*` 數量。
- Build：總秒數、`build/` bytes/file count、主 JS gzip、最大 20 個靜態資產。
- Install：`npm ci` 秒數、下載量、root package count、native package install 時間。
- Firebase：Functions packaging/upload/build/deploy 與 Rules deploy 分段時間。

## P1/P2：核心檔案拆分

目前優先候選（行數採「約略規模」，不同工具對空白行的計數可能不同）：

| 檔案 | 約略規模 | 建議邊界 |
|---|---:|---|
| `src/lib/db.js` | 4,900+ 行／247 KiB | 先 inventory exports/importers；依 member、billing、achievement 等 domain 抽離，暫由 `db.js` re-export |
| `MemberPractice.jsx` | 2,300+ 行 | session state、計分 domain、視覺區塊與 side effects 分離 |
| `MonsterBattle.jsx` | 2,200+ 行 | battle engine adapter、reward settlement、audio/animation、render sections |
| `DungeonBattleRoom.jsx` | 2,200+ 行 | room subscription、round state、action controls、result views |
| `PartyBattleRoom.jsx` | 2,200+ 行 | participant state、host controls、combat orchestration、presentation |
| `CatVillage.jsx` | 2,000+ 行 | domain hooks、inventory/forge/gathering panels |
| `WorldBossAttack.jsx` | 1,700+ 行 | subscription、attack flow、settlement、animation |
| `AdminApp.jsx` | 1,100+ 行 | shell/navigation、pending badges hook、route/section registry |

拆分原則：

- 一次只拆一個 domain 或穩定 UI 邊界。
- 先寫 characterization/contract tests，維持 export、props 與 Firestore payload 相容。
- `db.js` 使用 strangler pattern；先 re-export，再逐一遷移 imports，最後才縮小 facade。
- 安全修補、資料 schema 變更與純重構分開提交。
- 拆檔後用 bundle analyzer 與測試判定是否真的減少初始載入；檔案變多不等於 bundle 變小。

## P2：檔案歸位與移除候選

### 可進入後續驗證

- `.deploy-staging-2/`、`.deploy-static-home/`：tracked build/snapshot 候選。
- 根目錄與 `scripts/` 的一次性修復腳本：需確認是否仍是資料修復 runbook 的唯一來源。
- 無 import call site 的元件：`AdminAchievements`、`AdminAdventurerGuild`、`DungeonPathSelect`、`CouncilBattle`、`GatheringBattle`、`HonorTicker`、`CatAnimationToggle`。
- `public/` 與 `src/assets/` 的疑似重複資源。
- root 的 tooling packages 與 scripts，應移到獨立工具邊界，不等同直接刪除。

### 刪除前必要檢查

1. 搜尋 static import、dynamic import、`require`、路由表、字串名稱與資料驅動路徑。
2. 查 package scripts、Firebase/Vercel config、Git hooks、CI 與文件 runbook。
3. 對資產做 hash，不用檔名或目錄名判重複。
4. 查 Git history 與最近產品用途；必要時先 quarantine／archive 一個 release。
5. 執行 build、完整測試與對應 user flows。
6. 每批可獨立 revert；不要把數百個檔案與核心重構混在同一 commit。

## 建議的 Codex 後續任務樹

1. `firestore-rules-ownership-hardening`：P0，先做 rules matrix 與 emulator tests。
2. `deployment-phase-baseline`：取得 Vercel/Firebase 三次分段時間，不改設定。
3. `tracked-deploy-snapshot-cleanup`：保留策略、停止追蹤、量測 clone 改善；不預設 history rewrite。
4. `public-asset-manifest-and-offload-pilot`：先選一個大資產群組做可回滾試點。
5. `root-tooling-dependency-isolation`：建立獨立工具 package/lockfile，量測 `npm ci`。
6. `dependency-security-upgrade-batches`：browser、build-tool、Functions 三條線分開。
7. `db-strangler-phase-1`：export/import inventory、contract tests、抽離第一個 domain。
8. `large-page-boundaries`：逐頁拆分，先從低風險 render-only 邊界開始。
9. `dead-code-and-asset-quarantine`：驗證候選、先隔離後刪除。

## 已調查但不建議變更

- 不把 Firebase Web `apiKey` 當作管理員 secret；真正安全邊界是 Auth、App Check 與 Rules。
- 不因測試檔沒有同名 production module 就刪除。
- 不只把 JS 靜態資料改成同步 JSON import，因為這不會自然縮小初始 bundle。
- 不在沒有 Vercel 階段數據時宣稱精確節省分鐘數。
- 不直接執行 `npm audit fix`、刪除 staging、搬移 public 資產或改寫 Git history。

## 驗證紀錄與限制

- `npm run build`：成功，18.36 秒，476.63 MiB，CRA 回報 bundle 顯著偏大。
- 前端測試：599/601 通過；既有 `gameBalance.test.js` 兩項成本期望不一致，未修改。
- Functions 測試：56/56 通過。
- `npm audit --omit=dev`：根 94 個、Functions 13 個弱點；未執行 fix。
- Vercel CLI 54.18.5 可用且專案 link 存在，但無登入憑證，未取得平台 metrics。
- 本次沒有 Firebase/Vercel 部署、遠端寫入、檔案移除、移動或產品程式修改。
