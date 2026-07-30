export const WORLD_BOSS_SPAWN_DEFAULTS = Object.freeze({
  restHours:8, deadlineHours:48,
  targets:{ arrows:10000, dungeonClears:30, monsterKills:500, villageDice:300 },
});

export function buildWorldBossSpawnCycle({ previousEventId, previousBossKey, defeatedAtMs, config = {} }) {
  const restHours = Math.max(0, Number(config.restHours) || WORLD_BOSS_SPAWN_DEFAULTS.restHours);
  const deadlineHours = Math.min(48, Math.max(restHours, Number(config.deadlineHours) || WORLD_BOSS_SPAWN_DEFAULTS.deadlineHours));
  return {
    status:"resting", previousEventId, previousBossKey,
    restEndsAtMs:defeatedAtMs + restHours * 3600000,
    deadlineAtMs:defeatedAtMs + deadlineHours * 3600000,
    progress:{ arrows:0, dungeonClears:0, monsterKills:0, villageDice:0 },
    targets:{ ...WORLD_BOSS_SPAWN_DEFAULTS.targets, ...(config.targets || {}) },
  };
}

export function evaluateWorldBossSpawnCycle(cycle, nowMs = Date.now()) {
  if (!cycle || ["spawning", "spawned"].includes(cycle.status)) return { ready:false, reason:cycle?.status || "missing" };
  if (nowMs < cycle.restEndsAtMs) return { ready:false, reason:"resting", remainingMs:cycle.restEndsAtMs - nowMs };
  const keys = ["arrows", "dungeonClears", "monsterKills", "villageDice"];
  const reached = keys.find(key => (cycle.progress?.[key] || 0) >= (cycle.targets?.[key] || Infinity));
  if (reached) return { ready:true, reason:reached };
  if (nowMs >= cycle.deadlineAtMs) return { ready:true, reason:"deadline" };
  return { ready:false, reason:"charging", remainingMs:cycle.deadlineAtMs - nowMs };
}

export function applyWorldBossSpawnContribution(cycle, type, amount, nowMs = Date.now()) {
  if (!cycle || nowMs < cycle.restEndsAtMs || !Object.hasOwn(cycle.progress || {}, type)) return cycle;
  return {
    ...cycle,
    status:"charging",
    progress:{ ...cycle.progress, [type]:(cycle.progress[type] || 0) + Math.max(0, Number(amount) || 0) },
  };
}
