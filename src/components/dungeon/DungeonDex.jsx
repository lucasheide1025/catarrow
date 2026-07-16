// src/components/dungeon/DungeonDex.jsx — 地下城收藏檔案庫
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

function CollectibleCard({ item, qty, context }) {
  const grade = collectionGrade(qty);
  const progress = grade.next
    ? Math.max(0, Math.min(100, ((qty - grade.min) / (grade.next - grade.min)) * 100))
    : 100;
  return (
    <article className="relative min-w-0 overflow-hidden rounded-xl border p-3"
      style={{
        background: qty > 0 ? "#121c2d" : "#0b1220",
        borderColor: qty > 0 ? `${grade.color}55` : "rgba(148,163,184,.12)",
        boxShadow: qty > 0 ? `inset 0 3px ${grade.color}, 0 10px 20px rgba(0,0,0,.22)` : "inset 0 3px #334155",
        opacity: qty > 0 ? 1 : .62,
      }}>
      <div className="flex items-start justify-between gap-2">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-950 text-2xl"
          style={{ filter:qty > 0 ? "none" : "grayscale(1)" }}>{item.icon}</div>
        <div className="text-right">
          <div className="text-[9px] font-black tracking-wide" style={{ color:grade.color }}>{grade.label}</div>
          <div className="text-sm font-black text-white">×{qty}</div>
        </div>
      </div>
      <h3 className="mt-2 truncate text-xs font-black" style={{ color:qty > 0 ? "#f8fafc" : "#64748b" }}>{item.name}</h3>
      {context && <div className="mt-0.5 truncate text-[9px] text-slate-500">{context}</div>}
      <p className="mt-1 line-clamp-2 min-h-[30px] text-[10px] leading-[15px] text-slate-400">{item.desc}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-950">
        <div className="h-full rounded-full" style={{ width:`${progress}%`, background:grade.color }} />
      </div>
      <div className="mt-1 text-[8px] text-slate-500">
        {grade.next ? `再收集 ${Math.max(0, grade.next - qty)} 個升級` : "已達神話收藏"}
      </div>
    </article>
  );
}

export default function DungeonDex({ guestProfile }) {
  const { profile: authProfile } = useAuth();
  const profile = guestProfile || authProfile;
  const collectibles = profile?.dungeonCollectibles || {};
  const [selFamily, setSelFamily] = useState("all");
  const [mode, setMode] = useState("collection");
  const allItems = Object.values(COLLECTIBLE_MAP);
  const owned = allItems.filter(item => (collectibles[item.id] || 0) > 0).length;
  const totalCopies = Object.values(collectibles).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
  const families = selFamily === "all" ? FAMILY_CONFIGS.map(f => f.id) : [selFamily];

  return (
    <div className="pb-10">
      <section className="mb-4 rounded-2xl border border-amber-200/15 bg-[#101827] p-4 shadow-xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[9px] font-black tracking-[.2em] text-amber-300">RELIC ARCHIVE</div>
            <h2 className="mt-1 text-lg font-black text-white">地下城收藏檔案庫</h2>
            <p className="mt-1 text-[10px] text-slate-400">重複取得會提升品階，收集 100 個成為神話收藏。</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xl font-black text-amber-300">{owned}/{allItems.length}</div>
            <div className="text-[9px] text-slate-500">共 {totalCopies.toLocaleString()} 件</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-950">
          <div className="h-full bg-amber-400" style={{ width:`${allItems.length ? owned / allItems.length * 100 : 0}%` }} />
        </div>
      </section>

      <div className="mb-3 grid grid-cols-2 gap-2">
        {[{id:"collection",label:"一般收藏"},{id:"exclusive",label:"首通紀念章"}].map(tab => (
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
        <div className="grid grid-cols-2 gap-2">
          {DUNGEON_MAPS.map(map => {
            const item = COLLECTIBLE_MAP[`${map.id}_trophy`];
            return item ? <CollectibleCard key={item.id} item={item} qty={collectibles[item.id] || 0} context={`${map.emoji} ${map.name}`} /> : null;
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
                  <h3 className="text-sm font-black text-white">{family?.label}</h3>
                  <span className="ml-auto text-[10px] font-bold text-slate-500">{familyOwned}/{items.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {items.map(item => <CollectibleCard key={item.id} item={item} qty={collectibles[item.id] || 0} />)}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
