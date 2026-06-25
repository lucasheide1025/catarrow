// src/components/dungeon/DungeonLobby.jsx — 地下城等待室
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { createDungeonRoom, joinDungeonRoom, subscribeDungeonRoom, subscribeOpenDungeonRooms, cleanupStaleDungeonRooms, updateDungeonMemberStats, startDungeonFloor } from "../../lib/dungeonDb";
import { subscribePracticeLogs, subscribeCardCollection } from "../../lib/db";
import BattleRecords from "../member/BattleRecords";
import { DUNGEON_LENGTHS } from "../../lib/dungeonData";
import { calcArcherStats, MONSTERS } from "../../lib/monsterData";
import { calcEquippedBonus } from "../../lib/monsterCards";
import { archerLevelFromXP, archerLevelBonus } from "../../lib/archerLevel";
import { getCatStatMult, getBondLevel } from "../../lib/catData";

const MODES = [
  { id:"novice",  label:"新手",   icon:"🌱", desc:"HP×1.5，適合初學者"  },
  { id:"student", label:"學員",   icon:"⚔️", desc:"HP×2，標準難度"      },
  { id:"veteran", label:"老手",   icon:"🔥", desc:"HP×4，ATK/DEF 翻倍" },
];

function pickRandomMonsters(floor, hostAtk = 10) {
  // 房主 ATK 每 20 點拉高一個 tier（最高 tier 4）
  const tierBoost = Math.floor(hostAtk / 20);
  const maxTier   = Math.min(4, Math.ceil(floor / 2) + tierBoost);
  const pool = MONSTERS.filter(m => m.tier <= maxTier);
  if (!pool.length) return MONSTERS[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function DungeonLobby({ onEnterRoom, onBack }) {
  const { profile } = useAuth();
  const [tab, setTab]           = useState("create");
  const [selLength, setSelLength] = useState("standard");
  const [selMode,   setSelMode]   = useState("student");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");
  const [openRooms, setOpenRooms] = useState([]);
  // waiting room state
  const [roomId, setRoomId]     = useState(null);
  const [room,   setRoom]       = useState(null);
  const [isHost, setIsHost]     = useState(false);
  const [unsub,  setUnsub]      = useState(null);
  const [dungeonLogs, setDungeonLogs] = useState([]);

  const myId   = profile?.id;
  const myName = profile?.nickname || profile?.name || "射手";
  const [cardColl, setCardColl] = useState({ cards: {}, equipped: [] });
  useEffect(() => {
    if (!myId) return;
    const unsubLogs = subscribePracticeLogs(myId, logs =>
      setDungeonLogs(logs.filter(l => l.source === "dungeon"))
    );
    const unsubCards = subscribeCardCollection(myId, setCardColl);
    return () => { unsubLogs?.(); unsubCards?.(); };
  }, [myId]);

  useEffect(() => {
    if (tab !== "join") return;
    cleanupStaleDungeonRooms();
    const unsub = subscribeOpenDungeonRooms(setOpenRooms);
    return () => { unsub?.(); setOpenRooms([]); };
  }, [tab]); // eslint-disable-line

  const _d = new Date();
  const todayStr = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,"0")}-${String(_d.getDate()).padStart(2,"0")}`;
  const dungeonUsedToday = profile?.lastDungeonDate === todayStr;
  const _base    = calcArcherStats({ member: profile, certification: null, certRecords: [], dexStats: null });
  const _equipped = (cardColl.equipped || []).map(id => cardColl.cards?.[id]).filter(Boolean);
  const _equip   = calcEquippedBonus(_equipped);
  const _lvBon   = archerLevelBonus(archerLevelFromXP(profile?.archerXP || 0));
  const myCatId   = profile?.equippedCat?.catId  || null;
  const myCatName = profile?.equippedCat?.name   || "";
  const myCatType = profile?.equippedCat?.type   || "allround";
  const myCatBond = profile?.equippedCat?.bond   || 0;
  const catMult   = myCatId
    ? Math.max(1.1, getCatStatMult(myCatType, getBondLevel(myCatBond)))
    : 1.0;
  const myHP  = Math.round(((_base.hp  || 0) + (_equip.hp  || 0) + _lvBon.hp)  * catMult);
  const myMaxHP = myHP;
  const myATK = Math.round(((_base.atk || 0) + (_equip.atk || 0) + _lvBon.atk) * catMult);
  const myDEF = Math.round(((_base.def || 0) + (_equip.def || 0) + _lvBon.def) * catMult);

  async function handleCreate() {
    setLoading(true); setErr("");
    const res = await createDungeonRoom(myId, myName, myATK);
    if (!res.ok) { setErr(res.reason); setLoading(false); return; }
    await updateDungeonMemberStats(res.roomId, myId, myHP, myMaxHP, myATK, myDEF, myCatName, localStorage.getItem("mb_archer_style") || "baobao");
    const sub = subscribeDungeonRoom(res.roomId, r => setRoom(r));
    setUnsub(() => sub);
    setRoomId(res.roomId);
    setIsHost(true);
    setLoading(false);
  }

  async function handleJoinRoom(openRoom) {
    if (loading) return;
    setLoading(true); setErr("");
    const res = await joinDungeonRoom(openRoom.code, myId, myName);
    if (!res.ok) { setErr(res.reason); setLoading(false); return; }
    await updateDungeonMemberStats(res.roomId, myId, myHP, myMaxHP, myATK, myDEF, myCatName, localStorage.getItem("mb_archer_style") || "baobao");
    const sub = subscribeDungeonRoom(res.roomId, r => {
      setRoom(r);
      if (r?.status === "active") { sub(); onEnterRoom(res.roomId); }
    });
    setUnsub(() => sub);
    setRoomId(res.roomId);
    setIsHost(false);
    setLoading(false);
  }

  async function handleStart() {
    if (!room) return;
    const lengthDef = DUNGEON_LENGTHS[selLength];
    const firstMonster = pickRandomMonsters(1, myATK);
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
      <div className="h-[100dvh] overflow-hidden flex flex-col text-white" style={{ backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"center" }}>
        {/* Header */}
        <div className="shrink-0 text-center py-5 border-b border-white/10">
          <div className="text-3xl mb-1">🏰</div>
          <div className="text-xl font-black">地下城等待室</div>
          <div className="text-sm text-slate-400 mt-0.5">等待夥伴從大廳加入…</div>
        </div>

        {/* Members list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
              <span className="text-2xl">🧙</span>
              <div>
                <div className="font-bold">{m.name}</div>
                <div className="text-xs text-slate-400">HP {m.maxHP} / ATK {m.atk} / DEF {m.def}</div>
                {m.catName && <div className="text-xs text-indigo-300 mt-0.5">🐱 {m.catName} 神教光環 +10%</div>}
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
    <div className="h-[100dvh] overflow-hidden flex flex-col text-white" style={{ backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"center" }}>
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
            {t==="create" ? "🏰 建立" : "🏹 加入"}
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
            {dungeonUsedToday && (
              <div className="bg-rose-500/10 border border-rose-400/30 rounded-2xl p-3 text-sm text-rose-300 text-center">
                🔒 今日地下城次數已使用，明天再來挑戰吧！
              </div>
            )}
            <button onClick={handleCreate} disabled={loading || !!dungeonUsedToday}
              className="w-full py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg disabled:opacity-40">
              {loading ? "建立中…" : "🏰 建立地下城"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {openRooms.length === 0 ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
                <div className="text-3xl mb-2 animate-pulse">🔍</div>
                <div className="text-slate-400 text-sm">目前沒有開放中的地下城</div>
                <div className="text-slate-600 text-xs mt-1">等待夥伴建立後自動更新</div>
              </div>
            ) : openRooms.map(r => {
              const memberCount = Object.keys(r.members || {}).length;
              const hostName = Object.values(r.members || {})[0]?.name || "未知";
              return (
                <div key={r.id} className="rounded-2xl border border-amber-500/30 bg-amber-900/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏰</span>
                      <div>
                        <div className="text-white font-black text-sm">地下城探索</div>
                        <div className="text-slate-400 text-xs mt-0.5">
                          🧙 {hostName} 的隊伍・{memberCount} 人等待中
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinRoom(r)}
                      disabled={loading}
                      className="px-5 py-2 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-40 active:scale-95 transition-all"
                    >
                      {loading ? "…" : "加入"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {err && <div className="mt-3 text-center text-rose-400 text-sm">{err}</div>}

        {/* 地下城歷史紀錄 */}
        <div className="mt-6">
          <BattleRecords logs={dungeonLogs} title="📊 地下城戰鬥紀錄" maxGroups={6}/>
        </div>
      </div>
    </div>
  );
}
