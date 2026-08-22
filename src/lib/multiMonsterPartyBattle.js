import { calcStandardArrowDmg, calcStandardCounter } from "./damage";
import { getMultiMonsterPlayerStats } from "./multiMonsterBattle";
import { MULTI_MONSTER_CONFIG } from "./multiMonsterEncounter";
import { monsterStatMods } from "./monsterStatus";
import { getPartyMemberFreeHuntEnvironment } from "./freeHuntEnvironment";

const clone = value => JSON.parse(JSON.stringify(value ?? null));

export function hashMultiPartySeed(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createMultiPartyRandom(seed) {
  let state = Number.isFinite(Number(seed)) ? (Number(seed) >>> 0) : hashMultiPartySeed(seed);
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scoreMeta(raw) {
  const value = raw && typeof raw === "object" ? (raw.score ?? raw.label) : raw;
  if (String(value).toUpperCase() === "X") return { label:"X", score:10 };
  if (String(value).toUpperCase() === "M") return { label:"M", score:0 };
  const score = Math.max(0, Math.min(10, Number(value) || 0));
  return { label: score > 0 ? String(score) : "M", score };
}

export function multiPartyTargetsToMap(targets) {
  if (!targets) return {};
  if (!Array.isArray(targets)) return clone(targets) || {};
  return Object.fromEntries(targets.filter(Boolean).map((target, index) => [target.instanceId || `target_${index}`, clone(target)]));
}

function orderedTargetIds(room, targets) {
  const preferred = Array.isArray(room?.targetOrder) ? room.targetOrder.filter(id => targets[id]) : [];
  const rest = Object.keys(targets).filter(id => !preferred.includes(id)).sort();
  return [...preferred, ...rest];
}

function frontIds(room, targets) {
  return orderedTargetIds(room, targets).filter(id => targets[id]?.position === "front" && !targets[id]?.isRunePillar);
}

function livingTargetIds(room, targets) {
  return orderedTargetIds(room, targets).filter(id => targets[id]?.alive !== false && Number(targets[id]?.currentHp) > 0);
}

function livingMemberIds(members) {
  return Object.keys(members || {}).filter(id => members[id]?.alive !== false && Number(members[id]?.hp) > 0);
}

export function orderedMultiPartyMemberIds(room) {
  const ids = Object.keys(room?.members || {});
  const host = room?.hostId;
  return [host, ...ids.filter(id => id !== host).sort()].filter((id, index, all) => id && all.indexOf(id) === index && room.members[id]);
}

function memberLiveStats(member) {
  const snapshotBase = member?.loadoutSnapshot?.version === 2 ? member.loadoutSnapshot.baseStats : null;
  return getMultiMonsterPlayerStats({
    player: {
      ...member,
      maxHp: Number(snapshotBase?.hp ?? member?.maxHp ?? member?.maxHP) || 200,
      baseAtk: Number(snapshotBase?.atk ?? member?.baseAtk ?? member?.atk) || 15,
      baseDef: Number(snapshotBase?.def ?? member?.baseDef ?? member?.def) || 10,
      atkMult: member?.atkMult ?? 1,
      defMult: member?.defMult ?? 1,
      atkFlat: member?.atkFlat ?? 0,
      defFlat: member?.defFlat ?? 0,
      statuses: Array.isArray(member?.statuses) ? member.statuses : [],
    },
  });
}

function targetDefense(target) {
  if (target?.isRunePillar) return Math.max(0, Number(target?.def) || 0);
  const mods = monsterStatMods(target?.statuses || []);
  return Math.max(0, (Number(target?.def) || 0) * (1 - (Number(mods?.defDownPct) || 0) / 100));
}

function targetAttack(target) {
  const mods = monsterStatMods(target?.statuses || []);
  return Math.max(1, Math.round((Number(target?.atk) || 1) * (1 - (Number(mods?.atkDownPct) || 0) / 100)));
}

function hpMap(rows, hpKey = "hp") {
  return Object.fromEntries(Object.entries(rows || {}).map(([id, value]) => [id, Math.max(0, Number(value?.[hpKey]) || 0)]));
}

function applyTargetDamage(targets, targetId, damage, events, payload = {}) {
  const target = targets[targetId];
  if (!target || target.alive === false || Number(target.currentHp) <= 0) return 0;
  const applied = Math.min(Math.max(0, Math.round(Number(damage) || 0)), Number(target.currentHp) || 0);
  target.currentHp = Math.max(0, (Number(target.currentHp) || 0) - applied);
  events.push({ type:"target_damage", targetId, damage:applied, remainingHp:target.currentHp, ...payload });
  if (target.currentHp <= 0 && target.alive !== false) {
    target.currentHp = 0;
    target.alive = false;
    events.push({ type:"monster_killed", targetId, monsterId:target.id || null, name:target.name || targetId, isRunePillar:target.isRunePillar === true });
  }
  return applied;
}

function normalizeSubmission(member) {
  const submission = member?.submission || {};
  return {
    attackMode: submission.attackMode === "all" ? "all" : "focus",
    targetId: submission.targetId || null,
    arrows: Array.isArray(submission.arrows) ? submission.arrows : [],
  };
}

export function resolveMultiMonsterPartyRound({ room, expectedRound = room?.round } = {}) {
  if (!room || room.huntType !== "multi" || room.multiMonster !== true) throw new Error("invalid_multi_party_room");
  const round = Number(expectedRound) || 1;
  if ((Number(room.round) || 1) !== round) throw new Error("stale_round");

  const targets = multiPartyTargetsToMap(room.targets);
  const members = clone(room.members || {}) || {};
  const targetOrder = orderedTargetIds(room, targets);
  const events = [];
  const targetHpBefore = hpMap(targets, "currentHp");
  const memberHpBefore = hpMap(members, "hp");
  const rand = createMultiPartyRandom(`${room.encounterSeed || room.id || "multi"}:${round}`);

  for (const memberId of orderedMultiPartyMemberIds({ ...room, members })) {
    const member = members[memberId];
    if (member?.alive === false || Number(member?.hp) <= 0) continue;
    const submission = normalizeSubmission(member);
    const live = memberLiveStats(member);
    const environment = getPartyMemberFreeHuntEnvironment(member, room);
    const attackMode = submission.attackMode;
    let focusTargetId = submission.targetId;
    if (attackMode === "focus" && (!focusTargetId || !targets[focusTargetId] || targets[focusTargetId].alive === false || Number(targets[focusTargetId].currentHp) <= 0)) {
      focusTargetId = livingTargetIds({ ...room, targetOrder }, targets)[0] || null;
    }

    events.push({ type:"player_attack", memberId, name:member.name || memberId, attackMode, targetId:focusTargetId, arrowCount:submission.arrows.length });

    for (let arrowIndex = 0; arrowIndex < submission.arrows.length; arrowIndex += 1) {
      const score = scoreMeta(submission.arrows[arrowIndex]);
      if (score.score <= 0) {
        events.push({ type:"arrow_miss", memberId, arrowIndex, targetId:focusTargetId });
        continue;
      }
      const currentTargets = attackMode === "all"
        ? livingTargetIds({ ...room, targetOrder }, targets)
        : [focusTargetId && targets[focusTargetId]?.alive !== false && Number(targets[focusTargetId]?.currentHp) > 0
            ? focusTargetId
            : (livingTargetIds({ ...room, targetOrder }, targets)[0] || null)].filter(Boolean);
      if (!currentTargets.length) break;
      if (attackMode === "focus") focusTargetId = currentTargets[0];

      for (const targetId of currentTargets) {
        const target = targets[targetId];
        if (!target || target.alive === false) continue;
        const baseDamage = calcStandardArrowDmg(score.score, live.atk, targetDefense(target), 1, score.label === "X" ? "X" : null, rand);
        const familyBonus = Number(member?.loadoutSnapshot?.cards?.familyDamageBonusPct?.[target.family]) || 0;
        const environmentDamage = Math.max(0, Math.round(baseDamage * (Number(environment.multiplier) || 1) * (1 + familyBonus / 100)));
        const damage = attackMode === "all" ? Math.floor(environmentDamage * 0.5) : environmentDamage;
        applyTargetDamage(targets, targetId, damage, events, { memberId, arrowIndex, score:score.label, attackMode });
      }
    }

    const catAtk = Math.max(0, Number(member?.catATK) || 0);
    if (catAtk > 0) {
      const catTargetId = (focusTargetId && targets[focusTargetId]?.alive !== false && Number(targets[focusTargetId]?.currentHp) > 0)
        ? focusTargetId : (livingTargetIds({ ...room, targetOrder }, targets)[0] || null);
      if (catTargetId) {
        const damage = Math.max(1, Math.round(catAtk - targetDefense(targets[catTargetId]) * 0.35));
        const applied = applyTargetDamage(targets, catTargetId, damage, events, { memberId, source:"cat", catId:member.catId || null });
        events.push({ type:"cat_action", memberId, catId:member.catId || null, targetId:catTargetId, amount:applied });
      }
    }
  }

  const fronts = frontIds({ ...room, targetOrder }, targets);
  const frontsDeadAfterPlayers = fronts.every(id => targets[id]?.alive === false || Number(targets[id]?.currentHp) <= 0);

  if (!frontsDeadAfterPlayers) {
    const pillarIds = targetOrder.filter(id => targets[id]?.isRunePillar && targets[id]?.alive !== false && Number(targets[id]?.currentHp) > 0);
    for (const pillarId of pillarIds) {
      for (const targetId of fronts) {
        const target = targets[targetId];
        if (!target || target.alive === false || target.currentHp >= target.maxHp) continue;
        const healPct = MULTI_MONSTER_CONFIG.RUNE_PILLAR_HEAL_MIN + rand() * (MULTI_MONSTER_CONFIG.RUNE_PILLAR_HEAL_MAX - MULTI_MONSTER_CONFIG.RUNE_PILLAR_HEAL_MIN);
        const wanted = Math.max(1, Math.floor((Number(target.maxHp) || 1) * healPct));
        const heal = Math.min(wanted, Math.max(0, (Number(target.maxHp) || 0) - (Number(target.currentHp) || 0)));
        if (heal <= 0) continue;
        target.currentHp += heal;
        events.push({ type:"rune_heal", pillarId, targetId, heal, remainingHp:target.currentHp });
      }
    }

    for (const targetId of fronts) {
      const monster = targets[targetId];
      if (!monster || monster.alive === false || Number(monster.currentHp) <= 0) continue;
      const candidates = livingMemberIds(members);
      if (!candidates.length) break;
      const victimId = candidates[Math.floor(rand() * candidates.length)] || candidates[0];
      const victim = members[victimId];
      const live = memberLiveStats(victim);
      const damage = calcStandardCounter(targetAttack(monster), live.def);
      victim.hp = Math.max(0, (Number(victim.hp) || 0) - damage);
      if (victim.hp <= 0) victim.alive = false;
      events.push({ type:"monster_counter", monsterId:targetId, memberId:victimId, damage, remainingHp:victim.hp });
      if (victim.hp <= 0) events.push({ type:"member_down", memberId:victimId, name:victim.name || victimId });
    }
  }

  const victory = fronts.every(id => targets[id]?.alive === false || Number(targets[id]?.currentHp) <= 0);
  const defeat = !victory && livingMemberIds(members).length === 0;

  for (const member of Object.values(members)) {
    member.ready = false;
    member.submission = null;
    delete member.arrows;
  }

  const status = victory ? "victory" : (defeat ? "defeat" : "active");
  const nextRound = round + 1;
  const lastResolution = {
    round,
    resolutionId:`${room.id || "multi"}_${round}`,
    targetHpBefore,
    targetHpAfter:hpMap(targets, "currentHp"),
    memberHpBefore,
    memberHpAfter:hpMap(members, "hp"),
    result:victory ? "win" : (defeat ? "lose" : null),
    events:events.map((event, index) => ({ id:`${room.id || "multi"}:${round}:${index}`, ...event })),
  };

  return { targets, members, targetOrder, status, round:nextRound, processing:false, lastResolution };
}
