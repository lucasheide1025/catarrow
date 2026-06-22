// src/lib/councilMonsters.js — 議會廳生活怪物資料

// 建築 → 種族素材 mapping
export const COUNCIL_BUILDINGS = [
  { id:'mine',      name:'礦山',    emoji:'⛏️',  race:'ghost',     villageMat:'ore',       raceLabel:'鬼怪族' },
  { id:'farm',      name:'農地',    emoji:'🌿',  race:'mountain',  villageMat:'melon',     raceLabel:'山林族' },
  { id:'harbor',    name:'海港',    emoji:'⚓',  race:'exam',      villageMat:'fish',      raceLabel:'考試族' },
  { id:'hunting',   name:'獵場',    emoji:'🏕️', race:'insect',    villageMat:'meat',      raceLabel:'毒蟲族' },
  { id:'market',    name:'貓貓市集',emoji:'🛒',  race:'workplace', villageMat:'driedfish', raceLabel:'職場族' },
  { id:'warehouse', name:'露天倉庫',emoji:'📦',  race:'temple',    villageMat:'can',       raceLabel:'西方怪物族' },
];

export const TIER_ORDER = ['common','rare','elite','fierce','boss','mythic'];

// tier 外觀（顏色/標籤）與素材後綴
export const TIER_META = {
  common:  { label:'普通', color:'#6b7280', bg:'#f3f4f6', matSuffix:'m1' },
  rare:    { label:'稀有', color:'#3b82f6', bg:'#eff6ff', matSuffix:'m2' },
  elite:   { label:'精英', color:'#8b5cf6', bg:'#f5f3ff', matSuffix:'m3' },
  fierce:  { label:'猛獸', color:'#f59e0b', bg:'#fffbeb', matSuffix:'m4' },
  boss:    { label:'首領', color:'#ef4444', bg:'#fff1f2', matSuffix:'m5' },
  mythic:  { label:'神話', color:'#ec4899', bg:'#fdf4ff', matSuffix:'m6' },
};

// 生活怪物戰鬥數值（繼承 monsterData.js ghost 族基礎值）
export const LIFE_TIER_STATS = {
  common:  { hp:  80, atk:  12, def:  5 },
  rare:    { hp: 160, atk:  24, def: 12 },
  elite:   { hp: 280, atk:  40, def: 22 },
  fierce:  { hp: 440, atk:  62, def: 38 },
  boss:    { hp: 650, atk:  88, def: 58 },
  mythic:  { hp:1000, atk: 140, def: 95 },
};

// 建築等級 → 可出現的 tier 數量
// Lv1-3: 1隻, Lv4-6: 2隻, Lv7-9: 3隻, Lv10-12: 4隻, Lv13-16: 5隻, Lv17-20: 6隻
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

// 全通關獎勵
export const CLEAR_GACHA_COINS = 5;
export const CLEAR_VILLAGE_MAT_COUNT = 3;

// 36 隻生活怪物（外觀 + 動作描述）
export const COUNCIL_MONSTERS = {
  mine: {
    common:  { name:'碎石仔',    action:'擋住入口', emoji:'🪨', bgColor:'#f1f5f9' },
    rare:    { name:'煤炭精',    action:'堵住礦道', emoji:'⛏️', bgColor:'#e2e8f0' },
    elite:   { name:'水晶靈',    action:'凍結礦脈', emoji:'💎', bgColor:'#e0e7ff' },
    fierce:  { name:'鐵礦衛',    action:'封鎖深坑', emoji:'🔩', bgColor:'#d1d5db' },
    boss:    { name:'金礦王',    action:'操控落石', emoji:'👑', bgColor:'#fef9c3' },
    mythic:  { name:'秘晶古靈',  action:'封印地脈', emoji:'✨', bgColor:'#f5f3ff' },
  },
  farm: {
    common:  { name:'種仔精',    action:'偷吃種子', emoji:'🌱', bgColor:'#f0fdf4' },
    rare:    { name:'澆水桶',    action:'淹水作怪', emoji:'🪣', bgColor:'#dcfce7' },
    elite:   { name:'翻土怪',    action:'翻壞菜畦', emoji:'🌾', bgColor:'#d1fae5' },
    fierce:  { name:'開墾大叔',  action:'霸占農地', emoji:'🪚', bgColor:'#ecfccb' },
    boss:    { name:'肥料桶',    action:'污染土壤', emoji:'🌿', bgColor:'#fef9c3' },
    mythic:  { name:'豐收靈',    action:'詛咒豐收', emoji:'🌟', bgColor:'#fefce8' },
  },
  harbor: {
    common:  { name:'迷霧鱈',    action:'製造濃霧', emoji:'🐟', bgColor:'#eff6ff' },
    rare:    { name:'浪花仔',    action:'掀起惡浪', emoji:'🌊', bgColor:'#dbeafe' },
    elite:   { name:'漁網精',    action:'纏住船隻', emoji:'🕸️', bgColor:'#e0f2fe' },
    fierce:  { name:'暗礁石',    action:'鑿穿船底', emoji:'🪨', bgColor:'#f1f5f9' },
    boss:    { name:'潮汐守',    action:'鎖閉港口', emoji:'🌕', bgColor:'#fef9c3' },
    mythic:  { name:'深海制度神',action:'吞沒港灣', emoji:'🏮', bgColor:'#ede9fe' },
  },
  hunting: {
    common:  { name:'草叢蟲',    action:'咬破陷阱', emoji:'🌿', bgColor:'#f0fdf4' },
    rare:    { name:'胖蜜蜂',    action:'蜇傷獵人', emoji:'🐝', bgColor:'#fef9c3' },
    elite:   { name:'蜈蚣精',    action:'毒化獵場', emoji:'🐛', bgColor:'#ecfccb' },
    fierce:  { name:'蠍子仔',    action:'埋伏獵人', emoji:'🦂', bgColor:'#fef3c7' },
    boss:    { name:'蜘蛛大姐',  action:'封鎖林道', emoji:'🕷️', bgColor:'#f5f3ff' },
    mythic:  { name:'蟲神幼體',  action:'接管獵場', emoji:'✨', bgColor:'#fdf4ff' },
  },
  market: {
    common:  { name:'奧客精',    action:'無理取鬧', emoji:'😤', bgColor:'#fff7ed' },
    rare:    { name:'報價鬼',    action:'哄抬物價', emoji:'📊', bgColor:'#fef3c7' },
    elite:   { name:'搶攤怪',    action:'搶占攤位', emoji:'🛒', bgColor:'#fee2e2' },
    fierce:  { name:'包租婆',    action:'加租逼走', emoji:'👜', bgColor:'#fce7f3' },
    boss:    { name:'財閥掌櫃',  action:'壟斷市場', emoji:'🧮', bgColor:'#fef9c3' },
    mythic:  { name:'資本魔神',  action:'吞併市集', emoji:'💰', bgColor:'#fef3c7' },
  },
  warehouse: {
    common:  { name:'倉庫哥布林',action:'亂丟貨物', emoji:'📋', bgColor:'#f8fafc' },
    rare:    { name:'骷髏搬工',  action:'堵住通道', emoji:'💀', bgColor:'#f1f5f9' },
    elite:   { name:'狼人倉管',  action:'破壞貨架', emoji:'🐺', bgColor:'#e2e8f0' },
    fierce:  { name:'吸血伯爵',  action:'沒收庫存', emoji:'🦇', bgColor:'#ede9fe' },
    boss:    { name:'巫妖管帳',  action:'施咒封庫', emoji:'👻', bgColor:'#f5f3ff' },
    mythic:  { name:'惡龍護寶',  action:'燒毀倉庫', emoji:'🐉', bgColor:'#fef9c3' },
  },
};
