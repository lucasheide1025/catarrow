# Implement：其他五族名稱、技能名稱與卡片美術重製（共用執行流程）

> 各族子任務共用此流程；開始任一子任務前先讀 `.trellis/tasks/07-27-remake-mountain-t1-t6-gpt-art/prd.md`、`identity-matrix.md`、`implement.md` 作為模板對照，並遵守 `docs/image-generation-workflow.md` 的 staging 邊界。

## Phase 0：盤點與身分矩陣

- [ ] grep 盤點該族全部名稱出現位置：`src/lib/monsterData.js`、`src/data/monsterExpansionCatalog.json`、`functions/data/monsterExpansionCatalog.json`、`docs/second_brain/monster-handbook.md`、`src/components/**`、`src/lib/**`。
- [ ] 從 catalog 抽出該族全部 stable ID 與現行名稱（name／signatureName／material.name），建立「現行名稱快照」存 `research/current-names.md`。
- [ ] 盤點既有美術：`public/cards/monsters/{id}.webp` 與 `public/monsters-battle/{id}.webp` 數量、尺寸、格式。
- [ ] 為每個 stable ID 建立獨立身分與命名草案，寫成 `identity-matrix.md`（沿用山林族表格：stable ID／身分類型／新名稱／視覺核心／招牌技能名／掉落素材名）。
- [ ] 確認消除既有跨階成長線（舊名如果有「幼衛→聖衛」式進化鏈必須斷開）。
- [ ] **使用者核准身分矩陣後才進入 Phase 1。**

## Phase 1：跨度校準（新種族必做）

- [ ] 依 `docs/monster-art-progression.md` 建立 `T1/T3/T6 × 普通/小王/大王` 九宮格校準批（寶藏族視結構調整），存 `.staging/image-generation/<family>-calibration/`。
- [ ] 建立聯絡表，橫向驗證 Encounter hierarchy、縱向驗證 Tier progression；女性樣本確認「漂亮＋威脅感並存」。
- [ ] 未通過不得量產；通過後才生成正式角色。

## Phase 2：卡圖生成

- [ ] 依核准身分矩陣逐隻生成 3:4 卡圖（1086×1448），先 T1/T3/T6 再補 T2/T4/T5（照山林族順序）。
- [ ] 卡圖只含角色與場景，無卡框、文字、UI。
- [ ] 建立六階卡圖總覽聯絡表，**使用者核准後**才進入戰鬥圖階段。

## Phase 3：半 Q 戰鬥圖

- [ ] 逐張以核准卡圖作 reference 生成半 Q 戰鬥圖（512×512，純色 chroma-key 背景）。
- [ ] 人形 3.5～4 頭身；純怪物放大頭部/招牌輪廓；自動拒絕比例超標輸出。
- [ ] 本機去背為透明 WebP，驗證 alpha 與殘邊。
- [ ] 建立六階戰鬥圖總覽，**使用者核准後**才進入文案與整合。

## Phase 4：文案與正式整合

- [ ] 依核准矩陣更新 `src/data/monsterExpansionCatalog.json`：`name`、`signatureName`、`signatureSummary` 前綴（機制文字不動）、`material.name`。
- [ ] 更新 `src/lib/monsterData.js` legacy 六隻（`{family}_1~6`）的 `name`。
- [ ] 同步 `docs/second_brain/monster-handbook.md` 圖鑑名稱。
- [ ] 轉成卡圖 WebP 與透明戰鬥 WebP，依 stable ID 替換 `public/` 正式資產。
- [ ] grep 確認其他顯示位置（卡片系統、戰鬥 UI、掉落介面、組隊、世界王）沒有遺漏的舊名／舊圖。

## Phase 5：驗證

- [ ] 執行 `scripts/sync-functions-monster-data.mjs` 同步 `functions/data/monsterExpansionCatalog.json`，diff 確認無漂移。
- [ ] 驗證正式資產數量、尺寸、格式、alpha（對照 `audit-static-assets.mjs` 或既有驗證流程）。
- [ ] 跑 catalog 不變量測試（`src/lib/monsterExpansionCatalog.js`、`catalogInvariants.test.js` 等）：ID 未改名、signatureName 非空。
- [ ] 跑全專案測試 + ESLint + production build。
- [ ] **使用者核准後才提交、部署。**

## Phase 6：收尾

- [ ] 逐族提交（不混多族）。
- [ ] 依使用者指示部署。
