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
    <div className="min-h-screen flex flex-col items-center py-10 px-4 relative overflow-hidden text-white" style={{ backgroundImage:"linear-gradient(180deg,rgba(3,8,22,.68),rgba(3,8,22,.96)),url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"center" }}>
      <div aria-hidden="true" className="absolute -right-28 bottom-0 h-80 w-80 opacity-25 pointer-events-none" style={{backgroundImage:"url(/art/characters/adventure-men-roster-v1.png)",backgroundSize:"500% 200%",backgroundPosition:"50% 0%",backgroundRepeat:"no-repeat",filter:"drop-shadow(0 0 28px rgba(96,165,250,.65))"}} />
      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8 rounded-3xl border border-sky-200/15 bg-slate-950/45 px-4 py-6 shadow-2xl backdrop-blur-md">
          {onBack && (
            <button onClick={onBack} className="absolute left-4 top-4 text-slate-400 text-sm font-bold hover:text-white transition-colors">← 返回</button>
          )}
          <div className="text-5xl mb-3">👥</div>
          <div className="text-2xl font-black text-white">組隊模式</div>
          <div className="text-sm text-slate-400 mt-1">與夥伴一起練習、一起打怪</div>
        </div>

        {/* Tab */}
        <div className="flex border border-white/10 bg-slate-950/60 rounded-2xl p-1 mb-6 shadow-xl backdrop-blur-md">
          {[["create","✨ 建立房間"], ["join","🏹 加入房間"]].map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setErr(""); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
                tab === id ? "bg-white text-slate-800 shadow" : "text-slate-400"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "create" ? (
          <div className="flex flex-col gap-4">
            <div className="text-xs font-black text-slate-400 tracking-widest uppercase px-1">選擇模式</div>
            {(battleOnly ? TYPE_OPTIONS.filter(t => t.id === "battle") : TYPE_OPTIONS).map(t => (
              <button key={t.id} onClick={() => setSelType(t.id)}
                className={`relative w-full rounded-2xl border-2 p-4 text-left transition-all ${
                  selType === t.id
            ? `${t.border} ${t.bg} shadow-[0_0_22px_rgba(251,146,60,.15)]`
                    : "border-slate-600/70 bg-slate-950/55 backdrop-blur"
                }`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{t.icon}</span>
                  <div>
                    <div className={`font-black text-base ${selType === t.id ? t.textColor : "text-white"}`}>
                      {t.label}
                    </div>
                    <div className={`text-xs mt-0.5 ${selType === t.id ? t.textColor + "/80" : "text-slate-400"}`}>
                      {t.desc}
                    </div>
                  </div>
                  {selType === t.id && (
                    <span className="ml-auto text-lg">✅</span>
                  )}
                </div>
              </button>
            ))}

            <button onClick={handleCreate} disabled={loading}
              className="mt-2 w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-base rounded-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-50">
              {loading ? "建立中…" : "🚀 建立房間"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-xs font-black text-slate-400 tracking-widest uppercase px-1">開放中的房間</div>
            {openRooms.length === 0 ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
                <div className="text-3xl mb-2 animate-pulse">🔍</div>
                <div className="text-slate-400 text-sm">目前沒有開放中的房間</div>
                <div className="text-slate-600 text-xs mt-1">等待夥伴建立房間後自動更新</div>
              </div>
            ) : openRooms.map(r => {
              const memberCount = Object.keys(r.members || {}).length;
              const hostName    = r.members?.[r.hostId]?.name || "未知";
              const typeInfo    = TYPE_OPTIONS.find(t => t.id === r.type);
              return (
                <div key={r.id} className={`rounded-2xl border-2 p-4 shadow-xl backdrop-blur ${typeInfo?.border || "border-slate-600"} bg-slate-950/65`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{typeInfo?.icon || "👥"}</span>
                      <div>
                        <div className="text-white font-black text-sm">{typeInfo?.label || r.type}</div>
                        <div className="text-slate-400 text-xs mt-0.5">🧙 {hostName} 的房間・{memberCount} 人等待中</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinRoom(r)}
                      disabled={loading}
                      className="px-5 py-2 rounded-xl font-black text-sm bg-gradient-to-r from-teal-500 to-emerald-600 text-white disabled:opacity-40 active:scale-95 transition-all"
                    >
                      {loading ? "…" : "加入"}
                    </button>
                  </div>
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
