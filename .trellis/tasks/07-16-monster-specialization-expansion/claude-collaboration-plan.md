# Claude collaboration plan

## Purpose

Claude 的使用額度約每五小時刷新一次，因此協作採「每次刷新完成一個封閉交付物」，不依賴長時間連續對話，也不讓 Claude 與 Codex 同時修改相同檔案。

目前任務仍在規劃期。使用者確認完整 `prd.md`、`design.md`、`implement.md` 前，Claude 只能協助研究、資料草案、測試設計與審閱，不得接入戰鬥或修改 production 邏輯。

## Ground rules

1. 每次交付前都先閱讀：
   - `.trellis/tasks/07-16-monster-specialization-expansion/prd.md`
   - `.trellis/tasks/07-16-monster-specialization-expansion/design.md`
   - 本文件
   - prompt 指定的現有程式與 spec
2. 不修改 `MemberPerformance`／射手表現相關檔案，除非使用者明確結束原本並行工作並重新授權。
3. 不部署、不 push、不修改正式 Firebase／Firestore、不執行資料 migration。
4. 不安裝 dependency；資料草案優先寫入 task `research/`，不是 `src/`。
5. 一次只接受一個批次，完成後停下並回報，不自行展開下一批。
6. 交付回報必須包含：修改檔案、完成項目、未決問題、驗證結果、對下一批的依賴。
7. Codex 開始整合某批後，Claude 不再修改該批檔案；若需修正，先由使用者／Codex 重新分派。

## Five-hour refresh batches

### Batch C1 — Current-system inventory (research only)

Output: `research/current-combat-and-loot-map.md`

Inspect and document:

- 單人、組隊、地下城單人／組隊、世界王的回合與權威結算路徑。
- 怪物、材料、寶箱、卡片、裝備升級的資料 shape 與 Firestore 欄位。
- 所有 `roll*Loot`、開箱、卡片發放、裝備升級入口。
- 重連與防重複結算現況。

No `src/` edits. This is the safest first refresh and provides evidence for design.

### Batch C2 — Monster roster and material catalog draft (research only)

Output:

- `research/monster-roster-draft.json`
- `research/material-catalog-draft.json`
- `research/monster-roster-notes.md`

Create the complete 7 family × 6 tier × (3 normal + 1 miniBoss + 1 bigBoss) catalog. Preserve existing IDs and mark existing monsters. Every entry needs unique ID, child-safe name/description, encounter type, family, tier, shared skill IDs, signature-skill placeholder, material ID, card ID, and art key. Validate counts and uniqueness with a small task-local validation script if useful.

Do not edit live monster data.

### Batch C3 — Shared and signature ability catalog draft (research only)

Output:

- `research/ability-catalog-draft.json`
- `research/ability-balance-notes.md`

Define 10–12 shared abilities and signature abilities for the roster. Include target (`self|single|party`), telegraph, trigger, tier bounds, counters, status duration, caps, mode applicability, and deterministic resolver inputs/outputs. Follow the PRD's status and round contracts.

Do not implement React UI or Firestore writes.

### Batch C4 — Card and asset manifest draft (research only)

Output:

- `research/card-catalog-draft.json`
- `research/art-manifest-draft.json`
- `research/card-ui-information-architecture.md`

Map every monster to a card and proposed art path. Preserve existing card keys. Specify silhouette data and family/Tier grouping. Review current `CardCollection.jsx` and describe a lazy group renderer without implementing it.

### Batch C5 — Economy simulation and recipes (research only)

Output:

- `research/economy-settings-draft.json`
- `research/economy-simulation.md`
- `research/economy-simulation.test.js` or a task-local script

Model direct drops, all chest sources, same-tier conversion, same-family 5:1 upgrade, specialization Lv.1–10 recipes, legendary/mythic gold costs, king-material gates, and expected time-to-upgrade. Simulate low/typical/high weekly play. King materials must never enter conversion or ordinary chests.

### Batch C6 — Test matrix and invariant tests (tests only after planning approval)

Allowed files will be assigned after catalog schemas are approved. Create invariant tests before live integration: unique IDs, exact roster counts, cross references, material eligibility, T6 cap, chest exclusions, card mapping, skill parameter validation, and specialization caps.

### Later implementation batches

Only after user approves planning and Codex freezes contracts:

- C7: catalog data modules + invariant tests.
- C8: material conversion and batch transaction tests.
- C9: card collection grouped UI.
- C10: read-only code review of mode adapters after Codex integrates battle resolver.

Battle authority and Firestore transaction integration should remain with one owner (recommended: Codex) because it spans all five modes and has the highest duplicate-award/reconnect risk.

## Copy-paste prompt for Claude — first refresh

```text
Active planning task: .trellis/tasks/07-16-monster-specialization-expansion

You are helping with Batch C1 only. Read prd.md, design.md, and claude-collaboration-plan.md completely, then inspect the repository evidence for current combat and loot flows. Write only:
.trellis/tasks/07-16-monster-specialization-expansion/research/current-combat-and-loot-map.md

Document single monster, party monster, solo dungeon, team dungeon, and world boss round/authority flows; monster/material/chest/card/equipment data shapes; every loot/chest/card award entry point; reconnect and idempotency boundaries. Include file and function references. Do not edit src/, do not install anything, do not deploy, do not commit, and do not start another batch. Finish with unresolved risks and a concise handoff summary.
```

## Integration ownership ledger

Update this table before starting implementation so parallel edits never overlap.

| Area | Owner | Status | Files frozen for other agents |
|---|---|---|---|
| Requirements and contracts | Codex + user | planning | task artifacts |
| Existing shooter performance work | Claude (separate task) | done — committed thru c3c3283, deployed; files stable/frozen (awaiting only user threshold calibration) | MemberPerformance.jsx, archerDiagnosis.js, charts/ShotGroupOverlay.jsx |
| Current-system research C1 | Claude | done — research/current-combat-and-loot-map.md（含資料盤點+權威模型+風險評估；地下城/遠征冪等待 Codex 深查） | task research output only |
| Roster/material drafts C2 | Claude | done — 252 隻+252 材料由 generate-roster.js 生成並驗證；60 舊 ID 保留；4 項待拍板（見 monster-roster-notes.md，尤其 42-vs-60） | task research output only |
| Ability drafts C3 | Claude | done — 12 共用+15 積木+契約+排程 (ability-catalog-draft.json) + 252 招牌 (generate-signatures.js);世界王強攻另立、招牌數值待調校 | task research output only |
| Economy simulation C5 (v2+方案) | Claude | done — 打法比較+A/B/C方案;**使用者選定方案B**(單人×5+targeting、組隊×5+卡片30%獨立);建議鎖定值見 economy-recommended-lock-B.md;待 Codex 給寶箱補缺量+決定三/九專精是否解耦 | task research output only |
| Card UI architecture C4 | Claude | done — 架構文件已審核通過 | task research output only |
| Card UI 原型元件 C4-impl | Claude | done — 新增 src/components/member/cards/ 8 檔;13/13 測試 + CI build 過(+1.07KB gzip,Codex 驗);**未接線,待 Codex 接線** | 新增 src/components/member/cards/*(不改 CardCollection.jsx) |
| Invariant tests C6 | Claude | done — catalogInvariants.test.js:守護正式 catalog 數量/唯一/舊60/交叉引用/轉換邊界/T6上限/衍生一致;唯讀不改 catalog | 新增 src/components/member/cards/catalogInvariants.test.js |
| Card art manifest C7 | Claude | done — 192 新卡圖 manifest+prompt+規格;12批×16、零覆蓋既有60;art不變量入 CI(28/28) | task research + catalogInvariants.test.js |
| Card art 樣稿閘門 C7-gate | Claude | done — 6張代表性樣稿候選ID+逐張a-k驗收表+閘門判定(claude-card-art-sample-review.md) | task research output only |
| 女性魔物多樣性 C7-female | Claude | done(A路線) — 建議書(claude-female-monster-suggestion.md)+14隻候選完整名單與修改後prompt(claude-female-monster-prompts.{md,json});御姐/高冷/全包覆/零色氣;涵蓋7族,只改prompt外觀,artKey未動(已驗證);森林女獵人+星靈公主已核准 | task research output only,零觸 catalog/artKey |
| Boss reward 冪等測試批次 | Claude | done — bossRewardAdvance.js(+blocksAdvance edge保護)+21→24測試;dungeonBossRewardDb.test.js(mock交易:冪等/owner/選箱/pity/reconnect);TeamExpeditionBattle 前進閘門抽純函式+validRounds guard;風險:validRounds為client端gate(符合本專案哲學,server硬性需擴功能未做) | bossRewardAdvance.{js,test.js}, dungeonBossRewardDb.test.js, TeamExpeditionBattle.jsx |
| HQ命中 util + 過時測試修正 | Claude | done — battlePractice.js 抽 highQualityThreshold/isHighQualityHit(唯一權威,PRD128不寫死9分;field_16=4、10分制=8)+3測試;修 283ed00 後過時的 targetFace/battlePractice 測試(field_16 maxScore 6→5);**精準專精/弱點姿態/再生中斷接線時請呼叫此 util,勿 inline 門檻**;全套 219/219 綠+CI build 過 | battlePractice.{js,test.js}, targetFace.test.js |
| Engine review C10 + 追查收尾 | Claude | done — claude-engine-review-c10.md(已更新結論);🟡破解級距0.35vs0.4+異常取消語意 vs PRD20 請拍板;🟡大王HP階段被動**確認尚未實作**(phase_aura僅掛名,建議併入招牌結構化批次);🟢異常契約大多已實作且補齊測試(tier duration cap+targetFmt貫通回歸×3),**缺同能力≤40% aggregate cap**(招牌statDown積木時需加);+4測試,全套228/228綠 | 唯讀+新增 adapter 測試 |
| 🔴HIGH 破解品質靶紙正規化修復 | Claude | done — engine+adapter 加 targetFmt(10分制行為逐值不變;field_16 完全破解可達成);**接線已完成**(Codex 限流,經使用者同意由 Claude 接手):BattleScreen 帶 targetFormat prop、partyDb 帶 room.targetFormat;+5測試;全套228/228綠+CI build過,端到端生效 | combatSkillEngine, solo/partyMonsterAbilityEngine, BattleScreen.jsx(2行), partyDb.js(1行) |
| 世界王強攻 spec 草案 | Claude | done — claude-worldboss-skill-spec.md:與現有引擎對接表(worldBoss ruleset已對PRD14)、24王×2技 schema、個人出戰回合流程、PRD19結算順序、once-only/重連、7項測試矩陣、建議先做1隻教練王垂直切片 | task research output only |
| 卡面 SVG 佔位層(缺圖先用SVG) | Claude | done(使用者指示) — 新增 cards/CardArt.jsx:確定性 SVG 卡面(族系配色徽記+Tier光芒圓點+王冠角標,零請求);owned 缺圖→實圖fallback鏈終端=SVG(取代emoji);未取得→暗化SVG剪影;修 DetailSheet 單src無fallback破圖bug;CardMiniCell/DetailSheet 統一走 CardArtImage;全套228/228綠+CI build過。卡片接線確認已全通(Modern容器+MemberApp+AdminApp均切換,舊CardCollection.jsx已無引用,刪除時機由Codex定);Codex 卡圖進度184/252,補完後實圖自動蓋過SVG無需改碼 | cards/CardArt.jsx, CardMiniCell.jsx, CardDetailSheet.jsx, smoke test |
| Cross-mode resolver/integration + Phase 0/1 | Codex | in progress — 引擎四模組(combatRoundState/SkillEngine/Schedule/Snapshot 18/18綠)+BattleScreen 已接單人;C7 卡圖生成中(exam_* 已出) | Codex owns battle/monster/db production |

