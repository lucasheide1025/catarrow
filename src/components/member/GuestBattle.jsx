// src/components/member/GuestBattle.jsx
// 訪客打怪模式（無學籍，只顯示練習+打怪+組隊，3小時後清除）
import { useState, useEffect } from "react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "../../lib/firebase";
import MonsterBattle  from "./MonsterBattle";
import MemberPractice from "./MemberPractice";
import PartyLobby     from "../party/PartyLobby";
import PartyBattleRoom from "../party/PartyBattleRoom";
import DuelLobby      from "../duel/DuelLobby";
import DuelRoom       from "../duel/DuelRoom";

const PARTY_SESSION_KEY = "guest_party_session";
const PARTY_ID_KEY      = "guest_party_id";

export default function GuestBattle({ guestId, onExpire }) {
  const [tab, setTab] = useState("guide");

  // 每個 session 獨立的 party ID（同一條連結多人使用時不互相覆蓋）
  const [partyGuestId] = useState(() => {
    const stored = sessionStorage.getItem(PARTY_ID_KEY);
    if (stored) return stored;
    const suffix = Math.random().toString(36).slice(2, 8);
    const id = `guest_${guestId}_${suffix}`;
    sessionStorage.setItem(PARTY_ID_KEY, id);
    return id;
  });

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

  const guestOverride = {
    id:   partyGuestId,
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

  const [duelRoomId,  setDuelRoomId]  = useState(null);
  const [duelIsHost,  setDuelIsHost]  = useState(false);
  const [duelMyTeam,  setDuelMyTeam]  = useState("A");
  const [duelSubTab,  setDuelSubTab]  = useState("lobby");
  function handleEnterDuelRoom(roomId, team, host) {
    setDuelRoomId(roomId); setDuelMyTeam(team); setDuelIsHost(host);
    setDuelSubTab("room");
  }
  function handleLeaveDuel() {
    setDuelRoomId(null); setDuelIsHost(false);
    setDuelSubTab("lobby");
    setTab("duel");
  }

  const nav = [
    { id: "guide",    icon: "📋",  label: "說明" },
    { id: "monster",  icon: "⚔️",  label: "打怪" },
    { id: "duel",     icon: "🤺",  label: "決鬥" },
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
        {tab === "guide"   && <GuestGuide />}
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
        {tab === "duel" && duelSubTab === "lobby" && (
          <DuelLobby
            profile={guestOverride}
            isGuest={true}
            onEnterRoom={handleEnterDuelRoom}
            onBack={() => setTab("guide")}
          />
        )}
        {tab === "duel" && duelSubTab === "room" && duelRoomId && (
          <DuelRoom
            roomId={duelRoomId}
            myTeam={duelMyTeam}
            isHost={duelIsHost}
            onLeave={handleLeaveDuel}
            profile={guestOverride}
            isGuest={true}
          />
        )}
      </div>

      {/* 底部導覽 */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"white", borderTop:"1px solid #e2e8f0", display:"flex", zIndex:40, overflowX:"auto" }}>
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

function GuestGuide() {
  return (
    <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:"16px", paddingBottom:"100px" }}>
      <div style={{ background:"linear-gradient(135deg,#4c1d95,#1d4ed8)", borderRadius:"16px", padding:"20px", color:"white" }}>
        <div style={{ fontSize:"11px", letterSpacing:"0.1em", color:"#c4b5fd", fontWeight:900, marginBottom:"4px" }}>CATARROW 體驗模��</div>
        <div style={{ fontSize:"20px", fontWeight:900, marginBottom:"4px" }}>⚔️ 歡迎來到射箭場！</div>
        <div style={{ fontSize:"13px", color:"rgba(255,255,255,.7)" }}>連結有效 3 小時，以下是你可以做的事</div>
      </div>

      {[
        { icon:"⚔️", title:"打怪", lines:["選擇難度進入戰鬥","分配攻防屬性打倒怪物","有機會掉落稀有素材"] },
        { icon:"🤺", title:"決鬥", lines:["與其他人 1v1 對戰","建立房間，傳號碼給對手","對手加入後自動開始"] },
        { icon:"👥", title:"組隊", lines:["建立或加入組隊房間","與隊友一起打怪闖關","進行中頂部會出現橫幅"] },
        { icon:"🎯", title:"練習", lines:["記錄這次的練習成績","填入環數與箭數"] },
      ].map(({ icon, title, lines }) => (
        <div key={title} style={{ background:"white", borderRadius:"16px", border:"1px solid #e2e8f0", padding:"16px" }}>
          <div style={{ fontWeight:900, fontSize:"14px", marginBottom:"8px", color:"#1e293b" }}>{icon} {title}</div>
          {lines.map(l => (
            <div key={l} style={{ display:"flex", alignItems:"flex-start", gap:"8px", padding:"3px 0", fontSize:"13px", color:"#475569" }}>
              <span style={{ color:"#22c55e", flexShrink:0 }}>✓</span>{l}
            </div>
          ))}
        </div>
      ))}

      <div style={{ background:"#fefce8", border:"1px solid #fde047", borderRadius:"12px", padding:"12px" }}>
        <div style={{ fontSize:"12px", color:"#854d0e", fontWeight:700, lineHeight:1.7 }}>
          💡 訪客連結有效期限為 3 小時。<br />
          想正式加入、累積積分與成就，請聯絡教練開通帳號。
        </div>
      </div>
    </div>
  );
}
