import { FAMILY_COLLECTIBLES } from "./dungeonCollectibles";
import { CARRY_POTIONS } from "./itemData";
import { EXPANSION_MATERIALS } from "./monsterExpansionCatalog";

const CHEST_MATERIAL_TIERS = ["common", "rare", "elite", "fierce", "boss", "mythic"];

function randomFrom(list, random = Math.random) {
  if (!list?.length) return null;
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))] || null;
}

export function createOrdinaryChestLoot({
  family = "ghost",
  difficultyTier = 1,
  hidden = false,
  random = Math.random,
} = {}) {
  const tierNumber = Math.min(6, Math.max(1, Number(difficultyTier) || 1));
  const materialTier = CHEST_MATERIAL_TIERS[tierNumber - 1];
  const materialPool = EXPANSION_MATERIALS.filter(material =>
    material.family === family && material.tierIndex === tierNumber && material.kind === "normal"
  );
  const collectiblePool = FAMILY_COLLECTIBLES[family];
  const rarityKeys = tierNumber >= 5
    ? ["rare", "boss", "superRare"]
    : tierNumber >= 3 ? ["common", "rare"] : ["common"];
  const itemPool = collectiblePool
    ? rarityKeys.flatMap(key => collectiblePool[key] || [])
    : [];
  const potionPool = CARRY_POTIONS.filter(potion =>
    !potion.futureFeature && (tierNumber >= 4 || potion.level <= 1)
  );
  const material = randomFrom(materialPool, random);
  const item = randomFrom(itemPool, random);
  const potion = randomFrom(potionPool, random);
  const materialQuantity = tierNumber + (hidden ? 2 : 0);

  return {
    coins: (hidden ? 55 : 30) + tierNumber * 25 + Math.floor(random() * (20 + tierNumber * 10)),
    material: material ? {
      id: material.id,
      name: material.name,
      // ⚠️ EXPANSION_MATERIALS 的 material 物件沒有 icon 欄位（252 隻全缺）——
      //    直接寫 undefined 進 Firestore 會 400（巢狀 undefined），組隊探險踩寶箱房整隊卡死。
      //    choice 顯示層（:85）有 fallback，巢狀 material 也要有。
      icon: material.icon || "🧱",
      family: material.family,
      tier: material.tier,
      tierIndex: material.tierIndex,
      kind: material.kind,
      monsterId: material.monsterId,
      quantity: materialQuantity,
    } : null,
    item: item ? { id: item.id, name: item.name, icon: item.icon, desc: item.desc } : null,
    potion: potion ? {
      id: potion.id,
      name: potion.name,
      icon: potion.icon,
      desc: potion.effectText,
      quantity: 1,
    } : null,
    isHidden: !!hidden,
    materialTier,
  };
}

function rotate(list, offset) {
  const safeOffset = ((offset % list.length) + list.length) % list.length;
  return [...list.slice(safeOffset), ...list.slice(0, safeOffset)];
}

export function createOrdinaryChestChoices(options = {}) {
  const random = options.random || Math.random;
  const loot = createOrdinaryChestLoot({ ...options, random });
  const candidates = [
    {
      id: "coins",
      type: "coins",
      title: "金幣袋",
      icon: "🪙",
      desc: `獲得 ${loot.coins} 金幣`,
      value: loot.coins,
    },
    loot.material && {
      id: `material_${loot.material.id}`,
      type: "material",
      title: loot.material.name,
      icon: loot.material.icon || "🧱",
      desc: `獲得 ${loot.material.name} ×${loot.material.quantity}`,
      material: loot.material,
    },
    loot.potion && {
      id: `potion_${loot.potion.id}`,
      type: "potion",
      title: loot.potion.name,
      icon: loot.potion.icon || "🧪",
      desc: loot.potion.desc || "獲得戰鬥藥水 ×1",
      potion: loot.potion,
    },
    loot.item && {
      id: `item_${loot.item.id}`,
      type: "item",
      title: loot.item.name,
      icon: loot.item.icon || "🎒",
      desc: loot.item.desc || "獲得地下城道具 ×1",
      item: loot.item,
    },
  ].filter(Boolean);

  const offset = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return rotate(candidates, offset).slice(0, 3);
}
