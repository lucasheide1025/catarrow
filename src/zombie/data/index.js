// src/zombie/data/index.js
// ═══════════════════════════════════════════════════════════════
//  殭屍生存模式 — 資料表匯出
// ═══════════════════════════════════════════════════════════════

export {
  ZOMBIE_ARCHETYPES,
  BOSS_ARCHETYPES,
  ZOMBIE_STATUS,
  getArchetype,
  getAllArchetypes,
  getArchetypesForZone,
  getBOSSArchetype,
  generateEncounterProfile,
} from "./zombieArchetypes";

export {
  SPECIAL_ARROWS,
  MEDICAL_ITEMS,
  ACCESSORY_ITEMS,
  SUPPLY_ITEMS,
  ENHANCEMENT_ITEMS,
  getSpecialArrow,
  getAllArmor,
  getArmor,
  getMedicalItem,
  getAccessory,
  getSupply,
  getSuppliesByCategory,
  getEnhancement,
} from "./itemData";

export {
  BUILDINGS,
  BASE_MATERIALS,
  UPGRADE_COSTS,
  getBuilding,
  getUpgradeCost,
  getBuildingEffectDesc,
  getAccessorySlots,
  getBackpackBonus,
} from "./baseData";

export {
  GIANT_KING_REWARDS,
  getBossRewards,
  rollBossDrops,
  calculateBossReward,
} from "./bossRewards";
