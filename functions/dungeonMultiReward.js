"use strict";

const catalog=require("./data/monsterExpansionCatalog.json");
const {buildDungeonNormalCardClaim,seededRoll}=require("./monsterReward");

const monsters=new Map(catalog.monsters.map(monster=>[monster.id,monster]));
const tierXp={common:5,rare:10,elite:20,fierce:30,boss:50,mythic:80};
const collectibleByFamily={ghost:"shadow_stone",mountain:"rough_stone",insect:"chitin_shard",workplace:"id_card",exam:"exam_paper",temple:"stone_tablet"};

function hasDungeonMultiRunProof({room,battleId,memberId,activeExpedition}){
  const savedPending=activeExpedition?.mapState?.pendingRoom;
  const roomEncounterId=String(room?.encounter?.encounterId||"").trim();
  const savedEncounterId=String(savedPending?.encounter?.encounterId||"").trim();
  if(String(savedPending?.multiBattleRoomId||"")===String(battleId||"")&&roomEncounterId&&savedEncounterId===roomEncounterId)return true;

  const runId=String(activeExpedition?.expansionRunId||"").trim();
  const logicalRoomId=String(savedPending?.id||"").trim();
  const roomFloor=Number(room?.expeditionFloorIndex);
  const savedFloor=Number(activeExpedition?.mapState?.floorIndex);
  const roomFamily=String(room?.multiFamily||room?.monster?.family||"").trim();
  const savedFamily=String(activeExpedition?.family||"").trim();
  const roomTier=Number(room?.multiTier??room?.expeditionDifficulty);
  const savedTier=Number(activeExpedition?.difficultyTier);
  if(!runId||!logicalRoomId||!roomEncounterId||!Number.isInteger(roomFloor)||roomFloor<0)return false;
  if(savedEncounterId&&savedEncounterId!==roomEncounterId)return false;
  if(room?.encounterId&&String(room.encounterId)!==roomEncounterId)return false;
  if(roomEncounterId!==`dungeon:${runId}:${roomFloor}:${logicalRoomId}`)return false;
  if(!(room?.dungeonSolo===true&&room?.dungeonMulti===true&&room?.expeditionMode===true&&room?.combatVersion===2&&room?.status==="victory"))return false;
  const roomMemberIds=Object.keys(room?.members||{});
  if(room?.hostId!==memberId||roomMemberIds.length!==1||roomMemberIds[0]!==memberId)return false;
  if(!savedFamily||savedFamily!==roomFamily)return false;
  if(!Number.isFinite(savedTier)||!Number.isFinite(roomTier)||savedTier!==roomTier)return false;
  if(!Number.isInteger(savedFloor)||savedFloor!==roomFloor)return false;
  return true;
}

function buildDungeonMultiReward({room,battleId,memberId}){
  if(!(room?.dungeonSolo===true&&room?.dungeonMulti===true&&room?.combatVersion===2&&room?.status==="victory"))throw new Error("dungeon_multi_not_terminal");
  if(!room.members?.[memberId])throw new Error("dungeon_multi_not_member");
  const order=Array.isArray(room.targetOrder)?room.targetOrder:[];
  const targets=order.map(instanceId=>({instanceId,...room.targets?.[instanceId]}));
  if(targets.length<2||targets.some(target=>!target.id||target.alive!==false&&Number(target.currentHp)>0))throw new Error("dungeon_multi_targets_not_defeated");
  const primaryId=room.encounter?.primaryTargetId||"primary";
  const primary=targets.find(target=>target.instanceId===primaryId);
  if(!primary)throw new Error("dungeon_multi_primary_missing");
  if(targets.length!==3||new Set(targets.map(target=>target.instanceId)).size!==3)throw new Error("dungeon_multi_target_shape_invalid");
  const roomRole=room.expeditionRoomType||"monster";
  const allowedPrimaryEncounters=roomRole==="boss"?new Set(["miniBoss","boss"]):new Set(["normal"]);
  const expectedFamily=String(room.multiFamily||room.monster?.family||"");
  const expectedTier=Math.max(1,Number(room.multiTier||room.expeditionDifficulty)||1);
  for(const target of targets){
    const monster=monsters.get(target.id);
    if(!monster)throw new Error("dungeon_multi_unknown_target");
    if(monster.family!==expectedFamily||Number(monster.tierIndex)!==expectedTier)throw new Error("dungeon_multi_catalog_mismatch");
    const isPrimary=target.instanceId===primaryId;
    if(isPrimary?!allowedPrimaryEncounters.has(monster.encounter):monster.encounter!=="normal")throw new Error("dungeon_multi_target_role_invalid");
  }
  if(room.monster?.id&&room.monster.id!==primary.id)throw new Error("dungeon_multi_primary_mismatch");
  const materialTotals={},cards=[],chests=[],lootMult=Math.max(1,Math.min(5,Number(room.dungeonLootMult)||1));
  for(const target of targets){
    const monster=monsters.get(target.id);
    if(monster.material?.id)materialTotals[monster.material.id]=(materialTotals[monster.material.id]||0)+lootMult;
    for(let index=0;index<lootMult;index++)chests.push({id:`${battleId}:${memberId}:${target.instanceId}:material:${index}`,type:monster.encounter==="boss"?"boss_mat":monster.encounter==="miniBoss"?"mini_boss_mat":"family_mat",family:monster.family,tierIndex:Number(monster.tierIndex)||1,tier:monster.tier,name:`T${Number(monster.tierIndex)||1} 系素材箱`,icon:"📦",from:"dungeon_multi",ts:1700000000000+index});
    if(monster.encounter==="normal"){
      const card=buildDungeonNormalCardClaim({battleId,memberId,monsterId:monster.id,targetInstanceId:target.instanceId}).card;
      if(card)cards.push(card);
    }
  }
  const primaryMonster=monsters.get(primary.id)||primary;
  const tierIndex=Math.max(1,Number(primaryMonster.tierIndex||room.expeditionDifficulty)||1);
  const elite=room.expeditionRoomType==="elite",boss=room.expeditionRoomType==="boss";
  const mult=elite?1.5:1;
  const coins=Math.round((10+tierIndex*10+Math.floor(seededRoll(`${battleId}:${memberId}:tile-coins`)*11))*5*mult);
  const archerXP=Math.round((tierXp[primaryMonster.tier]||tierIndex*6)*mult);
  const collectibleChance=boss?.65:(elite?.45:.15);
  const collectibleId=collectibleByFamily[primaryMonster.family];
  const collectible=collectibleId&&seededRoll(`${battleId}:${memberId}:tile-collectible`)<collectibleChance?{itemId:collectibleId,qty:1}:null;
  return{claimId:[battleId,memberId,"dungeon_multi_solo"].map(encodeURIComponent).join("~"),coins,archerXP,materialTotals,chests,cards,collectibles:collectible?[collectible]:[],primaryMonsterId:primary.id,targetInstanceIds:targets.map(target=>target.instanceId)};
}

module.exports={buildDungeonMultiReward,hasDungeonMultiRunProof};
