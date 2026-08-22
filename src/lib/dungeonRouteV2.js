export const DUNGEON_ROUTE_VERSION = 2;

export const ROUTE_ARCHETYPES = {
  hunt:{ icon:"⚔️", label:"狩獵印記", risk:"敵人威脅提升 15%", reward:"素材與卡片掉落提高 20%", rooms:["elite_battle","chest"], immediate:{}, modifiers:{threatPct:.15,dropPct:.2} },
  supply:{ icon:"💚", label:"補給印記", risk:"最終寶箱收益降低 10%", reward:"立即恢復 15% 最大生命", rooms:["rest","shop"], immediate:{healPct:.15}, modifiers:{treasurePct:-.1} },
  curse:{ icon:"🩸", label:"詛咒印記", risk:"立即失去 8% 最大生命", reward:"稀有獎勵提高 25%，Boss 防禦降低 10%", rooms:["trap","elite_battle"], immediate:{hpCostPct:.08}, modifiers:{rarePct:.25,bossDefPct:-.1} },
  explore:{ icon:"🔭", label:"探索印記", risk:"事件結果波動提高", reward:"特殊收藏品機率提高 20%", rooms:["event","chest"], immediate:{}, modifiers:{collectiblePct:.2} },
};

export function getDungeonRouteModifiers(route) {
  const result={threatPct:0,dropPct:0,treasurePct:0,rarePct:0,bossDefPct:0,collectiblePct:0};
  for (const mark of route?.marks || []) {
    const modifiers=ROUTE_ARCHETYPES[mark]?.modifiers || {};
    for (const key of Object.keys(result)) result[key]+=Number(modifiers[key] || 0);
  }
  return result;
}

export function applyDungeonRouteImmediateEffect(member, mark) {
  const effect=ROUTE_ARCHETYPES[mark]?.immediate || {};
  const maxHP=Math.max(1,Number(member?.maxHP || 1));
  let hp=Math.max(0,Number(member?.hp || 0));
  if (effect.healPct) hp=Math.min(maxHP,hp+Math.max(1,Math.round(maxHP*effect.healPct)));
  if (effect.hpCostPct) hp=Math.max(1,hp-Math.max(1,Math.round(maxHP*effect.hpCostPct)));
  return {...member,hp};
}

export function resolveDungeonRouteSequence(route, boss, treasure) {
  const modifiers=getDungeonRouteModifiers(route);
  return [
    ...(route?.rooms || []).map(room=>({
      ...room,
      threatMultiplier:room.routeMark==="hunt" ? 1.15 : 1,
      dropMultiplier:room.routeMark==="hunt" ? 1.2 : 1,
      rareRewardMultiplier:room.routeMark==="curse" ? 1.25 : 1,
      collectibleMultiplier:room.routeMark==="explore" ? 1.2 : 1,
    })),
    {...boss,routeModifiers:modifiers,bossDefenseMultiplier:Math.max(.5,1+modifiers.bossDefPct)},
    {...treasure,routeModifiers:modifiers,rewardMultiplier:Math.max(.5,1+modifiers.treasurePct+modifiers.rarePct+modifiers.collectiblePct)},
  ];
}

function hashSeed(value) {
  let h=2166136261;
  for (const c of String(value)) { h^=c.charCodeAt(0); h=Math.imul(h,16777619); }
  return h>>>0;
}

function pairFor(seed,index) {
  const keys=Object.keys(ROUTE_ARCHETYPES);
  const a=(hashSeed(`${seed}:${index}:a`)+index)%keys.length;
  let b=(hashSeed(`${seed}:${index}:b`)+index+1)%keys.length;
  if (b===a) b=(b+1)%keys.length;
  return [keys[a],keys[b]];
}

export function createDungeonRouteV2(seed="dungeon") {
  return {
    version:DUNGEON_ROUTE_VERSION,
    seed:String(seed),
    decisions:[0,1,2].map(i=>({id:`route-${i}`,options:pairFor(seed,i)})),
    activeDecision:0,
    marks:[],
    rooms:[],
  };
}

export function chooseDungeonRouteMark(route,mark) {
  if (route?.version!==2 || route.marks?.length>=3) return route;
  const decision=route.decisions[route.marks.length];
  if (!decision?.options?.includes(mark)) return route;
  const marks=[...(route.marks||[]),mark];
  const rooms=marks.map((key,decisionIndex)=>{
    const types=ROUTE_ARCHETYPES[key].rooms;
    const type=types[hashSeed(`${route.seed}:${decisionIndex}:room`)%types.length];
    return {id:`v2-${decisionIndex}-${key}`,type,label:type==="elite_battle"?"強敵房":type==="chest"?"寶箱房":type==="rest"?"休息區":type==="shop"?"商人區":type==="trap"?"詛咒陷阱":"神秘事件",routeMark:key,cleared:false};
  });
  if (marks.length===3) rooms.push({id:"v2-rest",type:"rest",label:"王前營地",cleared:false},{id:"v2-shop",type:"shop",label:"最後補給",cleared:false});
  return {...route,activeDecision:marks.length<3?marks.length:null,marks,rooms,modifiers:getDungeonRouteModifiers({marks})};
}

export function chooseDungeonRouteMarkAsController(route, mark, canControl) {
  return canControl ? chooseDungeonRouteMark(route,mark) : route;
}

export function currentDungeonRouteOptions(route) {
  if (route?.version!==2) return [];
  return route.decisions?.[route.marks?.length||0]?.options||[];
}
