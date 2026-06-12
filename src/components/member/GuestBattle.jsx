// src/components/member/GuestBattle.jsx
// 訪客打怪模式（無學籍，只顯示練習+打怪+組隊，3小時後清除）
import { useState, useEffect } from "react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "../../lib/firebase";
import MonsterBattle  from "./MonsterBattle";
import MemberPractice from "./MemberPractice";
import PartyLobby     from "../party/PartyLobby";
import PartyBattleRoom from "../party/PartyBattleRoom";

const PARTY_SESSION_KEY = "guest_party_session";

export default function GuestBattle({ guestId, onExpire }) {
  const [tab, setTab] = useState("monster");

  // 訪客名稱
  const [guestName,      setGuestName]      = useState(() => sessionStorage.getItem("guest_name") || "");
  const [nameInput,      setNameInput]      = useState("");
  const [nameConfirmed,  setNameConfirmed]  = useState(() => !!sessionStorage.getItem("guest_name"));

  // 組隊相關狀態
  const [partyRoomId,  setPartyRoomId]  = useState(null);
  const [partyIsHost,  setPartyIsHost]  = useState(false);
  const [partySubTab,  setPartySubTab]  = useState("lobby"); // "lobby" | "battle"

  // 匿名登入，讓 Firestore 寫入（submitArrows 等）可通過權限驗證
  useEffect(() => {
    signInAnonymously(auth).catch(() => {});
  }, []); // eslint-disable-line

  // 掛載時：檢查 sessionStorage 是否有進行中房間
  useEffect(() => {
    const saved = sessionStorage.getItem(PARTY_SESSION_KEY);
    if (saved) {
      try {
        const { roomId, isHost } = JSON.parse(saved);
        if (roomId) {
          setPartyRoomId(roomId);
          setPartyIsHost(!!isHost);
          setPartySubTab("battle");
          setTab("party");
        }
      } catch { sessionStorage.removeItem(PARTY_SESSION_KEY); }
    }
  }, []); // eslint-disable-line

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
    name: guestName || "訪客射手",
  };

  function handleConfirmName() {
    const name = nameInput.trim() || "訪客射手";
    sessionStorage.setItem("guest_name", name);
    setGuestName(name);
    setNameConfirmed(true);
  }

  function handleEnterPartyRoom(roomId, _type, isHost) {
    setPartyRoomId(roomId);
    setPartyIsHost(isHost);
    setPartySubTab("battle");
    sessionStorage.setItem(PARTY_SESSION_KEY, JSON.stringify({ roomId, isHost: !!isHost }));
  }
  function handleLeaveParty() {
    setPartyRoomId(null);
    setPartyIsHost(false);
    setPartySubTab("lobby");
    sessionStorage.removeItem(PARTY_SESSION_KEY);
  }

  const nav = [
    { id: "monster",  icon: "⚔️",  label: "打怪" },
    { id: "party",    icon: "👥",  label: "組隊" },
    { id: "practice", icon: "🎯",  label: "練習" },
  ];

  // 名稱設定頁（第一次進入才顯示）
  if (!nameConfirmed) return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"sans-serif" }}>
      <div style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ color:"white", fontSize:"13px", fontWeight:900 }}>⚔️ 貓小隊射箭場・體驗模式</div>
        <div style={{ fontSize:"11px", color:"rgba(255,255,255,.7)" }}>訪客</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"60px 24px", gap:"20px" }}>
        <div style={{ fontSize:"52px" }}>🏹</div>
        <div style={{ fontSize:"20px", fontWeight:900, color:"#1e293b" }}>歡迎加入冒險！</div>
        <div style={{ fontSize:"14px", color:"#64748b", textAlign:"center", maxWidth:"280px" }}>
          請輸入你的射手名稱，其他玩家在組隊時會看見
        </div>
        <input
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleConfirmName(); }}
          placeholder="射手名稱（最多 10 字）"
          maxLength={10}
          style={{ width:"100%", maxWidth:"280px", padding:"10px 14px", border:"2px solid #7c3aed", borderRadius:"8px", fontSize:"16px", outline:"none", boxSizing:"border-box" }}
          autoFocus
        />
        <button onClick={handleConfirmName}
          style={{ width:"100%", maxWidth:"280px", background:"#7c3aed", color:"white", border:"none", borderRadius:"8px", padding:"12px", fontSize:"15px", fontWeight:900, cursor:"pointer" }}>
          開始冒險
        </button>
        <button onClick={() => { sessionStorage.setItem("guest_name","訪客射手"); setGuestName("訪客射手"); setNameConfirmed(true); }}
          style={{ fontSize:"12px", color:"#94a3b8", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>
          使用預設名稱「訪客射手」
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"sans-serif" }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:40 }}>
        <div style={{ color:"white", fontSize:"13px", fontWeight:900 }}>⚔️ 貓小隊射箭場・體驗模式</div>
        <div style={{ fontSize:"11px", color:"rgba(255,255,255,.7)" }}>訪客・{guestName}</div>
      </div>

      {/* 組隊中 banner（任何 tab 都顯示）*/}
      {partyRoomId && partySubTab !== "battle" && (
        <button onClick={() => { setTab("party"); setPartySubTab("battle"); }}
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
