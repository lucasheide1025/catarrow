import { calcCardCombatEffectsFromCollection } from "./cardTalents";
import { calcEquippedBonus, resolveEquippedCards, resolveFamilyModifiers } from "./monsterCards";
import { buildCombatModifiers } from "./combatModifiers";

export function buildCombatLoadoutSnapshot({ collection = {}, equipSpec = null } = {}) {
  const cardBonus=calcEquippedBonus(resolveEquippedCards(collection));
  const cardFx=calcCardCombatEffectsFromCollection(collection);
  return {
    familyDamageBonusPct:{...(cardBonus.familyDamageBonusPct||{})},
    familyDamageReducePct:{...(cardBonus.familyDamageReducePct||{})},
    combatMods:buildCombatModifiers({cardFx,equipSpec}),
  };
}

export function resolveSnapshotFamilyBonus(snapshot, monsterFamily) {
  return resolveFamilyModifiers(snapshot,monsterFamily);
}
