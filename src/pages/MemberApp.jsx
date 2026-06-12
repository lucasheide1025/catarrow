// src/pages/MemberApp.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { subscribeResults, subscribeNotifications } from "../lib/db";
import { getAppTheme, APP_THEMES, saveAppTheme } from "../lib/theme";
import { certLevelStyle } from "../lib/constants";
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
import MonsterBattle      from "../components/member/MonsterBattle";
import MemberMaterials    from "../components/member/MemberMaterials";
import MemberMonsterDex  from "../components/member/MemberMonsterDex";
import CardCollection    from "../components/member/CardCollection";
import PartyLobby        from "../components/party/PartyLobby";
import PartyQuestRoom    from "../components/party/PartyQuestRoom";
import PartyBattleRoom   from "../components/party/PartyBattleRoom";
import DuelLobby         from "../components/duel/DuelLobby";
import DuelRoom          from "../components/duel/DuelRoom";

const CAN_SCORE = ["upcoming","open","ongoing"];
const COMP_PAGES    = ["comp-detail","monster","duel","duel-room"];
const PROFILE_PAGES = ["learn","msgs","history","external","achievements","certexam","notifications","dex","materials","monsterdex","party","party-quest","party-battle"];

export default function MemberApp() {
  const { logout, profile } = useAuth();
  const [page, setPage]       = useState(()=>sessionStorage.getItem("member_page")||"home");
  const [selComp, setSelComp] = useState(null);
  const [scoring, setScoring] = useState(false);
  useEffect(()=>{ sessionStorage.setItem("member_page",page); },[page]);
  useEffect(()=>{ if(page==="comp-detail"&&!selComp) setPage("comps"); },[]); // eslint-disable-line
  const [lastResult, setLastResult] = useState(null);
  const [partyRoomId,   setPartyRoomId]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("party_room"))?.roomId || null; } catch { return null; }
  });
  const [partyRoomType, setPartyRoomType] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("party_room"))?.type || null; } catch { return null; }
  });
  const [partyIsHost,   setPartyIsHost]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("party_room"))?.isHost || false; } catch { return false; }
  });
  const [notifications, setNotifications] = useState([]);
  const [appTheme, setAppTheme] = useState(() => getAppTheme());

  function handleAppThemeChange(id) {
    saveAppTheme(id);
    setAppTheme(APP_THEMES.find(t => t.id === id) || APP_THEMES[0]);
  }

  useEffect(() => {
    if (!profile?.id) return;
    return subscribeNotifications(profile.id, setNotifications, profile.createdAt);
  }, [profile?.id]); // eslint-disable-line

  function handleEnterPartyRoom(roomId, type, host) {
    setPartyRoomId(roomId);
    setPartyRoomType(type);
    setPartyIsHost(host);
    sessionStorage.setItem("party_room", JSON.stringify({ roomId, type, isHost: host }));
    setPage(type === "quest" ? "party-quest" : "party-battle");
  }
  function handleLeaveParty() {
    sessionStorage.removeItem("party_room");
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

  const nav = [
    { id:"home",        icon:"🏠", label:"首頁" },
    { id:"comps",       icon:"🏆", label:"比賽" },
    { id:"practice",    icon:"🎯", label:"練習" },
    { id:"leaderboard", icon:"📊", label:"排行" },
    { id:"profile",     icon:"👤", label:"我的" },
  ];

  function handleSelectComp(comp) { setSelComp(comp); setScoring(false); setPage("comp-detail"); }

  function isNavActive(navId, curPage) {
    if (navId === curPage) return true;
    if (navId === "comps"   && COMP_PAGES.includes(curPage))    return true;
    if (navId === "profile" && PROFILE_PAGES.includes(curPage)) return true;
    return false;
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"sans-serif" }}>
      <MustReadGate memberId={profile?.id} notifications={notifications} />
      <HonorCelebration memberId={profile?.id} notifications={notifications} onGoPage={setPage} />

      {/* Header */}
      <div style={{ position:"sticky", top:0, zIndex:40 }}>
        <div style={{ background:appTheme.headerBg, borderBottom:`1px solid ${appTheme.headerBorder}`, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontWeight:"900", color:appTheme.titleColor, fontSize:"14px", letterSpacing:"0.02em" }}>🎯 貓小隊射箭場</div>
            <div style={{ fontSize:"11px", color:appTheme.subtitleColor, marginTop:"1px" }}>Barebow Indoor Archery</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <span style={{ fontSize:"12px", color:appTheme.usernameColor }}>👤 {profile?.nickname||profile?.name}</span>
            <button onClick={logout} style={{ fontSize:"11px", borderRadius:"8px", padding:"4px 10px", cursor:"pointer", ...appTheme.logoutStyle }}>登出</button>
          </div>
        </div>
        {partyRoomId && !["party-quest","party-battle"].includes(page) && (
          <button onClick={() => setPage(partyRoomType === "quest" ? "party-quest" : "party-battle")}
            style={{ display:"block", width:"100%", background:appTheme.partyBg, color:"white", padding:"7px 16px", fontSize:"12px", fontWeight:"900", textAlign:"center", border:"none", cursor:"pointer", letterSpacing:"0.02em" }}>
            🎮 組隊進行中 — 點此回到房間
          </button>
        )}
      </div>

      {/* 頁面內容 */}
      <div style={{ paddingBottom:"80px" }}>
        {page==="home"        && <MemberHome onPageChange={setPage} onJoinParty={handleEnterPartyRoom} notifications={notifications} />}
        {page==="comps"       && <MemberComps onSelectComp={handleSelectComp} onPageChange={setPage} />}
        {page==="comp-detail" && selComp && !scoring && (
          <CompDetail comp={selComp} profile={profile}
            onBack={()=>setPage("comps")}
            onStartScoring={(myRes)=>{ setLastResult(myRes||null); setScoring(true); }} />
        )}
        {page==="comp-detail" && selComp && scoring && (
          <MemberScoring comp={selComp} lastResult={lastResult}
            onBack={()=>setScoring(false)}
            onDone={()=>{ setScoring(false); setPage("comps"); }} />
        )}
        {page==="practice"    && <MemberPractice />}
        {page==="leaderboard" && <MemberLeaderboard />}
        {page==="profile"     && <MemberProfile onPageChange={setPage} appTheme={appTheme} onAppThemeChange={handleAppThemeChange} />}
        {page==="learn"       && <MemberLearn />}
        {page==="msgs"        && <MemberMessages />}
        {page==="history"     && <MemberHistory />}
        {page==="external"    && <MemberExternalComp />}
        {page==="achievements" && <MemberAchievements />}
        {page==="certexam"    && <MemberCertExam onBack={()=>setPage("profile")} />}
        {page==="notifications" && <MemberNotifications notifications={notifications} />}
        {page==="dex"         && <MemberDex onBack={()=>setPage("profile")} />}
        {page==="monster"     && <MonsterBattle onBack={()=>setPage("comps")} />}
        {page==="duel"        && <DuelLobby profile={profile} onEnterRoom={handleEnterDuelRoom} onBack={()=>setPage("home")} />}
        {page==="duel-room"   && duelRoomId && <DuelRoom roomId={duelRoomId} myTeam={duelMyTeam} isHost={duelIsHost} onLeave={handleLeaveDuel} profile={profile} />}
        {page==="materials"   && <MemberMaterials  onBack={()=>setPage("profile")} />}
        {page==="cards"       && <CardCollection />}
        {page==="monsterdex"  && <MemberMonsterDex onBack={()=>setPage("profile")} />}
        {page==="party"       && <PartyLobby onEnterRoom={handleEnterPartyRoom} />}
        {page==="party-quest" && partyRoomId && (
          <PartyQuestRoom roomId={partyRoomId} isHost={partyIsHost} onLeave={handleLeaveParty} />
        )}
        {page==="party-battle" && partyRoomId && (
          <PartyBattleRoom roomId={partyRoomId} isHost={partyIsHost} onLeave={handleLeaveParty} />
        )}
      </div>

      {/* 底部導覽 */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"white", borderTop:"1px solid #e2e8f0", display:"flex", zIndex:40 }}>
        {nav.map(n => {
          const active = isNavActive(n.id, page);
          return (
            <button key={n.id} onClick={() => setPage(n.id)}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", paddingTop:"6px", paddingBottom:"8px", gap:"2px", border:"none", background:"white", cursor:"pointer", color: active ? appTheme.navActive : "#94a3b8" }}>
              {/* 頂部 active 指示條 */}
              <div style={{ height:"2px", width: active ? "20px" : "0px", background:appTheme.navIndicator, borderRadius:"0 0 2px 2px", marginBottom:"3px", transition:"width 0.2s ease" }} />
              <div style={{ position:"relative", display:"inline-block" }}>
                <span style={{ fontSize:"18px" }}>{n.icon}</span>
                {n.id === "profile" && (profile?.hasUnreadReply || profile?.hasNewLearnLog) && (
                  <span style={{ position:"absolute", top:"-2px", right:"-5px", width:"8px", height:"8px", background:"#ef4444", borderRadius:"50%", border:"2px solid white", display:"block" }} />
                )}
              </div>
              <span style={{ fontSize:"10px", fontWeight: active ? "700" : "500" }}>{n.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompDetail({ comp, onBack, onStartScoring, profile }) {
  const isCert = comp?.type==="年度檢定";
  const [results, setResults]   = useState([]);
  const [loadingR, setLoadingR] = useState(true);

  useEffect(()=>{
    if(!comp?.id){ setLoadingR(false); return; }
    let unsub = ()=>{};
    try {
      unsub = subscribeResults(comp.id,(data)=>{ setResults(Array.isArray(data)?data:[]); setLoadingR(false); });
    } catch(e){ console.warn("subscribeResults failed:",e); setLoadingR(false); }
    return ()=>{ try{ unsub(); }catch{} };
  },[comp?.id]);

  const myId = profile?.id||null;
  const safeResults = Array.isArray(results)?results:[];
  const parts = Array.isArray(comp?.participants)?comp.participants:[];
  const joined = myId?parts.includes(myId):false;
  const myResult = safeResults.find(r=>r&&r.memberId===myId)||null;
  const myCertResults = isCert?safeResults.filter(r=>r&&r.memberId===myId):[];
  const rankList = (isCert?safeResults.filter(r=>r&&r.reviewStatus==="approved"):safeResults)
    .slice().sort((a,b)=>((b&&b.total)||0)-((a&&a.total)||0));
  const myRank = rankList.findIndex(r=>r&&r.memberId===myId);
  const BOW_GROUP_LABEL = { recurve_bare:"🏹 裸弓", recurve_full:"🎯 全配", compound:"🦅 獵弓", traditional:"🌿 傳統" };
  const certApproved = isCert?safeResults.filter(r=>r&&r.reviewStatus==="approved"):[];
  const certByBow = {};
  certApproved.forEach(r=>{ const b=r.certBowType||"other"; if(!certByBow[b]) certByBow[b]=[]; certByBow[b].push(r); });
  Object.keys(certByBow).forEach(b=>certByBow[b].sort((a,c)=>(c.total||0)-(a.total||0)));
  const canScoreStatus = CAN_SCORE.includes(comp?.status);
  let canEnter=false, lockMsg="";
  if(!joined){ canEnter=false; lockMsg="尚未報名，請先回比賽列表報名"; }
  else if(!canScoreStatus){ canEnter=false; lockMsg="此比賽目前無法計分"; }
  else{ canEnter=true; }
  const anyPending = isCert&&myCertResults.some(r=>r.reviewStatus==="pending");

  return (
    <div className="p-4 flex flex-col gap-4">
      <button onClick={onBack} className="text-gray-500 text-sm">← 返回</button>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="text-gray-800 font-black text-lg mb-2">{comp?.title||"比賽"}</div>
        <div className="grid grid-cols-2 gap-2">
          {[["📅 日期",(comp?.date||"")+(comp?.endDate?` ～ ${comp.endDate}`:"")],
            ["🎯 靶紙",comp?.targetName||"—"],
            ["🏹 規格",comp?.arrowCount?`${comp.arrowCount}箭×${comp.roundCount}回`:"—"],
            ["計分","環數"+(comp?.hasMiss?" +M":"")]].map(([k,v])=>(
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
      {isCert&&myCertResults.length>0 && (
        <div className="flex flex-col gap-2">
          {myCertResults.map(mr=>(
            <div key={mr.id} className="bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-blue-200 text-xs">{mr.bowLabel||(BOW_GROUP_LABEL[mr.certBowType]||"我的成績")}</div>
                <div className="font-black text-3xl">{mr.total}</div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {mr.reviewStatus==="pending" && <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">⏳ 審核中</span>}
                  {mr.reviewStatus==="approved"&&mr.certLevel && (
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${mr.certLevel==="未達標"?"bg-white/20 text-white":certLevelStyle(mr.certLevel,"solid")}`}>
                      {mr.certLevel==="未達標"?"未達標":`${mr.certLevel} 級`}
                    </span>
                  )}
                  {mr.reviewStatus==="rejected" && <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">已退回</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!isCert&&myResult && (
        <div className="bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-blue-200 text-xs">我的成績</div>
            <div className="font-black text-3xl">{myResult.total}</div>
          </div>
          {(myResult.rank||(myRank>=0)) && (
            <div className="text-right">
              <div className="text-blue-200 text-xs">名次</div>
              <div className="font-black text-3xl">{myResult.rank||(myRank+1)}</div>
            </div>
          )}
        </div>
      )}
      {anyPending && <div className="text-center text-amber-600 text-xs py-2 bg-amber-50 rounded-xl">部分弓種審核中，審核通過前該弓種無法刷分；可改考其他弓種</div>}
      {canEnter ? (
        <button onClick={()=>onStartScoring(isCert?null:myResult)}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-xl">
          🏹 {isCert?(myCertResults.length>0?"再考一種弓 / 刷分":"進入檢定"):(myResult?"重新挑戰":"開始記分")}
        </button>
      ) : (
        lockMsg&&<div className="text-center text-gray-400 text-sm py-2 bg-gray-50 rounded-xl">{lockMsg}</div>
      )}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="text-gray-500 text-xs font-bold mb-3">🏅 成績排行{isCert?"（已審核）":""}</div>
        {loadingR ? <div className="text-gray-400 text-sm text-center py-4">載入中…</div>
        : isCert ? (
          Object.keys(certByBow).length===0
            ? <div className="text-gray-400 text-sm text-center py-4">尚無已審核成績</div>
            : <div className="flex flex-col gap-4">
                {["recurve_bare","recurve_full","compound","traditional"].filter(b=>certByBow[b]?.length).map(b=>(
                  <div key={b}>
                    <div className="text-gray-600 text-xs font-black mb-1.5">{BOW_GROUP_LABEL[b]||b}</div>
                    {certByBow[b].map((r,i)=>{
                      const isMe=r.memberId===myId;
                      return (
                        <div key={r.id||i} className={`flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 ${isMe?"bg-blue-50 -mx-4 px-4 rounded-xl":""}`}>
                          <span className="w-7 text-center text-sm">{["🥇","🥈","🥉"][i]||i+1}</span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-bold ${isMe?"text-blue-700":"text-gray-800"}`}>{r.nickname||r.name||"匿名射手"}{isMe&&"（我）"}</div>
                            {r.certLevel&&r.certLevel!=="未達標" && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${certLevelStyle(r.certLevel,"soft")}`}>{r.certLevel}</span>}
                          </div>
                          <span className={`font-black text-xl ${isMe?"text-blue-600":"text-gray-800"}`}>{r.total}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
        ) : rankList.length===0
          ? <div className="text-gray-400 text-sm text-center py-4">尚無成績</div>
          : rankList.map((r,i)=>{
              const isMe=r.memberId===myId;
              return (
                <div key={r.id||r.memberId||i} className={`flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 ${isMe?"bg-blue-50 -mx-4 px-4 rounded-xl":""}`}>
                  <span className="w-7 text-center text-sm">{["🥇","🥈","🥉"][i]||i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold ${isMe?"text-blue-700":"text-gray-800"}`}>{r.nickname||r.name||"匿名射手"}{isMe&&"（我）"}</div>
                  </div>
                  <span className={`font-black text-xl ${isMe?"text-blue-600":"text-gray-800"}`}>{r.total}</span>
                </div>
              );
            })
        }
      </div>
      <RegList compId={comp?.id} myId={myId} />
    </div>
  );
}

function RegList({ compId, myId }) {
  const [regs, setRegs]     = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    if(!compId){ setLoading(false); return; }
    import("../lib/db").then(({ getRegistrations })=>{
      getRegistrations(compId).then(d=>{ setRegs(Array.isArray(d)?d:[]); setLoading(false); }).catch(()=>setLoading(false));
    });
  },[compId]);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="text-gray-500 text-xs font-bold mb-3">📋 報名名單{regs.length?`（${regs.length}）`:""}</div>
      {loading ? <div className="text-gray-400 text-sm text-center py-4">載入中…</div>
      : regs.length===0 ? <div className="text-gray-400 text-sm text-center py-4">尚無人報名</div>
      : <div className="flex flex-wrap gap-2">
          {regs.map(r=>{
            const isMe=r.memberId===myId;
            const label=r.nickname||r.name||r.guestInfo?.name||"射手";
            return (
              <span key={r.id||r.memberId} className={`text-xs px-3 py-1.5 rounded-full font-bold ${isMe?"bg-blue-600 text-white":"bg-gray-100 text-gray-600"}`}>
                {label}{isMe&&"（我）"}
              </span>
            );
          })}
        </div>
      }
    </div>
  );
}