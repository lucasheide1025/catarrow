// src/components/duel/DuelLobby.jsx — 決鬥大廳（建房/加入/等待室）— 決鬥 2.0 翻修
import { useState, useEffect, useRef } from "react";
import { Card, Btn, Inp, ST, useToast } from "../shared/UI";
import { calcArcherStats } from "../../lib/monsterData";
import {
  createDuelRoom, joinDuelRoom, subscribeDuelRoom, subscribeOpenDuelRooms, cleanupStaleDuelRooms,
  startDuelBattle, skipDisconnected, shuffleDuelTeams, balanceDuelStats, getDuelStats,
  updateDuelHeartbeat, DUEL_HEARTBEAT_MS, closeDuelRoom, removePlayerFromRoom, scaleUnevenHost,
  addBotToDuelRoom, removeBotFromDuelRoom,
} from "../../lib/duelDb";
import { buildDuelLoadout } from "../../lib/duelLoadout";
import { summarizeDuelLoadout } from "../../lib/duelCombat";
import { DUEL_BOT_STATS, makeBotId, randomBotName } from "../../lib/botUtils";
import { TargetFmtPicker, InputModePicker, getBattleTargetFmt, setBattleTargetFmt, getBattleInputMode, setBattleInputMode } from "../shared/TargetFaceOverlay";

const TYPE_OPTIONS = [
  { value:"1v1",   label:"⚔️ 1v1",       desc:"單挑，決一勝負",   color:"#d97706" },
  { value:"2v2",   label:"🛡 2v2",        desc:"雙打團隊賽",       color:"#0284c7" },
  { value:"3v3",   label:"🏹 3v3",        desc:"三對三混戰",       color:"#7c3aed" },
  { value:"4v4",   label:"💥 4v4",        desc:"四對四大型團隊賽", color:"#dc2626" },
  { value:"uneven",label:"⚡ 不對等",      desc:"1對多、多對多，自由配對", color:"#ca8a04" },
];

// ── 負載徽章（卡片/專精）──────────────────────────────────
function LoadoutChips({ loadout, max = 4 }) {
  const rows = summarizeDuelLoadout(loadout);
  if (!rows.length) return null;
  const shown = rows.slice(0, max);
  const rest = rows.length - shown.length;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((r, i) => (
        <span key={i} className="rounded-full px-2 py-[1px] text-[9px] font-black"
          style={{ background:"rgba(217,119,6,.14)", color:"#92400e", border:"1px solid rgba(217,119,6,.3)" }}>
          {r.icon} {r.label}
        </span>
      ))}
      {rest > 0 && (
        <span className="rounded-full px-2 py-[1px] text-[9px] font-black" style={{ background:"rgba(255,255,255,.08)", color:"#a78bfa" }}>
          +{rest}
        </span>
      )}
    </span>
  );
}

function quickStats(profile, isGuest) {
  if (isGuest || !profile) return { hp: 200, atk: 20, def: 10 };
  const raw = calcArcherStats({
    member: profile,
    certification: null,
    certRecords: profile.certRecords || [],
    dexStats: null,
  });
  // 決鬥直接帶入玩家本身的 HP / ATK / DEF（balanceDuelStats 不再壓縮）
  const real = balanceDuelStats(raw);
  const catName     = profile?.equippedCat?.name  || "";
  const archerStyle = profile?.equippedCat?.catId || "baobao";
  return {
    hp:  real.hp,
    atk: real.atk,
    def: real.def,
    catName,
    archerStyle,
  };
}

// 黑紫競技場主題（與 DuelIntro 進場動畫一致）
const ARENA_BG = {
  background:"linear-gradient(180deg,#05010f 0%,#0b0120 55%,#05010f 100%)",
};
const ARENA_CSS = `
@keyframes arena-shine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
@keyframes arena-glow{0%,100%{filter:drop-shadow(0 0 3px rgba(251,191,36,.5))}50%{filter:drop-shadow(0 0 10px rgba(253,224,71,.95))}}
@keyframes arena-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
`;
const arenaTitleStyle = {
  fontWeight:900,
  backgroundImage:"linear-gradient(100deg,#fbbf24 0%,#fff7cc 25%,#fde047 50%,#fff7cc 75%,#fbbf24 100%)",
  backgroundSize:"200% 100%",
  WebkitBackgroundClip:"text", backgroundClip:"text", color:"transparent",
  animation:"arena-shine 2.6s linear infinite, arena-glow 1.8s ease-in-out infinite",
};
function ArenaHeader({ icon, title, sub }) {
  return (
    <div className="rounded-2xl p-5 text-center relative overflow-hidden"
      style={{ background:"linear-gradient(135deg,#1a0838,#3b0f63)", border:"1px solid rgba(167,139,250,.35)", boxShadow:"0 10px 34px rgba(88,28,135,.5)" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background:"radial-gradient(ellipse at 50% -20%, rgba(217,70,239,.35), transparent 70%)" }} />
      <div className="relative text-5xl mb-1 drop-shadow" style={{ animation:"arena-pulse 2.4s ease-in-out infinite" }}>{icon}</div>
      <div className="relative text-2xl tracking-wide" style={arenaTitleStyle}>{title}</div>
      {sub && <div className="relative text-xs mt-1.5 text-purple-200/70 font-medium">{sub}</div>}
    </div>
  );
}
function ArenaCard({ children, glow = "rgba(167,139,250,.12)" }) {
  return (
    <div className="rounded-2xl p-3"
      style={{ background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.12)", boxShadow:`0 4px 16px ${glow}` }}>
      {children}
    </div>
  );
}
const PAGE_BG = ARENA_BG;

export default function DuelLobby({ profile, onEnterRoom, onBack, isGuest }) {
  const { toast, ToastContainer } = useToast();
  const [phase, setPhase]       = useState("menu");   // menu|create|join|waiting
  const [type, setType]         = useState("1v1");
  const [myTeam, setMyTeam]     = useState("A");
  const [room, setRoom]         = useState(null);
  const [roomId, setRoomId]     = useState(null);
  const [isHost, setIsHost]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [myStats, setMyStats]   = useState(null);
  const [openRooms, setOpenRooms] = useState([]);
  const [myLoadout, setMyLoadout] = useState({ mods: null, loadout: null });
  // 計分設定（靶紙＋輸入方式）：在大廳設定一次，進場後沿用（localStorage 持久化）
  const [battleTargetFmt, setBattleTargetFmtState] = useState(getBattleTargetFmt);
  const [battleInputMode, setBattleInputModeState] = useState(() => getBattleInputMode());

  // 決鬥 2.0：進大廳時快照我的卡片天賦＋裝備專精（建房/加入時寫進房間）
  useEffect(() => {
    if (!profile?.id || isGuest) { setMyLoadout({ mods: null, loadout: null }); return; }
    let cancel = false;
    buildDuelLoadout(profile.id).then(l => { if (!cancel) setMyLoadout(l); }).catch(() => {});
    return () => { cancel = true; };
  }, [profile?.id, isGuest]);

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

  // 用 ref 保持最新 myId，避免 closure stale 問題
  const myIdRef = useRef(myId);
  useEffect(() => { myIdRef.current = myId; }, [myId]);

  // 訂閱等待室
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeDuelRoom(roomId, r => {
      const mid = myIdRef.current;
      if (!r || r.status === "closed") {
        toast("房間已關閉", "error");
        setPhase("menu"); setRoomId(null); setRoom(null);
        try { sessionStorage.removeItem("duel_wait_id"); } catch {}
        return;
      }
      setRoom(r);
      if (r.status === "waiting") {
        setPhase("waiting");
        setIsHost(r.hostId === mid);
      }
      if (r.status === "active") {
        try { sessionStorage.removeItem("duel_wait_id"); } catch {}
        const team = Object.keys(r.teamA || {}).includes(mid) ? "A" : "B";
        onEnterRoom(roomId, team, r.hostId === mid);
      }
    });
    return unsub;
  }, [roomId]); // eslint-disable-line

  // 訂閱開放房間（公開大廳）
  useEffect(() => {
    if (phase !== "join") return;
    cleanupStaleDuelRooms();
    const unsub = subscribeOpenDuelRooms(setOpenRooms);
    return () => { unsub?.(); setOpenRooms([]); };
  }, [phase]); // eslint-disable-line

  // 心跳（等待室每 90 秒更新 lastSeen）
  useEffect(() => {
    if (phase !== "waiting" || !roomId || !myId) return;
    updateDuelHeartbeat(roomId, myIdRef.current).catch(() => {});
    const t = setInterval(() => updateDuelHeartbeat(roomId, myIdRef.current).catch(() => {}), DUEL_HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [phase, roomId, myId]); // eslint-disable-line

  // 自動踢除 5 分鐘未心跳的玩家（host 每分鐘檢查）
  useEffect(() => {
    if (phase !== "waiting" || !isHost || !roomId || !room) return;
    const t = setInterval(() => {
      const mid = myIdRef.current;
      const now = Date.now();
      const lastSeen = room.lastSeen || {};
      const all = [
        ...Object.keys(room.teamA || {}).map(id => ["A", id]),
        ...Object.keys(room.teamB || {}).map(id => ["B", id]),
      ];
      for (const [team, id] of all) {
        if (id === mid) continue;
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
    const res = await createDuelRoom(myId, myName, type, teamForCreate, stats, isGuest, myLoadout);
    setLoading(false);
    if (!res.ok) { toast("建立失敗：" + res.reason, "error"); return; }
    try { sessionStorage.setItem("duel_wait_id", res.roomId); } catch {}
    setRoomId(res.roomId);
    setIsHost(true);
    setPhase("waiting");
  }

  async function handleJoinRoom(openRoom) {
    if (loading) return;
    setLoading(true);
    const stats = quickStats(profile, isGuest);
    const aCount = Object.keys(openRoom.teamA || {}).length;
    const bCount = Object.keys(openRoom.teamB || {}).length;
    const autoTeam = openRoom.type === "uneven" ? "B" : (aCount <= bCount ? "A" : "B");
    const res = await joinDuelRoom(openRoom.code, myId, myName, autoTeam, stats, isGuest, myLoadout);
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
    // Bot 沒有心跳（lastSeen 不存在），不應被誤判為離線
    const isDisc = (id, m) => m?.isBot ? false : (now - (lastSeen[id] || 0)) > 90000;

    const teamAEntries = Object.entries(room.teamA || {});
    const teamBEntries = Object.entries(room.teamB || {});
    const maxPerTeam = { "1v1":1, "2v2":2, "3v3":3, "4v4":4, "uneven":8 }[room.type] || 4;
    const typeLabel = TYPE_OPTIONS.find(t => t.value === room.type)?.label || room.type;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={PAGE_BG}>
        <style>{ARENA_CSS}</style>
        <ToastContainer />
        <div className="w-full max-w-sm flex flex-col gap-4">
          {/* 房間資訊 */}
          <div className="rounded-2xl p-4 text-center relative overflow-hidden"
            style={{ background:"linear-gradient(135deg,#1a0838,#3b0f63)", border:"1px solid rgba(167,139,250,.35)", boxShadow:"0 8px 24px rgba(88,28,135,.4)" }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background:"radial-gradient(ellipse at 50% -20%, rgba(217,70,239,.3), transparent 70%)" }} />
            <div className="relative text-lg font-black tracking-wide" style={arenaTitleStyle}>{typeLabel} 決鬥</div>
            <div className="relative text-xs text-purple-200/70 mt-1">等待對手從大廳加入…　🏹 <span className="font-black text-amber-300">{room.code}</span></div>
          </div>

          {/* 雙隊顯示 */}
          <div className="flex gap-3">
            {[["A", teamAEntries, "#3b82f6"], ["B", teamBEntries, "#ef4444"]].map(([team, entries, color]) => (
              <div key={team} className="flex-1 rounded-2xl p-3 flex flex-col gap-2"
                style={{ background:`${color}12`, border:`1px solid ${color}55`, boxShadow:`0 4px 12px ${color}22` }}>
                <div className="text-xs font-black tracking-widest" style={{ color }}>⚔ 隊伍 {team}</div>
                {entries.length === 0 && <div className="text-slate-500 text-xs text-center py-2">等待中…</div>}
                {entries.map(([id, m]) => (
                  <div key={id} className={`flex flex-col gap-0.5 ${isDisc(id, m) ? "opacity-50" : ""}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{isDisc(id, m) ? "⚠️" : (m.isBot ? "🤖" : "🏹")}</span>
                      <span className="text-slate-100 text-sm font-bold truncate flex-1">{m.name}</span>
                      {m.isBot && <span className="text-[10px] bg-purple-500 text-white px-1.5 rounded-full font-black">AI</span>}
                      {id === myId && <span className="text-[10px] bg-amber-500 text-white px-1.5 rounded-full font-black">你</span>}
                      {isDisc(id, m) && isHost && (
                        <button onClick={() => handleSkip(team, id)}
                          className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold">踢</button>
                      )}
                    </div>
                    <LoadoutChips loadout={m.loadout} max={2} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* 我的配置預覽 */}
          {!isHost && summarizeDuelLoadout(myLoadout.loadout).length > 0 && (
            <div className="rounded-xl p-2.5 text-center" style={{ background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.12)" }}>
              <div className="text-[10px] font-black mb-1 text-purple-300/80">我的決鬥配置</div>
              <LoadoutChips loadout={myLoadout.loadout} max={8} />
            </div>
          )}

          {/* 不對等模式說明 */}
          {room.type === "uneven" && (
            <div className="rounded-xl p-2.5 text-xs text-center" style={{ background:"rgba(202,138,4,.14)", border:"1px solid rgba(250,204,21,.35)", color:"#fde047" }}>
              ⚡ 不對等模式・對手 {teamBEntries.length} 人・房主數值將在開始時自動強化
            </div>
          )}

          {/* 按鈕 */}
          {isHost ? (
            <>
              {/* AI 機器人 */}
              <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.12)" }}>
                <div className="text-xs font-black text-purple-300/80">🤖 加入AI機器人</div>
                {["A","B"].map(team => {
                  const teamEntries = team === "A" ? teamAEntries : teamBEntries;
                  const isFull = teamEntries.length >= maxPerTeam;
                  const isUnevenA = room.type === "uneven" && team === "A";
                  if (isUnevenA) return null; // 不對等模式 A 隊是房主，不加機器人
                  return (
                    <div key={team} className="flex gap-1.5 items-center">
                      <span className={`text-xs font-black w-10 ${team === "A" ? "text-blue-400" : "text-red-400"}`}>
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
                          className="flex-1 py-1 text-[11px] font-black rounded-lg border active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
                          style={{ background:"rgba(255,255,255,.07)", color:"#e9d5ff", borderColor:"rgba(167,139,250,.3)" }}>
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
                    className="flex-1 py-2.5 rounded-xl font-black text-sm border active:scale-95 transition-all"
                    style={{ background:"rgba(255,255,255,.05)", color:"#c4b5fd", borderColor:"rgba(167,139,250,.3)" }}>
                    🎲 隨機分隊
                  </button>
                )}
                <Btn v="primary" className="flex-1" onClick={handleStart}>
                  ⚔️ 開始決鬥
                </Btn>
              </div>
              <button onClick={async () => { await closeDuelRoom(roomId); handleLeaveWait(); }}
                className="w-full py-2 rounded-xl font-black text-sm border active:scale-95 transition-all"
                style={{ background:"rgba(239,68,68,.1)", color:"#f87171", borderColor:"rgba(239,68,68,.35)" }}>
                🚪 關閉房間
              </button>
            </>
          ) : (
            <div className="text-center text-slate-500 text-sm py-2 animate-pulse">等待主持人開始…</div>
          )}
          <Btn v="ghost" className="w-full" onClick={handleLeaveWait}>← 離開房間</Btn>
        </div>
      </div>
    );
  }

  // ── 建立房間 ────────────────────────────────────────────
  if (phase === "create") return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={PAGE_BG}>
      <style>{ARENA_CSS}</style>
      <ToastContainer />
      <div className="w-full max-w-sm flex flex-col gap-4">
        <ArenaHeader icon="⚔️" title="建立決鬥房間" sub="選擇模式與你的隊伍" />

        <ArenaCard>
          <ST>⚔️ 決鬥模式</ST>
          <div className="flex flex-col gap-2 mt-2">
            {TYPE_OPTIONS.map(t => (
              <button key={t.value} onClick={() => setType(t.value)}
                className={`rounded-xl px-3 py-2.5 text-left border transition-all ${type === t.value ? "text-white" : "text-slate-300"}`}
                style={type === t.value
                  ? { background:`linear-gradient(135deg, ${t.color}cc, ${t.color}66)`, borderColor:t.color, boxShadow:`0 4px 14px ${t.color}44` }
                  : { background:"rgba(255,255,255,.05)", borderColor:"rgba(255,255,255,.14)" }}>
                <span className="font-black text-sm">{t.label}</span>
                <span className="ml-2 text-xs opacity-80">{t.desc}</span>
              </button>
            ))}
          </div>
        </ArenaCard>

        {type !== "uneven" ? (
          <ArenaCard>
            <ST>🎽 選擇隊伍</ST>
            <div className="flex gap-3 mt-2">
              {["A","B"].map(t => (
                <button key={t} onClick={() => setMyTeam(t)}
                  className={`flex-1 py-3 rounded-xl font-black text-sm border transition-all ${myTeam === t ? "text-white" : "text-slate-300"}`}
                  style={myTeam === t
                    ? (t==="A" ? { background:"linear-gradient(135deg,#1e40af,#3b82f6)", borderColor:"#60a5fa", boxShadow:"0 4px 14px rgba(59,130,246,.4)" } : { background:"linear-gradient(135deg,#991b1b,#ef4444)", borderColor:"#f87171", boxShadow:"0 4px 14px rgba(239,68,68,.4)" })
                    : { background:"rgba(255,255,255,.05)", borderColor:"rgba(255,255,255,.14)" }}>
                  {t === "A" ? "🔵 隊伍 A" : "🔴 隊伍 B"}
                </button>
              ))}
            </div>
          </ArenaCard>
        ) : (
          <div className="rounded-xl p-3 text-sm text-center font-bold"
            style={{ background:"rgba(202,138,4,.14)", border:"1px solid rgba(250,204,21,.35)", color:"#fde047" }}>
            ⚡ 不對等模式：你是 Boss（隊伍 A）<br/>
            <span className="text-xs font-normal opacity-80 text-yellow-200/80">對手越多，你的 HP／ATK／DEF 越強！</span>
          </div>
        )}

        {/* 我的決鬥配置 */}
        {summarizeDuelLoadout(myLoadout.loadout).length > 0 && (
          <ArenaCard>
            <div className="text-[10px] font-black mb-1.5 text-purple-300/80">🎒 我會帶進決鬥的配置（卡片＋專精）</div>
            <LoadoutChips loadout={myLoadout.loadout} max={8} />
          </ArenaCard>
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
    <div className="min-h-screen flex flex-col p-4 pt-10" style={PAGE_BG}>
      <style>{ARENA_CSS}</style>
      <ToastContainer />
      <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
        <ArenaHeader icon="🏹" title="加入決鬥" sub="選擇一個開放中的房間" />

        {openRooms.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background:"rgba(255,255,255,.05)", border:"1px dashed rgba(255,255,255,.2)" }}>
            <div className="text-4xl mb-3 animate-pulse">🔍</div>
            <div className="text-slate-300 text-sm">目前沒有開放中的房間</div>
            <div className="text-slate-500 text-xs mt-1">請等待隊友建立房間後再刷新</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {openRooms.map(r => {
              const aCount = Object.keys(r.teamA || {}).length;
              const bCount = Object.keys(r.teamB || {}).length;
              const typeLabel = TYPE_OPTIONS.find(t => t.value === r.type)?.label || r.type;
              const maxPer = { "1v1":1, "2v2":2, "3v3":3, "4v4":4, "uneven":8 }[r.type] || 8;
              const isFull = r.type !== "uneven" && aCount >= maxPer && bCount >= maxPer;
              const hostName = (r.teamA?.[r.hostId] || r.teamB?.[r.hostId])?.name || "未知";
              return (
                <div key={r.id} className={`rounded-2xl border p-4 transition-all ${isFull ? "opacity-40" : ""}`}
                  style={{ borderColor: isFull ? "rgba(255,255,255,.14)" : "rgba(167,139,250,.4)", background:"rgba(255,255,255,.06)", boxShadow:"0 4px 14px rgba(88,28,135,.2)" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-black text-base">{typeLabel} 決鬥</div>
                      <div className="text-slate-400 text-xs mt-0.5 mb-1">🧙 {hostName} 的房間</div>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400 text-xs font-bold">🔵 A隊 {aCount}人</span>
                        <span className="text-slate-500 text-xs">vs</span>
                        <span className="text-red-400 text-xs font-bold">🔴 B隊 {bCount}人</span>
                      </div>
                    </div>
                    <button
                      onClick={() => !isFull && handleJoinRoom(r)}
                      disabled={isFull || loading}
                      className="ml-3 px-5 py-2.5 rounded-xl font-black text-sm text-white disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
                      style={{ background:"linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow:"0 4px 12px rgba(168,85,247,.4)" }}
                    >
                      {loading ? "…" : isFull ? "已滿" : "加入"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Btn v="ghost" className="w-full" onClick={() => setPhase("menu")}>← 返回</Btn>
      </div>
    </div>
  );

  // ── 主選單 ──────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={PAGE_BG}>
      <style>{ARENA_CSS}</style>
      <ToastContainer />
      <div className="w-full max-w-sm flex flex-col gap-4">
        <ArenaHeader icon="⚔️" title="決鬥競技場" sub="1v1・組隊・不對等對戰　│　無藥水限制" />

        {/* 我的決鬥紀錄 */}
        {profile && (
          <ArenaCard>
            <div className="flex justify-around py-1">
              {[
                ["🏆", myStats?.wins  ?? 0, "勝"],
                ["💀", myStats?.losses ?? 0, "敗"],
                ["🤝", myStats?.draws  ?? 0, "平"],
              ].map(([icon, val, label]) => (
                <div key={label} className="text-center">
                  <div className="text-xl font-black text-white">{val}</div>
                  <div className="text-[11px] text-slate-400">{icon} {label}</div>
                </div>
              ))}
            </div>
          </ArenaCard>
        )}

        {/* 我的決鬥配置 */}
        {summarizeDuelLoadout(myLoadout.loadout).length > 0 && (
          <ArenaCard>
            <div className="text-[10px] font-black mb-1.5 text-purple-300/80">🎒 我的決鬥配置（卡片＋專精會帶進決鬥）</div>
            <LoadoutChips loadout={myLoadout.loadout} max={8} />
          </ArenaCard>
        )}

        {/* 計分設定：場外一次設定，進場後自動沿用 */}
        <ArenaCard glow="rgba(96,165,250,.15)">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-black text-blue-300/90">🎯 計分設定（一次設定，進場自動沿用）</div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{ background:"rgba(96,165,250,.15)", color:"#93c5fd", border:"1px solid rgba(96,165,250,.3)" }}>
              已儲存
            </span>
          </div>
          <TargetFmtPicker value={battleTargetFmt} onChange={v => { setBattleTargetFmtState(v); setBattleTargetFmt(v); }} />
          <div className="h-3" />
          <InputModePicker value={battleInputMode} onChange={v => { setBattleInputModeState(v); setBattleInputMode(v); }} />
          <div className="mt-2 text-[10px] text-slate-400/70 leading-relaxed">
            靶紙決定計分環數與倍率、輸入方式決定場內怎麼記分（⌨️ 點分數／🎯 點靶面）。設定後所有決鬥皆沿用，不需每場重設。
          </div>
        </ArenaCard>

        <div className="flex flex-col gap-3">
          <button onClick={() => setPhase("create")}
            className="rounded-2xl p-4 text-left transition-all active:scale-95 relative overflow-hidden"
            style={{ background:"linear-gradient(135deg,#1e3a8a,#3b82f6)", boxShadow:"0 6px 20px rgba(59,130,246,.4)" }}>
            <div className="text-white font-black text-base">⚔️ 建立房間</div>
            <div className="text-blue-200 text-xs mt-0.5">設定模式、邀請對手加入</div>
          </button>

          <button onClick={() => setPhase("join")}
            className="rounded-2xl p-4 text-left transition-all active:scale-95 relative overflow-hidden"
            style={{ background:"linear-gradient(135deg,#7f1d1d,#ef4444)", boxShadow:"0 6px 20px rgba(239,68,68,.4)" }}>
            <div className="text-white font-black text-base">🏹 加入房間</div>
            <div className="text-red-200 text-xs mt-0.5">瀏覽開放中的房間，點擊即可加入</div>
          </button>
        </div>

        <Btn v="ghost" className="w-full" onClick={onBack}>← 返回首頁</Btn>
      </div>
    </div>
  );
}
