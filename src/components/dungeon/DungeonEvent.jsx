// src/components/dungeon/DungeonEvent.jsx — 事件揭示（一般事件與特殊二選一事件 + 狀態變化動畫回饋）
import { useState, useEffect } from "react";
import { confirmNonCombatRoom } from "../../lib/dungeonDb";
import { drawDungeonEvent } from "../../lib/dungeonData";
import { tallyEventVotes, allActiveMembersVoted } from "../../lib/dungeonEventVotes";
import { sfxBuff, sfxDebuff, sfxSuccess } from "../../lib/sound";
import DungeonEventStage from "./DungeonEventStage";

const TYPE_STYLE = {
  buff:    "border-emerald-400/50 bg-emerald-900/30 text-emerald-300",
  debuff:  "border-rose-400/50    bg-rose-900/30    text-rose-300",
  neutral: "border-purple-400/50  bg-purple-900/30  text-purple-300",
  special: "border-amber-400/50   bg-amber-900/30   text-amber-300",
};

function formatEffectBadges(effect, cost) {
  const badges = [];
  if (cost) {
    if (cost.hp) badges.push({ type: "cost", label: `💔 代價：扣除 ${Math.round(cost.hp * 100)}% 生命`, color: "text-rose-300 bg-rose-950/80 border-rose-500/50" });
    if (cost.gold) badges.push({ type: "cost", label: `🪙 代價：花費 ${cost.gold} 金幣`, color: "text-amber-300 bg-amber-950/80 border-amber-500/50" });
  }
  if (effect) {
    if (effect.hp) badges.push({ type: "gain", label: `❤️ 全隊生命回復 +${Math.round(effect.hp * 100)}%`, color: "text-emerald-300 bg-emerald-950/80 border-emerald-500/50" });
    if (effect.atk) badges.push({ type: "gain", label: `⚔️ 全隊攻擊 ${effect.atk > 0 ? '+' : ''}${Math.round(effect.atk * 100)}%`, color: "text-amber-300 bg-amber-950/80 border-amber-500/50" });
    if (effect.def) badges.push({ type: "gain", label: `🛡️ 全隊防禦 ${effect.def > 0 ? '+' : ''}${Math.round(effect.def * 100)}%`, color: "text-sky-300 bg-sky-950/80 border-sky-500/50" });
    if (effect.dmg) badges.push({ type: "gain", label: `🔥 全隊 傷害 ${effect.dmg > 0 ? '+' : ''}${Math.round(effect.dmg * 100)}%`, color: "text-orange-300 bg-orange-950/80 border-orange-500/50" });
    if (effect.gold) badges.push({ type: "gain", label: `🪙 金幣 +${effect.gold}`, color: "text-yellow-300 bg-yellow-950/80 border-yellow-500/50" });
    if (effect.item) badges.push({ type: "gain", label: `🧪 獲得冒險道具：${effect.item}`, color: "text-purple-300 bg-purple-950/80 border-purple-500/50" });
  }
  if (badges.length === 0) {
    badges.push({ type: "neutral", label: "💬 靜心觀望（屬性無變化）", color: "text-slate-300 bg-slate-900/80 border-slate-700" });
  }
  return badges;
}

export default function DungeonEvent({
  roomId, room, memberId, isHost, event: propEvent,
  localMode = false, onLocalEffect, onLocalDone, onResolveEvent,
}) {
  const [loading, setLoading] = useState(false);
  const [selectedChoiceIdx, setSelectedChoiceIdx] = useState(null);
  const [resolved, setResolved] = useState(false);
  const [confirmedWait, setConfirmedWait] = useState(false);
  const [activeBadges, setActiveBadges] = useState([]);

  const rawEv = propEvent || room?.roomResolution || room?.currentEvent || room?.event || room?.pendingRoom?.event;
  const validEv = (rawEv?.desc ? rawEv : (rawEv?.event?.desc ? rawEv.event : null));
  const ev = validEv || drawDungeonEvent(room?.type === "event" ? "special" : "general");
  const sharedResolution = room?.roomResolution?.kind === "team_event"
    ? room.roomResolution
    : null;

  // 揭示音效
  useEffect(() => {
    if (ev) (ev.type === "debuff" ? sfxDebuff() : sfxBuff());
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!sharedResolution) return;
    setResolved(true);
    setActiveBadges((sharedResolution.badges || []).map(label => ({
      type: "gain",
      label,
      color: label.includes("-")
        ? "text-rose-300 bg-rose-950/80 border-rose-500/50"
        : "text-emerald-300 bg-emerald-950/80 border-emerald-500/50",
    })));
  }, [sharedResolution]);

  if (!ev) return null;

  const isSpecial = Array.isArray(ev.choices) && ev.choices.length > 0;
  const style = TYPE_STYLE[ev.type] || TYPE_STYLE.neutral;

  // ── 全員投票（組隊）：每人的票寫進 roomChoices[memberId]，confirmNonCombatRoom 順便
  //    寫 roomConfirms → 全員投完後由 TeamExpeditionBattle 的房主端 effect 自動以最高票結算。
  //    單人（localMode）維持「直接選擇」：選了立刻套效果。
  const roomChoices = room?.roomChoices || {};
  const myVote = roomChoices[memberId];
  const voteTally = tallyEventVotes({
    members: room?.members,
    choices: roomChoices,
    hostId: room?.hostId,
  });
  const allVoted = !localMode && allActiveMembersVoted({ members: room?.members, choices: roomChoices });

  async function handleVote(choice, idx) {
    if (resolved || loading) return;
    if (!localMode && myVote !== undefined) return; // 已投過
    sfxSuccess();

    if (localMode) {
      setSelectedChoiceIdx(idx);
      setLoading(true);
      const badges = formatEffectBadges(choice.effect, choice.cost);
      setActiveBadges(badges);
      onLocalEffect?.({
        type: "event",
        event: {
          ...ev,
          cost: choice.cost,
          effect: choice.effect,
        },
      });
      setResolved(true);
      setLoading(false);
      return;
    }

    setSelectedChoiceIdx(idx);
    setLoading(true);
    try {
      await confirmNonCombatRoom(roomId, memberId, idx);
    } finally {
      setLoading(false);
    }
  }

  async function handleGeneralVote() {
    if (resolved || loading) return;
    if (!localMode && myVote !== undefined) return; // 已投過
    sfxSuccess();

    if (localMode) {
      setLoading(true);
      const badges = formatEffectBadges(ev.effect, ev.cost);
      setActiveBadges(badges);
      onLocalEffect?.({ type: "event", event: ev });
      setResolved(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await confirmNonCombatRoom(roomId, memberId, "ack");
    } finally {
      setLoading(false);
    }
  }

  async function handleContinueNext() {
    if (localMode) {
      onLocalDone?.();
      return;
    }
    setConfirmedWait(true);
    await confirmNonCombatRoom(roomId, memberId, "acknowledged");
  }

  return (
    <DungeonEventStage tone="event">
      <div className="dungeon-stage-header text-center py-4 border-b border-white/10">
        <div className="text-3xl mb-1">{isSpecial ? "🔴" : "🟢"}</div>
        <div className="text-xl font-black text-amber-300">
          {isSpecial ? "特殊事件（選擇與賭注）" : "一般事件（正面奇遇）"}
        </div>
      </div>

      <div className="dungeon-stage-main flex flex-col items-center justify-center p-6 space-y-4">
        {/* 事件內容卡片 */}
        <div className={`w-full max-w-md rounded-3xl border-2 p-6 text-center shadow-2xl backdrop-blur-md ${style}`}>
          <div className="text-5xl mb-3">{ev.icon}</div>
          <div className="text-xl font-black mb-2 text-white">{ev.title}</div>
          <div className="text-xs opacity-90 leading-relaxed mb-4 text-slate-200">{ev.desc}</div>

          {/* 特殊事件：單人直接選擇；組隊改全員投票（票多者勝，平票房主那票 ×2） */}
          {isSpecial && !resolved && (
            <div className="space-y-2.5 text-left pt-3 border-t border-white/15">
              <div className="text-xs font-black text-amber-300 mb-2">
                {localMode
                  ? "請選擇您的冒險決策："
                  : myVote !== undefined
                    ? "✅ 你已投票，等待其他隊友…"
                    : "🗳️ 全員投票，票多的選項套用到全隊："}
              </div>
              {ev.choices.map((c, idx) => {
                const count = voteTally.tally?.[idx] || 0;
                const isMyPick = !localMode && myVote === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleVote(c, idx)}
                    disabled={loading || (!localMode && myVote !== undefined)}
                    className={`w-full p-3.5 rounded-2xl border text-xs font-bold transition flex items-center justify-between shadow-md active:scale-95 ${
                      isMyPick || (!localMode && selectedChoiceIdx === idx && myVote === undefined)
                        ? "bg-amber-600 border-amber-400 text-white shadow-amber-500/20"
                        : "bg-slate-900/90 border-slate-700 text-slate-200 hover:border-amber-400/50 hover:bg-slate-800"
                    }`}
                  >
                    <div>
                      <div className="font-black text-sm text-amber-200">{c.label}</div>
                      {c.hint && <div className="text-[10px] text-amber-300/80 mt-0.5">{c.hint}</div>}
                    </div>
                    <span className="text-xs font-black bg-amber-500/20 border border-amber-400/40 text-amber-300 px-2.5 py-1 rounded-xl">
                      {localMode ? "👉 選擇" : `${myVote === idx ? "✓ " : "🗳️ "}${count} 票`}
                    </span>
                  </button>
                );
              })}
              {!localMode && allVoted && (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-950/30 p-3 text-xs font-bold text-emerald-200 text-center">
                  ⏳ 全員已投票，等待結算…
                </div>
              )}
            </div>
          )}

          {/* 一般事件（舊存檔相容）：接受效果按鈕解除房主限制，全員可確認 */}
          {!isSpecial && !resolved && (
            <button
              type="button"
              onClick={handleGeneralVote}
              disabled={loading || (!localMode && myVote !== undefined)}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-2xl text-sm shadow-xl active:scale-95 transition-all mt-2 border border-emerald-400/30"
            >
              {localMode
                ? (loading ? "套用效果中…" : "✨ 接受效果並查看狀態")
                : myVote !== undefined
                  ? "✅ 已確認，等待其他隊友…"
                  : (loading ? "確認中…" : "✨ 接受效果並查看狀態")}
            </button>
          )}

          {/* 狀態變化回饋面板 (已完成時顯示) */}
          {resolved && (
            <div className="mt-4 pt-4 border-t border-white/20 space-y-3 animate-fade-in text-left">
              <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                <span>✨</span> 團隊狀態變化與事件結果
              </div>
              <div className="space-y-1.5">
                {activeBadges.map((b, i) => (
                  <div
                    key={i}
                    className={`px-3 py-2 rounded-xl border text-xs font-black flex items-center justify-between shadow ${b.color}`}
                  >
                    <span>{b.label}</span>
                    <span className="text-[10px] opacity-75 font-bold">已生效 ✓</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleContinueNext}
                disabled={loading || confirmedWait}
                className={`w-full py-3.5 mt-3 font-black rounded-2xl text-sm shadow-xl transition-all ${
                  confirmedWait
                    ? "bg-slate-800 text-amber-300/80 border border-amber-500/30 cursor-wait animate-pulse"
                    : "bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 active:scale-95"
                }`}
              >
                {confirmedWait ? "✅ 已完成確認，等待其他隊友繼續…" : "➡️ 繼續探索下一關"}
              </button>
            </div>
          )}
        </div>
      </div>
    </DungeonEventStage>
  );
}
