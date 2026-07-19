# PRD — 地下城接線：中途樓層擴充怪物池＋招牌技能引擎

## 背景
252 隻擴充怪物已接進單人打怪與地下城「王房」（`dungeonBossEncounter` 鎖定抽選），但：
1. 地下城中途樓層（一般房/精英房）仍抽舊 60 隻表（`monsterData.drawFloorMonsters` / `drawMixedMonsterPool`，未 import 擴充清冊）。
2. 地下城戰鬥（單人＋組隊共用 `DungeonBattleRoom` → `dungeonDb.processDungeonRound`）完全沒有招牌技能——`BattleScreen.handleSubmit` 的技能結算只在 standalone 路徑跑，partyMode 提前 return。

## 需求

### R1 中途樓層擴充怪物池
- feature flag（`isMonsterExpansionEnabled()`）開啟時，一般/精英房改抽 `EXPANSION_MONSTERS` 中 `encounter === "normal"` 者。
- 依地下城族系 family＋難度→Tier 對映（monster-handbook 拍板）：**普通(1)=T1-2、進階(2)=T4、困難(3)=T5、地獄(4)=T6**。
- 小王/大王**不得**進入中途樓層池（母任務 PRD §151-152：王只在 BOSS 房生成）。
- 隱藏（treasure）地下城同規則使用 treasure 族 normal 怪。
- 樓層強度維持現行三層設計：第1層弱化、第2層普通＋精英強悍、第3層強悍（變體倍率沿用 adapter 的 weak/strong 數值範圍）。
- flag 關閉時完全走舊路徑（回退安全）。
- 戰鬥圖免改：`/monsters-battle/{id}.webp` 已含全部 252 隻，`DungeonMonsterImg` 以 id 取圖。

### R2 地下城戰鬥招牌技能
- **權威端（host）在 `processDungeonRound` 每回合結算怪物技能一次**，不是每位成員各重播一輪（母任務 PRD §39）。
- 團隊 break 規則（母任務 PRD §44）：全體有效成員實得分合計 ÷ 全體有效成員最高可能得分合計；門檻 **≥85% 完全破解、70–84.99% 傷害×0.35＋取消狀態、50–69.99% ×0.70＋狀態減半、<50% 完整承受**。倒地/退出/被跳過者不入分母；貓咪傷害不入分子。
- 技能結果寫入該回合 room log（一筆/回合），所有成員端 `BattleScreen` 經 `partyResolution` 顯示技能演出（skillFx 蓋版）。
- 冪等：`dungeon:{roomId}:{round}` 唯一 resolved key；host 重試/重連/動畫重播不得重複結算。
- 異常/護盾只存在當前戰鬥房；每場戰鬥房是新 doc，換房天然清空（母任務 PRD §50）。
- 王房怪 HP 階段強化（70%/40%）沿用 signature 引擎 `monsterHpRatio` 參數。
- flag 關閉或 monster 無 `signatureSkillId`（舊 60 隻）→ 完全不跑技能，行為與現行一致。

## 驗收標準
1. flag on：普通難度鬼怪地下城中途樓層抽出的怪全部是 ghost 族 T1-2 `normal`；地獄=T6；精英房怪同 Tier。
2. flag on：地下城戰鬥中怪物依排程放招牌技能，host 結算一次、雙端同步看到演出與結果；技能傷害/異常實際生效。
3. flag off：抽怪與戰鬥流程和改動前完全一致。
4. 全部既有 tests 綠、新增單元測試覆蓋抽怪與團隊 break 邊界、`npm run build` 通過。

## 不在此次範圍
- ~~層數 4/5/6/7 改版~~ → **使用者 2026-07-18 拍板取消**：地下城層數固定 3 層，手冊規格已移除，不再是待辦。
- 每殺獎勵數值（Codex 已接 `dungeonKillRewards.js`）。
- 王房獎勵鏈（已完成）。
