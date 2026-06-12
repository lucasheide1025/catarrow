// src/components/party/PartyLobby.jsx — 建立/加入組隊房間
import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { createPartyRoom, joinPartyRoom } from "../../lib/partyDb";

const TYPE_OPTIONS = [
  {
    id: "quest",
    icon: "📋",
    label: "日常任務分享",
    desc: "兩人各自設定練習距離，完成後一起獲得寶箱獎勵",
    color: "from-emerald-400 to-teal-500",
    border: "border-emerald-400",
    bg: "bg-emerald-50",
    textColor: "text-emerald-700",
  },
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
export default function PartyLobby({ onEnterRoom, guestOverride, battleOnly }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState("create"); // "create" | "join"
  const [selType, setSelType] = useState(battleOnly ? "battle" : "quest");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const myId   = guestOverride?.id   || profile?.id;
  const myName = guestOverride?.name || profile?.nickname || profile?.name || "射手";

  async function handleCreate() {
    setLoading(true); setErr("");
    const res = await createPartyRoom(myId, myName, selType);
    setLoading(false);
    if (res.ok) onEnterRoom(res.roomId, selType, true);
    else setErr(res.reason);
  }

  async function handleJoin() {
    if (joinCode.trim().length < 6) { setErr("請輸入 6 碼邀請碼"); return; }
    setLoading(true); setErr("");
    const res = await joinPartyRoom(joinCode.trim(), myId, myName);
    setLoading(false);
    if (res.ok) {
      // 用 subscribePartyRoom 判斷 type
      const { subscribePartyRoom } = await import("../../lib/partyDb");
      const unsub = subscribePartyRoom(res.roomId, (room) => {
        unsub();
        if (room) onEnterRoom(res.roomId, room.type, false);
        else setErr("讀取房間失敗");
      });
    } else setErr(res.reason);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">👥</div>
          <div className="text-2xl font-black text-white">組隊模式</div>
          <div className="text-sm text-slate-400 mt-1">與夥伴一起練習、一起打怪</div>
        </div>

        {/* Tab */}
        <div className="flex bg-slate-700/50 rounded-2xl p-1 mb-6">
          {[["create","✨ 建立房間"], ["join","🔑 加入房間"]].map(([id, label]) => (
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
                    ? `${t.border} ${t.bg}`
                    : "border-slate-600 bg-slate-700/40"
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
          <div className="flex flex-col gap-4">
            <div className="text-xs font-black text-slate-400 tracking-widest uppercase px-1">輸入邀請碼</div>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="例：AB2F9K"
              maxLength={6}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-2xl px-5 py-4 text-white font-black text-2xl tracking-[0.3em] text-center focus:outline-none focus:border-indigo-400 placeholder:text-slate-500 placeholder:text-base placeholder:tracking-normal"
            />
            <button onClick={handleJoin} disabled={loading || joinCode.length < 6}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black text-base rounded-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-50">
              {loading ? "加入中…" : "🔑 加入房間"}
            </button>
          </div>
        )}

        {err && (
          <div className="mt-4 p-3 bg-red-900/40 border border-red-500/50 rounded-xl text-red-300 text-sm font-bold text-center">
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
