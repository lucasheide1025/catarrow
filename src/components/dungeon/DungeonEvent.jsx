// src/components/dungeon/DungeonEvent.jsx — 隨機事件揭示
import { useState } from "react";
import { confirmDungeonEvent } from "../../lib/dungeonDb";

const TYPE_STYLE = {
  buff:    "border-emerald-400/50 bg-emerald-900/30 text-emerald-300",
  debuff:  "border-rose-400/50    bg-rose-900/30    text-rose-300",
  neutral: "border-purple-400/50  bg-purple-900/30  text-purple-300",
};

export default function DungeonEvent({ roomId, room, isHost }) {
  const [loading, setLoading] = useState(false);
  const ev = room?.currentEvent;

  if (!ev) return null;

  const style = TYPE_STYLE[ev.type] || TYPE_STYLE.neutral;
  const typeLabel = { buff:"增益", debuff:"負面", neutral:"中立" }[ev.type] || "";

  async function handleConfirm() {
    if (!isHost || loading) return;
    setLoading(true);
    await confirmDungeonEvent(roomId, room);
    setLoading(false);
  }

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="shrink-0 text-center py-6 border-b border-white/10">
        <div className="text-3xl mb-1">❓</div>
        <div className="text-xl font-black">神秘事件</div>
      </div>

      {/* Event card */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-6">
        <div className={`w-full max-w-sm rounded-3xl border-2 p-8 text-center ${style}`}>
          <div className="text-6xl mb-4">{ev.icon}</div>
          <div className="text-2xl font-black mb-2">{ev.title}</div>
          <div className="text-sm opacity-80 mb-4 leading-relaxed">{ev.desc}</div>
          <span className={`text-xs px-3 py-1 rounded-full border ${style} font-semibold`}>{typeLabel}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-6 pt-3 border-t border-white/10">
        {isHost ? (
          <button onClick={handleConfirm} disabled={loading}
            className="w-full py-3 rounded-2xl font-black bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg disabled:opacity-40">
            {loading ? "套用中…" : "確認事件，繼續前進 →"}
          </button>
        ) : (
          <div className="text-center text-slate-400 text-sm">等待房主確認事件…</div>
        )}
      </div>
    </div>
  );
}
