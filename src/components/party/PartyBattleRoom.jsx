// src/components/party/PartyBattleRoom.jsx — 組隊打怪房間
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribePartyRoom, startPartyBattle, updateBattleMemberStats,
  submitArrows, processPartyRound, leavePartyRoom, partyHPRange,
  forceSkipPlayer, storeBattleRewards, claimBattleReward,
} from "../../lib/partyDb";
import { subscribePotions, usePotions, checkPartyBattleLimit, recordPartyBattleSession } from "../../lib/db";
import { MONSTERS, calcDamage, calcCounterDamage, calcArcherStats, TIER_LABEL, FAMILIES } from "../../lib/monsterData";
import { makeChests, CHEST_TYPES, getPotion, calcPotionBuffs, MAX_POTIONS_PER_BATTLE } from "../../lib/itemData";

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

function calcDmgFn(arrows, atk, monsterDEF) {
  return arrows.reduce((total, arrow) =>
    total + calcDamage({ score: arrow.score, archerATK: atk, monsterDEF, partMult: arrow.partMult || 1.0 }), 0);
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

export default function PartyBattleRoom({ roomId, isHost, onLeave }) {
  const { profile } = useAuth();
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
  const [partyBattleLeft, setPartyBattleLeft] = useState(null);
  const [startError,      setStartError]      = useState("");

  const statsWrittenRef   = useRef(false); // 戰鬥中寫入
  const statsWaitingRef   = useRef(false); // 等待室寫入
  const rewardStoredRef   = useRef(false); // 防重複存獎勵
  const processingRef     = useRef(false);
  const partyRecordedRef  = useRef(false); // 每日次數記錄（只記一次）
  const logEndRef         = useRef(null);

  const myId = profile?.id;

  useEffect(() => {
    const unsub = subscribePartyRoom(roomId, setRoom);
    return unsub;
  }, [roomId]);

  // 房主：進入等待室時預查今日剩餘次數
  useEffect(() => {
    if (!myId || !isHost) return;
    checkPartyBattleLimit(myId).then(setPartyBattleLeft);
  }, [myId, isHost]); // eslint-disable-line

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
    await claimBattleReward(roomId, myId, myChests);
    setClaiming(false);
  }
  function copyCode() {
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">選擇怪物</div>
              <button
                onClick={() => setSetupMonster(MONSTERS[Math.floor(Math.random() * MONSTERS.length)])}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/60 text-indigo-200 text-xs font-black rounded-lg active:scale-95 transition-transform">
                🎲 {setupMonster ? "重抽" : "隨機抽取"}
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {MONSTERS.map(m => {
                const tier = TIER_LABEL[m.tier];
                const fam  = FAMILIES[m.family];
                const { min, max } = partyHPRange(memberList.length);
                return (
                  <button key={m.id} onClick={() => setSetupMonster(m)}
                    className={`w-full text-left rounded-xl p-3 border-2 transition-all flex items-center gap-3 ${
                      setupMonster?.id === m.id ? "border-indigo-500 bg-indigo-900/40" : "border-slate-600 bg-slate-700/30"
                    }`}>
                    <span className="text-2xl">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-sm">{m.name}</div>
                      <div className="text-xs text-slate-400">
                        {fam?.label} · <span style={{ color: tier?.color }}>{tier?.label}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400 shrink-0">
                      <div>❤️ {Math.round(m.hp * min)}~{Math.round(m.hp * max)}</div>
                      <div>⚔️ {m.atk} 🛡️ {m.def}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {setupMonster && (() => {
              const { min, max } = partyHPRange(memberList.length);
              return (
                <div className="bg-indigo-900/40 border border-indigo-500/50 rounded-xl p-3 flex items-center justify-between text-sm">
                  <span className="text-indigo-200 font-black">{setupMonster.icon} {setupMonster.name}</span>
                  <span className="text-slate-400 text-xs">HP ×{min.toFixed(1)}~×{max.toFixed(1)}（開戰隨機）</span>
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

  // ── 戰鬥結束畫面 ──────────────────────────────────────────
  if (room.status === "completed") {
    const won = room.result === "win";
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center px-4 gap-5 ${
        won ? "bg-gradient-to-b from-yellow-900 to-slate-900" : "bg-gradient-to-b from-red-900 to-slate-900"
      }`}>
        <div className="text-6xl animate-bounce">{won ? "🏆" : "💀"}</div>
        <div className="text-2xl font-black text-white">{won ? "討伐成功！" : "全滅了…"}</div>

        {/* 隊員結果 */}
        <div className="bg-white/10 rounded-2xl p-4 w-full max-w-xs flex flex-col gap-2">
          {memberList.map(m => (
            <div key={m.id} className="flex items-center gap-2 text-sm text-white">
              <span>{m.alive ? "✅" : "💀"}</span>
              <span className={`font-bold ${m.id === myId ? "text-indigo-300" : ""}`}>{m.name}</span>
              <span className="ml-auto text-slate-400">{m.alive ? `${m.hp}/${m.maxHP}` : "陣亡"}</span>
            </div>
          ))}
        </div>

        {/* 勝利：各人領取寶箱 */}
        {won && (
          <div className="w-full max-w-xs flex flex-col gap-3">
            {!myClaimed && myChests.length > 0 && (
              <div className="bg-yellow-900/50 border-2 border-yellow-500 rounded-2xl p-4 flex flex-col gap-3">
                <div className="text-yellow-200 font-black text-sm text-center">🎁 你的戰利品</div>
                <div className="flex justify-center gap-3">
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
              <div className="text-emerald-400 font-black text-sm text-center">✅ 寶箱已入庫！</div>
            )}
            {won && !myChests.length && !room.rewardPending && (
              <div className="text-slate-400 text-xs text-center animate-pulse">等待房主發放獎勵…</div>
            )}
          </div>
        )}

        <button onClick={onLeave}
          className="px-8 py-3 bg-white text-slate-900 font-black rounded-2xl shadow-lg active:scale-95 transition-transform">
          🏠 返回
        </button>
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
        {room.monster && (
          <div className="bg-slate-800 rounded-2xl p-3 flex flex-col gap-2">
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
              className={`rounded-xl p-2.5 flex flex-col gap-1 ${
                !m.alive ? "bg-slate-800/40 opacity-50" :
                m.id === myId ? "bg-indigo-900/40 border border-indigo-500/50" : "bg-slate-700/40"
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

      {/* 戰鬥 Log（含每人明細）*/}
      {(room.log || []).length > 0 && (
        <div className="px-4 pb-6 flex flex-col gap-2 mt-2">
          <div className="text-xs font-black text-slate-500 uppercase tracking-widest">戰鬥記錄</div>
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
            {[...room.log].reverse().map((entry, i) => (
              <div key={i} className="bg-slate-800/70 rounded-xl p-3 text-xs text-slate-300 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-slate-400 font-black">
                  <span>第 {entry.round} 回合</span>
                  <span>怪物剩 <span className="text-yellow-300">{entry.monsterHPAfter}</span></span>
                </div>
                {(entry.playerLog || []).map((p, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <span className="text-indigo-300">🏹 {p.name}</span>
                    <span>造成 <span className="text-rose-400 font-black">{p.dmg}</span> 傷</span>
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
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
