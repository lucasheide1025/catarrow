// src/components/shared/charts/ShotGroupOverlay.jsx
// 多場箭群疊加 SVG 圖：將多場 targetPlot 座標畫在同一張靶面上，
// 不同場次以不同顏色區分，顯示群心漂移軌跡。

import { useMemo } from "react";

const S = 100; // viewBox 尺寸
const CX = S / 2, CY = S / 2;
const COLORS = ["#60a5fa", "#f59e0b", "#34d399", "#f472b6", "#a78bfa", "#fb923c", "#38bdf8", "#e879f9"];

export default function ShotGroupOverlay({ sessions = [], size = 200 }) {
  const { layers, driftLine, counts } = useMemo(() => {
    const layers = [];
    const driftPoints = [];
    let totalArrows = 0;

    sessions.forEach((session, si) => {
      const ends = session.ends || [];
      const arrows = ends.flatMap(end => (end.arrows || []))
        .filter(a => a.captureMode === "targetPlot" && Number.isFinite(a.position?.x) && Number.isFinite(a.position?.y));
      if (!arrows.length) return;

      const color = COLORS[si % COLORS.length];
      const sumX = arrows.reduce((s, a) => s + a.position.x, 0);
      const sumY = arrows.reduce((s, a) => s + a.position.y, 0);
      const centerX = sumX / arrows.length;
      const centerY = sumY / arrows.length;

      layers.push({
        arrows: arrows.map(a => ({
          cx: CX + a.position.x * (S / 2 * 0.88),
          cy: CY + a.position.y * (S / 2 * 0.88),
        })),
        center: { cx: CX + centerX * (S / 2 * 0.88), cy: CY + centerY * (S / 2 * 0.88) },
        color,
        label: session.label || `第 ${si + 1} 場`,
        count: arrows.length,
      });
      driftPoints.push({ cx: CX + centerX * (S / 2 * 0.88), cy: CY + centerY * (S / 2 * 0.88), color, label: session.label || `第 ${si + 1} 場` });
      totalArrows += arrows.length;
    });

    return { layers, driftLine: driftPoints, counts: { sessions: layers.length, arrows: totalArrows } };
  }, [sessions]);

  if (!layers.length) return <div className="text-xs text-slate-500 text-center py-8">尚無靶面座標資料</div>;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${S} ${S}`} className="rounded-full bg-slate-950/40" style={{ width: size, height: size }}>
        {/* 靶面環 */}
        {[44, 35, 26, 17, 8].map(r => (
          <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="0.8" />
        ))}
        <line x1={S * 0.06} x2={S * 0.94} y1={CY} y2={CY} stroke="rgba(255,255,255,.1)" strokeWidth="0.6" />
        <line x1={CX} x2={CX} y1={S * 0.06} y2={S * 0.94} stroke="rgba(255,255,255,.1)" strokeWidth="0.6" />

        {/* 箭群落點 */}
        {layers.map((layer, li) => (
          <g key={li}>
            {layer.arrows.map((a, ai) => (
              <circle key={ai} cx={a.cx} cy={a.cy} r={1.8} fill={layer.color} opacity={0.6} />
            ))}
          </g>
        ))}

        {/* 群心漂移軌跡 */}
        {driftLine.length > 1 && (
          <polyline points={driftLine.map(p => `${p.cx},${p.cy}`).join(" ")}
            fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" strokeDasharray="3,2" />
        )}

        {/* 群心點 */}
        {driftLine.map((p, i) => (
          <g key={i}>
            <circle cx={p.cx} cy={p.cy} r={4} fill={p.color} stroke="#0f172a" strokeWidth="1.5" />
            <circle cx={p.cx} cy={p.cy} r={1.5} fill="white" opacity={0.8} />
          </g>
        ))}
      </svg>

      {/* 圖例 */}
      <div className="flex flex-wrap gap-3 justify-center">
        {layers.map((layer, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(255,255,255,.6)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: layer.color, display: "inline-block" }} />
            {layer.label}（{layer.count}箭）
          </div>
        ))}
      </div>
      {driftLine.length > 1 && (
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,.35)" }}>
          虛線 = 群心漂移軌跡
        </p>
      )}
    </div>
  );
}
