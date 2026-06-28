// src/lib/itemData.js
// 寶箱系統 + 藥劑系統（2026-06-28 改版）
// 藥水分兩大類：攜帶型(carry, 9種) / 投擲型(throw, 7種)

import { drawMaterial, MATERIALS } from "./monsterMaterials";
import { MONSTERS } from "./monsterData";

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
  potion:   { id:"potion",   name:"藥水箱",   icon:"🧪", color:"#06b6d4", potionChance:1,
              desc:"專屬藥水箱！必定開出一瓶藥水，機率依實用度調整。" },
  card_pack: { id:"card_pack", name:"圖片收集卡包", icon:"🃏", color:"#6366f1", potionChance:0,
               desc:"開啟獲得 3 張怪物卡片！36 種怪物都有機率，越稀有越難抽！" },
  cat_box:   { id:"cat_box",   name:"貓貓箱", icon:"🎐", color:"#ec4899", potionChance:0,
               desc:"神秘貓貓箱！90% 機率隨機掉落一種章碎片×1。" },
  mimi_box:  { id:"mimi_box",  name:"咪咪箱", icon:"😺", color:"#f43f5e", potionChance:0,
               desc:"神秘咪咪箱！開啟後隨機獲得一隻貓咪夥伴，已擁有全部時給羈絆經驗！" },
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
// 回傳 { mainChest, bonusChest|null, potionChest|null }
// 老手/賽事：bonusChest = 第二個主寶箱（已移除 catChest / 章碎片掉落）
export function makeChests(monster, mode) {
  const type = rollChestType(monster.tier, mode);
  const now  = Date.now();
  const mk   = (extra = 0) => ({
    id: `chest_${now + extra}_${Math.random().toString(36).slice(2, 8)}`,
    type, family: monster.family, tier: monster.tier, from: monster.name, ts: now + extra,
  });
  const mainChest  = mk(0);
  const bonusChest = (mode === "veteran" || mode === "match") ? mk(1) : null;
  const potMult    = (mode === "veteran" || mode === "match") ? 1.5 : mode === "novice" ? 0.5 : 1;
  const potionChance = (POTION_CHEST_CHANCE[monster.tier] || 0.02) * potMult;
  const potionChest = Math.random() < potionChance ? {
    id:   `chest_potion_${now + 2}_${Math.random().toString(36).slice(2, 8)}`,
    type: "potion", family: monster.family, tier: monster.tier, from: monster.name, ts: now + 2,
  } : null;
  return { mainChest, bonusChest, potionChest };
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

// ════════════════════════════════════════════════════════════
//  藥劑定義（2026-06-28 改版）
// ════════════════════════════════════════════════════════════
// 兩大類（全模式通用）：
//   carry  - 攜帶型：每回合可選一種喝，消耗一瓶，效果持續該回合
//   throw  - 投擲型：取代一箭，消耗一瓶，即時效果
//
// 效果欄位：
//   攜帶型: hpPct(回血%) / atkPct(ATK+%) / defPct(DEF+%)
//   投擲型: throwDmg(固定傷) / throwPct(比例傷 maxHP%) /
//           throwDmgMin+throwDmgMax(隨機傷) /
//           monAtkPct(降ATK%) / monDefPct(降DEF%) /
//           skipRound(禁反擊, "big")
// recipe 使用村莊資源（非怪物材料）
// ════════════════════════════════════════════════════════════

export const POTIONS = [
  // ══ 攜帶型：HP恢復（3 級）════════════════════════════════
  {
    id:"hp_5",   name:"HP恢復 Lv1", icon:"❤️",   rarity:"common",
    kind:"carry",
    effect:{ hpPct:5 },  effectText:"回復 5% HP",
    desc:"貓草熬製的基礎恢復藥水。",
    recipe:[ { id:"potion_t1", count:5 } ],
    gold:500,
  },
  {
    id:"hp_10",  name:"HP恢復 Lv2", icon:"❤️",   rarity:"uncommon",
    kind:"carry",
    effect:{ hpPct:10 }, effectText:"回復 10% HP",
    desc:"加入蜂蜜調味的強化恢復藥水。",
    recipe:[ { id:"potion_t2", count:5 } ],
    gold:1000,
  },
  {
    id:"hp_15",  name:"HP恢復 Lv3", icon:"❤️",   rarity:"rare",
    kind:"carry",
    effect:{ hpPct:15 }, effectText:"回復 15% HP",
    desc:"貓村長特製秘方，療效顯著。",
    recipe:[ { id:"potion_t3", count:5 } ],
    gold:2000,
  },
  // ══ 攜帶型：ATK提升（3 級）══════════════════════════════
  {
    id:"atk_5",  name:"ATK提升 Lv1", icon:"⚔️",  rarity:"common",
    kind:"carry",
    effect:{ atkPct:5 },  effectText:"ATK +5%",
    desc:"微辣配方，拉弓更順手。",
    recipe:[ { id:"potion_t1", count:5 } ],
    gold:500,
  },
  {
    id:"atk_10", name:"ATK提升 Lv2", icon:"⚔️",  rarity:"uncommon",
    kind:"carry",
    effect:{ atkPct:10 }, effectText:"ATK +10%",
    desc:"加入辣椒粉，戰鬥力倍增。",
    recipe:[ { id:"potion_t2", count:5 } ],
    gold:1000,
  },
  {
    id:"atk_15", name:"ATK提升 Lv3", icon:"⚔️",  rarity:"rare",
    kind:"carry",
    effect:{ atkPct:15 }, effectText:"ATK +15%",
    desc:"用龍血草調製，一箭穿雲！",
    recipe:[ { id:"potion_t3", count:5 } ],
    gold:2000,
  },
  // ══ 攜帶型：DEF提升（3 級）══════════════════════════════
  {
    id:"def_5",  name:"DEF提升 Lv1", icon:"🛡️",  rarity:"common",
    kind:"carry",
    effect:{ defPct:5 },  effectText:"DEF +5%",
    desc:"樹皮精華，讓皮膚硬一些。",
    recipe:[ { id:"potion_t1", count:5 } ],
    gold:500,
  },
  {
    id:"def_10", name:"DEF提升 Lv2", icon:"🛡️",  rarity:"uncommon",
    kind:"carry",
    effect:{ defPct:10 }, effectText:"DEF +10%",
    desc:"龜殼粉入藥，防禦力大增。",
    recipe:[ { id:"potion_t2", count:5 } ],
    gold:1000,
  },
  {
    id:"def_15", name:"DEF提升 Lv3", icon:"🛡️",  rarity:"rare",
    kind:"carry",
    effect:{ defPct:15 }, effectText:"DEF +15%",
    desc:"融合鎧甲花的汁液，堅不可摧。",
    recipe:[ { id:"potion_t3", count:5 } ],
    gold:2000,
  },

  // ══ 投擲型：傷害藥水（3 種）════════════════════════════
  {
    id:"throw_fixed",  name:"固定傷藥水", icon:"💉", rarity:"uncommon",
    kind:"throw",
    effect:{ throwDmg:30 }, effectText:"對怪固定扣 30 HP",
    desc:"強酸配方，碰到就燒一塊肉。",
    recipe:[ { id:"ore_t2", count:3 }, { id:"melon_t2", count:3 } ],
    gold:300,
  },
  {
    id:"throw_pct",    name:"比例傷藥水", icon:"💉", rarity:"rare",
    kind:"throw",
    effect:{ throwPct:0.10 }, effectText:"對怪扣 maxHP 10%",
    desc:"用詛咒草藥調製，傷口會不斷擴大。",
    recipe:[ { id:"fish_t3", count:3 }, { id:"meat_t3", count:3 } ],
    gold:500,
  },
  {
    id:"throw_random", name:"隨機傷藥水", icon:"💉", rarity:"uncommon",
    kind:"throw",
    effect:{ throwDmgMin:15, throwDmgMax:50 }, effectText:"對怪扣 15~50 HP",
    desc:"不穩定的煉金產物，效果飄忽不定。",
    recipe:[ { id:"driedfish_t2", count:3 }, { id:"can_t2", count:3 } ],
    gold:300,
  },
  // ══ 投擲型：弱化藥水（2 種）════════════════════════════
  {
    id:"throw_atkdown",  name:"降ATK藥水", icon:"🧪", rarity:"rare",
    kind:"throw",
    effect:{ monAtkPct:20 }, effectText:"怪物 ATK -20%",
    desc:"麻痺怪物的肌肉，讓牠攻擊無力。",
    recipe:[ { id:"fur_t3", count:3 }, { id:"ore_t3", count:3 } ],
    gold:500,
  },
  {
    id:"throw_defdown",  name:"降DEF藥水", icon:"🧴", rarity:"rare",
    kind:"throw",
    effect:{ monDefPct:20 }, effectText:"怪物 DEF -20%",
    desc:"腐蝕性液體，削弱怪物的護甲。",
    recipe:[ { id:"fish_t3", count:3 }, { id:"driedfish_t3", count:3 } ],
    gold:500,
  },
  // ══ 投擲型：控制道具（2 種）════════════════════════════
  {
    id:"throw_paralyze", name:"麻痺藥水", icon:"🕸️", rarity:"epic",
    kind:"throw",
    effect:{ skipRound:"big" }, effectText:"禁止怪物反擊一次（全隊共用）",
    desc:"蜘蛛王毒液提煉，怪物全身僵硬。",
    recipe:[ { id:"meat_t4", count:3 }, { id:"can_t4", count:3 } ],
    gold:800,
  },
  {
    id:"throw_knife",    name:"投擲小刀", icon:"🔪", rarity:"common",
    kind:"throw",
    effect:{ throwDmg:15 }, effectText:"直接造成 15 傷害（不吃 ATK/DEF）",
    desc:"磨利的貓爪刀片，輕巧好丟。",
    recipe:[ { id:"ore_t2", count:5 } ],
    gold:200,
  },
];

export function getPotion(id) { return POTIONS.find(p => p.id === id) || null; }

// 攜帶型藥水分類輔助
export const CARRY_POTIONS = POTIONS.filter(p => p.kind === "carry");
export const THROW_POTIONS = POTIONS.filter(p => p.kind === "throw");

// 舊系統 MAX_POTIONS_PER_BATTLE = 3 已移除（新系統改為回合中消耗，無每戰上限）

// 各寶箱可掉的藥劑池（依 rarity 分層）
const RARITY_TIER_MAP = {
  wood:   ["common"],
  iron:   ["common", "uncommon"],
  gold:   ["common", "uncommon", "rare"],
  epic:   ["common", "uncommon", "rare", "epic"],
  mythic: ["common", "uncommon", "rare", "epic"],
};
const CHEST_POTION_POOL = {};
for (const [type, rarities] of Object.entries(RARITY_TIER_MAP)) {
  CHEST_POTION_POOL[type] = POTIONS.filter(p => rarities.includes(p.rarity)).map(p => p.id);
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
  // 攜帶型 - common
  { id:"hp_5",           weight:16 },
  { id:"atk_5",          weight:16 },
  { id:"def_5",          weight:16 },
  { id:"throw_knife",    weight:14 },
  // 攜帶型 - uncommon
  { id:"hp_10",          weight:12 },
  { id:"atk_10",         weight:12 },
  { id:"def_10",         weight:12 },
  { id:"throw_fixed",    weight:10 },
  { id:"throw_random",   weight:10 },
  // 攜帶型 - rare
  { id:"hp_15",          weight:6 },
  { id:"atk_15",         weight:6 },
  { id:"def_15",         weight:6 },
  { id:"throw_pct",      weight:6 },
  { id:"throw_atkdown",  weight:6 },
  { id:"throw_defdown",  weight:6 },
  // 投擲型 - epic
  { id:"throw_paralyze", weight:3 },
];

const ALL_FAMILIES = ["ghost","mountain","insect","workplace","exam","temple"];

// ── 卡包抽卡（36 隻怪，按稀有度加權）─────────────────────
const CARD_TIER_WEIGHT = { common:50, rare:25, elite:15, fierce:7, boss:2.5, mythic:0.5 };
const CARD_TIER_TOTAL  = Object.values(CARD_TIER_WEIGHT).reduce((a,b) => a+b, 0);

function drawRandomCards(count = 3) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    let r = Math.random() * CARD_TIER_TOTAL;
    let tier = "common";
    for (const [t, w] of Object.entries(CARD_TIER_WEIGHT)) { r -= w; if (r <= 0) { tier = t; break; } }
    const pool = MONSTERS.filter(m => m.tier === tier);
    if (!pool.length) continue;
    const m = pool[Math.floor(Math.random() * pool.length)];
    drawn.push({ monsterId: m.id, name: m.name, icon: m.icon, tier: m.tier, family: m.family });
  }
  return drawn;
}

// ── 開箱：抽出寶箱內容 ───────────────────────────────────
// 回傳 { materials:[材料物件], potions:[藥劑物件], fragments:[碎片物件], cards:[卡片物件] }
export function openChestContents(chest) {
  // 圖片收集卡包：抽 3 張怪物卡
  if (chest.type === "card_pack") {
    return { materials: [], potions: [], fragments: [], cards: drawRandomCards(3) };
  }

  // 咪咪箱：由 db.js openChest 直接呼叫 openCatBox，這裡只標記類型
  if (chest.type === "mimi_box") {
    return { materials: [], potions: [], fragments: [], isMimiBox: true };
  }

  // 貓貓箱 / cat_box：90% 隨機一種碎片×1，10% 空
  if (chest.type === "cat" || chest.type === "cat_box") {
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

// ── 計算戰鬥加成 ────────────────────────────────────────
// 新版支援 carry / throw 兩類藥水：
//   carry -> 回傳 { hpPct, atkPct, defPct } 疊加
//   throw -> 回傳 throwEffects 陣列 + monAtkMult/monDefMult/skipRound
//
// 參數 potionIds: string[] - 該回合使用的藥水 ID 列表
// 回傳 {
//   hpPct: number,      // 攜帶型：HP 恢復 % 總和
//   atkPct: number,     // 攜帶型：ATK +% 總和
//   defPct: number,     // 攜帶型：DEF +% 總和
//   monAtkMult: number, // 投擲型：怪物 ATK 倍率（累乘）
//   monDefMult: number, // 投擲型：怪物 DEF 倍率（累乘）
//   skipRound: string|null, // 投擲型：跳過反擊 "big" | null
//   throwEffects: [],   // 投擲型傷害效果
//   used: [],           // 使用的藥水物件
// }
export function calcPotionBuffs(potionIds) {
  const buffs = {
    hpPct: 0, atkPct: 0, defPct: 0,
    monAtkMult: 1, monDefMult: 1,
    skipRound: null,
    throwEffects: [],
    used: [],
  };
  (potionIds || []).forEach(pid => {
    const p = getPotion(pid);
    if (!p) return;
    const e = p.effect || {};
    if (p.kind === "throw") {
      // 投擲型
      const eff = {
        name: p.name, icon: p.icon, effectText: p.effectText,
        dmg:        e.throwDmg    || 0,
        dmgPct:     e.throwPct    || 0,
        dmgMin:     e.throwDmgMin || 0,
        dmgMax:     e.throwDmgMax || 0,
        weaponDmg:  e.weaponDmg   || 0,
        monAtkPct:  e.monAtkPct   || 0,
        monDefPct:  e.monDefPct   || 0,
        skipRound:  e.skipRound   || null,
      };
      buffs.throwEffects.push(eff);
      if (e.monAtkPct) buffs.monAtkMult = Math.max(0.1, buffs.monAtkMult * (1 - e.monAtkPct / 100));
      if (e.monDefPct) buffs.monDefMult = Math.max(0.1, buffs.monDefMult * (1 - e.monDefPct / 100));
      if (e.skipRound) buffs.skipRound = e.skipRound;
    } else {
      // 攜帶型
      if (e.hpPct)  buffs.hpPct  += e.hpPct;
      if (e.atkPct) buffs.atkPct += e.atkPct;
      if (e.defPct) buffs.defPct += e.defPct;
    }
    buffs.used.push(p);
  });
  buffs.monAtkMult = Math.max(0.1, buffs.monAtkMult);
  buffs.monDefMult = Math.max(0.1, buffs.monDefMult);
  buffs.hpMult  = 1 + (buffs.hpPct  || 0) / 100;
  buffs.atkMult = 1 + (buffs.atkPct || 0) / 100;
  return buffs;
}