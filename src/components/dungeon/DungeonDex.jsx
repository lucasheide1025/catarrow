// src/components/dungeon/DungeonDex.jsx — 地下城收藏檔案庫（博物館陳列式）
// 陳列櫃格狀展示，框色＝收集品階（等級）；點一格才跳出細項。
import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { FAMILY_COLLECTIBLES, COLLECTIBLE_MAP } from "../../lib/dungeonCollectibles";
import { DUNGEON_MAPS, FAMILY_CONFIGS } from "../../lib/dungeonData";

const COLLECTION_GRADES = [
  { min:100, id:"mythic", label:"神話", color:"#fb7185", next:null },
  { min:60, id:"legendary", label:"傳說", color:"#fbbf24", next:100 },
  { min:30, id:"epic", label:"史詩", color:"#c084fc", next:60 },
  { min:15, id:"rare", label:"稀有", color:"#60a5fa", next:30 },
  { min:5, id:"uncommon", label:"優良", color:"#4ade80", next:15 },
  { min:1, id:"common", label:"普通", color:"#cbd5e1", next:5 },
];

function collectionGrade(qty) {
  return COLLECTION_GRADES.find(grade => qty >= grade.min) || {
    min:0, id:"locked", label:"未發現", color:"#64748b", next:1,
  };
}

// 陳列櫃小格：框色＝品階；未收集顯示灰色 ❔。點擊 → 開細項。
function MuseumTile({ item, qty, onClick }) {
  const grade = collectionGrade(qty);
  const owned = qty > 0;
  return (
    <button type="button" onClick={onClick} title={owned ? item.name : "未發現"}
      className="relative flex flex-col items-center gap-0.5 rounded-lg border p-1 transition-all active:scale-95"
      style={{
        background: owned ? "linear-gradient(180deg,#16233a,#0b1626)" : "#0b1220",
        borderColor: owned ? `${grade.color}77` : "rgba(148,163,184,.12)",
        boxShadow: owned ? `inset 0 2px ${grade.color}, 0 4px 10px rgba(0,0,0,.3)` : "inset 0 2px #334155",
        opacity: owned ? 1 : 0.7,
      }}>
      {/* 展示座 */}
      <div className="grid h-10 w-full place-items-center rounded-md text-2xl"
        style={{
          background: owned ? "radial-gradient(circle at 50% 25%, rgba(255,255,255,.07), #0a1220)" : "#0a1220",
          filter: owned ? "none" : "grayscale(1) brightness(.55)",
        }}>
        {owned ? item.icon : "❔"}
      </div>
      {/* 收集到的等級（品階，用色）+ 數量 */}
      <div className="flex w-full items-center justify-center gap-0.5 leading-none">
        <span className="text-[8px] font-black" style={{ color:grade.color }}>{owned ? grade.label : "—"}</span>
        {owned && <span className="text-[8px] font-bold text-slate-400">×{qty}</span>}
      </div>
    </button>
  );
}

// 點開的細項彈窗
function DetailModal({ entry, onClose }) {
  const { item, qty, context } = entry;
  const grade = collectionGrade(qty);
  const owned = qty > 0;
  const progress = grade.next ? Math.max(0, Math.min(100, ((qty - grade.min) / (grade.next - grade.min)) * 100)) : 100;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      onClick={onClose} style={{ background:"rgba(0,0,0,.82)", backdropFilter:"blur(6px)" }}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-xs rounded-3xl border p-5 text-center shadow-2xl"
        style={{ background:"linear-gradient(180deg,#16233a,#0b1220)", borderColor:`${grade.color}66`, boxShadow:`0 0 34px ${grade.color}33` }}>
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-2xl text-6xl"
          style={{ background:"radial-gradient(circle at 50% 25%, rgba(255,255,255,.08), #0a1220)", filter: owned ? "none" : "grayscale(1) brightness(.6)" }}>
          {owned ? item.icon : "❔"}
        </div>
        <div className="mt-2 text-xs font-black tracking-wide" style={{ color:grade.color }}>{grade.label} 收藏</div>
        <h3 className="mt-0.5 text-lg font-black text-white">{owned ? item.name : "尚未發現"}</h3>
        {context && <div className="text-[11px] text-slate-500">{context}</div>}
        <div className="mt-1 text-2xl font-black text-amber-300">×{qty}</div>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.desc}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-950">
          <div className="h-full rounded-full" style={{ width:`${progress}%`, background:grade.color }} />
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          {grade.next ? `再收集 ${Math.max(0, grade.next - qty)} 個升到下一品階` : "已達神話收藏 ✨"}
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-xl bg-amber-400 py-2.5 text-sm font-black text-slate-900 active:scale-95">關閉</button>
      </div>
    </div>
  );
}

export default function DungeonDex({ guestProfile }) {
  const { profile: authProfile } = useAuth();
  const profile = guestProfile || authProfile;
  const collectibles = profile?.dungeonCollectibles || {};
  const [selFamily, setSelFamily] = useState("all");
  const [mode, setMode] = useState("collection");
  const [selected, setSelected] = useState(null); // { item, qty, context }
  const allItems = Object.values(COLLECTIBLE_MAP);
  const owned = allItems.filter(item => (collectibles[item.id] || 0) > 0).length;
  const totalCopies = Object.values(collectibles).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
  const families = selFamily === "all" ? FAMILY_CONFIGS.map(f => f.id) : [selFamily];

  return (
    <div className="pb-10">
      {/* 館藏總覽 */}
      <section className="mb-4 rounded-2xl border border-amber-200/15 bg-[#101827] p-4 shadow-xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[9px] font-black tracking-[.2em] text-amber-300">🏛️ RELIC MUSEUM</div>
            <h2 className="mt-1 text-lg font-black text-white">地下城收藏博物館</h2>
            <p className="mt-1 text-[10px] text-slate-400">點展示櫃看細項；框色＝收藏品階，重複取得可升階。</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xl font-black text-amber-300">{owned}/{allItems.length}</div>
            <div className="text-[9px] text-slate-500">共 {totalCopies.toLocaleString()} 件</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-950">
          <div className="h-full bg-amber-400" style={{ width:`${allItems.length ? owned / allItems.length * 100 : 0}%` }} />
        </div>
        {/* 品階圖例 */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {COLLECTION_GRADES.slice().reverse().map(g => (
            <span key={g.id} className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-black"
              style={{ color:g.color, background:`${g.color}1a`, border:`1px solid ${g.color}44` }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background:g.color }} />{g.label}
            </span>
          ))}
        </div>
      </section>

      {/* 一般收藏 / 首通紀念章 */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {[{id:"collection",label:"🏺 一般收藏"},{id:"exclusive",label:"🏅 首通紀念章"}].map(tab => (
          <button key={tab.id} onClick={() => setMode(tab.id)}
            className="min-h-11 rounded-xl border px-3 text-xs font-black"
            style={mode === tab.id
              ? { background:"#fbbf24", color:"#111827", borderColor:"#fcd34d" }
              : { background:"#101827", color:"#94a3b8", borderColor:"rgba(148,163,184,.16)" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "exclusive" ? (
        <div className="grid grid-cols-5 gap-1.5">
          {DUNGEON_MAPS.map(map => {
            const item = COLLECTIBLE_MAP[`${map.id}_trophy`];
            if (!item) return null;
            const qty = collectibles[item.id] || 0;
            const context = `${map.emoji} ${map.name}`;
            return <MuseumTile key={item.id} item={item} qty={qty} onClick={() => setSelected({ item, qty, context })} />;
          })}
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth:"none" }}>
            <button onClick={() => setSelFamily("all")} className="min-h-9 shrink-0 rounded-lg border px-3 text-xs font-black"
              style={selFamily === "all" ? {background:"#334155",color:"white",borderColor:"#64748b"}:{background:"#101827",color:"#94a3b8",borderColor:"rgba(148,163,184,.14)"}}>全部</button>
            {FAMILY_CONFIGS.map(family => (
              <button key={family.id} onClick={() => setSelFamily(family.id)} className="min-h-9 shrink-0 rounded-lg border px-3 text-xs font-black"
                style={selFamily === family.id ? {background:"#334155",color:"white",borderColor:"#64748b"}:{background:"#101827",color:"#94a3b8",borderColor:"rgba(148,163,184,.14)"}}>
                {family.emoji} {family.label}
              </button>
            ))}
          </div>
          {families.map(familyId => {
            const tiers = FAMILY_COLLECTIBLES[familyId];
            if (!tiers) return null;
            const family = FAMILY_CONFIGS.find(config => config.id === familyId);
            const items = [...tiers.common, ...tiers.rare, ...tiers.boss, ...(tiers.superRare || [])]
              .map(item => COLLECTIBLE_MAP[item.id]).filter(Boolean);
            const familyOwned = items.filter(item => (collectibles[item.id] || 0) > 0).length;
            return (
              <section key={familyId} className="mb-5">
                <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-2">
                  <span className="text-lg">{family?.emoji}</span>
                  <h3 className="text-sm font-black text-white">{family?.label}展示廳</h3>
                  <span className="ml-auto text-[10px] font-bold text-slate-500">{familyOwned}/{items.length}</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {items.map(item => {
                    const qty = collectibles[item.id] || 0;
                    return <MuseumTile key={item.id} item={item} qty={qty} onClick={() => setSelected({ item, qty, context:`${family?.emoji} ${family?.label}` })} />;
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}

      {selected && <DetailModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
