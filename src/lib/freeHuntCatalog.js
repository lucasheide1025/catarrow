import { EXPANSION_MONSTERS, EXPANSION_MONSTER_BY_ID } from "./monsterExpansionCatalog";
import { toLegacyBattleMonster } from "./monsterExpansionAdapter";

export const FREE_HUNT_FAMILIES = Object.freeze([
  "ghost",
  "mountain",
  "insect",
  "workplace",
  "exam",
  "temple",
  "treasure",
]);

export const FREE_HUNT_TIERS = Object.freeze([1, 2, 3, 4, 5, 6]);

export const FREE_HUNT_MONSTERS = Object.freeze(
  EXPANSION_MONSTERS.filter(monster => monster.encounter === "normal")
);

export function getFreeHuntMonsters(family, tierIndex) {
  const tier = Number(tierIndex);
  return FREE_HUNT_MONSTERS.filter(monster =>
    monster.family === family && Number(monster.tierIndex) === tier
  );
}

export function getFreeHuntMonsterById(monsterId) {
  const monster = EXPANSION_MONSTER_BY_ID[monsterId] || null;
  return monster?.encounter === "normal" ? monster : null;
}

export function getFreeHuntBattleMonster(monsterId) {
  const monster = getFreeHuntMonsterById(monsterId);
  return monster ? toLegacyBattleMonster(monster) : null;
}
