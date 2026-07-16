import { useState } from "react";
import { DUNGEON_TARGET_FORMATS } from "../../lib/dungeonRunSettings";
import {
  getSoundEnabled,
  getVibrationEnabled,
  setSoundEnabled,
  setVibrationEnabled,
} from "../../lib/fxSettings";

export default function DungeonRunSettings({
  arrowsPerRound,
  targetFmt,
  onArrowsChange,
  onTargetChange,
  disabled = false,
  readOnlyNote = "",
}) {
  const [soundEnabled, setSoundState] = useState(getSoundEnabled);
  const [vibrationEnabled, setVibrationState] = useState(getVibrationEnabled);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundState(next);
  }

  function toggleVibration() {
    const next = !vibrationEnabled;
    setVibrationEnabled(next);
    setVibrationState(next);
  }

  return (
    <section className="rounded-2xl p-4 space-y-4"
      style={{ background:"rgba(99,102,241,0.09)", border:"1px solid rgba(129,140,248,0.24)" }}>
      <div>
        <h3 className="text-base font-black text-indigo-200">🏹 本次遠征規則</h3>
        <p className="text-xs text-slate-400 mt-1">
          開始遠征後鎖定，所有樓層與隊員使用相同設定。
        </p>
      </div>

      <fieldset disabled={disabled}>
        <legend className="text-sm font-bold text-slate-200 mb-2">每回合箭數</legend>
        <div className="grid grid-cols-2 gap-2">
          {[3, 6].map(count => {
            const active = arrowsPerRound === count;
            return (
              <button key={count} type="button"
                onClick={() => onArrowsChange?.(count)}
                className="py-3 rounded-xl font-black text-base transition-colors focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-default"
                style={{
                  background:active ? "linear-gradient(90deg,#f59e0b,#d97706)" : "rgba(255,255,255,0.06)",
                  color:active ? "white" : "#94a3b8",
                  border:`1px solid ${active ? "rgba(251,191,36,0.65)" : "rgba(255,255,255,0.12)"}`,
                  touchAction:"manipulation",
                }}>
                {count} 箭／回合
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset disabled={disabled}>
        <legend className="text-sm font-bold text-slate-200 mb-2">射擊靶紙</legend>
        <div className="grid grid-cols-3 gap-2">
          {DUNGEON_TARGET_FORMATS.map(format => {
            const active = targetFmt === format.id;
            return (
              <button key={format.id} type="button"
                onClick={() => onTargetChange?.(format.id)}
                className="min-w-0 py-2.5 px-1 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-default"
                style={{
                  background:active ? "rgba(16,185,129,0.22)" : "rgba(255,255,255,0.05)",
                  color:active ? "#6ee7b7" : "#94a3b8",
                  border:`1px solid ${active ? "rgba(52,211,153,0.62)" : "rgba(255,255,255,0.12)"}`,
                  touchAction:"manipulation",
                }}>
                <span className="block text-sm font-black truncate">{format.label}</span>
                <span className="block text-[10px] mt-0.5 opacity-75">{format.sub}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-2" aria-label="地下城回饋設定">
        <button type="button" onClick={toggleSound}
          aria-pressed={soundEnabled}
          className="min-h-11 rounded-xl px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-amber-300"
          style={{
            background:soundEnabled ? "rgba(245,158,11,0.16)" : "rgba(255,255,255,0.05)",
            color:soundEnabled ? "#fde68a" : "#94a3b8",
            border:`1px solid ${soundEnabled ? "rgba(251,191,36,0.45)" : "rgba(255,255,255,0.12)"}`,
          }}>
          <span className="block text-sm font-black">{soundEnabled ? "🔊 音效開啟" : "🔇 音效關閉"}</span>
          <span className="block text-[10px] mt-0.5 opacity-75">可隨時調整</span>
        </button>
        <button type="button" onClick={toggleVibration}
          aria-pressed={vibrationEnabled}
          className="min-h-11 rounded-xl px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-cyan-300"
          style={{
            background:vibrationEnabled ? "rgba(34,211,238,0.13)" : "rgba(255,255,255,0.05)",
            color:vibrationEnabled ? "#a5f3fc" : "#94a3b8",
            border:`1px solid ${vibrationEnabled ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.12)"}`,
          }}>
          <span className="block text-sm font-black">{vibrationEnabled ? "📳 震動開啟" : "📴 震動關閉"}</span>
          <span className="block text-[10px] mt-0.5 opacity-75">依裝置支援</span>
        </button>
      </div>

      {readOnlyNote && (
        <p className="text-xs text-center text-slate-400">{readOnlyNote}</p>
      )}
    </section>
  );
}
