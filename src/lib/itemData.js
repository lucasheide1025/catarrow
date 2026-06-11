// src/lib/itemData.js
// 寶箱系統 + 藥劑系統 + 碎片定義
// v3：8種藥劑（含投擲型）、貓貓箱、章碎片合成系統、MAX_POTIONS=3

import { drawMaterial, MATERIALS } from "./monsterMaterials";

// ── 寶箱類型 ─────────────────────────────────────────────
export const CHEST_TYPES = {
  wood:   { id:"wood",   name:"木寶箱",   icon:"📦", color:"#a16207", potionChance:0.10,
            desc:"普通木箱：普通材料 ×1，10% 掉藥水。" },
  iron:   { id:"iron",   name:"鐵寶箱",   icon:"🧰", color:"#64748b", potionChance:0.15,
            desc:"鐵製箱：普通+非凡材料各 1~2 個，15% 掉藥水。" },
  gold:   { id:"gold",   name:"黃金寶箱", icon:"🎁", color:"#f59e0b", potionChance:0.20,
            desc:"黃金箱：前三階段材料各 1~3 個，20% 掉藥水。" },
  epic:   { id:"epic",   name:"史詩寶箱", icon:"💜", color:"#a78bfa", potionChance:0.25,
            desc:"史詩箱：前四階段材料各 1~4 個，25% 掉藥水。" },
  mythic: { id:"mythic", name:"神話寶箱", icon:"🔮", color:"#a855f7", potionChance:0.35,
            desc:"神話箱：全五階段材料各 1~5 個，35% 掉藥水。" },
  cat:    { id:"cat",    name:"貓貓箱",   icon:"🐱", color:"#ec4899", potionChance:0,
            desc:"神秘的貓貓箱！90% 機率隨機掉落一種章碎片×1，集10片可合成對應章！" },
  potion: { id:"potion", name:"藥水箱",   icon:"🧪", color:"#06b6d4", potionChance:1,
            desc:"專屬藥水箱！必定開出一瓶藥水，機率依實用度調整。" },
};

// 怪物階級 → 寶箱種類機率
const CHEST_ROLL = {
  common: [["wood",   1.0]],
  rare:   [["wood",   0.7], ["iron",   0.3]],
  elite:  [["iron",   0.8], ["gold",   0.2]],
  fierce: [["iron",   0.4], ["gold",   0.6]],
  boss:   [["gold",   0.6], ["epic",   0.4]],
  mythic: [["epic",   0.6], ["mythic", 0.4]],
};

// 學生模式：同樣可掉較高級寶箱，但機率往低階偏移
const CHEST_ROLL_STUDENT = {
  common: [["wood",   1.0]],
  rare:   [["wood",   0.85], ["iron",  0.15]],
  elite:  [["iron",   0.85], ["gold",  0.15]],
  fierce: [["iron",   0.55], ["gold",  0.45]],
  boss:   [["gold",   0.70], ["epic",  0.30]],
  mythic: [["epic",   0.70], ["mythic",0.30]],
};

// 貓貓箱額外掉落機率（依怪物階級）
const CAT_CHEST_CHANCE = {
  common: 0.01, rare: 0.015, elite: 0.02, fierce: 0.03, boss: 0.04, mythic: 0.05,
};

// 藥水箱額外掉落機率（依怪物階級）
const POTION_CHEST_CHANCE = {
  common: 0.02, rare: 0.04, elite: 0.06, fierce: 0.08, boss: 0.12, mythic: 0.18,
};

export function rollChestType(tier, mode) {
  const table = (mode === "student" ? CHEST_ROLL_STUDENT : CHEST_ROLL)[tier]
    || CHEST_ROLL.common;
  let r = Math.random();
  for (const [type, p] of table) { r -= p; if (r <= 0) return type; }
  return table[table.length - 1][0];
}

// 產生寶箱（打贏怪物時呼叫）
// 回傳 { mainChest, catChest|null, potionChest|null }
export function makeChests(monster, mode) {
  const type = rollChestType(monster.tier, mode);
  const mainChest = {
    id:   `chest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type, family: monster.family, tier: monster.tier, from: monster.name, ts: Date.now(),
  };
  // 學生模式：貓貓箱和藥水箱機率各降低 40%
  const modeMult = mode === "student" ? 0.6 : 1;
  const catChance = (CAT_CHEST_CHANCE[monster.tier] || 0.01) * modeMult;
  const catChest = Math.random() < catChance ? {
    id:   `chest_cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: "cat", family: monster.family, tier: monster.tier, from: monster.name, ts: Date.now() + 1,
  } : null;
  const potionChance = (POTION_CHEST_CHANCE[monster.tier] || 0.02) * modeMult;
  const potionChest = Math.random() < potionChance ? {
    id:   `chest_potion_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: "potion", family: monster.family, tier: monster.tier, from: monster.name, ts: Date.now() + 2,
  } : null;
  return { mainChest, catChest, potionChest };
}

// 向下相容舊呼叫（MonsterBattle 會逐步改用 makeChests）
export function makeChest(monster) { return makeChests(monster).mainChest; }

// ── 章碎片定義 ────────────────────────────────────────────
// 10 個碎片 → 合成對應章
export const FRAGMENTS = [
  {
    id: "frag_fatcat_bronze",
    name: "肥貓銅章碎片",
    icon: "🐱",
    color: "#ec4899",
    desc: "集滿 10 個可合成肥貓銅章！",
    craftCount: 10,
    craftResult: { type: "fatcat_bronze", badgeField: "fatCat", badgeLevel: "bronze", label: "肥貓銅章" },
  },
  {
    id: "frag_score_bronze",
    name: "積分銅章碎片",
    icon: "⭐",
    color: "#f59e0b",
    desc: "集滿 10 個可合成積分銅章！",
    craftCount: 10,
    craftResult: { type: "score_bronze", badgeField: "score", badgeLevel: "bronze", label: "積分銅章" },
  },
  {
    id: "frag_achieve_silver",
    name: "成就銀章碎片",
    icon: "🏆",
    color: "#8b5cf6",
    desc: "集滿 10 個可合成成就銀章！",
    craftCount: 10,
    craftResult: { type: "achieve_silver", badgeField: "achievement", badgeLevel: "silver", label: "成就銀章" },
  },
];

export function getFragment(id) { return FRAGMENTS.find(f => f.id === id) || null; }

// ── 藥劑定義（8種）────────────────────────────────────────
// effect 欄位：
//   被動（戰鬥開始生效）: hpPct / atkPct / monAtkPct / monDefPct / critBonus / scorePlus
//   主動投擲（立即扣血）: throwDmg（固定傷害）+ monAtkPct 或 skipRound
//     throwDmg: 直接對怪扣血（不計回合）
//     skipRound: "small"(跳過下一次反擊) / "big"(跳過整個大回合反擊)
//     scorePlus: 每箭+N分（10→X→雙倍必出）
//     critBonus: 爆擊率+N（0~1）
export const POTIONS = [
  // ─ 被動：回血 ──────────────────────────────────────────
  {
    id:"heal_s", name:"小型生命藥水", icon:"🧪", rarity:"common",
    kind: "passive",
    effect:{ hpPct:15 }, effectText:"本場最大HP +15%",
    desc:"教練特調的草藥水，喝了渾身是勁。",
    recipe:[ { id:"ghost_m1", count:3 }, { id:"mountain_m1", count:2 } ],
    dropFrom: ["wood","iron"],
  },
  {
    id:"heal_l", name:"大型生命藥水", icon:"❤️‍🩹", rarity:"rare",
    kind: "passive",
    effect:{ hpPct:30 }, effectText:"本場最大HP +30%",
    desc:"濃縮版生命藥水，連百步蛇毒都拿來入藥。",
    recipe:[ { id:"ghost_m2", count:3 }, { id:"mountain_m2", count:2 } ],
    dropFrom: ["iron","gold","epic","mythic"],
  },
  // ─ 被動：ATK ───────────────────────────────────────────
  {
    id:"atk_s", name:"力量藥水", icon:"💪", rarity:"common",
    kind: "passive",
    effect:{ atkPct:15 }, effectText:"本場ATK +15%",
    desc:"喝下去手臂發燙，拉弓特別有力。",
    recipe:[ { id:"insect_m1", count:3 }, { id:"temple_m1", count:2 } ],
    dropFrom: ["wood","iron"],
  },
  {
    id:"atk_l", name:"狂暴藥水", icon:"🔥", rarity:"rare",
    kind: "passive",
    effect:{ atkPct:30 }, effectText:"本場ATK +30%",
    desc:"蜂毒與碎骨熬製，喝完眼睛都紅了。",
    recipe:[ { id:"insect_m2", count:3 }, { id:"temple_m2", count:2 } ],
    dropFrom: ["iron","gold","epic","mythic"],
  },
  // ─ 被動：爆擊率 ────────────────────────────────────────
  {
    id:"crit_brew", name:"爆擊靈藥", icon:"💥", rarity:"rare",
    kind: "passive",
    effect:{ critBonus:0.20 }, effectText:"本場爆擊率 +20%",
    desc:"山魈的幻影石磨粉，瞄準時感覺時間變慢了。",
    recipe:[ { id:"mountain_m3", count:2 }, { id:"exam_m2", count:2 } ],
    dropFrom: ["gold","epic","mythic"],
  },
  // ─ 被動：分數加成 ───────────────────────────────────────
  {
    id:"score_up", name:"穿心藥水", icon:"🎯", rarity:"epic",
    kind: "passive",
    effect:{ scorePlus:1 }, effectText:"本場每箭 +1分（10→X→雙倍必出）",
    desc:"淬煉自學測准考證的絕望，化壓力為精準。",
    recipe:[ { id:"exam_m4", count:2 }, { id:"ghost_m3", count:2 } ],
    dropFrom: ["epic","mythic"],
  },
  // ─ 主動投擲：毒藥 ──────────────────────────────────────
  {
    id:"poison_throw", name:"投擲毒藥", icon:"🌑", rarity:"rare",
    kind: "throw",
    effect:{ monAtkPct:30 }, effectText:"敵方ATK −30%",
    desc:"戰鬥前擲向怪物，毒素讓牠ATK大幅下降。",
    recipe:[ { id:"workplace_m2", count:2 }, { id:"insect_m1", count:3 } ],
    dropFrom: ["gold","epic","mythic"],
  },
  // ─ 主動投擲：麻痺 ──────────────────────────────────────
  {
    id:"paralyze_throw", name:"麻痺毒素", icon:"🕸️", rarity:"epic",
    kind: "throw",
    effect:{ throwDmg:15, skipRound:"big" }, effectText:"直接對怪扣15血 + 跳過本輪整個大回合反擊",
    desc:"蜘蛛絲提煉，命中後怪物全身僵硬一整回合。",
    recipe:[ { id:"insect_m5", count:1 }, { id:"workplace_m3", count:2 } ],
    dropFrom: ["mythic"],
  },
  // ─ 被動：雙效 ──────────────────────────────────────────
  {
    id:"holy_water", name:"神聖水", icon:"✨", rarity:"legendary",
    kind: "passive",
    effect:{ atkPct:15, monDefPct:25 }, effectText:"本場ATK +15% + 敵方DEF −25%",
    desc:"廟會族的神力結晶，攻守俱備的傳說藥水。",
    recipe:[ { id:"temple_m6", count:1 }, { id:"ghost_m5", count:1 } ],
    dropFrom: ["mythic"],
  },
];

export function getPotion(id) { return POTIONS.find(p => p.id === id) || null; }

// 每場戰鬥最多帶幾瓶藥
export const MAX_POTIONS_PER_BATTLE = 3;

// 各寶箱可掉的藥劑池（依 dropFrom 欄位自動建立）
const CHEST_POTION_POOL = {};
for (const type of ["wood","iron","gold","epic","mythic"]) {
  CHEST_POTION_POOL[type] = POTIONS.filter(p => (p.dropFrom||[]).includes(type)).map(p => p.id);
}

// ── 材料分層開箱設定 ─────────────────────────────────────
// RARITY_ORDER[0]=tier1(普通) … [4]=tier5(傳說)
const RARITY_ORDER = ["common","uncommon","rare","epic","legendary"];

// 每種寶箱開出的材料層數 + 每層最多幾個
const CHEST_TIER_CFG = {
  wood:   { tierCount:1, maxPerTier:1 },
  iron:   { tierCount:2, maxPerTier:2 },
  gold:   { tierCount:3, maxPerTier:3 },
  epic:   { tierCount:4, maxPerTier:4 },
  mythic: { tierCount:5, maxPerTier:5 },
};

// 藥水箱抽表（權重越高越容易出現）
const POTION_CHEST_TABLE = [
  { id:"heal_s",         weight:20 },
  { id:"atk_s",          weight:20 },
  { id:"heal_l",         weight:15 },
  { id:"atk_l",          weight:15 },
  { id:"poison_throw",   weight:10 },
  { id:"crit_brew",      weight:8  },
  { id:"score_up",       weight:6  },
  { id:"paralyze_throw", weight:4  },
  { id:"holy_water",     weight:2  },
];

const ALL_FAMILIES = ["ghost","mountain","insect","workplace","exam","temple"];

// ── 開箱：抽出寶箱內容 ───────────────────────────────────
// 回傳 { materials:[材料物件], potions:[藥劑物件], fragments:[碎片物件] }
export function openChestContents(chest) {
  // 貓貓箱：90% 隨機一種碎片×1，10% 空
  if (chest.type === "cat") {
    if (Math.random() < 0.90) {
      const frag = FRAGMENTS[Math.floor(Math.random() * FRAGMENTS.length)];
      return { materials: [], potions: [], fragments: [frag] };
    }
    return { materials: [], potions: [], fragments: [] };
  }

  // 藥水箱：必定開出一瓶，按 POTION_CHEST_TABLE 權重抽取
  if (chest.type === "potion") {
    const total = POTION_CHEST_TABLE.reduce((s,p) => s+p.weight, 0);
    let r = Math.random() * total;
    let potionId = POTION_CHEST_TABLE[0].id;
    for (const entry of POTION_CHEST_TABLE) { r -= entry.weight; if (r <= 0) { potionId = entry.id; break; } }
    const potion = getPotion(potionId);
    return { materials: [], potions: potion ? [potion] : [], fragments: [] };
  }

  // 普通寶箱（wood / iron / gold / epic / mythic）
  const tierCfg = CHEST_TIER_CFG[chest.type];
  if (!tierCfg) return { materials: [], potions: [], fragments: [] };

  // 決定材料族：優先用寶箱附帶的 family，否則隨機選一族
  const family = ALL_FAMILIES.includes(chest.family)
    ? chest.family
    : ALL_FAMILIES[Math.floor(Math.random() * ALL_FAMILIES.length)];

  // 按稀有度分層抽材料：每層隨機 1~maxPerTier 個
  const materials = [];
  for (let t = 0; t < tierCfg.tierCount; t++) {
    const rarity = RARITY_ORDER[t];
    const pool = MATERIALS.filter(m => m.family === family && m.rarity === rarity);
    if (!pool.length) continue;
    const mat   = pool[Math.floor(Math.random() * pool.length)];
    const count = Math.floor(Math.random() * tierCfg.maxPerTier) + 1;
    for (let i = 0; i < count; i++) materials.push(mat);
  }

  // 藥水機率
  const potions = [];
  const potionChance = CHEST_TYPES[chest.type]?.potionChance || 0;
  if (Math.random() < potionChance) {
    const pool = CHEST_POTION_POOL[chest.type] || [];
    if (pool.length) {
      const pid = pool[Math.floor(Math.random() * pool.length)];
      const potion = getPotion(pid);
      if (potion) potions.push(potion);
    }
  }

  return { materials, potions, fragments: [] };
}

// ── 計算戰鬥加成（戰鬥開始時呼叫）────────────────────────
// 回傳 { hpMult, atkMult, monAtkMult, monDefMult,
//        critBonus, scorePlus, throwEffects:[{dmg,monAtkMult,skipRound}],
//        used:[藥劑物件] }
export function calcPotionBuffs(potionIds) {
  const buffs = {
    hpMult: 1, atkMult: 1, monAtkMult: 1, monDefMult: 1,
    critBonus: 0, scorePlus: 0,
    throwEffects: [],   // 投擲型藥劑效果（開戰前立即生效）
    skipRound: null,    // "small" | "big" | null
    used: [],
  };
  (potionIds || []).forEach(pid => {
    const p = getPotion(pid);
    if (!p) return;
    const e = p.effect || {};
    if (p.kind === "throw") {
      // 投擲型：記錄投擲效果，在 startBattle 裡直接對怪扣血
      buffs.throwEffects.push({
        name: p.name, icon: p.icon, effectText: p.effectText,
        dmg:        e.throwDmg   || 0,
        monAtkMult: e.monAtkPct  ? (1 - e.monAtkPct / 100) : 1,
        skipRound:  e.skipRound  || null,
      });
      if (e.monAtkPct)  buffs.monAtkMult = Math.max(0.1, buffs.monAtkMult - e.monAtkPct / 100);
      if (e.skipRound)  buffs.skipRound  = e.skipRound;
    } else {
      if (e.hpPct)     buffs.hpMult     += e.hpPct / 100;
      if (e.atkPct)    buffs.atkMult    += e.atkPct / 100;
      if (e.monAtkPct) buffs.monAtkMult  = Math.max(0.1, buffs.monAtkMult - e.monAtkPct / 100);
      if (e.monDefPct) buffs.monDefMult  = Math.max(0.1, buffs.monDefMult - e.monDefPct / 100);
      if (e.critBonus) buffs.critBonus  += e.critBonus;
      if (e.scorePlus) buffs.scorePlus  += e.scorePlus;
    }
    buffs.used.push(p);
  });
  buffs.monAtkMult = Math.max(0.1, buffs.monAtkMult);
  buffs.monDefMult = Math.max(0.1, buffs.monDefMult);
  return buffs;
}