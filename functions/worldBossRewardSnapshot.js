const CATEGORIES = Object.freeze({
  family_small:{
    participation:{coins:[80,120],arrowDew:[15,30],archerXP:[80,130],catXP:[25,45],bond:[2,4],materialChests:[1,1]},
    kill:{coins:[200,300],arrowDew:[50,80],archerXP:[250,400],catXP:[80,130],bond:[8,12],materialChests:[1,2],coinChests:[0,1],mimiBoxes:[0,0],cardPacks:[0,1],wbCardChance:[0.15,0.25],scrolls:[1,1]},
    effortPool:{coins:[2000,3000],arrowDew:[400,700],archerXP:[1600,2400],catXP:[500,800],bond:[60,100]}, materialTierRange:[1,3], randomFamily:false,
  },
  family_big:{
    participation:{coins:[130,190],arrowDew:[30,50],archerXP:[140,220],catXP:[45,70],bond:[4,7],materialChests:[1,2]},
    kill:{coins:[350,500],arrowDew:[90,140],archerXP:[450,650],catXP:[140,220],bond:[15,22],materialChests:[2,3],coinChests:[1,2],mimiBoxes:[0,1],cardPacks:[0,1],wbCardChance:[0.20,0.30],scrolls:[1,1]},
    effortPool:{coins:[4000,6000],arrowDew:[800,1300],archerXP:[3000,4600],catXP:[1000,1600],bond:[120,200]}, materialTierRange:[4,6], randomFamily:false,
  },
  cat:{
    participation:{coins:[200,300],arrowDew:[50,80],archerXP:[240,360],catXP:[80,120],bond:[8,12],materialChests:[1,2]},
    kill:{coins:[550,750],arrowDew:[150,220],archerXP:[700,950],catXP:[250,350],bond:[25,35],materialChests:[1,2],coinChests:[2,4],mimiBoxes:[1,1],cardPacks:[1,2],wbCardChance:[0.15,0.25],scrolls:[1,1]},
    effortPool:{coins:[8000,12000],arrowDew:[1600,2400],archerXP:[6000,9000],catXP:[2000,3000],bond:[260,400]}, materialTierRange:[3,5], randomFamily:true,
  },
  coach:{
    participation:{coins:[320,450],arrowDew:[80,130],archerXP:[400,600],catXP:[130,180],bond:[15,22],materialChests:[2,3]},
    kill:{coins:[800,1100],arrowDew:[250,350],archerXP:[1000,1400],catXP:[350,500],bond:[40,55],materialChests:[3,5],coinChests:[3,5],mimiBoxes:[1,2],cardPacks:[2,3],wbCardChance:[0.10,0.20],scrolls:[1,2]},
    effortPool:{coins:[14000,20000],arrowDew:[2800,4000],archerXP:[10000,14000],catXP:[3400,4800],bond:[440,640]}, materialTierRange:[4,6], randomFamily:true,
  },
});

const HONOR_COUNTS=Object.freeze({rank1:30,rank2:20,rank3:10,lastHit:5});
const HONOR_FIXED=Object.freeze({rank1:{gachaCoins:10,mimiBoxes:1,arrowDew:200},rank2:{gachaCoins:7,mimiBoxes:1,arrowDew:120},rank3:{gachaCoins:5,mimiBoxes:1,arrowDew:80},lastHit:{gachaCoins:5,arrowDew:150}});
const MATERIAL_FAMILY=Object.freeze({ghost:'ghost',forest:'mountain',poison:'insect',office:'workplace',exam:'exam',western:'temple',treasure:'treasure'});
function integer([min,max],random){return min+Math.floor(random()*(max-min+1));}
function decimal([min,max],random){return Math.round((min+random()*(max-min))*100)/100;}
function rollFields(ranges,random){return Object.fromEntries(Object.entries(ranges).map(([key,range])=>[key,key==='wbCardChance'?decimal(range,random):integer(range,random)]));}

function buildWorldBossRewardSnapshot({category,bossFamily=null,generatedAt=Date.now(),random=Math.random}={}){
  const config=CATEGORIES[category];
  if(!config)throw new Error('invalid_world_boss_reward_category');
  const materialFamily=config.randomFamily?null:(MATERIAL_FAMILY[bossFamily]||bossFamily||null);
  return {
    version:2,category,generatedAt,
    participation:rollFields(config.participation,random),
    kill:{...rollFields(config.kill,random),materialTierRange:[...config.materialTierRange],materialFamily,randomFamily:config.randomFamily},
    effortPool:rollFields(config.effortPool,random),
    honor:Object.fromEntries(Object.entries(HONOR_COUNTS).map(([key,count])=>[key,{...HONOR_FIXED[key],materialChests:count,coinChests:count,catBoxes:key==='rank1'||key==='lastHit'?1:0,trophy:true,materialTierRange:[...config.materialTierRange],coinTierRange:[...config.materialTierRange],materialFamily,randomFamily:config.randomFamily}]))
  };
}
function rewardCategoryForBoss({bossKey,bossData}={}){const family=bossData?.family;return family==='coach'?'coach':family==='cat'?'cat':(bossData?.familyTier==='small'||String(bossKey||'').endsWith('_small'))?'family_small':'family_big';}

function validateWorldBossRewardSnapshot(snapshot){
  const config=CATEGORIES[snapshot?.category];
  if(snapshot?.version!==2||!config)return false;
  const valid=(actual,ranges)=>Object.entries(ranges).every(([key,[min,max]])=>Number(actual?.[key])>=min&&Number(actual?.[key])<=max);
  return valid(snapshot.participation,config.participation)&&valid(snapshot.kill,config.kill)&&valid(snapshot.effortPool,config.effortPool)
    && Object.entries(HONOR_COUNTS).every(([key,count])=>snapshot.honor?.[key]?.materialChests===count&&snapshot.honor?.[key]?.coinChests===count);
}

function largestRemainderAllocation(pool,participants){
  const entries=Object.entries(participants).filter(([,p])=>Number(p.totalDmg)>0&&!(p.isGuest===true&&p.accountType!=='official'));
  const weights=entries.map(([id,p])=>[id,Math.sqrt(Number(p.totalDmg))*Math.min(2,1+Math.max(0,(Array.isArray(p.sessions)?p.sessions.length:1)-1)*0.25)]);
  const total=weights.reduce((sum,[,weight])=>sum+weight,0)||1;
  const result=Object.fromEntries(weights.map(([id])=>[id,{}]));
  for(const [field,totalValue] of Object.entries(pool||{})){
    const raw=weights.map(([id,weight])=>({id,value:totalValue*weight/total}));
    let remaining=totalValue-raw.reduce((sum,item)=>sum+Math.floor(item.value),0);
    raw.sort((a,b)=>(b.value-Math.floor(b.value))-(a.value-Math.floor(a.value))||a.id.localeCompare(b.id));
    raw.forEach(item=>{result[item.id][field]=Math.floor(item.value)+(remaining-->0?1:0);});
  }
  return result;
}

const TIERS=['common','rare','elite','fierce','boss','mythic'];
const CHEST_TYPES=['wood','iron','gold','epic','mythic','mythic'];
const FAMILIES=['ghost','mountain','insect','workplace','exam','temple','treasure'];
const COIN_RANGES={common:[20,50],rare:[60,120],elite:[150,250],fierce:[300,500],boss:[600,1000],mythic:[1200,2000]};
function stableUnit(seed){let h=2166136261;for(const char of String(seed)){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;}
function chestTier(range,seed){const[min,max]=range,index=(min-1)+Math.floor(stableUnit(seed)*(max-min+1));return TIERS[index];}
function materialChest({id,range,family,seed,from}){const tier=chestTier(range,seed),index=TIERS.indexOf(tier);return{id,type:CHEST_TYPES[index],family:family||FAMILIES[Math.floor(stableUnit(`${seed}:family`)*FAMILIES.length)],tier,from,ts:Date.now()};}
function coinChest({id,range,seed,from}){const tier=chestTier(range,seed),[min,max]=COIN_RANGES[tier];return{id,type:'coin',coinTier:tier,family:'coin',tier,from,ts:Date.now(),min,max};}
function mergeNumeric(...rewards){const out={};for(const reward of rewards)for(const[key,value]of Object.entries(reward||{}))if(typeof value==='number')out[key]=(out[key]||0)+value;return out;}

module.exports={CATEGORIES,HONOR_COUNTS,buildWorldBossRewardSnapshot,rewardCategoryForBoss,validateWorldBossRewardSnapshot,largestRemainderAllocation,stableUnit,materialChest,coinChest,mergeNumeric};
