// src/components/dungeon/DungeonExpedition.jsx
// 遠征模式主體 — 單人、手動推進
// 第 1、2 層：5×5 迷霧格子地圖（expeditionGrid.generateGridFloor）
// 第 3 層：入口 → A/B/C 三選一（鎖定）→ 3 功能房 → 休息 → 王 → 寶箱
// HP / buff 全程跨房間、跨樓層持續；功能房走「本地單人模式」不寫 Firestore

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { drawFloorMonsters, drawMixedMonsterPool } from "../../lib/monsterData";
import { buildExpeditionMemberData } from "../../lib/expeditionMemberData";
import {
  getExcavationDifficulty,
  DUNGEON_SHOP_ITEMS,
  drawDungeonEvent,
} from "../../lib/dungeonData";
import {
  generateGridFloor,
  generateBranchFloor,
  isAdjacent,
  GRID_SIZE,
} from "../../lib/expeditionGrid";
import {
  createExpeditionBattleRoom,
  cleanupExpeditionRoom,
  broadcastExpeditionFailure,
  calculateExpeditionRewards,
  saveExpeditionRecord,
  grantExpeditionRewards,
} from "../../lib/expeditionDb";
import { trySetDungeonFirstClear, addDungeonBroadcast } from "../../lib/dungeonDb";
import {
  completeExcavation,
  abandonExcavation,
  removeSavedDungeon,
} from "../../lib/dungeonExcavation";
import {
  addArrowdew,
  addChests,
  addCoins,
  addMaterials,
  addMonsterCard,
} from "../../lib/db";
import {
  buildExpeditionParty,
  collectBattleStats,
  createExpeditionKillLoot,
  emptyExpeditionLoot,
  mergeExpeditionLoot,
  mergeExpeditionStats,
} from "../../lib/expeditionRewards";
import {
  sfxTap, sfxDoorOpen, sfxPathSelect, sfxBuff, sfxDebuff,
  sfxCoinDrop, sfxPotionDrink, sfxShopBuy, sfxVictory, sfxCounter,
} from "../../lib/sound";
import DungeonBattleRoom from "./DungeonBattleRoom";
import DungeonExpeditionResult from "./DungeonExpeditionResult";
import DungeonShop from "./DungeonShop";
import DungeonTrap from "./DungeonTrap";
import DungeonEvent from "./DungeonEvent";
import DungeonChest from "./DungeonChest";
import DungeonRest from "./DungeonRest";
import DungeonTreasureRoom from "./DungeonTreasureRoom";

// ── 樓層名稱 ────────────────────────────────────────────
const FLOOR_LABELS = [
  { icon:"🌿", title:"第 1 層 · 探索層", desc:"迷霧籠罩的 5×5 地圖：少量怪物與大量事件，小心陷阱！" },
  { icon:"⚔️", title:"第 2 層 · 戰鬥層", desc:"迷霧更深、怪物更多，還有一隻精英怪擋路！" },
  { icon:"👑", title:"第 3 層 · 王關",   desc:"三條岔路只能選一條——盡頭是 Boss 與寶藏！" },
];

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
function PlayerStatusBar({ playerState, coins }) {
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
  playerState, coins, onCellClick, onDescend, onRetreat,
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
      minHeight:"100dvh",
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

      <PlayerStatusBar playerState={playerState} coins={coins} />

      {/* Map */}
      <div style={{ flex:1, padding:"14px 8px 10px", display:"flex", justifyContent:"center", alignItems:"flex-start", overflow:"auto" }}>
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
        padding:"10px 14px 18px", borderTop:"1px solid rgba(255,255,255,0.07)",
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
  playerState, coins, onChoose, onEnterNext, onRetreat,
  canControl = true,
}) {
  const [confirmExit, setConfirmExit] = useState(false);

  return (
    <div style={{
      minHeight:"100dvh",
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

      <PlayerStatusBar playerState={playerState} coins={coins} />

      {!branchChoice ? (
        // ── 選路 ──
        <div style={{ flex:1, padding:"18px 16px", display:"flex", flexDirection:"column", gap:12, justifyContent:"center" }}>
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
        <div style={{ flex:1, padding:"16px", display:"flex", flexDirection:"column" }}>
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8, justifyContent:"center" }}>
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

// ── 戰鬥包裝元件 ────────────────────────────────────────
function ExpeditionBattleRoom({
  memberData, memberName, monster,
  difficultyTier, floorIndex, roomType,
  arrowsPerRound, targetFmt,
  onDone, onAbandon,
}) {
  const [roomId, setRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [battleDone, setBattleDone] = useState(false);
  const terminalHandledRef = useRef(false);
  const timerRef = useRef(null);

  // 建立戰鬥房間
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await createExpeditionBattleRoom({
        memberId: memberData?.id,
        memberName,
        memberData,
        monster,
        difficultyTier,
        floorIndex,
        roomType: roomType || "monster",
        arrowsPerRound,
        targetFmt,
      });
      if (cancelled) return;
      if (res.ok) {
        setRoomId(res.roomId);
        setLoading(false);
      } else {
        setError(res.reason);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // 用 ref 避免 stale closure
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const memberIdRef = useRef(memberData?.id);
  memberIdRef.current = memberData?.id;

  // 監聽房間狀態變化；結束時帶回戰後成員狀態（HP/buff 跨房間持續）
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, "dungeonRooms", roomId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const me = data.members?.[memberIdRef.current] || null;
      const finishBattle = (won, delay) => {
        if (terminalHandledRef.current) return;
        terminalHandledRef.current = true;
        setBattleDone(true);
        timerRef.current = setTimeout(async () => {
          await cleanupExpeditionRoom(roomId).catch(() => {});
          onDoneRef.current({ won, member: me, battle: data });
        }, delay);
      };

      // 檢測戰鬥結束
      if (data.status === "completed" && data.result === "lose") {
        finishBattle(false, 1500);
      } else if (data.status === "map_explore") {
        finishBattle(true, 300);
      }
    });
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [roomId]);

  if (loading) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4"
        style={{ background:"#0a0a0f", color:"rgba(255,255,255,0.5)" }}>
        <div style={{ fontSize:48 }}>⚔️</div>
        <div style={{ fontSize:14 }}>初始化戰鬥…</div>
      </div>
    );
  }

  if (error || !roomId) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4"
        style={{ background:"#0a0a0f", color:"rgba(255,255,255,0.5)" }}>
        <div style={{ fontSize:48 }}>❌</div>
        <div style={{ fontSize:14 }}>戰鬥建立失敗：{error || "未知錯誤"}</div>
        <button onClick={onAbandon}
          style={{ padding:"8px 24px", borderRadius:12, background:"#334155", color:"#e2e8f0", border:"none", cursor:"pointer" }}>
          返回
        </button>
      </div>
    );
  }

  if (battleDone) {
    return (
      <div className="h-[100dvh] flex items-center justify-center"
        style={{ background:"#0a0a0f", color:"rgba(255,255,255,0.4)" }}>
        結算中…
      </div>
    );
  }

  return (
    <DungeonBattleRoom
      roomId={roomId}
      isMapMode={true}
      onReturnToMap={() => {}}
      onExit={onAbandon}
    />
  );
}

// ── 樓層過場動畫 ────────────────────────────────────────
function FloorIntro({ floorIndex, difficultyTier, onStart }) {
  const [show, setShow] = useState(false);
  const [canStart, setCanStart] = useState(false);

  useEffect(() => {
    setShow(true);
    const t = setTimeout(() => setCanStart(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const floor = FLOOR_LABELS[floorIndex] || FLOOR_LABELS[0];
  const diff = getExcavationDifficulty(difficultyTier);

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center gap-6 px-6 text-white"
      style={{ background:"linear-gradient(160deg,#0f172a,#1e1b4b)" }}>
      <div style={{
        fontSize:64,
        animation: show ? "ei-bounce 0.6s ease-out" : "none",
      }}>{floor.icon}</div>
      <div style={{
        fontSize:24, fontWeight:900,
        animation: show ? "ei-fade 0.5s 0.3s ease both" : "none",
      }}>{floor.title}</div>
      <div style={{
        fontSize:13, color:"#94a3b8", textAlign:"center", maxWidth:280,
        animation: show ? "ei-fade 0.5s 0.5s ease both" : "none",
      }}>{floor.desc}</div>
      <div style={{
        display:"flex", gap:6,
        animation: show ? "ei-fade 0.5s 0.7s ease both" : "none",
      }}>
        <span style={{ background:"rgba(255,255,255,0.08)", borderRadius:6, padding:"2px 8px", fontSize:11, color:"#94a3b8" }}>
          {diff?.icon} {diff?.label}
        </span>
        {floorIndex === 2 && (
          <span style={{ background:"rgba(239,68,68,0.15)", borderRadius:6, padding:"2px 8px", fontSize:11, color:"#f87171", fontWeight:700 }}>
            ⚠️ Boss 層
          </span>
        )}
      </div>
      {canStart && (
        <button onClick={onStart}
          style={{
            padding:"14px 48px", borderRadius:14, fontWeight:900, fontSize:16,
            border:"none", cursor:"pointer",
            background:"linear-gradient(90deg,#f59e0b,#d97706)",
            color:"white",
          }}>
          {floorIndex === 2 ? "⚔️ 出發！" : "🗺️ 開始探索"}
        </button>
      )}
      <style>{`
@keyframes ei-bounce{0%{transform:scale(0.3) rotate(-20deg);opacity:0}55%{transform:scale(1.2) rotate(5deg)}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes ei-fade{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ▼▼▼  主元件  ▼▼▼
// ══════════════════════════════════════════════════════════════

export default function DungeonExpedition({
  excavation,
  profile,
  onComplete,
  onAbandon: onAbandonProp,
}) {
  const myId = profile?.id;
  const difficultyTier = excavation?.difficulty || 1;
  const isFromStorage = excavation?.fromStorage === true;
  const savedId = excavation?.savedId;
  const family = excavation?.family || "ghost";
  const fixedBoss = excavation?.boss || null;
  const isHidden = excavation?.isHidden || false;
  const arrowsPerRound = excavation?.arrowsPerRound === 3 ? 3 : 6;
  const targetFmt = excavation?.targetFmt || "full_110";
  const [phase, setPhase] = useState(isFromStorage ? "consume" : "intro");
  const [entryError, setEntryError] = useState("");

  // 從儲存槽啟動時先消耗槽位；失敗時不可進入戰鬥。
  useEffect(() => {
    if (isFromStorage && myId && savedId) {
      removeSavedDungeon(myId, savedId).then(result => {
        if (!result?.ok) {
          setEntryError(result?.reason || "無法消耗地下城儲存槽");
          setPhase("entry_error");
          return;
        }
        setPhase("intro");
      });
    }
  }, [isFromStorage, myId, savedId]);

  const [floorIndex, setFloorIndex] = useState(0);
  // 第 1、2 層：格子地圖狀態
  const [gridFloor, setGridFloor] = useState(null);
  const [playerPos, setPlayerPos] = useState(null);
  const [visitedIds, setVisitedIds] = useState(() => new Set());
  // 第 3 層：分支狀態
  const [branchFloor, setBranchFloor] = useState(null);
  const [branchChoice, setBranchChoice] = useState(null);
  const [branchStep, setBranchStep] = useState(0);
  // 進行中的房間
  const [pendingRoom, setPendingRoom] = useState(null);
  const [monsterPool, setMonsterPool] = useState({ monsters: [], elite: null, boss: null });
  const [floorsCleared, setFloorsCleared] = useState(0);
  const [wonLast, setWonLast] = useState(false);
  const [resultRewards, setResultRewards] = useState(null);
  const [runLoot, setRunLoot] = useState(() => emptyExpeditionLoot());
  const [runStats, setRunStats] = useState({});
  // 玩家持續狀態（HP / buff 跨房間、跨樓層帶著走）
  const [playerState, setPlayerState] = useState(null);
  // 可變怪物佇列（每場戰鬥消耗一隻）
  const monsterQueueRef = useRef([]);
  // 樓層事件修正（怪物 HP/ATK 倍率等）
  const floorModsRef = useRef({});
  const nextFloorModsRef = useRef({});

  const coins = profile?.coins ?? 0; // profile 為即時快照，addCoins 後自動更新

  const startFloor = useCallback((fi) => {
    setFloorIndex(fi);
    setPendingRoom(null);
    floorModsRef.current = { ...nextFloorModsRef.current };
    nextFloorModsRef.current = {};
    const monsters = drawFloorMonsters(fi, difficultyTier, {
      family,
      fixedBoss,
    });
    setMonsterPool(monsters);
    monsterQueueRef.current = [...(monsters.monsters || [])];
    if (fi < 2) {
      const gen = generateGridFloor(fi, difficultyTier);
      setGridFloor(gen);
      setPlayerPos(gen.startPos);
      setVisitedIds(new Set([gen.grid[gen.startPos.y][gen.startPos.x]]));
      setBranchFloor(null);
    } else {
      setBranchFloor(generateBranchFloor());
      setBranchChoice(null);
      setBranchStep(0);
      setGridFloor(null);
    }
    setPhase("floor_intro");
  }, [difficultyTier, family, fixedBoss]);

  // 初始化玩家狀態 + 第一層
  useEffect(() => {
    if (phase === "intro") {
      const base = buildExpeditionMemberData(profile);
      setPlayerState({
        hp: base.hp,
        maxHP: base.maxHP,
        atk: base.atk,
        def: base.def,
        buffs: { atkMult: 1, defMult: 1, dmgMult: 1, hasRevival: false },
      });
      startFloor(0);
    }
  }, [phase, startFloor]); // eslint-disable-line

  const showResult = useCallback((won, cleared) => {
    setWonLast(won);
    setFloorsCleared(cleared);
    setResultRewards(calculateExpeditionRewards({
      difficultyTier,
      floorsCleared: cleared,
      won,
    }));
    setPhase("result");
  }, [difficultyTier]);

  // ── 分支序列（第 3 層）──────────────────────────────────
  const branchSeq = useMemo(() => {
    if (!branchFloor || !branchChoice) return [];
    const b = branchFloor.branches[branchChoice];
    return [...b.rooms, branchFloor.boss, branchFloor.treasure];
  }, [branchFloor, branchChoice]);

  // ── 房間清除 ────────────────────────────────────────────
  const markRoomCleared = useCallback((roomId) => {
    setGridFloor(prev => prev ? {
      ...prev,
      rooms: prev.rooms.map(r => r.id === roomId ? { ...r, cleared: true } : r),
    } : prev);
  }, []);

  const finishPendingRoom = useCallback(() => {
    if (pendingRoom) {
      if (floorIndex < 2) {
        markRoomCleared(pendingRoom.id);
      } else {
        setBranchStep(s => s + 1);
      }
    }
    setPendingRoom(null);
    setPhase(floorIndex < 2 ? "grid" : "branch");
  }, [pendingRoom, floorIndex, markRoomCleared]);

  // ── 本地效果套用（功能房 → 玩家狀態）────────────────────
  const applyEventEffect = useCallback((ev) => {
    const eff = ev?.effect || {};
    const r2 = v => Math.round(v * 100) / 100;
    switch (eff.type) {
      case "hp_restore_all":
        sfxBuff();
        setPlayerState(p => ({ ...p, hp: Math.min(p.maxHP, Math.round(p.hp + p.maxHP * eff.value)) }));
        break;
      case "atk_debuff_all":
      case "atk_buff_one":
        (eff.value >= 1 ? sfxBuff : sfxDebuff)();
        setPlayerState(p => ({ ...p, buffs: { ...p.buffs, atkMult: r2((p.buffs.atkMult || 1) * eff.value) } }));
        break;
      case "def_mult_all":
        sfxBuff();
        setPlayerState(p => ({ ...p, buffs: { ...p.buffs, defMult: r2((p.buffs.defMult || 1) * eff.value) } }));
        break;
      case "dmg_mult_all":
        (eff.value >= 1 ? sfxBuff : sfxDebuff)();
        setPlayerState(p => ({ ...p, buffs: { ...p.buffs, dmgMult: r2((p.buffs.dmgMult || 1) * eff.value) } }));
        break;
      case "gold_bonus":
        sfxCoinDrop();
        addCoins(myId, eff.value).catch(() => {});
        break;
      case "monster_hp_mult":
        nextFloorModsRef.current.monsterHpMult = eff.value; // 「下一層怪物」
        break;
      case "monster_atk_mult":
        floorModsRef.current.monsterAtkMult = eff.value; // 「本層怪物」
        break;
      case "gold_mult":
        floorModsRef.current.goldMult = eff.value;
        break;
      case "skip_counter":
        floorModsRef.current.skipCounter = true; // 保留欄位（單人戰鬥房暫不支援）
        break;
      default:
        break;
    }
  }, [myId]);

  const handleLocalEffect = useCallback((effect) => {
    if (!effect) return;
    switch (effect.type) {
      case "hp_loss":
        sfxCounter();
        setPlayerState(p => ({ ...p, hp: Math.max(1, p.hp - effect.value) }));
        break;
      case "buff_mult":
        sfxDebuff();
        setPlayerState(p => ({
          ...p,
          buffs: { ...p.buffs, [effect.key]: Math.round((p.buffs[effect.key] || 1) * effect.value * 100) / 100 },
        }));
        break;
      case "heal_pct":
        sfxPotionDrink();
        setPlayerState(p => ({ ...p, hp: Math.min(p.maxHP, p.hp + Math.round(p.maxHP * effect.value)) }));
        break;
      case "cure":
        sfxBuff();
        setPlayerState(p => {
          const b = p.buffs || {};
          if ((b.atkMult || 1) < 1 || (b.defMult || 1) < 1) {
            return { ...p, buffs: { ...b, atkMult: 1, defMult: 1 } };
          }
          return p;
        });
        break;
      case "coins":
        sfxCoinDrop();
        addCoins(myId, effect.value).catch(() => {});
        break;
      case "event":
        applyEventEffect(effect.event);
        break;
      default:
        break;
    }
  }, [myId, applyEventEffect]);

  // 商店本地購買：扣金幣 + 套用效果
  const handleLocalBuy = useCallback((item) => {
    sfxShopBuy();
    addCoins(myId, -item.cost).catch(() => {});
    setPlayerState(p => {
      const r2 = v => Math.round(v * 100) / 100;
      switch (item.effect) {
        case "hp_restore":
          return { ...p, hp: Math.min(p.maxHP, Math.round(p.hp + p.maxHP * item.value)) };
        case "hp_max_boost": {
          const maxHP = Math.round(p.maxHP * (1 + item.value));
          return { ...p, maxHP, hp: Math.min(maxHP, Math.round(p.hp * (1 + item.value))) };
        }
        case "atk_mult":
          return { ...p, buffs: { ...p.buffs, atkMult: r2((p.buffs.atkMult || 1) * item.value) } };
        case "def_mult":
          return { ...p, buffs: { ...p.buffs, defMult: r2((p.buffs.defMult || 1) * item.value) } };
        case "revival":
          return { ...p, buffs: { ...p.buffs, hasRevival: true } };
        default:
          return p;
      }
    });
  }, [myId]);

  // ── 進入房間 ────────────────────────────────────────────
  const enterRoom = useCallback((room) => {
    const r = { ...room };
    if (["battle", "elite_battle", "boss_battle"].includes(r.type)) {
      const mods = floorModsRef.current;
      const fallbackVariant = floorIndex === 0
        ? "weak"
        : floorIndex === 2
          ? "strong"
          : "normal";
      let mon = r.type === "elite_battle" ? monsterPool.elite
        : r.type === "boss_battle" ? monsterPool.boss
        : (monsterQueueRef.current.shift()
          || drawMixedMonsterPool(1, fallbackVariant, Math.max(1, difficultyTier))[0]);
      if (!mon) {
        // 空房間：直接視為完成
        if (floorIndex < 2) markRoomCleared(r.id);
        else setBranchStep(s => s + 1);
        return;
      }
      r.monster = {
        ...mon,
        hp:  Math.round((mon.hp  || 100) * (mods.monsterHpMult  || 1)),
        atk: Math.round((mon.atk || 10) * (mods.monsterAtkMult || 1)),
      };
      setPendingRoom(r);
      setPhase("battle");
      return;
    }
    if (r.type === "treasure") {
      setPendingRoom(r);
      setPhase("treasure");
      return;
    }
    if (r.type === "shop") {
      const shuffled = [...DUNGEON_SHOP_ITEMS].sort(() => Math.random() - 0.5);
      r.shopItems = shuffled.slice(0, 5).map(i => i.id);
    }
    if (r.type === "event") {
      r.event = drawDungeonEvent();
    }
    setPendingRoom(r);
    setPhase("func_room");
  }, [monsterPool, difficultyTier, floorIndex, markRoomCleared]);

  // ── 格子點擊移動 ────────────────────────────────────────
  const handleCellClick = useCallback((room) => {
    if (!room || !playerPos || !isAdjacent(room.pos, playerPos)) return;
    sfxTap();
    setPlayerPos({ ...room.pos });
    setVisitedIds(prev => {
      const next = new Set(prev);
      next.add(room.id);
      return next;
    });
    if (room.cleared) return;             // 已清除 → 自由通行、不再觸發
    if (room.type === "stairs") return;   // 樓梯：站上後由底部面板確認下樓
    enterRoom(room);
  }, [playerPos, enterRoom]);

  const handleDescend = useCallback(() => {
    sfxDoorOpen();
    setFloorsCleared(prev => Math.max(prev, floorIndex + 1));
    startFloor(floorIndex + 1);
  }, [floorIndex, startFloor]);

  // ── 分支操作（第 3 層）──────────────────────────────────
  const handleChooseBranch = useCallback((key) => {
    sfxPathSelect();
    setBranchChoice(key); // 選定即鎖
  }, []);

  const handleBranchNext = useCallback(() => {
    const room = branchSeq[branchStep];
    if (!room) return;
    sfxDoorOpen();
    enterRoom(room);
  }, [branchSeq, branchStep, enterRoom]);

  // ── 戰鬥結束 ────────────────────────────────────────────
  const handleBattleDone = useCallback(({ won, member, battle }) => {
    // 戰後同步 HP/buff（用 ?? 避免 0 被復活）
    if (member) {
      setPlayerState(prev => prev ? {
        ...prev,
        hp:    member.hp    ?? prev.hp,
        maxHP: member.maxHP ?? prev.maxHP,
        atk:   member.atk   ?? prev.atk,
        def:   member.def   ?? prev.def,
        buffs: { ...prev.buffs, ...(member.buffs || {}) },
      } : prev);
    }
    if (!won) {
      if (!isFromStorage) abandonExcavation(myId).catch(() => {});
      const diff = getExcavationDifficulty(difficultyTier);
      broadcastExpeditionFailure(profile?.name, diff?.label || "").catch(() => {});
      showResult(false, Math.max(floorsCleared, floorIndex));
      return;
    }
    const killLoot = createExpeditionKillLoot(battle?.monster || pendingRoom?.monster);
    if (killLoot.chests.length > 0) {
      addChests(myId, killLoot.chests).catch(() => {});
      setRunLoot(previous => mergeExpeditionLoot(previous, killLoot));
    }
    setRunStats(previous => mergeExpeditionStats(
      previous,
      collectBattleStats(battle?.log),
    ));
    finishPendingRoom();
  }, [myId, isFromStorage, floorIndex, floorsCleared, difficultyTier, profile, pendingRoom, finishPendingRoom, showResult]);

  const handleAbandon = useCallback(() => {
    if (!isFromStorage) abandonExcavation(myId).catch(() => {});
    onAbandonProp?.();
  }, [myId, isFromStorage, onAbandonProp]);

  // 寶藏房獎勵入袋（金幣 + 收藏品；一次性）
  const handleTreasureLoot = useCallback((loot) => {
    if (!loot) return;
    if (loot.coins > 0) addCoins(myId, loot.coins).catch(() => {});
    if (loot.arrowDew > 0) addArrowdew(myId, loot.arrowDew).catch(() => {});
    if (loot.material?.id) addMaterials(myId, [loot.material]).catch(() => {});
    if (loot.card) addMonsterCard(myId, loot.card).catch(() => {});
    const treasureChestLoot = createExpeditionKillLoot(
      fixedBoss || monsterPool.boss || {
        id: "treasure_reward",
        name: "寶藏房",
        family,
        tier: ["common","rare","elite","fierce","boss","mythic"][difficultyTier - 1] || "common",
        variant: "boss",
      },
    );
    if (treasureChestLoot.chests.length > 0) {
      addChests(myId, treasureChestLoot.chests).catch(() => {});
    }
    if (loot.extraItem?.id) {
      import("../../lib/dungeonDb").then(({ addCollectibles }) => {
        addCollectibles(myId, [{ itemId: loot.extraItem.id, qty: 1 }]).catch(() => {});
      }).catch(() => {});
    }
    setRunLoot(previous => mergeExpeditionLoot(previous, treasureChestLoot, {
      bonusCoins: loot.coins || 0,
      bonusArrowDew: loot.arrowDew || 0,
      treasure: [
        ...(loot.material ? [{ ...loot.material, kind: "material" }] : []),
        ...(loot.extraItem ? [{ ...loot.extraItem, kind: "collectible" }] : []),
        ...(loot.card ? [{ ...loot.card, kind: "card" }] : []),
        ...(loot.arrowDew > 0
          ? [{ id: "arrowdew", name: `箭露 +${loot.arrowDew}`, icon: "💧", kind: "resource" }]
          : []),
      ],
    }));
  }, [myId, fixedBoss, monsterPool.boss, family, difficultyTier]);

  // 領取獎勵 + 儲存紀錄
  const handleFinish = useCallback(() => {
    const rewards = resultRewards;
    if (!rewards) return;
    // 發放獎勵
    grantExpeditionRewards(myId, rewards).catch(() => {});
    // 儲存紀錄
    saveExpeditionRecord(myId, {
      family,
      difficulty: difficultyTier,
      isHidden,
      floorsCleared,
      won: wonLast,
      coins: rewards.coins,
      arrowDew: rewards.arrowDew,
      archerXP: rewards.archerXP,
    }).catch(() => {});

    // ── 遠征首殺判定 ────────────────────────────────────────
    if (wonLast) {
      const expeditionKey = `expedition_${family}_${difficultyTier}`;
      const diff = getExcavationDifficulty(difficultyTier);
      const FAMILY_MAP = { ghost:{e:"👻",l:"幽冥系"}, mountain:{e:"⛰️",l:"山嶺系"}, insect:{e:"🦋",l:"昆蟲系"}, workplace:{e:"💼",l:"職場系"}, exam:{e:"📝",l:"考試系"}, temple:{e:"🏛️",l:"神廟系"}, treasure:{e:"📦",l:"寶箱族"} };
      const f = FAMILY_MAP[family] || {e:"🏰",l:"遠征"};
      trySetDungeonFirstClear(expeditionKey, myId, profile?.name || "射手", []).then(fcResult => {
        if (fcResult.isFirst) {
          addDungeonBroadcast(expeditionKey, `遠征-${f.l}`, diff?.label || `Lv.${difficultyTier}`, f.e, [], profile?.nickname || profile?.name || "射手").catch(() => {});
        }
      }).catch(() => {});
    }

    // 重置挖掘進度
    if (!isFromStorage) completeExcavation(myId).catch(() => {});
    onComplete?.();
    return true;
  }, [resultRewards, myId, isFromStorage, difficultyTier, floorsCleared, wonLast, family, isHidden, profile, onComplete]);

  // ── 本地房間文件（功能房共用，隨 playerState 即時更新）──
  const localRoomDoc = useMemo(() => {
    if (!playerState) return null;
    return {
      members: {
        [myId]: {
          name: profile?.name || "射手",
          hp: playerState.hp,
          maxHP: playerState.maxHP,
          atk: playerState.atk,
          def: playerState.def,
          alive: playerState.hp > 0,
          role: "front",
          buffs: playerState.buffs,
        },
      },
      roomConfirms: {},
      roomChoices: {},
      shopItems: pendingRoom?.shopItems || [],
      shopPurchases: {},
      currentEvent: pendingRoom?.event || null,
      mapDungeonId: `${family}_expedition`,
      activeRoomId: pendingRoom?.id || null,
    };
  }, [playerState, pendingRoom, myId, profile, family]);

  // ── 渲染 ────────────────────────────────────────────────

  if (phase === "entry_error") {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 text-white"
        style={{ background:"#0a0a0f" }}>
        <div className="text-5xl">⚠️</div>
        <div className="text-lg font-black">無法開始地下城</div>
        <div className="text-sm text-rose-300 text-center">{entryError}</div>
        <button onClick={onAbandonProp}
          className="px-6 py-3 rounded-xl bg-slate-700 font-bold">
          返回地下城選單
        </button>
      </div>
    );
  }

  if (phase === "floor_intro") {
    return (
      <FloorIntro
        floorIndex={floorIndex}
        difficultyTier={difficultyTier}
        onStart={() => setPhase(floorIndex < 2 ? "grid" : "branch")}
      />
    );
  }

  if (phase === "grid" && gridFloor && playerState) {
    return (
      <GridMapStage
        gridFloor={gridFloor}
        playerPos={playerPos}
        visitedIds={visitedIds}
        floorIndex={floorIndex}
        playerState={playerState}
        coins={coins}
        onCellClick={handleCellClick}
        onDescend={handleDescend}
        onRetreat={handleAbandon}
      />
    );
  }

  if (phase === "branch" && branchFloor && playerState) {
    return (
      <BranchStage
        branchFloor={branchFloor}
        branchChoice={branchChoice}
        branchSeq={branchSeq}
        branchStep={branchStep}
        playerState={playerState}
        coins={coins}
        onChoose={handleChooseBranch}
        onEnterNext={handleBranchNext}
        onRetreat={handleAbandon}
      />
    );
  }

  // 功能房（本地單人模式）
  if (phase === "func_room" && pendingRoom && localRoomDoc) {
    const common = {
      roomId: "local",
      room: localRoomDoc,
      memberId: myId,
      isHost: true,
      localMode: true,
      onLocalEffect: handleLocalEffect,
      onLocalDone: finishPendingRoom,
    };
    switch (pendingRoom.type) {
      case "shop":
        return (
          <DungeonShop
            {...common}
            memberData={{ id: myId, coins, hp: playerState.hp, maxHP: playerState.maxHP, buffs: playerState.buffs }}
            onLocalBuy={handleLocalBuy}
          />
        );
      case "trap":
        return <DungeonTrap {...common} />;
      case "event":
        return <DungeonEvent {...common} />;
      case "chest":
        return <DungeonChest {...common} />;
      case "rest":
        return <DungeonRest {...common} />;
      default:
        // 不認得的房型：提供手動跳過（避免 render 期間觸發 setState）
        return (
          <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 text-white/60"
            style={{ background:"#0a0a0f" }}>
            <div style={{ fontSize:40 }}>🗺️</div>
            <button onClick={finishPendingRoom}
              style={{ padding:"10px 28px", borderRadius:12, border:"none", cursor:"pointer",
                background:"#334155", color:"#e2e8f0", fontWeight:800 }}>
              繼續探索
            </button>
          </div>
        );
    }
  }

  // 寶藏房（第 3 層終點）
  if (phase === "treasure") {
    return (
      <DungeonTreasureRoom
        difficultyTier={difficultyTier}
        family={family}
        onLoot={handleTreasureLoot}
        onClaim={() => { sfxVictory(); showResult(true, 3); }}
      />
    );
  }

  if (phase === "battle" && pendingRoom?.monster && playerState) {
    return (
      <ExpeditionBattleRoom
        key={pendingRoom.id}
        memberData={{
          ...buildExpeditionMemberData(profile),
          id: myId,
          hp: playerState.hp,
          maxHP: playerState.maxHP,
          atk: playerState.atk,
          def: playerState.def,
          buffs: playerState.buffs,
        }}
        memberName={profile?.name || "射手"}
        monster={pendingRoom.monster}
        difficultyTier={difficultyTier}
        floorIndex={floorIndex}
        roomType={pendingRoom.type === "boss_battle" ? "boss" : pendingRoom.type === "elite_battle" ? "elite" : "monster"}
        arrowsPerRound={arrowsPerRound}
        targetFmt={targetFmt}
        onDone={handleBattleDone}
        onAbandon={handleAbandon}
      />
    );
  }

  // ── 結算畫面 ────────────────────────────────────────────
  if (phase === "result") {
    if (!resultRewards) return null;
    return (
      <DungeonExpeditionResult
        won={wonLast}
        family={family}
        difficultyTier={difficultyTier}
        isHidden={isHidden}
        rewards={resultRewards}
        loot={runLoot}
        party={buildExpeditionParty({
          [myId]: {
            name: profile?.name || "射手",
            alive: playerState?.hp > 0,
          },
        }, myId, runStats)}
        boss={fixedBoss || monsterPool.boss}
        floorsCleared={floorsCleared}
        onFinish={handleFinish}
      />
    );
  }

  return (
    <div className="h-[100dvh] flex items-center justify-center text-white/40"
      style={{ background:"#0a0a0f" }}>
      載入遠征…
    </div>
  );
}
