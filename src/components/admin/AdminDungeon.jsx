// src/components/admin/AdminDungeon.jsx — 地下城次數管理
import { useState, useEffect } from "react";
import { getMembers, resetDungeonUsed, resetAllDungeonUsed } from "../../lib/db";
import { DUNGEON_MAPS } from "../../lib/dungeonData";
import DungeonExplore from "../dungeon/DungeonExplore";

export default function AdminDungeon() {
  const [members,     setMembers]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [busy,        setBusy]        = useState("");
  const [msg,         setMsg]         = useState("");
  const [previewMap,  setPreviewMap]  = useState(null); // dungeon object | null

  useEffect(() => {
    getMembers().then(list => {
      setMembers(list.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      setLoading(false);
    });
  }, []);

  async function handleResetOne(id, name) {
    setBusy(id); setMsg("");
    await resetDungeonUsed(id);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, dungeonUsed: false } : m));
    setMsg(`✅ ${name} 次數已重置`);
    setBusy("");
  }

  async function handleResetAll() {
    if (!window.confirm("確定重置所有成員的地下城次數？")) return;
    setBusy("all"); setMsg("");
    await resetAllDungeonUsed();
    setMembers(prev => prev.map(m => ({ ...m, dungeonUsed: false })));
    setMsg("✅ 全員次數已重置");
    setBusy("");
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const used = members.filter(m => m.lastDungeonDate === todayStr);
  const free = members.filter(m => m.lastDungeonDate !== todayStr);

  if (previewMap) {
    return <DungeonExplore dungeon={previewMap} onBack={() => setPreviewMap(null)} />;
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-black text-xl text-gray-800">🏰 地下城次數管理</h2>
        <button onClick={handleResetAll} disabled={!!busy}
          className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold disabled:opacity-40">
          {busy === "all" ? "重置中…" : "全員重置"}
        </button>
      </div>

      {/* 新地圖預覽區 */}
      <div className="bg-slate-800 rounded-2xl p-4 space-y-2">
        <div className="text-sm font-bold text-amber-300">🗺️ 新地下城地圖預覽</div>
        {DUNGEON_MAPS.map(d => (
          <div key={d.id} className="flex items-center gap-3">
            <span className="text-lg">{d.emoji}</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">{d.name}</div>
              <div className="text-xs text-slate-400">{d.floorCount} 層 · {d.enabled ? "✅ 開放中" : "🔒 關閉"}</div>
            </div>
            <button
              onClick={() => setPreviewMap(d)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-900 text-xs font-black"
            >
              預覽地圖
            </button>
          </div>
        ))}
      </div>

      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-sm text-emerald-700 font-semibold">
          {msg}
        </div>
      )}

      <div className="text-xs text-gray-500">
        已使用 <span className="font-bold text-rose-600">{used.length}</span> 人 ／
        未使用 <span className="font-bold text-emerald-600">{free.length}</span> 人
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">載入中…</div>
      ) : (
        <div className="space-y-2">
          {used.length > 0 && (
            <>
              <div className="text-xs font-bold text-rose-500 mt-2">🔒 已使用（需重置）</div>
              {used.map(m => (
                <div key={m.id} className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
                  <span className="flex-1 text-sm font-semibold text-gray-800">{m.name}</span>
                  <button onClick={() => handleResetOne(m.id, m.name)} disabled={!!busy}
                    className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-40">
                    {busy === m.id ? "…" : "重置"}
                  </button>
                </div>
              ))}
            </>
          )}
          {free.length > 0 && (
            <>
              <div className="text-xs font-bold text-emerald-600 mt-3">✅ 可使用</div>
              {free.map(m => (
                <div key={m.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 opacity-60">
                  <span className="flex-1 text-sm text-gray-600">{m.name}</span>
                  <span className="text-xs text-emerald-600 font-bold">可使用</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
