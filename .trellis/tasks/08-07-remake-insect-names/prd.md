# 毒蟲族名稱、技能名稱與卡片美術重製

## Goal

沿用鬼怪族／山林族已驗證的獨立身份規則，重製毒蟲族全部 36 隻怪物的顯示名稱、招牌技能名稱（含 `signatureSummary` 前綴）、掉落素材名稱，以及**卡片系統美術**（卡圖＋戰鬥立繪）。名稱與美術一併重設計，兩者共用同一套世界語言。

## Confirmed Facts

- 正式資料有 36 個 stable IDs：6 階 × 每階 6 隻（3 普通、2 小王、1 大王）；legacy 6 隻為 `insect_1~6`。
- 現行名稱來源：`src/data/monsterExpansionCatalog.json`、`src/lib/monsterData.js`、`functions/data/monsterExpansionCatalog.json`、`docs/second_brain/monster-handbook.md`。
- 現行美術：`public/cards/monsters/` 36 張卡圖（1086×1448 WebP）＋ `public/monsters-battle/` 36 張戰鬥立繪（512×512 WebP），目前為舊版／佔位美術，需全部重製。
- 世界語言（取自 `07-22-local-comfyui-image-generation` 核准方向）：**華麗昆蟲幻想**——翅膀、甲殼、觸角、複眼飾品與毒素色彩；男／女人形融入昆蟲特徵，純怪物採幻想化昆蟲／蛛形／多足輪廓。
- 禁止元素：寄生、腐爛、鑽體、寫實昆蟲恐怖；名稱與美術都不得往恐怖獵奇靠。
- 現行技能名多為機制直譯佔位（如「露珠彈跳」「甲殼衝鋒」），需重製為能反映角色身份的華麗技能名。
- 本任務沿用父任務 `.trellis/tasks/08-07-remake-remaining-families-names/` 的共用規則、美術規格與執行流程。

## Requirements

- 保留全部 stable IDs、數值、技能 ID、技能機制與掉落機制；`signatureSummary` 只改「技能名：」前綴。
- 36 個彼此獨立的怪物身分，不沿用跨階角色成長；同族跨 Tier 只共享昆蟲幻想世界語言。
- 每階維持：normalA 男性或中性人形、normalExisting 漂亮成年女性、normalB 純怪物、miniA／miniB／boss 依階輪替。
- 名稱三件套同步：怪物名、招牌技能名、掉落素材名互相呼應。
- **美術**：卡圖 3:4 無框無字（Tier × Encounter 雙軸）；戰鬥立繪半 Q 3.5～4 頭身（純怪物放大頭部/招牌輪廓）；首次生成先做 T1/T3/T6 九宮格校準；全部輸出留在 `.staging/image-generation/`，validator 通過＋**使用者核准後**才提升 `public/`。
- 先建立 36 行身分矩陣（`identity-matrix.md`），使用者核准後才動資料檔與美術。

## Acceptance Criteria

- [ ] 36 組名稱完整更新（怪物名／技能名／素材名），無遺漏、無重複。
- [ ] 技能機制文字、數值、ID 零改動；catalog 不變量測試通過。
- [ ] 36 張卡圖＋36 張戰鬥立繪完成；卡圖符合 Tier × Encounter 階級差、人形半 Q 比例正確、女性角色漂亮清楚。
- [ ] staging validator 通過，美術經使用者核准後才提升 `public/`。
- [ ] 不存在跨階進化／同一角色換裝的連續感。
- [ ] 圖鑑、卡片系統與戰鬥 UI 顯示新名與新美術，grep 無舊名殘留。
- [ ] `functions/data` 與 `src/data` catalog 同步無漂移。
- [ ] 全測試與 production build 通過。

## Product Decisions

- 2026-08-07（作者指定）：原「蜘蛛女王」（`insect_5`）的怪物設定**新版必須維持女性**；身分矩陣已鎖定為「人形女・月冕蛛后」，實作與美術生成不得更改其性別設定。

## Out of Scope

- 不修改戰鬥平衡、技能倍率、怪物數值或掉落機率。
- 未經身分矩陣核准，不得修改任何名稱資料與 `public/` 美術。
