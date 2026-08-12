"use strict";
const catalog=require("./data/monsterExpansionCatalog.json");
const {seededRoll}=require("./monsterReward");
const {resolveCardDropChance}=require("./cardDropPolicy");
const MONSTERS=new Map(catalog.monsters.map(monster=>[monster.id,monster]));
const COINS={common:[3,8],rare:[6,15],elite:[12,25],fierce:[20,40],boss:[35,65],mythic:[60,100]};
const MODE={novice:1,student:2,veteran:3,match:4};
const XP={common:5,rare:8,elite:12,fierce:18,boss:25,mythic:35};
const TIERS=["common","rare","elite","fierce","boss","mythic"];
const COIN_CHEST={common:[20,50],rare:[60,120],elite:[150,250],fierce:[300,500],boss:[600,1000],mythic:[1200,2000]};
function buildPartyReward({roomId,battleInstanceId,memberId,room}){
  const monsterId=room?.monster?.id,monster=MONSTERS.get(monsterId);
  if(!roomId||!battleInstanceId||room.battleInstanceId!==battleInstanceId||!memberId||!monster||monster.encounter!=="normal")throw new Error("party_reward_invalid");
  const participated=(room.log||[]).some(entry=>(entry.playerLog||[]).some(player=>player.id===memberId&&(player.arrowBreakdown||[]).length>0));
  if(!room.members?.[memberId]||!["pending_confirm","completed"].includes(room.status)||room.result!=="win"||!participated)throw new Error("party_battle_not_rewardable");
  const key=`${roomId}:${battleInstanceId}:${memberId}:${monsterId}:party-v2`,range=COINS[monster.tier]||COINS.common;
  const raw=range[0]+Math.floor(seededRoll(`${key}:coins`)*(range[1]-range[0]+1));
  const coins=Math.round(raw*(MODE[room.mode]||1)*1.5),arrowCount=(room.log||[]).reduce((sum,entry)=>sum+((entry.playerLog||[]).find(player=>player.id===memberId)?.arrowBreakdown||[]).length,0);
  const tierIndex=monster.tierIndex||TIERS.indexOf(monster.tier)+1,cardChance=resolveCardDropChance({mode:"party",baseChance:.2});
  const card=seededRoll(`${key}:card`)<cardChance?{monsterId:monster.card.id,name:monster.name,icon:monster.icon||"👾",tier:monster.tier,family:monster.family,artKey:monster.artKey}:null;
  const now=Date.now(),chests=[0,1,2].map(index=>({id:`${key}:material:${index}`,type:"family_mat",family:monster.family,tierIndex,tier:monster.tier,name:`T${tierIndex} ${monster.family} 族系素材箱`,icon:"📦",color:"#a16207",from:"party_battle",ts:now}));
  const coinRange=COIN_CHEST[monster.tier]||COIN_CHEST.common;for(let index=0;index<3;index++)chests.push({id:`${key}:coin:${index}`,type:"coin",coinTier:monster.tier,family:"coin",tier:monster.tier,name:`${monster.tier} 金幣寶箱`,icon:"🪙",color:"#b45309",min:coinRange[0],max:coinRange[1],from:"party_battle",ts:now});
  return{claimId:[roomId,battleInstanceId,memberId,"party_v2"].map(encodeURIComponent).join("~"),coins,arrowDew:Math.round(arrowCount*1.5),archerXP:Math.round((XP[monster.tier]||5)*1.5),materialTotals:{[monster.material.id]:8},chests,card,cardChance,monsterId};
}
module.exports={buildPartyReward};
