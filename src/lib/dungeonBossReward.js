import { EXPANSION_MONSTER_BY_ID, EXPANSION_MONSTERS, MONSTER_EXPANSION_VERSION } from "./monsterExpansionCatalog";
import { buildBossReward, buildRewardKey, resolveBossCardDrop } from "./monsterLootEngine";

const RUNE_FRAGMENT_TYPES = Object.freeze(["atk", "def", "hp", "cat"]);
const CHOICE_VALUES = Object.freeze({
  1:{regularCoins:300,largeCoins:900,regularChests:2,largeChests:6,arrowDew:50,archerXP:150},
  2:{regularCoins:600,largeCoins:1800,regularChests:3,largeChests:9,arrowDew:80,archerXP:250},
  3:{regularCoins:1200,largeCoins:3600,regularChests:4,largeChests:12,arrowDew:120,archerXP:400},
  4:{regularCoins:2000,largeCoins:6000,regularChests:5,largeChests:15,arrowDew:180,archerXP:650},
  5:{regularCoins:3500,largeCoins:10500,regularChests:6,largeChests:18,arrowDew:250,archerXP:900},
  6:{regularCoins:6000,largeCoins:18000,regularChests:8,largeChests:24,arrowDew:350,archerXP:1300},
});

function seededRoll(value) {
  let hash=2166136261;
  for(const char of String(value))hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return(hash>>>0)/4294967296;
}

function choiceCard(monster,key){
  const pool=EXPANSION_MONSTERS.filter(item=>item.family===monster.family&&item.tierIndex===monster.tierIndex&&["miniBoss","boss"].includes(item.encounter));
  const minis=pool.filter(item=>item.encounter==="miniBoss"),boss=pool.find(item=>item.encounter==="boss"),roll=seededRoll(`${key}:boss-card-choice`);
  const picked=roll<.35?minis[0]:roll<.7?minis[1]:boss;
  return{monsterId:picked.card.id,name:picked.name,family:picked.family,tier:picked.tier,encounter:picked.encounter,artKey:picked.artKey};
}

export function buildDungeonBossRewardEnvelope({battleId,memberId,monsterId}){
  const monster=EXPANSION_MONSTER_BY_ID[monsterId];
  if(!battleId||!memberId)throw new Error("invalid_dungeon_reward_identity");
  if(!monster||!["miniBoss","boss"].includes(monster.encounter))throw new Error("boss_monster_required");
  const rewardKey=buildRewardKey({battleId,memberId,rewardType:"dungeonBoss"});
  const fixedReward=buildBossReward({monsterId});
  fixedReward.runeFragment={type:RUNE_FRAGMENT_TYPES[Math.floor(seededRoll(`${rewardKey}:${monsterId}:rune`)*4)],count:fixedReward.runeFragments};
  const cardResult=resolveBossCardDrop({encounter:monster.encounter,roll:seededRoll(`${rewardKey}:${monsterId}:card`)});
  const values=CHOICE_VALUES[monster.tierIndex];
  const choiceOptions=[
    {type:"largeCoins",reward:{type:"coins",coins:values.largeCoins}},
    {type:"largeMaterialChests",reward:{type:"materialChests",quantity:values.largeChests,family:monster.family,tier:monster.tierIndex}},
    {type:"bossCard",reward:{type:"card",card:choiceCard(monster,rewardKey)}},
    {type:"regularCoins",reward:{type:"coins",coins:values.regularCoins}},
    {type:"regularMaterialChests",reward:{type:"materialChests",quantity:values.regularChests,family:monster.family,tier:monster.tierIndex}},
    {type:"consolation",reward:{type:"consolation",arrowDew:values.arrowDew,archerXP:values.archerXP}},
  ];
  for(let i=choiceOptions.length-1;i>0;i--){const j=Math.floor(seededRoll(`${rewardKey}:${monsterId}:shuffle:${i}`)*(i+1));[choiceOptions[i],choiceOptions[j]]=[choiceOptions[j],choiceOptions[i]];}
  choiceOptions.forEach((option,index)=>{option.id=`${rewardKey}:choice:${index}`;});
  return Object.freeze({version:2,catalogVersion:MONSTER_EXPANSION_VERSION,rewardKey,battleId,memberId,monsterId,encounter:monster.encounter,fixedReward,cardResult,
    card:cardResult.dropped?{monsterId:monster.card.id,name:monster.name,family:monster.family,tier:monster.tier,encounter:monster.encounter,artKey:monster.artKey}:null,
    choiceCount:fixedReward.choiceCount,choiceOptions});
}

export function validateDungeonBossChoices(envelope,selectedOptionIds){
  if(!envelope?.rewardKey||!Array.isArray(selectedOptionIds)||selectedOptionIds.length!==envelope.choiceCount||new Set(selectedOptionIds).size!==selectedOptionIds.length)return false;
  const allowed=new Set((envelope.choiceOptions||[]).map(option=>option.id));
  return selectedOptionIds.every(id=>allowed.has(id));
}
