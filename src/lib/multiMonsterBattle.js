// src/lib/multiMonsterBattle.js
// 單人複數怪：純事件戰鬥引擎。
// 固定順序：player -> cat -> status -> counter -> recovery -> round_end。

import { calcStandardArrowDmg, calcStandardCounter } from "./damage";
import {
  applyBattleStart,
  applyIncoming,
  applyOutgoing,
  applyRoundEnd,
  buildCombatModifiers,
  effectiveDefense,
  reflectDamage,
} from "./combatModifiers";
import {
  mergeMonsterStatus,
  monsterBlocked,
  monsterStatMods,
  rollInflict,
  tickMonsterStatuses,
} from "./monsterStatus";
import { createCatBattleState, resolveCatRound } from "./catBattleEngine";

export const MULTI_BATTLE_PHASE = Object.freeze({
  PLAYER: "player",
  CAT: "cat",
  STATUS: "status",
  COUNTER: "counter",
  RECOVERY: "recovery",
  ROUND_END: "round_end",
});

export const MULTI_BATTLE_EVENT = Object.freeze({
  PHASE: "multi_phase",
  ARROW_HIT: "multi_arrow_hit",
  ARROW_CRIT: "multi_arrow_crit",
  ARROW_MISS: "multi_arrow_miss",
  DAMAGE_OVERFLOW: "multi_damage_overflow",
  MONSTER_KILLED: "multi_monster_killed",
  STATUS_APPLIED: "multi_status_applied",
  STATUS_TICK: "multi_status_tick",
  STATUS_EXPIRED: "multi_status_expired",
  CAT_ATTACK: "multi_cat_attack",
  CAT_HEAL: "multi_cat_heal",
  CAT_SHIELD: "multi_cat_shield",
  CAT_STATUS: "multi_cat_status",
  MONSTER_BLOCKED: "multi_monster_blocked",
  MONSTER_ATTACK: "multi_monster_attack",
  REFLECT_DAMAGE: "multi_reflect_damage",
  PLAYER_RECOVER: "multi_player_recover",
  RUNE_PILLAR_HEAL: "multi_rune_pillar_heal",
  ROUND_END: "multi_round_end",
  BATTLE_WIN: "multi_battle_win",
  BATTLE_LOSE: "multi_battle_lose",
});

const clone = value => JSON.parse(JSON.stringify(value));
const livingEnemyIndexes = monsters => monsters
  .map((m, index) => ({ m, index }))
  .filter(({ m }) => m.alive && !m.isRunePillar)
  .map(({ index }) => index);
const livingTargetIndexes = monsters => monsters
  .map((m, index) => ({ m, index }))
  .filter(({ m }) => m.alive)
  .map(({ index }) => index);
const allEnemiesDead = monsters => livingEnemyIndexes(monsters).length === 0;

function playerStatusReductionPct(statuses, stat) {
  const ids = stat === "atk" ? new Set(["atkDown", "fear"]) : new Set(["defDown", "armorBreak"]);
  return Math.min(100, (statuses || []).reduce((sum, status) => {
    if (!status || !ids.has(status.id)) return sum;
    if (status.duration != null && Number(status.duration) <= 0) return sum;
    return sum + Math.max(0, Number(status.strength) || 0);
  }, 0));
}

// Single source of truth for the player's live combat numbers. Skills/events may
// change multipliers, flat values or statuses on battle state; both the HUD and
// damage/counter formulas consume this helper so they cannot drift apart.
export function getMultiMonsterPlayerStats(state = {}) {
  const player = state.player || {};
  const statuses = Array.isArray(player.statuses)
    ? player.statuses
    : (Array.isArray(state.activeStatuses) ? state.activeStatuses : []);
  const baseAtk = Math.max(0, Number(player.baseAtk ?? player.atk) || 0);
  const baseDef = Math.max(0, Number(player.baseDef ?? player.def) || 0);
  const atkFlat = Number(player.atkFlat) || 0;
  const defFlat = Number(player.defFlat) || 0;
  const atkMult = Math.max(0, Number(player.atkMult ?? 1) || 0);
  const defMult = Math.max(0, Number(player.defMult ?? 1) || 0);
  const atkReduction = playerStatusReductionPct(statuses, "atk");
  const defReduction = playerStatusReductionPct(statuses, "def");
  return {
    hp: Math.max(0, Number(player.hp) || 0),
    maxHp: Math.max(1, Number(player.maxHp) || 1),
    baseAtk,
    baseDef,
    atk: Math.max(0, (baseAtk + atkFlat) * atkMult * (1 - atkReduction / 100)),
    def: Math.max(0, (baseDef + defFlat) * defMult * (1 - defReduction / 100)),
    statuses,
  };
}

function pushEvent(events, phase, type, payload = {}) {
  events.push({ phase, type, payload });
}
function pushPhase(events, id) {
  pushEvent(events, id, MULTI_BATTLE_EVENT.PHASE, { phase: id });
}
function findRetarget(monsters, preferredIndex = 0) {
  const alive = livingEnemyIndexes(monsters);
  if (!alive.length) return -1;
  if (alive.includes(preferredIndex)) return preferredIndex;
  const after = alive.find(index => index > preferredIndex);
  return after ?? alive[0];
}
function killIfNeeded(events, phaseId, monsters, index) {
  const monster = monsters[index];
  if (!monster || monster.currentHp > 0 || !monster.alive) return false;
  monster.currentHp = 0;
  monster.alive = false;
  pushEvent(events, phaseId, MULTI_BATTLE_EVENT.MONSTER_KILLED, {
    targetIndex: index,
    targetId: monster.instanceId,
    monsterName: monster.name,
    monster: clone(monster),
  });
  return true;
}
function dealDamage({ events, phaseId, monsters, startIndex, damage, source, arrowIndex = null, crit = false }) {
  let targetIndex = findRetarget(monsters, startIndex);
  let remaining = Math.max(0, Math.round(Number(damage) || 0));
  while (targetIndex >= 0 && remaining > 0) {
    const target = monsters[targetIndex];
    const applied = Math.min(remaining, target.currentHp);
    target.currentHp = Math.max(0, target.currentHp - applied);
    remaining -= applied;
    const type = source === "player"
      ? (crit ? MULTI_BATTLE_EVENT.ARROW_CRIT : MULTI_BATTLE_EVENT.ARROW_HIT)
      : MULTI_BATTLE_EVENT.CAT_ATTACK;
    pushEvent(events, phaseId, type, {
      source,
      arrowIndex,
      targetIndex,
      targetId: target.instanceId,
      monsterName: target.name,
      damage: applied,
      isCrit: crit,
      remainingHp: target.currentHp,
      maxHp: target.maxHp,
    });
    killIfNeeded(events, phaseId, monsters, targetIndex);
    if (remaining <= 0 || allEnemiesDead(monsters)) break;
    const nextIndex = findRetarget(monsters, targetIndex + 1);
    if (nextIndex < 0 || nextIndex === targetIndex) break;
    pushEvent(events, phaseId, MULTI_BATTLE_EVENT.DAMAGE_OVERFLOW, {
      source,
      fromIndex: targetIndex,
      fromId: target.instanceId,
      toIndex: nextIndex,
      toId: monsters[nextIndex].instanceId,
      overflowDmg: remaining,
    });
    targetIndex = nextIndex;
  }
  return targetIndex;
}

function dealDirectDamage({ events, phaseId, monsters, targetIndex, damage, source, arrowIndex = null, crit = false }) {
  const target = monsters[targetIndex];
  if (!target?.alive) return -1;
  const applied = Math.min(Math.max(0, Math.round(Number(damage) || 0)), target.currentHp);
  target.currentHp = Math.max(0, target.currentHp - applied);
  const type = source === "player"
    ? (crit ? MULTI_BATTLE_EVENT.ARROW_CRIT : MULTI_BATTLE_EVENT.ARROW_HIT)
    : MULTI_BATTLE_EVENT.CAT_ATTACK;
  pushEvent(events, phaseId, type, {
    source,
    arrowIndex,
    targetIndex,
    targetId: target.instanceId,
    monsterName: target.name,
    damage: applied,
    isCrit: crit,
    remainingHp: target.currentHp,
    maxHp: target.maxHp,
  });
  killIfNeeded(events, phaseId, monsters, targetIndex);
  return targetIndex;
}

export function processMultiMonsterRound(state, arrows, options = {}) {
  const rand = options.rand || Math.random;
  const mods = options.mods || state.mods || buildCombatModifiers();
  const cat = options.cat || null;
  const events = [];
  const monsters = clone(state.monsters || []);
  const player = clone(state.player || {});
  const livePlayerStats = () => getMultiMonsterPlayerStats({ ...state, player });
  let playerShield = Math.max(0, Number(state.playerShield) || 0);
  let catBattleState = clone(state.catBattleState || createCatBattleState());
  const round = (state.round || 0) + 1;
  const attackMode = options.attackMode === "all" ? "all" : "focus";

  pushPhase(events, MULTI_BATTLE_PHASE.PLAYER);
  for (let i = 0; i < arrows.length; i += 1) {
    if (allEnemiesDead(monsters)) break;
    const arrow = arrows[i] || {};
    const preferred = Number.isInteger(arrow.targetIndex) ? arrow.targetIndex : 0;
    const preferredTarget = monsters[preferred];
    const targetIndex = preferredTarget?.alive ? preferred : findRetarget(monsters, preferred);
    if (targetIndex < 0) break;
    const target = monsters[targetIndex];
    const score = arrow.score === "X" ? "X" : arrow.score === "M" ? "M" : String(arrow.score ?? "M");
    const scoreNum = score === "X" ? 10 : score === "M" ? 0 : Math.max(0, Number(score) || 0);
    if (scoreNum <= 0) {
      pushEvent(events, MULTI_BATTLE_PHASE.PLAYER, MULTI_BATTLE_EVENT.ARROW_MISS, {
        arrowIndex: i, targetIndex, targetId: target.instanceId, monsterName: target.name, score,
      });
      continue;
    }
    const resolveArrowAgainst = (currentIndex, direct = false) => {
      const currentTarget = monsters[currentIndex];
      if (!currentTarget?.alive) return -1;
      const statusMods = currentTarget.isRunePillar ? {} : monsterStatMods(currentTarget.statuses || []);
      const targetDef = Math.max(0, Number(currentTarget.def || 0) * (1 - (statusMods.defDownPct || 0) / 100));
      const baseDamage = calcStandardArrowDmg(
        scoreNum,
        livePlayerStats().atk,
        effectiveDefense(targetDef, mods),
        1,
        score === "X" ? "X" : null,
        rand,
      );
      const outgoing = applyOutgoing({
        baseDamage,
        score: score === "X" ? "X" : scoreNum,
        bossTagged: false,
        mods,
        rand,
        round,
        monsterHpRatio: currentTarget.maxHp > 0 ? currentTarget.currentHp / currentTarget.maxHp : 1,
      });
      const crit = score === "X" || outgoing.crit;
      // 全員攻擊固定 -50%；整數傷害向下取整，避免奇數傷害四捨五入後反而超過一半。
      const focusDamage = Math.max(0, Math.round(Number(outgoing.damage) || 0));
      const damage = attackMode === "all" ? Math.floor(focusDamage * 0.5) : focusDamage;
      const hitIndex = direct
        ? dealDirectDamage({
            events, phaseId: MULTI_BATTLE_PHASE.PLAYER, monsters, targetIndex: currentIndex,
            damage, source: "player", arrowIndex: i, crit,
          })
        : dealDamage({
            events, phaseId: MULTI_BATTLE_PHASE.PLAYER, monsters, startIndex: currentIndex,
            damage, source: "player", arrowIndex: i, crit,
          });
      if (hitIndex >= 0 && monsters[hitIndex]?.alive && !monsters[hitIndex]?.isRunePillar) {
        const hitTarget = monsters[hitIndex];
        for (const incoming of rollInflict({ score: score === "X" ? "X" : scoreNum, inflict: mods.inflict, rand })) {
          hitTarget.statuses = mergeMonsterStatus(hitTarget.statuses || [], incoming);
          pushEvent(events, MULTI_BATTLE_PHASE.PLAYER, MULTI_BATTLE_EVENT.STATUS_APPLIED, {
            targetIndex: hitIndex,
            targetId: hitTarget.instanceId,
            status: incoming,
            statuses: clone(hitTarget.statuses),
          });
        }
      }
      return hitIndex;
    };

    if (attackMode === "all") {
      for (const currentIndex of livingTargetIndexes(monsters)) {
        resolveArrowAgainst(currentIndex, true);
      }
      continue;
    }

    resolveArrowAgainst(targetIndex, !!target.isRunePillar);
  }

  if (!allEnemiesDead(monsters) && cat?.hasCat && cat.catId) {
    pushPhase(events, MULTI_BATTLE_PHASE.CAT);
    const targetIndex = findRetarget(monsters, Number.isInteger(options.selectedTarget) ? options.selectedTarget : 0);
    if (targetIndex >= 0) {
      const target = monsters[targetIndex];
      const outcome = resolveCatRound({
        catId: cat.catId,
        catLevel: cat.catLevel || 1,
        bondLevel: cat.bondLv || 0,
        catAtk: cat.catATK || 0,
        catMaxHp: cat.catHP || 1,
        companionAttackPct: mods.companionAttackPct || 0,
        companionHealingPct: mods.companionHealingPct || 0,
        playerHp: player.hp,
        playerMaxHp: player.maxHp,
        monsterHp: target.currentHp,
        monsterMaxHp: target.maxHp,
        monsterBossTagged: false,
        round,
        scores: arrows.map(a => a.score),
        mode: "normal",
        state: catBattleState,
        random: rand,
      });
      catBattleState = outcome.state || catBattleState;
      if (outcome.monsterDamage > 0) {
        dealDamage({
          events, phaseId: MULTI_BATTLE_PHASE.CAT, monsters, startIndex: targetIndex,
          damage: outcome.monsterDamage, source: "cat",
        });
      }
      if (outcome.playerHeal > 0) {
        const before = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + outcome.playerHeal);
        pushEvent(events, MULTI_BATTLE_PHASE.CAT, MULTI_BATTLE_EVENT.CAT_HEAL, {
          catId: cat.catId, catName: cat.catName, heal: player.hp - before, playerHp: player.hp,
        });
      }
      if (outcome.playerShield > 0) {
        playerShield += outcome.playerShield;
        pushEvent(events, MULTI_BATTLE_PHASE.CAT, MULTI_BATTLE_EVENT.CAT_SHIELD, {
          catId: cat.catId, catName: cat.catName, shield: outcome.playerShield, playerShield,
        });
      }
      if (outcome.monsterStatus && !allEnemiesDead(monsters)) {
        const statusTargetIndex = findRetarget(monsters, targetIndex);
        if (statusTargetIndex >= 0) {
          monsters[statusTargetIndex].statuses = mergeMonsterStatus(monsters[statusTargetIndex].statuses || [], outcome.monsterStatus);
          pushEvent(events, MULTI_BATTLE_PHASE.CAT, MULTI_BATTLE_EVENT.CAT_STATUS, {
            targetIndex: statusTargetIndex,
            targetId: monsters[statusTargetIndex].instanceId,
            status: outcome.monsterStatus,
            statuses: clone(monsters[statusTargetIndex].statuses),
          });
        }
      }
    }
  }

  if (!allEnemiesDead(monsters)) {
    pushPhase(events, MULTI_BATTLE_PHASE.STATUS);
    monsters.forEach((monster, index) => {
      if (!monster.alive || monster.isRunePillar || !(monster.statuses || []).length) return;
      const tick = tickMonsterStatuses({
        list: monster.statuses,
        monsterHp: monster.currentHp,
        monsterMaxHp: monster.maxHp,
        playerAtk: livePlayerStats().atk,
      });
      monster.currentHp = tick.monsterHp;
      monster.statuses = tick.statuses;
      (tick.logs || []).forEach(log => {
        pushEvent(events, MULTI_BATTLE_PHASE.STATUS,
          log.expired ? MULTI_BATTLE_EVENT.STATUS_EXPIRED : MULTI_BATTLE_EVENT.STATUS_TICK, {
            targetIndex: index,
            targetId: monster.instanceId,
            monsterName: monster.name,
            status: log,
            damage: log.damage || 0,
            remainingHp: monster.currentHp,
            statuses: clone(monster.statuses),
          });
      });
      killIfNeeded(events, MULTI_BATTLE_PHASE.STATUS, monsters, index);
    });
  }

  if (!allEnemiesDead(monsters) && player.hp > 0) {
    pushPhase(events, MULTI_BATTLE_PHASE.COUNTER);
    for (let index = 0; index < monsters.length; index += 1) {
      const monster = monsters[index];
      if (!monster.alive || monster.isRunePillar || player.hp <= 0) continue;
      const blocked = monsterBlocked(monster.statuses || [], rand);
      if (blocked.counterBlocked) {
        pushEvent(events, MULTI_BATTLE_PHASE.COUNTER, MULTI_BATTLE_EVENT.MONSTER_BLOCKED, {
          targetIndex: index, targetId: monster.instanceId, monsterName: monster.name,
        });
        continue;
      }
      const statusMods = monsterStatMods(monster.statuses || []);
      const attack = Math.max(1, Math.round((monster.atk || 10) * (1 - (statusMods.atkDownPct || 0) / 100)));
      const raw = calcStandardCounter(attack, livePlayerStats().def);
      const incoming = applyIncoming({ damage: raw, currentHp: player.hp, maxHp: player.maxHp, mods });
      const absorbed = Math.min(playerShield, incoming.damage);
      playerShield -= absorbed;
      const hpDamage = Math.max(0, incoming.damage - absorbed);
      player.hp = Math.max(0, player.hp - hpDamage);
      pushEvent(events, MULTI_BATTLE_PHASE.COUNTER, MULTI_BATTLE_EVENT.MONSTER_ATTACK, {
        monsterIndex: index,
        monsterId: monster.instanceId,
        monsterName: monster.name,
        damage: hpDamage,
        shieldAbsorbed: absorbed,
        playerHp: player.hp,
        playerShield,
      });
      const reflected = Math.min(monster.currentHp, reflectDamage(incoming.damage, mods));
      if (reflected > 0) {
        monster.currentHp -= reflected;
        pushEvent(events, MULTI_BATTLE_PHASE.COUNTER, MULTI_BATTLE_EVENT.REFLECT_DAMAGE, {
          targetIndex: index, targetId: monster.instanceId, damage: reflected, remainingHp: monster.currentHp,
        });
        killIfNeeded(events, MULTI_BATTLE_PHASE.COUNTER, monsters, index);
      }
    }
  }

  if (player.hp > 0 && !allEnemiesDead(monsters)) {
    pushPhase(events, MULTI_BATTLE_PHASE.RECOVERY);
    const recovery = applyRoundEnd({ currentHp: player.hp, maxHp: player.maxHp, mods, alive: true });
    if (recovery.healed > 0) {
      player.hp = recovery.hp;
      pushEvent(events, MULTI_BATTLE_PHASE.RECOVERY, MULTI_BATTLE_EVENT.PLAYER_RECOVER, {
        heal: recovery.healed, playerHp: player.hp,
      });
    }
    const pillars = monsters.filter(m => m.alive && m.isRunePillar);
    for (const pillar of pillars) {
      for (let index = 0; index < monsters.length; index += 1) {
        const target = monsters[index];
        if (!target.alive || target.isRunePillar || target.position !== "front" || target.currentHp >= target.maxHp) continue;
        const healPct = 0.01 + rand() * 0.04;
        const heal = Math.min(Math.max(1, Math.floor(target.maxHp * healPct)), target.maxHp - target.currentHp);
        target.currentHp += heal;
        pushEvent(events, MULTI_BATTLE_PHASE.RECOVERY, MULTI_BATTLE_EVENT.RUNE_PILLAR_HEAL, {
          pillarId: pillar.instanceId, targetIndex: index, targetId: target.instanceId,
          monsterName: target.name, heal, remainingHp: target.currentHp,
        });
      }
    }
  }

  pushPhase(events, MULTI_BATTLE_PHASE.ROUND_END);
  let battleOver = false;
  let result = null;
  if (allEnemiesDead(monsters)) {
    battleOver = true;
    result = "win";
    pushEvent(events, MULTI_BATTLE_PHASE.ROUND_END, MULTI_BATTLE_EVENT.BATTLE_WIN, { round });
  } else if (player.hp <= 0) {
    battleOver = true;
    result = "lose";
    pushEvent(events, MULTI_BATTLE_PHASE.ROUND_END, MULTI_BATTLE_EVENT.BATTLE_LOSE, { round });
  }
  pushEvent(events, MULTI_BATTLE_PHASE.ROUND_END, MULTI_BATTLE_EVENT.ROUND_END, { round });

  return {
    events,
    nextState: { monsters, player, playerShield, catBattleState, round, mods },
    battleOver,
    result,
  };
}

export function aggregateMultiMonsterRewardClaims(killedMonsters, claimResults, xpTable = {}) {
  const monsters = (killedMonsters || []).filter(monster => monster && !monster.isRunePillar);
  const reward = {
    coins: 0,
    exp: monsters.reduce((sum, monster) => sum + (Number(xpTable?.[monster.tier]) || 0), 0),
    materialTotals: {},
    chests: [],
    cards: [],
  };

  for (const claimResult of claimResults || []) {
    const trusted = claimResult?.reward || claimResult || {};
    reward.coins += Math.max(0, Number(trusted.coins) || 0);
    for (const [materialId, quantity] of Object.entries(trusted.materialTotals || {})) {
      reward.materialTotals[materialId] = (reward.materialTotals[materialId] || 0) + Math.max(0, Number(quantity) || 0);
    }
    if (Array.isArray(trusted.chests)) reward.chests.push(...trusted.chests);
    if (trusted.card) reward.cards.push(trusted.card);
  }
  return reward;
}

export function createMultiMonsterBattleState(monsters, player, options = {}) {
  const mods = options.mods || buildCombatModifiers();
  const source = player || {};
  const baseMaxHp = source.maxHp || source.hp || 200;
  const start = applyBattleStart({
    playerMaxHp: baseMaxHp,
    monsterAtk: 1,
    monsterDef: 0,
    mods,
  });
  const hpGain = start.playerMaxHp - baseMaxHp;
  return {
    monsters: (monsters || []).map(m => {
      const adjusted = applyBattleStart({
        playerMaxHp: baseMaxHp,
        monsterAtk: m.atk || 1,
        monsterDef: m.def || 0,
        mods,
      });
      return {
        ...m,
        atk: m.isRunePillar ? (m.atk || 0) : adjusted.monsterAtk,
        def: m.isRunePillar ? (m.def || 0) : adjusted.monsterDef,
        currentHp: m.hp,
        maxHp: m.hp,
        alive: true,
        statuses: [],
      };
    }),
    player: {
      hp: Math.min(start.playerMaxHp, (source.hp || baseMaxHp) + hpGain),
      maxHp: start.playerMaxHp,
      atk: source.atk || 15,
      def: source.def || 10,
      baseAtk: source.baseAtk ?? source.atk ?? 15,
      baseDef: source.baseDef ?? source.def ?? 10,
      atkMult: source.atkMult ?? 1,
      defMult: source.defMult ?? 1,
      atkFlat: source.atkFlat ?? 0,
      defFlat: source.defFlat ?? 0,
      statuses: Array.isArray(source.statuses) ? clone(source.statuses) : [],
    },
    playerShield: start.shield,
    catBattleState: createCatBattleState(),
    mods,
    round: 0,
  };
}
