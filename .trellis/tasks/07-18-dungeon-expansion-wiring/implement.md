# Implement — 地下城接線：中途樓層擴充怪物池＋招牌技能引擎

## Phase A：中途樓層擴充怪物池
- [x] A1 新增 `src/lib/dungeonExpansionMonsters.js`：難度→Tier 池、`drawDungeonFloorMonsters`（flag 分流）、單隻補怪函式；`monsterExpansionAdapter` export 變體倍率函式供共用。
- [x] A2 單元測試 `dungeonExpansionMonsters.test.js`：各難度 Tier 正確、全部 `encounter==="normal"`、王不入池、treasure 族、flag off fallback 回舊表、變體倍率套用。
- [x] A3 接線 `DungeonExpedition.jsx`（startFloor＋fallback）與 `TeamExpeditionBattle.jsx`（4 個呼叫點）。
- [x] A4 `npm test` 綠。

## Phase B：招牌技能接進地下城
- [x] B1 `soloMonsterAbilityEngine`：抽共用主體，新增 `resolveTeamMonsterAbility`（submissions 陣列）；單元測試（多人聚合 break、倒地成員不入分母、冪等 key）。
- [x] B2 `dungeonDb.processDungeonRound` 插入 Step 2.5：技能結算、傷害分配（single/party/self）、異常寫入 `abilityStatuses`、怪物盾/減傷/回血 `monsterAbilityState`、log 加 `ability` 欄位；下回合 Step 1 套用異常、回合末毒 tick。
- [x] B3 `BattleScreen` party 路徑：`partyResolution.ability` → skillFx 蓋版演出。
- [x] B4 `npm test` 綠＋新測試覆蓋 Step 2.5 純函式部分。

## Phase C：驗證與收尾
- [x] C1 `npm run build` 通過。
- [x] C2 flag on 自動化煙霧測試（`dungeonExpansionSmoke.test.js`）：全 7 族 × 4 難度 × 3 樓層抽怪不出王、技能結算不爆。
  - ⚠️ **未做瀏覽器實跑**：需登入 Firebase 的真實地下城一趟（確認技能演出與 HP 實際變化）留給使用者驗收。
- [x] C3 changelog＋monster-handbook 不需重生成（規格未變）；更新第二大腦 changelog、同步記憶。

## 驗證指令
- `CI=true npm test -- --silent --watchAll=false`
- `npm run build`

## 回滾點
- Phase A / B 各自獨立可回滾；接線入口單一（`drawDungeonFloorMonsters` / Step 2.5 區塊），revert 對應 commit 即回舊行為；flag off 為即時逃生門。
