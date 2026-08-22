export function resolveSoloBattlePlayer({ calculated={}, playerStats=null, carryOver=false }={}) {
  const source=carryOver&&playerStats ? playerStats : calculated;
  const maxHp=Math.max(1,Number(source.maxHP??source.maxHp??calculated.hp)||1);
  return {
    maxHp,
    hp:Math.max(0,Number(source.hp??calculated.hp)||0),
    atk:Math.max(0,Number(source.atk??calculated.atk)||0),
    def:Math.max(0,Number(source.def??calculated.def)||0),
  };
}

export function resolveSoloCatProfile(profile={},cats=[]) {
  const catId=profile?.equippedCat?.catId;
  if(!catId)return profile;
  const live=(Array.isArray(cats)?cats:[]).find(cat=>cat?.catId===catId);
  return live?{...profile,equippedCat:{...profile.equippedCat,...live,catId}}:profile;
}

export function aggregateRewardChests(chests=[]) {
  const rows=[],byKey=new Map();
  for(const chest of Array.isArray(chests)?chests:[]){
    const key=[chest.type||"",chest.family||"",chest.tierIndex??chest.tier??"",chest.name||""].join(":");
    const quantity=Math.max(1,Number(chest.quantity??chest.count??chest.qty)||1);
    const existing=byKey.get(key);
    if(existing)existing.quantity+=quantity;
    else{const row={...chest,quantity};byKey.set(key,row);rows.push(row);}
  }
  return rows;
}

export function shouldFinishSoloPresentation({ result, eventType, killedCount, livingEnemyCount }={}) {
  return result==="win"&&eventType==="multi_monster_killed"&&Number(livingEnemyCount)>0&&Number(killedCount)>=Number(livingEnemyCount);
}
