// src/components/member/MemberBowSettings.jsx — 學生自訂裝備設定頁
import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  EquipmentManager, ArmorManager, AccessoryManager,
  normalizeEquipment, normalizeArmor, normalizeAccessory,
} from "../shared/Equipment";
import { updateMember } from "../../lib/db";

const TABS = [
  { id:"bow",       label:"🏹 弓具" },
  { id:"armor",     label:"🛡️ 防具" },
  { id:"accessory", label:"🔧 配件" },
];

export default function MemberBowSettings({ onBack }) {
  const { profile } = useAuth();

  const [tab,       setTab]       = useState("bow");
  const [eq,        setEq]        = useState(() => normalizeEquipment(profile?.equipment));
  const [armorSets, setArmorSets] = useState(() => normalizeArmor(profile?.armorSets));
  const [accSets,   setAccSets]   = useState(() => normalizeAccessory(profile?.accessorySets));
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  async function save() {
    setSaving(true);
    await updateMember(profile.id, {
      equipment:      eq,
      armorSets:      armorSets,
      accessorySets:  accSets,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  }

  return (
    <div className="min-h-full" style={{ background:"var(--bg-deep)" }}>
      {/* 頁首 */}
      <div className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 flex items-center gap-3"
        style={{ background:"var(--bg-surface)" }}>
        <button onClick={onBack} className="text-gray-400 text-xl leading-none px-1">←</button>
        <div className="font-black text-gray-100 text-base flex-1">🏹 我的弓具設定</div>
        <button onClick={save} disabled={saving}
          className={`px-4 py-1.5 rounded-full text-sm font-black transition-all ${
            saved
              ? "bg-emerald-500 text-white"
              : "bg-indigo-600 text-white active:scale-95"
          } disabled:opacity-50`}>
          {saving ? "儲存中…" : saved ? "✓ 已儲存" : "儲存"}
        </button>
      </div>

      {/* 分頁切換 */}
      <div className="flex border-b border-white/10 px-4 gap-1 bg-white/5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`py-2.5 px-3 text-sm font-bold border-b-2 transition-colors ${
              tab === t.id
                ? "border-indigo-400 text-indigo-300"
                : "border-transparent text-gray-400"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 內容 */}
      <div className="p-4">
        {tab === "bow"       && <EquipmentManager  value={eq}        onChange={setEq}        />}
        {tab === "armor"     && <ArmorManager      value={armorSets} onChange={setArmorSets} />}
        {tab === "accessory" && <AccessoryManager  value={accSets}   onChange={setAccSets}   />}
      </div>
    </div>
  );
}
