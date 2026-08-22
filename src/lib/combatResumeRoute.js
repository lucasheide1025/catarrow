export function resolveCombatResumePage({
  storedPage,
  hasMultiMonsterPartySession = false,
  hasHuntResume = false,
  fallbackPage = "home",
} = {}) {
  // A dungeon owns its nested battle renderer. Restoring a generic hunt room
  // first would detach the player from the expedition coordinator and strand
  // the nested battle after refresh.
  if (storedPage === "dungeon") return "dungeon";
  if (hasMultiMonsterPartySession) return "multi-monster-party";
  if (hasHuntResume) return "hunt";
  return storedPage || fallbackPage;
}

