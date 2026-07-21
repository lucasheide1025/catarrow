// src/zombie/domain/index.js
// ═══════════════════════════════════════════════════════════════
//  殭屍生存模式 — 領域模型匯出
// ═══════════════════════════════════════════════════════════════

export {
  ZOMBIE_PHASE,
  LIFE_STATE,
  ROLE,
  ZOMBIE_ARCHETYPE,
  ZONE_TYPE,
  ARMOR_SLOT,
  ACCESSORY_TYPE,
  BODY_PARTS,
  ARMOR_TIERS,
  ZONE_ENCOUNTER_RATES,
  ITEM_WEIGHTS,
  INITIAL_BACKPACK_CAPACITY,
} from "./types";

export {
  processRound,
  resolveArrowHit,
  moveZombies,
  createEncounterState,
  EVENT,
} from "./encounterResolver";

export {
  createInfectionState,
  processInfectionTick,
  processConsecutiveAttack,
  applyMedicalItem,
  resolveLifeState,
  canShoot,
  isAlive,
  INFECTION_EVENT,
} from "./infectionEngine";

export {
  generateMap,
  createMapState,
  moveToNode,
  purchaseMap,
  clearBoss,
  getReachableNodes,
  canExtract,
  getNodeDisplayLabel,
  updateIntel,
  MAP_EVENT,
} from "./mapEngine";

export {
  generateRandomEvent,
  checkExtractionRequirements,
  performExtraction,
  getExtractionMethod,
  EVENT_DEFINITIONS,
  EXTRACTION_METHODS,
  RANDOM_EVENT,
  EXTRACTION_TYPE,
} from "./eventEngine";

export {
  calculateBackpackWeight,
  isOverweight,
  addItem,
  consumeItem,
  consumeNodeSupplies,
  createBackpack,
  getArrowInfo,
  getItemWeight,
  BACKPACK_EVENT,
} from "./backpackEngine";

export {
  createBaseState,
  upgradeBuilding,
  getBaseLevel,
  getBaseStats,
  calculateBaseEffects,
  addResource,
  getBaseCompletion,
  BASE_EVENT,
} from "./baseEngine";

export {
  createBossEncounter,
  processBossRound,
  resolveBossHit,
  getBossPhase,
  getBossStatus,
  BOSS_EVENT,
  BOSS_PHASE_COLORS,
  BOSS_PHASE_LABELS,
} from "./bossEngine";

export {
  createFullyInfectedSupport,
  applyWeakPointMark,
  processMarkDurations,
  useInterference,
  addInterferenceScore,
  getMarkedZombies,
  getDamageBoost,
  getHalvedThreshold,
  resetSupportState,
  MARK_DEFAULT_DURATION,
  MARK_DEFAULT_BOOST,
  SUPPORT_EVENT,
} from "./fullyInfectedSupportEngine";

export {
  GAME_PHASE,
  createInitialGameState,
  transitionPhase,
  getPhaseLabel,
  getPhaseIcon,
  isValidTransition,
  resetToLobby,
} from "./gameStateMachine";

export {
  createParty,
  joinParty,
  leaveParty,
  toggleReady,
  isAllReady,
  setPlayerEquipment,
  updateInfection,
  recordShot,
  getAliveMembers,
  getInfectedMembers,
  getMemberBySlot,
  createPlayer,
  MAX_PARTY_SIZE,
  PLAYER_ROLE,
  SLOT_LABELS,
  getRoleLabel,
} from "./partyEngine";
