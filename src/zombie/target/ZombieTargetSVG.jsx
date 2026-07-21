// src/zombie/target/ZombieTargetSVG.jsx
// ═══════════════════════════════════════════════════════════════
//  🧟 殭屍靶面 SVG — 使用 ComfyUI 生成圖作為背景 + 透明點擊判定區
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback } from "react";
import { COLORS, ANIM, RADIUS } from "../ui/theme";

// ── ComfyUI 生成的全圖殭屍（背景用） ────────────────────
const ZOMBIE_IMAGES = {
  normal:  "/assets/zombie/zombie_normal.webp",
  fast:    "/assets/zombie/zombie_fast.webp",
  armored: "/assets/zombie/zombie_armored.webp",
  ranged:  "/assets/zombie/zombie_ranged.webp",
  boss:    "/assets/zombie/zombie_boss.webp",
};

// ── 身體部位定義（透明覆蓋圖層，對應背景殭屍的身體區域） ──
const BODY_ZONES = [
  {
    id: "head", label: "頭部",
    d: "M60,10 C60,0 140,0 140,10 C140,45 125,55 100,58 C75,55 60,45 60,10Z",
    fill: "rgba(107,114,128,0.25)", hoverFill: "rgba(239,68,68,0.55)", hitColor: "rgba(220,38,38,0.6)",
    instantKill: true,
  },
  {
    id: "neck", label: "頸部",
    d: "M80,55 L120,55 L125,72 L75,72Z",
    fill: "rgba(120,113,108,0.25)", hoverFill: "rgba(239,68,68,0.55)", hitColor: "rgba(220,38,38,0.6)",
    killChance: "50%",
  },
  {
    id: "chest", label: "胸腔",
    d: "M60,70 L140,70 L148,95 L145,130 L55,130 L52,95Z",
    fill: "rgba(87,83,78,0.2)", hoverFill: "rgba(249,115,22,0.5)", hitColor: "rgba(234,88,12,0.55)",
    lethalCount: 3,
  },
  {
    id: "belly", label: "腹部",
    d: "M62,128 L138,128 L142,168 L58,168Z",
    fill: "rgba(68,64,60,0.2)", hoverFill: "rgba(249,115,22,0.5)", hitColor: "rgba(234,88,12,0.55)",
    lethalCount: 3,
  },
  {
    id: "arm_left", label: "左臂",
    d: "M40,70 L62,68 L62,130 L52,132 L38,110 L30,85Z",
    fill: "rgba(87,83,78,0.2)", hoverFill: "rgba(234,179,8,0.5)", hitColor: "rgba(202,138,4,0.55)",
    knockback: 1,
  },
  {
    id: "arm_right", label: "右臂",
    d: "M138,68 L160,70 L170,85 L168,110 L148,132 L138,130Z",
    fill: "rgba(87,83,78,0.2)", hoverFill: "rgba(234,179,8,0.5)", hitColor: "rgba(202,138,4,0.55)",
    knockback: 1,
  },
  {
    id: "groin", label: "鼠蹊",
    d: "M70,168 L130,168 L135,190 L120,210 L80,210 L65,190Z",
    fill: "rgba(41,37,36,0.2)", hoverFill: "rgba(168,85,247,0.5)", hitColor: "rgba(147,51,234,0.55)",
    slowEffect: true,
  },
];

const LOCKED_ZONES = [
  { id: "heart", label: "心臟", cx: 97, cy: 95, r: 6, unlockFrom: "chest", mult: 1.50, fill: "rgba(153,27,27,0.7)" },
  { id: "lung", label: "肺葉", cx: 115, cy: 98, r: 5, unlockFrom: "chest", mult: 1.35, fill: "rgba(127,29,29,0.7)" },
  { id: "kidney", label: "腎臟", cx: 105, cy: 142, r: 5, unlockFrom: "belly", mult: 1.30, fill: "rgba(113,63,18,0.7)" },
  { id: "balls", label: "要害", cx: 100, cy: 198, r: 5, unlockFrom: "groin", mult: 1.40, fill: "rgba(88,28,135,0.7)" },
];

// ── ZombieTargetSVG ────────────────────────────────────────
export default function ZombieTargetSVG({
  zombie, active = true, hits = {}, onHit,
  width = 200, height = 260,
}) {
  const [hoveredPart, setHoveredPart] = useState(null);
  const [clickedPart, setClickedPart] = useState(null);

  const handleMouseEnter = useCallback((partId) => {
    if (active) setHoveredPart(partId);
  }, [active]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPart(null);
  }, []);

  const handleClick = useCallback((partId) => {
    if (!active || !onHit) return;
    setClickedPart(partId);
    onHit(partId);
    setTimeout(() => setClickedPart(null), 300);
  }, [active, onHit]);

  const [imgLoaded, setImgLoaded] = useState(false);

  const archetypeId = zombie?.archetypeId || "normal";
  const archetypeColor = zombie?.color || "#6b7280";
  const archName = zombie?.name || "普通殭屍";
  const dist = zombie?.distanceM ?? "?";
  const alive = zombie?.alive !== false;
  const statuses = zombie?.statuses || [];
  const zombieImg = ZOMBIE_IMAGES[archetypeId] || ZOMBIE_IMAGES.normal;

  const zoneCoords = {
    head: [100, 30], neck: [100, 62], chest: [100, 98],
    belly: [100, 148], arm_left: [52, 98], arm_right: [148, 98],
    groin: [100, 190],
  };

  return (
    <div style={{ position: "relative", width, height, userSelect: "none" }}>
      {/* 殭屍資訊欄 */}
      <div style={{
        position: "absolute", top: -32, left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 10, fontWeight: 600, color: COLORS.textDim,
        padding: "0 4px",
      }}>
        <span>{archName}</span>
        <span style={{
          color: dist <= 3 ? COLORS.red : dist <= 6 ? COLORS.amber : COLORS.green,
          fontWeight: 900,
          textShadow: dist <= 3 ? `0 0 8px ${COLORS.redGlow}` : "none",
        }}>
          {dist}m
        </span>
      </div>

      <svg width={width} height={height} viewBox="0 0 200 260"
        style={{
          display: "block", touchAction: "none",
          cursor: active ? "crosshair" : "default",
          opacity: alive ? 1 : 0.35,
          filter: alive ? "none" : "grayscale(1)",
        }}
      >
        {/* 背景脫靶區 */}
        <rect x="2" y="2" width="196" height="256" rx={10}
          fill={active && hoveredPart === "miss" ? "rgba(239,68,68,0.06)" : "rgba(0,0,0,0.15)"}
          stroke={active && hoveredPart === "miss" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.04)"}
          strokeWidth={1.5} strokeDasharray={active && hoveredPart === "miss" ? "none" : "4,3"}
          onClick={() => handleClick("miss")}
          onMouseEnter={() => handleMouseEnter("miss")}
          onMouseLeave={handleMouseLeave}
          style={{ transition: `all ${ANIM.fast}` }}
        />

        {/* 🧟 背景：ComfyUI 生成的殭屍全圖（onLoad 後淡入） */}
        <image
          href={zombieImg}
          crossOrigin="anonymous"
          x="5" y="5" width="190" height="250"
          preserveAspectRatio="xMidYMid meet"
          opacity={imgLoaded ? (alive ? 0.92 : 0.35) : 0}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgLoaded(true)} {/* 圖片失敗時仍顯示點擊區，不卡死 */}
          style={{
            transition: `opacity ${ANIM.normal}`,
            filter: alive ? "drop-shadow(0 0 8px rgba(0,0,0,0.5))" : "none",
          }}
        />

        {/* 載入中：SVG 輪廓佔位骨架（圖片載入後淡出） */}
        {!imgLoaded && alive && (
          <g style={{ opacity: 0.6 }}>
            {BODY_ZONES.map(zone => (
              <path key={zone.id} d={zone.d}
                fill={zone.fill.replace("0.2", "0.35").replace("0.25", "0.4")}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={0.8}
              />
            ))}
            {/* 中央脈衝文字 */}
            <text x={100} y={130} textAnchor="middle"
              fill="rgba(255,255,255,0.3)" fontSize={10} fontWeight={600}
              letterSpacing={2}>
              LOADING
              <animate attributeName="opacity" values="0.3;0.1;0.3" dur="1.2s" repeatCount="indefinite" />
            </text>
          </g>
        )}

        {/* 背景暗色覆蓋（讓透明點擊區更清晰） */}
        <rect x="5" y="5" width="190" height="250" rx={10}
          fill="rgba(0,0,0,0.08)"
          pointerEvents="none"
        />

        {/* 🎯 身體部位透明覆蓋層 ──────────────────────── */}
        {BODY_ZONES.map((zone) => {
          const hitCount = hits[zone.id] || 0;
          const isHovered = active && hoveredPart === zone.id;
          const isClicked = clickedPart === zone.id;

          let fillColor = zone.fill;
          if (isClicked) fillColor = zone.hitColor;
          else if (isHovered) fillColor = zone.hoverFill;
          else if (hitCount > 0) {
            fillColor = zone.hitColor.replace("0.55", "0.7");
          }

          return (
            <g key={zone.id}>
              <path d={zone.d}
                fill={fillColor}
                stroke={isHovered ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.08)"}
                strokeWidth={isHovered ? 2 : 0.5}
                opacity={imgLoaded ? 1 : 0} {/* 載入中隱藏，只顯示 skeleton */}
                style={{ transition: `fill ${ANIM.fast}, stroke ${ANIM.fast}, opacity ${ANIM.normal}` }}
                onClick={() => handleClick(zone.id)}
                onMouseEnter={() => handleMouseEnter(zone.id)}
                onMouseLeave={handleMouseLeave}
              />
              {/* hover 光暈 */}
              {isHovered && (
                <path d={zone.d}
                  fill="none" stroke={zone.hoverFill}
                  strokeWidth={4} opacity={0.5}
                  style={{ pointerEvents: "none" }}
                >
                  <animate attributeName="opacity" values="0.5;0.2;0.5" dur="1.5s" repeatCount="indefinite" />
                </path>
              )}
              {/* 部位標籤 */}
              {isHovered && (
                <text x={100} y={250} textAnchor="middle"
                  fill="white" fontSize={9} fontWeight={700}
                  style={{ pointerEvents: "none" }}>
                  {zone.label} {zone.instantKill ? "⚡一箭" : zone.killChance ? `🎲${zone.killChance}` : zone.lethalCount ? `×${zone.lethalCount}` : ""}
                </text>
              )}
              {/* 命中標記 — 小圓點 */}
              {hitCount > 0 && (
                <circle cx={zoneCoords[zone.id][0]} cy={zoneCoords[zone.id][1]}
                  r={3 + hitCount * 1}
                  fill="none" stroke={zone.hitColor}
                  strokeWidth={1.5} opacity={0.7}
                >
                  <animate attributeName="r"
                    values={`${3 + hitCount * 1};${5 + hitCount * 1};${3 + hitCount * 1}`}
                    dur="1s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}

        {/* 🔒 鎖定部位 */}
        {LOCKED_ZONES.map((zone) => {
          const isUnlocked = hits[zone.unlockFrom] > 0;
          const hitCount = hits[zone.id] || 0;
          if (!isUnlocked && hitCount === 0) return null;
          return (
            <g key={zone.id}>
              <circle cx={zone.cx} cy={zone.cy} r={zone.r}
                fill={zone.fill}
                stroke={hitCount > 0 ? "#fff" : "rgba(255,255,255,0.3)"}
                strokeWidth={hitCount > 0 ? 2 : 0.5}
                style={{ transition: `all ${ANIM.normal}` }}>
                <title>{zone.label} (×{zone.mult})</title>
              </circle>
              {hitCount > 0 && (
                <circle cx={zone.cx} cy={zone.cy} r={zone.r + 3}
                  fill="none" stroke="#fff" strokeWidth={0.5} opacity={0.3}>
                  <animate attributeName="r" values={`${zone.r + 3};${zone.r + 5};${zone.r + 3}`}
                    dur="2s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}

        {/* 狀態標記 */}
        {statuses.includes("slowed") && (
          <text x="175" y="20" textAnchor="end" fontSize={9} fill={COLORS.amber} fontWeight={600}>🐢 減速</text>
        )}
        {statuses.includes("arm_destroyed") && (
          <text x="175" y="34" textAnchor="end" fontSize={9} fill={COLORS.red} fontWeight={600}>🦾 手臂失效</text>
        )}
        {statuses.includes("pelvis_hit") && (
          <text x="175" y="48" textAnchor="end" fontSize={9} fill={COLORS.purple} fontWeight={600}>🎯 骨盆命中</text>
        )}
      </svg>

      {/* 命中計數條 */}
      {Object.keys(hits).length > 0 && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          display: "flex", gap: 4, flexWrap: "wrap",
          padding: "4px 8px",
          background: "rgba(0,0,0,0.55)",
          borderRadius: RADIUS.md,
          fontSize: 9, fontWeight: 600,
          backdropFilter: "blur(4px)",
        }}>
          {Object.entries(hits).filter(([, c]) => c > 0).map(([part, count]) => (
            <span key={part} style={{
              padding: "1px 6px", borderRadius: 4,
              background: `${COLORS.red}22`,
              color: COLORS.text,
            }}>
              {getPartLabel(part)}: {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 雙面靶位配置 ─────────────────────────────────────────
export function ZombieTargetGrid({ zombies, hits = {}, activeSlot, onHit, onSelectSlot, slotLabels = ["A","B","C","D"] }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: 14,
      justifyItems: "center",
    }}>
      {slotLabels.map((slot) => {
        const zombie = zombies?.find(z => z.targetSlot === slot);
        return (
          <div key={slot} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            opacity: zombie && !zombie.alive ? 0.5 : 1,
          }}>
            <div onClick={() => onSelectSlot?.(slot)}
              style={{
                width: 36, height: 36, borderRadius: RADIUS.md,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 900, cursor: "pointer",
                background: activeSlot === slot ? `${COLORS.green}22` : COLORS.glass,
                border: `2px solid ${activeSlot === slot ? COLORS.green : COLORS.glassBorder}`,
                color: activeSlot === slot ? COLORS.green : COLORS.textDim,
                marginBottom: 8,
                transition: `all ${ANIM.fast}`,
                boxShadow: activeSlot === slot ? `0 0 12px ${COLORS.greenGlow}` : "none",
                transform: activeSlot === slot ? "scale(1.08)" : "scale(1)",
              }}>
              {slot}
            </div>
            {zombie ? (
              <ZombieTargetSVG
                zombie={zombie} active={activeSlot === slot}
                hits={hits[zombie.id] || {}}
                onHit={(part) => onHit?.(slot, zombie.id, part)}
                width={150} height={200}
              />
            ) : (
              <div style={{
                width: 150, height: 200,
                borderRadius: RADIUS.lg,
                border: "2px dashed rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, color: "rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
              }}>
                ⬜
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 輔助 ────────────────────────────────────────────────
function getPartLabel(partId) {
  const labels = {
    head: "頭部", neck: "頸部", chest: "胸腔", belly: "腹部",
    arm_left: "左臂", arm_right: "右臂", groin: "鼠蹊",
    heart: "心臟", lung: "肺葉", kidney: "腎臟", balls: "要害",
  };
  return labels[partId] || partId;
}

export { BODY_ZONES, LOCKED_ZONES };
