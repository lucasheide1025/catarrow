// src/components/dungeon/GuestDungeonEntry.jsx
// 訪客/兒童專屬：T1/T2 難度挑選（不經過挖掘機制，就地生成 dungeon 物件，不寫入 pendingReveal/savedDungeons）
// 見 .trellis/tasks/07-10-guest-kid-dungeon-parity/design.md §3（難度封頂第一層）
import { useState } from "react";
import { drawExpeditionBoss } from "../../lib/monsterData";
import { getExcavationDifficulty } from "../../lib/dungeonData";

// 比照 dungeonExcavation.js::claimAutoDig 既有的族系清單/隨機挑選寫法
const GUEST_FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple"];

function pickTier(requested, tierCap) {
  const cap = Math.max(1, tierCap || 2);
  return Math.min(Math.max(1, requested), cap);
}

export default function GuestDungeonEntry({ tierCap = 2, onSelect }) {
  const [picking, setPicking] = useState(false);
  const maxTier = Math.max(1, Math.min(2, tierCap || 2));
  const tiers = Array.from({ length: maxTier }, (_, i) => i + 1);

  function handlePick(requestedTier) {
    if (picking) return;
    setPicking(true);
    const tier = pickTier(requestedTier, tierCap);
    const family = GUEST_FAMILIES[Math.floor(Math.random() * GUEST_FAMILIES.length)];
    const boss = drawExpeditionBoss(tier, family);
    onSelect({
      id: null,
      savedId: null,
      family,
      difficulty: tier,
      boss,
      isHidden: false,
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 text-center"
        style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)" }}>
        <div className="text-4xl mb-2">🗺️</div>
        <div className="text-lg font-black text-white mb-1">選擇挑戰難度</div>
        <div className="text-xs" style={{ color:"var(--text-secondary)" }}>
          闖過三層地下城，最後迎戰守關首領
        </div>
      </div>

      <div className="space-y-3">
        {tiers.map(tier => {
          const diff = getExcavationDifficulty(tier);
          return (
            <button
              key={tier}
              onClick={() => handlePick(tier)}
              disabled={picking}
              className="w-full rounded-2xl p-4 text-left border transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                background:`${diff?.color || "#94a3b8"}14`,
                borderColor:`${diff?.color || "#94a3b8"}40`,
              }}
            >
              <div className="flex items-center gap-4">
                <div className="text-3xl">{diff?.icon || "🗡️"}</div>
                <div>
                  <div className="text-base font-black text-white">{diff?.label || `Lv.${tier}`}</div>
                  <div className="text-xs mt-0.5" style={{ color:"var(--text-secondary)" }}>
                    {tier === 1 ? "適合新手，難度最低" : "稍具挑戰性的下一階段"}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {picking && (
        <div className="text-center text-xs font-bold" style={{ color:"var(--text-muted)" }}>
          準備地下城中…
        </div>
      )}
    </div>
  );
}
