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
export function scoreDamageMultiplier(label, score = 0) {
  if (label === "X") return 2;
  const value = Number(score) || 0;
  if (label === "M" || value <= 0) return 0;
  if (value >= 10) return 1.2;
  return Math.max(0.2, value / 10);
}

export function calcStandardArrowDmg(score, atk, def, partMult = 1, label = null) {
  const scoreMult = scoreDamageMultiplier(label, score);
  if (scoreMult === 0 || partMult === 0) return 0;
  const base = 8 + (atk || 10) * 0.7 - (def || 0) * 0.35;
  return Math.max(1, Math.round(base * scoreMult * partMult));
}

/**
 * Crit detection for standard formula.
 */
export function isStandardCrit(_variance, partMult, score, label = null) {
  return label === "X" || partMult >= 1.8;
}

export function resolveStandardArrowHit(arrow, atk, def, unlockedParts = new Set(), dmgBonusPct = 0) {
  const label = arrow?.label ?? (arrow?.score === 0 ? "M" : String(arrow?.score ?? "M"));
  const score = Number(arrow?.score) || (label === "X" ? 10 : 0);
  if (label === "M" || score <= 0) {
    return { label:"M", score:0, scoreMult:0, part:BODY_PARTS.find(part => part.id === "miss"), dmg:0, isCrit:false, unlockedParts };
  }
  const part = resolveHitPart(score, unlockedParts, label === "X");
  const nextUnlocked = new Set(unlockedParts);
  if (["chest", "belly", "groin"].includes(part.id)) nextUnlocked.add(part.id);
  const dmg = Math.round(calcStandardArrowDmg(score, atk, def, part.mult, label) * (1 + dmgBonusPct));
  return { label, score, scoreMult:scoreDamageMultiplier(label, score), part, dmg, isCrit:isStandardCrit(0, part.mult, score, label), unlockedParts:nextUnlocked };
}

const PLAYER_PARTS = {
  arm: { id:"arm", name:"手臂", icon:"💪", mult:1.00 },
  belly: { id:"belly", name:"腹部", icon:"🫁", mult:1.00 },
  chest: { id:"chest", name:"胸腔", icon:"❤️", mult:1.08 },
  neck: { id:"neck", name:"頸部", icon:"🎯", mult:1.15 },
  vulnerable: { id:"vulnerable", name:"要害", icon:"⚡", mult:1.30 },
};

export function resolvePlayerCounter({ arrows = [], baseDamage = 0, maxHP = 0 }) {
  const scores = arrows.map(arrow => Number(arrow?.score) || (arrow?.label === "X" ? 10 : 0));
  const averageScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  const pool = averageScore >= 9 ? ["arm", "belly"]
    : averageScore >= 7 ? ["arm", "belly", "chest"]
    : averageScore >= 5 ? ["belly", "chest", "neck"]
    : ["chest", "neck", "vulnerable"];
  const part = PLAYER_PARTS[pool[Math.floor(Math.random() * pool.length)]];
  const uncappedDamage = Math.max(0, Math.round(baseDamage * part.mult));
  const cap = Math.max(0, Math.floor((Number(maxHP) || 0) * 0.25));
  return { averageScore, part, damage:cap > 0 ? Math.min(uncappedDamage, cap) : uncappedDamage, cap };
}

/**
 * Full round damage with part resolution (standard formula).
 * Replaces the inline calcDmgFn in PartyBattleRoom.
 * dmgBonusPct: 世界王卡被動加成（0 = 無加成，來自 calcEquippedBonus().dmgBonusPct）
 */
export function calcRoundDamage(arrows, atk, def, dmgBonusPct = 0) {
  let dmg = 0, crits = 0;
  const arrowBreakdown = [];
  let unlocked = new Set();

  for (const arrow of arrows) {
    const hit = resolveStandardArrowHit(arrow, atk, def, unlocked, dmgBonusPct);
    unlocked = hit.unlockedParts;
    dmg += hit.dmg;
    if (hit.isCrit) crits++;
    arrowBreakdown.push({
      label: hit.label, partIcon: hit.part.icon,
      partName: hit.part.name, partMult: hit.part.mult, dmg: hit.dmg, isCrit:hit.isCrit,
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
  return Math.max(1, Math.round(base));
}

/**
 * PartyBattle counter — wraps standard with random 10% crit.
 * Used by processPartyRound callback.
 */
export function calcPartyCounter(monsterATK, archerDEF, dmgReducePct = 0, isCrit = Math.random() < 0.1) {
  return calcStandardCounter(monsterATK, archerDEF, false, isCrit, dmgReducePct);
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
  return Math.round(calcStandardArrowDmg(score, atkFinal, bossDef, 1) * (1 + dmgBonusPct));
}

/**
 * World boss counter attack.
 * dmgReducePct: 世界王卡被動減傷（0 = 無加成）
 */
export function calcWorldBossCounter(bossAtk, myDEF, dmgReducePct = 0) {
  const base = ((bossAtk || 0) * 0.4 - (myDEF || 0) * 0.3) * (1 - dmgReducePct);
  return Math.max(5, Math.round(base));
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
  return Math.max(1, Math.round(base));
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
