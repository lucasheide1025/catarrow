// src/components/admin/AdminResetCenter.jsx — 重置中心（地下城 + 打怪次數）
import { useState, useEffect } from "react";
import {
  getMembers,
  resetDungeonUsed, resetAllDungeonUsed,
  resetMonsterSession, resetAllMonsterSessions,
} from "../../lib/db";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AdminResetCenter() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyD,   setBusyD]   = useState(""); // dungeon busy
  const [busyM,   setBusyM]   = useState(""); // monster busy
  const [msg,     setMsg]     = useState("");
  const [tab,     setTab]     = useState("dungeon");

  const today = todayStr();

  useEffect(() => {
    getMembers().then(list => {
      setMembers(list.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      setLoading(false);
    });
  }, []);

  // ── 地下城重置 ───────────────────────────────────────
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

  // ── 打怪次數重置 ─────────────────────────────────────
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

  const dungeonUsedToday = members.filter(m => m.lastDungeonDate === today);
  const dungeonFree      = members.filter(m => m.lastDungeonDate !== today);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-black text-xl text-gray-800">🔄 重置中心</h2>
        <span className="text-xs text-gray-400">世界王每日自動重置，無需手動</span>
      </div>

      {/* 分頁 */}
      <div className="flex gap-2">
        {[
          { id: "dungeon", label: "🏰 地下城" },
          { id: "monster", label: "⚔️ 打怪次數" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-sm font-black border transition-all ${tab === t.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
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
          {/* ── 地下城 tab ─────────────────────────── */}
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

          {/* ── 打怪次數 tab ───────────────────────── */}
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
        </>
      )}
    </div>
  );
}
