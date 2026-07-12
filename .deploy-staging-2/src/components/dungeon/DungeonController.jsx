// src/components/dungeon/DungeonController.jsx — 地下城模式路由器
// 根據 Firestore room.status 決定顯示地圖探索還是戰鬥室
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeDungeonRoom, checkDungeonRoomExists } from "../../lib/dungeonDb";
import { DUNGEON_MAPS } from "../../lib/dungeonData";
import DungeonExplore from "./DungeonExplore";
import DungeonBattleRoom from "./DungeonBattleRoom";
import DungeonShop from "./DungeonShop";
import DungeonEvent from "./DungeonEvent";
import DungeonRest from "./DungeonRest";
import DungeonTrap from "./DungeonTrap";
import DungeonChest from "./DungeonChest";

export default function DungeonController({ roomId, onExit }) {
  const { profile } = useAuth();
  const [room, setRoom] = useState(null);
  const [roomError, setRoomError] = useState(null); // "not_found" | "completed" | "stale"

  useEffect(() => {
    if (!roomId) return;
    setRoom(null);
    setRoomError(null);
    // 在短暫超時後檢查房間是否存在（防止中間狀態的快速閃爍）
    const timeoutId = setTimeout(async () => {
      const res = await checkDungeonRoomExists(roomId);
      if (!res.exists) setRoomError(res.reason || "not_found");
    }, 3000); // 3 秒後仍無資料 → 房間可能已不存在
    const unsub = subscribeDungeonRoom(roomId, r => {
      if (r) {
        setRoom(r);
        setRoomError(null); // 成功載入 → 清除錯誤
        clearTimeout(timeoutId);
      } else {
        // Firestore 文件不存在或已被刪除
        setRoomError("not_found");
        clearTimeout(timeoutId);
      }
    });
    return () => {
      unsub();
      clearTimeout(timeoutId);
    };
  }, [roomId]);

  if (roomError === "not_found") {
    return (
      <div style={{ minHeight:"100dvh", background:"#0a0a0f", color:"rgba(255,255,255,0.5)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, fontSize:14 }}>
        <div style={{ fontSize:48 }}>🏚️</div>
        <div style={{ fontWeight:700, color:"rgba(255,255,255,0.7)" }}>地下城房間已關閉或不存在</div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>可能是房主已結束地下城，或房間已過期</div>
        <button onClick={() => onExit?.({ preserve: false })} style={{ marginTop:8, padding:"10px 32px", borderRadius:14, background:"#334155", color:"#e2e8f0", fontWeight:700, cursor:"pointer", border:"none", fontSize:14 }}>返回大廳</button>
      </div>
    );
  }

  if (roomError === "completed") {
    return (
      <div style={{ minHeight:"100dvh", background:"#0a0a0f", color:"rgba(255,255,255,0.5)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, fontSize:14 }}>
        <div style={{ fontSize:48 }}>🏁</div>
        <div style={{ fontWeight:700, color:"rgba(255,255,255,0.7)" }}>地下城已結束</div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>此地下城的冒險已完成，獎勵已結算</div>
        <button onClick={() => onExit?.({ preserve: false })} style={{ marginTop:8, padding:"10px 32px", borderRadius:14, background:"#334155", color:"#e2e8f0", fontWeight:700, cursor:"pointer", border:"none", fontSize:14 }}>返回大廳</button>
      </div>
    );
  }

  if (!room) {
    return (
      <div style={{ minHeight:"100dvh", background:"#0a0a0f", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
        <div style={{ fontSize:32, color:"rgba(255,255,255,0.15)" }}>🏰</div>
        <div style={{ color:"rgba(255,255,255,0.3)", fontSize:14 }}>載入地下城中…</div>
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
  // - non-combat 房間（shop/rest/trap/event）→ 各自對應元件
  // - active / completed（戰鬥中／戰鬥結束等領獎）→ 顯示戰鬥室
  // - 其餘狀態（map_explore / waiting）→ 顯示地圖探索
  if (isMapMode) {
    // 非戰鬥房間：各自獨立元件，不進戰鬥室
    if (room.status === "shop") {
      return (
        <DungeonShopWrapper
          roomId={roomId} room={room}
          myId={profile?.id}
          myCoins={profile?.coins || 0}
          isHost={isHost}
          onDone={() => {}}
        />
      );
    }
    if (room.status === "rest") {
      return (
        <DungeonRestWrapper
          roomId={roomId} room={room}
          myId={profile?.id}
          isHost={isHost}
        />
      );
    }
    if (room.status === "trap") {
      return (
        <DungeonTrapWrapper
          roomId={roomId} room={room}
          myId={profile?.id}
          isHost={isHost}
        />
      );
    }
    if (room.status === "event") {
      return (
        <DungeonEventWrapper
          roomId={roomId} room={room}
          myId={profile?.id}
          isHost={isHost}
        />
      );
    }
    if (room.status === "chest") {
      return (
        <DungeonChestWrapper
          roomId={roomId} room={room}
          myId={profile?.id}
          isHost={isHost}
        />
      );
    }
    // 戰鬥相關狀態
    const battleStatuses = ["active", "completed", "path_select", "floor_transition"];
    if (battleStatuses.includes(room.status)) {
      return (
        <DungeonBattleRoom
          roomId={roomId}
          onExit={() => onExit?.({ preserve: true })}
          isMapMode={true}
          onReturnToMap={() => onExit?.({ preserve: true })}
        />
      );
    }
    // dungeon 找不到（舊 ID 或資料過期）→ 直接離開
    if (!dungeon) {
      return (
        <div style={{ minHeight:"100dvh", background:"#0a0a0f", color:"rgba(255,255,255,0.5)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, fontSize:14 }}>
          <div style={{ fontSize:32 }}>🏰</div>
          <div>地下城地圖已過期</div>
          <button onClick={() => onExit?.({ preserve: false })} style={{ marginTop:8, padding:"8px 24px", borderRadius:12, background:"#334155", color:"#e2e8f0", fontWeight:700, cursor:"pointer", border:"none" }}>返回大廳</button>
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
        onBack={() => onExit?.({ preserve: true })}
      />
    );
  }

  // 經典模式已移除，一律使用地圖模式
  // 若無 mapDungeonId 且 status 非 waiting，視為過期房間
  return (
    <div style={{ minHeight:"100dvh", background:"#0a0a0f", color:"rgba(255,255,255,0.5)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, fontSize:14 }}>
      <div style={{ fontSize:48 }}>🏚️</div>
      <div style={{ fontWeight:700, color:"rgba(255,255,255,0.7)" }}>地下城格式不支援</div>
      <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>此房間版本過舊，請建立新的地下城</div>
      <button onClick={onExit} style={{ marginTop:8, padding:"10px 32px", borderRadius:14, background:"#334155", color:"#e2e8f0", fontWeight:700, cursor:"pointer", border:"none", fontSize:14 }}>返回大廳</button>
    </div>
  );
}

// ── Wrapper：商店（非戰鬥互動）──────────────────────────────
function DungeonShopWrapper({ roomId, room, myId, myCoins, isHost }) {
  const me = room?.members?.[myId] || {};
  return (
    <DungeonShop
      roomId={roomId} room={room}
      memberId={myId} memberData={{ ...me, coins: myCoins }}
      isHost={isHost}
    />
  );
}

// ── Wrapper：休息區 ──────────────────────────────────────────
function DungeonRestWrapper({ roomId, room, myId, isHost }) {
  return (
    <DungeonRest
      roomId={roomId} room={room}
      memberId={myId} isHost={isHost}
    />
  );
}

// ── Wrapper：陷阱 ────────────────────────────────────────────
function DungeonTrapWrapper({ roomId, room, myId, isHost }) {
  return (
    <DungeonTrap
      roomId={roomId} room={room}
      memberId={myId} isHost={isHost}
    />
  );
}

// ── Wrapper：特殊事件 ────────────────────────────────────────
function DungeonEventWrapper({ roomId, room, myId, isHost }) {
  return (
    <DungeonEvent
      roomId={roomId} room={room}
      isHost={isHost} memberId={myId}
    />
  );
}

// ── Wrapper：寶箱 ──────────────────────────────────────────
function DungeonChestWrapper({ roomId, room, myId, isHost }) {
  return (
    <DungeonChest
      roomId={roomId} room={room}
      memberId={myId} isHost={isHost}
    />
  );
}
