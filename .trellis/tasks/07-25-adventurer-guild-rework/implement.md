# 執行計畫 — 冒險者公會重生

> 四期，每期獨立可上線。先玩法後包裝。全程守「公會戰力與主線隔離」。

## 前置：研究與模組骨架
- [ ] 讀 `src/components/member/AdventurerGuild.jsx`（現況，將被獨立模組取代）。
- [ ] 研究 `archerLevel.js`（怎麼取射手等級/加成當公會戰力輸入）與貓貓陪練（`useCatCompanion`/貓戰力）如何帶入。
- [ ] 研究 `src/zombie/`：backpackEngine（補給純函數可否直接 import）、`ZombieMapIsometric`/`ZombieBattleArena`（2.5D 鳥瞰做法借鏡）、DDD 分層結構。
- [ ] 建 `src/guild/` 模組骨架（比照 zombie：`domain/`、`data/`、`ui/`、`db/`）。入口決定（`?guild` 隱藏網址 or MemberApp 分頁；先隱藏測試）。

## P1：委託遠征核心玩法（獨立戰鬥 + 補給）
- [ ] `src/guild/domain/`：`rollExpedition`（隨機怪陣容 by client/danger）、`expeditionFlow`（逐 wave 狀態機）、`guildStats`（**六維 HP/ATK/AGI/DEF/VIT/LUK** = 射手等級+貓+公會裝）、`settleExpedition`。
- [ ] **公會自己的 2.5D 鳥瞰戰鬥**（`src/guild/ui/`）：等距戰場、距離倒數、手動選目標(≤4)、貓貓上場；重用 `damage.js`/`score.js` 與殭屍 `processRound`，**不嵌 MonsterBattle**。
- [ ] 背包/補給：重用 `backpackEngine`；推進途中**多重事件**各自消耗食/水；食或水歸零→減益升級→耗盡**強迫撤退**；出發前備包畫面（裝備+補給 vs 負重，VIT 影響）。
- [ ] 失敗處理（陣亡/補給耗盡撤退 → 委託失敗，當天鎖同一張）。
- [ ] 委託板（大廳）→ 接委託 → 出發 → 逐 wave 2.5D 戰鬥 → 凱旋回報。
- **驗證**：接委託→連打 N 場 2.5D 戰鬥→補給消耗→全勝結算/失敗有後果；主線完全不受影響；`CI=true` build 過。

## P2：階級系統重做
- [ ] `src/lib/guildRank.js`：`repToRank`/`rankUnlocks`/`nextRankRep`（新聲望階級表）。
- [ ] 廢除舊 `RANKS.mult` 公會金幣加乘與舊等級升級意義（舊欄位保留不刪）。
- [ ] 完成遠征給 `guildRep`；聲望達標升階；階級 gate 危險委託上限 + 商店層級。
- [ ] 稱號 / 冒險者證(可分享卡) / 獨占外觀解鎖。
- **驗證**：完成遠征→聲望↑→升階→解鎖更高危險委託；主線數值不受影響。

## P3：怪物・掉落・裝備・經濟（貓村×打怪核心，隔離）
### 怪物與掉落
- [ ] 怪物**沿用打怪數值** + 造 **2.5D 俯視 sprite**；建 `src/guild/data/` **獨立公會 loot 表**（不與主線混）。
- [ ] 掉落內容：通用材料(打怪/貓村用) + 雜貨(收藏品) + 公會裝機率 + CAT幣素材。
### 公會專屬裝備（隔離）
- [ ] `src/guild/domain/guildStats.js`：`calcGuildExpeditionStats`（**六維**，僅遠征用）。
- [ ] **5 槽（弓/箭/護具/箭袋/藥水袋）× 6 品級** + 強化；儲存 `members/{id}.guildEquip`；裝備有 `weight`（與補給爭背包容量）。
- [ ] 取得：遠征打怪/開寶箱機率掉 + 公會商店（花 CAT幣）。
### 經濟・CAT幣
- [ ] 雜貨帶回**評估價值** → 金幣 + **CAT幣**（LUK 影響價值）；新欄位 `members/{id}.catCoins`。
- [ ] 公會商店：CAT幣兌換材料 / 買公會裝 / 特殊用途。
- [ ] 通用材料寫回**打怪/貓村共用庫存**（回饋主線經濟）。
- **驗證（關鍵）**：`grep` 佐證 `guildEquip`/`calcGuildExpeditionStats`/六維 **未被** MonsterBattle/dungeonDb/partyDb/worldBoss/constants.calcArcherStats 引用；主線 build 與數值不變。

## P4：大廳 / NPC / 故事 / 美術
- [ ] `scripts/gen-guild-*.py`（ComfyUI）：大廳底圖、公會長貓、委託單、階級徽章×6、冒險者證、公會裝圖示、戰利品。逐張 QA。
- [ ] 公會畫面重構成大廳；公會長貓 NPC 依階級對話；委託單呈現故事+☠️星等+隨機陣容預覽。
- [ ] 「出發→回報」小儀式。
- **驗證**：味道到位；教練射手模式不白屏；訪客不崩。

## 收尾（每期完成都要）
- [ ] `firestore.rules` 補新欄位白名單 → **提醒老闆貼 Console**。
- [ ] 更新 `docs/second_brain`（game-systems 公會章節重寫、changelog）+ 同步 Obsidian。
- [ ] 教練射手模式回歸測試。
- [ ] commit（每期一個）。

## Rollback
- 每期獨立 commit；公會為獨立分頁，P1-P3 出問題可單獨 revert 該期，不影響主線（因隔離）。
