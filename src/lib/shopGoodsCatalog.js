// src/lib/shopGoodsCatalog.js — 貓貓村商店販售模擬器・商品目錄
// 120 件販售假商品（純展示不可用）：⚔️ 武器 40 / 🛡️ 裝備 40 / 🍜 料理 40
// 每件有 unlockLevel（商店等級幾級解鎖食譜）：L1 給 4 件，之後每級 4 件 → 4 + 29×4 = 120
//
// 定價公式（錨定 spec §3.3 的目標區間：T1 6~12 → T5 120~200）：
//   price = ceil( Σ(配方資源數) × RESOURCE_WORTH[tier] )
//   RESOURCE_WORTH = { T1:2, T2:4, T3:6, T4:8, T5:12 }
//   （spec 的 ×1.2×tierPremium 公式算出 T2≈9 與它自己的 15~25 區間矛盾，
//     此表直接以區間為準，worth 級數即等價的 tier premium。）

export const GOODS_CATEGORIES = [
  { id: "weapon", label: "武器", icon: "⚔️", theme: "冒險風" },
  { id: "armor",  label: "裝備", icon: "🛡️", theme: "防具風" },
  { id: "food",   label: "料理", icon: "🍜", theme: "美食風" },
];

export const TIER_LABELS = { 1: "T1", 2: "T2", 3: "T3", 4: "T4", 5: "T5" };
export const TIER_COLORS = {
  1: "#64748b", 2: "#2563eb", 3: "#7c3aed", 4: "#ea580c", 5: "#dc2626",
};
export const TIER_NAMES = { 1: "基礎", 2: "進階", 3: "菁英", 4: "兇猛", 5: "首領" };

// 每 tier 商品解鎖的商店等級區間（4 件/級 → 24 件/tier/6 級）
const TIER_LEVEL_RANGE = { 1: [1, 6], 2: [7, 12], 3: [13, 18], 4: [19, 24], 5: [25, 30] };
// spec §5.4 的 tier 門檻（最低商店等級）：與逐級解鎖取 max
const TIER_GATE = { 1: 1, 2: 1, 3: 5, 4: 10, 5: 13 };

export const RESOURCE_WORTH = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 12 };
export const TIER_GOLD = { 1: 20, 2: 40, 3: 80, 4: 160, 5: 320 };
// 每 tier 的配方資源數量區間（spec §3.3）
const TIER_RECIPE_COUNTS = {
  1: [3, 3, 4, 4, 4, 5, 5, 5],
  2: [4, 4, 4, 5, 5, 5, 6, 6],
  3: [5, 5, 6, 6, 7, 7, 8, 8],
  4: [8, 8, 9, 9, 10, 10, 11, 12],
  5: [10, 10, 11, 11, 12, 12, 13, 15],
};

// 各類別的商品命名（8 個基底名詞 × 5 個 tier 形容詞 = 40 件/類）
const CATEGORY_DEFS = {
  weapon: {
    nouns: ["弓", "短劍", "長劍", "法杖", "投石索", "戰錘", "魚骨劍", "重弩"],
    icons: ["🏹", "🗡️", "⚔️", "🪄", "🪃", "🔨", "🦴", "🎯"],
    adjs:  ["木製", "石製", "鐵製", "秘銀", "龍骨"],
    pools: ["ore", "driedfish", "can", "meat"],
    desc:  (n) => `貓貓冒險隊愛用的${n}，堅固耐用，擺上攤位總能吸引冒險系顧客。`,
    flavor: "純展示商品・冒險系顧客的最愛",
  },
  armor: {
    nouns: ["胸甲", "護符", "斗篷", "頭盔", "靴子", "手甲", "圓盾", "項圈"],
    icons: ["🦺", "🍀", "🧥", "⛑️", "🥾", "🧤", "🛡️", "🐾"],
    adjs:  ["布製", "皮製", "鎖甲", "精鋼", "傳說"],
    pools: ["can", "ore", "melon", "fish", "driedfish"],
    desc:  (n) => `保護貓貓遠征的${n}，輕巧又安心，裝扮系顧客看了就走不動。`,
    flavor: "純展示商品・裝扮系顧客的最愛",
  },
  food: {
    nouns: ["蓋飯", "沙拉", "湯品", "烤肉串", "蛋糕", "壽司", "拉麵", "蒸餃"],
    icons: ["🍱", "🥗", "🍲", "🍢", "🎂", "🍣", "🍜", "🥟"],
    adjs:  ["清爽", "香煎", "紅燒", "燉煮", "盛宴"],
    pools: ["melon", "fish", "meat", "driedfish", "can"],
    desc:  (n) => `村莊廚房現做${n}，香氣飄滿整條街，貪吃系顧客聞香而來。`,
    flavor: "純展示商品・貪吃系顧客的最愛",
  },
};

// 料理放檯面有吸引力加成（spec §5.1）
export const SHOP_GOOD_EXACT_ART = Object.freeze({
  weapon_0: "/assets/cat_equip/bow.jpg",
  armor_0: "/assets/cat_equip/armor.jpg",
});

// V5 視覺層：120 件商品共用 24 個穩定 visualKey。
// 沒有可信的成品圖時不硬配錯圖，改用配方主素材作為底紋，再疊上商品名稱。
// 未來新增真正商品插畫時，只要在上表補 visualKey -> public 路徑即可，不必改 UI。
export const COUNTER_ATTRACTION_BONUS = 0.15;

function buildGoods() {
  const goods = [];
  // tier 外層迴圈：每個 tier 有 24 件（3 類 × 8 件），全域索引 0~23 每 4 件一級 →
  // 每個 tier 橫跨 6 級、每級 4 件 → 全部 30 級都有新食譜（L1 起 4 件/級 = 120）
  for (let tier = 1; tier <= 5; tier++) {
    const range = TIER_LEVEL_RANGE[tier];
    const counts = TIER_RECIPE_COUNTS[tier];
    for (let c = 0; c < GOODS_CATEGORIES.length; c++) {
      const cat = GOODS_CATEGORIES[c];
      const def = CATEGORY_DEFS[cat.id];
      for (let i = 0; i < 8; i++) {
        const globalIdx = c * 8 + i; // 0~23（tier 內全域）
        const noun = def.nouns[i];
        const name = `${def.adjs[tier - 1]}${noun}`;
        const id = `${cat.id}_${tier}_${i}`;
        // 配方：偶數 idx 用 1 種資源，奇數用 2 種混合；總數量依 TIER_RECIPE_COUNTS
        const pool = def.pools;
        const total = counts[i];
        const mainCount = i % 2 === 0 ? total : Math.ceil(total / 2);
        const subCount = i % 2 === 0 ? 0 : total - mainCount;
        const recipe = [];
        if (mainCount > 0) recipe.push({ resource: pool[i % pool.length], tier, count: mainCount });
        if (subCount > 0) recipe.push({ resource: pool[(i + 3) % pool.length], tier, count: subCount });
        const recipeSum = recipe.reduce((s, r) => s + r.count, 0);
        const price = Math.ceil(recipeSum * RESOURCE_WORTH[tier]);
        // 逐級解鎖：tier 內 24 件 / 6 級 = 4 件/級
        const level = range[0] + Math.floor(globalIdx / 4);
        goods.push({
          id,
          category: cat.id,
          name,
          icon: def.icons[i],
          visualKey: `${cat.id}_${i}`,
          visualLabel: noun,
          art: SHOP_GOOD_EXACT_ART[`${cat.id}_${i}`] || null,
          motifArt: recipe[0] ? `/ui/village/resource-${recipe[0].resource}${tier}.webp` : null,
          desc: def.desc(noun),
          tier,
          // spec §5.4 tier 門檻與逐級解鎖取較晚者
          unlockLevel: Math.max(level, TIER_GATE[tier]),
          recipe,
          gold: TIER_GOLD[tier],
          price,
          popularity: i % 7 === 0 ? 0.9 : i % 5 === 0 ? 1.15 : 1.0,
          flavor: def.flavor,
        });
      }
    }
  }
  return goods;
}

export const SHOP_GOODS = buildGoods();

const GOODS_MAP = new Map(SHOP_GOODS.map(g => [g.id, g]));

export function getGoodById(id) {
  return GOODS_MAP.get(id);
}

// 依商店等級回傳已解鎖食譜（unlockLevel <= level）
export function getUnlockedGoods(level) {
  return SHOP_GOODS.filter(g => g.unlockLevel <= (level || 1));
}

export function getGoodsByCategory(category, level) {
  return SHOP_GOODS.filter(g => g.category === category && g.unlockLevel <= (level || 1));
}

export function getGoodsByTier(tier, level) {
  return SHOP_GOODS.filter(g => g.tier === tier && g.unlockLevel <= (level || 1));
}
