// src/components/member/DailyQuest.jsx
// 今日報到 + Buff 演出 + 今日任務（學生端）
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  submitCheckin, subscribeMyCheckin, rerollCheckinBuff, markQuestDone,
  getDailyQuestConfig, getDailyQuestCount,
} from "../../lib/db";
import { drawBuff } from "../../lib/buffPool";
import { sfxCast, sfxBuff, sfxEpic, sfxSuccess, sfxTap, sfxSoftFail, vibrate } from "../../lib/sound";

export default function DailyQuest() {
  const { profile } = useAuth();
  const [checkin, setCheckin] = useState(undefined);   // undefined=載入中, null=今天還沒報到
  const [config, setConfig] = useState(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showBuff, setShowBuff] = useState(false);     // Buff 演出彈窗
  const [arrows, setArrows] = useState([]);   // 每箭分數陣列

  useEffect(() => {
    if (!profile?.id) return;
    getDailyQuestConfig().then(setConfig);
    getDailyQuestCount(profile.id).then(setCount);
    const unsub = subscribeMyCheckin(profile.id, c => setCheckin(c));
    return () => unsub && unsub();
  }, [profile?.id]);

  // 核准後第一次看到 buff → 自動播放演出
  useEffect(() => {
    if (checkin?.status === "approved" && checkin?.buff && !checkin?.questDone) {
      const seen = sessionStorage.getItem("buffSeen_" + checkin.id);
      if (!seen) { setShowBuff(true); sessionStorage.setItem("buffSeen_" + checkin.id, "1"); }
    }
  }, [checkin?.status, checkin?.buff, checkin?.id]);

  if (checkin === undefined || !config) return null;

  const rewardEvery = config.rewardEvery || 10;
  const remain = rewardEvery - (count % rewardEvery);

  // 今日任務目標（套用 buff 降門檻）
  const buffPower = checkin?.buff?.power || 0;
  const isUltimate = buffPower >= 999;
  let targetScore = config.targetScore, targetHits = config.targetHits;
  if (config.targetType === "score") targetScore = Math.max(1, config.targetScore - buffPower);
  else targetHits = Math.max(1, config.targetHits - buffPower);

  async function doCheckin() {
    setBusy(true);
    sfxTap();
    await submitCheckin(profile.id, profile.name, profile.nickname);
    setBusy(false);
  }

  async function reroll() {
    setBusy(true);
    const newFail = (checkin.failCount || 0) + 1;
    const b = drawBuff(newFail);
    await rerollCheckinBuff(checkin.id, b, newFail);
    setArrows([]);
    setShowBuff(true);
    setBusy(false);
  }

  async function submitScore() {
    const total = arrows.reduce((s, v) => s + (v || 0), 0);
    const hits = arrows.filter(v => v > 0).length;
    const val = config.targetType === "score" ? total : hits;
    const target = config.targetType === "score" ? targetScore : targetHits;
    const pass = isUltimate || val >= target;
    if (pass) {
      sfxSuccess();
      await markQuestDone(checkin.id, { type: config.targetType, value: val, target });
    } else {
      sfxSoftFail();
      await reroll();
    }
  }

  // ── 畫面狀態 ──

  // 1. 今天還沒報到 → 大按鈕
  if (!checkin) {
    return (
      <div className="rounded-2xl p-5 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)" }}>
        <div className="text-xs font-black tracking-wider text-purple-100 mb-1">每日任務</div>
        <div className="text-lg font-black mb-1">📍 今日尚未報到</div>
        <div className="text-purple-100 text-xs mb-4">報到後接受教練加成，挑戰今日任務！還差 {remain} 次換成就銀章 🥈</div>
        <button onClick={doCheckin} disabled={busy}
          className="w-full py-3.5 rounded-xl bg-white text-purple-700 font-black text-base active:scale-95 transition-transform">
          {busy ? "報到中…" : "📍 今日報到"}
        </button>
      </div>
    );
  }

  // 2. 已報到，等教練核准
  if (checkin.status === "pending") {
    return (
      <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#475569,#334155)" }}>
        <div className="text-xs font-black tracking-wider text-slate-300 mb-1">每日任務</div>
        <div className="text-lg font-black mb-1">⏳ 報到成功，等待教練加成</div>
        <div className="text-slate-300 text-xs">教練正在準備為你施法，稍候片刻… 🪄</div>
      </div>
    );
  }

  // 3. 已核准，任務進行中（含重抽）
  if (checkin.status === "approved" && !checkin.questDone) {
    const buff = checkin.buff;
    return (
      <>
        <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#16a34a,#0891b2)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-black tracking-wider text-emerald-100">今日任務進行中</div>
            {checkin.failCount > 0 && <div className="text-xs text-emerald-100">第 {checkin.failCount + 1} 次挑戰</div>}
          </div>

          {/* 當前 Buff */}
          {buff && (
            <button onClick={() => setShowBuff(true)}
              className="w-full bg-white/15 rounded-xl px-3 py-2 mb-3 flex items-center gap-2 border border-white/20">
              <span className="text-2xl">{buff.icon}</span>
              <div className="text-left">
                <div className="text-xs text-emerald-100">教練給你的加成</div>
                <div className="font-black text-sm">{buff.name}</div>
              </div>
              <span className="ml-auto text-xs text-emerald-100">點看演出</span>
            </button>
          )}

          {/* 任務目標 */}
          <div className="bg-white/10 rounded-xl p-3 mb-3">
            <div className="text-xs text-emerald-100 mb-1">🎯 今日目標</div>
            <div className="text-sm font-bold">
              {config.targetName}　{config.distance}米　{config.arrowCount}箭
            </div>
            <div className="text-lg font-black mt-1">
              {isUltimate ? "✨ 直接達標！登記即可" :
                config.targetType === "score" ? `總分達到 ${targetScore} 分` : `命中 ${targetHits} 箭以上`}
            </div>
          </div>

          {/* 點擊式計分器 */}
          {!isUltimate && (
            <ArrowScorer arrowCount={config.arrowCount} arrows={arrows} setArrows={setArrows} targetType={config.targetType} />
          )}

          {/* 登記 */}
          <button onClick={submitScore} disabled={busy || (!isUltimate && arrows.length < config.arrowCount)}
            className="w-full py-3 rounded-xl bg-white text-emerald-700 font-black active:scale-95 transition-transform disabled:opacity-50">
            {isUltimate ? "✨ 直接完成任務" : arrows.length < config.arrowCount ? `還要射 ${config.arrowCount - arrows.length} 箭` : "登記成績"}
          </button>
          <div className="text-emerald-100 text-xs mt-2 text-center">沒過也別擔心，教練會給你更強的加成再來一次 💪</div>
        </div>

        {showBuff && buff && <BuffShow buff={buff} failCount={checkin.failCount} onClose={() => setShowBuff(false)} />}
      </>
    );
  }

  // 4. 任務達標，等教練最終確認
  if (checkin.questDone && !checkin.finalConfirmed) {
    return (
      <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
        <div className="text-xs font-black tracking-wider text-amber-100 mb-1">今日任務</div>
        <div className="text-lg font-black mb-1">🎉 任務達標！</div>
        <div className="text-amber-100 text-xs">等教練最終確認後計入次數。還差 {remain} 次換成就銀章 🥈</div>
      </div>
    );
  }

  // 5. 已完成並確認
  return (
    <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
      <div className="text-xs font-black tracking-wider text-emerald-100 mb-1">今日任務</div>
      <div className="text-lg font-black mb-1">✅ 今日任務完成！</div>
      <div className="text-emerald-100 text-xs">已完成 {count} 次　還差 {remain} 次換成就銀章 🥈　明天再來挑戰！</div>
    </div>
  );
}

// ── Buff 華麗演出 ──
function BuffShow({ buff, failCount, onClose }) {
  const [step, setStep] = useState(0);   // 0=施法, 1+=逐行台詞
  const lines = buff.lines || [];

  useEffect(() => {
    setStep(0);
    const timers = [];
    sfxCast();                                                 // 施法音
    timers.push(setTimeout(() => {
      setStep(1);
      if ((buff.power || 0) >= 3) sfxEpic();                   // 史詩/保底：澎湃音
      else sfxBuff();                                          // 一般 buff：叮!
    }, 900));
    lines.forEach((_, i) => timers.push(setTimeout(() => setStep(2 + i), 900 + (i + 1) * 800)));
    return () => timers.forEach(clearTimeout);
  }, [buff?.name]);

  const isUltimate = (buff.power || 0) >= 999;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6"
      style={{ background: "rgba(5,8,20,.82)", animation: "bfFade .25s ease" }} onClick={onClose}>
      <div className="relative w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>
        {/* 旋轉魔法陣 */}
        <div className="absolute left-1/2 top-1/2 pointer-events-none"
          style={{
            width: 280, height: 280, marginLeft: -140, marginTop: -140, opacity: .5,
            background: `conic-gradient(from 0deg, transparent, ${isUltimate ? "#fbbf24" : "#a78bfa"}, transparent 40%)`,
            borderRadius: "9999px", animation: "bfSpin 3s linear infinite",
          }} />

        <div className="relative">
          {step === 0 && (
            <div style={{ animation: "bfPop .4s ease" }}>
              <div className="text-5xl mb-3" style={{ animation: "bfShake .4s ease infinite" }}>🪄</div>
              <div className="text-purple-200 font-black tracking-widest">教練施法中…</div>
            </div>
          )}
          {step >= 1 && (
            <div style={{ animation: "bfPop .45s cubic-bezier(.18,.89,.32,1.4)" }}>
              <div className="text-7xl mb-2" style={{ filter: "drop-shadow(0 6px 20px rgba(167,139,250,.6))", animation: "bfBounce 1s ease infinite" }}>
                {buff.icon}
              </div>
              <div className={`font-black text-2xl mb-4 ${isUltimate ? "text-amber-300" : "text-white"}`}
                style={{ textShadow: "0 2px 14px rgba(0,0,0,.5)" }}>
                {buff.name}
              </div>
              <div className="flex flex-col gap-2 min-h-[60px]">
                {lines.map((ln, i) => (
                  step >= 2 + i && (
                    <div key={i} className="text-white/90 text-sm font-medium" style={{ animation: "bfSlide .4s ease" }}>
                      {ln}
                    </div>
                  )
                ))}
              </div>
              {failCount > 0 && step >= 1 + lines.length && (
                <div className="text-amber-200 text-xs mt-3">失敗 {failCount} 次，加成更強了！</div>
              )}
              {step >= 1 + lines.length && (
                <button onClick={() => { sfxTap(); onClose(); }}
                  className="mt-5 px-8 py-2.5 rounded-full font-black"
                  style={{ background: isUltimate ? "linear-gradient(90deg,#fbbf24,#f59e0b)" : "linear-gradient(90deg,#a78bfa,#7c3aed)", color: "#fff" }}>
                  開始挑戰 →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bfFade { from{opacity:0} to{opacity:1} }
        @keyframes bfSpin { to { transform: rotate(360deg) } }
        @keyframes bfPop { 0%{transform:scale(.6);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes bfBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes bfShake { 0%,100%{transform:rotate(-12deg)} 50%{transform:rotate(12deg)} }
        @keyframes bfSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

// ── 點擊式計分器（每箭點分數，自動加總）──
function ArrowScorer({ arrowCount, arrows, setArrows, targetType }) {
  const SCORES = [
    { label: "X", val: 10, color: "#fbbf24" },
    { label: "10", val: 10, color: "#fbbf24" },
    { label: "9", val: 9, color: "#fbbf24" },
    { label: "8", val: 8, color: "#ef4444" },
    { label: "7", val: 7, color: "#ef4444" },
    { label: "6", val: 6, color: "#3b82f6" },
    { label: "5", val: 5, color: "#3b82f6" },
    { label: "4", val: 4, color: "#1e293b" },
    { label: "3", val: 3, color: "#1e293b" },
    { label: "2", val: 2, color: "#9ca3af" },
    { label: "1", val: 1, color: "#9ca3af" },
    { label: "M", val: 0, color: "#64748b" },
  ];
  const next = arrows.length;            // 下一支要填第幾箭
  const total = arrows.reduce((s, v) => s + (v || 0), 0);
  const hits = arrows.filter(v => v > 0).length;

  function tap(val) {
    if (arrows.length >= arrowCount) return;
    sfxTap();
    setArrows([...arrows, val]);
  }
  function undo() {
    if (!arrows.length) return;
    setArrows(arrows.slice(0, -1));
  }

  return (
    <div className="bg-white/10 rounded-xl p-3 mb-3">
      {/* 已射的箭 */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {Array.from({ length: arrowCount }).map((_, i) => (
          <span key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black
            ${i < arrows.length ? "bg-white text-emerald-700" : i === next ? "bg-white/30 text-white ring-2 ring-white" : "bg-white/15 text-white/50"}`}>
            {i < arrows.length ? (arrows[i] === 0 ? "M" : arrows[i]) : ""}
          </span>
        ))}
        {arrows.length > 0 && (
          <button onClick={undo} className="ml-auto text-white/80 text-xs underline">↩ 退一箭</button>
        )}
      </div>

      {/* 計分按鈕 */}
      {arrows.length < arrowCount && (
        <div className="grid grid-cols-6 gap-1.5">
          {SCORES.map(s => (
            <button key={s.label} onClick={() => tap(s.val)}
              className="py-2 rounded-lg font-black text-white text-sm active:scale-90 transition-transform"
              style={{ background: s.color }}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* 即時統計 */}
      <div className="flex justify-between mt-2 text-white text-sm font-bold">
        <span>{targetType === "score" ? `總分 ${total}` : `中靶 ${hits} 箭`}</span>
        <span className="text-emerald-100">{arrows.length}/{arrowCount} 箭</span>
      </div>
    </div>
  );
}