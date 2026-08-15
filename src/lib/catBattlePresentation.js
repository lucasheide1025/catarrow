const PRESENTATION_TYPE_BY_ARCHETYPE = Object.freeze({
  heal: "heal",
  attack: "atk",
  defense: "def",
});

export function getCatBattlePresentationType(archetypeType) {
  return PRESENTATION_TYPE_BY_ARCHETYPE[archetypeType] || "atk";
}
