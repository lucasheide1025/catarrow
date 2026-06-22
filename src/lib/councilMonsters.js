// src/lib/councilMonsters.js — 議會廳採集任務資料

// 建築 → 種族材料 mapping
export const COUNCIL_BUILDINGS = [
  { id:'mine',      name:'礦山',    emoji:'⛏️',  race:'ghost',     villageMat:'ore',      raceLabel:'鬼怪族' },
  { id:'farm',      name:'農地',    emoji:'🌿',  race:'mountain',  villageMat:'melon',    raceLabel:'山林族' },
  { id:'harbor',    name:'海港',    emoji:'⚓',  race:'exam',      villageMat:'fish',     raceLabel:'考試族' },
  { id:'hunting',   name:'獵場',    emoji:'🏕️', race:'insect',    villageMat:'meat',     raceLabel:'毒蟲族' },
  { id:'market',    name:'貓貓市集',emoji:'🛒',  race:'workplace', villageMat:'driedfish',raceLabel:'職場族' },
  { id:'warehouse', name:'露天倉庫',emoji:'📦',  race:'temple',    villageMat:'can',      raceLabel:'西方怪物族' },
];

// 各 tier 基本數值
export const GATHER_TIER = {
  common:  { label:'普通', color:'#6b7280', maxHp: 60,  staminaCost: 3,  matSuffix:'m1' },
  rare:    { label:'稀有', color:'#3b82f6', maxHp: 100, staminaCost: 6,  matSuffix:'m2' },
  elite:   { label:'精英', color:'#8b5cf6', maxHp: 150, staminaCost: 10, matSuffix:'m3' },
  fierce:  { label:'猛獸', color:'#f59e0b', maxHp: 220, staminaCost: 16, matSuffix:'m4' },
  boss:    { label:'首領', color:'#ef4444', maxHp: 320, staminaCost: 24, matSuffix:'m5' },
  mythic:  { label:'神話', color:'#ec4899', maxHp: 500, staminaCost: 34, matSuffix:'m6' },
};

export const TIER_ORDER = ['common','rare','elite','fierce','boss','mythic'];

// 種族材料 ID：race + _m1~m6
export function getRaceMaterialId(race, tier) {
  return `${race}_${GATHER_TIER[tier].matSuffix}`;
}

// 36 隻生活怪物
export const COUNCIL_MONSTERS = {
  mine: {
    common:  { name:'碎石仔',    action:'探勘場地', emoji:'🪨', bgColor:'#f1f5f9' },
    rare:    { name:'煤炭精',    action:'打洞鑽探', emoji:'⛏️', bgColor:'#e2e8f0' },
    elite:   { name:'水晶靈',    action:'清除阻礙', emoji:'💎', bgColor:'#e0e7ff' },
    fierce:  { name:'鐵礦衛',    action:'深層採掘', emoji:'🔩', bgColor:'#dde0e8' },
    boss:    { name:'金礦王',    action:'突破岩壁', emoji:'👑', bgColor:'#fef9c3' },
    mythic:  { name:'秘晶古靈',  action:'挖出秘礦', emoji:'✨', bgColor:'#f5f3ff' },
  },
  farm: {
    common:  { name:'種仔精',    action:'撥種',     emoji:'🌱', bgColor:'#f0fdf4' },
    rare:    { name:'澆水桶',    action:'澆水',     emoji:'🪣', bgColor:'#dcfce7' },
    elite:   { name:'翻土怪',    action:'翻土',     emoji:'🌾', bgColor:'#d1fae5' },
    fierce:  { name:'開墾大叔',  action:'開墾',     emoji:'🪚', bgColor:'#ecfccb' },
    boss:    { name:'肥料桶',    action:'施肥',     emoji:'🌿', bgColor:'#fef9c3' },
    mythic:  { name:'豐收靈',    action:'收割',     emoji:'🌟', bgColor:'#fefce8' },
  },
  harbor: {
    common:  { name:'迷霧鱈',    action:'港口起霧', emoji:'🐟', bgColor:'#eff6ff' },
    rare:    { name:'浪花仔',    action:'海浪拍岸', emoji:'🌊', bgColor:'#dbeafe' },
    elite:   { name:'漁網精',    action:'修補漁網', emoji:'🕸️', bgColor:'#e0f2fe' },
    fierce:  { name:'暗礁石',    action:'暗礁危機', emoji:'🪨', bgColor:'#f1f5f9' },
    boss:    { name:'潮汐守',    action:'等待時機', emoji:'🌕', bgColor:'#fef9c3' },
    mythic:  { name:'深海制度神',action:'征服大海', emoji:'🏮', bgColor:'#ede9fe' },
  },
  hunting: {
    common:  { name:'草叢蟲',    action:'布置陷阱', emoji:'🌿', bgColor:'#f0fdf4' },
    rare:    { name:'胖蜜蜂',    action:'追蹤足跡', emoji:'🐝', bgColor:'#fef9c3' },
    elite:   { name:'蜈蚣精',    action:'潛伏等待', emoji:'🐛', bgColor:'#ecfccb' },
    fierce:  { name:'蠍子仔',    action:'追蹤獵物', emoji:'🦂', bgColor:'#fef3c7' },
    boss:    { name:'蜘蛛大姐',  action:'設網捕獲', emoji:'🕷️', bgColor:'#f5f3ff' },
    mythic:  { name:'蟲神幼體',  action:'征服森林', emoji:'✨', bgColor:'#fdf4ff' },
  },
  market: {
    common:  { name:'奧客精',    action:'議價扯皮', emoji:'😤', bgColor:'#fff7ed' },
    rare:    { name:'報價鬼',    action:'哄抬物價', emoji:'📊', bgColor:'#fef3c7' },
    elite:   { name:'搶攤怪',    action:'搶占地盤', emoji:'🛒', bgColor:'#fee2e2' },
    fierce:  { name:'包租婆',    action:'收租催帳', emoji:'👜', bgColor:'#fce7f3' },
    boss:    { name:'財閥掌櫃',  action:'壟斷市場', emoji:'🧮', bgColor:'#fef9c3' },
    mythic:  { name:'資本魔神',  action:'制霸市集', emoji:'💰', bgColor:'#fef3c7' },
  },
  warehouse: {
    common:  { name:'倉庫哥布林',action:'盤點庫存', emoji:'📋', bgColor:'#f8fafc' },
    rare:    { name:'骷髏搬工',  action:'搬運貨物', emoji:'💀', bgColor:'#f1f5f9' },
    elite:   { name:'狼人倉管',  action:'整理貨架', emoji:'🐺', bgColor:'#e2e8f0' },
    fierce:  { name:'吸血伯爵',  action:'稽查庫存', emoji:'🦇', bgColor:'#ede9fe' },
    boss:    { name:'巫妖管帳',  action:'封鎖倉庫', emoji:'👻', bgColor:'#f5f3ff' },
    mythic:  { name:'惡龍護寶',  action:'守護秘寶', emoji:'🐉', bgColor:'#fef9c3' },
  },
};

// 採集強度（每次點採集的傷害）
export const BASE_GATHER_POWER = 55;
export const GATHER_POWER_VARIANCE = 25; // random(0, 25)

// 玩家體力
export const PLAYER_STAMINA = 110;

// 全通關獎勵：扭蛋幣
export const CLEAR_GACHA_COINS = 5;

// 全通關村莊材料數量
export const CLEAR_VILLAGE_MAT_COUNT = 3;
