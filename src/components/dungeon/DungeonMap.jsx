// src/components/dungeon/DungeonMap.jsx — 地下城 SVG 方形房間地圖
import { getRoomMeta, getContractBadge } from "../../lib/dungeonData";

const CELL  = 84;  // 格距 px（加大給方形空間）
const PAD   = 50;  // 邊距 px
const RW    = 56;  // 房間寬
const RH    = 56;  // 房間高

const CSS = `
@keyframes dm-pulse {
  0%   { stroke-opacity: 0.7; stroke-width: 2; }
  50%  { stroke-opacity: 0.2; stroke-width: 3; }
  100% { stroke-opacity: 0.7; stroke-width: 2; }
}
.dm-reachable-ring { animation: dm-pulse 1.4s ease-in-out infinite; }
@keyframes dm-current-glow {
  0%   { filter: drop-shadow(0 0 4px rgba(251,191,36,0.6)); }
  50%  { filter: drop-shadow(0 0 12px rgba(251,191,36,0.9)); }
  100% { filter: drop-shadow(0 0 4px rgba(251,191,36,0.6)); }
}
@keyframes dm-fade-in {
  0%   { opacity: 0; transform: scale(0.8); }
  100% { opacity: 1; transform: scale(1); }
}
.dm-room-enter { animation: dm-fade-in 0.3s ease both; }
@keyframes dm-elite-glow {
  0%   { filter: drop-shadow(0 0 3px rgba(249,115,22,0.4)); }
  50%  { filter: drop-shadow(0 0 10px rgba(249,115,22,0.8)); }
  100% { filter: drop-shadow(0 0 3px rgba(249,115,22,0.4)); }
}
@keyframes dm-hidden-pulse {
  0%,100% { opacity: 0.8; transform: scale(1); }
  50%     { opacity: 1;   transform: scale(1.12); }
}
`;

function roomRect(room) {
  return {
    x: PAD + room.x * CELL - RW / 2,
    y: PAD + room.y * CELL - RH / 2,
    w: RW, h: RH,
    cx: PAD + room.x * CELL,
    cy: PAD + room.y * CELL,
  };
}

// 計算兩個矩形之間的最短連線端點
function rectConnPoints(r1, r2) {
  const dx = r2.cx - r1.cx;
  const dy = r2.cy - r1.cy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  let x1 = r1.cx, y1 = r1.cy, x2 = r2.cx, y2 = r2.cy;
  if (absDx > absDy) {
    // 水平方向為主
    const sign = dx > 0 ? 1 : -1;
    x1 = r1.cx + sign * (r1.w / 2);
    x2 = r2.cx - sign * (r2.w / 2);
    y1 = r1.cy;
    y2 = r2.cy;
  } else {
    // 垂直方向為主
    const sign = dy > 0 ? 1 : -1;
    y1 = r1.cy + sign * (r1.h / 2);
    y2 = r2.cy - sign * (r2.h / 2);
    x1 = r1.cx;
    x2 = r2.cx;
  }
  return { x1, y1, x2, y2 };
}

export default function DungeonMap({
  floorData,
  exploredIds  = new Set(),
  clearedIds   = new Set(),
  currentRoomId,
  reachableIds = new Set(),
  onRoomClick,
  pendingVoteRoomId,
  disabled = false,
}) {
  if (!floorData) return null;

  const { rooms = [], connections = [] } = floorData;
  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));

  const maxX = Math.max(...rooms.map(r => r.x));
  const maxY = Math.max(...rooms.map(r => r.y));
  const svgW = PAD * 2 + maxX * CELL + RW;
  const svgH = PAD * 2 + maxY * CELL + RH;

  function handleClick(roomId) {
    if (disabled) return;
    if (!reachableIds.has(roomId)) return;
    onRoomClick?.(roomId);
  }

  return (
    <div style={{ overflowX:"auto", overflowY:"visible", WebkitOverflowScrolling:"touch" }}>
      <style>{CSS}</style>
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ display:"block", minWidth: svgW }}
      >
        {/* ── 陰影定義 ── */}
        <defs>
          <filter id="dm-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
          </filter>
          <filter id="dm-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#fbbf24" floodOpacity="0.8" />
          </filter>
          <filter id="dm-unexplored" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.3" />
          </filter>
          <pattern id="p-locked" width="6" height="6" patternUnits="userSpaceOnUse">
            <line x1="0" y1="6" x2="6" y2="0" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* ── 連線 ── */}
        {connections.map((conn, i) => {
          const aId = Array.isArray(conn) ? conn[0] : conn.a;
          const bId = Array.isArray(conn) ? conn[1] : conn.b;
          const a = roomMap[aId];
          const b = roomMap[bId];
          if (!a || !b) return null;
          const ra = roomRect(a);
          const rb = roomRect(b);
          const pts = rectConnPoints(ra, rb);
          const bothExplored = exploredIds.has(aId) && exploredIds.has(bId);
          return (
            <line
              key={i}
              x1={pts.x1} y1={pts.y1}
              x2={pts.x2} y2={pts.y2}
              stroke={bothExplored ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}
              strokeWidth={bothExplored ? 2 : 1.5}
              strokeDasharray={bothExplored ? "none" : "5 4"}
              strokeLinecap="round"
            />
          );
        })}

        {/* ── 房間卡片 ── */}
        {rooms.map((room) => {
          const meta       = getRoomMeta(room.type);
          const rect       = roomRect(room);
          const { x, y, w, h } = rect;
          const isCurrent  = room.id === currentRoomId;
          const isExplored = exploredIds.has(room.id);
          const isCleared  = clearedIds.has(room.id);
          const isReach    = reachableIds.has(room.id) && !isCurrent;
          const isVoting   = room.id === pendingVoteRoomId;
          const isEntry    = room.type === "entrance";
          const isStairs   = room.type === "stairs";

          // 顏色方案
          let fillColor, strokeColor, strokeW;
          if (isEntry) {
            fillColor = "#1e293b";
            strokeColor = "rgba(255,255,255,0.25)";
            strokeW = 1.5;
          } else if (isCurrent) {
            fillColor = "#1a1a2e";
            strokeColor = "#fbbf24";
            strokeW = 2.5;
          } else if (isReach) {
            fillColor = "#0f172a";
            strokeColor = "#22c55e";
            strokeW = 2;
          } else if (isVoting) {
            fillColor = "#1a1a2e";
            strokeColor = "#f59e0b";
            strokeW = 2;
          } else if (isExplored && isCleared) {
            fillColor = "#0a0a0f";
            strokeColor = "rgba(255,255,255,0.1)";
            strokeW = 1;
          } else if (isExplored) {
            fillColor = meta.nodeColor || "#111827";
            strokeColor = "rgba(255,255,255,0.2)";
            strokeW = 1.5;
          } else {
            fillColor = "#0a0a0f";
            strokeColor = "rgba(255,255,255,0.06)";
            strokeW = 1;
          }

          // 圓角
          const rx = 10;

          return (
            <g
              key={room.id}
              onClick={() => handleClick(room.id)}
              style={{ cursor: (isReach && !disabled) ? "pointer" : "default" }}
              className="dm-room-enter"
            >
              {/* 可移動：發光外框 */}
              {isReach && (
                <rect
                  x={x - 4} y={y - 4}
                  width={w + 8} height={h + 8}
                  rx={rx + 2}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={2}
                  className="dm-reachable-ring"
                />
              )}

              {/* 投票中：橘色外框 */}
              {isVoting && !isReach && (
                <rect
                  x={x - 3} y={y - 3}
                  width={w + 6} height={h + 6}
                  rx={rx + 1}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                />
              )}

              {/* 主房間矩形 */}
              <rect
                x={x} y={y}
                width={w} height={h}
                rx={rx}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeW}
                filter={isCurrent ? "url(#dm-glow)" : isExplored ? "url(#dm-shadow)" : "none"}
              />

              {/* 未探索房間：斜線網底 */}
              {!isExplored && !isEntry && !isStairs && (
                <rect
                  x={x} y={y}
                  width={w} height={h}
                  rx={rx}
                  fill="url(#p-locked)"
                />
              )}

              {/* 精英強化：火焰外框 */}
              {room.type === "elite" && isExplored && (
                <rect
                  x={x - 3} y={y - 3}
                  width={w + 6} height={h + 6}
                  rx={rx + 1}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  style={{ animation: "dm-elite-glow 2s ease-in-out infinite" }}
                />
              )}

              {/* 圖示 */}
              <text
                x={rect.cx} y={rect.cy + 5}
                textAnchor="middle"
                fontSize={isExplored || isEntry ? 20 : 16}
                opacity={isExplored ? 1 : 0.4}
                style={{ userSelect:"none", pointerEvents:"none" }}
                filter={isCurrent ? "url(#dm-glow)" : undefined}
              >
                {isExplored || isEntry ? meta.icon : "🔒"}
              </text>

              {/* 隱藏房間特殊顯示：已探索時用 ? 圖示 + 動畫 */}
              {room.type === "hidden" && isExplored && (
                <text
                  x={rect.cx} y={rect.cy + 5}
                  textAnchor="middle"
                  fontSize={22}
                  fill="#a78bfa"
                  style={{
                    userSelect:"none", pointerEvents:"none",
                    animation: "dm-hidden-pulse 1.5s ease-in-out infinite",
                  }}
                >
                  ❓
                </text>
              )}

              {/* 入口特殊標籤 */}
              {isEntry && (
                <text
                  x={rect.cx} y={y + h + 12}
                  textAnchor="middle"
                  fontSize={8}
                  fill="rgba(255,255,255,0.35)"
                  style={{ userSelect:"none", pointerEvents:"none" }}
                >
                  入口
                </text>
              )}

              {/* 精英標籤 */}
              {room.type === "elite" && isExplored && (
                <text
                  x={rect.cx} y={y - 6}
                  textAnchor="middle"
                  fontSize={7.5}
                  fontWeight="bold"
                  fill="#f97316"
                  style={{ userSelect:"none", pointerEvents:"none" }}
                >
                  ⚡ 精英
                </text>
              )}

              {/* 已清除：打勾 */}
              {isCleared && !isCurrent && (
                <text
                  x={x + w - 8} y={y + 12}
                  fontSize={11} fontWeight="bold"
                  fill="#4ade80"
                  style={{ userSelect:"none", pointerEvents:"none" }}
                >
                  ✓
                </text>
              )}

              {/* 房間標籤 */}
              {isExplored && !isEntry && (
                <text
                  x={rect.cx} y={y + h + 12}
                  textAnchor="middle"
                  fontSize={9}
                  fill="rgba(255,255,255,0.5)"
                  style={{ userSelect:"none", pointerEvents:"none" }}
                >
                  {room.label}
                </text>
              )}

              {/* 合約標籤 */}
              {isExplored && (() => {
                const badge = getContractBadge(room);
                if (!badge) return null;
                const isElite = room.type === "elite";
                return (
                  <text
                    x={rect.cx} y={y + h + (isElite ? 30 : 23)}
                    textAnchor="middle"
                    fontSize={7.5}
                    fontWeight="bold"
                    fill={badge.color}
                    style={{ userSelect:"none", pointerEvents:"none" }}
                  >
                    [{badge.label}]
                  </text>
                );
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
