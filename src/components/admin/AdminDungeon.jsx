// src/components/admin/AdminDungeon.jsx — 地下城測試工具 + 次數管理
// 教練可在指定玩家設定地下城類型（測試用）

import { useState, useEffect } from "react";
import { getMembers } from "../../lib/db";
import { getSavedDungeons, removeSavedDungeon, adminSetSavedDungeon } from "../../lib/dungeonExcavation";

const FAMILY_OPTIONS = [
  { id:"ghost",     label:"幽冥系", emoji:"👻", color:"#c084fc" },
  { id:"mountain",  label:"山嶺系", emoji:"⛰️", color:"#4ade80" },
  { id:"insect",    label:"昆蟲系", emoji:"🦋", color:"#fbbf24" },
  { id:"workplace", label:"職場系", emoji:"💼", color:"#60a5fa" },
  { id:"exam",      label:"考試系", emoji:"📝", color:"#f472b6" },
  { id:"temple",    label:"神廟系", emoji:"🏛️", color:"#a78bfa" },
];

const DIFFICULTY_OPTIONS = [
  { id:1, label:"普通級", icon:"🌱", color:"#4ade80" },
  { id:2, label:"稀有級", icon:"🔵", color:"#60a5fa" },
  { id:3, label:"精英級", icon:"⚔️", color:"#8b5cf6" },
  { id:4, label:"強悍級", icon:"🔥", color:"#f97316" },
  { id:5, label:"頭目級", icon:"💀", color:"#ef4444" },
  { id:6, label:"神話級", icon:"👑", color:"#fbbf24" },
];

export default function AdminDungeon() {
  // ── 成員狀態 ──
  const [members,     setMembers]     = useState([]);
  const [search,      setSearch]      = useState("");
  const [selMember,   setSelMember]   = useState(null); // { id, name, ... }

  // ── 地下城設定 ──
  const [selFamily,   setSelFamily]   = useState("ghost");
  const [selDiff,     setSelDiff]     = useState(1);
  const [isHidden,    setIsHidden]    = useState(false);
  const [sending,     setSending]     = useState(false);
  const [msg,         setMsg]         = useState("");

  // ── 該玩家的儲存槽 ──
  const [savedDungeons, setSavedDungeons] = useState([]);
  const [loadingSaved,   setLoadingSaved]   = useState(false);

  useEffect(() => {
    getMembers().then(list => {
      setMembers(list.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    });
  }, []);

  // 選中玩家時讀取儲存槽
  useEffect(() => {
    if (!selMember?.id) { setSavedDungeons([]); return; }
    setLoadingSaved(true);
    getSavedDungeons(selMember.id).then(d => {
      setSavedDungeons(d || []);
      setLoadingSaved(false);
    });
  }, [selMember?.id]);

  const filtered = members.filter(m =>
    (m.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.nickname || "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleSaveDungeon() {
    if (!selMember?.id) return;
    setSending(true); setMsg("");
    const entry = {
      id: `admin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      family: selFamily,
      difficulty: selDiff,
      isHidden,
      revealedAt: new Date().toISOString(),
    };
    const res = await adminSetSavedDungeon(selMember.id, entry);
    if (res.ok) {
      setSavedDungeons(res.savedDungeons);
      setMsg(`✅ 已存入 ${getFamilyLabel(selFamily)} · ${getDiffLabel(selDiff)}`);
    } else {
      setMsg(`❌ ${res.reason}`);
    }
    setSending(false);
  }

  async function handleRemoveDungeon(dungeonId) {
    if (!selMember?.id || !dungeonId) return;
    const res = await removeSavedDungeon(selMember.id, dungeonId);
    if (res.ok) {
      setSavedDungeons(res.savedDungeons);
      setMsg("✅ 已移除");
    } else {
      setMsg("❌ 移除失敗");
    }
  }

  function getFamilyLabel(id) {
    return FAMILY_OPTIONS.find(f => f.id === id)?.label || id;
  }
  function getDiffLabel(id) {
    return DIFFICULTY_OPTIONS.find(d => d.id === id)?.label || `Lv.${id}`;
  }

  // ── Render ──
  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 className="font-black text-xl text-gray-800">🏰 地下城測試工具</h2>

      {/* ══════ 玩家選擇 ══════ */}
      <div className="bg-slate-800 rounded-2xl p-4 space-y-3">
        <div className="text-sm font-bold text-amber-300">👤 選擇玩家</div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="輸入玩家名稱搜尋…"
          className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {search && (
          <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl bg-slate-700/80 p-1">
            {filtered.length === 0 ? (
              <div className="text-slate-400 text-sm text-center py-2">無符合玩家</div>
            ) : (
              filtered.slice(0, 20).map(m => {
                const active = selMember?.id === m.id;
                return (
                  <button key={m.id}
                    onClick={() => { setSelMember(m); setSearch(""); setMsg(""); }}
                    style={{
                      display:"flex", alignItems:"center", gap:"8px", width:"100%",
                      padding:"8px 10px", borderRadius:"10px", border:"none", cursor:"pointer",
                      background: active ? "#1d4ed8" : "transparent",
                      color: active ? "white" : "#cbd5e1", fontSize:"13px",
                    }}>
                    <span>{m.nickname || m.name || "?"}</span>
                    <span className="text-slate-400 text-xs">{m.name}</span>
                    {active && <span className="ml-auto text-amber-300 text-xs">✓ 已選</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
        {selMember && !search && (
          <div className="flex items-center gap-2 bg-blue-900/40 rounded-xl px-3 py-2">
            <span className="text-white font-bold text-sm">{selMember.nickname || selMember.name}</span>
            <span className="text-slate-400 text-xs">@{selMember.name}</span>
            <button onClick={() => { setSelMember(null); setSavedDungeons([]); setMsg(""); }}
              className="ml-auto text-slate-400 text-xs hover:text-white">✕ 取消</button>
          </div>
        )}
      </div>

      {/* ══════ 地下城設定（有選玩家時顯示） ══════ */}
      {selMember && (
        <div className="bg-slate-800 rounded-2xl p-4 space-y-3">
          <div className="text-sm font-bold text-amber-300">🎲 設定地下城類型</div>

          {/* 種族選擇 */}
          <div>
            <div className="text-xs text-slate-400 mb-2">種族：</div>
            <div className="grid grid-cols-3 gap-2">
              {FAMILY_OPTIONS.map(f => (
                <button key={f.id}
                  onClick={() => setSelFamily(f.id)}
                  style={{
                    padding:"8px 4px", borderRadius:"10px", border:`2px solid ${selFamily === f.id ? f.color : "rgba(255,255,255,0.1)"}`,
                    background: selFamily === f.id ? `${f.color}22` : "rgba(255,255,255,0.05)",
                    color: selFamily === f.id ? f.color : "#94a3b8", cursor:"pointer",
                    fontWeight: selFamily === f.id ? "700" : "400", fontSize:"12px",
                    textAlign:"center", transition:"all 0.15s",
                  }}>
                  <div className="text-base">{f.emoji}</div>
                  <div>{f.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 難度選擇 */}
          <div>
            <div className="text-xs text-slate-400 mb-2">難度等級（1~6）：</div>
            <div className="flex gap-1.5">
              {DIFFICULTY_OPTIONS.map(d => (
                <button key={d.id}
                  onClick={() => setSelDiff(d.id)}
                  style={{
                    flex:1, padding:"8px 2px", borderRadius:"10px",
                    border:`2px solid ${selDiff === d.id ? d.color : "rgba(255,255,255,0.1)"}`,
                    background: selDiff === d.id ? `${d.color}22` : "rgba(255,255,255,0.05)",
                    color: selDiff === d.id ? d.color : "#94a3b8", cursor:"pointer",
                    fontWeight: selDiff === d.id ? "700" : "400", fontSize:"11px",
                    textAlign:"center", transition:"all 0.15s",
                  }}>
                  <div className="text-sm">{d.icon}</div>
                  <div>{d.id}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 隱藏開關 */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isHidden} onChange={e => setIsHidden(e.target.checked)}
              className="w-4 h-4 rounded accent-amber-500" />
            <span className="text-sm text-slate-300">
              {isHidden ? "🌟 隱藏地下城（神話級）" : "一般地下城"}
            </span>
          </label>

          {/* 預覽 */}
          <div className="bg-slate-700/50 rounded-xl p-3 text-center">
            <div className="text-xs text-slate-400 mb-1">預覽結果</div>
            <div className="text-lg">
              {FAMILY_OPTIONS.find(f => f.id === selFamily)?.emoji}{" "}
              {DIFFICULTY_OPTIONS.find(d => d.id === selDiff)?.icon}{" "}
              <span className="text-white font-bold">
                {getFamilyLabel(selFamily)} · {getDiffLabel(selDiff)}
              </span>
              {isHidden && <span className="text-amber-300 text-xs ml-2">🌟 隱藏</span>}
            </div>
          </div>

          <button onClick={handleSaveDungeon} disabled={sending}
            style={{
              width:"100%", padding:"12px", borderRadius:"12px", border:"none", cursor:"pointer",
              background: sending ? "#475569" : "linear-gradient(135deg,#f59e0b,#d97706)",
              color:"white", fontWeight:"900", fontSize:"14px",
              opacity: sending ? 0.6 : 1,
            }}>
            {sending ? "儲存中…" : "📦 存入玩家地下城選單"}
          </button>
        </div>
      )}

      {/* ══════ 當前儲存槽（有選玩家時顯示） ══════ */}
      {selMember && (
        <div className="bg-slate-800 rounded-2xl p-4 space-y-2">
          <div className="text-sm font-bold text-amber-300">
            📋 {selMember.nickname || selMember.name} 的儲存槽
            <span className="text-slate-400 text-xs ml-2">（{savedDungeons.length}/3）</span>
          </div>
          {loadingSaved ? (
            <div className="text-slate-400 text-sm text-center py-4">載入中…</div>
          ) : savedDungeons.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-4">尚無儲存的地下城</div>
          ) : (
            savedDungeons.map((d, i) => {
              const family = FAMILY_OPTIONS.find(f => f.id === d.family) || { emoji:"❓", label:"未知", color:"#94a3b8" };
              const diff = DIFFICULTY_OPTIONS.find(dd => dd.id === d.difficulty) || { icon:"❓", label:"未知" };
              return (
                <div key={d.id || i}
                  className="flex items-center gap-3 bg-slate-700/60 rounded-xl px-3 py-2.5">
                  <span className="text-lg">{family.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-semibold">
                      {family.label} · {diff.label}
                    </div>
                    <div className="text-xs text-slate-400">
                      槽 {i + 1}{d.isHidden ? " · 🌟 隱藏" : ""}
                      {d.revealedAt && ` · ${new Date(d.revealedAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button onClick={() => handleRemoveDungeon(d.id)}
                    className="px-2 py-1 rounded-lg bg-red-600/40 text-red-300 text-xs font-bold hover:bg-red-600/70 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ══════ 訊息提示 ══════ */}
      {msg && (
        <div className={`rounded-xl px-4 py-2 text-sm font-semibold ${
          msg.startsWith("✅") ? "bg-emerald-50 border border-emerald-200 text-emerald-700" :
          msg.startsWith("❌") ? "bg-rose-50 border border-rose-200 text-rose-700" :
          "bg-sky-50 border border-sky-200 text-sky-700"
        }`}>
          {msg}
        </div>
      )}


    </div>
  );
}
