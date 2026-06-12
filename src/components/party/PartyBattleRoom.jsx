// src/components/party/PartyBattleRoom.jsx — 組隊打怪房間
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribePartyRoom, startPartyBattle, updateBattleMemberStats,
  submitArrows, processPartyRound, leavePartyRoom, partyHPRange,
  forceSkipPlayer, storeBattleRewards, claimBattleReward, confirmBattleResult,
} from "../../lib/partyDb";
import { subscribePotions, usePotions, checkPartyBattleLimit, recordPartyBattleSession } from "../../lib/db";
import { sfxTap, sfxBuff, sfxEpic, sfxSuccess, sfxSoftFail, vibrate } from "../../lib/sound";
import { calcDamage, calcCounterDamage, calcArcherStats, calcArcherPower, drawMatchedMonsters, TIER_LABEL, FAMILIES } from "../../lib/monsterData";
import { makeChests, CHEST_TYPES, getPotion, calcPotionBuffs, MAX_POTIONS_PER_BATTLE } from "../../lib/itemData";
import PartyBattleCard from "./PartyBattleCard";
import { LOOT_TABLE_GUEST, drawLoot } from "../../lib/lootTable";

const SCORE_MAP    = { X:10, 10:10, 9:9, 8:8, 7:7, 6:6, 5:5, 4:4, 3:3, 2:2, 1:1, M:0 };
const SCORE_LABELS = ["X","10","9","8","7","6","5","4","3","M"];
const SCORE_COLORS = {
  X:"bg-yellow-400 text-yellow-900", 10:"bg-yellow-300 text-yellow-900",
  9:"bg-red-400 text-white", 8:"bg-red-300 text-white",
  7:"bg-blue-400 text-white", 6:"bg-blue-300 text-white",
  5:"bg-gray-500 text-white", 4:"bg-gray-400 text-white",
  3:"bg-gray-300 text-gray-800", 2:"bg-gray-200 text-gray-700",
  1:"bg-gray-100 text-gray-600", M:"bg-black/30 text-gray-300"
};
const ARROWS_PER_ROUND = 6;
const MODE_OPTIONS = [
  { id:"novice",  label:"新手", icon:"🌱" },
  { id:"student", label:"學生", icon:"📚" },
  { id:"veteran", label:"老手", icon:"🏹" },
];

// 依 profile 計算實際數值（帶入裝備 / 成就 / 報到次數）
function getArcherStats(profile, potionIds = []) {
  const base = calcArcherStats({ member: profile, certification: null, certRecords: [], dexStats: null });
  if (!potionIds.length) return base;
  const buffs = calcPotionBuffs(potionIds);
  return {
    hp:  Math.round(base.hp  * buffs.hpMult),
    atk: Math.round(base.atk * buffs.atkMult),
    def: base.def,
  };
}

// 裝備欄位計數
function equipSummary(profile) {
  const bows  = (profile?.equipment  || []).length;
  const armor = (profile?.armorSets  || []).reduce((s, set) =>
    s + Object.values(set).filter(v => v && typeof v === "string" && v.trim()).length, 0);
  const acc   = (profile?.accessorySets || []).reduce((s, set) =>
    s + Object.values(set).filter(Boolean).length, 0);
  return { bows, armor, acc };
}

// 回傳 { dmg, crits } — 隨機倍率 > 1.05 視為爆擊
function calcDmgFn(arrows, atk, monsterDEF) {
  let dmg = 0, crits = 0;
  for (const arrow of arrows) {
    const score = arrow.score ?? 0;
    if (!score) continue;
    const base = 8 + atk * 0.7 + score * 1.2 - monsterDEF * 0.35;
    const mult = 0.85 + Math.random() * 0.3;
    const d    = Math.max(1, Math.round(base * (arrow.partMult || 1.0) * mult));
    dmg  += d;
    if (mult > 1.05) crits++;
  }
  return { dmg, crits };
}
function calcCtrFn(monsterATK, archerDEF) {
  return calcCounterDamage({ monsterATK, archerDEF: archerDEF || 10, headStunned: false, isCrit: Math.random() < 0.1 });
}

function HPBar({ current, max, color = "#22c55e" }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct*100}%`, background: color }} />
    </div>
  );
}

// guestOverride = { id, name } — 訪客模式時傳入，覆蓋 profile.id
export default function PartyBattleRoom({ roomId, isHost, onLeave, guestOverride }) {
  const { profile: authProfile } = useAuth();
  const profile = guestOverride ? null : authProfile;
  const [room,            setRoom]            = useState(null);
  const [arrows,          setArrows]          = useState([]);
  const [submitting,      setSubmitting]      = useState(false);
  const [setupMonster,    setSetupMonster]    = useState(null);
  const [setupMode,       setSetupMode]       = useState("student");
  const [starting,        setStarting]        = useState(false);
  const [copied,          setCopied]          = useState(false);
  const [potionInv,       setPotionInv]       = useState({});
  const [selectedPotions, setSelectedPotions] = useState([]);
  const [claiming,        setClaiming]        = useState(false);
  const [skipping,        setSkipping]        = useState(null);
  const [confirming,      setConfirming]      = useState(false);
  const [partyBattleLeft, setPartyBattleLeft] = useState(null);
  const [startError,      setStartError]      = useState("");
  const [animHit,         setAnimHit]         = useState(false);
  const [animCounter,     setAnimCounter]     = useState(false);
  const [showEvent,       setShowEvent]       = useState(null);
  const [showFullLog,     setShowFullLog]     = useState(false);
  const [showShareCard,   setShowShareCard]   = useState(false);
  const [guestLoot,       setGuestLoot]       = useState(null);
  const [guestAlreadyWon, setGuestAlreadyWon] = useState(false);
  const [drawnMonsters,   setDrawnMonsters]   = useState([]);
  const [liveEntry,       setLiveEntry]       = useState(null);  // 正在逐人揭曉的回合
  const [liveRevealCount, setLiveRevealCount] = useState(0);     // 已揭曉幾位

  const statsWrittenRef   = useRef(false); // 戰鬥中寫入
  const statsWaitingRef   = useRef(false); // 等待室寫入
  const rewardStoredRef   = useRef(false); // 防重複存獎勵
  const processingRef     = useRef(false);
  const partyRecordedRef  = useRef(false); // 每日次數記錄（只記一次）
  const prevLogLenRef     = useRef(0);     // 動畫觸發用
  const revealTimersRef   = useRef([]);    // 逐人揭曉計時器
  const logEndRef         = useRef(null);

  const myId = guestOverride?.id || authProfile?.id;

  useEffect(() => {
    const unsub = subscribePartyRoom(roomId, setRoom);
    return unsub;
  }, [roomId]);

  // 房主：進入等待室時預查今日剩餘次數
  useEffect(() => {
    if (!myId || !isHost) return;
    checkPartyBattleLimit(myId).then(setPartyBattleLeft);
  }, [myId, isHost]); // eslint-disable-line

  // 房主：依自身戰力抽出 6 隻怪物候選（每族1隻）
  useEffect(() => {
    if (!isHost || !room || room.status !== "waiting" || drawnMonsters.length > 0) return;
    const stats = getArcherStats(profile);
    const power = calcArcherPower(stats);
    setDrawnMonsters(drawMatchedMonsters(power));
  }, [isHost, room?.status]); // eslint-disable-line

  // 戰鬥開始時所有人記錄一次（每人每場只記一次）
  useEffect(() => {
    if (!room || !myId || room.status !== "active" || partyRecordedRef.current) return;
    partyRecordedRef.current = true;
    recordPartyBattleSession(myId).catch(() => {});
    if (isHost) setPartyBattleLeft(l => Math.max(0, (l ?? 1) - 1));
  }, [room?.status]); // eslint-disable-line

  // 訂閱藥水庫存
  useEffect(() => {
    if (!myId) return;
    const unsub = subscribePotions(myId, setPotionInv);
    return unsub;
  }, [myId]);

  // 等待室就先寫入真實數值（讓所有人看到彼此的數值）
  useEffect(() => {
    if (!room || !myId || room.status !== "waiting" || statsWaitingRef.current) return;
    const me = room.members?.[myId];
    if (!me) return;
    statsWaitingRef.current = true;
    const stats = getArcherStats(profile);
    updateBattleMemberStats(roomId, myId, stats.hp, stats.hp, stats.atk, stats.def);
  }, [room?.status, myId]); // eslint-disable-line

  // 開戰後套入藥水 buff 重新寫入最終數值
  useEffect(() => {
    if (!room || !myId || room.status !== "active" || statsWrittenRef.current) return;
    const me = room.members?.[myId];
    if (!me) return;
    statsWrittenRef.current = true;
    const stats = getArcherStats(profile, selectedPotions);
    updateBattleMemberStats(roomId, myId, stats.hp, stats.hp, stats.atk, stats.def);
    if (selectedPotions.length > 0) usePotions(myId, selectedPotions).catch(() => {});
  }, [room?.status]); // eslint-disable-line

  // 房主：全員 ready → 自動計算
  useEffect(() => {
    if (!room || !isHost || room.status !== "active" || room.processing || processingRef.current) return;
    if (!room.monster) return;
    const members  = room.members || {};
    const aliveIds = Object.keys(members).filter(id => members[id].alive);
    if (aliveIds.length === 0) return;
    if (!aliveIds.every(id => members[id].ready)) return;
    processingRef.current = true;
    processPartyRound(roomId, room, calcDmgFn, calcCtrFn)
      .finally(() => { processingRef.current = false; });
  }, [room?.members, room?.processing]); // eslint-disable-line

  // 房主：勝利 → 存獎勵到 Firestore（每人一份獨立寶箱）
  useEffect(() => {
    if (!room || !isHost || room.result !== "win" || rewardStoredRef.current) return;
    if (room.rewardPending) return; // 已存過
    rewardStoredRef.current = true;
    const memberIds = Object.keys(room.members || {});
    storeBattleRewards(roomId, memberIds, room.monster).catch(() => {});
  }, [room?.result, room?.rewardPending]); // eslint-disable-line

  // 滾動 log 到底
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room?.log?.length]);

  // 回合更新：動畫 + 音效 + 事件先觸發 → 再逐人揭曉傷害（每 2 秒一位）
  useEffect(() => {
    const len = room?.log?.length || 0;
    if (len <= prevLogLenRef.current) return;
    prevLogLenRef.current = len;
    const entry = room.log[len - 1];
    if (!entry) return;

    // 清除上一回合的揭曉計時器
    revealTimersRef.current.forEach(t => clearTimeout(t));
    revealTimersRef.current = [];

    // 重置即時揭曉
    setLiveEntry(entry);
    setLiveRevealCount(0);

    // 怪物受擊動畫
    setAnimHit(true);
    setTimeout(() => setAnimHit(false), 700);

    // 音效（事件優先）
    if (entry.event?.type === "buff")   sfxBuff();
    else if (entry.totalDmg > 150)      sfxEpic();
    else                                sfxTap();
    vibrate(20);

    // 怪物反擊動畫 + 音效
    if (entry.counterRound) {
      setTimeout(() => { setAnimCounter(true); sfxSoftFail(); vibrate([0,30,40,30]); }, 500);
      setTimeout(() => setAnimCounter(false), 1100);
    }

    // 有突發事件：先顯示彈窗 3.5s，再揭曉傷害
    const eventDelay = entry.event ? 3500 : 0;
    if (entry.event) {
      setShowEvent(entry.event);
      const et = setTimeout(() => setShowEvent(null), 3500);
      revealTimersRef.current.push(et);
    }

    // 事件結束後每 2 秒揭曉一位玩家傷害
    const players = entry.playerLog || [];
    players.forEach((_, idx) => {
      const t = setTimeout(() => setLiveRevealCount(idx + 1), eventDelay + idx * 2000);
      revealTimersRef.current.push(t);
    });

    // 全部揭曉後 2.5s 清除 liveEntry（回到普通 log 顯示）
    const ct = setTimeout(
      () => setLiveEntry(null),
      eventDelay + players.length * 2000 + 2500
    );
    revealTimersRef.current.push(ct);
  }, [room?.log?.length]); // eslint-disable-line

  // 勝敗音效
  useEffect(() => {
    if (room?.result === "win")  { sfxSuccess(); setTimeout(() => sfxEpic(), 350); }
    if (room?.result === "lose") { sfxSoftFail(); }
  }, [room?.result]); // eslint-disable-line

  // 訪客組隊勝利：抽取紀念獎勵（sessionStorage 確保每位訪客只領一次）
  useEffect(() => {
    if (!room || room.status !== "completed" || room.result !== "win") return;
    if (!myId?.startsWith("guest")) return;
    const already = sessionStorage.getItem("guest_party_won");
    if (already) {
      setGuestAlreadyWon(true);
    } else {
      const loot = drawLoot(LOOT_TABLE_GUEST, "party", "common");
      setGuestLoot(loot);
      sessionStorage.setItem("guest_party_won", "1");
    }
  }, [room?.status, room?.result]); // eslint-disable-line

  if (!room) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-lg font-bold animate-pulse">載入中…</div>
    </div>
  );

  const members    = room.members || {};
  const memberList = Object.entries(members).map(([id, data]) => ({ id, ...data }));
  const me         = members[myId] || {};
  const aliveCount = memberList.filter(m => m.alive).length;
  const myReady    = me.ready || false;
  const isGuestPlayer = myId?.startsWith("guest");
  const myChests   = room.rewardPending?.[myId] || [];
  const myClaimed  = (room.rewardClaimed || []).includes(myId);

  function addArrow(label) {
    if (arrows.length >= ARROWS_PER_ROUND || myReady) return;
    setArrows(prev => [...prev, { score: SCORE_MAP[label] ?? 0, partMult: 1.0, label }]);
  }
  function removeLastArrow() {
    if (myReady) return;
    setArrows(prev => prev.slice(0, -1));
  }
  async function handleSubmit() {
    if (arrows.length < ARROWS_PER_ROUND || myReady || submitting) return;
    setSubmitting(true);
    await submitArrows(roomId, myId, arrows);
    setArrows([]);
    setSubmitting(false);
  }
  async function handleStart() {
    if (!setupMonster || starting) return;
    if (memberList.length < 2) {
      setStartError("組隊打怪至少需要 2 位玩家！");
      return;
    }
    if (partyBattleLeft !== null && partyBattleLeft <= 0) {
      setStartError("今日組隊打怪次數已達上限（5次）");
      return;
    }
    setStartError("");
    setStarting(true);
    await startPartyBattle(roomId, room, setupMonster, setupMode, "preset", 18);
    setStarting(false);
  }
  async function handleLeave() {
    await leavePartyRoom(roomId, myId, isHost);
    onLeave();
  }
  async function handleForceSkip(targetId) {
    if (skipping) return;
    setSkipping(targetId);
    await forceSkipPlayer(roomId, targetId);
    setSkipping(null);
  }
  async function handleClaim() {
    if (!myChests.length || claiming) return;
    setClaiming(true);
    const myDmg = (room.log || []).reduce((s, entry) => {
      const p = (entry.playerLog || []).find(p => p.id === myId);
      return s + (p?.dmg || 0);
    }, 0);
    await claimBattleReward(roomId, myId, myChests, room.monster?.id, room.result, myDmg);
    setClaiming(false);
  }
  async function handleConfirmResult() {
    if (!isHost || confirming) return;
    setConfirming(true);
    await confirmBattleResult(roomId);
    setConfirming(false);
  }
  function copyCode() {
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  function handleRedrawMonsters() {
    const stats = getArcherStats(profile);
    const power = calcArcherPower(stats);
    setDrawnMonsters(drawMatchedMonsters(power));
    setSetupMonster(null);
  }

  const tierInfo = room.monster ? TIER_LABEL[room.monster.tier] : null;
  const famInfo  = room.monster ? FAMILIES[room.monster.family] : null;
  const myStats  = getArcherStats(profile);
  const myEquip  = equipSummary(profile);

  // ── 等待/大廳畫面 ──────────────────────────────────────────
  if (room.status === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col px-4 py-6 gap-5 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-black text-lg">⚔️ 組隊打怪</div>
            <button onClick={copyCode} className="text-sm flex items-center gap-1 mt-0.5 active:opacity-70">
              <span className="font-mono tracking-widest text-indigo-300">{room.code}</span>
              <span>{copied ? "✅" : "📋"}</span>
            </button>
          </div>
          <button onClick={handleLeave} className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs font-bold rounded-lg">離開</button>
        </div>

        {/* 隊員列表（含數值）*/}
        <div className="bg-slate-700/40 rounded-2xl p-4 flex flex-col gap-3">
          <div className="text-xs font-black text-slate-400 uppercase tracking-widest">隊員 {memberList.length}/8</div>
          {memberList.map(m => {
            const isMe = m.id === myId;
            return (
              <div key={m.id} className={`rounded-xl p-3 flex flex-col gap-1.5 ${isMe ? "bg-indigo-900/40 border border-indigo-500/30" : "bg-slate-700/30"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{m.id === room.hostId ? "👑" : "🏹"}</span>
                  <span className={`font-black text-sm ${isMe ? "text-indigo-300" : "text-white"}`}>
                    {m.name}{isMe ? " (我)" : ""}
                  </span>
                </div>
                {m.maxHP > 0 && (
                  <div className="flex gap-3 text-xs text-slate-400 flex-wrap">
                    <span>❤️ {m.maxHP}</span>
                    <span>⚔️ {m.atk}</span>
                    <span>🛡️ {m.def}</span>
                  </div>
                )}
                {isMe && (
                  <div className="flex gap-2 text-xs text-slate-500 flex-wrap mt-0.5">
                    {myEquip.bows  > 0 && <span>🏹 {myEquip.bows}弓組</span>}
                    {myEquip.armor > 0 && <span>🛡️ {myEquip.armor}護具</span>}
                    {myEquip.acc   > 0 && <span>💎 {myEquip.acc}飾品</span>}
                  </div>
                )}
              </div>
            );
          })}
          {memberList.length < 8 && (
            <div className="text-slate-500 text-xs text-center py-1">等待夥伴加入…</div>
          )}
        </div>

        {/* 藥水選擇（自己的庫存）*/}
        {Object.values(potionInv).some(v => v > 0) && (
          <div className="bg-slate-700/40 rounded-2xl p-4 flex flex-col gap-2">
            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
              開戰前選擇藥水（最多 {MAX_POTIONS_PER_BATTLE} 瓶）
            </div>
            <div className="flex flex-col gap-1.5">
              {Object.entries(potionInv).filter(([, c]) => c > 0).map(([pid, count]) => {
                const p = getPotion(pid);
                if (!p) return null;
                const selected = selectedPotions.includes(pid);
                return (
                  <button key={pid}
                    onClick={() => {
                      if (selected) setSelectedPotions(prev => prev.filter(id => id !== pid));
                      else if (selectedPotions.length < MAX_POTIONS_PER_BATTLE)
                        setSelectedPotions(prev => [...prev, pid]);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all text-sm ${
                      selected ? "border-indigo-400 bg-indigo-900/40" : "border-slate-600 bg-slate-700/30"
                    }`}>
                    <span className="text-xl">{p.icon}</span>
                    <div className="flex-1">
                      <div className={`font-bold text-xs ${selected ? "text-indigo-200" : "text-white"}`}>{p.name}</div>
                      <div className="text-xs text-slate-400">{p.effectText}</div>
                    </div>
                    <span className="text-xs text-slate-500">×{count}</span>
                    {selected && <span className="text-indigo-400">✅</span>}
                  </button>
                );
              })}
            </div>
            {selectedPotions.length > 0 && (
              <div className="text-xs text-indigo-300 font-bold mt-1">
                已選：{selectedPotions.map(pid => getPotion(pid)?.name).join("、")}
              </div>
            )}
          </div>
        )}

        {/* 怪物選擇（房主）*/}
        {isHost && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              {MODE_OPTIONS.map(m => (
                <button key={m.id} onClick={() => setSetupMode(m.id)}
                  className={`py-2.5 rounded-xl text-sm font-black border transition-all ${
                    setupMode === m.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-700 text-slate-300 border-slate-600"
                  }`}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">系統抽出候選怪物（六族各1）</div>
              <button onClick={handleRedrawMonsters}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/60 text-indigo-200 text-xs font-black rounded-lg active:scale-95 transition-transform">
                🎲 重新抽取
              </button>
            </div>

            {drawnMonsters.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-4 animate-pulse">抽取中…</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {drawnMonsters.map(m => {
                  const tier = TIER_LABEL[m.tier];
                  const fam  = FAMILIES[m.family];
                  const ms   = setupMode === "novice" ? 1.5 : setupMode === "student" ? 2.0 : 4.0;
                  const atkM = setupMode === "veteran" ? 2 : 1;
                  const { min, max } = partyHPRange(memberList.length);
                  return (
                    <button key={m.id} onClick={() => setSetupMonster(m)}
                      className={`text-left rounded-xl p-3 border-2 transition-all flex flex-col gap-1 ${
                        setupMonster?.id === m.id ? "border-indigo-500 bg-indigo-900/40" : "border-slate-600 bg-slate-700/30"
                      }`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl">{m.icon}</span>
                        <span className="text-white font-bold text-sm leading-tight truncate">{m.name}</span>
                        {setupMonster?.id === m.id && <span className="ml-auto text-indigo-400 shrink-0">✅</span>}
                      </div>
                      <div className="text-xs" style={{ color: tier?.color }}>{tier?.label}</div>
                      <div className="text-xs text-slate-500">{fam?.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        ❤️ {Math.round(m.hp * ms * min)}~{Math.round(m.hp * ms * max)}
                      </div>
                      <div className="text-xs text-slate-500">
                        ⚔️ {Math.round(m.atk * atkM)} 🛡️ {Math.round(m.def * atkM)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {setupMonster && (() => {
              const ms  = setupMode === "novice" ? 1.5 : setupMode === "student" ? 2.0 : 4.0;
              const { min, max } = partyHPRange(memberList.length);
              return (
                <div className="bg-indigo-900/40 border border-indigo-500/50 rounded-xl p-3 flex items-center justify-between text-sm">
                  <span className="text-indigo-200 font-black">{setupMonster.icon} {setupMonster.name}</span>
                  <span className="text-slate-400 text-xs">
                    HP {Math.round(setupMonster.hp * ms * min)}~{Math.round(setupMonster.hp * ms * max)}
                  </span>
                </div>
              );
            })()}

            {/* 剩餘次數 & 防呆訊息 */}
            {partyBattleLeft !== null && (
              <div className={`flex items-center gap-1.5 text-xs font-bold ${partyBattleLeft > 0 ? "text-emerald-400" : "text-red-400"}`}>
                <span>{partyBattleLeft > 0 ? "⚔️" : "😴"}</span>
                <span>今日組隊剩餘 {partyBattleLeft}/5 次</span>
              </div>
            )}
            {startError && (
              <div className="bg-red-900/50 border border-red-500/50 rounded-xl px-3 py-2 text-red-300 text-xs font-bold text-center">
                {startError}
              </div>
            )}
            <button onClick={handleStart}
              disabled={!setupMonster || starting || memberList.length < 2 || (partyBattleLeft !== null && partyBattleLeft <= 0)}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-orange-500 text-white font-black text-base rounded-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-50">
              {starting ? "開始中…"
                : memberList.length < 2 ? `⚔️ 等待更多玩家（${memberList.length}/2）`
                : `⚔️ 開始戰鬥（${memberList.length}人）`}
            </button>
          </div>
        )}
        {!isHost && (
          <div className="text-center text-slate-400 text-sm py-8 animate-pulse">
            等待房主選擇怪物並開始戰鬥…
          </div>
        )}
      </div>
    );
  }

  // ── 怪物死亡確認畫面（房主按下才正式結算）───────────────────
  if (room.status === "pending_confirm") {
    const lastEntry = room.log?.[room.log.length - 1];
    return (
      <div className="min-h-screen bg-gradient-to-b from-yellow-950 to-slate-900 flex flex-col items-center justify-center px-4 gap-6">
        <div className="text-7xl animate-bounce">💥</div>
        <div className="text-2xl font-black text-yellow-300 text-center">
          {room.monster?.name} 已倒下！
        </div>
        {lastEntry && (
          <div className="bg-white/10 rounded-2xl px-5 py-3 text-center">
            <div className="text-slate-400 text-xs mb-1">最終回合共造成</div>
            <div className="text-3xl font-black text-rose-400">{lastEntry.totalDmg}</div>
            <div className="text-slate-300 text-xs">點傷害</div>
          </div>
        )}
        {isHost ? (
          <button onClick={handleConfirmResult} disabled={confirming}
            className="w-full max-w-xs py-5 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 font-black text-xl rounded-2xl shadow-xl active:scale-95 transition-transform disabled:opacity-50 animate-pulse">
            {confirming ? "確認中…" : "🏆 確認討伐！進入結算"}
          </button>
        ) : (
          <div className="text-slate-300 text-sm animate-pulse font-bold">
            等待房主確認結算…
          </div>
        )}
      </div>
    );
  }

  // ── 戰鬥結算畫面 ──────────────────────────────────────────
  if (room.status === "completed") {
    const won = room.result === "win";

    // 從戰鬥 log 彙總各人數據
    const statsMap = {};
    (room.log || []).forEach(entry => {
      (entry.playerLog || []).forEach(p => {
        if (!statsMap[p.id]) statsMap[p.id] = { name: p.name, dmgDealt: 0, dmgRecvd: 0, crits: 0 };
        statsMap[p.id].dmgDealt += p.dmg   || 0;
        statsMap[p.id].dmgRecvd += p.ctr   || 0;
        statsMap[p.id].crits    += p.crits || 0;
      });
    });
    // 補上沒有 log 的成員（可能全程觀戰）
    memberList.forEach(m => {
      if (!statsMap[m.id]) statsMap[m.id] = { name: m.name, dmgDealt: 0, dmgRecvd: 0, crits: 0 };
    });
    const statsList = Object.entries(statsMap).map(([id, s]) => ({
      id, ...s,
      maxHP: members[id]?.maxHP || 0,
      atk:   members[id]?.atk   || 0,
      def:   members[id]?.def   || 0,
    })).sort((a, b) => b.dmgDealt - a.dmgDealt);
    const mvpId = statsList[0]?.dmgDealt > 0 ? statsList[0].id : null;

    return (
      <div className={`min-h-screen flex flex-col px-4 py-6 gap-4 max-w-lg mx-auto overflow-y-auto ${
        won ? "bg-gradient-to-b from-yellow-900 to-slate-900" : "bg-gradient-to-b from-red-900 to-slate-900"
      }`}>
        {/* 標題 */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <div className="text-6xl">{won ? "🏆" : "💀"}</div>
          <div className="text-2xl font-black text-white">{won ? "討伐成功！" : "全滅了…"}</div>
          {room.monster && (
            <div className="text-slate-400 text-sm">
              {room.monster.icon} {room.monster.name} · {room.log?.length || 0} 回合
            </div>
          )}
        </div>

        {/* 詳細戰績表 */}
        <div className="bg-white/10 rounded-2xl overflow-hidden">
          <div className="px-4 py-2 bg-white/5 text-xs font-black text-slate-400 uppercase tracking-widest">
            戰鬥詳情
          </div>
          {statsList.map(s => {
            const isMvp = s.id === mvpId && won;
            const isMe  = s.id === myId;
            return (
              <div key={s.id}
                className={`px-4 py-3 border-t border-white/5 flex flex-col gap-1.5 ${
                  isMvp ? "bg-yellow-500/20" : ""
                }`}>
                <div className="flex items-center gap-2">
                  {isMvp && <span className="text-yellow-400 text-xs font-black bg-yellow-500/30 px-2 py-0.5 rounded-full">👑 MVP</span>}
                  <span className={`font-black text-sm ${isMe ? "text-indigo-300" : "text-white"}`}>
                    {s.name}{isMe ? " (我)" : ""}
                  </span>
                  <span className="ml-auto text-xs text-slate-400">
                    {members[s.id]?.alive ? "✅ 存活" : "💀 陣亡"}
                  </span>
                </div>
                <div className="flex gap-3 text-xs flex-wrap">
                  <span className="text-rose-400 font-bold">⚔️ 造成 {s.dmgDealt}</span>
                  <span className="text-orange-400">🛡️ 承受 {s.dmgRecvd}</span>
                  {s.crits > 0 && <span className="text-yellow-300">✨ 爆擊 {s.crits} 次</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 完整戰鬥紀錄（可展開）*/}
        {(room.log || []).length > 0 && (
          <div className="bg-white/10 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowFullLog(v => !v)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-black text-slate-300 active:opacity-70">
              <span>📜 完整戰鬥紀錄（{room.log.length} 回合）</span>
              <span>{showFullLog ? "▲" : "▼"}</span>
            </button>
            {showFullLog && (
              <div className="flex flex-col gap-2 px-4 pb-4 max-h-72 overflow-y-auto">
                {room.log.map((entry, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3 text-xs text-slate-300 flex flex-col gap-1.5">
                    <div className="flex justify-between font-black text-slate-400">
                      <span>第 {entry.round} 回合 · 總傷 {entry.totalDmg}</span>
                      <span>{entry.monsterHPBefore} → <span className="text-yellow-300">{entry.monsterHPAfter}</span></span>
                    </div>
                    {entry.event && (
                      <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${
                        entry.event.type === "buff"   ? "bg-emerald-900/40 text-emerald-300" :
                        entry.event.type === "debuff" ? "bg-red-900/40 text-red-300"
                                                      : "bg-yellow-900/40 text-yellow-300"
                      }`}>
                        {entry.event.icon} {entry.event.title}：{entry.event.desc}
                      </div>
                    )}
                    {(entry.playerLog || []).map((p, j) => (
                      <div key={j} className="flex items-center gap-2 text-[11px]">
                        <span className="text-indigo-300">🏹 {p.name}</span>
                        <span className="text-rose-400 font-black">+{p.dmg}</span>
                        {p.crits > 0 && <span className="text-yellow-300">✨{p.crits}</span>}
                        {entry.counterRound && p.ctr > 0 && <span className="text-orange-400 ml-auto">-{p.ctr}</span>}
                      </div>
                    ))}
                    {entry.counterRound && <div className="text-orange-300 text-[10px]">💥 反擊回合</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 勝利：領取寶箱 */}
        {won && (
          <div className="flex flex-col gap-3">
            {isGuestPlayer ? (
              /* 訪客：無背包，直接顯示紀念獎勵 */
              guestAlreadyWon ? (
                <div className="bg-slate-700/50 border border-slate-600 rounded-2xl p-4 text-center">
                  <div className="text-2xl mb-2">🎮</div>
                  <div className="text-slate-300 font-black text-sm">感謝體驗組隊打怪！</div>
                  <div className="text-slate-500 text-xs mt-1">此次不提供額外獎勵（每位訪客限領一次）</div>
                </div>
              ) : guestLoot ? (
                <div className="bg-yellow-900/50 border-2 border-yellow-500 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="text-yellow-200 font-black text-sm text-center">🎁 體驗獎勵</div>
                  <div className="flex flex-col items-center gap-2 py-2">
                    <span className="text-5xl">{guestLoot.icon}</span>
                    <span className="text-white font-black text-base">{guestLoot.name}</span>
                    <span className="text-slate-300 text-xs text-center px-4">{guestLoot.desc}</span>
                  </div>
                  <div className="bg-yellow-500/20 rounded-xl p-2 text-center text-yellow-300 text-xs font-bold">
                    📸 請截圖後出示給教練領取！
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-xs text-center animate-pulse">計算獎勵中…</div>
              )
            ) : (
              /* 一般會員：正常寶箱領取流程 */
              <>
                {!myClaimed && myChests.length > 0 && (
                  <div className="bg-yellow-900/50 border-2 border-yellow-500 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="text-yellow-200 font-black text-sm text-center">🎁 你的戰利品</div>
                    <div className="flex justify-center gap-3 flex-wrap">
                      {myChests.map(c => {
                        const info = CHEST_TYPES[c.type];
                        return info ? (
                          <div key={c.id} className="flex flex-col items-center gap-1">
                            <span className="text-3xl">{info.icon}</span>
                            <span className="text-xs text-white font-bold">{info.name}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                    <button onClick={handleClaim} disabled={claiming}
                      className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-slate-900 font-black rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                      {claiming ? "領取中…" : "✅ 確認領取寶箱"}
                    </button>
                  </div>
                )}
                {myClaimed && (
                  <div className="bg-emerald-900/40 border border-emerald-500 rounded-2xl p-3 text-emerald-400 font-black text-sm text-center">
                    ✅ 寶箱已入庫！
                  </div>
                )}
                {!myChests.length && !room.rewardPending && !myClaimed && (
                  <div className="text-slate-400 text-xs text-center animate-pulse">等待房主發放獎勵…</div>
                )}
              </>
            )}
          </div>
        )}

        {/* 分享戰績小卡 */}
        <button onClick={() => setShowShareCard(true)}
          className="w-full py-3 bg-slate-700 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-transform border border-slate-500">
          📤 分享戰績小卡
        </button>

        <button onClick={onLeave}
          className="w-full py-3 bg-white text-slate-900 font-black rounded-2xl shadow-lg active:scale-95 transition-transform">
          🏠 返回
        </button>

        {showShareCard && (
          <PartyBattleCard
            onClose={() => setShowShareCard(false)}
            partyData={{
              monster:   room.monster,
              statsList,
              mvpId,
              result:    room.result,
              rounds:    room.log?.length || 0,
            }}
          />
        )}
      </div>
    );
  }

  // ── 戰鬥中畫面 ────────────────────────────────────────────
  const monsterPct     = room.monsterMaxHP > 0 ? (room.monsterHP / room.monsterMaxHP) : 0;
  const myArrowTotal   = arrows.reduce((s, a) => s + a.score, 0);
  const isCounterRound = (room.round || 1) % 2 === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col max-w-lg mx-auto">
      {/* 頂部 */}
      <div className="px-4 pt-5 pb-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white font-black">第 {room.round} 回合</span>
            <span className="text-xs text-slate-400 ml-2">
              {isCounterRound ? "⚠️ 此回合怪物反擊！" : "（下回合反擊）"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">{aliveCount}/{memberList.length} 存活</span>
            <button onClick={handleLeave} className="px-2.5 py-1 bg-slate-700 text-slate-400 text-xs rounded-lg">離開</button>
          </div>
        </div>

        {/* 怪物 HP */}
        {/* 隨機事件彈窗 */}
        {showEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-6">
            <div className={`rounded-2xl shadow-2xl p-5 text-center max-w-xs w-full border-4 ${
              showEvent.type === "buff"    ? "bg-emerald-50 border-emerald-400"
            : showEvent.type === "debuff" ? "bg-red-50 border-red-400"
            : "bg-yellow-50 border-yellow-400"
            }`}>
              <div className="text-5xl mb-2">{showEvent.icon}</div>
              <div className={`font-black text-lg mb-1 ${
                showEvent.type === "buff" ? "text-emerald-700" :
                showEvent.type === "debuff" ? "text-red-700" : "text-yellow-700"
              }`}>{showEvent.title}</div>
              <div className="text-gray-600 text-sm leading-relaxed">{showEvent.desc}</div>
            </div>
          </div>
        )}

        {room.monster && (
          <div className={`rounded-2xl p-3 flex flex-col gap-2 transition-all duration-300 ${
            animHit ? "bg-orange-800/70 scale-[1.01]" : "bg-slate-800"
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{room.monster.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-black text-sm">{room.monster.name}</span>
                  {tierInfo && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: tierInfo.color, background: tierInfo.bg }}>{tierInfo.label}</span>}
                </div>
                <div className="text-xs text-slate-400">{famInfo?.label} · ⚔️{room.monster.atk} 🛡️{room.monster.def}</div>
              </div>
              <div className="text-right text-sm font-black text-white">
                {room.monsterHP} / {room.monsterMaxHP}
              </div>
            </div>
            <HPBar current={room.monsterHP} max={room.monsterMaxHP}
              color={monsterPct > 0.5 ? "#22c55e" : monsterPct > 0.25 ? "#f59e0b" : "#ef4444"} />
          </div>
        )}

        {/* 隊員 HP */}
        <div className="grid grid-cols-2 gap-2">
          {memberList.map(m => (
            <div key={m.id}
              className={`rounded-xl p-2.5 flex flex-col gap-1 transition-all duration-300 ${
                !m.alive        ? "bg-slate-800/40 opacity-50" :
                animCounter     ? "bg-red-900/60 border border-red-500/50" :
                m.id === myId   ? "bg-indigo-900/40 border border-indigo-500/50"
                                : "bg-slate-700/40"
              }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold truncate ${m.id === myId ? "text-indigo-300" : "text-white"}`}>
                  {m.alive ? "" : "💀"}{m.name}
                </span>
                <span className="text-xs text-slate-400 ml-1 shrink-0">{m.hp}/{m.maxHP}</span>
              </div>
              <HPBar current={m.hp} max={m.maxHP} color={m.id === myId ? "#818cf8" : "#64748b"} />
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-slate-500">⚔️{m.atk} 🛡️{m.def}</span>
                {m.alive && (
                  <span className="text-[10px] text-slate-500">
                    {m.ready ? (m.skipped ? "⏭️ 跳過" : "✅ 送出") : m.arrows?.length > 0 ? `🏹 ${m.arrows.length}支` : "等待…"}
                  </span>
                )}
              </div>
              {isHost && m.alive && !m.ready && m.id !== myId && !room.processing && (
                <button onClick={() => handleForceSkip(m.id)} disabled={skipping === m.id}
                  className="text-[9px] px-1.5 py-0.5 bg-slate-600 text-slate-300 rounded font-bold self-end active:scale-95 disabled:opacity-40">
                  {skipping === m.id ? "…" : "跳過"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 箭分輸入（自己存活且未 ready）*/}
      {me.alive && !myReady && (
        <div className="px-4 flex flex-col gap-3 pb-4">
          <div className="flex gap-1.5 items-center">
            <div className="text-xs text-slate-400 w-8 shrink-0">{arrows.length}/{ARROWS_PER_ROUND}</div>
            <div className="flex gap-1 flex-1 flex-wrap">
              {arrows.map((a, i) => (
                <span key={i} className={`text-xs font-black px-2 py-0.5 rounded-full ${SCORE_COLORS[a.label] || "bg-slate-600 text-white"}`}>
                  {a.label}
                </span>
              ))}
              {Array.from({ length: ARROWS_PER_ROUND - arrows.length }).map((_, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-500">○</span>
              ))}
            </div>
            <div className="text-xs font-black text-white shrink-0">{myArrowTotal}分</div>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {SCORE_LABELS.map(label => (
              <button key={label} onClick={() => addArrow(label)}
                disabled={arrows.length >= ARROWS_PER_ROUND}
                className={`py-3 rounded-xl font-black text-sm ${SCORE_COLORS[label] || "bg-slate-600 text-white"} disabled:opacity-40 active:scale-90 transition-transform`}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={removeLastArrow} disabled={arrows.length === 0}
              className="flex-1 py-2.5 bg-slate-700 text-slate-300 font-bold rounded-xl text-sm disabled:opacity-30 active:scale-95">
              ← 撤銷
            </button>
            <button onClick={handleSubmit} disabled={arrows.length < ARROWS_PER_ROUND || submitting}
              className="flex-1 py-2.5 bg-indigo-600 text-white font-black rounded-xl text-sm disabled:opacity-40 active:scale-95 transition-transform">
              {submitting ? "送出中…" : `✅ 送出 (${myArrowTotal}分)`}
            </button>
          </div>
        </div>
      )}

      {me.alive && myReady && (
        <div className="px-4 py-3 text-center text-emerald-400 font-black text-sm">
          ✅ 已送出，等待其他隊員…
          {room.processing && <span className="ml-2 text-yellow-400 animate-pulse">⚙️ 計算中…</span>}
        </div>
      )}
      {!me.alive && room.status === "active" && (
        <div className="px-4 py-6 text-center text-slate-500 font-black text-sm">
          💀 你已陣亡，觀戰中…
        </div>
      )}

      {/* 即時回合揭曉面板 */}
      {liveEntry && (
        <div className="px-4 pb-2 mt-1">
          <div className="bg-slate-800/95 rounded-2xl p-4 flex flex-col gap-2 border border-slate-600/60">
            <div className="flex items-center justify-between text-xs font-black text-slate-400">
              <span>⚔️ 第 {liveEntry.round} 回合結算</span>
              <span>怪物剩 <span className="text-yellow-300 text-sm font-black">{liveEntry.monsterHPAfter}</span></span>
            </div>
            {liveEntry.event && (
              <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1.5 rounded-lg ${
                liveEntry.event.type === "buff"   ? "bg-emerald-900/50 text-emerald-300" :
                liveEntry.event.type === "debuff" ? "bg-red-900/50 text-red-300"
                                                 : "bg-yellow-900/50 text-yellow-300"
              }`}>
                <span>{liveEntry.event.icon}</span>
                <span className="font-black">{liveEntry.event.title}</span>
                <span className="opacity-70">：{liveEntry.event.desc}</span>
              </div>
            )}
            {(liveEntry.playerLog || []).slice(0, liveRevealCount).map((p, j) => (
              <div key={j} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/5">
                <span className="text-indigo-300 font-black text-sm">🏹 {p.name}</span>
                <span className="text-slate-400 text-xs">造成</span>
                <span className="text-rose-400 font-black text-xl">{p.dmg}</span>
                <span className="text-slate-500 text-xs">傷</span>
                {p.crits > 0 && <span className="text-yellow-300 text-xs">✨×{p.crits}</span>}
                {liveEntry.counterRound && p.ctr > 0 && (
                  <span className="text-orange-400 text-xs ml-auto">受到 -{p.ctr}</span>
                )}
              </div>
            ))}
            {liveRevealCount > 0 && liveRevealCount < (liveEntry.playerLog || []).length && (
              <div className="text-slate-600 text-xs text-center animate-pulse py-1">▶ 下一位…</div>
            )}
            {liveRevealCount >= (liveEntry.playerLog || []).length && liveRevealCount > 0 && (
              <>
                <div className="flex items-center justify-between text-sm pt-1.5 border-t border-white/10 mt-1">
                  <span className="text-slate-400 font-bold">🗡️ 本回合總傷</span>
                  <span className="text-rose-400 font-black text-xl">{liveEntry.totalDmg}</span>
                </div>
                {liveEntry.counterRound && (
                  <div className="text-orange-300 font-bold text-xs">💥 怪物反擊！</div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 戰鬥 Log（含每人明細）*/}
      {(room.log || []).length > 0 && (
        <div className="px-4 pb-6 flex flex-col gap-2 mt-2">
          <div className="text-xs font-black text-slate-500 uppercase tracking-widest">戰鬥記錄</div>
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
            {[...room.log].reverse().map((entry, i) => {
              if (i === 0 && liveEntry) return null; // 揭曉中跳過，避免重複
              return (
              <div key={i} className="bg-slate-800/70 rounded-xl p-3 text-xs text-slate-300 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-slate-400 font-black">
                  <span>第 {entry.round} 回合</span>
                  <span>怪物剩 <span className="text-yellow-300">{entry.monsterHPAfter}</span></span>
                </div>
                {/* 事件 */}
                {entry.event && (
                  <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg ${
                    entry.event.type === "buff"    ? "bg-emerald-900/40 text-emerald-300" :
                    entry.event.type === "debuff"  ? "bg-red-900/40 text-red-300"
                                                   : "bg-yellow-900/40 text-yellow-300"
                  }`}>
                    <span>{entry.event.icon}</span>
                    <span>{entry.event.title}</span>
                  </div>
                )}
                {(entry.playerLog || []).map((p, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <span className="text-indigo-300">🏹 {p.name}</span>
                    <span>造成 <span className="text-rose-400 font-black">{p.dmg}</span> 傷</span>
                    {p.crits > 0 && <span className="text-yellow-300 text-[10px]">✨×{p.crits}</span>}
                    {entry.counterRound && p.ctr > 0 && (
                      <span className="text-orange-400 ml-auto">受到 -{p.ctr}</span>
                    )}
                  </div>
                ))}
                {entry.counterRound && (
                  <div className="text-orange-300 font-bold border-t border-white/10 pt-1 mt-0.5">
                    💥 怪物反擊！
                  </div>
                )}
              </div>
            ); })}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
