// src/components/shared/TargetFaceOverlay.jsx
// 戰鬥模式通用靶面輸入層（fixed overlay）
import { useState } from "react";
import {
  TARGET_FACE_FORMATS,
  getTargetFaceFormat,
  getTargetRings,
  makeLandingRecord,
  normalizeTargetFormatId,
} from "../../lib/targetFace";

export const BATTLE_TARGET_FORMATS = TARGET_FACE_FORMATS.map(format => ({
  id:format.id,
  label:format.shortLabel,
  sub:format.sub,
}));

export const BATTLE_INPUT_MODES = [
  { id:"button", label:"點擊分數", icon:"⌨️" },
  { id:"target", label:"點擊靶面", icon:"🎯" },
];

export function getBattleTargetFmt() {
  return normalizeTargetFormatId(localStorage.getItem("battle_target_fmt") || "full_110");
}
export function setBattleTargetFmt(fmtId) {
  localStorage.setItem("battle_target_fmt", normalizeTargetFormatId(fmtId));
}
export function getBattleInputMode() {
  return localStorage.getItem("battle_input_mode") || "button";
}
export function setBattleInputMode(mode) {
  localStorage.setItem("battle_input_mode", mode);
}

export function TargetSVG({ fmtId, R, onTap, arrows = [], active = true }) {
  const SIZE = R * 2 + 6, CX = R + 3, CY = R + 3;
  const format = getTargetFaceFormat(fmtId);
  const rings = getTargetRings(format.id);
  const [dragPos, setDragPos] = useState(null);
  const ZOOM = 26; // 放大鏡的 SVG 半徑（放大倍率 ≈ 80/ZOOM ≈ 3x）

  function svgPos(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  }

  function handleDown(e) {
    if (!active || !onTap) return;
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
    if (!dragPos || !active || !onTap) return;
    e.preventDefault();
    const { px, py } = svgPos(e);
    setDragPos(null);
    onTap(makeLandingRecord(format.id, (px - CX) / R, (py - CY) / R));
  }

  const dragScore = dragPos
    ? makeLandingRecord(format.id, (dragPos.px - CX) / R, (dragPos.py - CY) / R).label
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
                  <circle key={ring.score} cx={CX} cy={CY} r={ring.radius * R}
                    fill={ring.fill} stroke={ring.stroke} strokeWidth={0.7} />
                ))}
                {format.innerTenRatio != null && (
                  <circle cx={CX} cy={CY} r={format.innerTenRatio * R}
                    fill="none" stroke="rgba(30,30,30,.7)" strokeWidth={0.7} />
                )}
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
        style={{ touchAction:"none", display:"block", cursor:active ? "crosshair" : "default", opacity:active ? 1 : 0.72 }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={() => setDragPos(null)}>
        <circle cx={CX} cy={CY} r={R + 2} fill="#2a2a2a" />
        {rings.map(ring => (
          <circle key={ring.score} cx={CX} cy={CY} r={ring.radius * R}
            fill={ring.fill} stroke={ring.stroke} strokeWidth={0.7} />
        ))}
        {format.innerTenRatio != null && (
          <circle cx={CX} cy={CY} r={format.innerTenRatio * R}
            fill="none" stroke="rgba(30,30,30,.7)" strokeWidth={0.7} />
        )}
        <line x1={CX-6} y1={CY} x2={CX+6} y2={CY} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
        <line x1={CX} y1={CY-6} x2={CX} y2={CY+6} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
        {active && <circle cx={CX} cy={CY} r={R + 2} fill="none" stroke="#22c55e" strokeWidth={2.5} />}
        {arrows.map((arrow, index) => (
          <g key={`${arrow.arrow ?? index}-${arrow.nx}-${arrow.ny}`}>
            <circle cx={CX + arrow.nx * R} cy={CY + arrow.ny * R} r={Math.max(5, R * 0.045)}
              fill="#15803d" stroke="white" strokeWidth={1.3} />
            <text x={CX + arrow.nx * R} y={CY + arrow.ny * R + 0.5}
              textAnchor="middle" dominantBaseline="middle" fill="white"
              fontSize={Math.max(6, R * 0.055)} fontWeight="900">
              {arrow.label || arrow.score}
            </text>
          </g>
        ))}
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

export function TargetFaceInput({
  fmtId = "full_110",
  arrowLabels = [],
  arrowPositions = [],
  arrowsPerRound = 6,
  onArrow,
  radius = 130,
}) {
  const format = getTargetFaceFormat(fmtId);
  if (format.layout !== "vertical_triple") {
    return (
      <TargetSVG fmtId={format.id} R={radius} arrows={arrowPositions}
        active={arrowLabels.length < arrowsPerRound} onTap={onArrow} />
    );
  }

  const arrowsPerFace = Math.max(1, Math.ceil(arrowsPerRound / 3));
  const activeFace = arrowLabels.length >= arrowsPerRound
    ? -1
    : Math.min(2, Math.floor(arrowLabels.length / arrowsPerFace));
  const faceRadius = Math.min(58, radius);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
      {[0, 1, 2].map(faceIndex => (
        <TargetSVG
          key={faceIndex}
          fmtId={format.id}
          R={faceRadius}
          arrows={arrowPositions.filter(position => (position.faceIndex || 0) === faceIndex)}
          active={faceIndex === activeFace}
          onTap={landing => onArrow?.({ ...landing, faceIndex })}
        />
      ))}
    </div>
  );
}

function labelColor(label) {
  if (label === "M") return "#ef4444";
  if (label === "X") return "#f59f00";
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
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:8 }}>
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
  arrowPositions = [],
  arrowsPerRound = 6,
  onArrow,
  onTargetArrow,
  onUndo,
  onSubmit,
  onClose,
}) {
  if (!open) return null;

  const done = arrowLabels.length >= arrowsPerRound;
  const fmtInfo = BATTLE_TARGET_FORMATS.find(f => f.id === fmtId) || BATTLE_TARGET_FORMATS[0];
  const format = getTargetFaceFormat(fmtId);

  function handleTap(landing) {
    if (done) return;
    if (onTargetArrow) onTargetArrow(landing);
    else onArrow?.(landing.label, landing);
  }

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      background:"rgba(0,0,0,0.88)",
      backdropFilter:"blur(6px)",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"flex-start",
      gap:14, padding:"16px 16px 20px",
      paddingTop:format.layout === "vertical_triple" ? "2dvh" : "12dvh",
      overflowY:"auto",
    }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", maxWidth:320 }}>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, fontWeight:700, letterSpacing:1 }}>
          🎯 {fmtInfo.label}（{fmtInfo.sub}）· {arrowLabels.length}/{arrowsPerRound} 箭
        </div>
        {onClose && (
          <button onClick={onClose} style={{
            padding:"4px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.2)",
            background:"rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.55)",
            fontSize:11, fontWeight:700, cursor:"pointer",
          }}>
            ⌨️ 換按鈕
          </button>
        )}
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
      <TargetFaceInput fmtId={fmtId} radius={130}
        arrowLabels={arrowLabels} arrowPositions={arrowPositions}
        arrowsPerRound={arrowsPerRound} onArrow={!done ? handleTap : null} />

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
