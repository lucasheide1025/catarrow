// src/components/shared/charts/RadarChart.jsx
// 純 SVG 雷達圖，用於多維度綜合能力對比（前30箭 vs 後30箭）。

import { useMemo } from "react";

const CX = 120, CY = 120, R = 100;
const LEVELS = 5;

const AXIS_LABELS = {
  average: "平均分",
  hitRate: "命中率",
  xRate: "X率",
  stability: "穩定性",
  antiFatigue: "抗疲勞",
};

export default function RadarChart({ datasets = [], size = 240 }) {
  const axes = useMemo(() => {
    const keys = Object.keys(AXIS_LABELS);
    return keys.map((key, i) => {
      const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
      return {
        key,
        label: AXIS_LABELS[key],
        dx: Math.cos(angle),
        dy: Math.sin(angle),
      };
    });
  }, []);

  const polygons = useMemo(() => {
    return datasets.map(ds => {
      const points = axes.map(axis => {
        const value = ds.values[axis.key] ?? 0;
        const r = Math.max(0, Math.min(1, value)) * R;
        return {
          x: CX + axis.dx * r,
          y: CY + axis.dy * r,
        };
      });
      const pointStr = points.map(p => `${p.x},${p.y}`).join(" ");
      return { pointStr, color: ds.color, label: ds.label, points };
    });
  }, [axes, datasets]);

  if (!datasets.length) return null;

  const r = size / 2;
  const scale = r / 120;

  return (
    <svg viewBox={`0 0 ${r * 2} ${r * 2}`} className="w-full max-w-[260px] h-auto mx-auto">
      {/* 同心多邊形網格 */}
      {Array.from({ length: LEVELS }, (_, level) => {
        const lr = (R * (level + 1)) / LEVELS;
        const pts = axes.map(a => ({
          x: CX + a.dx * lr,
          y: CY + a.dy * lr,
        })).map(p => `${p.x * scale},${p.y * scale}`).join(" ");
        return <polygon key={level} points={pts} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1" />;
      })}
      {/* 軸線 */}
      {axes.map((a, i) => (
        <line key={i}
          x1={CX * scale} y1={CY * scale}
          x2={(CX + a.dx * R) * scale} y2={(CY + a.dy * R) * scale}
          stroke="rgba(255,255,255,.1)" strokeWidth="1" />
      ))}
      {/* 軸標籤 */}
      {axes.map((a, i) => {
        const lx = (CX + a.dx * (R + 22)) * scale;
        const ly = (CY + a.dy * (R + 22)) * scale;
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fill="rgba(255,255,255,.5)" fontSize="10" fontWeight="600">{a.label}</text>
        );
      })}
      {/* 資料多邊形 */}
      {polygons.map((poly, i) => (
        <g key={i}>
          <polygon points={poly.pointStr} fill={poly.color} fillOpacity="0.15" stroke={poly.color} strokeWidth="2" />
          {poly.points.map((p, j) => (
            <circle key={j} cx={p.x * scale} cy={p.y * scale} r={3} fill={poly.color} />
          ))}
        </g>
      ))}
      {/* 圖例 */}
      {datasets.length > 1 && (
        <g>
          {datasets.map((ds, i) => (
            <g key={i}>
              <rect x={10} y={r * 2 - 30 + i * 16} width={10} height={10} rx={2} fill={ds.color} />
              <text x={26} y={r * 2 - 21 + i * 16} fill="rgba(255,255,255,.6)" fontSize="10">{ds.label}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

// 輔助函式：從箭資料計算雷達圖數值（0~1 標準化）
export function computeRadarValues(arrows) {
  if (!arrows.length) return null;
  const scores = arrows.map(a => a.score);
  const total = scores.reduce((s, v) => s + v, 0);
  const missCount = scores.filter(s => s === 0).length;
  const xCount = arrows.filter(a => a.isX).length;
  const average = total / scores.length;

  // 將各項指標標準化到 0~1
  const averageNorm = Math.min(1, average / 10);         // 最高分10
  const hitRate = 1 - missCount / scores.length;          // 0~1
  const xRate = xCount / scores.length;                    // 0~1
  const stability = arrows.length > 1
    ? Math.max(0, 1 - (Math.sqrt(arrows.reduce((s, a) => s + (a.score - average) ** 2, 0) / arrows.length) / 5))
    : 0.5; // 標準差越小越穩定
  const fatigueDelta = arrows.length >= 6
    ? Math.max(0, 1 - Math.abs(
        arrows.slice(-Math.floor(arrows.length / 3)).reduce((s, a) => s + a.score, 0) / Math.floor(arrows.length / 3) -
        arrows.slice(0, Math.floor(arrows.length / 3)).reduce((s, a) => s + a.score, 0) / Math.floor(arrows.length / 3)
      ) / 5)
    : 0.5;

  return { average: averageNorm, hitRate, xRate, stability, antiFatigue: fatigueDelta };
}
