export default function GuildDefenseLine({ defense }) {
  if (!defense) return null;
  const ratio = Math.max(0, Math.min(1, defense.gateHp / Math.max(1, defense.gateMaxHp)));

  return (
    <div aria-label={`城門生命 ${defense.gateHp}/${defense.gateMaxHp}`} style={{
      position: "absolute", left: 0, right: 0, bottom: 78, zIndex: 64,
      display: "grid", gridTemplateColumns: "1fr minmax(92px, 28%) 1fr", alignItems: "end",
      filter: "drop-shadow(0 5px 5px rgba(0,0,0,.65))", pointerEvents: "none",
    }}>
      <div style={{ height: 25, borderTop: "5px solid #78716c", borderBottom: "5px solid #44403c", background: "repeating-linear-gradient(90deg,#57534e 0 22px,#44403c 22px 25px)" }} />
      <div style={{
        minHeight: 72, padding: "5px 7px 7px", boxSizing: "border-box",
        border: "5px solid #78716c", borderBottom: 0, borderRadius: "10px 10px 0 0",
        background: "linear-gradient(90deg,#3f2d20,#6b4f35 45%,#3f2d20)",
        display: "grid", gridTemplateRows: "26px 14px 6px", rowGap: 3,
        alignContent: "center", textAlign: "center",
      }}>
        <div style={{ fontSize: 22, lineHeight: "26px" }}>🏰</div>
        <div style={{ fontSize: 9, lineHeight: "14px", color: "#fff7ed", fontWeight: 900, whiteSpace: "nowrap" }}>
          城門 {defense.gateHp}/{defense.gateMaxHp}
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "#1c1917", overflow: "hidden" }}>
          <div style={{ width: `${ratio * 100}%`, height: "100%", background: ratio <= .25 ? "#ef4444" : "#f59e0b" }} />
        </div>
      </div>
      <div style={{ height: 25, borderTop: "5px solid #78716c", borderBottom: "5px solid #44403c", background: "repeating-linear-gradient(90deg,#57534e 0 22px,#44403c 22px 25px)" }} />
    </div>
  );
}
