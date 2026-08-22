import { computeDexStats } from "./achievementDex";
import { archerLevelBonus, archerLevelFromXP } from "./archerLevel";
import { calcCardCombatEffectsFromCollection } from "./cardTalents";
import { buildCombatModifiers } from "./combatModifiers";
import { calcArcherStats, describeStatSources } from "./monsterData";
import { calcEquippedBonus, resolveEquippedCards } from "./monsterCards";

// The character sheet, solo multi-hunt and party multi-hunt must all enter a
// battle with this exact total. Keep conditional combat effects separate.
export function buildAdventurerCombatStats({ member = {}, sharedData = {}, equipSpec = null, enemyFamily = null, enemyClass = "normal" } = {}) {
  const cardData = sharedData?.cardData || { cards:{}, equipped:[] };
  const dexStats = computeDexStats({
    member,
    certification:sharedData?.certification || null,
    certRecords:sharedData?.certRecords || [],
    checkinCount:member?.dailyQuestCount || 0,
    granted:Array.isArray(sharedData?.dexGrants) ? sharedData.dexGrants : [],
    physicalMax:sharedData?.dexConfig?.physicalMax,
    pointMax:sharedData?.dexConfig?.pointMax,
    monsterDex:sharedData?.monsterDex || {},
    craftStats:sharedData?.craftStats || {},
    chestStats:sharedData?.chestStats || {},
    potionDex:sharedData?.potionDex || {},
    cardData,
    duelStats:sharedData?.duelStats || null,
    cats:sharedData?.cats || [],
    guildRep:sharedData?.guildRep || 0,
    guildExpeditionStats:sharedData?.guildExpeditionStats || null,
    dexCompetitions:sharedData?.dexCompetitions || [],
  });
  const base = calcArcherStats({
    member,
    certification:sharedData?.certification || null,
    certRecords:sharedData?.certRecords || [],
    dexStats,
  });
  const level = archerLevelBonus(archerLevelFromXP(member?.archerXP || 0));
  const card = calcEquippedBonus(resolveEquippedCards(cardData));
  const total = {
    hp:Math.max(1, Math.round((base?.hp || 0) + (level?.hp || 0) + (card?.hp || 0))),
    atk:Math.max(0, Math.round((base?.atk || 0) + (level?.atk || 0) + (card?.atk || 0))),
    def:Math.max(0, Math.round((base?.def || 0) + (level?.def || 0) + (card?.def || 0))),
  };
  const cardFx = calcCardCombatEffectsFromCollection(cardData, { enemyFamily, enemyClass });
  const combatMods=buildCombatModifiers({ cardFx, equipSpec });
  return {
    ...total,
    dexStats,
    statSources:describeStatSources({ member, certification:sharedData?.certification || null, certRecords:sharedData?.certRecords || [], dexStats, archerLevel:archerLevelFromXP(member?.archerXP || 0) }),
    cards:{
      equippedKeys:Array.isArray(cardData?.equipped) ? [...cardData.equipped] : [],
      effectVersion:2,
      flat:{ hp:card?.hp || 0, atk:card?.atk || 0, def:card?.def || 0 },
      familyDamageBonusPct:{ ...(card?.familyDamageBonusPct || {}) },
      familyDamageReducePct:{ ...(card?.familyDamageReducePct || {}) },
      combatMods,
      supportedEffects:["flat_stats","family_damage","family_reduction","card_outgoing_modifiers","card_incoming_reduction","status_inflict","status_resistance","opening_shield","reflect","end_round_heal","cat_archetype","cat_bond"],
      unsupportedEffectKeys:[],
    },
  };
}
