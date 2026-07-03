// src/lib/monsterRegistry.js
// 怪物變體系統 + 族系掉落表
// 與 monsterData.js 的 MONSTERS 陣列搭配使用

// ── 變體倍率（hp/atk/def 全部按此比例縮放）─────────────────────
export const VARIANT_MULT = {
  weak:   { hp: 0.8, atk: 0.8, def: 0.8, dropMult: 0.7,  coinMult: 0.8 },
  normal: { hp: 1.0, atk: 1.0, def: 1.0, dropMult: 1.0,  coinMult: 1.0 },
  strong: { hp: 1.2, atk: 1.2, def: 1.2, dropMult: 1.3,  coinMult: 1.2 },
  boss:   { hp: 1.5, atk: 1.5, def: 1.5, dropMult: 2.0,  coinMult: 2.0 },
};

export const VARIANT_LABEL = {
  weak:   { label: "弱化", color: "#94a3b8", bg: "#1e293b" },
  normal: { label: "普通", color: "#6b7280", bg: "#f3f4f6" },
  strong: { label: "強悍", color: "#f97316", bg: "#fff7ed" },
  boss:   { label: "BOSS", color: "#ef4444", bg: "#fef2f2" },
};

// ── 族系掉落表 ─────────────────────────────────────────────────
// materials.pool: 按強度選 common/rare/boss 材料池
// chest/goldChest/card/arrowDew: 各變體的機率或固定數量
export const FAMILY_LOOT = {
  ghost: {
    arrowDew:      { weak: 0, normal: 1, strong: 2, boss: 5 },
    chestChance:   { weak: 0.10, normal: 0.20, strong: 0.30, boss: 0.55 },
    goldChestChance:{ weak: 0.02, normal: 0.05, strong: 0.10, boss: 0.20 },
    cardChance:    { weak: 0.05, normal: 0.10, strong: 0.18, boss: 0.30 },
    materialChance:{ weak: 0.40, normal: 0.60, strong: 0.75, boss: 0.92 },
    materials: {
      common: [
        { id: "shadow_stone",   name: "幽靈石",   icon: "🪨", weight: 60 },
        { id: "bone_fragment",  name: "骨頭碎片", icon: "🦴", weight: 40 },
      ],
      rare: [
        { id: "void_crystal",   name: "虛空水晶", icon: "💎", weight: 60 },
        { id: "lich_essence",   name: "巫妖精華", icon: "✨", weight: 40 },
      ],
      boss: [
        { id: "shadow_crown",   name: "幽靈王冠", icon: "👑", weight: 40 },
        { id: "lich_scepter",   name: "巫妖法杖", icon: "🔮", weight: 35 },
        { id: "void_eye",       name: "虛空之眼", icon: "👁️", weight: 25 },
      ],
    },
    dungeonDrops: {
      room: [
        { id: "ghost_lantern",  name: "幽靈燈籠", icon: "🏮", chance: 0.15 },
        { id: "ghost_scroll",   name: "靈咒捲軸", icon: "📜", chance: 0.08 },
      ],
      boss: [
        { id: "ghost_trophy",   name: "幽靈骨牌",   icon: "🃏", chance: 1.00 },
        { id: "ghost_rune",     name: "幽靈符文",   icon: "🔯", chance: 0.35 },
        { id: "ghost_key",      name: "冥界鑰匙",   icon: "🗝️", chance: 0.20 },
      ],
    },
  },
  mountain: {
    arrowDew:      { weak: 0, normal: 1, strong: 2, boss: 5 },
    chestChance:   { weak: 0.10, normal: 0.20, strong: 0.30, boss: 0.55 },
    goldChestChance:{ weak: 0.02, normal: 0.05, strong: 0.10, boss: 0.20 },
    cardChance:    { weak: 0.05, normal: 0.10, strong: 0.18, boss: 0.30 },
    materialChance:{ weak: 0.40, normal: 0.60, strong: 0.75, boss: 0.92 },
    materials: {
      common: [
        { id: "rough_stone",    name: "粗糙石塊", icon: "🪨", weight: 60 },
        { id: "mountain_herb",  name: "山林藥草", icon: "🌿", weight: 40 },
      ],
      rare: [
        { id: "ore_crystal",    name: "礦石水晶", icon: "💎", weight: 60 },
        { id: "peak_core",      name: "山巔核心", icon: "⛰️", weight: 40 },
      ],
      boss: [
        { id: "summit_gem",     name: "峰頂寶石",   icon: "💠", weight: 40 },
        { id: "mountain_throne",name: "山嶺王座",   icon: "👑", weight: 35 },
        { id: "peak_essence",   name: "山巔精華",   icon: "✨", weight: 25 },
      ],
    },
    dungeonDrops: {
      room: [
        { id: "mountain_map",   name: "山路地圖", icon: "🗺️", chance: 0.15 },
        { id: "wild_food",      name: "野外糧食", icon: "🍖", chance: 0.10 },
      ],
      boss: [
        { id: "mountain_trophy",name: "山嶺獵牌",   icon: "🏔️", chance: 1.00 },
        { id: "beast_fang",     name: "山獸獠牙",   icon: "🦷", chance: 0.35 },
        { id: "summit_key",     name: "峰頂鑰匙",   icon: "🗝️", chance: 0.20 },
      ],
    },
  },
  insect: {
    arrowDew:      { weak: 0, normal: 1, strong: 2, boss: 5 },
    chestChance:   { weak: 0.10, normal: 0.20, strong: 0.30, boss: 0.55 },
    goldChestChance:{ weak: 0.02, normal: 0.05, strong: 0.10, boss: 0.20 },
    cardChance:    { weak: 0.05, normal: 0.10, strong: 0.18, boss: 0.30 },
    materialChance:{ weak: 0.40, normal: 0.60, strong: 0.75, boss: 0.92 },
    materials: {
      common: [
        { id: "insect_shell",   name: "昆蟲外殼", icon: "🪲", weight: 60 },
        { id: "silk_thread",    name: "絲線",     icon: "🧵", weight: 40 },
      ],
      rare: [
        { id: "wing_dust",      name: "翅膀粉末", icon: "✨", weight: 60 },
        { id: "queen_pheromone",name: "蟲后費洛蒙",icon: "💜", weight: 40 },
      ],
      boss: [
        { id: "queen_crystal",  name: "蟲后水晶",   icon: "💎", weight: 40 },
        { id: "hive_core",      name: "蟲巢核心",   icon: "🕷️", weight: 35 },
        { id: "ancient_silk",   name: "古代蠶絲",   icon: "🎀", weight: 25 },
      ],
    },
    dungeonDrops: {
      room: [
        { id: "poison_vial",    name: "毒液小瓶", icon: "🧪", chance: 0.15 },
        { id: "web_fragment",   name: "蛛網碎片", icon: "🕸️", chance: 0.10 },
      ],
      boss: [
        { id: "insect_trophy",  name: "蟲族徽章",   icon: "🦋", chance: 1.00 },
        { id: "queen_stinger",  name: "蟲后毒刺",   icon: "💉", chance: 0.35 },
        { id: "hive_key",       name: "蟲巢鑰匙",   icon: "🗝️", chance: 0.20 },
      ],
    },
  },
  workplace: {
    arrowDew:      { weak: 0, normal: 1, strong: 2, boss: 5 },
    chestChance:   { weak: 0.10, normal: 0.20, strong: 0.30, boss: 0.55 },
    goldChestChance:{ weak: 0.02, normal: 0.05, strong: 0.10, boss: 0.20 },
    cardChance:    { weak: 0.05, normal: 0.10, strong: 0.18, boss: 0.30 },
    materialChance:{ weak: 0.40, normal: 0.60, strong: 0.75, boss: 0.92 },
    materials: {
      common: [
        { id: "memo_paper",     name: "便條紙",   icon: "📝", weight: 60 },
        { id: "coffee_bean",    name: "咖啡豆",   icon: "☕", weight: 40 },
      ],
      rare: [
        { id: "boss_seal",      name: "主管印章", icon: "📛", weight: 60 },
        { id: "overtime_crystal",name:"加班水晶", icon: "💎", weight: 40 },
      ],
      boss: [
        { id: "gold_badge",     name: "金牌員工",   icon: "🏅", weight: 40 },
        { id: "ceo_key",        name: "CEO 鑰匙",   icon: "🗝️", weight: 35 },
        { id: "annual_report",  name: "年度報告",   icon: "📊", weight: 25 },
      ],
    },
    dungeonDrops: {
      room: [
        { id: "energy_drink",   name: "提神飲料", icon: "🥤", chance: 0.15 },
        { id: "work_report",    name: "工作報告", icon: "📋", chance: 0.10 },
      ],
      boss: [
        { id: "workplace_trophy",name:"職場勳章",  icon: "💼", chance: 1.00 },
        { id: "ceo_card",       name: "CEO 名片",   icon: "💳", chance: 0.35 },
        { id: "company_key",    name: "公司鑰匙",   icon: "🗝️", chance: 0.20 },
      ],
    },
  },
  exam: {
    arrowDew:      { weak: 0, normal: 1, strong: 2, boss: 5 },
    chestChance:   { weak: 0.10, normal: 0.20, strong: 0.30, boss: 0.55 },
    goldChestChance:{ weak: 0.02, normal: 0.05, strong: 0.10, boss: 0.20 },
    cardChance:    { weak: 0.05, normal: 0.10, strong: 0.18, boss: 0.30 },
    materialChance:{ weak: 0.40, normal: 0.60, strong: 0.75, boss: 0.92 },
    materials: {
      common: [
        { id: "exam_paper",     name: "考卷碎片", icon: "📄", weight: 60 },
        { id: "pencil_stub",    name: "鉛筆頭",   icon: "✏️", weight: 40 },
      ],
      rare: [
        { id: "answer_key",     name: "解答卷",   icon: "📖", weight: 60 },
        { id: "study_crystal",  name: "學習水晶", icon: "💎", weight: 40 },
      ],
      boss: [
        { id: "diploma",        name: "畢業文憑",   icon: "🎓", weight: 40 },
        { id: "exam_god_seal",  name: "考神印璽",   icon: "🔏", weight: 35 },
        { id: "knowledge_core", name: "知識核心",   icon: "🧠", weight: 25 },
      ],
    },
    dungeonDrops: {
      room: [
        { id: "cheat_sheet",    name: "小抄紙條", icon: "📃", chance: 0.15 },
        { id: "lucky_eraser",   name: "幸運橡皮擦",icon: "🩹", chance: 0.10 },
      ],
      boss: [
        { id: "exam_trophy",    name: "狀元獎牌",   icon: "🏆", chance: 1.00 },
        { id: "god_pencil",     name: "神筆",       icon: "✒️", chance: 0.35 },
        { id: "exam_key",       name: "考場鑰匙",   icon: "🗝️", chance: 0.20 },
      ],
    },
  },
  temple: {
    arrowDew:      { weak: 0, normal: 1, strong: 2, boss: 5 },
    chestChance:   { weak: 0.10, normal: 0.20, strong: 0.30, boss: 0.55 },
    goldChestChance:{ weak: 0.02, normal: 0.05, strong: 0.10, boss: 0.20 },
    cardChance:    { weak: 0.05, normal: 0.10, strong: 0.18, boss: 0.30 },
    materialChance:{ weak: 0.40, normal: 0.60, strong: 0.75, boss: 0.92 },
    materials: {
      common: [
        { id: "stone_tablet",   name: "石板碎片", icon: "🗿", weight: 60 },
        { id: "incense_ash",    name: "香燭灰燼", icon: "🕯️", weight: 40 },
      ],
      rare: [
        { id: "relic_fragment", name: "聖物碎片", icon: "✨", weight: 60 },
        { id: "divine_jade",    name: "神聖翡翠", icon: "💚", weight: 40 },
      ],
      boss: [
        { id: "oracle_staff",   name: "神諭法杖",   icon: "🔱", weight: 40 },
        { id: "divine_crown",   name: "神明王冠",   icon: "👑", weight: 35 },
        { id: "eternal_flame",  name: "永恆聖火",   icon: "🔥", weight: 25 },
      ],
    },
    dungeonDrops: {
      room: [
        { id: "holy_water",     name: "聖水",     icon: "💧", chance: 0.15 },
        { id: "prayer_bead",    name: "念珠",     icon: "📿", chance: 0.10 },
      ],
      boss: [
        { id: "temple_trophy",  name: "神廟勳章",   icon: "🏛️", chance: 1.00 },
        { id: "divine_relic",   name: "神聖遺物",   icon: "⚜️", chance: 0.35 },
        { id: "temple_key",     name: "神廟鑰匙",   icon: "🗝️", chance: 0.20 },
      ],
    },
  },
  treasure: {
    arrowDew:      { weak: 2, normal: 3, strong: 5, boss: 10 },
    chestChance:   { weak: 0.60, normal: 0.80, strong: 1.00, boss: 1.00 },
    goldChestChance:{ weak: 0.10, normal: 0.20, strong: 0.40, boss: 0.60 },
    cardChance:    { weak: 0.30, normal: 0.50, strong: 0.70, boss: 1.00 },
    materialChance:{ weak: 0.80, normal: 0.90, strong: 1.00, boss: 1.00 },
    materials: {
      common: [
        { id: "copper_coin",    name: "銅幣",     icon: "🪙", weight: 60 },
        { id: "silver_nugget",  name: "銀塊",     icon: "🥈", weight: 40 },
      ],
      rare: [
        { id: "gold_bar",       name: "金條",     icon: "💛", weight: 60 },
        { id: "gem_shard",      name: "寶石碎片", icon: "💎", weight: 40 },
      ],
      boss: [
        { id: "treasure_crown", name: "寶藏王冠", icon: "👑", weight: 40 },
        { id: "mythic_gem",     name: "神話寶石", icon: "🔮", weight: 35 },
        { id: "golden_statue",  name: "黃金雕像", icon: "🗿", weight: 25 },
      ],
    },
    dungeonDrops: {
      room: [
        { id: "treasure_map",   name: "藏寶圖", icon: "🗺️", chance: 0.20 },
        { id: "golden_key",     name: "黃金鑰匙", icon: "🔑", chance: 0.15 },
      ],
      boss: [
        { id: "treasure_trophy",name: "寶藏王徽章", icon: "🏆", chance: 1.00 },
        { id: "divine_crown",   name: "神聖皇冠",   icon: "👑", chance: 0.40 },
        { id: "treasure_key",   name: "萬能鑰匙",   icon: "🗝️", chance: 0.25 },
      ],
    },
  },

};

// ── 工具函式 ─────────────────────────────────────────────────────

// 取得怪物套用變體後的數值
export function getVariantStats(monster, variant = "normal") {
  const mult = VARIANT_MULT[variant] || VARIANT_MULT.normal;
  return {
    hp:  Math.round(monster.hp  * mult.hp),
    atk: Math.round(monster.atk * mult.atk),
    def: Math.round(monster.def * mult.def),
  };
}

// 取得族系掉落表
export function getFamilyLoot(family) {
  return FAMILY_LOOT[family] || null;
}

// 決定材料池層級（boss → boss pool, fierce/boss → rare pool, else → common pool）
function getMaterialPool(tier, variant) {
  if (variant === "boss") return "boss";
  if (["fierce", "boss", "mythic"].includes(tier)) return "rare";
  if (["elite"].includes(tier)) return "rare";
  return "common";
}

// 抽取材料掉落（回傳 item 物件或 null）
export function rollFamilyMaterial(family, tier, variant = "normal") {
  const loot = FAMILY_LOOT[family];
  if (!loot) return null;
  if (Math.random() > loot.materialChance[variant]) return null;
  const pool = loot.materials[getMaterialPool(tier, variant)] || loot.materials.common;
  const totalWeight = pool.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * totalWeight;
  for (const item of pool) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return pool[pool.length - 1];
}

// 抽取完整戰鬥掉落結果
export function rollBattleLoot(monster, variant = "normal", mode = "student") {
  const loot = FAMILY_LOOT[monster.family];
  if (!loot) return { coins: 0 };

  const mult = VARIANT_MULT[variant] || VARIANT_MULT.normal;

  // 金幣（tier 基礎 × 變體倍率 × mode 倍率，參考 lootTable.js COIN_RANGE）
  const COIN_RANGE = { common:[3,8], rare:[6,15], elite:[12,25], fierce:[20,40], boss:[35,65], mythic:[60,100] };
  const MODE_MULT  = { novice:1.0, student:2.0, veteran:3.0, match:4.0 };
  const [min, max] = COIN_RANGE[monster.tier] || [3, 8];
  const coins = Math.round((min + Math.floor(Math.random() * (max - min + 1))) * mult.coinMult * (MODE_MULT[mode] || 1));

  // 材料
  const material = rollFamilyMaterial(monster.family, monster.tier, variant);

  // 寶箱
  const chest     = Math.random() < loot.chestChance[variant];
  const goldChest = Math.random() < loot.goldChestChance[variant];

  // 卡片
  const cardRoll = Math.random();
  const card = cardRoll < loot.cardChance[variant]
    ? { monsterId: monster.id, name: monster.name, icon: monster.icon, tier: monster.tier }
    : null;

  // 箭露
  const arrowDew = loot.arrowDew[variant] || 0;

  return { coins, material, chest, goldChest, card, arrowDew };
}
