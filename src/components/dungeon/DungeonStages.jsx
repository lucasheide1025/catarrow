// src/components/dungeon/DungeonStages.jsx
// 從 DungeonExpedition.jsx 抽出的共用關卡元件（PlayerStatusBar / GridMapStage / BranchStage）＋房型圖示常數。
// 原因：TeamExpeditionBattle 直接從 DungeonExpedition（一個同時含 default export 與模組級 const 的大型元件檔）
//       匯入 GridMapStage/BranchStage。這種「跨檔匯入大型元件模組的具名匯出」在 production 的 webpack
//       scope hoisting 下會觸發 "Cannot access X before initialization"（TDZ）——dev 正常、prod 才炸。
//       抽成獨立小模組後，DungeonExpedition 與 TeamExpeditionBattle 都從這裡匯入，消除該風險。
//       見第二大腦 memory：共用常數勿放 UI 元件再 re-export（循環／跨檔匯入坑）。
import { useState, useMemo, useCallback } from "react";
import { GRID_SIZE, isAdjacent } from "../../lib/expeditionGrid";

const TYPE_ICONS = {
  entrance:"🚪", battle:"⚔️", elite_battle:"💀", boss_battle:"👑",
  shop:"🛒", event:"✨", trap:"🪤", chest:"📦", rest:"💤",
  stairs:"🪜", treasure:"🏆",
};

const TYPE_HINTS = {
  entrance:"你的起點，隨時可以回來。",
  battle:"有怪物出沒！",
  elite_battle:"精英怪鎮守此地。",
  boss_battle:"王者的氣息…",
  shop:"行腳商人在此擺攤。",
  event:"神秘的力量在流動。",
  trap:"腳下傳來喀嚓聲…",
  chest:"閃閃發亮的寶箱！",
  rest:"安全的休息點。",
  stairs:"通往更深處的階梯。",
  treasure:"傳說中的寶藏房！",
};

// ── 頂部玩家狀態列（HP / 金幣 / buff）───────────────────
function PlayerStatusBar({ playerState, coins, lootMult = 1 }) {
  const hp = playerState?.hp ?? 0;
  const maxHP = playerState?.maxHP || 1;
  const pct = Math.max(0, Math.min(1, hp / maxHP));
  const buffs = playerState?.buffs || {};
  const badges = [];
  if ((buffs.atkMult || 1) !== 1) badges.push({ t:`⚔️×${buffs.atkMult}`, up:(buffs.atkMult||1) > 1 });
  if ((buffs.defMult || 1) !== 1) badges.push({ t:`🛡️×${buffs.defMult}`, up:(buffs.defMult||1) > 1 });
  if ((buffs.dmgMult || 1) !== 1) badges.push({ t:`💥×${buffs.dmgMult}`, up:(buffs.dmgMult||1) > 1 });
  if (buffs.hasRevival) badges.push({ t:"💫復活", up:true });

  return (
    <div style={{ padding:"8px 14px 6px", background:"rgba(0,0,0,0.3)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ height:8, borderRadius:4, background:"rgba(255,255,255,0.1)", overflow:"hidden" }}>
            <div style={{
              height:"100%", width:`${pct * 100}%`, transition:"width 0.4s ease",
              background: pct > 0.5 ? "#16a34a" : pct > 0.25 ? "#d97706" : "#dc2626",
            }}/>
          </div>
          <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>
            ❤️ {hp}/{maxHP}
            {badges.map((b, i) => (
              <span key={i} style={{ marginLeft:6, color: b.up ? "#4ade80" : "#f87171", fontWeight:700 }}>{b.t}</span>
            ))}
          </div>
        </div>
        {/* 本圖寶箱倍率（出圖時擲定,整場固定）——收進狀態列，不再用浮動角標 */}
        {lootMult > 1 && (
          <div style={{ flexShrink:0, padding:"3px 8px", borderRadius:999, fontSize:10, fontWeight:900,
            background:"rgba(120,53,15,.92)", border:"1px solid #fbbf24", color:"#fcd34d" }}>
            🎲 寶箱 ×{lootMult}
          </div>
        )}
        <div style={{ flexShrink:0, fontSize:12, fontWeight:900, color:"#fbbf24" }}>
          💰 {coins.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

// ── 第 1、2 層：5×5 迷霧格子地圖 ────────────────────────
export function GridMapStage({
  gridFloor, playerPos, visitedIds, floorIndex,
  playerState, coins, lootMult, onCellClick, onDescend, onRetreat,
  canControl = true,
}) {
  const [confirmExit, setConfirmExit] = useState(false);
  const CELL = 64;
  const PAD = 12;
  const W = CELL * GRID_SIZE + PAD * 2;

  const rooms = gridFloor?.rooms || [];
  const roomByPos = useMemo(() => {
    const m = {};
    rooms.forEach(r => { m[`${r.pos.x},${r.pos.y}`] = r; });
    return m;
  }, [rooms]);

  const isVisitedPos = useCallback((x, y) => {
    const r = roomByPos[`${x},${y}`];
    return !!r && visitedIds.has(r.id);
  }, [roomByPos, visitedIds]);

  const standingRoom = playerPos ? roomByPos[`${playerPos.x},${playerPos.y}`] : null;
  const showStairs = standingRoom?.type === "stairs" && !standingRoom.cleared;

  return (
    <div style={{
      minHeight:"100%",
      background:"linear-gradient(160deg,#0a0a0f,#12091a,#0a0f0a)",
      color:"white", display:"flex", flexDirection:"column",
    }}>
      <style>{`
@keyframes gm-pulse{0%,100%{opacity:0.2}50%{opacity:0.85}}
@keyframes gm-fade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Header */}
      <div style={{
        padding:"12px 14px 8px", display:"flex", alignItems:"center", gap:8,
        borderBottom:"1px solid rgba(255,255,255,0.07)", background:"rgba(0,0,0,0.25)",
      }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:900, fontSize:16, color:"#fbbf24" }}>
            🗺️ 第 {floorIndex + 1} 層 · 迷霧探索
          </div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:2 }}>
            點擊相鄰格子移動 · 走過的房間可自由通行
          </div>
        </div>
        <button onClick={() => setConfirmExit(true)}
          style={{
            flexShrink:0, padding:"6px 12px", borderRadius:10, fontSize:11, fontWeight:700,
            background:"rgba(239,68,68,0.12)", color:"#f87171",
            border:"1px solid rgba(239,68,68,0.3)", cursor:"pointer",
          }}>
          🏳️ 撤退
        </button>
      </div>

      <PlayerStatusBar playerState={playerState} coins={coins} lootMult={lootMult} />

      {/* Map */}
      <div style={{ padding:"14px 8px 10px", display:"flex", justifyContent:"center", alignItems:"flex-start", overflowX:"auto", overflowY:"visible" }}>
        <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`} style={{ display:"block", maxWidth:"100%" }}>
          {/* 背景格線（含牆格，僅隱約可見） */}
          {Array.from({ length: GRID_SIZE }).flatMap((_, gy) =>
            Array.from({ length: GRID_SIZE }).map((_, gx) => (
              <rect key={`bg-${gx}-${gy}`}
                x={PAD + gx * CELL + 4} y={PAD + gy * CELL + 4}
                width={CELL - 8} height={CELL - 8} rx={10}
                fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
            ))
          )}
          {rooms.map(room => {
            const visited = visitedIds.has(room.id);
            const fog = !visited && [
              [room.pos.x + 1, room.pos.y], [room.pos.x - 1, room.pos.y],
              [room.pos.x, room.pos.y + 1], [room.pos.x, room.pos.y - 1],
            ].some(([nx, ny]) => isVisitedPos(nx, ny));
            if (!visited && !fog) return null; // 迷霧之外：完全隱藏

            const isCurrent = playerPos && room.pos.x === playerPos.x && room.pos.y === playerPos.y;
            const clickable = canControl && isAdjacent(room.pos, playerPos);
            const x = PAD + room.pos.x * CELL + 4;
            const y = PAD + room.pos.y * CELL + 4;
            const s = CELL - 8;
            const cx = x + s / 2;

            return (
              <g key={room.id}
                onClick={() => clickable && onCellClick(room)}
                style={{ cursor: clickable ? "pointer" : "default" }}>
                {clickable && !isCurrent && (
                  <rect x={x - 3} y={y - 3} width={s + 6} height={s + 6} rx={12}
                    fill="none" stroke="#22c55e" strokeWidth={2}
                    style={{ animation:"gm-pulse 1.4s ease infinite" }} />
                )}
                <rect x={x} y={y} width={s} height={s} rx={10}
                  fill={isCurrent ? "#1a1a2e" : visited ? "rgba(255,255,255,0.06)" : "#0d0d14"}
                  stroke={isCurrent ? "#fbbf24" : visited ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.1)"}
                  strokeWidth={isCurrent ? 2.5 : 1.2}
                  strokeDasharray={!visited ? "4 3" : "none"} />
                <text x={cx} y={y + s / 2 + 7} textAnchor="middle"
                  fontSize={visited ? 22 : 18}
                  opacity={!visited ? 0.5 : room.cleared && !isCurrent ? 0.45 : 1}
                  style={{ userSelect:"none", pointerEvents:"none" }}>
                  {visited ? (TYPE_ICONS[room.type] || "❔") : "❓"}
                </text>
                {visited && room.cleared && room.type !== "entrance" && !isCurrent && (
                  <text x={x + s - 9} y={y + 14} fontSize={11} fontWeight="bold" fill="#4ade80"
                    style={{ userSelect:"none", pointerEvents:"none" }}>✓</text>
                )}
                {isCurrent && (
                  <text x={cx} y={y - 2} textAnchor="middle" fontSize={12}
                    style={{ userSelect:"none", pointerEvents:"none" }}>📍</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 底部：目前房間資訊 / 樓梯面板 */}
      <div style={{
        padding:"10px 14px calc(7rem + env(safe-area-inset-bottom))", borderTop:"1px solid rgba(255,255,255,0.07)",
        background:"rgba(0,0,0,0.32)", animation:"gm-fade 0.3s ease",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: showStairs ? 10 : 0 }}>
          <div style={{
            width:44, height:44, borderRadius:12, flexShrink:0,
            display:"flex", alignItems:"center", justifyContent:"center",
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", fontSize:22,
          }}>
            {TYPE_ICONS[standingRoom?.type] || "🗺️"}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:900, fontSize:14 }}>{standingRoom?.label || "探索中"}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginTop:2 }}>
              {showStairs ? "階梯就在腳下，要下去嗎？" : TYPE_HINTS[standingRoom?.type] || "點擊發亮的相鄰格子前進。"}
            </div>
          </div>
        </div>
        {showStairs && canControl && (
          <button onClick={onDescend}
            style={{
              width:"100%", padding:"13px 0", borderRadius:14, border:"none",
              fontWeight:900, fontSize:15, cursor:"pointer",
              background:"linear-gradient(90deg,#f59e0b,#d97706)", color:"white",
            }}>
            🪜 前往第 {floorIndex + 2} 層
          </button>
        )}
        {!canControl && (
          <div style={{ textAlign:"center", fontSize:12, color:"#94a3b8", padding:"10px 0 2px" }}>
            等待隊長選擇前進路線…
          </div>
        )}
      </div>

      {/* 撤退確認 */}
      {confirmExit && (
        <div style={{
          position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.7)",
          display:"flex", alignItems:"center", justifyContent:"center", padding:24,
        }}>
          <div style={{
            width:"100%", maxWidth:300, borderRadius:20, padding:"22px 18px",
            background:"#12111f", border:"1px solid rgba(255,255,255,0.1)", textAlign:"center",
          }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🏳️</div>
            <div style={{ fontWeight:900, fontSize:16, marginBottom:6 }}>要撤退嗎？</div>
            <div style={{ fontSize:12, color:"#94a3b8", marginBottom:16, lineHeight:1.6 }}>
              撤退不會獲得遠征結算獎勵，<br />已領取的金幣與寶物會保留。
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setConfirmExit(false)}
                style={{ flex:1, padding:"11px 0", borderRadius:12, border:"none", fontWeight:800,
                  background:"rgba(255,255,255,0.08)", color:"#e2e8f0", cursor:"pointer" }}>
                繼續探索
              </button>
              <button onClick={onRetreat}
                style={{ flex:1, padding:"11px 0", borderRadius:12, border:"none", fontWeight:800,
                  background:"#dc2626", color:"white", cursor:"pointer" }}>
                確定撤退
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 第 3 層：A/B/C 分支王關 ─────────────────────────────
export function BranchStage({
  branchFloor, branchChoice, branchSeq, branchStep,
  playerState, coins, lootMult, onChoose, onEnterNext, onRetreat,
  canControl = true,
}) {
  const [confirmExit, setConfirmExit] = useState(false);

  return (
    <div style={{
      minHeight:"100%",
      background:"linear-gradient(160deg,#0f0a14,#1a0a0a)",
      color:"white", display:"flex", flexDirection:"column",
    }}>
      <style>{`
@keyframes bs-fade{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}
@keyframes bs-glow{0%,100%{box-shadow:0 0 10px rgba(251,191,36,0.15)}50%{box-shadow:0 0 24px rgba(251,191,36,0.4)}}
      `}</style>

      <div style={{
        padding:"12px 14px 8px", display:"flex", alignItems:"center", gap:8,
        borderBottom:"1px solid rgba(255,255,255,0.07)", background:"rgba(0,0,0,0.25)",
      }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:900, fontSize:16, color:"#fbbf24" }}>👑 第 3 層 · 王關</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:2 }}>
            {branchChoice ? `已選 ${branchFloor.branches[branchChoice].icon} ${branchFloor.branches[branchChoice].label}` : "三條岔路，選定後無法回頭"}
          </div>
        </div>
        <button onClick={() => setConfirmExit(true)}
          style={{
            flexShrink:0, padding:"6px 12px", borderRadius:10, fontSize:11, fontWeight:700,
            background:"rgba(239,68,68,0.12)", color:"#f87171",
            border:"1px solid rgba(239,68,68,0.3)", cursor:"pointer",
          }}>
          🏳️ 撤退
        </button>
      </div>

      <PlayerStatusBar playerState={playerState} coins={coins} lootMult={lootMult} />

      {!branchChoice ? (
        // ── 選路 ──
        <div style={{ padding:"18px 16px calc(7rem + env(safe-area-inset-bottom))", display:"flex", flexDirection:"column", gap:12, justifyContent:"center" }}>
          <div style={{ textAlign:"center", marginBottom:6, animation:"bs-fade 0.4s ease both" }}>
            <div style={{ fontSize:44 }}>🚪</div>
            <div style={{ fontWeight:900, fontSize:17, marginTop:6 }}>王關入口</div>
            <div style={{ fontSize:12, color:"#94a3b8", marginTop:4 }}>每條路各有 3 間未知房間與 1 處休息區</div>
          </div>
          {["A", "B", "C"].map((key, i) => {
            const b = branchFloor.branches[key];
            return (
              <button key={key} onClick={() => canControl && onChoose(key)}
                disabled={!canControl}
                style={{
                  display:"flex", alignItems:"center", gap:12, textAlign:"left",
                  padding:"14px 16px", borderRadius:16, cursor:"pointer",
                  background:"rgba(255,255,255,0.05)", color:"white",
                  border:"1px solid rgba(251,191,36,0.2)",
                  animation:`bs-fade 0.4s ease ${0.1 + i * 0.1}s both`,
                }}>
                <span style={{ fontSize:30 }}>{b.icon}</span>
                <span style={{ flex:1, minWidth:0 }}>
                  <span style={{ display:"block", fontWeight:900, fontSize:14 }}>{b.label}</span>
                  <span style={{ display:"block", fontSize:11, color:"#94a3b8", marginTop:2 }}>❓ ❓ ❓ → 💤 → 👑 → 🏆</span>
                </span>
                <span style={{ fontSize:16, color:"#fbbf24" }}>▶</span>
              </button>
            );
          })}
        </div>
      ) : (
        // ── 分支進度 ──
        <div style={{ padding:"16px 16px calc(7rem + env(safe-area-inset-bottom))", display:"flex", flexDirection:"column" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:8, justifyContent:"center" }}>
            {branchSeq.map((room, i) => {
              const done = i < branchStep;
              const current = i === branchStep;
              const revealed = done || current || ["rest", "boss_battle", "treasure"].includes(room.type);
              return (
                <div key={room.id} style={{
                  display:"flex", alignItems:"center", gap:12, padding:"11px 14px",
                  borderRadius:14,
                  background: current ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.04)",
                  border:`1px solid ${current ? "rgba(251,191,36,0.45)" : "rgba(255,255,255,0.07)"}`,
                  opacity: done ? 0.55 : 1,
                  animation: current ? "bs-glow 2s ease infinite" : undefined,
                }}>
                  <span style={{ fontSize:22 }}>
                    {revealed ? (TYPE_ICONS[room.type] || "❔") : "❓"}
                  </span>
                  <span style={{ flex:1, fontWeight:800, fontSize:13 }}>
                    {revealed ? room.label : "未知房間"}
                  </span>
                  <span style={{ fontSize:14 }}>
                    {done ? "✅" : current ? "👉" : "🔒"}
                  </span>
                </div>
              );
            })}
          </div>
          <button onClick={onEnterNext} disabled={!canControl}
            style={{
              width:"100%", padding:"14px 0", borderRadius:16, border:"none",
              fontWeight:900, fontSize:15, cursor:"pointer", marginTop:12,
              background:"linear-gradient(90deg,#f59e0b,#d97706)", color:"white",
            }}>
            {!canControl ? "等待隊長前進…"
              : branchSeq[branchStep]?.type === "boss_battle" ? "⚔️ 挑戰 Boss！"
              : branchSeq[branchStep]?.type === "treasure" ? "🏆 進入寶藏房！"
              : "🚪 進入下一間房"}
          </button>
        </div>
      )}

      {confirmExit && (
        <div style={{
          position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.7)",
          display:"flex", alignItems:"center", justifyContent:"center", padding:24,
        }}>
          <div style={{
            width:"100%", maxWidth:300, borderRadius:20, padding:"22px 18px",
            background:"#12111f", border:"1px solid rgba(255,255,255,0.1)", textAlign:"center",
          }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🏳️</div>
            <div style={{ fontWeight:900, fontSize:16, marginBottom:6 }}>要撤退嗎？</div>
            <div style={{ fontSize:12, color:"#94a3b8", marginBottom:16, lineHeight:1.6 }}>
              撤退不會獲得遠征結算獎勵。
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setConfirmExit(false)}
                style={{ flex:1, padding:"11px 0", borderRadius:12, border:"none", fontWeight:800,
                  background:"rgba(255,255,255,0.08)", color:"#e2e8f0", cursor:"pointer" }}>
                繼續
              </button>
              <button onClick={onRetreat}
                style={{ flex:1, padding:"11px 0", borderRadius:12, border:"none", fontWeight:800,
                  background:"#dc2626", color:"white", cursor:"pointer" }}>
                確定撤退
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
