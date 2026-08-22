"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MONSTER_EXPANSION_VERSION = exports.EXPANSION_MONSTER_BY_ID = exports.EXPANSION_MONSTERS = exports.EXPANSION_MATERIALS = exports.EXPANSION_CARDS = void 0;
exports.validateMonsterExpansionCatalog = validateMonsterExpansionCatalog;
var _monsterExpansionCatalog = _interopRequireDefault(require("../data/monsterExpansionCatalog.json"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const MONSTER_EXPANSION_VERSION = exports.MONSTER_EXPANSION_VERSION = _monsterExpansionCatalog.default.version;
const EXPANSION_MONSTERS = exports.EXPANSION_MONSTERS = Object.freeze(_monsterExpansionCatalog.default.monsters);
const EXPANSION_MONSTER_BY_ID = exports.EXPANSION_MONSTER_BY_ID = Object.freeze(Object.fromEntries(EXPANSION_MONSTERS.map(monster => [monster.id, monster])));
const EXPANSION_MATERIALS = exports.EXPANSION_MATERIALS = Object.freeze(EXPANSION_MONSTERS.map(monster => ({
  ...monster.material,
  family: monster.family,
  tier: monster.tier,
  tierIndex: monster.tierIndex,
  monsterId: monster.id
})));
const EXPANSION_CARDS = exports.EXPANSION_CARDS = Object.freeze(EXPANSION_MONSTERS.map(monster => ({
  ...monster.card,
  monsterId: monster.id,
  family: monster.family,
  tier: monster.tier,
  tierIndex: monster.tierIndex,
  encounter: monster.encounter,
  role: monster.role,
  name: monster.name
})));
function validateMonsterExpansionCatalog() {
  const errors = [];
  const uniqueCount = values => new Set(values).size;
  const counts = EXPANSION_MONSTERS.reduce((result, monster) => {
    const key = `${monster.family}:${monster.tier}`;
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  if (EXPANSION_MONSTERS.length !== 252) errors.push("monster_count");
  if (uniqueCount(EXPANSION_MONSTERS.map(item => item.id)) !== 252) errors.push("monster_id_unique");
  if (uniqueCount(EXPANSION_MATERIALS.map(item => item.id)) !== 252) errors.push("material_id_unique");
  if (uniqueCount(EXPANSION_CARDS.map(item => item.id)) !== 252) errors.push("card_id_unique");
  if (uniqueCount(EXPANSION_MONSTERS.map(item => item.signatureSkillId)) !== 252) errors.push("signature_id_unique");
  if (Object.keys(counts).length !== 42 || Object.values(counts).some(count => count !== 6)) errors.push("family_tier_shape");
  if (EXPANSION_MONSTERS.filter(item => item.encounter === "normal").length !== 126) errors.push("normal_count");
  if (EXPANSION_MONSTERS.filter(item => item.encounter === "miniBoss").length !== 84) errors.push("mini_boss_count");
  if (EXPANSION_MONSTERS.filter(item => item.encounter === "boss").length !== 42) errors.push("boss_count");
  if (EXPANSION_MATERIALS.some(item => item.convertible !== (item.kind === "normal"))) errors.push("material_conversion_boundary");
  if (EXPANSION_MATERIALS.some(item => item.tierIndex === 6 && item.upgradesToTier !== null)) errors.push("t6_upgrade_boundary");
  if (EXPANSION_MONSTERS.some(item => !item.commonSkillIds.length || !item.signatureName || !item.counterSummary)) errors.push("skill_reference_missing");
  return {
    ok: errors.length === 0,
    errors,
    counts
  };
}
