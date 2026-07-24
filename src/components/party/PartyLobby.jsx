// src/components/party/PartyLobby.jsx — 建立/加入組隊房間
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { createPartyRoom, joinPartyRoom, subscribeOpenPartyRooms, cleanupStalePartyRooms } from "../../lib/partyDb";
import { subscribePracticeLogs } from "../../lib/db";
import { archerLevelFromXP } from "../../lib/archerLevel";
import BattleRecords from "../member/BattleRecords";

const TYPE_OPTIONS = [
  {
    id: "battle",
    icon: "⚔️",
    label: "組隊打怪",
    desc: "最多 8 人合力討伐怪物，每人輸入箭分，一起計算傷害",
    color: "from-rose-400 to-orange-500",
    border: "border-rose-400",
    bg: "bg-rose-50",
    textColor: "text-rose-700",
  },
];

// guestOverride = { id, name } — 訪客模式時傳入，覆蓋 profile
// battleOnly — 訪客模式只顯示打怪選項（不顯示日常任務）
export default function PartyLobby({ onEnterRoom, onBack, guestOverride, battleOnly }) {
  const { profile } = useAuth();
  const [tab, setTab]         = useState("create"); // "create" | "join"
  const [selType, setSelType] = useState("battle");
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [openRooms, setOpenRooms] = useState([]);

  const myId   = guestOverride?.id   || profile?.id;
  const myName = guestOverride?.name || profile?.nickname || profile?.name || "射手";
  const isGuestMode = !!guestOverride || ["guest", "kid"].includes(profile?.accountType);
  const [partyLogs, setPartyLogs] = useState([]);

  useEffect(() => {
    if (!myId || isGuestMode) return;
    const unsub = subscribePracticeLogs(myId, logs =>
      setPartyLogs(logs.filter(l => l.source === "party")), 60
    );
    return unsub;
  }, [myId, isGuestMode]);

  useEffect(() => {
    if (tab !== "join") return;
    cleanupStalePartyRooms();
    const unsub = subscribeOpenPartyRooms(setOpenRooms);
    return () => { unsub?.(); setOpenRooms([]); };
  }, [tab]); // eslint-disable-line

  async function handleCreate() {
    setLoading(true); setErr("");
    const res = await createPartyRoom(myId, myName, selType, {
      accountType: isGuestMode ? (guestOverride?.accountType || "guest") : (profile?.accountType || "official"),
      level: isGuestMode ? 1 : archerLevelFromXP(profile?.archerXP || 0),
    });
    setLoading(false);
    if (res.ok) onEnterRoom(res.roomId, selType, true);
    else setErr(res.reason);
  }

  async function handleJoinRoom(openRoom) {
    if (loading) return;
    setLoading(true); setErr("");
    const res = await joinPartyRoom(openRoom.code, myId, myName, {
      accountType: isGuestMode ? (guestOverride?.accountType || "guest") : (profile?.accountType || "official"),
      level: isGuestMode ? 1 : archerLevelFromXP(profile?.archerXP || 0),
    });
    setLoading(false);
    if (res.ok) onEnterRoom(res.roomId, openRoom.type, false);
    else setErr(res.reason);
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-8 px-4 relative overflow-x-hidden text-white"
      style={{ backgroundImage:"linear-gradient(180deg,rgba(7,11,22,.62),rgba(10,15,28,.82) 45%,rgba(15,23,42,.95)),url(/assets/dungeon/dungeon_team_lobby_bg.jpg)", backgroundSize:"cover", backgroundPosition:"center" }}>
      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="relative text-center mb-6 rounded-3xl border border-amber-500/25 bg-gradient-to-b from-slate-900/70 to-slate-950/85 px-4 py-6 shadow-2xl backdrop-blur-md">
          {onBack && (
            <button onClick={onBack} className="absolute left-4 top-4 text-slate-300 text-sm font-bold hover:text-white transition-colors">← 返回</button>
          )}
          <div className="text-5xl mb-2 drop-shadow">⚔️</div>
          <div className="text-2xl font-black text-amber-200">組隊打怪</div>
          <div className="text-sm text-slate-400 mt-1">揪隊合力討伐怪物・每人射箭一起計傷</div>
        </div>

        {/* Tab */}
        <div className="flex border border-white/10 bg-slate-950/60 rounded-2xl p-1 mb-5 shadow-xl backdrop-blur-md">
          {[["create","✨ 建立房間"], ["join","🏹 加入房間"]].map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setErr(""); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
                tab === id ? "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 shadow" : "text-slate-400"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "create" ? (
          <div className="flex flex-col gap-4">
            {(battleOnly ? TYPE_OPTIONS.filter(t => t.id === "battle") : TYPE_OPTIONS).map(t => (
              <button key={t.id} onClick={() => setSelType(t.id)}
                className="relative w-full rounded-2xl border p-4 text-left transition-all"
                style={{
                  borderColor: selType === t.id ? "rgba(251,146,60,0.5)" : "rgba(255,255,255,0.1)",
                  background: "linear-gradient(135deg, rgba(159,18,57,0.25), rgba(15,23,42,0.65))",
                  boxShadow: selType === t.id ? "0 0 22px rgba(251,146,60,.18)" : "none",
                }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-400/30 flex items-center justify-center text-2xl shrink-0">{t.icon}</div>
                  <div className="min-w-0">
                    <div className="font-black text-base text-white">{t.label}</div>
                    <div className="text-xs mt-0.5 text-slate-400">{t.desc}</div>
                  </div>
                  {selType === t.id && <span className="ml-auto text-lg">✅</span>}
                </div>
              </button>
            ))}

            <button onClick={handleCreate} disabled={loading}
              className="mt-1 w-full py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-base rounded-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-50">
              {loading ? "建立中…" : "🚀 建立房間，揪人打怪"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-xs font-black text-slate-400 tracking-widest uppercase px-1">🏠 開放中的隊伍（{openRooms.length}）</div>
            {openRooms.length === 0 ? (
              <div className="rounded-2xl bg-white/5 border border-dashed border-white/15 p-8 text-center">
                <div className="text-3xl mb-2 animate-pulse">🔍</div>
                <div className="text-slate-400 text-sm">目前沒有開放的隊伍</div>
                <div className="text-slate-600 text-xs mt-1">建立一個揪人吧！</div>
              </div>
            ) : openRooms.map(r => {
              const memberCount = Object.keys(r.members || {}).length;
              const hostName    = r.members?.[r.hostId]?.name || "未知";
              const typeInfo    = TYPE_OPTIONS.find(t => t.id === r.type);
              const full        = memberCount >= 8;
              return (
                <div key={r.id} className="rounded-2xl border border-amber-500/20 bg-slate-900/75 p-3 shadow-xl backdrop-blur flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-950/60 border border-white/10 flex items-center justify-center text-xl shrink-0">{typeInfo?.icon || "⚔️"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-black text-sm truncate">{hostName} 的隊伍</div>
                    <div className="text-slate-400 text-[11px] mt-0.5">👤 {memberCount}/8 人等待中</div>
                  </div>
                  <button onClick={() => handleJoinRoom(r)} disabled={loading || full}
                    className="px-4 py-2 rounded-xl font-black text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-40 active:scale-95 transition-all">
                    {full ? "已滿" : loading ? "…" : "加入"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {err && (
          <div className="mt-4 p-3 bg-red-900/40 border border-red-500/50 rounded-xl text-red-300 text-sm font-bold text-center">
            {err}
          </div>
        )}

        {/* 組隊打怪歷史紀錄 */}
        <div className="mt-6">
          <BattleRecords logs={partyLogs} title="📊 組隊打怪紀錄" maxGroups={6}/>
        </div>
      </div>
    </div>
  );
}
