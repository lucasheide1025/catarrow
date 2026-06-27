// src/components/dungeon/DungeonEvent.jsx — 隨機事件揭示（含全員確認流程）
import { useState } from "react";
import { confirmNonCombatRoom, resolveNonCombatRoom } from "../../lib/dungeonDb";
import { confirmDungeonEvent } from "../../lib/dungeonDb";

const TYPE_STYLE = {
  buff:    "border-emerald-400/50 bg-emerald-900/30 text-emerald-300",
  debuff:  "border-rose-400/50    bg-rose-900/30    text-rose-300",
  neutral: "border-purple-400/50  bg-purple-900/30  text-purple-300",
};

const TYPE_LABEL = { buff:"增益", debuff:"負面", neutral:"中立" };

export default function DungeonEvent({ roomId, room, isHost, memberId }) {
  const [loading, setLoading] = useState(false);
  const ev = room?.currentEvent;
  const members = room?.members || {};
  const aliveIds = Object.keys(members).filter(id => members[id]?.alive);
  const roomConfirms = room?.roomConfirms || {};
  const allConfirmed = aliveIds.every(id => roomConfirms[id]);

  if (!ev) return null;

  const style = TYPE_STYLE[ev.type] || TYPE_STYLE.neutral;
  const typeLabel = TYPE_LABEL[ev.type] || "";

  async function handleConfirm() {
    if (loading) return;
    setLoading(true);
    await confirmNonCombatRoom(roomId, memberId, "acknowledged");
    setLoading(false);
  }

  async function handleResolve() {
    if (!isHost || loading) return;
    setLoading(true);
    // 先套用事件效果，再返回地圖
    await confirmDungeonEvent(roomId, room);
    await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
    setLoading(false);
  }

  const myConfirmed = roomConfirms[memberId];

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col text-white"
      style={{ background:"linear-gradient(160deg,#1a1a2e,#16213e)" }}>

      <style>{`
@keyframes e-card-in { 0%{opacity:0;transform:scale(0.9) rotate(-2deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
@keyframes e-glow { 0%,100%{box-shadow:0 0 10px rgba(255,255,255,0.1)} 50%{box-shadow:0 0 30px rgba(255,255,255,0.2)} }
      `}</style>

      {/* Header */}
      <div className="shrink-0 text-center py-5 border-b border-white/10">
        <div className="text-3xl mb-1">❓</div>
        <div className="text-xl font-black" style={{ color:"#fde68a" }}>神秘事件</div>
      </div>

      {/* Event card */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-6" style={{animation:"e-card-in 0.5s ease"}}>
        <div className={`w-full max-w-sm rounded-3xl border-2 p-8 text-center ${style}`} style={{animation:"e-glow 3s ease infinite"}}>
          <div className="text-6xl mb-4">{ev.icon}</div>
          <div className="text-2xl font-black mb-2">{ev.title}</div>
          <div className="text-sm opacity-80 mb-4 leading-relaxed">{ev.desc}</div>
          <span className={`text-xs px-3 py-1 rounded-full border ${style} font-semibold`}>{typeLabel}</span>
        </div>
      </div>

      {/* 已確認成員 */}
      <div className="shrink-0 px-4">
        <div className="flex justify-center gap-2 flex-wrap pb-2">
          {Object.keys(roomConfirms).map(id => (
            <span key={id} className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
              ✅ {members[id]?.name || id}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-6 pt-3 border-t border-white/10 space-y-3">
        {!myConfirmed ? (
          <button onClick={handleConfirm} disabled={loading}
            className="w-full py-3 rounded-2xl font-black text-base shadow-lg disabled:opacity-40 transition-all active:scale-[0.98]"
            style={{ background:"linear-gradient(90deg,#a78bfa,#8b5cf6)", color:"white" }}>
            {loading ? "處理中…" : "👀 確認查看事件"}
          </button>
        ) : isHost && !allConfirmed ? (
          <div className="text-center text-slate-400 text-sm py-2">等待其他隊員確認事件…</div>
        ) : isHost && allConfirmed ? (
          <button onClick={handleResolve} disabled={loading}
            className="w-full py-3 rounded-2xl font-black text-base shadow-lg disabled:opacity-40"
            style={{ background:"linear-gradient(90deg,#22c55e,#16a34a)", color:"white" }}>
            {loading ? "處理中…" : "🗺️ 繼續探索"}
          </button>
        ) : (
          <div className="text-center text-emerald-400 text-sm py-2 font-bold">✅ 已確認，等待房主繼續</div>
        )}

        {isHost && myConfirmed && !allConfirmed && (
          <button onClick={handleResolve} disabled={loading}
            className="w-full py-2 rounded-xl text-amber-400 text-xs font-bold bg-amber-900/30 border border-amber-500/30">
            👑 強制繼續（{Object.keys(roomConfirms).length}/{aliveIds.length} 已確認）
          </button>
        )}
      </div>
    </div>
  );
}
