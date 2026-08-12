import {WORLD_BOSSES,WORLD_BOSS_KEYS,WB_FAMILY_TO_DUNGEON_FAMILY} from "./worldBossData";
import {WORLD_BOSS_SKILLS} from "./worldBossSkillData";

const bands={small:{hp:[90000,105000],atk:[50,75],def:[30,50],mult:[1.2,1.6],status:[5,8]},big:{hp:[155000,185000],atk:[95,140],def:[60,90],mult:[1.4,1.9],status:[10,15]},cat:{hp:[305000,370000],atk:[155,200],def:[100,135],mult:[1.6,2.2],status:[15,20]},coach:{hp:[500000,580000],atk:[215,270],def:[140,175],mult:[1.8,2.5],status:[20,25]}};
const category=b=>b.family==="coach"?"coach":b.family==="cat"?"cat":b.familyTier==="small"?"small":"big";

test("26 bosses stay inside approved fixed category bands and preserve strict strength order",()=>{
  expect(WORLD_BOSS_KEYS).toHaveLength(26);
  for(const[key,boss]of Object.entries(WORLD_BOSSES)){const band=bands[category(boss)];expect({key,hp:boss.hp>=band.hp[0]&&boss.hp<=band.hp[1],atk:boss.atk>=band.atk[0]&&boss.atk<=band.atk[1],def:boss.def>=band.def[0]&&boss.def<=band.def[1]}).toEqual({key,hp:true,atk:true,def:true});}
  expect(WORLD_BOSSES.head_coach.hp).toBeGreaterThan(WORLD_BOSSES.cat_haji.hp);expect(WORLD_BOSSES.cat_haji.hp).toBeGreaterThan(WORLD_BOSSES.ghost_boss.hp);expect(WORLD_BOSSES.ghost_boss.hp).toBeGreaterThan(WORLD_BOSSES.ghost_boss_small.hp);
});

test("every skill uses category R2/R4 multipliers, status caps, and pure knockout finisher",()=>{
  for(const[key,boss]of Object.entries(WORLD_BOSSES)){const skill=WORLD_BOSS_SKILLS[key],band=bands[category(boss)];expect([skill.r2Strike.baseMultiplier,skill.r4Finisher.baseMultiplier]).toEqual(band.mult);expect(skill.r4Finisher).toMatchObject({status:null,canKnockOut:true});if(skill.r2Strike.status&&!skill.r2Strike.status.effect.startsWith("dot")){const max=skill.r2Strike.status.effect==="healDownPct"?Math.min(25,band.status[1]+5):band.status[1];expect(skill.r2Strike.status.strength).toBeGreaterThanOrEqual(band.status[0]);expect(skill.r2Strike.status.strength).toBeLessThanOrEqual(max);}}
});

test("treasure world bosses are distinct seventh-family small/big entries with approved skills",()=>{
  expect(WB_FAMILY_TO_DUNGEON_FAMILY.treasure).toBe("treasure");expect(WORLD_BOSSES.treasure_boss_small).toMatchObject({name:"鎏金寶匣獸",title:"七族守藏者",family:"treasure",familyTier:"small"});expect(WORLD_BOSSES.treasure_boss).toMatchObject({name:"萬寶藏王",title:"無盡寶庫之主",family:"treasure",familyTier:"big"});expect(WORLD_BOSS_SKILLS.treasure_boss_small.r2Strike).toMatchObject({name:"黃金鎖鏈",status:{effect:"dealtDownPct",strength:5}});expect(WORLD_BOSS_SKILLS.treasure_boss.r2Strike).toMatchObject({name:"貪婪封印",status:{effect:"healDownPct",strength:15}});
});
