import { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { subscribeResults, getRegistrations, subscribePendingCertResults, subscribeAllMessages, subscribePendingCertTasks, subscribePendingCheckins, subscribeNotifications, subscribePendingMonthlyRequests, subscribeCertification, subscribeDexGrants, getDexConfig, subscribeMonsterDex, subscribeCraftStats, subscribeChestStats, subscribePotionDex, subscribeCardCollection } from "../lib/db";
import { getDuelStats } from "../lib/duelDb";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { sfxNotify } from "../lib/sound";
import { db } from "../lib/firebase";
import { certLevelStyle } from "../lib/constants";
import AdminMembers       from "../components/admin/AdminMembers";
import AdminCompetitions  from "../components/admin/AdminCompetitions";
import AdminLearn         from "../components/admin/AdminLearn";
import AdminAchievements  from "../components/admin/AdminAchievements";
import AdminDexGrant      from "../components/admin/AdminDexGrant";
import AdminGiveTool      from "../components/admin/AdminGiveTool";
import AdminBattleEvent   from "../components/admin/AdminBattleEvent";
import AdminEquipItems    from "../components/admin/AdminEquipItems";
import EquipmentPage      from "../components/member/EquipmentPage";
import CoinShop           from "../components/member/CoinShop";
import AdminFinance       from "../components/admin/AdminFinance";
import AdminReviewCenter  from "../components/admin/AdminReviewCenter";
import MemberHome         from "../components/member/MemberHome";
import MemberComps        from "../components/member/MemberComps";
import MemberScoring      from "../components/member/MemberScoring";
import MemberLearn        from "../components/member/MemberLearn";
import MemberMessages     from "../components/member/MemberMessages";
import MemberHistory      from "../components/member/MemberHistory";
import MemberPractice     from "../components/member/MemberPractice";
import MemberLeaderboard  from "../components/member/MemberLeaderboard";
import MemberProfile      from "../components/member/MemberProfile";
import MemberExternalComp from "../components/member/MemberExternalComp";
import MemberAchievements from "../components/member/MemberAchievements";
import MemberCertExam     from "../components/member/MemberCertExam";
import MemberNotifications from "../components/member/MemberNotifications";
import MustReadGate       from "../components/member/MustReadGate";
import HonorCelebration   from "../components/member/HonorCelebration";
import MemberDex          from "../components/member/MemberDex";
import MemberMaterials    from "../components/member/MemberMaterials";
import MemberMonsterDex  from "../components/member/MemberMonsterDex";
import CardCollection    from "../components/member/CardCollection";
import MemberGuide      from "../components/member/MemberGuide";
import MonsterBattle      from "../components/member/MonsterBattle";
import PartyLobby         from "../components/party/PartyLobby";
import PartyQuestRoom     from "../components/party/PartyQuestRoom";
import PartyBattleRoom    from "../components/party/PartyBattleRoom";
import { getAppTheme, saveAppTheme, APP_THEMES } from "../lib/theme";
import DuelLobby         from "../components/duel/DuelLobby";
import DuelRoom          from "../components/duel/DuelRoom";
import DungeonLobby      from "../components/dungeon/DungeonLobby";
import DungeonBattleRoom from "../components/dungeon/DungeonBattleRoom";
import AdminResetCenter       from "../components/admin/AdminResetCenter";
import AdminWorldBoss         from "../components/admin/AdminWorldBoss";
import AdminGuildQuests        from "../components/admin/AdminGuildQuests";
import AdventurerGuild    from "../components/member/AdventurerGuild";
import WorldBossLobby    from "../components/worldboss/WorldBossLobby";
import CatCollection     from "../components/cat/CatCollection";
import CatStoryBook      from "../components/cat/CatStoryBook";
import StoryBook         from "../components/story/StoryBook";
import AdminStoryManager from "../components/admin/AdminStoryManager";

const CAN_SCORE = ["upcoming", "open", "ongoing"];

export default function AdminApp() {
  const { logout, profile } = useAuth();
  const [page, setPage]             = useState(() => sessionStorage.getItem("admin_page") || "members");
  const [archerMode, setArcherMode] = useState(() => sessionStorage.getItem("admin_archerMode") === "1");
  const [appTheme, setAppTheme]     = useState(() => getAppTheme());
  function handleAppThemeChange(id) {
    saveAppTheme(id);
    setAppTheme(APP_THEMES.find(t => t.id === id) || APP_THEMES[0]);
  }
  const [selComp, setSelComp]       = useState(null);
  const [scoring, setScoring]       = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [pendingCertList, setPendingCertList] = useState([]);
  const [allMessages,     setAllMessages]     = useState([]);
  const [pendingExtList,  setPendingExtList]  = useState([]);
  const [certTasksList,   setCertTasksList]   = useState([]);
  const [pendingCheckinN,  setPendingCheckinN]  = useState(0);
  const [pendingMonthlyN,  setPendingMonthlyN]  = useState(0);
  const pendingMonthlyRef = useRef(0);
  const [partyRoomId,   setPartyRoomId]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("admin_party_room"))?.roomId || null; } catch { return null; }
  });
  const [partyRoomType, setPartyRoomType] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("admin_party_room"))?.type || null; } catch { return null; }
  });
  const [partyIsHost,   setPartyIsHost]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("admin_party_room"))?.isHost || false; } catch { return false; }
  });
  const [notifications, setNotifications] = useState([]);

  // 射手模式共用狀態（與 MemberApp 一致）
  const [certification, setCertification] = useState(null);
  const [dexConfig,     setDexConfig]     = useState({ physicalMax:10, pointMax:10 });
  const [dexGrants,     setDexGrants]     = useState([]);
  const [duelStats,     setDuelStats]     = useState(null);
  const [monsterDex,    setMonsterDex]    = useState({});
  const [craftStats,    setCraftStats]    = useState({});
  const [chestStats,    setChestStats]    = useState({});
  const [potionDex,     setPotionDex]     = useState({});
  const [cardData,      setCardData]      = useState({ cards:{}, equipped:[] });

  useEffect(() => {
    if (!profile?.id) return;
    return subscribeNotifications(profile.id, setNotifications, profile.createdAt);
  }, [profile?.id]); // eslint-disable-line

  useEffect(() => {
    if (!profile?.id || !archerMode) return;
    getDexConfig().then(setDexConfig).catch(() => {});
    getDuelStats(profile.id).then(setDuelStats).catch(() => {});
    const u1 = subscribeCertification(profile.id, setCertification);
    const u2 = subscribeDexGrants(profile.id, setDexGrants);
    const u3 = subscribeMonsterDex(profile.id, setMonsterDex);
    const u4 = subscribeCraftStats(profile.id, setCraftStats);
    const u5 = subscribeChestStats(profile.id, setChestStats);
    const u6 = subscribePotionDex(profile.id, setPotionDex);
    const u7 = subscribeCardCollection(profile.id, setCardData);
    return () => { u1?.(); u2?.(); u3?.(); u4?.(); u5?.(); u6?.(); u7?.(); };
  }, [profile?.id, archerMode]); // eslint-disable-line

  const pendingCertN = pendingCertList.length;
  const pendingMsgN  = allMessages.filter(m => !m.reply).length;
  const pendingExtN  = pendingExtList.length;
  const pendingExamN = certTasksList.length;

  function handleEnterPartyRoom(roomId, type, host) {
    setPartyRoomId(roomId); setPartyRoomType(type); setPartyIsHost(host);
    sessionStorage.setItem("admin_party_room", JSON.stringify({ roomId, type, isHost: host }));
    setPage(type === "quest" ? "party-quest" : "party-battle");
  }
  function handleLeaveParty() {
    sessionStorage.removeItem("admin_party_room");
    setPartyRoomId(null); setPartyRoomType(null); setPartyIsHost(false);
    setPage("profile");
  }

  const [duelRoomId,  setDuelRoomId]  = useState(null);
  const [duelIsHost,  setDuelIsHost]  = useState(false);
  const [duelMyTeam,  setDuelMyTeam]  = useState("A");
  function handleEnterDuelRoom(roomId, team, host) {
    setDuelRoomId(roomId); setDuelMyTeam(team); setDuelIsHost(host);
    setPage("duel-room");
  }
  function handleLeaveDuel() {
    setDuelRoomId(null); setDuelIsHost(false);
    setPage("duel");
  }

  const [dungeonRoomId, setDungeonRoomId] = useState(null);
  function handleEnterDungeonRoom(roomId) {
    setDungeonRoomId(roomId);
    setPage("dungeon-room");
  }
  function handleLeaveDungeon() {
    setDungeonRoomId(null);
    setPage("home");
  }

  // 記住當前頁面 + 射手模式（重整後留在原地）
  useEffect(() => { sessionStorage.setItem("admin_page", page); }, [page]);
  useEffect(() => { sessionStorage.setItem("admin_archerMode", archerMode ? "1" : "0"); }, [archerMode]);

  // 重整後若停在比賽詳情但沒有選中的比賽，退回比賽列表（避免空白）
  useEffect(() => {
    if ((page === "comp-detail") && !selComp) setPage("comps");
  }, []);

  useEffect(() => {
    const u1 = subscribePendingCertResults(list => setPendingCertList(Array.isArray(list) ? list : []));
    const u2 = subscribeAllMessages(msgs => setAllMessages(Array.isArray(msgs) ? msgs : []));
    const qExt = query(collection(db, "externalComps"), where("status", "==", "pending_review"));
    const u3 = onSnapshot(qExt, snap => setPendingExtList(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => setPendingExtList([]));
    const u4 = subscribePendingCertTasks(list => setCertTasksList(Array.isArray(list) ? list : []));
    const u5 = subscribePendingCheckins(list => setPendingCheckinN(Array.isArray(list) ? list.length : 0));
    const u6 = subscribePendingMonthlyRequests(list => {
      const n = list.length;
      if (n > pendingMonthlyRef.current) sfxNotify();
      pendingMonthlyRef.current = n;
      setPendingMonthlyN(n);
    });
    return () => { u1 && u1(); u2 && u2(); u3 && u3(); u4 && u4(); u5 && u5(); u6 && u6(); };
  }, []);

const adminNav = [
  { id:"members",     icon:"👥", label:"會員" },
  { id:"comps",       icon:"🏆", label:"比賽" },
  { id:"review",      icon:"🔔", label:"審核" },
  { id:"monthlycard", icon:"🎫", label:"財務" },
  { id:"learn",       icon:"📓", label:"學習" },
  { id:"battlesetting", icon:"⚔️", label:"打怪賽事" },
  { id:"givetool",      icon:"🧪", label:"測試" },
  { id:"equipitems",   icon:"⚔️", label:"裝備庫" },
  { id:"reset-center",   icon:"🔄", label:"重置" },
  { id:"worldboss-admin", icon:"🌍", label:"世界王" },
  { id:"story-admin",    icon:"📖", label:"故事本" },
  { id:"guild-admin",   icon:"⚔️", label:"公會" },
];

  const memberNav = [
    { id:"home",        icon:"🏠", label:"首頁"  },
    { id:"comps",       icon:"🏆", label:"比賽"  },
    { id:"practice",    icon:"🎯", label:"練習"  },
    { id:"leaderboard", icon:"📊", label:"排行"  },
    { id:"profile",     icon:"👤", label:"我的"  },
  ];

  // ── 射手模式 ──────────────────────────────────────────────
  if (archerMode) {
    return (
      <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"sans-serif"}}>
        <MustReadGate memberId={profile?.id} notifications={notifications} />
        <HonorCelebration memberId={profile?.id} notifications={notifications} onGoPage={setPage} />
        <div style={{background:"#1e3a5f",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:40}}>
          <div style={{color:"white",fontSize:"13px",fontWeight:"900"}}>🏹 射手模式</div>
          <button onClick={()=>{setArcherMode(false);setPage("members");}}
            style={{fontSize:"12px",background:"rgba(255,255,255,0.2)",color:"white",border:"none",borderRadius:"8px",padding:"5px 12px",cursor:"pointer",fontWeight:"bold"}}>
            ⚙️ 返回後台
          </button>
        </div>
        {partyRoomId && !["party-quest","party-battle"].includes(page) && (
          <button onClick={() => setPage(partyRoomType === "quest" ? "party-quest" : "party-battle")}
            style={{display:"block",width:"100%",background:"#4f46e5",color:"white",padding:"7px 16px",fontSize:"12px",fontWeight:"900",textAlign:"center",border:"none",cursor:"pointer"}}>
            🎮 組隊進行中 — 點此回到房間
          </button>
        )}
        <div style={{paddingBottom:"80px"}}>
          {page==="home"        && <MemberHome onPageChange={setPage} onJoinParty={handleEnterPartyRoom} notifications={notifications}
              certification={certification} dexConfig={dexConfig} dexGrants={dexGrants}
              duelStats={duelStats} monsterDex={monsterDex} craftStats={craftStats} chestStats={chestStats}
              potionDex={potionDex} cardData={cardData} />}
          {page==="comps"       && <MemberComps onPageChange={setPage} onSelectComp={c=>{setSelComp(c);setScoring(false);setPage("comp-detail");}}/>}
          {page==="comp-detail" && selComp && !scoring && (
            <CompDetail comp={selComp} profile={profile}
              onBack={()=>setPage("comps")}
              onStartScoring={(myRes)=>{ setLastResult(myRes||null); setScoring(true); }}/>
          )}
          {page==="comp-detail" && selComp && scoring && (
            <MemberScoring comp={selComp} lastResult={lastResult}
              onBack={()=>setScoring(false)}
              onDone={()=>{setScoring(false);setPage("comps");}}/>
          )}
          {page==="practice"    && <MemberPractice/>}
          {page==="leaderboard" && <MemberLeaderboard/>}
          {page==="profile"     && <MemberProfile onPageChange={setPage} appTheme={appTheme} onAppThemeChange={handleAppThemeChange}
              certification={certification} dexConfig={dexConfig} dexGrants={dexGrants}
              duelStats={duelStats} monsterDex={monsterDex} craftStats={craftStats} chestStats={chestStats}
              potionDex={potionDex} cardData={cardData} />}
          {page==="learn"       && <MemberLearn/>}
          {page==="msgs"        && <MemberMessages/>}
          {page==="history"     && <MemberHistory/>}
          {page==="external"    && <MemberExternalComp/>}
          {page==="achievements"&& <MemberAchievements/>}
          {page==="certexam"    && <MemberCertExam onBack={()=>setPage("profile")}/>}
          {page==="notifications" && <MemberNotifications notifications={notifications}/>}
          {page==="dex"         && <MemberDex onBack={()=>setPage("profile")}/>}
          {page==="materials"   && <MemberMaterials onBack={()=>setPage("profile")}/>}
          {page==="guide"       && <MemberGuide      onBack={()=>setPage("profile")}/>}
          {page==="monsterdex"  && <MemberMonsterDex onBack={()=>setPage("profile")}/>}
          {page==="cards"       && <CardCollection />}
          {page==="monster"     && <MonsterBattle onBack={()=>setPage("comps")}/>}
          {page==="party"       && <PartyLobby onEnterRoom={handleEnterPartyRoom}/>}
          {page==="party-quest" && partyRoomId && (
            <PartyQuestRoom roomId={partyRoomId} isHost={partyIsHost} onLeave={handleLeaveParty}/>
          )}
          {page==="party-battle" && partyRoomId && (
            <PartyBattleRoom roomId={partyRoomId} isHost={partyIsHost} onLeave={handleLeaveParty}/>
          )}
          {page==="duel"        && <DuelLobby profile={profile} onEnterRoom={handleEnterDuelRoom} onBack={()=>setPage("monster")}/>}
          {page==="duel-room"   && duelRoomId && <DuelRoom roomId={duelRoomId} myTeam={duelMyTeam} isHost={duelIsHost} onLeave={handleLeaveDuel} profile={profile}/>}
          {page==="dungeon"     && <DungeonLobby onEnterRoom={handleEnterDungeonRoom} onBack={()=>setPage("home")} />}
          {page==="dungeon-room" && dungeonRoomId && <DungeonBattleRoom roomId={dungeonRoomId} onExit={handleLeaveDungeon} />}
          {page==="equipment"   && <EquipmentPage onPageChange={setPage}/>}
          {page==="coinshop"    && <CoinShop/>}
          {page==="worldboss"   && <WorldBossLobby onBack={()=>setPage("home")}/>}
          {page==="cats"        && <CatCollection onBack={()=>setPage("home")} onOpenBook={()=>setPage("catbook")}/>}
          {page==="catbook"     && <CatStoryBook  onBack={()=>setPage("cats")}/>}
          {page==="story"       && <StoryBook     onBack={()=>setPage("home")}/>}
          {page==="guild"       && <AdventurerGuild onBack={()=>setPage("home")}/>}
        </div>
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"white",borderTop:"1px solid #e2e8f0",display:"flex",zIndex:40}}>
          {memberNav.map(n=>(
            <button key={n.id} onClick={()=>setPage(n.id)}
              style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 4px",gap:"2px",border:"none",background:"white",cursor:"pointer",
                color:(page===n.id||["comp-detail","monster","duel","duel-room"].includes(page)&&n.id==="comps"||["learn","msgs","history","external","achievements","certexam","notifications","dex","materials","monsterdex","cards","party","party-quest","party-battle","guide","equipment","coinshop","worldboss","cats","catbook"].includes(page)&&n.id==="profile")?"#2563eb":"#94a3b8"}}>
              <div style={{position:"relative",display:"inline-block"}}>
                <span style={{fontSize:"18px"}}>{n.icon}</span>
                {n.id==="profile" && (profile?.hasUnreadReply || profile?.hasNewLearnLog) && (
                  <span style={{position:"absolute",top:"-2px",right:"-5px",width:"8px",height:"8px",background:"#ef4444",borderRadius:"50%",border:"2px solid white",display:"block"}}/>
                )}
              </div>
              <span style={{fontSize:"11px",fontWeight:"600"}}>{n.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── 後台模式 ──────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"sans-serif"}}>
      <div style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:40}}>
        <div>
          <div style={{fontWeight:"900",color:"#1e293b",fontSize:"14px"}}>⚙️ 後台管理</div>
          <div style={{fontSize:"11px",color:"#94a3b8"}}>貓小隊射箭場-學籍系統</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <button onClick={()=>{setArcherMode(true);setPage("home");}}
            style={{fontSize:"12px",background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:"8px",padding:"4px 10px",cursor:"pointer",fontWeight:"bold"}}>
            🏹 射手模式
          </button>
          <button onClick={logout}
            style={{fontSize:"12px",color:"#94a3b8",border:"1px solid #e2e8f0",borderRadius:"8px",padding:"4px 10px",background:"white",cursor:"pointer"}}>
            登出
          </button>
        </div>
      </div>

      {(pendingCertN + pendingMsgN + pendingExtN + pendingExamN + pendingCheckinN) > 0 && (
        <button onClick={() => setPage("review")}
          style={{width:"100%",background:"#fffbeb",borderBottom:"1px solid #fde68a",padding:"10px 16px",display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",border:"none",textAlign:"left"}}>
          <span style={{fontSize:"16px"}}>🔔</span>
          <span style={{fontSize:"13px",color:"#b45309",fontWeight:"bold"}}>
            {[
              pendingCertN > 0 ? `${pendingCertN} 筆檢定待審核` : null,
              pendingExamN > 0 ? `${pendingExamN} 筆畢業考待審` : null,
              pendingCheckinN > 0 ? `${pendingCheckinN} 筆每日任務待處理` : null,
              pendingExtN > 0 ? `${pendingExtN} 筆外賽待審` : null,
              pendingMsgN > 0 ? `${pendingMsgN} 則新留言待回覆` : null,
            ].filter(Boolean).join("、")}
          </span>
          <span style={{marginLeft:"auto",fontSize:"12px",color:"#d97706",fontWeight:"bold"}}>前往處理 →</span>
        </button>
      )}
      {pendingMonthlyN > 0 && (
        <button onClick={() => setPage("monthlycard")}
          style={{width:"100%",background:"#eff6ff",borderBottom:"1px solid #bfdbfe",padding:"10px 16px",display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",border:"none",textAlign:"left"}}>
          <span style={{fontSize:"16px"}}>🎫</span>
          <span style={{fontSize:"13px",color:"#1d4ed8",fontWeight:"bold"}}>
            {pendingMonthlyN} 筆月卡使用待審核
          </span>
          <span style={{marginLeft:"auto",fontSize:"12px",color:"#2563eb",fontWeight:"bold"}}>前往審核 →</span>
        </button>
      )}

      <div style={{paddingBottom:"80px"}}>
        {page==="members"      && <AdminMembers/>}
        {page==="comps"        && <AdminCompetitions/>}
        {page==="review"       && (
          <AdminReviewCenter
            pendingCert={pendingCertList}
            messages={allMessages}
            pendingExtItems={pendingExtList}
            certTasks={certTasksList}
          />
        )}
        {page==="achievements" && <AdminAchievementsTab/>}
        {page==="learn"        && <AdminLearn/>}
        {page==="settings"     && <PlaceholderPage title="⚙️ 系統設定"/>}
        {page==="battlesetting" && <AdminBattleEvent/>}
        {page==="givetool"     && <AdminGiveTool/>}
        {page==="monthlycard"  && <AdminFinance adminProfile={profile}/>}
        {page==="equipitems"   && <AdminEquipItems/>}
        {page==="reset-center" && <AdminResetCenter/>}
        {page==="worldboss-admin" && <AdminWorldBoss/>}
        {page==="story-admin"     && <AdminStoryManager/>}
        {page==="guild-admin"     && <AdminGuildQuests/>}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"white",borderTop:"1px solid #e2e8f0",display:"flex",zIndex:40}}>
        {adminNav.map(n=>(
          <button key={n.id} onClick={()=>setPage(n.id)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 4px",gap:"2px",border:"none",background:"white",cursor:"pointer",color:page===n.id?"#2563eb":"#94a3b8"}}>
            <span style={{fontSize:"18px"}}>{n.icon}</span>
            <span style={{fontSize:"11px",fontWeight:"600"}}>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlaceholderPage({ title }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",color:"#94a3b8"}}>
      <div style={{fontSize:"48px",marginBottom:"12px"}}>🐱</div>
      <div style={{fontSize:"18px",fontWeight:"700",color:"#475569",marginBottom:"4px"}}>{title}</div>
      <div style={{fontSize:"13px"}}>開發中</div>
    </div>
  );
}

// 後台「成就」頁：成就章任務 / 圖鑑授予 兩個 tab
function AdminAchievementsTab() {
  const [t, setT] = useState("tasks");
  return (
    <div className="flex flex-col">
      <div className="flex gap-2 px-4 pt-4">
        {[["tasks", "🏆 成就章任務"], ["dex", "🎖️ 圖鑑授予"]].map(([id, label]) => (
          <button key={id} onClick={() => setT(id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${t === id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>
      {t === "tasks" ? <AdminAchievements/> : <AdminDexGrant/>}
    </div>
  );
}

// ── 射手模式比賽詳情（與 MemberApp 同步的新版：排行 + 報名名單 + 防彈）──
function CompDetail({ comp, onBack, onStartScoring, profile }) {
  const isCert = comp?.type === "年度檢定";
  const [results, setResults] = useState([]);
  const [loadingR, setLoadingR] = useState(true);

  useEffect(() => {
    if (!comp?.id) { setLoadingR(false); return; }
    let unsub = () => {};
    try {
      unsub = subscribeResults(comp.id, (data) => {
        setResults(Array.isArray(data) ? data : []);
        setLoadingR(false);
      });
    } catch (e) {
      console.warn("subscribeResults failed:", e);
      setLoadingR(false);
    }
    return () => { try { unsub(); } catch {} };
  }, [comp?.id]);

  const myId = profile?.id || null;
  const safeResults = Array.isArray(results) ? results : [];
  const parts = Array.isArray(comp?.participants) ? comp.participants : [];
  const joined = myId ? parts.includes(myId) : false;
  const myResult = safeResults.find(r => r && r.memberId === myId) || null;
  // 檢定：我在這場的所有弓種成績
  const myCertResults = isCert ? safeResults.filter(r => r && r.memberId === myId) : [];

  const rankList = (isCert
    ? safeResults.filter(r => r && r.reviewStatus === "approved")
    : safeResults
  ).slice().sort((a, b) => ((b && b.total) || 0) - ((a && a.total) || 0));
  const myRank = rankList.findIndex(r => r && r.memberId === myId);

  // 檢定排行：按弓種分組（只列已審核通過）
  const BOW_GROUP_LABEL = { recurve_bare: "🏹 競技反曲弓", compound: "🦅 獵弓", traditional: "🌿 傳統" };
  const certApproved = isCert ? safeResults.filter(r => r && r.reviewStatus === "approved") : [];
  const certByBow = {};
  certApproved.forEach(r => {
    const b = (r.certBowType === "recurve_full" ? "recurve_bare" : r.certBowType) || "other";
    if (!certByBow[b]) certByBow[b] = [];
    certByBow[b].push(r);
  });
  Object.keys(certByBow).forEach(b => certByBow[b].sort((a, c) => (c.total || 0) - (a.total || 0)));

  const canScoreStatus = CAN_SCORE.includes(comp?.status);
  let canEnter = false, lockMsg = "";
  if (!joined) { canEnter = false; lockMsg = "尚未報名，請先回比賽列表報名"; }
  else if (!canScoreStatus) { canEnter = false; lockMsg = "此比賽目前無法計分"; }
  else { canEnter = true; }
  const anyPending = isCert && myCertResults.some(r => r.reviewStatus === "pending");

  return (
    <div className="p-4 flex flex-col gap-4">
      <button onClick={onBack} className="text-gray-500 text-sm">← 返回</button>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="text-gray-800 font-black text-lg mb-2">{comp?.title || "比賽"}</div>
        <div className="grid grid-cols-2 gap-2">
          {[["📅 日期", (comp?.date || "") + (comp?.endDate ? ` ～ ${comp.endDate}` : "")],
            ["🎯 靶紙", comp?.targetName || "—"],
            ["🏹 規格", comp?.arrowCount ? `${comp.arrowCount}箭×${comp.roundCount}回` : "—"],
            ["計分", "環數" + (comp?.hasMiss ? " +M" : "")]].map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded-xl p-3">
              <div className="text-gray-400 text-xs">{k}</div>
              <div className="text-gray-700 font-bold text-sm">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {comp?.announcement && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-blue-600 text-xs font-bold mb-1">📢 比賽公告</div>
          <div className="text-blue-800 text-sm">{comp.announcement}</div>
        </div>
      )}
      {comp?.target && <img src={comp.target} alt="靶紙" className="w-full rounded-2xl max-h-48 object-contain bg-gray-100" />}

      {/* 檢定：列出所有弓種 */}
      {isCert && myCertResults.length > 0 && (
        <div className="flex flex-col gap-2">
          {myCertResults.map(mr => (
            <div key={mr.id} className="bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-blue-200 text-xs">{mr.bowLabel || (BOW_GROUP_LABEL[mr.certBowType] || "我的成績")}</div>
                <div className="font-black text-3xl">{mr.total}</div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {mr.reviewStatus === "pending" && (
                    <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">⏳ 審核中</span>
                  )}
                  {mr.reviewStatus === "approved" && mr.certLevel && (
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${mr.certLevel === "未達標" ? "bg-white/20 text-white" : certLevelStyle(mr.certLevel, "solid")}`}>
                      {mr.certLevel === "未達標" ? "未達標" : `${mr.certLevel} 級`}
                    </span>
                  )}
                  {mr.reviewStatus === "rejected" && (
                    <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">已退回</span>
                  )}
                  {mr.isRental && <span className="text-blue-200 text-xs">租借器材</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!isCert && myResult && (
        <div className="bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-blue-200 text-xs">我的成績</div>
            <div className="font-black text-3xl">{myResult.total}</div>
          </div>
          {(myResult.rank || myRank >= 0) && (
            <div className="text-right">
              <div className="text-blue-200 text-xs">名次</div>
              <div className="font-black text-3xl">{myResult.rank || (myRank + 1)}</div>
            </div>
          )}
        </div>
      )}

      {anyPending && (
        <div className="text-center text-amber-600 text-xs py-2 bg-amber-50 rounded-xl">部分弓種審核中，審核通過前該弓種無法刷分；可改考其他弓種</div>
      )}
      {canEnter ? (
        <button onClick={() => onStartScoring(isCert ? null : myResult)}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-xl">
          🏹 {isCert ? (myCertResults.length > 0 ? "再考一種弓 / 刷分" : "進入檢定") : (myResult ? "重新挑戰" : "開始記分")}
        </button>
      ) : (
        lockMsg && <div className="text-center text-gray-400 text-sm py-2 bg-gray-50 rounded-xl">{lockMsg}</div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="text-gray-500 text-xs font-bold mb-3">🏅 成績排行{isCert ? "（已審核）" : ""}</div>
        {loadingR ? (
          <div className="text-gray-400 text-sm text-center py-4">載入中…</div>
        ) : isCert ? (
          Object.keys(certByBow).length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-4">尚無已審核成績</div>
          ) : (
            <div className="flex flex-col gap-4">
              {["recurve_bare","compound","traditional"]
                .filter(b => certByBow[b]?.length)
                .map(b => (
                <div key={b}>
                  <div className="text-gray-600 text-xs font-black mb-1.5">{BOW_GROUP_LABEL[b] || b}</div>
                  {certByBow[b].map((r, i) => {
                    const isMe = r.memberId === myId;
                    return (
                      <div key={r.id || i}
                        className={`flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 ${isMe ? "bg-blue-50 -mx-4 px-4 rounded-xl" : ""}`}>
                        <span className="w-7 text-center text-sm">{["🥇","🥈","🥉"][i] || i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-bold ${isMe ? "text-blue-700" : "text-gray-800"}`}>
                            {r.nickname || r.name || "匿名射手"}{isMe && "（我）"}
                          </div>
                          {r.certLevel && r.certLevel !== "未達標" && (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${certLevelStyle(r.certLevel, "soft")}`}>{r.certLevel}</span>
                          )}
                          {r.isRental && <span className="text-orange-500 text-xs ml-1">· 租借</span>}
                        </div>
                        <span className={`font-black text-xl ${isMe ? "text-blue-600" : "text-gray-800"}`}>{r.total}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )
        ) : rankList.length === 0 ? (
          <div className="text-gray-400 text-sm text-center py-4">尚無成績</div>
        ) : (
          rankList.map((r, i) => {
            const isMe = r.memberId === myId;
            return (
              <div key={r.id || r.memberId || i}
                className={`flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 ${isMe ? "bg-blue-50 -mx-4 px-4 rounded-xl" : ""}`}>
                <span className="w-7 text-center text-sm">{["🥇","🥈","🥉"][i] || i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold ${isMe ? "text-blue-700" : "text-gray-800"}`}>
                    {r.nickname || r.name || "匿名射手"}{isMe && "（我）"}
                  </div>
                </div>
                <span className={`font-black text-xl ${isMe ? "text-blue-600" : "text-gray-800"}`}>{r.total}</span>
              </div>
            );
          })
        )}
      </div>

      <RegList compId={comp?.id} myId={myId} />
    </div>
  );
}

function RegList({ compId, myId }) {
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!compId) { setLoading(false); return; }
    getRegistrations(compId).then(d => { setRegs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [compId]);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="text-gray-500 text-xs font-bold mb-3">📋 報名名單{regs.length ? `（${regs.length}）` : ""}</div>
      {loading ? (
        <div className="text-gray-400 text-sm text-center py-4">載入中…</div>
      ) : regs.length === 0 ? (
        <div className="text-gray-400 text-sm text-center py-4">尚無人報名</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {regs.map(r => {
            const isMe = r.memberId === myId;
            const label = r.nickname || r.name || r.guestInfo?.name || "射手";
            return (
              <span key={r.id || r.memberId}
                className={`text-xs px-3 py-1.5 rounded-full font-bold ${isMe ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                {label}{isMe && "（我）"}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
