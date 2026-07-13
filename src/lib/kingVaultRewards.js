import { MATERIALS } from "./monsterMaterials";

export const KING_SEAL_BY_TIER = [1, 1, 2, 3, 5, 8];
const MATERIAL_TIER_BY_DUNGEON_TIER = ["common", "rare", "elite", "fierce", "boss", "mythic"];
const RUNE_FRAGMENT_TYPES = ["atk", "def", "hp", "cat"];

export function rollKingVaultReward(dungeonTier = 1, family = "treasure") {
  const tier = Math.max(1, Math.min(6, Number(dungeonTier) || 1));
  const materialTier = MATERIAL_TIER_BY_DUNGEON_TIER[tier - 1];
  const pool = MATERIALS.filter(material => material.family === family && material.tier === materialTier);
  const choices = pool.length ? pool : MATERIALS.filter(material => material.tier === materialTier);
  const materials = Array.from({ length: Math.min(4, 1 + Math.ceil(tier / 2)) }, () =>
    choices[Math.floor(Math.random() * choices.length)],
  ).filter(Boolean).map(material => ({ id: material.id, name: material.name, icon: material.icon }));
  const runeType = RUNE_FRAGMENT_TYPES[Math.floor(Math.random() * RUNE_FRAGMENT_TYPES.length)];
  return {
    kingSeals: KING_SEAL_BY_TIER[tier - 1], coins: 120 + tier * 90, materials,
    runeFragments: [{ type: runeType, count: 2 + tier }], dungeonTier: tier,
  };
}
