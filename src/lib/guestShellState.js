export const GUEST_SHELL_TABS = Object.freeze(["home", "adventure", "inventory", "equipment"]);
export function getGuestNavTab(page) {
  if (["monster", "party", "dungeon", "worldboss", "handbook"].includes(page)) return "adventure";
  return GUEST_SHELL_TABS.includes(page) ? page : "home";
}
export function getQrTimeState(expiresAt, now = Date.now()) {
  const expiresMs = Number(expiresAt || 0);
  const remainingMs = Math.max(0, expiresMs - now);
  return { remainingMs, expired:!expiresMs || remainingMs <= 0,
    warning:remainingMs > 0 && remainingMs <= 10 * 60_000,
    notifyTwoMinutes:remainingMs > 0 && remainingMs <= 2 * 60_000 };
}
export function formatQrRemaining(remainingMs) {
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60_000));
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;
}
export function getGuestEquipmentPageAction(page) {
  if (page === "inventory-hub") return "home";
  if (page === "coinshop") return "equipment";
  return null;
}
