# Technical Design

## Chosen direction

採用混合設計：

- 以方案 B「Pocket Quest Console」作為資訊架構與手機操作骨架。
- 以方案 A 的單一場景、角色焦點與單一主 CTA 建立沉浸感。
- 以方案 C 的木製魔法機台、紙靶與能量光建立戰鬥辨識。

大廳明亮、戰鬥較深色；兩者共享貓咪、箭羽、木材、紙張與魔法能量元素，維持同一品牌世界。

## Presentation architecture

### Style boundary

將目前集中在 `ArcadeApp.jsx` 的大型 CSS 字串移到獨立 `arcadeGame.css`，由 Arcade 入口載入一次。樣式採 `arcade-*` namespace，不影響正式學生系統。

新增共用呈現元件：

- `ArcadeShell`：safe area、背景、top HUD、內容區與底部操作區。
- `ArcadePlayerBar`：貓頭像、暱稱、等級、XP、金幣與本機狀態。
- `DungeonCarousel`：一次聚焦一座地下城，支援按鈕、圓點、scroll snap 與鍵盤操作。
- `ArcadeActionDock`：固定／sticky 的唯一主 CTA 與必要次要操作。
- `ArcadeBottomNav`／sheet：把組隊、夥伴、商店、統計與設定分層，不改變既有 phase／資料模型。
- `ArcadeBattleHud`：提供戰鬥畫面的視覺容器與插槽；既有 Adventure／Team／Duel 邏輯仍各自擁有狀態與提交。

元件只接受已整理好的 display props 與 callback，不讀 Firestore、不持有 profile persistence，也不改戰鬥公式。

## Screen design

### First visit

- 單一全螢幕明亮場景，中央突出當前同行貓。
- 暱稱與貓咪 carousel 位於同一 viewport；底部唯一 CTA 隨選中貓變化。
- 鍵盤開啟時縮小場景區，保留輸入與 CTA。
- 本機保存限制維持可見但降低視覺權重。

### Returning hub

- 頂端使用緊湊 Player Bar，不再使用傳統 topbar＋多張統計卡。
- 中央一次聚焦一座地下城場景，預設順序為可恢復冒險、上次選擇、貓森。
- 地下城下方只有一個主要「開始／繼續」動作。
- 組隊與競技場作為兩個次要功能島；房號輸入收進組隊 sheet。
- 商店、背包、統計、清除進度與本機說明收進底部導覽／sheet，功能不得消失。

### Dungeon visual identity

- Forest：天空與草綠、苔石、暖金光；`★ 新手推薦`。
- Moon：深藍月光、紫色岔路、青色魔法光；`★★ 路線選擇`。
- Abyss：炭黑岩壁、熔火橘與深紫；`★★★ 高風險`。

第一版使用 CSS 場景、現有怪物／貓咪素材與裝飾圖示建立景深，不阻塞於新增大型插畫資產。

### Battle HUD

- 上層：回合、房號／返回、同步狀態與怪物 HP。
- 中央：怪物最大視覺焦點；傷害與狀態錨定正確目標。
- 中下：本回合唯一射箭任務膠囊。
- 底部：分數／靶面輸入和唯一攻擊 CTA，落在拇指熱區與 safe area 之上。
- Adventure、Team、Duel 的玩法與資料流不合併；僅共用視覺容器和 tokens。
- 演出依既有權威結果播放，不預演擊殺或重複扣血。

## Tokens

- Base ink `#101827`, cream `#FFF8E8`, surface `#FFFFFF`.
- Forest `#35C66B`, moon `#7868E6`, abyss `#FF6B45`.
- Magic mint `#58F5B5`, sky `#55C7F3`, gold `#FFC83D`, danger `#E84855`.
- Display radius 24px、control radius 16px、pill radius 999px。
- Tap 120ms、UI 200ms、scene 360ms；戰鬥一般演出維持短促。
- 常用按鈕至少 48px，高頻主 CTA 56px；正文不低於 14–15px。

## Compatibility and constraints

- 不更改 `ArcadeApp` 的 route-query 優先順序、IndexedDB schema、Firestore room contract 或 profile migration。
- 既有 `loading/onboarding/hub/adventure/team/duel/shop` phase 均保持可達。
- 現有 class 若被測試或子元件依賴，先保留相容 alias，再逐步替換。
- 390px 為主要驗收寬度，同時檢查 360px 與較矮 viewport。
- 支援 `prefers-reduced-motion`、safe area、focus-visible、非色彩狀態提示。

## Multiplayer balance extension

### Team adventure

- `scaleMonsterForParty()` 使用 `1 + playerCount` 作為 HP 倍率；防禦與攻擊既有額外成長可保留。
- 開戰交易將每位 active roster 成員寫入 `hp:100`、`maxHp:100`、`alive:true`，作為整趟冒險的權威快照。
- 普通與 Boss 回合解析均回傳逐玩家傷害結果。怪物未被擊倒時，每位仍存活玩家承受 `monster.atk`；同一回合使用回合開始 roster，避免寫入順序影響誰受傷。
- 玩家 HP 跨關卡保留；離線移出 roster 不會使其他人的 HP 重算。全員 HP 為 0 才寫入 `defeat`。
- Boss 可保留「打斷大招」作為減傷／免傷條件，但失敗結果必須落到逐玩家 HP，不能只扣士氣。房間與 `lastResolution` 保存 `partyDamage`／逐玩家 HP before/after，供所有客戶端播放同一結果。
- UI 用隊員 HP 條顯示全體同步受傷；一次演出所有隊員扣血，不逐人拉長動畫。

### Duel

- `maxHpForArrows(arrows, playerCount)`：3 箭 `80 + max(0,n-2)*20`；6 箭 `130 + max(0,n-2)*30`，n 限制 2～8。
- `buildInitialDuelCombat()` 只在開始交易建立一次 combat；之後以 persisted `maxHp` 為準。
- 舊房間／測試缺少 player count 時維持 2 人基準，確保相容。

## Adventure dossier share card

沿用現有 `arcadeShare.js` 原生 Canvas 與 1080×1620 尺寸，重畫為「貓弓冒險檔案」，只借用參考圖的資訊架構，不複製其品牌或素材：

- 深藍黑魔法機台面板，金色細框、箭羽刻度、木質／紙靶細節。
- 頂部顯示 `CAT ARCHERY DOSSIER`、地下城與玩家／同行貓。
- 大型主成績使用本次綜合表現 `composite`（0～100）；下方顯示冒險稱號。
- 中央五軸雷達：命中、穩定、平均分、火力、探索。所有值由呼叫端提供或透過純函式 clamp 至 0～100；缺資料時安全降級。
- 大型半透明 S/A/B/C 評級置於雷達旁，不遮住標籤。
- 下方三項核心摘要依模式選擇（擊敗、最高傷害／Combo、X 內十／深度），再以小型成就章顯示額外 stats。
- 同行貓以現有透明圖像作背景浮水印或角落角色，不因圖片載入失敗阻止產圖。
- 頁尾保留 `student.catgroup.com.tw/?arcade` 與邀請文案。

新增純函式建立／正規化 dossier metrics，Canvas 測試以 mock context 驗證不拋錯與必要繪製分支；分享／下載 API 不更動。

## Rollout

1. 先建立 tokens、Shell、Player Bar、Action Dock 與契約測試。
2. 重構 onboarding 與 hub，保留所有入口。
3. 建立地下城 carousel 與三種場景主題。
4. 將 Adventure／Team／Duel 的共用表面套入戰鬥 HUD，不改邏輯。
5. 完整測試、手機視覺檢查與 production build。
6. 以純函式先完成多人 HP／全體反擊，再接 Firestore transaction 與 HUD 演出。

每一步均可獨立回退；不得用整檔覆寫方式破壞目前大量 Arcade 邏輯。
