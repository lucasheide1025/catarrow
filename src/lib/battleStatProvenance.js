const n=value=>Math.round(Number(value)||0);

export function buildBattleStatProvenance({base={},level={},card={},catMultiplier=1}={}){
  const rows=[{id:"base",label:"基礎與裝備",hp:n(base.hp),atk:n(base.atk),def:n(base.def)}];
  const add=(id,label,source)=>{const row={id,label,hp:n(source.hp),atk:n(source.atk),def:n(source.def)};if(row.hp||row.atk||row.def)rows.push(row);};
  add("level","射手等級",level);
  add("card","怪物卡片",card);
  const before=rows.reduce((sum,row)=>({hp:sum.hp+row.hp,atk:sum.atk+row.atk,def:sum.def+row.def}),{hp:0,atk:0,def:0});
  const mult=Math.max(0,Number(catMultiplier)||1);
  if(mult!==1)add("cat",`貓咪羈絆 ×${mult.toFixed(2)}`,{hp:n(before.hp*mult)-before.hp,atk:n(before.atk*mult)-before.atk,def:n(before.def*mult)-before.def});
  const total=rows.reduce((sum,row)=>({hp:sum.hp+row.hp,atk:sum.atk+row.atk,def:sum.def+row.def}),{hp:0,atk:0,def:0});
  return{rows,total};
}

export function appendBattleStatRuntimeSources(provenance,{effectiveAtk,effectiveDef,buffLabel="Buff"}={}){
  const base=provenance?.total||{};
  const rows=[...(provenance?.rows||[])];
  const atkDelta=n(effectiveAtk)-n(base.atk);
  const defDelta=n(effectiveDef)-n(base.def);
  if(atkDelta)rows.push({id:"runtimeAtk",label:atkDelta<0?"異常狀態":buffLabel,atk:atkDelta,def:0,hp:0});
  if(defDelta)rows.push({id:"runtimeDef",label:defDelta<0?"異常狀態":buffLabel,atk:0,def:defDelta,hp:0});
  return{rows,total:{...base,atk:n(effectiveAtk),def:n(effectiveDef)}};
}
