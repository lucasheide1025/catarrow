// src/components/dungeon/DungeonExplore.jsx — 地下城探索主畫面（Phase 1 MVP）
import { useState, useMemo } from "react";
import DungeonMap from "./DungeonMap";
import { getDungeonFloor, getReachableRooms, getRoomMeta, getContractBadge, getContractDesc } from "../../lib/dungeonData";

export default function DungeonExplore({ dungeon, onBack }) {
  const [floorIndex,    setFloorIndex]    = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(() => dungeon?.floors?.[0]?.startRoomId);
  const [exploredIds,   setExploredIds]   = useState(() => {
    const start = dungeon?.floors?.[0]?.startRoomId;
    return start ? new Set([start]) : new Set();
  });
  const [roomCard, setRoomCard] = useState(null); // null | room object

  const floorData = getDungeonFloor(dungeon, floorIndex);

  const reachableIds = useMemo(
    () => floorData ? getReachableRooms(floorData, currentRoomId) : new Set(),
    [floorData, currentRoomId]
  );

  function handleRoomClick(roomId) {
    const room = floorData?.rooms?.find(r => r.id === roomId);
    if (!room) return;
    setCurrentRoomId(roomId);
    setExploredIds(prev => new Set([...prev, roomId]));
    setRoomCard(room);
  }

  function handleNextFloor() {
    const nextIndex = floorIndex + 1;
    if (nextIndex >= dungeon.floorCount) return;
    const nextFloor = getDungeonFloor(dungeon, nextIndex);
    if (!nextFloor) return;
    setFloorIndex(nextIndex);
    setCurrentRoomId(nextFloor.startRoomId);
    setExploredIds(new Set([nextFloor.startRoomId]));
    setRoomCard(null);
  }

  const currentRoom = floorData?.rooms?.find(r => r.id === currentRoomId);
  const currentMeta = currentRoom ? getRoomMeta(currentRoom.type) : null;
  const totalFloors = dungeon?.floorCount || 1;

  return (
    <div style={{
      minHeight:"100dvh", background:"linear-gradient(160deg,#0a0a0f,#12091a,#0a0f0a)",
      color:"white", display:"flex", flexDirection:"column",
    }}>
      {/* ── 頂部標題列 ── */}
      <div style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"12px 14px 8px", borderBottom:"1px solid rgba(255,255,255,0.07)",
        flexShrink:0,
      }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#94a3b8", fontSize:18, cursor:"pointer", padding:"2px 6px" }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:900, fontSize:16, color:"#fbbf24" }}>
            {dungeon?.emoji} {dungeon?.name}
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>
            第 {floorIndex + 1} 層 / 共 {totalFloors} 層
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
          onRoomClick={handleRoomClick}
        />
      </div>

      {/* ── 當前房間資訊卡（底部浮出） ── */}
      {roomCard && currentMeta && (
        <div style={{
          flexShrink:0,
          padding:"14px 16px 24px",
          borderTop:"1px solid rgba(255,255,255,0.08)",
          background:"rgba(0,0,0,0.5)",
          backdropFilter:"blur(8px)",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{
              width:44, height:44, borderRadius:12,
              background: currentMeta.nodeColor,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, border:`1.5px solid ${currentMeta.color}44`,
            }}>
              {currentMeta.icon}
            </div>
            <div>
              <div style={{ fontWeight:900, fontSize:15, color: currentMeta.color }}>
                {currentMeta.label}
              </div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>
                {roomCard.label}
              </div>
            </div>
          </div>

          {/* 房間類型說明 */}
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:8 }}>
            {ROOM_DESC[roomCard.type] || "未知房間"}
          </div>

          {/* 合約規則說明（戰鬥房才顯示） */}
          {(() => {
            const badge = getContractBadge(roomCard);
            if (!badge) return null;
            const contract = { type: roomCard.meta?.contract, param: roomCard.meta?.contractParam };
            return (
              <div style={{
                display:"flex", alignItems:"center", gap:8,
                background:"rgba(255,255,255,0.05)", borderRadius:10,
                padding:"8px 10px", marginBottom:12,
                border:`1px solid ${badge.color}33`,
              }}>
                <span style={{ fontWeight:900, fontSize:11, color: badge.color }}>
                  ⚔️ {badge.label}
                </span>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.45)" }}>
                  {getContractDesc(contract)}
                </span>
              </div>
            );
          })()}

          {/* 行動按鈕 */}
          {roomCard.type === "stairs" ? (
            floorIndex + 1 < totalFloors ? (
              <button onClick={handleNextFloor} style={{
                width:"100%", padding:"12px 0", borderRadius:14, fontWeight:900, fontSize:15,
                border:"none", cursor:"pointer",
                background:"linear-gradient(90deg,#4ade80,#22c55e)", color:"#052e16",
              }}>
                🪜 前往第 {floorIndex + 2} 層
              </button>
            ) : (
              <div style={{ textAlign:"center", color:"#fbbf24", fontWeight:900, fontSize:15 }}>
                👑 已到達最終層！尋找 Boss 房間
              </div>
            )
          ) : (
            <button
              onClick={() => setRoomCard(null)}
              style={{
                width:"100%", padding:"12px 0", borderRadius:14, fontWeight:900, fontSize:15,
                border:"none", cursor:"pointer",
                background:"rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.7)",
              }}>
              繼續探索地圖
            </button>
          )}
        </div>
      )}

      {/* 若無房間卡顯示提示 */}
      {!roomCard && (
        <div style={{
          flexShrink:0, padding:"10px 16px 24px", textAlign:"center",
          fontSize:12, color:"rgba(255,255,255,0.25)",
        }}>
          點擊發光的房間繼續探索
        </div>
      )}
    </div>
  );
}

const ROOM_DESC = {
  monster:  "怪物正在守護這個房間，準備戰鬥！",
  elite:    "精英怪物蟄伏在此，擊敗它必有珍貴寶物。",
  boss:     "感受到極強的壓迫感——Boss 就在這裡！",
  chest:    "發現了一個神秘的寶箱，裡面裝有素材或金幣。",
  trap:     "地板上佈滿機關，踩上去會受到傷害！",
  merchant: "一位神秘商人在此等待，可以用金幣購買道具。",
  rest:     "終於有個可以喘息的地方，全體回復 30% HP。",
  teleport: "地面閃爍著魔法陣，傳送到同層的另一個房間。",
  event:    "這裡有些不尋常的東西，可能會有好事也可能有壞事。",
  stairs:   "找到通往下一層的樓梯！",
};
