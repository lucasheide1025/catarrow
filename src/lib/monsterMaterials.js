// src/lib/monsterMaterials.js
// 六族材料定義 + 材料升級鏈

export const RARITY_CONFIG = {
  common:    { label:"普通",   color:"#9ca3af", weight:60 },
  uncommon:  { label:"非凡",   color:"#4ade80", weight:28 },
  rare:      { label:"稀有",   color:"#60a5fa", weight:9  },
  epic:      { label:"史詩",   color:"#a78bfa", weight:2.5 },
  legendary: { label:"傳說",   color:"#fbbf24", weight:0.5 },
};

// ── 六族材料（每族6種，形成升級鏈）─────────────────────
export const MATERIALS = [

  // ════ 鬼怪族材料鏈 ════
  // 好兄弟→魔神仔→林投姐→城隍爺→十八王公→地獄閻羅
  { id:"ghost_m1", name:"路邊供品",   icon:"🍌", family:"ghost", tier:"common",    rarity:"common",    desc:"好兄弟最愛的供品，隨便撿的。",         upgradesTo:"ghost_m2", upgradeCount:5 },
  { id:"ghost_m2", name:"魔神仔迷霧", icon:"🌀", family:"ghost", tier:"rare",      rarity:"uncommon",  desc:"讓人迷路的靈氣，濃縮成一團。",         upgradesTo:"ghost_m3", upgradeCount:5 },
  { id:"ghost_m3", name:"林投葉",     icon:"🌿", family:"ghost", tier:"elite",     rarity:"rare",      desc:"林投姐親自摘下的樹葉，仍帶著怨氣。",   upgradesTo:"ghost_m4", upgradeCount:5 },
  { id:"ghost_m4", name:"生死簿碎頁", icon:"📖", family:"ghost", tier:"fierce",    rarity:"epic",      desc:"城隍爺的生死簿，記載著無數命運。",     upgradesTo:"ghost_m5", upgradeCount:5 },
  { id:"ghost_m5", name:"義犬魂魄",   icon:"🐺", family:"ghost", tier:"boss",      rarity:"legendary", desc:"十八王公義犬凝聚的靈魂，充滿忠義之氣。", upgradesTo:"ghost_m6", upgradeCount:5 },
  { id:"ghost_m6", name:"閻羅令牌",   icon:"⚖️", family:"ghost", tier:"mythic",    rarity:"legendary", desc:"地獄閻羅的最高權杖，掌管生死輪迴。",   upgradesTo:null,       upgradeCount:0 },

  // ════ 山林族材料鏈 ════
  { id:"mountain_m1", name:"山豬獠牙",   icon:"🐗", family:"mountain", tier:"common",    rarity:"common",    desc:"山豬的獠牙，堅硬無比。",               upgradesTo:"mountain_m2", upgradeCount:5 },
  { id:"mountain_m2", name:"百步蛇毒囊", icon:"🐍", family:"mountain", tier:"rare",      rarity:"uncommon",  desc:"劇毒濃縮，一滴可讓人昏迷三天。",       upgradesTo:"mountain_m3", upgradeCount:5 },
  { id:"mountain_m3", name:"山魈幻影石", icon:"🦊", family:"mountain", tier:"elite",     rarity:"rare",      desc:"山魈幻化的殘留靈石，帶著迷幻光芒。",   upgradesTo:"mountain_m4", upgradeCount:5 },
  { id:"mountain_m4", name:"霧社巨石",   icon:"🗿", family:"mountain", tier:"fierce",    rarity:"epic",      desc:"巨人踩過的山石，蘊含大地之力。",       upgradesTo:"mountain_m5", upgradeCount:5 },
  { id:"mountain_m5", name:"巨熊利爪",   icon:"🐻", family:"mountain", tier:"boss",      rarity:"legendary", desc:"食人巨熊的利爪，一掌能劈裂百年巨木。",     upgradesTo:"mountain_m6", upgradeCount:5 },
  { id:"mountain_m6", name:"惡蛟逆鱗",   icon:"🐲", family:"mountain", tier:"mythic",    rarity:"legendary", desc:"深山惡蛟的逆鱗，蘊含呼風喚雨的水之神力。", upgradesTo:null,          upgradeCount:0 },

  // ════ 毒蟲族材料鏈 ════
  { id:"insect_m1", name:"蟑螂觸角",   icon:"🪳", family:"insect", tier:"common",    rarity:"common",    desc:"蟑螂的觸角，感知能力超強。",             upgradesTo:"insect_m2", upgradeCount:5 },
  { id:"insect_m2", name:"虎頭蜂刺",   icon:"🐝", family:"insect", tier:"rare",      rarity:"uncommon",  desc:"劇毒蜂刺，碰到就腫成豬頭。",             upgradesTo:"insect_m3", upgradeCount:5 },
  { id:"insect_m3", name:"蜈蚣百腳",   icon:"🐛", family:"insect", tier:"elite",     rarity:"rare",      desc:"蜈蚣精的一隻腳，還在微微蠕動。",         upgradesTo:"insect_m4", upgradeCount:5 },
  { id:"insect_m4", name:"蠍王毒刺",   icon:"🦂", family:"insect", tier:"fierce",    rarity:"epic",      desc:"蠍子王的尾刺，毒性可融化鋼鐵。",         upgradesTo:"insect_m5", upgradeCount:5 },
  { id:"insect_m5", name:"蛛后毒腺",   icon:"🕷️", family:"insect", tier:"boss",      rarity:"legendary", desc:"蜘蛛女王的毒腺，能操縱命運之線。",       upgradesTo:"insect_m6", upgradeCount:5 },
  { id:"insect_m6", name:"蟲神核心",   icon:"🦋", family:"insect", tier:"mythic",    rarity:"legendary", desc:"蟲神的神力結晶，萬蟲朝聖的聖物。",       upgradesTo:null,        upgradeCount:0 },

  // ════ 職場族材料鏈 ════
  { id:"workplace_m1", name:"投訴書",     icon:"📝", family:"workplace", tier:"common",    rarity:"common",    desc:"奧客手寫的無理投訴，密密麻麻。",         upgradesTo:"workplace_m2", upgradeCount:5 },
  { id:"workplace_m2", name:"PUA語錄",    icon:"🗣️", family:"workplace", tier:"rare",      rarity:"uncommon",  desc:"爛主管的洗腦名言，讓人懷疑自己的那種。", upgradesTo:"workplace_m3", upgradeCount:5 },
  { id:"workplace_m3", name:"空頭支票",   icon:"💸", family:"workplace", tier:"elite",     rarity:"rare",      desc:"壞老闆的承諾書，從來不會兌現。",         upgradesTo:"workplace_m4", upgradeCount:5 },
  { id:"workplace_m4", name:"漲租通知",   icon:"📬", family:"workplace", tier:"fierce",    rarity:"epic",      desc:"包租婆每月必發，讓人絕望的信封。",       upgradesTo:"workplace_m5", upgradeCount:5 },
  { id:"workplace_m5", name:"財閥印章",   icon:"🤵", family:"workplace", tier:"boss",      rarity:"legendary", desc:"財閥總裁的私印，蓋下去就是命令。",       upgradesTo:"workplace_m6", upgradeCount:5 },
  { id:"workplace_m6", name:"資本核心",   icon:"💰", family:"workplace", tier:"mythic",    rarity:"legendary", desc:"資本主義的本質結晶，壓榨一切的來源。",   upgradesTo:null,           upgradeCount:0 },

  // ════ 考試族材料鏈 ════
  { id:"exam_m1", name:"小考卷",     icon:"📝", family:"exam", tier:"common",    rarity:"common",    desc:"滿江紅的小考卷，每個紅叉都是心痛。",     upgradesTo:"exam_m2", upgradeCount:5 },
  { id:"exam_m2", name:"段考筆記",   icon:"📚", family:"exam", tier:"rare",      rarity:"uncommon",  desc:"熬夜寫的段考筆記，字越到後面越潦草。",   upgradesTo:"exam_m3", upgradeCount:5 },
  { id:"exam_m3", name:"崩潰眼淚",   icon:"😱", family:"exam", tier:"elite",     rarity:"rare",      desc:"期末考前崩潰的眼淚，已凝固成結晶。",     upgradesTo:"exam_m4", upgradeCount:5 },
  { id:"exam_m4", name:"學測准考證", icon:"🎯", family:"exam", tier:"fierce",    rarity:"epic",      desc:"那一年的准考證，帶著無數人的夢想。",     upgradesTo:"exam_m5", upgradeCount:5 },
  { id:"exam_m5", name:"國考教材",   icon:"📜", family:"exam", tier:"boss",      rarity:"legendary", desc:"考了五年的國考教材，書頁都翻爛了。",     upgradesTo:"exam_m6", upgradeCount:5 },
  { id:"exam_m6", name:"制度本質",   icon:"🏫", family:"exam", tier:"mythic",    rarity:"legendary", desc:"升學制度的核心，無法改變的存在。",       upgradesTo:null,      upgradeCount:0 },

  // ════ 西方怪物族材料鏈 ════
  // 哥布林→骷髏劍士→狼人→吸血鬼伯爵→巫妖王→末日惡龍
  { id:"temple_m1", name:"哥布林金牙", icon:"🦷", family:"temple", tier:"common",    rarity:"common",    desc:"哥布林最寶貝的金牙，打死也不肯交出來。",       upgradesTo:"temple_m2", upgradeCount:5 },
  { id:"temple_m2", name:"碎骨片",     icon:"🦴", family:"temple", tier:"rare",      rarity:"uncommon",  desc:"骷髏劍士崩落的碎骨，夜裡還會隱隱發光。",       upgradesTo:"temple_m3", upgradeCount:5 },
  { id:"temple_m3", name:"狼人之爪",   icon:"🐾", family:"temple", tier:"elite",     rarity:"rare",      desc:"月圓之夜留下的利爪，鋒利得能劃開鐵甲。",       upgradesTo:"temple_m4", upgradeCount:5 },
  { id:"temple_m4", name:"吸血鬼獠牙", icon:"🩸", family:"temple", tier:"fierce",    rarity:"epic",      desc:"吸血鬼伯爵的獠牙，據說藏著不老的秘密。",       upgradesTo:"temple_m5", upgradeCount:5 },
  { id:"temple_m5", name:"巫妖魔法書", icon:"📕", family:"temple", tier:"boss",      rarity:"legendary", desc:"記載禁忌法術的魔法書，翻開就能聽見低語。",     upgradesTo:"temple_m6", upgradeCount:5 },
  { id:"temple_m6", name:"惡龍逆鱗",   icon:"🐉", family:"temple", tier:"mythic",    rarity:"legendary", desc:"末日惡龍喉下的逆鱗，蘊含毀天滅地的龍之力。",   upgradesTo:null,        upgradeCount:0 },

  // ════ 章碎片（所有怪物均可掉落）════
  { id:"frag_fatcat_bronze",  name:"肥貓銅章碎片", icon:"🐱", family:"all", tier:"all", rarity:"uncommon", desc:"集齊可以合成肥貓銅章。", upgradesTo:null, upgradeCount:0 },
  { id:"frag_score_bronze",   name:"積分銅章碎片", icon:"⭐", family:"all", tier:"all", rarity:"uncommon", desc:"集齊可以合成積分銅章。", upgradesTo:null, upgradeCount:0 },
  { id:"frag_achieve_silver", name:"成就銀章碎片", icon:"🏆", family:"all", tier:"all", rarity:"rare",     desc:"集齊可以合成成就銀章。", upgradesTo:null, upgradeCount:0 },
];

// ── 依怪物取材料池 ────────────────────────────────────────
export function getMaterialPool(monsterId, tier) {
  const monster = monsterId ? { family: monsterId.split("_")[0] } : null;
  const family  = monster?.family;

  // 家族專屬材料 + 全體章碎片
  const familyMats = family
    ? MATERIALS.filter(m => m.family === family)
    : [];
  const allMats = MATERIALS.filter(m => m.family === "all");

  // 依怪物階級決定可出現的材料等級
  const tierMap = {
    common:  ["common"],
    rare:    ["common","rare"],
    elite:   ["common","rare","uncommon"],
    fierce:  ["uncommon","rare","epic"],
    boss:    ["rare","epic","legendary"],
    mythic:  ["epic","legendary"],
  };
  const allowedRarities = tierMap[tier] || ["common"];

  const pool = [...familyMats, ...allMats].filter(m =>
    allowedRarities.includes(m.rarity)
  );

  return pool.length > 0 ? pool : allMats;
}

// ── 隨機抽材料（依稀有度加權）────────────────────────────
export function drawMaterial(monsterId, tier) {
  const pool = getMaterialPool(monsterId, tier);
  const tierMult = { common:0.8, rare:1.0, elite:1.2, fierce:1.5, boss:2.0, mythic:3.0 }[tier] || 1.0;

  const weighted = pool.map(m => ({
    ...m,
    w: (RARITY_CONFIG[m.rarity]?.weight || 30) / (m.rarity==="common" ? 1 : Math.sqrt(tierMult)),
  }));
  const total = weighted.reduce((s,m) => s+m.w, 0);
  let r = Math.random() * total;
  for (const m of weighted) { r -= m.w; if (r <= 0) return m; }
  return weighted[0];
}

// ── 依怪物階級決定掉落材料數量 ───────────────────────────
export function getMaterialDropCount(tier) {
  const map = { common:1, rare:1, elite:2, fierce:2, boss:3, mythic:4 };
  return map[tier] || 1;
}