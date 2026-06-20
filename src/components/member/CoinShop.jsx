// src/components/member/CoinShop.jsx — 金幣商店
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { shopBuyEquip, shopBuyConsumable, subscribeEquipItems } from "../../lib/db";
import { EQUIP_SLOT_DEFS, EQUIP_GRADES } from "../../lib/constants";
import { GRADE_PREFIX } from "../../lib/equipData";

// ── 裝備定價 ────────────────────────────────────────────────
const EQUIP_PRICE = { atk: 200, def: 180, hp: 150 };

// ── 消耗品定義 ───────────────────────────────────────────────
const CONSUMABLES = [
  {
    id: "chest_iron",
    name: "鐵寶箱",
    icon: "🧰",
    price: 120,
    desc: "普通＋稀有材料各 1~2 個，15% 掉藥水",
    type: "chest",
    payload: { chestType: "iron" },
    badge: "",
  },
  {
    id: "chest_gold",
    name: "黃金寶箱",
    icon: "🎁",
    price: 350,
    desc: "前三階段材料各 1~3 個，20% 掉藥水",
    type: "chest",
    payload: { chestType: "gold" },
    badge: "熱門",
  },
  {
    id: "mat_pack_s",
    name: "材料包（小）",
    icon: "🪨",
    price: 80,
    desc: "直接獲得 3 個普通材料",
    type: "material",
    payload: { materialIds: ["ghost_m1", "mountain_m1", "insect_m1"] },
    badge: "",
  },
  {
    id: "mat_pack_m",
    name: "材料包（中）",
    icon: "💎",
    price: 220,
    desc: "直接獲得 2 個稀有材料",
    type: "material",
    payload: { materialIds: ["ghost_m3", "mountain_m3"] },
    badge: "",
  },
  {
    id: "potion_chest",
    name: "藥水箱",
    icon: "🧪",
    price: 150,
    desc: "隨機獲得 1 瓶藥水（機率依稀有度調整）",
    type: "chest",
    payload: { chestType: "potion" },
    badge: "",
  },
];

// ── 裝備選牌 Modal ───────────────────────────────────────────
function EquipBuyModal({ slotDef, onBuy, onClose, buying, equipped, items }) {
  const [selected, setSelected] = useState(equipped?.itemId || null);
  const price    = EQUIP_PRICE[slotDef.stat];
  const hasEquip = !!equipped?.itemId;
  const curGrade = equipped?.grade;
  const curPlus  = equipped?.plusLevel ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
      onClick={onClose}>
      <div className="w-full max-w-md bg-slate-900 rounded-t-2xl p-4 pb-8"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{slotDef.icon}</span>
            <div>
              <div className="font-black text-white">{slotDef.name}</div>
              <div className="text-xs text-slate-400">
                {hasEquip
                  ? `已裝備 · 重新選牌不影響品級`
                  : `首次裝備 · 起始【普通】品級`}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 text-xl">✕</button>
        </div>

        {/* 現有裝備提示 */}
        {hasEquip && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-slate-800 text-xs text-slate-400">
            目前：<span className="font-black" style={{ color: EQUIP_GRADES.find(g => g.id === curGrade)?.color }}>
              {GRADE_PREFIX[curGrade]}{items.find(i => i.id === equipped.itemId)?.name}
            </span>
            {curPlus > 0 && ` +${curPlus}`}
          </div>
        )}

        {/* 品項列表 */}
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-4">
          {items.map(item => (
            <button key={item.id}
              onClick={() => setSelected(item.id)}
              className={`text-left rounded-xl p-3 border transition-all ${
                selected === item.id
                  ? "bg-indigo-900/40 border-indigo-400"
                  : "bg-slate-800 border-slate-700 hover:border-slate-500"
              }`}>
              <div className="font-bold text-white text-sm">{item.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">{item.brand} · {item.desc}</div>
              {selected === item.id && (
                <div className="text-[10px] text-indigo-400 mt-1 font-black">✓ 已選擇</div>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-slate-400">
            {hasEquip ? "更換品項" : "購買裝備"}
          </div>
          <div className="text-lg font-black text-yellow-400">🪙 {price.toLocaleString()}</div>
        </div>

        <button
          onClick={() => selected && onBuy(slotDef.id, selected, price)}
          disabled={!selected || buying}
          className="w-full py-3 rounded-xl bg-yellow-500 text-slate-900 font-black text-sm disabled:opacity-40 active:scale-95 transition-transform">
          {buying ? "購買中…" : selected ? `確認購買 · 🪙${price}` : "請先選擇品項"}
        </button>
      </div>
    </div>
  );
}

// ── 主元件 ──────────────────────────────────────────────────
export default function CoinShop() {
  const { profile } = useAuth();
  const [tab,        setTab]        = useState("equip"); // equip | consume
  const [modal,      setModal]      = useState(null);    // slotDef | null
  const [buying,     setBuying]     = useState(false);
  const [msg,        setMsg]        = useState("");
  const [rawItems,   setRawItems]   = useState([]);

  useEffect(() => subscribeEquipItems(setRawItems), []);

  // { slotId: [...items] }
  const itemsMap = rawItems.reduce((acc, item) => {
    if (!acc[item.slotId]) acc[item.slotId] = [];
    acc[item.slotId].push(item);
    return acc;
  }, {});

  const coins    = profile?.coins    || 0;
  const rpgEquip = profile?.rpgEquip || {};

  function showMsg(text, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(""), 3000);
  }

  async function handleBuyEquip(slotId, itemId, price) {
    if (!profile?.id || buying) return;
    setBuying(true);
    const result = await shopBuyEquip(profile.id, slotId, itemId, price);
    setBuying(false);
    setModal(null);
    if (result.ok) showMsg("✅ 購買成功！裝備已裝備至槽位");
    else showMsg(`❌ ${result.reason}`, false);
  }

  async function handleBuyConsumable(item) {
    if (!profile?.id || buying) return;
    setBuying(true);
    const result = await shopBuyConsumable(profile.id, item);
    setBuying(false);
    if (result.ok) showMsg(`✅ 已購買「${item.name}」`);
    else showMsg(`❌ ${result.reason}`, false);
  }

  return (
    <div className="min-h-full bg-slate-950 text-white">

      {/* 頁首 */}
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-black text-base">🏪 金幣商店</div>
            <div className="text-[11px] text-slate-500 mt-0.5">使用金幣購買裝備與道具</div>
          </div>
          <div className="flex items-center gap-1.5 bg-yellow-500/15 border border-yellow-500/30 rounded-xl px-3 py-1.5">
            <span className="text-base">🪙</span>
            <span className="font-black text-yellow-400 text-lg">{coins.toLocaleString()}</span>
          </div>
        </div>

        {/* 分頁 */}
        <div className="flex gap-2 mt-3">
          {[
            { id: "equip",   label: "⚔️ 裝備" },
            { id: "consume", label: "🧪 消耗品" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                tab === t.id
                  ? "bg-yellow-500 text-slate-900"
                  : "bg-slate-800 text-slate-400"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">

        {/* ── 裝備頁 ─────────────────────────────────────── */}
        {tab === "equip" && (
          <div className="flex flex-col gap-4">
            <div className="text-xs text-slate-500 leading-relaxed">
              購買裝備後立即裝備至對應槽位，初始為【普通】品級。
              已有裝備者可更換品牌外觀，不影響現有品級與等級。
            </div>

            {[
              { stat: "atk", label: "⚔️ 攻擊裝備",  color: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-900/10" },
              { stat: "def", label: "🛡️ 防禦裝備",  color: "text-blue-400",   border: "border-blue-500/20",   bg: "bg-blue-900/10"   },
              { stat: "hp",  label: "❤️ 生命裝備",  color: "text-green-400",  border: "border-green-500/20",  bg: "bg-green-900/10"  },
            ].map(sec => (
              <div key={sec.stat} className={`rounded-xl p-3 border ${sec.border} ${sec.bg}`}>
                <div className={`text-xs font-black mb-2.5 flex items-center justify-between ${sec.color}`}>
                  <span>{sec.label}</span>
                  <span className="text-slate-500 font-bold">
                    🪙 {EQUIP_PRICE[sec.stat]} / 件
                  </span>
                </div>
                {(() => {
                  // 槽位有品項且尚未裝備才顯示
                  const available = EQUIP_SLOT_DEFS.filter(
                    s => s.stat === sec.stat &&
                         !rpgEquip[s.id]?.itemId &&
                         (itemsMap[s.id]?.length || 0) > 0
                  );
                  const allBought = EQUIP_SLOT_DEFS
                    .filter(s => s.stat === sec.stat && (itemsMap[s.id]?.length || 0) > 0)
                    .every(s => rpgEquip[s.id]?.itemId);
                  const hasAny = EQUIP_SLOT_DEFS.some(s => s.stat === sec.stat && (itemsMap[s.id]?.length || 0) > 0);

                  if (!hasAny) {
                    return (
                      <div className="text-center py-3 text-xs text-slate-600">
                        📦 尚未上架任何品項
                      </div>
                    );
                  }
                  if (allBought) {
                    return (
                      <div className="text-center py-3 text-xs text-slate-600">
                        ✅ 此類裝備已全數購買
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {available.map(slotDef => (
                        <button key={slotDef.id}
                          onClick={() => setModal(slotDef)}
                          className="text-left rounded-xl p-2.5 bg-slate-800/70 border border-slate-700 hover:border-slate-500 transition-all active:scale-95">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span>{slotDef.icon}</span>
                            <span className="text-xs font-black text-slate-200">{slotDef.name}</span>
                          </div>
                          <div className="text-[10px] text-yellow-600 font-bold">🪙 {EQUIP_PRICE[slotDef.stat]} 購買</div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}

        {/* ── 消耗品頁 ───────────────────────────────────── */}
        {tab === "consume" && (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-slate-500">購買後立即加入背包或庫存。</div>
            {CONSUMABLES.map(item => (
              <div key={item.id}
                className="flex items-center gap-3 rounded-xl p-3.5 bg-slate-800/60 border border-slate-700">
                <span className="text-3xl shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm text-white">{item.name}</span>
                    {item.badge && (
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                        item.badge === "熱門" ? "bg-red-500/20 text-red-400" : "bg-purple-500/20 text-purple-400"
                      }`}>{item.badge}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                </div>
                <button
                  onClick={() => handleBuyConsumable(item)}
                  disabled={buying || coins < item.price}
                  className="shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-yellow-500 text-slate-900 font-black text-xs disabled:opacity-40 active:scale-95 transition-all">
                  <span>🪙{item.price}</span>
                  <span style={{ fontSize: 9 }}>購買</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 訊息 Toast */}
      {msg && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50
          text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg border
          ${msg.ok !== false ? "bg-slate-800 border-slate-600" : "bg-red-900 border-red-700"}`}>
          {msg.text}
        </div>
      )}

      {/* 裝備選購 Modal */}
      {modal && (
        <EquipBuyModal
          slotDef={modal}
          equipped={rpgEquip[modal.id] || null}
          items={itemsMap[modal.id] || []}
          onBuy={handleBuyEquip}
          onClose={() => setModal(null)}
          buying={buying}
        />
      )}
    </div>
  );
}
