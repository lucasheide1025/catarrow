// src/components/shared/charts/BarChart.jsx
// 純 SVG 柱狀圖，支援分組、標籤、hover 顯示數值。

import { useMemo, useState } from "react";

const PAD = { top: 16, right: 8, bottom: 28, left: 8 };
const W = 500, H = 180;

export default function BarChart({ data = [], color = "#60a5fa", barWidth = 0, height = "auto" }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const bars = useMemo(() => {
    if (!data.length) return [];
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const bw = barWidth || Math.min(36, iw / data.length * 0.6);
    const gap = (iw - bw * data.length) / (data.length + 1);

    return data.map((d, i) => {
      const x = PAD.left + gap + i * (bw + gap);
      const h = (d.value / maxVal) * ih;
      const y = PAD.top + ih - h;
      return { x, y, w: bw, h, label: d.label, value: d.value, color: d.color || color, idx: i };
    });
  }, [data, color, barWidth]);

  if (!data.length) {
    return <div className="text-xs text-slate-500 text-center py-8">尚無資料</div>;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: height === "auto" ? undefined : height }}>
      {/* 基準線 */}
      <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="rgba(255,255,255,.15)" strokeWidth="1" />
      
      {bars.map((b, i) => (
        <g key={i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: "pointer" }}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="3"
            fill={b.color} opacity={hoverIdx === i ? 0.9 : 0.6}
            stroke={hoverIdx === i ? b.color : "transparent"} strokeWidth="1.5" />
          {/* X 軸標籤 */}
          <text x={b.x + b.w / 2} y={H - PAD.bottom + 14} textAnchor="middle"
            fill="rgba(255,255,255,.35)" fontSize="9">{b.label}</text>
          {/* Hover 數值 */}
          {hoverIdx === i && (
            <g>
              <rect x={b.x + b.w / 2 - 20} y={b.y - 22} width={40} height={18} rx="4"
                fill="#1e293b" stroke="rgba(255,255,255,.15)" />
              <text x={b.x + b.w / 2} y={b.y - 10} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                {b.value}
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
