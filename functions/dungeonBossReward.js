"use strict";

const catalog = require("./data/monsterExpansionCatalog.json");
const { seededRoll } = require("./monsterReward");
const { resolveCardDropChance } = require("./cardDropPolicy");

const MONSTERS = new Map(catalog.monsters.map(monster => [monster.id, monster]));
const TIER_BASE = [0,1,1,2,2,3,3];
const BOSS_MARKS = [0,1,1,2,3,5,8];
const BOSS_COINS = [0,300,600,1200,2400,4800,8000];
const RUNES = ["atk", "def", "hp", "cat"];
const CHOICE_VALUES = Object.freeze({
  1:{ regularCoins:300, largeCoins:900, regularChests:2, largeChests:6, arrowDew:50, archerXP:150 },
  2:{ regularCoins:600, largeCoins:1800, regularChests:3, largeChests:9, arrowDew:80, archerXP:250 },
  3:{ regularCoins:1200, largeCoins:3600, regularChests:4, largeChests:12, arrowDew:120, archerXP:400 },
  4:{ regularCoins:2000, largeCoins:6000, regularChests:5, largeChests:15, arrowDew:180, archerXP:650 },
  5:{ regularCoins:3500, largeCoins:10500, regularChests:6, largeChests:18, arrowDew:250, archerXP:900 },
  6:{ regularCoins:6000, largeCoins:18000, regularChests:8, largeChests:24, arrowDew:350, archerXP:1300 },
});

function rewardKey({ battleId, memberId }) {
  if (!battleId || !memberId || String(battleId).includes("/") || String(memberId).includes("/")) throw new Error("invalid_dungeon_reward_identity");
  return `${battleId}:${memberId}:dungeonBoss`;
}

function normalPool(monster) {
  return catalog.monsters.filter(item => item.family === monster.family && item.tierIndex === monster.tierIndex && item.encounter === "normal").map(item => item.material);
}

function split(materials, total, key) {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const offset = (hash >>> 0) % 3;
  const quantities = [Math.floor(total * .4), Math.floor(total * .35), Math.floor(total * .25)];
  for (let remaining=total-quantities.reduce((a,b)=>a+b,0), index=0; remaining>0; index++,remaining--) quantities[index % 3]++;
  return quantities.map((quantity,index) => ({ materialId:materials[(index+offset)%3].id, quantity })).filter(item => item.quantity > 0);
}

function selectBossChoiceCard(monster, key) {
  const candidates = catalog.monsters.filter(item => item.family === monster.family && item.tierIndex === monster.tierIndex && ["miniBoss", "boss"].includes(item.encounter));
  const minis = candidates.filter(item => item.encounter === "miniBoss");
  const boss = candidates.find(item => item.encounter === "boss");
  if (minis.length < 2 || !boss) throw new Error("boss_card_choice_pool_invalid");
  const roll = seededRoll(`${key}:boss-card-choice`);
  const picked = roll < .35 ? minis[0] : roll < .7 ? minis[1] : boss;
  return { monsterId:picked.card.id, name:picked.name, family:picked.family, tier:picked.tier, encounter:picked.encounter, artKey:picked.artKey };
}

function buildDungeonBossEnvelope({ battleId, memberId, monsterId }) {
  const monster = MONSTERS.get(monsterId);
  if (!monster || !["miniBoss", "boss"].includes(monster.encounter)) throw new Error("boss_monster_required");
  const key = rewardKey({ battleId, memberId });
  const isBoss = monster.encounter === "boss";
  const pool = normalPool(monster);
  if (pool.length !== 3) throw new Error("normal_material_pool_invalid");
  const fixedReward = {
    bossMaterial:{ materialId:monster.material.id, quantity:1 },
    generalMaterials:split(pool, TIER_BASE[monster.tierIndex] * (isBoss?8:5), monster.id),
    bossMarks:BOSS_MARKS[monster.tierIndex] * (isBoss?2:1),
    runeFragments:(monster.tierIndex+2) * (isBoss?2:1),
    coins:BOSS_COINS[monster.tierIndex] * (isBoss?2:1),
    choiceCount:isBoss?2:1,
  };
  fixedReward.runeFragment = { type:RUNES[Math.floor(seededRoll(`${key}:${monsterId}:rune`)*RUNES.length)], count:fixedReward.runeFragments };
  const chance = resolveCardDropChance({ mode:"dungeon", encounter:monster.encounter });
  const dropped = seededRoll(`${key}:${monsterId}:card`) < chance;
  const cardResult = { dropped, guaranteed:false, reason:dropped?"roll":"miss", chance };
  const values = CHOICE_VALUES[monster.tierIndex];
  const choiceOptions = [
    { type:"largeCoins", reward:{ type:"coins", coins:values.largeCoins } },
    { type:"largeMaterialChests", reward:{ type:"materialChests", quantity:values.largeChests, family:monster.family, tier:monster.tierIndex } },
    { type:"bossCard", reward:{ type:"card", card:selectBossChoiceCard(monster, key) } },
    { type:"regularCoins", reward:{ type:"coins", coins:values.regularCoins } },
    { type:"regularMaterialChests", reward:{ type:"materialChests", quantity:values.regularChests, family:monster.family, tier:monster.tierIndex } },
    { type:"consolation", reward:{ type:"consolation", arrowDew:values.arrowDew, archerXP:values.archerXP } },
  ];
  for (let i=choiceOptions.length-1; i>0; i--) {
    const j=Math.floor(seededRoll(`${key}:${monsterId}:shuffle:${i}`)*(i+1));
    [choiceOptions[i],choiceOptions[j]]=[choiceOptions[j],choiceOptions[i]];
  }
  choiceOptions.forEach((option,index)=>{ option.id=`${key}:choice:${index}`; });
  return { version:2, catalogVersion:catalog.version, rewardKey:key, battleId, memberId, monsterId, encounter:monster.encounter,
    fixedReward, cardResult, card:dropped?{ monsterId:monster.card.id, name:monster.name, family:monster.family, tier:monster.tier, encounter:monster.encounter, artKey:monster.artKey }:null,
    choiceCount:fixedReward.choiceCount, choiceOptions };
}

function publicEnvelope(envelope) {
  return { ...envelope, choiceOptions:envelope.choiceOptions.map(({ id }) => ({ id })) };
}

function buildFamilyMaterialChests({ claimId, optionId, family, tierIndex, quantity, now=Date.now() }) {
  const familyLabel={ghost:"鬼怪族",mountain:"山林族",insect:"毒蟲族",workplace:"職場族",exam:"考試族",temple:"西方怪物族",treasure:"寶箱族"}[family]||family;
  return Array.from({length:Math.max(0,Number(quantity)||0)},(_,index)=>({
    id:`${claimId}:${optionId}:${index}`,type:"family_mat",family,tierIndex,
    tier:["common","rare","elite","fierce","boss","mythic"][tierIndex-1]||"common",
    name:`T${tierIndex} ${familyLabel}素材箱`,icon:"📦",color:"#a16207",from:"dungeon_boss_choice",ts:now,
  }));
}

function validateChoices(envelope, selectedOptionIds) {
  return Array.isArray(selectedOptionIds) && selectedOptionIds.length === envelope.choiceCount
    && new Set(selectedOptionIds).size === selectedOptionIds.length
    && selectedOptionIds.every(id => envelope.choiceOptions.some(option => option.id === id));
}

function hasDungeonWinProof(room){
  if(room?.result==="win") return true;
  const logs=room?.log||[];
  const lastLog=logs[logs.length-1];
  return room?.status==="map_explore"&&room?.result==null&&Number(lastLog?.monsterHPAfter)<=0;
}

function isRewardableDungeonRoom(room,memberId,monsterId){
  // Team membership is the participation proof. A rear/support member may
  // legitimately have no playerLog entry in the killing round, but must still
  // receive the same boss reward as the attacking members.
  return Boolean(room?.members?.[memberId]&&hasDungeonWinProof(room)&&Number(room.monsterHP)<=0&&(room.monster?.id||room.monsterId)===monsterId);
}

function isRewardableTeamDungeonBossRoom(teamRoom,battleId,memberId,monsterId){
  const eligible=Array.isArray(teamRoom?.bossRewardEligibleMemberIds)
    ? teamRoom.bossRewardEligibleMemberIds.includes(memberId)
    : Boolean(teamRoom?.members?.[memberId]);
  return Boolean(
    teamRoom?.members?.[memberId]
    && eligible
    && teamRoom?.bossRewardBattleId===battleId
    && teamRoom?.bossRewardMonsterId===monsterId
  );
}

module.exports = { buildDungeonBossEnvelope, buildFamilyMaterialChests, isRewardableDungeonRoom, isRewardableTeamDungeonBossRoom, publicEnvelope, validateChoices };
