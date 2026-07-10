// src/pages/GuestApp.jsx
// 訪客模式全新版本 — 取代舊的 GuestBattle.jsx（掃碼→留信箱/電話→跨次造訪接續同一份記錄）
import { useState, useEffect } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { resolveGuestSession } from "../lib/guestAuth";
import MonsterBattle   from "../components/member/MonsterBattle";
import PartyLobby      from "../components/party/PartyLobby";
import PartyBattleRoom from "../components/party/PartyBattleRoom";
import DuelLobby       from "../components/duel/DuelLobby";
import DuelRoom        from "../components/duel/DuelRoom";
import WorldBossLobby  from "../components/worldboss/WorldBossLobby";
import GuestShop       from "../components/member/GuestShop";
import DungeonLobby    from "../components/dungeon/DungeonLobby";
import EquipmentPage   from "../components/member/EquipmentPage";
import GuestShareCard  from "../components/member/GuestShareCard";

const SESSION_KEY = "guest_v2_profile";
const PARTY_SESSION_KEY = "guest_v2_party_session";

const TABS = [
  { id: "home",      icon: "🏠", label: "首頁" },
  { id: "monster",   icon: "⚔️", label: "打怪" },
  { id: "dungeon",   icon: "🏰", label: "地下城" },
  { id: "worldboss", icon: "🌍", label: "世界王" },
  { id: "duel",      icon: "🤺", label: "決鬥" },
  { id: "party",     icon: "👥", label: "組隊" },
  { id: "shop",      icon: "🛒", label: "商店" },
  { id: "card",      icon: "🎴", label: "結算" },
];

export default function GuestApp({ accountType = "guest", sessionSourceId = null }) {
  const [guestProfile, setGuestProfile] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  });
  const [contact, setContact]   = useState("");
  const [nameInput, setNameInput] = useState("");
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState("");
  const [tab, setTab]           = useState("home");

  const [partyRoomId, setPartyRoomId] = useState(null);
  const [partyIsHost, setPartyIsHost] = useState(false);
  const [partySubTab, setPartySubTab] = useState("lobby");
  const [duelRoomId,  setDuelRoomId]  = useState(null);
  const [duelIsHost,  setDuelIsHost]  = useState(false);
  const [duelMyTeam,  setDuelMyTeam]  = useState("A");
  const [duelSubTab,  setDuelSubTab]  = useState("lobby");
  const [wbResult, setWbResult] = useState(null);
  const [showShareCard, setShowShareCard] = useState(false);

  // 完整即時會員文件（地下城/裝備頁直接吃這份 profile，不用另外組裝——
  // 這就是 guest-kid-mode-overhaul 已經持久化的真實 members 文件，見 design.md §5）
  const [guestFullProfile, setGuestFullProfile] = useState(null);
  useEffect(() => {
    if (!guestProfile?.id) { setGuestFullProfile(null); return; }
    return onSnapshot(doc(db, "members", guestProfile.id), snap => {
      setGuestFullProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [guestProfile?.id]);
  const liveCoins = guestFullProfile?.coins ?? guestProfile?.coins ?? 0;

  useEffect(() => {
    if (!guestProfile) return;
    const saved = sessionStorage.getItem(PARTY_SESSION_KEY);
    if (saved) {
      try {
        const { roomId, isHost } = JSON.parse(saved);
        if (roomId) { setPartyRoomId(roomId); setPartyIsHost(!!isHost); setPartySubTab("battle"); setTab("party"); }
      } catch { sessionStorage.removeItem(PARTY_SESSION_KEY); }
    }
  }, [guestProfile]);

  async function handleEnter() {
    setErr("");
    if (!contact.trim()) { setErr("請輸入信箱或電話"); return; }
    setBusy(true);
    const res = await resolveGuestSession(contact.trim(), accountType, sessionSourceId);
    setBusy(false);
    if (!res.ok) { setErr(res.reason || "登入失敗，請稍後再試"); return; }
    const finalName = res.isNew ? (nameInput.trim() || res.name) : (res.name || "訪客射手");
    const profileObj = { id: res.id, name: finalName, accountType, coins: res.coins || 0 };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(profileObj));
    setGuestProfile(profileObj);
  }

  function handleEnterPartyRoom(roomId, _type, isHost) {
    setPartyRoomId(roomId); setPartyIsHost(isHost); setPartySubTab("battle");
    sessionStorage.setItem(PARTY_SESSION_KEY, JSON.stringify({ roomId, isHost: !!isHost }));
  }
  function handleLeaveParty() {
    setPartyRoomId(null); setPartyIsHost(false); setPartySubTab("lobby");
    sessionStorage.removeItem(PARTY_SESSION_KEY);
  }
  function handleEnterDuelRoom(roomId, team, host) {
    setDuelRoomId(roomId); setDuelMyTeam(team); setDuelIsHost(host); setDuelSubTab("room");
  }
  function handleLeaveDuel() {
    setDuelRoomId(null); setDuelIsHost(false); setDuelSubTab("lobby"); setTab("worldboss" === tab ? tab : "duel");
  }

  const isKid = accountType === "kid";
  const themeAccent = isKid ? "#f59e0b" : "#7c3aed";
  const themeGrad = isKid
    ? "linear-gradient(135deg,#f59e0b,#ef4444)"
    : "linear-gradient(135deg,#7c3aed,#2563eb)";

  // ── 入口畫面：輸入信箱/電話 ──────────────────────────────
  if (!guestProfile) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0a1e", fontFamily: "sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 30% 20%, ${themeAccent}33, transparent 50%), radial-gradient(circle at 70% 80%, #2563eb33, transparent 50%)`, pointerEvents: "none" }} />
        <div style={{ position: "relative", width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ fontSize: 64 }}>{isKid ? "🎈" : "🏹"}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "white", textAlign: "center" }}>
            {isKid ? "歡迎小小射手！" : "貓小隊射箭場・體驗模式"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", textAlign: "center", lineHeight: 1.6 }}>
            {isKid ? "留下爸爸媽媽的信箱或電話，下次來還能接續進度喔！" : "留下信箱或電話，下次再來也能接續你的進度"}
          </div>
          <input
            value={contact} onChange={e => setContact(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleEnter(); }}
            placeholder="信箱或電話"
            style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `2px solid ${themeAccent}66`, background: "rgba(255,255,255,.06)", color: "white", fontSize: 16, outline: "none", boxSizing: "border-box" }}
            autoFocus
          />
          <input
            value={nameInput} onChange={e => setNameInput(e.target.value)}
            placeholder={isKid ? "小朋友的名字（選填）" : "射手名稱（選填）"}
            maxLength={10}
            style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "2px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.06)", color: "white", fontSize: 16, outline: "none", boxSizing: "border-box" }}
          />
          {err && <div style={{ color: "#f87171", fontSize: 13, fontWeight: 700 }}>{err}</div>}
          <button onClick={handleEnter} disabled={busy}
            style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: themeGrad, color: "white", fontSize: 16, fontWeight: 900, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "登入中…" : "🚀 開始冒險"}
          </button>
        </div>
      </div>
    );
  }

  const guestOverride = { id: guestProfile.id, name: guestProfile.name };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "sans-serif" }}>
      <div style={{ background: themeGrad, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ color: "white", fontSize: 14, fontWeight: 900 }}>{isKid ? "🎈 兒童模式" : "⚔️ 體驗模式"}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.85)", fontWeight: 700 }}>{guestProfile.name}</div>
      </div>

      {partyRoomId && partySubTab !== "battle" && (
        <button onClick={() => { setTab("party"); setPartySubTab("battle"); }}
          style={{ display: "block", width: "100%", background: "#4f46e5", color: "white", padding: "7px 16px", fontSize: 12, fontWeight: 900, textAlign: "center", border: "none", cursor: "pointer" }}>
          🎮 組隊進行中 — 點此回到房間
        </button>
      )}

      <div style={{ paddingBottom: 90 }}>
        {tab === "home" && <GuestHome name={guestProfile.name} isKid={isKid} accent={themeAccent} onGo={setTab} onShareCard={() => setShowShareCard(true)} />}
        {tab === "monster" && <MonsterBattle isGuest={true} kidMode={isKid} />}
        {tab === "dungeon" && (
          guestFullProfile ? (
            <DungeonLobby guestProfile={guestFullProfile} isGuest tierCap={2} onBack={() => setTab("home")} />
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
              載入中…
            </div>
          )
        )}
        {tab === "equipment" && (
          guestFullProfile ? (
            <EquipmentPage guestProfile={guestFullProfile} onPageChange={page => { if (page === "coinshop") setTab("shop"); else setTab("home"); }} />
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
              載入中…
            </div>
          )
        )}
        {tab === "worldboss" && (
          <WorldBossLobby guestOverride={guestOverride} onBattleComplete={result => setWbResult(result)} />
        )}
        {tab === "shop" && <GuestShop memberId={guestProfile.id} />}
        {tab === "party" && partySubTab === "lobby" && (
          <PartyLobby onEnterRoom={handleEnterPartyRoom} guestOverride={guestOverride} battleOnly={true} />
        )}
        {tab === "party" && partySubTab === "battle" && partyRoomId && (
          <PartyBattleRoom roomId={partyRoomId} isHost={partyIsHost} onLeave={handleLeaveParty} guestOverride={guestOverride} />
        )}
        {tab === "duel" && duelSubTab === "lobby" && (
          <DuelLobby profile={guestOverride} isGuest={true} onEnterRoom={handleEnterDuelRoom} onBack={() => setTab("home")} />
        )}
        {tab === "duel" && duelSubTab === "room" && duelRoomId && (
          <DuelRoom roomId={duelRoomId} myTeam={duelMyTeam} isHost={duelIsHost} onLeave={handleLeaveDuel} profile={guestOverride} isGuest={true} />
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderTop: "1px solid #e2e8f0", display: "flex", zIndex: 40 }}>
        {TABS.map(n => (
          <button key={n.id} onClick={() => n.id === "card" ? setShowShareCard(true) : setTab(n.id)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 4px", gap: 2, border: "none", background: "white", cursor: "pointer", color: (n.id === "card" ? showShareCard : tab === n.id) ? themeAccent : "#94a3b8" }}>
            <span style={{ fontSize: 18 }}>{n.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700 }}>{n.label}</span>
          </button>
        ))}
      </div>

      {showShareCard && (
        <GuestShareCard name={guestProfile.name} coins={liveCoins} accountType={accountType} onClose={() => setShowShareCard(false)} />
      )}
    </div>
  );
}

function GuestHome({ name, isKid, accent, onGo, onShareCard }) {
  const cards = [
    { id: "monster",   icon: "⚔️", title: "打怪", desc: "挑戰怪物，累積戰績" },
    { id: "dungeon",   icon: "🏰", title: "地下城", desc: "闖3層，挑戰最終王" },
    { id: "equipment", icon: "⚔️", title: "裝備", desc: "升級你的裝備" },
    { id: "worldboss", icon: "🌍", title: "世界王", desc: "跟大家一起挑戰大魔王" },
    { id: "duel",      icon: "🤺", title: "決鬥", desc: "跟朋友 1v1 較量" },
    { id: "party",     icon: "👥", title: "組隊", desc: "建房間，一起闖關" },
    { id: "shop",      icon: "🛒", title: "商店", desc: "用金幣換道具" },
    { id: "card",      icon: "🎴", title: "結算分享", desc: "產生今日紀念卡", action: onShareCard },
  ];
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: isKid ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "linear-gradient(135deg,#4c1d95,#1d4ed8)", borderRadius: 20, padding: 22, color: "white" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.1em", color: "rgba(255,255,255,.75)", fontWeight: 900, marginBottom: 6 }}>CATARROW {isKid ? "兒童模式" : "體驗模式"}</div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>嗨，{name}！</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)", marginTop: 4 }}>下次用同一組信箱/電話再來，進度都還在喔</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {cards.map(c => (
          <button key={c.id} onClick={() => c.action ? c.action() : onGo(c.id)}
            style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 30 }}>{c.icon}</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#1e293b" }}>{c.title}</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>{c.desc}</span>
          </button>
        ))}
      </div>
      <div style={{ background: "#fefce8", border: "1px solid #fde047", borderRadius: 14, padding: 14, fontSize: 12, color: "#854d0e", fontWeight: 700, lineHeight: 1.7 }}>
        💡 想正式加入道館、累積積分與檢定成就，歡迎向教練詢問！
      </div>
    </div>
  );
}
