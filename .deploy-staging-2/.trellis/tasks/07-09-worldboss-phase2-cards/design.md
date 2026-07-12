# Design：世界王 Phase 2 — R1~R6重製、專屬寶箱與卡片系統升級

## 1. 世界王資料（`src/lib/worldBossData.js`）

### 1.1 `WORLD_BOSSES`（12 → 18 筆）

保留 `coach` 家族 3 筆（`head_coach`/`wife`/`yumi`，數值/稱號不動）。
移除 `cat_orange`/`cat_black`/`cat_white`，改為 9 筆 `cat_<catId>`（catId 取自 `catData.js::CAT_IDS`），`family:"cat"`，並新增 `catGroup: "heal"|"atk"|"def"`（取自 `CAT_SKILL_GROUPS`）供卡片屬性與稱號分組使用。
六大族 6 筆數值全部更新，並新增 `rTier: 1~6` 欄位（供 UI 顯示「R1」「R6」標籤與寶箱等級判斷）。

數值表（HP/ATK/DEF）：

| Key | family | HP | ATK | DEF | 備註 |
|---|---|---|---|---|---|
| cat_haji | cat/atk | 180,000 | 105 | 45 | |
| cat_baobao | cat/atk | 195,000 | 112 | 48 | |
| cat_xiaoan | cat/atk | 210,000 | 118 | 52 | 注意：xiaoan 屬 `def` 群組（見下方修正） |
| cat_meimei | cat/heal | 175,000 | 78 | 50 | |
| cat_gege | cat/heal | 190,000 | 82 | 55 | |
| cat_daming | cat/heal | 200,000 | 85 | 58 | |
| cat_niuniu | cat/def | 220,000 | 70 | 68 | |
| cat_youyou | cat/def | 235,000 | 75 | 72 | |
| cat_diandian | cat/def | 250,000 | 78 | 78 | |
| poison_boss (R1) | poison | 280,000 | 95 | 55 | |
| forest_boss (R2) | forest | 340,000 | 115 | 65 | |
| exam_boss (R3) | exam | 400,000 | 135 | 75 | |
| ghost_boss (R4) | ghost | 470,000 | 155 | 85 | |
| office_boss (R5) | office | 550,000 | 175 | 95 | |
| western_boss (R6) | western | 650,000 | 200 | 110 | |
| yumi | coach | 750,000 | 190 | 100 | |
| wife | coach | 900,000 | 215 | 115 | |
| head_coach | coach | 1,100,000 | 240 | 130 | |

> **實作前需核對**：`CAT_SKILL_GROUPS` 實際分組是 `niuniu/haji/baobao = atk`、`youyou/xiaoan/diandian = def`、`daming/gege/meimei = heal`（來自 `catData.js`）。上表分組欄位需以此為準，實作時直接讀 `CAT_SKILL_GROUPS[catId]` 決定 `catGroup`，不要手動謄寫避免抄錯。

貓貓稱號（4字風格，草案，PM 可在實作前再微調文字但不影響機制）：
- niuniu（攻擊/裁判）→「精準判官」
- haji（攻擊/夢幻）→「夢遊突擊」
- baobao（攻擊/黏人）→「弓袋霸主」
- youyou（防禦/銳利）→「慢步鷹眼」
- xiaoan（防禦/膽小勇敢）→「顫爪不退」
- diandian（防禦/神秘）→「暗影觀氣」
- daming（治癒/霸氣老大）→「萬箭之母」
- gege（治癒/溫柔大哥）→「引路橘光」
- meimei（治癒/活潑）→「逐箭橘影」

### 1.2 `rewardByHP()` 門檻重新校準

現行三檔門檻（700000 / 400000 / 其餘）要改成對齊新的 18 隻分布。改用明確分檔取代純 HP 門檻，避免未來改動使門檻失準：

```js
const REWARD_TIER_BY_FAMILY = {
  coach: "top",                    // 3 隻教練
  cat:   "entry",                  // 9 隻貓
};
const REWARD_TIER_BY_RTIER = { 1:"low", 2:"low", 3:"mid", 4:"mid", 5:"high", 6:"high" };

function getRewardTier(boss) {
  if (boss.family === "coach") return "top";
  if (boss.family === "cat")   return "entry";
  return REWARD_TIER_BY_RTIER[boss.rTier] || "mid";
}
```
`rewardByHP(hp)` 呼叫處全部改為 `getRewardByBossKey(bossKey)` 內部改查 `getRewardTier`，五檔（entry/low/mid/high/top）取代原本三檔，數值维持現有量級的相對比例，entry 檔比原本「弱檔」再低一階（因為貓貓王現在比六族最低還弱）。

## 2. 專屬寶箱（`src/lib/itemData.js`）

新增 `CHEST_TYPES.wb_relic`：
```js
wb_relic: { id:"wb_relic", name:"世界秘寶箱", icon:"🗝️", color:"#facc15", potionChance:0,
  desc:"只有世界王才會掉落的稀世寶箱！開啟後獲得世界王專屬材料、大量金幣，並有機率開出世界王專屬卡片。" }
```
`openChestContents()` 新增分支：`chest.type === "wb_relic"` → 呼叫新函式 `openWorldBossRelic()`，回傳 `{ materials:[wbMaterial], coins, wbCards:[...] }`（`wbCards` 陣列走機率，可能是空陣列）。

六大族王寶箱不新增型別，沿用 `gold`/`epic`/`mythic`，只是在 `worldBossDb.js` 授獎時依 `rTier` 決定：`rTier<=2 → gold`、`<=4 → epic`、`<=6 → mythic`，`chest.family` 設成該族 key（`poison`/`forest`/.../`western`，注意這裡對照的是 `monsterData.js::FAMILIES` 用的族名 `insect/mountain/exam/ghost/workplace/temple`，需要一個 `WB_FAMILY_TO_DUNGEON_FAMILY` 對照表做轉換，因為 `worldBossData.js` 現有 family key 跟 `monsterData.js` 的 6 族 key 不完全同名（`poison`↔`insect`、`forest`↔`mountain`、`office`↔`workplace`、`western`↔`temple`，`ghost`/`exam` 同名）。

## 3. 世界王專屬卡片

### 3.1 卡片定義來源
新檔案 `src/lib/worldBossCards.js`，匯出 `WB_CARDS`（18 筆，key＝bossKey，對齊 `WORLD_BOSSES`）：
```js
{ head_coach: { bossKey:"head_coach", name:"主教練", icon:"👨‍🏫", title:"永恆弓聖",
    flavor:"傳說從未被任何射手擊敗過的男人。", statMode:"choose" }, // 教練=玩家自選屬性
  cat_niuniu: { bossKey:"cat_niuniu", name:"妞妞", icon:"🐱", title:"精準判官",
    flavor:"黑白分明，做事一板一眼。", statMode:"fixed", stat:"atk" }, // 貓=固定
  poison_boss: { bossKey:"poison_boss", name:"毒蟲之母", icon:"🐛", title:"蟲族女王",
    flavor:"夏天箭場的真正老大。", statMode:"fixed", stat:"hp" }, // 六族=沿用 FAMILY_STAT
  ... }
```
六族王卡 `stat` 直接抄 `FAMILY_STAT`（`monsterCards.js`）對照到的值（`insect→hp` 對應 poison_boss 等），寫成常數不用動態查表，避免執行期依賴順序問題。

### 3.2 `monsterCards.js` 擴充
```js
export const FAMILY_STAT = {
  ghost: "atk", mountain: "def", insect: "hp",
  workplace: "atk", exam: "def", temple: "hp",
  treasure: "atk", // 補上遺漏的寶箱族（修正既有 bug）
};

export const TIER_CARD_BONUS = {
  ...現有 6 檔,
  worldboss: { base: 25, perStar: 0, label: "世界王", color: "#facc15", bg: "#fffbeb" },
};

export const MAX_EQUIPPED_PER_STAT = 3; // 取代 MAX_EQUIPPED_CARDS
```
`calcCardBonus()` 對 `worldboss` 階級固定回傳 `base`（`perStar:0` 使公式自然忽略星級，不用另外特判，且升星 UI 因 `(card.stars||1)<5` 判斷加一個 `card.tier!=="worldboss"` 條件直接隱藏升星區塊）。

`calcEquippedBonus()` 擴充回傳被動百分比：
```js
export function calcEquippedBonus(equippedCards = []) {
  const bonus = { hp: 0, atk: 0, def: 0, dmgBonusPct: 0, dmgReducePct: 0, healBonusPct: 0 };
  for (const card of equippedCards) {
    const stat = card.chosenStat || card.stat || FAMILY_STAT[card.family] || "atk";
    bonus[stat] += calcCardBonus(card.tier, card.stars || 1);
    if (card.tier === "worldboss") {
      if (stat === "atk") bonus.dmgBonusPct += 0.03;
      if (stat === "def") bonus.dmgReducePct += 0.03;
      if (stat === "hp")  bonus.healBonusPct += 0.03;
    }
  }
  return bonus;
}
```
呼叫端（各戰鬥元件目前解構 `{hp,atk,def}`）不受影響，多出的欄位在還沒接上前是安全的死欄位。

### 3.3 卡片收藏儲存
`cardCollections/{memberId}` 新增 `wbCards: { [bossKey]: { bossKey, name, icon, title, flavor, tier:"worldboss", stat, chosenStat?, ts } }`。
`db.js` 新增：
- `addWorldBossCard(memberId, bossKey, chosenStat)`（`statMode:"choose"` 的教練卡在開出當下就要求 UI 選好 `chosenStat` 再呼叫；`statMode:"fixed"` 直接用 `WB_CARDS[bossKey].stat`）——不做 duplicate 累加，因為一隻王只有一張，重複開到就視為「已擁有」直接跳過/轉材料（沿用既有「已擁有轉換」模式，比照 `drawRandomCat` 的 unowned 過濾邏輯）。
- `equipCard(memberId, cardKey, source)`：`source: "monster"|"wb"`。內部讀 `cards[cardKey]`（monster）或 `wbCards[cardKey]`（wb）取得該卡 `stat`，查目前 `equipped` 陣列中「解析出同 stat 的卡片數量」（要同時查兩個池才能算總數），`>=3` 則回傳 `{ok:false, reason:"HP/ATK/DEF 分類已滿 3 張"}`。`equipped` 陣列元素格式改為 `{key, source}` 物件（取代原本純字串 `monsterId`），避免 `wb_` 前綴字串解析容易撞名的風險，且明確表達來源。
- 既有 `equipped` 是字串陣列，這次改成物件陣列屬於**破壞性欄位格式變更**——遷移策略：讀取時若元素是字串（舊格式）一律視為 `{key: str, source:"monster"}`，寫入時一律寫新格式，不用寫遷移腳本（漸進式相容讀取即可）。

## 4. 傷害/治療公式接入被動效果（`damage.js`）

不改動既有函式簽章的預設行為（避免動到既有呼叫點全部要改），改用「可選第 4/5 參數，預設 1（無加成）」的方式：

- `calcRoundDamage(arrows, atk, def, dmgBonusPct = 0)` → 最終 `dmg = Math.max(1, Math.round(base * pMult * mult * (1 + dmgBonusPct)))`。
- `calcWorldBossArrowDmg(score, myATK, bossDef, participantBonus = 1, dmgBonusPct = 0)` → 同樣乘上 `(1+dmgBonusPct)`。
- 受到傷害的地方（`calcStandardCounter`/`calcWorldBossCounter`/`calcDungeonCounter`/`calcPartyCounter`）新增可選參數 `dmgReducePct = 0`，回傳前 `base *= (1 - dmgReducePct)`。
- 治療量的地方不在 `damage.js`（在 `dungeonDb.js::processDungeonRound` 與 `partyDb.js::processPartyRound` 內聯計算），改法：這兩處目前的 `heal = Math.round(maxHP*0.15*scorePct)`，套用玩家自己的 `healBonusPct`（來自自己的 `calcEquippedBonus`）→ `heal *= (1+healBonusPct)`。

呼叫端（`DungeonBattleRoom.jsx`/`PartyBattleRoom.jsx`/`WorldBossAttack.jsx`）在算自己回合傷害前，先用 `calcEquippedBonus(myEquippedCards)` 取得 `dmgBonusPct/dmgReducePct/healBonusPct`，帶進對應函式呼叫。三個檔案都已經有 equippedCards 相關 state（現有卡片加成邏輯已經在用），只是多帶兩個欄位進函式呼叫。

## 5. `CardCollection.jsx` UI 重寫

- `collection` state 擴充讀 `wbCards`；`cardList` 合併兩個來源（monster + wb），每筆加 `source` 標記。
- 篩選籤陣列改為 `["all","hp","atk","def","wb"]`；篩選邏輯：`hp/atk/def` 用 `getCardStat(card)` 比對，`wb` 用 `card.source==="wb"`。
- 已裝備區塊改成三個 `<div>` 區塊（HP/ATK/DEF），各自 `.slice(0,3)` 並補空格佔位（`Array(3-count).fill(null)` 畫虛線格）。
- 卡片列表容器從 `flex flex-col` 改成 `grid grid-cols-3 gap-2`，每張卡片 `aspect-[3/4]` 直式小卡（icon 置中大字、下方名稱+階級色條）。
- `source==="wb"` 的卡片套用全息邊框（`background: linear-gradient(...)` + CSS `@keyframes` 位移動畫做漸層流動感），卡片底部多一行 `flavor` 小字（`text-[9px] italic`）。
- 裝備/卸下呼叫改帶 `{key, source}`。

## 6. 戰鬥畫面世界王卡徽章

- 新增共用小元件 `src/components/shared/WorldBossCardBadge.jsx`：純展示，`equipped.some(c=>c.source==="wb")` 為真時渲染一個 `👑` 發光徽章（CSS `animation: pulse-glow`）。
- 掛載點：`DungeonBattleRoom.jsx`、`PartyBattleRoom.jsx`、`WorldBossAttack.jsx` 的玩家名牌旁（三處都已有渲染「自己/隊友名稱」的位置，插入徽章即可，不需要新的資料流——直接讀該玩家的 `equippedCards` 判斷來源）。

## 7. `worldBossDb.js::claimWorldBossKillReward` 接線

擊殺結算時依 `boss.family` 分支：
- `family==="coach" || family==="cat"` → 授予 `wb_relic` 寶箱（機率/數量沿用現有 `unified` 分層邏輯的量級）。
- 其餘（六族）→ 授予對應族的 `gold/epic/mythic` 寶箱（`chest.family` 用 `WB_FAMILY_TO_DUNGEON_FAMILY` 轉換後的 6 族 key）。
不動既有 self-claim 寫入模式（只寫自己的 `members`/`chestInventory` 文件）。

## 8. 風險與待確認

- `equipped` 陣列格式從字串改物件是這次唯一的資料相容性風險，設計上採漸進式相容讀取，不需要遷移腳本，但實作時要在 `equipCard`/`unequipCard`/`calcEquippedBonus`/`CardCollection.jsx` 四處都處理好新舊格式判斷。
- 貓貓稱號文字是草案，PM 可在實作 PR review 時直接改字串，不影響其他邏輯。
- `WB_FAMILY_TO_DUNGEON_FAMILY` 對照表要在實作時明確列出（`poison→insect, forest→mountain, office→workplace, western→temple, ghost→ghost, exam→exam`），避免掉錯寶箱族。
