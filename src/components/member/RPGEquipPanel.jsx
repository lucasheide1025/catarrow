// src/components/member/RPGEquipPanel.jsx — RPG 裝備面板
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { equipItem, changeEquipBrand, unequipSlot, upgradeEquipSlot, saveEquipNextMats, subscribeEquipItems, subscribeMaterials, setEquipSocketRune, trySocketEquip } from "../../lib/db";
import { EQUIP_GRADES, EQUIP_SLOT_DEFS, calcEquipBonus, getEquipSlotBonus } from "../../lib/constants";
import { MATERIALS, RARITY_CONFIG } from "../../lib/monsterMaterials";
import { MATERIAL_BY_ID as EXPANSION_MATERIAL_BY_ID } from "../../lib/monsterEconomyCatalog";
import { EQUIP_UPGRADE_COST, GRADE_PREFIX, generateRandomMats, isMatsCurveCurrent, KING_SEAL_BREAKTHROUGH_COST } from "../../lib/equipData";
import { sfxLevelUp } from "../../lib/sound";
import EquipmentIcon from "../shared/EquipmentIcon";
import { EQUIPMENT_RUNES, getEquipmentRune, getEquipmentRuneBonus } from "../../lib/equipmentRuneData";

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

function EquipmentSocketControls({ memberId, slotId, equipped, kingSeals, inventory, readOnly }) {
  const [busy, setBusy] = useState("");
  const [picker, setPicker] = useState(null);
  const [notice, setNotice] = useState("");
  const sockets = Array.isArray(equipped?.sockets) ? equipped.sockets : [];
  const gradeIndex = gradeIdx(equipped?.grade);
  const bonus = getEquipmentRuneBonus(sockets);
  const availableRunes = Object.values(EQUIPMENT_RUNES).filter(rune => (inventory?.[rune.id] || 0) > 0);
  const notify = text => { setNotice(text); window.setTimeout(() => setNotice(""), 3200); };

  async function socket() {
    if (readOnly || busy || !memberId) return;
    setBusy("socket");
    const result = await trySocketEquip(memberId, slotId);
    setBusy("");
    notify(result.ok ? (result.success ? `打洞成功，目前 ${result.sockets} 洞` : `打洞失敗，消耗 ${result.sealCost} 枚王之印記；裝備未受損`) : result.reason);
  }

  async function setRune(index, runeId) {
    if (readOnly || busy || !memberId) return;
    setBusy(`rune-${index}`);
    const result = await setEquipSocketRune(memberId, slotId, index, runeId);
    setBusy("");
    if (result.ok) { setPicker(null); notify(runeId ? "符文已鑲嵌" : "符文已卸下並放回背包"); }
    else notify(result.reason);
  }

  return <section className="mb-3 rounded-xl border border-violet-400/25 bg-violet-950/25 p-3">
    <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-black text-violet-100">🔮 打洞與符文鑲嵌</h3><span className="text-[10px] font-bold text-amber-200">👑 {kingSeals || 0}</span></div>
    {notice && <div role="status" className="mt-2 rounded-lg bg-violet-400/10 px-2 py-1.5 text-[10px] font-bold text-violet-100">{notice}</div>}
    <div className="mt-2 flex gap-2">{[0, 1, 2].map(index => {
      const rune = getEquipmentRune(sockets[index]);
      return <button key={index} type="button" disabled={readOnly || index >= sockets.length || Boolean(busy)} onClick={() => setPicker(index)} className="min-h-14 flex-1 whitespace-pre-line rounded-xl border border-dashed border-violet-300/35 bg-black/20 px-1 text-center text-[10px] font-bold text-violet-100 disabled:opacity-45">{index >= sockets.length ? "未開洞" : rune ? `${rune.icon}\nT${rune.tier}` : "空洞\n鑲嵌"}</button>;
    })}</div>
    <div className="mt-2 text-[10px] text-slate-400">符文加成：ATK +{Math.round(bonus.atk * 100)}%／DEF +{Math.round(bonus.def * 100)}%／HP +{Math.round(bonus.hp * 100)}%</div>
    {gradeIndex >= 2 && sockets.length < 3 ? <button type="button" disabled={readOnly || Boolean(busy) || (kingSeals || 0) < sockets.length + 1} onClick={socket} className="mt-3 min-h-10 w-full rounded-xl bg-amber-400 px-3 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{busy === "socket" ? "打洞中…" : `使用 ${sockets.length + 1} 枚王之印記打第 ${sockets.length + 1} 洞（成功率 ${[85, 65, 45][sockets.length]}%）`}</button> : <div className="mt-3 text-[10px] text-slate-500">{sockets.length >= 3 ? "此裝備已開滿 3 洞。" : "精良（Elite）以上裝備才能打洞。"}</div>}
    {picker !== null && <div className="mt-2 rounded-xl border border-violet-300/25 bg-slate-950 p-2"><div className="flex items-center justify-between"><span className="text-[11px] font-black text-white">選擇第 {picker + 1} 洞的符文</span><button type="button" onClick={() => setPicker(null)} className="text-[10px] text-slate-400">關閉</button></div><button type="button" onClick={() => setRune(picker, null)} className="mt-2 min-h-9 w-full rounded-lg border border-white/10 px-2 text-left text-[11px] font-bold text-slate-300">卸下符文，放回背包</button>{availableRunes.map(rune => <button key={rune.id} type="button" onClick={() => setRune(picker, rune.id)} className="mt-2 min-h-9 w-full rounded-lg border border-violet-300/20 bg-violet-400/10 px-2 text-left text-[11px] font-bold text-violet-100">{rune.icon} {rune.name} T{rune.tier} ×{inventory[rune.id]}</button>)}</div>}
  </section>;
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
            <span className="grid size-14 place-items-center rounded-2xl border border-slate-700/50 bg-slate-900/60 opacity-40">
              <EquipmentIcon slotId={slotDef.id} size={52} />
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
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl border bg-black/20"
            style={{ borderColor: `${gStyle.color}45` }}>
            <EquipmentIcon slotId={slotDef.id} size={52} />
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
          <div className="mx-auto grid size-24 place-items-center rounded-3xl border bg-black/20"
            style={{ borderColor: `${result.gradeColor}80` }}>
            <EquipmentIcon slotId={result.slotId} size={88} />
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

// 材料中繼資料查詢：先查 legacy MATERIALS，查不到再查擴充素材清冊。
// 沒有這層的話，擴充素材（mat_ghost_t5_mini_a 之類）會直接把原始 id 顯示給玩家。
function resolveMatMeta(id) {
  const legacy = MATERIALS.find(x => x.id === id);
  if (legacy) return legacy;
  const expansion = EXPANSION_MATERIAL_BY_ID[id];
  if (!expansion) return null;
  return {
    id: expansion.id,
    name: expansion.name,
    icon: expansion.kind === "boss" ? "👑" : expansion.kind === "miniBoss" ? "🔱" : "🧱",
    rarity: null,
  };
}

// ── 裝備選擇 Modal ─────────────────────────────────────────
function EquipModal({ slotDef, equipped, onEquip, onUnequip, onUpgrade, onClose, upgrading, itemsMap, matInv, coins, kingSeals, runeInventory, memberId, readOnly, upgradeErr, nextMats, equipMaxGradeAllowed = 99 }) {
  const [tab, setTab] = useState("info"); // "info" | "change"
  const isEmpty   = !equipped?.itemId;
  const grade     = equipped?.grade     || "common";
  const plus      = equipped?.plusLevel || 0;
  const idx       = gradeIdx(grade);
  const isMax     = idx >= (equipMaxGradeAllowed ?? (EQUIP_GRADES.length - 1)) && plus >= 4;
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
  const sealCost = plus >= 4 && nextGrade ? (KING_SEAL_BREAKTHROUGH_COST[nextGrade] || 0) : 0;
  const sealsOk = kingSeals >= sealCost;
  const gradeTooHigh = (equipMaxGradeAllowed ?? 99) < (idx + (plus >= 4 ? 1 : 0));
  const canUpgrade = !gradeTooHigh && coinsOk && matsOk && keyOk && sealsOk;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-0"
      onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="equip-dialog-title"
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-slate-900 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] overscroll-contain"
        onClick={e => e.stopPropagation()}>

        {/* 標題 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <EquipmentIcon slotId={slotDef.id} size={34} />
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
                <EquipmentSocketControls
                  memberId={memberId}
                  slotId={slotDef.id}
                  equipped={equipped}
                  kingSeals={kingSeals}
                  inventory={runeInventory}
                  readOnly={readOnly}
                />

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
                      const mat  = resolveMatMeta(m.id);
                      const has  = inv[m.id] || 0;
                      const ok   = has >= m.count;
                      const nameColor = RARITY_CONFIG[mat?.rarity]?.color || (m.note ? "#fbbf24" : "#9ca3af");
                      return (
                        <div key={m.id} className="flex items-center gap-1.5 mb-1">
                          <span>{mat?.icon || (m.note ? "👑" : "🪨")}</span>
                          <span style={{ color: nameColor }} className="font-bold text-[11px]">
                            {mat?.name || m.id}
                            {m.note && <span className="ml-1 text-[9px] text-amber-400/80">（{m.note}）</span>}
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
                      const mat  = resolveMatMeta(mats.keyItem.id);
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

                    {sealCost > 0 && (
                      <div className={`flex items-center justify-between rounded-xl px-3 py-2 border ${sealsOk ? "bg-amber-400/10 border-amber-300/25" : "bg-red-500/10 border-red-400/25"}`}>
                        <span className="text-xs font-black text-amber-200">👑 王之印記（突破至 {gradeName(nextGrade)}）</span>
                        <span className={`text-sm font-black ${sealsOk ? "text-amber-300" : "text-red-300"}`}>{kingSeals}/{sealCost}</span>
                      </div>
                    )}

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
                      {upgrading ? "升級中…" : canUpgrade ? `⬆️ 升級 +${plus + 1}` : sealsOk ? "材料或金幣不足" : "王之印記不足"}
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
  // openSlot 重算材料需求是非同步寫入。若玩家一開面板就馬上升級，那筆寫入可能
  // 「晚於」升級交易才落地，把升級後產生的新需求覆蓋回舊的 —— 表現就是精煉沒
  // 吃到新材料。升級前先等這筆寫入完成，race 就消失。
  const pendingMatsSaveRef = useRef(null);
  // 訪客可裝備/更換品項，並可強化至稀有（含）以下；兒童維持唯讀
  const isGuestEquipReadOnly = false; // 訪客/兒童皆可操作裝備

  useEffect(() => subscribeEquipItems(setRawItems), []);

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
    if (equip?.nextMats && isMatsCurveCurrent(equip.nextMats, equip.grade || "common", equip.plusLevel || 0)) {
      setDisplayNextMats(equip.nextMats);
    } else if (equip?.itemId) {
      // 舊資料/舊曲線格式 或 首次裝備：依目前曲線重算並存回 Firestore（一次性收斂）
      const mats = generateRandomMats(equip.grade || "common", equip.plusLevel || 0);
      setDisplayNextMats(mats);
      pendingMatsSaveRef.current = saveEquipNextMats(profile.id, slotDef.id, mats);
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
      // 首次裝備：產生初始隨機材料需求（common +0）
      const mats = generateRandomMats("common", 0);
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
    // 先確保 openSlot 那筆材料需求寫入已落地，避免它覆蓋升級後的新需求
    if (pendingMatsSaveRef.current) {
      await pendingMatsSaveRef.current;
      pendingMatsSaveRef.current = null;
    }
    const result = await upgradeEquipSlot(profile.id, slotDef.id, {
      equip:    currentEquip,
      coins:    profile.coins || 0,
      kingSeals: profile.kingSeals || 0,
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
        slotId: slotDef.id,
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
          kingSeals={profile?.kingSeals || 0}
          runeInventory={profile?.equipmentRuneInventory || {}}
          memberId={profile?.id}
          readOnly={isGuestEquipReadOnly}
          upgradeErr={upgradeErr}
          nextMats={displayNextMats}
        />
      )}
    </div>
  );
}
