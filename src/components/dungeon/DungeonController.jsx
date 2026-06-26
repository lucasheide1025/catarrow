// src/components/dungeon/DungeonController.jsx — 地下城模式路由器
// 根據 Firestore room.status 決定顯示地圖探索還是戰鬥室
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeDungeonRoom } from "../../lib/dungeonDb";
import { DUNGEON_MAPS } from "../../lib/dungeonData";
import DungeonExplore from "./DungeonExplore";
import DungeonBattleRoom from "./DungeonBattleRoom";

export default function DungeonController({ roomId, onExit }) {
  const { profile } = useAuth();
  const [room, setRoom] = useState(null);

  useEffect(() => {
    if (!roomId) return;
    return subscribeDungeonRoom(roomId, setRoom);
  }, [roomId]);

  if (!room) {
    return (
      <div style={{ minHeight:"100dvh", background:"#0a0a0f", color:"rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
        載入中…
      </div>
    );
  }

  const isMapMode = !!room.mapDungeonId;
  const isHost    = room.hostId === profile?.id;
  const dungeon   = isMapMode ? DUNGEON_MAPS.find(d => d.id === room.mapDungeonId) : null;

  // 地圖探索模式
  if (isMapMode && (room.status === "map_explore" || room.status === "waiting") && dungeon) {
    return (
      <DungeonExplore
        dungeon={dungeon}
        roomId={roomId}
        room={room}
        isHost={isHost}
        memberId={profile?.id}
        profile={profile}
        onBack={onExit}
      />
    );
  }

  // 舊版地下城 or 地圖模式的戰鬥房間
  return (
    <DungeonBattleRoom
      roomId={roomId}
      onExit={isMapMode ? undefined : onExit}
      isMapMode={isMapMode}
      onReturnToMap={isMapMode ? onExit : undefined}
    />
  );
}
