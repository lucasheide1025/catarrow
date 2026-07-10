// src/components/member/RPGEquipPanel.jsx — RPG 裝備面板
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { equipItem, changeEquipBrand, unequipSlot, upgradeEquipSlot, saveEquipNextMats, subscribeEquipItems, subscribeMaterials } from "../../lib/db";
import { EQUIP_GRADES, EQUIP_SLOT_DEFS, calcEquipBonus, getEquipSlotBonus } from "../../lib/constants";
import { MATERIALS, RARITY_CONFIG } from "../../lib/monsterMaterials";
import { EQUIP_UPGRADE_COST, GRADE_PREFIX, generateRandomMats } from "../../lib/equipData";
import { sfxLevelUp } from "../../lib/sound";

const STAT_SECTIONS = [
  { stat: "atk", label: "⚔️ 攻擊裝備", color: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-900/10" },
  { stat: "def", label: "🛡️ 防禦裝備", color: "text-blue-400",   border: "border-blue-500/30",   bg: "bg-blue-900/10"   },
  { stat: "hp",  label: "❤️ 生命裝備", color: "text-green-400",  border: "border-green-500/30",  bg: "bg-green-900/10"  },
];

function gradeStyle(gradeId) {
  const g = EQUIP_GRADES.find(x => x.id === gradeId);
  return g ? { color: g.color } : { color: "#94a3b8" };
}

function gradeName(gradeId) {
  return EQUIP_GRADES.find(x => x.id === gradeId)?.name || "—";
}

function gradeIdx(gradeId) {
  return EQUIP_GRADES.findIndex(x => x.id === gradeId);
}

// ── 單一槽位卡片 ───────────────────────────────────────────
function SlotCard({ slotDef, equipped, onClick, onGoShop, itemsMap }) {
  const isEmpty = !equipped?.itemId;
  const grade   = equipped?.grade     || "common";
  const plus    = equipped?.plusLevel || 0;
  const idx     = gradeIdx(grade);
  const bonus   = getEquipSlotBonus(slotDef, equipped);
  const gStyle  = gradeStyle(grade);
  const itemList = (itemsMap || {})[slotDef.id] || [];
  const item     = itemList.find(i => i.id === equipped?.itemId);
  const isMax    = idx >= EQUIP_GRADES.length - 1 && plus >= 4;

  if (isEmpty) {
    return (
      <button type="button" onClick={onGoShop}
        className="min-h-40 w-full touch-manipulation rounded-2xl border border-dashed border-slate-700/60 bg-slate-950/25 p-3 text-left transition-[transform,border-color,background-color] hover:border-slate-500 hover:bg-slate-900/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-black text-slate-500">{slotDef.name}</span>
            <span className="text-xs text-slate-600" aria-hidden="true">🏪</span>
          </div>
          <div className="my-3 flex flex-1 items-center justify-center">
            <span className="grid size-14 place-items-center rounded-2xl border border-slate-700/50 bg-slate-900/60 text-3xl opacity-40">
              {slotDef.icon}
            </span>
          </div>
          <div className="text-center text-xs font-bold text-slate-500">尚未裝備</div>
          <div className="mt-1 text-center text-[10px] text-slate-600">點擊前往商店</div>
        </div>
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick}
      className="relative min-h-40 w-full touch-manipulation overflow-hidden rounded-2xl border p-3 text-left shadow-lg transition-[transform,border-color,background-color] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      style={{
        borderColor: `${gStyle.color}66`,
        background: `linear-gradient(145deg, ${gStyle.color}20 0%, rgba(15,23,42,.92) 55%)`,
      }}>
      <div className="absolute -right-5 -top-5 size-20 rounded-full opacity-15 blur-2xl"
        style={{ backgroundColor: gStyle.color }} />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-black text-slate-400">{slotDef.name}</span>
          {isMax && <span className="rounded-full bg-pink-500/15 px-1.5 py-0.5 text-[9px] font-black text-pink-300">MAX</span>}
        </div>
        <div className="my-2 flex items-center justify-between gap-2">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl border bg-black/20 text-3xl"
            style={{ borderColor: `${gStyle.color}45` }}>
            {slotDef.icon}
          </span>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-500">
              {slotDef.stat === "hp" ? "HP" : slotDef.stat.toUpperCase()} 加成
            </div>
            <div className="text-xl font-black" style={gStyle}>+{bonus}</div>
          </div>
        </div>
        <div className="mt-auto min-w-0">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold" style={gStyle}>
            <span className="opacity-70">{GRADE_PREFIX[grade] || ""}</span>
            {item?.name || equipped.itemId}
          </div>
          <div className="mt-1 flex items-center justify-between gap-1">
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-black" style={gStyle}>
              {gradeName(grade)}{plus > 0 ? ` +${plus}` : ""}
            </span>
            <span className="text-[10px] font-bold text-slate-500">查看 ›</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── 強化成功演出 ───────────────────────────────────────────
function UpgradeCelebration({ result, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2600);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-hidden bg-slate-950/90 px-6"
      role="status" aria-live="assertive">
      <style>{`
        @keyframes equip-flash { 0% { opacity: 0; } 18% { opacity: .9; } 100% { opacity: 0; } }
        @keyframes equip-card-in {
          0% { opacity: 0; transform: scale(.55) rotateY(90deg); }
          55% { opacity: 1; transform: scale(1.08) rotateY(0); }
          100% { opacity: 1; transform: scale(1) rotateY(0); }
        }
        @keyframes equip-ray { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes equip-spark {
          0% { opacity: 0; transform: rotate(var(--angle)) translateY(0) scale(.3); }
          35% { opacity: 1; }
          100% { opacity: 0; transform: rotate(var(--angle)) translateY(-145px) scale(1); }
        }
        .equip-fx-card { animation: equip-card-in .7s cubic-bezier(.16,1,.3,1) both; }
        .equip-fx-flash { animation: equip-flash .8s ease-out both; }
        .equip-fx-ray { animation: equip-ray 8s linear infinite; }
        .equip-fx-spark { animation: equip-spark 1.4s ease-out both; animation-delay: var(--delay); }
        @media (prefers-reduced-motion: reduce) {
          .equip-fx-card, .equip-fx-flash, .equip-fx-ray, .equip-fx-spark { animation: none !important; }
          .equip-fx-spark { display: none; }
        }
      `}</style>

      <div className="equip-fx-flash pointer-events-none absolute inset-0 bg-white" />
      <div className="equip-fx-ray pointer-events-none absolute size-[28rem] rounded-full opacity-20"
        style={{ background: `conic-gradient(from 0deg, transparent, ${result.gradeColor}, transparent, ${result.gradeColor}, transparent)` }} />
      {Array.from({ length: 12 }, (_, index) => (
        <span key={index}
          className="equip-fx-spark pointer-events-none absolute left-1/2 top-1/2 size-2 rounded-full"
          style={{
            "--angle": `${index * 30}deg`,
            "--delay": `${0.2 + (index % 4) * 0.08}s`,
            backgroundColor: result.gradeColor,
            boxShadow: `0 0 14px ${result.gradeColor}`,
          }} />
      ))}

      <div className="equip-fx-card relative w-full max-w-xs text-center">
        <div className="mb-3 text-sm font-black tracking-[.3em] text-amber-200">
          {result.upgraded ? "品級突破" : "強化成功"}
        </div>
        <div className="rounded-[2rem] border-2 bg-slate-900/95 p-6 shadow-2xl"
          style={{ borderColor: result.gradeColor, boxShadow: `0 0 45px ${result.gradeColor}55` }}>
          <div className="mx-auto grid size-24 place-items-center rounded-3xl border bg-black/20 text-6xl"
            style={{ borderColor: `${result.gradeColor}80` }}>
            {result.icon}
          </div>
          <div className="mt-4 text-xs font-bold text-slate-400">{result.slotName}</div>
          <div className="mt-1 truncate text-lg font-black text-white">{result.itemName}</div>
          <div className="mt-3 text-2xl font-black" style={{ color: result.gradeColor }}>
            {result.gradeName}{result.plusLevel > 0 ? ` +${result.plusLevel}` : ""}
          </div>
          <div className="mt-2 text-sm font-bold text-emerald-300">
            {result.statLabel} 加成提升至 +{result.bonus}
          </div>
        </div>
        <button type="button" onClick={onClose}
          className="mt-5 min-h-11 rounded-full border border-white/15 bg-white/10 px-8 text-sm font-black text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          繼續
        </button>
      </div>
    </div>
  );
}

// ── 裝備選擇 Modal ─────────────────────────────────────────
function EquipModal({ slotDef, equipped, onEquip, onUnequip, onUpgrade, onClose, upgrading, itemsMap, matInv, coins, upgradeErr, nextMats }) {
  const [tab, setTab] = useState("info"); // "info" | "change"
  const isEmpty   = !equipped?.itemId;
  const grade     = equipped?.grade     || "common";
  const plus      = equipped?.plusLevel || 0;
  const idx       = gradeIdx(grade);
  const isMax     = idx >= EQUIP_GRADES.length - 1 && plus >= 4;
  const cost      = EQUIP_UPGRADE_COST[grade];
  const mats      = nextMats || {};
  const itemList  = (itemsMap || {})[slotDef.id] || [];
  const curItem   = itemList.find(i => i.id === equipped?.itemId);
  const currentBonus = getEquipSlotBonus(slotDef, equipped);
  const nextGrade = plus >= 4 ? EQUIP_GRADES[idx + 1]?.id : grade;
  const nextEquip = nextGrade
    ? { ...equipped, grade: nextGrade, plusLevel: plus >= 4 ? 0 : plus + 1 }
    : null;
  const nextBonus = nextEquip ? getEquipSlotBonus(slotDef, nextEquip) : currentBonus;

  // 計算是否可升級
  const inv = matInv || {};
  const myCoins = coins || 0;
  const coinsOk = !cost || myCoins >= cost.gold;
  const matsOk  = !mats.materials || mats.materials.every(m => (inv[m.id] || 0) >= m.count);
  const keyOk   = !mats.keyItem || (inv[mats.keyItem.id] || 0) >= (mats.keyItem.count || 1);
  const canUpgrade = coinsOk && matsOk && keyOk;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-0"
      onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="equip-dialog-title"
        className="w-full max-w-md bg-slate-900 rounded-t-2xl p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] overscroll-contain"
        onClick={e => e.stopPropagation()}>

        {/* 標題 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{slotDef.icon}</span>
            <div>
              <div id="equip-dialog-title" className="font-black text-white">{slotDef.name}</div>
              <div className="text-xs text-slate-500">
                {slotDef.stat === "atk" ? "⚔️ 攻擊" : slotDef.stat === "def" ? "🛡️ 防禦" : "❤️ 生命"}裝備
              </div>
            </div>
          </div>
          <button type="button" aria-label="關閉裝備視窗" onClick={onClose}
            className="min-h-11 min-w-11 rounded-lg text-slate-400 text-xl hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70">✕</button>
        </div>

        {isEmpty ? (
          /* 空槽：直接顯示品項列表 */
          <div>
            <div className="text-xs text-slate-400 mb-3">選擇要裝備的品項：</div>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {itemList.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-700 px-4 py-6 text-center text-xs text-slate-500">
                  此槽位目前沒有可裝備品項，請先前往金幣商店購買。
                </div>
              )}
              {itemList.map(item => (
                <button key={item.id}
                  onClick={() => onEquip(item.id)}
                  className="text-left rounded-xl p-3 bg-slate-800 border border-slate-700 hover:border-slate-500 transition-all">
                  <div className="font-bold text-white text-sm">{item.name}</div>
                  <div className="text-xs text-slate-400">{item.brand} · {item.desc}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* 已裝備：顯示資訊 + 操作 */
          <>
            <div className="flex gap-2 mb-4">
              {["info", "change"].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    tab === t ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"
                  }`}>
                  {t === "info" ? "📊 資訊 / 升級" : "🔄 更換品項"}
                </button>
              ))}
            </div>

            {tab === "info" && (
              <div>
                {/* 當前裝備資訊 */}
                <div className="bg-slate-800 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-sm text-white">
                      <span className="opacity-50 text-xs">{GRADE_PREFIX[grade] || ""}</span>
                      {curItem?.name || equipped.itemId}
                    </span>
                    <span className="text-sm font-black" style={gradeStyle(grade)}>
                      {gradeName(grade)}{plus > 0 ? `+${plus}` : ""}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">{curItem?.brand} · {curItem?.desc}</div>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="text-xs text-slate-500">加成</div>
                    <div className="font-black text-sm" style={gradeStyle(grade)}>
                      {slotDef.stat === "hp" ? "❤️ HP" : slotDef.stat === "atk" ? "⚔️ ATK" : "🛡️ DEF"} +{currentBonus}
                    </div>
                  </div>
                  {!isMax && (
                    <div className="mt-2 rounded-lg bg-black/20 px-3 py-2 text-xs text-slate-300">
                      下次升級：
                      <span className="ml-1 font-black text-emerald-300">
                        +{currentBonus} → +{nextBonus}
                      </span>
                      <span className="ml-1 text-slate-500">（提升 +{nextBonus - currentBonus}）</span>
                    </div>
                  )}
                </div>

                {/* 升級進度條 */}
                {!isMax && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-slate-400">升級進度</span>
                      <span className="text-xs font-black" style={gradeStyle(grade)}>{plus}/5</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(plus / 5) * 100}%`, background: EQUIP_GRADES[idx]?.glow || "#64748b" }} />
                    </div>
                    {plus === 4 && (
                      <div className="text-xs text-center mt-1" style={gradeStyle(EQUIP_GRADES[idx + 1]?.id)}>
                        下次升級 → {gradeName(EQUIP_GRADES[idx + 1]?.id)}
                      </div>
                    )}
                  </div>
                )}

                {/* 升級費用（含庫存顯示）*/}
                {!isMax && cost && (
                  <div className="bg-slate-800/60 rounded-xl p-3 mb-3 text-xs">
                    <div className="font-bold text-slate-300 mb-2">升級材料需求
                      <span className="ml-1.5 text-[10px] text-indigo-400 font-normal">🎲 隨機配方</span>
                    </div>

                    {/* 金幣 */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span>🪙</span>
                      <span className="text-slate-300">金幣</span>
                      <span className="ml-auto font-black"
                        style={{ color: coinsOk ? "#fbbf24" : "#f87171" }}>
                        {myCoins.toLocaleString()}
                        <span className="text-slate-500 font-normal"> / </span>
                        {cost.gold.toLocaleString()}
                      </span>
                    </div>

                    {/* 一般材料（來自 nextMats）*/}
                    {(mats.materials || []).map(m => {
                      const mat  = MATERIALS.find(x => x.id === m.id);
                      const has  = inv[m.id] || 0;
                      const ok   = has >= m.count;
                      const nameColor = RARITY_CONFIG[mat?.rarity]?.color || "#9ca3af";
                      return (
                        <div key={m.id} className="flex items-center gap-1.5 mb-1">
                          <span>{mat?.icon || "🪨"}</span>
                          <span style={{ color: nameColor }} className="font-bold text-[11px]">
                            {mat?.name || m.id}
                          </span>
                          <span className="ml-auto font-black"
                            style={{ color: ok ? "#86efac" : "#f87171" }}>
                            {has}
                            <span className="text-slate-500 font-normal"> / </span>
                            {m.count}
                          </span>
                        </div>
                      );
                    })}

                    {/* 關鍵材料（來自 nextMats）*/}
                    {mats.keyItem && (() => {
                      const mat  = MATERIALS.find(x => x.id === mats.keyItem.id);
                      const has  = inv[mats.keyItem.id] || 0;
                      const ok   = has >= mats.keyItem.count;
                      const nameColor = RARITY_CONFIG[mat?.rarity]?.color || "#fbbf24";
                      return (
                        <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-700">
                          <span>{mat?.icon || "⭐"}</span>
                          <span style={{ color: nameColor }} className="font-black text-[11px]">
                            {mat?.name || mats.keyItem.id}
                          </span>
                          <span className="ml-auto font-black"
                            style={{ color: ok ? "#86efac" : "#f87171" }}>
                            {has}
                            <span className="text-slate-500 font-normal"> / </span>
                            {mats.keyItem.count}
                          </span>
                        </div>
                      );
                    })()}

                    {/* 尚未載入隨機配方時的提示 */}
                    {!mats.materials && (
                      <div className="text-slate-500 text-center py-1">載入配方中…</div>
                    )}
                  </div>
                )}

                {/* 升級 Modal 內錯誤提示 */}
                {upgradeErr && (
                  <div className="mb-2 text-center text-xs text-red-400 font-bold bg-red-900/20 rounded-lg px-3 py-1.5">
                    ❌ {upgradeErr}
                  </div>
                )}

                <div className="flex gap-2">
                  {!isMax && (
                    <button onClick={onUpgrade} disabled={upgrading || !canUpgrade}
                      className={`flex-1 py-2.5 rounded-xl font-black text-sm active:scale-95 transition-all ${
                        canUpgrade
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-700 text-slate-500 cursor-not-allowed"
                      } disabled:opacity-60`}>
                      {upgrading ? "升級中…" : canUpgrade ? `⬆️ 升級 +${plus + 1}` : "材料或金幣不足"}
                    </button>
                  )}
                  <button onClick={onUnequip}
                    className="px-4 py-2.5 rounded-xl bg-slate-700 text-slate-300 font-bold text-sm active:scale-95 transition-transform">
                    卸下
                  </button>
                </div>
              </div>
            )}

            {tab === "change" && (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                <div className="text-xs text-amber-400 mb-1">⚠️ 更換品項不影響品級與等級</div>
                {itemList.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-700 px-4 py-6 text-center text-xs text-slate-500">
                    沒有其他可更換的品項。
                  </div>
                )}
                {itemList.map(item => (
                  <button key={item.id}
                    onClick={() => onEquip(item.id)}
                    className={`text-left rounded-xl p-3 border transition-all ${
                      item.id === equipped?.itemId
                        ? "bg-indigo-900/30 border-indigo-500/60"
                        : "bg-slate-800 border-slate-700 hover:border-slate-500"
                    }`}>
                    <div className="font-bold text-white text-sm">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.brand} · {item.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── 主元件 ─────────────────────────────────────────────────
export default function RPGEquipPanel({ onGoShop, showSummary = true, guestProfile }) {
  const { profile: authProfile } = useAuth();
  const profile = guestProfile || authProfile;
  const [activeSlot,      setActiveSlot]      = useState(null);
  const [displayNextMats, setDisplayNextMats] = useState(null);
  const [upgrading,       setUpgrading]       = useState(false);
  const [msg,             setMsg]             = useState("");
  const [upgradeErr,      setUpgradeErr]      = useState("");
  const [upgradeFx,       setUpgradeFx]       = useState(null);
  const [rawItems,        setRawItems]        = useState([]);
  const [matInv,          setMatInv]          = useState({});

  useEffect(() => subscribeEquipItems(setRawItems), []);
  useEffect(() => {
    if (!profile?.id) return;
    return subscribeMaterials(profile.id, setMatInv);
  }, [profile?.id]); // eslint-disable-line

  const equipment = profile?.rpgEquip || {};
  const unlockedItems = profile?.unlockedEquipItems || {};

  // 已穿戴品項視為既有解鎖；其他品牌需先在商店永久解鎖。
  const itemsMap = useMemo(() => rawItems.reduce((acc, item) => {
    const isEquipped = equipment[item.slotId]?.itemId === item.id;
    if (!isEquipped && !unlockedItems[item.id]) return acc;
    if (!acc[item.slotId]) acc[item.slotId] = [];
    acc[item.slotId].push(item);
    return acc;
  }, {}), [rawItems, equipment, unlockedItems]);

  const bonus     = calcEquipBonus(equipment);

  function showMsg(text) {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  }

  function openSlot(slotDef) {
    const equip = equipment[slotDef.id];
    setActiveSlot(slotDef);
    setUpgradeErr("");
    if (equip?.nextMats) {
      setDisplayNextMats(equip.nextMats);
    } else if (equip?.itemId) {
      // 舊資料或首次裝備：產生並存入 Firestore
      const mats = generateRandomMats(equip.grade || "common");
      setDisplayNextMats(mats);
      saveEquipNextMats(profile.id, slotDef.id, mats);
    } else {
      setDisplayNextMats(null);
    }
  }

  async function handleEquip(itemId) {
    if (!activeSlot || !profile?.id) return;
    const cur = equipment[activeSlot.id];
    if (cur?.itemId) {
      await changeEquipBrand(profile.id, activeSlot.id, itemId);
    } else {
      await equipItem(profile.id, activeSlot.id, itemId);
      // 首次裝備：產生初始隨機材料需求
      const mats = generateRandomMats("common");
      await saveEquipNextMats(profile.id, activeSlot.id, mats);
    }
    setActiveSlot(null);
    showMsg("✅ 裝備完成");
  }

  async function handleUnequip() {
    if (!activeSlot || !profile?.id) return;
    await unequipSlot(profile.id, activeSlot.id);
    setActiveSlot(null);
    showMsg("已卸下裝備");
  }

  async function handleUpgrade() {
    if (!activeSlot || !profile?.id || upgrading) return;
    const slotDef = activeSlot;
    const currentEquip = equipment[slotDef.id];
    const currentItem = (itemsMap[slotDef.id] || []).find(item => item.id === currentEquip?.itemId);
    setUpgrading(true);
    setUpgradeErr("");
    const result = await upgradeEquipSlot(profile.id, slotDef.id, {
      equip:    currentEquip,
      coins:    profile.coins || 0,
      matItems: matInv,
      nextMats: displayNextMats,
    });
    setUpgrading(false);
    if (result.ok) {
      const nextEquip = {
        ...currentEquip,
        grade: result.newGrade,
        plusLevel: result.newPlusLevel,
      };
      const nextGrade = EQUIP_GRADES.find(grade => grade.id === result.newGrade);
      sfxLevelUp();
      setUpgradeFx({
        upgraded: result.upgraded,
        icon: slotDef.icon,
        slotName: slotDef.name,
        itemName: currentItem?.name || currentEquip?.itemId || slotDef.name,
        gradeName: nextGrade?.name || gradeName(result.newGrade),
        gradeColor: nextGrade?.color || "#f8fafc",
        plusLevel: result.newPlusLevel,
        bonus: getEquipSlotBonus(slotDef, nextEquip),
        statLabel: slotDef.stat === "hp" ? "HP" : slotDef.stat.toUpperCase(),
      });
      setUpgradeErr("");
      setActiveSlot(null);
    } else {
      setUpgradeErr(result.reason);
    }
  }

  const activeEquipped = activeSlot ? (equipment[activeSlot.id] || null) : null;

  return (
    <div className="pb-4">
      {/* 總加成摘要 */}
      {showSummary && <div className="flex gap-2 mb-4 px-1">
        {[
          { label: "ATK 加成", val: `+${bonus.atkBonus}`, color: "text-orange-400" },
          { label: "DEF 加成", val: `+${bonus.defBonus}`, color: "text-blue-400"   },
          { label: "HP 加成",  val: `+${bonus.hpBonus}`,  color: "text-green-400"  },
        ].map(({ label, val, color }) => (
          <div key={label} className="flex-1 bg-slate-800 rounded-xl p-2.5 text-center">
            <div className="text-[10px] text-slate-500">{label}</div>
            <div className={`text-lg font-black ${color}`}>{val}</div>
          </div>
        ))}
      </div>}

      {/* 各槽位分區顯示 */}
      {STAT_SECTIONS.map(sec => (
        <div key={sec.stat} className={`mb-4 rounded-xl p-3 border ${sec.border} ${sec.bg}`}>
          <div className={`text-xs font-black mb-2 ${sec.color}`}>{sec.label}</div>
          <div className="grid grid-cols-2 gap-2.5">
            {EQUIP_SLOT_DEFS.filter(s => s.stat === sec.stat).map(slotDef => (
              <SlotCard
                key={slotDef.id}
                slotDef={slotDef}
                equipped={equipment[slotDef.id] || null}
                onClick={() => openSlot(slotDef)}
                onGoShop={onGoShop}
                itemsMap={itemsMap}
              />
            ))}
          </div>
        </div>
      ))}

      {/* 訊息提示 */}
      {msg && (
        <div aria-live="polite" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
          bg-slate-800 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg
          border border-slate-600">
          {msg}
        </div>
      )}

      {upgradeFx && (
        <UpgradeCelebration result={upgradeFx} onClose={() => setUpgradeFx(null)} />
      )}

      {/* 槽位操作 Modal */}
      {activeSlot && (
        <EquipModal
          slotDef={activeSlot}
          equipped={activeEquipped}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
          onUpgrade={handleUpgrade}
          onClose={() => { setActiveSlot(null); setUpgradeErr(""); }}
          upgrading={upgrading}
          itemsMap={itemsMap}
          matInv={matInv}
          coins={profile?.coins || 0}
          upgradeErr={upgradeErr}
          nextMats={displayNextMats}
        />
      )}
    </div>
  );
}
