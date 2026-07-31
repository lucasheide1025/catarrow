// src/worldboss/domain/raidPhases.js
// 三階段：每階段換一組被護住的部位，強迫所有人改變宣告。
// 為什麼要階段：不然戰鬥中段就是重複勞動——選同一個部位按 30 次。

export const WB_PHASES = Object.freeze([
  {
    id: 1, roman: "I", hpFrom: 1.00, hpTo: 0.66,
    blocked: [], gaugeMult: 1.0, tint: null,
    name: "現身", flavor: "牠還在打量你們。",
  },
  {
    id: 2, roman: "II", hpFrom: 0.66, hpTo: 0.33,
    blocked: ["eye"], gaugeMult: 1.0, tint: "violet",
    name: "戒備", flavor: "牠護住了眼睛。",
  },
  {
    id: 3, roman: "III", hpFrom: 0.33, hpTo: 0.00,
    blocked: ["heart"], gaugeMult: 1.5, tint: "crimson",
    name: "狂暴", flavor: "牠不再防守，只想把你們全部帶走。",
  },
]);

export const PHASE_TINTS = Object.freeze({
  violet:  "rgba(139,92,246,.20)",
  crimson: "rgba(220,38,38,.24)",
});

export function currentPhase(hpRatio) {
  const r = Math.max(0, Math.min(1, Number(hpRatio)));
  if (!Number.isFinite(r)) return WB_PHASES[0];
  // 由低血量往上找：hpTo 是下界，命中第一個「還在區間內」的階段
  for (let i = WB_PHASES.length - 1; i >= 0; i -= 1) {
    if (r <= WB_PHASES[i].hpFrom) {
      if (r > WB_PHASES[i].hpTo || i === WB_PHASES.length - 1) return WB_PHASES[i];
    }
  }
  return WB_PHASES[0];
}

export function phaseOf(id) {
  return WB_PHASES.find(p => p.id === id) || WB_PHASES[0];
}

export function blockedParts(phaseId) {
  return phaseOf(phaseId).blocked;
}

// 跨階段了嗎？回傳新階段（沒跨回 null）——UI 據此播階段轉換演出。
export function phaseTransition(prevRatio, nextRatio) {
  const before = currentPhase(prevRatio);
  const after = currentPhase(nextRatio);
  return after.id !== before.id ? after : null;
}
