"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.consumeCatDeathGuard = consumeCatDeathGuard;
exports.createCatBattleState = createCatBattleState;
exports.describeCatOutcome = describeCatOutcome;
exports.deterministicCatRoll = deterministicCatRoll;
exports.getCatGuardAtkBonus = getCatGuardAtkBonus;
exports.recordCatShieldAbsorption = recordCatShieldAbsorption;
exports.resolveAuthoritativeCatRound = resolveAuthoritativeCatRound;
exports.resolveCatRound = resolveCatRound;
var _catBattleArchetypes = require("./catBattleArchetypes");
function createCatBattleState() {
  return {
    strongSkillMisses: 0,
    personalShield: 0,
    guardAtkBuff: null,
    deathGuardReady: false,
    deathGuardUsed: false,
    combo: 0,
    pulse: 0,
    catStatuses: []
  };
}
const scoreValue = s => String(s).toUpperCase() === "X" ? 10 : Math.max(0, Number(s) || 0);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function getCatGuardAtkBonus(state, round) {
  const buff = state?.guardAtkBuff;
  return buff && Number(buff.expiresAfterRound) >= Number(round) ? Math.max(0, Number(buff.value) || 0) : 0;
}
function describeCatOutcome(outcome = {}) {
  const parts = [];
  const strong = (outcome.events || []).find(event => event.kind === "strong_skill");
  const statusTick = (outcome.events || []).find(event => event.kind === "cat_status_tick");
  const detonation = (outcome.events || []).find(event => event.kind === "cat_status_detonation");
  if (strong?.name) parts.push(`✨ 發動「${strong.name}」`);
  if ((outcome.monsterDamage || 0) > 0) parts.push(`造成 ${outcome.monsterDamage} 傷害`);
  if (statusTick?.damage > 0) parts.push(`異常持續 ${statusTick.damage}`);
  if (detonation?.damage > 0) parts.push(`引爆 ${detonation.damage}`);
  if ((outcome.playerHeal || 0) > 0) parts.push(`治療 ${outcome.playerHeal}`);
  if ((outcome.playerShield || 0) > 0) parts.push(`護盾 ${outcome.playerShield}`);
  if ((outcome.teamHeal || 0) > 0) parts.push(`全隊治療 ${outcome.teamHeal}`);
  if ((outcome.teamShield || 0) > 0) parts.push(`全隊護盾 ${outcome.teamShield}`);
  if ((outcome.teamCleanseCount || 0) > 0) parts.push("全隊淨化");
  if (outcome.monsterStatus?.name) parts.push(`附加${outcome.monsterStatus.name}`);
  if ((outcome.playerDefBonusPct || 0) > 0) parts.push(`DEF +${outcome.playerDefBonusPct}%`);
  if ((outcome.events || []).some(event => event.kind === "guard_atk_expired")) parts.push("守護反攻已消耗");
  return parts.join("・") || "陪你並肩作戰";
}
function recordCatShieldAbsorption(state, input = {}) {
  const cat = (0, _catBattleArchetypes.getCatBattleArchetype)(input.catId);
  const absorbed = Math.max(0, Number(input.absorbed) || 0);
  if (cat.type !== "defense" || absorbed <= 0) return state || createCatBattleState();
  const bond = (0, _catBattleArchetypes.getCatBondScaling)(input.bondLevel);
  const catAtk = Math.max(1, Number(input.catAtk) || 1);
  const conversion = input.catId === "diandian" ? .45 : input.catId === "xiaoan" ? .2 : .3;
  return {
    ...createCatBattleState(),
    ...(state || {}),
    guardAtkBuff: {
      value: Math.round(clamp(absorbed * conversion * bond.powerMultiplier, 1, catAtk * .8)),
      expiresAfterRound: (Number(input.round) || 1) + 1
    }
  };
}
function consumeCatDeathGuard(state, input = {}) {
  const current = {
    ...createCatBattleState(),
    ...(state || {})
  };
  const policy = _catBattleArchetypes.CAT_BATTLE_MODE_POLICIES[input.mode] || _catBattleArchetypes.CAT_BATTLE_MODE_POLICIES.normal;
  if (input.catId !== "xiaoan" || !policy.allowDeathGuard || !current.deathGuardReady || current.deathGuardUsed) return {
    triggered: false,
    state: current,
    hp: 0
  };
  return {
    triggered: true,
    state: {
      ...current,
      deathGuardReady: false,
      deathGuardUsed: true
    },
    hp: Math.max(1, Math.round((Number(input.maxHp) || 1) * .15))
  };
}
function resolveCatRound(input = {}) {
  const cat = (0, _catBattleArchetypes.getCatBattleArchetype)(input.catId);
  const bond = (0, _catBattleArchetypes.getCatBondScaling)(input.bondLevel);
  const policy = _catBattleArchetypes.CAT_BATTLE_MODE_POLICIES[input.mode] || _catBattleArchetypes.CAT_BATTLE_MODE_POLICIES.normal;
  const state = {
    ...createCatBattleState(),
    ...(input.state || {})
  };
  const events = [];
  const random = typeof input.random === "function" ? input.random : Math.random;
  const strongTriggered = state.strongSkillMisses >= 3 || random() < (0, _catBattleArchetypes.getCatStrongSkillChance)(input.catId, input.bondLevel);
  const next = {
    ...state,
    strongSkillMisses: strongTriggered ? 0 : state.strongSkillMisses + 1
  };
  if (next.guardAtkBuff && Number(next.guardAtkBuff.expiresAfterRound) <= Number(input.round || 1)) {
    events.push({
      kind: "guard_atk_expired",
      name: "守護反攻已消耗"
    });
    next.guardAtkBuff = null;
  }
  const catAtk = Math.max(1, Number(input.catAtk) || 1);
  const attackMult = 1 + Math.min(.8, Math.max(0, Number(input.companionAttackPct) || 0) / 100);
  const healingMult = 1 + Math.min(.8, Math.max(0, Number(input.companionHealingPct) || 0) / 100);
  const monsterMaxHp = Math.max(1, Number(input.monsterMaxHp) || 1);
  let monsterDamage = 0,
    playerHeal = 0,
    playerShield = 0,
    teamShield = 0,
    teamHeal = 0,
    teamCleanseCount = 0,
    playerDefBonusPct = 0,
    monsterStatus = null;
  if (cat.type === "heal") {
    const activeStatuses = (state.catStatuses || []).filter(status => Number(status.rounds) > 0);
    const statusTickDamage = activeStatuses.reduce((sum, status) => sum + Math.max(0, Number(status.damage) || 0), 0);
    next.catStatuses = activeStatuses.map(status => ({
      ...status,
      rounds: status.rounds - 1
    })).filter(status => status.rounds > 0);
    const baseHeal = Math.round((8 + catAtk * .18) * bond.powerMultiplier * healingMult);
    playerHeal = Math.min(baseHeal, Math.max(0, (input.playerMaxHp || 0) - (input.playerHp || 0)));
    if (cat.id === "unused") playerHeal = 0;
    if (input.catId === "daming") playerShield = Math.max(0, baseHeal - playerHeal);
    const hpPart = monsterMaxHp * policy.maxHpDamagePct;
    const raw = (catAtk * .35 + hpPart) * bond.powerMultiplier;
    const cap = hpPart + catAtk * policy.damageCapFromCatAtk;
    monsterDamage = Math.max(1, Math.round(Math.min(raw, cap)));
    if (input.catId === "meimei") monsterDamage = Math.round(monsterDamage * 1.08);
    if (input.catId === "gege") monsterDamage = Math.round(monsterDamage * .8);
    const duration = input.catId === "meimei" ? 1 : 2;
    const appliedDamage = monsterDamage;
    monsterDamage += statusTickDamage;
    next.catStatuses = [...next.catStatuses.filter(status => status.id !== cat.status.id), {
      id: cat.status.id,
      name: cat.status.name,
      damage: appliedDamage,
      rounds: duration
    }];
    if (statusTickDamage > 0) events.push({
      kind: "cat_status_tick",
      name: "貓咪異常持續傷害",
      damage: statusTickDamage
    });
    events.push({
      kind: "monster_status",
      statusId: cat.status.id,
      name: cat.status.name,
      damage: appliedDamage,
      duration
    });
    if (strongTriggered) {
      playerHeal += Math.round(baseHeal * .8);
      teamHeal = Math.max(1, Math.round(baseHeal * .3));
      if (input.catId === "gege") teamCleanseCount = 1;
      if (input.catId === "gege") monsterStatus = {
        id: "weaken",
        name: "弱化",
        icon: "🫥",
        kind: "statDown",
        strength: Math.min(25, 10 + Math.floor(bond.level / 5)),
        duration: 2
      };
      if (input.catId === "meimei") {
        const detonation = (next.catStatuses || []).reduce((sum, status) => sum + Math.max(0, Number(status.damage) || 0) * Math.max(0, Number(status.rounds) || 0), 0);
        monsterDamage += Math.round(detonation * .6);
        next.catStatuses = [];
        events.push({
          kind: "cat_status_detonation",
          name: "脈衝引爆",
          damage: Math.round(detonation * .6)
        });
      }
      events.push({
        kind: "strong_skill",
        name: cat.strongSkill.name,
        monsterStatus
      });
    }
  } else if (cat.type === "attack") {
    const scores = (input.scores || []).map(scoreValue);
    const accurate = scores.filter(s => s >= 9).length;
    let mult = .8,
      hitCount = 1;
    if (input.catId === "niuniu") {
      mult += accurate * .12;
      if (strongTriggered) {
        const precisionPierce = 1 + Math.min(.35, .12 + accurate * .05);
        mult *= precisionPierce;
        monsterStatus = {
          id: "defBreak",
          name: "破防",
          icon: "🔨",
          kind: "statDown",
          strength: Math.min(25, 10 + accurate * 3 + Math.floor(bond.level / 10)),
          duration: 2
        };
      }
    }
    if (input.catId === "haji") {
      next.combo = scores.every(s => s > 0) ? Math.min(6, (state.combo || 0) + 1) : 0;
      mult += next.combo * .08;
      if (strongTriggered) {
        hitCount = Math.min(4, 2 + Math.floor(next.combo / 2));
        mult *= 1 + .22 * hitCount;
        monsterStatus = {
          id: "defBreak",
          name: "破防",
          icon: "🔨",
          kind: "statDown",
          strength: Math.min(18, 6 + next.combo * 2),
          duration: 2
        };
      }
    }
    if (input.catId === "baobao") {
      const ratio = (input.monsterHp || monsterMaxHp) / monsterMaxHp;
      mult += ratio <= .3 ? .7 : ratio <= .6 ? .25 : 0;
      if (strongTriggered) mult *= ratio <= .3 ? 2.15 : ratio <= .6 ? 1.75 : 1.35;
    }
    monsterDamage = Math.round(catAtk * mult * bond.powerMultiplier * attackMult);
    events.push({
      kind: "cat_attack",
      damage: monsterDamage,
      hitCount,
      name: strongTriggered ? cat.strongSkill.name : cat.passive.name
    });
    if (monsterStatus) events.push({
      kind: "monster_status",
      ...monsterStatus
    });
  } else {
    const shieldBase = Math.round(((input.catMaxHp || 200) * .04 + catAtk * .25) * bond.powerMultiplier * healingMult);
    playerShield = Math.min(Math.round((input.playerMaxHp || 500) * policy.shieldPctCap), shieldBase * (strongTriggered ? 2 : 1));
    playerDefBonusPct = Math.min(25, 8 + Math.floor(bond.level / 5) + (strongTriggered ? 5 : 0));
    next.personalShield = Math.max(state.personalShield || 0, playerShield);
    const absorbed = Math.max(0, Number(input.shieldAbsorbed) || 0);
    if (absorbed > 0) {
      next.guardAtkBuff = recordCatShieldAbsorption(next, {
        catId: input.catId,
        bondLevel: input.bondLevel,
        catAtk,
        absorbed,
        round: input.round
      }).guardAtkBuff;
    }
    events.push({
      kind: "player_shield",
      amount: playerShield,
      name: cat.passive.name
    });
    if (strongTriggered) {
      if (input.catId === "youyou") teamShield = Math.min(Math.round((input.playerMaxHp || 500) * policy.shieldPctCap * .35), Math.round(playerShield * .35));
      if (input.catId === "xiaoan" && policy.allowDeathGuard && !state.deathGuardUsed) next.deathGuardReady = true;
      if (input.catId === "diandian") playerShield = Math.min(Math.round((input.playerMaxHp || 500) * policy.shieldPctCap), Math.round(playerShield * (1 + .35 * policy.blockScale)));
      events.push({
        kind: "strong_skill",
        name: cat.strongSkill.name,
        blockScale: policy.blockScale,
        teamShield,
        deathGuardReady: next.deathGuardReady
      });
    }
  }
  return {
    state: next,
    events,
    strongTriggered,
    monsterDamage,
    playerHeal,
    playerShield,
    teamShield,
    teamHeal,
    teamCleanseCount,
    playerDefBonusPct,
    monsterStatus
  };
}
function deterministicCatRoll(...parts) {
  const seed = parts.map(part => String(part ?? "")).join("|");
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}
function resolveAuthoritativeCatRound({
  member = {},
  monster = {},
  round = 1,
  mode = "normal",
  state = null,
  random = null,
  battleId = "",
  memberId = ""
} = {}) {
  const stableRandom = typeof random === "function" ? random : () => deterministicCatRoll(battleId, memberId, member.catId, round, "strong-skill");
  return resolveCatRound({
    catId: member.catId,
    catLevel: member.catLevel || 1,
    bondLevel: member.catBond || 0,
    catAtk: member.catAtk || member.catATK || 0,
    catMaxHp: member.catMaxHP || 200,
    companionAttackPct: member.catModifiers?.companionAttackPct || 0,
    companionHealingPct: member.catModifiers?.companionHealingPct || 0,
    playerHp: member.hp || 0,
    playerMaxHp: member.maxHP || member.hp || 1,
    monsterHp: monster.currentHp ?? monster.hp,
    monsterMaxHp: monster.maxHp ?? monster.hp,
    monsterBossTagged: !!(monster.bossTagged || ["boss", "mythic"].includes(monster.tier)),
    round,
    scores: (member.arrows || []).map(a => a?.label ?? a?.score ?? a),
    mode,
    state: state || member.catBattleState || createCatBattleState(),
    random: stableRandom
  });
}
