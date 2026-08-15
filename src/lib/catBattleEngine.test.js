import { consumeCatDeathGuard, createCatBattleState, describeCatOutcome, deterministicCatRoll, getCatGuardAtkBonus, recordCatShieldAbsorption, resolveAuthoritativeCatRound, resolveCatRound } from "./catBattleEngine";

const ctx=(overrides={})=>({
  catId:"daming",catLevel:100,bondLevel:10,catAtk:50,catMaxHp:300,
  playerHp:500,playerMaxHp:500,monsterHp:1000,monsterMaxHp:1000,
  monsterBossTagged:false,round:1,scores:[9,10,10],shieldAbsorbed:0,
  mode:"normal",state:createCatBattleState(),random:()=>0.99,...overrides,
});

describe("cat battle engine",()=>{
  test("battle presentation describes actual effects and buff expiry",()=>{
    const text=describeCatOutcome({monsterDamage:12,playerHeal:8,playerShield:5,monsterStatus:{name:"弱化"},playerDefBonusPct:10,events:[{kind:"guard_atk_expired"}]});
    expect(text).toContain("治療 8");
    expect(text).toContain("護盾 5");
    expect(text).toContain("附加弱化");
    expect(text).toContain("守護反攻已消耗");
  });
  test("healing cats still damage a stronger monster through signature ailment",()=>{
    const out=resolveCatRound(ctx());
    expect(out.events.some(e=>e.kind==="monster_status"&&e.damage>0)).toBe(true);
    expect(out.monsterDamage).toBeGreaterThan(0);
  });

  test("overflow healing becomes shield for Daming",()=>{
    const out=resolveCatRound(ctx({playerHp:500,playerMaxHp:500}));
    expect(out.playerShield).toBeGreaterThan(0);
  });

  test("strong skill is guaranteed on fourth miss",()=>{
    const state={...createCatBattleState(),strongSkillMisses:3};
    const out=resolveCatRound(ctx({state,random:()=>0.99}));
    expect(out.strongTriggered).toBe(true);
    expect(out.state.strongSkillMisses).toBe(0);
  });

  test("defense shield absorption becomes next-round attack",()=>{
    const out=resolveCatRound(ctx({catId:"diandian",shieldAbsorbed:80}));
    expect(out.state.guardAtkBuff.value).toBeGreaterThan(0);
    expect(out.state.guardAtkBuff.expiresAfterRound).toBe(2);
    expect(getCatGuardAtkBonus(out.state,2)).toBe(out.state.guardAtkBuff.value);
    expect(getCatGuardAtkBonus(out.state,3)).toBe(0);
  });

  test("authority can record shield absorption after the monster counter",()=>{
    const state=recordCatShieldAbsorption(createCatBattleState(),{catId:"diandian",bondLevel:20,catAtk:80,absorbed:50,round:3});
    expect(getCatGuardAtkBonus(state,4)).toBeGreaterThan(0);
    expect(getCatGuardAtkBonus(state,5)).toBe(0);
  });

  test("Youyou strong skill exposes a capped weaker team shield",()=>{
    const out=resolveCatRound(ctx({catId:"youyou",state:{...createCatBattleState(),strongSkillMisses:3}}));
    expect(out.teamShield).toBeGreaterThan(0);
    expect(out.teamShield).toBeLessThan(out.playerShield);
    expect(out.playerDefBonusPct).toBeGreaterThan(0);
    expect(out.playerDefBonusPct).toBeLessThanOrEqual(25);
  });

  test("Xiaoan death guard triggers once and is disabled for world bosses",()=>{
    const ready=resolveCatRound(ctx({catId:"xiaoan",state:{...createCatBattleState(),strongSkillMisses:3}}));
    const saved=consumeCatDeathGuard(ready.state,{catId:"xiaoan",maxHp:1000,mode:"normal"});
    expect(saved).toMatchObject({triggered:true,hp:150});
    expect(consumeCatDeathGuard(saved.state,{catId:"xiaoan",maxHp:1000,mode:"normal"}).triggered).toBe(false);
    expect(consumeCatDeathGuard(ready.state,{catId:"xiaoan",maxHp:1000,mode:"worldboss"}).triggered).toBe(false);
  });

  test("healing cat statuses persist and tick on the following round",()=>{
    const first=resolveCatRound(ctx({catId:"daming",random:()=>.99}));
    const second=resolveCatRound(ctx({catId:"daming",round:2,state:first.state,random:()=>.99}));
    expect(first.state.catStatuses[0]).toMatchObject({id:"cat_corrosion",rounds:2});
    expect(second.events.some(event=>event.kind==="cat_status_tick")).toBe(true);
    expect(second.monsterDamage).toBeGreaterThan(first.monsterDamage);
  });

  test("Gege strong skill applies a real capped attack weaken",()=>{
    const out=resolveCatRound(ctx({catId:"gege",bondLevel:50,state:{...createCatBattleState(),strongSkillMisses:3}}));
    expect(out.monsterStatus).toMatchObject({id:"weaken",duration:2});
    expect(out.monsterStatus.strength).toBeLessThanOrEqual(25);
    expect(out.teamHeal).toBeGreaterThan(0);
    expect(out.teamHeal).toBeLessThan(out.playerHeal);
    expect(out.teamCleanseCount).toBe(1);
  });

  test("Meimei strong skill detonates remaining cat ailment damage and consumes it",()=>{
    const state={...createCatBattleState(),strongSkillMisses:3,catStatuses:[{id:"cat_pulse",damage:30,rounds:2}]};
    const out=resolveCatRound(ctx({catId:"meimei",state}));
    expect(out.events.find(event=>event.kind==="cat_status_detonation")?.damage).toBeGreaterThan(0);
    expect(out.state.catStatuses).toHaveLength(0);
  });

  test("Niuniu precision scales with quality hits and strong skill exposes capped armor break",()=>{
    const low=resolveCatRound(ctx({catId:"niuniu",scores:[5,6,7]}));
    const high=resolveCatRound(ctx({catId:"niuniu",scores:[9,10,"X"]}));
    const strong=resolveCatRound(ctx({catId:"niuniu",bondLevel:50,scores:[9,10,"X"],state:{...createCatBattleState(),strongSkillMisses:3}}));
    expect(high.monsterDamage).toBeGreaterThan(low.monsterDamage);
    expect(strong.monsterStatus).toMatchObject({id:"defBreak",duration:2});
    expect(strong.monsterStatus.strength).toBeLessThanOrEqual(25);
  });

  test("Haji builds combo and converts its strong skill into multiple hits",()=>{
    const first=resolveCatRound(ctx({catId:"haji",scores:[7,8,9]}));
    const strong=resolveCatRound(ctx({catId:"haji",round:2,scores:[7,8,9],state:{...first.state,strongSkillMisses:3}}));
    expect(strong.state.combo).toBe(2);
    expect(strong.events.find(event=>event.kind==="cat_attack")?.hitCount).toBeGreaterThan(1);
  });

  test("Baobao finisher is strongest against a low-health monster",()=>{
    const healthy=resolveCatRound(ctx({catId:"baobao",monsterHp:900,state:{...createCatBattleState(),strongSkillMisses:3}}));
    const wounded=resolveCatRound(ctx({catId:"baobao",monsterHp:250,state:{...createCatBattleState(),strongSkillMisses:3}}));
    expect(wounded.monsterDamage).toBeGreaterThan(healthy.monsterDamage);
  });

  test("support specialization scales attack and healing without exceeding its cap",()=>{
    const attackBase=resolveCatRound(ctx({catId:"niuniu"}));
    const attackBoosted=resolveCatRound(ctx({catId:"niuniu",companionAttackPct:30}));
    expect(attackBoosted.monsterDamage).toBeGreaterThan(attackBase.monsterDamage);
    const healBase=resolveCatRound(ctx({catId:"gege",playerHp:100}));
    const healBoosted=resolveCatRound(ctx({catId:"gege",playerHp:100,companionHealingPct:30}));
    expect(healBoosted.playerHeal).toBeGreaterThan(healBase.playerHeal);
  });

  test("higher bond produces stronger base effect without bypassing caps",()=>{
    const low=resolveCatRound(ctx({bondLevel:0}));
    const high=resolveCatRound(ctx({bondLevel:50}));
    expect(high.monsterDamage).toBeGreaterThan(low.monsterDamage);
    expect(high.monsterDamage).toBeLessThanOrEqual(1000*0.025+50);
  });

  test("world boss healing ailment uses stricter cap",()=>{
    const normal=resolveCatRound(ctx({monsterMaxHp:100000,monsterHp:100000}));
    const world=resolveCatRound(ctx({mode:"worldboss",monsterMaxHp:100000,monsterHp:100000}));
    expect(world.monsterDamage).toBeLessThan(normal.monsterDamage);
  });

  test("authoritative room wrapper preserves each member bond and pity",()=>{
    const out=resolveAuthoritativeCatRound({member:{catId:"haji",catAtk:50,catBond:20,hp:100,maxHP:100,arrows:[9,9],catBattleState:{...createCatBattleState(),strongSkillMisses:3}},monster:{hp:500},round:4,random:()=>.99});
    expect(out.strongTriggered).toBe(true);
    expect(out.state.strongSkillMisses).toBe(0);
  });

  test("authoritative skill roll is stable across transaction retries",()=>{
    expect(deterministicCatRoll("battle-1","member-1","daming",2,"strong-skill"))
      .toBe(deterministicCatRoll("battle-1","member-1","daming",2,"strong-skill"));
    const input={member:{catId:"daming",catAtk:100,catBond:10},monster:{hp:1000},round:2,battleId:"battle-1",memberId:"member-1"};
    expect(resolveAuthoritativeCatRound(input).strongTriggered).toBe(resolveAuthoritativeCatRound(input).strongTriggered);
  });
});
