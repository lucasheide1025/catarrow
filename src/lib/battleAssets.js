const BATTLE_FAMILIES = new Set(["ghost", "mountain", "insect", "workplace", "exam", "temple"]);

export function getBattleBackgroundUrl(family) {
  return BATTLE_FAMILIES.has(family)
    ? `/ui/battle-bg/family-${family}.webp`
    : "/ui/dungeon-bg.webp";
}

export function getBattleMonsterSources(id) {
  return [
    `/monsters-battle/${id}.webp`,
    `/monsters/${id}.webp`,
  ];
}
