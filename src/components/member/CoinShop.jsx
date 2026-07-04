// src/components/member/CoinShop.jsx — 金幣商店
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { shopBuyEquip, shopBuyProduct, shopUnlockEquipAppearance, shopRecycleMaterial, subscribeEquipItems, subscribeMaterials } from "../../lib/db";
import { EQUIP_SLOT_DEFS, EQUIP_GRADES } from "../../lib/constants";
import { GRADE_PREFIX } from "../../lib/equipData";
import { getDailyShopProducts, getWeeklyShopProduct, getShopDailyKey, getShopWeeklyKey } from "../../lib/shopData";
import { MATERIALS } from "../../lib/monsterMaterials";

// ── 裝備定價 ────────────────────────────────────────────────
const EQUIP_PRICE = { atk: 200, def: 180, hp: 150 };

const RARITY_STYLE = {
  common:"#94a3b8", uncommon:"#4ade80", rare:"#60a5fa", epic:"#c084fc", legendary:"#fbbf24",
};

function ShopProductCard({ product, coins, purchased, onBuy, buying }) {
  const soldOut = purchased >= product.limit;
  const color = RARITY_STYLE[product.rarity] || RARITY_STYLE.common;
  return (
    <article className="flex min-h-52 flex-col rounded-2xl border bg-slate-800/60 p-3"
      style={{ borderColor:`${color}55` }}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-4xl" aria-hidden="true">{product.icon}</span>
        <span className="rounded-full px-2 py-1 text-[10px] font-black"
          style={{ color, backgroundColor:`${color}20` }}>
          剩餘 {Math.max(0, product.limit - purchased)}/{product.limit}
        </span>
      </div>
      <h3 className="mt-3 break-words text-sm font-black text-white">{product.name}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{product.desc}</p>
      <div className="mt-auto pt-3">
        <div className="mb-2 text-[10px] font-bold text-slate-500">購買後放入：{product.destination}</div>
        <button type="button" onClick={() => onBuy(product.id)}
          disabled={buying || soldOut || coins < product.price}
          className="min-h-11 w-full touch-manipulation rounded-xl bg-yellow-500 px-2 text-xs font-black text-slate-950 transition-[transform,background-color] hover:bg-yellow-400 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500">
          {soldOut ? "本期已購買" : coins < product.price ? `還差 ${(product.price - coins).toLocaleString()}` : `🪙 ${product.price.toLocaleString()} 購買`}
        </button>
      </div>
    </article>
  );
}

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
  const [tab,        setTab]        = useState("today");
  const [modal,      setModal]      = useState(null);    // slotDef | null
  const [buying,     setBuying]     = useState(false);
  const [msg,        setMsg]        = useState("");
  const [rawItems,   setRawItems]   = useState([]);
  const [materials,  setMaterials]  = useState({});

  useEffect(() => subscribeEquipItems(setRawItems), []);
  useEffect(() => {
    if (!profile?.id) return undefined;
    return subscribeMaterials(profile.id, setMaterials);
  }, [profile?.id]);

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

  async function handleBuyProduct(productId) {
    if (!profile?.id || buying) return;
    setBuying(true);
    const result = await shopBuyProduct(profile.id, productId);
    setBuying(false);
    if (result.ok) showMsg(`✅ ${result.product.name}已放入${result.product.destination}`);
    else showMsg(`❌ ${result.reason}`, false);
  }

  async function handleUnlockAppearance(item) {
    if (!profile?.id || buying) return;
    setBuying(true);
    const result = await shopUnlockEquipAppearance(profile.id, item.id);
    setBuying(false);
    if (result.ok) showMsg(`✅ 已永久解鎖「${item.name}」`);
    else showMsg(`❌ ${result.reason}`, false);
  }

  async function handleRecycle(materialId, amount) {
    if (!profile?.id || buying) return;
    setBuying(true);
    const result = await shopRecycleMaterial(profile.id, materialId, amount);
    setBuying(false);
    if (result.ok) showMsg(`✅ 回收完成，獲得 ${result.earned.toLocaleString()} 金幣`);
    else showMsg(`❌ ${result.reason}`, false);
  }

  const dailyProducts = getDailyShopProducts();
  const weeklyProduct = getWeeklyShopProduct();
  const dailyKey = getShopDailyKey();
  const weeklyKey = getShopWeeklyKey();
  const purchases = profile?.coinShopPurchases || {};
  const purchasedCount = product => (purchases[product === weeklyProduct ? weeklyKey : dailyKey]?.[product.id] || 0);

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
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {[
            { id: "today",  label: "☀️ 今日精選" },
            { id: "weekly", label: "💎 每週珍寶" },
            { id: "equip",  label: "⚔️ 基本裝備" },
            { id: "looks",  label: "🎨 外觀" },
            { id: "recycle", label: "♻️ 回收" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`min-h-10 flex-none whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-black transition-colors ${
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

        {tab === "today" && (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-slate-500">全服每日同步更新；每件商品的限購次數獨立計算。</div>
            <div className="grid grid-cols-2 gap-2.5">
              {dailyProducts.map(product => (
                <ShopProductCard key={product.id} product={product} coins={coins}
                  purchased={purchasedCount(product)} onBuy={handleBuyProduct} buying={buying} />
              ))}
            </div>
          </div>
        )}

        {tab === "weekly" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-purple-400/25 bg-purple-500/10 px-3 py-2 text-xs leading-relaxed text-purple-200">
              每週一更新，全服玩家看到相同珍寶；每人每週限購 1 次。
            </div>
            <div className="mx-auto w-full max-w-xs">
              <ShopProductCard product={weeklyProduct} coins={coins}
                purchased={purchasedCount(weeklyProduct)} onBuy={handleBuyProduct} buying={buying} />
            </div>
          </div>
        )}

        {tab === "looks" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs leading-relaxed text-cyan-200">
              品牌只改變裝備名稱與外觀，不增加能力。購買一次後可永久自由切換。
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {rawItems.map(item => {
                const slot = EQUIP_SLOT_DEFS.find(entry => entry.id === item.slotId);
                const equipped = rpgEquip[item.slotId]?.itemId === item.id;
                const unlocked = equipped || profile?.unlockedEquipItems?.[item.id];
                const price = slot?.stat === "atk" ? 1500 : slot?.stat === "def" ? 1300 : 1000;
                return (
                  <article key={item.id} className="flex min-h-44 flex-col rounded-2xl border border-cyan-400/20 bg-slate-800/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-3xl" aria-hidden="true">{slot?.icon || "🛡️"}</span>
                      <span className="text-[10px] font-black text-cyan-300">{slot?.name}</span>
                    </div>
                    <h3 className="mt-2 break-words text-sm font-black text-white">{item.name}</h3>
                    <p className="mt-1 text-[10px] text-slate-400">{item.brand}</p>
                    <button type="button" onClick={() => handleUnlockAppearance(item)}
                      disabled={buying || unlocked || coins < price}
                      className="mt-auto min-h-11 rounded-xl bg-cyan-500 px-2 text-xs font-black text-slate-950 transition-colors hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:bg-slate-700 disabled:text-slate-500">
                      {unlocked ? "✓ 已永久解鎖" : coins < price ? `還差 ${(price - coins).toLocaleString()}` : `🪙 ${price.toLocaleString()} 解鎖`}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {tab === "recycle" && (() => {
          const dailyRecycled = profile?.coinShopRecycle?.[dailyKey] || 0;
          const recyclable = MATERIALS.filter(item => /_m[1-3]$/.test(item.id) && (materials[item.id] || 0) > 0);
          return (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                每日最多回收 20 個 T1～T3 素材。今日已回收 {dailyRecycled}/20。
              </div>
              {recyclable.length ? recyclable.map(material => {
                const tier = Number(material.id.match(/_m([1-3])$/)?.[1]);
                const unitPrice = { 1:10, 2:25, 3:60 }[tier];
                const count = materials[material.id] || 0;
                const amount = Math.min(5, count, 20 - dailyRecycled);
                return (
                  <article key={material.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-800/60 p-3">
                    <span className="text-3xl" aria-hidden="true">{material.icon}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-black text-white">{material.name}</h3>
                      <p className="text-xs text-slate-400">持有 {count}・每個 🪙{unitPrice}</p>
                    </div>
                    <button type="button" onClick={() => handleRecycle(material.id, amount)}
                      disabled={buying || amount <= 0}
                      className="min-h-11 rounded-xl bg-emerald-500 px-3 text-xs font-black text-slate-950 transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:bg-slate-700 disabled:text-slate-500">
                      回收 {amount} 個
                    </button>
                  </article>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-white/15 py-10 text-center text-sm text-slate-500">
                  沒有可回收的 T1～T3 素材
                </div>
              )}
            </div>
          );
        })()}
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
