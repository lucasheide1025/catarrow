export const COMBAT_PHASES = Object.freeze({
  TELEGRAPH: "telegraph",
  SHOOTING: "shooting",
  PLAYER_DAMAGE: "playerDamage",
  BREAK_RESULT: "breakResult",
  COMPANION: "companion",
  MONSTER_ABILITY: "monsterAbility",
  STATUSES: "statuses",
  COUNTER: "counter",
  END_HEAL: "endHeal",
  COMPLETED: "completed",
});

const PHASE_ORDER = Object.freeze([
  COMBAT_PHASES.TELEGRAPH,
  COMBAT_PHASES.SHOOTING,
  COMBAT_PHASES.PLAYER_DAMAGE,
  COMBAT_PHASES.BREAK_RESULT,
  COMBAT_PHASES.COMPANION,
  COMBAT_PHASES.MONSTER_ABILITY,
  COMBAT_PHASES.STATUSES,
  COMBAT_PHASES.COUNTER,
  COMBAT_PHASES.END_HEAL,
]);

export function createCombatRoundState({
  battleId,
  mode,
  monster,
  members,
  arrowsPerRound,
  targetFmt,
  rngSeed,
  catalogVersion = 1,
}) {
  if (!battleId || !mode || !monster?.id) throw new Error("invalid_combat_identity");
  if (![3, 6].includes(arrowsPerRound)) throw new Error("invalid_arrows_per_round");
  if (!["full_110", "half_610", "field_16"].includes(targetFmt)) throw new Error("invalid_target_format");
  return {
    version: 1,
    catalogVersion,
    battleId,
    mode,
    monsterId: monster.id,
    monsterSnapshot: { ...monster },
    lockedSettings: { arrowsPerRound, targetFmt },
    memberOrder: Object.keys(members || {}).sort(),
    memberSnapshot: structuredCloneSafe(members || {}),
    rngSeed: String(rngSeed ?? battleId),
    combatRound: 1,
    phase: COMBAT_PHASES.TELEGRAPH,
    pendingTelegraph: null,
    submissions: {},
    skillState: {},
    skillHistory: [],
    statusEffects: {},
    resolvedSkillKeys: [],
    resolvedCompanionKeys: [],
    phaseHistory: [{ round: 1, phase: COMBAT_PHASES.TELEGRAPH }],
  };
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

export function restoreCombatRoundState(serialized) {
  const state = typeof serialized === "string" ? JSON.parse(serialized) : structuredCloneSafe(serialized);
  if (!state?.battleId || !state?.monsterId || !Number.isInteger(state.combatRound)) {
    throw new Error("invalid_combat_snapshot");
  }
  if (![3, 6].includes(state.lockedSettings?.arrowsPerRound)) throw new Error("invalid_combat_snapshot");
  return state;
}

export function serializeCombatRoundState(state) {
  return JSON.stringify(state);
}

export function setPendingTelegraph(state, telegraph) {
  if (state.phase !== COMBAT_PHASES.TELEGRAPH) return state;
  return { ...state, pendingTelegraph: telegraph ? structuredCloneSafe(telegraph) : null };
}

export function beginShooting(state) {
  if (state.phase !== COMBAT_PHASES.TELEGRAPH) return state;
  return moveToPhase(state, COMBAT_PHASES.SHOOTING);
}

export function submitMemberRound(state, { memberId, arrows }) {
  if (state.phase !== COMBAT_PHASES.SHOOTING || !state.memberOrder.includes(memberId)) return state;
  if (state.submissions[memberId]) return state;
  if (!Array.isArray(arrows) || arrows.length !== state.lockedSettings.arrowsPerRound) return state;
  return {
    ...state,
    submissions: {
      ...state.submissions,
      [memberId]: { arrows: structuredCloneSafe(arrows), submittedRound: state.combatRound },
    },
  };
}

export function allMembersSubmitted(state, eligibleMemberIds = state.memberOrder) {
  return eligibleMemberIds.every(memberId => state.submissions[memberId]?.submittedRound === state.combatRound);
}

export function moveToPhase(state, nextPhase) {
  if (state.phase === COMBAT_PHASES.COMPLETED) return state;
  const currentIndex = PHASE_ORDER.indexOf(state.phase);
  const nextIndex = PHASE_ORDER.indexOf(nextPhase);
  if (nextPhase !== COMBAT_PHASES.COMPLETED && nextIndex !== currentIndex + 1) return state;
  return {
    ...state,
    phase: nextPhase,
    phaseHistory: [...state.phaseHistory, { round: state.combatRound, phase: nextPhase }],
  };
}

export function recordResolvedSkill(state, { resolvedKey, result }) {
  if (!resolvedKey || state.resolvedSkillKeys.includes(resolvedKey)) return state;
  return {
    ...state,
    resolvedSkillKeys: [...state.resolvedSkillKeys, resolvedKey],
    skillHistory: [...state.skillHistory, { round: state.combatRound, resolvedKey, result: structuredCloneSafe(result) }],
  };
}

export function recordResolvedCompanion(state, resolvedKey) {
  if (!resolvedKey || state.resolvedCompanionKeys.includes(resolvedKey)) return state;
  return { ...state, resolvedCompanionKeys: [...state.resolvedCompanionKeys, resolvedKey] };
}

export function startNextCombatRound(state, pendingTelegraph = null) {
  if (state.phase !== COMBAT_PHASES.END_HEAL) return state;
  const combatRound = state.combatRound + 1;
  return {
    ...state,
    combatRound,
    phase: COMBAT_PHASES.TELEGRAPH,
    pendingTelegraph: pendingTelegraph ? structuredCloneSafe(pendingTelegraph) : null,
    submissions: {},
    phaseHistory: [...state.phaseHistory, { round: combatRound, phase: COMBAT_PHASES.TELEGRAPH }],
  };
}

export function orderCompanionActions(members) {
  const roleOrder = { front: 0, middle: 1, rear: 2 };
  return Object.entries(members || {})
    .filter(([, member]) => member?.alive !== false && member?.companionId)
    .sort(([idA, a], [idB, b]) => {
      const roleDiff = (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9);
      return roleDiff || idA.localeCompare(idB);
    })
    .map(([memberId, member]) => ({ memberId, companionId: member.companionId, role: member.role }));
}
