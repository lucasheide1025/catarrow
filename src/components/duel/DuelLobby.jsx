// src/components/duel/DuelLobby.jsx — 決鬥大廳（建房/加入/等待室）
import { useState, useEffect } from "react";
import { Card, Btn, Inp, ST, useToast } from "../shared/UI";
import { calcArcherStats } from "../../lib/monsterData";
import {
  createDuelRoom, joinDuelRoom, subscribeDuelRoom,
  startDuelBattle, skipDisconnected, shuffleDuelTeams, balanceDuelStats, getDuelStats,
  updateDuelHeartbeat, closeDuelRoom, removePlayerFromRoom, scaleUnevenHost,
  addBotToDuelRoom, removeBotFromDuelRoom,
} from "../../lib/duelDb";
import { DUEL_BOT_STATS, makeBotId, randomBotName } from "../../lib/botUtils";

const TYPE_OPTIONS = [
  { value:"1v1",   label:"⚔️ 1v1",       desc:"單挑，決一勝負" },
  { value:"2v2",   label:"🛡 2v2",        desc:"雙打團隊賽" },
  { value:"3v3",   label:"🏹 3v3",        desc:"三對三混戰" },
  { value:"4v4",   label:"💥 4v4",        desc:"四對四大型團隊賽" },
  { value:"uneven",label:"⚡ 不對等",      desc:"1對多、多對多，自由配對" },
];

function quickStats(profile, isGuest) {
  if (isGuest || !profile) return { hp: 200, atk: 20, def: 10 };
  const raw = calcArcherStats({
    member: profile,
    certification: null,
    certRecords: profile.certRecords || [],
    dexStats: null,
  });
  return balanceDuelStats(raw);
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
  const [myStats, setMyStats] = useState(null);

  useEffect(() => {
    if (!profile?.id || isGuest) return;
    getDuelStats(profile.id).then(setMyStats).catch(() => {});
  }, [profile?.id]); // eslint-disable-line

  // 重新進入時從 sessionStorage 還原等待室
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("duel_wait_id");
      if (saved) { setRoomId(saved); }
    } catch {}
  }, []); // eslint-disable-line

  const myId   = profile?.id || profile?.uid || "guest";
  const myName = profile?.nickname || profile?.name || (isGuest ? "訪客" : "射手");

  // 訂閱等待室
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeDuelRoom(roomId, r => {
      if (!r || r.status === "closed") {
        toast("房間已關閉", "error");
        setPhase("menu"); setRoomId(null); setRoom(null);
        try { sessionStorage.removeItem("duel_wait_id"); } catch {}
        return;
      }
      setRoom(r);
      if (r.status === "waiting") {
        setPhase("waiting");
        setIsHost(r.hostId === myId);
      }
      if (r.status === "active") {
        try { sessionStorage.removeItem("duel_wait_id"); } catch {}
        const team = Object.keys(r.teamA || {}).includes(myId) ? "A" : "B";
        onEnterRoom(roomId, team, r.hostId === myId);
      }
    });
    return unsub;
  }, [roomId]); // eslint-disable-line

  // 心跳（等待室每 30 秒更新 lastSeen）
  useEffect(() => {
    if (phase !== "waiting" || !roomId || !myId) return;
    updateDuelHeartbeat(roomId, myId).catch(() => {});
    const t = setInterval(() => updateDuelHeartbeat(roomId, myId).catch(() => {}), 30000);
    return () => clearInterval(t);
  }, [phase, roomId, myId]); // eslint-disable-line

  // 自動踢除 5 分鐘未心跳的玩家（host 每分鐘檢查）
  useEffect(() => {
    if (phase !== "waiting" || !isHost || !roomId || !room) return;
    const t = setInterval(() => {
      const now = Date.now();
      const lastSeen = room.lastSeen || {};
      const all = [
        ...Object.keys(room.teamA || {}).map(id => ["A", id]),
        ...Object.keys(room.teamB || {}).map(id => ["B", id]),
      ];
      for (const [team, id] of all) {
        if (id === myId) continue;
        if (now - (lastSeen[id] || 0) > 5 * 60 * 1000) {
          removePlayerFromRoom(roomId, team, id).catch(() => {});
        }
      }
    }, 60000);
    return () => clearInterval(t);
  }, [phase, isHost, roomId, room]); // eslint-disable-line

  async function handleCreate() {
    setLoading(true);
    const teamForCreate = type === "uneven" ? "A" : myTeam;
    const stats = quickStats(profile, isGuest);
    const res = await createDuelRoom(myId, myName, type, teamForCreate, stats, isGuest);
    setLoading(false);
    if (!res.ok) { toast("建立失敗：" + res.reason, "error"); return; }
    try { sessionStorage.setItem("duel_wait_id", res.roomId); } catch {}
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
    if (res.roomType === "uneven") toast("⚡ 不對等模式：已自動分配至 B 隊");
    try { sessionStorage.setItem("duel_wait_id", res.roomId); } catch {}
    setRoomId(res.roomId);
    setIsHost(false);
    setPhase("waiting");
  }

  async function handleStart() {
    if (!room) return;
    const aCount = Object.keys(room.teamA || {}).length;
    const bCount = Object.keys(room.teamB || {}).length;
    if (aCount === 0 || bCount === 0) { toast("兩隊都需至少一名玩家"); return; }
    if (room.type === "uneven") await scaleUnevenHost(roomId, room);
    await startDuelBattle(roomId);
  }

  async function handleSkip(team, memberId) {
    await skipDisconnected(roomId, team, memberId);
  }

  async function handleShuffle() {
    if (!room || !isHost) return;
    await shuffleDuelTeams(roomId, room);
    toast("🎲 隊伍已隨機重新分配");
  }

  function handleLeaveWait() {
    try { sessionStorage.removeItem("duel_wait_id"); } catch {}
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
    const maxPerTeam = { "1v1":1, "2v2":2, "3v3":3, "4v4":4, "uneven":8 }[room.type] || 4;
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

          {/* 不對等模式說明 */}
          {room.type === "uneven" && (
            <div className="rounded-xl bg-amber-900/20 border border-amber-500/30 p-2.5 text-amber-300 text-xs text-center">
              ⚡ 不對等模式・對手 {teamBEntries.length} 人・房主數值將在開始時自動強化
            </div>
          )}

          {/* 按鈕 */}
          {isHost ? (
            <>
              {/* AI 機器人 */}
              <div className="rounded-xl bg-slate-800/60 border border-slate-600/50 p-3 flex flex-col gap-2">
                <div className="text-xs font-black text-slate-400 tracking-widest">🤖 加入AI機器人</div>
                {["A","B"].map(team => {
                  const teamEntries = team === "A" ? teamAEntries : teamBEntries;
                  const isFull = teamEntries.length >= maxPerTeam;
                  const isUnevenA = room.type === "uneven" && team === "A";
                  if (isUnevenA) return null; // 不對等模式 A 隊是房主，不加機器人
                  return (
                    <div key={team} className="flex gap-1.5 items-center">
                      <span className={`text-xs font-black w-10 ${team === "A" ? "text-blue-300" : "text-red-300"}`}>
                        {team}隊 {teamEntries.length}/{maxPerTeam}
                      </span>
                      {Object.entries(DUEL_BOT_STATS).map(([diff, s]) => (
                        <button key={diff} onClick={async () => {
                          const id = makeBotId();
                          const rnd = v => Math.round(v * (0.75 + Math.random() * 0.5));
                          const rs = { ...s, hp: rnd(s.hp), atk: rnd(s.atk), def: rnd(s.def) };
                          await addBotToDuelRoom(roomId, team, id, randomBotName(diff), diff, rs);
                        }}
                          disabled={isFull}
                          className="flex-1 py-1 text-[11px] font-black rounded-lg bg-slate-700 text-slate-200 border border-slate-600 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed">
                          {s.label}
                        </button>
                      ))}
                    </div>
                  );
                })}
                {([...teamAEntries, ...teamBEntries].some(([, m]) => m.isBot)) && (
                  <button onClick={async () => {
                    for (const [id] of teamAEntries.filter(([, m]) => m.isBot))
                      await removeBotFromDuelRoom(roomId, "A", id);
                    for (const [id] of teamBEntries.filter(([, m]) => m.isBot))
                      await removeBotFromDuelRoom(roomId, "B", id);
                  }}
                    className="text-xs text-red-400 text-center py-0.5 active:opacity-70">
                    🗑️ 移除全部機器人
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {room.type !== "uneven" && (
                  <button onClick={handleShuffle}
                    className="flex-1 py-2.5 rounded-xl font-black text-sm border border-slate-500/50 bg-slate-800/60 text-slate-300 active:scale-95 transition-all">
                    🎲 隨機分隊
                  </button>
                )}
                <Btn v="primary" className="flex-1" onClick={handleStart}>
                  ⚔️ 開始決鬥
                </Btn>
              </div>
              <button onClick={async () => { await closeDuelRoom(roomId); handleLeaveWait(); }}
                className="w-full py-2 rounded-xl font-black text-sm border border-red-800/40 text-red-400 bg-red-900/20 active:scale-95 transition-all">
                🚪 關閉房間
              </button>
            </>
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

        {type !== "uneven" ? (
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
        ) : (
          <div className="rounded-xl bg-amber-900/20 border border-amber-500/30 p-3 text-amber-300 text-sm text-center font-bold">
            ⚡ 不對等模式：你是 Boss（隊伍 A）<br/>
            <span className="text-xs font-normal opacity-80">對手越多，你的 HP／ATK／DEF 越強！</span>
          </div>
        )}

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
              ["🏆", myStats?.wins  ?? 0, "勝"],
              ["💀", myStats?.losses ?? 0, "敗"],
              ["🤝", myStats?.draws  ?? 0, "平"],
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

        <Btn v="ghost" className="w-full" onClick={onBack}>← 返回首頁</Btn>
      </div>
    </div>
  );
}
