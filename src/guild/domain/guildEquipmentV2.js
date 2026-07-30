import {
  GRADE_META,
  GRADE_MULT,
  GUILD_AFFIXES,
  GUILD_EQUIP_ARCHETYPES,
  PLUS_PCT_PER_LEVEL,
  plusCapOf,
} from "../data/guildEquipCatalog";

export const EQUIPMENT_SCHEMA_VERSION = 2;

export const SLOT_IDENTITIES = Object.freeze({
  bow: { role: "主武器", primaryStats: ["atk"], affixTags: ["attack", "tempo", "fortune"] },
  arrow: { role: "箭矢效果", primaryStats: ["atk"], affixTags: ["attack", "tempo", "fortune", "survival"] },
  armor: { role: "承傷防護", primaryStats: ["hp", "def"], affixTags: ["guard", "survival", "tempo", "fortune"] },
  quiver: { role: "射擊節奏", primaryStats: ["agi"], affixTags: ["tempo", "attack", "fortune", "survival"] },
  potionPouch: { role: "遠征續航", primaryStats: ["vit"], affixTags: ["survival", "guard", "fortune"] },
});

export const WEIGHT_CLASSES = Object.freeze({
  light: { label: "輕型", max: 1.5 },
  medium: { label: "中型", max: 3 },
  heavy: { label: "重型", max: Infinity },
});

export const EQUIPMENT_TRAITS = Object.freeze({
  precise: { name: "穩定瞄準", description: "高分箭的傷害更穩定", tags: ["accuracy"] },
  rapid: { name: "快速搭箭", description: "偏向敏捷與連續射擊", tags: ["tempo"] },
  breaker: { name: "破陣", description: "偏向對高防禦目標造成壓力", tags: ["armorBreak"] },
  survivor: { name: "野外求生", description: "偏向補給效率與攜帶量", tags: ["supply"] },
  bulwark: { name: "堅守", description: "偏向生命與減傷", tags: ["guard"] },
  fortune: { name: "尋寶直覺", description: "偏向暴擊與遠征收穫", tags: ["fortune"] },
});

const TRAIT_BY_ARCHETYPE = Object.freeze({
  siege_bow: "breaker", long_bow: "precise", short_bow: "rapid", bamboo_bow: "survivor",
  spirit_bow: "fortune", hunter_bow: "fortune",
  bodkin_arrow: "breaker", heavy_arrow: "breaker", feather_arrow: "rapid",
  blessed_arrow: "fortune", poison_arrow: "survivor",
  plate_armor: "bulwark", chain_armor: "bulwark", robe_armor: "survivor",
  fortune_vest: "fortune", scout_armor: "rapid",
  swift_quiver: "rapid", ranger_quiver: "rapid", gilded_quiver: "fortune",
  wide_quiver: "survivor", war_quiver: "breaker",
  ration_pack: "survivor", herb_pouch: "survivor", waterskin: "survivor",
  medic_bag: "bulwark", alchemy_kit: "fortune",
});

const AFFIX_TAGS = Object.freeze({
  sharp: ["attack"], brutal: ["attack"], sturdy: ["guard"], vital: ["guard"],
  swift: ["tempo"], lucky: ["fortune"], enduring: ["survival"],
  balanced: ["attack", "guard"], hunters: ["attack", "fortune"], guardians: ["guard"],
});

const roundStat = value => Math.round(value);
const weightClassOf = weight => (
  weight <= WEIGHT_CLASSES.light.max ? "light"
    : weight <= WEIGHT_CLASSES.medium.max ? "medium"
      : "heavy"
);

function primaryStatOf(archetype, identity) {
  return identity.primaryStats
    .slice()
    .sort((a, b) => Math.abs(archetype.base[b] || 0) - Math.abs(archetype.base[a] || 0))[0];
}

export function equipmentDefinition(archetypeId) {
  const archetype = GUILD_EQUIP_ARCHETYPES[archetypeId];
  if (!archetype) return null;
  const identity = SLOT_IDENTITIES[archetype.slot];
  const traitId = TRAIT_BY_ARCHETYPE[archetypeId]
    || (archetype.base.luk ? "fortune" : archetype.base.vit ? "survivor" : archetype.base.agi ? "rapid"
      : archetype.slot === "armor" ? "bulwark" : "precise");
  return {
    version: EQUIPMENT_SCHEMA_VERSION,
    id: archetypeId,
    slot: archetype.slot,
    role: identity.role,
    weightClass: weightClassOf(archetype.weight),
    primary: primaryStatOf(archetype, identity),
    secondary: Object.keys(archetype.base).filter(stat => stat !== primaryStatOf(archetype, identity)),
    traitId,
    trait: EQUIPMENT_TRAITS[traitId],
    allowedAffixTags: identity.affixTags,
  };
}

export function isAffixCompatible(archetypeId, affixId) {
  const definition = equipmentDefinition(archetypeId);
  const affix = GUILD_AFFIXES[affixId];
  if (!definition || !affix) return false;
  const tags = AFFIX_TAGS[affixId] || [];
  const hasAllowedTag = tags.some(tag => definition.allowedAffixTags.includes(tag));
  const hasEffect = Object.keys(affix.flat || {}).length > 0
    || Object.keys(affix.pct || {}).some(stat => (GUILD_EQUIP_ARCHETYPES[archetypeId].base[stat] || 0) > 0);
  return hasAllowedTag && hasEffect;
}

export function compatibleAffixIds(archetypeId) {
  return Object.keys(GUILD_AFFIXES).filter(id => isAffixCompatible(archetypeId, id));
}

export function migrateEquipmentItem(item) {
  if (!item?.archetypeId || !equipmentDefinition(item.archetypeId)) return item;
  if (item.equipmentVersion === EQUIPMENT_SCHEMA_VERSION) return item;
  return { ...item, equipmentVersion: EQUIPMENT_SCHEMA_VERSION };
}

export function resolveEquipmentV2(archetypeId, grade, item = {}) {
  const archetype = GUILD_EQUIP_ARCHETYPES[archetypeId];
  if (!archetype) return { stats: {}, definition: null, affixes: [], legacyAffixes: [] };
  const gradeMult = GRADE_MULT[grade] || 1;
  const stats = Object.fromEntries(
    Object.entries(archetype.base).map(([stat, value]) => [stat, value * gradeMult]),
  );
  const affixes = [];
  const legacyAffixes = [];
  for (const affixId of item.affixes || []) {
    const affix = GUILD_AFFIXES[affixId];
    if (!affix) continue;
    (isAffixCompatible(archetypeId, affixId) ? affixes : legacyAffixes).push(affixId);
    for (const [stat, pct] of Object.entries(affix.pct || {})) {
      if ((stats[stat] || 0) > 0) stats[stat] += stats[stat] * pct;
    }
    for (const [stat, flat] of Object.entries(affix.flat || {})) stats[stat] = (stats[stat] || 0) + flat;
  }
  const plus = Math.max(0, Math.min(plusCapOf(grade), Math.floor(Number(item.plus) || 0)));
  const enhanceMult = 1 + plus * PLUS_PCT_PER_LEVEL;
  const resolved = {};
  for (const [stat, value] of Object.entries(stats)) {
    resolved[stat] = roundStat(value > 0 ? value * enhanceMult : value);
  }
  return {
    stats: resolved,
    definition: equipmentDefinition(archetypeId),
    gradeBudget: GRADE_META[grade]?.tier || 1,
    affixes,
    legacyAffixes,
  };
}
