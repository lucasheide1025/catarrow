// src/components/admin/AdminGiveTool.jsx — 獎品發放與道具微調工具
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, doc, getDoc, updateDoc, increment, query, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { MATERIALS } from "../../lib/monsterMaterials";
import { POTIONS, FRAGMENTS, CHEST_TYPES } from "../../lib/itemData";
import { COIN_CHEST_TIERS } from "../../lib/lootTable";
import { VILLAGE_PACKS } from "../../lib/villagePack";
import { EXPANSION_CARDS } from "../../lib/monsterExpansionCatalog";
import { adminGiveItem, adminSetFragments, adminSetMemberBadge, addCoins } from "../../lib/db";
import { assertCostCapability, COST_CAPABILITIES } from "../../lib/costControl";
import { fmtDT } from "../../lib/constants";
import { Card, Btn, Modal, Spinner } from "../shared/UI";
import AdminDexGrant from "./AdminDexGrant";

const CATEGORIES = [
  { id: "coins",     label: "金幣", icon: "🪙", maxLimit: 10000 },
  { id: "arrowdew",  label: "箭露", icon: "💧", maxLimit: 10000 },
  { id: "materials", label: "素材", icon: "🧪", maxLimit: 10 },
  { id: "potions",   label: "藥水", icon: "🧪", maxLimit: 10 },
  { id: "fragments", label: "碎片", icon: "🧩", maxLimit: 10 },
  { id: "chests",    label: "寶箱", icon: "🎁", maxLimit: 25 },
  { id: "cards",     label: "卡片", icon: "🃏", maxLimit: 5 },
];

const ITEMS_BY_CAT = {
  materials: MATERIALS.map(m => ({ id: m.id, name: m.name, icon: m.icon || "🧪", sub: m.rarity })),
  potions:   POTIONS.map(p =>   ({ id: p.id, name: p.name, icon: p.icon || "🧪", sub: p.rarity })),
  fragments: FRAGMENTS.map(f => ({ id: f.id, name: f.name, icon: f.icon || "🧩", sub: "" })),
  chests:    [
    ...Object.values(CHEST_TYPES).map(c => ({ id: c.id, name: c.name, icon: c.icon || "🎁", sub: "材料/特規" })),
    ...Object.entries(COIN_CHEST_TIERS).map(([key, c]) => ({ id: `coin_${key}`, name: c.name, icon: c.icon || "🪙", sub: "金幣寶箱" })),
    ...Object.values(VILLAGE_PACKS).map(p => ({ id: p.id, name: p.name, icon: p.icon || "🧱", sub: "建築包" })),
  ],
  cards:     EXPANSION_CARDS.map(c => ({ id: c.monsterId, name: `${c.name}卡片`, icon: "🃏", sub: c.tier })),
};

const RARITY_COLOR = {
  common: "#9ca3af", uncommon: "#4ade80", rare: "#60a5fa",
  epic: "#a78bfa", legendary: "#fbbf24", mythic: "#f472b6",
};

function getLoginTime(m) {
  const ts = m.lastLoginAt || m.lastCheckinAt || m.lastBookingAt || m.updatedAt || m.createdAt;
  if (!ts) return 0;
  return ts?.toMillis ? ts.toMillis() : new Date(ts).getTime();
}

export default function AdminGiveTool() {
  const { profile } = useAuth();
  const [mainTab,    setMainTab]    = useState("give");
  const [members,    setMembers]    = useState([]);
  const [selMembers, setSelMembers]  = useState(new Set());
  const [category,   setCategory]   = useState("coins");
  const [selItem,    setSelItem]    = useState(null);
  const [qty,        setQty]        = useState(""); // 預設空白讓教練自己填
  const [giving,     setGiving]     = useState(false);
  const [msg,        setMsg]        = useState("");
  const [search,     setSearch]     = useState("");
  const [confirmModal, setConfirmModal] = useState(null); // 發放二次確認彈窗

  // 單人資料修正面板
  const [fixFrags,   setFixFrags]   = useState(null);
  const [fixBadges,  setFixBadges]  = useState(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [fixMsg,     setFixMsg]     = useState("");
  const [fixSaving,  setFixSaving]  = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, "members"), limit(50)))
      .then(snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // 按照登入順序降序排列（最新登入排在最前面）
        list.sort((a, b) => getLoginTime(b) - getLoginTime(a));
        setMembers(list);
      })
      .catch(() => {});
  }, []);

  const curCatCfg = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
  const maxLimit  = curCatCfg.maxLimit;

  // 排序與搜尋過濾
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.nickname && m.nickname.toLowerCase().includes(q)) ||
        (m.archerNo && String(m.archerNo).includes(q))
      );
    });
  }, [members, search]);

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

  function selectAll() {
    setSelMembers(new Set(filteredMembers.map(m => m.id)));
    setMsg("");
  }
  function clearAll() {
    setSelMembers(new Set());
    setMsg("");
  }

  // 點擊「發放」開啟二次確認 Modal
  function handleOpenConfirm() {
    const num = Number(qty);
    if (selMembers.size === 0) {
      setMsg("❌ 請先選擇至少一位射手");
      return;
    }
    if (!qty || isNaN(num) || num <= 0) {
      setMsg("❌ 請輸入有效的發放數量");
      return;
    }
    if (category !== "coins" && category !== "arrowdew" && !selItem) {
      setMsg("❌ 請選擇發放的道具");
      return;
    }
    // 上限修訂
    const safeQty = Math.min(num, maxLimit);
    setConfirmModal({
      qty: safeQty,
      wasCapped: num > maxLimit,
    });
  }

  async function executeGive() {
    if (!confirmModal) return;
    const finalQty = confirmModal.qty;
    setConfirmModal(null);
    setGiving(true);
    setMsg("");

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
          await addCoins(memberId, finalQty);
        }
        setMsg(`✅ 已成功為 ${displayNames} 發放 🪙 金幣 × ${finalQty}`);
      } else if (category === "arrowdew") {
        for (const memberId of targets) {
          await updateDoc(doc(db, "members", memberId), { arrowdew: increment(finalQty) });
        }
        setMsg(`✅ 已成功為 ${displayNames} 發放 💧 箭露 × ${finalQty}`);
      } else if (category === "cards") {
        for (const memberId of targets) {
          await updateDoc(doc(db, "members", memberId), {
            [`monsterCards.${selItem.id}.count`]: increment(finalQty),
          });
        }
        setMsg(`✅ 已成功為 ${displayNames} 發放 🃏「${selItem.name}」× ${finalQty}`);
      } else {
        const itemCatMap = {
          materials: "material",
          potions: "potion",
          fragments: "fragment",
          chests: "chest",
        };
        const realCat = itemCatMap[category] || category;
        for (const memberId of targets) {
          await adminGiveItem(memberId, realCat, selItem.id, finalQty);
        }
        setMsg(`✅ 已成功為 ${displayNames} 發放「${selItem.icon}${selItem.name}」× ${finalQty}`);
      }

      setQty(""); // 完成後清空數量輸入框
    } catch (e) {
      setMsg("❌ 發放失敗：" + (e?.message || ""));
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

  const items = ITEMS_BY_CAT[category] || [];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 text-slate-100">
      <div className="font-black text-xl text-white flex items-center gap-2">
        🎁 獎品發放中心
      </div>

      {/* 主 Tab */}
      <div className="flex gap-2">
        {[["give","🎁 道具與資源發放"],["dex","🎖️ 圖鑑直接授予"]].map(([id,label]) => (
          <button key={id} onClick={() => setMainTab(id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition ${
              mainTab === id
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500 shadow-md"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {mainTab === "dex" ? <AdminDexGrant /> : (
        <>
          {/* ── 1. 選擇射手（卡片式網格疊好，依登入順序排列） ── */}
          <Card className="p-4 bg-slate-800/90 border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-black text-slate-400">
                1. 選擇對象射手（已依最新登入時間排序）
                {selMembers.size > 0 && <span className="text-blue-400 font-bold ml-2">已選取 {selMembers.size} 位</span>}
              </div>
              <div className="flex gap-2">
                <Btn v="secondary" size="sm" onClick={selectAll}>全選 ({filteredMembers.length})</Btn>
                <Btn v="ghost" size="sm" onClick={clearAll}>清空已選</Btn>
              </div>
            </div>

            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 搜尋射手姓名、暱稱、編號..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />

            {/* 卡片方格（一格一格疊好） */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {filteredMembers.map(m => {
                const isSelected = selMembers.has(m.id);
                const lastTime = getLoginTime(m);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? "bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10"
                        : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs truncate">{m.nickname || m.name || "未命名"}</span>
                      {isSelected && <span className="text-xs font-black text-blue-400">✓</span>}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span>{m.archerNo ? `CA-${String(m.archerNo).padStart(4,"0")}` : "一般"}</span>
                      <span>{lastTime ? fmtDT(lastTime) : "未有紀錄"}</span>
                    </div>
                  </button>
                );
              })}
              {filteredMembers.length === 0 && (
                <div className="col-span-full py-8 text-center text-slate-500 text-xs">找不到符合關鍵字的射手</div>
              )}
            </div>
          </Card>

          {/* ── 2. 七大類別選擇 ── */}
          <Card className="p-4 bg-slate-800/90 border-slate-700/80 space-y-3">
            <div className="text-xs font-black text-slate-400">2. 選擇發放類別</div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setCategory(c.id); setSelItem(null); setMsg(""); }}
                  className={`py-2 px-1 rounded-xl text-xs font-bold border transition flex flex-col items-center gap-0.5 ${
                    category === c.id
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20"
                      : "bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="text-lg">{c.icon}</span>
                  <span className="text-[11px]">{c.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* ── 3. 選擇道具（非金幣/箭露時） ── */}
          {category !== "coins" && category !== "arrowdew" && (
            <Card className="p-4 bg-slate-800/90 border-slate-700/80 space-y-3">
              <div className="text-xs font-black text-slate-400">
                3. 選擇道具（共有 {items.length} 項）
              </div>
              <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
                {items.map(item => {
                  const isSelected = selItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setSelItem(item); setMsg(""); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-emerald-600 border-emerald-500 text-white shadow-md"
                          : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600"
                      }`}
                      style={!isSelected && item.sub ? { borderLeftColor: RARITY_COLOR[item.sub], borderLeftWidth: 3 } : {}}
                    >
                      <span>{item.icon}</span>
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {/* ── 4. 數量與發放執行 ── */}
          <Card className="p-4 bg-slate-800/90 border-slate-700/80 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <span className="text-xs font-bold text-slate-300 whitespace-nowrap">
                  發放數量（上限 {maxLimit.toLocaleString()}）：
                </span>
                <input
                  type="number"
                  min="1"
                  max={maxLimit}
                  placeholder="請輸入數量…"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="w-32 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <Btn
                v="primary"
                onClick={handleOpenConfirm}
                disabled={selMembers.size === 0 || (category !== "coins" && category !== "arrowdew" && !selItem) || !qty || giving}
                className="px-6 py-2.5 font-black text-sm"
              >
                {giving ? "發放中…" : "✅ 執行發放"}
              </Btn>
            </div>

            {msg && (
              <div className={`p-3 rounded-xl text-xs font-bold ${
                msg.startsWith("✅") ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              }`}>
                {msg}
              </div>
            )}
          </Card>

          {/* ── 單人資料修正面板（單選射手時） ── */}
          {singleSel && (
            <Card className="p-4 bg-slate-800/90 border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black text-amber-400">
                  📊 {singleSel.nickname || singleSel.name} 的資料微調
                </div>
                <Btn v="ghost" size="sm" onClick={() => loadFixData(singleSel.id)}>🔄 重新讀取</Btn>
              </div>

              {fixLoading && <div className="text-xs text-slate-400">讀取中…</div>}

              {fixFrags && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-pink-400">✨ 碎片持有量</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FRAGMENTS.map(f => (
                      <div key={f.id} className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
                        <span className="text-sm">{f.icon}</span>
                        <span className="text-[11px] text-slate-300 flex-1 truncate">{f.name}</span>
                        <input
                          type="number"
                          min="0"
                          max="999"
                          value={fixFrags[f.id] ?? 0}
                          onChange={e => setFixFrags(prev => ({ ...prev, [f.id]: e.target.value }))}
                          className="w-14 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-center font-bold text-white"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Btn v="secondary" size="sm" onClick={saveFrags} disabled={fixSaving}>
                      {fixSaving ? "儲存中…" : "💾 儲存碎片"}
                    </Btn>
                    <Btn v="ghost" size="sm" onClick={() => setFixFrags(Object.fromEntries(FRAGMENTS.map(f=>[f.id,0])))}>
                      🗑️ 清零
                    </Btn>
                  </div>
                </div>
              )}

              {fixMsg && (
                <div className={`text-xs font-bold ${fixMsg.startsWith("✅") ? "text-emerald-400" : "text-rose-400"}`}>
                  {fixMsg}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* ── 發放二次確認彈窗 Modal ── */}
      {confirmModal && (
        <Modal open onClose={() => setConfirmModal(null)} title="確認發放道具與資源">
          <div className="space-y-4">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2 text-xs">
              <div className="text-slate-400 font-bold">發放對象（共 {selMembers.size} 位射手）：</div>
              <div className="text-white font-bold flex flex-wrap gap-1">
                {[...selMembers].map(id => {
                  const m = members.find(x => x.id === id);
                  return <span key={id} className="bg-slate-700 px-2 py-0.5 rounded">{m?.nickname || m?.name}</span>;
                })}
              </div>

              <div className="text-slate-400 font-bold pt-2">發放品項：</div>
              <div className="text-emerald-400 font-black text-base">
                {category === "coins" && `🪙 金幣 × ${confirmModal.qty.toLocaleString()}`}
                {category === "arrowdew" && `💧 箭露 × ${confirmModal.qty.toLocaleString()}`}
                {category !== "coins" && category !== "arrowdew" && `${selItem?.icon} ${selItem?.name} × ${confirmModal.qty}`}
              </div>

              {confirmModal.wasCapped && (
                <div className="text-amber-400 font-bold text-[11px] pt-1">
                  ⚠️ 您輸入的數量超過類別上限，已自動修訂為上限值 {confirmModal.qty}。
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Btn v="ghost" onClick={() => setConfirmModal(null)} className="flex-1">
                取消
              </Btn>
              <Btn v="primary" onClick={executeGive} disabled={giving} className="flex-1 font-black">
                {giving ? "發放中…" : "確認送出發放"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
