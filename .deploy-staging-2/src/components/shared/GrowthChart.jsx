// src/components/shared/GrowthChart.jsx — 純 SVG 折線圖（無第三方依賴）

// points: [{ y: number, label: string }]
export function LineChart({ points, color = "#3b82f6", height = 120 }) {
  if (!points || points.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="text-xs text-gray-400">資料不足（需至少 2 筆）</span>
      </div>
    );
  }

  const W = 320, H = height;
  const pad = { t: 16, b: 24, l: 36, r: 12 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;

  const ys   = points.map(p => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;
  const pbVal  = maxY;

  const mapped = points.map((p, i) => ({
    ...p,
    cx: pad.l + (i / (points.length - 1)) * cW,
    cy: pad.t + (1 - (p.y - minY) / rangeY) * cH,
  }));

  const polyline = mapped.map(p => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(" ");
  const f = mapped[0], l = mapped[mapped.length - 1];
  const area =
    `M${f.cx.toFixed(1)},${f.cy.toFixed(1)} ` +
    mapped.slice(1).map(p => `L${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(" ") +
    ` L${l.cx.toFixed(1)},${(pad.t + cH).toFixed(1)} L${f.cx.toFixed(1)},${(pad.t + cH).toFixed(1)} Z`;

  const ticks = minY === maxY ? [minY] : [minY, Math.round((minY + maxY) / 2), maxY];
  const labelIdxs = points.length <= 3
    ? points.map((_, i) => i)
    : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height }}>
      {ticks.map((v, i) => {
        const cy = pad.t + (1 - (v - minY) / rangeY) * cH;
        return (
          <g key={i}>
            <line x1={pad.l} y1={cy.toFixed(1)} x2={pad.l + cW} y2={cy.toFixed(1)}
              stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="4,4" />
            <text x={pad.l - 4} y={(cy + 3.5).toFixed(1)} textAnchor="end" fontSize="8" fill="#94a3b8">{v}</text>
          </g>
        );
      })}
      <path d={area} fill={color} fillOpacity="0.08" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
      {mapped.map((p, i) => {
        const isPB = p.y === pbVal;
        return (
          <g key={i}>
            <circle cx={p.cx.toFixed(1)} cy={p.cy.toFixed(1)}
              r={isPB ? 5 : (points.length > 15 ? 2.5 : 3.5)}
              fill={isPB ? "#f59e0b" : color}
              stroke="white" strokeWidth={isPB ? 1.5 : 1} />
          </g>
        );
      })}
      {labelIdxs.map(i => (
        <text key={i} x={mapped[i].cx.toFixed(1)} y={H - 5}
          textAnchor="middle" fontSize="8" fill="#94a3b8">
          {mapped[i].label}
        </text>
      ))}
    </svg>
  );
}

// 趨勢徽章：比最近 n 筆 vs 前 n 筆均值
export function TrendBadge({ values, n = 5 }) {
  if (!values || values.length < 2) return null;
  const len     = values.length;
  const recentN = Math.min(n, len);
  const recent  = values.slice(-recentN).reduce((a, b) => a + b, 0) / recentN;
  const prevN   = Math.min(n, len - recentN);
  if (prevN < 1) return null;
  const prev = values.slice(-recentN - prevN, -recentN).reduce((a, b) => a + b, 0) / prevN;
  const diff = recent - prev;
  if (Math.abs(diff) < 0.1) return <span className="text-xs text-gray-500 font-bold">≈ 持平</span>;
  const up = diff > 0;
  return (
    <span className={`text-xs font-black ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? "↑" : "↓"} {Math.abs(diff).toFixed(1)} {up ? "進步中" : "下滑中"}
    </span>
  );
}
