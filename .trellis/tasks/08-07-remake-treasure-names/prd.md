# 寶藏族名稱、技能名稱與卡片美術重製

## Goal

沿用鬼怪族／山林族已驗證的獨立身份規則，重製寶藏族怪物的顯示名稱、招牌技能名稱（含 `signatureSummary` 前綴）、掉落素材名稱，以及**卡片系統美術**（卡圖＋戰鬥立繪）。名稱與美術一併重設計，兩者共用同一套世界語言。

## Confirmed Facts

- 寶藏族結構特殊（非 6 階 × 6 隻）：共 **24 個 stable IDs**，全部在 `src/lib/monsterData.js`：
  - 6 隻「假」寶箱怪：`treasure_1~6`（common～mythic，現名如 寶箱怪／黃金寶箱怪／鑽石寶箱怪／祕銀寶箱怪／遠古寶箱怪／神話寶箱怪）；
  - 6 隻「真」寶箱怪：`treasure_1_real~6_real`（現名如 安分寶箱怪／安分黃金寶箱怪…）；
  - 12 隻王：`treasure_king_small_1~6` ＋ `treasure_king_big_1~6`（每階小 King、大 King）。
- 現行美術：`public/cards/monsters/` 與 `public/monsters-battle/` 各有 24 張對應資產（含 12 王＋各階 normal_b／mini_b 等），目前為舊版／佔位美術，需重製。
- 寶藏族不出現在一般六族隨機池，是隱藏地下城（獎勵農場）專屬；名稱與美術重製不得影響 `drawTreasureMonsterPool`／`drawTreasureKing` 等抽選邏輯（ID 不動即可）。
- 世界語言（取自 `07-22-local-comfyui-image-generation` 核准方向）：**冒險、鍊金與活化財寶**——寶藏獵人、鑑定師、鍊金術師、收藏家、探險者、珠寶工匠、寶庫守護者；純怪物可為寶箱怪、金幣精靈、寶石獸、鎧甲守衛、鑰匙生命、黃金龍或活化神器。
- 禁止元素：賭場／拉霸機與現代炫富語言。
- 「假」與「真」寶箱怪的命名要能一眼分辨（現行「安分」前綴即為此目的，可保留此機制但換新詞）。
- 本任務沿用父任務 `.trellis/tasks/08-07-remake-remaining-families-names/` 的共用規則、美術規格與執行流程。

## Requirements

- 保留全部 stable IDs、數值、技能 ID、技能機制與掉落機制；`signatureSummary` 只改「技能名：」前綴（有 signature 的才改）。
- 24 隻彼此獨立的怪物身分；假／真／王三類的命名規則清楚分群。
- 王級名稱與美術需反映「該階最大量體與支配感」（小 King vs 大 King 要有層級感）。
- 名稱三件套同步：怪物名、招牌技能名（若有）、掉落素材名互相呼應。
- **美術**：卡圖 3:4 無框無字（Tier × Encounter 雙軸，王怪需有壓迫感構圖）；戰鬥立繪半 Q 3.5～4 頭身（純怪物放大頭部/招牌輪廓）；校準批按寶藏族結構調整；全部輸出留在 `.staging/image-generation/`，validator 通過＋**使用者核准後**才提升 `public/`。
- 先建立 24 行身分矩陣（`identity-matrix.md`），使用者核准後才動資料檔與美術。

## Acceptance Criteria

- [ ] 24 組名稱完整更新（怪物名／技能名／素材名），無遺漏、無重複。
- [ ] 技能機制文字、數值、ID 零改動；寶箱族抽選邏輯不受影響。
- [ ] 24 張卡圖＋24 張戰鬥立繪完成；假／真／王三類美術一眼可辨；小 King 與大 King 層級感清楚。
- [ ] staging validator 通過，美術經使用者核准後才提升 `public/`。
- [ ] 圖鑑、卡片系統與戰鬥 UI 顯示新名與新美術，grep 無舊名殘留。
- [ ] `functions/data` 與 `src/data` catalog 同步無漂移（寶藏怪若有進 catalog）。
- [ ] 全測試與 production build 通過。

## Out of Scope

- 不修改隱藏地下城的掉落、獎勵倍率或抽選邏輯。
- 未經身分矩陣核准，不得修改任何名稱資料與 `public/` 美術。
