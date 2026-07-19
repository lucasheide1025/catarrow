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
      // ⚠️ 寶箱族（treasure）沒有專屬收藏品池 —— FAMILY_COLLECTIBLES 只定義了六個
      // 一般族系。寶箱王房因此會 throw missing_collectible_pool，玩家完全領不到獎勵
      // （使用者實測）。缺池時退到「所有族的同稀有度合併池」，語意上也說得通：
      // 寶箱族本來就是什麼都有。
      // 再往下退一層稀有度：superRare 目前整個合併池是空的（尚未有該階收藏品），
      // 只靠族系 fallback 仍會 throw。
      const poolFor = rarity => {
        const own = FAMILY_COLLECTIBLES[monster.family]?.[rarity] || [];
        return own.length ? own : Object.values(FAMILY_COLLECTIBLES).flatMap(entry => entry?.[rarity] || []);
      };
      let pool = poolFor(reward.rarity);
      if (!pool.length) {
        for (const fallbackRarity of ["boss", "rare", "common"]) {
          pool = poolFor(fallbackRarity);
          if (pool.length) break;
        }
      }
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
