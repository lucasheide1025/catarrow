// src/lib/damage.js
// Unified Damage Engine — all battle damage formulas are centralized here.
// Each mode selects its formula via config or dedicated export.
//
// Convention:
//   - Single-arrow functions return { dmg, isCrit } or just dmg.
//   - Round functions return { dmg, crits, arrowBreakdown }.
//   - Counter functions return a plain number.

import { resolveHitPart } from "./monsterData";
import { BODY_PARTS } from "./monsterData";

// ── Utility ─────────────────────────────────────────────────
const ALL_PARTS = new Set(BODY_PARTS.map(p => p.id));

function landingMeta(arrow) {
  return Number.isFinite(arrow?.nx) && Number.isFinite(arrow?.ny)
    ? {
        nx:arrow.nx,
        ny:arrow.ny,
        faceIndex:arrow.faceIndex || 0,
        targetFormat:arrow.targetFormat || null,
      }
    : {};
}

// ════════════════════════════════════════════════════════════════
//  1. STANDARD FORMULA
//     Base: 8 + ATK*0.7 + score*1.2 - DEF*0.35
//     Crit: variance > 1.05 OR partMult >= 1.8
//     Used by: MonsterBattle, PartyBattle, CouncilBattle,
//              DungeonBattle (standard contract)
// ════════════════════════════════════════════════════════════════

/**
 * Single arrow damage (standard formula, no part resolution).
 * Same as monsterData's calcDamage({ score, archerATK, monsterDEF, partMult }).
 */
export function calcStandardArrowDmg(score, atk, def, partMult) {
  if (!score || partMult === 0) return 0;
  const base = 8 + (atk || 10) * 0.7 + score * 1.2 - (def || 0) * 0.35;
  const mult = 0.85 + Math.random() * 0.3;
  return Math.max(1, Math.round(base * partMult * mult));
}

/**
 * Crit detection for standard formula.
 */
export function isStandardCrit(variance, partMult, score) {
  return variance > 1.05 || partMult >= 1.8;
}

/**
 * Full round damage with part resolution (standard formula).
 * Replaces the inline calcDmgFn in PartyBattleRoom.
 * dmgBonusPct: 世界王卡被動加成（0 = 無加成，來自 calcEquippedBonus().dmgBonusPct）
 */
export function calcRoundDamage(arrows, atk, def, dmgBonusPct = 0) {
  let dmg = 0, crits = 0;
  const arrowBreakdown = [];
  const unlocked = new Set();

  for (const arrow of arrows) {
    const score = arrow.score ?? 0;
    const part  = resolveHitPart(score, unlocked, arrow.label === "X");
    if (!part) {
      arrowBreakdown.push({ label: arrow.label || "M", partIcon: "💨", partName: "脫靶", dmg: 0, isCrit: false, ...landingMeta(arrow) });
      continue;
    }
    if (part.id === "chest") unlocked.add("chest");
    if (part.id === "belly") unlocked.add("belly");
    if (part.id === "groin") unlocked.add("groin");

    const pMult = part.mult;
    if (pMult === 0) {
      arrowBreakdown.push({ label: arrow.label || "M", partIcon: "💨", partName: "脫靶", dmg: 0, isCrit: false, ...landingMeta(arrow) });
      continue;
    }
    // M 分（score=0）但有 pMult：50% base 傷害
    if (!score) {
      const base = 8 + (atk || 10) * 0.7 - (def || 0) * 0.35;
      const halfDmg = Math.max(1, Math.round(base * 0.5 * (1 + dmgBonusPct)));
      arrowBreakdown.push({
        label: arrow.label || "M",
        partIcon: part.icon, partName: part.name,
        partMult: pMult, dmg: halfDmg, isCrit: false,
        ...landingMeta(arrow),
      });
      dmg += halfDmg;
      continue;
    }

    const base   = 8 + (atk || 10) * 0.7 + score * 1.2 - (def || 0) * 0.35;
    const mult   = 0.85 + Math.random() * 0.3;
    const isCrit = isStandardCrit(mult, pMult, score);
    const d      = Math.max(1, Math.round(base * pMult * mult * (1 + dmgBonusPct)));
    dmg  += d;
    if (isCrit) crits++;

    arrowBreakdown.push({
      label: arrow.label, partIcon: part.icon,
      partName: part.name, partMult: pMult, dmg: d, isCrit,
      ...landingMeta(arrow),
    });
  }

  return { dmg, crits, arrowBreakdown };
}

/**
 * Standard counter attack (monsterData formula).
 * headStunned -> 50% dmg; isCrit -> 180% dmg.
 * dmgReducePct: 世界王卡被動減傷（0 = 無加成）
 */
export function calcStandardCounter(monsterATK, archerDEF, headStunned = false, isCrit = false, dmgReducePct = 0) {
  let base = (monsterATK || 0) * 0.6 - (archerDEF || 10) * 0.4 + 5;
  if (headStunned) base *= 0.5;
  if (isCrit)      base *= 1.8;
  base *= (1 - dmgReducePct);
  return Math.max(1, Math.round(base * (0.8 + Math.random() * 0.4)));
}

/**
 * PartyBattle counter — wraps standard with random 10% crit.
 * Used by processPartyRound callback.
 */
export function calcPartyCounter(monsterATK, archerDEF, dmgReducePct = 0) {
  return calcStandardCounter(monsterATK, archerDEF, false, Math.random() < 0.1, dmgReducePct);
}

// ════════════════════════════════════════════════════════════════
//  2. DUEL FORMULA
//     Base: 2 + ATK*0.5 + score*0.4 - DEF*0.3
//     Crit: variance > 1.05 OR partMult >= 1.8
//     All body parts unlocked from start.
//     Has miss-recovery mechanic.
// ════════════════════════════════════════════════════════════════

/**
 * Full round damage for duels.
 * Replaces the inline calcDmgFn in DuelRoom.
 * Includes the miss-recovery mechanic.
 */
export function calcDuelRoundDamage(arrows, atk, targetDef) {
  // ── Miss recovery ────────────────────────────────────────
  const missCount = arrows.filter(a => a.score === 0).length;
  let processedArrows = arrows;
  let luckyEvent = null;
  if (missCount >= 3 && Math.random() < 0.40) {
    let saved = 0;
    processedArrows = arrows.map(a => {
      if (a.score === 0 && saved < 2 && Math.random() < 0.60) {
        saved++;
        const s = 5 + Math.floor(Math.random() * 3);
        return { ...a, score: s, label: `✨${s}`, lucky: true };
      }
      return a;
    });
    if (saved > 0) {
      luckyEvent = {
        icon: "✨",
        title: "天外飛箭",
        desc: `${saved} 支脫靶的箭竟然擦中了目標！`,
      };
    }
  }

  // ── Calculate damage ─────────────────────────────────────
  let dmg = 0, crits = 0;
  const arrowBreakdown = [];

  for (const arrow of processedArrows) {
    const score = arrow.score ?? 0;
    const part  = resolveHitPart(score, ALL_PARTS, arrow.label === "X");
    const pMult = part?.mult ?? 1.0;

    if (!score || pMult === 0) {
      arrowBreakdown.push({ label: "M", partIcon: "💨", partName: "脫靶", dmg: 0, isCrit: false, ...landingMeta(arrow) });
      continue;
    }

    const base   = 2 + (atk || 20) * 0.5 + score * 0.4 - (targetDef || 10) * 0.3;
    const mult   = 0.85 + Math.random() * 0.3;
    const isCrit = mult > 1.05 || pMult >= 1.8;
    const d      = Math.max(1, Math.round(base * pMult * mult));
    dmg  += d;
    if (isCrit) crits++;

    arrowBreakdown.push({
      label: arrow.lucky ? `✨${score}` : (arrow.label || String(score)),
      partIcon: part?.icon || "❤️", partName: part?.name || "胸腔",
      partMult: pMult, dmg: d, isCrit, lucky: arrow.lucky || false,
      ...landingMeta(arrow),
    });
  }

  return { dmg, crits, arrowBreakdown, luckyEvent };
}

// ════════════════════════════════════════════════════════════════
//  3. WORLD BOSS FORMULA
//     Base: 5 + ATK*0.6*participantBonus + score*1.5 - DEF*0.3
//     Crit: score >= 10 (no part system)
// ════════════════════════════════════════════════════════════════

/**
 * Single arrow damage for world boss (no part system).
 * dmgBonusPct: 世界王卡被動加成（0 = 無加成）
 */
export function calcWorldBossArrowDmg(score, myATK, bossDef, participantBonus = 1, dmgBonusPct = 0) {
  if (score === 0) return 0;
  const atkFinal = (myATK || 0) * participantBonus;
  const base     = 5 + atkFinal * 0.6 + score * 1.5 - (bossDef || 0) * 0.3;
  const mult     = 0.85 + Math.random() * 0.3;
  return Math.max(1, Math.round(base * mult * (1 + dmgBonusPct)));
}

/**
 * World boss counter attack.
 * dmgReducePct: 世界王卡被動減傷（0 = 無加成）
 */
export function calcWorldBossCounter(bossAtk, myDEF, dmgReducePct = 0) {
  const base = ((bossAtk || 0) * 0.4 - (myDEF || 0) * 0.3) * (1 - dmgReducePct);
  const mult = 0.8 + Math.random() * 0.4;
  return Math.max(5, Math.round(base * mult));
}

// ════════════════════════════════════════════════════════════════
//  4. DUNGEON COUNTER FORMULA
//     Base: 4 + ATK*0.6 - DEF*0.3
//     (Different from standard counter - dungeon specific balance)
// ════════════════════════════════════════════════════════════════

/**
 * Dungeon-specific counter attack.
 * Used by processDungeonRound callback.
 * dmgReducePct: 世界王卡被動減傷（0 = 無加成）
 */
export function calcDungeonCounter(monsterAtk, archerDef, dmgReducePct = 0) {
  const base = (4 + (monsterAtk || 10) * 0.6 - (archerDef || 10) * 0.3) * (1 - dmgReducePct);
  const mult = 0.8 + Math.random() * 0.4;
  return Math.max(1, Math.round(base * mult));
}

// ════════════════════════════════════════════════════════════════
//  5. HELPER - CouncilBuilding part-multiplier mapping
//      (Simplified part system, not full resolveHitPart)
// ════════════════════════════════════════════════════════════════

/**
 * Simplified part multiplier for CouncilBattle (no body parts enum).
 */
export function getCouncilPartMult(label, targetFmt) {
  if (label === "0" || label === "M") return 0;
  if (targetFmt === "field_16") {
    const v = parseInt(label);
    if (v === 6) return 2.0;
    if (v === 5) return 1.5;
    if (v >= 3) return 1.2;
    return 1.0;
  }
  if (label === "X") return 2.0;
  const v = parseInt(label);
  if (v === 10) return 1.5;
  if (v >= 8) return 1.2;
  return 1.0;
}
