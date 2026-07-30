export function normalizeWorldBossState(event) {
  if (!event) return null;
  const maxHP = Math.max(1, Number(event.bossMaxHP) || Number(event.bossData?.hp) || 1);
  const rawHP = Number(event.bossCurrentHP);
  const terminal = event.status === "defeated" || (event.status !== "expired" && event.status !== "cancelled" && Number.isFinite(rawHP) && rawHP <= 0);
  return {
    ...event,
    status:terminal ? "defeated" : event.status,
    bossMaxHP:maxHP,
    bossCurrentHP:terminal ? 0 : Math.max(0, Math.min(maxHP, Number.isFinite(rawHP) ? rawHP : maxHP)),
    needsTerminalRepair:event.status === "defeated" && Number.isFinite(rawHP) && rawHP > 0,
  };
}

export function findPendingWorldBossEvents(events, memberId) {
  if (!memberId) return [];
  return (events || [])
    .map(normalizeWorldBossState)
    .filter(event => {
      const mine = event?.participants?.[memberId];
      const eligible = mine && (mine.accountType === "official" || mine.isGuest !== true);
      return event?.status === "defeated" && eligible && mine.claimed !== true;
    })
    .sort((a, b) => {
      const time = value => value?.createdAt?.toMillis?.() || value?.createdAt?.seconds * 1000 || 0;
      return time(b) - time(a);
    });
}

export function shouldShowWorldBossVictory(result) {
  return !!(result?.ok && (result.defeated || result.bossAlreadyDefeated));
}
