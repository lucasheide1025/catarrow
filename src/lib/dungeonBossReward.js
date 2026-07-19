import { EXPANSION_MONSTER_BY_ID, MONSTER_EXPANSION_VERSION } from "./monsterExpansionCatalog";
import {
  buildBossReward,
  buildChoiceChestReward,
  buildRewardKey,
  resolveBossCardDrop,
} from "./monsterLootEngine";
import { FAMILY_COLLECTIBLES } from "./dungeonCollectibles";

const CHOICE_TYPES = Object.freeze(["material", "coins", "exploration"]);
const RUNE_FRAGMENT_TYPES = Object.freeze(["atk", "def", "hp", "cat"]);

function seededRoll(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

export function buildDungeonBossRewardEnvelope({
  battleId,
  memberId,
  monsterId,
  firstDefeat = false,
  cardMisses = 0,
}) {
  const monster = EXPANSION_MONSTER_BY_ID[monsterId];
  if (!battleId || !memberId) throw new Error("invalid_dungeon_reward_identity");
  if (!monster || !["miniBoss", "boss"].includes(monster.encounter)) {
    throw new Error("boss_monster_required");
  }

  const rewardKey = buildRewardKey({ battleId, memberId, rewardType:"dungeonBoss" });
  const cardResult = resolveBossCardDrop({
    encounter:monster.encounter,
    firstDefeat,
    misses:cardMisses,
    roll:seededRoll(`${rewardKey}:${monsterId}:card`),
  });
  const fixedReward = buildBossReward({ monsterId });
  const runeFragment = {
    type:RUNE_FRAGMENT_TYPES[Math.floor(seededRoll(`${rewardKey}:${monsterId}:rune`) * RUNE_FRAGMENT_TYPES.length)],
    count:fixedReward.runeFragments,
  };
  const choiceOptions = CHOICE_TYPES.map(type => {
    const reward = buildChoiceChestReward({
      type,
      monsterId,
      roll:seededRoll(`${rewardKey}:${monsterId}:choice:${type}`),
    });
    if (type === "exploration") {
      const pool = FAMILY_COLLECTIBLES[monster.family]?.[reward.rarity] || [];
      if (!pool.length) throw new Error(`missing_collectible_pool:${monster.family}:${reward.rarity}`);
      reward.itemId = pool[Math.floor(seededRoll(`${rewardKey}:${monsterId}:collectible`) * pool.length)].id;
    }
    return { id:`${rewardKey}:choice:${type}`, type, reward };
  });

  return Object.freeze({
    version:1,
    catalogVersion:MONSTER_EXPANSION_VERSION,
    rewardKey,
    battleId,
    memberId,
    monsterId,
    encounter:monster.encounter,
    fixedReward:{ ...fixedReward, runeFragment },
    cardResult,
    card:cardResult.dropped ? {
      monsterId:monster.card.id,
      name:monster.name,
      family:monster.family,
      tier:monster.tier,
      encounter:monster.encounter,
      artKey:monster.artKey,
    } : null,
    choiceCount:fixedReward.choiceCount,
    choiceOptions,
  });
}

export function validateDungeonBossChoices(envelope, selectedOptionIds) {
  if (!envelope?.rewardKey || !Array.isArray(selectedOptionIds)) return false;
  if (selectedOptionIds.length !== envelope.choiceCount) return false;
  if (new Set(selectedOptionIds).size !== selectedOptionIds.length) return false;
  const allowed = new Set((envelope.choiceOptions || []).map(option => option.id));
  return selectedOptionIds.every(id => allowed.has(id));
}
