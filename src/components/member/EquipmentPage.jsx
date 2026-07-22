// src/components/member/EquipmentPage.jsx — 裝備系統獨立頁面
import { useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  EQUIP_GRADES,
  EQUIP_SLOT_DEFS,
  calcEquipBonus,
  getEquipSlotBonus,
} from "../../lib/constants";
import { GRADE_PREFIX } from "../../lib/equipData";
import RPGEquipPanel from "./RPGEquipPanel";
import EquipmentRunePanel from "./EquipmentRunePanel";
import EquipSpecializationPanel from "./EquipSpecializationPanel";
import { isMonsterExpansionEnabled } from "../../lib/monsterExpansionFeature";
import GuestEquipmentShop from "./GuestEquipmentShop";

export default function EquipmentPage({ onPageChange, guestProfile }) {
  const guestShopRef = useRef(null);
  const { profile: authProfile } = useAuth();
  const profile = guestProfile || authProfile;
  const equipment = profile?.rpgEquip || {};
  const bonus     = calcEquipBonus(equipment);
  const equipped  = EQUIP_SLOT_DEFS.filter(s => equipment[s.id]?.itemId).length;
  const completionPct = Math.round(equipped / EQUIP_SLOT_DEFS.length * 100);
  const expansionEnabled = isMonsterExpansionEnabled();
  function goToShop() {
    if (!guestProfile) { onPageChange?.("coinshop"); return; }
    guestShopRef.current?.scrollIntoView({ behavior:"smooth", block:"start" });
    guestShopRef.current?.focus({ preventScroll:true });
  }
  const statCards = [
    { icon:"⚔️", label:"攻擊加成", short:"ATK", val:bonus.atkBonus, color:"#fb923c", bg:"rgba(249,115,22,0.12)" },
    { icon:"🛡️", label:"防禦加成", short:"DEF", val:bonus.defBonus, color:"#60a5fa", bg:"rgba(59,130,246,0.12)" },
    { icon:"❤️", label:"生命加成", short:"HP", val:bonus.hpBonus, color:"#4ade80", bg:"rgba(34,197,94,0.12)" },
  ];

  return (
    <div className="min-h-full text-white" style={{backgroundImage:"linear-gradient(180deg,rgba(3,8,20,.78),rgba(3,8,20,.96)),url(/ui/page-bg.webp)",backgroundSize:"cover",backgroundPosition:"center",backgroundAttachment:"fixed"}}>
      {/* 頁首 */}
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          {onPageChange && (
            <button type="button" onClick={() => onPageChange("inventory-hub")}
              className="min-h-11 rounded-xl px-2 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70">
              ← 返回
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-black text-base tracking-wide">⚔️ 我的裝備</h1>
            <div className="text-[11px] text-slate-500 mt-0.5">
              已裝備 {equipped}/{EQUIP_SLOT_DEFS.length} 格
            </div>
          </div>
        </div>
      </div>

      <main className="px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <section className="rounded-3xl border border-sky-300/20 bg-gradient-to-br from-slate-900/90 to-indigo-950/75 p-4 shadow-2xl backdrop-blur-md" style={{position:"relative",overflow:"hidden"}}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black">目前裝備加成</h2>
              <p className="mt-1 text-[11px] text-slate-400">直接加到射手的戰鬥 HP、ATK 與 DEF。</p>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-indigo-300">{completionPct}%</div>
              <div className="text-[10px] text-slate-500">槽位完成度</div>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-[width] duration-500"
              style={{ width:`${completionPct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {statCards.map(stat => (
              <div key={stat.short} className="rounded-xl border border-white/10 px-2 py-3 text-center"
                style={{ background:stat.bg }}>
                <div className="text-base" aria-hidden="true">{stat.icon}</div>
                <div className="mt-1 text-[10px] text-slate-400">{stat.label}</div>
                <div className="text-xl font-black tabular-nums" style={{ color:stat.color }}>+{stat.val}</div>
              </div>
            ))}
          </div>
          {equipped === 0 && (
            <button type="button" onClick={goToShop}
              className="mt-4 min-h-11 w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-200">
              {guestProfile ? "前往基礎裝備商店取得第一件裝備" : "前往金幣商店取得第一件裝備"}
            </button>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-indigo-400/20 bg-indigo-950/30 p-4">
          <h2 className="text-sm font-black text-indigo-200">加成如何計算？</h2>
          <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-300">
            <p>1. 品級決定基礎值：普通 +1，之後每升一品增加 +5。</p>
            <p>2. 強化等級直接加算：例如稀有 +3 為 6 + 3 = 9。</p>
            <p>3. 生命裝備的結果再乘以 5；品牌只影響名稱與外觀，不影響數值。</p>
            <p>4. 強化達 +5 時自動升品，並從新一品的 +0 開始。</p>
          </div>
        </section>

        {/* 裝備面板 */}
        <div className="mt-4">
          <RPGEquipPanel
            showSummary={false}
            guestProfile={guestProfile}
            onGoShop={goToShop}
          />
        </div>
        {guestProfile ? <div ref={guestShopRef} tabIndex={-1} aria-label="基礎裝備商店" className="scroll-mt-20 focus:outline-none"><GuestEquipmentShop profile={profile} /></div> : null}

      {/* 品級說明 */}
        <EquipmentRunePanel profile={profile} readOnly={Boolean(guestProfile)} />

        {/* 裝備專精（訪客不顯示;DLC Phase 7） */}
        {!guestProfile && expansionEnabled ? <EquipSpecializationPanel /> : null}

      <section className="mt-1">
        <h2 className="text-xs text-slate-400 font-bold mb-2">品級基礎加成</h2>
        <div className="grid grid-cols-3 gap-1.5">
          {EQUIP_GRADES.map(g => {
            const standard = getEquipSlotBonus("atk", { grade:g.id, plusLevel:0 });
            const hp = getEquipSlotBonus("hp", { grade:g.id, plusLevel:0 });
            return (
            <div key={g.id} className="rounded-lg px-2.5 py-1.5 bg-slate-900 border border-slate-800">
              <div className="font-black text-xs" style={{ color: g.color }}>
                {GRADE_PREFIX[g.id]?.replace(/[【】]/g, "") || g.name}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                ATK/DEF +{standard} · HP +{hp}
              </div>
            </div>
          );})}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
          表格為 +0 數值；每次強化會再提高 ATK／DEF +1 或 HP +5。
        </p>
      </section>
      </main>
    </div>
  );
}
