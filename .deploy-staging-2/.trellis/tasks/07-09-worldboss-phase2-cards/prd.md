# PRD：世界王 Phase 2 — R1~R6重製、專屬寶箱與卡片系統升級

## 背景

世界王系統目前只有 12 隻 Boss（教練×3、貓×3、六大族×6），Phase 1 已修好結算畫面與共同獎勵機制（見 `07-09-worldboss-settlement-phase1`）。Phase 2 要把貓貓系列從 3 隻改為對應現實 9 隻真貓、重新設計全部 18 隻王的強度曲線、新增世界王專屬寶箱與卡片，並同時把既有的「怪物卡片」裝備系統從單一 5 格改為分屬性 3+3+3 格，讓世界王卡片成為可裝備的獨立收藏品。

## Requirements

### 1. 18 隻世界王重新分類與命名
- 教練系列（3）：主教練、師母、YUMI教練 — 沿用現有名稱/稱號。
- 貓貓系列（9）：改用 `catData.js` 的 9 隻真貓（大娘/哥哥/妹妹/妞妞/哈吉/寶寶/悠悠/小安/顛顛），依 `CAT_SKILL_GROUPS` 分三組（治癒/攻擊/防禦），需要新的稱號（4字風格，仿現有 12 隻王的稱號調性）。
- 六大族系列（6）：ghost/forest/poison/office/exam/western，對應難度 R1~R6：
  R1=毒蟲之母、R2=山林守護神、R3=考試恐懼之神、R4=怨靈大君、R5=職場終極魔王、R6=古龍皇帝。

### 2. 強度數值重新設計
- 六大族 R1~R6：HP/ATK/DEF 呈等比階梯遞增（R1 最低、R6 最高）。
- 貓貓系列：定位為入門王，強度低於 R1；依三組（防禦組 HP/DEF 偏高、攻擊組 ATK 偏高、治癒組均衡）分級。
- 教練系列：定位為超越 R6 的隱藏王，強度最高。
- `rewardByHP()`（`worldBossData.js`）目前用 HP 門檻分三檔獎勵，門檻值必須跟著新數值重新校準，否則會分檔錯亂。

### 3. 專屬寶箱
- 六大族王（R1~R6）：擊殺掉落「對應族寶箱」，沿用現有 `CHEST_TYPES`（gold/epic/mythic）+ `chest.family` 機制；R1~R2→gold、R3~R4→epic、R5~R6→mythic。
- 非六大族王（教練3+貓貓9＝12隻）：新增獨立寶箱型別「世界秘寶箱」，內容含世界王專屬材料、大量金幣、世界王專屬卡片機率，不與現有寶箱池混用。

### 4. 專屬卡片系統
- 新增 18 張世界王卡片，一隻王對應一張，只能從世界秘寶箱／六大族族寶箱（機率）開出，不混入現有 `card_pack`（36怪物+8寶箱怪）抽卡池。
- 新卡片階級 `worldboss`：固定加成值（無升星機制，因重複張數幾乎不可能取得）。
- 卡片加成屬性依來源固定：
  - 六族王卡：沿用 `FAMILY_STAT`（ghost/workplace→ATK、mountain/exam→DEF、insect/temple→HP）。
  - 貓貓王卡：依 `CAT_SKILL_GROUPS`（防禦組→DEF、攻擊組→ATK、治癒組→HP）。
  - 教練王卡：玩家開出時自選一項屬性（比照現有 mythic 卡 `chosenStat` 機制）。
- 世界王卡額外被動效果（一般卡沒有）：同分類每張額外 +3%（ATK類→傷害加成、DEF類→減傷、HP類→治療/回復量加成），最多疊 3 張＝+9%。

### 5. 卡片系統裝備機制改版
- 裝備上限從「總共 5 張任意」改為「HP/ATK/DEF 各自最多 3 張」，總計最多 9 張同時裝備。
- 世界王卡與怪物卡是兩個獨立收藏池（各自的圖鑑/收藏清單），但共用同一組 HP/ATK/DEF 裝備欄位——不管卡片來源，只看它加成的屬性去佔對應欄位的格子。

### 6. 卡片系統 UI 改版（`CardCollection.jsx`）
- 已裝備區塊改為三欄（HP/ATK/DEF），每欄固定顯示 3 格（含空格佔位）。
- 篩選籤從現有階級篩選（全部/神話/首領…）改為分類籤：**全部／HP／ATK／DEF／世界王**。
- 卡片列表改為小卡片九宮格排版，取代現有橫向條列。
- 世界王卡片使用專屬的「全息卡框」視覺樣式（動態漸層邊框），底部顯示一行稱號/敘述小字，與一般怪物卡明顯區隔。

### 7. 戰鬥中的世界王卡視覺效果
- 玩家身上只要有任一張世界王卡裝備中，進入戰鬥畫面（地下城房間／組隊房間／世界王攻擊畫面）時，玩家名牌旁顯示閃亮徽章（發光/動態邊框），純視覺辨識，無額外機制。

## 限制與既有架構

- 遵守既有「self-claim」模式：世界王擊殺獎勵（含新寶箱/卡片）一律走 `claimWorldBossKillReward`（自己寫自己的 `members` 文件），不可對他人文件做迴圈寫入（見 `firestore.rules` 的 `members` 白名單限制）。
- 新增/修改任何寫入 `members` 頂層欄位的邏輯，需同步檢查 `firestore.rules` 的 `hasOnly([...])` 白名單是否要加新欄位。
- 卡片資料現況：`monsterCards.js::FAMILY_STAT` 目前漏了 `treasure` 族（寶箱族怪物卡目前吃預設 atk），這次一併補上。
- 傷害公式分散在 `damage.js` 五套（standard/duel/worldboss/dungeon counter/council），世界王卡被動效果（dmgBonusPct/dmgReducePct/healBonusPct）需要以「呼叫端多帶一個乘數參數」的方式擴充，不改動原本公式本體語意。

## Acceptance Criteria

- [ ] `WORLD_BOSSES` 有 18 筆資料，貓貓系列為 9 隻真貓（非舊有 3 隻通用貓），家族/稱號/數值皆已更新。
- [ ] `rewardByHP()` 門檻對齊新數值，18 隻王各自落在正確的獎勵檔位。
- [ ] 六大族王擊殺可正確掉落對應族寶箱（family + tier 正確）；教練/貓貓王擊殺可正確掉落世界秘寶箱。
- [ ] 世界秘寶箱開出後可產出世界王專屬卡片（機率可調），且不會混入一般 `card_pack` 池。
- [ ] `cardCollections/{memberId}` 能同時儲存怪物卡（`cards`）與世界王卡（`wbCards`），兩者互不覆蓋。
- [ ] 裝備邏輯強制「HP/ATK/DEF 各自 ≤3」，超過會拒絕並提示先卸下同分類的卡。
- [ ] 世界王卡被動效果（±3%/張，封頂9%）在對應戰鬥流程（地下城/組隊/世界王）中實際生效，可用固定種子/測試值驗證傷害數字有變化。
- [ ] `CardCollection.jsx` 顯示三欄裝備格＋分類籤（全部/HP/ATK/DEF/世界王）＋九宮格小卡片，且教練王卡開出時仍可選屬性。
- [ ] 玩家裝備任一世界王卡時，地下城/組隊/世界王戰鬥畫面的名牌旁出現閃亮徽章。
- [ ] 教練切換射手模式後，上述所有畫面不空白（既有回歸測試項目）。
- [ ] `firestore.rules` 白名單已補齊新欄位（若新欄位落在 `cardCollections/{memberId}` 這種獨立 collection，需確認該 collection 現有規則是否已足夠開放，不一定要動 `members` 白名單）。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
