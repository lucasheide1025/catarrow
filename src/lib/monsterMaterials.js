// src/lib/monsterMaterials.js
// 六族材料定義 + 材料升級鏈

// ── 稀有度定義 ────────────────────────────────────────────
export const RARITY_CONFIG = {
  common:    { label:"普通",   color:"#6b7280", weight:60 },
  uncommon:  { label:"非凡",   color:"#22c55e", weight:28 },
  rare:      { label:"稀有",   color:"#3b82f6", weight:10 },
  epic:      { label:"史詩",   color:"#8b5cf6", weight:4  },
  legendary: { label:"傳說",   color:"#f59e0b", weight:1  },
};

// ── 六族材料（每族 5 個升級鏈 + 1 個頂級）────────────────
export const MATERIALS = [

  // ══ 鬼怪族材料鏈 ══
  { id:"ghost_hair",    name:"鬼魅髮絲",   icon:"🖤", family:"ghost",     rarity:"common",    desc:"飄散著陰氣，觸碰會發冷" },
  { id:"ghost_tear",    name:"冤魂淚水",   icon:"💧", family:"ghost",     rarity:"uncommon",  desc:"凝固的怨念，散發藍光" },
  { id:"ghost_chain",   name:"閻羅鎖鏈",   icon:"⛓️", family:"ghost",     rarity:"rare",      desc:"用來束縛惡鬼的神鏈碎片" },
  { id:"ghost_crown",   name:"城隍令牌",   icon:"🪬", family:"ghost",     rarity:"epic",      desc:"陰間司法官的權威象徵" },
  { id:"ghost_seal",    name:"地獄封印",   icon:"🔮", family:"ghost",     rarity:"legendary", desc:"閻羅王親手刻下的封印" },

  // ══ 山林族材料鏈 ══
  { id:"mtn_fang",      name:"山豬獠牙",   icon:"🦷", family:"mountain",  rarity:"common",    desc:"咬合力驚人，適合做裝飾" },
  { id:"mtn_scale",     name:"百步蛇鱗",   icon:"🐍", family:"mountain",  rarity:"uncommon",  desc:"劇毒蛇鱗，光澤如玉" },
  { id:"mtn_claw",      name:"山魈利爪",   icon:"🦴", family:"mountain",  rarity:"rare",      desc:"劃過山石如切豆腐" },
  { id:"mtn_stone",     name:"靈山玉石",   icon:"💎", family:"mountain",  rarity:"epic",      desc:"玉山頂峰的千年靈石" },
  { id:"mtn_dragoncore",name:"龍神龍核",   icon:"🫀", family:"mountain",  rarity:"legendary", desc:"台灣龍神的心臟碎片，蘊含大地之力" },

  // ══ 毒蟲族材料鏈 ══
  { id:"poison_gland",  name:"毒囊碎片",   icon:"🟢", family:"poison",    rarity:"common",    desc:"裡面還有毒液，小心別碰" },
  { id:"poison_sting",  name:"蜂王毒刺",   icon:"⚔️", family:"poison",    rarity:"uncommon",  desc:"虎頭蜂王的毒刺，劇毒無比" },
  { id:"poison_fang",   name:"蜈蚣毒牙",   icon:"🦷", family:"poison",    rarity:"rare",      desc:"腐蝕性毒液的來源" },
  { id:"poison_web",    name:"蛛后絲線",   icon:"🕸️", family:"poison",    rarity:"epic",      desc:"比鋼鐵更強韌的蜘蛛絲" },
  { id:"poison_core",   name:"蟲神之核",   icon:"✨", family:"poison",    rarity:"legendary", desc:"萬蟲之源，蘊含毒族的終極力量" },

  // ══ 職場族材料鏈 ══
  { id:"work_complaint", name:"奧客投訴書", icon:"📝", family:"workplace", rarity:"common",    desc:"密密麻麻的無理要求，令人頭痛" },
  { id:"work_kpi",       name:"假KPI報告", icon:"📊", family:"workplace", rarity:"uncommon",  desc:"全是假數字，但裝訂精美" },
  { id:"work_contract",  name:"霸王契約",  icon:"📜", family:"workplace", rarity:"rare",      desc:"不平等條款寫滿整張紙" },
  { id:"work_stocks",    name:"財閥股票",  icon:"📈", family:"workplace", rarity:"epic",      desc:"操控市場的秘密武器" },
  { id:"work_crown",     name:"資本王冠",  icon:"👑", family:"workplace", rarity:"legendary", desc:"資本主義魔王的權力象徵" },

  // ══ 考試族材料鏈 ══
  { id:"exam_paper",    name:"考卷碎片",   icon:"📄", family:"exam",      rarity:"common",    desc:"滿江紅，每個字都是眼淚" },
  { id:"exam_pencil",   name:"用力到斷的鉛筆", icon:"✏️", family:"exam", rarity:"uncommon",  desc:"考試壓力的實體化產物" },
  { id:"exam_score",    name:"滿級分碎片", icon:"💯", family:"exam",      rarity:"rare",      desc:"傳說中的成績，破碎成了碎片" },
  { id:"exam_permit",   name:"國考准考證", icon:"🎫", family:"exam",      rarity:"epic",      desc:"考了十年的紙，已經泛黃" },
  { id:"exam_essence",  name:"制度之魂",   icon:"🏛️", family:"exam",      rarity:"legendary", desc:"升學制度本體的核心，蘊含億萬學子的淚水" },

  // ══ 廟會族材料鏈 ══
  { id:"temple_incense",name:"神明香灰",   icon:"🌸", family:"temple",    rarity:"common",    desc:"百年老廟的香灰，帶有靈氣" },
  { id:"temple_token",  name:"虎爺錢幣",   icon:"🪙", family:"temple",    rarity:"uncommon",  desc:"虎爺咬過的金幣，據說帶財" },
  { id:"temple_eye",    name:"千里眼珠",   icon:"👁️", family:"temple",    rarity:"rare",      desc:"摘下來的神眼，仍然閃閃發光" },
  { id:"temple_drum",   name:"廟會神鼓",   icon:"🥁", family:"temple",    rarity:"epic",      desc:"八家將出陣時的戰鼓碎片" },
  { id:"temple_blessing",name:"媽祖神力",  icon:"🌊", family:"temple",    rarity:"legendary", desc:"媽祖護法留下的神聖之力，守護台灣海峽千年" },

  // ══ 通用材料（所有怪物均可掉）══
  { id:"frag_fatcat",   name:"肥貓章碎片", icon:"🐱", family:"all",       rarity:"uncommon",  desc:"集齊可以合成肥貓章" },
  { id:"frag_score",    name:"積分章碎片", icon:"⭐", family:"all",       rarity:"uncommon",  desc:"集齊可以合成積分章" },
  { id:"frag_achieve",  name:"成就章碎片", icon:"🏆", family:"all",       rarity:"rare",      desc:"集齊可以合成成就章" },
];

// ── 材料升級鏈（5個低階→1個高階）────────────────────────
export const UPGRADE_CHAINS = {
  ghost:     ["ghost_hair","ghost_tear","ghost_chain","ghost_crown","ghost_seal"],
  mountain:  ["mtn_fang","mtn_scale","mtn_claw","mtn_stone","mtn_dragoncore"],
  poison:    ["poison_gland","poison_sting","poison_fang","poison_web","poison_core"],
  workplace: ["work_complaint","work_kpi","work_contract","work_stocks","work_crown"],
  exam:      ["exam_paper","exam_pencil","exam_score","exam_permit","exam_essence"],
  temple:    ["temple_incense","temple_token","temple_eye","temple_drum","temple_blessing"],
};

// ── 依怪物族群取材料池 ────────────────────────────────────
export function getMaterialPool(monster) {
  const family = monster?.family || "all";
  const familyMats = MATERIALS.filter(m => m.family === family);
  const allMats    = MATERIALS.filter(m => m.family === "all");
  return [...familyMats, ...allMats];
}

// ── 依階級決定掉落材料數 ─────────────────────────────────
export function getMaterialCount(tier) {
  const map = { common:1, rare:1, elite:2, tough:2, boss:3, myth:4 };
  return map[tier] || 1;
}

// ── 隨機抽取材料（依稀有度+階級加權）────────────────────
export function drawMaterial(monster) {
  const pool    = getMaterialPool(monster);
  const tier    = monster?.tier || "common";
  const tierMult = { common:0.7, rare:0.9, elite:1.1, tough:1.3, boss:1.6, myth:2.0 }[tier] || 1.0;

  const weighted = pool.map(m => ({
    ...m,
    w: (RARITY_CONFIG[m.rarity]?.weight || 30) * (m.rarity === "common" ? 1 : tierMult),
  }));
  const total = weighted.reduce((s, m) => s + m.w, 0);
  let r = Math.random() * total;
  for (const m of weighted) { r -= m.w; if (r <= 0) return m; }
  return weighted[0];
}

// ── 批次抽取材料 ─────────────────────────────────────────
export function drawMaterials(monster) {
  const count = getMaterialCount(monster?.tier || "common");
  return Array.from({ length: count }, () => drawMaterial(monster)).filter(Boolean);
}
