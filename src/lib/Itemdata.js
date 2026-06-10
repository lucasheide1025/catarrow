// src/lib/itemData.js
// 寶箱系統 + 藥劑系統定義
// 寶箱：怪物掉寶箱（依階級決定箱種）→ 背包開箱 → 取得材料＋機率掉藥劑
// 藥劑：戰鬥前使用，只影響當場（不改射手本體數值），可用材料合成

import { drawMaterial } from "./monsterMaterials";

// ── 寶箱類型 ─────────────────────────────────────────────
export const CHEST_TYPES = {
  wood:   { id:"wood",   name:"木寶箱",   icon:"📦", color:"#a16207", matCount:1, potionChance:0.15,
            desc:"普通的木箱，裡面有 1 個材料，偶爾藏著藥水。" },
  iron:   { id:"iron",   name:"鐵寶箱",   icon:"🧰", color:"#64748b", matCount:2, potionChance:0.25,
            desc:"堅固的鐵箱，裡面有 2 個材料，藥水機率提高。" },
  gold:   { id:"gold",   name:"黃金寶箱", icon:"🎁", color:"#f59e0b", matCount:3, potionChance:0.45,
            desc:"閃閃發光的黃金箱，3 個材料，將近一半機率掉高級藥劑！" },
  mythic: { id:"mythic", name:"神話寶箱", icon:"🔮", color:"#a855f7", matCount:4, potionChance:0.80,
            desc:"傳說中的神話寶箱，4 個材料，幾乎必掉稀有藥劑！" },
};

// 怪物階級 → 寶箱種類機率
const CHEST_ROLL = {
  common: [["wood", 1.0]],
  rare:   [["wood", 0.7], ["iron", 0.3]],
  elite:  [["iron", 0.8], ["gold", 0.2]],
  fierce: [["iron", 0.4], ["gold", 0.6]],
  boss:   [["gold", 0.8], ["mythic", 0.2]],
  mythic: [["mythic", 1.0]],
};

export function rollChestType(tier) {
  const table = CHEST_ROLL[tier] || CHEST_ROLL.common;
  let r = Math.random();
  for (const [type, p] of table) { r -= p; if (r <= 0) return type; }
  return table[table.length - 1][0];
}

// 產生一個寶箱物件（打贏怪物時呼叫）
export function makeChest(monster) {
  const type = rollChestType(monster.tier);
  return {
    id: `chest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    family: monster.family,
    tier:   monster.tier,
    from:   monster.name,
    ts:     Date.now(),
  };
}

// ── 藥劑定義 ─────────────────────────────────────────────
// effect 欄位：hpPct（本場最大HP+%）/ atkPct（本場ATK+%）
//             monAtkPct（敵方ATK−%）/ monDefPct（敵方DEF−%）
// recipe：合成所需材料 [{ id, count }]
export const POTIONS = [
  {
    id:"heal_s", name:"小型生命藥水", icon:"🧪", rarity:"common",
    effect:{ hpPct:15 }, effectText:"本場最大HP +15%",
    desc:"教練特調的草藥水，喝了渾身是勁。",
    recipe:[ { id:"ghost_m1", count:3 }, { id:"mountain_m1", count:2 } ],
  },
  {
    id:"heal_l", name:"大型生命藥水", icon:"❤️‍🩹", rarity:"rare",
    effect:{ hpPct:30 }, effectText:"本場最大HP +30%",
    desc:"濃縮版生命藥水，連百步蛇毒都拿來入藥。",
    recipe:[ { id:"ghost_m2", count:3 }, { id:"mountain_m2", count:2 } ],
  },
  {
    id:"atk_s", name:"力量藥水", icon:"💪", rarity:"common",
    effect:{ atkPct:15 }, effectText:"本場ATK +15%",
    desc:"喝下去手臂發燙，拉弓特別有力。",
    recipe:[ { id:"insect_m1", count:3 }, { id:"temple_m1", count:2 } ],
  },
  {
    id:"atk_l", name:"狂暴藥水", icon:"🔥", rarity:"rare",
    effect:{ atkPct:30 }, effectText:"本場ATK +30%",
    desc:"蜂毒與碎骨熬製，喝完眼睛都紅了。",
    recipe:[ { id:"insect_m2", count:3 }, { id:"temple_m2", count:2 } ],
  },
  {
    id:"weaken", name:"虛弱毒霧", icon:"☠️", rarity:"rare",
    effect:{ monAtkPct:20 }, effectText:"敵方ATK −20%",
    desc:"戰鬥前灑向怪物，PUA語錄讓牠懷疑自己。",
    recipe:[ { id:"workplace_m2", count:2 }, { id:"insect_m1", count:3 } ],
  },
  {
    id:"armor_break", name:"破甲藥劑", icon:"🧨", rarity:"epic",
    effect:{ monDefPct:30 }, effectText:"敵方DEF −30%",
    desc:"狼人之爪磨粉混合空頭支票，腐蝕一切防禦。",
    recipe:[ { id:"workplace_m3", count:2 }, { id:"temple_m3", count:2 } ],
  },
];

export function getPotion(id) { return POTIONS.find(p => p.id === id) || null; }

// 每場戰鬥最多帶幾瓶藥
export const MAX_POTIONS_PER_BATTLE = 2;

// 各寶箱可掉的藥劑池
const CHEST_POTION_POOL = {
  wood:   ["heal_s", "atk_s"],
  iron:   ["heal_s", "atk_s", "heal_l", "atk_l"],
  gold:   ["heal_l", "atk_l", "weaken"],
  mythic: ["heal_l", "atk_l", "weaken", "armor_break"],
};

// ── 開箱：抽出寶箱內容 ───────────────────────────────────
// 回傳 { materials:[材料物件], potions:[藥劑物件] }
export function openChestContents(chest) {
  const cfg = CHEST_TYPES[chest.type] || CHEST_TYPES.wood;

  // 材料：依寶箱來源的家族與階級抽（沿用怪物材料池邏輯）
  const fakeMonsterId = `${chest.family || "ghost"}_chest`;
  const materials = Array.from({ length: cfg.matCount }, () =>
    drawMaterial(fakeMonsterId, chest.tier || "common")
  ).filter(Boolean);

  // 藥劑：依機率掉 1 瓶
  const potions = [];
  if (Math.random() < cfg.potionChance) {
    const pool = CHEST_POTION_POOL[chest.type] || CHEST_POTION_POOL.wood;
    const pid = pool[Math.floor(Math.random() * pool.length)];
    const potion = getPotion(pid);
    if (potion) potions.push(potion);
  }

  return { materials, potions };
}

// ── 計算戰鬥加成（戰鬥開始時呼叫）────────────────────────
// potionIds → { hpMult, atkMult, monAtkMult, monDefMult, used:[藥劑物件] }
export function calcPotionBuffs(potionIds) {
  const buffs = { hpMult:1, atkMult:1, monAtkMult:1, monDefMult:1, used:[] };
  (potionIds || []).forEach(pid => {
    const p = getPotion(pid);
    if (!p) return;
    const e = p.effect || {};
    if (e.hpPct)     buffs.hpMult     += e.hpPct / 100;
    if (e.atkPct)    buffs.atkMult    += e.atkPct / 100;
    if (e.monAtkPct) buffs.monAtkMult -= e.monAtkPct / 100;
    if (e.monDefPct) buffs.monDefMult -= e.monDefPct / 100;
    buffs.used.push(p);
  });
  buffs.monAtkMult = Math.max(0.1, buffs.monAtkMult);
  buffs.monDefMult = Math.max(0.1, buffs.monDefMult);
  return buffs;
}