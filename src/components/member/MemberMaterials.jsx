// src/components/member/MemberMaterials.jsx
// v3：材料庫存 + 升級系統 + 章碎片 tab + 合成銀章
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeMaterials, upgradeMaterial, subscribeFragments, craftFragment, subscribeChests, openChest, openChestsBulk, migrateOldFragments, subscribePotions, updateChestOpenStats, refreshMaterials, refreshFragments, refreshPotions } from "../../lib/db";
import { MATERIALS, RARITY_CONFIG } from "../../lib/monsterMaterials";
import { FRAGMENTS, POTIONS, openChestContents, CHEST_TYPES } from "../../lib/itemData";
import { useToast } from "../shared/UI";
import { sfxBuff, sfxEpic, sfxSuccess, sfxCast, sfxCoinDrop } from "../../lib/sound";
import Confetti from "../shared/Confetti";
import ExpansionMaterialsPanel from "./ExpansionMaterialsPanel";
import { isMonsterExpansionEnabled } from "../../lib/monsterExpansionFeature";

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

// 藥水分類：與貓貓村製作頁（CatVillage）使用同一組分類與名稱，避免兩邊歸類不一致。
const POTION_GROUPS = [
  { id:"carry", icon:"💊", label:"攜帶型", hint:"立即生效" },
  { id:"throw", icon:"💣", label:"投擲型", hint:"占用 1 箭" },
  { id:"raid",  icon:"👑", label:"討伐型", hint:"限世界王" },
];

// 開箱結果的材料縮圖：優先用道具圖（public/items/monster-materials/{id}.webp，共 167 張），
// 沒有對應圖檔就退回該素材的 emoji，避免出現破圖。
function MaterialThumb({ material }) {
  const [failed, setFailed] = useState(false);
  const showImage = !failed && material?.id;
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg"
      style={{ background:"rgba(2,6,23,0.5)" }}>
      {showImage && (
        <img src={`/items/monster-materials/${material.id}.webp`} alt=""
          className="h-full w-full object-cover" onError={() => setFailed(true)} />
      )}
      {!showImage && (
        <span className="absolute inset-0 flex items-center justify-center text-2xl" aria-hidden="true">
          {material?.icon || "🪨"}
        </span>
      )}
    </div>
  );
}

export default function MemberMaterials({ onBack, onGoVillage, guestProfile }) {
  const { profile:authProfile } = useAuth();
  const profile=guestProfile||authProfile;
  const { toast, ToastContainer } = useToast();

  // ── tab ──────────────────────────────────────────────────
  const [tab, setTab] = useState(() => {
    const requested = sessionStorage.getItem("inventory_initial_tab");
    sessionStorage.removeItem("inventory_initial_tab");
    return ["materials", "chests", "fragments", "potions", "special"].includes(requested)
      ? requested
      : "chests";
  });

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

  // ── 寶箱庫存 ─────────────────────────────────────────────
  const [chests,       setChests]       = useState([]);
  const [chestLoading, setChestLoading] = useState(!!profile?.id);
  const [openingChest,   setOpeningChest]   = useState(null);
  const [openResult,     setOpenResult]     = useState(null);
  const [chestAnim,      setChestAnim]      = useState(null);
  const [openAllBusy,    setOpenAllBusy]    = useState(false);
  const [openAllProgress, setOpenAllProgress] = useState(null);

  // ── 藥水庫存 ─────────────────────────────────────────────
  const [potions,        setPotions]        = useState({});
  const [potionLoading,  setPotionLoading]  = useState(!!profile?.id);

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
      .filter(m => (m.family === "all" ? (fragments[m.id] || 0) : (inventory[m.id] || 0)) > 0)
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
      setInventory(res.inventory);
    } else {
      toast(res.reason || "升級失敗，請稍後再試");
    }
  }

  // 新素材箱（family_mat/mini_boss_mat/boss_mat）使用 chest 物件自帶的 name/icon/color
  // 舊型寶箱由 CHEST_TYPES 查表取得顯示資料
  function chestLookup(ch) {
    const base = CHEST_TYPES[ch.type];
    if (!base) return CHEST_TYPES.wood;
    return {
      ...base,
      name: ch.name || base.name,
      icon: ch.icon || base.icon,
      color: ch.color || base.color,
      img: ch.img || null,   // 族系箱專屬立繪；無則用 emoji icon
    };
  }

  async function doOpenChest(chest) {
    if (openingChest) return;
    const isCoin = chest.type === "coin";
    const cc = isCoin
      ? { icon: chest.icon || "🪙", color: chest.color || "#92400e", name: chest.name || "金幣寶箱" }
      : chestLookup(chest);
    setOpeningChest(chest.id);
    setChestAnim({ type: chest.type, icon: cc.icon, color: cc.color, name: cc.name, img: cc.img });
    sfxCast();
    const isBig = chest.coinTier === "fierce" || chest.coinTier === "boss" || chest.coinTier === "mythic"
      || chest.type === "gold" || chest.type === "mythic" || chest.type === "cat" || chest.type === "card_pack" || chest.type === "mimi_box"
      || chest.type === "boss_mat" || (chest.type === "family_mat" && (chest.tierIndex || 0) >= 4);
    setTimeout(isBig ? sfxEpic : sfxBuff, 700);
    await new Promise(r => setTimeout(r, 1600));
    const contents = isCoin ? null : openChestContents(chest);
    const res = await openChest(profile.id, chest.id, contents);
    setChestAnim(null);
    setOpeningChest(null);
    if (res.ok) {
      sfxSuccess();
      if (isCoin) setTimeout(sfxCoinDrop, 350);
      setOpenResult(isCoin ? { coins: res.coins } : { ...contents, catResult: res.catResult });
      setChests(res.chests);
      if (!isCoin) updateChestOpenStats(profile.id, chest.type).catch(() => {});
      // 開箱後重新讀取材料/藥水/碎片
      refreshMaterials(profile.id, setInventory);
      refreshPotions(profile.id, setPotions);
      refreshFragments(profile.id, setFragments);
    } else {
      toast(res.reason || "開箱失敗，請稍後再試");
    }
  }

  async function doOpenAllChests() {
    if (openAllBusy || openingChest || chests.length === 0) return;
    setOpenAllBusy(true);
    const snap = [...chests];
    setOpenAllProgress({ done: 0, total: snap.length });
    // ⚠️ 2026-07-19 改為批次：舊版是迴圈逐箱呼叫 openChest，每箱 1 次讀 ＋ 3~6 次
    // 序列化寫入，開 30 箱就是 200 多次 Firestore 往返，畫面看起來就是卡住。
    // 現在改成「本地全部開完 → 彙總 → 每個 collection 只寫一次」。
    let totalCoins = 0;
    let failed = 0;
    let openedIds = new Set();
    let allMats = [], allFrags = [], allPotions = [], allCards = [];
    try {
      // 批次期間無法逐箱回報進度，直接顯示總數讓使用者知道正在處理
      setOpenAllProgress({ done: 0, total: snap.length });
      const res = await openChestsBulk(profile.id, snap, openChestContents);
      if (res?.ok) {
        totalCoins = res.coins || 0;
        failed = res.failed || 0;
        openedIds = new Set(res.opened || []);
        allMats = res.materials || [];
        allFrags = res.fragments || [];
        allPotions = res.potions || [];
        allCards = res.cards || [];
      } else {
        failed = snap.length;
      }
      setOpenAllProgress({ done: snap.length, total: snap.length });
    } catch (error) {
      failed = snap.length;
      console.warn("openAllChests:", error?.message);
    } finally {
      // 不管中途發生什麼，busy 一定要解除，否則按鈕永久鎖死
      setOpenAllBusy(false);
      setOpenAllProgress(null);
    }
    sfxEpic();
    // 只移除真的開成功的，失敗的留在清單裡讓玩家重試（以前是無條件清空，失敗的箱子會憑空消失）
    setChests(previous => previous.filter(chest => !openedIds.has(chest.id)));
    // 全部開完後重新讀取材料/藥水/碎片
    refreshMaterials(profile.id, setInventory);
    refreshPotions(profile.id, setPotions);
    refreshFragments(profile.id, setFragments);
    const groupById = (arr) => {
      const map = {};
      arr.forEach(item => {
        if (!map[item.id]) map[item.id] = { ...item, count: 0 };
        map[item.id].count++;
      });
      return Object.values(map);
    };
    setOpenResult({
      bulk: true,
      count: openedIds.size,
      failed,
      coins: totalCoins,
      materials: groupById(allMats),
      fragments: groupById(allFrags),
      potions: groupById(allPotions),
      cards: allCards,
    });
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
      setFragments(res.fragments);
    } else {
      toast(res.reason || "合成失敗，請稍後再試");
    }
  }

  // ── render ────────────────────────────────────────────────
  if (!profile?.id) return (
    <div className="p-4 flex flex-col gap-4">
      {onBack && <button onClick={onBack} className="text-gray-400 text-sm py-1">← 返回</button>}
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
          <button onClick={onBack} className="text-gray-400 text-sm py-1">← 返回</button>
        )}
        <div className="flex-1">
          <h2 className="text-gray-100 font-black text-xl">🎒 背包</h2>
        </div>
      </div>

      {/* 總覽卡 */}
      <div className="rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-purple-200 text-xs mb-0.5">持有素材種類</div>
            <div className="font-black text-2xl">{ownedKinds}</div>
          </div>
          <div>
            <div className="text-purple-200 text-xs mb-0.5">材料總數</div>
            <div className="font-black text-2xl">{totalCount}</div>
          </div>
          <div>
            <div className="text-purple-200 text-xs mb-0.5">未開戰利品</div>
            <div className="font-black text-2xl">{chests.length}</div>
          </div>
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
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setTab("materials")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all
            ${tab === "materials" ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400"}`}>
          🪨 素材
        </button>
        <button onClick={() => setTab("chests")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all relative
            ${tab === "chests" ? "bg-amber-500 text-white" : "bg-white/10 text-gray-400"}`}>
          📦 寶箱
          {chests.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
              {chests.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab("fragments")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all relative
            ${tab === "fragments" ? "bg-pink-500 text-white" : "bg-white/10 text-gray-400"}`}>
          ✨ 碎片
          {craftableCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full text-[9px] font-black text-white flex items-center justify-center">
              {craftableCount}
            </span>
          )}
        </button>
        <button onClick={() => setTab("potions")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all
            ${tab === "potions" ? "bg-green-500 text-white" : "bg-white/10 text-gray-400"}`}>
          🧪 藥水
        </button>
        <button onClick={() => setTab("special")}
          className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-black transition-colors
            ${tab === "special" ? "bg-indigo-500 text-white" : "bg-white/10 text-gray-400"}`}>
          🎟️ 特殊
        </button>
      </div>

      {/* ══════════ 材料 tab ══════════ */}
      {tab === "materials" && (
        <div className="flex flex-col gap-4">

          {/* 冒險素材（DLC：materialInventory,轉換＋專精升級共用庫存） */}
          {isMonsterExpansionEnabled() ? <ExpansionMaterialsPanel items={inventory} /> : null}

          {!isMonsterExpansionEnabled() && <>
          {/* 升級說明 */}
          <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2 text-amber-300 text-xs leading-relaxed">
            💡 集滿 <b>5 個</b>同一種材料，就能升級成 <b>1 個</b>更高階的材料！
          </div>

          {/* 族別篩選 */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setFamilyFilter("all_families")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all
                ${familyFilter === "all_families" ? "bg-purple-600 text-white border-purple-600" : "bg-white/10 text-gray-300 border-white/15"}`}>
              全部
            </button>
            {FAMILY_ORDER.map(fam => {
              const cfg = FAMILY_CONFIG[fam];
              return (
                <button key={fam} onClick={() => setFamilyFilter(fam)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all
                    ${familyFilter === fam ? "bg-purple-600 text-white border-purple-600" : "bg-white/10 text-gray-300 border-white/15"}`}>
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
                            className={`rounded-2xl p-4 border transition-all ${owned ? "bg-white/5 border-white/15" : "bg-white/5 border-white/10 opacity-50"}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${owned ? "bg-purple-500/15" : "bg-white/10"}`}>
                                {owned ? mat.icon : "❓"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-black text-sm ${owned ? "text-gray-100" : "text-gray-400"}`}>
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
                                <div className={`font-black text-2xl ${owned ? "text-purple-300" : "text-gray-600"}`}>{count}</div>
                                <div className="text-gray-400 text-xs">個</div>
                              </div>
                            </div>

                            {/* 升級進度條（有升級鏈且持有才顯示） */}
                            {canChain && owned && nextMat && (
                              <div className="mt-3 pt-3 border-t border-white/10">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <span className="text-gray-400 font-bold">
                                        {need} 個 → {(inventory[nextMat.id] || 0) > 0 ? `${nextMat.icon} ${nextMat.name}` : "❓ 下一階"}
                                      </span>
                                      <span className={`font-black ${canUpgrade ? "text-amber-400" : "text-gray-400"}`}>
                                        {Math.min(count, need)}/{need}
                                      </span>
                                    </div>
                                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-500 ${canUpgrade ? "bg-amber-400" : "bg-purple-300"}`}
                                        style={{ width: `${Math.min(count / need, 1) * 100}%` }} />
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => canUpgrade && setConfirmMat(mat)}
                                    disabled={!canUpgrade}
                                    className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all
                                      ${canUpgrade ? "bg-amber-400 text-amber-900 shadow-sm active:scale-95" : "bg-white/10 text-gray-500"}`}>
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
          </>}
        </div>
      )}

      {/* ══════════ 寶箱 tab ══════════ */}
      {tab === "chests" && (
        <div className="flex flex-col gap-3">
          <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2 text-amber-300 text-xs leading-relaxed">
            📦 打怪獲勝後寶箱會存入背包，點「開箱！」取得材料、藥劑或章碎片！
          </div>
          {chests.length > 1 && !openAllBusy && !openingChest && (
            // 一定要 catch：doOpenAllChests 是 async，未捕捉的 rejection 會讓畫面卡在 busy
            <button onClick={() => { doOpenAllChests().catch(() => setOpenAllBusy(false)); }}
              className="w-full py-3 rounded-2xl font-black text-white text-sm bg-gradient-to-r from-amber-500 to-orange-500 active:scale-95 transition-all shadow-lg">
              🎁 全部開箱（{chests.length} 個）
            </button>
          )}
          {openAllBusy && openAllProgress && (
            <div className="py-3 text-center text-amber-300 font-bold text-sm bg-amber-500/10 border border-amber-400/30 rounded-2xl">
              ✨ 開箱中 {openAllProgress.done} / {openAllProgress.total}…
            </div>
          )}
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
                : chestLookup(ch);
              const isOpening = openingChest === ch.id;
              return (
                <div key={ch.id || idx} className="bg-white/5 rounded-2xl p-4 border border-white/15 flex items-center gap-4">
                  {cc.img
                    ? <img src={cc.img} alt="" className="w-14 h-14 object-contain shrink-0" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.5))" }} />
                    : <div className="text-4xl">{cc.icon}</div>}
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-sm" style={{ color: cc.color }}>{cc.name}</div>
                    {ch.from && <div className="text-gray-400 text-xs mt-0.5">來自 {ch.from}</div>}
                    <div className="text-gray-500 text-xs mt-0.5 leading-snug">{cc.desc}</div>
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
            <div className="fixed inset-0 bg-black/70 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto"
              onClick={() => setOpenResult(null)}>
              {(openResult.cards?.length > 0 || openResult.catResult || openResult.bulk) && <Confetti />}
              <div className="rounded-3xl p-6 w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
                style={{ background:"var(--bg-surface)", border:"1px solid var(--border-card)", boxShadow:"var(--shadow-elevated)" }}
                onClick={e => e.stopPropagation()}>
                <div className="text-center font-black text-xl mb-4 text-gray-100">
                  {openResult.bulk ? `🎁 全開 ${openResult.count} 個寶箱！` : "🎁 開箱結果！"}
                  {openResult.bulk && openResult.failed > 0 && (
                    <div className="mt-1 text-xs font-bold text-amber-300">
                      ⚠️ 有 {openResult.failed} 個沒開成功，已留在背包可再試一次
                    </div>
                  )}
                </div>
                {openResult.coins > 0 && (
                  <div className="mb-3 text-center">
                    <div className="text-amber-300 text-xs font-bold mb-2">🪙 獲得金幣</div>
                    <div className="text-amber-400 font-black text-4xl">+{openResult.coins}</div>
                  </div>
                )}
                {openResult.fragments?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-pink-300 text-xs font-bold mb-2">✨ 獲得章碎片</div>
                    <div className="flex gap-2 flex-wrap">
                      {openResult.fragments.map(f => (
                        <div key={f.id} className="text-xs px-3 py-1.5 rounded-full font-bold text-white"
                          style={{ background: f.color }}>
                          {f.icon} {f.name} ×{f.count || 1}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {openResult.materials?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-purple-300 text-xs font-bold mb-2">🧪 獲得材料</div>
                    {/* 小卡網格：每張＝道具圖 + 名稱 + 數量。
                        用 auto-fill + minmax 讓一列能放幾張由容器寬度決定（手機自動變少），
                        不必寫任何斷點。 */}
                    <div style={{ display:"grid", gap:8,
                      gridTemplateColumns:"repeat(auto-fill, minmax(84px, 1fr))" }}>
                      {openResult.materials.map((m, i) => (
                        <div key={i}
                          className="flex flex-col items-center gap-1 rounded-xl px-2 py-2"
                          style={{ background:"rgba(168,85,247,0.12)", border:"1px solid rgba(168,85,247,0.25)" }}>
                          <MaterialThumb material={m} />
                          <div className="w-full truncate text-center text-[10px] font-bold text-purple-200"
                            title={m.name}>{m.name}</div>
                          <div className="text-sm font-black text-purple-100">×{m.count || 1}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {openResult.potions?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-green-300 text-xs font-bold mb-2">🧪 獲得藥劑</div>
                    <div className="flex gap-2 flex-wrap">
                      {openResult.potions.map((p, i) => (
                        <div key={i} className="text-xs bg-green-500/15 text-green-300 px-3 py-1.5 rounded-full font-bold">
                          {p.icon} {p.name}{p.count > 1 ? ` ×${p.count}` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {openResult.cards?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-indigo-300 text-xs font-bold mb-2">🃏 抽到的怪物卡片</div>
                    <div className="flex flex-col gap-2">
                      {openResult.cards.map((c, i) => {
                        const tierColor = { common:"#6b7280", rare:"#3b82f6", elite:"#8b5cf6", fierce:"#f59e0b", boss:"#ef4444", mythic:"#ec4899" }[c.tier] || "#6b7280";
                        const tierLabel = { common:"普通", rare:"稀有", elite:"菁英", fierce:"兇猛", boss:"首領", mythic:"神話" }[c.tier] || c.tier;
                        return (
                          <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2">
                            <span className="text-2xl">{c.icon}</span>
                            <div className="flex-1">
                              <div className="font-bold text-gray-100 text-sm">{c.name}</div>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: tierColor }}>{tierLabel}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {openResult.catResult && (
                  <div className="mb-3 text-center">
                    {openResult.catResult.isDuplicate ? (
                      <>
                        <div className="text-4xl mb-1">😺</div>
                        <div className="font-black text-pink-300">已擁有全部貓咪！</div>
                        <div className="text-sm text-gray-400 mt-1">轉換為羈絆經驗 +{openResult.catResult.bondAdded}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-4xl mb-1">🐱</div>
                        <div className="font-black text-pink-300">獲得新夥伴！</div>
                        <div className="text-lg font-black text-pink-400 mt-1">{openResult.catResult.catName}</div>
                      </>
                    )}
                  </div>
                )}
                {!openResult.bulk && !openResult.coins && !openResult.fragments?.length && !openResult.materials?.length && !openResult.potions?.length && !openResult.cards?.length && !openResult.catResult && (
                  <div className="text-center text-gray-400 text-sm py-4">這次開箱什麼都沒有…</div>
                )}
                <button onClick={() => setOpenResult(null)}
                  className="sticky bottom-0 w-full mt-4 py-3 rounded-2xl bg-purple-600 text-white font-black active:scale-95 transition-all shadow-lg">
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
          <div className="bg-pink-500/10 border border-pink-400/30 rounded-xl px-3 py-2 text-pink-300 text-xs leading-relaxed">
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
                <div key={frag.id} className="bg-white/5 rounded-2xl p-4 border border-white/15">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: frag.color + "22" }}>
                      {frag.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-sm text-gray-100">{frag.name}</div>
                      <div className="text-gray-400 text-xs mt-0.5">{frag.desc}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-2xl" style={{ color: frag.color }}>{count}</div>
                      <div className="text-gray-400 text-xs">/{frag.craftCount}</div>
                    </div>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: canCraft ? frag.color : frag.color + "88" }} />
                  </div>
                  <button
                    onClick={() => canCraft && setConfirmFrag(frag)}
                    disabled={!canCraft}
                    className={`w-full py-2.5 rounded-xl text-sm font-black transition-all active:scale-95
                      ${canCraft ? "text-white" : "bg-white/10 text-gray-500"}`}
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
          <div className="bg-green-500/10 border border-green-400/30 rounded-xl px-3 py-2 text-green-300 text-xs leading-relaxed">
            每回合最多使用 1 瓶藥水；攜帶型立即生效，投擲型會占用 1 箭，討伐型限世界王使用。
          </div>
          {potionLoading ? (
            <div className="text-center py-6 text-gray-400 text-sm">載入中…</div>
          ) : POTIONS.some(p => (potions[p.id] || 0) > 0) ? (
            /* 分類方式與貓貓村製作頁一致（攜帶／投擲／討伐），玩家兩邊看到的歸類不會打架 */
            <div className="flex flex-col gap-4">
              {POTION_GROUPS.map(group => {
                const owned = POTIONS.filter(p => p.kind === group.id && (potions[p.id] || 0) > 0);
                if (!owned.length) return null;
                return (
                  <section key={group.id}>
                    <div className="mb-1.5 flex items-center justify-between px-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-black text-green-300">
                        <span aria-hidden="true">{group.icon}</span>
                        <span>{group.label}</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-500">{group.hint}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {owned.map(potion => (
                        <article key={potion.id} className="min-h-36 rounded-2xl border border-green-400/25 bg-green-500/10 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-3xl" aria-hidden="true">{potion.icon}</span>
                            <span className="rounded-full bg-green-400/15 px-2 py-0.5 text-xs font-black text-green-300">
                              ×{potions[potion.id]}
                            </span>
                          </div>
                          <h3 className="mt-3 break-words text-sm font-black text-gray-100">{potion.name}</h3>
                          {potion.level ? (
                            <div className="mt-1 inline-block rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-300">
                              Lv.{potion.level}
                            </div>
                          ) : null}
                          <p className="mt-1 text-[11px] leading-relaxed text-gray-400">{potion.effectText}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 py-10 text-center text-sm text-gray-500">
              <div className="mb-2 text-4xl" aria-hidden="true">🧪</div>
              目前沒有藥水
            </div>
          )}
          {onGoVillage ? (
            <button type="button" onClick={onGoVillage}
              className="min-h-11 touch-manipulation rounded-xl bg-green-600 px-4 text-sm font-black text-white transition-colors hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300">
              前往貓貓村製作藥水
            </button>
          ) : null}
        </div>
      )}

      {tab === "special" && (
        <div className="rounded-2xl border border-dashed border-indigo-400/25 bg-indigo-500/5 px-4 py-12 text-center">
          <div className="mb-3 text-5xl" aria-hidden="true">🎟️</div>
          <h3 className="font-black text-gray-200">目前沒有特殊道具</h3>
          <p className="mt-1 text-xs text-gray-500">活動券與任務道具會收納在這裡。</p>
        </div>
      )}

      {/* ── 升級確認彈窗 ───────────────────────────────────── */}
      {confirmMat && (() => {
        const nextMat = MATERIALS.find(m => m.id === confirmMat.upgradesTo);
        const need    = confirmMat.upgradeCount || 5;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
            onClick={() => !upgrading && setConfirmMat(null)}>
            <div className="rounded-3xl p-6 w-full max-w-sm"
              style={{ background:"var(--bg-surface)", border:"1px solid var(--border-card)", boxShadow:"var(--shadow-elevated)" }}
              onClick={e => e.stopPropagation()}>
              <div className="text-center mb-4">
                <div className="font-black text-gray-100 text-lg mb-1">⬆️ 材料升級</div>
                <div className="text-gray-400 text-xs">確定要升級嗎？升級後低階材料會消耗掉</div>
              </div>
              <div className="flex items-center justify-center gap-3 mb-5">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/15 flex items-center justify-center text-3xl mx-auto">{confirmMat.icon}</div>
                  <div className="text-gray-300 text-xs font-bold mt-1">{confirmMat.name}</div>
                  <div className="text-red-400 text-xs font-black">−{need} 個</div>
                </div>
                <div className="text-2xl text-gray-500">➜</div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/15 flex items-center justify-center text-3xl mx-auto">{nextMat?.icon}</div>
                  <div className="text-gray-300 text-xs font-bold mt-1">{nextMat?.name}</div>
                  <div className="text-green-400 text-xs font-black">＋1 個</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmMat(null)} disabled={upgrading}
                  className="flex-1 py-3 rounded-2xl bg-white/10 text-gray-300 text-sm font-black border border-white/15">取消</button>
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
          <div className="rounded-3xl p-6 w-full max-w-sm"
            style={{ background:"var(--bg-surface)", border:"1px solid var(--border-card)", boxShadow:"var(--shadow-elevated)" }}
            onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="font-black text-gray-100 text-lg mb-1">✨ 碎片合成</div>
              <div className="text-gray-400 text-xs">確定要合成「{confirmFrag.craftResult.label}」嗎？</div>
            </div>
            <div className="text-center mb-5">
              <div className="text-5xl mb-2">{confirmFrag.icon}</div>
              <div className="font-black text-gray-200 text-base mb-1">{confirmFrag.name} ×{confirmFrag.craftCount}</div>
              <div className="text-2xl my-2 text-gray-500">↓</div>
              <div className="inline-block px-4 py-2 rounded-2xl font-black text-white text-base"
                style={{ background: confirmFrag.color }}>
                {confirmFrag.craftResult.badgeLevel === "gold" ? "🥇" : confirmFrag.craftResult.badgeLevel === "bronze" ? "🥉" : "🥈"} {confirmFrag.craftResult.label}
              </div>
              <div className="text-gray-400 text-xs mt-2">合成後請找教練領取實體銀章！</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmFrag(null)} disabled={crafting}
                className="flex-1 py-3 rounded-2xl bg-white/10 text-gray-300 text-sm font-black border border-white/15">取消</button>
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
            <div className="mb-4 animate-bounce flex items-center justify-center"
              style={{ filter: `drop-shadow(0 0 24px ${chestAnim.color})` }}>
              {chestAnim.img
                ? <img src={chestAnim.img} alt="" className="w-40 h-40 object-contain" />
                : <span className="text-9xl">{chestAnim.icon}</span>}
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

      {/* ── 碎片合成成功動畫 ────────────────────────────────── */}
      {craftCelebrate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
          onClick={() => setCraftCelebrate(null)}>
          <Confetti />
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
