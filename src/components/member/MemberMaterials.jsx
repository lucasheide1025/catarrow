// src/components/member/MemberMaterials.jsx
// v3：材料庫存 + 升級系統 + 章碎片 tab + 合成銀章
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeMaterials, upgradeMaterial, subscribeFragments, craftFragment, subscribeChests, openChest, migrateOldFragments, subscribePotions, craftPotion, updateChestOpenStats } from "../../lib/db";
import { MATERIALS, RARITY_CONFIG } from "../../lib/monsterMaterials";
import { FRAGMENTS, POTIONS, openChestContents, CHEST_TYPES } from "../../lib/itemData";
import { useToast } from "../shared/UI";
import { sfxBuff, sfxEpic, sfxSuccess, sfxCast } from "../../lib/sound";

const FAMILY_CONFIG = {
  ghost:     { label: "鬼怪族",    icon: "👻", color: "#7c3aed" },
  mountain:  { label: "山林族",    icon: "🏔️", color: "#16a34a" },
  insect:    { label: "毒蟲族",    icon: "🦂", color: "#65a30d" },
  workplace: { label: "職場族",    icon: "💼", color: "#475569" },
  exam:      { label: "考試族",    icon: "📝", color: "#dc2626" },
  temple:    { label: "西方怪物族", icon: "🏰", color: "#ea580c" },
  all:       { label: "章碎片",    icon: "✨", color: "#d97706" },
};
const FAMILY_ORDER = ["ghost", "mountain", "insect", "workplace", "exam", "temple", "all"];
const TIER_ORDER   = ["common", "rare", "elite", "fierce", "boss", "mythic", "all"];
const RARITY_ORDER = ["legendary", "rare", "uncommon", "common"];

export default function MemberMaterials({ onBack }) {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();

  // ── tab ──────────────────────────────────────────────────
  const [tab, setTab] = useState("materials"); // "materials" | "fragments"

  // ── 材料庫存 ─────────────────────────────────────────────
  const [inventory,      setInventory]      = useState({});
  const [loading,        setLoading]        = useState(!!profile?.id);
  const [familyFilter,   setFamilyFilter]   = useState("all_families");
  const [confirmMat,     setConfirmMat]     = useState(null);
  const [upgrading,      setUpgrading]      = useState(false);
  const [celebrate,      setCelebrate]      = useState(null); // { from, to }

  // ── 碎片庫存 ─────────────────────────────────────────────
  const [fragments,      setFragments]      = useState({});
  const [fragLoading,    setFragLoading]    = useState(!!profile?.id);
  const [confirmFrag,    setConfirmFrag]    = useState(null);
  const [crafting,       setCrafting]       = useState(false);
  const [craftCelebrate,  setCraftCelebrate]  = useState(null); // { frag, label }
  const [potionCelebrate, setPotionCelebrate] = useState(null); // potion 物件

  // ── 寶箱庫存 ─────────────────────────────────────────────
  const [chests,       setChests]       = useState([]);
  const [chestLoading, setChestLoading] = useState(!!profile?.id);
  const [openingChest, setOpeningChest] = useState(null);
  const [openResult,   setOpenResult]   = useState(null);
  const [chestAnim,    setChestAnim]    = useState(null);

  // ── 藥水庫存 ─────────────────────────────────────────────
  const [potions,        setPotions]        = useState({});
  const [potionLoading,  setPotionLoading]  = useState(!!profile?.id);
  const [craftingPotion, setCraftingPotion] = useState(null);

  useEffect(() => {
    if (!profile?.id) return;
    migrateOldFragments(profile.id);
    const unsub = subscribeMaterials(profile.id, data => {
      setInventory(data);
      setLoading(false);
    });
    const unsubFrag = subscribeFragments(profile.id, data => {
      setFragments(data);
      setFragLoading(false);
    });
    const unsubChest = subscribeChests(profile.id, data => {
      setChests(Array.isArray(data) ? data : []);
      setChestLoading(false);
    });
    const unsubPotion = subscribePotions(profile.id, data => {
      setPotions(data);
      setPotionLoading(false);
    });
    return () => { unsub && unsub(); unsubFrag && unsubFrag(); unsubChest && unsubChest(); unsubPotion && unsubPotion(); };
  }, [profile?.id]);

  // ── 統計 ─────────────────────────────────────────────────
  const totalKinds      = MATERIALS.length;
  const ownedKinds      = MATERIALS.filter(m => (m.family === "all" ? (fragments[m.id] || 0) : (inventory[m.id] || 0)) > 0).length;
  const totalCount      = Object.values(inventory).reduce((s, v) => s + (v || 0), 0);
  const upgradableCount = MATERIALS.filter(m =>
    m.upgradesTo && (inventory[m.id] || 0) >= (m.upgradeCount || 5)
  ).length;
  const craftableCount  = FRAGMENTS.filter(f => (fragments[f.id] || 0) >= f.craftCount).length;

  // ── 工具函數 ──────────────────────────────────────────────
  const familiesToShow = familyFilter === "all_families" ? FAMILY_ORDER : [familyFilter];

  function matsOfFamily(fam) {
    return MATERIALS
      .filter(m => m.family === fam)
      .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  }

  async function doUpgrade(mat) {
    if (upgrading) return;
    setUpgrading(true);
    const res = await upgradeMaterial(profile.id, mat.id);
    setUpgrading(false);
    setConfirmMat(null);
    if (res.ok) {
      sfxSuccess();
      setCelebrate({ from: res.from, to: res.to });
    } else {
      toast(res.reason || "升級失敗，請稍後再試");
    }
  }

  async function doOpenChest(chest) {
    if (openingChest) return;
    const isCoin = chest.type === "coin";
    const cc = isCoin
      ? { icon: chest.icon || "🪙", color: chest.color || "#92400e", name: chest.name || "金幣寶箱" }
      : (CHEST_TYPES[chest.type] || CHEST_TYPES.wood);
    setOpeningChest(chest.id);
    setChestAnim({ type: chest.type, icon: cc.icon, color: cc.color, name: cc.name });
    sfxCast();
    const isBig = chest.coinTier === "fierce" || chest.coinTier === "boss" || chest.coinTier === "mythic"
      || chest.type === "gold" || chest.type === "mythic" || chest.type === "cat" || chest.type === "card_pack";
    setTimeout(isBig ? sfxEpic : sfxBuff, 700);
    await new Promise(r => setTimeout(r, 1600));
    const contents = isCoin ? null : openChestContents(chest);
    const res = await openChest(profile.id, chest.id, contents);
    setChestAnim(null);
    setOpeningChest(null);
    if (res.ok) {
      sfxSuccess();
      setOpenResult(isCoin ? { coins: res.coins } : contents);
      if (!isCoin) updateChestOpenStats(profile.id, chest.type).catch(() => {});
    } else {
      toast(res.reason || "開箱失敗，請稍後再試");
    }
  }

  async function doCraftFragment(frag) {
    if (crafting) return;
    setCrafting(true);
    const res = await craftFragment(profile.id, frag.id);
    setCrafting(false);
    setConfirmFrag(null);
    if (res.ok) {
      sfxEpic();
      setCraftCelebrate({ frag, label: res.label });
    } else {
      toast(res.reason || "合成失敗，請稍後再試");
    }
  }

  async function doCraftPotion(potion) {
    if (craftingPotion) return;
    setCraftingPotion(potion.id);
    const res = await craftPotion(profile.id, potion.id);
    setCraftingPotion(null);
    if (res.ok) {
      if (potion.rarity === "epic" || potion.rarity === "legendary") sfxEpic();
      else sfxBuff();
      setPotionCelebrate(potion);
    } else {
      toast(res.reason || "合成失敗，請稍後再試");
    }
  }

  // ── render ────────────────────────────────────────────────
  if (!profile?.id) return (
    <div className="p-4 flex flex-col gap-4">
      {onBack && <button onClick={onBack} className="text-gray-500 text-sm">← 返回</button>}
      <div className="text-center py-12 text-gray-400">
        <div className="text-4xl mb-3">🔒</div>
        <div className="font-bold">請先登入射手帳號</div>
        <div className="text-xs mt-1">背包功能需要射手身分才能使用</div>
      </div>
    </div>
  );

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />

      {/* 頂部 */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="text-gray-500 text-sm">← 返回</button>
        )}
        <div className="flex-1">
          <h2 className="text-gray-800 font-black text-xl">🎒 背包</h2>
        </div>
      </div>

      {/* 總覽卡 */}
      <div className="rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
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
        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
            style={{ width: `${ownedKinds / totalKinds * 100}%` }} />
        </div>
        <div className="mt-2 flex gap-2 flex-wrap">
          {upgradableCount > 0 && (
            <div className="bg-white/15 rounded-xl px-3 py-1.5 text-xs font-bold">
              ⬆️ {upgradableCount} 種材料可升級！
            </div>
          )}
          {craftableCount > 0 && (
            <div className="bg-pink-400/40 rounded-xl px-3 py-1.5 text-xs font-bold">
              ✨ {craftableCount} 種碎片可合成！
            </div>
          )}
        </div>
      </div>

      {/* Tab 切換 */}
      <div className="flex gap-2">
        <button onClick={() => setTab("materials")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all
            ${tab === "materials" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-500"}`}>
          🧪 材料
        </button>
        <button onClick={() => setTab("chests")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all relative
            ${tab === "chests" ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-500"}`}>
          📦 寶箱
          {chests.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
              {chests.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab("fragments")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all relative
            ${tab === "fragments" ? "bg-pink-500 text-white" : "bg-gray-100 text-gray-500"}`}>
          ✨ 碎片
          {craftableCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full text-[9px] font-black text-white flex items-center justify-center">
              {craftableCount}
            </span>
          )}
        </button>
        <button onClick={() => setTab("potions")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all
            ${tab === "potions" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-500"}`}>
          🔮 藥水
        </button>
      </div>

      {/* ══════════ 材料 tab ══════════ */}
      {tab === "materials" && (
        <div className="flex flex-col gap-4">

          {/* 升級說明 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-700 text-xs leading-relaxed">
            💡 集滿 <b>5 個</b>同一種材料，就能升級成 <b>1 個</b>更高階的材料！
          </div>

          {/* 族別篩選 */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setFamilyFilter("all_families")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all
                ${familyFilter === "all_families" ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200"}`}>
              全部
            </button>
            {FAMILY_ORDER.map(fam => {
              const cfg = FAMILY_CONFIG[fam];
              return (
                <button key={fam} onClick={() => setFamilyFilter(fam)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all
                    ${familyFilter === fam ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200"}`}>
                  {cfg.icon} {cfg.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">載入中…</div>
          ) : (
            <div className="flex flex-col gap-5">
              {familiesToShow.map(fam => {
                const cfg  = FAMILY_CONFIG[fam];
                const mats = matsOfFamily(fam);
                if (mats.length === 0) return null;
                const famOwned = mats.filter(m => (m.family === "all" ? (fragments[m.id] || 0) : (inventory[m.id] || 0)) > 0).length;

                return (
                  <section key={fam}>
                    {/* 族標題 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cfg.icon}</span>
                        <span className="font-black text-sm" style={{ color: cfg.color }}>{cfg.label}</span>
                      </div>
                      <span className="text-gray-400 text-xs font-bold">{famOwned}/{mats.length}</span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {mats.map(mat => {
                        const count      = mat.family === "all" ? (fragments[mat.id] || 0) : (inventory[mat.id] || 0);
                        const rarity     = RARITY_CONFIG[mat.rarity] || RARITY_CONFIG.common;
                        const owned      = count > 0;
                        const canChain   = !!mat.upgradesTo;
                        const need       = mat.upgradeCount || 5;
                        const canUpgrade = canChain && count >= need;
                        const nextMat    = canChain ? MATERIALS.find(m => m.id === mat.upgradesTo) : null;

                        return (
                          <div key={mat.id}
                            className={`rounded-2xl p-4 border transition-all ${owned ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${owned ? "bg-purple-50" : "bg-gray-100"}`}>
                                {owned ? mat.icon : "❓"}
                              </div>
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
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className={`font-black text-2xl ${owned ? "text-purple-600" : "text-gray-300"}`}>{count}</div>
                                <div className="text-gray-400 text-xs">個</div>
                              </div>
                            </div>

                            {/* 升級進度條（有升級鏈且持有才顯示） */}
                            {canChain && owned && nextMat && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <span className="text-gray-500 font-bold">
                                        {need} 個 → {(inventory[nextMat.id] || 0) > 0 ? `${nextMat.icon} ${nextMat.name}` : "❓ 下一階"}
                                      </span>
                                      <span className={`font-black ${canUpgrade ? "text-amber-500" : "text-gray-400"}`}>
                                        {Math.min(count, need)}/{need}
                                      </span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-500 ${canUpgrade ? "bg-amber-400" : "bg-purple-300"}`}
                                        style={{ width: `${Math.min(count / need, 1) * 100}%` }} />
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => canUpgrade && setConfirmMat(mat)}
                                    disabled={!canUpgrade}
                                    className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all
                                      ${canUpgrade ? "bg-amber-400 text-amber-900 shadow-sm active:scale-95" : "bg-gray-100 text-gray-300"}`}>
                                    ⬆️ 升級
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════ 寶箱 tab ══════════ */}
      {tab === "chests" && (
        <div className="flex flex-col gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-700 text-xs leading-relaxed">
            📦 打怪獲勝後寶箱會存入背包，點「開箱！」取得材料、藥劑或章碎片！
          </div>
          {chestLoading ? (
            <div className="text-center py-6 text-gray-400 text-sm">載入中…</div>
          ) : chests.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-5xl mb-3">📦</div>
              <div className="font-bold text-sm">目前沒有寶箱</div>
              <div className="text-xs mt-1">打怪獲勝就能拿到！</div>
            </div>
          ) : (
            chests.map((ch, idx) => {
              const isCoin = ch.type === "coin";
              const cc = isCoin
                ? { icon: ch.icon || "🪙", color: ch.color || "#92400e", name: ch.name || "金幣寶箱", desc: `開箱後獲得 ${ch.min ?? 20}–${ch.max ?? 50} 金幣` }
                : (CHEST_TYPES[ch.type] || CHEST_TYPES.wood);
              const isOpening = openingChest === ch.id;
              return (
                <div key={ch.id || idx} className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-4">
                  <div className="text-4xl">{cc.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-sm" style={{ color: cc.color }}>{cc.name}</div>
                    {ch.from && <div className="text-gray-400 text-xs mt-0.5">來自 {ch.from}</div>}
                    <div className="text-gray-300 text-xs mt-0.5 leading-snug">{cc.desc}</div>
                  </div>
                  <button
                    onClick={() => doOpenChest(ch)}
                    disabled={!!openingChest}
                    className="px-4 py-2 rounded-xl text-sm font-black text-white active:scale-95 transition-all disabled:opacity-40"
                    style={{ background: cc.color }}>
                    {isOpening ? "開箱中…" : "開箱！"}
                  </button>
                </div>
              );
            })
          )}

          {openResult && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
              onClick={() => setOpenResult(null)}>
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="text-center font-black text-xl mb-4">🎁 開箱結果！</div>
                {openResult.coins > 0 && (
                  <div className="mb-3 text-center">
                    <div className="text-amber-600 text-xs font-bold mb-2">🪙 獲得金幣</div>
                    <div className="text-amber-500 font-black text-4xl">+{openResult.coins}</div>
                  </div>
                )}
                {openResult.fragments?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-pink-600 text-xs font-bold mb-2">✨ 獲得章碎片</div>
                    <div className="flex gap-2 flex-wrap">
                      {openResult.fragments.map(f => (
                        <div key={f.id} className="text-xs px-3 py-1.5 rounded-full font-bold text-white"
                          style={{ background: f.color }}>
                          {f.icon} {f.name} ×1
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {openResult.materials?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-purple-600 text-xs font-bold mb-2">🧪 獲得材料</div>
                    <div className="flex gap-2 flex-wrap">
                      {openResult.materials.map((m, i) => (
                        <div key={i} className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full font-bold">
                          {m.icon} {m.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {openResult.potions?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-green-600 text-xs font-bold mb-2">🧪 獲得藥劑</div>
                    <div className="flex gap-2 flex-wrap">
                      {openResult.potions.map((p, i) => (
                        <div key={i} className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-bold">
                          {p.icon} {p.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {openResult.cards?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-indigo-600 text-xs font-bold mb-2">🃏 抽到的怪物卡片</div>
                    <div className="flex flex-col gap-2">
                      {openResult.cards.map((c, i) => {
                        const tierColor = { common:"#6b7280", rare:"#3b82f6", elite:"#8b5cf6", fierce:"#f59e0b", boss:"#ef4444", mythic:"#ec4899" }[c.tier] || "#6b7280";
                        const tierLabel = { common:"普通", rare:"稀有", elite:"菁英", fierce:"兇猛", boss:"首領", mythic:"神話" }[c.tier] || c.tier;
                        return (
                          <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                            <span className="text-2xl">{c.icon}</span>
                            <div className="flex-1">
                              <div className="font-bold text-gray-800 text-sm">{c.name}</div>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: tierColor }}>{tierLabel}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {!openResult.coins && !openResult.fragments?.length && !openResult.materials?.length && !openResult.potions?.length && !openResult.cards?.length && (
                  <div className="text-center text-gray-400 text-sm py-4">這次開箱什麼都沒有…</div>
                )}
                <button onClick={() => setOpenResult(null)}
                  className="w-full mt-4 py-3 rounded-2xl bg-purple-600 text-white font-black active:scale-95 transition-all">
                  收下！
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ 碎片 tab ══════════ */}
      {tab === "fragments" && (
        <div className="flex flex-col gap-3">
          <div className="bg-pink-50 border border-pink-200 rounded-xl px-3 py-2 text-pink-700 text-xs leading-relaxed">
            🐱 打怪有機率額外掉落<b>貓貓箱</b>，開箱後可能獲得章碎片！集滿 <b>10 個</b>可合成對應章。<b>碎片本身不計分</b>，合成後才算。
          </div>

          {fragLoading ? (
            <div className="text-center py-6 text-gray-400 text-sm">載入中…</div>
          ) : (
            FRAGMENTS.map(frag => {
              const count    = fragments[frag.id] || 0;
              const canCraft = count >= frag.craftCount;
              const pct      = Math.min(count / frag.craftCount, 1) * 100;
              return (
                <div key={frag.id} className="bg-white rounded-2xl p-4 border border-gray-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: frag.color + "22" }}>
                      {frag.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-sm text-gray-800">{frag.name}</div>
                      <div className="text-gray-400 text-xs mt-0.5">{frag.desc}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-2xl" style={{ color: frag.color }}>{count}</div>
                      <div className="text-gray-400 text-xs">/{frag.craftCount}</div>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: canCraft ? frag.color : frag.color + "88" }} />
                  </div>
                  <button
                    onClick={() => canCraft && setConfirmFrag(frag)}
                    disabled={!canCraft}
                    className={`w-full py-2.5 rounded-xl text-sm font-black transition-all active:scale-95
                      ${canCraft ? "text-white" : "bg-gray-100 text-gray-300"}`}
                    style={canCraft ? { background: frag.color } : {}}>
                    {canCraft ? `✨ 合成 ${frag.craftResult.label}！` : `還差 ${frag.craftCount - count} 個`}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ══════════ 藥水 tab ══════════ */}
      {tab === "potions" && (
        <div className="flex flex-col gap-3">
          <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-green-700 text-xs leading-relaxed">
            🔮 消耗怪物材料可合成藥劑！戰鬥前最多帶 <b>3 瓶</b>，被動型開戰自動生效，投擲型可手動擲出。
          </div>

          {/* 持有藥水一覽 */}
          {!potionLoading && (
            <div className="bg-white rounded-2xl p-3 border border-gray-200">
              <div className="text-gray-400 text-xs font-bold mb-2">🧴 目前持有</div>
              {POTIONS.some(p => (potions[p.id] || 0) > 0) ? (
                <div className="flex flex-wrap gap-2">
                  {POTIONS.filter(p => (potions[p.id] || 0) > 0).map(p => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-xl px-2.5 py-1.5">
                      <span>{p.icon}</span>
                      <span className="text-xs font-bold text-gray-700">{p.name}</span>
                      <span className="text-xs font-black text-green-600">×{potions[p.id]}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-300 text-xs text-center py-1">尚無藥水，合成後會顯示在這裡</div>
              )}
            </div>
          )}

          {/* 合成配方清單 */}
          {potionLoading ? (
            <div className="text-center py-6 text-gray-400 text-sm">載入中…</div>
          ) : (
            POTIONS.map(potion => {
              const owned      = potions[potion.id] || 0;
              const canCraft   = potion.recipe?.every(r => (inventory[r.id] || 0) >= r.count);
              const isCrafting = craftingPotion === potion.id;
              const RARITY_COLOR = { common:"bg-gray-100 text-gray-500", rare:"bg-blue-100 text-blue-600", epic:"bg-purple-100 text-purple-600", legendary:"bg-amber-100 text-amber-600" };
              const RARITY_LABEL = { common:"普通", rare:"稀有", epic:"史詩", legendary:"傳說" };
              return (
                <div key={potion.id}
                  className={`rounded-2xl p-3 border transition-all
                    ${canCraft ? "bg-white border-green-200" : "bg-gray-50 border-gray-100"}`}>
                  {/* 名稱 + 功效列 */}
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-2xl flex-shrink-0">{potion.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-black text-sm ${canCraft ? "text-gray-800" : "text-gray-500"}`}>{potion.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${RARITY_COLOR[potion.rarity] || RARITY_COLOR.common}`}>
                          {RARITY_LABEL[potion.rarity] || potion.rarity}
                        </span>
                        {potion.kind === "throw" && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">投擲</span>
                        )}
                      </div>
                      <div className="text-gray-400 text-[11px] mt-0.5 leading-snug">{potion.effectText}</div>
                    </div>
                    {owned > 0 && (
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-black">
                        {owned}
                      </div>
                    )}
                  </div>
                  {/* 配方材料 */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    {(potion.recipe || []).map(r => {
                      const mat    = MATERIALS.find(m => m.id === r.id);
                      const have   = inventory[r.id] || 0;
                      const enough = have >= r.count;
                      return (
                        <div key={r.id}
                          className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-lg font-bold border
                            ${enough ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-400 border-red-100"}`}>
                          <span>{mat?.icon}</span>
                          <span>{mat?.name}</span>
                          <span className="opacity-60">{have}/{r.count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => canCraft && !craftingPotion && doCraftPotion(potion)}
                    disabled={!canCraft || !!craftingPotion}
                    className={`w-full py-2 rounded-xl text-xs font-black transition-all active:scale-95
                      ${canCraft ? "bg-green-500 text-white" : "bg-gray-100 text-gray-300"}`}>
                    {isCrafting ? "合成中…" : canCraft ? `🔮 合成 ${potion.name}` : "材料不足"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── 升級確認彈窗 ───────────────────────────────────── */}
      {confirmMat && (() => {
        const nextMat = MATERIALS.find(m => m.id === confirmMat.upgradesTo);
        const need    = confirmMat.upgradeCount || 5;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
            onClick={() => !upgrading && setConfirmMat(null)}>
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-4">
                <div className="font-black text-gray-800 text-lg mb-1">⬆️ 材料升級</div>
                <div className="text-gray-400 text-xs">確定要升級嗎？升級後低階材料會消耗掉</div>
              </div>
              <div className="flex items-center justify-center gap-3 mb-5">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center text-3xl mx-auto">{confirmMat.icon}</div>
                  <div className="text-gray-600 text-xs font-bold mt-1">{confirmMat.name}</div>
                  <div className="text-red-500 text-xs font-black">−{need} 個</div>
                </div>
                <div className="text-2xl text-gray-300">➜</div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl mx-auto">{nextMat?.icon}</div>
                  <div className="text-gray-600 text-xs font-bold mt-1">{nextMat?.name}</div>
                  <div className="text-green-600 text-xs font-black">＋1 個</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmMat(null)} disabled={upgrading}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 text-sm font-black">取消</button>
                <button onClick={() => doUpgrade(confirmMat)} disabled={upgrading}
                  className="flex-1 py-3 rounded-2xl bg-amber-400 text-amber-900 text-sm font-black active:scale-95 transition-all">
                  {upgrading ? "升級中…" : "確定升級！"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 碎片合成確認彈窗 ────────────────────────────────── */}
      {confirmFrag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => !crafting && setConfirmFrag(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="font-black text-gray-800 text-lg mb-1">✨ 碎片合成</div>
              <div className="text-gray-400 text-xs">確定要合成「{confirmFrag.craftResult.label}」嗎？</div>
            </div>
            <div className="text-center mb-5">
              <div className="text-5xl mb-2">{confirmFrag.icon}</div>
              <div className="font-black text-gray-700 text-base mb-1">{confirmFrag.name} ×{confirmFrag.craftCount}</div>
              <div className="text-2xl my-2 text-gray-300">↓</div>
              <div className="inline-block px-4 py-2 rounded-2xl font-black text-white text-base"
                style={{ background: confirmFrag.color }}>
                {confirmFrag.craftResult.badgeLevel === "gold" ? "🥇" : confirmFrag.craftResult.badgeLevel === "bronze" ? "🥉" : "🥈"} {confirmFrag.craftResult.label}
              </div>
              <div className="text-gray-400 text-xs mt-2">合成後請找教練領取實體銀章！</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmFrag(null)} disabled={crafting}
                className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 text-sm font-black">取消</button>
              <button onClick={() => doCraftFragment(confirmFrag)} disabled={crafting}
                className="flex-1 py-3 rounded-2xl text-white text-sm font-black active:scale-95 transition-all"
                style={{ background: confirmFrag.color }}>
                {crafting ? "合成中…" : "確定合成！"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 升級成功動畫 ────────────────────────────────────── */}
      {celebrate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
          onClick={() => setCelebrate(null)}>
          <div className="text-center">
            <div className="text-7xl mb-3 animate-bounce">{celebrate.to.icon}</div>
            <div className="text-amber-300 font-black text-2xl mb-1">升級成功！</div>
            <div className="text-white font-bold text-lg mb-2">獲得「{celebrate.to.name}」×1</div>
            <div className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4"
              style={{
                background: (RARITY_CONFIG[celebrate.to.rarity]?.color || "#9ca3af") + "33",
                color: RARITY_CONFIG[celebrate.to.rarity]?.color || "#9ca3af",
              }}>
              {RARITY_CONFIG[celebrate.to.rarity]?.label || ""}
            </div>
            <div className="text-white/60 text-xs leading-relaxed max-w-xs mx-auto mb-6">{celebrate.to.desc}</div>
            <button onClick={() => setCelebrate(null)}
              className="px-8 py-3 rounded-full bg-white text-gray-800 text-sm font-black">太棒了！</button>
          </div>
        </div>
      )}

      {/* ── 開箱動畫 ────────────────────────────────────────── */}
      {chestAnim && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50">
          <div className="text-center select-none">
            <div className="text-9xl mb-4 animate-bounce"
              style={{ filter: `drop-shadow(0 0 24px ${chestAnim.color})` }}>
              {chestAnim.icon}
            </div>
            <div className="font-black text-2xl mb-3" style={{ color: chestAnim.color }}>
              {chestAnim.name}
            </div>
            <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
              <span className="animate-spin inline-block">✨</span>
              <span>開箱中…</span>
              <span className="animate-spin inline-block" style={{ animationDirection: "reverse" }}>✨</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 藥水合成成功動畫 ────────────────────────────────── */}
      {potionCelebrate && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-6"
          onClick={() => setPotionCelebrate(null)}>
          <div className="text-center" onClick={e => e.stopPropagation()}>
            <div className="text-8xl mb-4 animate-bounce"
              style={{ filter: `drop-shadow(0 0 20px ${RARITY_CONFIG[potionCelebrate.rarity]?.color || "#9ca3af"})` }}>
              {potionCelebrate.icon}
            </div>
            <div className="font-black text-2xl mb-1"
              style={{ color: RARITY_CONFIG[potionCelebrate.rarity]?.color || "#9ca3af" }}>
              ⚗️ 合成成功！
            </div>
            <div className="text-white font-bold text-lg mb-1">{potionCelebrate.name}</div>
            <div className="inline-block px-3 py-0.5 rounded-full text-xs font-black mb-3"
              style={{
                background: (RARITY_CONFIG[potionCelebrate.rarity]?.color || "#9ca3af") + "33",
                color: RARITY_CONFIG[potionCelebrate.rarity]?.color || "#9ca3af",
              }}>
              {RARITY_CONFIG[potionCelebrate.rarity]?.label || ""}
            </div>
            <div className="text-white/70 text-sm mb-2">{potionCelebrate.effectText}</div>
            <div className="text-white/50 text-xs mb-6">{potionCelebrate.desc}</div>
            <button onClick={() => setPotionCelebrate(null)}
              className="px-8 py-3 rounded-full bg-white text-gray-800 text-sm font-black">
              收下！
            </button>
          </div>
        </div>
      )}

      {/* ── 碎片合成成功動畫 ────────────────────────────────── */}
      {craftCelebrate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
          onClick={() => setCraftCelebrate(null)}>
          <div className="text-center">
            <div className="text-7xl mb-3 animate-bounce">
              {craftCelebrate.frag.craftResult?.badgeLevel === "gold" ? "🥇" : craftCelebrate.frag.craftResult?.badgeLevel === "bronze" ? "🥉" : "🥈"}
            </div>
            <div className="font-black text-2xl mb-1" style={{ color: craftCelebrate.frag.color }}>合成成功！</div>
            <div className="text-white font-bold text-lg mb-2">{craftCelebrate.label} 已入帳！</div>
            <div className="text-white/70 text-sm mb-6">請帶著這個畫面去找教練領取實體銀章 🎖️</div>
            <button onClick={() => setCraftCelebrate(null)}
              className="px-8 py-3 rounded-full bg-white text-gray-800 text-sm font-black">好的！</button>
          </div>
        </div>
      )}
    </div>
  );
}