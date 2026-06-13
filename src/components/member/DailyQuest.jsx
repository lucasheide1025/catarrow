// src/components/member/DailyQuest.jsx
// 今日報到 + Buff 演出 + 三個隨機任務（三選一）
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  submitCheckin, submitSimpleCheckin, subscribeMyCheckin, rerollCheckinBuff, markQuestDone,
  getDailyQuestConfig, cancelCheckin,
} from "../../lib/db";
import { drawBuff } from "../../lib/buffPool";
import { sfxCast, sfxBuff, sfxEpic, sfxSuccess, sfxTap, sfxSoftFail, vibrate } from "../../lib/sound";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { createPartyRoom } from "../../lib/partyDb";

// 靶紙清單
const TARGET_TYPES = ["菜雞靶", "克蘇魯", "原野射箭", "人質靶", "殭屍靶", "飛鏢靶"];

// 從設定產生三個隨機任務（三選一）
// task1: 達到分數；task2: 命中數；task3: 另一個分數（不同射程/靶紙）
function generateTasks(config) {
  const minDist = config.distanceMin || 1;
  const maxDist = config.distanceMax || 15;
  const minScore = config.scoreMin || 1;
  const maxScore = config.scoreMax || 100;
  const minHits = config.hitsMin || 1;
  const maxHits = config.hitsMax || 6;
  const arrowCount = config.arrowCount || 6;

  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function randTarget() { return TARGET_TYPES[Math.floor(Math.random() * TARGET_TYPES.length)]; }

  return [
    {
      id: "score",
      type: "score",
      icon: "🎯",
      label: "分數挑戰",
      distance: randInt(minDist, maxDist),
      target: randTarget(),
      arrowCount,
      goal: randInt(minScore, maxScore),
    },
    {
      id: "hits",
      type: "hits",
      icon: "💥",
      label: "命中挑戰",
      distance: randInt(minDist, maxDist),
      target: randTarget(),
      arrowCount,
      goal: Math.min(randInt(minHits, maxHits), arrowCount),
    },
    {
      id: "score2",
      type: "score",
      icon: "🏹",
      label: "遠距挑戰",
      distance: randInt(Math.ceil((minDist + maxDist) / 2), maxDist), // 偏遠
      target: randTarget(),
      arrowCount,
      goal: randInt(minScore, Math.ceil(maxScore * 0.7)),
    },
  ];
}

// 套用 Buff 降幅到任務目標
function applyBuff(task, buff) {
  if (!buff) return task;
  const power = buff.actualPower || (Array.isArray(buff.power) ? buff.power[0] : buff.power) || 0;
  if (power >= 999) return { ...task, buffed: true, isUltimate: true };
  const reduction = Math.round(task.goal * power / 100);
  const newGoal = Math.max(1, task.goal - reduction);
  return { ...task, buffed: true, originalGoal: task.goal, newGoal, reduction, reductionPct: power };
}

export default function DailyQuest({ onJoinParty }) {
  const { profile } = useAuth();
  const [checkin, setCheckin]   = useState(undefined);
  const [config,  setConfig]    = useState(null);
  const [busy,       setBusy]       = useState(false);
  const [showBuff,   setShowBuff]   = useState(false);
  const [showChoice, setShowChoice] = useState(false); // 選擇「純報到」或「完成任務」

  // 三個任務（從 checkin 裡存的，或重新產生）
  const [tasks, setTasks] = useState(null);
  // 學生選了哪個任務（index 0/1/2）
  const [chosenIdx, setChosenIdx] = useState(null);
  // 計分器
  const [arrows, setArrows] = useState([]);
  // 組隊邀請流程
  const [partyAsk,      setPartyAsk]      = useState(false);
  const [partyCreating, setPartyCreating] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    getDailyQuestConfig().then(setConfig);
    const unsub = subscribeMyCheckin(profile.id, c => setCheckin(c));
    return () => unsub && unsub();
  }, [profile?.id]);

  const count = profile?.dailyQuestCount || 0;

  // 核准後第一次看到 buff → 自動播放演出，同時產生/恢復任務
  useEffect(() => {
    if (checkin?.status === "approved" && checkin?.buff && !checkin?.questDone) {
      const seen = sessionStorage.getItem("buffSeen_" + checkin.id);
      if (!seen) {
        setShowBuff(true);
        sessionStorage.setItem("buffSeen_" + checkin.id, "1");
      }
      // 從 checkin 恢復任務（重新整理後不消失）
      if (checkin.tasks) {
        setTasks(checkin.tasks);
      } else if (config) {
        const generated = generateTasks(config);
        setTasks(generated);
      }
      // 恢復已選的任務
      if (checkin.chosenTask != null) setChosenIdx(checkin.chosenTask);
    }
  }, [checkin?.status, checkin?.buff, checkin?.id, config]); // eslint-disable-line

  if (checkin === undefined || !config) return null;

  const rewardEvery = config.rewardEvery || 10;
  const remain = rewardEvery - (count % rewardEvery);
  const buff = checkin?.buff;

  async function doCheckin() {
    setBusy(true); setShowChoice(false);
    sfxTap();
    await submitCheckin(profile.id, profile.name, profile.nickname);
    setBusy(false);
  }

  async function doSimpleCheckin() {
    setBusy(true); setShowChoice(false);
    sfxTap();
    await submitSimpleCheckin(profile.id, profile.name, profile.nickname);
    setBusy(false);
  }

  async function doCancel() {
    if (!checkin?.id) return;
    setBusy(true);
    sfxTap();
    await cancelCheckin(checkin.id);
    setBusy(false);
  }

  async function reroll() {
    setBusy(true);
    const newFail = (checkin.failCount || 0) + 1;
    const b = drawBuff(newFail);
    await rerollCheckinBuff(checkin.id, b, newFail);
    // 重新產生任務
    if (config) {
      const newTasks = generateTasks(config);
      setTasks(newTasks);
    }
    setChosenIdx(null);
    setArrows([]);
    setShowBuff(true);
    setBusy(false);
  }

  async function chooseTask(idx) {
    setChosenIdx(idx);
    setArrows([]);
    if (onJoinParty) setPartyAsk(true);
    try {
      await updateDoc(doc(db, "checkins", checkin.id), { chosenTask: idx, tasks });
    } catch {}
  }

  async function handleCreateParty() {
    if (!tasks || chosenIdx == null) return;
    setPartyCreating(true);
    const task = tasks[chosenIdx];
    const bt = applyBuff(task, buff);
    const effectiveGoal = bt.newGoal ?? bt.goal;
    const taskForRoom = { ...task, goal: effectiveGoal };
    const res = await createPartyRoom(
      profile.id, profile.nickname || profile.name, "quest",
      { task: taskForRoom, checkinId: checkin.id }
    );
    setPartyCreating(false);
    if (res.ok) onJoinParty(res.roomId, "quest", true);
  }

  async function submitScore() {
    const task = chosenTask;
    const total = arrows.reduce((s, v) => s + (v || 0), 0);
    const hits = arrows.filter(v => v > 0).length;
    const buffedTask = applyBuff(task, buff);
    const isUltimate = buffedTask.isUltimate;
    const goalToHit = buffedTask.newGoal ?? buffedTask.goal;
    const val = task.type === "score" ? total : hits;
    const pass = isUltimate || val >= goalToHit;
    if (pass) {
      sfxSuccess();
      await markQuestDone(checkin.id, { type: task.type, value: val, target: goalToHit, taskId: task.id });
    } else {
      sfxSoftFail();
      await reroll();
    }
  }

  const chosenTask = (tasks && chosenIdx != null) ? tasks[chosenIdx] : null;
  const buffedChosenTask = chosenTask ? applyBuff(chosenTask, buff) : null;

  // ── 畫面狀態 ──

  // 1. 今天還沒報到
  if (!checkin) {
    return (
      <div className="rounded-2xl p-5 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)" }}>
        <div className="text-xs font-black tracking-wider text-purple-100 mb-1">每日任務</div>
        <div className="text-lg font-black mb-1">📍 今日尚未報到</div>
        <div className="text-purple-100 text-xs mb-4">還差 {remain} 次換成就銀章 🥈</div>

        {!showChoice ? (
          <button onClick={() => setShowChoice(true)} disabled={busy}
            className="w-full py-3.5 rounded-xl bg-white text-purple-700 font-black text-base active:scale-95 transition-transform">
            {busy ? "報到中…" : "📍 今日報到"}
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-center text-purple-100 text-sm font-bold">選擇今天的報到方式：</div>

            {/* 純報到 */}
            <button onClick={doSimpleCheckin} disabled={busy}
              className="w-full py-3.5 rounded-xl bg-white/20 border border-white/40 text-white font-black text-sm active:scale-95 transition-transform flex flex-col items-center gap-0.5">
              <span className="text-base">✅ 純報到</span>
              <span className="text-purple-200 text-xs font-normal">次數 +1，直接完成</span>
            </button>

            {/* 完成今日任務 */}
            <button onClick={doCheckin} disabled={busy}
              className="w-full py-3.5 rounded-xl bg-white text-purple-700 font-black text-sm active:scale-95 transition-transform flex flex-col items-center gap-0.5">
              <span className="text-base">🎯 完成今日任務</span>
              <span className="text-purple-400 text-xs font-normal">接受教練加成 + 完成後送 🧰 鐵寶箱</span>
            </button>

            <button onClick={() => setShowChoice(false)}
              className="text-purple-300 text-xs text-center underline">取消</button>
          </div>
        )}
      </div>
    );
  }

  // 2. 已報到，等教練核准
  if (checkin.status === "pending") {
    return (
      <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#475569,#334155)" }}>
        <div className="text-xs font-black tracking-wider text-slate-300 mb-1">每日任務</div>
        <div className="text-lg font-black mb-2">⏳ 報到成功，等待教練加成</div>
        <div className="text-slate-300 text-xs mb-4">教練正在準備為你施法，稍候片刻… 🪄</div>
        <button onClick={doCancel} disabled={busy}
          className="w-full py-2.5 rounded-xl bg-white/20 text-white font-bold text-sm active:scale-95 transition-transform border border-white/30">
          {busy ? "取消中…" : "✕ 取消報到"}
        </button>
      </div>
    );
  }

  // 3. 已核准，選任務或進行任務
  if (checkin.status === "approved" && !checkin.questDone) {
    return (
      <>
        <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#16a34a,#0891b2)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-black tracking-wider text-emerald-100">今日任務進行中</div>
            {checkin.failCount > 0 && <div className="text-xs text-emerald-100">第 {checkin.failCount + 1} 次挑戰</div>}
          </div>

          {/* 當前 Buff + 降幅說明 */}
          {buff && (
            <button onClick={() => setShowBuff(true)}
              className="w-full bg-white/15 rounded-xl px-3 py-2 mb-3 flex items-center gap-2 border border-white/20">
              <span className="text-2xl">{buff.icon}</span>
              <div className="text-left flex-1">
                <div className="text-xs text-emerald-100">教練給你的加成</div>
                <div className="font-black text-sm">{buff.name}</div>
                {buff.actualPower >= 999 ? (
                  <div className="text-xs text-amber-200 font-bold">✨ 直接過關！</div>
                ) : (
                  <div className="text-xs text-emerald-200">目標降低 {buff.actualPower}%</div>
                )}
              </div>
              <span className="text-xs text-emerald-100 flex-shrink-0">點看演出</span>
            </button>
          )}

          {/* 三選一任務 */}
          {chosenIdx == null && tasks && (
            <div className="flex flex-col gap-2 mb-3">
              <div className="text-xs text-emerald-100 font-bold mb-1">🎲 選擇今日任務（三選一）</div>
              {tasks.map((task, idx) => {
                const bt = applyBuff(task, buff);
                const goalDisplay = bt.isUltimate ? "直接過關" :
                  bt.newGoal != null
                    ? `${bt.newGoal} ${task.type === "score" ? "分" : "箭"}（原${bt.originalGoal}，降${bt.reductionPct}%）`
                    : `${task.goal} ${task.type === "score" ? "分" : "箭"}`;
                return (
                  <button key={task.id} onClick={() => chooseTask(idx)}
                    className="w-full bg-white/15 hover:bg-white/25 rounded-xl px-3 py-3 text-left border border-white/20 transition-all active:scale-95">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{task.icon}</span>
                      <span className="font-black text-sm">{task.label}</span>
                    </div>
                    <div className="text-xs text-emerald-100 flex gap-2 flex-wrap">
                      <span>📍 {task.distance}米</span>
                      <span>🎯 {task.target}</span>
                      <span>🏹 {task.arrowCount}箭</span>
                    </div>
                    <div className="text-sm font-black text-white mt-1">
                      目標：{goalDisplay}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 已選任務：分享給隊友？ */}
          {chosenIdx != null && buffedChosenTask && partyAsk && (
            <div className="bg-white/10 rounded-xl p-4 border border-white/20">
              <div className="font-black text-white text-base mb-1">👥 要招募隊友一起解任務嗎？</div>
              <div className="text-emerald-100 text-xs mb-3">
                建立組隊房間，隊友輸入邀請碼加入，完成後各得一個額外寶箱！（最多 4 人）
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateParty} disabled={partyCreating}
                  className="flex-1 py-2.5 bg-white text-emerald-700 font-black rounded-xl text-sm disabled:opacity-50 active:scale-95 transition-transform">
                  {partyCreating ? "建立中…" : "👥 建立組隊房間"}
                </button>
                <button onClick={() => setPartyAsk(false)}
                  className="flex-1 py-2.5 bg-white/20 text-white font-bold rounded-xl text-sm active:scale-95 transition-transform">
                  自己練
                </button>
              </div>
            </div>
          )}

          {/* 已選任務：進行計分 */}
          {chosenIdx != null && buffedChosenTask && !partyAsk && (
            <>
              <div className="bg-white/10 rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-emerald-100">🎯 已選任務：{chosenTask.label}</div>
                  <div className="flex items-center gap-2">
                    {onJoinParty && (
                      <button onClick={() => setPartyAsk(true)}
                        className="text-xs text-indigo-200 underline">👥 招募隊友</button>
                    )}
                    <button onClick={() => { setChosenIdx(null); setArrows([]); }}
                      className="text-xs text-emerald-200 underline">換一個</button>
                  </div>
                </div>
                <div className="text-xs text-emerald-100 flex gap-2 flex-wrap mb-1">
                  <span>📍 {chosenTask.distance}米</span>
                  <span>🎯 {chosenTask.target}</span>
                  <span>🏹 {chosenTask.arrowCount}箭</span>
                </div>
                {buffedChosenTask.isUltimate ? (
                  <div className="text-lg font-black text-amber-300">✨ 直接達標！登記即可</div>
                ) : (
                  <div className="text-lg font-black">
                    {chosenTask.type === "score" ? `總分達到 ${buffedChosenTask.newGoal ?? buffedChosenTask.goal} 分` : `命中 ${buffedChosenTask.newGoal ?? buffedChosenTask.goal} 箭以上`}
                    {buffedChosenTask.reduction > 0 && (
                      <span className="text-xs font-normal text-emerald-200 ml-2">
                        （原{buffedChosenTask.originalGoal}，Buff降了{buffedChosenTask.reduction}{chosenTask.type === "score" ? "分" : "箭"}）
                      </span>
                    )}
                  </div>
                )}
              </div>

              {!buffedChosenTask.isUltimate && (
                <ArrowScorer
                  arrowCount={chosenTask.arrowCount}
                  arrows={arrows}
                  setArrows={setArrows}
                  targetType={chosenTask.type}
                  goal={buffedChosenTask.newGoal ?? buffedChosenTask.goal}
                />
              )}

              <button onClick={submitScore}
                disabled={busy || (!buffedChosenTask.isUltimate && arrows.length < chosenTask.arrowCount)}
                className="w-full py-3 rounded-xl bg-white text-emerald-700 font-black active:scale-95 transition-transform disabled:opacity-50">
                {buffedChosenTask.isUltimate ? "✨ 直接完成任務" :
                  arrows.length < chosenTask.arrowCount ? `還要射 ${chosenTask.arrowCount - arrows.length} 箭` : "登記成績"}
              </button>
              <div className="text-emerald-100 text-xs mt-2 text-center">沒過也別擔心，教練會給你更強的加成再來一次 💪</div>
            </>
          )}
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

  // 5a. 純報到完成
  if (checkin.type === "simple") {
    return (
      <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#0891b2,#0369a1)" }}>
        <div className="text-xs font-black tracking-wider text-sky-100 mb-1">每日報到</div>
        <div className="text-lg font-black mb-1">✅ 今日已純報到！</div>
        <div className="text-sky-100 text-xs">已完成 {count} 次　還差 {remain} 次換成就銀章 🥈　明天再來！</div>
      </div>
    );
  }

  // 5b. 已完成任務並確認
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
  const [step, setStep] = useState(0);
  const lines = buff.lines || [];

  useEffect(() => {
    setStep(0);
    const timers = [];
    sfxCast();
    timers.push(setTimeout(() => {
      setStep(1);
      const power = buff.actualPower || 0;
      if (power >= 999 || power >= 25) sfxEpic();
      else sfxBuff();
    }, 900));
    lines.forEach((_, i) => timers.push(setTimeout(() => setStep(2 + i), 900 + (i + 1) * 800)));
    return () => timers.forEach(clearTimeout);
  }, [buff?.name]); // eslint-disable-line

  const isUltimate = (buff.actualPower || 0) >= 999;
  const power = buff.actualPower || 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6"
      style={{ background: "rgba(5,8,20,.82)", animation: "bfFade .25s ease" }} onClick={onClose}>
      <div className="relative w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>
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
              <div className="text-7xl mb-2"
                style={{ filter: "drop-shadow(0 6px 20px rgba(167,139,250,.6))", animation: "bfBounce 1s ease infinite" }}>
                {buff.icon}
              </div>
              <div className={`font-black text-2xl mb-1 ${isUltimate ? "text-amber-300" : "text-white"}`}
                style={{ textShadow: "0 2px 14px rgba(0,0,0,.5)" }}>
                {buff.name}
              </div>
              {/* 降幅說明 */}
              {!isUltimate && power > 0 && step >= 1 && (
                <div className="text-emerald-300 text-sm font-bold mb-3">
                  ✨ 目標降低 {power}%
                </div>
              )}
              {isUltimate && (
                <div className="text-amber-200 text-sm font-bold mb-3">✨ 直接過關！</div>
              )}
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

// ── 點擊式計分器 ──
function ArrowScorer({ arrowCount, arrows, setArrows, targetType, goal }) {
  const SCORES = [
    { label: "X",  val: 10, color: "#fbbf24" },
    { label: "10", val: 10, color: "#fbbf24" },
    { label: "9",  val: 9,  color: "#fbbf24" },
    { label: "8",  val: 8,  color: "#ef4444" },
    { label: "7",  val: 7,  color: "#ef4444" },
    { label: "6",  val: 6,  color: "#3b82f6" },
    { label: "5",  val: 5,  color: "#3b82f6" },
    { label: "4",  val: 4,  color: "#1e293b" },
    { label: "3",  val: 3,  color: "#1e293b" },
    { label: "2",  val: 2,  color: "#9ca3af" },
    { label: "1",  val: 1,  color: "#9ca3af" },
    { label: "M",  val: 0,  color: "#64748b" },
  ];
  const next  = arrows.length;
  const total = arrows.reduce((s, v) => s + (v || 0), 0);
  const hits  = arrows.filter(v => v > 0).length;
  const current = targetType === "score" ? total : hits;
  const pct = goal ? Math.min(100, Math.round(current / goal * 100)) : 0;

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

      {/* 進度條 */}
      <div className="mt-2">
        <div className="flex justify-between text-white text-sm font-bold mb-1">
          <span>{targetType === "score" ? `總分 ${total}` : `中靶 ${hits} 箭`}</span>
          <span className="text-emerald-100">{arrows.length}/{arrowCount} 箭</span>
        </div>
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-right text-emerald-200 text-xs mt-0.5">{pct}% / 目標 {goal}</div>
      </div>
    </div>
  );
}