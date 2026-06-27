// src/components/dungeon/DungeonTrap.jsx — 地下城陷阱房間
import { useState, useEffect, useMemo } from "react";
import { confirmNonCombatRoom, resolveNonCombatRoom } from "../../lib/dungeonDb";

export default function DungeonTrap({ roomId, room, memberId, isHost }) {
  const [effects, setEffects] = useState(null);
  const [animPhase, setAnimPhase] = useState("entering"); // entering | hitting | done
  const [confirmed, setConfirmed] = useState(false);

  const members = room?.members || {};
  const aliveIds = Object.keys(members).filter(id => members[id].alive);
  const roomConfirms = room?.roomConfirms || {};
  const roomChoices  = room?.roomChoices || {};

  // 計算陷阱效果（首次渲染時固定）
  useEffect(() => {
    if (effects) return;
    // 全員 HP 扣 10~20%
    const hpPct = 0.10 + Math.random() * 0.10;
    // 隨機指定一名成員額外受 10~35% HP 傷害
    const targetId = aliveIds.length > 0
      ? aliveIds[Math.floor(Math.random() * aliveIds.length)]
      : null;
    const targetPct = 0.10 + Math.random() * 0.25;
    // ATK/DEF 降低 10~20%
    const atkDebuff = 0.80 + Math.random() * 0.10;
    const defDebuff = 0.80 + Math.random() * 0.10;

    setEffects({ hpPct, targetId, targetPct, atkDebuff, defDebuff });

    // 自動播放動畫
    const t1 = setTimeout(() => setAnimPhase("hitting"), 600);
    const t2 = setTimeout(() => setAnimPhase("done"), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line

  const appliedEffects = useMemo(() => {
    if (!effects) return {};
    const result = {};
    for (const id of aliveIds) {
      const m = members[id];
      const maxHP = m.maxHP || 100;
      const hpLoss = Math.round(maxHP * effects.hpPct);
      const extraLoss = id === effects.targetId ? Math.round(maxHP * effects.targetPct) : 0;
      const totalLoss = Math.min(hpLoss + extraLoss, (m.hp || maxHP) - 1); // 至少留 1 HP
      result[id] = {
        name: m.name,
        hpLoss: totalLoss,
        isTarget: id === effects.targetId,
        atkMult: effects.atkDebuff,
        defMult: effects.defDebuff,
      };
    }
    return result;
  }, [effects, aliveIds, members]);

  const isFullyConfirmed = aliveIds.every(id => roomConfirms[id]);
  const myChoice = roomChoices[memberId] || null;

  async function handleConfirm() {
    if (confirmed) return;
    setConfirmed(true);
    // 將陷阱效果寫入 Firestore 成員狀態
    if (appliedEffects[memberId]) {
      const eff = appliedEffects[memberId];
      const m = members[memberId];
      const newHP = Math.max(1, (m.hp || m.maxHP || 100) - eff.hpLoss);
      const { updateDoc, doc } = await import("firebase/firestore");
      const { db } = await import("../../lib/firebase");
      await updateDoc(doc(db, "dungeonRooms", roomId), {
        [`members.${memberId}.hp`]: newHP,
        [`members.${memberId}.buffs.atkMult`]: eff.atkMult,
        [`members.${memberId}.buffs.defMult`]: eff.defMult,
      });
    }
    await confirmNonCombatRoom(roomId, memberId, "confirmed");
  }

  async function handleResolve() {
    if (!isHost) return;
    await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
  }

  const allConfirmed = aliveIds.length === 0 || aliveIds.every(id => roomConfirms[id]);

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col text-white"
      style={{ background:"linear-gradient(135deg,#1a0a0a,#2d0a0a)" }}>
      
      <style>{`
@keyframes trap-flash { 0%,100%{opacity:1} 50%{opacity:0.3} }
@keyframes trap-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-12px)} 75%{transform:translateX(12px)} }
@keyframes trap-skull { 0%{opacity:0;transform:scale(3) rotate(-30deg)} 60%{opacity:1;transform:scale(0.8) rotate(10deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
@keyframes trap-hit { 0%{filter:brightness(1)} 30%{filter:brightness(2.5) saturate(0)} 100%{filter:brightness(1)} }
      `}</style>

      {/* 頂部 */}
      <div className="shrink-0 text-center py-6 border-b border-red-500/20">
        <div className="text-5xl mb-2 animate-pulse" style={animPhase === "hitting" ? {animation:"trap-flash 0.3s ease infinite"} : {}}>🪤</div>
        <div className="text-2xl font-black" style={{color:"#f87171"}}>陷阱！</div>
        <div className="text-sm text-red-300/60 mt-1">踩到了隱藏機關！</div>
      </div>

      {/* 主體 */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4"
        style={animPhase === "hitting" ? {animation:"trap-shake 0.5s ease"} : {}}>

        {animPhase === "entering" && (
          <div className="text-center text-4xl animate-pulse py-12">
            <div className="mb-4">⚡</div>
            <div className="text-lg text-red-300 font-bold">機關被觸發了…</div>
          </div>
        )}

        {animPhase !== "entering" && effects && (
          <>
            {/* 全體傷害 */}
            <div className="bg-red-900/30 border border-red-500/30 rounded-2xl p-4">
              <div className="text-xs font-black text-red-300 mb-3">💥 全體傷害 — 每人 {Math.round(effects.hpPct * 100)}% HP</div>
              {aliveIds.map(id => {
                const eff = appliedEffects[id];
                if (!eff) return null;
                const m = members[id];
                const isMe = id === memberId;
                return (
                  <div key={id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 mb-1.5 ${isMe ? "bg-red-900/40 border border-red-500/30" : "bg-black/30"}`}
                    style={eff.isTarget && animPhase === "hitting" ? {animation:"trap-hit 0.4s ease"} : {}}>
                    <span className="text-lg">{isMe ? "👉" : "👤"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">{m.name}{isMe ? "（你）" : ""}</div>
                      <div className="text-xs text-red-400">
                        -{eff.hpLoss} HP
                        {eff.isTarget && <span className="ml-2 text-orange-300 font-bold">🎯 額外傷害！</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">HP</div>
                      <div className="text-xs font-bold text-red-300">
                        {Math.max(1, (m.hp || m.maxHP || 100) - eff.hpLoss)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ATK/DEF 降低 */}
            <div className="bg-purple-900/30 border border-purple-500/30 rounded-2xl p-4">
              <div className="text-xs font-black text-purple-300 mb-2">🌑 全體弱化</div>
              <div className="flex gap-4 justify-center">
                <div className="bg-black/30 rounded-xl px-4 py-3 text-center flex-1">
                  <div className="text-lg">⚔️</div>
                  <div className="text-xs text-slate-400">ATK</div>
                  <div className="text-sm font-black text-purple-300">{Math.round((1 - effects.atkDebuff) * 100)}% ↓</div>
                </div>
                <div className="bg-black/30 rounded-xl px-4 py-3 text-center flex-1">
                  <div className="text-lg">🛡️</div>
                  <div className="text-xs text-slate-400">DEF</div>
                  <div className="text-sm font-black text-purple-300">{Math.round((1 - effects.defDebuff) * 100)}% ↓</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-6 pt-3 border-t border-red-500/20 space-y-3">
        {/* 已確認成員 */}
        {Object.keys(roomConfirms).length > 0 && (
          <div className="flex justify-center gap-2 flex-wrap">
            {Object.keys(roomConfirms).map(id => (
              <span key={id} className="text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">
                ✅ {members[id]?.name || id}
              </span>
            ))}
          </div>
        )}

        {!confirmed ? (
          <button onClick={handleConfirm} disabled={animPhase !== "done"}
            className="w-full py-4 rounded-2xl font-black text-base text-white shadow-lg disabled:opacity-40 transition-all"
            style={{
              background: animPhase === "done"
                ? "linear-gradient(90deg,#ef4444,#dc2626)"
                : "rgba(255,255,255,0.1)",
            }}>
            {animPhase !== "done" ? "⚡ 陷阱發動中…" : "💀 確認損害，繼續前進"}
          </button>
        ) : isHost && !allConfirmed ? (
          <div className="text-center text-slate-400 text-sm py-2">等待其他隊員確認…</div>
        ) : isHost && allConfirmed ? (
          <button onClick={handleResolve}
            className="w-full py-4 rounded-2xl font-black text-base bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg">
            🗺️ 繼續探索
          </button>
        ) : (
          <div className="text-center text-emerald-400 text-sm py-2 font-bold">✅ 已確認，等待房主繼續</div>
        )}

        {/* 全員確認進度（房主可強制結算） */}
        {isHost && confirmed && !allConfirmed && (
          <button onClick={handleResolve}
            className="w-full py-2 rounded-xl text-red-400 text-xs font-bold bg-red-900/30 border border-red-500/30">
            👑 強制繼續（{Object.keys(roomConfirms).length}/{aliveIds.length} 已確認）
          </button>
        )}
      </div>
    </div>
  );
}
