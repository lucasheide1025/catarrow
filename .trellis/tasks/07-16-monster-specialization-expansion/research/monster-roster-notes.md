# C2 — 怪物名冊 + 材料目錄草案 notes

> 產物：`monster-roster-draft.json`（252 隻）、`material-catalog-draft.json`（252 材料）、`generate-roster.js`（確定性產生器）。
> 全部由 `generate-roster.js` 生成；scheme 要調整就改腳本重跑，**不要手改 JSON**。
> 唯讀研究，未碰 `src/`。

## 產生結果（已驗證）
- 怪物 252 = 一般 126 + 小王 84 + 大王 42（7 族 × 6 Tier × (3+2+1)）。
- 材料 252 = 一般 126 + 小王 84 + 大王 42（每怪 1 專屬材料）。
- **60 隻既有 ID 全保留**（標 `existing:true`）；唯一性 + 每怪 materialId 交叉引用驗證通過。

## ID 命名 scheme（保留舊 ID）
- 一般怪：既有 1.0 錨點 `{family}_{n}`（保留）；新增 A(0.8) `{family}_{n}_na`、B(1.2) `{family}_{n}_nb`。
- 小王：A `{family}_{n}_ma`、B `{family}_{n}_mb`。
- 大王：`{family}_{n}_bk`。
- `n` = tierIndex 1..6（common..mythic）。
- **寶箱族特殊保留**：`treasure_{n}`（標準=1.0）、`treasure_{n}_real`（被動怪→一般A）、`treasure_king_small_{n}`（→小王A）、`treasure_king_big_{n}`（→大王）；只新增被動缺的 B 線小王 `treasure_{n}_mb` 與一般 B `treasure_{n}_nb`。

## 數值公式（PRD 59-61）
- 一般 A/存/B = 錨點 ×0.8 / ×1.0 / ×1.2（HP/ATK/DEF 同倍）。
- 小王 A = ×(HP1.3/ATK1.5/DEF1.3)、小王 B = ×(HP1.5/ATK1.3/DEF1.5)、大王 = ×(HP1.7/ATK1.5/DEF1.6)。
- 錨點 = 現有 `{family}_{n}` 一般怪數值。變體(weak/strong)倍率由現有 `VARIANT_CONFIG` 之後再套（本表為基準值）。

## 命名 scheme（草案品質，待潤色）
- 一般怪：既有名保留；新 A/B = `既有名·幼` / `既有名·猛`（明確標弱/強變體）。
- 王怪：PRD 147 進化系譜基名 [小王線A, 小王線B, 大王線] + Tier 階段前綴 `見習/初階/精銳/強權/王階/傳說`。例：`精銳·巡夜燈使`。
- 說明文字目前為模板，需潤色成兒童友善敘事。

## 材料 scheme（1 種 → 3 種/族·Tier）
- 一般材料：中間（1.0）沿用既有 `{family}_m{n}`；新增 `_a`/`_b`。`convertible:true`。
- 王怪材料：小王 `{family}_km{n}_a|b`、大王 `{family}_bm{n}`，`convertible:false`（PRD：王怪素材不可轉換）。
- 卡片：每怪 1 張，`cardId = monsterId`（現有卡片由 `FAMILY_STAT`+`TIER_CARD_BONUS` 程序推導，不需獨立卡表）。
- 美術：`artKey = monsterId`。

## 技能欄位（佔位，待 C3）
- 每怪帶 `sharedSkills`（一般1/小王2/大王2 佔位）、`signatureSkill: sig_{id}`、大王另有 `phasePassive` 佔位。實際技能定義在 C3。

## ⚠️ 待 Codex / 使用者拍板（影響全 scheme）
1. **已解決 — 42 vs 60 落差**：實際 monsterData 有 **60 隻**（寶箱族已含被動怪6+小王6+大王6），使用者已確認改為「既有60、新增192」，PRD與正式名冊均已更新。
2. **寶箱族映射**：本草案把 `treasure_{n}_real`(被動,atk:1) 當一般怪A（保留 atk:1，標 `passive:true`，不套 0.8）；現有 `寶箱小王/大王` 通用名 → 是否改用 PRD 147 的 `秘庫守衛/寶石魔偶/王冠寶庫王` 系譜名（會變更顯示名，但 ID 不變、不影響收藏識別）？
3. **既有材料升級鏈**：舊 `{family}_m{n}` 有 `upgradesTo`(5:1 同族升級)。新增的 `_a/_b` 材料與王怪材料的 `upgradesTo`/轉換資格待定（PRD：王怪材料不可轉換、一般同族 5:1）。
4. **命名/敘事潤色**：目前系統化生成，非最終文案。

## 交棒下一批
- C3（共用+招牌技能 catalog）可接著做，會回填本草案的 `sharedSkills`/`signatureSkill` 佔位。
- C6（完整性測試）待 schema（本 notes + C3）定案後，把這裡的驗證邏輯正式化成測試。
