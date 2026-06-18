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
import { resolveHitPart, MONSTERS, TIER_ORDER, TIER_LABEL } from "../../lib/monsterData";
import { calcDungeonContractDmg, getContractDesc, CONTRACT_TYPES, DUNGEON_LENGTHS } from "../../lib/dungeonData";
import { recordBattleDex, addCoins, addMaterials, addChests, addPracticeLog } from "../../lib/db";
import { rollCoins, rollMaterialDrop, openCoinChest, floorToMonsterTier, makeCoinChest } from "../../lib/lootTable";
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

function DungeonMonsterImg({ id, icon, charge, hit }) {
  const [err, setErr] = useState(false);
  const anim = charge ? "mb-charge 0.7s ease infinite" : hit ? "mb-monster-hit 0.5s ease" : undefined;
  return err ? (
    <span style={{ fontSize:80, display:"block", textAlign:"center", animation:anim }}>{icon}</span>
  ) : (
    <img src={`/monsters/${id}.webp`} alt={icon} onError={() => setErr(true)}
      style={{ maxWidth:"82%", maxHeight:200, objectFit:"contain", animation:anim }}/>
  );
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
  const { catMsg, clearCatMsg, triggerCatAction, saveBond, hasCat, catStatMult, catName: myCatName } = useCatCompanion();
  const myId = profile?.id;
  const bondSavedRef = useRef(false);

  const [room,          setRoom]          = useState(null);
  const [arrows,        setArrows]        = useState([]);
  const [submitted,     setSubmitted]     = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [shopDone,      setShopDone]      = useState(false);

  // 小回合動畫
  const [liveEntry,         setLiveEntry]         = useState(null);
  const [liveMiniIdx,       setLiveMiniIdx]       = useState(0);
  // 回合結算覆蓋（動畫結束後顯示）
  const [showRoundResult,   setShowRoundResult]   = useState(false);
  // 戰鬥動畫 states（同組隊風格）
  const [animHit,           setAnimHit]           = useState(false);
  const [animMonsterCharge, setAnimMonsterCharge] = useState(false);
  const [animScreenShake,   setAnimScreenShake]   = useState(false);
  const [floatCounterDmgs,  setFloatCounterDmgs]  = useState([]);
  const [floatDmg,          setFloatDmg]          = useState(null);
  const [localHpOverride,   setLocalHpOverride]   = useState({});

  const processingRef       = useRef(false);
  const lastProcessedRef    = useRef(null); // "${floor}-${round}" 已處理過就跳過
  const logEndRef           = useRef(null);
  const lastAnimKeyRef      = useRef(null);
  const revealTimersRef     = useRef([]);
  const prevRoundKeyRef     = useRef(null); // "${floor}-${round}" 換回合才清箭

  const isHost = room?.hostId === myId;
  const me     = room?.members?.[myId] || {};
  const status = room?.status;

  // ── 訂閱 ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeDungeonRoom(roomId, r => {
      setRoom(r);
      if (r && r.status === "active" && r.round !== undefined) {
        // 只有「層＋回合」組合真的變了才清箭，避免其他人送出觸發時誤清
        const key = `${r.currentFloor || 1}-${r.round}`;
        if (key !== prevRoundKeyRef.current) {
          prevRoundKeyRef.current = key;
          setSubmitted(false);
          setArrows([]);
        }
      }
    });
    return () => unsub();
  }, [roomId]);

  // ── 日誌捲底 ─────────────────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [room?.log]);

  // ── 進入新回合時觸發貓貓補助提示（整個回合只一次）────────────
  useEffect(() => {
    if (!room?.round || room?.status !== "active") return;
    triggerCatAction();
  }, [room?.round, room?.currentFloor]); // eslint-disable-line

  // ── 小回合動畫（新 log 到 → 逐箭播放，同組隊風格）────────────
  useEffect(() => {
    const len = room?.log?.length || 0;
    if (len === 0) return;
    const entry = room.log[len - 1];
    if (!entry) return;
    const key = `${room.currentFloor || 1}-${entry.round}`;
    if (key === lastAnimKeyRef.current) return;
    lastAnimKeyRef.current = key;

    revealTimersRef.current.forEach(clearTimeout);
    revealTimersRef.current = [];
    setShowRoundResult(false);
    setLocalHpOverride({});
    setLiveEntry(entry);
    setLiveMiniIdx(0);

    const minis = entry.miniRounds || [];
    let delay = 0;
    minis.forEach((mini, idx) => {
      const t = setTimeout(() => {
        setLiveMiniIdx(idx);
        sfxArrowShoot();
        vibrate(8);
      }, delay);
      revealTimersRef.current.push(t);

      if (mini.isCounter) {
        // 反擊：先鎖 HP → 怪物蓄力 → 衝擊 + 浮動傷害
        const ctrLog = mini.playerLog || [];
        const tLock = setTimeout(() => {
          setLocalHpOverride(prev => {
            const next = { ...prev };
            ctrLog.forEach(p => {
              const mem = room?.members?.[p.id];
              if (mem) next[p.id] = Math.min(mem.maxHP || 9999, (mem.hp || 0) + (p.ctr || 0));
            });
            return next;
          });
        }, delay);
        const t1 = setTimeout(() => setAnimMonsterCharge(true), delay + 600);
        const t2 = setTimeout(() => {
          setAnimMonsterCharge(false);
          setAnimScreenShake(true);
          setLocalHpOverride({});
          sfxCounter();
          vibrate([0, 35, 55, 30]);
          const floats = ctrLog
            .filter(p => p.ctr > 0)
            .map(p => ({ id: Date.now() + Math.random(), memberId: p.id, text: `-${p.ctr}` }));
          if (floats.length) {
            setFloatCounterDmgs(floats);
            setTimeout(() => setFloatCounterDmgs([]), 1400);
          }
          setTimeout(() => setAnimScreenShake(false), 850);
        }, delay + 1400);
        revealTimersRef.current.push(tLock, t1, t2);
        delay += 2700;
      } else {
        // 攻擊：怪物閃白 + 浮動傷害數字
        const totalDmg = (mini.playerLog || []).reduce((s, p) => s + (p.dmg || 0), 0);
        const hasCrit  = (mini.playerLog || []).some(p => (p.crits || 0) > 0);
        if (totalDmg > 0) {
          const th = setTimeout(() => {
            setAnimHit(true);
            setFloatDmg({ dmg: totalDmg, isCrit: hasCrit });
            setTimeout(() => { setAnimHit(false); setFloatDmg(null); }, 1200);
          }, delay + 200);
          revealTimersRef.current.push(th);
        }
        delay += 1400;
      }
    });

    const monsterDied = entry.monsterHPAfter <= 0;
    const allDead     = Object.values(room?.members || {}).every(m => !m.alive);
    const minDelay    = minis.length === 0 && !monsterDied && !allDead ? 1500 : 0;

    const ct = setTimeout(() => {
      setLiveEntry(null);
      setLiveMiniIdx(0);
      setShowRoundResult(true);
      if (monsterDied) sfxMonsterDead();
      else if (allDead) sfxSoftFail();
      else sfxRoundEnd();
    }, delay + 500 + minDelay);
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
    const roundKey = `${room.currentFloor || 1}-${room.round || 1}`;
    if (roundKey === lastProcessedRef.current) return;
    lastProcessedRef.current = roundKey;
    processingRef.current = true;
    setLoading(true);
    sfxCast();
    const res = await processDungeonRound(roomId, room, calcContractDmgFn, calcCtrFn);
    if (!res?.ok) lastProcessedRef.current = null; // 失敗時允許重試
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
    const score = label === "命中" ? 1 : (SCORE_MAP[label] ?? 0);
    setArrows(prev => [...prev, { label, score }]);
  }

  function undoArrow() {
    setArrows(prev => prev.slice(0, -1));
    if (submitted) setSubmitted(false);
  }

  async function handleNextFloor() {
    if (!isHost || !room) return;
    const nextFloor = (room.currentFloor || 0) + 1;
    // 層數對應最高 tier（索引）：1-2層=common(0), 3-4=rare(1), 5-6=elite(2), 7+=fierce(3)
    // 地下城不出 boss/mythic
    const maxTierIdx  = nextFloor <= 2 ? 0 : nextFloor <= 4 ? 1 : nextFloor <= 6 ? 2 : 3;
    const allMonsters = MONSTERS.filter(m => TIER_ORDER.indexOf(m.tier) <= maxTierIdx);
    const pool        = allMonsters.length ? allMonsters : MONSTERS.filter(m => m.tier === "common");
    const nextMonster = pool[Math.floor(Math.random() * pool.length)];
    setLoading(true);
    await advanceDungeonFloor(roomId, room, nextMonster);
    setLoading(false);
  }

  async function handleClaim() {
    if (!isHost) return;
    const goldMult      = room?.nextFloorModifiers?.goldMult || 1;
    const baseMaterials = rollMaterialDrop(room?.monster);
    const totalFloors   = room.totalFloors || 7;

    for (const mid of Object.keys(room.members || {})) {
      if (mid.startsWith("guest")) continue;
      const baseCoins = rollCoins(room?.monster?.tier || "common", 1);
      await claimDungeonReward(mid, baseCoins, goldMult);
      const memberChests = Array.from({ length: totalFloors }, (_, i) =>
        makeCoinChest(floorToMonsterTier(i + 1), `地下城第${i + 1}層`)
      );
      if (memberChests.length > 0) await addChests(mid, memberChests).catch(() => {});
      if (baseMaterials) await addMaterials(mid, [baseMaterials]).catch(() => {});
      await recordBattleDex(mid, room.monster.id).catch(() => {});
    }

    // 儲存自己的練習紀錄（win）
    if (myId && !myId.startsWith("guest")) {
      const practiceRounds = (room.log || []).map(entry => {
        const pl = (entry.playerLog || []).find(p => p.id === myId);
        return (pl?.arrowBreakdown || []).map(a =>
          a.label === "X" ? 10 : a.label === "M" ? 0 : (parseInt(a.label) || 0)
        );
      }).filter(r => r.length > 0);
      if (practiceRounds.length > 0) {
        addPracticeLog(myId, {
          date: new Date().toISOString().slice(0, 10), source: "dungeon",
          monsterName: room.monster?.name || "地下城", result: "win",
          rounds: practiceRounds,
          total: practiceRounds.flat().reduce((s, v) => s + v, 0),
          totalFloors,
        }, myId).catch(() => {});
      }
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
      // 安慰金幣箱：每通關一層給一個木幣箱
      const consolationChests = Array.from({ length: floorsCleared },
        (_, i) => ({ floor: i + 1, ...openCoinChest("common") }));
      const consolationCoins = consolationChests.reduce((s, c) => s + c.coins, 0);

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
            {Object.keys(room.members || {}).length > 0 && (
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

            {/* 安慰金幣箱 */}
            <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-4">
              <div className="text-xs text-amber-300 font-bold mb-2">🎁 探索金幣箱（每通關一層各得一個）</div>
              {consolationChests.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {consolationChests.map((c, i) => (
                      <div key={i} className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1">
                        <span>{c.icon}</span>
                        <span className="text-xs text-slate-300">{c.name}</span>
                        <span className="text-xs text-amber-300 font-bold">+{c.coins}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-amber-300 font-black">💰 合計 +{consolationCoins} 金幣</div>
                </>
              ) : (
                <div className="text-xs text-slate-500">未通關任何一層，無探索獎勵</div>
              )}
            </div>

            <button onClick={() => {
              // 儲存失敗紀錄
              if (myId && !myId.startsWith("guest")) {
                const practiceRounds = (room.log || []).map(entry => {
                  const pl = (entry.playerLog || []).find(p => p.id === myId);
                  return (pl?.arrowBreakdown || []).map(a =>
                    a.label === "X" ? 10 : a.label === "M" ? 0 : (parseInt(a.label) || 0)
                  );
                }).filter(r => r.length > 0);
                if (practiceRounds.length > 0) {
                  addPracticeLog(myId, {
                    date: new Date().toISOString().slice(0, 10), source: "dungeon",
                    monsterName: room.monster?.name || "地下城", result: "lose",
                    rounds: practiceRounds,
                    total: practiceRounds.flat().reduce((s, v) => s + v, 0),
                    floorsCleared,
                  }, myId).catch(() => {});
                }
              }
              onExit?.();
            }}
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

  // 前後排成員分配
  const memberList = Object.entries(members)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => {
      if (a.id === myId) return -1;
      if (b.id === myId) return 1;
      if (a.id === room.hostId) return -1;
      if (b.id === room.hostId) return 1;
      return a.id < b.id ? -1 : 1;
    });
  const memberCount  = memberList.length;
  const aliveCount   = memberList.filter(m => m.alive).length;
  const frontMembers = memberList.slice(0, 4);
  const backMembers  = memberList.slice(4);
  const frontW = Math.min(100, Math.floor((528 - Math.max(0, frontMembers.length - 1) * 3) / (frontMembers.length || 1)));
  const backW  = Math.min(80,  Math.floor((528 - Math.max(0, backMembers.length  - 1) * 3) / (backMembers.length  || 1)));
  const showBackRow  = !!(liveEntry || submitted);

  function handleLeave() {
    leaveDungeonRoom(roomId, myId, isHost).catch(() => {});
    onExit?.();
  }

  return (
    <div style={{
      position:"fixed", top:0, bottom:0, left:"50%", transform:"translateX(-50%)",
      width:"100%", maxWidth:540, zIndex:9999, overflow:"hidden",
      backgroundImage:"url(/ui/dungeon-bg.webp)", backgroundSize:"cover", backgroundPosition:"center",
      display:"flex", flexDirection:"column", fontFamily:"sans-serif",
    }}>
      <style>{`
@keyframes mb-float{0%{transform:translateY(0) scale(1.15);opacity:1}100%{transform:translateY(-60px) scale(0.85);opacity:0}}
@keyframes mb-miss{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-50px) scale(0.7);opacity:0}}
@keyframes mb-charge{0%{transform:scale(1) rotate(0deg)}25%{transform:scale(1.35) rotate(-12deg)}60%{transform:scale(1.5) rotate(0deg)}80%{transform:scale(1.35) rotate(10deg)}100%{transform:scale(1) rotate(0deg)}}
@keyframes mb-screen-shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-10px)}30%{transform:translateX(9px)}45%{transform:translateX(-7px)}60%{transform:translateX(5px)}80%{transform:translateX(-3px)}}
@keyframes mb-monster-hit{0%{filter:brightness(1)}40%{filter:brightness(2) saturate(0)}100%{filter:brightness(1)}}
@keyframes mb-archer-attack{0%{transform:translateX(0)}30%{transform:translateX(8px)}60%{transform:translateX(-3px)}100%{transform:translateX(0)}}
      `}</style>

      <CatMsg msg={catMsg} onDone={clearCatMsg}/>

      {/* ── 頂部 HUD ── */}
      <div style={{ flexShrink:0, background:"rgba(0,0,0,0.78)", zIndex:2, borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"4px 10px 5px" }}>
        {/* 第一行：怪物名稱 + 等級徽章 + 離開 */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ fontSize:15, fontWeight:900, color:monster.accent||"#f59e0b", textShadow:"0 2px 8px #000" }}>{monster.name||"怪物"}</span>
            {monster.tier && (() => {
              const tl = TIER_LABEL[monster.tier] || {};
              return (
                <span style={{ fontSize:10, fontWeight:700, color:"white", background:tl.color||"#6b7280", borderRadius:4, padding:"1px 5px" }}>
                  {tl.label||monster.tier}
                </span>
              );
            })()}
          </div>
          <button onClick={handleLeave}
            style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.18)", color:"rgba(255,255,255,0.55)", borderRadius:7, padding:"1px 8px", fontSize:11, cursor:"pointer" }}>
            離開
          </button>
        </div>
        {/* 第二行：怪物 HP 條 */}
        <div style={{ background:"rgba(0,0,0,0.4)", height:16, borderRadius:8, overflow:"hidden", position:"relative", marginBottom:4, border:"1px solid rgba(127,29,29,0.6)" }}>
          <div style={{ width:`${Math.max(0,(displayHP||0)/(room.monsterMaxHP||1))*100}%`, height:"100%", borderRadius:8, transition:"width .7s ease",
            background: (displayHP||0)/(room.monsterMaxHP||1)>0.5?"#dc2626":(displayHP||0)/(room.monsterMaxHP||1)>0.25?"#f59e0b":"#7f1d1d" }}/>
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:9, fontWeight:900 }}>
            {(displayHP||0).toLocaleString()} / {(room.monsterMaxHP||0).toLocaleString()}
          </div>
        </div>
        {/* 第三行：統計標籤列 */}
        <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
          <div style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:5, padding:"1px 6px", fontSize:10, color:"#94a3b8" }}>
            🏰 {room.currentFloor||1}/{room.totalFloors||7}層 R{room.round||1}
          </div>
          <div style={{ background:"rgba(239,68,68,0.15)", border:"1px solid #f8717144", borderRadius:5, padding:"1px 6px", fontSize:10, color:"#f87171" }}>
            ⚔️ {monster.atk||0}
          </div>
          <div style={{ background:"rgba(59,130,246,0.15)", border:"1px solid #60a5fa44", borderRadius:5, padding:"1px 6px", fontSize:10, color:"#60a5fa" }}>
            🛡️ {monster.def||0}
          </div>
          <div style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:5, padding:"1px 6px", fontSize:10, color:"#94a3b8" }}>
            👤 {aliveCount}/{memberCount}
          </div>
          <div style={{ background:"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:5, padding:"1px 6px", fontSize:10 }}
            className={contractInfo.color}>
            {contractInfo.icon} {contractInfo.name}
          </div>
        </div>
      </div>

      {/* ── 怪物展示區 ── */}
      <div style={{ flex:"1 1 0", position:"relative", minHeight:0, overflow:"hidden", display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:6 }}>
        <DungeonMonsterImg id={monster.id} icon={monster.icon} charge={animMonsterCharge} hit={animHit}/>
        {/* 浮動傷害 */}
        {floatDmg && (
          floatDmg.isMiss
            ? <span style={{ position:"absolute", top:"25%", left:"50%", transform:"translateX(-50%)", fontSize:"1.3rem", fontWeight:900, color:"#94a3b8", textShadow:"0 2px 8px rgba(0,0,0,0.9)", animation:"mb-miss 1.0s ease-out forwards", pointerEvents:"none", whiteSpace:"nowrap" }}>MISS</span>
            : <span style={{ position:"absolute", top:"20%", left:"50%", transform:"translateX(-50%)", fontSize:floatDmg.isCrit?"2rem":"1.6rem", fontWeight:900, color:floatDmg.isCrit?"#fbbf24":"#f87171", textShadow:"0 2px 10px rgba(0,0,0,0.9)", animation:"mb-float 1.3s ease-out forwards", pointerEvents:"none", whiteSpace:"nowrap" }}>
                -{floatDmg.dmg}{floatDmg.isCrit?"💥":""}
              </span>
        )}
        {/* 小回合進度點 */}
        {liveEntry && (
          <div style={{ position:"absolute", bottom:8, left:0, right:0, display:"flex", justifyContent:"center", alignItems:"center", gap:4 }}>
            {(liveEntry.miniRounds||[]).map((mini,i) => (
              <div key={i} style={{ width:7, height:7, borderRadius:"50%", background: i===liveMiniIdx?"#fbbf24":i<liveMiniIdx?(mini.isCounter?"#f97316":"#6366f1"):"rgba(255,255,255,0.1)", transform:i===liveMiniIdx?"scale(1.4)":"scale(1)", transition:"all 0.3s" }}/>
            ))}
            {curMini?.isCounter && <span style={{ fontSize:10, color:"#fb923c", fontWeight:900, marginLeft:4 }}>⚡反擊</span>}
          </div>
        )}
      </div>

      {/* ── 角色列（前後排）── */}
      <div style={{ flex:"0 0 auto", background:"rgba(0,0,0,0.82)", borderTop:"1px solid rgba(255,255,255,0.08)" }}>
        {/* 前排（最多4人）完整顯示 */}
        <div style={{ display:"flex", gap:3, padding:"4px 6px 4px", justifyContent:"center",
          animation: animScreenShake ? "mb-screen-shake 0.55s ease" : undefined }}>
          {frontMembers.map(m => {
            const displayHp = localHpOverride[m.id] !== undefined ? localHpOverride[m.id] : m.hp;
            const hpPct = m.maxHP > 0 ? Math.max(0, Math.min(1, displayHp/m.maxHP)) : 0;
            const isMe = m.id === myId;
            const mContract = CONTRACT_TYPES[m.contract?.type] || CONTRACT_TYPES.standard;
            return (
              <div key={m.id} style={{
                flexShrink:0, width:frontW, display:"flex", flexDirection:"column",
                border:`1px solid ${isMe?"rgba(251,191,36,0.35)":"rgba(255,255,255,0.07)"}`,
                borderRadius:8, overflow:"hidden",
                background: isMe?"rgba(251,191,36,0.04)":"rgba(255,255,255,0.01)",
              }}>
                <div style={{ height:90, position:"relative", flexShrink:0, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
                  {floatCounterDmgs.filter(f=>f.memberId===m.id).map(f => (
                    <span key={f.id} style={{ position:"absolute", top:"5%", left:"50%", transform:"translateX(-50%)", zIndex:10, animation:"mb-float 1.3s ease-out forwards", fontWeight:900, fontSize:"0.9rem", color:"#f43f5e", textShadow:"0 2px 8px rgba(0,0,0,0.9)", whiteSpace:"nowrap", pointerEvents:"none" }}>{f.text}💢</span>
                  ))}
                  <img src={`/cats/archers/${m.archerStyle||"baobao"}.webp`} alt={m.name}
                    style={{ height:"100%", objectFit:"contain", objectPosition:"center bottom",
                      filter: !m.alive ? "grayscale(100%) opacity(0.25)" : undefined,
                      outline: isMe ? "2px solid rgba(251,191,36,0.6)" : undefined,
                      outlineOffset:"2px", borderRadius:2 }}
                    onError={e => { e.target.style.display="none"; }}/>
                </div>
                <div style={{ height:1, background:"rgba(255,255,255,0.06)", flexShrink:0 }}/>
                <div style={{ padding:"3px 3px 4px", textAlign:"center" }}>
                  <div style={{ height:5, borderRadius:3, background:"rgba(255,255,255,0.06)", overflow:"hidden", marginBottom:2 }}>
                    <div style={{ height:"100%", borderRadius:3, width:`${hpPct*100}%`, transition:"width 0.5s ease",
                      background: hpPct>0.5?"linear-gradient(90deg,#16a34a,#4ade80)":hpPct>0.25?"linear-gradient(90deg,#d97706,#fbbf24)":"linear-gradient(90deg,#dc2626,#f87171)",
                      boxShadow:hpPct<=0.25?"0 0 6px rgba(239,68,68,0.8)":undefined }}/>
                  </div>
                  <div style={{ fontSize:10, fontWeight:700, color:isMe?"#fbbf24":!m.alive?"#f87171":"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:1 }}>
                    {!m.alive?"💀":""}{m.name.slice(0,6)}
                  </div>
                  <div style={{ display:"flex", justifyContent:"center", gap:4, marginBottom:1 }}>
                    <div style={{ fontSize:9, color:"#f87171" }}>⚔️{m.atk||0}</div>
                    <div style={{ fontSize:9, color:"#60a5fa" }}>🛡{m.def||0}</div>
                  </div>
                  <div style={{ fontSize:8, marginBottom:1 }} className={mContract.color}>
                    {mContract.icon} {mContract.name}
                  </div>
                  <div style={{ fontSize:9, color: liveEntry?"#64748b":m.ready?"#4ade80":!m.alive?"#475569":"#fbbf24" }}>
                    {!m.alive?"⬛":liveEntry?"⚙️":m.ready?"✅":"⏳"}
                  </div>
                  {isHost && m.alive && !m.ready && m.id!==myId && (
                    <button onClick={()=>forceSkipDungeonPlayer(roomId, m.id)}
                      style={{ fontSize:8, padding:"1px 4px", borderRadius:3, background:"rgba(255,255,255,0.08)", color:"#64748b", border:"none", cursor:"pointer", marginTop:1 }}>
                      跳
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* 後排（第5-8人）戰鬥期才顯示 */}
        {backMembers.length > 0 && showBackRow && (
          <div style={{ display:"flex", gap:3, padding:"0 6px 6px", justifyContent:"center" }}>
            {backMembers.map(m => {
              const displayHp = localHpOverride[m.id] !== undefined ? localHpOverride[m.id] : m.hp;
              const hpPct = m.maxHP > 0 ? Math.max(0, Math.min(1, displayHp/m.maxHP)) : 0;
              const isMe = m.id === myId;
              return (
                <div key={m.id} style={{
                  flexShrink:0, width:backW, display:"flex", flexDirection:"column",
                  border:`1px solid ${isMe?"rgba(251,191,36,0.35)":"rgba(255,255,255,0.07)"}`,
                  borderRadius:8, overflow:"hidden", background:"rgba(255,255,255,0.01)",
                }}>
                  <div style={{ height:60, position:"relative", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
                    {floatCounterDmgs.filter(f=>f.memberId===m.id).map(f => (
                      <span key={f.id} style={{ position:"absolute", top:"5%", left:"50%", transform:"translateX(-50%)", zIndex:10, animation:"mb-float 1.3s ease-out forwards", fontWeight:900, fontSize:"0.75rem", color:"#f43f5e", textShadow:"0 2px 8px rgba(0,0,0,0.9)", whiteSpace:"nowrap", pointerEvents:"none" }}>{f.text}💢</span>
                    ))}
                    <img src={`/cats/archers/${m.archerStyle||"baobao"}.webp`} alt={m.name}
                      style={{ height:"100%", objectFit:"contain", objectPosition:"center bottom",
                        filter: !m.alive ? "grayscale(100%) opacity(0.25)" : undefined }}
                      onError={e => { e.target.style.display="none"; }}/>
                  </div>
                  <div style={{ height:1, background:"rgba(255,255,255,0.06)" }}/>
                  <div style={{ padding:"2px 2px 3px", textAlign:"center" }}>
                    <div style={{ height:4, borderRadius:3, background:"rgba(255,255,255,0.06)", overflow:"hidden", marginBottom:1 }}>
                      <div style={{ height:"100%", borderRadius:3, width:`${hpPct*100}%`, transition:"width 0.5s ease",
                        background: hpPct>0.5?"linear-gradient(90deg,#16a34a,#4ade80)":hpPct>0.25?"linear-gradient(90deg,#d97706,#fbbf24)":"linear-gradient(90deg,#dc2626,#f87171)" }}/>
                    </div>
                    <div style={{ fontSize:9, fontWeight:700, color:isMe?"#fbbf24":"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {!m.alive?"💀":""}{m.name.slice(0,5)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 輸入區 ── */}
      <div style={{ flex:"0 0 auto", background:"rgba(0,0,0,0.68)", padding:"3px 6px 10px", paddingBottom:"max(10px, env(safe-area-inset-bottom))" }}>
        {liveEntry ? (
          <div style={{ textAlign:"center", color:"rgba(148,163,184,0.7)", fontSize:12, padding:"10px 0" }}>⚔️ 戰鬥進行中…</div>
        ) : isDead ? (
          <div style={{ textAlign:"center", color:"#f87171", fontWeight:900, fontSize:12, padding:"10px 0" }}>💀 你已陣亡，等待隊友繼續…</div>
        ) : submitted ? (
          <div style={{ textAlign:"center", padding:"6px 0" }}>
            <div style={{ color:"#4ade80", fontWeight:900, fontSize:12, marginBottom:6 }}>✅ 已送出，等待隊友…</div>
            <div style={{ display:"flex", justifyContent:"center", gap:2, flexWrap:"wrap" }}>
              {arrows.map((a,i) => (
                <span key={i} className={`px-2 py-0.5 rounded-lg text-xs font-bold ${SCORE_COLORS[a.label]||"bg-slate-600 text-white"}`}>{a.label}</span>
              ))}
            </div>
            {isHost && (
              <button onClick={()=>clearDungeonProcessing(roomId)}
                style={{ marginTop:8, width:"100%", padding:"4px", borderRadius:8, fontSize:10, color:"#64748b", background:"rgba(255,255,255,0.05)", border:"none", cursor:"pointer" }}>
                房主：強制重置（卡住時）
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 任務提示 */}
            <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:4, padding:"2px 6px", borderRadius:6, background:"rgba(0,0,0,0.3)" }} className={contractInfo.color}>
              <span style={{ fontSize:11 }}>{contractInfo.icon}</span>
              <span style={{ fontSize:9, fontWeight:700 }}>{getContractDesc(myContract)}</span>
            </div>
            {/* 箭槽 */}
            <div style={{ display:"flex", gap:3, marginBottom:4, justifyContent:"center", alignItems:"center" }}>
              {Array.from({ length:6 }).map((_,i) => {
                const a = arrows[i];
                return (
                  <div key={i} style={{ width:36, height:36, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900,
                    background: a?"#2563eb":"rgba(255,255,255,0.05)",
                    border:`2px solid ${a?"#60a5fa":"rgba(255,255,255,0.1)"}`,
                    color: a?"white":"#475569" }}>
                    {a ? a.label : ""}
                  </div>
                );
              })}
              {arrows.length > 0 && (
                <button onClick={undoArrow} style={{ background:"none", border:"none", color:"#64748b", fontSize:18, cursor:"pointer", paddingLeft:4 }}>↩</button>
              )}
            </div>
            {/* 分數按鈕格（依合約類型調整）*/}
            {(myContract.type === "hit_count" || myContract.type === "all_hit") ? (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:4 }}>
                <button onClick={() => addArrow("命中")} disabled={arrows.length>=6}
                  className="rounded-xl font-black active:scale-95 bg-emerald-500 text-white"
                  style={{ fontSize:18, padding:"14px 0", opacity:arrows.length>=6?0.3:1 }}>
                  命中
                </button>
                <button onClick={() => addArrow("M")} disabled={arrows.length>=6}
                  className={`rounded-xl font-black active:scale-95 ${SCORE_COLORS["M"]}`}
                  style={{ fontSize:18, padding:"14px 0", opacity:arrows.length>=6?0.3:1 }}>
                  M
                </button>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:2, marginBottom:4 }}>
                {SCORE_LABELS.map(label => (
                  <button key={label} onClick={() => addArrow(label)} disabled={arrows.length>=6}
                    className={`rounded-lg font-black active:scale-95 ${SCORE_COLORS[label]||"bg-slate-600 text-white"}`}
                    style={{ fontSize:12, padding:"8px 2px", opacity:arrows.length>=6?0.3:1 }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {/* 送出 */}
            <button onClick={handleSubmit} disabled={arrows.length<6}
              style={{ width:"100%", padding:"10px", borderRadius:10, fontWeight:900, fontSize:14, color:"white", cursor:"pointer", border:"none",
                background: arrows.length>=6?"linear-gradient(135deg,#059669,#10b981)":"rgba(255,255,255,0.1)",
                opacity: arrows.length<6?0.5:1, transition:"all 0.2s" }}>
              🏹 送出 6 箭 {arrows.length>0?`(${arrows.length}/6)`:""}
            </button>
            {hasCat && (
              <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4, padding:"2px 6px", borderRadius:6, background:"rgba(79,70,229,0.15)", border:"1px solid rgba(99,102,241,0.3)" }}>
                <span style={{ fontSize:11 }}>🐱</span>
                <span style={{ fontSize:9, color:"#a5b4fc", fontWeight:700 }}>{myCatName} 光環 ×{Math.max(1.1,catStatMult).toFixed(2)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 回合結算蓋板 ── */}
      {showRoundResult && lastEntry && (
        <RoundResultOverlay
          entry={lastEntry} room={room} status={status}
          onContinue={() => { setShowRoundResult(false); setSubmitted(false); setArrows([]); }}
        />
      )}
    </div>
  );
}

function RoundResultOverlay({ entry, room, status, onContinue }) {
  const monsterKilled  = entry.monsterHPAfter <= 0;
  const allMembersDead = Object.values(room?.members || {}).every(m => !m.alive);
  const partyWiped     = (status === "completed" && room?.result === "lose") || allMembersDead;
  const finalWin       = status === "completed" && room?.result === "win";
  const floorCleared   = monsterKilled && !finalWin;

  let title, icon, btnLabel, btnColor;
  if (partyWiped) {
    const killer = room?.monster ? `${room.monster.icon}${room.monster.name}` : "怪物";
    icon = "💀"; title = `被《${killer}》擊殺！`; btnLabel = "查看結果"; btnColor = "bg-rose-600";
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
