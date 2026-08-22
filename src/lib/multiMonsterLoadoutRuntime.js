import { buildAdventurerCombatStats } from "./adventurerCombatStats";
import { calcCatCombatStats } from "./catCombat";
import { createCatBattleState, resolveCatRound, consumeCatDeathGuard } from "./catBattleEngine";

const stable = value => JSON.stringify(value, Object.keys(value || {}).sort());
function hash(value) { let out=2166136261; for(const char of String(value||"")) out=Math.imul(out^char.charCodeAt(0),16777619); return (out>>>0).toString(16); }

export function buildMultiMonsterLoadout({ member={}, sharedData={}, equipSpec=null, enemyFamily=null, enemyClass="normal" }={}) {
  const stats=buildAdventurerCombatStats({member,sharedData,equipSpec,enemyFamily,enemyClass});
  const catId=member?.equippedCat?.catId || "";
  const authoritativeCat=(sharedData.cats||[]).find(cat=>cat?.catId===catId) || (catId ? member.equippedCat : null);
  const cat=authoritativeCat ? calcCatCombatStats(authoritativeCat,catId) : null;
  const snapshot={version:2,memberId:member.id||null,baseStats:{hp:stats.hp,atk:stats.atk,def:stats.def},statSources:stats.statSources,cards:stats.cards,cat:cat?{...cat,battleState:createCatBattleState()}:null,statuses:[]};
  snapshot.sourceFingerprint=hash(stable({member,sharedData,enemyFamily,enemyClass}));
  return snapshot;
}

export { createCatBattleState, resolveCatRound, consumeCatDeathGuard };
