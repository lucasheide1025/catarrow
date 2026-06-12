// src/components/duel/DuelLobby.jsx — 決鬥大廳（建房/加入/等待室）
import { useState, useEffect } from "react";
import { Card, Btn, Inp, ST, useToast } from "../shared/UI";
import { calcArcherStats } from "../../lib/monsterData";
import {
  createDuelRoom, joinDuelRoom, subscribeDuelRoom,
  startDuelBattle, skipDisconnected
} from "../../lib/duelDb";

const TYPE_OPTIONS = [
  { value:"1v1",   label:"⚔️ 1v1",       desc:"單挑，決一勝負" },
  { value:"2v2",   label:"🛡 2v2",        desc:"雙打團隊賽" },
  { value:"3v3",   label:"🏹 3v3",        desc:"三對三混戰" },
  { value:"4v4",   label:"💥 4v4",        desc:"四對四大型團隊賽" },
  { value:"uneven",label:"⚡ 不對等",      desc:"1對多、多對多，自由配對" },
];

function quickStats(profile, isGuest) {
  if (isGuest || !profile) return { hp: 200, atk: 20, def: 10 };
  return calcArcherStats({
    member: profile,
    certification: null,
    certRecords: profile.certRecords || [],
    dexStats: null,
  });
}

export default function DuelLobby({ profile, onEnterRoom, onBack, isGuest }) {
  const { toast, ToastContainer } = useToast();
  const [phase, setPhase]   = useState("menu");   // menu|create|join|waiting
  const [type, setType]     = useState("1v1");
  const [myTeam, setMyTeam] = useState("A");
  const [code, setCode]     = useState("");
  const [room, setRoom]     = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(false);

  const myId   = profile?.id || profile?.uid || "guest";
  const myName = profile?.name || (isGuest ? "訪客" : "射手");

  // 訂閱等待室
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeDuelRoom(roomId, r => {
      if (!r) { toast("房間已關閉", "error"); setPhase("menu"); setRoomId(null); return; }
      setRoom(r);
      // 自動進入戰鬥
      if (r.status === "active") {
        const team = Object.keys(r.teamA || {}).includes(myId) ? "A" : "B";
        onEnterRoom(roomId, team, r.hostId === myId);
      }
    });
    return unsub;
  }, [roomId]);

  async function handleCreate() {
    setLoading(true);
    const stats = quickStats(profile, isGuest);
    const res = await createDuelRoom(myId, myName, type, myTeam, stats, isGuest);
    setLoading(false);
    if (!res.ok) { toast("建立失敗：" + res.reason, "error"); return; }
    setRoomId(res.roomId);
    setIsHost(true);
    setPhase("waiting");
  }

  async function handleJoin() {
    if (!code.trim()) { toast("請輸入邀請碼"); return; }
    setLoading(true);
    const stats = quickStats(profile, isGuest);
    const res = await joinDuelRoom(code.trim(), myId, myName, myTeam, stats, isGuest);
    setLoading(false);
    if (!res.ok) { toast(res.reason, "error"); return; }
    setRoomId(res.roomId);
    setIsHost(false);
    setPhase("waiting");
  }

  async function handleStart() {
    if (!room) return;
    const aCount = Object.keys(room.teamA || {}).length;
    const bCount = Object.keys(room.teamB || {}).length;
    if (aCount === 0 || bCount === 0) { toast("兩隊都需至少一名玩家"); return; }
    await startDuelBattle(roomId);
  }

  async function handleSkip(team, memberId) {
    await skipDisconnected(roomId, team, memberId);
  }

  function handleLeaveWait() {
    setPhase("menu");
    setRoomId(null);
    setRoom(null);
    setIsHost(false);
  }

  // ── 等待室 ──────────────────────────────────────────────
  if (phase === "waiting" && room) {
    const now = Date.now();
    const lastSeen = room.lastSeen || {};
    const isDisc = id => (now - (lastSeen[id] || 0)) > 90000;

    const teamAEntries = Object.entries(room.teamA || {});
    const teamBEntries = Object.entries(room.teamB || {});
    const typeLabel = TYPE_OPTIONS.find(t => t.value === room.type)?.label || room.type;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4">
        <ToastContainer />
        <div className="w-full max-w-sm flex flex-col gap-4">

          {/* 房間資訊 */}
          <div className="text-center">
            <div className="text-3xl font-black text-white tracking-wide">{typeLabel} 決鬥</div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-sm text-slate-400">邀請碼：</span>
              <span className="text-2xl font-black tracking-[6px] text-amber-400">{room.code}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">分享邀請碼邀請對手加入</div>
          </div>

          {/* 雙隊顯示 */}
          <div className="flex gap-3">
            {[["A", teamAEntries, "from-blue-900/60 border-blue-500/50"], ["B", teamBEntries, "from-red-900/60 border-red-500/50"]].map(([team, entries, cls]) => (
              <div key={team} className={`flex-1 rounded-2xl bg-gradient-to-b ${cls} border p-3 flex flex-col gap-2`}>
                <div className={`text-xs font-black tracking-widest ${team === "A" ? "text-blue-300" : "text-red-300"}`}>⚔ 隊伍 {team}</div>
                {entries.length === 0 && <div className="text-slate-500 text-xs text-center py-2">等待中…</div>}
                {entries.map(([id, m]) => (
                  <div key={id} className={`flex items-center gap-1.5 ${isDisc(id) ? "opacity-50" : ""}`}>
                    <span className="text-sm">{isDisc(id) ? "⚠️" : "🏹"}</span>
                    <span className="text-white text-sm font-bold truncate flex-1">{m.name}</span>
                    {id === myId && <span className="text-[10px] bg-amber-500 text-white px-1.5 rounded-full font-black">你</span>}
                    {isDisc(id) && isHost && (
                      <button onClick={() => handleSkip(team, id)}
                        className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold">踢</button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* 按鈕 */}
          {isHost ? (
            <Btn v="primary" className="w-full" onClick={handleStart}>
              ⚔️ 開始決鬥
            </Btn>
          ) : (
            <div className="text-center text-slate-400 text-sm py-2 animate-pulse">等待主持人開始…</div>
          )}
          <Btn v="ghost" className="w-full" onClick={handleLeaveWait}>← 離開房間</Btn>
        </div>
      </div>
    );
  }

  // ── 建立房間 ────────────────────────────────────────────
  if (phase === "create") return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4">
      <ToastContainer />
      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="text-center">
          <div className="text-2xl font-black text-white">⚔️ 建立決鬥房間</div>
          <div className="text-slate-400 text-sm mt-1">選擇模式與你的隊伍</div>
        </div>

        <Card className="p-4 flex flex-col gap-3">
          <ST>⚔️ 決鬥模式</ST>
          <div className="flex flex-col gap-2">
            {TYPE_OPTIONS.map(t => (
              <button key={t.value} onClick={() => setType(t.value)}
                className={`rounded-xl px-3 py-2.5 text-left border transition-all ${type === t.value ? "bg-indigo-600 border-indigo-400 text-white" : "bg-slate-800/60 border-slate-700 text-slate-300"}`}>
                <span className="font-black text-sm">{t.label}</span>
                <span className="ml-2 text-xs opacity-70">{t.desc}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <ST>🎽 選擇隊伍</ST>
          <div className="flex gap-3">
            {["A","B"].map(t => (
              <button key={t} onClick={() => setMyTeam(t)}
                className={`flex-1 py-3 rounded-xl font-black text-sm border transition-all ${myTeam === t
                  ? (t==="A" ? "bg-blue-600 border-blue-400 text-white" : "bg-red-600 border-red-400 text-white")
                  : "bg-slate-800/60 border-slate-700 text-slate-300"}`}>
                {t === "A" ? "🔵 隊伍 A" : "🔴 隊伍 B"}
              </button>
            ))}
          </div>
        </Card>

        <Btn v="primary" className="w-full" onClick={handleCreate} disabled={loading}>
          {loading ? "建立中…" : "🚀 建立房間"}
        </Btn>
        <Btn v="ghost" className="w-full" onClick={() => setPhase("menu")}>← 返回</Btn>
      </div>
    </div>
  );

  // ── 加入房間 ────────────────────────────────────────────
  if (phase === "join") return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4">
      <ToastContainer />
      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="text-center">
          <div className="text-2xl font-black text-white">🔑 加入決鬥房間</div>
          <div className="text-slate-400 text-sm mt-1">輸入對手的邀請碼</div>
        </div>

        <Card className="p-4 flex flex-col gap-3">
          <Inp label="邀請碼" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="例：A3F7K2" maxLength={6}
            style={{ letterSpacing: "0.3em", fontSize: "1.2rem", fontWeight: 900 }} />

          <ST>🎽 選擇隊伍</ST>
          <div className="flex gap-3">
            {["A","B"].map(t => (
              <button key={t} onClick={() => setMyTeam(t)}
                className={`flex-1 py-3 rounded-xl font-black text-sm border transition-all ${myTeam === t
                  ? (t==="A" ? "bg-blue-600 border-blue-400 text-white" : "bg-red-600 border-red-400 text-white")
                  : "bg-slate-800/60 border-slate-700 text-slate-300"}`}>
                {t === "A" ? "🔵 隊伍 A" : "🔴 隊伍 B"}
              </button>
            ))}
          </div>
        </Card>

        <Btn v="primary" className="w-full" onClick={handleJoin} disabled={loading}>
          {loading ? "加入中…" : "⚔️ 加入決鬥"}
        </Btn>
        <Btn v="ghost" className="w-full" onClick={() => setPhase("menu")}>← 返回</Btn>
      </div>
    </div>
  );

  // ── 主選單 ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4">
      <ToastContainer />
      <div className="w-full max-w-sm flex flex-col gap-6">

        <div className="text-center">
          <div className="text-5xl mb-3">⚔️</div>
          <div className="text-3xl font-black text-white">決鬥模式</div>
          <div className="text-slate-400 text-sm mt-2">1v1・組隊・不對等對戰　│　無藥水限制</div>
        </div>

        {/* 我的決鬥紀錄 */}
        {profile && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex justify-around">
            {[
              ["🏆", profile?.duelWins || 0, "勝"],
              ["💀", profile?.duelLosses || 0, "敗"],
              ["🤝", profile?.duelDraws || 0, "平"],
            ].map(([icon, val, label]) => (
              <div key={label} className="text-center">
                <div className="text-xl font-black text-white">{val}</div>
                <div className="text-xs text-slate-400">{icon} {label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button onClick={() => setPhase("create")}
            className="rounded-2xl p-4 border-2 border-blue-500/50 text-left transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#1e3a5f,#1d4ed8)" }}>
            <div className="text-white font-black text-base">⚔️ 建立房間</div>
            <div className="text-blue-200 text-xs mt-0.5">設定模式、邀請對手加入</div>
          </button>

          <button onClick={() => setPhase("join")}
            className="rounded-2xl p-4 border-2 border-red-500/50 text-left transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#5f1e1e,#c2410c)" }}>
            <div className="text-white font-black text-base">🔑 加入房間</div>
            <div className="text-red-200 text-xs mt-0.5">輸入邀請碼加入對手的房間</div>
          </button>
        </div>

        <Btn v="ghost" className="w-full" onClick={onBack}>← 返回打怪模式</Btn>
      </div>
    </div>
  );
}
