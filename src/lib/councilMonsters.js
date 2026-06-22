// src/lib/councilMonsters.js — 議會廳生活任務資料

export const COUNCIL_BUILDINGS = [
  { id:'mine',      name:'礦山',     emoji:'⛏️',  race:'ghost',     villageMat:'ore',       raceLabel:'鬼怪族' },
  { id:'farm',      name:'農地',     emoji:'🌿',  race:'mountain',  villageMat:'melon',     raceLabel:'山林族' },
  { id:'harbor',    name:'海港',     emoji:'⚓',  race:'exam',      villageMat:'fish',      raceLabel:'考試族' },
  { id:'hunting',   name:'獵場',     emoji:'🏕️', race:'insect',    villageMat:'meat',      raceLabel:'毒蟲族' },
  { id:'market',    name:'貓貓市集', emoji:'🛒',  race:'workplace', villageMat:'driedfish', raceLabel:'職場族' },
  { id:'warehouse', name:'露天倉庫', emoji:'📦',  race:'temple',    villageMat:'can',       raceLabel:'西方怪物族' },
];

export const TIER_ORDER = ['common','rare','elite','fierce','boss','mythic'];

// tier 外觀（顏色 / 標籤 / 素材後綴）
export const TIER_META = {
  common:  { label:'普通', color:'#6b7280', matSuffix:'m1' },
  rare:    { label:'稀有', color:'#3b82f6', matSuffix:'m2' },
  elite:   { label:'精英', color:'#8b5cf6', matSuffix:'m3' },
  fierce:  { label:'猛獸', color:'#f59e0b', matSuffix:'m4' },
  boss:    { label:'首領', color:'#ef4444', matSuffix:'m5' },
  mythic:  { label:'神話', color:'#ec4899', matSuffix:'m6' },
};

// 生活怪物戰鬥數值（繼承 ghost 族基礎值）
export const LIFE_TIER_STATS = {
  common:  { hp: 120, atk:  18, def:  8 },
  rare:    { hp: 240, atk:  36, def: 18 },
  elite:   { hp: 420, atk:  60, def: 33 },
  fierce:  { hp: 660, atk:  93, def: 57 },
  boss:    { hp: 975, atk: 132, def: 87 },
  mythic:  { hp:1500, atk: 210, def:143 },
};

// 建築等級 → 可出現的 tier 數量
export function getAvailableTiers(buildingLevel) {
  const lv = Math.max(1, buildingLevel || 1);
  if (lv >= 17) return TIER_ORDER.slice();
  if (lv >= 13) return TIER_ORDER.slice(0, 5);
  if (lv >= 10) return TIER_ORDER.slice(0, 4);
  if (lv >= 7)  return TIER_ORDER.slice(0, 3);
  if (lv >= 4)  return TIER_ORDER.slice(0, 2);
  return TIER_ORDER.slice(0, 1);
}

// 種族素材 ID
export function getRaceMaterialId(race, tier) {
  return `${race}_${TIER_META[tier].matSuffix}`;
}

export const CLEAR_GACHA_COINS      = 5;
export const CLEAR_VILLAGE_MAT_COUNT = 3;

// Tier → 種族寶箱類型（對應 itemData.js CHEST_TYPES）
export const TIER_TO_CHEST_TYPE = {
  common:'wood', rare:'iron', elite:'gold', fierce:'epic', boss:'mythic', mythic:'mythic',
};

// 勝利獎勵（依最高通關 tier）
export function getVictoryRewards(tier) {
  const n = TIER_ORDER.indexOf(tier) + 1;
  return {
    matCount:       5 + n * 5,
    raceChestTypes: TIER_ORDER.slice(0, n).map(t => TIER_TO_CHEST_TYPE[t]),
    coinChestTiers:  TIER_ORDER.slice(0, n),
  };
}

// 失敗補償（撤退 tier）
export function getFailureRewards(tier) {
  const n = TIER_ORDER.indexOf(tier) + 1;
  return { matCount: 5, gachaChance: 0.10 + n * 0.05, gachaMax: n };
}

// ── 36 個生活障礙（外觀 + 行動描述，無怪物形象）────────────────
export const COUNCIL_MONSTERS = {
  mine: {
    common:  { name:'入口碎石堆',   action:'堵住礦道入口',   emoji:'🪨', bgColor:'#f1f5f9' },
    rare:    { name:'礦道積水',     action:'地下水滲入礦道', emoji:'💧', bgColor:'#e0f2fe' },
    elite:   { name:'礦車壞軸',     action:'礦車卡死斜坡',   emoji:'⚙️', bgColor:'#e0e7ff' },
    fierce:  { name:'礦燈全滅',     action:'整層礦道無光',   emoji:'🔦', bgColor:'#d1d5db' },
    boss:    { name:'頂板裂縫',     action:'隨時可能崩塌',   emoji:'🪵', bgColor:'#fef9c3' },
    mythic:  { name:'地脈封印',     action:'地底能量封鎖礦脈', emoji:'💎', bgColor:'#f5f3ff' },
  },
  farm: {
    common:  { name:'雜草叢生',     action:'蔓延整片菜畦',   emoji:'🌱', bgColor:'#f0fdf4' },
    rare:    { name:'菜畦積水',     action:'根部開始腐爛',   emoji:'🪣', bgColor:'#dcfce7' },
    elite:   { name:'板結土壤',     action:'植物完全無法生長', emoji:'⛏️', bgColor:'#d1fae5' },
    fierce:  { name:'農具全鏽',     action:'所有工具無法使用', emoji:'🔧', bgColor:'#ecfccb' },
    boss:    { name:'土壤污染',     action:'整塊農地中毒',   emoji:'🌿', bgColor:'#fef9c3' },
    mythic:  { name:'枯萎詛咒',     action:'作物集體枯死',   emoji:'🌟', bgColor:'#fefce8' },
  },
  harbor: {
    common:  { name:'港口濃霧',     action:'船隻完全無法導航', emoji:'🌫️', bgColor:'#eff6ff' },
    rare:    { name:'惡浪衝擊',     action:'碼頭護欄嚴重受損', emoji:'🌊', bgColor:'#dbeafe' },
    elite:   { name:'纏船漁網',     action:'整艘船被漁網困住', emoji:'🕸️', bgColor:'#e0f2fe' },
    fierce:  { name:'擱淺船隻',     action:'漁船卡在礁石上', emoji:'⚓', bgColor:'#f1f5f9' },
    boss:    { name:'閘門故障',     action:'港口進出口全部鎖死', emoji:'🚪', bgColor:'#fef9c3' },
    mythic:  { name:'海底異常湧泉', action:'整個海灣水位異常', emoji:'🌀', bgColor:'#ede9fe' },
  },
  hunting: {
    common:  { name:'蟲害草叢',     action:'獵場入口蟲群橫行', emoji:'🌿', bgColor:'#f0fdf4' },
    rare:    { name:'擋路蜂巢',     action:'蜂群封鎖唯一通道', emoji:'🐝', bgColor:'#fef9c3' },
    elite:   { name:'毒蟲巢穴',     action:'毒液蔓延整塊獵場', emoji:'🐛', bgColor:'#ecfccb' },
    fierce:  { name:'蠍子埋伏',     action:'整條路佈滿蠍子', emoji:'🦂', bgColor:'#fef3c7' },
    boss:    { name:'巨型蛛網',     action:'蜘蛛網封死所有林道', emoji:'🕷️', bgColor:'#f5f3ff' },
    mythic:  { name:'蟲群封地',     action:'蟲神幼體接管獵場', emoji:'✨', bgColor:'#fdf4ff' },
  },
  market: {
    common:  { name:'奧客糾紛',     action:'在攤位前大吵大鬧', emoji:'😤', bgColor:'#fff7ed' },
    rare:    { name:'價格紛爭',     action:'惡意哄抬市場物價', emoji:'📊', bgColor:'#fef3c7' },
    elite:   { name:'攤位搶占',     action:'強行霸占三個攤位', emoji:'🛒', bgColor:'#fee2e2' },
    fierce:  { name:'惡意漲租',     action:'房東突然漲租三倍', emoji:'📜', bgColor:'#fce7f3' },
    boss:    { name:'市場壟斷',     action:'財閥壟斷所有貨源', emoji:'🧮', bgColor:'#fef9c3' },
    mythic:  { name:'財閥入侵',     action:'吞併整個貓貓市集', emoji:'💰', bgColor:'#fef3c7' },
  },
  warehouse: {
    common:  { name:'散落貨物',     action:'整個倉庫地板散滿貨', emoji:'📦', bgColor:'#f8fafc' },
    rare:    { name:'通道堵塞',     action:'主要走道完全無法通行', emoji:'🚧', bgColor:'#f1f5f9' },
    elite:   { name:'貨架倒塌',     action:'三排貨架連鎖倒下', emoji:'🗄️', bgColor:'#e2e8f0' },
    fierce:  { name:'大量庫損',     action:'一半庫存損毀急需清查', emoji:'📋', bgColor:'#ede9fe' },
    boss:    { name:'全庫封鎖',     action:'倉庫遭神秘力量封印', emoji:'🔐', bgColor:'#f5f3ff' },
    mythic:  { name:'龍守古寶',     action:'古龍佔據倉庫最深處', emoji:'🐉', bgColor:'#fef9c3' },
  },
};

// ── 各建築自扣血訊息（每 2 回合觸發，情境化）────────────────────
export const BUILDING_PAIN_MSGS = {
  mine: [
    "石頭碎片打到臉！",
    "礦坑悶熱，頭昏眼花！",
    "鋤頭揮空，跌了一跤！",
    "工具太重，手腕痠痛！",
    "黑暗中撞上礦壁！",
    "搬石塊閃到了腰！",
  ],
  farm: [
    "太陽太大，中暑了！",
    "鏟子揮太猛，腰痠了！",
    "跪太久，膝蓋好痛！",
    "被土堆嗆到咳嗽！",
    "除草時被刺藤刮傷！",
    "澆水桶太重，手腕扭到！",
  ],
  harbor: [
    "海浪打來，全身濕透受寒！",
    "繩索割傷了手掌！",
    "被海風吹得站不穩！",
    "搬漁貨太重，閃到腰！",
    "溼滑碼頭上滑倒了！",
    "鹹海風吹進眼睛好痛！",
  ],
  hunting: [
    "被蟲子咬了一口！",
    "荊棘刺傷了小腿！",
    "踩到泥地滑倒了！",
    "被樹枝彈回打到臉！",
    "草叢裡的毒液噴到手！",
    "腳踩進泥坑裡拔不出來！",
  ],
  market: [
    "被人群推擠跌倒！",
    "奧客叫聲太吵，頭好痛！",
    "搬貨時撞上攤位角！",
    "被踩到腳趾！",
    "爭論太激烈，嗓子啞了！",
    "擁擠中撞到了別人的手推車！",
  ],
  warehouse: [
    "貨箱太重，閃到腰！",
    "貨架掉東西砸到頭！",
    "黑暗中撞上木柱！",
    "搬太久，手臂無力了！",
    "不小心踢翻了整箱貨！",
    "地板油滑，差點摔倒！",
  ],
};
