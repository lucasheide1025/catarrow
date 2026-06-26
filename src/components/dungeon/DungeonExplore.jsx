// src/components/dungeon/DungeonExplore.jsx — 地下城探索主畫面（Phase 2）
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import DungeonMap from "./DungeonMap";
import {
  getDungeonFloor, getReachableRooms, getRoomMeta, getContractBadge,
  getContractDesc, DUNGEON_MAPS,
} from "../../lib/dungeonData";
import {
  subscribeDungeonRoom, saveMapExploration, proposeMapMove,
  castMapVote, resolveMapVote, advanceMapFloor, enterMapCombatRoom,
  returnToMapAfterBattle, addMapLoot,
} from "../../lib/dungeonDb";
import DungeonBattleRoom from "./DungeonBattleRoom";

const VOTE_SEC = 30;

// ── 非戰鬥房間事件 modal ──────────────────────────────────────
function RoomEventModal({ room, memberHPs, onClose }) {
  const meta = getRoomMeta(room.type);
  if (!room) return null;

  const eventInfo = {
    chest:    { title:"發現寶箱！", color:"#4ade80", desc:"獲得素材與金幣。（Phase 3 接掉寶表）", icon:"📦" },
    rest:     { title:"休息室",     color:"#a78bfa", desc:"全體回復 30% 最大血量。", icon:"💤" },
    trap:     { title:"陷阱！",     color:"#f87171", desc:"踩到機關，全體受到傷害。", icon:"🪤" },
    merchant: { title:"神秘商人",   color:"#60a5fa", desc:"可用金幣購買道具。（Phase 3 接商店）", icon:"🛒" },
    teleport: { title:"傳送陣",     color:"#e879f9", desc:"傳送到同層已探索的另一個房間。", icon:"🌀" },
    event:    { title:"特殊事件",   color:"#fde68a", desc:"發生了神秘的事件……", icon:"✨" },
    stairs:   { title:"找到樓梯！", color:"#94a3b8", desc:"可以前往下一層。", icon:"🪜" },
  }[room.type] || { title: meta.label, color: meta.color, desc: "", icon: meta.icon };

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      zIndex:100, backdropFilter:"blur(4px)",
    }}>
      <div style={{
        width:"100%", maxWidth:480, background:"linear-gradient(160deg,#1a1a2e,#16213e)",
        borderRadius:"24px 24px 0 0", padding:"24px 20px 36px",
        border:"1.5px solid rgba(255,255,255,0.1)", borderBottom:"none",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <div style={{
            width:52, height:52, borderRadius:14, fontSize:28,
            background: eventInfo.color + "22",
            border:`1.5px solid ${eventInfo.color}44`,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {eventInfo.icon}
          </div>
          <div>
            <div style={{ fontWeight:900, fontSize:17, color: eventInfo.color }}>{eventInfo.title}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>{room.label}</div>
          </div>
        </div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", marginBottom:20 }}>
          {eventInfo.desc}
        </div>
        <button onClick={onClose} style={{
          width:"100%", padding:"13px 0", borderRadius:14, fontWeight:900,
          fontSize:15, border:"none", cursor:"pointer",
          background:`linear-gradient(90deg,${eventInfo.color},${eventInfo.color}cc)`,
          color:"#000",
        }}>
          確認，繼續探索
        </button>
      </div>
    </div>
  );
}

// ── 投票 UI ───────────────────────────────────────────────────
function VoteOverlay({ proposal, room, memberId, isHost, onVote, onResolve, onSkip }) {
  const [secLeft, setSecLeft] = useState(VOTE_SEC);
  const timerRef = useRef(null);

  useEffect(() => {
    setSecLeft(VOTE_SEC);
    timerRef.current = setInterval(() => {
      setSecLeft(s => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          if (isHost) onResolve();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [proposal?.targetRoomId]); // eslint-disable-line

  const votes      = room?.mapVotes || {};
  const totalVotes = Object.keys(room?.members || {}).length;
  const votedFor   = votes[memberId];
  const voteCount  = Object.values(votes).filter(v => v === proposal.targetRoomId).length;

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      zIndex:90, backdropFilter:"blur(3px)",
    }}>
      <div style={{
        width:"100%", maxWidth:480, background:"linear-gradient(160deg,#1c1008,#2d1a0a)",
        borderRadius:"24px 24px 0 0", padding:"20px 18px 32px",
        border:"1.5px solid rgba(245,158,11,0.3)", borderBottom:"none",
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ fontWeight:900, fontSize:15, color:"#fbbf24" }}>🗺️ 隊長提議移動</div>
          <div style={{
            fontWeight:900, fontSize:22, color: secLeft <= 10 ? "#ef4444" : "#fbbf24",
            minWidth:36, textAlign:"right",
          }}>
            {secLeft}s
          </div>
        </div>

        <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", marginBottom:16 }}>
          前往 <b style={{ color:"white" }}>{proposal.targetRoomId}</b> 房間
          {" — "}已有 <b style={{ color:"#4ade80" }}>{voteCount}/{totalVotes}</b> 人同意
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button
            onClick={() => onVote(proposal.targetRoomId)}
            disabled={!!votedFor}
            style={{
              flex:2, padding:"12px 0", borderRadius:14, fontWeight:900,
              fontSize:14, border:"none", cursor: votedFor ? "default" : "pointer",
              background: votedFor === proposal.targetRoomId
                ? "rgba(74,222,128,0.3)"
                : "linear-gradient(90deg,#22c55e,#16a34a)",
              color: votedFor === proposal.targetRoomId ? "#4ade80" : "white",
            }}>
            {votedFor ? "✓ 已同意" : "👍 同意前往"}
          </button>
          {isHost && (
            <button onClick={onSkip} style={{
              flex:1, padding:"12px 0", borderRadius:14, fontWeight:800,
              fontSize:13, border:"1px solid rgba(255,255,255,0.15)",
              background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.5)",
              cursor:"pointer",
            }}>
              取消
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 主元件 ────────────────────────────────────────────────────
export default function DungeonExplore({
  dungeon: dungeonProp,  // preview mode（無 roomId 時使用）
  roomId,                // Firestore room doc ID（多人模式）
  isHost = true,
  memberId,
  profile,
  onBack,
  onEnterBattle,         // (roomId) => void — 切換到 DungeonBattleRoom
}) {
  // ── 決定用哪個 dungeon 資料 ─────────────────────────────────
  const [room,       setRoom]       = useState(null);
  const [eventModal, setEventModal] = useState(null); // room object | null
  const [battleMode, setBattleMode] = useState(false);

  // Local state (用於 preview 或 host 的操作 source of truth)
  const [floorIndex,    setFloorIndex]    = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [exploredIds,   setExploredIds]   = useState(new Set());
  const [clearedIds,    setClearedIds]    = useState(new Set());
  const [inited,        setInited]        = useState(false);

  // Firestore 訂閱
  useEffect(() => {
    if (!roomId) return;
    return subscribeDungeonRoom(roomId, setRoom);
  }, [roomId]);

  // 從 Firestore 同步地圖狀態（非 host 或初始 load）
  useEffect(() => {
    if (!room) return;
    if (room.mapFloorIndex   != null) setFloorIndex(room.mapFloorIndex);
    if (room.mapCurrentRoomId)        setCurrentRoomId(room.mapCurrentRoomId);
    if (room.mapExploredIds)          setExploredIds(new Set(room.mapExploredIds));
    if (room.mapClearedIds)           setClearedIds(new Set(room.mapClearedIds));
    setInited(true);
  }, [room]);

  // preview mode init
  useEffect(() => {
    if (roomId) return;
    const dungeon = dungeonProp;
    if (!dungeon) return;
    const startId = dungeon.floors?.[0]?.startRoomId;
    setCurrentRoomId(startId);
    setExploredIds(new Set(startId ? [startId] : []));
    setInited(true);
  }, [dungeonProp, roomId]);

  const dungeon  = dungeonProp || DUNGEON_MAPS.find(d => d.id === room?.mapDungeonId);
  const floorData = dungeon ? getDungeonFloor(dungeon, floorIndex) : null;

  const reachableIds = useMemo(
    () => floorData && currentRoomId ? getReachableRooms(floorData, currentRoomId) : new Set(),
    [floorData, currentRoomId]
  );

  const voteProposal = room?.mapVoteProposal || null;

  // ── 處理房間點擊 ─────────────────────────────────────────────
  const handleRoomClick = useCallback(async (roomId_) => {
    if (!floorData) return;
    const clickedRoom = floorData.rooms.find(r => r.id === roomId_);
    if (!clickedRoom) return;

    // 更新本地探索狀態
    const newExplored = new Set([...exploredIds, roomId_]);
    setExploredIds(newExplored);
    setCurrentRoomId(roomId_);

    // 儲存到 Firestore（host only）
    if (roomId && isHost) {
      await saveMapExploration(roomId, {
        floorIndex, currentRoomId: roomId_, exploredIds: newExplored, clearedIds,
      });
    }

    // 決定行為
    if (["monster","elite","boss"].includes(clickedRoom.type)) {
      if (roomId && isHost) {
        // Phase 2: 準備進入戰鬥（Phase 3 完整接戰鬥）
        setEventModal({ ...clickedRoom, _type:"battle_preview" });
      } else {
        setEventModal({ ...clickedRoom, _type:"battle_preview" });
      }
    } else if (clickedRoom.type === "stairs") {
      setEventModal(clickedRoom);
    } else {
      setEventModal(clickedRoom);
    }
  }, [floorData, exploredIds, clearedIds, floorIndex, roomId, isHost]);

  // host 提案移動（有多人時走投票）
  const handleProposeMove = useCallback(async (targetRoomId) => {
    const memberCount = Object.keys(room?.members || {}).length;
    if (memberCount <= 1 || !roomId) {
      // 單人直接移動
      handleRoomClick(targetRoomId);
    } else {
      // 多人：發起投票
      await proposeMapMove(roomId, targetRoomId);
      await castMapVote(roomId, memberId, targetRoomId); // host 自動投自己
    }
  }, [room, roomId, memberId, handleRoomClick]);

  const handleVote = useCallback(async (targetRoomId) => {
    if (!roomId || !memberId) return;
    await castMapVote(roomId, memberId, targetRoomId);
  }, [roomId, memberId]);

  const handleResolveVote = useCallback(async () => {
    if (!roomId || !isHost) return;
    const res = await resolveMapVote(roomId, room, voteProposal?.targetRoomId);
    if (res.ok) handleRoomClick(res.winner);
  }, [roomId, isHost, room, voteProposal, handleRoomClick]);

  // 切換樓層
  const handleNextFloor = useCallback(async () => {
    const nextIdx = floorIndex + 1;
    if (!dungeon || nextIdx >= dungeon.floorCount) return;
    if (roomId && isHost) {
      await advanceMapFloor(roomId, dungeon, nextIdx);
    } else {
      const nextFloor = getDungeonFloor(dungeon, nextIdx);
      if (!nextFloor) return;
      setFloorIndex(nextIdx);
      setCurrentRoomId(nextFloor.startRoomId);
      setExploredIds(new Set([nextFloor.startRoomId]));
    }
    setEventModal(null);
  }, [floorIndex, dungeon, roomId, isHost]);

  if (!inited || !dungeon) {
    return <div style={{ minHeight:"100dvh", background:"#0a0a0f", color:"rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>載入地圖…</div>;
  }

  // 進行中的戰鬥（Phase 3: 完整接 DungeonBattleRoom）
  if (battleMode && roomId) {
    return (
      <DungeonBattleRoom
        roomId={roomId}
        onBack={async () => {
          const curRoom = floorData?.rooms?.find(r => r.id === currentRoomId);
          if (curRoom && roomId && isHost) {
            await returnToMapAfterBattle(roomId, currentRoomId, [...clearedIds]);
            setClearedIds(new Set([...clearedIds, currentRoomId]));
          }
          setBattleMode(false);
        }}
      />
    );
  }

  const currentRoom = floorData?.rooms?.find(r => r.id === currentRoomId);
  const totalFloors = dungeon.floorCount || 1;

  return (
    <div style={{
      minHeight:"100dvh", background:"linear-gradient(160deg,#0a0a0f,#12091a,#0a0f0a)",
      color:"white", display:"flex", flexDirection:"column", position:"relative",
    }}>
      {/* ── 頂部標題列 ── */}
      <div style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"12px 14px 8px", borderBottom:"1px solid rgba(255,255,255,0.07)", flexShrink:0,
      }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#94a3b8", fontSize:18, cursor:"pointer", padding:"2px 6px" }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:900, fontSize:16, color:"#fbbf24" }}>
            {dungeon.emoji} {dungeon.name}
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>
            第 {floorIndex + 1} 層 / 共 {totalFloors} 層
            {roomId && <span style={{ marginLeft:6, color:"rgba(255,255,255,0.2)" }}>
              {isHost ? "（房主）" : "（隊員）"}
            </span>}
          </div>
        </div>
        {/* 樓層進度點 */}
        <div style={{ display:"flex", gap:4 }}>
          {Array.from({ length: totalFloors }, (_, i) => (
            <div key={i} style={{
              width:8, height:8, borderRadius:"50%",
              background: i < floorIndex ? "#4ade80" : i === floorIndex ? "#fbbf24" : "rgba(255,255,255,0.12)",
            }} />
          ))}
        </div>
      </div>

      {/* ── 探索地圖 ── */}
      <div style={{ flex:1, padding:"16px 8px", display:"flex", alignItems:"flex-start", justifyContent:"center", overflowY:"auto" }}>
        <DungeonMap
          floorData={floorData}
          exploredIds={exploredIds}
          currentRoomId={currentRoomId}
          reachableIds={reachableIds}
          clearedIds={clearedIds}
          onRoomClick={isHost ? handleProposeMove : undefined}
          pendingVoteRoomId={voteProposal?.targetRoomId}
          disabled={!!voteProposal || !isHost}
        />
      </div>

      {/* ── 底部提示 ── */}
      <div style={{ flexShrink:0, padding:"8px 16px 24px", textAlign:"center", fontSize:11, color:"rgba(255,255,255,0.2)" }}>
        {isHost ? "點擊發光的房間移動" : "等待隊長決定路線"}
      </div>

      {/* ── 投票 overlay ── */}
      {voteProposal && (
        <VoteOverlay
          proposal={voteProposal}
          room={room}
          memberId={memberId}
          isHost={isHost}
          onVote={handleVote}
          onResolve={handleResolveVote}
          onSkip={isHost ? async () => {
            const { updateDoc, doc: firestoreDoc } = await import("firebase/firestore");
            const { db: firestoreDb } = await import("../../lib/firebase");
            await updateDoc(firestoreDoc(firestoreDb, "dungeonRooms", roomId), { mapVoteProposal: null, mapVotes: {} });
          } : undefined}
        />
      )}

      {/* ── 非戰鬥房間 modal ── */}
      {eventModal && eventModal._type !== "battle_preview" && (
        <RoomEventModal
          room={eventModal}
          memberHPs={{}}
          onClose={async () => {
            if (eventModal.type === "stairs") {
              await handleNextFloor();
            } else {
              // 標記已清除
              setClearedIds(prev => new Set([...prev, eventModal.id]));
              if (roomId && isHost) {
                await saveMapExploration(roomId, {
                  floorIndex, currentRoomId, exploredIds,
                  clearedIds: new Set([...clearedIds, eventModal.id]),
                });
              }
              setEventModal(null);
            }
          }}
        />
      )}

      {/* ── 戰鬥房間預告（Phase 2 stub） ── */}
      {eventModal?._type === "battle_preview" && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.8)",
          display:"flex", alignItems:"flex-end", justifyContent:"center",
          zIndex:100, backdropFilter:"blur(4px)",
        }}>
          <div style={{
            width:"100%", maxWidth:480, background:"linear-gradient(160deg,#1a0a0a,#2d0a0a)",
            borderRadius:"24px 24px 0 0", padding:"24px 20px 36px",
            border:"1.5px solid rgba(239,68,68,0.3)", borderBottom:"none",
          }}>
            {(() => {
              const meta   = getRoomMeta(eventModal.type);
              const badge  = getContractBadge(eventModal);
              const desc   = getContractDesc({ type: eventModal.meta?.contract, param: eventModal.meta?.contractParam });
              return (
                <>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                    <div style={{ fontSize:36 }}>{meta.icon}</div>
                    <div>
                      <div style={{ fontWeight:900, fontSize:16, color: meta.color }}>{meta.label}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>{eventModal.label}</div>
                    </div>
                  </div>
                  {badge && (
                    <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:10, padding:"8px 12px", marginBottom:14, border:`1px solid ${badge.color}33` }}>
                      <span style={{ fontWeight:900, color: badge.color }}>⚔️ {badge.label}</span>
                      <span style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginLeft:8 }}>{desc}</span>
                    </div>
                  )}
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:18 }}>
                    T{eventModal.meta?.tier || 1} 等級怪物正在等待。準備好你的弓箭！
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button
                      onClick={() => {
                        setEventModal(null);
                        if (roomId && isHost) {
                          enterMapCombatRoom(roomId, room, eventModal.meta || {});
                          setBattleMode(true);
                        } else {
                          setBattleMode(true);
                        }
                      }}
                      style={{
                        flex:2, padding:"13px 0", borderRadius:14, fontWeight:900,
                        fontSize:15, border:"none", cursor:"pointer",
                        background:"linear-gradient(90deg,#dc2626,#ef4444)", color:"white",
                      }}>
                      ⚔️ 進入戰鬥！
                    </button>
                    <button onClick={() => setEventModal(null)} style={{
                      flex:1, padding:"13px 0", borderRadius:14, fontWeight:800,
                      fontSize:13, border:"1px solid rgba(255,255,255,0.1)",
                      background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.5)",
                      cursor:"pointer",
                    }}>
                      撤退
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
