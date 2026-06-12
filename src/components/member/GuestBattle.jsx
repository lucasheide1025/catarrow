// src/components/member/GuestBattle.jsx
// 訪客打怪模式（無學籍，只顯示練習+打怪+組隊，3小時後清除）
import { useState, useEffect } from "react";
import MonsterBattle  from "./MonsterBattle";
import MemberPractice from "./MemberPractice";
import PartyLobby     from "../party/PartyLobby";
import PartyBattleRoom from "../party/PartyBattleRoom";

export default function GuestBattle({ guestId, onExpire }) {
  const [tab, setTab] = useState("monster");

  // 組隊相關狀態
  const [partyRoomId,  setPartyRoomId]  = useState(null);
  const [partyIsHost,  setPartyIsHost]  = useState(false);
  const [partySubTab,  setPartySubTab]  = useState("lobby"); // "lobby" | "battle"

  // 3小時後自動過期
  useEffect(() => {
    const timer = setTimeout(() => {
      onExpire && onExpire();
    }, 3 * 60 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [onExpire]);

  // 訪客用 ID（加 guest_ 前綴讓後端可識別）
  const guestOverride = {
    id:   `guest_${guestId}`,
    name: "訪客射手",
  };

  function handleEnterPartyRoom(roomId, _type, isHost) {
    setPartyRoomId(roomId);
    setPartyIsHost(isHost);
    setPartySubTab("battle");
  }
  function handleLeaveParty() {
    setPartyRoomId(null);
    setPartyIsHost(false);
    setPartySubTab("lobby");
  }

  const nav = [
    { id: "monster",  icon: "⚔️",  label: "打怪" },
    { id: "party",    icon: "👥",  label: "組隊" },
    { id: "practice", icon: "🎯",  label: "練習" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"sans-serif" }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:40 }}>
        <div style={{ color:"white", fontSize:"13px", fontWeight:900 }}>⚔️ 貓小隊射箭場・體驗模式</div>
        <div style={{ fontSize:"11px", color:"rgba(255,255,255,.7)" }}>訪客</div>
      </div>

      {/* 組隊中 banner */}
      {partyRoomId && tab === "party" && partySubTab === "lobby" && (
        <button onClick={() => setPartySubTab("battle")}
          style={{ display:"block", width:"100%", background:"#4f46e5", color:"white", padding:"7px 16px", fontSize:"12px", fontWeight:900, textAlign:"center", border:"none", cursor:"pointer" }}>
          🎮 組隊進行中 — 點此回到房間
        </button>
      )}

      {/* 頁面內容 */}
      <div style={{ paddingBottom:"80px" }}>
        {tab === "monster" && <MonsterBattle isGuest={true} />}
        {tab === "practice" && <MemberPractice />}
        {tab === "party" && partySubTab === "lobby" && (
          <PartyLobby
            onEnterRoom={handleEnterPartyRoom}
            guestOverride={guestOverride}
            battleOnly={true}
          />
        )}
        {tab === "party" && partySubTab === "battle" && partyRoomId && (
          <PartyBattleRoom
            roomId={partyRoomId}
            isHost={partyIsHost}
            onLeave={handleLeaveParty}
            guestOverride={guestOverride}
          />
        )}
      </div>

      {/* 底部導覽 */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"white", borderTop:"1px solid #e2e8f0", display:"flex", zIndex:40 }}>
        {nav.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"8px 4px", gap:"2px", border:"none", background:"white", cursor:"pointer",
              color: tab === n.id ? "#7c3aed" : "#94a3b8" }}>
            <span style={{ fontSize:"18px" }}>{n.icon}</span>
            <span style={{ fontSize:"11px", fontWeight:"600" }}>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
