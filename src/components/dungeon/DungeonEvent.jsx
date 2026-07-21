// src/components/dungeon/DungeonEvent.jsx — 事件揭示（一般事件與特殊二選一事件）
import { useState, useEffect } from "react";
import { confirmNonCombatRoom, resolveNonCombatRoom } from "../../lib/dungeonDb";
import { sfxBuff, sfxDebuff, sfxSuccess, sfxTap } from "../../lib/sound";
import DungeonEventStage from "./DungeonEventStage";

const TYPE_STYLE = {
  buff:    "border-emerald-400/50 bg-emerald-900/30 text-emerald-300",
  debuff:  "border-rose-400/50    bg-rose-900/30    text-rose-300",
  neutral: "border-purple-400/50  bg-purple-900/30  text-purple-300",
  special: "border-amber-400/50   bg-amber-900/30   text-amber-300",
};

export default function DungeonEvent({
  roomId, room, memberId, isHost,
  localMode = false, onLocalEffect, onLocalDone, onSharedDone,
}) {
  const [loading, setLoading] = useState(false);
  const [selectedChoiceIdx, setSelectedChoiceIdx] = useState(null);
  const [resolved, setResolved] = useState(false);

  const ev = room?.roomResolution || room?.currentEvent;

  // 揭示音效
  useEffect(() => {
    if (ev) (ev.type === "debuff" ? sfxDebuff() : sfxBuff());
  }, []); // eslint-disable-line

  if (!ev) return null;

  const isSpecial = Array.isArray(ev.choices) && ev.choices.length > 0;
  const style = TYPE_STYLE[ev.type] || TYPE_STYLE.neutral;

  async function handlePickChoice(choice, idx) {
    if (resolved || loading) return;
    setSelectedChoiceIdx(idx);
    setLoading(true);
    sfxSuccess();

    try {
      if (localMode) {
        onLocalEffect?.({
          type: "event",
          event: {
            ...ev,
            cost: choice.cost,
            effect: choice.effect,
          },
        });
        setResolved(true);
        setTimeout(() => {
          onLocalDone?.();
        }, 1200);
        return;
      }

      await confirmNonCombatRoom(roomId, memberId, choice.label);
      setResolved(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleGeneralConfirm() {
    if (resolved || loading) return;
    setLoading(true);
    sfxSuccess();

    try {
      if (localMode) {
        onLocalEffect?.({ type: "event", event: ev });
        setResolved(true);
        setTimeout(() => {
          onLocalDone?.();
        }, 1000);
        return;
      }

      await confirmNonCombatRoom(roomId, memberId, "acknowledged");
      if (onSharedDone) await onSharedDone();
      else await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
      setResolved(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DungeonEventStage tone="event">
      <div className="dungeon-stage-header text-center py-4 border-b border-white/10">
        <div className="text-3xl mb-1">{isSpecial ? "🔴" : "🟢"}</div>
        <div className="text-xl font-black text-amber-300">
          {isSpecial ? "特殊事件（選擇與賭注）" : "一般事件（正面/無負面）"}
        </div>
      </div>

      <div className="dungeon-stage-main flex flex-col items-center justify-center p-6 space-y-4">
        {/* 事件內容卡片 */}
        <div className={`w-full max-w-md rounded-3xl border-2 p-6 text-center ${style}`}>
          <div className="text-5xl mb-3">{ev.icon}</div>
          <div className="text-xl font-black mb-2">{ev.title}</div>
          <div className="text-xs opacity-80 leading-relaxed mb-4">{ev.desc}</div>

          {/* 若為特殊事件，顯示選擇二選一 */}
          {isSpecial && !resolved && (
            <div className="space-y-2 text-left pt-2 border-t border-white/10">
              <div className="text-xs font-bold text-amber-300 mb-2">請選擇您的決策：</div>
              {ev.choices.map((c, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePickChoice(c, idx)}
                  disabled={loading}
                  className={`w-full p-3 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                    selectedChoiceIdx === idx
                      ? "bg-amber-600 border-amber-500 text-white shadow-lg"
                      : "bg-slate-900/80 border-slate-700 text-slate-200 hover:border-slate-600"
                  }`}
                >
                  <div>
                    <div className="font-black text-sm">{c.label}</div>
                    {c.hint && <div className="text-[10px] text-amber-300 mt-0.5">{c.hint}</div>}
                  </div>
                  <span className="text-xs font-bold">👉 選擇</span>
                </button>
              ))}
            </div>
          )}

          {/* 一般事件確認按鈕 */}
          {!isSpecial && !resolved && (
            <button
              type="button"
              onClick={handleGeneralConfirm}
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-sm shadow-md mt-2"
            >
              {loading ? "處理中…" : "✨ 接受效果並繼續"}
            </button>
          )}

          {resolved && (
            <div className="text-xs font-bold text-emerald-400 pt-2 animate-fade-in">
              ✅ 已套用事件效果，準備前進下一間房間！
            </div>
          )}
        </div>
      </div>
    </DungeonEventStage>
  );
}
