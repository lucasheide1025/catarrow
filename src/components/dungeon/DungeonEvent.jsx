// src/components/dungeon/DungeonEvent.jsx — 隨機事件揭示（含全員確認流程）
import { useState, useEffect, useRef } from "react";
import { confirmNonCombatRoom, resolveNonCombatRoom } from "../../lib/dungeonDb";
import { confirmDungeonEvent } from "../../lib/dungeonDb";
import { sfxBuff, sfxDebuff, sfxSuccess, sfxTap } from "../../lib/sound";
import DungeonEventStage from "./DungeonEventStage";

const TYPE_STYLE = {
  buff:    "border-emerald-400/50 bg-emerald-900/30 text-emerald-300",
  debuff:  "border-rose-400/50    bg-rose-900/30    text-rose-300",
  neutral: "border-purple-400/50  bg-purple-900/30  text-purple-300",
};

const TYPE_LABEL = { buff:"增益", debuff:"負面", neutral:"中立" };
const RESULT_DISPLAY_MS = 3000;

// localMode（遠征單人）：事件效果透過 onLocalEffect({type:"event", event}) 回傳父層，
// 結束呼叫 onLocalDone，不寫 Firestore
export default function DungeonEvent({
  roomId, room, isHost, memberId,
  localMode = false, onLocalEffect, onLocalDone, onSharedDone,
}) {
  const [loading, setLoading] = useState(false);
  const [localConfirms, setLocalConfirms] = useState({});
  const [resultTimerDone, setResultTimerDone] = useState(false);
  const continueLockRef = useRef(false);

  // Bug #7: hasResult 表示事件已結算（roomResolution 存在），需展示 3 秒結果 phase
  const hasResult = room?.roomResolution?.kind === "event";
  // ev 優先使用結算後的 roomResolution（含 icon/title/desc），無則用 currentEvent
  const ev = hasResult ? room.roomResolution : room?.currentEvent;

  const members = room?.members || {};
  const aliveIds = Object.keys(members).filter(id => members[id]?.alive);
  const roomConfirms = localMode ? localConfirms : (room?.roomConfirms || {});
  const allConfirmed = aliveIds.every(id => roomConfirms[id]);

  // 事件揭示音效
  useEffect(() => {
    if (ev) (ev.type === "debuff" ? sfxDebuff() : sfxBuff());
  }, []); // eslint-disable-line

  // Bug #7: 結果 phase 3 秒計時器
  useEffect(() => {
    if (!hasResult) {
      setResultTimerDone(false);
      return;
    }
    continueLockRef.current = false;
    const t = setTimeout(() => setResultTimerDone(true), RESULT_DISPLAY_MS);
    return () => clearTimeout(t);
  }, [hasResult]);

  if (!ev) return null;

  const style = TYPE_STYLE[ev.type] || TYPE_STYLE.neutral;
  const typeLabel = TYPE_LABEL[ev.type] || "";

  async function handleConfirm() {
    if (loading) return;
    sfxTap();
    if (localMode) {
      setLocalConfirms({ [memberId]: true });
      return;
    }
    setLoading(true);
    await confirmNonCombatRoom(roomId, memberId, "acknowledged");
    setLoading(false);
  }

  // Bug #7: handleResolve 只套用效果 + store roomResolution，不跳轉
  async function handleResolve() {
    if (!isHost || loading || hasResult) return;
    sfxSuccess();
    if (localMode) {
      onLocalEffect?.({ type:"event", event: ev });
      onLocalDone?.();
      return;
    }
    setLoading(true);
    // confirmDungeonEvent 現在 store roomResolution + 保持 status="event"
    await confirmDungeonEvent(roomId, room);
    setLoading(false);
  }

  // Bug #7: 結果 phase 結束後，host 手動呼叫此函式推進
  async function handleContinue() {
    if (!isHost || loading || continueLockRef.current) return;
    continueLockRef.current = true;
    setLoading(true);
    if (onSharedDone) await onSharedDone();
    else await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
    setLoading(false);
  }

  const myConfirmed = roomConfirms[memberId];
  const resultPhase = hasResult && !resultTimerDone;
  const resultReady = hasResult && resultTimerDone;
  const eventHint = ev.type === "debuff"
    ? "不祥的氣息逐漸逼近……"
    : ev.type === "buff"
      ? "周遭似乎出現了神秘的變化……"
      : "前方傳來難以辨識的動靜……";

  return (
    <DungeonEventStage tone="event">

      <style>{`
@keyframes e-card-in { 0%{opacity:0;transform:scale(0.9) rotate(-2deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
@keyframes e-glow { 0%,100%{box-shadow:0 0 10px rgba(255,255,255,0.1)} 50%{box-shadow:0 0 30px rgba(255,255,255,0.2)} }
@keyframes e-result-in { 0%{opacity:0;transform:scale(0.8)} 100%{opacity:1;transform:scale(1)} }
@keyframes e-timer { 0%{width:100%} 100%{width:0%} }
      `}</style>

      {/* Header */}
      <div className="dungeon-stage-header shrink-0 text-center py-5 border-b border-white/10">
        <div className="text-3xl mb-1">{hasResult ? "✨" : "❓"}</div>
        <div className="text-xl font-black" style={{ color:"#fde68a" }}>
          {hasResult ? "事件結果" : "神秘事件"}
        </div>
      </div>

      {/* Event card */}
      <div className="dungeon-stage-main flex items-center justify-center px-6 py-8" style={{animation:"e-card-in 0.5s ease"}}>
        <div className={`w-full max-w-sm rounded-3xl border-2 p-8 text-center ${style}`}
          style={{
            animation: hasResult ? "e-result-in 0.4s ease" : "e-glow 3s ease infinite",
            filter: resultReady ? "brightness(1.2)" : undefined,
            transition: "filter 0.4s",
          }}>
          <div className="text-6xl mb-4">{ev.icon}</div>
          <div className="text-2xl font-black mb-2">{ev.title}</div>
          <div className="text-sm opacity-80 mb-4 leading-relaxed">{hasResult ? ev.desc : eventHint}</div>
          {hasResult ? (
            <span className={`text-xs px-3 py-1 rounded-full border ${style} font-semibold`}>
              {typeLabel} · 已套用
            </span>
          ) : (
            <span className={`text-xs px-3 py-1 rounded-full border ${style} font-semibold`}>{typeLabel}</span>
          )}
          {/* Bug #7: 結果 phase 進度條 */}
          {resultPhase && (
            <div className="mt-5">
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400" style={{animation:"e-timer 3s linear forwards"}} />
              </div>
              <div className="text-[10px] text-slate-500 mt-2">結果揭示中…</div>
            </div>
          )}
        </div>
      </div>

      {/* 已確認成員（僅在結算前顯示） */}
      {!hasResult && (
        <div className="shrink-0 px-4">
          <div className="flex justify-center gap-2 flex-wrap pb-2">
            {Object.keys(roomConfirms).map(id => (
              <span key={id} className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                ✅ {members[id]?.name || id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="dungeon-stage-footer shrink-0 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3 border-t border-white/10 space-y-3">
        {/* Bug #7: 結果 phase 結束後顯示「繼續探索」 */}
        {resultReady && isHost ? (
          <button onClick={handleContinue} disabled={loading}
            className="w-full py-3 rounded-2xl font-black text-base shadow-lg disabled:opacity-40 transition-all active:scale-[0.98]"
            style={{ background:"linear-gradient(90deg,#22c55e,#16a34a)", color:"white" }}>
            {loading ? "處理中…" : "🗺️ 繼續探索"}
          </button>
        ) : resultReady && !isHost ? (
          <div className="text-center text-emerald-400 text-sm py-2 font-bold">✅ 已套用，等待房主繼續</div>
        ) : resultPhase ? (
          <div className="text-center text-slate-400 text-sm py-2">⏳ 結果揭示中…</div>
        ) : !myConfirmed ? (
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
            style={{ background:"linear-gradient(90deg,#f59e0b,#d97706)", color:"white" }}>
            {loading ? "處理中…" : "✨ 結算事件效果"}
          </button>
        ) : (
          <div className="text-center text-emerald-400 text-sm py-2 font-bold">✅ 已確認，等待房主結算</div>
        )}

        {isHost && myConfirmed && !allConfirmed && !hasResult && (
          <button onClick={handleResolve} disabled={loading}
            className="w-full py-2 rounded-xl text-amber-400 text-xs font-bold bg-amber-900/30 border border-amber-500/30">
            👑 強制結算（{Object.keys(roomConfirms).length}/{aliveIds.length} 已確認）
          </button>
        )}
      </div>
    </DungeonEventStage>
  );
}
