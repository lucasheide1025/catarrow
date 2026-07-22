export const GUEST_ALLOWED_FAMILIES = Object.freeze([
  "ghost", "mountain", "insect", "workplace", "exam", "temple",
]);
export const GUEST_MAX_TIER = 1;
export const GUEST_QR_LIFETIME_MS = 2 * 60 * 60 * 1000;

export function isQrGuest(profile) { return profile?.accountType === "kid"; }
export function isGuestMonsterAllowed(monster, mode = "standard") {
  if (mode === "worldboss") return true;
  if (!monster) return false;
  const family = monster.family || monster.monsterFamily || monster.race;
  const tier = Number(monster.tierIndex ?? monster.tier ?? monster.t);
  return GUEST_ALLOWED_FAMILIES.includes(family) && tier === GUEST_MAX_TIER;
}
export function filterGuestMonsters(monsters, mode = "standard") {
  return (monsters || []).filter(monster => isGuestMonsterAllowed(monster, mode));
}
export function getQrExpiry(createdAtMs = Date.now()) {
  return new Date(createdAtMs + GUEST_QR_LIFETIME_MS);
}
export function isQrProfileExpired(profile, nowMs = Date.now()) {
  if (!isQrGuest(profile)) return false;
  const value = profile?.expiresAt;
  const expiryMs = value?.toMillis ? value.toMillis() : value?.toDate ? value.toDate().getTime() : new Date(value || 0).getTime();
  return !Number.isFinite(expiryMs) || expiryMs <= nowMs;
}
