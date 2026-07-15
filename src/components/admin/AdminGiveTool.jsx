import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { MATERIALS } from "../../lib/monsterMaterials";
import { POTIONS, FRAGMENTS, CHEST_TYPES } from "../../lib/itemData";
import { adminGiveItem, adminSetFragments, adminSetMemberBadge, addCoins } from "../../lib/db";
import { assertCostCapability, COST_CAPABILITIES } from "../../lib/costControl";
import AdminDexGrant from "./AdminDexGrant";

const CATEGORIES = [
  { id:"coins",    label:"金幣", icon:"🪙" },
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
  const { profile } = useAuth();
  const [mainTab,    setMainTab]   = useState("give");
  const [members,    setMembers]   = useState([]);
  const [selMembers, setSelMembers] = useState(new Set());
  const [category,   setCategory]  = useState("coins");
  const [selItem,    setSelItem]   = useState(null);
  const [qty,        setQty]       = useState(100);
  const [giving,     setGiving]    = useState(false);
  const [msg,        setMsg]       = useState("");
  const [search,     setSearch]    = useState("");

  // 資料修正面板（只在單選時啟用）
  const [fixFrags,   setFixFrags]   = useState(null);
  const [fixBadges,  setFixBadges]  = useState(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [fixMsg,     setFixMsg]     = useState("");
  const [fixSaving,  setFixSaving]  = useState(false);

  useEffect(() => {
    getDocs(collection(db, "members"))
      .then(snap => {
        const list = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        list.sort((a, b) => (a.name || a.nickname || "").localeCompare(b.name || b.nickname || ""));
        setMembers(list);
      })
      .catch(() => {});
  }, []);

  // 單選的那位成員（用於資料修正）
  const singleSel = selMembers.size === 1
    ? members.find(m => m.id === [...selMembers][0]) || null
    : null;

  useEffect(() => {
    if (singleSel?.id) loadFixData(singleSel.id);
    else { setFixFrags(null); setFixBadges(null); setFixMsg(""); }
  }, [singleSel?.id]); // eslint-disable-line

  function toggleMember(id) {
    setSelMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setMsg("");
  }

  const filteredMembers = members.filter(m =>
    !search || (m.nickname || m.name || "").includes(search)
  );

  function selectAll() {
    setSelMembers(new Set(filteredMembers.map(m => m.id)));
    setMsg("");
  }
  function clearAll() {
    setSelMembers(new Set());
    setMsg("");
  }

  async function doGive() {
    if (selMembers.size === 0 || qty < 1) return;
    if (category !== "coins" && !selItem) return;
    setGiving(true); setMsg("");

    try {
      const targets = [...selMembers];
      if (targets.length > 1) assertCostCapability(COST_CAPABILITIES.bulkAdminWrites);
      const nameOf = id => {
        const m = members.find(x => x.id === id);
        return m?.nickname || m?.name || id;
      };
      const displayNames = targets.length > 3
        ? `${targets.length} 位射手`
        : targets.map(nameOf).join("、");

      if (category === "coins") {
        for (const memberId of targets) {
          await addCoins(memberId, qty);
        }
        setMsg(`✅ 已給予 ${displayNames} × ${qty} 🪙 金幣`);
      } else {
        for (const memberId of targets) {
          await adminGiveItem(memberId, category, selItem.id, qty);
        }
        setMsg(`✅ 已給予 ${displayNames} × ${qty} 個「${selItem.icon}${selItem.name}」`);
      }
    } catch (e) {
      setMsg("❌ " + (e?.message || "發放失敗"));
    }
    setGiving(false);
  }

  async function loadFixData(memberId) {
    setFixLoading(true); setFixMsg(""); setFixFrags(null); setFixBadges(null);
    try {
      const [fragSnap, memSnap] = await Promise.all([
        getDoc(doc(db, "fragmentInventory", memberId)),
        getDoc(doc(db, "members", memberId)),
      ]);
      setFixFrags(fragSnap.exists() ? (fragSnap.data().items || {}) : {});
      const md = memSnap.exists() ? memSnap.data() : {};
      setFixBadges({
        fatCat:      { bronze: md.fatCat?.bronze || 0,      silver: md.fatCat?.silver || 0 },
        score:       { bronze: md.score?.bronze  || 0,      silver: md.score?.silver  || 0 },
        achievement: { silver: md.achievement?.silver || 0, gold:   md.achievement?.gold  || 0 },
      });
    } catch (e) { setFixMsg("❌ 讀取失敗：" + e?.message); }
    setFixLoading(false);
  }

  async function saveFrags() {
    if (!singleSel || !fixFrags) return;
    setFixSaving(true); setFixMsg("");
    const cleaned = {};
    FRAGMENTS.forEach(f => { cleaned[f.id] = Math.max(0, Number(fixFrags[f.id]) || 0); });
    const res = await adminSetFragments(singleSel.id, cleaned);
    setFixMsg(res.ok ? "✅ 碎片已更新" : "❌ " + res.reason);
    setFixSaving(false);
  }

  async function saveBadge(badgeField, badgeLevel, value) {
    if (!singleSel) return;
    setFixMsg("");
    const res = await adminSetMemberBadge(singleSel.id, badgeField, badgeLevel, value);
    if (res.ok) {
      setFixBadges(prev => ({ ...prev, [badgeField]: { ...prev[badgeField], [badgeLevel]: Number(value) } }));
      setFixMsg("✅ 徽章已更新");
    } else { setFixMsg("❌ " + res.reason); }
  }

  async function resetAllFrags() {
    if (!singleSel || !window.confirm(`確定要清零「${singleSel.nickname || singleSel.name}」的所有碎片嗎？`)) return;
    setFixSaving(true); setFixMsg("");
    const empty = {};
    FRAGMENTS.forEach(f => { empty[f.id] = 0; });
    const res = await adminSetFragments(singleSel.id, empty);
    if (res.ok) { setFixFrags(empty); setFixMsg("✅ 碎片已全部清零"); }
    else setFixMsg("❌ " + res.reason);
    setFixSaving(false);
  }

  const items = ITEMS_BY_CAT[category] || [];

  return (
    <div className="p-4 flex flex-col gap-5 max-w-lg mx-auto pb-8">
      <div className="font-black text-xl text-gray-800">🎁 獎品發放</div>

      {/* 主 Tab */}
      <div className="flex gap-2">
        {[["give","🎁 道具/金幣"],["dex","🎖️ 圖鑑授予"]].map(([id,label]) => (
          <button key={id} onClick={() => setMainTab(id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${mainTab === id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {mainTab === "dex" ? <AdminDexGrant /> : (
        <>
          {/* ── 選射手（多選） ── */}
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-gray-500 tracking-wider uppercase">
                射手{selMembers.size > 0 ? `（已選 ${selMembers.size} 位）` : "（可多選）"}
              </div>
              <div className="flex gap-2">
                <button onClick={selectAll}
                  className="text-xs text-blue-600 font-bold border border-blue-200 px-2 py-1 rounded-lg">
                  全選
                </button>
                <button onClick={clearAll}
                  className="text-xs text-gray-500 font-bold border border-gray-200 px-2 py-1 rounded-lg">
                  清除
                </button>
              </div>
            </div>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜尋射手名稱…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
              {filteredMembers.map(m => (
                <button key={m.id} onClick={() => toggleMember(m.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${
                    selMembers.has(m.id)
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

          {/* ── 類別 ── */}
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <div className="text-xs font-black text-gray-500 tracking-wider uppercase">類別</div>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => { setCategory(c.id); setSelItem(null); setMsg(""); }}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-0.5 ${
                    category === c.id
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300"
                  }`}>
                  <span className="text-base">{c.icon}</span>
                  <span className="text-[10px]">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── 選道具（金幣不需要選） ── */}
          {category !== "coins" && (
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
          )}

          {/* ── 數量 + 執行 ── */}
          <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
            <div className="text-xs font-black text-gray-500 whitespace-nowrap">
              {category === "coins" ? "金幣數" : "數量"}
            </div>
            <button onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-9 h-9 rounded-full bg-gray-100 font-black text-gray-700 text-lg flex items-center justify-center flex-shrink-0">−</button>
            <span className="w-12 text-center font-black text-xl text-gray-800">{qty}</span>
            <button onClick={() => setQty(q => Math.min(9999, q + 1))}
              className="w-9 h-9 rounded-full bg-gray-100 font-black text-gray-700 text-lg flex items-center justify-center flex-shrink-0">+</button>
            {(category === "coins" ? [100, 500, 1000] : [5, 10, 20]).map(n => (
              <button key={n} onClick={() => setQty(n)}
                className="px-2.5 py-1 text-xs bg-gray-100 rounded-lg text-gray-500 font-bold hover:bg-gray-200">
                {n}
              </button>
            ))}
            <button onClick={doGive}
              disabled={selMembers.size === 0 || (category !== "coins" && !selItem) || qty < 1 || giving}
              className="ml-auto px-5 py-2.5 bg-blue-600 text-white font-black rounded-xl text-sm disabled:opacity-40 active:scale-95 transition-transform">
              {giving ? "發放中…" : "✅ 發放"}
            </button>
          </div>

          {/* ── 結果訊息 ── */}
          {msg && (
            <div className={`p-4 rounded-xl text-sm font-bold ${
              msg.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
            }`}>
              {msg}
            </div>
          )}

          {/* ── 資料修正面板（單選時顯示） ── */}
          {singleSel && (
            <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black text-gray-500 tracking-wider uppercase">
                  📊 {singleSel.nickname || singleSel.name} 的資料修正
                </div>
                <button onClick={() => loadFixData(singleSel.id)}
                  className="text-xs text-blue-600 font-bold border border-blue-200 px-2 py-1 rounded-lg">
                  🔄 重新讀取
                </button>
              </div>

              {fixLoading && <div className="text-sm text-gray-400">讀取中…</div>}

              {fixFrags && (
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-black text-pink-600">✨ 章碎片</div>
                  {FRAGMENTS.map(f => (
                    <div key={f.id} className="flex items-center gap-2">
                      <span className="text-base">{f.icon}</span>
                      <span className="text-xs text-gray-600 flex-1">{f.name}</span>
                      <input type="number" min="0" max="999"
                        value={fixFrags[f.id] ?? 0}
                        onChange={e => setFixFrags(prev => ({ ...prev, [f.id]: e.target.value }))}
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center font-black focus:outline-none focus:border-pink-400"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 mt-1">
                    <button onClick={saveFrags} disabled={fixSaving}
                      className="flex-1 py-2 bg-pink-500 text-white font-black rounded-xl text-sm disabled:opacity-40">
                      {fixSaving ? "儲存中…" : "💾 儲存碎片"}
                    </button>
                    <button onClick={resetAllFrags} disabled={fixSaving}
                      className="px-3 py-2 bg-gray-100 text-gray-600 font-black rounded-xl text-sm disabled:opacity-40">
                      🗑️ 全清零
                    </button>
                  </div>
                </div>
              )}

              {fixBadges && (
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-black text-amber-600">🏅 徽章數量</div>
                  {[
                    { field:"fatCat",      level:"bronze", label:"🐱 肥貓銅章" },
                    { field:"fatCat",      level:"silver", label:"🐱 肥貓銀章" },
                    { field:"score",       level:"bronze", label:"⭐ 積分銅章" },
                    { field:"score",       level:"silver", label:"⭐ 積分銀章" },
                    { field:"achievement", level:"silver", label:"🏆 成就銀章" },
                    { field:"achievement", level:"gold",   label:"🏆 成就金章" },
                  ].map(({ field, level, label }) => (
                    <div key={`${field}_${level}`} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 flex-1">{label}</span>
                      <input type="number" min="0" max="99"
                        defaultValue={fixBadges[field]?.[level] ?? 0}
                        onBlur={e => saveBadge(field, level, e.target.value)}
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center font-black focus:outline-none focus:border-amber-400"
                      />
                      <span className="text-xs text-gray-400">失焦儲存</span>
                    </div>
                  ))}
                </div>
              )}

              {fixMsg && (
                <div className={`text-sm font-bold ${fixMsg.startsWith("✅") ? "text-emerald-700" : "text-red-600"}`}>
                  {fixMsg}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
