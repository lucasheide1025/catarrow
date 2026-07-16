// src/components/shared/charts/ShotGroupOverlay.jsx
// 多場箭群疊加 SVG 圖。支援多種疊加模式：
//   session 分場分色（各場不同色 + 群心漂移軌跡）
//   merged  全部合併（單色，看整體群形與群心）
//   phase   前段 vs 後段（每場前半/後半回合分色，看場內漂移）
//   heat    密度熱區（落點越密越亮）
// 座標為靶面正規化值（x 右+、y 下+，約 -1~1），僅 targetPlot 箭有值。

import { useMemo } from "react";

const S = 100, CX = S / 2, CY = S / 2, K = (S / 2) * 0.88;
const COLORS = ["#60a5fa", "#f59e0b", "#34d399", "#f472b6", "#a78bfa", "#fb923c", "#38bdf8", "#e879f9"];
const px = x => CX + x * K, py = y => CY + y * K;

function plotArrows(ends) {
  return (ends || []).flatMap(end => (end.arrows || []))
    .filter(a => a.captureMode === "targetPlot" && Number.isFinite(a.position?.x) && Number.isFinite(a.position?.y))
    .map(a => ({ x: a.position.x, y: a.position.y }));
}
function centroid(pts) {
  if (!pts.length) return null;
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
}

export default function ShotGroupOverlay({ sessions = [], size = 200, mode = "session" }) {
  const { layers, drift, showHeat } = useMemo(() => {
    // phase：每場依回合前半/後半拆成兩組再合併
    if (mode === "phase") {
      const front = [], back = [];
      sessions.forEach(s => {
        const ends = s.ends || [];
        const mid = Math.ceil(ends.length / 2);
        front.push(...plotArrows(ends.slice(0, mid)));
        back.push(...plotArrows(ends.slice(mid)));
      });
      const layers = [];
      if (front.length) layers.push({ pts: front, center: centroid(front), color: "#60a5fa", label: `前段（${front.length}箭）` });
      if (back.length) layers.push({ pts: back, center: centroid(back), color: "#fb923c", label: `後段（${back.length}箭）` });
      return { layers, drift: layers.map(l => l.center).filter(Boolean), showHeat: false };
    }
    // merged / heat：所有箭合併成一組
    if (mode === "merged" || mode === "heat") {
      const all = sessions.flatMap(s => plotArrows(s.ends));
      const layers = all.length ? [{ pts: all, center: centroid(all), color: COLORS[0], label: `全部（${all.length}箭）` }] : [];
      return { layers, drift: [], showHeat: mode === "heat" };
    }
    // session（預設）：每場一色 + 群心漂移
    const layers = [];
    sessions.forEach((s, i) => {
      const pts = plotArrows(s.ends);
      if (!pts.length) return;
      layers.push({ pts, center: centroid(pts), color: COLORS[i % COLORS.length], label: `${s.label || `第 ${i + 1} 場`}（${pts.length}箭）` });
    });
    return { layers, drift: layers.map(l => l.center).filter(Boolean), showHeat: false };
  }, [sessions, mode]);

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

        {/* 落點 */}
        {layers.map((layer, li) => (
          <g key={li}>
            {layer.pts.map((p, ai) => showHeat
              ? <circle key={ai} cx={px(p.x)} cy={py(p.y)} r={6} fill="#f97316" opacity={0.12} />
              : <circle key={ai} cx={px(p.x)} cy={py(p.y)} r={1.8} fill={layer.color} opacity={0.6} />
            )}
          </g>
        ))}

        {/* 群心漂移軌跡（session / phase） */}
        {drift.length > 1 && (
          <polyline points={drift.map(p => `${px(p.x)},${py(p.y)}`).join(" ")}
            fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" strokeDasharray="3,2" />
        )}

        {/* 群心點 */}
        {!showHeat && layers.map((layer, i) => layer.center && (
          <g key={`c${i}`}>
            <circle cx={px(layer.center.x)} cy={py(layer.center.y)} r={4} fill={layer.color} stroke="#0f172a" strokeWidth="1.5" />
            <circle cx={px(layer.center.x)} cy={py(layer.center.y)} r={1.5} fill="white" opacity={0.8} />
          </g>
        ))}
      </svg>

      {/* 圖例 */}
      <div className="flex flex-wrap gap-3 justify-center">
        {layers.map((layer, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(255,255,255,.6)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: showHeat ? "#f97316" : layer.color, display: "inline-block" }} />
            {layer.label}
          </div>
        ))}
      </div>
      {mode === "phase" && drift.length > 1 && (
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,.35)" }}>虛線 = 前段→後段群心漂移（看場內偏移）</p>
      )}
      {mode === "session" && drift.length > 1 && (
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,.35)" }}>虛線 = 各場群心漂移軌跡</p>
      )}
      {showHeat && <p className="text-[10px]" style={{ color: "rgba(255,255,255,.35)" }}>越亮＝落點越密集</p>}
    </div>
  );
}
