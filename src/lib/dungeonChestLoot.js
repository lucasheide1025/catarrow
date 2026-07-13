import { FAMILY_COLLECTIBLES } from "./dungeonCollectibles";
import { MATERIALS } from "./monsterMaterials";

const CHEST_MATERIAL_TIERS = ["common", "rare", "elite", "fierce"];

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)] || null;
}

// Normal chest rooms intentionally stop at T4/fierce materials, even in a T5/T6 dungeon.
export function createOrdinaryChestLoot({ family = "ghost", difficultyTier = 1, hidden = false } = {}) {
  const cappedTier = CHEST_MATERIAL_TIERS[Math.min(3, Math.max(0, Number(difficultyTier || 1) - 1))];
  const materialPool = MATERIALS.filter(material =>
    material.family === family && material.tier === cappedTier,
  );
  const collectiblePool = FAMILY_COLLECTIBLES[family];
  const itemPool = collectiblePool
    ? [...(collectiblePool.common || []), ...(collectiblePool.rare || [])]
    : [];
  const item = Math.random() < (hidden ? 0.65 : 0.35) ? randomFrom(itemPool) : null;
  const material = randomFrom(materialPool);

  return {
    coins: (hidden ? 35 : 15) + Math.floor(Math.random() * (hidden ? 36 : 26)),
    material: material ? { id: material.id, name: material.name, icon: material.icon, tier: material.tier } : null,
    item: item ? { id: item.id, name: item.name, icon: item.icon, desc: item.desc } : null,
    isHidden: !!hidden,
    materialTierCap: "fierce",
  };
}
