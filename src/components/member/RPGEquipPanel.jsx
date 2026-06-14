// src/components/member/RPGEquipPanel.jsx — RPG 裝備面板
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { equipItem, changeEquipBrand, unequipSlot, upgradeEquipSlot, subscribeEquipItems, subscribeMaterials } from "../../lib/db";
import { EQUIP_GRADES, EQUIP_SLOT_DEFS, calcEquipBonus } from "../../lib/constants";
import { MATERIALS, RARITY_CONFIG } from "../../lib/monsterMaterials";
import { EQUIP_UPGRADE_COST, GRADE_PREFIX } from "../../lib/equipData";

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
  const bonus   = idx + 1;
  const gStyle  = gradeStyle(grade);
  const itemList = (itemsMap || {})[slotDef.id] || [];
  const item     = itemList.find(i => i.id === equipped?.itemId);
  const isMax    = idx >= EQUIP_GRADES.length - 1 && plus >= 4;

  if (isEmpty) {
    return (
      <button onClick={onGoShop}
        className="w-full text-left rounded-xl p-2.5 border border-dashed border-slate-700/40 bg-slate-900/20 transition-all hover:border-slate-600/60 active:scale-95">
        <div className="flex items-center gap-2">
          <span className="text-lg opacity-30">{slotDef.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-slate-600 font-bold">{slotDef.name}</div>
            <div className="text-[10px] text-slate-700">🔒 前往金幣商店購買</div>
          </div>
          <span className="text-slate-700 text-xs">🏪</span>
        </div>
      </button>
    );
  }

  return (
    <button onClick={onClick}
      className="w-full text-left rounded-xl p-2.5 border border-slate-600/50 bg-slate-800/50 hover:border-slate-500 transition-all active:scale-95">
      <div className="flex items-center gap-2">
        <span className="text-lg">{slotDef.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-slate-500 font-bold">{slotDef.name}</div>
          <div className="text-xs font-bold truncate" style={gStyle}>
            <span className="opacity-70">{GRADE_PREFIX[grade] || ""}</span>
            {item?.name || equipped.itemId}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] font-black" style={gStyle}>
              {gradeName(grade)}{plus > 0 ? `+${plus}` : ""}
            </span>
            {isMax && <span className="text-[9px] text-pink-400">MAX</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-slate-500">
            {slotDef.stat === "hp" ? "HP" : slotDef.stat.toUpperCase()}
          </div>
          <div className="text-sm font-black" style={gStyle}>
            +{slotDef.stat === "hp" ? bonus * 5 : bonus}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── 裝備選擇 Modal ─────────────────────────────────────────
function EquipModal({ slotDef, equipped, onEquip, onUnequip, onUpgrade, onClose, upgrading, itemsMap, matInv, coins, upgradeErr }) {
  const [tab, setTab] = useState("info"); // "info" | "change"
  const isEmpty   = !equipped?.itemId;
  const grade     = equipped?.grade     || "common";
  const plus      = equipped?.plusLevel || 0;
  const idx       = gradeIdx(grade);
  const isMax     = idx >= EQUIP_GRADES.length - 1 && plus >= 4;
  const cost      = EQUIP_UPGRADE_COST[grade];
  const itemList  = (itemsMap || {})[slotDef.id] || [];
  const curItem   = itemList.find(i => i.id === equipped?.itemId);

  // 計算是否可升級
  const inv = matInv || {};
  const myCoins = coins || 0;
  const coinsOk = !cost || myCoins >= cost.gold;
  const matsOk  = !cost || cost.materials.every(m => (inv[m.id] || 0) >= m.count);
  const keyOk   = !cost?.keyItem || (inv[cost.keyItem?.id] || 0) >= (cost.keyItem?.count || 1);
  const canUpgrade = coinsOk && matsOk && keyOk;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-0"
      onClick={onClose}>
      <div className="w-full max-w-md bg-slate-900 rounded-t-2xl p-4 pb-8"
        onClick={e => e.stopPropagation()}>

        {/* 標題 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{slotDef.icon}</span>
            <div>
              <div className="font-black text-white">{slotDef.name}</div>
              <div className="text-xs text-slate-500">
                {slotDef.stat === "atk" ? "⚔️ 攻擊" : slotDef.stat === "def" ? "🛡️ 防禦" : "❤️ 生命"}裝備
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 text-xl">✕</button>
        </div>

        {isEmpty ? (
          /* 空槽：直接顯示品項列表 */
          <div>
            <div className="text-xs text-slate-400 mb-3">選擇要裝備的品項：</div>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
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
                      {slotDef.stat === "hp"
                        ? `❤️ HP +${(idx + 1) * 5}`
                        : slotDef.stat === "atk"
                          ? `⚔️ ATK +${idx + 1}`
                          : `🛡️ DEF +${idx + 1}`
                      }
                    </div>
                  </div>
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
                    <div className="font-bold text-slate-300 mb-2">升級材料需求</div>

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

                    {/* 一般材料 */}
                    {cost.materials.map(m => {
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

                    {/* 關鍵材料 */}
                    {cost.keyItem && (() => {
                      const mat  = MATERIALS.find(x => x.id === cost.keyItem.id);
                      const has  = inv[cost.keyItem.id] || 0;
                      const ok   = has >= cost.keyItem.count;
                      const nameColor = RARITY_CONFIG[mat?.rarity]?.color || "#fbbf24";
                      return (
                        <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-700">
                          <span>{mat?.icon || "⭐"}</span>
                          <span style={{ color: nameColor }} className="font-black text-[11px]">
                            {mat?.name || cost.keyItem.id}
                          </span>
                          <span className="ml-auto font-black"
                            style={{ color: ok ? "#86efac" : "#f87171" }}>
                            {has}
                            <span className="text-slate-500 font-normal"> / </span>
                            {cost.keyItem.count}
                          </span>
                        </div>
                      );
                    })()}
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
export default function RPGEquipPanel({ onGoShop }) {
  const { profile } = useAuth();
  const [activeSlot,  setActiveSlot]  = useState(null);
  const [upgrading,   setUpgrading]   = useState(false);
  const [msg,         setMsg]         = useState("");
  const [upgradeErr,  setUpgradeErr]  = useState("");
  const [rawItems,    setRawItems]    = useState([]);
  const [matInv,      setMatInv]      = useState({});

  useEffect(() => subscribeEquipItems(setRawItems), []);
  useEffect(() => {
    if (!profile?.id) return;
    return subscribeMaterials(profile.id, setMatInv);
  }, [profile?.id]); // eslint-disable-line

  // 轉成 { slotId: [...items] } 的 map，方便子元件查找
  const itemsMap = rawItems.reduce((acc, item) => {
    if (!acc[item.slotId]) acc[item.slotId] = [];
    acc[item.slotId].push(item);
    return acc;
  }, {});

  const equipment = profile?.rpgEquip || {};
  const bonus     = calcEquipBonus(equipment);

  function showMsg(text) {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  }

  async function handleEquip(itemId) {
    if (!activeSlot || !profile?.id) return;
    const cur = equipment[activeSlot.id];
    // 每次都用 dot notation，確保不覆蓋其他槽位
    if (cur?.itemId) {
      await changeEquipBrand(profile.id, activeSlot.id, itemId);
    } else {
      await equipItem(profile.id, activeSlot.id, itemId);
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
    setUpgrading(true);
    setUpgradeErr("");
    const result = await upgradeEquipSlot(profile.id, activeSlot.id);
    setUpgrading(false);
    if (result.ok) {
      const upgraded = result.upgraded;
      showMsg(upgraded
        ? `🎉 升品！→ ${EQUIP_GRADES.find(g => g.id === result.newGrade)?.name}`
        : `✅ 升至 +${result.newPlusLevel}`);
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
      <div className="flex gap-2 mb-4 px-1">
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
      </div>

      {/* 各槽位分區顯示 */}
      {STAT_SECTIONS.map(sec => (
        <div key={sec.stat} className={`mb-4 rounded-xl p-3 border ${sec.border} ${sec.bg}`}>
          <div className={`text-xs font-black mb-2 ${sec.color}`}>{sec.label}</div>
          <div className="flex flex-col gap-1.5">
            {EQUIP_SLOT_DEFS.filter(s => s.stat === sec.stat).map(slotDef => (
              <SlotCard
                key={slotDef.id}
                slotDef={slotDef}
                equipped={equipment[slotDef.id] || null}
                onClick={() => setActiveSlot(slotDef)}
                onGoShop={onGoShop}
                itemsMap={itemsMap}
              />
            ))}
          </div>
        </div>
      ))}

      {/* 訊息提示 */}
      {msg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
          bg-slate-800 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg
          border border-slate-600">
          {msg}
        </div>
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
        />
      )}
    </div>
  );
}
