"use strict";

const catalog = require("./data/monsterExpansionCatalog.json");

const MONSTERS = new Map(catalog.monsters.map(monster => [monster.id, monster]));
const COIN_RANGE = Object.freeze({
  common:[3,8], rare:[6,15], elite:[12,25], fierce:[20,40], boss:[35,65], mythic:[60,100],
});
const MODE_MULT = Object.freeze({ novice:1, student:2, veteran:3, match:4, expedition:0 });
const SOLO_CHALLENGE = Object.freeze({
  easy:{ materialQty:3, cardChance:0.12, coinMult:0.8 },
  standard:{ materialQty:5, cardChance:0.20, coinMult:1 },
  hard:{ materialQty:7, cardChance:0.30, coinMult:1.5 },
});
const REWARD_TYPES = new Set(["solo_hunt", "team_hunt"]);

function seededRoll(key) {
  let hash = 2166136261;
  for (const char of String(key)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

function requireId(value, code) {
  const id = String(value || "").trim();
  if (!id || id.length > 240 || id.includes("/")) throw new Error(code);
  return id;
}

function buildTrustedMonsterReward(input) {
  const battleId = requireId(input?.battleId, "invalid_battle_id");
  const memberId = requireId(input?.memberId, "invalid_member_id");
  const monsterId = requireId(input?.monsterId, "invalid_monster_id");
  const rewardType = String(input?.rewardType || "");
  if (!REWARD_TYPES.has(rewardType)) throw new Error("invalid_reward_type");
  const monster = MONSTERS.get(monsterId);
  if (!monster || monster.encounter !== "normal") throw new Error("monster_not_rewardable");
  const mode = rewardType === "team_hunt" ? "expedition" : String(input?.mode || "novice");
  if (!(mode in MODE_MULT)) throw new Error("invalid_reward_mode");
  const challengeLevel = rewardType === "solo_hunt" ? String(input?.challengeLevel || "standard") : "standard";
  if (!(challengeLevel in SOLO_CHALLENGE)) throw new Error("invalid_challenge_level");

  const range = COIN_RANGE[monster.tier] || COIN_RANGE.common;
  const rawCoins = range[0] + Math.floor(seededRoll(`${battleId}:${memberId}:${monsterId}:coins`) * (range[1] - range[0] + 1));
  const challenge = SOLO_CHALLENGE[challengeLevel];
  const coins = Math.round(rawCoins * MODE_MULT[mode] * challenge.coinMult);
  const cardDropped = rewardType === "solo_hunt" && seededRoll(`${battleId}:${memberId}:${monsterId}:card`) < challenge.cardChance;
  const claimId = [battleId, memberId, rewardType].map(encodeURIComponent).join("~");
  return {
    claimId, battleId, memberId, monsterId, rewardType, mode, coins,
    challengeLevel,
    materialTotals:{ [monster.material.id]:challenge.materialQty },
    card:cardDropped ? {
      monsterId:monster.card.id || monster.id, name:monster.name, icon:monster.icon || "👾",
      tier:monster.tier, family:monster.family,
    } : null,
    catalogVersion:catalog.version,
  };
}

module.exports = { buildTrustedMonsterReward, seededRoll };
