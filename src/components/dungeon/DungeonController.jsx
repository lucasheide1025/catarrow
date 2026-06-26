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

  // 房間剛建立尚未開始（status=waiting 且無 mapDungeonId）→ 等待房主開始
  if (!room.mapDungeonId && room.status === "waiting") {
    return (
      <div style={{ minHeight:"100dvh", background:"#0a0a0f", color:"rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
        等待房主開始地下城…
      </div>
    );
  }

  const isMapMode = !!room.mapDungeonId;
  const isHost    = room.hostId === profile?.id;
  const dungeon   = isMapMode ? DUNGEON_MAPS.find(d => d.id === room.mapDungeonId) : null;

  // 地圖模式路由：
  // - active / completed（戰鬥中／戰鬥結束等領獎）→ 顯示戰鬥室
  // - 其餘狀態（map_explore / waiting）→ 顯示地圖探索
  // 這樣確保戰鬥結束後玩家能看到結算畫面 + 領獎按鈕，
  // 等 host 點「領取並回地圖」後 returnToMapAfterBattle 才回到地圖
  if (isMapMode) {
    const battleStatuses = ["active", "completed", "path_select", "shop", "event", "floor_transition"];
    if (battleStatuses.includes(room.status)) {
      return (
        <DungeonBattleRoom
          roomId={roomId}
          onExit={undefined}
          isMapMode={true}
          onReturnToMap={onExit}
        />
      );
    }
    // dungeon 找不到（舊 ID 或資料過期）→ 直接離開
    if (!dungeon) {
      return (
        <div style={{ minHeight:"100dvh", background:"#0a0a0f", color:"rgba(255,255,255,0.5)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, fontSize:14 }}>
          <div style={{ fontSize:32 }}>🏰</div>
          <div>地下城地圖已過期</div>
          <button onClick={onExit} style={{ marginTop:8, padding:"8px 24px", borderRadius:12, background:"#334155", color:"#e2e8f0", fontWeight:700, cursor:"pointer", border:"none" }}>返回大廳</button>
        </div>
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
