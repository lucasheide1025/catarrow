# Technical Design

## Architecture

- `catBattleArchetypes`：新增資料驅動目錄，定義三型循環、九隻個體特性、模式倍率、觸發率與上限。
- `catBattleEngine`：純函式權威規則，輸入貓咪／玩家／怪物／卡片專精／回合上下文，輸出事件與下一狀態。
- `BattleScreen`：單人消費同一引擎事件，負責 reducer 狀態、演出與快照，不在 JSX 重寫公式。
- `partyDb` / `dungeonDb`：權威端呼叫共用引擎，將逐人事件寫入 round log；客戶端只播放結果。
- 世界王結算使用相同引擎的 `worldboss` policy；決鬥不接新版 policy。
- `CatCollection`：拆成 mobile overview、archetype tabs、cat preview、skill detail sheet 與 equip action；沿用現有資料讀寫。

## State Contract

```js
catBattleState = {
  strongSkillMisses: number,
  personalShield: number,
  guardAtkBuff: { value, expiresAfterRound } | null,
  deathGuardUsed: boolean,
  combo: number,
  pulse: number,
  catStatuses: [],
}
```

- 狀態放入單人 `battleScreenSnapshot` 與組隊／地下城成員快照。
- 舊快照缺欄位時使用零值，不重置貓咪 HP 或玩家既有戰鬥狀態。
- 強力技能 roll 由 battle instance、round、memberId、catId 派生確定性亂數，避免房主重試重複觸發。

## Resolution Order

1. 回合開始：到期清理、套防禦型護盾存在 DEF、套上一回合守勢 ATK。
2. 玩家輸入後：攻擊型讀取命中／連擊／殘血條件。
3. 貓咪基礎行動：普通協攻＋類型基礎效果。
4. 強力技能：機率或第四回合保底；產生個人及封頂後的團隊事件。
5. 怪物狀態：合併卡片與貓咪異常，立即效果先結算，DOT 按共用生命週期 tick。
6. 怪物反擊：玩家護盾與貓咪護盾按單一順序吸收，記錄實際吸收量。
7. 回合末：治療／淨化、承傷轉次回合 ATK、持續時間遞減與提示。

## Balance Policies

- `normal`, `boss`, `worldboss` 分開配置最大 HP 比例、每回合傷害上限、護盾上限與致命保護形式。
- 團隊效果採 strongest-wins 或隊伍 cap，不把四個百分比直接相加。
- 應援專精同時支援攻擊、治療與防禦效能，需新增 shield／guard scaling，避免只偏袒兩型。
- 卡片聯動以既有 `combatModifiers` 鍵為來源，不讀顯示文字判斷效果。
- 羈絆輸入一律使用 `getBondLevel(rawBond)` 的 0–50 等級，不直接拿原始 bond 點數套公式。
- 初始曲線採平滑倍率：基礎效果與技能威力隨羈絆線性／分段成長，強力技能機率只做小幅加成並受個體 cap；第四回合保底固定。
- catalog 必須能輸出 `currentBondEffect` 與 `nextBondEffect`，供 UI 顯示實際差值。

## UI Design

- 手機首頁：sticky compact header、目前同行陪練房、三型 segmented tabs、三張角色卡、sticky equip CTA。
- 陪練房使用 CatAnimator 待機／換貓動畫、短台詞及戰術循環三步預覽。
- 角色卡第一層只有三枚語意徽章與一句用途；完整數值在 bottom sheet。
- 所有動畫尊重 `prefers-reduced-motion`，不得用動畫延遲主要操作。

## Compatibility and Rollback

- 不修改貓咪擁有、XP、羈絆或裝備文件 schema。
- 新戰鬥狀態採版本化欄位；可用 feature flag 回退舊技能 resolver。
- UI 可獨立回退到舊 CatCollection，而不影響已保存養成資料。
