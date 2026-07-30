import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  shopBuyEquip, shopBuyProduct, shopRecycleMaterial, shopUpgradeMaterial,
  subscribeEquipItems, subscribeMaterials,
} from "../../lib/db";
import { EQUIP_SLOT_DEFS } from "../../lib/constants";
import {
  getDailyShopProducts, getMaterialSupplyProducts, getWeeklyShopProducts,
  getShopDailyKey, getShopPeriodKey, getShopWeeklyKey, getMaterialUpgradePlan,
} from "../../lib/shopData";
import { MATERIALS } from "../../lib/monsterMaterials";

const EQUIP_PRICE = { atk:200, def:180, hp:150 };
const RARITY = {
  common:"#94a3b8", uncommon:"#4ade80", rare:"#60a5fa", epic:"#c084fc", legendary:"#fbbf24",
};
const TABS = [
  ["today", "☀️ 今日補給"], ["materials", "📦 素材補給"], ["weekly", "💎 每週珍寶"],
  ["equip", "⚔️ 新手裝備"], ["workshop", "🛠️ 素材工坊"],
];

function remainingTime(period) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(24, 0, 0, 0);
  if (period === "week") {
    const days = (8 - now.getDay()) % 7 || 7;
    target.setDate(now.getDate() + days);
  }
  const ms = Math.max(0, target - now);
  const hours = Math.floor(ms / 3600000);
  return period === "week" ? `${Math.floor(hours / 24)}天 ${hours % 24}小時` : `${hours}小時 ${Math.floor(ms / 60000) % 60}分`;
}

function ProductCard({ product, coins, purchased, held, busy, onBuy }) {
  const soldOut = purchased >= product.limit;
  const capped = product.holdCap && held >= product.holdCap;
  const color = RARITY[product.rarity] || RARITY.common;
  const highValue = product.price >= 15000;
  return (
    <article className="flex min-h-64 flex-col rounded-2xl border bg-slate-900/75 p-3 shadow-lg"
      style={{ borderColor:`${color}55` }}>
      <div className="relative -mx-1 -mt-1 mb-2 h-28 overflow-hidden rounded-xl border border-white/10 bg-slate-950">
        <img src={product.art || "/ui/coin-shop/shop-header-v1.webp"} alt=""
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
        <span className="absolute bottom-2 left-2 rounded-lg bg-black/55 px-2 py-1 text-2xl backdrop-blur" aria-hidden="true">{product.icon}</span>
        <span className="absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-black backdrop-blur" style={{ color, background:`${color}33` }}>
          剩餘 {Math.max(0, product.limit - purchased)}/{product.limit}
        </span>
      </div>
      <h3 className="mt-2 text-sm font-black text-white">{product.name}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{product.effect}</p>
      <div className="mt-2 space-y-1 text-[10px] text-slate-500">
        <div>放入：{product.destination}</div>
        {product.holdCap && <div>持有：{held}/{product.holdCap}</div>}
        <div>{product.desc}</div>
      </div>
      <button type="button" disabled={busy || soldOut || capped || coins < product.price}
        onClick={() => {
          if (!highValue || window.confirm(`確認花費 ${product.price.toLocaleString()} 金幣購買「${product.name}」？`)) onBuy(product.id);
        }}
        className="mt-auto min-h-11 rounded-xl bg-yellow-400 px-2 text-xs font-black text-slate-950 transition-colors hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-100 disabled:bg-slate-700 disabled:text-slate-500">
        {soldOut ? "本期已達上限" : capped ? "持有已滿" : coins < product.price
          ? `還差 ${(product.price - coins).toLocaleString()}` : `🪙 ${product.price.toLocaleString()} 購買`}
      </button>
    </article>
  );
}

export default function CoinShop() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("today");
  const [items, setItems] = useState([]);
  const [materials, setMaterials] = useState({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  const [, tick] = useState(0);

  useEffect(() => subscribeEquipItems(setItems), []);
  useEffect(() => profile?.id ? subscribeMaterials(profile.id, setMaterials) : undefined, [profile?.id]);
  useEffect(() => {
    const timer = setInterval(() => tick(value => value + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const daily = getDailyShopProducts();
  const supply = getMaterialSupplyProducts();
  const weekly = getWeeklyShopProducts();
  const coins = Math.floor(profile?.coins || 0);
  const purchases = profile?.coinShopPurchases || {};
  const special = profile?.specialItems || {};
  const dailyKey = getShopDailyKey();
  const weeklyKey = getShopWeeklyKey();
  const spending = profile?.coinShopSpending || {};
  const todaySpent = spending.dailyKey === dailyKey ? spending.dailySpent || 0 : 0;
  const weekSpent = spending.weeklyKey === weeklyKey ? spending.weeklySpent || 0 : 0;
  const itemBySlot = useMemo(() => items.reduce((map, item) => {
    if (!map[item.slotId]) map[item.slotId] = [];
    map[item.slotId].push(item);
    return map;
  }, {}), [items]);

  function toast(text, ok = true) {
    setNotice({ text, ok });
    setTimeout(() => setNotice(null), 3200);
  }
  async function run(key, action, success) {
    if (!profile?.id || busy) return;
    setBusy(key);
    const result = await action();
    setBusy("");
    toast(result.ok ? success(result) : result.reason, result.ok);
  }
  const buyProduct = id => run(id, () => shopBuyProduct(profile.id, id), result =>
    result.family ? `購買成功，獲得隨機族系素材箱` : result.runeType ? `購買成功，獲得${{ atk:"攻擊", def:"防禦", hp:"生命" }[result.runeType]}符文碎片 ×5` : "購買成功");
  const bought = product => purchases[getShopPeriodKey(product)]?.[product.id] || 0;
  const held = product => product.ticketId ? special[product.ticketId] || 0 : 0;

  return (
    <div className="min-h-full bg-slate-950 pb-24 text-white">
      <header className="sticky top-0 z-20 overflow-hidden border-b border-amber-200/20 bg-slate-950 px-4 py-3">
        <img src="/ui/coin-shop/shop-header-v1.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/35 via-slate-950/75 to-slate-950" />
        <div className="relative flex items-start justify-between gap-3">
          <div><h1 className="font-black">🏪 金幣商店</h1><p className="mt-0.5 text-[10px] text-slate-500">商品固定販售，限購次數按期重置</p></div>
          <div className="rounded-xl border border-yellow-300/25 bg-yellow-400/10 px-3 py-1 text-lg font-black text-yellow-300">🪙 {coins.toLocaleString()}</div>
        </div>
        <div className="relative mt-3 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-lg bg-white/5 px-2 py-1.5">今日已花 {todaySpent.toLocaleString()}・{remainingTime("day")}重置</div>
          <div className="rounded-lg bg-white/5 px-2 py-1.5">本週已花 {weekSpent.toLocaleString()}・{remainingTime("week")}重置</div>
        </div>
        <button type="button" onClick={() => document.querySelector('[data-inventory-tab="special"]')?.click()}
          className="relative mt-2 min-h-9 w-full rounded-lg border border-indigo-300/20 bg-indigo-950/65 text-xs font-black text-indigo-100 backdrop-blur">
          🎟️ 特殊道具：單人 {special.soloBattleTicket || 0}・組隊 {special.partyBattleTicket || 0}・骰子 {special.boardDiceTicket || 0}
        </button>
        <nav className="relative mt-3 flex gap-2 overflow-x-auto pb-1">
          {TABS.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)}
            className={`min-h-11 flex-none rounded-xl px-3 text-xs font-black ${tab === id ? "bg-yellow-400 text-slate-950" : "bg-slate-800 text-slate-300"}`}>{label}</button>)}
        </nav>
      </header>

      <main className="p-4">
        {(tab === "today" || tab === "materials" || tab === "weekly") && (
          <div className="grid grid-cols-2 gap-2.5">
            {(tab === "today" ? daily : tab === "materials" ? supply : weekly).map(product =>
              <ProductCard key={product.id} product={product} coins={coins} purchased={bought(product)}
                held={held(product)} busy={Boolean(busy)} onBuy={buyProduct} />)}
          </div>
        )}

        {tab === "equip" && (
          <div className="space-y-3">
            <p className="rounded-xl bg-blue-400/10 p-3 text-xs text-blue-100">只販售尚未裝備的基礎槽位，價格維持 150～200 金幣，讓新玩家快速成形。</p>
            <div className="grid grid-cols-2 gap-2.5">
              {EQUIP_SLOT_DEFS.filter(slot => !profile?.rpgEquip?.[slot.id]?.itemId && itemBySlot[slot.id]?.length).map(slot => {
                const item = itemBySlot[slot.id][0];
                const price = EQUIP_PRICE[slot.stat];
                return <article key={slot.id} className="rounded-2xl border border-white/10 bg-slate-900 p-3">
                  <div className="text-3xl">{slot.icon}</div><h3 className="mt-2 text-sm font-black">{slot.name}</h3>
                  <p className="mt-1 text-[11px] text-slate-400">{item.name}・普通品級</p>
                  <button type="button" disabled={Boolean(busy) || coins < price}
                    onClick={() => run(`equip-${slot.id}`, () => shopBuyEquip(profile.id, slot.id, item.id, price), () => "裝備已購買並裝上")}
                    className="mt-3 min-h-11 w-full rounded-xl bg-yellow-400 text-xs font-black text-slate-950 disabled:opacity-40">🪙 {price} 購買</button>
                </article>;
              })}
            </div>
            {!EQUIP_SLOT_DEFS.some(slot => !profile?.rpgEquip?.[slot.id]?.itemId && itemBySlot[slot.id]?.length) &&
              <div className="rounded-2xl border border-dashed border-white/15 py-12 text-center text-sm text-slate-500">所有基礎槽位都已完成</div>}
          </div>
        )}

        {tab === "workshop" && (
          <div className="space-y-3">
            <p className="rounded-xl bg-emerald-400/10 p-3 text-xs text-emerald-100">回收：每日最多 20 個 T1～T3。升級：5 個同族素材換 1 個下一階，全部兌換仍會保留 5 個。</p>
            {MATERIALS.filter(mat => /_m[1-5]$/.test(mat.id) && (materials[mat.id] || 0) > 0).map(mat => {
              const owned = materials[mat.id] || 0;
              const tier = Number(mat.id.match(/_m([1-5])$/)?.[1]);
              const all = getMaterialUpgradePlan(mat.id, owned, "all");
              const recycled = profile?.coinShopRecycle?.[dailyKey] || 0;
              const recycleAmount = tier <= 3 ? Math.min(5, owned, 20 - recycled) : 0;
              return <article key={mat.id} className="rounded-2xl border border-white/10 bg-slate-900 p-3">
                <div className="flex items-center gap-3"><span className="text-3xl">{mat.icon}</span><div><h3 className="text-sm font-black">{mat.name}</h3><p className="text-[11px] text-slate-400">持有 {owned}・升級後保留 5</p></div></div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[1, 5, "all"].map(count => {
                    const plan = getMaterialUpgradePlan(mat.id, owned, count);
                    return <button key={count} type="button" disabled={Boolean(busy) || !plan?.exchanges}
                      onClick={() => window.confirm(`將消耗 ${plan.consume} 個，獲得 ${plan.output} 個下一階素材，並至少保留 ${plan.keep} 個。確定兌換？`)
                        && run(`up-${mat.id}`, () => shopUpgradeMaterial(profile.id, mat.id, count), result => `升級完成：獲得 ${result.plan.output} 個下一階素材`)}
                      className="min-h-11 rounded-xl bg-violet-500 px-1 text-[10px] font-black disabled:bg-slate-700">
                      {count === "all" ? `全部 ${all?.exchanges || 0}次` : `${count}次`}
                    </button>;
                  })}
                  <button type="button" disabled={Boolean(busy) || recycleAmount <= 0}
                    onClick={() => run(`re-${mat.id}`, () => shopRecycleMaterial(profile.id, mat.id, recycleAmount), result => `回收獲得 ${result.earned} 金幣`)}
                    className="min-h-11 rounded-xl bg-emerald-500 px-1 text-[10px] font-black text-slate-950 disabled:bg-slate-700 disabled:text-slate-500">回收 {recycleAmount}</button>
                </div>
              </article>;
            })}
          </div>
        )}
      </main>
      {notice && <div className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border px-4 py-2 text-sm font-bold shadow-xl ${notice.ok ? "border-emerald-300 bg-emerald-900" : "border-red-300 bg-red-900"}`}>{notice.text}</div>}
    </div>
  );
}
