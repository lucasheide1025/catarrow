import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { normalizeEquipment } from "./Equipment";
import {
  BATTLE_BOW_OPTIONS,
  BATTLE_DISTANCE_OPTIONS,
  loadBattleShootingProfile,
  saveBattleShootingProfile,
} from "../../lib/battlePractice";

export default function BattleShootingProfile({ memberId }) {
  const { profile: authProfile } = useAuth();
  const [shootingProfile, setShootingProfile] = useState(() => loadBattleShootingProfile(memberId));

  function update(patch) {
    setShootingProfile(saveBattleShootingProfile(memberId, patch));
  }

  // bowType 維持分類供練習分析使用；bowId 則精確記錄玩家選用的裝備組。
  const myEquip = normalizeEquipment(authProfile?.equipment);
  const defaultEquip = myEquip.find(set => set.isDefault) || myEquip[0];
  const bowOptions = myEquip.length
    ? myEquip.map(set => ({
        value:`equipment:${set.id}`,
        bowType:set.bowCategory,
        label:`${set.isDefault ? "★ 預設 · " : ""}${set.label || "未命名弓組"}`,
      }))
    : BATTLE_BOW_OPTIONS.map(option => ({ value:`category:${option.value}`, bowType:option.value, label:option.label }));
  const selectedBowValue = myEquip.some(set => set.id === shootingProfile.bowId)
    ? `equipment:${shootingProfile.bowId}`
    : (defaultEquip ? `equipment:${defaultEquip.id}` : `category:${shootingProfile.bowType}`);

  return (
    <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-black text-blue-200">🏹 個人射擊設定</span>
        <span className="text-[10px] text-white/35">自動沿用</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] font-bold text-white/50">
          弓種
          <select value={selectedBowValue} onChange={event => {
            const selected = bowOptions.find(option => option.value === event.target.value);
            if (!selected) return;
            update({ bowId:event.target.value.startsWith("equipment:") ? event.target.value.slice(10) : "", bowType:selected.bowType });
          }}
            className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900 px-2 py-2 text-xs font-bold text-white">
            {bowOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-bold text-white/50">
          實際距離
          <select value={shootingProfile.distance} onChange={event => update({ distance:Number(event.target.value) })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900 px-2 py-2 text-xs font-bold text-white">
            {BATTLE_DISTANCE_OPTIONS.map(distance => (
              <option key={distance} value={distance}>{distance}m</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
