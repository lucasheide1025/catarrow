// src/components/member/GuestBattle.jsx
// 訪客打怪模式（無學籍，只顯示練習+打怪，3小時後清除）
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import MonsterBattle from "./MonsterBattle";
import MemberPractice from "./MemberPractice";

export default function GuestBattle({ guestId, onExpire }) {
  const [tab, setTab] = useState("monster");

  // 3小時後自動過期
  useEffect(() => {
    const timer = setTimeout(() => {
      onExpire && onExpire();
    }, 3 * 60 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [onExpire]);

  const nav = [
    { id: "monster",   icon: "⚔️", label: "打怪" },
    { id: "practice",  icon: "🎯", label: "練習" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"sans-serif" }}>
      <div style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:40 }}>
        <div style={{ color:"white", fontSize:"13px", fontWeight:900 }}>⚔️ 貓小隊射箭場・體驗模式</div>
        <div style={{ fontSize:"11px", color:"rgba(255,255,255,.7)" }}>訪客</div>
      </div>

      <div style={{ paddingBottom:"80px" }}>
        {tab === "monster"  && <MonsterBattle isGuest={true} />}
        {tab === "practice" && <MemberPractice />}
      </div>

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
