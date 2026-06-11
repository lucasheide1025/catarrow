import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { MATERIALS } from "../../lib/monsterMaterials";
import { POTIONS, FRAGMENTS, CHEST_TYPES } from "../../lib/itemData";
import { adminGiveItem } from "../../lib/db";

const CATEGORIES = [
  { id:"material", label:"素材", icon:"🪨" },
  { id:"potion",   label:"藥水", icon:"🧪" },
  { id:"fragment", label:"碎片", icon:"🔮" },
  { id:"chest",    label:"寶箱", icon:"📦" },
];

const ITEMS_BY_CAT = {
  material: MATERIALS.map(m => ({ id:m.id, name:m.name, icon:m.icon, sub:m.rarity })),
  potion:   POTIONS.map(p =>   ({ id:p.id, name:p.name, icon:p.icon, sub:p.rarity })),
  fragment: FRAGMENTS.map(f => ({ id:f.id, name:f.name, icon:f.icon, sub:"" })),
  chest:    Object.values(CHEST_TYPES).map(c => ({ id:c.id, name:c.name, icon:c.icon, sub:"" })),
};

const RARITY_COLOR = {
  common:"#9ca3af", uncommon:"#4ade80", rare:"#60a5fa",
  epic:"#a78bfa", legendary:"#fbbf24",
};

export default function AdminGiveTool() {
  const [members,   setMembers]   = useState([]);
  const [selMember, setSelMember] = useState(null);
  const [category,  setCategory]  = useState("material");
  const [selItem,   setSelItem]   = useState(null);
  const [qty,       setQty]       = useState(1);
  const [giving,    setGiving]    = useState(false);
  const [msg,       setMsg]       = useState("");
  const [search,    setSearch]    = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "members"), orderBy("name")))
      .then(snap => setMembers(snap.docs.map(d => ({ id:d.id, ...d.data() }))))
      .catch(() => {});
  }, []);

  async function doGive() {
    if (!selMember || !selItem || qty < 1) return;
    setGiving(true);
    setMsg("");
    const res = await adminGiveItem(selMember.id, category, selItem.id, qty);
    setGiving(false);
    if (res.ok) {
      setMsg(`✅ 已給予「${selMember.nickname || selMember.name}」× ${qty} 個「${selItem.icon}${selItem.name}」`);
    } else {
      setMsg(`❌ ${res.reason}`);
    }
  }

  const filteredMembers = members.filter(m =>
    !search || (m.nickname || m.name || "").includes(search)
  );
  const items = ITEMS_BY_CAT[category] || [];

  return (
    <div className="p-4 flex flex-col gap-5 max-w-lg mx-auto pb-8">
      <div className="font-black text-xl text-gray-800">🧪 後台道具給予</div>

      {/* 選射手 */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
        <div className="text-xs font-black text-gray-500 tracking-wider uppercase">射手</div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜尋射手名稱…"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
          {filteredMembers.map(m => (
            <button key={m.id} onClick={() => { setSelMember(m); setMsg(""); }}
              className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${
                selMember?.id === m.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300"
              }`}>
              {m.nickname || m.name}
            </button>
          ))}
          {filteredMembers.length === 0 && (
            <div className="text-sm text-gray-400">找不到射手</div>
          )}
        </div>
      </div>

      {/* 選類別 */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
        <div className="text-xs font-black text-gray-500 tracking-wider uppercase">道具類別</div>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => { setCategory(c.id); setSelItem(null); setMsg(""); }}
              className={`py-2.5 rounded-xl text-sm font-bold border transition-all flex flex-col items-center gap-0.5 ${
                category === c.id
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300"
              }`}>
              <span className="text-lg">{c.icon}</span>
              <span className="text-[11px]">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 選道具 */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
        <div className="text-xs font-black text-gray-500 tracking-wider uppercase">選擇道具</div>
        <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
          {items.map(item => (
            <button key={item.id} onClick={() => { setSelItem(item); setMsg(""); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 ${
                selItem?.id === item.id
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-gray-50 text-gray-700 border-gray-200 hover:border-emerald-300"
              }`}
              style={selItem?.id !== item.id && item.sub ? { borderLeftColor: RARITY_COLOR[item.sub], borderLeftWidth: 3 } : {}}>
              <span>{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 數量 + 執行 */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
        <div className="text-xs font-black text-gray-500">數量</div>
        <button onClick={() => setQty(q => Math.max(1, q - 1))}
          className="w-9 h-9 rounded-full bg-gray-100 font-black text-gray-700 text-lg flex items-center justify-center">−</button>
        <span className="w-10 text-center font-black text-xl text-gray-800">{qty}</span>
        <button onClick={() => setQty(q => Math.min(99, q + 1))}
          className="w-9 h-9 rounded-full bg-gray-100 font-black text-gray-700 text-lg flex items-center justify-center">+</button>
        {[5, 10, 20].map(n => (
          <button key={n} onClick={() => setQty(n)}
            className="px-2.5 py-1 text-xs bg-gray-100 rounded-lg text-gray-500 font-bold hover:bg-gray-200">
            ×{n}
          </button>
        ))}
        <button onClick={doGive} disabled={!selMember || !selItem || giving}
          className="ml-auto px-5 py-2.5 bg-blue-600 text-white font-black rounded-xl text-sm disabled:opacity-40 active:scale-95 transition-transform">
          {giving ? "給予中…" : "✅ 給予"}
        </button>
      </div>

      {/* 目前選擇摘要 */}
      {selMember && selItem && !msg && (
        <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-800 font-bold">
          {selMember.nickname || selMember.name} ← {selItem.icon} {selItem.name} × {qty}
        </div>
      )}

      {/* 結果 */}
      {msg && (
        <div className={`p-4 rounded-xl text-sm font-bold ${
          msg.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
        }`}>
          {msg}
        </div>
      )}
    </div>
  );
}
