# 世界王強攻技能 spec 草案（PRD 11-21 結構化）

> Claude research,供 Codex 實作參考;不覆蓋正式規格。價值：把 PRD 條文轉成「可直接接現有引擎」的契約——破解分段、once-only、回合狀態機都已有現成模組可引用。

## 0. 與現有引擎的對接點（先講,避免重造）
| 需求 | 現成模組 | 備註 |
|---|---|---|
| 破解分段 ≥85/70-84/50-69/<50 | `getBreakOutcome(ratio, "worldBoss")` | **worldBoss ruleset 的 MAJOR=×0.4 正是 PRD 14 的「降低60%」,已對** |
| 破解品質正規化 | `calculateBreakRatio(submissions, targetFmt)` | 已修靶紙正規化;世界王必帶玩家當前 targetFmt |
| once-only | `makeSkillResolutionKey` + `recordResolvedSkill` | key=`{sortieId}:{round}:{bossId}:{skillId}` |
| 回合/預告持久化 | `createCombatRoundState`/`restoreCombatRoundState` | `pendingTelegraph`/`resolvedSkillKeys`/`phaseHistory` 齊備 |
| snapshot 重連 | 比照 `normalizeMonsterBattleSnapshot` | 取代現行 WorldBossAttack 的裸 localStorage 物件 |

世界王=**個人出戰**（PRD 30）→ 本專案 client-authoritative 哲學下,回合狀態存本機 snapshot 即可,但**必須**走 combatRoundState 的結構（而非現行 `_saved.roundIdx` 裸物件）,否則預告/已施放/round 位置無法保證重連一致（PRD 12）。

## 1. 每王技能設定 schema（24 王 × 2 技）
```js
worldBossSkills[bossKey] = {
  r2Strike: {  // 第2回合強攻
    skillId,           // 唯一,如 wb_{bossKey}_strike
    name, color, animKey, sfxKey,          // 專屬演出（PRD 20）
    counterText,       // 兒童可理解的破解說明（R1 末預告用）
    baseMultiplier: 1.6,                   // 固定（PRD 17）
    status: { id, strength, duration } | null,  // 可帶一個較輕異常（PRD 20）
    minPlayerHp: 1,                        // 不可擊倒（PRD 17）
  },
  r4Finisher: { // 第4回合終結技
    skillId, name, color, animKey, sfxKey, counterText,
    baseMultiplier: 2.2,                   // 固定（PRD 18）
    status: null,                          // 不追加持續傷害（PRD 20）
    canKnockOut: true,                     // 可擊倒;睡飽不可復活（PRD 18/127）
    fullBreakSpectacle: animKey,           // 完全破解仍播非傷害演出（PRD 16）
  },
}
```
- 24 王類型 profile（PRD 21）：教練3=射箭系強攻;攻擊型貓王=高傷;防禦型貓王=攻擊後加**自身**護盾/減傷;治癒型貓王=攻擊後少量**自我**回復;六族大小王12=族系專屬異常+終結演出。共用同一 resolver,差異全在資料。
- 禁止：無預警即死、整回合剝奪操作、恐怖驚嚇（PRD 21）。

## 2. 個人出戰回合流程（PRD 11-12,固定回合制,非全服倒數）
```
R1 射擊 → 結算 → 【R1 末：預告 R2 強攻（名稱/效果/破解方式）→ 存 pendingTelegraph】
R2 射擊提交 → 計算本回合破解% → 施放強攻（一次結算）→ 反擊
R3 射擊 → 結算 → 【R3 末：預告 R4 終結技 → pendingTelegraph】
R4 射擊提交 → 破解% → 終結技（可擊倒）
R5+ 一般反擊,無循環強攻（世界王不用一般怪排程,PRD 50）
```
- 預告在 **R1/R3 結束時**必須出現且**重連後一致**（讀回 pendingTelegraph,不重抽）。
- 強攻在**玩家完成該回合射箭後**施放（PRD 14）——即 phase 進 MONSTER_ABILITY 才結算。

## 3. 結算順序（PRD 19,固定,不可重排）
```
skillDamage = baseCounter × strikeMultiplier(1.6|2.2)
            → × breakOutcome.damageMultiplier      // 射擊破解減幅（worldBoss ruleset）
            → × (1 - 防具專精減傷)                  // 堅韌/守勢(≤35%HP)——依正常順序,R4 不提供1HP保護(PRD 122)
            → - 護盾
            → 扣 HP（R2: max(1, hp-dmg);R4: 可到 0）
異常在傷害後套用:strength × breakOutcome.statusMultiplier,再過免疫專精(先降強度→縮回合→最低1回合)
```
- 破解計算輸入：該回合**全部有效箭**,`calculateBreakRatio([{arrows}], playerTargetFmt)`——**必帶玩家靶紙**（3/6箭、全環/半環/field_16 自動正規化,PRD 15）。
- **R4 完全破解**：傷害0、異常0,但仍播 `fullBreakSpectacle` 非傷害演出,且**不得因演出再扣血/重複寫入**（PRD 16）→ 演出與結算徹底分離,結算只看 resolvedSkillKeys。

## 4. once-only 與重連（PRD 13/12）
- 每次個人出戰建立 `sortieId`（唯一,如 `wb:{eventId}:{memberId}:{attemptNo}`）。
- 強攻結算 key：`makeSkillResolutionKey({battleId: sortieId, round, monsterId: bossKey, skillId})`;結算前查 `resolvedSkillKeys`,已在 → **只播演出不再改數值**。
- snapshot：整包 combatRoundState 序列化存本機（restore 驗證 round/settings）;動畫重播、刷新、重送**不推進回合、不重複結算**（PRD 31）。
- 「睡飽」回合末回復在玩家被 R4 擊倒後**不觸發、不能復活**（PRD 18/127）→ END_HEAL phase 檢查 alive。

## 5. 測試矩陣（實作時的驗收底線）
1. R1/R3 末預告出現;serialize→restore 後預告/round/已施放清單一致。
2. R2 破解四級距各一案（≥85 → 0傷0異常;70-84 → ×0.4;50-69 → ×0.7;<50 全額）,**field_16 與 full_110 各測一組**（靶紙正規化）。
3. R2 結算後 HP ≥1（滿傷也不倒）;R4 可擊倒,倒地後睡飽不回血。
4. 同一 round 的強攻重複觸發（模擬動畫重播/重連重送）→ 第二次不改 HP/不再寫 status。
5. R4 完全破解 → 傷害0/異常0,演出 flag 仍回傳。
6. 結算順序：專精減傷在破解減幅之後、護盾之前（用可組合的數值案例驗）。
7. 24 王 config 完整性：每王 r2Strike+r4Finisher、skillId 全域唯一、multiplier 固定 1.6/2.2、r4 無 status。

## 6. 建議實作切法
先做 **1 隻教練王的垂直切片**（config+resolver+snapshot+測試矩陣 1-6）→ 通過後 24 王只是資料（同 252 招牌的哲學）。resolver 命名建議 `worldBossStrikeEngine.js`,與 solo/party adapter 同層。
