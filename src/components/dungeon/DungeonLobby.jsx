// src/components/dungeon/DungeonLobby.jsx — 地下城等待室
import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { createDungeonRoom, joinDungeonRoom, subscribeDungeonRoom, updateDungeonMemberStats, startDungeonFloor } from "../../lib/dungeonDb";
import { DUNGEON_LENGTHS } from "../../lib/dungeonData";
import { calcArcherStats, MONSTERS } from "../../lib/monsterData";
import { calcEquippedBonus } from "../../lib/monsterCards"; // [] 傳入，卡牌 collection 未訂閱故忽略

const MODES = [
  { id:"novice",  label:"新手",   icon:"🌱", desc:"HP×1.5，適合初學者"  },
  { id:"student", label:"學員",   icon:"⚔️", desc:"HP×2，標準難度"      },
  { id:"veteran", label:"老手",   icon:"🔥", desc:"HP×4，ATK/DEF 翻倍" },
];

function pickRandomMonsters(floor) {
  const pool = MONSTERS.filter(m => m.tier <= Math.ceil(floor / 2));
  if (!pool.length) return MONSTERS[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function DungeonLobby({ onEnterRoom, onBack }) {
  const { profile } = useAuth();
  const [tab, setTab]       = useState("create");
  const [joinCode, setJoinCode] = useState("");
  const [selLength, setSelLength] = useState("standard");
  const [selMode,   setSelMode]   = useState("student");
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  // waiting room state
  const [roomId, setRoomId]   = useState(null);
  const [room,   setRoom]     = useState(null);
  const [isHost, setIsHost]   = useState(false);
  const [unsub,  setUnsub]    = useState(null);

  const myId   = profile?.id;
  const myName = profile?.nickname || profile?.name || "射手";
  const _base    = calcArcherStats({ member: profile, certification: null, certRecords: [], dexStats: null });
  const _equip   = calcEquippedBonus([]);
  const myHP     = (_base.hp  || 0) + (_equip.hp  || 0);
  const myMaxHP  = myHP;
  const myATK    = (_base.atk || 0) + (_equip.atk || 0);
  const myDEF    = (_base.def || 0) + (_equip.def || 0);

  async function handleCreate() {
    setLoading(true); setErr("");
    const res = await createDungeonRoom(myId, myName);
    if (!res.ok) { setErr(res.reason); setLoading(false); return; }
    await updateDungeonMemberStats(res.roomId, myId, myHP, myMaxHP, myATK, myDEF);
    const sub = subscribeDungeonRoom(res.roomId, r => setRoom(r));
    setUnsub(() => sub);
    setRoomId(res.roomId);
    setIsHost(true);
    setLoading(false);
  }

  async function handleJoin() {
    if (joinCode.trim().length < 6) { setErr("請輸入 6 碼邀請碼"); return; }
    setLoading(true); setErr("");
    const res = await joinDungeonRoom(joinCode.trim(), myId, myName);
    if (!res.ok) { setErr(res.reason); setLoading(false); return; }
    await updateDungeonMemberStats(res.roomId, myId, myHP, myMaxHP, myATK, myDEF);
    const sub = subscribeDungeonRoom(res.roomId, r => {
      setRoom(r);
      if (r?.status === "active") {
        sub();
        onEnterRoom(res.roomId);
      }
    });
    setUnsub(() => sub);
    setRoomId(res.roomId);
    setIsHost(false);
    setLoading(false);
  }

  async function handleStart() {
    if (!room) return;
    const lengthDef = DUNGEON_LENGTHS[selLength];
    const firstMonster = pickRandomMonsters(1);
    setLoading(true);
    await startDungeonFloor(roomId, room, firstMonster, selMode, selLength, lengthDef.totalFloors);
    setLoading(false);
    if (unsub) unsub();
    onEnterRoom(roomId);
  }

  // ── 等待室畫面 ────────────────────────────────────────────
  if (roomId && room) {
    const members = Object.values(room.members || {});
    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        {/* Header */}
        <div className="shrink-0 text-center py-5 border-b border-white/10">
          <div className="text-3xl mb-1">🏰</div>
          <div className="text-xl font-black">地下城等待室</div>
          <div className="text-sm text-slate-400 mt-0.5">邀請碼：<span className="font-mono font-bold text-amber-400">{room.code}</span></div>
        </div>

        {/* Members list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
              <span className="text-2xl">🧙</span>
              <div>
                <div className="font-bold">{m.name}</div>
                <div className="text-xs text-slate-400">HP {m.maxHP} / ATK {m.atk} / DEF {m.def}</div>
              </div>
              {i === 0 && <span className="ml-auto text-xs bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full">房主</span>}
            </div>
          ))}

          {isHost && (
            <div className="mt-4 space-y-4">
              {/* 長度選擇 */}
              <div>
                <div className="text-sm text-slate-400 mb-2 font-semibold">地下城長度</div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(DUNGEON_LENGTHS).map(([k, v]) => (
                    <button key={k} onClick={() => setSelLength(k)}
                      className={`py-2 rounded-xl text-sm font-bold border transition-all ${selLength===k ? "border-amber-400 bg-amber-400/20 text-amber-300" : "border-white/10 bg-white/5 text-slate-300"}`}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 難度選擇 */}
              <div>
                <div className="text-sm text-slate-400 mb-2 font-semibold">難度</div>
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map(md => (
                    <button key={md.id} onClick={() => setSelMode(md.id)}
                      className={`py-2 rounded-xl text-sm font-bold border transition-all ${selMode===md.id ? "border-rose-400 bg-rose-400/20 text-rose-300" : "border-white/10 bg-white/5 text-slate-300"}`}>
                      {md.icon} {md.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 pb-6 pt-3 border-t border-white/10 space-y-2">
          {isHost && (
            <button onClick={handleStart} disabled={loading || members.length < 1}
              className="w-full py-3 rounded-2xl font-black text-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg disabled:opacity-40">
              {loading ? "準備中…" : `🏰 開始地下城（${members.length}人）`}
            </button>
          )}
          {!isHost && (
            <div className="text-center text-slate-400 text-sm py-2">等待房主開始…</div>
          )}
          <button onClick={() => { if (unsub) unsub(); setRoomId(null); setRoom(null); }}
            className="w-full py-2 rounded-xl text-slate-400 text-sm">離開等待室</button>
        </div>
      </div>
    );
  }

  // ── 建立 / 加入畫面 ───────────────────────────────────────
  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="shrink-0 text-center py-8 relative">
        {onBack && (
          <button onClick={onBack} className="absolute left-4 top-6 text-slate-400 text-sm font-bold hover:text-white">← 返回</button>
        )}
        <div className="text-5xl mb-2">🏰</div>
        <div className="text-2xl font-black">地下城模式</div>
        <div className="text-sm text-slate-400 mt-1">攜帶不同任務，與夥伴深入地下城</div>
      </div>

      {/* Tab */}
      <div className="shrink-0 flex bg-slate-700/50 rounded-2xl p-1 mx-4 mb-4">
        {["create","join"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab===t ? "bg-white/15 text-white" : "text-slate-400"}`}>
            {t==="create" ? "🏰 建立" : "🔗 加入"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {tab === "create" ? (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-4">
              <div className="font-bold text-amber-300 mb-1">🎯 地下城特色</div>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• 每位射手獲得不同任務合約</li>
                <li>• 通關後選擇 A / B 路線繼續</li>
                <li>• 商店補給、隨機事件</li>
                <li>• 金幣掉落 ×2</li>
              </ul>
            </div>
            {profile?.dungeonUsed && (
              <div className="bg-rose-500/10 border border-rose-400/30 rounded-2xl p-3 text-sm text-rose-300 text-center">
                🔒 本期地下城次數已使用，等待教練重置後才能再次建立
              </div>
            )}
            <button onClick={handleCreate} disabled={loading || !!profile?.dungeonUsed}
              className="w-full py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg disabled:opacity-40">
              {loading ? "建立中…" : "🏰 建立地下城"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="輸入 6 碼邀請碼"
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white text-center text-xl font-mono tracking-widest placeholder:text-slate-500 uppercase"
              maxLength={6}
            />
            <button onClick={handleJoin} disabled={loading}
              className="w-full py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg disabled:opacity-40">
              {loading ? "加入中…" : "🔗 加入地下城"}
            </button>
          </div>
        )}
        {err && <div className="mt-3 text-center text-rose-400 text-sm">{err}</div>}
      </div>
    </div>
  );
}
