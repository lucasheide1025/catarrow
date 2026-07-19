// C5 經濟模擬 v2（task-local research，不碰 src）
// 數據源：正式規格 PRD。v2 更新參數 + 4 種打法比較（Codex 指示 2026-07-17）。
// 執行：node economy-sim.js → 印出 + 寫 claude-economy-simulation.json

const fs = require("fs");
const path = require("path");

// ─────────── PRD 明列數值 ───────────
const TIERS = ["T1", "T2", "T3", "T4", "T5", "T6"];
const BASE_DROP = { T1: 1, T2: 2, T3: 3, T4: 4, T5: 5, T6: 7 };  // PRD 141
const VARIANT_DROP = { normal: 1.0 };                            // 平均取 normal（0.8/1.0/1.2 無條件進位，均值≈1.0）

const SPEC_MAT = {
  1:  { T1:20, T2:10 },
  2:  { T1:30, T2:15, T3:8 },
  3:  { T1:40, T2:20, T3:12, T4:6 },
  4:  { T1:50, T2:30, T3:18, T4:10, T5:5 },
  5:  { T1:60, T2:40, T3:25, T4:15, T5:8, T6:4 },
  6:  { T1:80, T2:55, T3:35, T4:22, T5:12, T6:6 },
  7:  { T1:100, T2:70, T3:45, T4:30, T5:18, T6:9 },
  8:  { T1:125, T2:90, T3:60, T4:40, T5:24, T6:12, miniKing:1 },
  9:  { T1:160, T2:120, T3:80, T4:55, T5:32, T6:16, miniKing:2 },
  10: { T1:200, T2:150, T3:100, T4:70, T5:45, T6:25, bigKing:1 },
};
const SPEC_GOLD = { 1:1000, 2:1500, 3:2500, 4:4000, 5:6000, 6:9000, 7:13000, 8:18000, 9:25000, 10:35000 };
const SPEC_SUCCESS = { 1:.45, 2:.425, 3:.40, 4:.375, 5:.35, 6:.325, 7:.30, 8:.275, 9:.25, 10:.20 };
const SPEC_UNLOCK_GOLD = 10000, FAIL_BONUS = 0.15;

const LEGEND_GOLD = 12000, MYTHIC_GOLD = 30000;
const LEGEND_MINI = [1, 1, 1, 2, 2]; // 突破+四級 小王素材需求（PRD 101）合計 7
const MYTHIC_BIG  = [1, 1, 1, 2, 2]; // 大王素材 合計 7

// ─────────── 假設（Codex 指定 v2） ───────────
const ASSUMPTIONS = {
  dailyLimits: { single: 5, party: 5, dungeon: 1 },   // Codex 指定：地下城每天最多1次有效完成
  activeDaysPerWeek: { light: 2.5, normal: 4.5, high: 7 },
  singleDropMult: 3,        // PRD 142 單人 指定怪物素材 基準×3
  partyPerMember: 5,        // PRD 142 組隊 每合格成員 基準×5
  dungeonNormalMatMult: 5,  // 地下城一般素材（王房 PRD 152 基準×5 起）
  avgVariant: "normal",
  equipSlotsForFullMythic: 10, // Codex 指定：全身 = 10 件
  // 普通寶箱只產一般素材、且定位為「補缺口」→ 本模型不把寶箱當主要素材來源（只計保底戰鬥掉落）
  chestPolicy: "gap-filler-only (normal mats); NOT modeled as primary source",
  // 王素材：維持地下城王房限定（PRD 144）
  miniKingPerBossRun: 0.70, // BOSS 房小王A35%+小王B35% → 本體×1 期望
  bigKingPerBossRun: 0.34,  // 大王30% + 第4房保底 → 有效≈0.34
  goldPerSingleHunt: 300,
  goldPerPartyHunt: 300,
  goldPerDungeonRun: 3000,
};

// 4 種打法（Codex 指定比較）
const PATTERNS = {
  "只打地下城":     { single:false, party:false, dungeon:true },
  "地下城+單人":    { single:true,  party:false, dungeon:true },
  "地下城+組隊":    { single:false, party:true,  dungeon:true },
  "三模式全打滿":   { single:true,  party:true,  dungeon:true },
};

// ─────────── 工具 ───────────
const ceil = Math.ceil;
function expectedAttempts(pBase) {
  const p = [pBase, Math.min(1,pBase+FAIL_BONUS), Math.min(1,pBase+2*FAIL_BONUS), 1];
  const P1=p[0], P2=(1-p[0])*p[1], P3=(1-p[0])*(1-p[1])*p[2], P4=(1-p[0])*(1-p[1])*(1-p[2]);
  return 1*P1+2*P2+3*P3+4*P4;
}
function specTotalCost() {
  const cost = { T1:0,T2:0,T3:0,T4:0,T5:0,T6:0, miniKing:0, bigKing:0, gold: SPEC_UNLOCK_GOLD };
  for (let L=1; L<=10; L++) { const att = expectedAttempts(SPEC_SUCCESS[L]); const rc = SPEC_MAT[L];
    for (const k of Object.keys(rc)) cost[k] += rc[k]*att; cost.gold += SPEC_GOLD[L]*att; }
  return cost;
}
function onePieceLegendToMythic() {
  return { miniKing: LEGEND_MINI.reduce((a,b)=>a+b,0), bigKing: MYTHIC_BIG.reduce((a,b)=>a+b,0),
    gold: LEGEND_GOLD*5 + MYTHIC_GOLD*5 };
}
const scale = (c,k)=>{const o={};for(const key of Object.keys(c))o[key]=c[key]*k;return o;};
const round = x => Math.round(x*10)/10;
const mo = w => round(w/4.33);

// 每週收入（依打法）
function weeklyIncome(type, pat) {
  const days = ASSUMPTIONS.activeDaysPerWeek[type], v = VARIANT_DROP[ASSUMPTIONS.avgVariant];
  const single = pat.single ? days*ASSUMPTIONS.dailyLimits.single : 0;
  const party  = pat.party  ? days*ASSUMPTIONS.dailyLimits.party  : 0;
  const dungeon= pat.dungeon? days*ASSUMPTIONS.dailyLimits.dungeon: 0;
  const perTierFocused = {};
  for (const T of TIERS) { const b = BASE_DROP[T];
    perTierFocused[T] = single*ceil(b*ASSUMPTIONS.singleDropMult*v)
                      + party *ceil(b*ASSUMPTIONS.partyPerMember*v)
                      + dungeon*ceil(b*ASSUMPTIONS.dungeonNormalMatMult*v);
  }
  const miniKing = dungeon*ASSUMPTIONS.miniKingPerBossRun;
  const bigKing  = dungeon*ASSUMPTIONS.bigKingPerBossRun;
  const gold = single*ASSUMPTIONS.goldPerSingleHunt + party*ASSUMPTIONS.goldPerPartyHunt + dungeon*ASSUMPTIONS.goldPerDungeonRun;
  return { days, single, party, dungeon, perTierFocused, miniKing, bigKing, gold, cardsPerWeek: party*0.20*3 /*組隊卡片估:每人每場~機率*/ };
}

// 里程碑期望週數：一般素材需序列農各 Tier(相加)；king/gold 與農素材並行(取最慢)
function weeksFor(cost, inc) {
  const b = {};
  for (const T of TIERS) { const d=cost[T]||0, r=inc.perTierFocused[T]; b[T] = r>0 ? d/r : (d>0?Infinity:0); }
  const matWeeks = TIERS.reduce((s,T)=>s+b[T],0);
  const kingWeeks = Math.max(inc.miniKing>0?(cost.miniKing||0)/inc.miniKing:((cost.miniKing||0)>0?Infinity:0),
                             inc.bigKing >0?(cost.bigKing ||0)/inc.bigKing :((cost.bigKing ||0)>0?Infinity:0));
  const goldWeeks = inc.gold>0 ? (cost.gold||0)/inc.gold : ((cost.gold||0)>0?Infinity:0);
  return { total: Math.max(matWeeks, kingWeeks, goldWeeks), matWeeks, kingWeeks, goldWeeks };
}

// ─────────── 執行 ───────────
const spec = specTotalCost();
const piece = onePieceLegendToMythic();
const pieceCost = { miniKing:piece.miniKing, bigKing:piece.bigKing, gold:piece.gold };
const out = { version:"v2", assumptions:ASSUMPTIONS, specTotalCost:spec, onePieceLegendToMythic:piece, results:{} };

console.log("=== 專精單條 Lv1→10 期望總消耗 ===");
console.log(Object.fromEntries(Object.entries(spec).map(([k,v])=>[k,round(v)])));

for (const type of Object.keys(ASSUMPTIONS.activeDaysPerWeek)) {
  out.results[type] = {};
  console.log(`\n########## ${type} 玩家（${ASSUMPTIONS.activeDaysPerWeek[type]} 天/週）##########`);
  for (const pname of Object.keys(PATTERNS)) {
    const inc = weeklyIncome(type, PATTERNS[pname]);
    const oneSpec = weeksFor(spec, inc);
    const three = weeksFor(scale(spec,3), inc);
    const nine  = weeksFor(scale(spec,9), inc);
    const one   = weeksFor(pieceCost, inc);
    const full  = weeksFor(scale(pieceCost, ASSUMPTIONS.equipSlotsForFullMythic), inc);
    const bind = (w) => w.matWeeks===Infinity ? "一般素材(無此模式產出)" :
      (w.matWeeks>=w.kingWeeks && w.matWeeks>=w.goldWeeks) ? "一般素材" :
      (w.kingWeeks>=w.goldWeeks) ? (w.kingWeeks===Infinity?"王素材(無地下城)":"王素材") : "金幣";
    out.results[type][pname] = {
      oneSpecL10_mo: mo(oneSpec.total), threeSpecs_mo: mo(three.total), nineSpecs_mo: mo(nine.total),
      onePieceMythic_mo: mo(one.total), fullMythic10_mo: mo(full.total),
      bind_spec: bind(oneSpec), bind_fullMythic: bind(full),
    };
    console.log(`【${pname}】 單專精 ${mo(oneSpec.total)}月 | 三專精 ${mo(three.total)}月 | 九專精 ${mo(nine.total)}月 | 全身神話(10件) ${mo(full.total)}月 | 專精瓶頸:${bind(oneSpec)} / 神話瓶頸:${bind(full)}`);
  }
}

fs.writeFileSync(path.join(__dirname, "claude-economy-simulation.json"), JSON.stringify(out, null, 2));
console.log("\n✅ 已寫 claude-economy-simulation.json");
