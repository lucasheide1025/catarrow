// src/components/party/PartyQuestRoom.jsx — 日常任務分享房間
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribePartyRoom, updateQuestTask, markQuestDone,
  giveQuestRewards, leavePartyRoom
} from "../../lib/partyDb";
import { CHEST_TYPES } from "../../lib/itemData";

const DISTANCE_OPTIONS = [5, 7, 10, 13.5, 15, 18, 20, 25, 30];

export default function PartyQuestRoom({ roomId, isHost, onLeave }) {
  const { profile } = useAuth();
  const [room, setRoom] = useState(null);
  const [taskDesc, setTaskDesc] = useState("");
  const [distance, setDistance] = useState("");
  const [saving, setSaving] = useState(false);
  const [rewarding, setRewarding] = useState(false);
  const [copied, setCopied] = useState(false);

  const myId = profile?.id;

  useEffect(() => {
    const unsub = subscribePartyRoom(roomId, setRoom);
    return unsub;
  }, [roomId]);

  // 同步自己的設定到本地 state（只在初次載入）
  useEffect(() => {
    if (!room || !myId) return;
    const me = room.members?.[myId];
    if (me && !taskDesc && !distance) {
      setTaskDesc(me.taskDesc || "");
      setDistance(me.distance || "");
    }
  }, [room?.members?.[myId]?.taskDesc]);

  if (!room) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-lg font-bold animate-pulse">載入中…</div>
    </div>
  );

  const members = room.members || {};
  const memberList = Object.entries(members).map(([id, data]) => ({ id, ...data }));
  const me = members[myId] || {};
  const partner = memberList.find(m => m.id !== myId);
  const bothDone = memberList.length >= 2 && memberList.every(m => m.done);
  const completed = room.status === "completed";

  const chestInfo = room.rewardChestType
    ? CHEST_TYPES[room.rewardChestType]
    : null;

  async function handleSaveTask() {
    if (!taskDesc.trim() || !distance) return;
    setSaving(true);
    await updateQuestTask(roomId, myId, taskDesc.trim(), distance);
    setSaving(false);
  }

  async function handleToggleDone() {
    const newDone = !me.done;
    await markQuestDone(roomId, myId, newDone);
  }

  async function handleReward() {
    setRewarding(true);
    const memberIds = memberList.map(m => m.id);
    await giveQuestRewards(roomId, memberIds);
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

  // ── 完成畫面 ──
  if (completed && chestInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-slate-900 flex flex-col items-center justify-center px-4 gap-6">
        <div className="text-6xl animate-bounce">{chestInfo.icon}</div>
        <div className="text-2xl font-black text-white text-center">任務完成！</div>
        <div className="text-slate-300 text-center text-sm leading-relaxed">
          雙方都完成了今天的練習！<br/>
          各獲得一個 <span className="font-black" style={{ color: chestInfo.color }}>{chestInfo.name}</span>
        </div>
        <div className="bg-white/10 rounded-2xl p-5 flex flex-col gap-2 w-full max-w-xs">
          {memberList.map(m => (
            <div key={m.id} className="flex items-center gap-2 text-white text-sm">
              <span className="text-emerald-400">✅</span>
              <span className="font-bold">{m.name}</span>
              <span className="text-slate-400 ml-auto">{m.distance ? `${m.distance}m` : ""}</span>
            </div>
          ))}
        </div>
        <button onClick={onLeave}
          className="px-8 py-3 bg-white text-slate-900 font-black rounded-2xl shadow-lg active:scale-95 transition-transform">
          🏠 返回
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col px-4 py-6 gap-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-white font-black text-lg">📋 日常任務分享</div>
          <button onClick={copyCode}
            className="text-sm text-slate-400 mt-0.5 flex items-center gap-1 active:opacity-70">
            <span className="font-mono tracking-widest text-indigo-300">{room.code}</span>
            <span>{copied ? "✅" : "📋"}</span>
          </button>
        </div>
        <button onClick={handleLeave}
          className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs font-bold rounded-lg active:scale-95">
          離開
        </button>
      </div>

      {/* 玩家狀態列 */}
      <div className="grid grid-cols-2 gap-3">
        {memberList.map(m => (
          <div key={m.id}
            className={`rounded-2xl p-3 flex flex-col gap-1 border-2 transition-all ${
              m.done
                ? "bg-emerald-900/40 border-emerald-500"
                : "bg-slate-700/40 border-slate-600"
            }`}>
            <div className="flex items-center gap-1.5">
              <span className="text-base">{m.done ? "✅" : "⏳"}</span>
              <span className={`font-black text-sm ${m.id === myId ? "text-indigo-300" : "text-white"}`}>
                {m.name} {m.id === myId ? "(我)" : ""}
              </span>
            </div>
            {m.taskDesc
              ? <div className="text-xs text-slate-300 leading-snug">{m.taskDesc}</div>
              : <div className="text-xs text-slate-500">尚未填寫任務</div>
            }
            {m.distance && (
              <div className="text-xs text-slate-400">📍 {m.distance}m</div>
            )}
          </div>
        ))}
        {memberList.length < 2 && (
          <div className="rounded-2xl p-3 bg-slate-700/20 border-2 border-dashed border-slate-600 flex items-center justify-center">
            <span className="text-slate-500 text-sm">等待夥伴加入…</span>
          </div>
        )}
      </div>

      {/* 我的任務設定 */}
      {!completed && (
        <div className="bg-slate-700/40 rounded-2xl p-4 flex flex-col gap-3">
          <div className="text-xs font-black text-slate-400 tracking-widest uppercase">我的今日任務</div>

          <textarea
            value={taskDesc}
            onChange={e => setTaskDesc(e.target.value)}
            placeholder="今天要練什麼？（例：100支 18m 三環以上）"
            rows={2}
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-indigo-400 placeholder:text-slate-500"
          />

          <div className="flex flex-col gap-1.5">
            <div className="text-xs text-slate-400">射距</div>
            <div className="flex flex-wrap gap-2">
              {DISTANCE_OPTIONS.map(d => (
                <button key={d} onClick={() => setDistance(String(d))}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                    String(distance) === String(d)
                      ? "bg-indigo-500 text-white border-indigo-500"
                      : "bg-slate-700 text-slate-300 border-slate-600 hover:border-indigo-400"
                  }`}>
                  {d}m
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSaveTask} disabled={!taskDesc.trim() || !distance || saving}
              className="flex-1 py-2.5 bg-indigo-600 text-white font-black rounded-xl text-sm disabled:opacity-40 active:scale-95 transition-transform">
              {saving ? "儲存中…" : "💾 儲存任務"}
            </button>
            <button onClick={handleToggleDone}
              disabled={!me.taskDesc}
              className={`flex-1 py-2.5 font-black rounded-xl text-sm disabled:opacity-40 active:scale-95 transition-transform ${
                me.done
                  ? "bg-slate-600 text-white"
                  : "bg-emerald-500 text-white"
              }`}>
              {me.done ? "↩️ 取消完成" : "✅ 我完成了！"}
            </button>
          </div>
        </div>
      )}

      {/* 雙方完成 → 領獎 */}
      {bothDone && !completed && isHost && (
        <button onClick={handleReward} disabled={rewarding}
          className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 font-black text-base rounded-2xl shadow-xl animate-pulse active:scale-95 transition-transform disabled:opacity-50">
          {rewarding ? "發放中…" : "🎁 雙方完成！領取寶箱獎勵"}
        </button>
      )}
      {bothDone && !completed && !isHost && (
        <div className="w-full py-4 bg-emerald-900/40 border-2 border-emerald-500 text-emerald-300 font-black text-sm rounded-2xl text-center">
          🎉 雙方都完成了！等待房主發放獎勵…
        </div>
      )}
    </div>
  );
}
