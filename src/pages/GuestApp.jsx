// src/pages/GuestApp.jsx
// 訪客模式全新版本 — 取代舊的 GuestBattle.jsx（掃碼→留信箱/電話→跨次造訪接續同一份記錄）
import { useState, useEffect } from "react";
import { onSnapshot, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import { resolveGuestSession } from "../lib/guestAuth";
import MonsterBattle   from "../components/member/MonsterBattle";
import PartyLobby      from "../components/party/PartyLobby";
import PartyBattleRoom from "../components/party/PartyBattleRoom";
import WorldBossLobby  from "../components/worldboss/WorldBossLobby";
import GuestShop       from "../components/member/GuestShop";
import DungeonLobby    from "../components/dungeon/DungeonLobby";
import EquipmentPage   from "../components/member/EquipmentPage";
import GuestShareCard  from "../components/member/GuestShareCard";
import { EQUIP_SLOT_DEFS } from "../lib/constants";

function guestSessionKey(accountType, sessionSourceId) {
  return `guest_v2_profile_${accountType}_${sessionSourceId || "default"}`;
}

function guestPartySessionKey(accountType, sessionSourceId) {
  return `guest_v2_party_session_${accountType}_${sessionSourceId || "default"}`;
}

const TABS = [
  { id: "home",      icon: "🏠", label: "首頁" },
  { id: "monster",   icon: "⚔️", label: "打怪" },
  { id: "party",     icon: "👥", label: "組隊" },
  { id: "dungeon",   icon: "🏰", label: "地城" },
  { id: "worldboss", icon: "🌍", label: "大王" },
  { id: "profile",   icon: "🎒", label: "角色" },
];

const GUEST_VISUAL_CSS = `
.guest-stage{min-height:100vh;font-family:Inter,"Noto Sans TC",system-ui,sans-serif;background:#07111f;color:#e5eefb;position:relative;overflow-x:hidden}
.guest-stage:before{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(5,10,22,.18),#07111f 76%),url(/ui/page-bg.webp);background-size:cover;background-position:center;opacity:.42}
.guest-stage.kid:before{background:linear-gradient(180deg,rgba(30,18,4,.12),#111827 78%),url(/ui/page-bg.webp);background-size:cover;background-position:center;opacity:.44}
.guest-content{position:relative;z-index:1;padding:16px 14px 108px;max-width:720px;margin:0 auto}
.guest-stage.immersive{background:#020617;overflow:hidden}
.guest-stage.immersive:before{display:none}
.guest-stage.immersive .guest-content{position:static;z-index:auto;max-width:none;padding:0;margin:0}
.guest-login{min-height:100vh;display:grid;place-items:center;padding:22px;position:relative;background:#07111f;color:#fff;overflow:hidden}
.guest-login:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,10,24,.24),rgba(4,10,24,.92)),url(/ui/page-bg.webp);background-size:cover;background-position:center;filter:saturate(1.12)}
.guest-login-panel{position:relative;width:min(100%,390px);display:flex;flex-direction:column;gap:14px}
.guest-login-badge{align-self:flex-start;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.1);backdrop-filter:blur(14px);border-radius:999px;padding:7px 11px;font-size:12px;font-weight:900}
.guest-login-hero{border:1px solid rgba(255,255,255,.18);background:rgba(8,16,34,.72);box-shadow:0 22px 70px rgba(0,0,0,.38);backdrop-filter:blur(18px);border-radius:26px;padding:20px;overflow:hidden;position:relative}
.guest-login-hero:after{content:"";position:absolute;right:-38px;bottom:-58px;width:190px;height:190px;background:url(/cats/archers/baobao.webp) center/contain no-repeat;opacity:.92}
.guest-login-title{font-size:30px;line-height:1.08;font-weight:1000;letter-spacing:0;margin:0 0 8px;max-width:260px}
.guest-login-copy{font-size:13px;line-height:1.65;color:rgba(226,238,255,.78);max-width:245px}
.guest-input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.1);color:white;border-radius:16px;padding:14px 15px;font-size:16px;outline:none}
.guest-input:focus{border-color:rgba(125,211,252,.9);box-shadow:0 0 0 4px rgba(14,165,233,.18)}
.guest-primary{width:100%;border:0;border-radius:18px;padding:15px 16px;color:white;font-size:16px;font-weight:1000;cursor:pointer;box-shadow:0 14px 34px rgba(14,165,233,.24)}
.guest-primary:disabled{opacity:.58;cursor:default}
.guest-topbar{position:sticky;top:0;z-index:50;padding:10px 12px;background:rgba(7,17,31,.8);backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,.08)}
.guest-topbar-inner{max-width:720px;margin:0 auto;display:flex;align-items:center;gap:10px}
.guest-mode-mark{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-size:21px;box-shadow:inset 0 1px 0 rgba(255,255,255,.28)}
.guest-top-title{font-size:13px;font-weight:1000;color:#f8fafc}
.guest-top-sub{font-size:11px;font-weight:800;color:#94a3b8;margin-top:1px}
.guest-coin-pill{margin-left:auto;border:1px solid rgba(251,191,36,.34);background:rgba(251,191,36,.12);color:#fde68a;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:1000}
.guest-top-actions{display:flex;align-items:center;gap:6px;margin-left:0}
.guest-top-btn{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.08);color:#dbeafe;border-radius:999px;padding:7px 9px;font-size:11px;font-weight:1000;cursor:pointer;white-space:nowrap}
.guest-top-btn.logout{color:#fecaca;border-color:rgba(248,113,113,.24);background:rgba(127,29,29,.16)}
.guest-party-banner{position:relative;z-index:2;width:100%;border:0;background:#2563eb;color:white;padding:8px 16px;font-size:12px;font-weight:1000}
.guest-hero{border:1px solid rgba(255,255,255,.12);background:linear-gradient(135deg,rgba(15,23,42,.92),rgba(30,64,175,.78));border-radius:26px;padding:18px;min-height:202px;position:relative;overflow:hidden;box-shadow:0 22px 60px rgba(0,0,0,.26)}
.guest-hero.kid{background:linear-gradient(135deg,rgba(120,53,15,.92),rgba(220,38,38,.78))}
.guest-hero:after{content:"";position:absolute;right:-18px;bottom:-28px;width:190px;height:190px;background:url(/cats/archers/baobao.webp) center/contain no-repeat;filter:drop-shadow(0 22px 28px rgba(0,0,0,.32))}
.guest-hero-kicker{position:relative;z-index:1;color:rgba(255,255,255,.72);font-size:11px;font-weight:1000;letter-spacing:.08em}
.guest-hero-title{position:relative;z-index:1;font-size:28px;line-height:1.08;font-weight:1000;margin-top:8px;max-width:360px}
.guest-hero-copy{position:relative;z-index:1;color:rgba(226,238,255,.78);font-size:13px;line-height:1.62;margin-top:8px;max-width:310px}
.guest-hero-actions{position:relative;z-index:1;display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
.guest-chip-btn{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.12);color:white;border-radius:999px;padding:8px 11px;font-size:12px;font-weight:1000;cursor:pointer}
.guest-section-title{font-size:12px;color:#9fb3cc;font-weight:1000;letter-spacing:.08em;margin:22px 2px 11px}
.guest-action-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.guest-action{min-height:168px;border:1px solid rgba(255,255,255,.1);background:rgba(15,23,42,.76);backdrop-filter:blur(14px);border-radius:22px;padding:16px;text-align:left;color:white;cursor:pointer;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.guest-action.feature{grid-column:span 2;min-height:148px;background:linear-gradient(135deg,rgba(14,165,233,.24),rgba(79,70,229,.22)),rgba(15,23,42,.8)}
.guest-action-icon{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;font-size:26px;flex:0 0 auto}
.guest-action-title{display:block;font-size:18px;font-weight:1000;line-height:1.28;margin-top:2px;letter-spacing:0}
.guest-action-desc{display:block;font-size:12px;line-height:1.72;color:#b6c8dd;margin-top:0;padding-right:16px;max-width:100%}
.guest-action-arrow{position:absolute;right:14px;bottom:12px;font-size:22px;color:#cbd5e1;font-weight:1000;line-height:1}
.guest-quick-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
.guest-mini{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.08);color:#e2e8f0;border-radius:16px;padding:13px;font-size:13px;font-weight:1000;cursor:pointer}
.guest-note{border:1px solid rgba(125,211,252,.2);background:rgba(14,165,233,.1);border-radius:18px;padding:13px;color:#bae6fd;font-size:12px;line-height:1.65;font-weight:800}
.guest-bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:60;background:rgba(7,17,31,.9);backdrop-filter:blur(20px);border-top:1px solid rgba(255,255,255,.1);padding:7px 8px max(7px,env(safe-area-inset-bottom));display:flex;gap:5px;justify-content:center}
.guest-nav-btn{max-width:112px;flex:1;border:0;background:transparent;color:#64748b;border-radius:16px;padding:7px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px;font-weight:1000;cursor:pointer}
.guest-nav-btn.active{background:rgba(255,255,255,.1);color:white}
.guest-nav-icon{font-size:18px;line-height:1}
.guest-profile-hero{border:1px solid rgba(255,255,255,.12);background:linear-gradient(135deg,#0f172a,#334155);border-radius:24px;padding:18px;color:white;position:relative;overflow:hidden}
.guest-profile-hero:after{content:"";position:absolute;right:-20px;bottom:-30px;width:150px;height:150px;background:url(/cats/archers/meimei.webp) center/contain no-repeat;opacity:.82}
.guest-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.guest-stat{border:1px solid rgba(255,255,255,.1);background:rgba(15,23,42,.74);border-radius:18px;padding:14px;color:white}
.guest-stat-head{display:flex;align-items:center;gap:8px;color:#9fb3cc;font-size:12px;font-weight:1000}
.guest-stat-icon{width:32px;height:32px;border-radius:11px;display:grid;place-items:center}
.guest-stat-value{font-size:24px;font-weight:1000;margin-top:9px;color:#f8fafc}
@media (max-width:430px){.guest-topbar-inner{gap:8px}.guest-coin-pill{padding:7px 8px}.guest-top-btn{padding:7px 8px;font-size:10px}.guest-top-btn .full{display:none}}
@media (max-width:380px){.guest-action{min-height:176px;padding:15px}.guest-action.feature{min-height:154px}.guest-action-title{font-size:17px}.guest-action-desc{font-size:11.5px;line-height:1.68;padding-right:12px}}
@media (min-width:680px){.guest-action-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.guest-action.feature{grid-column:span 1}.guest-hero{min-height:230px}.guest-hero:after{width:240px;height:240px}.guest-hero-title{font-size:34px}}
`;

export default function GuestApp({ accountType = "guest", sessionSourceId = null }) {
  const sessionKey = guestSessionKey(accountType, sessionSourceId);
  const partySessionKey = guestPartySessionKey(accountType, sessionSourceId);
  const [guestProfile, setGuestProfile] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
      return saved?.accountType === accountType ? saved : null;
    } catch { return null; }
  });
  const [contact, setContact]   = useState("");
  const [nameInput, setNameInput] = useState("");
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState("");
  const [tab, setTab]           = useState("home");

  const [partyRoomId, setPartyRoomId] = useState(null);
  const [partyIsHost, setPartyIsHost] = useState(false);
  const [partySubTab, setPartySubTab] = useState("lobby");
  const [wbResult, setWbResult] = useState(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [guestBattleImmersive, setGuestBattleImmersive] = useState(false);

  useEffect(() => {
    if (document.querySelector("[data-guest-visual-css]")) return;
    const s = document.createElement("style");
    s.setAttribute("data-guest-visual-css", "1");
    s.textContent = GUEST_VISUAL_CSS;
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
      setGuestProfile(saved?.accountType === accountType ? saved : null);
    } catch {
      setGuestProfile(null);
    }
    setPartyRoomId(null);
    setPartyIsHost(false);
    setPartySubTab("lobby");
    setWbResult(null);
    setTab("home");
  }, [sessionKey, accountType]);

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
    const saved = sessionStorage.getItem(partySessionKey);
    if (saved) {
      try {
        const { roomId, isHost, memberId } = JSON.parse(saved);
        if (memberId && memberId !== guestProfile.id) {
          sessionStorage.removeItem(partySessionKey);
          return;
        }
        if (roomId) { setPartyRoomId(roomId); setPartyIsHost(!!isHost); setPartySubTab("battle"); setTab("party"); }
      } catch { sessionStorage.removeItem(partySessionKey); }
    }
  }, [guestProfile, partySessionKey]);

  useEffect(() => {
    setGuestBattleImmersive(false);
  }, [tab, partySubTab]);

  // ── 讀取預填資料（從會員中心的 enterGuestGame 跨頁傳入）────────────────
  useEffect(() => {
    const prefKey = 'guest_prefill';
    try {
      const pref = JSON.parse(sessionStorage.getItem(prefKey) || 'null');
      if (pref) {
        if (pref.email && !contact) setContact(pref.email);
        if (pref.name && !nameInput) setNameInput(pref.name);
        sessionStorage.removeItem(prefKey); // 用完即刪，避免下次進 GuestApp 又被預填
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line

  async function handleEnter() {
    setErr("");
    if (!contact.trim()) { setErr("請輸入信箱或電話"); return; }
    setBusy(true);
    const res = await resolveGuestSession(contact.trim(), accountType, sessionSourceId);
    setBusy(false);
    if (!res.ok) { setErr(res.reason || "登入失敗，請稍後再試"); return; }
    const finalName = res.isNew ? (nameInput.trim() || res.name) : (res.name || "訪客射手");
    const profileObj = { id: res.id, name: finalName, accountType, coins: res.coins || 0 };
    sessionStorage.setItem(sessionKey, JSON.stringify(profileObj));
    setGuestProfile(profileObj);
  }

  function handleEnterPartyRoom(roomId, _type, isHost) {
    setPartyRoomId(roomId); setPartyIsHost(isHost); setPartySubTab("battle");
    sessionStorage.setItem(partySessionKey, JSON.stringify({ roomId, isHost: !!isHost, memberId: guestProfile.id }));
  }
  function handleLeaveParty() {
    setPartyRoomId(null); setPartyIsHost(false); setPartySubTab("lobby");
    sessionStorage.removeItem(partySessionKey);
  }

  function handleLogout() {
    sessionStorage.removeItem(sessionKey);
    sessionStorage.removeItem(partySessionKey);
    setGuestProfile(null);
    setGuestFullProfile(null);
    setPartyRoomId(null);
    setPartyIsHost(false);
    setPartySubTab("lobby");
    setWbResult(null);
    setTab("home");
  }

  function handleGoMemberFront() {
    window.location.href = "/?login=1";
  }

  const isKid = accountType === "kid";
  const themeAccent = isKid ? "#f59e0b" : "#7c3aed";
  const themeGrad = isKid
    ? "linear-gradient(135deg,#f59e0b,#ef4444)"
    : "linear-gradient(135deg,#7c3aed,#2563eb)";

  // ── 入口畫面：輸入信箱/電話 ──────────────────────────────
  if (!guestProfile) {
    return (
      <div className={`guest-login ${isKid ? "kid" : "guest"}`}>
        <div className="guest-login-panel">
          <div className="guest-login-badge">{isKid ? "KID CAMP ACCESS" : "GUEST ADVENTURE PASS"}</div>
          <div className="guest-login-hero">
            <h1 className="guest-login-title">{isKid ? "小小射手冒險場" : "貓小隊體驗冒險"}</h1>
            <div className="guest-login-copy">
              {isKid ? "輸入信箱或電話後開始活動，這台裝置換人也能保留每位孩子自己的進度。" : "用正式版的戰鬥、組隊、地下城與世界王流程體驗低階冒險。"}
            </div>
          </div>
          <input
            value={contact} onChange={e => setContact(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleEnter(); }}
            placeholder="信箱或電話"
            className="guest-input"
            autoFocus
          />
          <input
            value={nameInput} onChange={e => setNameInput(e.target.value)}
            placeholder={isKid ? "小朋友的名字（選填）" : "射手名稱（選填）"}
            maxLength={10}
            className="guest-input"
          />
          {err && <div style={{ color: "#f87171", fontSize: 13, fontWeight: 700 }}>{err}</div>}
          <button onClick={handleEnter} disabled={busy} className="guest-primary" style={{ background: themeGrad }}>
            {busy ? "登入中…" : "🚀 開始冒險"}
          </button>
        </div>
      </div>
    );
  }

  const guestOverride = {
    ...(guestFullProfile || {}),
    id: guestProfile.id,
    name: guestFullProfile?.name || guestProfile.name,
    accountType,
    currentSessionSourceId: sessionSourceId || guestFullProfile?.lastSessionSourceId || guestFullProfile?.sessionSourceId || null,
  };
  const immersiveBattle = (tab === "monster" && guestBattleImmersive) || (tab === "party" && partySubTab === "battle");

  return (
    <div className={`guest-stage ${isKid ? "kid" : "guest"} ${immersiveBattle ? "immersive" : ""}`}>
      {!immersiveBattle && <div className="guest-topbar">
        <div className="guest-topbar-inner">
          <div className="guest-mode-mark" style={{ background: themeGrad }}>{isKid ? "🎈" : "🏹"}</div>
          <div>
            <div className="guest-top-title">{isKid ? "兒童活動模式" : "訪客體驗模式"}</div>
            <div className="guest-top-sub">{guestProfile.name}</div>
          </div>
          <div className="guest-coin-pill">🪙 {liveCoins || 0}</div>
          <div className="guest-top-actions">
            <button className="guest-top-btn" onClick={handleGoMemberFront}>
              會員<span className="full">中心</span>
            </button>
            <button className="guest-top-btn logout" onClick={handleLogout}>
              登出
            </button>
          </div>
        </div>
      </div>}

      {!immersiveBattle && partyRoomId && partySubTab !== "battle" && (
        <button onClick={() => { setTab("party"); setPartySubTab("battle"); }}
          className="guest-party-banner">
          🎮 組隊進行中 — 點此回到房間
        </button>
      )}

      <div className="guest-content">
        {tab === "home" && <GuestHome name={guestProfile.name} isKid={isKid} accent={themeAccent} onGo={setTab} onShareCard={() => setShowShareCard(true)} coins={liveCoins} wbResult={wbResult} />}
        {tab === "monster" && (
          guestFullProfile ? (
            <MonsterBattle
              isGuest={true}
              kidMode={isKid}
              guestProfile={guestFullProfile}
              onBack={() => setTab("home")}
              onImmersiveChange={setGuestBattleImmersive}
            />
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
              載入中…
            </div>
          )
        )}
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
        {tab === "gacha" && (
          <GuestGachaPanel profile={guestFullProfile} isKid={isKid} onBack={() => setTab("profile")} />
        )}
        {tab === "profile" && (
          <GuestProfileHub
            name={guestProfile.name}
            isKid={isKid}
            coins={liveCoins}
            profile={guestFullProfile}
            wbResult={wbResult}
            onGo={setTab}
            onShareCard={() => setShowShareCard(true)}
          />
        )}
        {tab === "party" && partySubTab === "lobby" && (
          <PartyLobby onEnterRoom={handleEnterPartyRoom} guestOverride={guestOverride} battleOnly={true} />
        )}
        {tab === "party" && partySubTab === "battle" && partyRoomId && (
          <PartyBattleRoom roomId={partyRoomId} isHost={partyIsHost} onLeave={handleLeaveParty} guestOverride={guestOverride} />
        )}
      </div>

      {!immersiveBattle && <div className="guest-bottom-nav">
        {TABS.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} className={`guest-nav-btn ${tab === n.id ? "active" : ""}`}>
            <span className="guest-nav-icon">{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </div>}

      {showShareCard && (
        <GuestShareCard
          name={guestProfile.name}
          coins={liveCoins}
          accountType={accountType}
          profile={guestFullProfile}
          wbResult={wbResult}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </div>
  );
}

function GuestHome({ name, isKid, onGo, onShareCard, coins, wbResult }) {
  const cards = [
    { id: "monster",   icon: "⚔️", title: isKid ? "出發打怪" : "單人冒險", desc: "T1-T2 怪物挑戰，熟悉正式戰鬥節奏", tone: "#f59e0b", feature: true },
    { id: "party",     icon: "👥", title: isKid ? "大家一起打" : "一起打怪", desc: "用房號加入隊伍，團康活動一起推進", tone: "#4f46e5", feature: true },
    { id: "dungeon",   icon: "🏰", title: "地下城探索", desc: "正式迷霧探索版本，低階 T1-T2 體驗", tone: "#7c3aed" },
    { id: "worldboss", icon: "🌍", title: isKid ? "打大魔王" : "世界王活動", desc: "多人一起攻擊世界王，感受共同作戰", tone: "#0891b2" },
    { id: "profile",   icon: "🎒", title: "我的角色", desc: "裝備、商店、紀念卡與進度保留", tone: "#16a34a" },
  ];
  return (
    <div>
      <div className={`guest-hero ${isKid ? "kid" : ""}`}>
        <div className="guest-hero-kicker">CATARROW {isKid ? "KID CAMP" : "TRIAL QUEST"}</div>
        <div className="guest-hero-title">{isKid ? "今天一起打怪、探險、打大王" : "用正式玩法進入低階冒險"}</div>
        <div className="guest-hero-copy">
          {isKid ? `嗨，${name}，選一個活動就能和大家一起玩。` : `嗨，${name}，你的體驗進度會保留，之後可轉正式。`}
        </div>
        <div className="guest-hero-actions">
          <button className="guest-chip-btn" onClick={() => onGo("monster")}>⚔️ 立即打怪</button>
          <button className="guest-chip-btn" onClick={() => onGo("worldboss")}>🌍 世界王</button>
          <button className="guest-chip-btn" onClick={onShareCard}>🎴 紀念卡</button>
        </div>
      </div>

      <div className="guest-stat-grid" style={{ marginTop: 12 }}>
        <div className="guest-stat">
          <div className="guest-stat-head"><span className="guest-stat-icon" style={{ background: "rgba(251,191,36,.16)" }}>🪙</span>體驗金幣</div>
          <div className="guest-stat-value">{coins || 0}</div>
        </div>
        <div className="guest-stat">
          <div className="guest-stat-head"><span className="guest-stat-icon" style={{ background: "rgba(14,165,233,.16)" }}>🌍</span>世界王</div>
          <div className="guest-stat-value" style={{ fontSize: 18 }}>{wbResult ? "已參戰" : "可參戰"}</div>
        </div>
      </div>

      <div className="guest-section-title">選擇活動</div>
      <div className="guest-action-grid">
        {cards.map(c => (
          <button key={c.id} onClick={() => c.action ? c.action() : onGo(c.id)}
            className={`guest-action ${c.feature ? "feature" : ""}`}>
            <span className="guest-action-icon" style={{ background: `${c.tone}22`, color: c.tone }}>{c.icon}</span>
            <span className="guest-action-title">{c.title}</span>
            <span className="guest-action-desc">{c.desc}</span>
            <span className="guest-action-arrow">›</span>
          </button>
        ))}
      </div>

      <div className="guest-quick-row">
        <button onClick={() => onGo("equipment")} className="guest-mini">
          🛡️ 裝備
        </button>
        <button onClick={onShareCard} className="guest-mini">
          🎴 紀念卡
        </button>
      </div>
      <div className="guest-note" style={{ marginTop: 10 }}>
        💡 訪客與兒童模式開放低階多人活動；正式會員可解鎖高階地下城、完整世界王獎勵與長期成就。
      </div>
    </div>
  );
}

function GuestProfileHub({ name, isKid, coins, profile, wbResult, onGo, onShareCard }) {
  const equipment = profile?.rpgEquip || {};
  const equippedCount = EQUIP_SLOT_DEFS.filter(s => equipment[s.id]?.itemId).length;
  const materialCount = (() => {
    const inv = profile?.materials || profile?.materialInventory || {};
    if (Array.isArray(inv)) return inv.length;
    return Object.values(inv).reduce((sum, val) => sum + (typeof val === "number" ? val : Number(val?.count || val?.qty || 0)), 0);
  })();
  const catCount = (() => {
    const cats = profile?.cats || profile?.catCards || profile?.ownedCats || {};
    if (Array.isArray(cats)) return cats.length;
    return Object.keys(cats).length;
  })();
  const gachaCoins = profile?.gachaCoins || profile?.gachaToken || 0;
  const actions = [
    { id: "equipment", icon: "🛡️", title: "我的裝備", desc: "查看與強化低階裝備" },
    { id: "shop", icon: "🛒", title: "體驗商店", desc: "用金幣補充活動道具" },
    { id: "gacha", icon: "🎰", title: "體驗轉蛋", desc: "使用轉蛋幣抽低階活動回饋" },
    { id: "card", icon: "🎴", title: "紀念卡", desc: "產生今天的體驗成果卡", action: onShareCard },
  ];
  return (
    <div>
      <div className="guest-profile-hero">
        <div style={{ position: "relative", zIndex: 1, fontSize: 12, color: "rgba(255,255,255,.65)", fontWeight: 900, letterSpacing: ".08em" }}>
          {isKid ? "KID ADVENTURER" : "GUEST ADVENTURER"}
        </div>
        <div style={{ position: "relative", zIndex: 1, fontSize: 25, fontWeight: 1000, marginTop: 6 }}>{name}</div>
        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <span style={{ background: "rgba(255,255,255,.12)", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900 }}>🪙 {coins || 0}</span>
          <span style={{ background: "rgba(255,255,255,.12)", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900 }}>T1-T2 體驗</span>
          <span style={{ background: "rgba(255,255,255,.12)", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900 }}>進度保留</span>
        </div>
      </div>

      <div className="guest-section-title">角色摘要</div>
      <div className="guest-stat-grid">
        <GuestStatTile icon="🛡️" label="裝備" value={`${equippedCount}/${EQUIP_SLOT_DEFS.length}`} tone="#4f46e5" />
        <GuestStatTile icon="📦" label="材料" value={materialCount} tone="#0891b2" />
        <GuestStatTile icon="🎰" label="轉蛋幣" value={gachaCoins} tone="#9333ea" />
        <GuestStatTile icon="🐱" label="貓咪" value={catCount} tone="#f59e0b" />
      </div>

      {wbResult && (
        <div className="guest-note" style={{ marginTop: 10 }}>
          🌍 最近一次世界王活動已完成，可以到紀念卡留下今天的戰績。
        </div>
      )}

      <div className="guest-section-title">角色功能</div>
      <div className="guest-action-grid">
        {actions.map(action => (
          <button key={action.id} onClick={() => action.action ? action.action() : onGo(action.id)}
            className="guest-action">
            <span className="guest-action-icon" style={{ background: "rgba(255,255,255,.08)" }}>{action.icon}</span>
            <span className="guest-action-title">{action.title}</span>
            <span className="guest-action-desc">{action.desc}</span>
            <span className="guest-action-arrow">›</span>
          </button>
        ))}
      </div>

      <div className="guest-note" style={{ marginTop: 10 }}>
        {isKid
          ? "兒童模式會保留本次活動進度；需要轉正式學籍時，請由教練在後台處理。"
          : "升級正式會員後可保留這份體驗進度，並解鎖完整村莊、排行與高階獎勵。"}
      </div>
    </div>
  );
}

function GuestStatTile({ icon, label, value, tone }) {
  return (
    <div className="guest-stat">
      <div className="guest-stat-head">
        <span className="guest-stat-icon" style={{ background: `${tone}22` }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="guest-stat-value">{value || 0}</div>
    </div>
  );
}

function GuestGachaPanel({ profile, isKid, onBack }) {
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(null);
  const gachaCoins = profile?.gachaCoins || 0;

  async function roll() {
    if (!profile?.id || rolling || gachaCoins < 1) return;
    setRolling(true);
    const rewardCoins = 8 + Math.floor(Math.random() * 17);
    try {
      await updateDoc(doc(db, "members", profile.id), {
        gachaCoins: increment(-1),
        coins: increment(rewardCoins),
      });
      setResult({ coins: rewardCoins });
    } catch (e) {
      setResult({ error: e?.message || "轉蛋失敗，請稍後再試" });
    }
    setRolling(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <button onClick={onBack}
        style={{ alignSelf: "flex-start", border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.08)", color: "#dbeafe", borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>
        ← 返回角色
      </button>

      <div style={{ background: isKid ? "linear-gradient(135deg,rgba(245,158,11,.95),rgba(239,68,68,.82))" : "linear-gradient(135deg,rgba(124,58,237,.92),rgba(37,99,235,.82))", border: "1px solid rgba(255,255,255,.14)", borderRadius: 24, padding: 22, color: "white", textAlign: "center", boxShadow: "0 20px 52px rgba(0,0,0,.25)" }}>
        <div style={{ fontSize: 58, marginBottom: 8 }}>🎰</div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{isKid ? "小小轉蛋機" : "體驗轉蛋機"}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.76)", marginTop: 6, lineHeight: 1.6 }}>
          只會產出低風險活動回饋，不進正式高價貓村轉蛋池。
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, background: "rgba(255,255,255,.14)", borderRadius: 999, padding: "7px 12px", fontSize: 13, fontWeight: 900 }}>
          🎰 可用轉蛋幣 {gachaCoins}
        </div>
      </div>

      <div style={{ background: "rgba(15,23,42,.78)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 18, padding: 16 }}>
        <div style={{ color: "#f8fafc", fontSize: 15, fontWeight: 900 }}>本池內容</div>
        <div style={{ color: "#b6c8dd", fontSize: 12, lineHeight: 1.7, marginTop: 6 }}>
          每次消耗 1 枚轉蛋幣，獲得 8~24 金幣。後續若要接活動徽章或低階貓咪，可在這裡擴充，不影響正式轉蛋池。
        </div>
      </div>

      {result && (
        <div style={{ background: result.error ? "rgba(239,68,68,.16)" : "rgba(34,197,94,.16)", border: `1px solid ${result.error ? "rgba(252,165,165,.42)" : "rgba(134,239,172,.42)"}`, borderRadius: 18, padding: 16, textAlign: "center" }}>
          {result.error ? (
            <div style={{ color: "#fecaca", fontSize: 13, fontWeight: 900 }}>{result.error}</div>
          ) : (
            <>
              <div style={{ fontSize: 38 }}>💰</div>
              <div style={{ color: "#bbf7d0", fontSize: 18, fontWeight: 900, marginTop: 4 }}>獲得 {result.coins} 金幣</div>
            </>
          )}
        </div>
      )}

      <button onClick={roll} disabled={rolling || gachaCoins < 1}
        style={{ border: "none", borderRadius: 16, padding: 16, background: gachaCoins < 1 ? "#e2e8f0" : "linear-gradient(135deg,#f59e0b,#ef4444)", color: gachaCoins < 1 ? "#94a3b8" : "white", fontSize: 16, fontWeight: 900, cursor: rolling || gachaCoins < 1 ? "default" : "pointer" }}>
        {rolling ? "轉動中…" : gachaCoins < 1 ? "轉蛋幣不足" : "轉一次"}
      </button>
    </div>
  );
}
