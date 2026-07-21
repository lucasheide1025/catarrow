// src/zombie/ui/ZombieMapIsometric.jsx
// ═══════════════════════════════════════════════════════════════
//  🗺️ 殭屍生存 — 2.5D 等角節點地圖（SVG 渲染）
//  大尺寸菱形、立體道路、角色移動動畫、互動節點
// ═══════════════════════════════════════════════════════════════

import { useMemo, useRef, useState, useEffect } from "react";
import { computeNodeLayout } from "../domain/mapEngine";
import { ZONE_TYPE } from "../domain/types";
import { COLORS } from "./theme";
import { ANIM_DURATION } from "../style/zombieAnimations";

// ── 等角投影參數 ─────────────────────────────────────────
const TILE_W = 110;       // 菱形寬度
const TILE_H = 55;        // 菱形高度
const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;
const THICKNESS = 14;     // 平台厚度（3D 擠出高度）
const SHADOW_OX = 10;     // 陰影水平偏移
const SHADOW_OY = 12;     // 陰影垂直偏移

// ── 工具函式 ────────────────────────────────────────────
/** 16 進制色 → rgba 字串 */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── 區域顏色對照（擴充 side 立體牆面顏色） ───────────────
const ZONE_STYLES = {
  [ZONE_TYPE.SAFE]:       { fill: "#22c55e", stroke: "#16a34a", glow: "rgba(34,197,94,0.5)",  label: "🟢", label2: "安全區" },
  [ZONE_TYPE.NORMAL]:     { fill: "#eab308", stroke: "#ca8a04", glow: "rgba(234,179,8,0.5)",  label: "🟡", label2: "普通區" },
  [ZONE_TYPE.DANGER]:     { fill: "#f97316", stroke: "#ea580c", glow: "rgba(249,115,22,0.5)", label: "🟠", label2: "危險區" },
  [ZONE_TYPE.HIGH_RISK]:  { fill: "#ef4444", stroke: "#dc2626", glow: "rgba(239,68,68,0.5)",  label: "🔴", label2: "高危區" },
  [ZONE_TYPE.RESTRICTED]: { fill: "#a855f7", stroke: "#9333ea", glow: "rgba(168,85,247,0.5)", label: "⚫", label2: "禁區" },
};

/** 根據區域色與亮度計算側牆顏色 */
function sideColors(fillHex, alpha) {
  const r = parseInt(fillHex.slice(1, 3), 16);
  const g = parseInt(fillHex.slice(3, 5), 16);
  const b = parseInt(fillHex.slice(5, 7), 16);
  // 暗化系數
  return {
    left:  `rgba(${Math.round(r * 0.5)},${Math.round(g * 0.5)},${Math.round(b * 0.5)},${alpha})`,
    right: `rgba(${Math.round(r * 0.7)},${Math.round(g * 0.7)},${Math.round(b * 0.7)},${alpha})`,
  };
}

/** Grid → 畫面等角座標 */
function gridToScreen(gx, gy) {
  return {
    sx: (gx - gy) * HALF_W,
    sy: (gx + gy) * HALF_H,
  };
}

/** 菱形四個頂點 */
function diamondPoints(sx, sy) {
  return `${sx},${sy - HALF_H} ${sx + HALF_W},${sy} ${sx},${sy + HALF_H} ${sx - HALF_W},${sy}`;
}

/** 菱形地面投影（偏移陰影） */
function shadowPoints(sx, sy, ox, oy) {
  const t = sy + oy;
  return `${sx + ox},${t - HALF_H} ${sx + HALF_W + ox},${t} ${sx + ox},${t + HALF_H} ${sx - HALF_W + ox},${t}`;
}

/** 左側牆面（連接左邊緣→底部頂點→向下擠出） */
function leftWallPoints(sx, sy, t) {
  return `${sx - HALF_W},${sy} ${sx},${sy + HALF_H} ${sx},${sy + HALF_H + t} ${sx - HALF_W},${sy + t}`;
}

/** 右側牆面（連接右邊緣→底部頂點→向下擠出） */
function rightWallPoints(sx, sy, t) {
  return `${sx + HALF_W},${sy} ${sx},${sy + HALF_H} ${sx},${sy + HALF_H + t} ${sx + HALF_W},${sy + t}`;
}

/** 頂面高光邊緣（右上邊與左上邊的亮線） */
function topEdgeHighlight(sx, sy) {
  return `${sx},${sy - HALF_H} ${sx + HALF_W},${sy} ${sx},${sy + HALF_H}`;
}

/** 計算兩點之間的中點與角度 */
function midpoint(x1, y1, x2, y2) {
  return { mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
}

function angle(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
}

/**
 * 2.5D 等角節點地圖元件
 */
export default function ZombieMapIsometric({
  mapState,
  currentNodeId,
  reachableIds = [],
  moveAnimId = null,
  onMove,
  phase,
  mapPurchased = false,
  showLabels = true,
}) {
  // ── 節點佈局 ──────────────────────────────────────────
  const layout = useMemo(() => {
    if (!mapState?.nodes) return null;
    return computeNodeLayout(mapState.nodes);
  }, [mapState]);

  // ── SVG 視口 ──────────────────────────────────────────
  const svgViewBox = useMemo(() => {
    if (!layout || !mapState?.nodes) return "0 0 800 600";
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const pos of Object.values(layout)) {
      const { sx, sy } = gridToScreen(pos.gridX, pos.gridY);
      minX = Math.min(minX, sx - HALF_W - 40);
      maxX = Math.max(maxX, sx + HALF_W + 40);
      minY = Math.min(minY, sy - HALF_H - 80);
      maxY = Math.max(maxY, sy + HALF_H + 80);
    }
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [layout, mapState]);

  // ── 深度排序 ──────────────────────────────────────────
  const sortedNodes = useMemo(() => {
    if (!layout || !mapState?.nodes) return [];
    return Object.entries(mapState.nodes)
      .map(([id, node]) => ({ id, node, pos: layout[id] }))
      .filter(n => n.pos)
      .sort((a, b) => {
        const yd = a.pos.gridY - b.pos.gridY;
        return yd !== 0 ? yd : a.pos.gridX - b.pos.gridX;
      });
  }, [layout, mapState]);

  // ── 連接線（道路） ──────────────────────────────────
  const connections = useMemo(() => {
    if (!layout || !mapState?.nodes) return [];
    const drawn = new Set();
    const lines = [];
    for (const [id, node] of Object.entries(mapState.nodes)) {
      const from = layout[id];
      if (!from) continue;
      for (const neighborId of node.connectedNodeIds || []) {
        const to = layout[neighborId];
        if (!to) continue;
        const key = [id, neighborId].sort().join("--");
        if (drawn.has(key)) continue;
        drawn.add(key);
        const fromS = gridToScreen(from.gridX, from.gridY);
        const toS = gridToScreen(to.gridX, to.gridY);
        const fromRevealed = mapState.revealedNodeIds?.includes(id) || mapState.revealedNodeIds?.includes(`partial_${id}`);
        const toRevealed = mapState.revealedNodeIds?.includes(neighborId) || mapState.revealedNodeIds?.includes(`partial_${neighborId}`);
        const revealed = fromRevealed || toRevealed;
        const toNode = mapState.nodes[neighborId];
        lines.push({
          id: key,
          x1: fromS.sx, y1: fromS.sy, x2: toS.sx, y2: toS.sy,
          revealed,
          isExtractPath: !!toNode?.isExtractionPoint,
          isBossPath: !!toNode?.bossGuarded,
        });
      }
    }
    return lines;
  }, [layout, mapState]);

  // ── 互動反饋狀態 ────────────────────────────────────
  const [hoveredId, setHoveredId] = useState(null);
  const [clickRipple, setClickRipple] = useState(null); // { id, sx, sy }

  // ── 玩家角色移動動畫 ──────────────────────────────────
  const prevNodeIdRef = useRef(currentNodeId);
  const [playerAnim, setPlayerAnim] = useState(null);
  // playerAnim = { fromSx, fromSy, toSx, toSy, phase: "start"|"animate" }

  // 第一階段：檢測移動，設定起點位置
  useEffect(() => {
    if (!layout || !mapState?.nodes) return;
    const prevId = prevNodeIdRef.current;
    if (prevId !== currentNodeId && moveAnimId && layout[prevId] && layout[currentNodeId]) {
      const from = gridToScreen(layout[prevId].gridX, layout[prevId].gridY);
      const to = gridToScreen(layout[currentNodeId].gridX, layout[currentNodeId].gridY);
      // Phase 1: 設定起點位置（無 transition）
      setPlayerAnim({ fromSx: from.sx, fromSy: from.sy, toSx: to.sx, toSy: to.sy, phase: "start" });
      // Phase 2: 雙重 rAF 確保瀏覽器先繪製起點，再切換終點觸發 transition
      let raf1, raf2;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setPlayerAnim(prev => prev ? { ...prev, phase: "animate" } : prev);
        });
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2 !== undefined) cancelAnimationFrame(raf2);
      };
    }
    prevNodeIdRef.current = currentNodeId;
  }, [currentNodeId, moveAnimId, layout, mapState]);

  // 動畫結束後清除
  useEffect(() => {
    if (!moveAnimId && playerAnim?.phase === "animate") {
      const t = setTimeout(() => setPlayerAnim(null), 200);
      return () => clearTimeout(t);
    }
  }, [moveAnimId, playerAnim]);

  // ── 空狀態 ────────────────────────────────────────────
  if (!mapState || !layout) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 12, color: COLORS.textDim }}>
        <div style={{ fontSize: 48, opacity: 0.3, animation: `za-float ${ANIM_DURATION.float} infinite` }}>🗺️</div>
        <p style={{ fontSize: 12 }}>生成地圖開始探索</p>
      </div>
    );
  }

  return (
    <svg
      viewBox={svgViewBox}
      style={{
        width: "100%",
        height: "auto",
        maxHeight: 520,
        animation: `za-fade-in ${ANIM_DURATION.slow}`,
        filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.4))",
      }}
    >
      <defs>
        <radialGradient id="iso-bg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {/* 發光濾鏡 */}
        <filter id="glow-green">
          <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor={COLORS.green} floodOpacity="0.7" />
        </filter>
        <filter id="glow-current">
          <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor={COLORS.green} floodOpacity="0.8" />
        </filter>
        <filter id="glow-reachable">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="rgba(255,255,255,0.4)" floodOpacity="0.6" />
        </filter>
        <filter id="glow-revealed">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(255,255,255,0.2)" floodOpacity="0.3" />
        </filter>
        {/* 道路發光 */}
        <filter id="glow-road-extract">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={COLORS.green} floodOpacity="0.4" />
        </filter>
        <filter id="glow-road-boss">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={COLORS.accent} floodOpacity="0.3" />
        </filter>
        {/* 角色發光 */}
        <filter id="glow-player">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#fff" floodOpacity="0.6" />
        </filter>
        {/* 箭頭標記 */}
        <marker id="arrow-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.4)" />
        </marker>
        <marker id="arrow-head-extract" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.green} />
        </marker>
        <marker id="arrow-head-boss" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.accent} />
        </marker>
        {/* 互動動畫關鍵幀 */}
        <style>{`
          @keyframes iso-reachable-pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 0.9; }
          }
          @keyframes iso-click-ripple {
            0% { transform: scale(0.3); opacity: 0.8; }
            100% { transform: scale(2.2); opacity: 0; }
          }
          @keyframes iso-current-ring {
            0% { transform: scale(0.85); opacity: 0.5; }
            50% { transform: scale(1.05); opacity: 0.2; }
            100% { transform: scale(0.85); opacity: 0.5; }
          }
          @keyframes iso-tooltip-in {
            0% { opacity: 0; transform: translateY(4px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </defs>

      <rect width="100%" height="100%" fill="url(#iso-bg)" rx={10} />

      {/* ── 道路 — 底部陰影（多層柔化） ──────────────── */}
      {connections.map(conn => {
        const baseWidth = conn.isExtractPath ? 10 : conn.isBossPath ? 9 : 7;
        const dark = conn.revealed ? 0.08 : 0.03;
        return (
          <g key={`road-shadow-${conn.id}`}>
            {/* 外層寬陰影 */}
            <line
              x1={conn.x1 + SHADOW_OX * 0.3} y1={conn.y1 + SHADOW_OY * 0.3}
              x2={conn.x2 + SHADOW_OX * 0.3} y2={conn.y2 + SHADOW_OY * 0.3}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={baseWidth + 8}
              opacity={dark}
              strokeLinecap="round"
            />
            {/* 內層陰影 */}
            <line
              x1={conn.x1 + SHADOW_OX * 0.15} y1={conn.y1 + SHADOW_OY * 0.15}
              x2={conn.x2 + SHADOW_OX * 0.15} y2={conn.y2 + SHADOW_OY * 0.15}
              stroke="rgba(0,0,0,0.6)"
              strokeWidth={baseWidth + 4}
              opacity={dark * 1.3}
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* ── 道路 — 主線路面 ──────────────────────────── */}
      {connections.map(conn => {
        const opacity = conn.revealed ? 0.7 : 0.12;
        const strokeColor = conn.isExtractPath ? COLORS.green : conn.isBossPath ? COLORS.accent : "rgba(255,255,255,0.45)";
        const strokeWidth = conn.isExtractPath ? 5 : conn.isBossPath ? 4 : 3;
        const filter = conn.isExtractPath ? "url(#glow-road-extract)" : conn.isBossPath ? "url(#glow-road-boss)" : "none";
        return (
          <line
            key={`road-${conn.id}`}
            x1={conn.x1} y1={conn.y1} x2={conn.x2} y2={conn.y2}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            strokeLinecap="round"
            strokeDasharray={conn.revealed ? "none" : "6,6"}
            filter={filter}
          />
        );
      })}

      {/* ── 道路 — 方向箭頭（揭示路線） ──────────────── */}
      {connections.filter(c => c.revealed).map(conn => {
        const { mx, my } = midpoint(conn.x1, conn.y1, conn.x2, conn.y2);
        const ang = angle(conn.x1, conn.y1, conn.x2, conn.y2);
        const arrowColor = conn.isExtractPath ? COLORS.green : conn.isBossPath ? COLORS.accent : "rgba(255,255,255,0.4)";
        return (
          <polygon
            key={`arrow-${conn.id}`}
            points="0,-5 10,0 0,5"
            fill={arrowColor}
            opacity={0.65}
            transform={`translate(${mx},${my}) rotate(${ang})`}
          />
        );
      })}

      {/* ── 道路 — 未揭示的虛線動畫提示 ──────────────── */}
      {connections.filter(c => !c.revealed).map(conn => (
        <line
          key={`road-unrevealed-${conn.id}`}
          x1={(conn.x1 + conn.x2) / 2} y1={(conn.y1 + conn.y2) / 2}
          x2={conn.x2} y2={conn.y2}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={2}
          strokeDasharray="4,6"
          strokeLinecap="round"
          opacity={0.3}
        />
      ))}

      {/* ── 節點繪製 ────────────────────────────────── */}
      {sortedNodes.map(({ id, node, pos }) => {
        const { sx, sy } = gridToScreen(pos.gridX, pos.gridY);
        const zs = ZONE_STYLES[node.zoneType] || ZONE_STYLES[ZONE_TYPE.NORMAL];

        const isFullyRevealed = mapState.revealedNodeIds?.includes(id) ?? false;
        const isPartiallyRevealed = mapState.revealedNodeIds?.includes(`partial_${id}`) ?? false;
        const isHidden = !isFullyRevealed && !isPartiallyRevealed;
        const isCurrent = id === currentNodeId;
        const isReachable = reachableIds.includes(id);
        const isMoving = id === moveAnimId;
        const isClickable = isReachable && !isCurrent && onMove;
        const isHovered = hoveredId === id;
        const hasRipple = clickRipple?.id === id;

        let nodeOpacity = 1;
        if (isHidden) nodeOpacity = 0.15;
        else if (isPartiallyRevealed) nodeOpacity = 0.5;

        const hoverScale = isHovered ? 1.06 : 1;
        const hoverShadowScale = isHovered ? 1.15 : 1;

        const tileFill = isCurrent
          ? `${COLORS.green}33`
          : isReachable ? `${zs.fill}22`
          : isHidden ? "rgba(255,255,255,0.02)"
          : `${zs.fill}15`;

        const tileStroke = isCurrent
          ? COLORS.green
          : isReachable ? zs.stroke
          : isHidden ? "rgba(255,255,255,0.04)"
          : `${zs.stroke}44`;

        const filter = isCurrent ? "url(#glow-current)"
          : isReachable && isHovered ? "url(#glow-green)"
          : isReachable ? "url(#glow-reachable)"
          : isFullyRevealed ? "url(#glow-revealed)"
          : "none";

        const thickness = isCurrent || isReachable ? THICKNESS + 4 : THICKNESS;
        const sides = sideColors(zs.fill, 1);

        const handleClick = () => {
          if (isClickable) {
            setClickRipple({ id, sx, sy });
            setTimeout(() => setClickRipple(prev => prev?.id === id ? null : prev), 500);
            onMove?.(id);
          }
        };

        return (
          <g
            key={id}
            opacity={nodeOpacity}
            style={{ cursor: isClickable ? "pointer" : "default", transition: "opacity 0.3s" }}
            onClick={handleClick}
            onMouseEnter={() => { if (isClickable) setHoveredId(id); }}
            onMouseLeave={() => setHoveredId(prev => prev === id ? null : prev)}
          >
            {/* ── 地面投影陰影（hover 放大） ────────── */}
            {!isHidden && (
              <polygon
                points={shadowPoints(sx, sy, SHADOW_OX, SHADOW_OY)}
                fill="rgba(0,0,0,0.15)"
                stroke="none"
                filter={isCurrent ? "url(#glow-current)" : "none"}
                style={{
                  pointerEvents: "none",
                  transformOrigin: `${sx}px ${sy}px`,
                  transform: `scale(${hoverShadowScale})`,
                  transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              />
            )}

            {/* ── 左側牆面（暗面） ───────────────────── */}
            <polygon
              points={leftWallPoints(sx, sy, thickness)}
              fill={isCurrent ? hexToRgba(COLORS.green, 0.25) : sides.left}
              stroke={isCurrent ? hexToRgba(COLORS.green, 0.4) : hexToRgba(zs.stroke, 0.15)}
              strokeWidth={0.5}
              opacity={isHidden ? 0 : 0.85}
              style={{ pointerEvents: "none" }}
            />

            {/* ── 右側牆面（亮面） ───────────────────── */}
            <polygon
              points={rightWallPoints(sx, sy, thickness)}
              fill={isCurrent ? hexToRgba(COLORS.green, 0.18) : sides.right}
              stroke={isCurrent ? hexToRgba(COLORS.green, 0.25) : "none"}
              strokeWidth={0.5}
              opacity={isHidden ? 0 : 0.8}
              style={{ pointerEvents: "none" }}
            />

            {/* ── 頂面菱形（hover 放大 + glow） ────── */}
            <polygon
              points={diamondPoints(sx, sy)}
              fill={tileFill}
              stroke={tileStroke}
              strokeWidth={isCurrent ? 3 : isReachable ? 2.5 : 1.5}
              filter={filter}
              style={{
                transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                transformOrigin: `${sx}px ${sy}px`,
                transform: isMoving ? "scale(1.08)" : `scale(${hoverScale})`,
                animation: isReachable && !isCurrent && !isHovered
                  ? `iso-reachable-pulse 2.5s ease-in-out infinite`
                  : "none",
              }}
            />

            {/* ── 頂面邊緣高光（hover 時更亮） ────── */}
            {!isHidden && (
              <polyline
                points={topEdgeHighlight(sx, sy)}
                fill="none"
                stroke={isHovered ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)"}
                strokeWidth={isHovered ? 2 : 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: "none", transition: "all 0.2s" }}
              />
            )}

            {/* ── 當前節點脈動光環 ─────────────────── */}
            {isCurrent && !isHidden && (
              <polygon
                points={diamondPoints(sx, sy)}
                fill="none"
                stroke={COLORS.green}
                strokeWidth={2}
                opacity={0.4}
                style={{
                  pointerEvents: "none",
                  transformOrigin: `${sx}px ${sy}px`,
                  animation: "iso-current-ring 2.5s ease-in-out infinite",
                }}
              />
            )}

            {/* 節點內容圖示 */}
            {!isHidden && (
              <text
                x={sx} y={sy - 2}
                textAnchor="middle" dominantBaseline="central"
                fontSize={isCurrent ? 24 : isPartiallyRevealed ? 16 : 20}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {isCurrent ? "📍"
                  : isPartiallyRevealed ? zs.label
                  : node.bossGuarded ? "👑"
                  : node.isExtractionPoint ? "🚁"
                  : zs.label}
              </text>
            )}

            {/* 未揭露問號 */}
            {isHidden && (
              <text
                x={sx} y={sy - 2}
                textAnchor="middle" dominantBaseline="central"
                fontSize={16} fill="rgba(255,255,255,0.2)"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >❓</text>
            )}

            {/* BOSS 標記 */}
            {!isHidden && node.bossGuarded && !node.bossCleared && (
              <text
                x={sx + HALF_W - 6} y={sy - HALF_H + 6}
                textAnchor="end" fontSize={14}
                style={{ pointerEvents: "none", animation: `za-pulse-glow ${ANIM_DURATION.pulse} ease infinite` }}
              >👑</text>
            )}

            {/* 撤離標記 */}
            {!isHidden && node.isExtractionPoint && (
              <text
                x={sx - HALF_W + 6} y={sy - HALF_H + 6}
                textAnchor="start" fontSize={14}
                style={{ pointerEvents: "none", animation: `za-float ${ANIM_DURATION.float} ease-in-out infinite` }}
              >🚁</text>
            )}

            {/* ── hover 提示浮層 ──────────────────────── */}
            {isHovered && isClickable && (
              <g style={{ pointerEvents: "none", animation: "iso-tooltip-in 0.15s ease-out" }}>
                {/* 氣泡背景 */}
                <rect
                  x={sx - 52} y={sy - HALF_H - 46}
                  width={104} height={34}
                  rx={6} ry={6}
                  fill="rgba(10,8,20,0.92)"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth={1}
                />
                {/* 箭頭（向下三角） */}
                <polygon
                  points={`${sx - 5},${sy - HALF_H - 12} ${sx + 5},${sy - HALF_H - 12} ${sx},${sy - HALF_H - 6}`}
                  fill="rgba(10,8,20,0.92)"
                />
                {/* 節點類型 */}
                <text
                  x={sx} y={sy - HALF_H - 34}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={8} fill={zs.stroke}
                  fontWeight={600}
                >{zs.label2} · {node.label.replace(/^[^\s]+\s/, "").slice(0, 10)}</text>
                {/* Combat 標籤 */}
                <text
                  x={sx} y={sy - HALF_H - 20}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={7}
                  fill="rgba(255,255,255,0.4)"
                >
                  {node.isSafeZone ? "🛡️ 安全區域" : `⚔️ ${Math.round((node.combatChance || 0) * 100)}% 遭遇機率`}
                </text>
              </g>
            )}

            {/* 節點名稱 */}
            {showLabels && isFullyRevealed && (
              <text
                x={sx} y={sy + HALF_H + 16}
                textAnchor="middle" dominantBaseline="central"
                fontSize={9}
                fill={isCurrent ? COLORS.green : "rgba(255,255,255,0.7)"}
                fontWeight={isCurrent ? 700 : 500}
                style={{
                  pointerEvents: "none", userSelect: "none",
                  textShadow: "0 1px 6px rgba(0,0,0,0.6)",
                }}
              >
                {node.label.replace(/^[^\s]+\s/, "").slice(0, 8)}
              </text>
            )}

            {/* 部分揭示提示 */}
            {showLabels && isPartiallyRevealed && (
              <text
                x={sx} y={sy + HALF_H + 16}
                textAnchor="middle" dominantBaseline="central"
                fontSize={9} fill="rgba(255,255,255,0.35)"
                style={{ pointerEvents: "none", userSelect: "none", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
              >???</text>
            )}

            {/* 可點擊提示（hover 時隱藏，交給 tooltip） */}
            {isReachable && !isCurrent && !isPartiallyRevealed && !isHidden && !isHovered && (
              <text
                x={sx} y={sy + HALF_H + 28}
                textAnchor="middle" fontSize={8}
                fill="rgba(255,255,255,0.35)"
                style={{ pointerEvents: "none" }}
              >▶ 前往</text>
            )}

            {/* ── 點擊漣漪效果 ────────────────────────── */}
            {hasRipple && (
              <circle
                cx={sx} cy={sy}
                r={20}
                fill="none"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth={2}
                style={{
                  pointerEvents: "none",
                  transformOrigin: `${sx}px ${sy}px`,
                  animation: "iso-click-ripple 0.45s ease-out forwards",
                }}
              />
            )}
          </g>
        );
      })}

      {/* ── 角色移動動畫 ────────────────────────────── */}
      {playerAnim && (
        <g style={{ pointerEvents: "none" }}>
          {/* 角色腳下光環 — 跟隨角色位置 */}
          <ellipse
            cx={playerAnim.phase === "animate" ? playerAnim.toSx : playerAnim.fromSx}
            cy={playerAnim.phase === "animate" ? playerAnim.toSy + HALF_H * 0.6 : playerAnim.fromSy + HALF_H * 0.6}
            rx={16}
            ry={7}
            fill="rgba(255,255,255,0.06)"
            style={{
              transition: playerAnim.phase === "animate"
                ? "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"
                : "none",
            }}
          />
          {/* 角色光點 */}
          <circle
            cx={playerAnim.phase === "animate" ? playerAnim.toSx : playerAnim.fromSx}
            cy={playerAnim.phase === "animate"
              ? playerAnim.toSy - HALF_H * 1.2
              : playerAnim.fromSy - HALF_H * 1.2}
            r={10}
            fill="rgba(255,255,255,0.95)"
            filter="url(#glow-player)"
            style={{
              transition: playerAnim.phase === "animate"
                ? "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"
                : "none",
            }}
          />
          {/* 角色內圈 */}
          <circle
            cx={playerAnim.phase === "animate" ? playerAnim.toSx : playerAnim.fromSx}
            cy={playerAnim.phase === "animate"
              ? playerAnim.toSy - HALF_H * 1.2
              : playerAnim.fromSy - HALF_H * 1.2}
            r={4}
            fill={COLORS.green}
            style={{
              transition: playerAnim.phase === "animate"
                ? "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"
                : "none",
            }}
          />
        </g>
      )}
    </svg>
  );
}
