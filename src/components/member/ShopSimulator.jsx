// src/components/member/ShopSimulator.jsx — 貓貓村商店販售模擬器（場景式遊戲 UI）
// 玩家用村資源製作販售商品 → 擺上攤位 → NPC 貓顧客光顧購買 → 賺 🎟️ 票券 →
// 兌換真實獎勵 / 投資商店成長。v2 全面遊戲化：店鋪門面、木架陳列、排隊顧客、全動畫回饋。
import { useState, useEffect, useMemo } from "react";
import {
  sfxSuccess, sfxTap, sfxVillageExchange,
  sfxCoinDrop, sfxShopBuy, sfxDoorOpen, sfxLevelUp, sfxVictoryFanfare, sfxGachaReveal, sfxNotify,
} from "../../lib/sound";
import {
  SHOP_GOODS, getGoodById, GOODS_CATEGORIES, TIER_LABELS, TIER_NAMES,
} from "../../lib/shopGoodsCatalog";
import {
  normalizeShop, calcShopRate, calcShopCap, calcShopSlots, calcWaitingVisitors,
  getLevelProgress, getLevelReward, FURNITURE_DEFS, getFurniturePrice,
  SHOP_EXCHANGE_REWARDS, SHOP_CUSTOMERS, getExchangeUsed, getExchangeRemaining,
} from "../../lib/villageShop";
import {
  initVillageShopIfNeeded, craftShopGood, arrangeShopDisplay, serveShop,
  buyShopFurniture, exchangeTicketsForReward,
} from "../../lib/villageShopDb";

// ── 遊戲風配色 ─────────────────────────────────────────────
const C = {
  brown:    "#5C3D2E",
  mid:      "#9B7B6A",
  muted:    "#C4A899",
  sage:     "#6B8E5E",
  gold:     "#D4933A",
  goldLt:   "#F2C14E",
  cream:    "#FFF8EC",
  woodDk:   "#5E3518",
  wood:     "#8B5A2B",
  woodLt:   "#B07A3E",
  night:    "linear-gradient(180deg,#2E2340 0%,#4A3460 45%,#6E4A38 100%)",
};
const RES_EMOJI = { ore:'⛏️', melon:'🌿', fish:'🐟', meat:'🥩', driedfish:'🐠', can:'🥫', potion:'🍵', fur:'🐾' };
const RES_CN = { ore:'礦物', melon:'瓜瓜', fish:'鮮魚', meat:'動物肉', driedfish:'小魚乾', can:'貓罐頭' };
const TIER_BG = {
  1:{ bg:"rgba(100,116,139,0.12)", border:"rgba(100,116,139,0.4)",  color:"#64748b", glow:"rgba(100,116,139,0.35)" },
  2:{ bg:"rgba(37,99,235,0.12)",   border:"rgba(37,99,235,0.4)",    color:"#2563eb", glow:"rgba(37,99,235,0.35)" },
  3:{ bg:"rgba(124,58,237,0.12)",  border:"rgba(124,58,237,0.4)",   color:"#7c3aed", glow:"rgba(124,58,237,0.35)" },
  4:{ bg:"rgba(234,88,12,0.12)",   border:"rgba(234,88,12,0.4)",    color:"#ea580c", glow:"rgba(234,88,12,0.35)" },
  5:{ bg:"rgba(220,38,38,0.12)",   border:"rgba(220,38,38,0.4)",    color:"#dc2626", glow:"rgba(220,38,38,0.4)" },
};
const MASCOT = "/cats/portraits/meimei.webp"; // 店貓立繪

// 遊戲風 3D 按鈕
const btn3d = (bg, shadow = "rgba(60,35,15,0.4)", text = "#FFF8F0") => ({
  background: bg,
  color: text,
  border: "none",
  borderRadius: 12,
  boxShadow: `0 4px 0 ${shadow}, 0 6px 14px rgba(40,20,5,0.35)`,
  transition: "transform .12s ease, box-shadow .12s ease, filter .15s ease",
  cursor: "pointer",
});
const btn3dPressed = { transform: "translateY(3px)", boxShadow: "0 1px 0 rgba(60,35,15,0.4), 0 2px 6px rgba(40,20,5,0.3)" };

export default function ShopSimulator({ memberId, resources, coins, village, onChange }) {
  const shop = useMemo(() => normalizeShop(village?.shop), [village?.shop]);
  const [tab, setTab] = useState("stall");
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [serveResult, setServeResult] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [slotPicker, setSlotPicker] = useState(null);
  const [toast, setToast] = useState(null);
  const [mascotSay, setMascotSay] = useState("歡迎光臨喵喵商店！今天想賣什麼好呢？");

  useEffect(() => {
    if (memberId && !village?.shop) {
      initVillageShopIfNeeded(memberId, village).then(() => onChange?.()).catch(() => {});
    }
    // eslint-disable-line
  }, [memberId]); // eslint-disable-line

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const waiting = useMemo(() => calcWaitingVisitors(shop, Date.now()), [shop, tick]); // eslint-disable-line
  const levelInfo = useMemo(() => getLevelProgress(shop.stats?.totalRevenue || 0), [shop]);
  const rate = useMemo(() => calcShopRate(shop.furniture, shop.level), [shop]);
  const cap  = useMemo(() => calcShopCap(shop.furniture, shop.level), [shop]);
  const slots = useMemo(() => calcShopSlots(shop.furniture), [shop]);
  const tickets = shop.tickets || 0;
  const discovered = new Set(shop.stats?.discoveredCustomers || []);

  // 店貓小語（隨狀態輪播提示；stock 變化也要重算）
  const stockTotal = useMemo(() => stockCount(shop), [shop.stock]);
  useEffect(() => {
    const lines = waiting > 0
      ? ["門口有顧客在等了，快拉鈴開店！", "今天的客人看起來很餓～準備好商品了嗎？"]
      : (stockTotal > 0
          ? ["休息一下～顧客過陣子就會聞香而來。", "把料理擺上檯面，賣得會更好喔！", "高級商品擺前面，富商貓才會上門！"]
          : ["先去廚房做點商品吧，空攤位沒有貓會來啦！", "製作商品要消耗村莊資源＋金幣，記得去收資源！"]);
    setMascotSay(lines[Math.floor(Math.random() * lines.length)]);
    // eslint-disable-line
  }, [waiting, stockTotal]); // eslint-disable-line

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  // ── 開門營業 ─────────────────────────────────────────────
  async function handleServe() {
    if (busy || !memberId || waiting === 0) return;
    sfxDoorOpen();
    setBusy(true);
    try {
      const res = await serveShop(memberId, village);
      if (res?.ok) {
        setServeResult(res.result);
        if (res.result.newLevel > res.result.oldLevel) {
          sfxLevelUp();
          setTimeout(() => sfxVictoryFanfare(), 350);
          setLevelUp(res.result);
        } else if (res.result.served > 0) {
          sfxNotify();
          setTimeout(() => { sfxCoinDrop(); }, 200);
        }
        if (res.result.newCustomers?.length) {
          setTimeout(() => sfxGachaReveal(true), 400);
          showToast(`✨ 新顧客光臨：${res.result.newCustomers.join("、")}`);
        }
        onChange?.();
      }
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function handleCraft(good, count) {
    if (busy || !memberId) return;
    setBusy(true);
    sfxVillageExchange();
    try {
      const res = await craftShopGood(memberId, good.id, count);
      if (res?.ok) {
        showToast(`✅ 製作 ${good.name} ×${res.added ?? res.count}（庫存 ${res.stock}）`);
        sfxSuccess();
        onChange?.();
      }
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function applyPlacement(idx, goodId) {
    if (!memberId) return;
    const base = shop.display.map(d => ({ slot: d.slot || "counter", goodId: d.goodId || null }));
    while (base.length < slots) base.push({ slot: "counter", goodId: null });
    base[idx] = { ...base[idx], goodId };
    sfxTap();
    try {
      await arrangeShopDisplay(memberId, base);
      onChange?.();
    } catch (e) { alert(e.message); }
    setSlotPicker(null);
  }

  async function handleBuyFurniture(fid) {
    if (busy || !memberId) return;
    const price = getFurniturePrice(fid, shop.furniture?.[fid] || 0);
    if (price <= 0) return;
    if ((tickets || 0) < price) { alert(`票券不足（需 ${price.toLocaleString()}）`); return; }
    setBusy(true);
    sfxShopBuy();
    try {
      const res = await buyShopFurniture(memberId, fid);
      if (res?.ok) { showToast(`🛠️ ${FURNITURE_DEFS[fid].name} 升到 Lv.${res.level}！`); sfxSuccess(); onChange?.(); }
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function handleExchange(reward, count = 1) {
    if (busy || !memberId) return;
    setBusy(true);
    sfxShopBuy();
    try {
      const res = await exchangeTicketsForReward(memberId, reward.id, count);
      if (res?.ok) { showToast(`🎁 兌換 ${reward.label} ×${res.count}`); sfxSuccess(); onChange?.(); }
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  const stockList = useMemo(() => SHOP_GOODS.filter(g => (shop.stock?.[g.id] || 0) > 0), [shop.stock]);

  const baseDisplay = useMemo(() => {
    const base = shop.display.map(d => ({ slot: d.slot || "counter", goodId: d.goodId || null }));
    while (base.length < slots) base.push({ slot: "counter", goodId: null });
    return base;
  }, [shop.display, slots]);

  const displayGoods = useMemo(() => baseDisplay.map(d => ({ ...d, good: d.goodId ? getGoodById(d.goodId) : null })), [baseDisplay]);

  // 排隊顧客（從已解鎖顧客池抽 emoji，最多顯示 6 位）
  const queueEmojis = useMemo(() => {
    const pool = SHOP_CUSTOMERS.filter(c => c.unlockLevel <= shop.level);
    const arr = [];
    for (let i = 0; i < Math.min(waiting, 6); i++) {
      arr.push(pool[(i * 7 + tick) % pool.length]);
    }
    return arr;
  }, [waiting, shop.level, tick]); // eslint-disable-line

  const tabs = [
    ["stall", "🏪", "攤位"], ["craft", "🍳", "製作"], ["exchange", "🎁", "兌換"], ["growth", "📈", "成長"], ["dex", "🐱", "圖鑑"],
  ];

  return (
    <div className="shop-root">
      <style>{`
        @keyframes spFloat   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes spFloat2  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
        @keyframes spSway    { 0%,100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg); } }
        @keyframes spBell    { 0%,100% { transform: rotate(0); } 20% { transform: rotate(-14deg); } 40% { transform: rotate(12deg); } 60% { transform: rotate(-8deg); } 80% { transform: rotate(6deg); } }
        @keyframes spWalkIn  { 0% { opacity:0; transform: translateX(70px) scale(0.6); } 60% { opacity:1; transform: translateX(-6px) scale(1.08); } 100% { opacity:1; transform: translateX(0) scale(1); } }
        @keyframes spPop     { 0% { opacity:0; transform: scale(0.8) translateY(10px); } 100% { opacity:1; transform: scale(1) translateY(0); } }
        @keyframes spTicket  { 0% { opacity:0; transform: translateY(8px) scale(0.7); } 25% { opacity:1; transform: translateY(-4px) scale(1.15); } 100% { opacity:0; transform: translateY(-34px) scale(1); } }
        @keyframes spBump    { 0% { transform: scale(1); } 35% { transform: scale(1.28); } 100% { transform: scale(1); } }
        @keyframes spPulse   { 0%,100% { box-shadow: 0 4px 0 rgba(120,70,20,.55), 0 0 0 0 rgba(242,193,78,.55); } 50% { box-shadow: 0 4px 0 rgba(120,70,20,.55), 0 0 0 14px rgba(242,193,78,0); } }
        @keyframes spSparkle { 0%,100% { opacity: 0.15; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes spShake   { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        @keyframes spShine   { 0% { background-position: -120% 0; } 100% { background-position: 220% 0; } }
        @keyframes spBob     { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes spToast   { 0% { opacity:0; transform: translateY(-8px) scale(0.9); } 100% { opacity:1; transform: translateY(0) scale(1); } }
        .sp-float   { animation: spFloat 3s ease-in-out infinite; }
        .sp-float2  { animation: spFloat2 4s ease-in-out infinite; }
        .sp-sway    { animation: spSway 5s ease-in-out infinite; transform-origin: top center; }
        .sp-bell    { animation: spBell 1s ease-in-out; transform-origin: top center; }
        .sp-walk-in { animation: spWalkIn .55s ease-out both; }
        .sp-pop     { animation: spPop .3s ease-out both; }
        .sp-ticket  { animation: spTicket 1.3s ease-out both; }
        .sp-bump    { animation: spBump .4s ease-out; }
        .sp-pulse   { animation: spPulse 1.6s ease-out infinite; }
        .sp-sparkle { animation: spSparkle 2.2s ease-in-out infinite; }
        .sp-shake   { animation: spShake .4s ease-in-out; }
        .sp-bob     { animation: spBob 1.8s ease-in-out infinite; }
        .sp-toast   { animation: spToast .25s ease-out both; }
        .sp-shine { position: relative; overflow: hidden; }
        .sp-shine::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background-image: linear-gradient(110deg, transparent 28%, rgba(255,255,255,.38) 50%, transparent 72%); background-size: 220% 100%; animation: spShine 2.6s linear infinite; }
        .sp-btn3d:active { transform: translateY(3px) !important; box-shadow: 0 1px 0 rgba(60,35,15,.4), 0 2px 6px rgba(40,20,5,.3) !important; }
      `}</style>

      {/* ══════════════ 場景：店鋪門面 ══════════════ */}
      <div className="relative overflow-hidden rounded-3xl mb-3"
        style={{ background: C.night, border: "2px solid #3A2A18", boxShadow: "inset 0 0 40px rgba(0,0,0,.45), 0 6px 18px rgba(60,30,5,.35)" }}>
        {/* 星空 */}
        {[[8,18],[22,30],[38,14],[56,26],[72,12],[85,32],[93,16],[15,42],[46,44],[64,40],[30,52],[80,48]].map(([x,y],i) => (
          <span key={i} className="sp-sparkle absolute rounded-full" style={{ left:`${x}%`, top:`${y}%`, width:4, height:4, background:"#FFF3C4", boxShadow:"0 0 6px #FFF3C4", animationDelay:`${i * 0.3}s` }} />
        ))}
        <div className="absolute inset-0 opacity-30" style={{ background:"radial-gradient(ellipse at 50% 115%, #F2C14E 0%, transparent 55%)" }} />

        {/* 遮陽棚 */}
        <div className="relative mx-2 mt-3" style={{ zIndex: 2 }}>
          <div className="sp-sway relative h-7 rounded-t-lg overflow-hidden"
            style={{ background:"repeating-linear-gradient(90deg,#C0392B 0 26px,#FFF8EC 26px 52px)", border:"2px solid #8E2B1F", boxShadow:"0 3px 8px rgba(0,0,0,.4)" }}>
            <div className="absolute -bottom-2 left-0 right-0 flex justify-center gap-0">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} style={{ width: 24, height: 10, background:"#C0392B", borderBottomLeftRadius: 12, borderBottomRightRadius: 12, border:`1px solid #8E2B1F`, flexShrink: 0 }} />
              ))}
            </div>
          </div>
          {/* 招牌 */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10">
            <div className="sp-float2 relative px-4 py-2 rounded-lg text-center min-w-[132px]"
              style={{ background:"linear-gradient(180deg,#B07A3E,#7C4A2D)", border:"3px solid #5E3518", boxShadow:"0 4px 0 #4A2A12, 0 8px 16px rgba(0,0,0,.4)" }}>
              <div className="text-[15px] font-black leading-none text-amber-100" style={{ textShadow:"0 2px 0 rgba(60,30,10,.6)" }}>🐾 喵喵商店</div>
              <div className="mt-1 flex justify-center gap-0.5 text-[10px]">
                {Array.from({ length: Math.min(5, Math.ceil(shop.level / 6)) }).map((_, i) => <span key={i}>⭐</span>)}
                <span className="ml-1 text-[9px] font-black text-amber-200">Lv.{shop.level}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 櫃檯與店貓 */}
        <div className="relative px-4 pb-3 pt-2 flex items-end gap-3" style={{ zIndex: 1 }}>
          {/* 等待顧客群 */}
          <div className="flex items-end gap-1.5 pb-1 min-w-[86px]">
            {queueEmojis.length === 0 ? (
              <span className="text-[9px] font-bold text-white/60 pb-2">暫無顧客</span>
            ) : (
              queueEmojis.map((c, i) => (
                <span key={i} className="sp-bob inline-block text-xl" style={{ animationDelay: `${i * 0.22}s`, filter: "drop-shadow(0 3px 3px rgba(0,0,0,.5))" }}>{c.emoji}</span>
              ))
            )}
            {waiting > 6 && <span className="text-[9px] font-black text-amber-200 pb-1">+{waiting - 6}</span>}
          </div>

          {/* 櫃檯 */}
          <div className="flex-1 relative">
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-10 w-44">
              <div className="sp-float2 relative">
                <div className="sp-pop rounded-full bg-white px-2.5 py-1 text-center"
                  style={{ border:"2px solid #D4933A", boxShadow:"0 3px 8px rgba(0,0,0,.35)" }}>
                  <span className="text-[9px] font-black text-[#5C3D2E] leading-tight block">{mascotSay}</span>
                </div>
                <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-0 h-0" style={{ borderLeft:"7px solid transparent", borderRight:"7px solid transparent", borderTop:"8px solid white" }} />
              </div>
            </div>
            <img src={MASCOT} alt="店貓" className="relative mx-auto w-16 h-16 object-cover rounded-full"
              style={{ border:"3px solid #F2C14E", boxShadow:"0 4px 10px rgba(0,0,0,.45)", zIndex: 1 }} />
            <div className="relative h-7 -mt-1 rounded-t-xl" style={{ background:"repeating-linear-gradient(90deg,#8B5A2B 0 34px,#6B3E1F 34px 68px)", border:"2px solid #4A2A12", boxShadow:"0 5px 0 #3A2210" }}>
              <div className="absolute inset-0 flex items-center justify-around text-[13px] opacity-90">
                <span className="sp-float" style={{ animationDelay:"0s" }}>🍪</span>
                <span className="sp-float" style={{ animationDelay:".6s" }}>🍵</span>
                <span className="sp-float" style={{ animationDelay:"1.2s" }}>🐟</span>
              </div>
            </div>
          </div>

          {/* 拉鈴開店按鈕 */}
          <button disabled={busy || waiting === 0} onClick={handleServe}
            className={`sp-btn3d relative flex flex-col items-center justify-center w-[74px] h-[74px] rounded-full shrink-0 ${waiting > 0 ? "sp-pulse" : ""}`}
            style={btn3d(waiting > 0 ? "linear-gradient(160deg,#F6C453,#DE9A2E)" : "rgba(255,255,255,0.18)", waiting > 0 ? "rgba(150,90,25,0.55)" : "rgba(0,0,0,0.3)", waiting > 0 ? "#5C3D2E" : "rgba(255,255,255,0.55)")}>
            <span className="sp-bell text-2xl" style={{ animationPlayState: waiting > 0 ? "running" : "paused" }}>🔔</span>
            <span className="text-[9px] font-black mt-0.5">{busy ? "結算中" : waiting > 0 ? `開店×${waiting}` : "休息中"}</span>
          </button>
        </div>

        {/* 底部石板地面 */}
        <div className="relative h-6" style={{ background:"repeating-linear-gradient(90deg,#5A4630 0 40px,#4C3A28 40px 80px)", borderTop:"3px solid #3A2A18" }} />
      </div>

      {/* ══════════════ 遊戲風統計徽章 ══════════════ */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <div className="rounded-xl py-1.5 text-center" style={{ background:"rgba(255,255,255,.85)", border:"2px solid #D4933A", boxShadow:"0 3px 0 rgba(180,140,60,.5)" }}>
          <div key={Math.floor(tickets)} className="sp-bump text-[13px] font-black tabular-nums" style={{ color:"#B8860B" }}>🎟️ {Math.floor(tickets).toLocaleString()}</div>
          <div className="text-[8px] font-bold text-[#9B7B6A] mt-0.5">票券</div>
        </div>
        <div className="rounded-xl py-1.5 text-center" style={{ background:"rgba(255,255,255,.85)", border:"2px solid #E0CDB5", boxShadow:"0 3px 0 rgba(180,150,110,.4)" }}>
          <div className="text-[13px] font-black" style={{ color:"#5C3D2E" }}>🏪 Lv.{shop.level}</div>
          <div className="text-[8px] font-bold text-[#9B7B6A] mt-0.5">商店等級</div>
        </div>
        <div className="rounded-xl py-1.5 text-center" style={{ background:"rgba(255,255,255,.85)", border:"2px solid #E0CDB5", boxShadow:"0 3px 0 rgba(180,150,110,.4)" }}>
          <div className="text-[13px] font-black tabular-nums" style={{ color:"#6B8E5E" }}>🐾 {rate.toFixed(1)}</div>
          <div className="text-[8px] font-bold text-[#9B7B6A] mt-0.5">客速/分</div>
        </div>
        <div className="rounded-xl py-1.5 text-center" style={{ background: waiting > 0 ? "rgba(242,193,78,.25)" : "rgba(255,255,255,.85)", border:`2px solid ${waiting > 0 ? "#D4933A" : "#E0CDB5"}`, boxShadow:"0 3px 0 rgba(180,150,110,.4)" }}>
          <div className="text-[13px] font-black tabular-nums" style={{ color: waiting > 0 ? "#B0672A" : "#9B7B6A" }}>🚪 {waiting}<span className="text-[9px]">/{cap}</span></div>
          <div className="text-[8px] font-bold text-[#9B7B6A] mt-0.5">等待顧客</div>
        </div>
      </div>

      {/* 即時訊息 */}
      {toast && (
        <div className="sp-toast rounded-xl px-3 py-2 mb-3 text-[11px] font-black text-center"
          style={{ background:"linear-gradient(135deg,rgba(90,158,80,.2),rgba(90,158,80,.12))", border:"1.5px solid #5A9E50", color:"#3D7A3A", boxShadow:"0 3px 10px rgba(90,158,80,.25)" }}>
          {toast}
        </div>
      )}

      {/* ══════════════ 遊戲風頁籤 ══════════════ */}
      <div className="flex gap-1 mb-3">
        {tabs.map(([id, icon, lb]) => (
          <button key={id} onClick={() => { sfxTap(); setTab(id); }}
            className={`sp-btn3d flex-1 py-1.5 rounded-xl text-center ${tab === id ? "sp-shine" : ""}`}
            style={tab === id
              ? btn3d("linear-gradient(160deg,#F2C14E,#D4933A)", "rgba(150,90,25,.5)", "#5C3D2E")
              : { ...btn3d("rgba(255,255,255,.75)", "rgba(180,150,110,.4)", "#7C6450"), fontWeight: 700 }}>
            <div className="text-base leading-none">{icon}</div>
            <div className="text-[9px] font-black mt-0.5">{lb}</div>
          </button>
        ))}
      </div>

      {/* ══════════════ 攤位：木架陳列 ══════════════ */}
      {tab === "stall" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-black text-[#5C3D2E]">🧺 商品陳列（{baseDisplay.filter(d => d.goodId).length}/{slots}）</div>
            <div className="text-[9px] font-bold text-[#9B7B6A]">點格子擺放商品</div>
          </div>

          <div className="relative rounded-2xl p-3 pt-5"
            style={{ background:"linear-gradient(180deg,#7C4A2D,#5E3518)", border:"2px solid #3A2210", boxShadow:"inset 0 4px 12px rgba(0,0,0,.4), 0 6px 16px rgba(60,30,5,.3)" }}>
            {/* 架頂 */}
            <div className="absolute top-0 left-3 right-3 h-2.5 rounded-t" style={{ background:"#8B5A2B", border:"1px solid #4A2A12" }} />
            <div className="grid grid-cols-2 gap-2.5">
              {displayGoods.map((d, i) => (
                <button key={i} onClick={() => { sfxTap(); setSlotPicker({ index: i, slot: d.slot }); }}
                  className="group relative rounded-lg overflow-hidden text-left transition-transform active:scale-95 hover:-translate-y-0.5"
                  style={{
                    background: d.good
                      ? "linear-gradient(180deg,rgba(255,250,240,.95),rgba(245,232,205,.92))"
                      : "linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,.12))",
                    border: d.good ? `2px solid ${TIER_BG[d.good.tier].border}` : "2px dashed rgba(255,255,255,.35)",
                    boxShadow: d.good ? `0 4px 0 rgba(60,30,10,.45), 0 6px 12px rgba(0,0,0,.25)` : "inset 0 0 0 1px rgba(255,255,255,.15)",
                    minHeight: 104,
                  }}>
                  {/* 架子底板 */}
                  <div className="absolute bottom-0 left-0 right-0 h-4" style={{ background:"repeating-linear-gradient(90deg,#B07A3E 0 12px,#8B5A2B 12px 24px)", borderTop:"2px solid #6B3E1F" }} />
                  {d.good ? (
                    <>
                      <div className="relative p-2 pb-5">
                        <div className="sp-float inline-block text-[34px] leading-none" style={{ animationDelay:`${i * 0.35}s`, filter:"drop-shadow(0 4px 4px rgba(60,30,10,.4))" }}>{d.good.icon}</div>
                        <div className="mt-1 text-[11px] font-black leading-tight text-[#5C3D2E]">{d.good.name}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[8px] font-black px-1 py-0.5 rounded" style={{ background:TIER_BG[d.good.tier].bg, color:TIER_BG[d.good.tier].color }}>{TIER_LABELS[d.good.tier]}</span>
                          <span className="text-[9px] font-black text-[#6B8E5E]">×{shop.stock?.[d.goodId] || 0}</span>
                        </div>
                        <div className="absolute top-1 right-1 text-[8px] font-bold text-[#9B7B6A]">{d.slot === "counter" ? "🧺檯" : "🗄️櫃"}</div>
                      </div>
                    </>
                  ) : (
                    <div className="relative py-5 flex flex-col items-center justify-center" style={{ minHeight: 104 }}>
                      <span className="text-2xl opacity-60 transition-transform group-hover:scale-125">{d.slot === "counter" ? "🧺" : "🗄️"}</span>
                      <span className="mt-1 text-[9px] font-bold text-white/70">＋ 放商品</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 庫存一覽 */}
          <div className="mt-3 rounded-2xl p-3" style={{ background:"rgba(255,255,255,.75)", border:"2px solid #E0CDB5", boxShadow:"0 3px 0 rgba(180,150,110,.4)" }}>
            <div className="text-xs font-black text-[#5C3D2E] mb-2">📦 倉庫庫存（{stockList.length} 種）</div>
            {stockList.length === 0 ? (
              <div className="text-[11px] text-center py-3 text-[#C4A899]">還沒有庫存 → 去「🍳 製作」做幾道商品上架吧！</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {stockList.map(g => (
                  <span key={g.id} className="sp-float flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                    style={{ background:TIER_BG[g.tier].bg, border:`1.5px solid ${TIER_BG[g.tier].border}`, color:TIER_BG[g.tier].color, animationDelay:`${(g.tier + stockList.indexOf(g)) * 0.15}s` }}>
                    {g.icon} {g.name} ×{shop.stock[g.id]}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ 製作：食譜書 ══════════════ */}
      {tab === "craft" && (
        <CraftPanel resources={resources} coins={coins} shop={shop} busy={busy} onCraft={handleCraft} />
      )}

      {/* ══════════════ 兌換 ══════════════ */}
      {tab === "exchange" && (
        <div>
          <div className="rounded-xl px-3 py-2 mb-3 flex items-center justify-between"
            style={{ background:"linear-gradient(135deg,rgba(184,134,11,.14),rgba(242,193,78,.1))", border:"2px solid #D4933A", boxShadow:"0 3px 0 rgba(180,140,60,.4)" }}>
            <span className="text-xs font-black text-[#8A5A1F]">🎟️ 票券餘額</span>
            <span key={Math.floor(tickets)} className="sp-bump text-base font-black tabular-nums" style={{ color:"#B8860B" }}>{Math.floor(tickets).toLocaleString()}</span>
          </div>
          <div className="text-[10px] mb-3 text-[#9B7B6A]">賣出商品賺取票券，兌換真實獎勵（每日限量）。</div>
          <div className="grid grid-cols-2 gap-2">
            {SHOP_EXCHANGE_REWARDS.map((r, i) => {
              const remain = getExchangeRemaining(shop, r.id);
              const can = remain > 0 && (tickets || 0) >= r.price;
              return (
                <div key={r.id} className="relative rounded-2xl p-2.5 overflow-hidden"
                  style={{ background:"linear-gradient(180deg,#FFF8EC,#F5E4C4)", border:`2px solid ${can ? "#D4933A" : "#D8C4B0"}`, boxShadow:"0 4px 0 rgba(180,140,60,.4)" }}>
                  <div className="sp-float inline-block text-3xl" style={{ animationDelay:`${i * 0.3}s`, filter:"drop-shadow(0 3px 3px rgba(60,30,10,.3))" }}>{r.icon}</div>
                  <div className="mt-1 text-[11px] font-black text-[#5C3D2E] leading-tight">{r.label}</div>
                  <div className="text-[8px] font-bold text-[#9B7B6A] mt-0.5">🎟️ {r.price}・今日剩 <span style={{ color: remain > 0 ? "#6B8E5E" : "#C0533A" }}>{remain}/{r.dailyLimit}</span></div>
                  <button disabled={!can || busy} onClick={() => handleExchange(r)}
                    className={`sp-btn3d w-full mt-2 py-1.5 rounded-lg text-[10px] font-black ${can ? "sp-shine" : ""}`}
                    style={btn3d(can ? "linear-gradient(160deg,#7CBF70,#5A9E50)" : "rgba(216,196,176,.6)", can ? "rgba(50,110,45,.5)" : "rgba(160,140,110,.35)", can ? "#fff" : "#A89070")}>
                    {busy ? "…" : "兌換"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════ 成長：商店翻修 ══════════════ */}
      {tab === "growth" && (
        <div>
          {/* 等級進度 */}
          <div className="rounded-2xl p-3 mb-3" style={{ background:"linear-gradient(180deg,#2E2340,#4A3460)", border:"2px solid #D4933A", boxShadow:"0 4px 0 rgba(150,90,25,.5)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-amber-100">🏪 商店等級 Lv.{shop.level}</span>
              <span className="text-[9px] font-bold tabular-nums text-amber-200/80">
                {Math.floor(shop.stats?.totalRevenue || 0).toLocaleString()}
                {levelInfo.next ? ` / ${levelInfo.next.toLocaleString()}` : "（滿級）"}
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background:"rgba(0,0,0,.45)", border:"1px solid rgba(255,255,255,.2)" }}>
              <div className="h-full rounded-full sp-shine transition-all" style={{ width:`${levelInfo.pct}%`, background:"linear-gradient(90deg,#DE9A2E,#F6C453)" }} />
            </div>
            <div className="text-[9px] font-bold mt-1.5 text-amber-200/70">
              {levelInfo.next ? `再 ${Math.max(0, levelInfo.next - Math.floor(shop.stats?.totalRevenue || 0)).toLocaleString()} 營業額升到 Lv.${levelInfo.level + 1}` : "已達最高等級！"}
            </div>
            {levelInfo.next && (
              <div className="mt-2 flex flex-wrap gap-1">
                {[levelInfo.level + 1, levelInfo.level + 2, levelInfo.level + 3].filter(lv => lv <= 30).map(lv => {
                  const r = getLevelReward(lv);
                  return (
                    <span key={lv} className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                      style={{ background:"rgba(242,193,78,.15)", border:"1px solid rgba(242,193,78,.4)", color:"#F2C14E" }}>
                      Lv{lv}: {r?.speed ? `+${r.speed}%速` : ""}{r?.cap ? `+${r.cap}格` : ""}{r?.customer ? `・${r.customer}` : ""}{r?.milestone ? `・${r.milestone}` : ""}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-xs font-black text-[#5C3D2E] mb-2">🗄️ 店鋪家具（10 階成長）</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(FURNITURE_DEFS).map(f => {
              const cur = shop.furniture?.[f.id] || 0;
              const nextPrice = getFurniturePrice(f.id, cur);
              const maxed = nextPrice <= 0;
              const can = !maxed && (tickets || 0) >= nextPrice;
              return (
                <div key={f.id} className="rounded-2xl p-2.5"
                  style={{ background:"linear-gradient(180deg,#FFF8EC,#F5E4C4)", border:"2px solid #E0CDB5", boxShadow:"0 3px 0 rgba(180,150,110,.4)" }}>
                  <div className="flex items-center gap-2">
                    <span className="sp-float text-2xl" style={{ animationDelay:`${(cur % 5) * .4}s` }}>{f.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-black text-[#5C3D2E]">{f.name}</div>
                      <div className="text-[8px] font-bold text-[#9B7B6A] leading-tight">{f.effect}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-1">
                    <div className="text-[9px] font-black tabular-nums text-[#5C3D2E]">{cur}<span className="text-[#9B7B6A]">/{f.maxLevel}</span></div>
                    <button disabled={maxed || !can || busy} onClick={() => handleBuyFurniture(f.id)}
                      className={`sp-btn3d px-2.5 py-1.5 rounded-lg text-[9px] font-black ${can ? "sp-shine" : ""}`}
                      style={btn3d(maxed ? "rgba(107,142,94,.25)" : can ? "linear-gradient(160deg,#F6C453,#DE9A2E)" : "rgba(216,196,176,.6)", maxed ? "rgba(60,90,50,.3)" : can ? "rgba(150,90,25,.5)" : "rgba(160,140,110,.35)", maxed ? "#6B8E5E" : can ? "#5C3D2E" : "#A89070")}>
                      {maxed ? "已滿級 ✓" : `🎟️ ${nextPrice.toLocaleString()}`}
                    </button>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background:"rgba(180,150,110,.35)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width:`${(cur / f.maxLevel) * 100}%`, background:"linear-gradient(90deg,#6B8E5E,#8FBE7F)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════ 圖鑑：拍立得 ══════════════ */}
      {tab === "dex" && (
        <div>
          <div className="rounded-xl px-3 py-2 mb-3 flex items-center justify-between"
            style={{ background:"linear-gradient(135deg,rgba(212,147,58,.14),rgba(242,193,78,.1))", border:"2px solid #D4933A", boxShadow:"0 3px 0 rgba(180,140,60,.4)" }}>
            <span className="text-xs font-black text-[#8A5A1F]">🐱 顧客圖鑑</span>
            <span className="text-xs font-black text-[#5C3D2E]">{discovered.size} / {SHOP_CUSTOMERS.length}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SHOP_CUSTOMERS.map((c, i) => {
              const met = discovered.has(c.id);
              const unlocked = c.unlockLevel <= shop.level;
              const tierColor = c.tier === "legend" ? "#D4933A" : c.tier === "rare" ? "#7C9BD4" : "#C4A899";
              return (
                <div key={c.id} className="rounded-lg p-1.5 pb-2 text-center transition-transform hover:-translate-y-1"
                  style={{
                    background:"linear-gradient(180deg,#FFFEFA,#F3EAD8)",
                    border:`2px solid ${met ? tierColor : "#D8C4B0"}`,
                    boxShadow: met ? `0 3px 0 ${tierColor}, 0 4px 10px rgba(60,30,5,.18)` : "0 2px 0 rgba(180,150,110,.3)",
                    opacity: met || unlocked ? 1 : 0.6,
                  }}>
                  <div className="text-[26px] leading-none py-1">{met ? c.emoji : unlocked ? "❓" : "🔒"}</div>
                  <div className="text-[9px] font-black leading-tight text-[#5C3D2E]">{met ? c.name : unlocked ? "？？？" : `Lv.${c.unlockLevel}`}</div>
                  <div className="text-[7px] font-bold text-[#9B7B6A] mt-0.5">
                    {c.tier === "legend" ? "🌟傳說" : c.tier === "rare" ? "✨稀有" : "🐱常見"}・{c.group}
                  </div>
                  {met && <div className="text-[8px] leading-tight mt-1 italic text-[#6B8E5E]">「{c.line}」</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 擺放選擇 Modal ── */}
      {slotPicker && (
        <div className="fixed inset-0 z-[220] flex items-end justify-center" style={{ background:"rgba(40,20,5,.6)", backdropFilter:"blur(2px)" }}
          onClick={() => setSlotPicker(null)}>
          <div className="sp-pop w-full max-w-sm rounded-t-3xl overflow-hidden"
            style={{ background:"linear-gradient(180deg,#FFF8EC,#F5E4C4)", border:"2px solid #8B5A2B", maxHeight:"80vh", overflowY:"auto" }}
            onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-4 pb-1 text-sm font-black text-[#5C3D2E]">
              {slotPicker.slot === "counter" ? "🧺 檯面" : "🗄️ 櫃子"}・第 {slotPicker.index + 1} 格
            </div>
            <div className="px-4 py-2 text-[10px] text-[#9B7B6A]">選擇要擺上的商品（庫存會被顧客購買）</div>
            <div className="px-4 pb-4">
              <div className="flex flex-col gap-1.5 max-h-[46vh] overflow-y-auto pr-1">
                <button onClick={() => applyPlacement(slotPicker.index, null)}
                  className="sp-btn3d rounded-xl px-3 py-2 text-left text-[11px] font-bold"
                  style={{ ...btn3d("rgba(192,83,58,.12)", "rgba(150,60,35,.35)", "#9B3A20"), border:"1.5px solid rgba(192,83,58,.4)" }}>
                  🗑️ 取下商品（清空此格）
                </button>
                {stockList.length === 0 && (
                  <div className="text-[11px] text-center py-4 text-[#C4A899]">沒有庫存，先去「🍳 製作」做幾件吧！</div>
                )}
                {stockList.map(g => (
                  <button key={g.id} onClick={() => applyPlacement(slotPicker.index, g.id)}
                    className="sp-btn3d rounded-xl px-3 py-2 text-left flex items-center gap-2"
                    style={{ ...btn3d("rgba(255,255,255,.85)", "rgba(180,150,110,.4)", "#5C3D2E"), border:`1.5px solid ${TIER_BG[g.tier].border}` }}>
                    <span className="text-[22px]">{g.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black">{g.name}</div>
                      <div className="text-[8px] font-bold" style={{ color:TIER_BG[g.tier].color }}>{TIER_LABELS[g.tier]}・售價 {g.price} 🎟️</div>
                    </div>
                    <span className="text-[10px] font-black text-[#6B8E5E]">×{shop.stock[g.id]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 營業結果 Overlay：顧客進場 ── */}
      {serveResult && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center p-4" style={{ background:"rgba(30,18,5,.78)", backdropFilter:"blur(3px)" }}
          onClick={() => setServeResult(null)}>
          <div className="sp-pop w-full max-w-sm rounded-3xl overflow-hidden"
            style={{ background:"linear-gradient(180deg,#2E2340,#4A3460 55%,#6E4A38)", border:"2px solid #D4933A", boxShadow:"0 8px 30px rgba(0,0,0,.5)", maxHeight:"88vh", overflowY:"auto" }}
            onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-4 text-center">
              <div className="text-base font-black text-amber-100">🎉 營業結算</div>
              <div className="text-[10px] mt-0.5 text-amber-200/70">
                接待 {serveResult.served} 位・賣出 {serveResult.totalItems} 件
                {serveResult.disappointed > 0 ? `・${serveResult.disappointed} 位空手而歸` : ""}
              </div>
              <div className="my-3 rounded-2xl py-3 text-center" style={{ background:"rgba(242,193,78,.12)", border:"1.5px solid rgba(242,193,78,.4)" }}>
                <div className="text-[10px] font-bold text-amber-200/80">營業收入</div>
                <div key={serveResult.totalTickets} className="sp-bump text-2xl font-black tabular-nums" style={{ color:"#F6C453" }}>+{serveResult.totalTickets.toLocaleString()} 🎟️</div>
              </div>
            </div>
            <div className="px-4 pb-4">
              <div className="flex flex-col gap-1.5">
                {serveResult.sales.slice(0, 12).map((s, i) => (
                  <div key={i} className="sp-walk-in flex items-center gap-2 rounded-xl px-3 py-2"
                    style={{ background:"rgba(255,255,255,.09)", border:"1.5px solid rgba(255,255,255,.15)", animationDelay:`${i * 0.14}s` }}>
                    <span className="text-2xl" style={{ filter:"drop-shadow(0 2px 3px rgba(0,0,0,.4))" }}>{s.customerEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black text-amber-100">{s.customerName}</div>
                      <div className="text-[8px] font-bold truncate text-amber-100/60">
                        {s.items.slice(0, 3).map(it => `${it.goodName}×${it.qty}`).join("、")}{s.items.length > 3 ? ` 等 ${s.items.length} 件` : ""}
                      </div>
                    </div>
                    <span className="sp-ticket text-[11px] font-black shrink-0" style={{ color:"#F6C453", animationDelay:`${0.3 + i * 0.14}s` }}>+{s.tickets}</span>
                  </div>
                ))}
                {serveResult.sales.length === 0 && (
                  <div className="sp-shake text-center py-4 text-[11px] text-amber-100/70">沒有顧客購買…多擺幾件顧客喜歡的商品吧！</div>
                )}
              </div>
              <button onClick={() => setServeResult(null)}
                className="sp-btn3d w-full mt-3 py-2.5 rounded-xl text-sm font-black"
                style={btn3d("linear-gradient(160deg,#F2C14E,#D4933A)", "rgba(150,90,25,.5)", "#5C3D2E")}>
                收攤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 升級慶祝 Overlay ── */}
      {levelUp && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-4" style={{ background:"rgba(60,30,5,.85)", backdropFilter:"blur(3px)" }}
          onClick={() => setLevelUp(null)}>
          <div className="sp-pop relative w-full max-w-sm rounded-3xl overflow-hidden text-center"
            style={{ background:"linear-gradient(180deg,#FFF3D6,#F5E0B8)", border:"3px solid #D4933A", boxShadow:"0 10px 40px rgba(0,0,0,.5)" }}
            onClick={e => e.stopPropagation()}>
            {/* 彩帶星星 */}
            {[["🌟",8,"sp-bob"],[ "✨",30,"sp-float"],[ "🎉",58,"sp-bob"],[ "🎊",80,"sp-float"],[ "⭐",18,"sp-float2"],[ "💫",70,"sp-bob"],[ "🎈",92,"sp-float2"],[ "🎐",42,"sp-bob"]].map(([e,x,cls], i) => (
              <span key={i} className={`absolute text-xl ${cls}`} style={{ left:`${x}%`, top: i % 2 ? "8%" : "18%", animationDelay:`${i * 0.3}s`, opacity:.85 }}>{e}</span>
            ))}
            <div className="pt-6 text-5xl">🏪</div>
            <div className="mt-2 text-lg font-black text-[#7C4A2D]">商店升級！Lv.{levelUp.oldLevel} → Lv.{levelUp.newLevel}</div>
            <div className="text-[11px] mt-1 px-6 text-[#9A6A2F]">累計營業額 {Math.floor(levelUp.oldRevenue + levelUp.totalTickets).toLocaleString()} 🎟️</div>
            <div className="px-6 py-4 flex flex-col gap-1.5">
              {Array.from({ length: levelUp.newLevel - levelUp.oldLevel }, (_, i) => levelUp.oldLevel + 1 + i).map(lv => {
                const r = getLevelReward(lv);
                return (
                  <div key={lv} className="sp-pop rounded-xl px-3 py-2 flex items-center justify-between"
                    style={{ background:"rgba(255,255,255,.75)", border:"1.5px solid rgba(212,147,58,.45)", animationDelay:`${i * 0.12}s` }}>
                    <span className="text-xs font-black text-[#5C3D2E]">Lv.{lv}</span>
                    <span className="text-[10px] font-bold text-[#B0672A]">
                      {r?.speed ? `+${r.speed}%客速 ` : ""}{r?.cap ? `+${r.cap}上限 ` : ""}
                      {r?.customer ? `✨${r.customer}` : ""}{r?.milestone ? `🏅${r.milestone}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setLevelUp(null)}
              className="sp-btn3d w-[calc(100%-3rem)] mb-5 py-2.5 rounded-xl text-sm font-black"
              style={btn3d("linear-gradient(160deg,#F6C453,#DE9A2E)", "rgba(150,90,25,.5)", "#5C3D2E")}>
              太棒了！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 統計輔助
function stockCount(shop) {
  return Object.values(shop?.stock || {}).reduce((s, n) => s + (Number(n) || 0), 0);
}

// ═══════════════════════════════════════════════════════════
// 製作面板：食譜書風格（已解鎖翻開／未解鎖剪影＋鎖）
// ═══════════════════════════════════════════════════════════
function CraftPanel({ resources, coins, shop, busy, onCraft }) {
  const [cat, setCat] = useState("all");
  const [tier, setTier] = useState(0);
  const [craftMode, setCraftMode] = useState(1);

  const list = useMemo(() => SHOP_GOODS.filter(g =>
    (cat === "all" || g.category === cat) && (tier === 0 || g.tier === tier)
  ), [cat, tier]);

  const level = shop.level || 1;
  const unlockedCount = SHOP_GOODS.filter(g => g.unlockLevel <= level).length;

  return (
    <div>
      {/* 食譜書標頭 */}
      <div className="rounded-2xl p-3 mb-3 relative overflow-hidden"
        style={{ background:"linear-gradient(160deg,#7C4A2D,#5E3518)", border:"2px solid #3A2210", boxShadow:"0 4px 0 rgba(60,30,10,.4)" }}>
        <div className="absolute inset-0 opacity-20" style={{ background:"radial-gradient(ellipse at 20% 0%, #F6C453 0%, transparent 50%)" }} />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-sm font-black text-amber-100">📖 食譜書</div>
            <div className="text-[9px] font-bold text-amber-200/70 mt-0.5">已解鎖 {unlockedCount}/120・升等翻開新食譜</div>
          </div>
          <div className="text-2xl sp-sway">📖</div>
        </div>
        {/* 分類 */}
        <div className="relative flex gap-1 mt-2 flex-wrap">
          {[["all","全部"], ...GOODS_CATEGORIES.map(c => [c.id, `${c.icon} ${c.label}`])].map(([id, lb]) => (
            <button key={id} onClick={() => { sfxTap(); setCat(id); }}
              className={`sp-btn3d px-2.5 py-1 rounded-lg text-[9px] font-black ${cat === id ? "sp-shine" : ""}`}
              style={btn3d(cat === id ? "linear-gradient(160deg,#F2C14E,#D4933A)" : "rgba(255,255,255,.18)", cat === id ? "rgba(150,90,25,.5)" : "rgba(0,0,0,.3)", cat === id ? "#5C3D2E" : "#FFE9C4")}>
              {lb}
            </button>
          ))}
        </div>
        {/* T 級 filter */}
        <div className="relative flex gap-1 mt-2 flex-wrap">
          {[0,1,2,3,4,5].map(t => (
            <button key={t} onClick={() => { sfxTap(); setTier(t); }}
              className={`sp-btn3d px-2 py-1 rounded-lg text-[9px] font-black`}
              style={btn3d(tier === t ? (t ? TIER_BG[t].color : "#5C3D2E") : "rgba(255,255,255,.15)", tier === t ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.25)", tier === t ? "#fff" : "#FFE9C4")}>
              {t === 0 ? "全部" : `${TIER_LABELS[t]} ${TIER_NAMES[t]}`}
            </button>
          ))}
        </div>
      </div>

      {/* 製作次數 */}
      <div className="flex gap-1.5 mb-3">
        {[[1,"×1"],[5,"×5"],[10,"×10"],["max","MAX"]].map(([value, lb]) => (
          <button key={value} onClick={() => setCraftMode(value)}
            className={`sp-btn3d flex-1 py-1.5 rounded-lg text-[10px] font-black ${craftMode === value ? "sp-shine" : ""}`}
            style={btn3d(craftMode === value ? "linear-gradient(160deg,#7CBF70,#5A9E50)" : "rgba(255,255,255,.7)", craftMode === value ? "rgba(50,110,45,.5)" : "rgba(180,150,110,.35)", craftMode === value ? "#fff" : "#7C6450")}>
            {lb}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 items-stretch">
        {list.map(g => {
          const unlocked = g.unlockLevel <= level;
          if (!unlocked) {
            return (
              <div key={g.id} className="rounded-lg p-2 min-w-0 flex flex-col items-center justify-center text-center"
                style={{ background:"linear-gradient(180deg,rgba(180,160,130,.22),rgba(160,140,110,.14))", border:"2px dashed rgba(140,110,80,.5)", minHeight: 168 }}>
                <div className="relative text-3xl mb-1 opacity-50">📖</div>
                <div className="text-[10px] font-black text-[#A89070]">？？？</div>
                <div className="text-[8px] font-bold mt-1 px-1 py-0.5 rounded-full" style={{ background:"rgba(140,110,80,.2)", color:"#8A7050" }}>🔒 商店 Lv.{g.unlockLevel} 解鎖</div>
              </div>
            );
          }
          const haveStock = shop.stock?.[g.id] || 0;
          const max = Math.min(
            99 - haveStock,
            ...g.recipe.map(r => Math.floor((resources?.[`${r.resource}_t${r.tier}`] || 0) / r.count)),
            Math.floor((coins || 0) / (g.gold || 1)),
          );
          const count = craftMode === "max" ? Math.max(0, max) : Math.min(craftMode, Math.max(0, max));
          const canCraft = count > 0;
          const tierC = TIER_BG[g.tier];
          return (
            <div key={g.id} className="rounded-lg p-2 min-w-0 h-full flex flex-col transition-transform hover:-translate-y-0.5"
              style={{ background:"linear-gradient(180deg,#FFFEFA,#F3EAD8)", border:`2px solid ${tierC.border}`, boxShadow:`0 3px 0 ${tierC.glow}, 0 4px 10px rgba(60,30,5,.12)` }}>
              <div className="flex items-start gap-1.5 mb-1 min-w-0">
                <span className="sp-float inline-block text-[26px]" style={{ animationDelay:`${g.id.length * 0.1}s`, filter:"drop-shadow(0 3px 3px rgba(60,30,10,.25))" }}>{g.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] leading-tight font-black break-words text-[#5C3D2E]">{g.name}</div>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <span className="text-[8px] leading-none font-bold px-1 py-0.5 rounded" style={{ background:tierC.bg, color:tierC.color }}>{TIER_LABELS[g.tier]} {TIER_NAMES[g.tier]}</span>
                    <span className="text-[8px] font-black text-[#6B8E5E]">庫存 {haveStock}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[9px] font-black mb-1 px-0.5">
                <span style={{ color:"#B8860B" }}>售 {g.price}🎟️</span>
                <span style={{ color:"#B8860B" }}>🪙 {g.gold}</span>
              </div>
              <div className="flex flex-col gap-1 mb-2">
                {g.recipe.map(r => {
                  const key = `${r.resource}_t${r.tier}`;
                  const have = Math.floor(resources?.[key] || 0);
                  const need = r.count * Math.max(1, count);
                  const ok = have >= need;
                  return (
                    <div key={key} className="flex items-center justify-between gap-1 px-1.5 py-1 rounded text-[8px] font-bold min-w-0"
                      style={{ background: ok ? "rgba(90,158,80,.1)" : "rgba(192,83,58,.08)", border:`1px solid ${ok ? "rgba(90,158,80,.3)" : "rgba(192,83,58,.25)"}`, color: ok ? "#6B8E5E" : "#C0533A" }}>
                      <span className="truncate min-w-0">{RES_EMOJI[r.resource]} {RES_CN[r.resource]}T{r.tier}</span>
                      <span className="shrink-0">{need}/{have}</span>
                    </div>
                  );
                })}
              </div>
              <button disabled={!canCraft || busy} onClick={() => onCraft(g, Math.max(1, count))}
                className={`sp-btn3d w-full min-h-9 mt-auto px-1 py-1.5 rounded-lg text-[10px] leading-tight font-black ${canCraft ? "sp-shine" : ""}`}
                style={btn3d(canCraft ? "linear-gradient(160deg,#7CBF70,#5A9E50)" : "rgba(216,196,176,.6)", canCraft ? "rgba(50,110,45,.5)" : "rgba(160,140,110,.35)", canCraft ? "#fff" : "#A89070")}>
                {busy ? "製作中…" : canCraft ? `製作 ×${Math.max(1, count)}` : haveStock >= 99 ? "庫存已滿" : "材料不足"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
