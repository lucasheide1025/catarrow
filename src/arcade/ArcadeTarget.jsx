// src/arcade/ArcadeTarget.jsx — BOSS 戰靶面輸入（世界王風格，單人與組隊共用）
// 點靶面射 6 箭，瞄準自己的弱點圈：
// - 同心環靶（貓小隊實際靶紙 half_17：X 內十 → 6~10 環 → M 脫靶）
// - 自己的弱點圈彩色高亮畫在靶面上（射進圈＝弱點攻擊）
// - 點一下射一支箭；按住拖曳有放大鏡可微調（手機上點得準）
// arrows: Array(6) of { nx, ny, label, score } | null
import { useState } from "react";
import { ARROWS_PER_ROUND } from "./arcadeBattle";
import { getTargetRings, resolveTargetHit } from "../lib/targetFace";
import { sfxTap } from "../lib/sound";

const BOSS_TARGET_FORMAT = "half_17"; // 6~10 環＋X，靶外 = M 脫靶（貓小隊實際靶紙）

export default function BossTarget({ ring, ringColor = "#f87171", arrows, onArrow, disabled = false }) {
  const R = 108;              // 靶紙半徑（px，SVG 座標系）
  const PAD = R * 1.34;       // 靶外可點區（脫靶也要點得到）
  const W = PAD * 2 + 8;
  const H = PAD * 2 + 8;
  const CX = W / 2;
  const CY = H / 2;
  const rings = getTargetRings(BOSS_TARGET_FORMAT);
  const [drag, setDrag] = useState(null);
  const shots = arrows.filter((a) => a && typeof a === "object");
  const full = shots.length >= ARROWS_PER_ROUND;

  function posOf(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = W / rect.width;
    return { px: (e.clientX - rect.left) * scale, py: (e.clientY - rect.top) * scale };
  }

  function commit(px, py) {
    if (full || disabled) return;
    const nx = (px - CX) / R;
    const ny = (py - CY) / R;
    const hit = resolveTargetHit(BOSS_TARGET_FORMAT, nx, ny);
    onArrow({ nx, ny, label: hit.label, score: hit.rawScore });
    sfxTap();
  }

  const dragLabel = drag
    ? resolveTargetHit(BOSS_TARGET_FORMAT, (drag.px - CX) / R, (drag.py - CY) / R).label
    : null;
  const ZOOM_SPAN = 46;

  // 放大鏡內容（與主靶面同一組圖形，用縮小 viewBox 再畫一次）
  const layers = () => (
    <>
      {rings.map((ring) => (
        <circle key={ring.score} cx={CX} cy={CY} r={ring.radius * R}
          fill={ring.fill} stroke={ring.stroke} strokeWidth="0.9" />
      ))}
      {ring && (
        <circle cx={CX + ring.cx * R} cy={CY + ring.cy * R} r={ring.radius * R}
          fill={ringColor} fillOpacity="0.22" stroke={ringColor} strokeWidth="2.5" />
      )}
      {arrows.map((a, i) => a && (
        <circle key={i} cx={CX + a.nx * R} cy={CY + a.ny * R} r="3.4"
          fill={a.label === "M" ? "#94a3b8" : a.label === "X" ? "#fde68a" : "#f8fafc"}
          stroke="#0f172a" strokeWidth="1.2" />
      ))}
      {drag && <circle cx={drag.px} cy={drag.py} r="1" fill="#fff" />}
    </>
  );

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: "100%", display: "block", margin: "0 auto", touchAction: "none",
          opacity: disabled ? 0.55 : 1, cursor: disabled ? "not-allowed" : "crosshair",
        }}
        onPointerDown={(e) => { if (disabled) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDrag(posOf(e)); }}
        onPointerMove={(e) => { if (!drag || disabled) return; e.preventDefault(); setDrag(posOf(e)); }}
        onPointerUp={(e) => { if (!drag || disabled) return; e.preventDefault(); const { px, py } = posOf(e); setDrag(null); commit(px, py); }}
      >
        <rect x="0" y="0" width={W} height={H} rx="16" fill="#0b1220" />
        {/* 靶外空間（脫靶可點） */}
        <circle cx={CX} cy={CY} r={PAD} fill="#111c30" stroke="#1e293b" strokeWidth="1" />
        {rings.map((ring) => (
          <circle key={ring.score} cx={CX} cy={CY} r={ring.radius * R}
            fill={ring.fill} stroke={ring.stroke} strokeWidth="0.9" />
        ))}
        {/* 自己的弱點圈：彩色高亮＋脈動＋圈心標記 */}
        {ring && (
          <g>
            <circle cx={CX + ring.cx * R} cy={CY + ring.cy * R} r={ring.radius * R}
              fill={ringColor} fillOpacity="0.22" stroke={ringColor} strokeWidth="2.5">
              <animate attributeName="fill-opacity" values="0.14;0.34;0.14" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle cx={CX + ring.cx * R} cy={CY + ring.cy * R} r={ring.radius * R * 0.5}
              fill="none" stroke={ringColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.9" />
            <circle cx={CX + ring.cx * R} cy={CY + ring.cy * R} r="1.8" fill={ringColor} />
          </g>
        )}
        {/* 已射出的箭 */}
        {arrows.map((a, i) => a && typeof a === "object" && (
          <g key={i}>
            <circle cx={CX + a.nx * R} cy={CY + a.ny * R} r="3.6"
              fill={a.label === "M" ? "#94a3b8" : a.label === "X" ? "#fde68a" : "#f8fafc"}
              stroke="#0f172a" strokeWidth="1.2" />
            <text x={CX + a.nx * R} y={CY + a.ny * R - 8} textAnchor="middle" fontSize="9" fontWeight="900" fill="#e2e8f0">
              {a.label === "X" ? "X" : a.label}
            </text>
          </g>
        ))}
        {full && (
          <text x={CX} y={CY + PAD - 10} textAnchor="middle" fontSize="11" fontWeight="900" fill="#f87171">
            已射滿 6 箭，送出攻擊！
          </text>
        )}
        {/* 拖曳十字線 */}
        {drag && (
          <g pointerEvents="none">
            <line x1={drag.px - 14} y1={drag.py} x2={drag.px + 14} y2={drag.py} stroke="#fff" strokeWidth="1" opacity=".8" />
            <line x1={drag.px} y1={drag.py - 14} x2={drag.px} y2={drag.py + 14} stroke="#fff" strokeWidth="1" opacity=".8" />
          </g>
        )}
      </svg>

      {/* 放大鏡：按住時浮在畫面頂端，拖曳微調再放開 */}
      {drag && (
        <div style={{
          position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
          zIndex: 10050, pointerEvents: "none", textAlign: "center",
        }}>
          <div style={{
            width: 172, height: 172, borderRadius: "50%", overflow: "hidden",
            border: `3px solid ${ringColor}`, boxShadow: "0 8px 30px rgba(0,0,0,.75)",
            background: "#0b1220",
          }}>
            <svg width="172" height="172"
              viewBox={`${drag.px - ZOOM_SPAN / 2} ${drag.py - ZOOM_SPAN / 2} ${ZOOM_SPAN} ${ZOOM_SPAN}`}>
              {layers()}
            </svg>
          </div>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900, color: "#fde68a", textShadow: "0 2px 10px rgba(0,0,0,.9)" }}>
            {dragLabel === "X" ? "X 滿分" : dragLabel === "M" ? "M 脫靶" : `${dragLabel} 環`}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.6)" }}>拖曳微調，放開就記錄</div>
        </div>
      )}
    </div>
  );
}
