# 📋 features — 功能清單
> 最後更新：2026-07-03

## 🎨 2026-07-03 UI 全面改版 Phase 0-2

- **設計系統**：index.css design tokens（語意色/圓角/陰影/玻璃卡）+ `.ui-card`/`.ui-input` CSS 類；shared/UI.jsx 15 元件深色 token 化（API 向後相容）；新增 shared/Widgets.jsx（SectionHeader/StatBar/ProgressRing/Skeleton/HubTile）
- **主題收斂**：theme.js 只留單一 navy 深海金（要復活多主題往 APP_THEMES 加元素即可）
- **導覽**：header 改版（等級環+貨幣 chips+通知鈴鐺）、底部 nav token 化、四 hub 頁 HubTile 格線（cell-*.webp 引用移除）
- **首頁儀表板**：今日卡（報到/箭數/每日里程碑環）+ 進行中卡（世界王/遠征倒數/村目標）+ 快速入口 4 格
- 待辦：Phase 3 逐頁套版（戰鬥/貓村/卡片/排行）、Phase 4 後台、Phase 5 打磨（見 Trellis 任務 07-03-ui-redesign-p0 的 prd）

🔗 **在 Obsidian 中開啟**：`obsidian://open?vault=Obsidian%20Vault&file=catarrow%2Ffeatures`

## ✅ 已實作

**核心**：登入/角色分流、會員 CRUD、射手卡分享、主題換色（8 種）
**報到**：pending→教練審核→active/rejected、下課結算箭露、浮動視窗
**練習**：自主練習、歷史/總覽/分析、箭數里程碑（多回合+世界王已修 2026-07-02）、箭露累積
**比賽**：建立/提交/審核/結算/排行榜、外部比賽、報名
**檢定**：6 等級 3 弓種、檢定考試任務（藍書/金書）、教練審核
**遊戲化**：
- 打怪（6 種族 6 難度，正常/組隊/決鬥/地下城/世界首領/賽事）
- 地下城地圖探索：SVG 地圖 + 10 種房型 + 投票移動（中文房間名+全員同意自動前進）+ 前後衛陣型（後排角色卡完整顯示+高亮） + 符文系統 + 合約系統（幽冥地窖 3 層已實作）
- 地下城經典模式：7 層隨機樓層，支援 8 人組隊（前排 4 人+後排 4 人）
- 後衛機制（地下城 + 組隊均已套用）：可選治癒（25% maxHP 均分給存活隊友）或攻擊（傷害 ×0.5），反擊只打前衛；前衛倒下 → 自動轉後衛並復活至 50% HP
- 怪物人數縮放（地下城 + 組隊）：每多一人 HP×+50%、ATK×+15%、DEF×+15%，金幣/XP/掉寶 +20%（鼓勵組隊）
- 前後排顯示（地下城）：**視角分排**設計——前衛只看前衛排（最多4人），後衛只看後衛排；動畫進行中補顯對方排緊湊小卡；前衛死亡轉後衛時機在動畫結束後（displayGroupsBefore 機制）；後衛位置滿時死亡前衛留在前排顯示紫框+"🛡後衛"標籤
- 每人各自領取結算獎勵（不需等房主）
- 卡死預防：try/finally 確保結算不卡死、重整後自動同步 ready 狀態、5 秒安全網、房主強制重置按鈕永遠可見、全員 ready 後延遲 2 秒結算（Firestore 快照傳播）、非房主卡住 20 秒自動重置 submitted
- 怪物卡片 100 張（5 星升級，最多裝備 5 張，加成 HP/ATK/DEF）
- 射手等級（200 級，5 種模式各有 XP）
- RPG 裝備（武器/防具/飾品，品質+強化）
- 成就系統（銀/金/黑章）、公會任務
- 議會廳（6 副本採集，日限）
**貓系統**：9 隻貓角色、貓村（9 棟 20 級）、貓卡 100 張、轉蛋機、故事書
- 貓貓戰鬥：每回合 6 箭齊射，技能分組（補血/增傷/防護），等級 200 + 裝備 5 格鍛造
- 貓貓獨立 HP 條：打怪/議會廳各自扣血，HP 歸零無法攻擊/技能
- 議會廳陪練、組隊模式虛擬夥伴（貓貓單人可開組隊模式，XP×1.5 需真實隊友）
**後台**：記帳、通知、訊息、月卡申請/審核、圖鑑、版本更新提示

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

## 🚧 待辦

- [ ] 射箭偵測 (player.html) 整合 Firebase Auth（目前獨立 HTML 無登入）
- [ ] 藥水系統大改版——三層藥水架構 + 底部 tab 列 UI（see `potion-system-redesign.md`）——原設計藥水應從遠征隊取得，煉金室仍維持箭露生產
- [x] CouncilBattle / WorldBossAttack 改用統一 `damage.js` 公式（Phase 8）
- [x] 透過 `RoundController` 重構 Party/Duel/Dungeon 戰鬥模式的 event playback
- [x] 透過 `useDuelReveal` 重構 DuelRoom 的逐箭揭露動畫
