// src/components/shared/charts/TrendLine.jsx
// 純 SVG 折線圖，零外部依賴。支援多條資料線、數據點、移動平均、tooltip 提示。
// 所有尺寸以 viewBox 為基準自動縮放，不需設定固定寬高。

import { useMemo, useState, useRef, useEffect } from "react";

const PAD = { top: 16, right: 16, bottom: 28, left: 36 };
const W = 600, H = 220;

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function TrendLine({ series = [], width = "100%", height = "auto", yLabel = "", formatY = v => v.toFixed(1) }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const rootRef = useRef(null);
  const [dim, setDim] = useState({ w: W, h: H });
  
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setDim(w => ({ ...w, w: entry.contentRect.width }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { paths, xLabels, yTicks, dots, hoverDot } = useMemo(() => {
    if (!series.length || !series[0].data.length) return { paths: [], xLabels: [], yTicks: [], dots: [], hoverDot: null };

    const allValues = series.flatMap(s => s.data.map(d => d.value));
    const yMax = Math.max(...allValues) * 1.15 || 10;
    const yMin = Math.min(0, Math.min(...allValues) * 0.85);
    const yRange = yMax - yMin || 1;

    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;

    const dataLen = series[0].data.length;
    const stepX = dataLen > 1 ? iw / (dataLen - 1) : iw / 2;

    function xPos(i) { return PAD.left + (dataLen > 1 ? i * stepX : iw / 2); }
    function yPos(v) { return PAD.top + ih - ((v - yMin) / yRange) * ih; }

    // Y axis ticks
    const tickCount = 5;
    const yTicks = Array.from({ length: tickCount }, (_, i) => {
      const v = yMin + (yRange * i) / (tickCount - 1);
      return { y: yPos(v), label: formatY(v) };
    });

    // X labels (show ~5 evenly spaced)
    const labelStep = Math.max(1, Math.floor(dataLen / 5));
    const xLabels = series[0].data
      .filter((_, i) => i % labelStep === 0 || i === dataLen - 1)
      .map((d, _, arr) => ({ x: xPos(series[0].data.indexOf(d)), label: formatDate(d.date) }));

    // Paths + dots per series
    const paths = series.map((s, si) => {
      const points = s.data.map((d, i) => `${xPos(i)},${yPos(d.value)}`).join(" ");
      return { d: points, color: s.color || ["#60a5fa", "#f59e0b", "#34d399"][si % 3], label: s.label };
    });

    const dots = series.map((s, si) => {
      return s.data.map((d, i) => ({
        cx: xPos(i), cy: yPos(d.value),
        value: d.value, date: d.date,
        color: s.color || ["#60a5fa", "#f59e0b", "#34d399"][si % 3],
        seriesIdx: si, dataIdx: i,
      }));
    });

    const hoverDotInfo = hoverIdx != null && series[0]?.data[hoverIdx]
      ? { x: xPos(hoverIdx), data: series.map(s => ({ label: s.label, value: s.data[hoverIdx]?.value, color: s.color })) }
      : null;

    return { paths, xLabels, yTicks, dots: dots.flat(), hoverDot: hoverDotInfo };
  }, [series, hoverIdx, formatY]);

  if (!series.length || !series[0].data.length) {
    return <div ref={rootRef} className="text-xs text-slate-500 text-center py-8" style={{ width }}>尚無足夠資料繪製趨勢圖</div>;
  }

  return (
    <div ref={rootRef} style={{ width, position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: height === "auto" ? undefined : height }}
        onMouseLeave={() => setHoverIdx(null)}>
        {/* Y軸網格線 */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="rgba(255,255,255,.08)" strokeWidth="1" />
            <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fill="rgba(255,255,255,.4)" fontSize="10">{t.label}</text>
          </g>
        ))}
        {/* X軸標籤 */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - PAD.bottom + 16} textAnchor="middle" fill="rgba(255,255,255,.35)" fontSize="10">{l.label}</text>
        ))}
        {/* Y軸標題 */}
        {yLabel && <text x={12} y={PAD.top + 8} textAnchor="start" fill="rgba(255,255,255,.3)" fontSize="9">{yLabel}</text>}
        {/* 折線 */}
        {paths.map((p, i) => (
          <g key={i}>
            <polyline points={p.d} fill="none" stroke={p.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
          </g>
        ))}
        {/* 數據點 - 透明寬命中區 */}
        {series[0]?.data.map((_, i) => {
          const cx = dots.filter(d => d.dataIdx === i)[0]?.cx;
          if (cx == null) return null;
          return <circle key={i} cx={cx} cy={H / 2} r={12} fill="transparent"
            onMouseEnter={() => setHoverIdx(i)} style={{ cursor: "pointer" }} />;
        })}
        {/* 數據點 - 可見圓點 */}
        {dots.filter(d => hoverIdx == null || d.dataIdx === hoverIdx).map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={hoverIdx === d.dataIdx ? 4.5 : 3}
            fill={d.color} stroke="#0f172a" strokeWidth="1.5"
            opacity={hoverIdx == null || hoverIdx === d.dataIdx ? 1 : 0.3} />
        ))}
        {/* Hover tooltip */}
        {hoverDot && (
          <g>
            <line x1={hoverDot.x} x2={hoverDot.x} y1={PAD.top} y2={H - PAD.bottom}
              stroke="rgba(255,255,255,.2)" strokeWidth="1" strokeDasharray="3,3" />
            <rect x={hoverDot.x + 8} y={PAD.top + 4} width={110} height={hoverDot.data.length * 22 + 10}
              rx="6" fill="#1e293b" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
            {hoverDot.data.map((d, i) => (
              <g key={i}>
                <circle cx={hoverDot.x + 18} cy={PAD.top + 16 + i * 22} r={4} fill={d.color} />
                <text x={hoverDot.x + 28} y={PAD.top + 20 + i * 22} fill="rgba(255,255,255,.7)" fontSize="11">{d.label}</text>
                <text x={hoverDot.x + 106} y={PAD.top + 20 + i * 22} textAnchor="end" fill="white" fontSize="11" fontWeight="bold">{formatY(d.value)}</text>
              </g>
            ))}
          </g>
        )}
      </svg>
      {/* 圖例 */}
      {series.length > 1 && (
        <div className="flex gap-4 justify-center mt-1">
          {series.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(255,255,255,.6)" }}>
              <span style={{ width: 10, height: 3, borderRadius: 2, background: s.color || "#60a5fa", display: "inline-block" }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
