// src/components/dungeon/DungeonMap.jsx — 地下城 SVG 探索地圖
import { getRoomMeta, getContractBadge } from "../../lib/dungeonData";

const CELL  = 70;  // 格距 px
const PAD   = 44;  // 邊距 px
const R     = 22;  // 一般節點半徑
const R_CUR = 26;  // 當前位置節點半徑

const CSS = `
@keyframes dm-pulse {
  0%   { r: 28; opacity: 0.6; }
  50%  { r: 33; opacity: 0.25; }
  100% { r: 28; opacity: 0.6; }
}
.dm-reachable-ring { animation: dm-pulse 1.4s ease-in-out infinite; }
`;

function roomCenter(room) {
  return { cx: PAD + room.x * CELL, cy: PAD + room.y * CELL };
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
  const svgW = PAD * 2 + maxX * CELL;
  const svgH = PAD * 2 + maxY * CELL;

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
        {/* ── 連線 ── */}
        {connections.map(([aId, bId], i) => {
          const a = roomMap[aId];
          const b = roomMap[bId];
          if (!a || !b) return null;
          const ca = roomCenter(a);
          const cb = roomCenter(b);
          const bothExplored = exploredIds.has(aId) && exploredIds.has(bId);
          return (
            <line
              key={i}
              x1={ca.cx} y1={ca.cy}
              x2={cb.cx} y2={cb.cy}
              stroke={bothExplored ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}
              strokeWidth={bothExplored ? 2 : 1.5}
              strokeDasharray={bothExplored ? "none" : "5 4"}
            />
          );
        })}

        {/* ── 房間節點 ── */}
        {rooms.map(room => {
          const meta       = getRoomMeta(room.type);
          const { cx, cy } = roomCenter(room);
          const isCurrent  = room.id === currentRoomId;
          const isExplored = exploredIds.has(room.id);
          const isCleared  = clearedIds.has(room.id);
          const isReach    = reachableIds.has(room.id) && !isCurrent;
          const isVoting   = room.id === pendingVoteRoomId;
          const r = isCurrent ? R_CUR : R;

          const fillColor   = isCleared ? "#0f172a" : isExplored ? meta.nodeColor : "#111827";
          const iconOpacity = isExplored ? (isCleared ? 0.3 : 1) : 0.3;

          return (
            <g
              key={room.id}
              onClick={() => handleClick(room.id)}
              style={{ cursor: isReach && !disabled ? "pointer" : "default" }}
            >
              {/* 可移動：發光外圈 */}
              {isReach && (
                <circle
                  cx={cx} cy={cy}
                  r={28}
                  fill="none"
                  stroke={isVoting ? "#f59e0b" : "#22c55e"}
                  strokeWidth={2}
                  className="dm-reachable-ring"
                />
              )}

              {/* 投票中：橘色外圈 */}
              {isVoting && !isReach && (
                <circle cx={cx} cy={cy} r={R+6} fill="none" stroke="#f59e0b" strokeWidth={2.5} />
              )}

              {/* 主節點 */}
              <circle
                cx={cx} cy={cy}
                r={r}
                fill={fillColor}
                stroke={isCurrent ? "#fbbf24" : isExplored ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)"}
                strokeWidth={isCurrent ? 3 : 1.5}
              />

              {/* 圖示 / 問號 */}
              <text
                x={cx} y={cy + 6}
                textAnchor="middle"
                fontSize={isExplored ? 16 : 14}
                opacity={iconOpacity}
                style={{ userSelect:"none", pointerEvents:"none" }}
              >
                {isExplored ? meta.icon : "?"}
              </text>

              {/* 已清除：打勾覆蓋 */}
              {isCleared && !isCurrent && (
                <text
                  x={cx + 10} y={cy - 10}
                  fontSize={12} fontWeight="bold"
                  fill="#4ade80"
                  style={{ userSelect:"none", pointerEvents:"none" }}
                >
                  ✓
                </text>
              )}

              {/* 房間標籤（已探索才顯示） */}
              {isExplored && (
                <text
                  x={cx} y={cy + r + 13}
                  textAnchor="middle"
                  fontSize={9}
                  fill="rgba(255,255,255,0.5)"
                  style={{ userSelect:"none", pointerEvents:"none" }}
                >
                  {room.label}
                </text>
              )}

              {/* 合約標籤（戰鬥房已探索才顯示） */}
              {isExplored && (() => {
                const badge = getContractBadge(room);
                if (!badge) return null;
                return (
                  <text
                    x={cx} y={cy + r + 24}
                    textAnchor="middle"
                    fontSize={8}
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
