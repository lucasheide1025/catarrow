// src/worldboss/domain/breakGauge.js
// ─────────────────────────────────────────────────────────────
// 破防槽：全場共享，**算命中次數、不算傷害**。
//
// 這是新手貢獻度的解方。傷害榜壓不到完全平等，也不該壓（裝備和等級不能白練），
// 但破防槽只看「打中了幾次」——新手穩穩打腿 ×4 拿 4 點，老手打眼 ×4 拿 12 點：
// 眼睛值比較多，但門檻也高得多，累積速度不會差到十倍。
//
// 槽滿 → 全場「破防」，所有人增傷 ×1.5 兩回合。這一步把各自輸出變成團隊節奏。
// ─────────────────────────────────────────────────────────────

export const BREAK_GAUGE_MAX     = 30;
export const BREAK_BURST_MULT    = 1.5;
export const BREAK_BURST_ROUNDS  = 2;
export const ULT_GAUGE_PENALTY   = 0.2;   // 大招打中：槽被打掉 20%

export function emptyGaugeState() {
  return { gauge: 0, burstUntilRound: 0, bursts: 0 };
}

/**
 * 累積破防點數。phase 的 gaugeMult 在這裡吃（第三階段 ×1.5）。
 * 滿了就爆發並歸零——溢出的點數留到下一輪，連續破防才不會被吃掉。
 */
export function advanceBreakGauge(state, points, { phaseGaugeMult = 1, round = 1 } = {}) {
  const prev = { ...emptyGaugeState(), ...(state || {}) };
  const gained = Math.max(0, Math.round((Number(points) || 0) * phaseGaugeMult));
  let gauge = prev.gauge + gained;
  let triggered = false;
  let burstUntilRound = prev.burstUntilRound;
  let bursts = prev.bursts;

  if (gauge >= BREAK_GAUGE_MAX) {
    triggered = true;
    bursts += 1;
    gauge -= BREAK_GAUGE_MAX;            // 溢出保留
    burstUntilRound = round + BREAK_BURST_ROUNDS;
  }

  return { state: { gauge, burstUntilRound, bursts }, gained, triggered };
}

// 大招命中：槽被打掉一截（沒斷成的代價之一）
export function applyUltGaugePenalty(state) {
  const prev = { ...emptyGaugeState(), ...(state || {}) };
  return { ...prev, gauge: Math.max(0, Math.round(prev.gauge * (1 - ULT_GAUGE_PENALTY))) };
}

export function isBurstActive(state, round) {
  const s = { ...emptyGaugeState(), ...(state || {}) };
  return (Number(round) || 0) <= s.burstUntilRound;
}

// 全場增傷倍率（沒在爆發就是 1）
export function burstMultiplier(state, round) {
  return isBurstActive(state, round) ? BREAK_BURST_MULT : 1;
}

export function gaugeRatio(state) {
  const s = { ...emptyGaugeState(), ...(state || {}) };
  return Math.max(0, Math.min(1, s.gauge / BREAK_GAUGE_MAX));
}
