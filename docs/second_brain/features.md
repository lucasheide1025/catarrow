# 📋 features — 功能清單
> 最後更新：2026-07-14

## 🎨 2026-07-03 UI 全面改版 Phase 0-2（同左）

🔗 **在 Obsidian 中開啟**：`obsidian://open?vault=Obsidian%20Vault&file=catarrow%2Ffeatures`

## ✅ 已實作

**官網（2026-07-04 新增）**：`website/` 靜態 SEO 單頁官網（與 App 獨立），暖紙＋炭墨＋品牌橘編輯風；JSON-LD（LocalBusiness+FAQ）、OG、sitemap/robots；預約 CTA 連 SimplyBook `#book`；⚠ 網域 placeholder `catarchery.tw` 待部署後替換、地址 12/14 號待確認
**核心**：登入/角色分流、會員 CRUD、射手卡分享、主題換色（8 種）
**報到**：pending→教練審核→active/rejected、下課結算箭露、浮動視窗
**練習**：自主練習、歷史/總覽/分析、箭數里程碑（多回合+世界王已修 2026-07-02）、箭露累積
**比賽**：建立/提交/審核/結算/排行榜、外部比賽、報名
**檢定**：6 等級 3 弓種、檢定考試任務（藍書/金書）、教練審核
**地下城三大來源系統（2026-07-14）**：
- **① ⏳ 定時生成**：每次領取/放棄/保存後自動重設計時器（隨機 24~144h），時間到可領取隨機地下城（6 族 × T1~T6）
- **② ⛏️ 練箭挖掘**：報到 +20、每箭 +1、每 30 箭提升最高可開等級（T1→T6）；即時顯示 T1~T6 完整機率表；免費降級（T6→T1 無限制）；金幣強化保留
- **③ 📜 世界王卷軸**：擊殺世界王給卷軸，使用時隨機獲得 T1~T6 地下城存入儲存槽；使用前檢查槽位空滿
- **三卡並排 UI**：DungeonExcavationTab 同時顯示三個來源的操作卡片

**端對端地下城流程**：
- 挖掘探索（3 來源）→ 100% 揭曉（難度/族系/隱藏）→ 選擇保存/放棄
- 儲存槽固定 3 格（空槽 🕳️ 可視化）→ 選擇面板（單人 or 組隊）
- 單人遠征（DungeonExpedition：第 1、2 層 5×5 迷霧格子＋功能房本地模式，第 3 層 A/B/C 分支王關，2026-07-03 Phase G）
- **組隊遠征**（接現有 DungeonBattleRoom 多人戰鬥系統，2026-07-14 修正路由）：建立組隊房間 → 房主開始 → 三層 DungeonBattleRoom → 結算畫面
- **遠征 Boss／獎勵修訂（2026-07-04）**：建立時固定 Boss；weak/normal/strong/boss 分層；每隻怪保證材料寶箱 ×2＋金幣寶箱 ×2；寶藏房逐張翻牌；最終報告含隊員、傷害與 MVP
- 後台測試工具（AdminDungeon：幫任何玩家設定/移除儲存槽地下城）

**遊戲化（既有）**：
- 打怪（6 種族 6 難度，正常/組隊/決鬥/地下城/世界首領/賽事）
- 地下城地圖探索：SVG 地圖 + 10 種房型 + 投票移動 + 前後衛陣型 + 符文系統 + 合約系統
- 地下城經典模式：7 層隨機樓層，支援 8 人組隊
- 後衛機制（地下城 + 組隊）：可選治癒/攻擊，反擊只打前衛
- 怪物人數縮放 + 卡死預防機制 + 每人各自領獎
- 怪物卡片 100 張（5 星升級，最多裝備 5 張）
- 射手等級（200 級，5 種模式 XP）
- RPG 裝備（品質+強化）、成就系統、公會任務、議會廳
- 我的裝備頁顯示槽位完成度、實際 ATK／DEF／HP 總加成、單件公式與升級前後比較；神話裝備可強化至 +4

**貓系統**：9 隻貓角色、貓村（9 棟 20 級）、貓卡 100 張、轉蛋機、故事書
- 貓貓戰鬥技能（補血/增傷/防護），等級 200 + 裝備 5 格鍛造
- 九隻貓採「類型基底＋個體配點＋固有特性」：上排治癒、中排攻擊、下排防禦；同類三隻仍有不同成長倍率、技能威力與觸發率
- 貓貓獨立 HP 條、議會廳陪練、組隊虛擬夥伴

**後台**：記帳、通知、訊息、月卡申請/審核、圖鑑、版本更新提示

## 🚧 待辦

- [x] 地下城組隊失敗路由與全區廣播（2026-07-03 接手收尾）
- [ ] 使用兩個真實帳號完成組隊遠征 Firestore 多客戶端實測
- [ ] 藥水系統大改版——三層藥水架構 + 底部 tab 列 UI（see `potion-system-redesign.md`）
- [ ] UI 改版 Phase 4：後台套版、shared/Equipment.jsx 內層、戰鬥頁 token 收斂、最終刪 `.content-area` 覆寫層
- [ ] 音效/動畫批次 D：戰鬥層（受擊震屏、爆擊 hit-stop、怪物死亡溶解）
- [x] 地下城終戰模式（發掘→三層探險→Boss）— Trellis task `07-14-dungeon-expedition` — **全完成 2026-07-14**
- [x] 三大來源系統（定時生成 + 練箭挖掘 + 世界王卷軸）
- [x] 組隊遠征接 DungeonBattleRoom（正確路由）

## 🏗️ 戰鬥系統架構（2026-07-01 Phases 1-8）

### 共用模組（9 新檔）

```
src/lib/
  damage.js          ← 5 模式共用傷害公式（箭矢/反擊/貓貓/世界王）
  score.js           ← 集中計分邏輯（label↔value、SCORE_MAP、COLORS）

src/battle/
  BattleEvents.js    ← 22 個標準化 EventType + createXxxEvent builders
  BattleConfig.js    ← 戰鬥參數集中管理（箭數、距離、倍率、機率）
  BattleEngine.js    ← 單人戰鬥事件產生器（MonsterBattle pilot）
  BattleAnimation.js ← 19 個 playXxx + EVENT_DISPATCH 映射表
  useFirestoreRound.js ← Firestore 回合生命週期 hook（Party/Duel/Dungeon）
  RoundController.js ← 通用事件播放控制器（Monster/Council/WorldBoss）
  useBattleRound.js  ← React hook 封裝 RoundController
  useMiniRoundReveal.js ← mini-round 動畫 hook（Party/Dungeon）
  useDuelReveal.js   ← 決鬥逐箭揭露 hook（DuelRoom）
```

### 重構的 8 個元件

| 模式 | Phase | 重構目標 | 行數變化 |
|------|-------|---------|---------|
| MonsterBattle.jsx | 6 | 50 行 event loop → RoundController | −263 |
| PartyBattleRoom.jsx | 5, 7 | handleSubmit + host processing → useFirestoreRound；mini-round 動畫 → useMiniRoundReveal | +58 |
| DuelRoom.jsx | 5, 8 | subscribe + host processing → useFirestoreRound；12 步逐箭揭露 → useDuelReveal | +58 |
| DungeonBattleRoom.jsx | 5, 7 | 4 合 1 subscribe + host processing → useFirestoreRound；90 行 inline mini-round → useMiniRoundReveal | +94 |
| CouncilBattle.jsx | 6 | 內聯動畫/音效/log → RoundController | +138 |
| WorldBossAttack.jsx | 6 | 25 行 arrow loop → RoundController + customDelays 600ms | +12 |

### 架構原則

- **事件驅動**：標準化 EventType 22 種，EventType-driven dispatch
- **關注點分離**：傷害引擎 (damage.js) → 事件產生 (BattleEngine) → 動畫派遣 (BattleAnimation) → 回合控制 (RoundController/useFirestoreRound)
- **Firestore 回合抽象**：subscribe + submit + host process 三合一 hook，減少重複 30-50 行/元件
- **向後相容**：customDelays 等參數使用 options 物件，預設值不影響既有呼叫

---

## 🔧 2026-06-27 修正/改版

- **地下城事件**：補實裝 `def_mult_all`（守護結界）；reversal 合約 dmg 拼寫 bug 已修
- **商店購買記憶**：`shopPurchases` 不再在每次進出商店時重置；`hp_potion` 可重複購買
- **進場動畫 / 樓層**：地圖模式用 `mapCurrentRoomId` 作 key；`currentFloor` 從 `mapFloorIndex+1` 算
- **今日箭數同步**：`DailyQuest` 改用 `subscribeTodayPracticeLogs`（Firestore 側限日期）
- **成就通知**：改為個人通知（不再全頻廣播），deps 補全避免部分成就偵測失效
- **首頁改版**：公會等級 pill（adventurerXP）、三個收藏進度格、月卡移入等級卡、移除個人資訊列/年度檢定/最近成績
- **廣播訊息**：移除底圖，加 8 類分類篩選；type="achievement" 對應「成就」分類
- **怪物卡片**：改條列式，inline 顯示可升星、快速裝備按鈕；合約 HEX 補三色
- **地下城前後衛顯示**：改視角分排（單排顯示）；前衛死亡轉排時機修正（動畫後才移動）；`displayGroup` 欄位控制視覺分排；非房主卡住自動恢復；全員 ready 延遲 2 秒結算

## 🔧 2026-06-28 修正

- **復活藥/休息區復活**：修正 `handleResolve` 邏輯——改為掃描隊伍中所有 `alive && role==="rear"` 的成員來復活，不再錯誤檢查購買者本身的 role
- **商店 revival_front 條件**：只有隊伍中有前衛倒地（role=rear 的存活成員）時才能購買
- **休息區全員狀態卡**：頂部加橫排 HP 小卡，顯示所有隊員的 HP/role 狀態，便於討論投票選項
- **商店全員狀態卡**：同上，便於討論購買決策
- **商店購買限制修正**：移除 local `bought` state，改用 Firestore `shopPurchases` 作唯一購買記錄依據（避免換頁後 local state 重置而允許重複購買）
- **計分板折疊**：12 顆分數按鈕改為 7 顆折疊切換——Row A（X 10 9 8 7 6 M）/ Row B（6 5 4 3 2 1 M），節省螢幕空間
- **前衛觀察後衛**：輸入分數時，前衛新增小按鈕可切換角色卡視角至後衛排觀察狀況
- **關卡機制改版**：
  - `all_hit`（全中關）→「M懲罰關」：不再全部清零，改為每一發 M 扣除 10% 總傷害，最低歸零
  - `score_gate`（得分關）→ 比例懲罰：低於門檻的箭依距離降低該箭傷害（差1分-10%），且最高門檻 cap 至 9（不再要求 X/10）；score_gate 的分數按鈕去除 X 和 10
- **後台暗色主題**：`AdminReviewCenter`、`AdminMembers`、`AdminFinance` 共修正 16 處白底/淺色框（CertReviewCard、ExtReviewCard、MsgReplyCard、CertTaskCard 等）；QR code 白底保留（掃碼必需）

## ⚡ 2026-06-28 效能優化（vercel-react-best-practices）

- **Lazy Loading**（bundle-dynamic-imports）：MemberApp / AdminApp 共 50+ 元件改 `React.lazy`，主 bundle 676KB → **475KB（-30%）**
- **React.memo**（rerender-memo）：`MonsterSVG`、`BadgeSVG`、`SharedBattleComponents` 全員加 memo，戰鬥畫面 timer tick 不再重渲染純 SVG/HP bar
- **智能預載**（bundle-preload + js-request-idle-callback）：
  - `MemberApp` / `AdminApp` 登入後瀏覽器空閒時預下載最常用 chunk
  - nav 按鈕加 `onPointerEnter`，碰到就開始下載，切頁無 loading 感
  - Safari 無 `requestIdleCallback` 時 fallback 到 `setTimeout(cb, 1000)`

## ✨ 2026-06-28 View Transitions（vercel-react-view-transitions）

- **react@canary** 升級（19.3.0-canary）：`ViewTransition` 只在 canary 可用，用 `--legacy-peer-deps` 安裝
- **全分頁 cross-fade**：所有 `setPage()` 呼叫改透過 `startTransition()` 包裹（`useCallback` 封裝為新的 `setPage`）
- `MemberApp` 與 `AdminApp` 兩個 content-area 加 `<ViewTransition key={page} enter="fade-in" exit="fade-out" default="none">` 包裹 Suspense
- **底部導覽列隔離**：`member-nav` / `admin-nav` 加 `viewTransitionName`，切頁時導覽列不跟著動
- CSS recipes 加入 `src/index.css`：fade / slide-y keyframes、nav persistent isolation、reduced motion 支援

## 🔧 2026-06-28（續）地下城多人 Bug 修正

- **非房主拖出地圖**：`DungeonBattleRoom.handleClaimSelf` 改為：房主才呼叫 `returnToMapAfterBattle`，非房主設 `localClaimed=true` 顯示「等待房主」overlay，等 Firestore status 自然切換
- **隊員看不到房主選的怪物房**：`DungeonExplore.handleRoomClick` 選到怪物房時寫 `mapPendingRoom` 到 Firestore；非房主 subscribe 到後顯示唯讀預告 modal（「等待隊長決定是否出戰…」）；房主按出戰或撤退後清除 `mapPendingRoom`
- `dungeonDb.js` 新增 `proposeMapBattle(roomId, roomData)` / `clearMapPendingRoom(roomId)`

## ✅ 地下城終戰模式完成範圍

- 三大來源、三槽選單、單人／組隊三層遠征、結算獎勵、失敗廣播均已接線。
- 2026-07-03 接手收尾：等待室 transaction、固定房主、樓層 HP 延續、全員結果同步、固定獎勵與 `expeditionRecords` 規則已修。
- 尚待兩帳號實機驗證；在完成前不要把「build 通過」等同多人流程已驗證。
- [ ] 藥水系統大改版——三層藥水架構 + 底部 tab 列 UI（see `potion-system-redesign.md`）——原設計藥水應從遠征隊取得，煉金室仍維持箭露生產
- [x] CouncilBattle / WorldBossAttack 改用統一 `damage.js` 公式（Phase 8）
- [x] 透過 `RoundController` 重構 Party/Duel/Dungeon 戰鬥模式的 event playback
- [x] 透過 `useDuelReveal` 重構 DuelRoom 的逐箭揭露動畫
