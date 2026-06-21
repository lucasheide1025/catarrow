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
  half_610: [
    { r:1.00, fill:"#1864ab", stroke:"#4a90d9" },
    { r:0.80, fill:"#c92a2a", stroke:"#e03131" },
    { r:0.60, fill:"#c92a2a", stroke:"#e03131" },
    { r:0.40, fill:"#e67700", stroke:"#f59f00" },
    { r:0.20, fill:"#e67700", stroke:"#f59f00" },
  ],
  field_16: [
    { r:1.00, fill:"#1c1c1c", stroke:"#555" },
    { r:5/6,  fill:"#1c1c1c", stroke:"#555" },
    { r:4/6,  fill:"#1c1c1c", stroke:"#555" },
    { r:3/6,  fill:"#1c1c1c", stroke:"#555" },
    { r:2/6,  fill:"#e67700", stroke:"#f59f00" },
    { r:1/6,  fill:"#e67700", stroke:"#f59f00" },
  ],
};

export const BATTLE_TARGET_FORMATS = [
  { id:"full_110", label:"全靶", sub:"1-10 環" },
  { id:"half_610", label:"半靶", sub:"6-10 環" },
  { id:"field_16", label:"原野", sub:"1-6 環" },
];

export function getBattleTargetFmt() {
  return localStorage.getItem("battle_target_fmt") || "full_110";
}
export function setBattleTargetFmt(fmtId) {
  localStorage.setItem("battle_target_fmt", fmtId);
}

function calcTapScore(ratio, fmtId) {
  if (ratio > 1) return "M";
  if (fmtId === "half_610") {
    const ring = ratio <= 0 ? 0 : Math.ceil(ratio * 5);
    return ring === 0 ? 10 : Math.max(6, 11 - ring);
  }
  if (fmtId === "field_16") {
    const ring = ratio <= 0 ? 0 : Math.ceil(ratio * 6);
    return ring === 0 ? 6 : Math.max(1, 7 - ring);
  }
  const ring = ratio <= 0 ? 0 : Math.ceil(ratio * 10);
  return ring === 0 ? 10 : Math.max(1, 11 - ring);
}

function TargetSVG({ fmtId, R, onTap }) {
  const SIZE = R * 2 + 6, CX = R + 3, CY = R + 3;
  const rings = RING_DEFS[fmtId] || RING_DEFS.full_110;

  function handleTap(e) {
    if (!onTap) return;
    e.preventDefault();
    const svg = e.currentTarget.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    const px = (touch.clientX ?? touch.pageX) - svg.left;
    const py = (touch.clientY ?? touch.pageY) - svg.top;
    const dist = Math.sqrt((px - CX) ** 2 + (py - CY) ** 2);
    const ratio = dist / R;
    const score = calcTapScore(ratio, fmtId);
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
  if (n >= 9) return "#f59f00";
  if (n >= 7) return "#ef4444";
  if (n >= 5) return "#3b82f6";
  if (n >= 3) return "#9ca3af";
  return "#6b7280";
}

// 靶面格式選擇器（可嵌入 lobby / setup 中）
export function TargetFmtPicker({ value, onChange }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.45)", letterSpacing:1 }}>
        🎯 靶面計分格式
      </div>
      <div style={{ display:"flex", gap:8 }}>
        {BATTLE_TARGET_FORMATS.map(fmt => {
          const active = value === fmt.id;
          return (
            <button key={fmt.id} onClick={() => onChange(fmt.id)} style={{
              flex:1, padding:"8px 4px", borderRadius:10,
              border:`2px solid ${active ? "#22c55e" : "rgba(255,255,255,0.12)"}`,
              background: active ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
              color: active ? "#4ade80" : "rgba(255,255,255,0.55)",
              fontSize:12, fontWeight:900, cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", gap:2,
              transition:"all 0.15s",
            }}>
              <span>{fmt.label}</span>
              <span style={{ fontSize:9, fontWeight:600, opacity:0.7 }}>{fmt.sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TargetFaceOverlay({
  open,
  fmtId = "full_110",
  arrowLabels = [],
  arrowsPerRound = 6,
  onArrow,
  onUndo,
  onSubmit,
}) {
  if (!open) return null;

  const done = arrowLabels.length >= arrowsPerRound;
  const fmtInfo = BATTLE_TARGET_FORMATS.find(f => f.id === fmtId) || BATTLE_TARGET_FORMATS[0];

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
      gap:14, padding:"20px 16px",
    }}>
      <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, fontWeight:700, letterSpacing:1 }}>
        🎯 {fmtInfo.label}（{fmtInfo.sub}）· {arrowLabels.length}/{arrowsPerRound} 箭
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
      <TargetSVG fmtId={fmtId} R={130} onTap={!done ? handleTap : null} />

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
