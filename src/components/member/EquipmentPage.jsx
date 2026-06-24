// src/components/member/EquipmentPage.jsx — 裝備系統獨立頁面
import { useAuth } from "../../hooks/useAuth";
import { EQUIP_GRADES, EQUIP_SLOT_DEFS, calcEquipBonus } from "../../lib/constants";
import { GRADE_PREFIX } from "../../lib/equipData";
import RPGEquipPanel from "./RPGEquipPanel";

export default function EquipmentPage({ onPageChange }) {
  const { profile } = useAuth();
  const equipment = profile?.rpgEquip || {};
  const bonus     = calcEquipBonus(equipment);
  const equipped  = EQUIP_SLOT_DEFS.filter(s => equipment[s.id]?.itemId).length;

  return (
    <div className="min-h-full bg-slate-950 text-white">
      {/* 頁首 */}
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-black text-base tracking-wide">⚔️ 裝備系統</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              裝備 {equipped}/10 格 · 提升戰鬥屬性
            </div>
          </div>
          {/* 屬性摘要 */}
          <div className="flex gap-1.5">
            {[
              { label: "ATK", val: bonus.atkBonus, color: "#fb923c" },
              { label: "DEF", val: bonus.defBonus, color: "#60a5fa" },
              { label: "HP",  val: bonus.hpBonus,  color: "#4ade80" },
            ].map(({ label, val, color }) => (
              <div key={label} className="text-center bg-slate-800/80 rounded-lg px-2 py-1">
                <div style={{ fontSize: 8, color: "#64748b" }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 900, color }}>+{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 說明列 */}
      <div className="px-4 py-2.5 bg-indigo-950/40 border-b border-indigo-900/30">
        <div className="text-[11px] text-indigo-300 leading-relaxed">
          📌 裝備從 <span className="font-black text-yellow-400">金幣商店</span> 購買，初始為【普通】品級。
          升級消耗材料與金幣，品級越高屬性加成越大。
        </div>
      </div>

      {/* 裝備面板 */}
      <div className="p-4">
        <RPGEquipPanel onGoShop={onPageChange ? () => onPageChange("coinshop") : null} />
      </div>

      {/* 品級說明 */}
      <div className="px-4 pb-8">
        <div className="text-[10px] text-slate-600 font-bold mb-2">品級與加成對照</div>
        <div className="grid grid-cols-3 gap-1.5">
          {EQUIP_GRADES.map((g, i) => (
            <div key={g.id} className="rounded-lg px-2.5 py-1.5 bg-slate-900 border border-slate-800">
              <div className="font-black text-xs" style={{ color: g.color }}>
                {GRADE_PREFIX[g.id]?.replace(/[【】]/g, "") || g.name}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                ATK/DEF +{i + 1} · HP +{(i + 1) * 5}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
