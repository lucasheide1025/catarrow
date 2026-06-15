// src/components/dungeon/DungeonBattleRoom.jsx — 地下城戰鬥室
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeDungeonRoom, submitDungeonArrows, processDungeonRound,
  forceSkipDungeonPlayer, advanceDungeonFloor, leaveDungeonRoom,
  clearDungeonProcessing, claimDungeonReward,
} from "../../lib/dungeonDb";
import { resolveHitPart, MONSTERS } from "../../lib/monsterData";
import { calcDungeonContractDmg, getContractDesc, CONTRACT_TYPES, DUNGEON_LENGTHS } from "../../lib/dungeonData";
import { recordBattleDex, addCoins, addMaterials } from "../../lib/db";
import { rollCoins, rollMaterialDrop } from "../../lib/lootTable";
import { sfxTap, sfxArrowShoot, sfxCast, sfxCounter, sfxCritBoom, sfxRoundEnd, sfxSuccess, vibrate } from "../../lib/sound";
import DungeonPathSelect from "./DungeonPathSelect";
import DungeonShop from "./DungeonShop";
import DungeonEvent from "./DungeonEvent";

const SCORE_MAP = { X:10, 10:10, 9:9, 8:8, 7:7, 6:6, 5:5, 4:4, 3:3, 2:2, 1:1, M:0 };
const SCORE_LABELS = ["X","10","9","8","7","6","5","4","3","2","1","M"];
const SCORE_COLORS = {
  X:"bg-yellow-400 text-yellow-900", 10:"bg-yellow-300 text-yellow-900",
  9:"bg-red-400 text-white", 8:"bg-red-300 text-white",
  7:"bg-blue-400 text-white", 6:"bg-blue-300 text-white",
  5:"bg-gray-500 text-white", 4:"bg-gray-400 text-white",
  3:"bg-gray-300 text-gray-800", 2:"bg-gray-200 text-gray-700",
  1:"bg-gray-100 text-gray-600", M:"bg-black/30 text-gray-300",
};

function calcContractDmgFn(arrows, atk, monsterDef, contract, dmgMult = 1) {
  return calcDungeonContractDmg(arrows, atk, monsterDef, contract, resolveHitPart, dmgMult);
}

function calcCtrFn(monsterAtk, archerDef) {
  const base = 4 + monsterAtk * 0.6 - archerDef * 0.3;
  const m    = 0.8 + Math.random() * 0.4;
  return Math.max(1, Math.round(base * m));
}

function HPBar({ current, max, color = "bg-emerald-500" }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) * 100 : 0;
  return (
    <div className="h-2 w-full rounded-full bg-white/15 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width:`${pct}%` }} />
    </div>
  );
}

function ContractBadge({ contract }) {
  if (!contract) return null;
  const info = CONTRACT_TYPES[contract.type];
  if (!info) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-white/10 ${info.bg} ${info.color} font-semibold`}>
      {info.icon} {info.name}
      {contract.param != null && <span>({contract.param})</span>}
    </span>
  );
}

export default function DungeonBattleRoom({ roomId, onExit }) {
  const { profile } = useAuth();
  const myId = profile?.id;

  const [room,     setRoom]     = useState(null);
  const [arrows,   setArrows]   = useState([]);
  const [submitted,setSubmitted]= useState(false);
  const [loading,  setLoading]  = useState(false);
  const [liveMsg,  setLiveMsg]  = useState(null);
  const [shopDone, setShopDone] = useState(false);
  const logEndRef = useRef(null);

  const isHost = room?.hostId === myId;
  const me     = room?.members?.[myId] || {};
  const status = room?.status;

  // 訂閱
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeDungeonRoom(roomId, r => {
      setRoom(r);
      if (r && r.status === "active" && r.round !== undefined) {
        setSubmitted(false);
        setArrows([]);
      }
    });
    return () => unsub();
  }, [roomId]);

  // 日誌捲到底
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [room?.log]);

  // 所有人都 ready → 房主結算
  useEffect(() => {
    if (!isHost || !room || room.processing) return;
    if (room.status !== "active") return;
    const members = room.members || {};
    const alive   = Object.values(members).filter(m => m.alive);
    if (alive.length === 0) return;
    const allReady = alive.every(m => m.ready);
    if (!allReady) return;
    handleProcess();
  }, [room]);

  // 進入下一層（房主切換）
  useEffect(() => {
    if (!isHost || !room) return;
    if (room.status !== "floor_transition") return;
    handleNextFloor();
  }, [room?.status]);

  async function handleProcess() {
    if (loading) return;
    setLoading(true);
    sfxCast();
    await processDungeonRound(roomId, room, calcContractDmgFn, calcCtrFn);
    sfxRoundEnd();
    setLoading(false);
  }

  async function handleSubmit() {
    if (arrows.length < 6) return;
    sfxArrowShoot();
    vibrate([10,10,10]);
    setSubmitted(true);
    await submitDungeonArrows(roomId, myId, arrows);
  }

  function addArrow(label) {
    if (arrows.length >= 6) return;
    sfxTap();
    setArrows(prev => [...prev, { label, score: SCORE_MAP[label] ?? 0 }]);
  }

  function undoArrow() {
    setArrows(prev => prev.slice(0, -1));
    if (submitted) setSubmitted(false);
  }

  async function handleNextFloor() {
    if (!isHost || !room) return;
    const nextFloor   = (room.currentFloor || 0) + 1;
    const allMonsters = MONSTERS.filter(m => m.tier <= Math.ceil(nextFloor / 2));
    const pool        = allMonsters.length ? allMonsters : MONSTERS;
    const nextMonster = pool[Math.floor(Math.random() * pool.length)];
    setLoading(true);
    await advanceDungeonFloor(roomId, room, nextMonster);
    setLoading(false);
  }

  async function handleClaim() {
    if (!isHost) return;
    const lastLog = (room?.log || []).at(-1);
    const baseMaterials = rollMaterialDrop(room?.monster?.tier || 1);
    const goldMult = room?.nextFloorModifiers?.goldMult || 1;

    for (const mid of Object.keys(room.members || {})) {
      if (mid.startsWith("guest")) continue;
      const baseCoins = rollCoins(room?.monster?.tier || 1, 1);
      await claimDungeonReward(mid, baseCoins, goldMult);
      if (baseMaterials?.length) await addMaterials(mid, baseMaterials).catch(() => {});
      await recordBattleDex(mid, room.monster.id).catch(() => {});
    }
    sfxSuccess();
    onExit?.();
  }

  // ── 路線選擇 ───────────────────────────────────────────────
  if (status === "path_select") {
    return <DungeonPathSelect roomId={roomId} room={room} isHost={isHost} />;
  }

  // ── 商店 ───────────────────────────────────────────────────
  if (status === "shop") {
    return (
      <DungeonShop
        roomId={roomId} room={room}
        memberId={myId} memberData={{ ...me, coins: profile?.score || 0 }}
        isHost={isHost}
        onDone={() => {
          setShopDone(true);
          if (isHost) {
            import("../../lib/dungeonDb").then(({ clearDungeonProcessing }) =>
              import("firebase/firestore").then(({ updateDoc, doc }) =>
                import("../../lib/firebase").then(({ db }) =>
                  updateDoc(doc(db, "dungeonRooms", roomId), { status:"floor_transition" })
                )
              )
            );
          }
        }}
      />
    );
  }

  // ── 事件 ───────────────────────────────────────────────────
  if (status === "event") {
    return <DungeonEvent roomId={roomId} room={room} isHost={isHost} />;
  }

  // ── 完成畫面 ───────────────────────────────────────────────
  if (status === "completed") {
    const won = room?.result === "win";
    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white items-center justify-center px-6 text-center gap-6">
        <div className="text-7xl">{won ? "🏆" : "💀"}</div>
        <div className="text-3xl font-black">{won ? "地下城攻略完成！" : "全員陣亡"}</div>
        <div className="text-slate-400 text-sm">
          {won ? `恭喜通關全 ${room.totalFloors} 層，金幣收益 ×2！` : "下次再挑戰"}
        </div>
        {isHost && won && (
          <button onClick={handleClaim}
            className="px-8 py-3 rounded-2xl font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white text-lg shadow-lg">
            💰 領取獎勵
          </button>
        )}
        <button onClick={onExit}
          className="px-6 py-2 rounded-xl bg-white/10 text-slate-300 text-sm">
          返回大廳
        </button>
      </div>
    );
  }

  if (!room || status === "waiting") {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-900 text-slate-400">
        等待房間資料…
      </div>
    );
  }

  // ── 戰鬥主畫面 ─────────────────────────────────────────────
  const members     = room.members || {};
  const aliveIds    = Object.keys(members).filter(id => members[id].alive);
  const allReady    = aliveIds.every(id => members[id].ready);
  const isDead      = me.alive === false;
  const monster     = room.monster || {};
  const monsterHPPct = room.monsterMaxHP > 0
    ? Math.max(0, (room.monsterHP / room.monsterMaxHP) * 100) : 0;
  const lastLog     = (room.log || []).at(-1);
  const myContract  = me.contract || { type:"standard", param:null };
  const contractInfo= CONTRACT_TYPES[myContract.type] || CONTRACT_TYPES.standard;

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">

      {/* ── Header ── */}
      <div className="shrink-0 px-4 pt-3 pb-2 border-b border-white/10">
        <div className="flex items-center justify-between mb-1">
          <button onClick={() => leaveDungeonRoom(roomId, myId, isHost).then(onExit)}
            className="text-slate-500 text-xs">✕ 離開</button>
          <div className="text-xs text-slate-400 font-mono">
            🏰 第 {room.currentFloor}/{room.totalFloors} 層 · 回合 {(room.round||1) - 1 || "–"}
          </div>
          <div className="w-8" />
        </div>
        {/* Monster */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">{monster.icon || "👾"}</span>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{monster.name || "怪物"}</span>
              <span className="text-xs text-slate-400">{room.monsterHP?.toLocaleString()} / {room.monsterMaxHP?.toLocaleString()}</span>
            </div>
            <HPBar current={room.monsterHP} max={room.monsterMaxHP} color="bg-rose-500" />
          </div>
        </div>
      </div>

      {/* ── Scrollable middle ── */}
      <div className="flex-1 overflow-y-auto">

        {/* 我的任務 */}
        <div className={`mx-4 mt-3 rounded-2xl px-4 py-3 border border-white/10 ${contractInfo.bg}`}>
          <div className={`text-xs font-bold mb-1 ${contractInfo.color}`}>📋 你的任務</div>
          <div className="flex items-center gap-2">
            <ContractBadge contract={myContract} />
            <span className="text-xs text-slate-300">{getContractDesc(myContract)}</span>
          </div>
        </div>

        {/* 隊員狀態 */}
        <div className="px-4 mt-3 space-y-2">
          {Object.entries(members).map(([id, m]) => (
            <div key={id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${m.alive ? "bg-white/5" : "bg-white/3 opacity-50"}`}>
              <span className="text-lg">{m.alive ? "🧙" : "💀"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold truncate">{m.name}</span>
                  <ContractBadge contract={m.contract} />
                  {m.ready && m.alive && <span className="text-xs text-emerald-400">✓</span>}
                </div>
                <HPBar current={m.hp} max={m.maxHP} color="bg-emerald-500" />
                <div className="text-xs text-slate-500 mt-0.5">{m.hp} / {m.maxHP}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 戰鬥紀錄 */}
        {(room.log || []).length > 0 && (
          <div className="mx-4 mt-3 mb-2">
            <div className="text-xs text-slate-500 mb-1 font-semibold">戰鬥紀錄</div>
            <div className="space-y-1 text-xs text-slate-300">
              {(room.log || []).slice(-5).map((entry, i) => (
                <div key={i} className="bg-white/5 rounded-lg px-3 py-2 space-y-0.5">
                  <div className="text-slate-400 font-mono">第 {entry.round} 回合・總傷 {entry.totalDmg}</div>
                  {(entry.playerLog || []).map((p, j) => (
                    <div key={j}>
                      {p.name}（{CONTRACT_TYPES[p.contract?.type]?.icon || "⚔️"}{p.contract?.type === "standard" ? "" : CONTRACT_TYPES[p.contract?.type]?.name}）
                      → <span className="text-amber-300">{p.dmg} 傷</span>
                      {p.crits > 0 && <span className="text-yellow-400"> 💥×{p.crits}</span>}
                      {p.ctr > 0   && <span className="text-rose-400">  反傷 -{p.ctr}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* ── 底部輸入區 ── */}
      {isDead ? (
        <div className="shrink-0 px-4 py-4 border-t border-white/10 text-center text-rose-400 font-bold">
          💀 你已陣亡，等待隊友繼續…
        </div>
      ) : submitted ? (
        <div className="shrink-0 px-4 py-4 border-t border-white/10">
          <div className="text-center text-emerald-400 font-bold mb-2">✓ 已送出{arrows.length}箭，等待其他隊友…</div>
          <div className="flex justify-center gap-1 flex-wrap">
            {arrows.map((a, i) => (
              <span key={i} className={`px-2 py-0.5 rounded-lg text-xs font-bold ${SCORE_COLORS[a.label] || "bg-slate-600 text-white"}`}>{a.label}</span>
            ))}
          </div>
          {isHost && (
            <button onClick={() => clearDungeonProcessing(roomId)}
              className="mt-3 w-full py-1.5 rounded-xl text-xs text-slate-500 bg-white/5">
              房主：強制重置（卡住時）
            </button>
          )}
          {isHost && aliveIds.some(id => !members[id].ready) && (
            <div className="mt-2 text-xs text-slate-500 text-center">
              {aliveIds.filter(id => !members[id].ready).map(id => members[id].name).join("、")} 尚未送出
            </div>
          )}
        </div>
      ) : (
        <div className="shrink-0 border-t border-white/10 px-3 pt-3 pb-4">
          {/* 箭分預覽 */}
          <div className="flex gap-1 mb-2 min-h-[28px] flex-wrap">
            {arrows.map((a, i) => (
              <span key={i} className={`px-2 py-0.5 rounded-lg text-xs font-bold ${SCORE_COLORS[a.label] || "bg-slate-600 text-white"}`}>{a.label}</span>
            ))}
            {arrows.length < 6 && (
              <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-white/10 text-slate-500">
                {6 - arrows.length} 箭待輸入
              </span>
            )}
          </div>
          {/* 按鈕 */}
          <div className="grid grid-cols-6 gap-1 mb-2">
            {SCORE_LABELS.map(label => (
              <button key={label} onClick={() => addArrow(label)}
                disabled={arrows.length >= 6}
                className={`py-2 rounded-lg font-black text-sm transition-all active:scale-95 ${SCORE_COLORS[label] || "bg-slate-600 text-white"} disabled:opacity-30`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={undoArrow} disabled={arrows.length === 0}
              className="flex-1 py-2 rounded-xl bg-white/10 text-slate-300 text-sm font-bold disabled:opacity-30">
              ↩ 撤銷
            </button>
            <button onClick={handleSubmit} disabled={arrows.length < 6}
              className="flex-[2] py-2 rounded-xl bg-emerald-600 font-black text-white text-sm disabled:opacity-30 active:scale-95">
              🏹 送出 6 箭
            </button>
          </div>
          {isHost && aliveIds.filter(id => id !== myId && !members[id].ready).length > 0 && (
            <div className="mt-2 flex gap-1 flex-wrap">
              {aliveIds.filter(id => id !== myId && !members[id].ready).map(id => (
                <button key={id} onClick={() => forceSkipDungeonPlayer(roomId, id)}
                  className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded-lg">
                  跳過 {members[id].name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
