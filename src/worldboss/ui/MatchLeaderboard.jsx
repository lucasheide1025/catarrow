// src/worldboss/ui/MatchLeaderboard.jsx
// 比賽即時排行。**場內選手跟場外觀眾看的是同一個元件**——
// 兩份實作遲早會漂，而比賽當天分數對不上是最嚴重的事。
const MEDAL = ["🥇", "🥈", "🥉"];

export default function MatchLeaderboard({ board = [], myId = null, compact = false, max = 0 }) {
  const rows = max > 0 ? board.slice(0, max) : board;
  if (!rows.length) {
    return (
      <div style={{
        padding: "16px 10px", textAlign: "center", borderRadius: 10,
        border: "1px dashed rgba(148,163,184,.28)", color: "#64748b",
        fontSize: 11.5, fontWeight: 800,
      }}>還沒有人上場</div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 3 : 5 }}>
      {rows.map(p => {
        const mine = p.memberId === myId;
        return (
          <div key={p.memberId} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: compact ? "5px 8px" : "8px 10px", borderRadius: 9,
            background: mine ? "rgba(251,191,36,.16)" : "rgba(15,23,42,.75)",
            border: `1px solid ${mine ? "#fbbf24" : "rgba(148,163,184,.14)"}`,
          }}>
            <div style={{
              width: 26, textAlign: "center", flexShrink: 0,
              fontSize: p.rank <= 3 ? 15 : 12, fontWeight: 900,
              color: p.rank <= 3 ? "#fde68a" : "#64748b",
            }}>{MEDAL[p.rank - 1] || p.rank}</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: compact ? 12 : 13, fontWeight: 900,
                color: mine ? "#fde68a" : "#e2e8f0",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {p.name}{mine && "（我）"}
                {/* 還在場上的人標一個亮點——場外看得出誰正在射 */}
                {p.active && <span style={{ color: "#4ade80", marginLeft: 5, fontSize: 9 }}>●</span>}
              </div>
              {!compact && (
                <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 1 }}>
                  {p.arrows} 箭・平均 {p.average.toFixed(1)} 環・X{p.xCount}・10×{p.tens}
                </div>
              )}
            </div>

            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: compact ? 14 : 17, fontWeight: 900, color: "#fbbf24", lineHeight: 1.1 }}>
                {p.score}
              </div>
              {!compact && <div style={{ fontSize: 9, color: "#64748b" }}>分</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
