# 其他五族名稱、技能名稱與卡片美術重製（父任務）

## Goal

延續鬼怪族（`07-26-remake-ghost-t1-gpt-art`）與山林族（`07-27-remake-mountain-t1-t6-gpt-art`）已完成的「**名稱＋技能名稱＋卡片美術**」全套重製模式，為其餘五族完成：

1. 怪物顯示名稱、招牌技能名稱（含 `signatureSummary` 前綴）、掉落素材名稱重製；
2. **卡片系統美術重製**——卡片圖（`public/cards/monsters/{id}.webp`）與對應的戰鬥立繪（`public/monsters-battle/{id}.webp`），替換目前各族仍在使用的舊版／佔位美術。

**一族一個子任務，逐族完成**——這是鬼怪族／山林族一路走來的既定節奏，不要一次跨多族動工。

## Background（為什麼要重製）

- 山林族 PRD 確立的規則：每個 `family × tier × slot` 都是**獨立怪物**，不存在跨階成長線（例如舊版「石角幼衛→石角聖衛」這種進化鏈必須消除）；名稱與美術必須一併重設計，名稱與圖像要對得上。
- 現行各族名稱大量沿用舊版「跨階成長／民俗舊名／隨意佔位」命名；卡片美術也還是舊版（五族各有 36 張卡圖＋36 張戰鬥圖未重製，寶藏族 24 隻另有自己的一套）。
- 生成規範以 `docs/image-generation-workflow.md`＋`docs/monster-art-progression.md` 為準：GPT 生成 → `.staging/image-generation/` → validator 驗證 → **使用者核准** → 才提升 `public/`。

## Scope

**做**：五族的（1）怪物顯示名稱、招牌技能名稱、`signatureSummary` 前綴、掉落素材名稱；（2）卡片圖與戰鬥立繪美術。只改顯示文字與美術資產。

**不做**（與山林族相同）：stable ID、戰鬥數值、技能 ID、技能機制、掉落機制、卡片 ID、收藏資料、既有玩家收藏的相容性。

## 子任務地圖

| 子任務 | 家族 | 怪物數 | 世界語言 |
|---|---|---|---|
| `08-07-remake-insect-names` | 毒蟲族（insect） | 36 | 華麗昆蟲幻想：翅膀、甲殼、觸角、複眼飾品與毒素色彩；禁止寄生、腐爛、鑽體與寫實昆蟲恐怖 |
| `08-07-remake-workplace-names` | 職場族（workplace） | 36 | 現代職場生活：辦公、契約、產線、階級 |
| `08-07-remake-exam-names` | 考試族（exam） | 36 | 校園與考試：試卷、書卷、學術、制度 |
| `08-07-remake-temple-names` | 西方怪物族（temple） | 36 | 西方奇幻：吸血鬼、狼人、龍、騎士、神話生物 |
| `08-07-remake-treasure-names` | 寶藏族（treasure） | 24（6假+6真+12王） | 冒險、鍊金與活化財寶：寶箱怪、金幣精靈、寶石獸、鎧甲守衛、鑰匙生命、黃金龍；禁止賭場／拉霸機與現代炫富語言 |

> 各族世界語言方向取自 `07-22-local-comfyui-image-generation` 的 PRD（已核准的美術方向），名稱與美術共用同一套語言。

## 共用規則（全部子任務適用，源自山林族 PRD／identity-matrix／image-generation-workflow）

### 名稱與身分

1. **獨立身份**：每隻怪物都是獨立角色，不沿用跨階角色成長；同族跨 Tier 只共享「家族級世界語言」，不共享角色。
2. **保留不變**：stable ID、數值、技能 ID、技能機制、掉落機制；`signatureSummary` 只改「技能名：」前綴，冒號後的機制文字一字不動。
3. **名稱三件套同步**：怪物顯示名稱、招牌技能名稱、掉落素材名稱三項一起改，命名要能互相呼應（參考山林族「苔帽跳童／苔石滑步／濕苔帽」）。
4. **女性角色**：名稱與美術都須對應「漂亮、成熟、臉部清楚」的設定；不以面具、腐敗或醜化暗示威脅。
5. **表格先行、核准後改碼**：先建立身分矩陣（36 或 24 行：stable ID／身分類型／新名稱／視覺核心／招牌技能名／掉落素材名），**使用者核准後**才動資料檔與美術。

### 美術（沿用山林族規格與流程）

6. **卡圖規格**：1086×1448 3:4 WebP，只含角色與場景，**無卡框、名稱、文字或 UI**；依 `docs/monster-art-progression.md` 的 Tier × Encounter 雙軸（Tier 控制材質/文明成熟度，Encounter 控制體型/構圖/壓迫感）。
7. **戰鬥立繪規格**：512×512 透明 WebP；人形採 3.5～4 頭身半 Q（頭臉約全高 25%、四肢短、手腳略放大），純怪物放大頭部與招牌輪廓 20～25%；保持與核准卡圖同一角色身份。
8. **新種族首次生成前先做校準批**：`T1/T3/T6 × 普通/小王/大王` 九宮格（或各族當量），不進產品、不用正式 ID，橫向驗證 Encounter、縱向驗證 Tier，女性樣本另驗「漂亮＋威脅感並存」。
9. **staging 流程**：所有未核准輸出留在 `.staging/image-generation/<batch>/`，附 `manifest.json`（資產 ID、provider 邊界、prompt 與 lineage、尺寸/SHA/格式/alpha、審核決策）；用 `node scripts/validate-gpt-image-staging.mjs` 驗證；**使用者核准後才提升 `public/`**。
10. **校準未通過不得量產**；正式卡圖核准後，戰鬥立繪只延續同一角色身份，不同 Tier 之間不延續身份。

## 資料來源（現行名稱與美術所在）

- `src/lib/monsterData.js` — 六族 legacy 名冊（每族 `{family}_1~6` 六隻，含 `name` 欄位）。
- `src/data/monsterExpansionCatalog.json` — 擴充名冊（含 `name`／`signatureName`／`signatureSummary`／`material.name`）。
- `functions/data/monsterExpansionCatalog.json` — 上述 JSON 的雲端同步副本（改完用 `scripts/sync-functions-monster-data.mjs` 同步）。
- `public/cards/monsters/{id}.webp` — 卡圖資產（各族 36 張；寶藏 24 張）。
- `public/monsters-battle/{id}.webp` — 戰鬥立繪資產（各族 36 張；寶藏 24 張）。
- `.trellis/tasks/07-16-monster-specialization-expansion/signature-skill-mappings.md` — 六族全技能對應表（⚠️ 規劃文件，可能與 catalog 漂移，以 catalog 為準）。
- `docs/second_brain/monster-handbook.md` — 玩家圖鑑（名稱同步更新處）。
- 模板對照：山林族 `.trellis/tasks/07-27-remake-mountain-t1-t6-gpt-art/prd.md`、`identity-matrix.md`、`implement.md`、`t2-t6-completion.md`；鬼怪族 `07-26-remake-ghost-t1-gpt-art/`。

## 跨子任務驗收標準

- [ ] 每族身分矩陣皆經使用者核准後才動名稱與美術。
- [ ] 每族名稱三件套完整更新（怪物名／技能名／素材名），技能機制文字零改動。
- [ ] 每族卡圖＋戰鬥立繪完成、staging validator 通過、經使用者核准後才提升 `public/`。
- [ ] 兩份 catalog（`src/data` + `functions/data`）同步，無漂移。
- [ ] 怪物圖鑑、卡片系統、戰鬥 UI、掉落介面顯示新名與新美術（grep 確認無遺漏舊名）。
- [ ] 每族完成後：測試全過 + production build 成功。
- [ ] 逐族提交、逐族部署（依使用者指示），不一次動五族。

## Out of Scope

- 修改任何數值、機制、掉落率、收藏 ID。
- 未經該族身分矩陣核准前，不得動任何名稱資料與 `public/` 美術。
- 移除既有美術僅因生成器退役（image-generation-workflow 安全不變式）。
