"use strict";

const catalog = require("./data/monsterExpansionCatalog.json");
const { resolveCardDropChance } = require("./cardDropPolicy");

const MONSTERS = new Map(catalog.monsters.map(monster => [monster.id, monster]));
const COIN_RANGE = Object.freeze({
  common:[3,8], rare:[6,15], elite:[12,25], fierce:[20,40], boss:[35,65], mythic:[60,100],
});
const MODE_MULT = Object.freeze({ novice:1, student:2, veteran:3, match:4, expedition:0 });
const SOLO_CHALLENGE = Object.freeze({
  easy:{ materialQty:3, cardChance:0.12, coinMult:0.8, coinChestChance:0.2 },
  standard:{ materialQty:5, cardChance:0.20, coinMult:1, coinChestChance:0.5 },
  hard:{ materialQty:7, cardChance:0.30, coinMult:1.5, coinChestChance:1 },
});
const POTION_CHEST_CHANCE=Object.freeze({common:.02,rare:.03,elite:.05,fierce:.08,boss:.12,mythic:.18});
const COIN_CHEST_RANGE=Object.freeze({common:[20,50],rare:[60,120],elite:[150,250],fierce:[300,500],boss:[600,1000],mythic:[1200,2000]});
function stableTimestamp(key){return 1700000000000+Math.floor(seededRoll(`${key}:timestamp`)*31536000000);}
function buildSoloChests({battleId,memberId,monster,challenge}){
  const key=`${battleId}:${memberId}:${monster.id}:solo`,now=stableTimestamp(key),tierIndex=monster.tierIndex||1;
  const chests=[{id:`${key}:material`,type:"family_mat",family:monster.family,tierIndex,tier:monster.tier,name:`T${tierIndex} 族系素材箱`,icon:"📦",from:"單人狩獵",ts:now}];
  if(seededRoll(`${key}:coin-chest`)<challenge.coinChestChance){const range=COIN_CHEST_RANGE[monster.tier]||COIN_CHEST_RANGE.common;chests.push({id:`${key}:coin`,type:"coin",family:"coin",tier:monster.tier,coinTier:monster.tier,name:`${monster.tier} 金幣寶箱`,icon:"🪙",min:range[0],max:range[1],from:"單人狩獵",ts:now+1});}
  if(seededRoll(`${key}:potion-chest`)<(POTION_CHEST_CHANCE[monster.tier]||.02))chests.push({id:`${key}:potion`,type:"potion",family:monster.family,tier:monster.tier,name:"藥水寶箱",icon:"🧪",from:"單人狩獵",ts:now+2});
  return chests;
}
const REWARD_TYPES = new Set(["solo_hunt"]);

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
  const mode = String(input?.mode || "novice");
  if (!(mode in MODE_MULT)) throw new Error("invalid_reward_mode");
  const challengeLevel = rewardType === "solo_hunt" ? String(input?.challengeLevel || "standard") : "standard";
  if (!(challengeLevel in SOLO_CHALLENGE)) throw new Error("invalid_challenge_level");

  const range = COIN_RANGE[monster.tier] || COIN_RANGE.common;
  const rawCoins = range[0] + Math.floor(seededRoll(`${battleId}:${memberId}:${monsterId}:coins`) * (range[1] - range[0] + 1));
  const challenge = SOLO_CHALLENGE[challengeLevel];
  const coins = Math.round(rawCoins * MODE_MULT[mode] * challenge.coinMult);
  const cardChance = resolveCardDropChance({ mode:"solo", encounter:monster.encounter, baseChance:challenge.cardChance });
  const cardDropped = seededRoll(`${battleId}:${memberId}:${monsterId}:card`) < cardChance;
  const chests=buildSoloChests({battleId,memberId,monster,challenge});
  const claimId = [battleId, memberId, rewardType].map(encodeURIComponent).join("~");
  return {
    claimId, battleId, memberId, monsterId, rewardType, mode, coins,
    challengeLevel, cardChance, chests,
    materialTotals:{ [monster.material.id]:challenge.materialQty },
    card:cardDropped ? {
      monsterId:monster.card.id || monster.id, name:monster.name, icon:monster.icon || "👾",
      tier:monster.tier, family:monster.family,
    } : null,
    catalogVersion:catalog.version,
  };
}

function buildDungeonNormalCardClaim({ battleId, memberId, monsterId }) {
  const safeBattleId=requireId(battleId,"invalid_battle_id"),safeMemberId=requireId(memberId,"invalid_member_id"),safeMonsterId=requireId(monsterId,"invalid_monster_id");
  const monster=MONSTERS.get(safeMonsterId);
  if(!monster||monster.encounter!=="normal")throw new Error("normal_monster_required");
  const chance=resolveCardDropChance({mode:"dungeon",encounter:"normal",baseChance:SOLO_CHALLENGE.standard.cardChance});
  const dropped=seededRoll(`${safeBattleId}:${safeMemberId}:${safeMonsterId}:dungeon-card`)<chance;
  return{claimId:[safeBattleId,safeMemberId,"dungeon_normal_card"].map(encodeURIComponent).join("~"),battleId:safeBattleId,memberId:safeMemberId,monsterId:safeMonsterId,chance,
    card:dropped?{monsterId:monster.card.id||monster.id,name:monster.name,icon:monster.icon||"👾",tier:monster.tier,family:monster.family,encounter:monster.encounter,artKey:monster.artKey}:null};
}

module.exports = { buildDungeonNormalCardClaim, buildTrustedMonsterReward, seededRoll };
