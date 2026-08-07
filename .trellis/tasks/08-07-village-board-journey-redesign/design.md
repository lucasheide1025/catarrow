# Design：探索地圖重製（7 張直線旅程地圖）

> 目標是「**旅程制 Roguelike 路線**」：7 張地圖 × 每圖一趟 seed 生成旅程 × 跨日進度。取代現行 28 格固定環形棋盤。

## 1. 資料模型（members/{id}.villageBoard）

```js
{
  dice: 15,                 // 全地圖共用（不變）
  diceGrantedDate: "YYYY-MM-DD",  // 每日補滿判斷（不變）
  maps: {
    mine:     { seed: 42001, pos: 47, length: 137, clears: 1, buffs: { campMult: 1.2, catmate: true } },
    farm:     { seed: 0,     pos: 0,  length: 0,   clears: 0 },  // 未開始 = length 0
    harbor:   { ... },
    hunting:  { ... },
    market:   { ... },
    warehouse:{ ... },
    archery:  { ... },
  },
  pendingEvent: null,       // 未結算事件（斷線保護，沿用）
}
```

- **旅程狀態**：`{ seed, pos, length, clears }`。`length===0` 表示尚未開始（進場時才生成）。
- **本趟 buff**（營地/強化/貓夥伴）存 `maps.{id}.buffs`，旅程完成時一併清空。
- ⚠️ `villageBoard.maps` 必須加進 `firestore.rules` 的 **兩個 members hasOnly 白名單**（本專案慣例）。

## 2. 路線生成（純函式，client/server 共用同一 seed）

`src/lib/boardJourney.js`（新檔，或重寫 boardData.js）：

```js
// 確定性 PRNG（mulberry32 即可，不需套件）
export function seedRandom(seed) { ... }   // 回傳 () => [0,1)

// 一次旅程的完整生成；同一 seed 恆等
export function generateJourney(modeId, seed) {
  const rnd = seedRandom(seed);
  const length = 100 + Math.floor(rnd() * 101);            // 100~200
  const cells = [TILE.start];                               // index 0 = 起點
  for (let i = 1; i < length - 1; i++) cells.push(rollTileType(rnd, modeId));
  cells.push(TILE.boss);                                    // 終點 = Boss
  const path = windingPath(length, rnd);                    // 座標序列 {x,y}
  return { modeId, seed, length, cells, path };
}

// 格子加權抽選（每張地圖可依家族調權重；事件/特殊格適量）
export function rollTileType(rnd, modeId) { ... }

// 蜿蜒幾何：水平為主、分段折返（每段 6~10 格直線、上下起伏），
// 產生 path[i] = {x, y}（單位格座標），UI 據此畫捲動地圖
export function windingPath(length, rnd) { ... }
```

- **確定性要求**：`generateJourney(seed)` 產生的 `length/cells/path` 在 client（顯示）與 server/DB（結算）必須一致。seed 存 Firestore，路線不必整包存（要存也只是一維陣列，100~200 元素，可接受但非必要）。
- `BOARD_LAYOUT` 固定 28 格移除，改為「權重表」：`TILE_WEIGHTS[modeId]`。

## 3. 獎勵與結算（沿用/擴充 boardData.js 純函式）

- `rollTileReward(tileType, ctx)` 保留為核心，新增 tile type 分支：
  - `camp`：不直接給獎勵 → 設定 `buffs.campMult = 1.2`（本趟後續資源格 ×1.2）
  - `empower`：設定 `nextShootMult = 2`（下一射箭格 ×2）
  - `catmate`：`buffs.catmate = true`（射箭完成度 +5% 上限、貓羈絆加成）
  - `trap`：後退 2 格／損失少量金幣（有下限保護）
  - `shortcut`：前進 3~5 格
  - `market`：市集選單（用村資源換 BUFF／+1 骰）——**第二期**；第一期做**佔位格**：小機率金幣＋「市集整修中」說明文字
  - `scenery`：純 flavor＋微獎勵（+1~5 金幣）
  - `boss`：終點結算（見下）
- 射箭格沿用 `scoreToBand`；挖礦（採集）改走「直接資源 + 演示」，不再吃 scoreRatio。

## 4. 採集演示（A / C 隨機）

- 踩到採集格（挖礦類）時 `Math.random() < 0.5` 選 A 或 C：
  - **A 純動畫**：`GatherDemoA`——角色揮鋤/採摘動畫 1.5~2 秒（CSS/emoji，重複使用現有風格）→ 獎勵噴出（`BoardRewardPopup`）。
  - **C 三選一**：`GatherDemoC`——3 個採集點卡片，各自顯示「內容物範圍」（如 素材×3／村資源＋20／素材×1＋箭露），選完立即結算。未選前可自由切換。
- **組隊**：採集演示要全員等待。設計：A 模式由房主執行、其他隊員顯示「等待中」；**C 三選一由各隊員自己選**——各自看到同一組 3 個採集點、各自選擇、各自結算獎勵；全部完成才繼續移動；加「15 秒自動隨機選」保護（離線不卡房）。
- 新元件 `GatherDemo.jsx`（A/C 二合一，依隨機選定渲染），單人/組隊共用。

## 5. 移動與終點

- `rollAndMove` 改吃 `maps.{mapId}`：`pos = Math.min(pos + roll, length - 1)`。
- `pos === length - 1`（終點）→ 觸發終點 Boss：射 6 箭挑戰（沿 `TargetFaceOverlay`）。
  - **沒有「打輸」**：按 6 箭完成度分帶 S/A/B/C 直接判定獎勵大小（S 最大獎），不重試。
  - 打完即完成旅程 → `clears + 1` → 更新村目標 `board_laps` → `maps.{mapId}` 重置（新 seed、pos=0、buffs 清空）→ 可重刷。

## 6. UI 重寫（CatVillageBoard.jsx）

- **地圖選單**（進入時）：7 張地圖卡片，各顯示 進度 %（pos/length）、完成次數、骰子餘額。選一張進入旅程。
- **旅程畫面**：大畫布（寬度 = length × 格寬，例如 40px/格 → 100~200 格 = 4000~8000px），`overflow-x: auto` 橫向捲動；路徑照 `path[]` 絕對定位（縱向蜿蜒）。
  - 玩家棋子定位在 `path[pos]`；捲動自動跟隨棋子（`scrollIntoView`，尊重 `prefers-reduced-motion`）。
  - 格子渲染：emoji icon（現有 `TileIcon` 擴充新類型）+ 已有 `public/assets/board/tile_*.webp`（若存在）。
- 骰子按鈕、`BoardRewardPopup`、`GatherDemo`、射箭 overlay（沿用 `TargetFaceOverlay`）。
- 怪物格/終點 Boss 立繪：沿用 `public/monsters-battle/{id}.webp`（依模式 family 抽該族怪物；或沿用現有 MonsterSVG fallback），**不新增 SVG**。

## 7. 組隊（villageBoardTeamDb 改版）

- 房間記錄 `{ hostId, modeId, seed, pos, diceLeft }`——**吃房主的 `maps.{modeId}` 旅程**。
- 隊員加入即讀房主 seed/pos 顯示同一條路線；移動/結算寫房主的旅程狀態（`pos` 由房主 session 更新，或房主代結算後 `setBoardPos`）。
- 斷線重連：房主旅程狀態在 `members/{hostId}` 本來就持久化，重連只需恢復房 + 重新顯示 `maps.{modeId}`。沿用現有 reconnect/save 模式。

## 8. 檔案變動

**改寫**
- `src/lib/boardData.js` — 移除固定 `BOARD_LAYOUT`，改權重表 + `generateJourney`/`windingPath`（或拆 `boardJourney.js`）。
- `src/lib/villageBoardDb.js` — `setBoardSession/rollAndMove/settleBoardTile` 改 per-map；`ensureDailyDice` 不變。
- `src/components/member/CatVillageBoard.jsx` — 地圖選單 + 旅程捲動地圖 + 新格子 icon。
- `firestore.rules` — members hasOnly 白名單加 `villageBoard.maps`（＋`maps.{id}.buffs`）。

**新增**
- `src/components/member/GatherDemo.jsx` — A/C 二合一採集演示。
- `src/lib/boardJourney.js`（若拆分）＋ `boardJourney.test.js`（seed 確定性、長度 100~200、終點必為 boss、權重抽選）。
- `src/lib/boardData.test.js` 擴充（新 tile 獎勵、buff 疊加）。

**沿用不動**
- `BoardRewardPopup.jsx`、`CatVillageBoardTeam.jsx`（改內部邏輯）、`TargetFaceOverlay`、`villageGoalDb.js`（board_laps hook 沿用）、`DAILY_DICE=15`。

## 9. 相容性與遷移

- 舊資料 `villageBoard.boardPos/lapCount/mode/boardSeed` 是**單一**狀態：遷移規則＝讀舊 `boardPos` 時塞進 `maps.{舊 mode}.pos`（保留一次），`lapCount` 併入該圖 `clears`；新寫入一律 per-map。`normalizeVillageBoard` 補齊 7 圖欄位（預設 `{seed:0,pos:0,length:0,clears:0}`）。
- 舊 `board_laps` 村目標：`clears` 增加時照舊 hook（`villageGoalDb.js` 的 `if count<=0 return` 判斷對應改）。

## 10. Phase 1 完成備註（2026-08-07）

- ✅ `src/lib/boardJourney.js` 新增：`seedRandom`（mulberry32）/`generateJourney`/`rollTileType`/`tileWeights`/`windingPath`/`emptyMapState`/`normalizeVillageBoard`/`JOURNEY_MAP_IDS`/`JOURNEY_SHOOTING_TILES`/`JOURNEY_DAILY_DICE`。
- ✅ `boardData.js` 擴充：TILE_TYPES 新增 8 種旅程格（camp/empower/catmate/trap/shortcut/market/scenery/boss）＋rollTileReward 對應分支。
- ✅ 測試 24 個（`boardJourney.test.js` 15＋`boardJourneyRewards.test.js` 9），全專案 1873 測全過。
- ⚠️ **採集不射箭的落地方式**：新旅程以 `JOURNEY_SHOOTING_TILES`（只有 monster/boss）判斷，**不動** `TILE_TYPES.mining.shooting`（維持 true）——那是舊版棋盤在線上用的旗標，Phase 2 換 UI 時一併處理，避免改早炸掉現行版。
- ⚠️ **Boss 獎勵分帶倍率**（測試抓到的設計修正）：原本 S/C 在同一隨機範圍滾，低分帶可能偶爾反超；現在 S ×1.5 / A ×1.0 / B ×0.75 / C ×0.5，高低帶範圍不重疊。
- 🐛 **Phase 1 踩坑**：本機 write_file 工具對 `src/` 目錄下新檔寫入失敗（.trellis/scripts 正常），改用 bash heredoc 寫入——日後新增 src 檔案若遇到相同錯誤，直接用 heredoc。
- 🔜 **Phase 2 待決（reviewer）**：① `tier`（進場選的階級）在 per-map 模型中要放哪（maps.{id}.tier 或維持全域）——現行 settleBoardTile 讀 `vb.tier`，normalize 若把 tier 丟掉會降階；② 遷移「只保留一次」要靠 DB 寫入邊界清掉舊欄位（boardPos/lapCount/mode）；③ 新格子欄位（buffs/trapBack/loseCoins/…）由 settle 消費，applyBoardReward 不會套用。

## 11. 已定案備註（2026-08-07 作者）

- 終點 Boss **無失敗**：按 6 箭分數帶 S/A/B/C 判定獎勵大小。
- 市集格第一期**佔位**（小機率金幣＋「市集整修中」說明），第二期做完整市集。
- 組隊採集 C 三選一：**各隊員自己選、各自結算**；A 模式房主執行、隊員等待。

## 分岔路口（fork）— 追加功能（2026-08-07）

- **格子**：`fork`，紫色系，低機率（權重 3）出現在旅程中段。
- **踩到**：跳出二選一預覽（不動骰子、不加骰）：
  - ⬅️ 左路穩妥：跳去**前方最近**的素材（material）／採集（mining）格
  - ➡️ 右路冒險：跳去**前方最近**的怪物格（要打 6 箭）
  - 距離差 `dist` 顯示在按鈕上；若前方 15 格內找不到目標，DB 層退回固定步數（右 4／左 2 格）
- **跳轉**：`chooseForkPath(memberId, mapId, side)`（villageBoardDb.js）→ 寫入新 pos → 若落到終點 Boss 格（`reachedBoss`）直接開 Boss 射箭，否則照常結算該格（共用 settle 路徑）。
- **純函式**：`findNextTile(cells, from, targetTypes, maxLookahead=15)`（boardJourney.js）＋測試（含 lookahead 限制、尾端找不到、防呆）。
- 組隊版：分岔路只有單人版（Phase 3 組隊待評估；組隊流程暫時不會生成 fork 格決策，可後補）。

## 統一獎勵分層分級（2026-08-07 重新規劃）

**單一真源**：`scoreToBand(scoreRatio)`（boardData.js）＋分層表 `MONSTER_BAND_TABLE`／`MINING_BAND_TABLE`。
射箭格一律用 scoreRatio（6 箭命中總分/60）判定，不再各自立門檻。

| 分帶 | 完成度（6箭命中） | 怪物資源倍率 | 怪物素材 | 怪物寶箱 | 終點Boss倍率（coins/arrowdew/catXP） |
|------|------------------|-------------|---------|---------|----------------------------------|
| S | ≥85%（≥51分） | ×2.0 | 4 | 40% | ×1.5 |
| A | ≥65%（≥39分） | ×1.4 | 3 | 25% | ×1.0 |
| B | ≥40%（≥24分） | ×1.0 | 2 | 10% | ×0.75 |
| C | <40% | ×0.6 | 1 | 0% | ×0.5 |

- **怪物格**（舊 bug）：原本「過/不過」二階（threshold 沒傳→恆過→平獎 ×1.5，S/A 分不出差別）→ 已統一四階。
- **終點 Boss**：保底 1 族系箱，S 再加 1 萬用箱；無失敗（打完即完成旅程）。
- **採集格**（不射箭，進度制 0~180%）：`MINING_BAND_TABLE` 五階——大豐收≥180 ×1.8 / 豐收≥130 ×1.5 / 完成≥100 ×1.2 / 半成品≥50 ×0.8 / 安慰獎<50 ×0.5。
  C 三選一實際產出：素材袋（material 3~6）／礦脈點（140→豐收 9~23）／混合袋（material＋100→完成 8~18）。
- **T 階級**（1~6，建築等級上限）仍是獨立軸：金幣/箭露/素材階級全乘 T；分帶是同一 T 內的技巧軸。
- **驗證**：4 個新屬性測試鎖定分層單調遞減（S>A>B>C）、素材階梯（4/3/2/1）、高階期望值>低階、採集五階標籤。

---

## 2026-08-07 追加：加成可疊加（重踩同種 buff 格累積，不是覆寫）

**玩家需求**：「加成可以累加」。

**改法**（`boardJourney.js` `mergeBuffs` 單一真源，單人/組隊共用）：
| buff | 每踩一次 | 疊加方式 | 上限 |
|---|---|---|---|
| 🏕️ 營地 campMult | 村資源 ×1.2 | **相乘**（踩兩次＝×1.44） | ×3（`MAX_CAMP_MULT`） |
| ✨ 強化 nextShootMult | 下次射箭獎勵 ×2 | **相乘**（踩兩次＝×4） | ×8（`MAX_SHOOT_MULT`） |
| 🐾 貓夥伴 catmate | 射箭分數 +5% | **相加**（層數+1，2 層＝+10%） | 5 層＝+25%（`MAX_CATMATE_STACKS`） |

**相容性**：
- catmate 舊資料是 `true`（布林）→ `Number(true)=1` 視為 1 層，`effRatio = ratio + 層數×0.05` 自然相容。
- 上限是「封頂」不是「不能疊」：超過後維持上限值。
- 上限選擇：旅程 100~200 格、營地權重 4／強化 3／貓夥伴 3，一趟期望踩到營地 ~6 次、強化 ~4.5 次——無上限會變成 ×2^4.5≈22 的射箭獎勵（失衡），所以封頂。改上限時同步改 `JOURNEY_BUFF_INFO` 文案與 `MAX_*` 常數。

**顯示**：
- chips／toast 顯示**累計值**（`資源 ×1.44`、`下次打怪/決戰 ×4`、`射箭 +10%`）。
- 說明彈窗「啟用中」徽章顯示目前疊層（`buffValueLabel`），文案改「每踩到一次…再…可疊加（最多…）」。
- 完成旅程時 buffs 清空（`{}`）＝疊加歸零。

---

## 2026-08-07 追加：階級鎖定（選好 T 幾就固定到走完地圖）

**玩家需求**：「地圖選擇好T幾後 就要固定好 一直到走完地圖」。

**規則**：`lockedJourneyTier(mapState, pickedTier)`（`boardJourney.js` 純函式）——
- `length > 0`（旅程已開走，含完成後自動重開的新一趟）→ **鎖定既有 tier**，新選值一律忽略；
- 未開始（length=0）→ 用新選值；
- 進行中但舊資料沒記 tier（遷移前）→ 接受新選並從此鎖定（相容舊帳號）。

**改動**：
- `startJourney`（單人 DB）：續走分支改用 `lockedJourneyTier`，不再覆寫 tier（第二道防線）。
- `CatVillageBoard.jsx` 地圖選單：進行中的地圖卡片顯示「T{n}・進行中」徽章＋進度 X/Y；選到進行中地圖時②階級區**改顯示鎖定 T**（禁用按鈕），按鈕改「🎲 繼續 … T{n} 旅程」；點地圖時 `setSelTier(lockedJourneyTier(...))`。
- 組隊：`create()` 開房吃 `lockedJourneyTier`（房主 profile 快照含 villageBoard.maps）；lobby 進行中地圖同樣鎖定顯示；`startBoardRoom` **把鎖定 tier 寫回 room.tier**——以前不寫，房主有進行中旅程但 lobby 重選 T 時，獎勵會用錯的 room.tier（reward/claim 都吃 room.tier），這是這次順手修掉的隱性 bug。

**注意（08-07 更新）**：完成旅程（Boss 打敗）後**回地圖選單讓玩家重選 T**——boss 分支寫入的 `tier` 改為 `0`（未鎖定），`lockedJourneyTier` 自然接受新選（與舊資料 tier=0 同一條路）；選單顯示「進行中・待選 T」徽章＋階級選擇器。單人版 Boss 完成後**跳回選單**（有獎勵 popup 就等它關閉再跳，避免 popup 被選單蓋住）；組隊版房間持續進行（同房間新一趟沿用 room.tier 保證獎勵一致），房主 `maps.tier=0` → **下次開房在 lobby 重選**。

---

## 2026-08-07 追加：強化加乘持久化（骰子用完不消失）＋挖礦/採集動作動畫

**玩家需求**：
1. 「玩家的強化加乘不應該在骰子沒有了就消失 要保持到結束 或是達成效果」
2. 「挖礦沒有挖礦的感覺 採集素材沒有採集素材的感覺 用生成圖片做點動作動畫」

**① 強化加乘持久化（組隊版 bug 修復）**

- **單人版本來就持久**：buff 存在 `members/{uid}/villageBoard/maps.<mode>.buffs`，只有 Boss 完成才清、強化打完下一個射箭格才消耗——骰子用完 buff 照留。✅ 不需改。
- **組隊版是 bug**：`roomRollAndMove` 以前只把 `pos` 寫回房主 doc，**room.buffs 沒同步回房主**；`startBoardRoom` 開新房又 `buffs:{}` 重來——骰子用完、房間解散，buff 就跟著房間一起消失。
- 修法（`villageBoardTeamDb.js` 三處）：
  1. `startBoardRoom` 續走分支：`buffs = m.buffs || {}`（把上一個房間累積的加成帶過來），寫回 host doc 與 room；
  2. `roomRollAndMove`：踩到 buff 格時 `patch.buffs` 同步寫回房主 `maps.<mode>.buffs`；
  3. `finalizeBoardShoot` 怪物分支：強化消耗後 `consumedBuffs = { ...room.buffs, nextShootMult: null }` 同步寫回房主——避免下次開房把已消耗的強化當「幽靈加成」復活（null 在 `Number(null)=0` 下正確視為未啟用）。

**② 挖礦/採集動作動畫（ComfyUI 生成）**

- **42 張動作幀**：7 族（mine/farm/harbor/hunting/market/warehouse/archery）× 2 動作（dig 挖礦/gather 採集）× 3 幀，輸出 `public/assets/board/action_<mapId>_<dig|gather>_<1..3>.webp`。
- 管線沿用 `gen-journey-tiles.py`：DreamShaperXL_Turbo @ 127.0.0.1:8188 → rembg 去背 → 512×512 透明 WebP；`scripts/gen-action-frames.py`（背景批次）。
- **GatherDemo.jsx 重寫**：`variant` prop——`"mining"`＝挖礦（A 純動畫或 C 三選一隨機），`"material"`＝採集素材（固定 A 快速動畫）。三幀 crossfade 循環、進度條、完成 ✨；`onError` 兜底（圖片缺幀時隱藏不破版）。
- **CatVillageBoard.jsx**：`gather` state 改 `null|"mining"|"material"`——**採集素材格以前直接結算、沒有演示**，現在跟挖礦一樣開動作動畫；`gatherDone` 依 variant 對應 `settleAt("material")` / `settleAt("mining", { miningChoice })`。

**⚠️ 注意**：
- 動作幀只有「資源隨族主題」不同，動作本身 7 族共用同一套（舉鋤/揮鋤/收穫）——不要單族重繪，除非玩家覺得資源辨識度不足。
- `GatherDemo` 的 `ASSET` 基準路徑是 `public/assets/board/`（跟 tiles 不同目錄），新增族別時確認幀檔名對得上 `action_<mapId>_<action>_<n>.webp`。
- 組隊版採集演示**需要接線**（本次補上）：房主/隊員看到 `pendingSettle.tileType` 為 mining/material 時開同一組件，`onDone` 才送 claim——組隊的採集格也要有「動手」感覺；房主 buff 寫回房主 doc 是單向同步——組隊時單人版地圖選單的 buff chip 也會正確顯示累計值（因為組隊吃的就是同一份房主 maps.buffs）。

**組隊版採集動畫接線（補記）**：`CatVillageBoardTeam.jsx` 的 claim effect 攔截 mining/material——同一 seq 第一次開 `GatherDemo`（`auto` 強制 A 動畫，組隊結算無三選一回傳通道），`gatherAnimRef={seq,done}` 防止快照重跑重開/提前 claim，動畫完成或「跳過動畫（直接結算）」後才送 claim；**7 秒 watchdog** 強制收場（背景分頁節流/裝置卡頓時防止全隊卡死——組隊卡死是全隊災難，既有 retry 機制救不了「claim 根本沒送出」）。`GatherDemo` 新增 `auto`/`cancelLabel`/`zIndex` props（單人版預設值不變，維持 50/50 A/C）。

---

## 2026-08-07 追加：怪物格改用採集任務障礙＋骰子 1~15

**玩家需求**：
1. 「怪物的部分沒有去撈舊版原先的採集任務中的那些怪物 而是去抓取冒險遊戲中的怪物出來用 這在探索地圖有點奇怪」
2. 「修改骰子可以擲出1~15點」

**① 怪物格＝採集任務障礙（COUNCIL_MONSTERS）**
- 探索地圖怪物格原本用 `pickFamilyMonster`（monsterData.js 的冒險遊戲角色怪物立繪）——採集場景出現「鏡幕幽姬」這種冒險角色很突兀。
- 改吃 **議會廳採集同一套 COUNCIL_MONSTERS 生活障礙**（入口碎石堆／礦道積水／雜草叢生…）：`getObstacleForTier(mapId, tier)`（councilMonsters.js 新匯出，tier 數字→字串 clamp）。
- **archery（寶箱族／藏金靶場）原本缺組**（councilMonsters 只有六建築）——補齊 6 階障礙（靶心脫漆/弓弦鬆弛/機關卡鎖/金庫鎖死/靶場斷電/龍守金庫），七張地圖都有障礙可用。
- 射箭介面：障礙 emoji（text-5xl）＋bgColor 底色＋名稱標籤＋🛠️ action 描述（「堵住礦道入口」）；**終點 Boss 也顯示該族 boss 障礙**（礦坑＝「頂板裂縫」）。
- 移除兩個 JSX 檔的 thin wrapper，直接呼叫 getObstacleForTier；MONSTERS/TIER_ORDER import 一併移除（JOURNEY_MAP_META 仍保留給 GatherDemo meta）。

**② 骰子 1~15**
- `rollDice()`（boardJourney.js）改 `1 + floor(random*15)`；組隊 roomRollAndMove 統一用它（原獨立 inline 1~6）；兩處骰子動畫跳數字同步 1~15。
- ⚠️ **舊 28 格棋盤 rollAndMove 維持 1~6**：28 格環形用 1~15 會狂繞圈；旅程（100~200 格直線）才是 1~15 的適用場景。
- 平衡：100~200 格旅程約 7~27 擲走完，每日 15 骰＝約 1~2 趟/天（1~6 時代擲 15 顆也不太動，這是玩家要改的原因）。

**測試**：councilMonsters.test.js 新建（5 測：7 點×6 階完整性含欄位、tier 對應、超界 clamp、未知點 null、七地圖可用）＋boardJourney.test.js 補 rollDice（mock 邊界 1/15＋2000 採樣範圍）。

**注意**：COUNCIL_MONSTERS 現在 7 組、COUNCIL_BUILDINGS 仍 6 筆——目前無迭代配對兩者（GatheringBattle 用建築 id 單點取用，archery 不可達），若日後有人成對迭代要記得補 COUNCIL_BUILDINGS。

---

## 2026-08-07 追加：強化格新增「多骰」效果（一次擲 2/3 顆骰子）

**玩家需求**：「新增強化格可以增加一次骰出2顆骰子或3顆骰子的功能」。

**強化格效果池**（`rollTileReward("empower")`，boardData.js）：
- 50% → 下次射箭格獎勵 ×2（`nextShootMult`，疊加如舊）；
- 25% → 下一次擲骰骰 **2 顆**骰子（`diceCount=2`）；
- 25% → 下一次擲骰骰 **3 顆**骰子（`diceCount=3`，一次移動距離大增）。

**擲骰消費**（單人/組隊同一套）：
- 新純函式 `rollJourneyDice(count)`（boardJourney.js）：count 夾在 1~3，回傳 `{ rolls[], total }`（每顆 1~15）。
- 單人 `rollJourney`：`diceN = m.buffs?.diceCount || 1`；移動＝多顆總和；用完 `deleteField` 清 `maps.buffs.diceCount`；回傳 `rolls`。
- 組隊 `roomRollAndMove`：**消耗要先算**——`consumedBuffs = { ...room.buffs, diceCount: null }` 餵給 `landingPatch`，避免「踩到新 buff 格時舊 diceCount 被併回、下次擲骰幽靈生效」；沒踩新 buff 格時寫回 room＋房主 doc。
- **已有就疊加**（08-07 玩家再要求「當玩家已經有該加成後則是疊加上去」）：`mergeBuffs` 對 `reward.diceCount` **相加**、上限 `MAX_DICE_COUNT=4`（2+2=4 顆骰＝一次 4~60 步，一趟 1/3 左右，夠刺激；3+2=5 夾到 4）。`rollJourneyDice` clamp 跟著用 MAX_DICE_COUNT。`nextShootMult` 與 `diceCount` 可並存（各自獨立效果）。

**UI**：
- 骰子動畫定格顯示每顆（`8+12`，多骰時縮字 text-4xl）；buff chips 加「🎲 下次擲 N 骰」；buffHelp 彈窗加多骰卡（JOURNEY_BUFF_INFO 第 4 筆）；單人/組隊 toast 都顯示實際抽到的效果（兩者並存就都顯示）。
- 地圖選單卡片的進行中 buff chips 自動吃 JOURNEY_BUFF_INFO（4 筆），無需額外改動。

**測試**（+6）：rollJourneyDice 邊界/clamp/500 採樣、mergeBuffs 覆寫與 clamp、buffValueLabel/buffActive diceCount、JOURNEY_BUFF_INFO 4 筆、empower 效果池 mock 鎖定 50/25/25、舊測試改效果池語意。

**注意**：組隊 toast 顯示的是「疊加後」的 room.buffs（若先前已累積 nextShootMult 又抽到多骰，兩者都會列出）——與既有 camp toast 語意一致（顯示目前效果，非僅本次新增）。

---

## 2026-08-07 終點 Boss 決戰重做（BossDuel）

**背景**：終點 Boss 原本與普通怪物共用同一個小射箭面板（6 格分數＋一顆「結算」按鈕），
「打 Boss 的感覺」完全沒有。玩家要求整個重做。

**新流程（三階段全螢幕演出，單人/組隊共用 `BossDuel.jsx`）**：
1. **登場**（1.7s）：⚠ 終點・BOSS 現身 ⚠ 警示＋Boss 大圖（採集障礙 emoji＋族色底＋震動＋紅光暈）＋
   「T{tier}・決戰開始/全員出戰」徽章。
2. **決戰**：Boss 血條（HP 100%＝6 箭完成度）＋9 鍵計分盤（X/10/9/8/7/6/5/3/M）＋6 箭槽。
   每箭命中**血條即時扣血**（hit 逐箭更新，hpColor 綠→黃→紅）。滿 6 箭按「🎯 攻擊 Boss！」。
3. **討伐成功**：血條 0.9s 動畫扣到底＋傷害數字跳動＋sfxSuccess，停留 1.6s 後交分；
   顯示 `{band} 級討伐`（S 金/A 綠/B 青/C 灰）＋「不會輸，獎勵依討伐等級」。

**規則**：
- `bossDuelState(score60)` 純函式（boardData.js）：ratio=clamp(score/60)、血條剩餘 HP=100−ratio×100、
  downed=ratio≥0.85、分帶直接吃 `scoreToBand`（**同一張表，不另立門檻**）。
- 交分後仍走**既有 settle 路徑**（單人 `settleAt("boss", {scoreRatio})`、組隊
  `submitBoardShootScore`）——BossDuel 只換掉輸入 UI，結算/重置邏輯零變動。
- 組隊：全員各自射 6 箭（血條是大家的，各自畫面上各自扣）；交分「確認寫進去」才收 UI。

**防呆**：無 skip 按鈕（reviewer 擔憂的雙重結算不存在）；`finishRef`＋`disabled(arrows<6)`
保證 onFinish 只帶滿 6 箭、只觸發一次。

**驗證**：1916 測全過（+2 bossDuelState：0/60 邊界、85% 倒下臨界、與 scoreToBand 各帶邊界
同表、越界防呆）＋build 成功。

---

## 2026-08-07 動作幀去背修正（rembg 誤刪貓）

**問題**：玩家檢視挖礦/採集動作動畫時發現——rembg 去背把**貓的部位也一起刪掉**了
（貓毛色與場景背景相近時 rembg 誤判為背景）。

**修正**：42 張動作幀全部改用 **ComfyUI 原圖**（`E:\AI\ComfyUI_windows_portable_nvidia\
ComfyUI_windows_portable\ComfyUI\output\board_action_*.png`，依 mtime 一一配對），
**不再去背、不再 crop**——原圖本身就是場景圖（角色＋資源＋背景），直接縮放 512×512 輸出。
驗證：全部 42 張透明像素比例 = 0。

**渲染相容性**：GatherDemo 用 `<img>`＋`object-cover`＋深色漸層容器——原圖含背景直接填滿
不突兀，UI 零變動。

**腳本同步**：`gen-action-frames.py` 的 `cut_and_save` 移除 rembg 呼叫（保留 PIL 縮放），
註解標明「⚠️ 不去背：rembg 會誤刪貓」。日後重跑生圖不會再犯。

**踩坑提醒**：rembg/任何自動去背對「毛茸茸生物＋相近色背景」不可靠——這類資產寧可
保留原圖背景（場景圖），也不要自動去背。

---

## 2026-08-08 🃏 抽卡房格子（探索地圖內新增，踩到才有）

**背景**：玩家要求探索地圖新增「抽卡房」——不是選單入口，是**旅程中的格子**，踩到才觸發。

**規則**（玩家拍板）：
- 免費抽 1 張（不花錢）／付費抽 3 張（金幣 3000，`CARD_GACHA_PAID_PRICE`）——每踩到一次
  免費 1 次＋付費 1 次；踩過 pos 就前移，天然不重複，不需 DB 記錄次數。
- **階級綁定**：在 T1 地圖踩到就是抽 T1 卡（tierIndex === T）。
- **池＝該 T 階級普通怪卡**（`CARD_CATALOG` filter encounter==="normal" && tierIndex===T，
  每階 21 張＝7 族 × 3 隻）——**小王/大王/世界王不進池**（用戶明確要求）。
- 入帳走既有 `addMonsterCard`（重複卡自動累計 duplicates 供升星）。

**實作**：
- `boardCardGacha.js`（純邏輯單一真源）：池選取/抽 1 張/抽 N 張/cardToMonsterCard/cardToView/計價。
- 單人 `CatVillageBoard.jsx`：settle() 攔截 cardgacha → 開 `CardGachaRoom` overlay
  （choose→rolling→result 三階段、CardArtImage 卡面翻轉、免費/付費按鈕、返回地圖鈕）。
  DB：`claimCardGachaFree`（免費入帳）／`claimCardGachaPaid`（spendCoins 3000＋3 張入帳）。
- 組隊 `CatVillageBoardTeam.jsx`：landingPatch 一般格分支已涵蓋 → 每人 claim 時
  `claimCardGachaTeamFree` **自動免費抽 1 張**（組隊結算自動化，付費留單人互動），
  reward 帶 `cardGachaViews` → 專屬結果 popup（關閉時 ackStep）。
- 權重 cardgacha:2（稀有格）；TILE_FX/tileBg 紫系。

**踩坑提醒（reviewer 抓到）**：
- ⚠️ **組隊 claim 新分支一定要寫 settleClaims**——組隊 cardgacha 早回分支若漏寫，
  重整/斷線重連會再 claim 一次（重複領卡），且房主的「全員領完清 pending」讀這欄位會卡等。
  新格子接到 claimBoardSettle 時，跟一般格一樣把 settleClaims 寫掉再 return。
- ⚠️ 抽卡 overlay 的 choose 階段要有「返回地圖」鈕——沒有的話不想抽的玩家卡死在 overlay。
- ⚠️ doRoll 的 await 要包 try/catch——呼叫端 reject 時回到 choose，不能卡死在 rolling。
- ⚠️ 付費抽卡要「先扣錢再入帳」；池空時退錢（目前每階都有 21 張，防呆用）。

**驗證**：+7 測試（boardCardGacha：池形狀/越界/mock 抽卡/卡片格式/計價）＝全專案 **1923 測全過**＋build 成功。

---

## 2026-08-08 格子動作演示全面重做（TileDemo）＋陷阱多事件

**需求**：採集動畫太快要放慢；挖礦要有動畫但不要三選一；寶箱要有「挖到寶箱」的動畫展示；箭露也要；陷阱要有多種不同事件。

**改了什麼**
- **GatherDemo → TileDemo（新檔，舊檔刪除）**：單一元件吃 variant 四種格子：
  - `mining` 2.6s／`material` 2.2s（ComfyUI 三幀，節奏全面放慢）；
  - `chest` 2.4s（CSS：搖晃→爆開放射＋開箱音）／`arrowdew` 2.2s（CSS：水滴升起收集）。
  - **三選一機制移除**——挖礦/採集不再有 C 選擇，動畫播完直接 `onDone()` 結算。
- **陷阱多事件**（`boardData.js` 純函式 `rollTrapEvent`/`trapEffectOf`，5 種）：
  - 🐍 蛇咬（退 1＋扣金幣）／🟤 流沙（退 3＋扣箭露）／🥷 竊賊（退 1＋扣較多金幣）／
    🎲 骰子被偷（退 2＋少 1 顆骰）／💧 箭露灑了（退 2＋扣箭露）。
  - 單人：`settleJourneyTile` 依事件移動＋扣資源（下限保護）；組隊：房主擲骰時抽一次事件
    （`trapType` 帶進 pendingSettle），全員 claim 用同一個事件（不各自重抽）。
- 單人/組隊 `settle()` 對 chest/arrowdew 也開 TileDemo；trap toast 帶事件名 icon。
- 挖礦結算改「完成」帶（gatheringProgress:100 → ×1.2）；`miningChoice` 保留給舊版棋盤。

**驗證**：1925 測全過（+2 陷阱多事件測試）＋build 成功。

**踩坑提醒**
- ⚠️ **TileDemo 完成後 onDone 的延遲也要進 cleanup**：不然玩家在最後 250ms 按取消，
  元件卸載後 pending timeout 仍觸發 onDone → 單人版把已取消的格子又結算一次（reviewer 抓到）。
- ⚠️ **組隊陷阱事件要由房主「抽一次」帶進 pendingSettle**——若成員各自 `rollTileReward("trap")`，
  全員會看到/領到不同事件（各自重抽）；`trapType` 是 shared event 的單一真源。
- ⚠️ 組隊的 `loseDice` 事件不扣任何人骰子（骰子是房主的，成員 claim 端管不到）——設計上
  組隊陷阱懲罰只含金幣/箭露，骰子事件在組隊是「較弱版」，可接受。
- ⚠️ 挖礦預設結算從「隨機三選一」改固定「完成」帶，是**輕微 buff**（期望值略升）——
  三選一移除是玩家明示需求，資源期望變高是合理的代償。
