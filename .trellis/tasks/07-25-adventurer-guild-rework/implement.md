# 執行計畫 — 冒險者公會重生

> 四期，每期獨立可上線。先玩法後包裝。全程守「公會戰力與主線隔離」。

## 前置：研究與模組骨架
- [x] 讀 `src/components/member/AdventurerGuild.jsx`（現況；現行入口已由獨立模組取代，舊檔保留）。
- [x] 研究並串接射手等級與真實貓咪資料作為公會戰力輸入。
- [x] 研究 survival／2.5D 做法；最終採公會獨立的補給與戰鬥 domain。
- [x] 建 `src/guild/` 模組骨架（`domain/`、`data/`、`ui/`、`db/`），正式接入會員與教練射手模式。

## P1：委託遠征核心玩法（獨立戰鬥 + 補給）
- [x] `src/guild/domain/`：`rollExpedition`（隨機怪陣容 by client/danger）、`expeditionFlow`（逐 wave 狀態機）、`guildStats`（**六維 HP/ATK/AGI/DEF/VIT/LUK** = 射手等級+貓+公會裝）、`settleExpedition`。
- [x] **公會自己的 2.5D 鳥瞰戰鬥**（`src/guild/ui/`）：等距戰場、距離倒數、手動選目標(≤4)、貓貓上場；重用 `damage.js`/`score.js` 與殭屍 `processRound`，**不嵌 MonsterBattle**。
- [x] 背包/補給：出發前備包（裝備與補給共用負重、VIT 增加容量）；每回合消耗食水；清波觸發迷路／天候／陷阱／休息泉事件；補給完全耗盡強迫撤退。單人與組隊共用同一套事件規則。
- [x] 補給經濟：食物／飲水用主線金幣購入並累積於 `guildProfiles.supplyStock`；每趟自動各裝 6 份並扣庫存，不足時阻止出發且導向商店；組隊取消準備／離房會退回預留補給。
- [x] 公會領地：以獨立場景呈現補給倉庫、農地、供水站；三棟皆有 20 級、跨級施工時間、階級上限、五個主體外觀階段與逐級裝飾變化。
- [x] 建設經濟：以 CAT 幣支付升級；農地／供水站按真實離線時間累積低量產出，Lv20 每週各 30 份（5 趟份量），讓集中遊玩者仍需用主線金幣購買補給。
- [x] 階級試煉：聲望只解鎖晉升任務，不自動升階；固定使用現有怪物陣容，失敗消耗補給但不占每日委託額度，可立即重試。
- [x] 失敗處理（陣亡/補給耗盡撤退 → 委託失敗，**勝敗都把該委託當天結案**，見 guildContracts）。
- [x] 委託板 → 接委託 → 出發 → 逐 wave 2.5D 戰鬥 → 凱旋回報（`GuildBoard` 2026-07-25 完成；大廳底圖/公會長貓仍待美術）。
- **驗證**：接委託→連打 N 場 2.5D 戰鬥→補給消耗→全勝結算/失敗有後果；主線完全不受影響；`CI=true` build 過。
- ✅ 委託板已於 2026-07-25 補上，`?guild` 的預設入口已改成委託板（不再是三顆危險度按鈕）。

## P1.5：持久化（獎勵真的入帳）✅ 2026-07-25
- [x] 新集合 `guildProfiles/{memberId}`（CAT幣/聲望/equipped/stash/junkSeen/expeditions）——選獨立集合而非 members 欄位，理由：不動 members 兩份 hasOnly 白名單、隔離更乾淨。
- [x] `domain/guildRewards.js` 純函數（normalize/applyLoot/換裝，13 測試）＋ `db/guildDb.js` 只做 I/O。
- [x] 回饋主線：金幣 → `members.coins`（increment）、材料 → `materialInventory`（`ghost_t3`→`ghost_m3`）。
- [x] `ui/GuildStash.jsx` 倉庫換裝；`GuildTestApp` 接 `useAuth`（未登入仍可離線試玩不寫庫）。
- [x] `firestore.rules` 加 `guildProfiles` block → **待老闆手動貼 Console**。
- **驗證**：34 測試全過、`CI=true` build 過、`grep -rn "guild/" src` 僅 App.jsx 路由（隔離佐證）。

## P2：階級系統重做 ✅ 2026-07-25（稱號/分享卡除外）
- [x] `domain/guildRank.js`（放公會模組內不放 `src/lib`，維持隔離）：`repToRank`/`nextRankInfo`/`rankUnlocks`/`canAcceptDanger`/`repNeededForDanger`。
- [x] 廢除舊 `RANKS.mult`：**新階級零戰力加成**，測試斷言階級表不得有 `mult`/`atk`/`hp`。
- [x] 完成遠征給聲望（危險度×10，存 `guildProfiles.rep`）；階級 gate 危險度上限 + 商店層級（UI 鎖住仍顯示「差X聲望」）。
- [x] 公會商店（本來排 P3，跟階級一起做才有意義）：`data/guildShop.js` + `domain/guildShopPurchase.js` + `ui/GuildShop.jsx`，CAT幣買主線材料/公會裝。
- [x] 稱號 / 冒險者證：稱號解鎖與配戴、雜貨圖鑑、9:16 冒險者證 PNG 分享／下載已完成；階級徽章與公會長外觀依階級呈現。
- **驗證**：完成遠征→聲望↑→升階→解鎖更高危險委託；主線數值不受影響。

## P3：怪物・掉落・裝備・經濟（貓村×打怪核心，隔離）
### 怪物與掉落
- [x] 怪物依族系／危險度建立公會遠征數值與 2.5D 顯示；`src/guild/data/guildLootTable.js` 為獨立 loot 表。
- [x] 掉落內容：通用材料（打怪／貓村用）+ 雜貨（收藏品）+ 公會裝 + CAT幣。
### 公會專屬裝備（隔離）
- [x] `src/guild/domain/guildStats.js`：`calcGuildExpeditionStats`（**六維**，僅遠征用）。
- [x] **5 槽（弓/箭/護具/箭袋/藥水袋）× 6 品級** + 強化／分解；儲存於隔離的 `guildProfiles`；裝備重量與補給共用容量。
- [x] 取得：遠征掉落／寶箱機率 + 公會商店（花 CAT幣）。
### 經濟・CAT幣
- [x] 雜貨帶回**評估價值** → 金幣 + **CAT幣**（LUK 影響價值）；CAT 幣存於隔離的 `guildProfiles`。
- [x] 公會商店：CAT幣兌換材料／購買公會裝。
- [x] 通用材料寫回**打怪／貓村共用庫存**（回饋主線經濟）。
- **驗證（關鍵）**：`grep` 佐證 `guildEquip`/`calcGuildExpeditionStats`/六維 **未被** MonsterBattle/dungeonDb/partyDb/worldBoss/constants.calcArcherStats 引用；主線 build 與數值不變。

## P4：大廳 / NPC / 故事 / 美術
- [x] `scripts/gen-guild-*.py`：大廳底圖、公會長貓、委託單、階級徽章×6、區域、角色與戰利品資產已產生；仍待實機逐張 QA。
- [x] 委託單呈現故事+☠️星等+獎勵預覽；大廳底圖、公會長貓 NPC 與階級對話已整合。
- [x] 「出發→回報」小儀式與升階橫幅已完成。
- **驗證**：味道到位；教練射手模式不白屏；訪客不崩。

## 收尾（每期完成都要）
- [x] `firestore.rules` 已加入 `guildProfiles`／`guildTeamRooms`；**尚未部署，需老闆明確要求**。
- [ ] 更新 `docs/second_brain`（game-systems 公會章節重寫、changelog）+ 同步 Obsidian。
- [ ] 教練射手模式回歸測試。
- [ ] commit（每期一個）。

> 2026-07-27 的完整完成度、設計差異與安全風險見 `audit.md`。

## Rollback
- 每期獨立 commit；公會為獨立分頁，P1-P3 出問題可單獨 revert 該期，不影響主線（因隔離）。
