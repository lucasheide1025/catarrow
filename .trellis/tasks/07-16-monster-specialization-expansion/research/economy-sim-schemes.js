// C5b 方案模擬：單人 targeting × 組隊卡片效率（A/B/C）
// task-local research，數據源 PRD + Codex 指定方案（2026-07-17）。不碰 src。
// 執行：node economy-sim-schemes.js → 印出 + 寫 claude-economy-schemes.json

const fs = require("fs");
const path = require("path");

const TIERS = ["T1","T2","T3","T4","T5","T6"];
const BASE = { T1:1,T2:2,T3:3,T4:4,T5:5,T6:7 };
const ceil = Math.ceil, round = x=>Math.round(x*10)/10, mo = w=>round(w/4.33);

// 專精配方（PRD 84）
const SPEC_MAT = { 1:{T1:20,T2:10},2:{T1:30,T2:15,T3:8},3:{T1:40,T2:20,T3:12,T4:6},4:{T1:50,T2:30,T3:18,T4:10,T5:5},
  5:{T1:60,T2:40,T3:25,T4:15,T5:8,T6:4},6:{T1:80,T2:55,T3:35,T4:22,T5:12,T6:6},7:{T1:100,T2:70,T3:45,T4:30,T5:18,T6:9},
  8:{T1:125,T2:90,T3:60,T4:40,T5:24,T6:12,miniKing:1},9:{T1:160,T2:120,T3:80,T4:55,T5:32,T6:16,miniKing:2},
  10:{T1:200,T2:150,T3:100,T4:70,T5:45,T6:25,bigKing:1} };
const SPEC_GOLD={1:1000,2:1500,3:2500,4:4000,5:6000,6:9000,7:13000,8:18000,9:25000,10:35000};
const SPEC_SUCCESS={1:.45,2:.425,3:.40,4:.375,5:.35,6:.325,7:.30,8:.275,9:.25,10:.20};
const UNLOCK=10000, FAILB=0.15;
function eAtt(p){const a=[p,Math.min(1,p+FAILB),Math.min(1,p+2*FAILB),1];const P1=a[0],P2=(1-a[0])*a[1],P3=(1-a[0])*(1-a[1])*a[2],P4=(1-a[0])*(1-a[1])*(1-a[2]);return P1+2*P2+3*P3+4*P4;}
function specCost(){const c={T1:0,T2:0,T3:0,T4:0,T5:0,T6:0,miniKing:0,bigKing:0,gold:UNLOCK};for(let L=1;L<=10;L++){const at=eAtt(SPEC_SUCCESS[L]);for(const k of Object.keys(SPEC_MAT[L]))c[k]+=SPEC_MAT[L][k]*at;c.gold+=SPEC_GOLD[L]*at;}return c;}
const SPEC=specCost();

// 卡片
const SINGLE_CARD=0.20, STAR_TO_MAX=15; // 1★→5★ 需 15 張（PRD 73）

// ── 三方案定義 ──
const SCHEMES = {
  A: { label:"保守調整", singleBulk:t=>ceil(BASE[t]*4), singleTarget:t=>ceil(BASE[t]*4), partyBulk:t=>ceil(BASE[t]*5), partyCard:0.25, partyPity:false },
  B: { label:"明確分工", singleBulk:t=>ceil(BASE[t]*5), singleTarget:t=>ceil(BASE[t]*5), partyBulk:t=>ceil(BASE[t]*5), partyCard:0.30, partyPity:false },
  C: { label:"強化targeting", singleBulk:t=>ceil(BASE[t]*3)+2, singleTarget:t=>ceil(BASE[t]*3)+2, partyBulk:t=>ceil(BASE[t]*5), partyCard:0.30, partyPity:true },
};
// 組隊對「特定素材」的擴散：假設組隊較難精準,對指定材只拿 1/3（單人可完全 targeting）
const PARTY_TARGET_SHARE = 1/3;
// 組隊卡片含保底的有效率
function partyCardEff(s){ if(!s.partyPity) return s.partyCard; const p=s.partyCard; return (5*p + Math.pow(1-p,5))/5; }

const DAILY={single:5,party:5,dungeon:1};
const DUNGEON_NORMAL_MULT=5, MINIK=0.70, BIGK=0.34, GOLD_S=300,GOLD_P=300,GOLD_D=3000;
const PLAYERS={ normal:4.5, high:7 };

function scale(c,k){const o={};for(const key of Object.keys(c))o[key]=c[key]*k;return o;}
// 每週一般素材(bulk)每 Tier 收入（打法 = 單人+組隊+地下城 全打）
function tierIncomeAll(s, days){
  const inc={};
  for(const t of TIERS){
    inc[t]= days*DAILY.single*s.singleBulk(t) + days*DAILY.party*s.partyBulk(t) + days*DAILY.dungeon*ceil(BASE[t]*DUNGEON_NORMAL_MULT);
  }
  inc.miniKing=days*DAILY.dungeon*MINIK; inc.bigKing=days*DAILY.dungeon*BIGK;
  inc.gold=days*(DAILY.single*GOLD_S+DAILY.party*GOLD_P+DAILY.dungeon*GOLD_D);
  return inc;
}
function weeksFor(cost, inc){
  let mat=0; for(const t of TIERS){const d=cost[t]||0,r=inc[t];mat+=r>0?d/r:(d>0?Infinity:0);}
  const king=Math.max(inc.miniKing>0?(cost.miniKing||0)/inc.miniKing:((cost.miniKing||0)>0?Infinity:0), inc.bigKing>0?(cost.bigKing||0)/inc.bigKing:((cost.bigKing||0)>0?Infinity:0));
  const gold=inc.gold>0?(cost.gold||0)/inc.gold:Infinity;
  return {total:Math.max(mat,king,gold),mat,king,gold};
}

const out={version:"schemes-v1", schemes:{}};
console.log("############ A/B/C 方案比較 ############\n");

for(const key of Object.keys(SCHEMES)){
  const s=SCHEMES[key]; out.schemes[key]={label:s.label};
  console.log(`===== 方案 ${key}（${s.label}）=====`);

  // 1. 每日單一 Tier 素材效率（bulk）：只單人 / 只組隊 / 兩者
  console.log("每日一般素材效率(bulk, 5場/模式):  Tier | 只單人 | 只組隊 | 單+組");
  const eff={};
  for(const t of TIERS){
    const sOnly=DAILY.single*s.singleBulk(t), pOnly=DAILY.party*s.partyBulk(t), both=sOnly+pOnly;
    eff[t]={singleOnly:sOnly,partyOnly:pOnly,both};
    console.log(`   ${t}: ${String(sOnly).padStart(4)} | ${String(pOnly).padStart(4)} | ${both}`);
  }
  out.schemes[key].dailyBulkPerTier=eff;

  // 2. 精準農某瓶頸素材(以 T1 指定材 需要 600 為例) 所需天數：單人targeting vs 組隊擴散
  const NEED=600;
  const t="T1";
  const singleTargetDay=DAILY.single*s.singleTarget(t);
  const partyTargetDay=DAILY.party*s.partyBulk(t)*PARTY_TARGET_SHARE;
  const daysSingle=NEED/singleTargetDay, daysParty=NEED/partyTargetDay;
  console.log(`精準農 T1 指定材 ${NEED} 個: 單人targeting ${round(daysSingle)}天 (${singleTargetDay}/天) | 組隊擴散 ${round(daysParty)}天 (${round(partyTargetDay)}/天)`);
  out.schemes[key].targetFarmT1_600={singleDays:round(daysSingle),partyDays:round(daysParty)};

  // 3. 卡片：每日某目標怪卡片、升滿一張(15張)天數
  const cardEff=partyCardEff(s);
  const cardSingleDay=DAILY.single*SINGLE_CARD, cardPartyDay=DAILY.party*cardEff, cardBoth=cardSingleDay+cardPartyDay;
  console.log(`卡片(目標怪): 只單人 ${round(cardSingleDay)}/天(率${SINGLE_CARD}) | 只組隊 ${round(cardPartyDay)}/天(有效率${round(cardEff*100)/100}) | 升滿1張(15) 兩者 ${round(STAR_TO_MAX/cardBoth)}天`);
  out.schemes[key].cards={singlePerDay:round(cardSingleDay),partyPerDay:round(cardPartyDay),maxOneCardDays_both:round(STAR_TO_MAX/cardBoth)};

  // 4-5. 三條 / 九條專精 L10 時間（high/normal 全打）
  out.schemes[key].specTimes={};
  for(const pl of Object.keys(PLAYERS)){
    const inc=tierIncomeAll(s,PLAYERS[pl]);
    const three=weeksFor(scale(SPEC,3),inc), nine=weeksFor(scale(SPEC,9),inc);
    out.schemes[key].specTimes[pl]={threeSpecs_mo:mo(three.total),nineSpecs_mo:mo(nine.total),threeBind:bind(three),nineBind:bind(nine)};
    console.log(`  ${pl}玩家 全打: 三專精 ${mo(three.total)}月 | 九專精 ${mo(nine.total)}月 (瓶頸 ${bind(nine)})`);
  }
  // 6. 組隊是否嚴格支配單人？
  const partyDomBulk = TIERS.every(t=>s.partyBulk(t)>=s.singleBulk(t));
  const singleWinsTarget = s.singleTarget("T1")>=s.partyBulk("T1")*PARTY_TARGET_SHARE;
  const verdict = (partyDomBulk && !singleWinsTarget) ? "❌ 組隊嚴格支配(單人無獨立價值)" :
    partyDomBulk ? "⚠️ 組隊bulk較高,但單人targeting有獨立價值→不支配" : "✅ 互有勝場,不支配";
  console.log(`  組隊是否支配單人: ${verdict}\n`);
  out.schemes[key].dominanceVerdict=verdict;
}

function bind(w){return w.mat===Infinity?"一般素材":(w.mat>=w.king&&w.mat>=w.gold)?"一般素材":(w.king>=w.gold)?"王素材":"金幣";}

fs.writeFileSync(path.join(__dirname,"claude-economy-schemes.json"),JSON.stringify(out,null,2));
console.log("✅ 已寫 claude-economy-schemes.json");
