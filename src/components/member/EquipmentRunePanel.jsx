import { useState } from "react";
import { EQUIPMENT_RUNE_TYPES, EQUIPMENT_RUNES, getNextEquipmentRune } from "../../lib/equipmentRuneData";
import { combineEquipmentRune, craftEquipmentRune } from "../../lib/db";
const label = rune => `${rune.icon} ${rune.name} T${rune.tier}`;

export default function EquipmentRunePanel({ profile, readOnly = false }) {
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const inventory = profile?.equipmentRuneInventory || {};
  const fragments = profile?.equipmentRuneFragments || {};
  const notify = text => { setNotice(text); window.setTimeout(() => setNotice(""), 3200); };
  const run = async (key, action) => {
    if (readOnly || busy) return null;
    setBusy(key); const result = await action(); setBusy("");
    if (!result.ok) notify(result.reason || "操作失敗，請稍後重試");
    return result;
  };
  const craft = async rune => {
    const result = await run(`craft-${rune.id}`, () => craftEquipmentRune(profile.id, rune.id));
    if (result?.ok) notify(`已製作 ${label(rune)}`);
  };
  const combine = async rune => {
    const result = await run(`combine-${rune.id}`, () => combineEquipmentRune(profile.id, rune.id));
    // 文案要跟實際扣除一致：兩枚都是材料，失敗不會保留任何一枚（2026-07-19 規格）
    if (result?.ok) notify(result.success
      ? `合成成功：${label(result.nextRune)}`
      : "合成失敗：兩枚材料符文與金幣已消耗");
  };

  return <section className="mt-4 rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-950/45 to-slate-950 p-4 shadow-xl">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-black text-violet-100">🔮 裝備符文</h2><p className="mt-1 text-[11px] text-slate-400">王房碎片製作初階符文；兩枚相同未鑲嵌符文可逐階合成（兩枚都會消耗，失敗不返還）。</p></div><div className="rounded-lg border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-[11px] font-black text-amber-200">👑 {profile?.kingSeals || 0}</div></div>
    {notice && <div role="status" className="mt-3 rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-xs font-bold text-violet-100">{notice}</div>}
    <div className="mt-4 grid grid-cols-2 gap-2">{Object.entries(EQUIPMENT_RUNE_TYPES).map(([type, meta]) => {
      const rune = EQUIPMENT_RUNES[`equipment_${type}_t1`]; const enabled = (fragments[type] || 0) >= rune.fragmentCost && (profile?.coins || 0) >= rune.goldCost;
      return <div key={type} className="rounded-xl border border-white/10 bg-black/20 p-2.5"><div className="text-xs font-black text-white">{meta.icon} {meta.name}</div><div className="mt-1 text-[10px] text-slate-400">碎片 {fragments[type] || 0}／{rune.fragmentCost}</div><button type="button" disabled={readOnly || !enabled || Boolean(busy)} onClick={() => craft(rune)} className="mt-2 min-h-9 w-full rounded-lg bg-violet-500/80 px-2 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busy === `craft-${rune.id}` ? "製作中…" : `製作 T1・${rune.goldCost} 金幣`}</button></div>;
    })}</div>
    <div className="mt-4 border-t border-white/10 pt-3"><div className="mb-2 text-xs font-black text-violet-200">符文背包</div><div className="space-y-2">{Object.values(EQUIPMENT_RUNES).filter(rune => (inventory[rune.id] || 0) > 0).map(rune => {
      const next = getNextEquipmentRune(rune.id); const enabled = next && (inventory[rune.id] || 0) >= 2 && (profile?.coins || 0) >= next.goldCost;
      return <div key={rune.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2"><div className="min-w-0 flex-1"><div className="text-xs font-black text-white">{label(rune)} <span className="text-violet-300">×{inventory[rune.id]}</span></div><div className="mt-0.5 text-[10px] text-slate-400">{rune.stat === "all" ? "ATK／DEF／HP" : rune.stat.toUpperCase()} +{Math.round(rune.bonus * 100)}%</div></div>{next && <button type="button" disabled={readOnly || !enabled || Boolean(busy)} onClick={() => combine(rune)} className="min-h-9 rounded-lg border border-violet-300/30 bg-violet-500/15 px-2 text-[10px] font-black text-violet-100 disabled:cursor-not-allowed disabled:opacity-35">{busy === `combine-${rune.id}` ? "合成中…" : `合成 T${next.tier}`}</button>}</div>;
    })}{!Object.values(EQUIPMENT_RUNES).some(rune => (inventory[rune.id] || 0) > 0) && <div className="rounded-xl border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">背包尚無符文。完成地下城王房可取得符文碎片。</div>}</div></div>
  </section>;
}
