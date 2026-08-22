# 多人複數怪手機戰鬥與完整加成整合設計

## 核心不變量

1. 角色頁、單人複數怪、多人複數怪的進場基礎 HP／ATK／DEF 完全一致。
2. Client 只提交回合草稿；正式 loadout、隨機觸發與傷害由 server 決定。
3. Resolver 產生事件；UI 只播放事件，不在動畫或 JSX 重算效果。
4. `390×844` 完整首屏；`360×640` 仍可無頁面垂直捲動完成核心操作。
5. 主戰場只保留決策必要資訊，完整隊伍、加成與戰報採漸進揭露。

## 手機資訊架構

```text
┌──────────────────────────────┐
│ R3  自己 HP ███  隊友 5/6  效果│
├──────────────────────────────┤
│  [怪 A]  [怪 B]  [怪 C]      │
│       🔮 後排治療符文          │
│       短暫事件浮字             │
├──────────────────────────────┤
│ [集火 100%] [全體 50%]        │
│ 已輸入：X · 9 · _ · _ · _ · _ │
│ [X][10][9][8][7][6]           │
│ [5][4] [3][2][1][M]           │
│ [撤回/長按清空] [送出本回合]    │
└──────────────────────────────┘
```

- 外層使用 `100dvh`、safe-area 與 `overflow:hidden`；只有 bottom sheet 內容可捲動。
- 狀態列常駐回合、自己的 HP、存活／送出進度與「效果」入口。隊友常駐資訊限存活、HP、ready。
- 三隻前排怪共用 responsive stage，移除固定 `min-h-[118px]`；名稱、HP bar、選取狀態常駐，次要資訊在小螢幕縮成圖示或點擊詳情。
- 後排符文改為緊湊 stage marker，不再建立第二列大型 TargetCard。
- 操作盤固定底部；十二鍵兩排六鍵，觸控元件高度至少約 44px。`360×640` 只縮怪物圖、間距與次要文案。
- 「隊伍／效果／戰報」整合為 bottom sheet 分頁。主畫面只顯示自己 HP 與最多三個重要狀態；卡片、貓咪、異常觸發以短暫浮字依 event order 播放。
- 建立 presentation cursor／queue 消費 `RoundResolution.events`。Firestore terminal status 只代表結果已確定；結算頁還需等待當前 resolution 完整播放。秒殺仍按 arrow flight → hit／crit → damage → status／cat（若有）→ monster killed → victory 演出。
- 音效由 presentation adapter 呼叫既有 `sound.js`；resolver／server 不觸發音效，重連以 resolution/event ID 防止同一 client 重複副作用。
- Queue 使用不可跳過的固定節奏；不提供 fast-forward。Reduced-motion 版本只改用較溫和的 opacity／scale 呈現，仍等待相同事件生命週期完成後才前進。
- `prefers-reduced-motion` 停用位移動畫，但保留靜態結果回饋。

## 送出與修改

- 送出後 action dock 顯示「已鎖定・N/M 已送出」。
- Server 尚未將 round 原子切到 `resolving` 前，可撤回 ready 並以較高 revision 修改同一 submission。
- Round 鎖定後不可撤回；收到 resolution 後播放事件並進入下一回合。

## 權威資料契約

### LoadoutSnapshot v2

```js
{
  version: 2, memberId, sourceFingerprint,
  baseStats: { hp, atk, def },
  statSources: [{ key, label, hp, atk, def }],
  cards: {
    equippedKeys, effectVersion,
    flat: { hp, atk, def },
    familyDamageBonusPct, familyDamageReducePct, combatMods
  },
  cat: { catId, catLevel, bondLv, hp, atk, def, modifiers, battleState },
  statuses: [], createdAt
}
```

- Server 從正式 member、certification／record、dex、RPG equipment、card collection 與 cat 資料建立快照，不接受 client 自報結果。
- `baseStats` 必須等於角色頁 `calcArcherStats + archerLevelBonus + calcEquippedBonus`。
- RPG 裝備沿用 `calcEquipBonus/getEquipSlotBonus`；貓咪沿用 `calcCatCombatStats`；羈絆統一為 0–50 bond level。
- 一般卡接入靜態三圍、族系攻防、套裝、天賦與異常；世界王卡只使用 v2 結構化被動，不使用舊 `+25` 或 persisted 顯示文字。
- Active 房固定 snapshot／effect version；中途換卡、換貓或升級裝備不改公式。
- Browser ES module 與 Functions CommonJS 不得靠元件內手抄公式。實作需建立純資料契約及 golden fixtures；server 為最終權威。若無法安全直接共用 runtime module，使用明確 generated adapter 並以 parity tests 防漂移。

### RoundSubmission

```js
{
  submissionId: `${battleId}:${round}:${memberId}`,
  round, memberId, arrows,
  attackMode: "focus" | "all",
  targetId: string | null,
  revision
}
```

### RoundResolution

```js
{
  resolutionId: `${battleId}:${round}`,
  round, seedVersion, submissionIds, before,
  events: [{ id, type, actorId, targetId, amount, source, payload }],
  after, outcome: "continue" | "win" | "lose"
}
```

事件涵蓋 player attack、card proc、status apply/tick/resist、cat action、shield/heal、monster action、member down 與 target defeated。UI 依 event ID 去重播放。

## 多目標規則

- 集火：玩家傷害、穿甲、卡片觸發、異常與貓咪單體攻擊作用於選定目標；目標倒下後轉向第一隻存活前排怪。
- 全體：每個存活目標承受 50% 玩家傷害；攻擊型卡片與異常按目標分別使用決定性 seed 判定。
- 貓咪治療、護盾、防禦與回合末恢復只作用於所屬玩家。未具備多人 cap 契約的團隊型效果本次先按個人效果處理。
- 怪物反擊、符文治療、DOT 與回合末效果的順序由 resolver 測試鎖定。
- RNG 由 `battleId + round + actorId + sourceId + targetId` 派生，重試產生相同 resolution。

## Server 流程與信任邊界

1. 建房／加入不扣 quota。
2. 房主要求開戰；server 驗證 MULTI quota、房間與成員，建立 encounter 與 loadout snapshots，再切換 active。
3. Client 只能透過 callable 提交／修改箭組、模式與目標。
4. 所有存活成員 ready 後，server 原子鎖定 round，執行 resolver 並寫入單一 resolution。
5. 同一 round 重複處理回傳既有 resolution，不重複傷害或觸發。
6. 勝利後沿用 `claimMultiMonsterBattleReward` 的 trusted、battleId 冪等獎勵契約。

Firestore rules 禁止 client 直接寫 snapshot、targets HP、members combat state、resolution 與 outcome。

## 相容性、測試與回復

- 新房使用 `combatVersion: 2`；舊 active v1 房保持原 resolver 到結束。Waiting v1 房可於開戰升級；缺資料時明確失敗，不以 raw profile 靜默降級。
- Golden parity：角色頁與 server snapshot 的 HP／ATK／DEF 逐項及來源總和一致。
- Authority／idempotency：偽造三圍、卡片、貓咪、revision 或 target 無效；雙擊、重送、競爭結算只產生一份 resolution。
- Combat：集火／全體、目標提前死亡、各卡片效果、世界王卡 scope、九隻貓、羈絆邊界、異常與符文順序。
- UI：`390×844`、`360×640`、safe-area、長名稱及 8 人隊伍均可完成核心操作且無頁面垂直捲動。
- Functions logs 只記 battleId、round、resolutionId、combatVersion 與錯誤碼，不記 token 或完整私人 loadout。
- 以 feature flag／version 分段落地；v2 發生問題只讓新房回退，已開始房間不可中途換公式。
- 不加入斷線代打、逾時自動出手或大規模平衡調整。
- Functions 僅 targeted deploy；遵循 2026-08-20 handoff 的 `CAT_ARCHERY_VERCEL` 限制，不全量部署。
