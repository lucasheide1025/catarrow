const normalized=state=>({
  shield:Math.max(0,Math.round(Number(state?.shield)||0)),
  reductionPct:Math.max(0,Math.min(100,Number(state?.reductionPct)||0)),
  reductionDuration:Math.max(0,Math.floor(Number(state?.reductionDuration)||0)),
  delayedMult:Math.max(0,Number(state?.delayedMult)||0),
  reflectPct:Math.max(0,Math.min(100,Number(state?.reflectPct)||0)),
  reflectDuration:Math.max(0,Math.floor(Number(state?.reflectDuration)||0)),
});

export function applyPartySignatureBeforeDamage({damage=0,...rawState}={}){
  const state=normalized(rawState);
  const incoming=Math.max(0,Math.round(Number(damage)||0));
  const absorbed=Math.min(state.shield,incoming);
  const afterShield=incoming-absorbed;
  const finalDamage=Math.round(afterShield*(state.reductionDuration>0?1-state.reductionPct/100:1));
  return{damage:Math.max(0,finalDamage),absorbed,state:{...state,shield:state.shield-absorbed}};
}

export function applyPartySignatureAfterAbility(previous={},resolved={}, {monsterMaxHp=0}={}){
  const state=normalized(previous);
  return normalized({
    ...state,
    shield:state.shield+Math.round(Math.max(0,Number(monsterMaxHp)||0)*Math.max(0,Number(resolved.selfShieldMaxHpPct)||0)/100),
    reductionPct:resolved.selfReductionPct||state.reductionPct,
    reductionDuration:resolved.selfReductionDuration||state.reductionDuration,
    delayedMult:resolved.delayedMult||0,
    reflectPct:resolved.selfReflectPct||state.reflectPct,
    reflectDuration:resolved.selfReflectDuration||state.reflectDuration,
  });
}

export function tickPartySignatureState(previous={}){
  const state=normalized(previous);
  const reductionDuration=Math.max(0,state.reductionDuration-1);
  const reflectDuration=Math.max(0,state.reflectDuration-1);
  return{...state,reductionDuration,reductionPct:reductionDuration?state.reductionPct:0,reflectDuration,reflectPct:reflectDuration?state.reflectPct:0};
}
