// src/components/member/cards/TalentEffectPanel.jsx
// 「裝備總效果」面板：把 calcCardCombatEffects 的實際生效值攤開給玩家看。
// 顯示＝戰鬥實際吃的（含砍上限），並標示封頂、共池貢獻、族系套裝、主動搭配建議。
// ⚠️ 純顯示：只讀 cardTalents 的輸出，不做任何戰鬥計算。
import { useMemo, useState } from "react";
import { calcCardCombatEffects, calcFamilySetStatus } from "../../../lib/cardTalents";
import {
  EFFECT_DISPLAY, effectCap, formatEffectValue,
  buildEquippedViews, buildContribution, buildSuggestion,
} from "../../../lib/cardTalentDisplay";
import { CARD_CATALOG_BY_ID } from "./cardCatalog";

const cardName = monsterId => (CARD_CATALOG_BY_ID[monsterId] && CARD_CATALOG_BY_ID[monsterId].name) || monsterId;

function EffectRow({ keyName, value, contribution }) {
  const meta = EFFECT_DISPLAY[keyName] || { icon: "•", name: keyName };
  const cap = effectCap(keyName);
  const capped = cap != null && value >= cap - 0.001;
  const pct = cap != null ? Math.min(100, (value / cap) * 100) : 100;
  const parts = contribution || [];
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12 }}>
        <span style={{ fontWeight: 800, color: capped ? "#94a3b8" : "#e2e8f0" }}>{meta.icon} {meta.name}</span>
        <span style={{ fontWeight: 900, color: capped ? "#f59e0b" : "#6ee7b7" }}>
          {formatEffectValue(keyName, value)}{cap != null && <span style={{ color: "#64748b", fontWeight: 600 }}> / {cap}</span>}
          {capped && <span style={{ marginLeft: 6, fontSize: 10, color: "#f59e0b" }}>⚠️已滿</span>}
        </span>
      </div>
      {cap != null && (
        <div style={{ marginTop: 3, height: 5, borderRadius: 4, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: capped ? "#f59e0b" : "linear-gradient(90deg,#34d399,#22d3ee)" }} />
        </div>
      )}
      {parts.length > 0 && (
        <div style={{ marginTop: 2, fontSize: 9.5, color: "#7c8aa5" }}>
          來自：{parts.map(p => `${p.icon}${cardName(p.monsterId)}`).join("、")}
        </div>
      )}
    </div>
  );
}

export default function TalentEffectPanel({ collection }) {
  const [open, setOpen] = useState(true);

  const { totals, sets, contribution, tips, hasAny } = useMemo(() => {
    const views = buildEquippedViews(collection || {});
    const totals = calcCardCombatEffects(views);
    const sets = calcFamilySetStatus(views);
    const contribution = buildContribution(views);
    const tips = buildSuggestion(totals, sets, views, contribution);
    return { totals, sets, contribution, tips, hasAny: Object.keys(totals).length > 0 || views.length > 0 };
  }, [collection]);

  const keys = Object.keys(totals);
  // 有上限的（畫進度條）在前，純套裝效果（無 cap）在後
  const capped = keys.filter(k => effectCap(k) != null);
  const uncapped = keys.filter(k => effectCap(k) == null);

  const boxStyle = { marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "rgba(2,6,23,.35)", border: "1px solid rgba(129,140,248,.25)" };

  return (
    <div style={boxStyle}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", color: "#c7d2fe", fontWeight: 900, fontSize: 12 }}
      >
        <span>⚔️ 裝備總效果（實際生效）</span>
        <span style={{ fontSize: 11, color: "#818cf8" }}>{open ? "收合 ▲" : "展開 ▼"}</span>
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          {!hasAny && <div style={{ fontSize: 11, color: "#94a3b8" }}>尚未裝備卡片——裝上去就會在這裡顯示實際生效的總效果。</div>}

          {capped.map(k => <EffectRow key={k} keyName={k} value={totals[k]} contribution={contribution[k]} />)}

          {uncapped.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2, marginBottom: 6 }}>
              {uncapped.map(k => {
                const meta = EFFECT_DISPLAY[k] || { icon: "•", name: k };
                return <span key={k} style={{ fontSize: 11, fontWeight: 800, color: "#a7f3d0", background: "rgba(16,185,129,.12)", border: "1px solid rgba(52,211,153,.3)", borderRadius: 999, padding: "2px 8px" }}>{meta.icon} {meta.name} {formatEffectValue(k, totals[k])}</span>;
              })}
            </div>
          )}

          {/* 族系套裝 */}
          {sets.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,.06)" }}>
              {sets.map(set => (
                <span key={set.family} style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "2px 8px", border: `1px solid ${set.tier2 ? "rgba(52,211,153,.5)" : "rgba(255,255,255,.12)"}`, color: set.tier2 ? "#6ee7b7" : "#94a3b8" }}>
                  {set.name}（{set.count}）{set.tier4 ? `✦ ${set.text2}＋${set.text4}` : set.tier2 ? `✦ ${set.text2}` : "（2張啟動）"}
                </span>
              ))}
            </div>
          )}

          {/* 主動搭配建議 */}
          {hasAny && tips.length > 0 && (
            <div style={{ marginTop: 8, padding: "6px 9px", borderRadius: 9, background: "rgba(129,140,248,.1)", border: "1px solid rgba(129,140,248,.25)" }}>
              {tips.map((t, i) => <div key={i} style={{ fontSize: 11, color: "#c7d2fe", lineHeight: 1.5 }}>💡 {t}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
