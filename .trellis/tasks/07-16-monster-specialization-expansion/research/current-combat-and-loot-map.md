# C1 — 現有戰鬥／掉寶／強化系統盤點 + DLC 風險評估

> 作者：Claude（射手表現線之外的協作研究）
> 目的：給 Codex 做怪物專精 DLC 的風險參考評估。
> 方法：唯讀研究，未改任何 `src/`。已驗證項附 `file:line`；未深讀者明確標「⚠️ 待 Codex 深查」。

---

## 0. 研究範圍與深度

- **已細讀**：`monsterData.js`、`monsterConfig.js`、`monsterRegistry.js`、`lootTable.js`、`monsterMaterials.js`、`equipData.js`（結構+抽樣）；`partyDb.js` 的 `processPartyRound` / `storeBattleRewards` / `claimBattleReward`；`MonsterBattle.jsx` 發獎段；`WorldBossAttack.jsx` 存檔段。
- **僅掃函式簽章、未逐行驗證冪等**：`dungeonDb.js`（`processDungeonRound` / `claimDungeonReward` / `ensureChestRoomLoot`）、`expeditionDb.js`、`expeditionTeamDb.js`、`duelDb.js`。→ **⚠️ 待 Codex 深查地下城與遠征的重連/冪等細節**。

---

## 1. 現有資料層盤點（DLC 擴充基準）

### 怪物 `monsterData.js`（749 行）
- **60 隻**：六個一般族系各 6 隻（共 36 隻），寶箱族另有標準怪、特殊／被動怪、小王與大王各 6 隻（共 24 隻）。族：`ghost/mountain/insect/workplace/exam/temple/treasure`。
- Tier 6 階：`common/rare/elite/fierce/boss/mythic`。
- 條目 shape：`{ id, family, tier, name, icon, hp, atk, def, desc }` — **無任何技能欄位**（技能是全新系統）。
- 變體：`monsterConfig.js VARIANT_CONFIG` weak/normal/strong/boss 套 hp/atk/def/掉落倍率。

### 技能 → 目前不存在
- 全專案無 ability/signature/skill catalog；monsterData 零技能欄位。PRD 的 12 共用 + 252 招牌 + 共享 resolver + 五模式 adapter **全為新建**。

### 掉寶（分散 4 檔）
- `monsterConfig.js`：`TIER_DROP_CONFIG`、`MONSTER_SPECIAL_DROPS`、`DUNGEON_ITEM_POOL`(6族)、`COIN_CHEST_TIERS`(6階)。
- `monsterRegistry.js`：`FAMILY_LOOT`、`rollFamilyMaterial`、`rollBattleLoot`。
- `lootTable.js`：`rollCoins`、`rollMaterialDrop(s)`、`CARD_CHANCE_BY_MODE`、`COIN_CHEST_CHANCE_BY_MODE`、模式倍率(novice/student/veteran/match)。
- `monsterMaterials.js`：`MATERIALS`、`drawMaterial`、`getMaterialDropCount`。材料命名 `{family}_{m1..m6}`（每族每 tier **只有 1 種**一般素材）。

### 強化 `equipData.js`（375 行）
- 裝備 `member.equipment[slot]={itemId,grade,plusLevel}`；grade `common→rare→elite→epic→legend→mythic`，plus 0–4，+5 升品級。
- `EQUIP_UPGRADE_COST`（金幣，**legend 6500 / mythic 13000**，PRD 要提到 12000/30000）、`KING_SEAL_BREAKTHROUGH_COST`（王之印記突破）。
- 材料 `generateRandomMats` 六族隨機交叉，存 `member.rpgEquip[slot].nextMats`；`_PLUS_MAT_COUNTS` 曲線。
- `equipmentRuneData.js`：符文系統。**無專精（specialization）系統**（9 專精全新）。

---

## 2. 現有戰鬥權威模型（關鍵風險來源）

| 面向 | 現況 | 佐證 |
|---|---|---|
| 權威 | **客戶端權威**：傷害/掉寶在瀏覽器算，`addCoins`/`addChests` fire-and-forget 寫入 | `MonsterBattle.jsx:961-998`（`.catch(()=>{})`） |
| 冪等 | **薄弱**：`claimBattleReward` 先 `addChests` 才 `arrayUnion(rewardClaimed)`，**未先檢查是否已領** → 重連/重播/雙擊可能**重複發獎** | `partyDb.js:836-851` |
| 回合結算 | `processing` 旗標當鎖，但 **read→write 非交易**、有競態窗；`calcDmgFn` 由 client 傳入 | `partyDb.js:446-459` |
| 世界王 | **localStorage + bot 模擬**（`_saved.roundIdx`、`bot.atkMult`），**非伺服器權威回合** | `WorldBossAttack.jsx:266,276` |
| 五模式 | 單人/組隊/地下城單/組/世界王**各一套重複結算**，無共享 resolver | `MonsterBattle` inline vs `partyDb.processPartyRound` vs `dungeonDb.processDungeonRound` vs WorldBoss localStorage |
| 交易 | `runTransaction` 只用在 7 檔的部分操作，**戰鬥發獎主路徑多未包交易** | grep：booking/db/duel/dungeon/expeditionTeam/party |

---

## 3. 現況 → PRD 落差

| 面向 | 現在 | DLC 目標 | 落差 |
|---|---|---|---|
| 怪物 | 42（每 tier 1隻） | 252（每 tier 3一般+2小王+1大王），保留舊 42 ID | 資料 +210，且結構改 |
| 技能 | 無 | 12 共用 + 252 招牌 + 共享 resolver | 全新建 |
| 一般素材 | 每族每 tier 1 種 | 每族每 tier 3 種 + 王怪不可轉換專屬素材 | 材料表重構 |
| 強化 | 品級+plus，隨機材料 | +9 專精(欄位型,失敗率)、提高金幣、王怪素材需求 | 加新系統 |
| 轉換 | 無 | 同 tier 轉換 + 同族 5:1 升級 + 王房獎勵箱 | 全新經濟 |
| 權威/冪等 | 客戶端權威、薄弱冪等 | 伺服器權威、once-only、重連一致 | **最大落差** |

---

## 4. 可行性分級

- 🟢 **低風險**：純資料擴充（怪物/卡/材料/專精數值/掉寶轉換表）。吻合現有 data-driven + client-side 計算，可獨立驗證。
- 🟡 **中風險**：技能系統（共享 resolver + 五模式 adapter），需新抽象層把五套重複邏輯收斂成一套。
- 🔴 **高風險**：伺服器權威 + 交易冪等 + 世界王回合重連一致性。與現況落差最大，世界王近乎重寫（localStorage bot → 伺服器權威回合）。

---

## 5. 風險登記

1. **架構落差（最高）**：PRD 的 once-only／重連一致，現有客戶端權威達不到；世界王尤甚。
2. **重複發獎放大**：現有領獎無去重 guard（`partyDb:836`），DLC 加更多獎勵來源會放大既有 bug。
3. **遷移零破壞**：60 隻既有怪/卡/材料 ID + 玩家背包/裝備必須完整保留（PRD 硬性）。
4. **規模完整性**：252×(招牌+共用) 唯一 ID、交叉引用（怪↔技↔材↔卡↔圖）需自動完整性測試（C6）。
5. **效能**：252 卡 UI 需分組懶載入（PRD 禁一次平鋪）；本機快取讀寫壓力。
6. **平衡**：專精曲線 + 經濟（3-4 月養成）需模擬驗證（C5）。
7. **五模式一致性**：一套 resolver 要同時服務單/組/地下城單/組/世界王；最難為組隊 party 破解聚合 + 世界王個人回合語意。

---

## 6. 好處

1. **內容深度**：42→252 + 專屬素材 + 招牌技能 → 戰術辨識、收集慾、重玩性大增。
2. **養成節奏**：專精 + 提高高階成本 → 拉長生命週期，避免速通空虛。
3. **清架構債**：趁機把五模式收斂成共享 resolver + 權威結算，長期維護成本與 bug 面大幅收斂。
4. **教學連結**：靶紙正規化破解（不寫死 9 分）、高品質命中 → 與射箭教學綁更緊。
5. **舊庫存保值**：材料轉換讓舊素材持續有用。

---

## 7. 建議

- 照 PRD 內部順序：**完整資料 → 完整性測試 → 共享引擎 → 逐模式接入 → 寶箱/卡片**。
- **戰鬥權威/交易/世界王重連歸 Codex 單一 owner**（PRD 亦如此建議），跨五模式風險最高。
- Claude 可安全承接的低風險批次：**C2 名冊草案、C5 經濟模擬、C6 完整性/不變量測試**（皆 research/tests，不碰 production 戰鬥邏輯）。
- **關鍵先決策**：本次是否把「客戶端權威 → 伺服器權威/冪等」一起做。
  - 不做 → 世界王 once-only／重連一致無法達成，需降規格。
  - 做 → 工程與風險大幅上升，但一次清掉重複發獎架構債。
  此決策決定整個 DLC 規模與時程，建議 Codex + 使用者先拍板。

---

## 8. 待深查（交棒 Codex）

- `dungeonDb.js` `processDungeonRound` / `claimDungeonReward` / `ensureChestRoomLoot` 的實際冪等與重連處理。
- `expeditionDb.js` / `expeditionTeamDb.js` 的遠征（=地下城？）獎勵冪等與 `claimTeamExpeditionResult` 去重。
- 各模式對「重連後只領一次」的真實保證強度（現有 `rewardClaimed`/`rewardPending` 機制是否足以支撐 PRD 的唯一戰鬥 ID 冪等）。
- BOSS 房生成保底的冪等記錄點（PRD 要求唯一房間/戰鬥 ID）。
