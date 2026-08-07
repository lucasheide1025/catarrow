// src/components/member/BossDuel.jsx
// 終點 Boss 決戰（08-07 重做）：三階段演出——登場 → 決戰（Boss 血條＋6 箭）→ 討伐成功。
// 單人/組隊共用；組隊＝全員各自射 6 箭、共享同一隻 Boss 的血條（onFinish 帶自己的 6 箭分數）。
// 與怪物格的差別：怪物格是小面板直接計分；Boss 有登場、血條、命中演出與討伐成功畫面。
import { useState, useEffect, useCallback, useRef } from "react";
import { bossDuelState } from "../../lib/boardData";
import { sfxTap, sfxSuccess, sfxBoardLap, sfxBoardDiceLand } from "../../lib/sound";

const SCORE_PAD = [["X", 10], ["10", 10], ["9", 9], ["8", 8], ["7", 7], ["6", 6], ["5", 5], ["3", 3], ["M", 0]];
const BOSS_MAX_HP = 100;   // 血條用 %——6 箭完成度（scoreRatio）就是打掉的 Boss HP

export default function BossDuel({ obstacle, tier, party = false, onFinish, zIndex = 135 }) {
  const [phase, setPhase] = useState("intro");     // intro → duel → outcome
  const [arrows, setArrows] = useState([]);        // 6 箭分數（label 用 X/10/9/…）
  const [hp, setHp] = useState(BOSS_MAX_HP);       // 血條數值（duel 逐箭預演扣、outcome 動畫）
  const hpRef = useRef(BOSS_MAX_HP);
  const [dmgShown, setDmgShown] = useState(0);
  const finishRef = useRef(false);

  const obs = obstacle || { name: "終點 Boss", emoji: "⚔️", action: "守護終點的強大存在", bgColor: "#1e293b" };
  const score = arrows.reduce((s, v) => s + v, 0);
  const { ratio, band, hpLeft, downed } = bossDuelState(score);   // 血條/分帶單一真源

  // 登場演出（1.7s）
  useEffect(() => {
    if (phase !== "intro") return undefined;
    sfxBoardDiceLand();
    const t = setTimeout(() => setPhase("duel"), 1700);
    return () => clearTimeout(t);
  }, [phase]);

  // 逐箭命中：血條即時扣血（duel 階段輸入分數時）
  const hit = useCallback((label, val) => {
    sfxTap();
    setArrows(a => {
      if (a.length >= 6) return a;
      const next = [...a, val];
      const r = Math.min(1, next.reduce((s, v) => s + v, 0) / 60);
      hpRef.current = Math.max(0, BOSS_MAX_HP - r * BOSS_MAX_HP);
      setHp(hpRef.current);
      return next;
    });
  }, []);

  // 攻擊（滿 6 箭）：血條動畫扣到底 + 傷害數字 → 討伐成功演出
  const attack = useCallback(() => {
    if (arrows.length < 6 || finishRef.current) return;
    finishRef.current = true;
    sfxBoardLap();
    setPhase("outcome");
    const target = hpLeft;   // 血條最後停在剩餘 HP
    // 血條快速扣到最終值（~1s），傷害數字同步跳
    const start = Date.now();
    const from = hpRef.current;
    const iv = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 900);
      const v = Math.round(from + (target - from) * p);
      setHp(v);
      setDmgShown(Math.round(p * ratio * 100));
      if (p >= 1) {
        clearInterval(iv);
        sfxSuccess();
        setDmgShown(Math.round(ratio * 100));
        setTimeout(() => onFinish(arrows), 1600);   // 討伐畫面停留後交分
      }
    }, 50);
    return () => clearInterval(iv);
  }, [arrows, ratio, onFinish]); // eslint-disable-line

  const hpColor = hp > 50 ? "#22c55e" : hp > 25 ? "#eab308" : "#ef4444";

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4" style={{ zIndex }}>
      {phase === "intro" && (
        // ── 登場：Boss 現身 ──
        <div className="text-center animate-[fx-pop-in_0.4s_cubic-bezier(.34,1.56,.64,1)]">
          <div className="text-[10px] font-black tracking-[.35em] text-rose-300/80 mb-3">⚠ 終點・BOSS 現身 ⚠</div>
          <div className="relative mx-auto w-44 h-44 rounded-3xl overflow-hidden flex items-center justify-center shadow-2xl board-chest-shake"
            style={{ background: `linear-gradient(160deg, ${obs.bgColor || "#3f1d1d"}, #120a08)`, border: "2px solid rgba(248,113,113,.5)", boxShadow: "0 0 60px rgba(248,113,113,.35)" }}>
            <span className="text-8xl drop-shadow-[0_6px_18px_rgba(0,0,0,.6)]">{obs.emoji || "⚔️"}</span>
          </div>
          <div className="mt-4 text-rose-100 font-black text-xl">{obs.name || "終點 Boss"}</div>
          <div className="mt-1 text-rose-200/60 text-xs font-bold">🛠️ {obs.action}</div>
          <div className="mt-3 inline-block rounded-full bg-rose-500/20 border border-rose-400/40 px-3 py-1 text-[10px] font-black text-rose-200">
            T{tier}・{party ? "全員出戰" : "決戰開始"}
          </div>
        </div>
      )}

      {phase === "duel" && (
        // ── 決戰：Boss 血條 + 6 箭 ──
        <div className="w-full max-w-sm">
          <div className="rounded-3xl border-2 bg-slate-900/95 p-5 animate-[fx-pop-in_0.3s_cubic-bezier(.34,1.56,.64,1)]"
            style={{ borderColor: "rgba(248,113,113,.45)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{obs.emoji || "⚔️"}</span>
                <div>
                  <div className="text-rose-100 font-black text-sm leading-tight">{obs.name || "終點 Boss"}</div>
                  <div className="text-[9px] font-bold text-rose-200/50">T{tier} 終點 Boss</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-bold text-slate-400">BOSS HP</div>
                <div className="text-sm font-black" style={{ color: hpColor }}>{Math.round(hp)}<span className="text-[9px] text-slate-400 font-bold">/{BOSS_MAX_HP}</span></div>
              </div>
            </div>
            {/* 血條：逐箭命中即時扣 */}
            <div className="h-3 rounded-full bg-black/50 border border-white/10 overflow-hidden mb-2">
              <div className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${hp}%`, background: `linear-gradient(90deg, ${hpColor}, ${hpColor}cc)`, boxShadow: `0 0 12px ${hpColor}88` }} />
            </div>
            <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-3">
              <span>每箭命中都會扣 Boss 血</span><span>完成度 {Math.round(ratio * 100)}%</span>
            </div>

            {/* 6 箭槽 */}
            <div className="flex justify-center gap-1 mb-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border ${arrows[i] != null ? "bg-rose-600 text-white border-rose-400" : "bg-slate-800 text-slate-500 border-slate-700"}`}>{arrows[i] != null ? arrows[i] : "?"}</div>
              ))}
            </div>
            {/* 分數按鈕 */}
            <div className="grid grid-cols-5 gap-1.5">
              {SCORE_PAD.map(([label, val]) => (
                <button key={label} disabled={arrows.length >= 6}
                  onClick={() => hit(label, val)}
                  className="py-2 rounded-lg bg-rose-500/20 text-rose-100 font-black text-xs border border-rose-400/30 disabled:opacity-40 active:scale-95 transition-transform">{label}</button>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setArrows([])} className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">清除</button>
              <button onClick={attack} disabled={arrows.length < 6}
                className="flex-[2] py-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-black text-sm shadow-lg active:scale-95 transition-transform disabled:opacity-40">
                {arrows.length < 6 ? `填箭（${arrows.length}/6）` : "🎯 攻擊 Boss！"}
              </button>
            </div>
            {party && <div className="mt-2 text-center text-[9px] font-bold text-slate-500">組隊：全員各自射 6 箭，血條是大家的</div>}
          </div>
        </div>
      )}

      {phase === "outcome" && (
        // ── 討伐成功：血條扣到底 + 分帶 ──
        <div className="w-full max-w-sm text-center animate-[fx-pop-in_0.35s_cubic-bezier(.34,1.56,.64,1)]">
          <div className="rounded-3xl border-2 bg-slate-900/95 p-6" style={{ borderColor: band.band === "S" ? "rgba(250,204,21,.6)" : "rgba(248,113,113,.45)" }}>
            <div className="text-6xl mb-2">{downed ? "💀" : "⚔️"}</div>
            <div className="text-2xl font-black mb-1" style={{ color: downed ? "#fde68a" : "#fca5a5" }}>
              {downed ? "Boss 倒下！" : "討伐成功！"}
            </div>
            <div className="text-[10px] font-bold text-slate-400 mb-4">終點 Boss・{obs.name}　完成度 {Math.round(ratio * 100)}%</div>
            {/* 血條：動畫扣血到最終值 */}
            <div className="h-4 rounded-full bg-black/50 border border-white/10 overflow-hidden mb-2">
              <div className="h-full rounded-full transition-[width] duration-100"
                style={{ width: `${hp}%`, background: `linear-gradient(90deg, ${hp > 50 ? "#22c55e" : hp > 25 ? "#eab308" : "#ef4444"}, #00000000)`, boxShadow: "0 0 14px rgba(248,113,113,.5)" }} />
            </div>
            <div className="text-[10px] font-bold text-slate-500 mb-3">Boss HP 剩 {Math.round(hp)}%　・　本次輸出 <span className="text-rose-300 font-black">{dmgShown}%</span></div>
            <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-black ${band.band === "S" ? "bg-yellow-500/25 text-yellow-300" : band.band === "A" ? "bg-emerald-500/20 text-emerald-300" : band.band === "B" ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-600/30 text-slate-300"}`}>
              {band.band} 級討伐
            </div>
            <div className="mt-4 text-[10px] font-bold text-amber-200/60">獎勵依討伐等級發放，不會輸</div>
          </div>
        </div>
      )}
    </div>
  );
}
