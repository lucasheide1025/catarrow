import { applyStatusResist } from "./combatModifiers";

export const FAMILY_PLAYER_STATUS = Object.freeze({
  ghost:Object.freeze({id:"fear",name:"恐懼",icon:"👻",kind:"stat_down",stat:"atk",blocksShooting:false}),
  mountain:Object.freeze({id:"armorBreak",name:"破甲",icon:"🪨",kind:"stat_down",stat:"def",blocksShooting:false}),
  insect:Object.freeze({id:"poison",name:"中毒",icon:"☠️",kind:"dot",blocksShooting:false}),
  workplace:Object.freeze({id:"fatigue",name:"疲勞",icon:"💼",kind:"recovery_down",blocksShooting:false}),
  exam:Object.freeze({id:"pressure",name:"壓力",icon:"📝",kind:"damage_taken_up",blocksShooting:false}),
  temple:Object.freeze({id:"bleed",name:"流血",icon:"🩸",kind:"dot",removeOnEffectiveHeal:true,blocksShooting:false}),
  treasure:Object.freeze({id:"glare",name:"眩光",icon:"✨",kind:"bonus_down",blocksShooting:false}),
});

export function normalizePlayerStatusResistance(mods={}){
  const clampPct=value=>Math.max(0,Math.min(100,Number(value)||0));
  return{
    statusStrengthReductionPct:clampPct(mods.statusStrengthReductionPct),
    statusDurationReduction:Math.max(0,Math.floor(Number(mods.statusDurationReduction)||0)),
    poisonResistPct:clampPct(mods.poisonResistPct),
  };
}

export function deterministicStatusRoll(...parts){
  const text=parts.join("|");
  let hash=2166136261;
  for(let i=0;i<text.length;i+=1){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return(hash>>>0)/4294967296;
}

export function getPlayerStatusModifiers(statuses=[]){
  let healingReceivedMultiplier=1;
  let shieldReceivedMultiplier=1;
  let damageTakenMultiplier=1;
  let bonusDamageReductionPct=0;
  for(const status of statuses){
    if(!status||Number(status.duration)<=0)continue;
    const pct=Math.max(0,Math.min(100,Number(status.strength)||0))/100;
    if(status.id==="fatigue"){
      healingReceivedMultiplier*=1-pct;
      shieldReceivedMultiplier*=1-pct;
    }else if(status.id==="pressure")damageTakenMultiplier*=1+pct;
    else if(status.id==="glare")bonusDamageReductionPct=1-(1-bonusDamageReductionPct)*(1-pct);
  }
  return{
    healingReceivedMultiplier,
    shieldReceivedMultiplier,
    damageTakenMultiplier,
    bonusDamageReductionPct:Math.round(bonusDamageReductionPct*10000)/100,
  };
}

export function applyGlareToDamageBreakdown(breakdown=[],reductionPct=0){
  const reduction=Math.max(0,Math.min(100,Number(reductionPct)||0))/100;
  if(!reduction)return breakdown;
  return breakdown.map(hit=>{
    const mult=Math.max(1,Number(hit?.partMult)||1);
    if(!hit?.isCrit&&mult<=1)return hit;
    const damage=Math.max(0,Number(hit?.dmg)||0);
    const base=damage/mult;
    const glareReduced=Math.round(Math.max(0,damage-base)*reduction);
    return{...hit,dmg:Math.max(0,damage-glareReduced),glareReduced};
  });
}

export function applyIncomingHealing({hp=0,maxHp=0,amount=0,statuses=[]}={}){
  const cap=Math.max(0,Number(maxHp)||0);
  const before=Math.max(0,Math.min(cap,Number(hp)||0));
  const adjusted=Math.max(0,Math.round((Number(amount)||0)*getPlayerStatusModifiers(statuses).healingReceivedMultiplier));
  const nextHp=Math.min(cap,before+adjusted);
  const healed=Math.max(0,nextHp-before);
  return{hp:nextHp,healed,statuses:removeBleedOnEffectiveHeal(statuses,{healed})};
}

function tierBand(tierIndex){
  const tier=Math.max(1,Math.min(6,Number(tierIndex)||1));
  return tier<=2?0:tier<=4?1:2;
}

export function getFamilyOrdinaryStatus({family,tierIndex}){
  const definition=FAMILY_PLAYER_STATUS[family];
  if(!definition)return null;
  const band=tierBand(tierIndex);
  const chance=[.2,.3,.4][band];
  const duration=[1,2,3][band];
  const strength=definition.id==="poison"?[2,3,4][band]:definition.id==="bleed"?[3,4,5][band]:[10,15,20][band];
  return {...definition,family,tierIndex:Math.max(1,Math.min(6,Number(tierIndex)||1)),chance,strength,duration};
}

function resistanceChanged(rawStatus,finalStatus){
  return rawStatus.strength!==finalStatus.strength||rawStatus.duration!==finalStatus.duration;
}

export function resolveFamilyOrdinaryStatusForParty({family,tierIndex,members=[],random=Math.random}={}){
  const raw=getFamilyOrdinaryStatus({family,tierIndex});
  if(!raw)return [];
  return members.filter(member=>member?.alive!==false).map(member=>{
    const base={targetId:member.id,family,statusId:raw.id,chance:raw.chance};
    if((member.role||"front")==="rear")return{...base,outcome:"rear_immune",rawStatus:null,finalStatus:null};
    const roll=Math.max(0,Math.min(1,Number(random(member))||0));
    if(roll>=raw.chance)return{...base,roll,outcome:"not_triggered",rawStatus:null,finalStatus:null};
    const rawStatus={...raw};
    const resisted=applyStatusResist(rawStatus,{
      statusStrengthReductionPct:0,statusDurationReduction:0,poisonResistPct:0,
      ...normalizePlayerStatusResistance(member.mods),
    });
    if(raw.id==="poison"&&Number(resisted?.strength)<=0)return{...base,roll,outcome:"immune",rawStatus,finalStatus:null};
    return{...base,roll,outcome:resistanceChanged(rawStatus,resisted)?"resisted":"applied",rawStatus,finalStatus:resisted};
  });
}

export function resolveFamilyOrdinaryStatusForSolo({family,tierIndex,battleId="solo",round=1,mods={},random=null}={}){
  return resolveFamilyOrdinaryStatusForParty({
    family,tierIndex,
    members:[{id:"player",role:"front",alive:true,mods}],
    random:random||(()=>deterministicStatusRoll(battleId,round,"player",family)),
  })[0]||null;
}

export function removeBleedOnEffectiveHeal(statuses,{healed=0}={}){
  if(!(Number(healed)>0))return statuses;
  return(statuses||[]).filter(status=>status?.id!=="bleed");
}
