import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { MATERIALS } from "../../lib/monsterMaterials";
import { POTIONS, FRAGMENTS, CHEST_TYPES } from "../../lib/itemData";
import { adminGiveItem, adminSetFragments, adminSetMemberBadge } from "../../lib/db";

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
  const { profile } = useAuth();
  const [members,   setMembers]   = useState([]);
  const [selMember, setSelMember] = useState(null);
  const [category,  setCategory]  = useState("material");
  const [selItem,   setSelItem]   = useState(null);
  const [qty,       setQty]       = useState(1);
  const [giving,    setGiving]    = useState(false);
  const [msg,       setMsg]       = useState("");
  const [search,    setSearch]    = useState("");
  const [linkTarget, setLinkTarget] = useState(null);
  const [linking,    setLinking]   = useState(false);
  const [linkMsg,    setLinkMsg]   = useState("");

  // 資料修正面板
  const [fixFrags,    setFixFrags]    = useState(null);  // { frag_fatcat_bronze: N, ... }
  const [fixBadges,   setFixBadges]   = useState(null);  // { fatCat:{bronze,silver}, score:{bronze}, achievement:{silver} }
  const [fixLoading,  setFixLoading]  = useState(false);
  const [fixMsg,      setFixMsg]      = useState("");
  const [fixSaving,   setFixSaving]   = useState(false);

  // 帳號未連結：profile.id === profile.uid 代表沒找到 members 文件
  const isUnlinked = profile?.id && profile?.uid && profile.id === profile.uid;

  useEffect(() => {
    // 不加 orderBy 避免沒有 name 欄位的文件（例如教練帳號）被 Firestore 排除
    getDocs(collection(db, "members"))
      .then(snap => {
        const list = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        list.sort((a, b) => (a.name || a.nickname || "").localeCompare(b.name || b.nickname || ""));
        setMembers(list);
      })
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

  async function doLink() {
    if (!linkTarget || !profile?.uid) return;
    setLinking(true);
    setLinkMsg("");
    try {
      await updateDoc(doc(db, "members", linkTarget.id), { uid: profile.uid });
      setLinkMsg("✅ 已連結！請重新整理頁面讓資料生效。");
    } catch (e) {
      setLinkMsg("❌ " + (e.message || "連結失敗"));
    }
    setLinking(false);
  }

  async function loadFixData(member) {
    if (!member?.id) return;
    setFixLoading(true); setFixMsg(""); setFixFrags(null); setFixBadges(null);
    try {
      const [fragSnap, memSnap] = await Promise.all([
        getDoc(doc(db, "fragmentInventory", member.id)),
        getDoc(doc(db, "members", member.id)),
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
    if (!selMember || !fixFrags) return;
    setFixSaving(true); setFixMsg("");
    const cleaned = {};
    FRAGMENTS.forEach(f => { cleaned[f.id] = Math.max(0, Number(fixFrags[f.id]) || 0); });
    const res = await adminSetFragments(selMember.id, cleaned);
    setFixMsg(res.ok ? "✅ 碎片已更新" : "❌ " + res.reason);
    setFixSaving(false);
  }

  async function saveBadge(badgeField, badgeLevel, value) {
    if (!selMember) return;
    setFixMsg("");
    const res = await adminSetMemberBadge(selMember.id, badgeField, badgeLevel, value);
    if (res.ok) {
      setFixBadges(prev => ({ ...prev, [badgeField]: { ...prev[badgeField], [badgeLevel]: Number(value) } }));
      setFixMsg("✅ 徽章已更新");
    } else { setFixMsg("❌ " + res.reason); }
  }

  async function resetAllFrags() {
    if (!selMember || !window.confirm(`確定要清零「${selMember.nickname || selMember.name}」的所有碎片嗎？`)) return;
    setFixSaving(true); setFixMsg("");
    const empty = {};
    FRAGMENTS.forEach(f => { empty[f.id] = 0; });
    const res = await adminSetFragments(selMember.id, empty);
    if (res.ok) { setFixFrags(empty); setFixMsg("✅ 碎片已全部清零"); }
    else setFixMsg("❌ " + res.reason);
    setFixSaving(false);
  }

  const filteredMembers = members.filter(m =>
    !search || (m.nickname || m.name || "").includes(search)
  );
  const items = ITEMS_BY_CAT[category] || [];

  return (
    <div className="p-4 flex flex-col gap-5 max-w-lg mx-auto pb-8">
      <div className="font-black text-xl text-gray-800">🧪 後台道具給予</div>

      {/* ── 帳號未連結警告 ─────────────────────────────────────── */}
      {isUnlinked && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex flex-col gap-3">
          <div className="font-black text-red-700 text-base">⚠️ 此教練帳號尚未連結射手資料</div>
          <div className="text-sm text-red-600">
            Firestore 找不到 uid/email 相符的 members 文件。請選擇您的射手身份，系統會自動補寫 <code className="bg-red-100 px-1 rounded">uid</code> 欄位。
          </div>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
            {members.map(m => (
              <button key={m.id} onClick={() => setLinkTarget(m)}
                className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${
                  linkTarget?.id === m.id
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-red-400"
                }`}>
                {m.nickname || m.name || m.id}
              </button>
            ))}
          </div>
          <button onClick={doLink} disabled={!linkTarget || linking}
            className="py-2.5 bg-red-600 text-white font-black rounded-xl disabled:opacity-40 active:scale-95 transition-transform">
            {linking ? "連結中…" : "🔗 連結此射手身份"}
          </button>
          {linkMsg && (
            <div className={`text-sm font-bold ${linkMsg.startsWith("✅") ? "text-emerald-700" : "text-red-600"}`}>
              {linkMsg}
            </div>
          )}
          {linkMsg.startsWith("✅") && (
            <button onClick={() => window.location.reload()}
              className="py-2 bg-gray-800 text-white font-black rounded-xl text-sm">
              🔄 重新整理頁面
            </button>
          )}
        </div>
      )}

      {/* 選射手 */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
        <div className="text-xs font-black text-gray-500 tracking-wider uppercase">射手</div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜尋射手名稱…"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        {profile?.id && (
          <button onClick={() => { const m = { id:profile.id, name: profile.nickname || profile.name || "教練" }; setSelMember(m); setMsg(""); loadFixData(m); }}
            className={`w-full py-2 rounded-xl text-sm font-black border transition-all ${
              selMember?.id === profile.id
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-400"
            }`}>
            ⚙️ 自己（教練帳號 · {profile.nickname || profile.name || profile.id}）
          </button>
        )}
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
          {filteredMembers.map(m => (
            <button key={m.id} onClick={() => { setSelMember(m); setMsg(""); loadFixData(m); }}
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

      {/* ── 資料修正面板 ──────────────────────────────────────── */}
      {selMember && (
        <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-black text-gray-500 tracking-wider uppercase">📊 資料查看 / 直接修正</div>
            <button onClick={() => loadFixData(selMember)}
              className="text-xs text-blue-600 font-bold border border-blue-200 px-2 py-1 rounded-lg">
              🔄 重新讀取
            </button>
          </div>

          {fixLoading && <div className="text-sm text-gray-400">讀取中…</div>}

          {/* 章碎片 */}
          {fixFrags && (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-black text-pink-600">✨ 章碎片（fragmentInventory）</div>
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

          {/* 徽章數量 */}
          {fixBadges && (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-black text-amber-600">🏅 徽章（members 文件）</div>
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
    </div>
  );
}
