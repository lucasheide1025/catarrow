// src/components/party/PartyBattleRoom.jsx — 組隊打怪房間
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribePartyRoom, startPartyBattle, updateBattleMemberStats,
  submitArrows, processPartyRound, leavePartyRoom, partyHPMult, forceSkipPlayer
} from "../../lib/partyDb";
import { addChests } from "../../lib/db";
import { MONSTERS, calcDamage, calcCounterDamage, calcArcherStats, TIER_LABEL, FAMILIES } from "../../lib/monsterData";
import { makeChests } from "../../lib/itemData";
import { CHEST_TYPES } from "../../lib/itemData";

// 箭分輸入值（X=10, M=0）
const SCORE_MAP = { X:10, 10:10, 9:9, 8:8, 7:7, 6:6, 5:5, 4:4, 3:3, 2:2, 1:1, M:0 };
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

// 簡化版射手數值（不需要檢定/圖鑑就能算）
function simpleArcherStats(member) {
  const hp  = Math.min(400, 100 + Math.min(30, Math.floor((member?.dailyQuestCount||0)/4)));
  const atk = Math.min(160, 15 + Math.min(30, Math.floor((member?.dailyQuestCount||0)/5)));
  const def = Math.min(120, 10);
  return { hp, atk, def };
}

function calcDmgFn(arrows, atk, monsterDEF) {
  return arrows.reduce((total, arrow) => {
    return total + calcDamage({ score: arrow.score, archerATK: atk, monsterDEF, partMult: arrow.partMult || 1.0 });
  }, 0);
}
function calcCtrFn(monsterATK, archerDEF) {
  return calcCounterDamage({ monsterATK, archerDEF: archerDEF || 10, headStunned: false, isCrit: Math.random() < 0.1 });
}

// HP 條
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
  const [room, setRoom] = useState(null);
  const [arrows, setArrows] = useState([]); // { score, partMult }[]
  const [submitting, setSubmitting] = useState(false);
  const [setupMonster, setSetupMonster] = useState(null);
  const [setupMode, setSetupMode] = useState("student");
  const [setupDistance, setSetupDistance] = useState(18);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wonChests, setWonChests] = useState([]);
  const [skipping, setSkipping] = useState(null); // 正在強制跳過的 memberId
  const statsWritten  = useRef(false);
  const processingRef = useRef(false); // 防止 useEffect 在同一幀觸發兩次
  const logEndRef = useRef(null);

  const myId = profile?.id;

  useEffect(() => {
    const unsub = subscribePartyRoom(roomId, setRoom);
    return unsub;
  }, [roomId]);

  // 當戰鬥開始，自動寫入自己的 archerStats
  useEffect(() => {
    if (!room || !myId || room.status !== "active" || statsWritten.current) return;
    const me = room.members?.[myId];
    if (!me || me.maxHP > 0) return; // 已有數值就跳過
    statsWritten.current = true;
    const stats = simpleArcherStats(profile);
    updateBattleMemberStats(roomId, myId, stats.hp, stats.hp, stats.atk, stats.def);
  }, [room?.status]);

  // 房主：全員 ready → 自動計算（processingRef 防同幀重複觸發）
  useEffect(() => {
    if (!room || !isHost || room.status !== "active" || room.processing || processingRef.current) return;
    if (!room.monster) return;
    const members = room.members || {};
    const aliveIds = Object.keys(members).filter(id => members[id].alive);
    if (aliveIds.length === 0) return;
    const allReady = aliveIds.every(id => members[id].ready);
    if (!allReady) return;
    processingRef.current = true;
    processPartyRound(roomId, room, calcDmgFn, calcCtrFn)
      .finally(() => { processingRef.current = false; });
  }, [room?.members, room?.processing]);

  // 戰鬥結束 → 發寶箱
  useEffect(() => {
    if (!room || room.result !== "win" || wonChests.length > 0) return;
    const { mainChest, catChest, potionChest } = makeChests(room.monster);
    const chests = [mainChest, catChest, potionChest].filter(Boolean);
    setWonChests(chests);
    if (myId) addChests(myId, chests).catch(() => {});
  }, [room?.result]);

  // 滾動 log 到底
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room?.log?.length]);

  if (!room) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-lg font-bold animate-pulse">載入中…</div>
    </div>
  );

  const members = room.members || {};
  const memberList = Object.entries(members).map(([id, data]) => ({ id, ...data }));
  const me = members[myId] || {};
  const aliveCount = memberList.filter(m => m.alive).length;
  const myReady = me.ready || false;

  function addArrow(label) {
    if (arrows.length >= ARROWS_PER_ROUND || myReady) return;
    const score = SCORE_MAP[label] ?? 0;
    setArrows(prev => [...prev, { score, partMult: 1.0, label }]);
  }
  function removeLastArrow() {
    if (myReady) return;
    setArrows(prev => prev.slice(0, -1));
  }

  async function handleSubmit() {
    if (arrows.length < ARROWS_PER_ROUND || myReady || submitting) return;
    setSubmitting(true);
    await submitArrows(roomId, myId, arrows);
    setSubmitting(false);
  }

  async function handleStart() {
    if (!setupMonster || starting) return;
    setStarting(true);
    await startPartyBattle(roomId, room, setupMonster, setupMode, "preset", setupDistance);
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

  function copyCode() {
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const tierInfo = room.monster ? TIER_LABEL[room.monster.tier] : null;
  const famInfo  = room.monster ? FAMILIES[room.monster.family] : null;

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

        {/* 玩家列表 */}
        <div className="bg-slate-700/40 rounded-2xl p-4 flex flex-col gap-3">
          <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
            隊員 {memberList.length}/8
          </div>
          <div className="flex flex-col gap-2">
            {memberList.map(m => (
              <div key={m.id} className="flex items-center gap-2 text-white">
                <span>{m.id === room.hostId ? "👑" : "🏹"}</span>
                <span className={`font-bold text-sm ${m.id === myId ? "text-indigo-300" : ""}`}>
                  {m.name} {m.id === myId ? "(我)" : ""}
                </span>
              </div>
            ))}
            {memberList.length < 8 && (
              <div className="text-slate-500 text-xs">等待夥伴用邀請碼加入…</div>
            )}
          </div>
        </div>

        {/* 怪物選擇（房主） */}
        {isHost && (
          <div className="flex flex-col gap-4">
            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">選擇模式</div>
            <div className="grid grid-cols-3 gap-2">
              {MODE_OPTIONS.map(m => (
                <button key={m.id} onClick={() => setSetupMode(m.id)}
                  className={`py-2.5 rounded-xl text-sm font-black border transition-all ${
                    setupMode === m.id
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-slate-700 text-slate-300 border-slate-600"
                  }`}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">選擇怪物</div>
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
              {MONSTERS.map(m => {
                const tier = TIER_LABEL[m.tier];
                const fam  = FAMILIES[m.family];
                const scaledHP = Math.round(m.hp * partyHPMult(memberList.length));
                return (
                  <button key={m.id} onClick={() => setSetupMonster(m)}
                    className={`w-full text-left rounded-xl p-3 border-2 transition-all flex items-center gap-3 ${
                      setupMonster?.id === m.id
                        ? "border-indigo-500 bg-indigo-900/40"
                        : "border-slate-600 bg-slate-700/30"
                    }`}>
                    <span className="text-2xl">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-sm">{m.name}</div>
                      <div className="text-xs text-slate-400">
                        {fam?.label} · <span style={{ color: tier?.color }}>{tier?.label}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400 shrink-0">
                      <div>❤️ {scaledHP}</div>
                      <div>⚔️ {m.atk} 🛡️ {m.def}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {setupMonster && (
              <div className="bg-indigo-900/40 border border-indigo-500/50 rounded-xl p-3 text-sm text-indigo-200">
                <span className="font-black">選中：{setupMonster.icon} {setupMonster.name}</span>
                <span className="ml-2 text-slate-400">
                  HP×{partyHPMult(memberList.length).toFixed(1)} → {Math.round(setupMonster.hp * partyHPMult(memberList.length))}
                </span>
              </div>
            )}

            <button onClick={handleStart} disabled={!setupMonster || starting}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-orange-500 text-white font-black text-base rounded-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-50">
              {starting ? "開始中…" : `⚔️ 開始戰鬥（${memberList.length}人）`}
            </button>
          </div>
        )}
        {!isHost && (
          <div className="text-center text-slate-400 text-sm py-8">
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
      <div className={`min-h-screen flex flex-col items-center justify-center px-4 gap-6 ${
        won ? "bg-gradient-to-b from-yellow-900 to-slate-900" : "bg-gradient-to-b from-red-900 to-slate-900"
      }`}>
        <div className="text-6xl animate-bounce">{won ? "🏆" : "💀"}</div>
        <div className="text-2xl font-black text-white">
          {won ? "討伐成功！" : "全滅了…"}
        </div>
        {won && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-slate-300 text-sm">獲得的寶箱</div>
            <div className="flex gap-3">
              {wonChests.map(c => {
                const info = CHEST_TYPES[c.type];
                return info ? (
                  <div key={c.id} className="flex flex-col items-center gap-1">
                    <span className="text-3xl">{info.icon}</span>
                    <span className="text-xs text-white font-bold">{info.name}</span>
                  </div>
                ) : null;
              })}
              {wonChests.length === 0 && <span className="text-slate-400 text-sm">無額外獎勵</span>}
            </div>
          </div>
        )}
        <div className="bg-white/10 rounded-2xl p-4 w-full max-w-xs flex flex-col gap-2">
          {memberList.map(m => (
            <div key={m.id} className="flex items-center gap-2 text-sm text-white">
              <span>{m.alive ? "✅" : "💀"}</span>
              <span className={`font-bold ${m.id === myId ? "text-indigo-300" : ""}`}>{m.name}</span>
              <span className="ml-auto text-slate-400">{m.alive ? `${m.hp}/${m.maxHP}` : "陣亡"}</span>
            </div>
          ))}
        </div>
        <button onClick={onLeave}
          className="px-8 py-3 bg-white text-slate-900 font-black rounded-2xl shadow-lg active:scale-95 transition-transform">
          🏠 返回
        </button>
      </div>
    );
  }

  // ── 戰鬥中畫面 ────────────────────────────────────────────
  const monsterPct = room.monsterMaxHP > 0 ? (room.monsterHP / room.monsterMaxHP) : 0;
  const myPct = me.maxHP > 0 ? (me.hp / me.maxHP) : 0;
  const myArrowTotal = arrows.reduce((s, a) => s + a.score, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col max-w-lg mx-auto">
      {/* 頂部資訊 */}
      <div className="px-4 pt-5 pb-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-white font-black">第 {room.round} 回合</div>
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
                <div className="text-xs text-slate-400">{famInfo?.label}</div>
              </div>
              <div className="text-right text-sm font-black text-white">
                {room.monsterHP} / {room.monsterMaxHP}
              </div>
            </div>
            <HPBar current={room.monsterHP} max={room.monsterMaxHP} color={monsterPct > 0.5 ? "#22c55e" : monsterPct > 0.25 ? "#f59e0b" : "#ef4444"} />
          </div>
        )}

        {/* 隊員 HP 列 */}
        <div className="grid grid-cols-2 gap-2">
          {memberList.map(m => (
            <div key={m.id}
              className={`rounded-xl p-2.5 flex flex-col gap-1 ${
                !m.alive ? "bg-slate-800/40 opacity-50" :
                m.id === myId ? "bg-indigo-900/40 border border-indigo-500/50" : "bg-slate-700/40"
              }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${m.id === myId ? "text-indigo-300" : "text-white"}`}>
                  {m.alive ? "" : "💀"}{m.name}
                </span>
                <span className="text-xs text-slate-400">{m.hp}/{m.maxHP}</span>
              </div>
              <HPBar current={m.hp} max={m.maxHP} color={m.id === myId ? "#818cf8" : "#64748b"} />
              {m.alive && (
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] text-slate-500">
                    {m.ready ? (m.skipped ? "⏭️ 已跳過" : "✅ 已送出") : m.arrows?.length > 0 ? `🏹 ${m.arrows.length}支` : "等待輸入…"}
                  </span>
                  {isHost && !m.ready && m.id !== myId && !room.processing && (
                    <button onClick={() => handleForceSkip(m.id)}
                      disabled={skipping === m.id}
                      className="text-[9px] px-1.5 py-0.5 bg-slate-600 text-slate-300 rounded font-bold active:scale-95 disabled:opacity-40">
                      {skipping === m.id ? "…" : "跳過"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 箭分輸入（自己存活且未 ready）*/}
      {me.alive && !myReady && (
        <div className="px-4 flex flex-col gap-3 pb-4">
          {/* 已輸入的箭 */}
          <div className="flex gap-1.5 items-center">
            <div className="text-xs text-slate-400 w-8 shrink-0">
              {arrows.length}/{ARROWS_PER_ROUND}
            </div>
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

          {/* 分數按鈕 */}
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
            <button onClick={handleSubmit}
              disabled={arrows.length < ARROWS_PER_ROUND || submitting}
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

      {/* 戰鬥 Log */}
      {(room.log || []).length > 0 && (
        <div className="px-4 pb-6 flex flex-col gap-2 mt-2">
          <div className="text-xs font-black text-slate-500 uppercase tracking-widest">戰鬥記錄</div>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {[...room.log].reverse().map((entry, i) => (
              <div key={i} className="bg-slate-800/60 rounded-xl p-2.5 text-xs text-slate-300">
                <span className="text-slate-500 mr-1">R{entry.round}</span>
                總傷害 <span className="text-rose-400 font-black">{entry.totalDmg}</span>
                {" "}| 怪物剩 <span className="text-yellow-300 font-black">{entry.monsterHPAfter}</span>
                {entry.ctrPerPlayer > 0 && (
                  <> | 反擊 <span className="text-orange-400 font-black">-{entry.ctrPerPlayer}</span>/人</>
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
