// src/worldboss/ui/RaidTarget.jsx
// 討伐專用靶面輸入。**強制使用**（不再提供「點分數」模式）——
// 弱點的判定要靠落點，按分數鍵給不出位置。
//
// 跟共用的 TargetFaceOverlay 差在四件事，所以另外寫一支而不是改共用元件
// （共用的那支還有地下城/組隊/決鬥/打怪四個地方在用，改它風險太高）：
//   ① **靶外空間**：靶紙外圍留一圈可點區，脫靶也要點得到、也要記到位置
//   ② **弱點圈**：每回合 1~2 個彩色圈畫在靶紙上（大小＝難度、顏色＝報酬）
//   ③ **三連靶橫排**：作者要求左/中/右各一張（共用元件的 triple 是直式）
//   ④ **放大鏡**：手指按住時畫面中央浮出放大視窗，可以拖曳微調再放開
//      （手機上靶面很小，沒有放大鏡根本點不準——這是能不能玩的關鍵）
//   ⑤ 即時顯示標準環值（半靶只有 6~10 環，印在紙上的環數跨靶紙不能比）
import { useState } from "react";
import { getTargetFaceFormat, getTargetRings } from "../../lib/targetFace";
import { faceCountOf, maxArrowsPerFace } from "../domain/raidFaces";
import { standardScoreFromRatio } from "../domain/weakPoints";

// 靶外可點的比例：1.0 = 靶紙邊緣，1.3 = 再往外 30%
const OUTSIDE_PAD = 1.3;
const FACE_LABELS = ["左", "中", "右"];

export default function RaidTarget({
  fmtId = "half_17",
  spots = [],             // [{ id, color, radius, cx, cy, faceIndex }]
  arrows = [],            // [{ nx, ny, faceIndex, bullseye }]
  onArrow,
  disabled = false,
  radius = 120,
}) {
  const faceCount = faceCountOf(fmtId);
  const cap = maxArrowsPerFace(fmtId);
  const usedOn = i => arrows.filter(a => (a.faceIndex || 0) === i).length;
  const isFull = i => cap != null && usedOn(i) >= cap;
  // 多張靶時每張要縮小才排得下
  const R = faceCount > 1 ? radius / 1.8 : radius;
  const PAD = R * OUTSIDE_PAD;
  const GAP = faceCount > 1 ? R * 0.3 : 0;
  const W = faceCount * PAD * 2 + (faceCount - 1) * GAP + 8;
  const H = PAD * 2 + 8;
  const CY = H / 2;
  const centreX = i => 4 + PAD + i * (PAD * 2 + GAP);

  const format = getTargetFaceFormat(fmtId);
  const rings = getTargetRings(format.id);
  const [drag, setDrag] = useState(null);

  function posOf(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = W / rect.width;
    return { px: (e.clientX - rect.left) * scale, py: (e.clientY - rect.top) * scale };
  }

  // 落點屬於哪一張靶：取最近的那張（三連靶時點哪張就算哪張）
  function faceOf(px, py) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < faceCount; i += 1) {
      const d = Math.hypot(px - centreX(i), py - CY);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function commit(px, py) {
    // ⚠️ **不鎖定**（作者 2026-07-31）：玩家可能多射、或箭脫靶跑到別張去。
    //    射出去的箭收不回來，擋輸入等於不承認現實——照收，但超過上限那箭不算傷害。
    const faceIndex = faceOf(px, py);
    const nx = (px - centreX(faceIndex)) / R;
    const ny = (py - CY) / R;
    const ratio = Math.sqrt(nx * nx + ny * ny);
    const rawScore = ratio > 1 ? 0
      : Math.max(format.minScore,
        format.maxScore - Math.ceil(ratio * (format.maxScore - format.minScore + 1)) + 1);
    const label = ratio > 1 ? "M"
      : (format.innerTenRatio != null && ratio <= format.innerTenRatio ? "X" : String(rawScore));
    onArrow?.({
      nx, ny, faceIndex, ratio, label,
      score: rawScore, standardScore: standardScoreFromRatio(ratio),
    });
  }

  // 放大鏡：把同一組圖形用縮小的 viewBox 再畫一次＝放大
  const ZOOM_SPAN = 46;        // 放大鏡看得到的 SVG 範圍（越小倍率越高）
  const dragFace = drag ? faceOf(drag.px, drag.py) : 0;
  const dragScore = drag
    ? standardScoreFromRatio(Math.hypot((drag.px - centreX(dragFace)) / R, (drag.py - CY) / R))
    : null;

  // 靶面本體（放大鏡要用同一組圖形再畫一次，所以抽成函式）
  const faceLayers = () => (
    <>
      {Array.from({ length: faceCount }).map((_, i) => (
        <g key={`z${i}`}>
          <circle cx={centreX(i)} cy={CY} r={PAD} fill="#111c30" stroke="#1e293b" strokeWidth="1" />
          {rings.map(ring => (
            <circle key={ring.score} cx={centreX(i)} cy={CY} r={ring.radius * R}
              fill={ring.fill} stroke={ring.stroke} strokeWidth="0.8" />
          ))}
        </g>
      ))}
      {spots.map(spot => (
        <circle key={`zs${spot.key || spot.id}`}
          cx={centreX(spot.faceIndex || 0) + spot.cx * R} cy={CY + spot.cy * R}
          r={spot.radius * R} fill={spot.color} fillOpacity="0.28"
          stroke={spot.color} strokeWidth="1.5" />
      ))}
      {arrows.map((a, i) => (
        <circle key={`za${i}`} cx={centreX(a.faceIndex || 0) + a.nx * R} cy={CY + a.ny * R}
          r="3" fill="#f8fafc" stroke="#0f172a" strokeWidth="1" />
      ))}
    </>
  );

  return (
    <div style={{ position: "relative" }}>
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{
        width: "100%", display: "block", margin: "0 auto", touchAction: "none",
        opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "crosshair",
      }}
      onPointerDown={e => { if (disabled) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDrag(posOf(e)); }}
      onPointerMove={e => { if (!drag || disabled) return; e.preventDefault(); setDrag(posOf(e)); }}
      onPointerUp={e => { if (!drag || disabled) return; e.preventDefault(); const { px, py } = posOf(e); setDrag(null); commit(px, py); }}
    >
      {/* 靶外空間：一定要有，不然脫靶的箭點不下去 */}
      <rect x="0" y="0" width={W} height={H} rx="14" fill="#0b1220" />

      {Array.from({ length: faceCount }).map((_, i) => (
        <g key={i}>
          <circle cx={centreX(i)} cy={CY} r={PAD} fill="#111c30" stroke="#1e293b" strokeWidth="1" />
          {rings.map(ring => (
            <circle key={ring.score} cx={centreX(i)} cy={CY} r={ring.radius * R}
              fill={ring.fill} stroke={ring.stroke} strokeWidth="0.8" />
          ))}
          {format.innerTenRatio != null && (
            <circle cx={centreX(i)} cy={CY} r={format.innerTenRatio * R}
              fill="none" stroke="rgba(30,30,30,.75)" strokeWidth="0.8" />
          )}
          {/* 滿了就壓暗＋標示，但還是可以點（多射的箭照樣記，只是不算傷害） */}
          {isFull(i) && (
            <circle cx={centreX(i)} cy={CY} r={PAD} fill="rgba(2,6,23,.55)" />
          )}
          {faceCount > 1 && (
            <text x={centreX(i)} y={CY + PAD - 3} textAnchor="middle" fontSize="10"
              fill={isFull(i) ? "#f87171" : "#94a3b8"} fontWeight="900">
              {FACE_LABELS[i] || i + 1}{cap != null ? `　${usedOn(i)}/${cap}` : ""}
              {isFull(i) ? " 已滿" : ""}
            </text>
          )}
        </g>
      ))}

      {/* 弱點圈：每回合 1~2 個、位置隨機。三連靶時可能分在不同張上 */}
      {spots.map(spot => {
        const cx = centreX(spot.faceIndex || 0) + spot.cx * R;
        const cy = CY + spot.cy * R;
        return (
          <g key={spot.key || spot.id}>
            <circle cx={cx} cy={cy} r={spot.radius * R}
              fill={spot.color} fillOpacity="0.22" stroke={spot.color} strokeWidth="2.5">
              <animate attributeName="fill-opacity" values="0.16;0.34;0.16" dur="1.8s" repeatCount="indefinite" />
            </circle>
            {/* 圈心一半的範圍＝正中加碼（只加傷害，不加破防） */}
            <circle cx={cx} cy={cy} r={spot.radius * R * 0.5}
              fill="none" stroke={spot.color} strokeWidth="1" strokeDasharray="3 3" opacity="0.85" />
            <circle cx={cx} cy={cy} r="1.8" fill={spot.color} />
          </g>
        );
      })}

      {/* 已射出的箭 */}
      {arrows.map((a, i) => {
        const ax = centreX(a.faceIndex || 0) + a.nx * R;
        const ay = CY + a.ny * R;
        // 這一箭是不是這張靶的第 3 箭以後（超過上限＝不算傷害，畫成灰的）
        const over = cap != null
          && arrows.slice(0, i).filter(b => (b.faceIndex || 0) === (a.faceIndex || 0)).length >= cap;
        return (
          <g key={i}>
            <circle cx={ax} cy={ay} r={a.bullseye ? 4.5 : 3.5}
              fill={over ? "#475569" : a.bullseye ? "#fde68a" : "#f8fafc"}
              stroke="#0f172a" strokeWidth="1.5" opacity={over ? 0.7 : 1} />
            {a.bullseye && (
              <circle cx={ax} cy={ay} r="8" fill="none" stroke="#fde68a" strokeWidth="1" opacity=".8" />
            )}
          </g>
        );
      })}

      {/* 拖曳中：靶面上的十字線 */}
      {drag && (
        <g pointerEvents="none">
          <line x1={drag.px - 14} y1={drag.py} x2={drag.px + 14} y2={drag.py} stroke="#fff" strokeWidth="1" opacity=".8" />
          <line x1={drag.px} y1={drag.py - 14} x2={drag.px} y2={drag.py + 14} stroke="#fff" strokeWidth="1" opacity=".8" />
          <circle cx={drag.px} cy={drag.py} r="2" fill="#fff" />
        </g>
      )}
    </svg>

    {/* 放大鏡：按住時浮在畫面中央，可以拖曳微調再放開。手機上沒有這個點不準。 */}
    {drag && (
      <div style={{
        // 釘在畫面頂端：手指在下半部操作，放大鏡不能擋住靶面（矮視窗用 % 會壓到）
        position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
        zIndex: 10050, pointerEvents: "none", textAlign: "center",
      }}>
        <div style={{
          width: 172, height: 172, borderRadius: "50%", overflow: "hidden",
          border: "3px solid rgba(255,255,255,.75)", boxShadow: "0 8px 30px rgba(0,0,0,.75)",
          background: "#0b1220",
        }}>
          <svg width="172" height="172"
            viewBox={`${drag.px - ZOOM_SPAN / 2} ${drag.py - ZOOM_SPAN / 2} ${ZOOM_SPAN} ${ZOOM_SPAN}`}>
            {faceLayers()}
            <line x1={drag.px - 5} y1={drag.py} x2={drag.px + 5} y2={drag.py} stroke="#fff" strokeWidth="0.5" />
            <line x1={drag.px} y1={drag.py - 5} x2={drag.px} y2={drag.py + 5} stroke="#fff" strokeWidth="0.5" />
            <circle cx={drag.px} cy={drag.py} r="0.9" fill="#fff" />
          </svg>
        </div>
        <div style={{
          marginTop: 6, fontSize: 20, fontWeight: 900, color: "#fde68a",
          textShadow: "0 2px 10px rgba(0,0,0,.9)",
        }}>
          {dragScore || "M"} 環
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.6)" }}>拖曳微調，放開就記錄</div>
      </div>
    )}
    </div>
  );
}
