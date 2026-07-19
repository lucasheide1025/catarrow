const VALID_ARROWS_PER_ROUND = new Set([3, 6]);
const VALID_TARGET_FORMATS = new Set(["full_110", "half_610", "field_16"]);

export function createMonsterBattleSnapshot(state) {
  return {
    version: 2,
    ts: state.ts || Date.now(),
    monster: state.monster,
    mode: state.mode,
    battleMode: state.battleMode,
    monsterHP: state.monsterHP,
    archerHP: state.archerHP,
    round: state.round,
    roundScores: state.roundScores,
    selectedDistance: state.selectedDistance,
    distanceMode: state.distanceMode,
    battleStats: state.battleStats,
    arrowsPerRound: state.arrowsPerRound,
    targetFmt: state.targetFmt,
    targetMode: state.targetMode,
    battleSessionId: state.battleSessionId || null,
    runtimeSnapshot: state.runtimeSnapshot || null,
    activeCarryBuffs: state.activeCarryBuffs,
    potionShield: state.potionShield,
    monsterDmgTakenPct: state.monsterDmgTakenPct,
    counterReducePct: state.counterReducePct,
    poisonEffect: state.poisonEffect,
    log: Array.isArray(state.log) ? state.log.slice(-8) : [],
  };
}

export function normalizeMonsterBattleSnapshot(snapshot) {
  if (!snapshot?.monster?.id) throw new Error("invalid_monster_battle_snapshot");
  return {
    ...snapshot,
    mode: snapshot.mode || "student",
    battleMode: snapshot.battleMode || "score",
    round: Number.isInteger(snapshot.round) && snapshot.round > 0 ? snapshot.round : 1,
    arrowsPerRound: VALID_ARROWS_PER_ROUND.has(snapshot.arrowsPerRound) ? snapshot.arrowsPerRound : 6,
    targetFmt: VALID_TARGET_FORMATS.has(snapshot.targetFmt) ? snapshot.targetFmt : "full_110",
    targetMode: typeof snapshot.targetMode === "boolean" ? snapshot.targetMode : false,
    battleSessionId: snapshot.battleSessionId || null,
  };
}
