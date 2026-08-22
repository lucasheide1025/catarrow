"use strict";

const catalog = require("./data/monsterExpansionCatalog.json");
const combatRuntime = require("./generated/combat/lib/multiMonsterLoadoutRuntime");

const SCORES = new Set(["X","10","9","8","7","6","5","4","3","2","1","M"]);
const EFFECT_VERSION = 2;
const SUPPORTED_EFFECTS = Object.freeze(["flat_stats","family_damage","family_reduction","card_outgoing_modifiers","card_incoming_reduction","status_inflict","status_resistance","opening_shield","reflect","end_round_heal","cat_archetype","cat_bond"]);

function hash(value) {
  let out = 2166136261;
  for (const char of String(value || "")) out = Math.imul(out ^ char.charCodeAt(0), 16777619);
  return out >>> 0;
}
function random(seed) {
  let state = hash(seed);
  return () => { state += 0x6D2B79F5; let t=state; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}
const clone = value => JSON.parse(JSON.stringify(value ?? null));
const score = value => String(value).toUpperCase() === "X" ? 10 : (String(value).toUpperCase() === "M" ? 0 : Math.max(0,Math.min(10,Number(value)||0)));

function validateSnapshot(member) {
  const snapshot = member?.loadoutSnapshot;
  if (snapshot?.version !== 2 || snapshot?.cards?.effectVersion !== EFFECT_VERSION) throw new Error("loadout_v2_required");
  const declared = Array.isArray(snapshot.cards.supportedEffects) ? snapshot.cards.supportedEffects : [];
  if (declared.some(key => !SUPPORTED_EFFECTS.includes(key))) throw new Error("unsupported_loadout_effect");
  if (Array.isArray(snapshot.cards.unsupportedEffectKeys) && snapshot.cards.unsupportedEffectKeys.length) throw new Error("unsupported_loadout_effect");
  for (const key of ["hp","atk","def"]) if (!Number.isFinite(Number(snapshot.baseStats?.[key]))) throw new Error("invalid_loadout_stats");
  return snapshot;
}

function buildEncounter(family, tier, seed) {
  const rows = catalog.monsters.filter(row => row.family === family && Number(row.tierIndex) === Number(tier) && row.encounter === "normal").slice(0,3);
  if (rows.length !== 3) throw new Error("missing_encounter");
  const rand=random(`${seed}:encounter`), targets={}, targetOrder=[];
  rows.forEach((row,index) => {
    const scale=[.85,1,1.2][Math.floor(rand()*3)];
    const id=`monster_${index}`, hp=Math.max(1,Math.round(Number(row.hp||200)*scale));
    targets[id]={ id:row.id, instanceId:id, name:row.name, family:row.family, position:"front", hp, maxHp:hp, currentHp:hp, atk:Math.max(1,Math.round(Number(row.atk||10)*scale)), def:Math.max(0,Math.round(Number(row.def||5)*scale)), alive:true, statuses:[] };
    targetOrder.push(id);
  });
  return { targets, targetOrder };
}

function buildDungeonEncounter(encounter) {
  if (!encounter || encounter.kind !== "multi" || !Array.isArray(encounter.targets) || encounter.targets.length < 2) throw new Error("invalid_dungeon_encounter");
  const targets={},targetOrder=[];
  for (const source of encounter.targets) {
    const instanceId=String(source.instanceId||"");
    if(!instanceId||targets[instanceId])throw new Error("invalid_dungeon_target");
    const hp=Math.max(1,Math.round(Number(source.maxHp??source.maxHP??source.hp)||1));
    targets[instanceId]={...clone(source),instanceId,id:String(source.id||""),position:source.position||"front",hp,currentHp:Math.max(0,Math.min(hp,Number(source.currentHp??hp))),maxHp:hp,alive:source.alive!==false&&Number(source.currentHp??hp)>0,statuses:Array.isArray(source.statuses)?clone(source.statuses):[]};
    targetOrder.push(instanceId);
  }
  return {targets,targetOrder};
}

function startPatch(room, roomId) {
  const dungeonMode=room.dungeonMulti===true&&room.expeditionMode===true;
  if (!dungeonMode&&(room.huntType !== "multi" || room.multiMonster !== true)) throw new Error("not_multi_room");
  if (room.status === "active" && room.combatVersion === 2) return null;
  if (room.status !== "waiting") throw new Error("room_not_waiting");
  const members=clone(room.members||{});
  if (!Object.keys(members).length) throw new Error("empty_party");
  for (const member of Object.values(members)) {
    const snapshot=validateSnapshot(member), base=snapshot.baseStats;
    const canonicalMaxHp=Math.max(1,Number(base.hp)+(Number(snapshot.cards?.combatMods?.maxHpFlat)||0));
    const maxHp=dungeonMode?Math.max(1,Number(member.maxHp??member.maxHP)||canonicalMaxHp):canonicalMaxHp;
    const hp=dungeonMode?Math.max(0,Math.min(maxHp,Number(member.hp)||0)):maxHp;
    if(dungeonMode)snapshot.baseStats={...snapshot.baseStats,hp:maxHp,atk:Number(member.atk)||Number(base.atk),def:Number(member.def)||Number(base.def)};
    Object.assign(member,{ hp,maxHp,maxHP:maxHp,atk:Number(snapshot.baseStats.atk),def:Number(snapshot.baseStats.def),baseAtk:Number(snapshot.baseStats.atk),baseDef:Number(snapshot.baseStats.def),personalShield:Math.round(maxHp*(Number(snapshot.cards?.combatMods?.openingShieldPct)||0)/100),catBattleState:member.catBattleState||snapshot.cat?.battleState||null,alive:hp>0&&member.alive!==false,ready:false,submission:null,rewardClaimed:false });
  }
  const seed=Number(room.encounterSeed)||hash(`${roomId}:${room.multiFamily}:${room.multiTier}`);
  return { ...(dungeonMode?buildDungeonEncounter(room.encounter):buildEncounter(room.multiFamily,room.multiTier,seed)), members, encounterSeed:seed, combatVersion:2, effectVersion:EFFECT_VERSION, resolverVersion:"multi-party-v2.1", supportedEffects:[...SUPPORTED_EFFECTS], arrowsPerRound:[3,6].includes(Number(room.arrowsPerRound))?Number(room.arrowsPerRound):6, round:1, roundPhase:"input",status:"active",lastResolution:null };
}

function submissionPatch(room, roomId, memberId, input) {
  if (room.status !== "active" || room.combatVersion !== 2) throw new Error("battle_not_active");
  if (room.roundPhase !== "input") throw new Error("round_locked");
  if (Number(input.round)!==Number(room.round)) throw new Error("stale_round");
  const member=room.members?.[memberId]; if(!member||member.alive===false||Number(member.hp)<=0)throw new Error("member_down");
  const needed=[3,6].includes(Number(room.arrowsPerRound))?Number(room.arrowsPerRound):6;
  const arrows=Array.isArray(input.arrows)?input.arrows.map(v=>String(v).toUpperCase()):[];
  if(arrows.length!==needed||arrows.some(v=>!SCORES.has(v)))throw new Error("invalid_arrows");
  const attackMode=input.attackMode==="all"?"all":"focus", targetId=attackMode==="focus"?String(input.targetId||""):null;
  if(attackMode==="focus"&&(!room.targets?.[targetId]||room.targets[targetId].alive===false||Number(room.targets[targetId].currentHp)<=0))throw new Error("invalid_target");
  const revision=Math.max(0,Number(member.submission?.revision)||0)+1;
  return { submissionId:`${roomId}:${room.round}:${memberId}`,round:Number(room.round),memberId,arrows,attackMode,targetId,revision };
}

function resolveRound(room, roomId) {
  const targets=clone(room.targets||{}),members=clone(room.members||{}),order=Array.isArray(room.targetOrder)?room.targetOrder:Object.keys(targets);
  const targetHpBefore=Object.fromEntries(Object.entries(targets).map(([id,target])=>[id,Number(target.currentHp)||0]));
  const memberHpBefore=Object.fromEntries(Object.entries(members).map(([id,member])=>[id,Number(member.hp)||0]));
  const livingMembers=Object.keys(members).filter(id=>members[id].alive!==false&&Number(members[id].hp)>0);
  if(!livingMembers.length||livingMembers.some(id=>!members[id].ready||Number(members[id].submission?.round)!==Number(room.round)))throw new Error("not_all_ready");
  const rand=random(`${roomId}:${room.round}:v2`),events=[];
  const livingTargets=()=>order.filter(id=>targets[id]?.position==="front"&&targets[id].alive!==false&&Number(targets[id].currentHp)>0);
  const hit=(targetId,amount,payload)=>{const target=targets[targetId];if(!target||target.alive===false)return 0;const applied=Math.min(Number(target.currentHp)||0,Math.max(0,Math.round(amount)));target.currentHp-=applied;events.push({type:"target_damage",targetId,amount:applied,damage:applied,remainingHp:target.currentHp,...payload});if(target.currentHp<=0){target.currentHp=0;target.alive=false;events.push({type:"monster_killed",targetId});}return applied;};
  for(const targetId of livingTargets()){const target=targets[targetId];for(const status of target.statuses||[]){const amount=status.id==="poison"?target.maxHp*(Number(status.strength)||0)/100:(Number(status.sourceAtk)||0)*(Number(status.strength)||0)/100;if(amount>0)hit(targetId,amount,{source:"status",memberId:status.sourceMemberId,statusId:status.id});status.duration=Number(status.duration)-1;}target.statuses=(target.statuses||[]).filter(status=>status.duration>0);}
  for(const memberId of livingMembers.sort()){
    const member=members[memberId],snapshot=validateSnapshot(member),sub=member.submission;
    member.validRounds=Math.max(0,Number(member.validRounds)||0)+1;
    let focus=targets[sub.targetId]?.alive!==false&&Number(targets[sub.targetId]?.currentHp)>0?sub.targetId:livingTargets()[0];
    for(let i=0;i<sub.arrows.length;i++){
      const points=score(sub.arrows[i]); if(!points){events.push({type:"arrow_miss",memberId,arrowIndex:i});continue;}
      const ids=sub.attackMode==="all"?livingTargets():[focus||livingTargets()[0]].filter(Boolean);
      for(const id of ids){const target=targets[id],family=Number(snapshot.cards?.familyDamageBonusPct?.[target.family])||0,mods=snapshot.cards?.combatMods||{},defDown=Number(mods.monsterDefDownPct)||0;const effectiveDef=Number(target.def)*(1-defDown/100)*(1-(Number(mods.defIgnoreCardPct)||0)/100)*(1-(Number(mods.defIgnoreSpecPct)||0)/100);const jitter=.9+rand()*.2;let raw=Math.max(1,(points/10)*Number(snapshot.baseStats.atk)*1.7-effectiveDef*.6);let pct=(Number(mods.damagePct)||0)+(points>=8?(Number(mods.hqDamageCardPct)||0)+(Number(mods.hqDamageSpecPct)||0):0)+(Number(room.round)<=1?(Number(mods.firstStrikePct)||0):0)+(Number(target.currentHp)/Math.max(1,Number(target.maxHp))<=.3?(Number(mods.finisherPct)||0):0);raw*=1+pct/100;if(points<10&&Number(mods.critRatePct)>0&&rand()<Number(mods.critRatePct)/100)raw*=1.3;hit(id,raw*jitter*(1+family/100)*(sub.attackMode==="all"?.5:1),{memberId,arrowIndex:i,source:"player"});for(const [statusId,cfg] of Object.entries(mods.inflict||{})){const minScore=Number.isFinite(Number(cfg.minScore))?Number(cfg.minScore):9;if(points>=minScore&&rand()<(Number(cfg.chancePct)||0)/100){target.statuses=(target.statuses||[]).filter(status=>!(status.id===statusId&&status.sourceMemberId===memberId));target.statuses.push({id:statusId,strength:Number(cfg.strength)||0,duration:Math.max(1,Number(cfg.duration)||1),sourceAtk:Number(snapshot.baseStats.atk),sourceMemberId:memberId});events.push({type:"status_applied",targetId:id,memberId,statusId});}}}
      if(sub.attackMode==="focus")focus=livingTargets().includes(focus)?focus:livingTargets()[0];
    }
    const catTarget=focus||livingTargets()[0],cat=snapshot.cat;
    if(cat?.catId&&catTarget){const target=targets[catTarget],outcome=combatRuntime.resolveCatRound({catId:cat.catId,catLevel:cat.catLevel,bondLevel:cat.bondLv,catAtk:cat.catATK,catMaxHp:cat.catHP,companionAttackPct:snapshot.cards?.combatMods?.companionAttackPct,companionHealingPct:snapshot.cards?.combatMods?.companionHealingPct,playerHp:member.hp,playerMaxHp:member.maxHp,monsterHp:target.currentHp,monsterMaxHp:target.maxHp,round:Number(room.round),scores:sub.arrows,mode:"normal",state:member.catBattleState||cat.battleState,random:rand});member.catBattleState=outcome.state;const amount=outcome.monsterDamage>0?hit(catTarget,outcome.monsterDamage,{memberId,source:"cat",catId:cat.catId}):0;if(outcome.playerHeal>0)member.hp=Math.min(Number(member.maxHp),Number(member.hp)+outcome.playerHeal);member.personalShield=Math.max(Number(member.personalShield)||0,Number(outcome.playerShield)||0);events.push({type:"cat_action",memberId,targetId:catTarget,amount,heal:outcome.playerHeal||0,shield:outcome.playerShield||0,strong:outcome.strongTriggered,catId:cat.catId});}
    else if(catTarget&&Number(member.catATK)>0){const amount=hit(catTarget,Math.max(1,Number(member.catATK)-Number(targets[catTarget].def)*.35),{memberId,source:"cat",catId:member.catId||null});events.push({type:"cat_action",memberId,targetId:catTarget,amount,catId:member.catId||null});}
  }
  if(livingTargets().length){for(const targetId of livingTargets()){const candidates=livingMembers.filter(id=>members[id].alive!==false&&Number(members[id].hp)>0);if(!candidates.length)break;const memberId=candidates[Math.floor(rand()*candidates.length)],member=members[memberId],snapshot=member.loadoutSnapshot,mods=snapshot?.cards?.combatMods||{},reduce=Number(snapshot?.cards?.familyDamageReducePct?.[targets[targetId].family])||0,guardOn=Number(member.hp)/Math.max(1,Number(member.maxHp))<=(Number(mods.guardThresholdPct)||35)/100,cardReduce=Math.min(80,(Number(mods.cardReductionPct)||0)+(Number(mods.flatReductionPct)||0)+(guardOn?(Number(mods.guardReductionPct)||0):0)),atkDown=Number(mods.monsterAtkDownPct)||0;const raw=Math.max(1,Math.round(Math.max(1,Number(targets[targetId].atk)*(1-atkDown/100)-Number(snapshot.baseStats.def)*.5)*(1-reduce/100)*(1-cardReduce/100)));const absorbed=Math.min(raw,Number(member.personalShield)||0);member.personalShield=Math.max(0,(Number(member.personalShield)||0)-absorbed);const damage=raw-absorbed;member.hp=Math.max(0,Number(member.hp)-damage);if(Number(mods.reflectPct)>0)hit(targetId,raw*Number(mods.reflectPct)/100,{memberId,source:"reflect"});if(!member.hp){const guard=combatRuntime.consumeCatDeathGuard(member.catBattleState,{catId:snapshot.cat?.catId,maxHp:member.maxHp,mode:"normal"});member.catBattleState=guard.state;if(guard.triggered)member.hp=guard.hp;else member.alive=false;}events.push({type:"monster_counter",targetId,memberId,amount:damage,damage,remainingHp:member.hp,absorbed});}}
  for(const [memberId,member] of Object.entries(members)){const heal=Math.max(0,Number(member.loadoutSnapshot?.cards?.combatMods?.endRoundHeal)||0);if(member.alive!==false&&heal){const before=Number(member.hp);member.hp=Math.min(Number(member.maxHp),before+heal);if(member.hp>before)events.push({type:"round_heal",memberId,amount:member.hp-before,source:"card"});}}
  const victory=!livingTargets().length,defeat=!victory&&!Object.values(members).some(m=>m.alive!==false&&Number(m.hp)>0),round=Number(room.round);
  for(const member of Object.values(members)){member.ready=false;member.submission=null;}
  return {targets,members,status:victory?"victory":defeat?"defeat":"active",round:round+1,roundPhase:victory||defeat?"complete":"input",lastResolution:{resolutionId:`${roomId}:${round}`,round,seedVersion:2,targetHpBefore,memberHpBefore,events:events.map((event,index)=>({id:`${roomId}:${round}:${index}`,...event})),outcome:victory?"win":defeat?"lose":"continue"}};
}

module.exports={EFFECT_VERSION,SUPPORTED_EFFECTS,buildEncounter,buildDungeonEncounter,startPatch,submissionPatch,resolveRound,validateSnapshot};
