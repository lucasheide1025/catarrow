// src/components/shared/TargetFaceOverlay.jsx
// 戰鬥模式通用靶面輸入層（fixed overlay）
import { useState } from "react";

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

export const BATTLE_INPUT_MODES = [
  { id:"button", label:"點擊分數", icon:"⌨️" },
  { id:"target", label:"點擊靶面", icon:"🎯" },
];

export function getBattleTargetFmt() {
  return localStorage.getItem("battle_target_fmt") || "full_110";
}
export function setBattleTargetFmt(fmtId) {
  localStorage.setItem("battle_target_fmt", fmtId);
}
export function getBattleInputMode() {
  return localStorage.getItem("battle_input_mode") || "button";
}
export function setBattleInputMode(mode) {
  localStorage.setItem("battle_input_mode", mode);
}

function calcTapScore(ratio, fmtId) {
  if (ratio > 1) return "M";
  if (fmtId === "field_16") {
    const ring = ratio <= 0 ? 0 : Math.ceil(ratio * 6);
    return ring === 0 ? 6 : Math.max(1, 7 - ring);
  }
  if (fmtId === "half_610") {
    if (ratio < 0.20) return "X";  // 最內環 = X（10分）
    const ring = Math.ceil(ratio * 5);
    return Math.max(6, 11 - ring);
  }
  // full_110
  if (ratio < 0.10) return "X";   // 最內環 = X（10分）
  const ring = Math.ceil(ratio * 10);
  return Math.max(1, 11 - ring);
}

function TargetSVG({ fmtId, R, onTap }) {
  const SIZE = R * 2 + 6, CX = R + 3, CY = R + 3;
  const rings = RING_DEFS[fmtId] || RING_DEFS.full_110;
  const [dragPos, setDragPos] = useState(null);
  const ZOOM = 26; // 放大鏡的 SVG 半徑（放大倍率 ≈ 80/ZOOM ≈ 3x）

  function svgPos(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  }

  function handleDown(e) {
    if (!onTap) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragPos(svgPos(e));
  }

  function handleMove(e) {
    if (!dragPos) return;
    e.preventDefault();
    setDragPos(svgPos(e));
  }

  function handleUp(e) {
    if (!dragPos || !onTap) return;
    e.preventDefault();
    const { px, py } = dragPos;
    setDragPos(null);
    const dist = Math.sqrt((px - CX) ** 2 + (py - CY) ** 2);
    const score = calcTapScore(dist / R, fmtId);
    onTap({ score, nx: (px - CX) / R, ny: (py - CY) / R });
  }

  const dragScore = dragPos
    ? calcTapScore(Math.sqrt((dragPos.px - CX) ** 2 + (dragPos.py - CY) ** 2) / R, fmtId)
    : null;

  return (
    <>
      {/* 放大鏡（拖曳中固定顯示於畫面頂部） */}
      {dragPos && (
        <div style={{
          position:"fixed", top:14, left:"50%", transform:"translateX(-50%)",
          zIndex:10001, display:"flex", flexDirection:"column", alignItems:"center", gap:4,
          pointerEvents:"none",
        }}>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", fontWeight:700, letterSpacing:1 }}>
            放大確認
          </div>
          <div style={{ position:"relative" }}>
            <div style={{
              width:160, height:160, borderRadius:"50%", overflow:"hidden",
              border:"2px solid rgba(255,255,255,0.65)",
              boxShadow:"0 4px 24px rgba(0,0,0,0.7)",
            }}>
              <svg width={160} height={160}
                viewBox={`${dragPos.px - ZOOM} ${dragPos.py - ZOOM} ${ZOOM * 2} ${ZOOM * 2}`}>
                <rect x={dragPos.px - ZOOM} y={dragPos.py - ZOOM} width={ZOOM*2} height={ZOOM*2} fill="#2a2a2a" />
                {rings.map((ring, i) => (
                  <circle key={i} cx={CX} cy={CY} r={ring.r * R}
                    fill={ring.fill} stroke={ring.stroke} strokeWidth={0.7} />
                ))}
                <line x1={dragPos.px-3} y1={dragPos.py} x2={dragPos.px+3} y2={dragPos.py}
                  stroke="white" strokeWidth={0.6} />
                <line x1={dragPos.px} y1={dragPos.py-3} x2={dragPos.px} y2={dragPos.py+3}
                  stroke="white" strokeWidth={0.6} />
                <circle cx={dragPos.px} cy={dragPos.py} r={1} fill="white" />
              </svg>
            </div>
            <div style={{
              position:"absolute", bottom:-16, left:"50%", transform:"translateX(-50%)",
              background: dragScore === "M" ? "#dc2626" : "rgba(0,0,0,0.85)",
              color:"white", fontWeight:900, fontSize:24,
              borderRadius:8, padding:"1px 12px", whiteSpace:"nowrap",
            }}>
              {dragScore === "M" ? "脫靶" : dragScore === "X" ? "X 滿分" : `${dragScore} 環`}
            </div>
          </div>
        </div>
      )}

      {/* 靶面 SVG */}
      <svg width={SIZE} height={SIZE}
        style={{ touchAction:"none", display:"block", cursor:"crosshair" }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={() => setDragPos(null)}>
        <circle cx={CX} cy={CY} r={R + 2} fill="#2a2a2a" />
        {rings.map((ring, i) => (
          <circle key={i} cx={CX} cy={CY} r={ring.r * R}
            fill={ring.fill} stroke={ring.stroke} strokeWidth={0.7} />
        ))}
        <line x1={CX-6} y1={CY} x2={CX+6} y2={CY} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
        <line x1={CX} y1={CY-6} x2={CX} y2={CY+6} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
        <circle cx={CX} cy={CY} r={R + 2} fill="none" stroke="#22c55e" strokeWidth={2.5} />
        {dragPos && (
          <>
            <circle cx={dragPos.px} cy={dragPos.py} r={9}
              fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth={1.5}
              style={{ pointerEvents:"none" }} />
            <circle cx={dragPos.px} cy={dragPos.py} r={3}
              fill="white" style={{ pointerEvents:"none" }} />
          </>
        )}
      </svg>
    </>
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

export function InputModePicker({ value, onChange }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.45)", letterSpacing:1 }}>
        計分方式
      </div>
      <div style={{ display:"flex", gap:8 }}>
        {BATTLE_INPUT_MODES.map(mode => {
          const active = value === mode.id;
          return (
            <button key={mode.id} onClick={() => onChange(mode.id)} style={{
              flex:1, padding:"8px 4px", borderRadius:10,
              border:`2px solid ${active ? "#60a5fa" : "rgba(255,255,255,0.12)"}`,
              background: active ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.05)",
              color: active ? "#93c5fd" : "rgba(255,255,255,0.55)",
              fontSize:12, fontWeight:900, cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", gap:2,
              transition:"all 0.15s",
            }}>
              <span style={{ fontSize:16 }}>{mode.icon}</span>
              <span>{mode.label}</span>
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
      alignItems:"center", justifyContent:"flex-start",
      gap:14, padding:"16px 16px 20px",
      paddingTop:"20dvh",
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
