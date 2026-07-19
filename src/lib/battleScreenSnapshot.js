const RESTORABLE_PHASES = new Set(["playing", "scoring", "round_result"]);

function normalizePhase(phase, arrows) {
  if (RESTORABLE_PHASES.has(phase)) return phase;
  // Processing is intentionally not persisted as a resumable animation state:
  // replaying it after damage was applied could double-apply a round.
  if (phase === "processing" && Array.isArray(arrows) && arrows.length > 0) return "scoring";
  return "playing";
}

export function createBattleScreenSnapshot({ battle, resolvedAbilityKeys = [], shootingEnds = [] }) {
  if (!battle || !Number.isInteger(battle.round) || battle.round < 1) throw new Error("invalid_battle_screen_state");
  return {
    version: 1,
    battle: {
      ...battle,
      phase: normalizePhase(battle.phase, battle.arrows),
      unlockedParts: [...(battle.unlockedParts || [])],
      activeStatuses: (battle.activeStatuses || []).map(status => ({ ...status })),
    },
    resolvedAbilityKeys: [...new Set(resolvedAbilityKeys)],
    shootingEnds: JSON.parse(JSON.stringify(shootingEnds || [])),
  };
}

export function restoreBattleScreenSnapshot(snapshot) {
  const battle = snapshot?.battle;
  if (!battle || !Number.isInteger(battle.round) || battle.round < 1) throw new Error("invalid_battle_screen_snapshot");
  return {
    battle: {
      ...battle,
      phase: normalizePhase(battle.phase, battle.arrows),
      arrows: Array.isArray(battle.arrows) ? battle.arrows : [],
      activeStatuses: Array.isArray(battle.activeStatuses) ? battle.activeStatuses : [],
      unlockedParts: new Set(Array.isArray(battle.unlockedParts) ? battle.unlockedParts : []),
    },
    resolvedAbilityKeys: Array.isArray(snapshot.resolvedAbilityKeys) ? snapshot.resolvedAbilityKeys : [],
    shootingEnds: Array.isArray(snapshot.shootingEnds) ? snapshot.shootingEnds : [],
  };
}
