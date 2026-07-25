# 技術設計 — 卡片天賦透明化

## 核心原則：只讀不改

現有 `src/lib/cardTalents.js` 已提供全部計算：
- `calcCardCombatEffects(views)` / `calcCardCombatEffectsFromCollection(collection)` → 彙總+砍上限+套裝的最終 `{key:value}`。
- `calcFamilySetStatus(views)` → 各族套裝觸發狀態。
- `getCardTalent(view)` → 單卡天賦 `{key,value,icon,label,text}`。
- `TALENT_CAPS` / `FAMILY_SET_BONUSES` → 上限與套裝定義。

**本任務不動上述任何計算**；只新增「顯示層」讀取它們。

## 新增：純顯示 metadata（可放 cardTalents.js 或新檔 cardTalentDisplay.js）

需要一張「效果 key → 顯示資訊」的登記表，涵蓋**天賦 key** 與**套裝 key** 兩類：

```
EFFECT_DISPLAY = {
  armorPiercePct:   { icon:"🗡️", name:"穿甲",   cap:10, kind:"talent" },
  damagePct:        { icon:"💪", name:"傷害系", cap:8,  kind:"talent", pooledFrom:["蠻力","蓄勁","淬毒"] },
  critRatePct:      { icon:"⚡", name:"爆擊率", cap:8,  kind:"talent", pooledFrom:["連擊","挑戰者"] },
  ...（對齊 TALENT_CAPS 全部 key）
  // 套裝專屬 key（無 cap 或另註）
  endRoundHeal:     { icon:"🌿", name:"回合回復", cap:20, kind:"mixed" },   // 天賦+套裝都會加
  coinBonusPct:     { icon:"🪙", name:"金幣加成", kind:"set" },
  bossDamagePct:    { icon:"🐲", name:"屠龍",    kind:"set" },
  poisonResistPct:  { icon:"🛡️", name:"抗毒",   cap:100, kind:"set" },
  statusDurationReduction / statusStrengthReductionPct / hqDamagePct ...
}
```

> ⚠️ cap 值必須**引用** `TALENT_CAPS`（不要另外抄一份數字，避免第二段改 cap 時顯示對不上）。顯示表只放 icon/name/pooledFrom/kind，cap 一律 `TALENT_CAPS[key]`。

## 資料流

```
collection {cards, equipped}
  → 建 enrichedViews（含 monsterId/family/tier/tierIndex/source）
      ※ 現有 CardCollectionModern 的 views 只有 family，天賦需要 tierIndex
        → 沿用 calcCardCombatEffectsFromCollection 內那段 mapping（含 tierIndexFromTier）
  → totals = calcCardCombatEffects(enrichedViews)      // 實際生效值（已砍上限）
  → sets   = calcFamilySetStatus(enrichedViews)
  → 貢獻來源：對 equipped 每張 getCardTalent(view) 收集 key→[label...] 計數
  → 面板逐 key 畫 bar：value=totals[key], cap=TALENT_CAPS[key], 貢獻=上面收集
```

## 元件改動

| 檔案 | 改動 |
|------|------|
| `src/lib/cardTalentDisplay.js`（新，純顯示 metadata + 建議產生器） | `EFFECT_DISPLAY`、`buildContribution(views)`、`buildSuggestion(totals, sets, views)` |
| `src/components/member/cards/TalentEffectPanel.jsx`（新） | 總效果面板 UI（bars＋貢獻小字＋套裝＋主動建議＋收合） |
| `src/components/member/CardCollectionModern.jsx` | header 內嵌 `<TalentEffectPanel .../>`；enrichedViews 用含 tierIndex 版本（取代現有只含 family 的 mapping） |
| `src/components/member/cards/CardCollectionPrototype.jsx` | 卡片格加天賦顯示（`getCardTalent` icon+label） |
| `src/components/member/cards/CardDetailSheet.jsx` | 天賦文字後補共池/上限說明（讀 `EFFECT_DISPLAY[key].pooledFrom` + cap） |

## 主動建議邏輯（buildSuggestion）

依序判斷，回傳一行字（可多條取最重要 1~2 條）：
1. **撞頂浪費**：某 key `sum(貢獻原始值) > cap` → 「⚠️ {name}已滿，多的沒作用，換 {未滿的建議天賦} 更划算」。
2. **差一張套裝**：某族 count==1 或 ==3 → 「再裝 1 張 {族名} 即可觸發 {2階/4階} 套裝」。
3. **有空間**：主力 key 離 cap 還很遠 → 「{name} 還有空間，可再堆」。
4. 都沒有 → 給正面回饋「搭配均衡，讚 👍」。

## 風險 / 注意

- **admin 射手模式白屏**（[[feedback_admin_mode]]）：`CardCollectionModern` 是 member 元件，AdminApp 射手模式也會 render。新元件/新 import 不得造成循環 import（顯示 metadata 放 `lib/`，不要放 UI 元件再 re-export）。改完務必實測教練切射手模式進裝備頁。
- **null / 空收藏 / 訪客**：`collection` 可能為 `{}`、`equipped` 可能空、訪客可能無天賦資料。所有讀取加防呆，面板無效果時顯示「尚未裝備／無生效天賦」而非崩潰。
- **世界王卡**：`source==="wb"` 不參與天賦與套裝（現有邏輯已排除），面板同樣略過。
- **效能**：面板每次 render 都算一次 `calcCardCombatEffects`；裝備頁非高頻重繪，可接受；若需要再 `useMemo`（依 `collection.equipped`）。
- **零平衡佐證**：完工時 `git diff src/lib/cardTalents.js` 應為空（或僅註解）。
