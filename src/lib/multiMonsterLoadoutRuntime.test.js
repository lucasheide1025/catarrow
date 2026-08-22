import { buildMultiMonsterLoadout } from "./multiMonsterLoadoutRuntime";

test("browser and generated Functions runtimes produce the same authoritative loadout",()=>{
  // eslint-disable-next-line global-require
  const server=require("../../functions/generated/combat/lib/multiMonsterLoadoutRuntime");
  const input={member:{id:"m1",hp:120,atk:18,def:9,archerXP:500,rpgEquip:{},equippedCat:{catId:"niuniu"}},sharedData:{certRecords:[],dexGrants:[],monsterDex:{},craftStats:{},chestStats:{},potionDex:{},cardData:{cards:{},wbCards:{},equipped:[]},cats:[{catId:"niuniu",catXP:100,bond:80,equip:{}}]},equipSpec:{weapon:{trackId:"precision",level:3}},enemyFamily:"ghost",enemyClass:"normal"};
  expect(server.buildMultiMonsterLoadout(input)).toEqual(buildMultiMonsterLoadout(input));
  expect(buildMultiMonsterLoadout(input).cards.combatMods.hqDamageSpecPct).toBeGreaterThan(0);
});
