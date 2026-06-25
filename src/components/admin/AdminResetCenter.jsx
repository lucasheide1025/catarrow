// src/components/admin/AdminResetCenter.jsx — 重置中心（地下城 + 打怪次數 + 世界王 + 報到）
import { useState, useEffect } from "react";
import {
  getMembers,
  resetDungeonUsed, resetAllDungeonUsed,
  resetMonsterSession, resetAllMonsterSessions,
  resetCouncilDailyLimit, resetAllCouncilDailyLimits,
  forceEndTodayCheckins, resetCheckinCount, resetAllCheckinCounts,
} from "../../lib/db";
import {
  subscribeActiveWorldBoss,
  resetWorldBossAttack, resetAllWorldBossAttacks,
} from "../../lib/worldBossDb";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AdminResetCenter() {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [busyD,    setBusyD]    = useState("");
  const [busyM,    setBusyM]    = useState("");
  const [busyWB,   setBusyWB]   = useState("");
  const [busyC,    setBusyC]    = useState("");
  const [busyK,    setBusyK]    = useState("");
  const [msg,      setMsg]      = useState("");
  const [tab,      setTab]      = useState("checkin");
  const [wbEvent,  setWbEvent]  = useState(null);

  const today = todayStr();

  useEffect(() => {
    getMembers().then(list => {
      setMembers(list.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      setLoading(false);
    });
    const unsub = subscribeActiveWorldBoss(setWbEvent);
    return () => unsub();
  }, []);

  // ── 地下城重置 ───────────────────────────────────────────
  async function handleResetDungeonOne(id, name) {
    setBusyD(id); setMsg("");
    await resetDungeonUsed(id);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, lastDungeonDate: null } : m));
    setMsg(`✅ ${name} 地下城次數已重置`);
    setBusyD("");
  }
  async function handleResetDungeonAll() {
    if (!window.confirm("確定重置所有成員的地下城次數？")) return;
    setBusyD("all"); setMsg("");
    await resetAllDungeonUsed();
    setMembers(prev => prev.map(m => ({ ...m, lastDungeonDate: null })));
    setMsg("✅ 全員地下城次數已重置");
    setBusyD("");
  }

  // ── 打怪次數重置 ─────────────────────────────────────────
  async function handleResetMonsterOne(id, name) {
    setBusyM(id); setMsg("");
    await resetMonsterSession(id);
    setMsg(`✅ ${name} 今日打怪次數已重置`);
    setBusyM("");
  }
  async function handleResetMonsterAll() {
    if (!window.confirm("確定重置所有成員的今日打怪次數？")) return;
    setBusyM("all"); setMsg("");
    await resetAllMonsterSessions();
    setMsg("✅ 全員打怪次數已重置");
    setBusyM("");
  }

  // ── 報到次數重置 ─────────────────────────────────────────
  async function handleResetCheckinOne(id, name) {
    setBusyK(id); setMsg("");
    try {
      // 先強制結束此人今日未下課的報到
      await forceEndTodayCheckins();
      await resetCheckinCount(id);
      setMembers(prev => prev.map(m => m.id === id ? { ...m, dailyQuestCount: 0 } : m));
      setMsg(`✅ ${name} 報到累積次數已歸零`);
    } catch (e) { setMsg("❌ 失敗：" + (e?.message || "")); }
    setBusyK("");
  }
  async function handleResetCheckinAll() {
    if (!window.confirm("確定要強制結束今日所有進行中的報到，並重置所有成員的報到累積次數？")) return;
    setBusyK("all"); setMsg("");
    try {
      const ended = await forceEndTodayCheckins();
      await resetAllCheckinCounts(members.map(m => m.id));
      setMembers(prev => prev.map(m => ({ ...m, dailyQuestCount: 0 })));
      setMsg(`✅ 全員報到次數已歸零${ended > 0 ? `（強制結束 ${ended} 人的進行中報到）` : ""}`);
    } catch (e) { setMsg("❌ 失敗：" + (e?.message || "")); }
    setBusyK("");
  }

  // ── 議會廳次數重置 ───────────────────────────────────────
  async function handleResetCouncilOne(id, name) {
    setBusyC(id); setMsg("");
    await resetCouncilDailyLimit(id);
    setMsg(`✅ ${name} 議會廳次數已重置（5次）`);
    setBusyC("");
  }
  async function handleResetCouncilAll() {
    if (!window.confirm("確定重置所有成員的今日議會廳次數？")) return;
    setBusyC("all"); setMsg("");
    await resetAllCouncilDailyLimits(members.map(m => m.id));
    setMsg("✅ 全員議會廳次數已重置");
    setBusyC("");
  }

  // ── 世界王重置 ───────────────────────────────────────────
  async function handleResetWBOne(memberId, name) {
    if (!wbEvent) return;
    setBusyWB(memberId); setMsg("");
    await resetWorldBossAttack(wbEvent.id, memberId);
    setMsg(`✅ ${name} 世界王今日出戰已重置`);
    setBusyWB("");
  }
  async function handleResetWBAll() {
    if (!wbEvent) return;
    if (!window.confirm("確定重置所有人今日的世界王出戰？")) return;
    setBusyWB("all"); setMsg("");
    await resetAllWorldBossAttacks(wbEvent.id);
    setMsg("✅ 全員世界王出戰已重置");
    setBusyWB("");
  }

  const dungeonUsedToday = members.filter(m => m.lastDungeonDate === today);
  const dungeonFree      = members.filter(m => m.lastDungeonDate !== today);

  // 世界王今日出戰名單（從 event.participants 取）
  const wbParts     = Object.entries(wbEvent?.participants || {});
  const wbAttToday  = wbParts.filter(([, p]) => p.lastAttackedDate === today);
  const wbNotToday  = wbParts.filter(([, p]) => p.lastAttackedDate !== today);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 className="font-black text-xl text-gray-800">🔄 重置中心</h2>

      {/* 分頁 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: "checkin",  label: "📍 報到" },
          { id: "dungeon",  label: "🏰 地下城" },
          { id: "monster",  label: "⚔️ 打怪" },
          { id: "worldboss", label: "🌍 世界王" },
          { id: "council",  label: "🏛️ 議會廳" },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setMsg(""); }}
            className={`py-2 rounded-xl text-sm font-black border transition-all ${tab === t.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 訊息 */}
      {msg && (
        <div className={`p-3 rounded-xl text-sm font-bold ${msg.startsWith("✅") ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">載入中…</div>
      ) : (
        <>
          {/* ── 報到次數 ────────────────────────────────── */}
          {tab === "checkin" && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700 leading-relaxed">
                點「全員重置」會先<b>強制結束</b>今日所有仍在上課中（忘記點下課）的報到，再把所有人的累積報到次數歸零。<br/>
                重置個人時也會先執行強制下課。
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  累積次數最高：<span className="font-bold text-indigo-600">{Math.max(0, ...members.map(m => m.dailyQuestCount || 0))}</span> 次
                </div>
                <button onClick={handleResetCheckinAll} disabled={!!busyK}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-black disabled:opacity-40">
                  {busyK === "all" ? "重置中…" : "全員重置"}
                </button>
              </div>
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                  <span className="flex-1 text-sm font-semibold text-gray-800">{m.name}</span>
                  <span className="text-xs text-indigo-600 font-bold">{m.dailyQuestCount || 0} 次</span>
                  <button onClick={() => handleResetCheckinOne(m.id, m.name)} disabled={!!busyK}
                    className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black disabled:opacity-40">
                    {busyK === m.id ? "…" : "歸零"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── 地下城 ─────────────────────────────────── */}
          {tab === "dungeon" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  今日已使用 <span className="font-bold text-rose-600">{dungeonUsedToday.length}</span> 人 ／
                  未使用 <span className="font-bold text-emerald-600">{dungeonFree.length}</span> 人
                </div>
                <button onClick={handleResetDungeonAll} disabled={!!busyD}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-black disabled:opacity-40">
                  {busyD === "all" ? "重置中…" : "全員重置"}
                </button>
              </div>
              {dungeonUsedToday.length > 0 && (
                <>
                  <div className="text-xs font-bold text-rose-500">🔒 今日已使用</div>
                  {dungeonUsedToday.map(m => (
                    <div key={m.id} className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
                      <span className="flex-1 text-sm font-semibold text-gray-800">{m.name}</span>
                      <button onClick={() => handleResetDungeonOne(m.id, m.name)} disabled={!!busyD}
                        className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-black disabled:opacity-40">
                        {busyD === m.id ? "…" : "重置"}
                      </button>
                    </div>
                  ))}
                </>
              )}
              {dungeonFree.length > 0 && (
                <>
                  <div className="text-xs font-bold text-emerald-600 mt-2">✅ 可使用</div>
                  {dungeonFree.map(m => (
                    <div key={m.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 opacity-60">
                      <span className="flex-1 text-sm text-gray-600">{m.name}</span>
                      <span className="text-xs text-emerald-600 font-bold">可使用</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── 打怪次數 ────────────────────────────────── */}
          {tab === "monster" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">手動重置個別射手的今日打怪次數</div>
                <button onClick={handleResetMonsterAll} disabled={!!busyM}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-black disabled:opacity-40">
                  {busyM === "all" ? "重置中…" : "全員重置"}
                </button>
              </div>
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                  <span className="flex-1 text-sm font-semibold text-gray-800">{m.name}</span>
                  <button onClick={() => handleResetMonsterOne(m.id, m.name)} disabled={!!busyM}
                    className="px-3 py-1 rounded-lg bg-orange-500 text-white text-xs font-black disabled:opacity-40">
                    {busyM === m.id ? "…" : "重置"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── 議會廳 ──────────────────────────────────── */}
          {tab === "council" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">重置後可立即再進行採集任務（每日上限 5 次）</div>
                <button onClick={handleResetCouncilAll} disabled={!!busyC}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-black disabled:opacity-40">
                  {busyC === "all" ? "重置中…" : "全員重置"}
                </button>
              </div>
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                  <span className="flex-1 text-sm font-semibold text-gray-800">{m.name}</span>
                  <button onClick={() => handleResetCouncilOne(m.id, m.name)} disabled={!!busyC}
                    className="px-3 py-1 rounded-lg bg-amber-600 text-white text-xs font-black disabled:opacity-40">
                    {busyC === m.id ? "…" : "重置"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── 世界王 ──────────────────────────────────── */}
          {tab === "worldboss" && (
            <div className="space-y-3">
              {!wbEvent ? (
                <div className="text-center py-8 text-gray-400 text-sm">目前沒有活躍的世界王活動</div>
              ) : (
                <>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2 text-xs text-indigo-700 font-bold">
                    🌍 {wbEvent.bossData?.name}｜累計參戰 {wbEvent.totalParticipants || 0} 人
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">重置後可再次出戰（保留參戰紀錄）</div>
                    <button onClick={handleResetWBAll} disabled={!!busyWB || wbParts.length === 0}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-black disabled:opacity-40">
                      {busyWB === "all" ? "重置中…" : "全員重置"}
                    </button>
                  </div>
                  {wbParts.length === 0 ? (
                    <div className="text-center py-4 text-gray-400 text-sm">尚無人參戰</div>
                  ) : (
                    wbParts.map(([id, p]) => (
                      <div key={id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-800">{p.name}</div>
                          <div className="text-xs text-gray-400">累積傷害 {(p.totalDmg || 0).toLocaleString()}</div>
                        </div>
                        <button onClick={() => handleResetWBOne(id, p.name)} disabled={!!busyWB}
                          className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black disabled:opacity-40">
                          {busyWB === id ? "…" : "重置次數"}
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
