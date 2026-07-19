// 冒險素材：清楚分成「升級素材」庫存與「兌換素材」操作。
import { useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { MATERIAL_BY_ID, previewSameTierConversion, previewTierUpgrade } from "../../lib/monsterEconomyCatalog";
import { convertMaterials } from "../../lib/materialConversionDb";
import { sfxBuff, sfxError, sfxTap } from "../../lib/sound";

const FAMILY = {
  ghost:["鬼怪","👻"], mountain:["山林","🏔️"], insect:["毒蟲","🦂"],
  workplace:["職場","💼"], exam:["考試","📝"], temple:["西方","🏰"], treasure:["寶箱","🧰"],
};
const KIND = { normal:"一般", miniBoss:"小王", boss:"大王" };

function MaterialArt({ material }) {
  const [failed, setFailed] = useState(false);
  return <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
    {!failed && <img src={`/items/monster-materials/${material.id}.webp`} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />}
    {failed && <span className="absolute inset-0 flex items-center justify-center text-3xl" aria-hidden="true">{material.icon || FAMILY[material.family]?.[1] || "🪨"}</span>}
  </div>;
}

function Tags({ material }) {
  return <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-black">
    <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-violet-200">{FAMILY[material.family]?.[0] || material.family}</span>
    <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-sky-200">T{material.tierIndex}</span>
    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-200">{KIND[material.kind] || material.kind}</span>
  </div>;
}

export default function ExpansionMaterialsPanel({ items = {} }) {
  const { profile } = useAuth();
  const memberId = profile?.id;
  const coins = profile?.coins || 0;
  const [section, setSection] = useState("upgrade");
  const [family, setFamily] = useState("all");
  const [sourceId, setSourceId] = useState("");
  const [operation, setOperation] = useState("sameTier");
  const [targetId, setTargetId] = useState("");
  const [batches, setBatches] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const owned = useMemo(() => Object.entries(items)
    .filter(([id, count]) => Number(count) > 0 && MATERIAL_BY_ID[id])
    .map(([id, count]) => ({ ...MATERIAL_BY_ID[id], count:Number(count) }))
    .sort((a,b) => a.family.localeCompare(b.family) || a.tierIndex-b.tierIndex || a.name.localeCompare(b.name)), [items]);
  const visible = family === "all" ? owned : owned.filter(item => item.family === family);
  const source = MATERIAL_BY_ID[sourceId] || null;
  const targetOptions = useMemo(() => {
    if (!source || source.kind !== "normal") return [];
    return Object.values(MATERIAL_BY_ID).filter(item => item.kind === "normal" && item.id !== source.id &&
      (operation === "sameTier" ? item.tierIndex === source.tierIndex : item.family === source.family && item.tierIndex === source.tierIndex + 1));
  }, [source, operation]);
  const preview = useMemo(() => {
    if (!source || !targetId || batches < 1) return null;
    try { return operation === "tierUpgrade"
      ? previewTierUpgrade({ sourceMaterialId:source.id, targetMaterialId:targetId, batches })
      : previewSameTierConversion({ sourceMaterialId:source.id, targetMaterialId:targetId, batches });
    } catch { return null; }
  }, [source, targetId, operation, batches]);

  async function handleConvert() {
    if (!preview || busy) return;
    setBusy(true); sfxTap();
    const result = await convertMaterials(memberId, { operation, sourceMaterialId:source.id, targetMaterialId:targetId, batches });
    setBusy(false);
    if (!result.ok) { sfxError(); setNotice({ tone:"err", text:result.reason }); return; }
    sfxBuff(); setNotice({ tone:"ok", text:`轉換成功：${MATERIAL_BY_ID[targetId]?.name} ×${result.preview.target.quantity}` });
  }

  if (!memberId) return null;
  return <section className="rounded-2xl border border-violet-400/20 bg-slate-900/70 p-4">
    <div className="flex items-center justify-between"><h3 className="text-sm font-black text-violet-200">怪物素材</h3><span className="text-[11px] text-slate-400">共 {owned.reduce((n,m)=>n+m.count,0)} 個・🪙 {coins.toLocaleString()}</span></div>
    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-black/20 p-1">
      <button onClick={()=>setSection("upgrade")} className={`rounded-lg py-2 text-xs font-black ${section==="upgrade"?"bg-violet-500 text-white":"text-slate-400"}`}>⬆️ 升級素材</button>
      <button onClick={()=>setSection("convert")} className={`rounded-lg py-2 text-xs font-black ${section==="convert"?"bg-emerald-500 text-slate-950":"text-slate-400"}`}>♻️ 兌換素材</button>
    </div>

    {section === "upgrade" && <>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={()=>setFamily("all")} className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black ${family==="all"?"bg-violet-500 text-white":"bg-white/5 text-slate-400"}`}>全部</button>
        {Object.entries(FAMILY).map(([id,meta]) => <button key={id} onClick={()=>setFamily(id)} className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black ${family===id?"bg-violet-500 text-white":"bg-white/5 text-slate-400"}`}>{meta[1]} {meta[0]}</button>)}
      </div>
      {visible.length ? <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {visible.map(material => <article key={material.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] p-2.5">
          <MaterialArt material={material}/><div className="min-w-0 flex-1"><div className="truncate text-xs font-black text-slate-100">{material.name}</div><Tags material={material}/><div className="mt-1 text-[10px] text-slate-500">用於裝備專精與素材製作</div></div><div className="text-lg font-black text-amber-300">×{material.count}</div>
        </article>)}
      </div> : <div className="py-10 text-center text-xs text-slate-500">目前沒有這個分類的素材</div>}
    </>}

    {section === "convert" && <div className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
      <label className="text-[10px] font-black text-slate-400">來源素材</label>
      <select value={sourceId} onChange={e=>{setSourceId(e.target.value);setTargetId("");}} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-2 py-2 text-xs text-slate-100">
        <option value="">選擇持有的一般素材…</option>{owned.filter(m=>m.kind==="normal").map(m=><option key={m.id} value={m.id}>{m.name}・{FAMILY[m.family]?.[0]}・T{m.tierIndex}（×{m.count}）</option>)}
      </select>
      {source && <>
        <div className="mt-3 flex gap-2"><button onClick={()=>{setOperation("sameTier");setTargetId("");}} className={`rounded-lg px-2 py-1.5 text-[10px] font-black ${operation==="sameTier"?"bg-emerald-500/20 text-emerald-300":"bg-white/5 text-slate-400"}`}>同階轉換</button><button disabled={source.tierIndex>=6} onClick={()=>{setOperation("tierUpgrade");setTargetId("");}} className={`rounded-lg px-2 py-1.5 text-[10px] font-black disabled:opacity-30 ${operation==="tierUpgrade"?"bg-sky-500/20 text-sky-300":"bg-white/5 text-slate-400"}`}>同族升階</button></div>
        <select value={targetId} onChange={e=>setTargetId(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-2 py-2 text-xs text-slate-100"><option value="">選擇目標素材…</option>{targetOptions.map(m=><option key={m.id} value={m.id}>{m.name}・{FAMILY[m.family]?.[0]}・T{m.tierIndex}（持有 ×{items[m.id]||0}）</option>)}</select>
        <div className="mt-2 flex items-center gap-2"><label className="text-[10px] text-slate-400">批數</label><input type="number" min="1" max="99" value={batches} onChange={e=>setBatches(Math.max(1,Math.min(99,Math.floor(Number(e.target.value)||1))))} className="w-16 rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white"/></div>
        {preview && <div className="mt-2 rounded-lg bg-black/20 p-2 text-[10px] text-slate-300">消耗 {source.name} ×{preview.source.quantity} ＋ 🪙{preview.coins.toLocaleString()} → 獲得 {MATERIAL_BY_ID[targetId]?.name} ×{preview.target.quantity}</div>}
        <button disabled={!preview||busy} onClick={handleConvert} className="mt-2 w-full rounded-lg bg-emerald-500 py-2 text-xs font-black text-slate-950 disabled:opacity-30">{busy?"處理中…":"確認兌換"}</button>
      </>}
      {notice && <div className={`mt-2 rounded-lg px-3 py-2 text-[11px] font-bold ${notice.tone==="err"?"bg-rose-500/15 text-rose-300":"bg-emerald-500/15 text-emerald-300"}`}>{notice.text}</div>}
    </div>}
  </section>;
}
