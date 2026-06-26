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

  // 等待 Firestore 同步 mapDungeonId（防止初始 snapshot 拿到舊資料而直接跳戰鬥）
  if (!room.mapDungeonId && !room.hostId) {
    return (
      <div style={{ minHeight:"100dvh", background:"#0a0a0f", color:"rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
        載入地下城地圖…
      </div>
    );
  }

  const isMapMode = !!room.mapDungeonId;
  const isHost    = room.hostId === profile?.id;
  const dungeon   = isMapMode ? DUNGEON_MAPS.find(d => d.id === room.mapDungeonId) : null;

  // 地圖模式：只在 active（戰鬥中）時顯示戰鬥室，其餘狀態都回到地圖探索
  // 確保了：初始進入先看地圖、戰鬥結束後回到地圖、不會誤跳進戰鬥
  if (isMapMode && dungeon) {
    if (room.status === "active") {
      return (
        <DungeonBattleRoom
          roomId={roomId}
          onExit={undefined}
          isMapMode={true}
          onReturnToMap={onExit}
        />
      );
    }
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

  // 舊版地下城
  return (
    <DungeonBattleRoom
      roomId={roomId}
      onExit={onExit}
      isMapMode={false}
      onReturnToMap={undefined}
    />
  );
}
