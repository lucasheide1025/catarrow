"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TIER_NAMES = exports.TIER_LABELS = exports.TIER_GOLD = exports.TIER_COLORS = exports.SHOP_VILLAGE_RESOURCE_META = exports.SHOP_QUICK_REFILL_THRESHOLD = exports.SHOP_QUICK_REFILL_TARGET = exports.SHOP_GOOD_STOCK_CAP = exports.SHOP_GOOD_EXACT_ART = exports.SHOP_GOODS = exports.RESOURCE_WORTH = exports.GOODS_CATEGORIES = exports.COUNTER_ATTRACTION_BONUS = void 0;
exports.getGoodById = getGoodById;
exports.getGoodsByCategory = getGoodsByCategory;
exports.getGoodsByTier = getGoodsByTier;
exports.getShopQuickRefillPlan = getShopQuickRefillPlan;
exports.getShopSinkRecommendations = getShopSinkRecommendations;
exports.getShopTierOverflowEntries = getShopTierOverflowEntries;
exports.getUnlockedGoods = getUnlockedGoods;
// src/lib/shopGoodsCatalog.js — 貓貓村商店販售模擬器・商品目錄
// 120 件販售假商品（純展示不可用）：⚔️ 武器 40 / 🛡️ 裝備 40 / 🍜 料理 40
// 每件有 unlockLevel（商店等級幾級解鎖食譜）：L1 給 4 件，之後每級 4 件 → 4 + 29×4 = 120
//
// 定價公式（錨定 spec §3.3 的目標區間：T1 6~12 → T5 120~200）：
//   price = ceil( Σ(配方資源數) × RESOURCE_WORTH[tier] )
//   RESOURCE_WORTH = { T1:2, T2:4, T3:6, T4:8, T5:12 }
//   （spec 的 ×1.2×tierPremium 公式算出 T2≈9 與它自己的 15~25 區間矛盾，
//     此表直接以區間為準，worth 級數即等價的 tier premium。）

const GOODS_CATEGORIES = exports.GOODS_CATEGORIES = [{
  id: "weapon",
  label: "武器",
  icon: "⚔️",
  theme: "冒險風"
}, {
  id: "armor",
  label: "裝備",
  icon: "🛡️",
  theme: "防具風"
}, {
  id: "food",
  label: "料理",
  icon: "🍜",
  theme: "美食風"
}];
const TIER_LABELS = exports.TIER_LABELS = {
  1: "T1",
  2: "T2",
  3: "T3",
  4: "T4",
  5: "T5"
};
const TIER_COLORS = exports.TIER_COLORS = {
  1: "#64748b",
  2: "#2563eb",
  3: "#7c3aed",
  4: "#ea580c",
  5: "#dc2626"
};
const TIER_NAMES = exports.TIER_NAMES = {
  1: "基礎",
  2: "進階",
  3: "菁英",
  4: "兇猛",
  5: "首領"
};

// 每 tier 商品解鎖的商店等級區間（4 件/級 → 24 件/tier/6 級）
const TIER_LEVEL_RANGE = {
  1: [1, 6],
  2: [7, 12],
  3: [13, 18],
  4: [19, 24],
  5: [25, 30]
};
// spec §5.4 的 tier 門檻（最低商店等級）：與逐級解鎖取 max
const TIER_GATE = {
  1: 1,
  2: 1,
  3: 5,
  4: 10,
  5: 13
};
const RESOURCE_WORTH = exports.RESOURCE_WORTH = {
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 12
};

// V9：商店是射箭主系統裡的「貓貓村材料去化器」，不是另一條金幣消耗線。
// 保留 TIER_GOLD 欄位做舊 UI / 測試相容，但製作費固定為 0；真正成本只來自 village.resources。
const TIER_GOLD = exports.TIER_GOLD = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0
};
const SHOP_GOOD_STOCK_CAP = exports.SHOP_GOOD_STOCK_CAP = 999;
const SHOP_QUICK_REFILL_THRESHOLD = exports.SHOP_QUICK_REFILL_THRESHOLD = 10;
const SHOP_QUICK_REFILL_TARGET = exports.SHOP_QUICK_REFILL_TARGET = 30;

// 商店唯一允許大量消耗的九種村莊分層資源。
// arrowdew / gachaToken 是村莊貨幣，不放進商品配方；怪物 family materials 也完全不在此池。
const SHOP_VILLAGE_RESOURCE_META = exports.SHOP_VILLAGE_RESOURCE_META = Object.freeze({
  ore: {
    name: "礦物",
    icon: "⛏️"
  },
  melon: {
    name: "瓜瓜",
    icon: "🌿"
  },
  fish: {
    name: "鮮魚",
    icon: "🐟"
  },
  meat: {
    name: "動物肉",
    icon: "🥩"
  },
  driedfish: {
    name: "小魚乾",
    icon: "🐠"
  },
  can: {
    name: "貓罐頭",
    icon: "🥫"
  },
  potion: {
    name: "貓薄荷藥水",
    icon: "🍵"
  },
  fur: {
    name: "貓毛",
    icon: "🐾"
  },
  archer: {
    name: "貓貓射手",
    icon: "🏹"
  }
});
// 每 tier 的配方資源數量區間（spec §3.3）
const TIER_RECIPE_COUNTS = {
  1: [3, 3, 4, 4, 4, 5, 5, 5],
  2: [4, 4, 4, 5, 5, 5, 6, 6],
  3: [5, 5, 6, 6, 7, 7, 8, 8],
  4: [8, 8, 9, 9, 10, 10, 11, 12],
  5: [10, 10, 11, 11, 12, 12, 13, 15]
};

// 各類別的商品命名（8 個基底名詞 × 5 個 tier 形容詞 = 40 件/類）
const CATEGORY_DEFS = {
  weapon: {
    nouns: ["弓", "短劍", "長劍", "法杖", "投石索", "戰錘", "魚骨劍", "重弩"],
    visualKeys: ["bow", "short-sword", "long-sword", "staff", "sling", "war-hammer", "fishbone-sword", "crossbow"],
    icons: ["🏹", "🗡️", "⚔️", "🪄", "🪃", "🔨", "🦴", "🎯"],
    adjs: ["木製", "石製", "鐵製", "秘銀", "龍骨"],
    desc: n => `貓貓冒險隊愛用的${n}，堅固耐用，擺上攤位總能吸引冒險系顧客。`,
    flavor: "純展示商品・冒險系顧客的最愛"
  },
  armor: {
    nouns: ["胸甲", "護符", "斗篷", "頭盔", "靴子", "手甲", "圓盾", "項圈"],
    visualKeys: ["chest-armor", "amulet", "cloak", "helmet", "boots", "gloves", "shield", "collar"],
    icons: ["🦺", "🍀", "🧥", "⛑️", "🥾", "🧤", "🛡️", "🐾"],
    adjs: ["布製", "皮製", "鎖甲", "精鋼", "傳說"],
    desc: n => `保護貓貓遠征的${n}，輕巧又安心，裝扮系顧客看了就走不動。`,
    flavor: "純展示商品・裝扮系顧客的最愛"
  },
  food: {
    nouns: ["蓋飯", "沙拉", "湯品", "烤肉串", "蛋糕", "壽司", "拉麵", "蒸餃"],
    visualKeys: ["rice-bowl", "salad", "soup", "meat-skewer", "cake", "sushi", "ramen", "dumplings"],
    icons: ["🍱", "🥗", "🍲", "🍢", "🎂", "🍣", "🍜", "🥟"],
    adjs: ["清爽", "香煎", "紅燒", "燉煮", "盛宴"],
    desc: n => `村莊廚房現做${n}，香氣飄滿整條街，貪吃系顧客聞香而來。`,
    flavor: "純展示商品・貪吃系顧客的最愛"
  }
};

// 料理放檯面有吸引力加成（spec §5.1）
const SHOP_GOOD_EXACT_ART = exports.SHOP_GOOD_EXACT_ART = Object.freeze({
  bow: "/assets/cat_equip/bow.jpg",
  "chest-armor": "/assets/cat_equip/armor.jpg"
});

// V5 視覺層：120 件商品共用 24 個穩定 visualKey。
// 沒有可信的成品圖時不硬配錯圖，改用配方主素材作為底紋，再疊上商品名稱。
// 未來新增真正商品插畫時，只要在上表補 visualKey -> public 路徑即可，不必改 UI。
const COUNTER_ATTRACTION_BONUS = exports.COUNTER_ATTRACTION_BONUS = 0.15;
function recipePoolFor(category, tier) {
  // T1/T2 只用早期六種建築資源，避免新玩家被尚未取得的後段資源卡死。
  // T3 起把採集/遠征會累積的 potion、fur，以及練箭場持續生產的 archer 正式納入 sink。
  if (category === "weapon") {
    return tier >= 3 ? ["ore", "archer", "driedfish", "can", "fur"] : ["ore", "driedfish", "can", "meat"];
  }
  if (category === "armor") {
    return tier >= 3 ? ["can", "ore", "fur", "fish", "archer"] : ["can", "ore", "melon", "fish", "driedfish"];
  }
  return tier >= 3 ? ["melon", "fish", "meat", "driedfish", "can", "potion"] : ["melon", "fish", "meat", "driedfish", "can"];
}
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
        // 依品類交錯解鎖，確保 Lv.1 就同時有武器、裝備與料理可製作，
        // 初始檯面因此不會在料理到 Lv.5 前失去用途。
        const globalIdx = i * GOODS_CATEGORIES.length + c; // 0~23（tier 內全域）
        const noun = def.nouns[i];
        const name = `${def.adjs[tier - 1]}${noun}`;
        const id = `${cat.id}_${tier}_${i}`;
        // 配方：偶數 idx 用 1 種資源，奇數用 2 種混合；總數量依 TIER_RECIPE_COUNTS
        const pool = recipePoolFor(cat.id, tier);
        const total = counts[i];
        const mainCount = i % 2 === 0 ? total : Math.ceil(total / 2);
        const subCount = i % 2 === 0 ? 0 : total - mainCount;
        const recipe = [];
        if (mainCount > 0) recipe.push({
          resource: pool[i % pool.length],
          tier,
          count: mainCount
        });
        if (subCount > 0) recipe.push({
          resource: pool[(i + 3) % pool.length],
          tier,
          count: subCount
        });
        const recipeSum = recipe.reduce((s, r) => s + r.count, 0);
        const price = Math.ceil(recipeSum * RESOURCE_WORTH[tier]);
        // 逐級解鎖：tier 內 24 件 / 6 級 = 4 件/級
        const level = range[0] + Math.floor(globalIdx / 4);
        goods.push({
          id,
          category: cat.id,
          name,
          icon: def.icons[i],
          visualKey: def.visualKeys[i],
          visualLabel: noun,
          art: SHOP_GOOD_EXACT_ART[def.visualKeys[i]] || null,
          motifArt: recipe[0] ? `/ui/village/resource-${recipe[0].resource}${tier}.webp` : null,
          desc: def.desc(noun),
          tier,
          // spec §5.4 tier 門檻與逐級解鎖取較晚者
          unlockLevel: Math.max(level, TIER_GATE[tier]),
          recipe,
          gold: TIER_GOLD[tier],
          price,
          popularity: i % 7 === 0 ? 0.9 : i % 5 === 0 ? 1.15 : 1.0,
          flavor: def.flavor
        });
      }
    }
  }
  return goods;
}
const SHOP_GOODS = exports.SHOP_GOODS = buildGoods();
const GOODS_MAP = new Map(SHOP_GOODS.map(g => [g.id, g]));
function getGoodById(id) {
  return GOODS_MAP.get(id);
}

// 依商店等級回傳已解鎖食譜（unlockLevel <= level）
function getUnlockedGoods(level) {
  return SHOP_GOODS.filter(g => g.unlockLevel <= (level || 1));
}
function getGoodsByCategory(category, level) {
  return SHOP_GOODS.filter(g => g.category === category && g.unlockLevel <= (level || 1));
}
function getGoodsByTier(tier, level) {
  return SHOP_GOODS.filter(g => g.tier === tier && g.unlockLevel <= (level || 1));
}

// V9：用玩家「已經擁有的 village.resources」算目前最能大量去化材料的商品。
// 純函式、零 Firestore；UI 直接吃 CatVillage 已經訂閱到的 resources，不增加讀取。
function getShopGoodCraftCapacity(good, resources = {}, stock = {}) {
  if (!good?.recipe?.length) return 0;
  const currentStock = Math.max(0, Math.floor(Number(stock?.[good.id]) || 0));
  const room = Math.max(0, SHOP_GOOD_STOCK_CAP - currentStock);
  if (room <= 0) return 0;
  const materialCaps = good.recipe.map(part => {
    const key = `${part.resource}_t${part.tier}`;
    return Math.floor(Math.max(0, Number(resources?.[key]) || 0) / part.count);
  });
  return Math.max(0, Math.min(room, ...materialCaps));
}

// V11：把九種資源拆成真正的 45 個 exact-tier stack，讓 UI 能直接指出「貓貓射手 T3 爆倉」。
// 這是純函式；resources 直接使用 CatVillage 已經取得的資料，不增加 Firestore read。
function getShopTierOverflowEntries(resources = {}, shop = {}) {
  const level = Math.max(1, Number(shop?.level) || 1);
  const stock = shop?.stock || {};
  return Object.entries(SHOP_VILLAGE_RESOURCE_META).flatMap(([resource, meta]) => [1, 2, 3, 4, 5].map(tier => {
    const key = `${resource}_t${tier}`;
    const amount = Math.max(0, Math.floor(Number(resources?.[key]) || 0));
    const consumers = SHOP_GOODS.filter(good => good.recipe.some(part => `${part.resource}_t${part.tier}` === key));
    const minUnlockLevel = consumers.length ? Math.min(...consumers.map(good => good.unlockLevel)) : null;
    const unlockedConsumers = consumers.filter(good => good.unlockLevel <= level);
    const actionable = amount > 0 && unlockedConsumers.some(good => getShopGoodCraftCapacity(good, resources, stock) > 0);
    return {
      key,
      resource,
      tier,
      name: meta.name,
      icon: meta.icon,
      amount,
      minUnlockLevel,
      unlocked: unlockedConsumers.length > 0,
      actionable,
      consumerCount: consumers.length
    };
  })).sort((a, b) => b.amount - a.amount || Number(b.actionable) - Number(a.actionable) || a.tier - b.tier || a.key.localeCompare(b.key));
}
function getShopSinkRecommendations(resources = {}, shop = {}, limit = 4, focusResourceKey = null) {
  const level = Math.max(1, Number(shop?.level) || 1);
  const stock = shop?.stock || {};
  const safeLimit = Math.max(1, Math.min(8, Math.floor(Number(limit) || 4)));
  const focusKey = typeof focusResourceKey === "string" && focusResourceKey ? focusResourceKey : null;
  return SHOP_GOODS.filter(good => good.unlockLevel <= level && (Number(stock[good.id]) || 0) < SHOP_GOOD_STOCK_CAP && (!focusKey || good.recipe.some(part => `${part.resource}_t${part.tier}` === focusKey))).map(good => {
    const maxCraft = getShopGoodCraftCapacity(good, resources, stock);
    const materialPerGood = good.recipe.reduce((sum, part) => sum + part.count, 0);
    const sinkUnits = maxCraft * materialPerGood;
    const sourceTotal = good.recipe.reduce((sum, part) => {
      const key = `${part.resource}_t${part.tier}`;
      return sum + Math.max(0, Number(resources?.[key]) || 0);
    }, 0);
    const focusPerGood = focusKey ? good.recipe.reduce((sum, part) => sum + (`${part.resource}_t${part.tier}` === focusKey ? part.count : 0), 0) : 0;
    const focusUnits = maxCraft * focusPerGood;
    return {
      good,
      maxCraft,
      sinkUnits,
      sourceTotal,
      focusUnits
    };
  }).filter(entry => entry.maxCraft > 0).sort((a, b) => (focusKey ? b.focusUnits - a.focusUnits : 0) || b.sinkUnits - a.sinkUnits || b.sourceTotal - a.sourceTotal || a.good.unlockLevel - b.good.unlockLevel || a.good.id.localeCompare(b.good.id)).slice(0, safeLimit);
}

// V11：目前 display 只存商品 ID，真正可販售數量就是 shop.stock。
// 因此「補貨」＝直接用原配方把同一件已上架商品加工到安全存量，不建立第二層貨架庫存。
function getShopQuickRefillPlan(resources = {}, shop = {}, goodId) {
  const good = getGoodById(goodId);
  const displayed = Boolean(good && Array.isArray(shop?.display) && shop.display.some(d => d?.goodId === goodId));
  const currentStock = Math.max(0, Math.floor(Number(shop?.stock?.[goodId]) || 0));
  const needsRefill = Boolean(good && displayed && currentStock <= SHOP_QUICK_REFILL_THRESHOLD);
  const desired = needsRefill ? Math.max(0, Math.min(SHOP_QUICK_REFILL_TARGET - currentStock, SHOP_GOOD_STOCK_CAP - currentStock)) : 0;
  const craftCapacity = good ? getShopGoodCraftCapacity(good, resources, shop?.stock || {}) : 0;
  const refillCount = Math.max(0, Math.min(desired, craftCapacity));
  return {
    goodId,
    good,
    displayed,
    currentStock,
    needsRefill,
    refillCount,
    canRefill: needsRefill && refillCount > 0,
    materialInsufficient: needsRefill && refillCount <= 0,
    threshold: SHOP_QUICK_REFILL_THRESHOLD,
    target: SHOP_QUICK_REFILL_TARGET
  };
}
