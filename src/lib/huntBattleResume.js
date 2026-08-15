export const HUNT_BATTLE_RESUME_KEY = "free_hunt_battle_resume_v1";
export const MONSTER_BATTLE_SAVE_KEY = "mb_battle_save";
const DEFAULT_TTL = 30 * 60 * 1000;

export function buildHuntBattleResume(monsterId, now = Date.now(), ttl = DEFAULT_TTL) {
  if (!monsterId) return null;
  return { version:1, source:"free-hunt", monsterId, savedAt:now, expiresAt:now + ttl };
}

export function parseHuntBattleResume(descriptor, battleSave, now = Date.now()) {
  if (!descriptor || descriptor.version !== 1 || descriptor.source !== "free-hunt" || !descriptor.monsterId) return null;
  if (!Number.isFinite(descriptor.expiresAt) || descriptor.expiresAt < now) return null;
  if (!battleSave?.runtimeSnapshot || battleSave.huntMonsterId !== descriptor.monsterId) return null;
  return descriptor;
}

export function readHuntBattleResume(storage = sessionStorage, now = Date.now()) {
  try {
    const descriptor = JSON.parse(storage.getItem(HUNT_BATTLE_RESUME_KEY) || "null");
    const battleSave = JSON.parse(storage.getItem(MONSTER_BATTLE_SAVE_KEY) || "null");
    return parseHuntBattleResume(descriptor, battleSave, now);
  } catch { return null; }
}

export function writeHuntBattleResume(monsterId, storage = sessionStorage, now = Date.now()) {
  const descriptor = buildHuntBattleResume(monsterId, now);
  if (descriptor) storage.setItem(HUNT_BATTLE_RESUME_KEY, JSON.stringify(descriptor));
  return descriptor;
}

export function clearHuntBattleResume(storage = sessionStorage, { clearBattle = false } = {}) {
  storage.removeItem(HUNT_BATTLE_RESUME_KEY);
  if (clearBattle) storage.removeItem(MONSTER_BATTLE_SAVE_KEY);
}
