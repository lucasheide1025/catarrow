// src/components/dungeon/DungeonBattleRoom.jsx — 地下城戰鬥室
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import CatMsg from "../cat/CatMsg";
import {
  subscribeDungeonRoom, submitDungeonArrows, processDungeonRound,
  forceSkipDungeonPlayer, advanceDungeonFloor, leaveDungeonRoom,
  clearDungeonProcessing, claimDungeonReward,
} from "../../lib/dungeonDb";
import { resolveHitPart, MONSTERS } from "../../lib/monsterData";
import { calcDungeonContractDmg, getContractDesc, CONTRACT_TYPES, DUNGEON_LENGTHS } from "../../lib/dungeonData";
import { recordBattleDex, addCoins, addMaterials } from "../../lib/db";
import { rollCoins, rollMaterialDrop } from "../../lib/lootTable";
import {
  sfxTap, sfxArrowShoot, sfxCast, sfxCounter, sfxCritBoom,
  sfxRoundEnd, sfxSuccess, sfxSoftFail, sfxMonsterDead, vibrate,
} from "../../lib/sound";
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
  const { catMsg, clearCatMsg, triggerCatAction, saveBond } = useCatCompanion();
  const myId = profile?.id;
  const bondSavedRef = useRef(false);

  const [room,          setRoom]          = useState(null);
  const [arrows,        setArrows]        = useState([]);
  const [submitted,     setSubmitted]     = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [shopDone,      setShopDone]      = useState(false);

  // 小回合動畫
  const [liveEntry,     setLiveEntry]     = useState(null);
  const [liveMiniIdx,   setLiveMiniIdx]   = useState(0);
  // 回合結算覆蓋（動畫結束後顯示）
  const [showRoundResult, setShowRoundResult] = useState(false);

  const processingRef    = useRef(false);
  const logEndRef        = useRef(null);
  const lastAnimKeyRef   = useRef(null);
  const revealTimersRef  = useRef([]);

  const isHost = room?.hostId === myId;
  const me     = room?.members?.[myId] || {};
  const status = room?.status;

  // ── 訂閱 ─────────────────────────────────────────────────────
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

  // ── 日誌捲底 ─────────────────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [room?.log]);

  // ── 小回合動畫（新 log 到 → 逐箭播放）────────────────────────
  useEffect(() => {
    const len = room?.log?.length || 0;
    if (len === 0) return;
    const entry = room.log[len - 1];
    if (!entry) return;
    // 用 floor+round 組合鍵避免換層後 log 清空造成動畫跳過
    const key = `${room.currentFloor || 1}-${entry.round}`;
    if (key === lastAnimKeyRef.current) return;
    lastAnimKeyRef.current = key;

    revealTimersRef.current.forEach(clearTimeout);
    revealTimersRef.current = [];
    setShowRoundResult(false);
    setLiveEntry(entry);
    setLiveMiniIdx(0);

    const minis = entry.miniRounds || [];
    let delay = 0;
    minis.forEach((mini, idx) => {
      const t = setTimeout(() => {
        setLiveMiniIdx(idx);
        if (mini.isCounter && idx > 0) sfxCounter();
        else sfxArrowShoot();
        vibrate(8);
      }, delay);
      revealTimersRef.current.push(t);
      delay += mini.isCounter ? 2400 : 1100;
    });

    // 動畫結束 → 切到結算畫面
    const ct = setTimeout(() => {
      setLiveEntry(null);
      setLiveMiniIdx(0);
      setShowRoundResult(true);
      const won  = entry.monsterHPAfter <= 0;
      const lost = entry.miniRounds?.at(-1)
        ? Object.values(room?.members || {}).every(m => !m.alive)
        : false;
      if (won)  sfxMonsterDead();
      else if (lost) sfxSoftFail();
      else sfxRoundEnd();
    }, delay + 500);
    revealTimersRef.current.push(ct);
  }, [room?.log?.length, room?.currentFloor]); // eslint-disable-line

  // ── 所有人 ready → 房主結算 ──────────────────────────────────
  useEffect(() => {
    if (!isHost || !room || room.processing || processingRef.current) return;
    if (room.status !== "active") return;
    const members = room.members || {};
    const alive   = Object.values(members).filter(m => m.alive);
    if (alive.length === 0) return;
    const allReady = alive.every(m => m.ready);
    if (!allReady) return;
    handleProcess();
  }, [room]); // eslint-disable-line

  // ── 進入下一層（floor_transition）────────────────────────────
  useEffect(() => {
    if (!isHost || !room) return;
    if (room.status !== "floor_transition") return;
    handleNextFloor();
  }, [room?.status]); // eslint-disable-line

  async function handleProcess() {
    if (processingRef.current) return;
    processingRef.current = true;
    setLoading(true);
    sfxCast();
    await processDungeonRound(roomId, room, calcContractDmgFn, calcCtrFn);
    setLoading(false);
    processingRef.current = false;
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
    triggerCatAction();
    setArrows(prev => [...prev, { label, score: SCORE_MAP[label] ?? 0 }]);
  }

  function undoArrow() {
    setArrows(prev => prev.slice(0, -1));
    if (submitted) setSubmitted(false);
  }

  async function handleNextFloor() {
    if (!isHost || !room) return;
    const nextFloor = (room.currentFloor || 0) + 1;
    const hostAtk   = room.hostAtk || 10;
    const tierBoost = Math.floor(hostAtk / 20);
    const maxTier   = Math.min(4, Math.ceil(nextFloor / 2) + tierBoost);
    const allMonsters = MONSTERS.filter(m => m.tier <= maxTier);
    const pool        = allMonsters.length ? allMonsters : MONSTERS;
    const nextMonster = pool[Math.floor(Math.random() * pool.length)];
    setLoading(true);
    await advanceDungeonFloor(roomId, room, nextMonster);
    setLoading(false);
  }

  async function handleClaim() {
    if (!isHost) return;
    const goldMult     = room?.nextFloorModifiers?.goldMult || 1;
    const baseMaterials = rollMaterialDrop(room?.monster?.tier || 1);
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

  // ── 路線選擇（等動畫和結算結束才顯示）───────────────────────
  if (status === "path_select" && !liveEntry && !showRoundResult) {
    return <DungeonPathSelect roomId={roomId} room={room} isHost={isHost} />;
  }

  // ── 商店 ───────────────────────────────────────────────────
  if (status === "shop") {
    return (
      <DungeonShop
        roomId={roomId} room={room}
        memberId={myId} memberData={{ ...me, coins: profile?.coins || 0 }}
        isHost={isHost}
        onDone={() => {
          setShopDone(true);
          if (isHost) {
            import("../../lib/dungeonDb").then(({ clearDungeonProcessing: _ }) =>
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

  // ── 完成畫面（等動畫和結算結束才顯示）─────────────────────
  if (status === "completed" && !liveEntry && !showRoundResult) {
    const won = room?.result === "win";
    if (won && !bondSavedRef.current) { bondSavedRef.current = true; saveBond("dungeon"); }

    if (!won) {
      // 失敗結算畫面
      const floorsCleared = (room.currentFloor || 1) - 1;
      const allPlayerLogs  = (room.log || []).flatMap(e => e.playerLog || []);
      const maxSingleDmg   = allPlayerLogs.length
        ? Math.max(...allPlayerLogs.map(p => p.dmg || 0))
        : 0;
      const consolationCoins = floorsCleared * 20;
      const partyNames = Object.values(room.members || {}).map(m => m.name).filter(Boolean);

      return (
        <div className="h-[100dvh] overflow-y-auto flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
          <div className="flex flex-col items-center px-6 pt-10 pb-6 text-center gap-4">
            <div className="text-7xl">💀</div>
            <div className="text-3xl font-black">全員陣亡</div>
            <div className="text-slate-400 text-sm">被《{room.monster?.icon}{room.monster?.name}》擊敗</div>
          </div>

          <div className="px-5 space-y-3 pb-8">
            {/* 探索成果 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="text-xs text-slate-400 font-bold mb-1">📊 探索成果</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-indigo-300">{room.currentFloor}</div>
                  <div className="text-xs text-slate-400 mt-0.5">到達層數</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-amber-300">{floorsCleared}</div>
                  <div className="text-xs text-slate-400 mt-0.5">通關層數</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-rose-300">{maxSingleDmg}</div>
                  <div className="text-xs text-slate-400 mt-0.5">本層最高單人傷</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-emerald-300">+{consolationCoins}</div>
                  <div className="text-xs text-slate-400 mt-0.5">探索金幣</div>
                </div>
              </div>
            </div>

            {/* 隊伍 */}
            {partyNames.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="text-xs text-slate-400 font-bold mb-2">🧙 隊伍成員</div>
                <div className="flex flex-wrap gap-2">
                  {Object.values(room.members || {}).map((m, i) => (
                    <div key={i} className={`text-sm px-3 py-1.5 rounded-xl border ${m.alive ? "border-emerald-500/30 bg-emerald-900/20 text-emerald-300" : "border-rose-500/30 bg-rose-900/20 text-rose-300"}`}>
                      {m.alive ? "🧙" : "💀"} {m.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 本層戰鬥紀錄摘要 */}
            {(room.log || []).length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="text-xs text-slate-400 font-bold mb-2">⚔️ 本層戰鬥（{room.log.length} 回合）</div>
                <div className="space-y-1.5">
                  {(room.log || []).map((entry, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-300">
                      <span className="text-slate-500">第 {entry.round} 回合</span>
                      <span className="text-amber-300 font-bold">傷害 {entry.totalDmg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 安慰獎說明 */}
            <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-4">
              <div className="text-xs text-amber-300 font-bold mb-1">🎁 探索獎勵</div>
              <div className="text-xs text-slate-400">即使失敗，探索過程仍可獲得金幣！（每通關 1 層 +20 金幣）</div>
              <div className="text-sm text-amber-300 font-black mt-2">💰 +{consolationCoins} 金幣</div>
            </div>

            <button onClick={onExit}
              className="w-full py-4 rounded-2xl font-black bg-white/10 text-slate-300 text-lg active:scale-95">
              返回大廳
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white items-center justify-center px-6 text-center gap-6">
        <div className="text-7xl">🏆</div>
        <div className="text-3xl font-black">地下城攻略完成！</div>
        <div className="text-slate-400 text-sm">恭喜通關全 {room.totalFloors} 層，金幣收益 ×2！</div>
        {isHost && (
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

  // ── 主體 ───────────────────────────────────────────────────
  const members     = room.members || {};
  const aliveIds    = Object.keys(members).filter(id => members[id].alive);
  const isDead      = me.alive === false;
  const monster     = room.monster || {};
  const myContract  = me.contract || { type:"standard", param:null };
  const contractInfo= CONTRACT_TYPES[myContract.type] || CONTRACT_TYPES.standard;

  // 動畫中用小回合 HP；否則用 Firestore 值
  const curMini      = liveEntry?.miniRounds?.[liveMiniIdx];
  const displayHP    = liveEntry ? (curMini?.monsterHPAfter ?? room.monsterHP) : room.monsterHP;
  const lastEntry    = (room.log || []).at(-1);

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <CatMsg msg={catMsg} onDone={clearCatMsg}/>

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
        <div className="flex items-center gap-2">
          <span className="text-2xl">{monster.icon || "👾"}</span>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{monster.name || "怪物"}</span>
              <span className="text-xs text-slate-400">
                {displayHP?.toLocaleString()} / {room.monsterMaxHP?.toLocaleString()}
              </span>
            </div>
            <HPBar current={displayHP} max={room.monsterMaxHP} color="bg-rose-500" />
          </div>
        </div>
      </div>

      {/* ── 中間（小回合動畫 or 一般內容）── */}
      <div className="flex-1 overflow-y-auto">

        {liveEntry ? (
          /* 小回合逐箭播放面板 */
          <div className="px-4 py-4 space-y-3">

            {/* ── 攻擊小回合 ── */}
            {!curMini?.isCounter && (
              <>
                <div className="text-center text-xs text-slate-400 font-mono">
                  ⚔️ 第 {liveEntry.round} 回合 · 第 <span className="text-white font-bold">{curMini?.miniRound}</span> / 6 箭
                </div>
                <div className="space-y-2">
                  {(curMini?.playerLog || []).map((p, i) => {
                    const arrow = p.arrowBreakdown?.[0];
                    return (
                      <div key={i} className="bg-white/5 border border-white/8 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🏹</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{p.name}</div>
                            {arrow && <div className="text-[11px] text-slate-400 mt-0.5">{arrow.partIcon} {arrow.partName}</div>}
                          </div>
                          {arrow && (
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${SCORE_COLORS[arrow.label] || "bg-slate-600 text-white"}`}>
                              {arrow.label}
                            </span>
                          )}
                          <span className={`text-sm font-black min-w-[40px] text-right ${p.dmg > 0 ? "text-amber-300" : "text-slate-500"}`}>
                            {p.dmg > 0 ? `-${p.dmg}` : "miss"}
                          </span>
                        </div>
                        {p.message && (
                          <div className="text-[11px] text-slate-400 mt-1.5 pl-8 border-t border-white/5 pt-1.5">{p.message}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── 反擊小回合 ── */}
            {curMini?.isCounter && (
              <>
                <div className="bg-rose-900/50 border border-rose-500/40 rounded-2xl px-4 py-3 text-center">
                  <div className="text-3xl mb-1" style={{ animation:"mb-bounce .7s ease infinite" }}>{monster.icon || "👾"}</div>
                  <div className="text-rose-200 font-black text-base">⚡ {monster.name} 反擊！</div>
                  <div className="text-rose-400 text-xs mt-0.5">所有射手受到傷害</div>
                </div>
                <div className="space-y-1.5">
                  {(curMini?.playerLog || []).map((p, i) => (
                    <div key={i} className={`rounded-xl px-3 py-2.5 border ${p.died ? "bg-slate-900 border-rose-500/50" : "bg-rose-500/10 border-rose-500/20"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${p.died ? "text-rose-300" : "text-slate-200"}`}>
                          {p.died ? "💀 " : ""}{p.name}
                        </span>
                        <span className="text-rose-400 font-black">-{p.ctr} HP</span>
                      </div>
                      {p.died && (
                        <div className="text-xs text-rose-400 mt-1">⚠️ 陣亡…等待隊友繼續戰鬥</div>
                      )}
                      {!p.died && p.message && (
                        <div className="text-[11px] text-rose-300/70 mt-1">{p.message}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 怪物 HP 進度條（動態更新）*/}
            <div className="bg-slate-800/80 border border-white/8 rounded-xl px-4 py-3">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>{monster.name}</span>
                <span>{displayHP?.toLocaleString()} HP</span>
              </div>
              <HPBar current={displayHP} max={room.monsterMaxHP} color="bg-rose-500" />
            </div>
          </div>

        ) : (
          /* 一般戰鬥內容 */
          <>
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
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-bold truncate">{m.name}</span>
                      <ContractBadge contract={m.contract} />
                      {m.catName && <span className="text-[10px] text-indigo-300 bg-indigo-900/40 px-1 py-0.5 rounded">🐱 光環</span>}
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
                  {(room.log || []).slice(-3).map((entry, i) => (
                    <div key={i} className="bg-white/5 rounded-lg px-3 py-2 space-y-0.5">
                      <div className="text-slate-400 font-mono">
                        第 {entry.round} 回合・總傷 {entry.totalDmg}
                        {entry.monsterHPAfter <= 0 && <span className="text-rose-400 ml-1">💀 擊殺</span>}
                      </div>
                      {(entry.playerLog || []).map((p, j) => (
                        <div key={j}>
                          {p.name}（{CONTRACT_TYPES[p.contract?.type]?.icon || "⚔️"}）
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
          </>
        )}
      </div>

      {/* ── 底部輸入區 ── */}
      {liveEntry ? (
        /* 動畫播放中 */
        <div className="shrink-0 px-4 py-3 border-t border-white/10 text-center text-slate-400 text-sm">
          戰鬥進行中…
        </div>
      ) : isDead ? (
        <div className="shrink-0 px-4 py-4 border-t border-white/10 text-center text-rose-400 font-bold">
          💀 你已陣亡，等待隊友繼續…
        </div>
      ) : submitted ? (
        <div className="shrink-0 px-4 py-4 border-t border-white/10">
          <div className="text-center text-emerald-400 font-bold mb-2">✓ 已送出 {arrows.length} 箭，等待其他隊友…</div>
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

      {/* ── 回合結算覆蓋層 ── */}
      {showRoundResult && lastEntry && (
        <RoundResultOverlay
          entry={lastEntry}
          room={room}
          status={status}
          onContinue={() => setShowRoundResult(false)}
        />
      )}
    </div>
  );
}

function RoundResultOverlay({ entry, room, status, onContinue }) {
  const monsterKilled = entry.monsterHPAfter <= 0;
  const partyWiped    = status === "completed" && room?.result === "lose";
  const finalWin      = status === "completed" && room?.result === "win";
  const floorCleared  = monsterKilled && !finalWin;

  let title, icon, btnLabel, btnColor;
  if (partyWiped) {
    icon = "💀"; title = "全員陣亡"; btnLabel = "查看結果"; btnColor = "bg-rose-600";
  } else if (finalWin) {
    icon = "🏆"; title = `第 ${room.currentFloor} 層通關！\n地下城完全攻略！`; btnLabel = "🎉 領取獎勵"; btnColor = "bg-gradient-to-r from-amber-500 to-orange-500";
  } else if (floorCleared) {
    icon = "✨"; title = `第 ${room.currentFloor} 層通關！`; btnLabel = "選擇路線 →"; btnColor = "bg-gradient-to-r from-indigo-500 to-purple-600";
  } else {
    icon = "⚔️"; title = `第 ${entry.round} 回合結束`; btnLabel = "下一回合"; btnColor = "bg-slate-700";
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5 gap-5 text-white"
      style={{ background: "rgba(15,23,42,0.97)" }}>
      <div className="text-6xl">{icon}</div>
      <div className="text-2xl font-black text-center whitespace-pre-line">{title}</div>

      {/* 本回合傷害摘要 */}
      <div className="w-full max-w-sm bg-white/8 border border-white/10 rounded-2xl p-4 space-y-2">
        <div className="text-xs text-slate-400 font-bold mb-2 flex justify-between">
          <span>本回合總傷害</span>
          <span className="text-amber-300 font-black">{entry.totalDmg?.toLocaleString()}</span>
        </div>
        {(entry.playerLog || []).map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 flex-1 truncate">{p.name}</span>
            <span className="text-[11px] text-slate-500 font-mono">
              {(p.arrowBreakdown || []).map(a => a.label).join(" ")}
            </span>
            <span className="font-black text-amber-300 min-w-[36px] text-right">{p.dmg}</span>
            {p.crits > 0 && <span className="text-yellow-400 text-xs">💥</span>}
            {p.ctr  > 0 && <span className="text-rose-400 text-xs">-{p.ctr}</span>}
          </div>
        ))}
        {!monsterKilled && (
          <div className="flex justify-between text-xs text-slate-400 border-t border-white/10 pt-2 mt-1">
            <span>怪物剩餘 HP</span>
            <span className="text-rose-300 font-bold">{room.monsterHP?.toLocaleString()}</span>
          </div>
        )}
      </div>

      <button onClick={onContinue}
        className={`w-full max-w-sm py-4 rounded-2xl font-black text-lg text-white shadow-lg active:scale-95 transition-all ${btnColor}`}>
        {btnLabel}
      </button>
    </div>
  );
}
