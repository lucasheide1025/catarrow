# C10 — 戰鬥引擎唯讀審查（vs PRD 契約）

> 範圍：`combatRoundState.js` / `combatSkillEngine.js` / `monsterSkillSchedule.js` / `monsterBattleSnapshot.js` / `monsterAbilityCatalog.js`（共 424 行,全數細讀）。
> 唯讀審查,未改任何被審檔案。發現按嚴重度排序。

## ✅ 通過項（先講好的）
- **回合階段機**：`PHASE_ORDER` 與 PRD 32 演出狀態機**逐項吻合**（預告→射擊→玩家傷害→破解→夥伴→怪技→異常→反擊→回合回復）；`moveToPhase` 只允許 +1 前進,防跳段重放。
- **持久化欄位**：PRD 31 要求的 `combatRound/skillState/skillHistory/pendingTelegraph/resolvedSkillKeys/statusEffects` 全數在 state ✓。
- **once-only**：`recordResolvedSkill`/`recordResolvedCompanion` 以 resolvedKey 去重；key 格式 `battleId:round:monsterId:skillId` 與 `battleId:round:memberId:companionId` 符合 PRD 40 ✓。
- **回合推進**：只能從 END_HEAL 進下一回合（PRD 30「完整結算才 +1」）；`submitMemberRound` 拒絕重複提交、鎖定 arrows 數 ✓。
- **夥伴順序**：前→中→後 + memberId 穩定排序（PRD 35）✓。
- **排程**：一般怪 R2招牌/R4共用交替、小王 R2/R4/R6 循環（招牌間隔6≥4）、大王 R2招牌/R4共用A/R6招牌強化/R8共用B——**與 PRD 48-49 完全一致**；排程為 round 的確定性函式 → 重連不重抽（PRD 50）✓。
- **12 共用技能數值**：與 PRD 52 逐項核對一致；反射/淨化/再生 minTier 3（PRD 53 T1-2 不配置）✓,反射單次上限 15% maxHP、毒素/反射 nonLethal ✓。
- **snapshot**：`normalizeMonsterBattleSnapshot` 驗證 arrowsPerRound/targetFmt 並給預設——正確處理先前交接提過的「重連 run settings 被覆蓋」問題 ✓。

## 🔴 HIGH — 破解品質未按靶紙正規化（違反 PRD 15/128）
`combatSkillEngine.scoreToBreakQuality` **寫死 10 分制**（10→1、9→0.9、8→0.75、7→0.55、1-6→0.3），`calculateBreakRatio` 完全不接收 targetFmt：
- **field_16（X、1-5 環）滿環 5 分只得 0.3 品質**;若 submissions 的 arrow.score 存數字 rawScore（X=5）,連 X 都拿 0.3 → **field_16 幾乎永遠無法達成 ≥85% 完全破解**,世界王/技能破解對原野靶玩家實質失效。
- PRD 15：「破解百分比必須由靶紙格式…正規化;支援 field_16…禁止寫死 9 分門檻」——此處正是被禁止的寫死模式。
- **建議修法**：品質函式改吃 `targetFmt`,按 `score/maxScore` 或每靶紙品質表正規化（可與 `battlePractice.isHighQualityHit` 同源）。我可接手實作+測試,等你分派。

## 🟡 MEDIUM — 破解級距與 PRD 數字/語意不符（請確認是否刻意）
`getBreakOutcome`：
1. **MAJOR(70-84%) 一般模式傷害 ×0.35**,PRD 級距「降低60%」=×0.4（worldBoss 0.4 是對的）。0.35 若是刻意 buff 請在 spec 註明,否則統一 0.4。
2. **MAJOR 把異常完全取消**（cancelStatus:true, statusMultiplier:0）,但 PRD 20：「部分破解時傷害**與異常強度依同一破解級距降低**」→ 70-84% 應為異常 ×0.4,只有 ≥85% 完全破解才 0 異常。PARTIAL 異常 ×0.5 也與級距 ×0.7 不同。
（若最終設計刻意改為「70%+ 即免異常」對玩家更友善,也成立——但請把 PRD 20 或 spec 更新一致,避免日後照 PRD 寫測試又紅。）

## 🟡 MEDIUM — 大王 HP 70%/40% 階段被動【追查結論：尚未實作】
全 src 搜尋確認：`phase_aura` 只在 `EFFECT_PRIMITIVES` 掛名,無任何實作/排程/觸發點。PRD 49 的階段被動屬**尚未實作**（與招牌技能 `signature_effect_not_structured` 同為 pending）。建議列入招牌技能結構化的同一批。

## 🟢 LOW — 異常契約強制點【追查結論：在 solo/party adapter,大多已實作且有測試】
- 已實作+已測：同名刷新不疊加、最多同時3種（`mergeCombatStatus`/`addPartyCombatStatus`）、毒素保1HP（`applySoloStatusTick`/`applyPartyStatusesForRound`）、tier 持續上限（`getStatusDurationCap` 1/2/3,已補測試）、破解取消/減半異常。
- **仍缺**：同能力總減幅 ≤40%（PRD 46）無強制點——現在共用技能單值 ≤20% 天然不超,但**招牌技能加 statDown 積木後可能同能力疊超 40%**,結構化招牌時需加 aggregate cap;免疫專精 pipeline（先降強度再縮回合）也待專精接線時實作。

## 🟢 LOW — 小項
- `common_heal maxUses:1` 全域套用;PRD 只限「一般怪每場最多一次」。對王怪限一次比 PRD 嚴——可接受,備註即可。
- `reduceStatusDuration` 最低保 1 回合 ✓（與免疫規則一致）。
- 排程天然滿足「回復/再生不得連續施放」（同技能至少隔 4 回合）✓。

## 總評
引擎骨架（狀態機/once-only/排程/snapshot）**與 PRD 高度吻合,品質好**。唯一必修是 **破解品質的靶紙正規化（HIGH）**——它直接決定 field_16 玩家的技能破解體驗,建議在擴到其他模式前先修。兩個 MEDIUM 是「數字/語意對齊」層級,拍板即可。
