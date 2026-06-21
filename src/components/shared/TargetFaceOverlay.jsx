// src/components/shared/TargetFaceOverlay.jsx
// 戰鬥模式通用靶面輸入層（fixed overlay）

const RING_DEFS = {
  full_110: [
    { r:1.00, fill:"#d0d0d0", stroke:"#aaa" },
    { r:0.90, fill:"#d0d0d0", stroke:"#aaa" },
    { r:0.80, fill:"#1c1c1c", stroke:"#555" },
    { r:0.70, fill:"#1c1c1c", stroke:"#555" },
    { r:0.60, fill:"#1864ab", stroke:"#4a90d9" },
    { r:0.50, fill:"#1864ab", stroke:"#4a90d9" },
    { r:0.40, fill:"#c92a2a", stroke:"#e03131" },
    { r:0.30, fill:"#c92a2a", stroke:"#e03131" },
    { r:0.20, fill:"#e67700", stroke:"#f59f00" },
    { r:0.10, fill:"#e67700", stroke:"#f59f00" },
  ],
};

function calcTapScore(ratio) {
  if (ratio > 1) return "M";
  const ring = ratio <= 0 ? 0 : Math.ceil(ratio * 10);
  return ring === 0 ? 10 : Math.max(1, 11 - ring);
}

function TargetSVG({ R, onTap }) {
  const SIZE = R * 2 + 6, CX = R + 3, CY = R + 3;
  const rings = RING_DEFS.full_110;

  function handleTap(e) {
    if (!onTap) return;
    e.preventDefault();
    const svg = e.currentTarget.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    const px = (touch.clientX ?? touch.pageX) - svg.left;
    const py = (touch.clientY ?? touch.pageY) - svg.top;
    const dist = Math.sqrt((px - CX) ** 2 + (py - CY) ** 2);
    const ratio = dist / R;
    const score = calcTapScore(ratio);
    const nx = (px - CX) / R, ny = (py - CY) / R;
    onTap({ score, nx, ny });
  }

  return (
    <svg width={SIZE} height={SIZE}
      style={{ touchAction:"none", display:"block", cursor:"crosshair" }}
      onMouseDown={handleTap} onTouchStart={handleTap}>
      <circle cx={CX} cy={CY} r={R + 2} fill="#2a2a2a" />
      {rings.map((ring, i) => (
        <circle key={i} cx={CX} cy={CY} r={ring.r * R}
          fill={ring.fill} stroke={ring.stroke} strokeWidth={0.7} />
      ))}
      <line x1={CX-6} y1={CY} x2={CX+6} y2={CY} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
      <line x1={CX} y1={CY-6} x2={CX} y2={CY+6} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
      <circle cx={CX} cy={CY} r={R + 2} fill="none" stroke="#22c55e" strokeWidth={2.5} />
    </svg>
  );
}

function labelColor(label) {
  if (label === "M") return "#ef4444";
  const n = parseInt(label);
  if (n === 10) return "#f59f00";
  if (n >= 9) return "#f59f00";
  if (n >= 7) return "#ef4444";
  if (n >= 5) return "#3b82f6";
  if (n >= 3) return "#9ca3af";
  return "#6b7280";
}

export default function TargetFaceOverlay({
  open,
  arrowLabels = [],
  arrowsPerRound = 6,
  onArrow,
  onUndo,
  onSubmit,
}) {
  if (!open) return null;

  const done = arrowLabels.length >= arrowsPerRound;

  function handleTap({ score }) {
    if (done) return;
    const label = score === "M" ? "M" : String(score);
    onArrow?.(label);
  }

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      background:"rgba(0,0,0,0.88)",
      backdropFilter:"blur(6px)",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      gap:16, padding:"20px 16px",
    }}>
      <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, fontWeight:700, letterSpacing:1 }}>
        🎯 靶面計分 {arrowLabels.length}/{arrowsPerRound} 箭
      </div>

      {/* 箭槽 */}
      <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
        {Array.from({ length: arrowsPerRound }).map((_, i) => {
          const label = arrowLabels[i];
          const filled = i < arrowLabels.length;
          const active = i === arrowLabels.length;
          return (
            <div key={i} style={{
              width:34, height:34, borderRadius:8,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:13, fontWeight:900,
              background: filled ? `${labelColor(label)}22` : active ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.05)",
              border: `2px solid ${filled ? labelColor(label) : active ? "#3b82f6" : "rgba(255,255,255,0.1)"}`,
              color: filled ? labelColor(label) : "transparent",
              transition:"all 0.15s",
            }}>
              {label || ""}
            </div>
          );
        })}
      </div>

      {/* 靶面 */}
      <TargetSVG R={130} onTap={!done ? handleTap : null} />

      {/* 操作按鈕 */}
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <button
          onClick={onUndo}
          disabled={arrowLabels.length === 0}
          style={{
            padding:"10px 18px", borderRadius:12, border:"1px solid rgba(255,255,255,0.2)",
            background:"rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.7)",
            fontSize:13, fontWeight:700, cursor:"pointer", opacity: arrowLabels.length===0 ? 0.35 : 1,
          }}>
          ← 取消
        </button>

        <button
          onClick={() => onArrow?.("M")}
          disabled={done}
          style={{
            padding:"10px 18px", borderRadius:12, border:"1px solid rgba(239,68,68,0.5)",
            background:"rgba(239,68,68,0.15)", color:"#f87171",
            fontSize:13, fontWeight:900, cursor:"pointer", opacity: done ? 0.35 : 1,
          }}>
          脫靶 M
        </button>

        {done && (
          <button
            onClick={onSubmit}
            style={{
              padding:"10px 22px", borderRadius:12, border:"none",
              background:"linear-gradient(135deg,#7c3aed,#2563eb)",
              color:"white", fontSize:14, fontWeight:900, cursor:"pointer",
              boxShadow:"0 4px 20px rgba(124,58,237,0.5)",
            }}>
            ⚔️ 送出
          </button>
        )}
      </div>
    </div>
  );
}
