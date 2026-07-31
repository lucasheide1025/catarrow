// src/worldboss/ui/RaidHud.jsx
// 頂部共享血條、意圖條、破防槽、宣告列——討伐版式的四條資訊帶。
// 全部是無狀態的呈現元件，資料由 RaidScreen 餵。
import { BREAK_GAUGE_MAX } from "../domain/breakGauge";
import { intentHint } from "../domain/bossIntent";
import { callableParts } from "../domain/weakPoints";

const GAUGE_CELLS = 20;

/* 全場共享血條：世界王的血是大家一起打的，這條是共鬥感的來源 */
export function RaidBossBar({ name, title, phase, hp, maxHp, participants = 0 }) {
  const pct = Math.max(0, Math.min(100, (hp / (maxHp || 1)) * 100));
  return (
    <div style={{ padding: "8px 12px", background: "linear-gradient(180deg,rgba(2,6,23,.95),rgba(2,6,23,.6))" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: "#fde68a", whiteSpace: "nowrap" }}>👹 {name}</span>
          {title && <span style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>}
        </div>
        <span style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap" }}>
          {participants > 0 ? `參戰 ${participants} 人` : ""}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5 }}>
        <span style={{
          fontSize: 10, fontWeight: 900, padding: "2px 7px", borderRadius: 5,
          background: phase?.id === 3 ? "#7f1d1d" : phase?.id === 2 ? "#4c1d95" : "#1e293b",
          color: "#fef3c7", whiteSpace: "nowrap",
        }}>
          第 {phase?.roman || "I"} 階段・{phase?.name || ""}
        </span>
        <div style={{ flex: 1, height: 11, borderRadius: 6, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`, transition: "width .45s cubic-bezier(.3,.9,.4,1)",
            background: pct > 66 ? "linear-gradient(90deg,#dc2626,#f87171)"
              : pct > 33 ? "linear-gradient(90deg,#c026d3,#e879f9)"
              : "linear-gradient(90deg,#991b1b,#ef4444)",
          }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 900, color: "#e2e8f0", minWidth: 38, textAlign: "right" }}>
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

/* 意圖條：讓「貪還是斷」的抉擇有依據，不是猜 */
export function RaidIntent({ intent, legHits = 0, broken = false }) {
  if (!intent) return null;
  if (!intent.charging) {
    return (
      <div style={{ padding: "6px 12px", fontSize: 11, color: "#93c5fd", textAlign: "center" }}>
        🌙 牠在等你出手——弱點都開著。
      </div>
    );
  }
  const need = Math.max(1, intent.interruptRequired);
  const pct = Math.min(100, (legHits / need) * 100);
  return (
    <div style={{ padding: "6px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 900, marginBottom: 3 }}>
        <span style={{ color: intent.color }}>⚡ {intent.name}</span>
        <span style={{ color: pct >= 100 ? "#4ade80" : "#fca5a5" }}>
          {pct >= 100 ? "可打斷！" : `打斷進度 ${legHits}/${need}`}
        </span>
      </div>
      <div className={broken ? "raid-intent-break" : ""}
        style={{ height: 8, borderRadius: 5, background: "rgba(255,255,255,.08)", overflow: "hidden", transformOrigin: "left" }}>
        <div className={`raid-intent-fill ${pct < 100 ? "raid-intent-danger" : ""}`}
          style={{
            height: "100%", width: `${pct}%`,
            background: pct >= 100 ? "linear-gradient(90deg,#22c55e,#4ade80)" : "linear-gradient(90deg,#b91c1c,#f43f5e)",
          }} />
      </div>
      <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 3 }}>{intentHint(intent, legHits)}</div>
    </div>
  );
}

/* 破防槽：全場共享，算命中次數不算傷害——新手真的推得動的那一條 */
export function RaidGauge({ gauge = 0, burstActive = false }) {
  const filled = Math.round((gauge / BREAK_GAUGE_MAX) * GAUGE_CELLS);
  const near = filled >= GAUGE_CELLS - 4;
  return (
    <div style={{ padding: "5px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 900, marginBottom: 3 }}>
        <span style={{ color: burstActive ? "#fde68a" : "#cbd5e1" }}>
          {burstActive ? "💥 破防中！全員增傷" : "破防槽（全場共享）"}
        </span>
        <span style={{ color: "#94a3b8" }}>{gauge} / {BREAK_GAUGE_MAX}</span>
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {Array.from({ length: GAUGE_CELLS }).map((_, i) => (
          <span key={i}
            className={`raid-gauge-cell ${i < filled ? "raid-gauge-on" : ""} ${near && i < filled ? "raid-gauge-near" : ""}`} />
        ))}
      </div>
    </div>
  );
}

/* 宣告列：決策在射之前，不是之後 */
export function RaidCallBar({ blocked = [], value, onChange, disabled = false }) {
  const parts = callableParts(blocked);
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 900, color: "#c7d2fe", margin: "0 0 5px 2px" }}>
        宣告部位（先選才能計分）
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
        {parts.map(part => {
          const active = value === part.id;
          return (
            <button key={part.id} type="button"
              disabled={part.blocked || disabled}
              aria-pressed={active}
              onClick={() => onChange?.(part.id)}
              style={{
                padding: "7px 2px", borderRadius: 10, cursor: part.blocked ? "not-allowed" : "pointer",
                border: `2px solid ${active ? part.color : "rgba(255,255,255,.12)"}`,
                background: active ? `${part.color}28` : "rgba(15,23,42,.85)",
                color: part.blocked ? "#475569" : "#e2e8f0",
                opacity: part.blocked ? 0.45 : 1,
                boxShadow: active ? `0 0 14px ${part.color}66` : "none",
                transition: "all .18s",
              }}>
              <div style={{ fontSize: 19, lineHeight: 1.1 }}>{part.blocked ? "⛓️" : part.icon}</div>
              <div style={{ fontSize: 10.5, fontWeight: 900 }}>{part.name}</div>
              <div style={{ fontSize: 9, color: part.blocked ? "#475569" : part.color, fontWeight: 900 }}>
                {part.blocked ? "封鎖" : `≥${part.threshold}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
