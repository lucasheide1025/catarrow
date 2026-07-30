import { CARRY_POTIONS } from "./itemData";

export const DUNGEON_MERCHANT_TYPES = Object.freeze([
  "healer", "magic_weapon", "magic_armor", "mystery",
]);

const MATERIAL_CHEST_PRICES = Object.freeze({
  1:600, 2:1000, 3:1500, 4:2200, 5:3000, 6:4200,
});

const MERCHANT_META = Object.freeze({
  healer:{ name:"生命藥水商人", subtitle:"傷口與行囊，都可以在這裡整理", x:0, y:0 },
  magic_weapon:{ name:"魔法武器商人", subtitle:"選擇一件陪你走完整趟地下城", x:1, y:0 },
  magic_armor:{ name:"魔法防具商人", subtitle:"一次選擇，換取本趟穩固防線", x:0, y:1 },
  mystery:{ name:"神秘素材商人", subtitle:"只販售這座地下城所屬族系的箱子", x:1, y:1 },
});

export function drawDungeonMerchantType(random = Math.random) {
  return DUNGEON_MERCHANT_TYPES[
    Math.min(3, Math.floor(random() * DUNGEON_MERCHANT_TYPES.length))
  ];
}

export function buildDungeonMerchant({ type, family = "ghost", tier = 1 } = {}) {
  const merchantType = DUNGEON_MERCHANT_TYPES.includes(type) ? type : "healer";
  let items = [];
  if (merchantType === "healer") {
    items = [
      { id:"heal_10", name:"小型生命藥水", desc:"立即回復最大 HP 10%", kind:"instant_heal", effect:"hp_restore", value:0.1, cost:200, limit:1, limitScope:"run" },
      { id:"heal_25", name:"中型生命藥水", desc:"立即回復最大 HP 25%", kind:"instant_heal", effect:"hp_restore", value:0.25, cost:500, limit:1, limitScope:"run" },
      { id:"heal_50", name:"大型生命藥水", desc:"立即回復最大 HP 50%", kind:"instant_heal", effect:"hp_restore", value:0.5, cost:1000, limit:1, limitScope:"run" },
      ...CARRY_POTIONS.filter(potion => potion.family === "heal").map(potion => {
        const available = !potion.futureFeature;
        return {
          id:`potion_${potion.id}`, potionId:potion.id, name:potion.name,
          desc:available ? potion.effectText : "功能準備中",
          kind:"carry_potion", effect:"add_potion", level:potion.level,
          cost:potion.level === 1 ? 250 : 600, limit:1, limitScope:"room",
          locked:!available, lockedReason:"功能準備中",
        };
      }),
      { id:"potion_level_3", name:"Level 3 攜帶型回復藥", desc:"尚未開放", kind:"locked", cost:0, locked:true, lockedReason:"尚未開放" },
    ];
  } else if (merchantType === "magic_weapon" || merchantType === "magic_armor") {
    const isWeapon = merchantType === "magic_weapon";
    items = [10,25,50].map((pct, index) => ({
      id:`${isWeapon ? "weapon" : "armor"}_${pct}`,
      name:`${isWeapon ? "魔法武器" : "魔法防具"}・${pct}%`,
      desc:`本趟地下城 ${isWeapon ? "ATK" : "DEF"} +${pct}%`,
      kind:isWeapon ? "magic_weapon" : "magic_armor",
      effect:isWeapon ? "dungeon_atk" : "dungeon_def",
      value:pct / 100, pct, cost:[500,1200,2500][index],
      group:merchantType, limit:1, limitScope:"run",
    }));
  } else {
    const currentTier = Math.min(6, Math.max(1, Number(tier) || 1));
    const tiers = [...new Set([currentTier - 1, currentTier, currentTier + 1]
      .filter(value => value >= 1 && value <= 6))];
    items = tiers.map(chestTier => ({
      id:`material_${family}_t${chestTier}`, name:`T${chestTier} ${family}族素材箱`,
      desc:`開啟獲得 ${family} 族 T${chestTier} 一般素材`,
      kind:"material_chest", family, tier:chestTier,
      cost:MATERIAL_CHEST_PRICES[chestTier], limit:3, limitScope:"room",
    }));
  }
  return { type:merchantType, ...MERCHANT_META[merchantType], items };
}
