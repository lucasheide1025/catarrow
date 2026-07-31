// src/worldboss/domain/raidFlow.js
// ─────────────────────────────────────────────────────────────
// 一場出擊的狀態機。**只算，不演。**
//
// ⚠️ 鐵律：domain 產生 log，UI 照 log 的**原順序**重播。
//    公會改版時最大的一個 bug 就是演出按事件類型分桶，導致「怪物全滅前系統已結算，
//    直接跳過戰鬥動畫」。這裡從第一天就用 log 順序，所有聲光效果掛在事件上，
//    不散在 setState 裡——想加特效就是加一種事件，畫面不會再跟結果對不上。
// ─────────────────────────────────────────────────────────────

import { calcWorldBossArrowDmg, calcWorldBossCounter } from "../../lib/damage";
import { advanceBreakGauge, applyUltGaugePenalty, burstMultiplier, emptyGaugeState } from "./breakGauge";
import { intentForRound, resolveIntent } from "./bossIntent";
import { currentPhase, phaseTransition } from "./raidPhases";
import { resolveWeakPointHit } from "./weakPoints";

export const RAID_TOTAL_ROUNDS = 5;

// ⚠️ 平衡的主要旋鈕。世界王的「一般傷害」（ATK 公式）刻意壓到五成，把配重讓給弱點固定傷害。
// 為什麼不是直接調高固定傷害：那會連帶讓王死得更快、還要回頭改 24 隻王的血量。
// 降低 ATK 那一段的權重可以只動「配重」不動「總量」——實測貢獻差距 4.5× → 3.5×，
// 而每場總傷害幾乎不變（見 raidBalance.test.js）。
export const RAID_NORMAL_DAMAGE_SCALE = 0.5;
export const RAID_ARROWS_PER_ROUND = 6;

export function createRaidState({
  boss,                       // { key, name, hp, maxHp, atk, def, skillConfig }
  stats,                      // { atk, def, hp } ← 由 raidLoadout 從既有存檔轉進來
  participantBonus = 1,
  dmgBonusPct = 0,
  dmgReducePct = 0,
  gauge = null,               // 進場快照（全場共享；戰鬥中只用本地樂觀值）
  weakClock = null,
} = {}) {
  const maxHp = Math.max(1, Number(boss?.maxHp || boss?.hp) || 1);
  return {
    boss: {
      key: boss?.key || "boss", name: boss?.name || "世界王",
      atk: Number(boss?.atk) || 100, def: Number(boss?.def) || 0,
      maxHp, skillConfig: boss?.skillConfig || null,
    },
    bossHp: Math.max(0, Math.min(maxHp, Number(boss?.hp ?? maxHp))),
    stats: { atk: Number(stats?.atk) || 0, def: Number(stats?.def) || 0, hp: Number(stats?.hp) || 100 },
    participantBonus, dmgBonusPct, dmgReducePct, weakClock,
    playerHp: Number(stats?.hp) || 100,
    playerMaxHp: Number(stats?.hp) || 100,
    round: 1,
    gauge: { ...emptyGaugeState(), ...(gauge || {}) },
    staggered: false,          // 上回合打斷成功 → 這回合王硬直
    weakenStacks: 0,
    totals: { damage: 0, breakPoints: 0, weakHits: 0, grazes: 0, bestCombo: 0, interrupts: 0 },
    finished: false,
  };
}

export function raidHpRatio(state) {
  return Math.max(0, Math.min(1, state.bossHp / state.boss.maxHp));
}

/**
 * 結算一個回合。
 * arrows: [{ score, label, declaredId, nx, ny }]
 * 回傳 { state, log }——log 順序就是演出順序。
 */
export function resolveRaidRound({ state, arrows = [] } = {}) {
  const s = {
    ...state,
    gauge: { ...state.gauge },
    totals: { ...state.totals },
  };
  const log = [];
  const round = s.round;
  const phase = currentPhase(raidHpRatio(s));
  const intent = intentForRound({ config: s.boss.skillConfig, round, phaseId: phase.id });
  const staggered = !!s.staggered;

  log.push({ type: "roundStart", round, phase, staggered });
  log.push({ type: "intent", round, intent, staggered });

  let legHits = 0;
  let combo = 0;
  let roundDamage = 0;
  let roundBreak = 0;

  arrows.forEach((arrow, index) => {
    if (s.bossHp <= 0) return;
    const ratioBefore = raidHpRatio(s);
    const phaseNow = currentPhase(ratioBefore);

    const hit = resolveWeakPointHit({
      declaredId: arrow?.declaredId,
      score: arrow?.score,
      label: arrow?.label,
      bossMaxHp: s.boss.maxHp,
      blocked: phaseNow.blocked,
      charging: intent.charging,
      staggered,
      nx: arrow?.nx, ny: arrow?.ny,
      weakClock: s.weakClock,
    });

    const normal = calcWorldBossArrowDmg(
      arrow?.label === "X" ? 10 : Number(arrow?.score) || 0,
      s.stats.atk, s.boss.def, s.participantBonus, s.dmgBonusPct,
    ) * hit.normalMult * RAID_NORMAL_DAMAGE_SCALE;

    const burst = burstMultiplier(s.gauge, round);
    const damage = Math.max(0, Math.round((normal + hit.flatDamage) * burst));

    s.bossHp = Math.max(0, s.bossHp - damage);
    roundDamage += damage;
    s.totals.damage += damage;

    if (hit.hit) {
      combo += 1;
      s.totals.weakHits += 1;
      s.totals.bestCombo = Math.max(s.totals.bestCombo, combo);
      if (hit.effect === "interrupt") legHits += 1;
      if (hit.effect === "weaken") s.weakenStacks += 1;
    } else {
      combo = 0;
      if (hit.grazed) s.totals.grazes += 1;
    }

    log.push({
      type: "arrow", round, index,
      label: arrow?.label ?? String(arrow?.score ?? ""),
      declared: hit.declared, part: hit.part,
      hit: hit.hit, grazed: hit.grazed, missed: hit.missed, blocked: hit.blocked,
      bonuses: hit.bonuses, burst: burst > 1,
      damage, flatDamage: hit.flatDamage, combo,
      bossHp: s.bossHp, bossHpRatio: raidHpRatio(s),
    });

    if (hit.breakPoints > 0) {
      const adv = advanceBreakGauge(s.gauge, hit.breakPoints, { phaseGaugeMult: phaseNow.gaugeMult, round });
      s.gauge = adv.state;
      roundBreak += adv.gained;
      s.totals.breakPoints += adv.gained;
      log.push({ type: "gauge", round, gained: adv.gained, gauge: { ...s.gauge } });
      if (adv.triggered) {
        log.push({ type: "breakthrough", round, gauge: { ...s.gauge }, untilRound: s.gauge.burstUntilRound });
      }
    }

    const shifted = phaseTransition(ratioBefore, raidHpRatio(s));
    if (shifted) log.push({ type: "phaseShift", round, phase: shifted });

    if (s.bossHp <= 0) log.push({ type: "bossDown", round, index });
  });

  // ── 回合結束：分歧 ──
  let nextStagger = false;
  if (s.bossHp > 0) {
    const outcome = resolveIntent({ intent, legHits, weakenStacks: s.weakenStacks });
    if (intent.charging && outcome.interrupted) {
      nextStagger = true;
      s.totals.interrupts += 1;
      log.push({ type: "interrupt", round, intent, legHits });
    } else if (outcome.fired) {
      const base = calcWorldBossCounter(s.boss.atk, s.stats.def, s.dmgReducePct);
      const mult = (intent.skill?.baseMultiplier || 1) * outcome.ultMultiplier;
      const dealt = Math.max(1, Math.round(base * mult));
      // R2 保 1 血、R4 才可能打死（沿用既有 canKnockOut 設定）
      const floor = intent.skill?.canKnockOut ? 0 : 1;
      s.playerHp = Math.max(floor, s.playerHp - dealt);
      s.gauge = applyUltGaugePenalty(s.gauge);
      s.weakenStacks = 0;
      log.push({
        type: "ult", round, intent, damage: dealt,
        weakened: outcome.ultMultiplier < 1, playerHp: s.playerHp,
        knockedOut: s.playerHp <= 0, gauge: { ...s.gauge },
      });
    } else {
      const base = calcWorldBossCounter(s.boss.atk, s.stats.def, s.dmgReducePct);
      s.playerHp = Math.max(1, s.playerHp - base);
      log.push({ type: "counter", round, damage: base, playerHp: s.playerHp });
    }
  }

  s.staggered = nextStagger;
  s.round = round + 1;
  s.finished = s.bossHp <= 0 || s.round > RAID_TOTAL_ROUNDS || s.playerHp <= 0;

  log.push({
    type: "roundEnd", round,
    damage: roundDamage, breakPoints: roundBreak,
    bossHp: s.bossHp, bossHpRatio: raidHpRatio(s),
    finished: s.finished, staggerNext: nextStagger,
  });

  return { state: s, log };
}
