// src/components/dungeon/DungeonRest.jsx — 地下城休息區
// 全員投票選擇一個效果：恢復血量 / 治療異常 / 復活前衛
// 點選選項即確認，無需額外確認按鈕
import { useState, useEffect, useMemo } from "react";
import { confirmNonCombatRoom, resolveNonCombatRoom } from "../../lib/dungeonDb";

const REST_OPTIONS = [
  { id: "heal",   icon: "💤", title: "恢復全體血量", desc: "全體隊員恢復 50~100% 隨機最大血量",   color: "#4ade80" },
  { id: "cure",   icon: "✨", title: "治療異常狀態", desc: "清除全體隊員的 ATK/DEF 弱化效果",     color: "#a78bfa" },
  { id: "revive", icon: "💊", title: "復活前衛",     desc: "復活一名陣亡轉後衛的隊員（50% HP 轉回前衛）", color: "#fbbf24" },
];

export default function DungeonRest({ roomId, room, memberId, isHost }) {
  const [animPhase, setAnimPhase] = useState("entering"); // entering | open | done

  const members = room?.members || {};
  const aliveIds = Object.keys(members).filter(id => members[id].alive);
  const roomConfirms = room?.roomConfirms || {};
  const roomChoices = room?.roomChoices || {};

  // 判斷是否有前衛死亡轉後衛
  const hasFrontFallen = useMemo(() => aliveIds.some(id => members[id]?.role === "rear"), [aliveIds, members]);

  const myChoice = roomChoices[memberId] || null;
  const allConfirmed = aliveIds.every(id => roomConfirms[id]);

  // 進場動畫
  useEffect(() => {
    const t1 = setTimeout(() => setAnimPhase("open"), 400);
    const t2 = setTimeout(() => setAnimPhase("done"), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // 票數統計
  const tally = useMemo(() => {
    const t = {};
    for (const choice of Object.values(roomChoices)) t[choice] = (t[choice] || 0) + 1;
    return t;
  }, [roomChoices]);

  async function handleSelect(optionId) {
    if (animPhase !== "done" || myChoice) return;
    await confirmNonCombatRoom(roomId, memberId, optionId);
  }

  async function handleResolve() {
    if (!isHost) return;

    // 找出得票最高的選項
    const votes = Object.values(roomChoices);
    const count = {};
    let bestOption = "heal";
    let bestCount = 0;
    for (const v of votes) { count[v] = (count[v] || 0) + 1; if (count[v] > bestCount) { bestCount = count[v]; bestOption = v; }}

    const { updateDoc, doc } = await import("firebase/firestore");
    const { db } = await import("../../lib/firebase");
    const upd = {};

    if (bestOption === "heal") {
      const pct = 0.5 + Math.random() * 0.5;
      for (const id of aliveIds) {
        const m = members[id];
        const newHP = Math.min(m.maxHP || 100, (m.hp || 0) + Math.round((m.maxHP || 100) * pct));
        upd[`members.${id}.hp`] = newHP;
      }
    } else if (bestOption === "cure") {
      for (const id of aliveIds) {
        const b = members[id]?.buffs || {};
        if ((b.atkMult || 1) < 1 || (b.defMult || 1) < 1) {
          upd[`members.${id}.buffs.atkMult`] = 1;
          upd[`members.${id}.buffs.defMult`] = 1;
        }
      }
    } else if (bestOption === "revive") {
      const targetId = aliveIds.find(id => members[id]?.role === "rear");
      if (targetId) {
        const m = members[targetId];
        upd[`members.${targetId}.role`] = "front";
        upd[`members.${targetId}.hp`] = Math.round((m.maxHP || 100) * 0.5);
      } else {
        // 無人可復活 → 全體回 50%
        for (const id of aliveIds) {
          upd[`members.${id}.hp`] = Math.min(members[id].maxHP || 100, (members[id].hp || 0) + Math.round((members[id].maxHP || 100) * 0.5));
        }
      }
    }

    if (Object.keys(upd).length > 0) await updateDoc(doc(db, "dungeonRooms", roomId), upd);
    await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
  }

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col text-white"
      style={{ background:"linear-gradient(160deg,#1a0a2e,#2d1a4e)" }}>
      <style>{`
@keyframes r-glow { 0%,100%{box-shadow:0 0 20px rgba(167,139,250,0.3)} 50%{box-shadow:0 0 40px rgba(167,139,250,0.6)} }
@keyframes r-fade { 0%{opacity:0;transform:translateY(20px)} 100%{opacity:1;transform:translateY(0)} }
@keyframes r-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
      `}</style>

      {/* Header */}
      <div className="shrink-0 text-center py-6 border-b border-purple-500/20"
        style={animPhase === "entering" ? {animation:"r-pulse 0.8s ease infinite"} : {}}>
        <div className="text-5xl mb-2">🏕️</div>
        <div className="text-2xl font-black" style={{ color:"#a78bfa" }}>休息區</div>
        <div className="text-sm text-purple-300/60 mt-1">短暫歇息，恢復戰力</div>
      </div>

      {/* 投票 */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        <div className="text-center text-sm text-purple-200/70 mb-1 font-semibold">🗳️ 全員投票選擇方式</div>

        {REST_OPTIONS.map((opt, i) => {
          const enabled = opt.id !== "revive" || hasFrontFallen;
          const votes = tally[opt.id] || 0;
          const isSelected = myChoice === opt.id;
          return (
            <div key={opt.id}
              onClick={() => enabled && handleSelect(opt.id)}
              className={`rounded-2xl p-4 border-2 transition-all cursor-pointer ${
                isSelected ? "border-white/40 bg-white/10" : enabled ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20" : "border-white/5 bg-white/3 opacity-40 cursor-not-allowed"
              }`}
              style={{
                animation: animPhase === "open" ? `r-fade 0.4s ease ${i*0.15}s both` : undefined,
                boxShadow: isSelected ? "0 0 20px rgba(255,255,255,0.1)" : undefined,
              }}>
              <div className="flex items-center gap-4">
                <div className="text-3xl">{opt.icon}</div>
                <div className="flex-1">
                  <div className="font-bold text-sm" style={{ color: isSelected ? "white" : opt.color }}>
                    {opt.title}
                    {isSelected && <span className="ml-2 text-white">✓</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{opt.desc}</div>
                  {opt.id === "revive" && !hasFrontFallen && (
                    <div className="text-xs text-amber-400 mt-1">⚠️ 無前衛陣亡</div>
                  )}
                </div>
                {votes > 0 && (
                  <div className="shrink-0 bg-white/10 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">{votes}</div>
                )}
              </div>
            </div>
          );
        })}

        {Object.keys(roomConfirms).length > 0 && (
          <div className="flex justify-center gap-2 flex-wrap pt-2">
            {Object.keys(roomConfirms).map(id => (
              <span key={id} className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                ✅ {members[id]?.name || id} {roomChoices[id] ? `(${REST_OPTIONS.find(o=>o.id===roomChoices[id])?.icon||"?"})` : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-6 pt-3 border-t border-purple-500/20 space-y-3">
        {!myChoice ? (
          <div className="text-center text-slate-400 text-sm py-2">👆 點擊選擇上方休息方式</div>
        ) : isHost && allConfirmed ? (
          <button onClick={handleResolve}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg"
            style={{ background:"linear-gradient(90deg,#22c55e,#16a34a)", color:"white" }}>
            🗺️ 套用效果，繼續探索
          </button>
        ) : isHost ? (
          <button onClick={handleResolve}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg"
            style={{ background:"linear-gradient(90deg,#f59e0b,#d97706)", color:"white" }}>
            👑 強制繼續（{Object.keys(roomConfirms).length}/{aliveIds.length} 已投票）
          </button>
        ) : (
          <div className="text-center text-emerald-400 text-sm py-2 font-bold">✅ 已投票，等待房主繼續</div>
        )}
      </div>
    </div>
  );
}
