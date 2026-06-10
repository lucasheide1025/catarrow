// src/components/member/MemberMaterials.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeMaterials } from "../../lib/db";
import { MATERIALS, RARITY_CONFIG } from "../../lib/monsterMaterials";

const RARITY_ORDER = ["legendary","rare","uncommon","common"];

export default function MemberMaterials({ onBack }) {
  const { profile } = useAuth();
  const [inventory, setInventory] = useState({});
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("all"); // all | owned | legendary | rare | uncommon | common

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeMaterials(profile.id, data => {
      setInventory(data);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, [profile?.id]);

  // 統計
  const totalKinds  = MATERIALS.length;
  const ownedKinds  = MATERIALS.filter(m => (inventory[m.id] || 0) > 0).length;
  const totalCount  = Object.values(inventory).reduce((s, v) => s + (v || 0), 0);

  // 篩選
  const filtered = MATERIALS.filter(m => {
    if (filter === "owned")    return (inventory[m.id] || 0) > 0;
    if (filter === "legendary" || filter === "rare" || filter === "uncommon" || filter === "common")
      return m.rarity === filter;
    return true;
  }).sort((a, b) => {
    // 先依稀有度排（高→低），再依持有數排（多→少）
    const ri = RARITY_ORDER.indexOf(a.rarity);
    const rj = RARITY_ORDER.indexOf(b.rarity);
    if (ri !== rj) return ri - rj;
    return (inventory[b.id] || 0) - (inventory[a.id] || 0);
  });

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* 頂部 */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="text-gray-500 text-sm">← 返回</button>
        )}
        <div className="flex-1">
          <h2 className="text-gray-800 font-black text-xl">🧪 材料庫存</h2>
        </div>
      </div>

      {/* 總覽卡 */}
      <div className="rounded-2xl p-4 text-white" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-purple-200 text-xs mb-0.5">已收集種類</div>
            <div className="font-black text-2xl">{ownedKinds}<span className="text-purple-300 text-sm font-normal">/{totalKinds}</span></div>
          </div>
          <div>
            <div className="text-purple-200 text-xs mb-0.5">材料總數</div>
            <div className="font-black text-2xl">{totalCount}</div>
          </div>
          <div>
            <div className="text-purple-200 text-xs mb-0.5">圖鑑完成度</div>
            <div className="font-black text-2xl">{Math.round(ownedKinds / totalKinds * 100)}<span className="text-purple-300 text-sm font-normal">%</span></div>
          </div>
        </div>
        {/* 進度條 */}
        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
            style={{ width:`${ownedKinds / totalKinds * 100}%` }} />
        </div>
      </div>

      {/* 篩選 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id:"all",       label:"全部" },
          { id:"owned",     label:"已持有" },
          { id:"legendary", label:"🌟 傳說" },
          { id:"rare",      label:"💙 稀有" },
          { id:"uncommon",  label:"💚 非凡" },
          { id:"common",    label:"⬜ 普通" },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all
              ${filter === f.id ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">載入中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">🧪</div>
          <div className="font-bold">沒有符合條件的材料</div>
          <div className="text-xs mt-1">打怪就能獲得材料！</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(mat => {
            const count    = inventory[mat.id] || 0;
            const rarity   = RARITY_CONFIG[mat.rarity] || RARITY_CONFIG.common;
            const owned    = count > 0;

            return (
              <div key={mat.id}
                className={`rounded-2xl p-4 border transition-all ${owned ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"}`}>
                <div className="flex items-center gap-3">
                  {/* 圖示 */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${owned ? "bg-purple-50" : "bg-gray-100"}`}>
                    {owned ? mat.icon : "❓"}
                  </div>

                  {/* 資訊 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-black text-sm ${owned ? "text-gray-800" : "text-gray-400"}`}>
                        {owned ? mat.name : "???"}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: rarity.color + "22", color: rarity.color }}>
                        {rarity.label}
                      </span>
                    </div>
                    {owned && (
                      <div className="text-gray-400 text-xs mt-0.5 leading-relaxed">{mat.desc}</div>
                    )}
                    {/* 來源怪物 */}
                    <div className="text-gray-400 text-xs mt-1">
                      {mat.monster === "all"
                        ? "🎲 所有怪物均可掉落"
                        : `👹 ${Array.isArray(mat.monster) ? mat.monster.length : 0} 種怪物`}
                    </div>
                  </div>

                  {/* 持有數 */}
                  <div className="text-right flex-shrink-0">
                    <div className={`font-black text-2xl ${owned ? "text-purple-600" : "text-gray-300"}`}>
                      {count}
                    </div>
                    <div className="text-gray-400 text-xs">個</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
