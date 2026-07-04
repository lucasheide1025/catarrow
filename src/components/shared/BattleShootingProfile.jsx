import { useState } from "react";
import {
  BATTLE_BOW_OPTIONS,
  BATTLE_DISTANCE_OPTIONS,
  loadBattleShootingProfile,
  saveBattleShootingProfile,
} from "../../lib/battlePractice";

export default function BattleShootingProfile({ memberId }) {
  const [profile, setProfile] = useState(() => loadBattleShootingProfile(memberId));

  function update(patch) {
    setProfile(saveBattleShootingProfile(memberId, patch));
  }

  return (
    <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-black text-blue-200">🏹 個人射擊設定</span>
        <span className="text-[10px] text-white/35">自動沿用</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] font-bold text-white/50">
          弓種
          <select value={profile.bowType} onChange={event => update({ bowType:event.target.value })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900 px-2 py-2 text-xs font-bold text-white">
            {BATTLE_BOW_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-bold text-white/50">
          實際距離
          <select value={profile.distance} onChange={event => update({ distance:Number(event.target.value) })}
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
