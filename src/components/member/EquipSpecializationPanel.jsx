// src/components/member/EquipSpecializationPanel.jsx — 裝備專精：解鎖/升級/切換/效果顯示（PRD Phase 7）
// 資料：equipSpecializations/{memberId}（equipSpecializationDb）;素材：materialInventory。
// 戰鬥端效果套用（applyWeapon/Armor/AccessorySpecialization）另批接線。

import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import {
  SPECIALIZATION_TRACKS, SPECIALIZATION_UNLOCK_COST, getSpecializationUpgradeCost, getSpecializationAttemptChance,
} from "../../lib/equipmentSpecializationCatalog";
import { getSpecializationEffect } from "../../lib/equipmentSpecializationEngine";
import {
  getEquipSpecializations, unlockSpecializationTrack, setActiveSpecialization,
  attemptSpecializationUpgrade, summarizeMaterialsForSpec,
} from "../../lib/equipSpecializationDb";
import { sfxBuff, sfxError, sfxLevelUp, sfxTap } from "../../lib/sound";

const SLOTS = [
  { id: "weapon", label: "🏹 武器專精", color: "#f59e0b" },
  { id: "armor", label: "🛡️ 防具專精", color: "#38bdf8" },
  { id: "accessory", label: "💍 飾品專精", color: "#a78bfa" },
];

function effectText(trackId, level) {
  const e = getSpecializationEffect(trackId, level);
  switch (trackId) {
    case "precision": return `高品質命中傷害 +${e.highQualityDamagePct}%`;
    case "armorBreak": return `無視怪物防禦 ${e.defenseIgnorePct}%`;
    case "bossHunter": return `對王類傷害 +${e.bossDamagePct}%`;
    case "tenacity": return `受到傷害 -${e.finalDamageReductionPct}%`;
    case "immunity": return `異常強度 -${e.statusStrengthReductionPct}%${e.statusDurationReduction ? `、回合 -${e.statusDurationReduction}` : ""}`;
    case "guard": return `HP≤35% 時受傷 -${e.finalDamageReductionPct}%`;
    case "nutrition": return `最大 HP +${e.maxHpFlat}`;
    case "wellRested": return `回合末回復 ${e.endRoundHeal} HP`;
    case "support": return `貓咪攻擊/治療 +${e.companionAttackPct}%`;
    default: return "";
  }
}

export default function EquipSpecializationPanel() {
  const { profile } = useAuth();
  const memberId = profile?.id;
  const coins = profile?.coins || 0;
  const [spec, setSpec] = useState(null);
  const [materials, setMaterials] = useState({ byTier: {}, miniBoss: 0, boss: 0 });
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null); // {text, tone}

  const reload = useCallback(async () => {
    if (!memberId) return;
    const [specData, inventorySnap] = await Promise.all([
      getEquipSpecializations(memberId),
      getDoc(doc(db, "materialInventory", memberId)).catch(() => null),
    ]);
    setSpec(specData);
    setMaterials(summarizeMaterialsForSpec(inventorySnap?.exists() ? inventorySnap.data().items || {} : {}));
  }, [memberId]);

  useEffect(() => { reload(); }, [reload]);

  const flash = (text, tone = "ok") => {
    setNotice({ text, tone });
    setTimeout(() => setNotice(null), 3200);
  };

  async function handleUnlock(trackId) {
    if (busy) return;
    setBusy(trackId); sfxTap();
    const result = await unlockSpecializationTrack(memberId, trackId);
    setBusy("");
    if (!result.ok) { sfxError(); flash(result.reason, "err"); return; }
    sfxBuff(); flash("已解鎖專精！");
    reload();
  }

  async function handleActivate(trackId) {
    if (busy) return;
    setBusy(trackId); sfxTap();
    const result = await setActiveSpecialization(memberId, trackId);
    setBusy("");
    if (!result.ok) { sfxError(); flash(result.reason, "err"); return; }
    setSpec(result.spec);
    flash("已切換啟用專精");
  }

  async function handleUpgrade(trackId) {
    if (busy) return;
    setBusy(trackId); sfxTap();
    const result = await attemptSpecializationUpgrade(memberId, trackId);
    setBusy("");
    if (!result.ok) { sfxError(); flash(result.reason, "err"); return; }
    if (result.success) { sfxLevelUp(); flash(`升級成功！Lv.${result.targetLevel}`); }
    else { sfxError(); flash(`升級失敗（成功率 ${Math.round(result.chance * 100)}%）…材料已消耗,連續失敗會提高下次成功率`, "warn"); }
    reload();
  }

  if (!memberId) return null;

  return (
    <section className="mt-4 rounded-2xl border border-amber-400/20 bg-slate-900/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-black text-amber-300">⚒️ 裝備專精</h3>
        <span className="text-[11px] text-slate-400">🪙 {coins.toLocaleString()}</span>
      </div>
      <div className="mt-1 text-[11px] leading-relaxed text-slate-400">
        每條專精 🪙 {SPECIALIZATION_UNLOCK_COST.toLocaleString()} 解鎖;升級消耗金幣＋打怪素材,失敗也會扣（連敗 3 次後下一次必成功）。每個部位同時只能啟用一條。
      </div>
      {/* 素材摘要 */}
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-300">
        {[1, 2, 3, 4, 5, 6].map(tier => (
          <span key={tier} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">T{tier}×{materials.byTier[tier] || 0}</span>
        ))}
        <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5">小王×{materials.miniBoss}</span>
        <span className="rounded-full border border-rose-400/25 bg-rose-500/10 px-2 py-0.5">大王×{materials.boss}</span>
      </div>
      {notice && (
        <div className={`mt-2 rounded-lg px-3 py-2 text-[11px] font-bold ${
          notice.tone === "err" ? "bg-rose-500/15 text-rose-300"
          : notice.tone === "warn" ? "bg-amber-500/15 text-amber-300"
          : "bg-emerald-500/15 text-emerald-300"}`}>
          {notice.text}
        </div>
      )}

      {SLOTS.map(slot => {
        const slotState = spec?.[slot.id] || { activeTrackId: null, tracks: {} };
        return (
          <div key={slot.id} className="mt-3">
            <div className="text-xs font-black" style={{ color: slot.color }}>{slot.label}</div>
            <div className="mt-1.5 space-y-1.5">
              {SPECIALIZATION_TRACKS.filter(track => track.slot === slot.id).map(track => {
                const state = slotState.tracks[track.id];
                const level = state?.level || 0;
                const isActive = slotState.activeTrackId === track.id;
                const nextCost = state && level < 10
                  ? getSpecializationUpgradeCost({ trackId: track.id, targetLevel: level + 1 })
                  : null;
                const chance = state && level < 10
                  ? getSpecializationAttemptChance({ trackId: track.id, targetLevel: level + 1, consecutiveFailures: state.failCount || 0 })
                  : 0;
                return (
                  <div key={track.id} className={`rounded-xl border p-2.5 ${isActive ? "border-emerald-400/40 bg-emerald-500/5" : "border-white/10 bg-white/[.03]"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-100">{track.name}</span>
                      {state && <span className="text-[10px] font-bold text-amber-300">Lv.{level}</span>}
                      {isActive && <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">啟用中</span>}
                      {state && (state.failCount || 0) > 0 && <span className="text-[9px] text-rose-300">連敗 {state.failCount}</span>}
                      <span className="flex-1" />
                      {state && !isActive && (
                        <button onClick={() => handleActivate(track.id)} disabled={!!busy}
                          className="rounded-lg border border-emerald-400/40 px-2 py-1 text-[10px] font-bold text-emerald-300 active:scale-95 disabled:opacity-40">
                          啟用
                        </button>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {level > 0 ? `目前：${effectText(track.id, level)}` : "尚未升級"}
                      {level < 10 && <span className="text-slate-500">｜下一級：{effectText(track.id, level + 1)}</span>}
                    </div>
                    {!state ? (
                      <button onClick={() => handleUnlock(track.id)} disabled={!!busy || coins < SPECIALIZATION_UNLOCK_COST}
                        className="mt-1.5 w-full rounded-lg bg-amber-500/90 py-1.5 text-[11px] font-black text-slate-900 active:scale-95 disabled:opacity-40">
                        🔓 解鎖（🪙 {SPECIALIZATION_UNLOCK_COST.toLocaleString()}）
                      </button>
                    ) : level < 10 && nextCost ? (
                      <button onClick={() => handleUpgrade(track.id)} disabled={busy === track.id}
                        className="mt-1.5 w-full rounded-lg border border-amber-400/40 bg-amber-500/10 py-1.5 text-[11px] font-black text-amber-300 active:scale-95 disabled:opacity-40">
                        ⬆️ 升級 Lv.{level + 1}（🪙 {nextCost.coins.toLocaleString()}
                        {nextCost.tierMaterials.map(item => `｜T${item.tierIndex}×${item.total}`).join("")}
                        {nextCost.bossMaterial ? `｜${nextCost.bossMaterial.kind === "boss" ? "大王" : "小王"}素材×${nextCost.bossMaterial.quantity}` : ""}
                        ）成功率 {Math.round(chance * 100)}%
                      </button>
                    ) : (
                      <div className="mt-1.5 text-center text-[10px] font-bold text-emerald-300">✨ 已達最高等級</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
