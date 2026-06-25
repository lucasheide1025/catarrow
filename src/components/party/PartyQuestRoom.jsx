// src/components/party/PartyQuestRoom.jsx — 組隊今日任務（共享任務版）
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribePartyRoom, markQuestDone as markPartyDone,
  markQuestGaveUp, giveQuestRewards, leavePartyRoom
} from "../../lib/partyDb";
import { markQuestDone as markCheckinDone, subscribeMyCheckin, submitCheckin, addPracticeLog } from "../../lib/db";
import { CHEST_TYPES } from "../../lib/itemData";
import { sfxSuccess, sfxTap, sfxSoftFail } from "../../lib/sound";

const HALF_SCORES = [
  { label:"X",  val:10, color:"#fbbf24" },
  { label:"10", val:10, color:"#fbbf24" },
  { label:"9",  val:9,  color:"#fbbf24" },
  { label:"8",  val:8,  color:"#ef4444" },
  { label:"7",  val:7,  color:"#ef4444" },
  { label:"6",  val:6,  color:"#3b82f6" },
  { label:"5",  val:5,  color:"#3b82f6" },
  { label:"4",  val:4,  color:"#1e293b" },
  { label:"3",  val:3,  color:"#1e293b" },
  { label:"2",  val:2,  color:"#9ca3af" },
  { label:"1",  val:1,  color:"#9ca3af" },
  { label:"M",  val:0,  color:"#64748b" },
];

export default function PartyQuestRoom({ roomId, isHost, onLeave }) {
  const { profile } = useAuth();
  const [room,       setRoom]       = useState(null);
  const [arrows,     setArrows]     = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [rewarding,  setRewarding]  = useState(false);
  const [pendingComplete, setPendingComplete] = useState(null); // { chestType } 房主本地完成狀態
  const [copied,     setCopied]     = useState(false);
  const [failMsg,    setFailMsg]    = useState("");
  const [gaveUpConfirm, setGaveUpConfirm] = useState(false);
  const [givingUp,  setGivingUp]   = useState(false);
  const [checkin,   setCheckin]    = useState(undefined);
  const [checkingIn, setCheckingIn] = useState(false);

  const myId = profile?.id;

  useEffect(() => {
    const unsub = subscribePartyRoom(roomId, setRoom);
    return unsub;
  }, [roomId]);

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeMyCheckin(profile.id, c => setCheckin(c ?? null));
    return unsub;
  }, [profile?.id]);

  if (!room || checkin === undefined) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white font-bold animate-pulse">載入中…</div>
    </div>
  );

  // ── 報到關卡：尚未報到者必須先報到才能進入 ────────────────────
  if (!checkin) {
    async function doCheckin() {
      setCheckingIn(true);
      await submitCheckin(profile.id, profile.name, profile.nickname);
      setCheckingIn(false);
    }
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center px-6 gap-5">
        <div className="text-5xl">📍</div>
        <div className="text-white font-black text-xl text-center">參加前請先今日報到！</div>
        <div className="text-slate-400 text-sm text-center leading-relaxed">
          組隊任務需要確認你今天有到場。<br/>報到送出後即可進入房間。
        </div>
        <button onClick={doCheckin} disabled={checkingIn}
          className="w-full max-w-xs py-4 bg-purple-600 text-white font-black text-base rounded-2xl disabled:opacity-50 active:scale-95 transition-transform">
          {checkingIn ? "報到中…" : "📍 今日報到"}
        </button>
        <button onClick={onLeave}
          className="text-slate-500 text-sm underline">
          離開房間
        </button>
      </div>
    );
  }

  const task       = room.task;
  const members    = room.members || {};
  const memberList = Object.entries(members).map(([id, data]) => ({ id, ...data }));
  const me         = members[myId] || {};
  const allDone      = memberList.length >= 1 && memberList.every(m => m.done || m.gaveUp);
  const completed    = room.status === "completed" || !!pendingComplete;
  const chestTypeKey = room.rewardChestType || pendingComplete;
  const chestInfo    = chestTypeKey ? CHEST_TYPES[chestTypeKey] : null;
  const arrowCount = task?.arrowCount || 6;
  const total      = arrows.reduce((s, v) => s + v, 0);
  const hits       = arrows.filter(v => v > 0).length;
  const current    = task?.type === "score" ? total : hits;
  const pct        = task?.goal ? Math.min(100, Math.round(current / task.goal * 100)) : 0;

  async function handleSubmit() {
    if (!task || arrows.length < arrowCount) return;
    setSubmitting(true);
    setFailMsg("");
    sfxTap();
    const val  = task.type === "score" ? total : hits;
    const pass = val >= task.goal;

    if (!pass) {
      sfxSoftFail();
      setFailMsg(`未達標（${val} / ${task.goal}），重新輸入！`);
      setArrows([]);
      setSubmitting(false);
      return;
    }

    sfxSuccess();
    // 所有人（不限房主）都用自己的 checkin.id 標記完成
    if (checkin?.id) {
      await markCheckinDone(checkin.id, {
        type: task.type, value: val, target: task.goal, taskId: task.id,
      }).catch(() => {});
    }
    if (myId) {
      addPracticeLog(myId, {
        date: new Date().toISOString().slice(0, 10), source: "daily",
        taskLabel: task.label || task.target || "日常任務", result: "win",
        rounds: [arrows],
        total: arrows.reduce((s, v) => s + v, 0),
        distance: task.distance || null,
      }, myId).catch(() => {});
    }
    await markPartyDone(roomId, myId, true);
    setSubmitting(false);
  }

  async function handleGaveUp() {
    setGivingUp(true);
    await markQuestGaveUp(roomId, myId);
    setGivingUp(false);
    setGaveUpConfirm(false);
    setFailMsg("");
    setArrows([]);
  }

  async function handleKick(targetId) {
    await leavePartyRoom(roomId, targetId, false);
  }

  async function handleReward() {
    setRewarding(true);
    const doneIds = memberList.filter(m => m.done).map(m => m.id);
    const res = await giveQuestRewards(roomId, doneIds);
    if (res?.ok) setPendingComplete(res.chestType);
    setRewarding(false);
  }

  async function handleLeave() {
    await leavePartyRoom(roomId, myId, isHost);
    onLeave();
  }

  function copyCode() {
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ── 完成畫面 ──────────────────────────────────────────────────
  if (completed && chestInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-slate-900 flex flex-col items-center justify-center px-4 gap-5">
        <div className="text-7xl animate-bounce">{chestInfo.icon}</div>
        <div className="text-2xl font-black text-white text-center">🎉 任務完成！</div>
        <div className="text-slate-300 text-center text-sm leading-relaxed">
          全員完成今日任務！<br />
          各獲得一個 <span className="font-black" style={{ color: chestInfo.color }}>{chestInfo.name}</span>
        </div>
        <div className="bg-white/10 rounded-2xl p-4 w-full max-w-xs flex flex-col gap-2">
          {memberList.map(m => (
            <div key={m.id} className="flex items-center gap-2 text-white text-sm">
              <span className="text-emerald-400">✅</span>
              <span className="font-bold">{m.name}</span>
              {m.id === myId && <span className="text-slate-400 text-xs ml-auto">（我）</span>}
            </div>
          ))}
        </div>
        <button onClick={onLeave}
          className="px-8 py-3 bg-white text-slate-900 font-black rounded-2xl active:scale-95 transition-transform">
          🏠 返回
        </button>
      </div>
    );
  }

  // ── 主畫面 ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col px-4 py-5 gap-4 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-white font-black text-lg">👥 組隊今日任務</div>
        <button onClick={handleLeave}
          className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs font-bold rounded-lg active:scale-95">
          離開
        </button>
      </div>

      {/* 任務詳情 */}
      {task ? (
        <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
          <div className="text-slate-400 text-xs font-black tracking-widest uppercase mb-2">今日共同任務</div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{task.icon}</span>
            <div>
              <div className="text-white font-black text-base">{task.label}</div>
              <div className="flex gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                <span>📍 {task.distance}米</span>
                <span>🎯 {task.target}</span>
                <span>🏹 {task.arrowCount}箭</span>
              </div>
            </div>
          </div>
          <div className="bg-indigo-500/20 border border-indigo-400/30 rounded-xl px-4 py-2.5 text-center">
            <span className="text-white font-black text-lg">
              目標：{task.goal} {task.type === "score" ? "分" : "箭命中"}
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-white/10 rounded-2xl p-4 text-slate-400 text-sm text-center">
          等待房主設定任務…
        </div>
      )}

      {/* 隊員狀態 */}
      <div className="grid grid-cols-2 gap-2">
        {memberList.map(m => (
          <div key={m.id}
            className={`rounded-2xl p-3 border-2 transition-all ${
              m.done    ? "bg-emerald-900/40 border-emerald-500" :
              m.gaveUp  ? "bg-slate-700/20 border-slate-500 opacity-60" :
                          "bg-slate-700/40 border-slate-600"
            }`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">{m.done ? "✅" : m.gaveUp ? "🏳️" : "⏳"}</span>
              <span className={`font-black text-sm truncate ${m.id === myId ? "text-indigo-300" : "text-white"}`}>
                {m.name}{m.id === myId ? " (我)" : ""}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              {m.done ? "已完成！" : m.gaveUp ? "已放棄" : "進行中…"}
            </div>
            {/* 房主踢出未完成的隊友（排除自己） */}
            {isHost && m.id !== myId && !m.done && !m.gaveUp && !completed && (
              <button onClick={() => handleKick(m.id)}
                className="mt-1.5 text-xs text-red-400 underline">
                移除
              </button>
            )}
          </div>
        ))}
        {memberList.length < 2 && (
          <div className="rounded-2xl p-3 bg-slate-700/20 border-2 border-dashed border-slate-600 flex items-center justify-center">
            <span className="text-slate-500 text-xs">等待隊友加入…</span>
          </div>
        )}
      </div>

      {/* 我的計分 */}
      {!me.done && !me.gaveUp && task && !completed && (
        <div className="bg-slate-700/40 rounded-2xl p-4 flex flex-col gap-3">
          <div className="text-xs font-black text-slate-400 tracking-widest uppercase">我的成績</div>

          {failMsg && (
            <div className="bg-red-900/40 border border-red-500/50 rounded-xl px-3 py-2 flex flex-col gap-2">
              <div className="text-red-300 text-xs font-bold text-center">{failMsg}</div>
              {!gaveUpConfirm ? (
                <button onClick={() => setGaveUpConfirm(true)}
                  className="text-xs text-slate-400 underline text-center">
                  放棄本次任務
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleGaveUp} disabled={givingUp}
                    className="flex-1 py-1.5 bg-red-700 text-white text-xs font-black rounded-lg disabled:opacity-50">
                    {givingUp ? "處理中…" : "確認放棄"}
                  </button>
                  <button onClick={() => setGaveUpConfirm(false)}
                    className="flex-1 py-1.5 bg-slate-600 text-white text-xs font-bold rounded-lg">
                    取消
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 已輸入箭數 */}
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: arrowCount }).map((_, i) => (
              <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black
                ${i < arrows.length
                  ? "bg-indigo-500 text-white"
                  : i === arrows.length
                    ? "bg-slate-600 text-slate-300 ring-2 ring-indigo-400"
                    : "bg-slate-700 text-slate-500"}`}>
                {i < arrows.length ? (arrows[i] === 0 ? "M" : arrows[i]) : ""}
              </div>
            ))}
            {arrows.length > 0 && (
              <button onClick={() => setArrows(p => p.slice(0, -1))}
                className="text-xs text-slate-400 underline self-center ml-1">↩ 退</button>
            )}
          </div>

          {/* 分數按鈕 */}
          {arrows.length < arrowCount && (
            <div className="grid grid-cols-6 gap-1.5">
              {HALF_SCORES.map(s => (
                <button key={s.label}
                  onClick={() => { sfxTap(); setArrows(p => [...p, s.val]); }}
                  className="py-2 rounded-lg font-black text-white text-sm active:scale-90 transition-transform"
                  style={{ background: s.color }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* 進度條 */}
          <div>
            <div className="flex justify-between text-white text-sm font-bold mb-1">
              <span>{task.type === "score" ? `總分 ${total}` : `中靶 ${hits} 箭`}</span>
              <span className="text-slate-400">{arrows.length}/{arrowCount} 箭</span>
            </div>
            <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-right text-slate-400 text-xs mt-0.5">{pct}% / 目標 {task.goal}</div>
          </div>

          {arrows.length >= arrowCount && (
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl text-sm disabled:opacity-50 active:scale-95 transition-transform">
              {submitting ? "計算中…" : "✅ 送出成績"}
            </button>
          )}
        </div>
      )}

      {me.done && !completed && (
        <div className="bg-emerald-900/30 border-2 border-emerald-500 rounded-2xl p-4 text-center">
          <div className="text-emerald-300 font-black text-base">🎉 你已完成！</div>
          <div className="text-emerald-400 text-xs mt-1">等待其他隊友完成…</div>
        </div>
      )}
      {me.gaveUp && !completed && (
        <div className="bg-slate-700/40 border-2 border-slate-500 rounded-2xl p-4 text-center">
          <div className="text-slate-300 font-black text-base">🏳️ 你已放棄本次任務</div>
          <div className="text-slate-400 text-xs mt-1">等待其他隊友完成後房主可發放獎勵</div>
        </div>
      )}

      {/* 全員完成 → 房主發獎 */}
      {allDone && !completed && isHost && (
        <button onClick={handleReward} disabled={rewarding}
          className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 font-black text-base rounded-2xl shadow-xl animate-pulse active:scale-95 transition-transform disabled:opacity-50">
          {rewarding ? "發放中…" : "🎁 全員完成！領取寶箱獎勵"}
        </button>
      )}
      {allDone && !completed && !isHost && (
        <div className="w-full py-4 bg-emerald-900/40 border-2 border-emerald-500 text-emerald-300 font-black text-sm rounded-2xl text-center">
          🎉 全員完成！等待房主發放獎勵…
        </div>
      )}
    </div>
  );
}
