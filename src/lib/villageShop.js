// src/lib/villageShop.js — 貓貓村商店販售模擬器・純邏輯（零 firebase 依賴，全部可測）

import { COUNTER_ATTRACTION_BONUS } from "./shopGoodsCatalog";
import { SPECIAL_TICKET_META } from "./shopData";
// 對應 spec：docs/second_brain/village-shop-simulator-spec.md
//
// 內容：
//   §5.3 商店等級 30 級（累計營業額門檻 + 每級獎勵）
//   §5.2 家具 7 類 × 10 階（價格 ×2 指數成長）
//   §4.2 24 位 NPC 顧客（8 族群 × 3 階）
//   §4.3/4.4 顧客累積 + 購買模擬（開店批次結算）
//   §6.3 票券兌換表（9 樣獎勵 + 每日限量）

// ────────────────────────────────────────────────────────────
// 商店等級（index 0 = Lv1；threshold = 達到此級所需的累計營業額）
// ────────────────────────────────────────────────────────────
export const SHOP_LEVEL_THRESHOLDS = [
  0,          // Lv1 開局
  300,        // Lv2
  700,        // Lv3
  1400,       // Lv4
  2600,       // Lv5
  4500,       // Lv6
  7500,       // Lv7
  12000,      // Lv8
  18500,      // Lv9
  28000,      // Lv10
  41000,      // Lv11
  59000,      // Lv12
  84000,      // Lv13
  118000,     // Lv14
  165000,     // Lv15
  230000,     // Lv16
  320000,     // Lv17
  440000,     // Lv18
  600000,     // Lv19
  820000,     // Lv20
  1100000,    // Lv21
  1450000,    // Lv22
  1900000,    // Lv23
  2450000,    // Lv24
  3100000,    // Lv25
  3900000,    // Lv26
  4900000,    // Lv27
  6100000,    // Lv28
  7500000,    // Lv29
  9200000,    // Lv30
];

export const MAX_SHOP_LEVEL = SHOP_LEVEL_THRESHOLDS.length; // 30

// 每級獎勵（speed = +%客速；cap = +顧客上限；其他欄位供 UI 里程碑顯示）
const LEVEL_REWARDS = {
  2:  { speed: 4 },  3:  { speed: 4, customer: "大食客貓" },
  4:  { cap: 4 },    5:  { speed: 4, customer: "獵人貓" },
  6:  { cap: 4 },    7:  { speed: 4, customer: "貴族貓" },
  8:  { cap: 5 },    9:  { speed: 4, customer: "貓議員" },
  10: { speed: 5, customer: "美食家貓", milestone: "★ 招牌" },
  11: { cap: 5 },    12: { speed: 5, customer: "幻影貓" },
  13: { cap: 5, customer: "傳奇勇者貓" },  14: { speed: 5 },
  15: { cap: 6, customer: "富商貓" },      16: { speed: 5, customer: "女王貓" },
  17: { cap: 6 },    18: { speed: 6, customer: "古董商貓" },
  19: { cap: 7 },    20: { speed: 6, customer: "貓神", milestone: "★★ 招牌" },
  21: { cap: 8, customer: "觀光團長貓" },  22: { speed: 6 },
  23: { cap: 8, customer: "異世界貓" },    24: { speed: 7 },
  25: { cap: 10, milestone: "🎉 25 級里程碑" },
  26: { speed: 7, customer: "圖鑑大師貓" }, 27: { cap: 10 },
  28: { speed: 8, customer: "銀行家貓" },  29: { cap: 12 },
  30: { speed: 10, cap: 15, customer: "異國商隊貓", milestone: "🏆 傳說招牌" },
};

// 依累計營業額回傳商店等級（1~30）
export function getShopLevel(totalRevenue) {
  const rev = Number(totalRevenue) || 0;
  let level = 1;
  for (let i = 0; i < SHOP_LEVEL_THRESHOLDS.length; i++) {
    if (rev >= SHOP_LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

// 累計至 level 的客速加成（%）
export function getShopSpeedBonus(level) {
  let sum = 0;
  for (let lv = 2; lv <= level; lv++) sum += LEVEL_REWARDS[lv]?.speed || 0;
  return sum;
}

// 累計至 level 的顧客上限加成
export function getShopCapBonus(level) {
  let sum = 0;
  for (let lv = 2; lv <= level; lv++) sum += LEVEL_REWARDS[lv]?.cap || 0;
  return sum;
}

export function getLevelReward(level) {
  return LEVEL_REWARDS[level] || null;
}

// 下一級的門檻與進度（供進度條）
export function getLevelProgress(totalRevenue) {
  const level = getShopLevel(totalRevenue);
  const next = level >= MAX_SHOP_LEVEL ? null : SHOP_LEVEL_THRESHOLDS[level];
  const cur  = level >= 2 ? SHOP_LEVEL_THRESHOLDS[level - 1] : 0;
  const rev  = Number(totalRevenue) || 0;
  return {
    level,
    next,
    cur,
    pct: next ? Math.min(100, Math.round(((rev - cur) / (next - cur)) * 100)) : 100,
    maxed: level >= MAX_SHOP_LEVEL,
  };
}

// ────────────────────────────────────────────────────────────
// 家具（7 類；價格 = base × 2^(lv-1)，luckyCat/starLamp 只 1 階）
// ────────────────────────────────────────────────────────────
export const FURNITURE_DEFS = {
  cabinet:  { id: "cabinet",  name: "櫃子",   icon: "🗄️", base: 100,   maxLevel: 10, effect: "每級 +1 格位",     liveEffect: "即時營業：補貨動作會逐級加快。", desc: "更多展示空間，可擺更多商品。" },
  counter:  { id: "counter",  name: "檯面",   icon: "🧺", base: 80,    maxLevel: 10, effect: "每級 +1 格位，料理吸引力 +15%", liveEffect: "即時營業：妹妹的收銀結帳會逐級加快。", desc: "寬敞的料理檯，擺料理特別吸引人。" },
  flower:   { id: "flower",   name: "花飾",   icon: "🌸", base: 150,   maxLevel: 10, effect: "每級 +8% 客速",   liveEffect: "即時營業：提升招客節奏，也讓排隊顧客更有耐心。", desc: "芬芳花飾吸引貓貓上門。" },
  flag:     { id: "flag",     name: "旗幟",   icon: "🎏", base: 120,   maxLevel: 10, effect: "每級 +8 顧客上限", liveEffect: "即時營業：Lv.3 起店內可同時容納 3 位顧客。", desc: "飄揚的旗幟讓更多貓貓駐足。" },
  sign:     { id: "sign",     name: "招牌",   icon: "🏪", base: 300,   maxLevel: 10, effect: "每級 +10% 客速",  liveEffect: "即時營業：讓下一位顧客更快推門進店。", desc: "醒目的招牌讓遠方的貓貓也聞名而來。" },
  luckyCat: { id: "luckyCat", name: "招財貓", icon: "🐈", base: 10000, maxLevel: 1,  effect: "+25% 客速",      liveEffect: "即時營業：一次大幅提升店內招客節奏。", desc: "舉起招財小手的幸運貓！" },
  starLamp: { id: "starLamp", name: "星塵燈", icon: "🌠", base: 16000, maxLevel: 1,  effect: "+10% 顧客上限",  liveEffect: "即時營業：直接開放 3 人同場，並大幅提升排隊耐性。", desc: "星塵光芒映照，店內人氣高漲。" },
};

export function getFurniturePrice(fid, currentLevel) {
  const def = FURNITURE_DEFS[fid];
  if (!def) return 0;
  if (currentLevel >= def.maxLevel) return 0; // 已滿級
  return def.base * Math.pow(2, currentLevel); // 下一階價格（Lv0→base, Lv1→base×2…）
}

export function getFurnitureTotalPrice(fid, targetLevel) {
  const def = FURNITURE_DEFS[fid];
  if (!def) return 0;
  let sum = 0;
  for (let lv = 0; lv < targetLevel; lv++) sum += def.base * Math.pow(2, lv);
  return sum;
}

// 攤位格位數（開局 1 櫃 + 1 檯 = 2 格；滿級 11 + 10 = 21 格）
export function calcShopSlots(furniture) {
  const f = furniture || {};
  return ((f.cabinet || 1)) + ((f.counter || 1));
}

// V10：規劃「加工後順手上架」的展示位置（純函式，零 Firebase）。
// 已展示商品維持原位；料理優先 counter，武器/裝備優先 cabinet；滿格時絕不覆蓋既有陳列。
export function planQuickShopDisplay(shop, goodId, category) {
  const capacity = calcShopSlots(shop?.furniture);
  const display = (Array.isArray(shop?.display) ? shop.display : [])
    .slice(0, capacity)
    .map(d => ({ slot:d?.slot || "counter", goodId:d?.goodId || null }));
  while (display.length < capacity) display.push({ slot:"counter", goodId:null });

  const existingIndex = display.findIndex(d => d.goodId === goodId);
  if (existingIndex >= 0) {
    return {
      display,
      index:existingIndex,
      slot:display[existingIndex].slot,
      alreadyDisplayed:true,
      full:false,
      changed:false,
    };
  }

  const preferredSlot = category === "food" ? "counter" : "cabinet";
  let index = display.findIndex(d => !d.goodId && d.slot === preferredSlot);
  if (index < 0) index = display.findIndex(d => !d.goodId);
  if (index < 0) {
    return { display, index:-1, slot:null, alreadyDisplayed:false, full:true, changed:false };
  }

  const next = display.map(d => ({ ...d }));
  next[index] = { ...next[index], goodId };
  return {
    display:next,
    index,
    slot:next[index].slot,
    alreadyDisplayed:false,
    full:false,
    changed:true,
  };
}

// 客速（位/分鐘）：基礎 1 × (1+等級加成) × 花飾 × 招牌 × 招財貓
export function calcShopRate(furniture, level) {
  const f = furniture || {};
  const speedBonus = 1 + getShopSpeedBonus(level || 1) / 100;
  const flowerMult = 1 + 0.08 * (f.flower || 0);
  const signMult   = 1 + 0.10 * (f.sign || 0);
  const luckyMult  = 1 + 0.25 * (f.luckyCat || 0);
  return speedBonus * flowerMult * signMult * luckyMult;
}

// 顧客上限：原本的基礎＋裝修／等級完整結果 ×5，讓手動營業有足夠客潮可消耗。
export function calcShopCap(furniture, level) {
  const f = furniture || {};
  const base = 10 + 8 * (f.flag || 0) + getShopCapBonus(level || 1);
  return Math.round(base * (1 + 0.10 * (f.starLamp || 0))) * 5;
}

export function getShopLastVisitedMs(shop, fallbackNow = Date.now()) {
  if (typeof shop?.lastVisitedAt === "number") return shop.lastVisitedAt;
  const timestampMs = shop?.lastVisitedAt?.toMillis?.();
  return Number.isFinite(timestampMs) ? timestampMs : fallbackNow;
}

// 等待顧客數（沿用村莊產能模式：真實時間累積，cap 上限）
export function calcWaitingVisitors(shop, now = Date.now()) {
  const lastMs = getShopLastVisitedMs(shop, now);
  const elapsedMin = Math.max(0, (now - lastMs) / 60000);
  const rate = calcShopRate(shop?.furniture, shop?.level);
  const cap  = calcShopCap(shop?.furniture, shop?.level);
  return Math.min(cap, Math.floor(elapsedMin * rate));
}

// ────────────────────────────────────────────────────────────
// 24 位 NPC 顧客（spec §4.2：8 族群 × 3 階）
// mode: pref=依偏好加權抽 / random=隨機 / collector=各類別都要
// ────────────────────────────────────────────────────────────
export const SHOP_CUSTOMERS = [
  // ── 常見（開局，weight 30）───────────────────────────────
  { id: "小貓仔",     name: "小貓仔",     emoji: "🐱", tier: "common", group: "貪吃系", unlockLevel: 1,  weight: 30, mode: "pref",  affinities: { food: 0.7 },                    minTier: 1, maxTier: 2, qtyMin: 1, qtyMax: 1, priceMult: 1.0, line: "喵～想吃點香香的！" },
  { id: "冒險貓",     name: "冒險貓",     emoji: "🐈", tier: "common", group: "冒險系", unlockLevel: 1,  weight: 30, mode: "pref",  affinities: { weapon: 0.6 },                  minTier: 1, maxTier: 5, qtyMin: 1, qtyMax: 2, priceMult: 1.0, line: "我要帶新武器去探險！" },
  { id: "淑女貓",     name: "淑女貓",     emoji: "🐩", tier: "common", group: "裝扮系", unlockLevel: 1,  weight: 30, mode: "pref",  affinities: { armor: 0.55 },                   minTier: 1, maxTier: 5, qtyMin: 1, qtyMax: 1, priceMult: 1.0, line: "這件好適合我～" },
  { id: "貓村長",     name: "貓村長",     emoji: "🧓", tier: "common", group: "村莊系", unlockLevel: 1,  weight: 30, mode: "pref",  affinities: { weapon: 0.34, armor: 0.33, food: 0.33 }, minTier: 1, maxTier: 5, qtyMin: 1, qtyMax: 1, priceMult: 2.0, line: "村莊的商店越來越熱鬧了，很好！" },
  { id: "神秘貓",     name: "神秘貓",     emoji: "🕵️", tier: "common", group: "神秘系", unlockLevel: 1,  weight: 15, mode: "random", affinities: {},                            minTier: 1, maxTier: 5, qtyMin: 1, qtyMax: 1, priceMult: 3.0, line: "這件商品…有我見過的痕跡。" },
  { id: "批發貓",     name: "批發貓",     emoji: "🛒", tier: "common", group: "批量系", unlockLevel: 1,  weight: 30, mode: "pref",  affinities: { food: 0.5, weapon: 0.5 },          minTier: 1, maxTier: 5, qtyMin: 3, qtyMax: 5, priceMult: 0.8, line: "這批我全包了，算便宜點？" },
  { id: "收藏貓",     name: "收藏貓",     emoji: "🧺", tier: "common", group: "收藏系", unlockLevel: 1,  weight: 25, mode: "collector", affinities: {},                        minTier: 1, maxTier: 5, qtyMin: 1, qtyMax: 1, priceMult: 1.0, line: "每種都要一件，我要蒐集整套！" },
  { id: "旅行貓",     name: "旅行貓",     emoji: "🎪", tier: "common", group: "旅行系", unlockLevel: 1,  weight: 25, mode: "random", affinities: {},                            minTier: 1, maxTier: 5, qtyMin: 1, qtyMax: 1, priceMult: 1.0, line: "路過這間店，帶個紀念品走吧！" },
  // ── 稀有（weight 10）──────────────────────────────────────
  { id: "大食客貓",   name: "大食客貓",   emoji: "😋", tier: "rare", group: "貪吃系", unlockLevel: 3,  weight: 10, mode: "pref",  affinities: { food: 0.8 },                    minTier: 3, maxTier: 5, qtyMin: 2, qtyMax: 4, priceMult: 1.3, line: "哇，這香味…老闆再來一盤！" },
  { id: "獵人貓",     name: "獵人貓",     emoji: "🏹", tier: "rare", group: "冒險系", unlockLevel: 5,  weight: 10, mode: "pref",  affinities: { weapon: 0.75 },                  minTier: 3, maxTier: 5, qtyMin: 2, qtyMax: 3, priceMult: 1.2, line: "這把弓的工藝不錯，我要了。" },
  { id: "貴族貓",     name: "貴族貓",     emoji: "🎩", tier: "rare", group: "裝扮系", unlockLevel: 7,  weight: 10, mode: "pref",  affinities: { armor: 0.7 },                    minTier: 3, maxTier: 5, qtyMin: 1, qtyMax: 2, priceMult: 1.5, line: "品味還行，買來賞玩吧。" },
  { id: "貓議員",     name: "貓議員",     emoji: "🏛️", tier: "rare", group: "村莊系", unlockLevel: 9,  weight: 10, mode: "pref",  affinities: { weapon: 0.34, armor: 0.33, food: 0.33 }, minTier: 4, maxTier: 5, qtyMin: 1, qtyMax: 1, priceMult: 2.5, line: "高級貨才有資格進議員的會客室。" },
  { id: "幻影貓",     name: "幻影貓",     emoji: "👻", tier: "rare", group: "神秘系", unlockLevel: 12, weight: 6,  mode: "random", affinities: {},                            minTier: 1, maxTier: 5, qtyMin: 1, qtyMax: 2, priceMult: 4.0, line: "（飄過）這件…與我有緣。" },
  { id: "富商貓",     name: "富商貓",     emoji: "💰", tier: "rare", group: "批量系", unlockLevel: 15, weight: 10, mode: "pref",  affinities: { food: 0.5, weapon: 0.5 },          minTier: 1, maxTier: 5, qtyMin: 5, qtyMax: 8, priceMult: 0.9, line: "量夠大的話，價錢好談。" },
  { id: "古董商貓",   name: "古董商貓",   emoji: "🏺", tier: "rare", group: "收藏系", unlockLevel: 18, weight: 10, mode: "collector2", affinities: {},                       minTier: 3, maxTier: 5, qtyMin: 1, qtyMax: 2, priceMult: 1.4, line: "武器跟裝備各來幾件，轉手能增值。" },
  { id: "觀光團長貓", name: "觀光團長貓", emoji: "📸", tier: "rare", group: "旅行系", unlockLevel: 21, weight: 10, mode: "random", affinities: {},                            minTier: 1, maxTier: 5, qtyMin: 2, qtyMax: 3, priceMult: 1.6, line: "帶團路過，給團員們買點伴手禮！" },
  // ── 傳說（weight 3）──────────────────────────────────────
  { id: "美食家貓",   name: "美食家貓",   emoji: "🍽️", tier: "legend", group: "貪吃系", unlockLevel: 10, weight: 3,  mode: "pref",  affinities: { food: 0.9 },                    minTier: 5, maxTier: 5, qtyMin: 3, qtyMax: 5, priceMult: 2.0, line: "這道料理，足以登上美食月刊的封面。" },
  { id: "傳奇勇者貓", name: "傳奇勇者貓", emoji: "🦸", tier: "legend", group: "冒險系", unlockLevel: 13, weight: 3,  mode: "pref",  affinities: { weapon: 0.85 },                  minTier: 5, maxTier: 5, qtyMin: 2, qtyMax: 4, priceMult: 2.5, line: "傳說之兵，值得最強的貓來用！" },
  { id: "女王貓",     name: "女王貓",     emoji: "👑", tier: "legend", group: "裝扮系", unlockLevel: 16, weight: 3,  mode: "pref",  affinities: { armor: 0.85 },                   minTier: 5, maxTier: 5, qtyMin: 2, qtyMax: 2, priceMult: 3.0, line: "勉為其難收下吧，這是你的榮幸。" },
  { id: "貓神",       name: "貓神",       emoji: "🌟", tier: "legend", group: "村莊系", unlockLevel: 20, weight: 3,  mode: "pref",  affinities: { weapon: 0.34, armor: 0.33, food: 0.33 }, minTier: 1, maxTier: 5, qtyMin: 3, qtyMax: 3, priceMult: 5.0, line: "凡間的手藝，也算有趣。" },
  { id: "異世界貓",   name: "異世界貓",   emoji: "🌌", tier: "legend", group: "神秘系", unlockLevel: 23, weight: 3,  mode: "random", affinities: {},                            minTier: 1, maxTier: 5, qtyMin: 2, qtyMax: 3, priceMult: 8.0, line: "這世界的商品，帶回去研究研究。" },
  { id: "銀行家貓",   name: "銀行家貓",   emoji: "🏦", tier: "legend", group: "批量系", unlockLevel: 28, weight: 3,  mode: "pref",  affinities: { food: 0.34, weapon: 0.33, armor: 0.33 }, minTier: 1, maxTier: 5, qtyMin: 10, qtyMax: 15, priceMult: 1.5, line: "庫存有多少？我全都要。" },
  { id: "圖鑑大師貓", name: "圖鑑大師貓", emoji: "📖", tier: "legend", group: "收藏系", unlockLevel: 26, weight: 3,  mode: "collector2", affinities: {},                       minTier: 1, maxTier: 5, qtyMin: 2, qtyMax: 2, priceMult: 2.5, line: "每類都來兩件，補齊我的圖鑑。" },
  { id: "異國商隊貓", name: "異國商隊貓", emoji: "🐫", tier: "legend", group: "旅行系", unlockLevel: 30, weight: 3,  mode: "random", affinities: {},                            minTier: 1, maxTier: 5, qtyMin: 3, qtyMax: 5, priceMult: 3.0, line: "遠方的奇珍，裝滿我的商隊！" },
];

export function getUnlockedCustomers(level) {
  return SHOP_CUSTOMERS.filter(c => c.unlockLevel <= (level || 1));
}

// 加權抽一位顧客（rng 注入以便測試）
export function pickCustomer(level, rng = Math.random) {
  const pool = getUnlockedCustomers(level);
  const total = pool.reduce((s, c) => s + c.weight, 0);
  let roll = rng() * total;
  for (const c of pool) {
    roll -= c.weight;
    if (roll <= 0) return c;
  }
  return pool[pool.length - 1];
}

function rndInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// 依顧客偏好抽一件商品（displayed = 已上架且有庫存的 good）
// 先依 minTier/maxTier 過濾（spec §4.2「T3+＝偏好 T≥3」）；沒有符合的退回全部（「退回一般隨機」）
function pickGoodForCustomer(customer, displayed, rng) {
  if (!displayed.length) return null;
  const tierFiltered = displayed.filter(d =>
    (!customer.minTier || d.good.tier >= customer.minTier) &&
    (!customer.maxTier || d.good.tier <= customer.maxTier)
  );
  const pool = tierFiltered.length ? tierFiltered : displayed;
  const byCat = {};
  pool.forEach(d => { (byCat[d.good.category] = byCat[d.good.category] || []).push(d); });

  if (customer.mode === "collector" || customer.mode === "collector2") {
    // 各類別都買：collector = 每類 1 件；collector2 = 武器+裝備各 1~2（古董商）或每類各 N
    const targets = customer.mode === "collector2"
      ? ["weapon", "armor"]
      : ["weapon", "armor", "food"];
    const picks = [];
    for (const cat of targets) {
      const list = byCat[cat] || [];
      if (!list.length) continue;
      const per = customer.mode === "collector2"
        ? rndInt(rng, customer.qtyMin, customer.qtyMax)
        : customer.qtyMin;
      for (let i = 0; i < per; i++) picks.push(list[Math.floor(rng() * list.length)]);
    }
    return picks.length ? picks : null;
  }

  // pref / random：抽出 qty 件（可重複）
  let picks = [];
  const qty = rndInt(rng, customer.qtyMin, customer.qtyMax);
  for (let i = 0; i < qty; i++) {
    if (customer.mode === "random") {
      picks.push(pool[Math.floor(rng() * pool.length)]);
    } else {
      const weights = pool.map(d => {
        const affinity = customer.affinities?.[d.good.category] ?? 0.2;
        const popularity = d.good.popularity ?? 1;
        const counterBonus = d.slot === "counter" && d.good.category === "food" ? 1 + COUNTER_ATTRACTION_BONUS : 1;
        return Math.max(0.01, affinity * popularity * counterBonus);
      });
      const total = weights.reduce((s, w) => s + w, 0);
      let roll = rng() * total;
      let chosen = pool[pool.length - 1];
      for (let j = 0; j < pool.length; j++) {
        roll -= weights[j];
        if (roll <= 0) { chosen = pool[j]; break; }
      }
      picks.push(chosen);
    }
  }
  return picks;
}

// 開店結算（純函式）：回傳這次營業的全部購買計畫，DB 端套用
// shop = { display:[{slot,goodId,qty}], stock:{goodId:count}, furniture, level, lastVisitedAt, stats }
// goodsMap = { goodId: good }（由呼叫端注入目錄，避免此檔相依商品目錄）
export function simulateServe(shop, { now = Date.now(), rng = Math.random, goodsMap = {} } = {}) {
  const display = (shop?.display || []).filter(d => d && d.goodId);
  const stock   = { ...(shop?.stock || {}) };
  // 解析 good 並過濾庫存
  const displayed = [];
  for (const d of display) {
    const good = goodsMap[d.goodId];
    if (!good) continue;
    const have = stock[d.goodId] || 0;
    if (have <= 0) continue;
    displayed.push({ ...d, good, available: have });
  }

  const waiting = calcWaitingVisitors(shop, now);
  const customers = [];
  for (let i = 0; i < waiting; i++) customers.push(pickCustomer(shop?.level || 1, rng));

  const sales = [];
  const disappointed = [];
  const events = [];
  const newCustomers = new Set();
  let totalTickets = 0;
  let totalItems = 0;
  let customersServed = 0;

  for (const customer of customers) {
    const picks = pickGoodForCustomer(customer, displayed, rng);
    if (!picks || picks.length === 0) {
      disappointed.push(customer.id);
      events.push({
        customerId: customer.id,
        customerName: customer.name,
        customerEmoji: customer.emoji,
        customerLine: customer.line,
        outcome: "disappointed",
        items: [],
        tickets: 0,
      });
      continue;
    }
    // 依序購買（庫存不足就買少的；全無庫存跳過）
    const perSale = { customerId: customer.id, customerName: customer.name, customerEmoji: customer.emoji, items: [] };
    let saleTickets = 0;
    for (const pick of picks) {
      const good = pick.good;
      const have = stock[good.id] || 0;
      if (have <= 0) continue;
      const qty = 1; // 每抽 1 件；庫存扣 1
      stock[good.id] = have - 1;
      const tickets = Math.round(good.price * customer.priceMult);
      saleTickets += tickets;
      totalItems += 1;
      perSale.items.push({ goodId: good.id, goodName: good.name, goodIcon: good.icon, category: good.category, tier: good.tier, qty, tickets });
    }
    if (perSale.items.length) {
      // ⚠️ 只在實際成交後才計入 served／發現（避免與 disappointed 重複計數）
      customersServed += 1;
      newCustomers.add(customer.id);
      perSale.tickets = saleTickets;
      sales.push(perSale);
      events.push({
        customerId: customer.id,
        customerName: customer.name,
        customerEmoji: customer.emoji,
        customerLine: customer.line,
        outcome: "sale",
        items: perSale.items,
        tickets: saleTickets,
      });
      totalTickets += saleTickets;
    } else {
      disappointed.push(customer.id);
      events.push({
        customerId: customer.id,
        customerName: customer.name,
        customerEmoji: customer.emoji,
        customerLine: customer.line,
        outcome: "disappointed",
        items: [],
        tickets: 0,
      });
    }
  }

  const oldRevenue = (shop?.stats?.totalRevenue) || 0;
  return {
    waiting,
    served: customersServed,
    disappointed: disappointed.length,
    events,
    sales,
    totalTickets,
    totalItems,
    newCustomers: [...newCustomers],
    stockAfter: stock,
    // 等級推進（供 DB 寫入 stats.totalRevenue 後重新推導）
    oldLevel: getShopLevel(oldRevenue),
    newLevel: getShopLevel(oldRevenue + totalTickets),
    oldRevenue,
  };
}

// ────────────────────────────────────────────────────────────
// 票券兌換表（經濟 v2）
// 材料箱指定族系 / 指定 T 級，同 T 級七族共用每日額度；稀有獎勵改採每週限購。
// ────────────────────────────────────────────────────────────
const SHOP_MATERIAL_FAMILIES = [
  { id: "ghost", icon: "👻", label: "鬼怪族" },
  { id: "mountain", icon: "🏔️", label: "山林族" },
  { id: "insect", icon: "🦂", label: "毒蟲族" },
  { id: "workplace", icon: "💼", label: "職場族" },
  { id: "exam", icon: "📝", label: "考試族" },
  { id: "temple", icon: "⛩️", label: "西方怪物族" },
  { id: "treasure", icon: "🎁", label: "寶箱族" },
];

const SHOP_MATERIAL_TIER_CONFIG = {
  1: { price: 15, unlockLevel: 1 },
  2: { price: 25, unlockLevel: 7 },
  3: { price: 40, unlockLevel: 13 },
  4: { price: 60, unlockLevel: 19 },
  5: { price: 90, unlockLevel: 25 },
};

const SHOP_MATERIAL_REWARDS = Object.entries(SHOP_MATERIAL_TIER_CONFIG).flatMap(([tierText, cfg]) => {
  const tierIndex = Number(tierText);
  return SHOP_MATERIAL_FAMILIES.map(family => ({
    id: `mat_${family.id}_t${tierIndex}`,
    type: "family_mat",
    family: family.id,
    tierIndex,
    icon: family.icon,
    label: `${family.label} T${tierIndex} 材料箱`,
    price: cfg.price,
    period: "unlimited",
    unlockLevel: cfg.unlockLevel,
  }));
});

const SHOP_SPECIAL_TICKET_PRICES = Object.freeze({
  soloBattleTicket: 500,
  partyBattleTicket: 750,
  boardDiceTicket: 400,
});

const SHOP_SPECIAL_TICKET_REWARDS = Object.entries(SPECIAL_TICKET_META).map(([ticketId, meta]) => ({
  id: ticketId,
  type: "special_ticket",
  ticketId,
  icon: meta.icon,
  label: meta.name,
  price: SHOP_SPECIAL_TICKET_PRICES[ticketId],
  dailyLimit: 1,
  period: "daily",
  unlockLevel: 1,
  holdCap: meta.holdCap,
}));

export const SHOP_EXCHANGE_REWARDS = [
  ...SHOP_MATERIAL_REWARDS,
  ...SHOP_SPECIAL_TICKET_REWARDS,
  { id: "potion", type: "potion", family: null, icon: "🧪", label: "藥水箱", price: 40, dailyLimit: 2, period: "daily", unlockLevel: 1 },
  { id: "card_pack", type: "card_pack", family: null, icon: "🃏", label: "怪物卡包 ×3", price: 600, weeklyLimit: 1, period: "weekly", unlockLevel: 13 },
];

export function getExchangeRewardById(id) {
  return SHOP_EXCHANGE_REWARDS.find(r => r.id === id) || null;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function weekStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

export function getExchangeUsed(shop, rewardId) {
  const reward = getExchangeRewardById(rewardId);
  if (!reward) return 0;
  const ex = shop?.exchange || {};
  if (reward.type === "special_ticket") {
    if (ex.date !== todayStr()) return 0;
    return Math.max(0, Math.floor(Number(ex.daily?.specialTickets?.[reward.ticketId]) || 0));
  }
  const key = reward.limitKey || reward.id;
  if (reward.period === "weekly") {
    if (ex.week !== weekStr()) return 0;
    return ex.weeklyCounts?.[key] || 0;
  }
  if (ex.date !== todayStr()) return 0;
  return ex.counts?.[key] || 0;
}

export function getExchangeRemaining(shop, rewardId) {
  const reward = getExchangeRewardById(rewardId);
  if (!reward) return 0;
  if (reward.period === "unlimited") return Infinity;
  const limit = reward.period === "weekly" ? reward.weeklyLimit : reward.dailyLimit;
  return Math.max(0, (limit || 0) - getExchangeUsed(shop, rewardId));
}

// Public exchange seam: UI previews and the DB transaction share exactly the
// same catalog, daily-limit, balance, and special-item hold-cap validation.
export function planShopExchange(shop, rewardId, count = 1, specialItems = {}) {
  if (!Number.isFinite(count) || !Number.isInteger(count) || count < 1) throw new Error("參數錯誤");
  const reward = getExchangeRewardById(rewardId);
  if (!reward) throw new Error("找不到兌換項目");
  if ((shop?.level || 1) < (reward.unlockLevel || 1)) throw new Error(`商店 Lv.${reward.unlockLevel} 才能兌換`);
  const remaining = getExchangeRemaining(shop, rewardId);
  const periodLabel = reward.period === "weekly" ? "本週" : "今日";
  if (count > remaining) throw new Error(`${periodLabel}限購剩 ${remaining} 次`);
  const cost = reward.price * count;
  if ((shop?.tickets || 0) < cost) throw new Error(`票券不足（需 ${cost.toLocaleString()}）`);

  if (reward.type !== "special_ticket") return { reward, count, cost };
  const held = Math.max(0, Math.floor(Number(specialItems?.[reward.ticketId]) || 0));
  const heldAfter = held + count;
  if (heldAfter > reward.holdCap) throw new Error(`${reward.label}持有上限 ${reward.holdCap}`);
  return { reward, count, cost, ticketId:reward.ticketId, held, heldAfter };
}

export const SHOP_RUSH_SECONDS_PER_TEN_ARROWS = 60;
export const SHOP_RUSH_SECONDS_CAP = 30 * 60;

// 在「確認下課」成功後以官方累計箭數呼叫。回傳完整持久化欄位與本次差額，
// 讓呼叫端可在 transaction 內寫入 checkpoint，重送同一累計值時不會重複發放。
export function claimShopRushTime(shop, officialArrowTotal) {
  const previousTotal = Math.max(0, Math.floor(Number(shop?.rushClaimedArrowTotal) || 0));
  const nextTotal = Math.max(previousTotal, Math.floor(Number(officialArrowTotal) || 0));
  const claimedArrowDelta = nextTotal - previousTotal;
  const combinedArrows = Math.max(0, Math.min(9, Math.floor(Number(shop?.rushArrowRemainder) || 0)))
    + claimedArrowDelta;
  const convertedSets = Math.floor(combinedArrows / 10);
  const currentSeconds = Math.max(0, Math.min(SHOP_RUSH_SECONDS_CAP, Math.floor(Number(shop?.rushSeconds) || 0)));
  const rushSeconds = Math.min(
    SHOP_RUSH_SECONDS_CAP,
    currentSeconds + convertedSets * SHOP_RUSH_SECONDS_PER_TEN_ARROWS,
  );

  return {
    rushSeconds,
    rushArrowRemainder: combinedArrows % 10,
    rushClaimedArrowTotal: nextTotal,
    claimedArrowDelta,
    awardedSeconds: rushSeconds - currentSeconds,
    isReplay: claimedArrowDelta === 0,
  };
}

// ────────────────────────────────────────────────────────────
// 預設商店狀態（新帳號 / 缺欄位補齊用）
// ────────────────────────────────────────────────────────────
export function defaultShopState(now = Date.now()) {
  return {
    level: 1,
    tickets: 0,
    stock: {},
    display: [
      { slot: "cabinet", goodId: null, qty: 0 },
      { slot: "counter", goodId: null, qty: 0 },
    ],
    furniture: { cabinet: 1, counter: 1, flower: 0, flag: 0, sign: 0, luckyCat: 0, starLamp: 0 },
    managerId: "meimei",
    lastVisitedAt: now - 60 * 60000, // 首次開店即有 ~1 小時累積（開場驚喜）
    stats: { totalSales: 0, totalTickets: 0, customersServed: 0, totalRevenue: 0, discoveredCustomers: [], customerLog: [] },
    exchange: { date: todayStr(), counts: {}, daily: { specialTickets:{} }, week: weekStr(), weeklyCounts: {} },
    rushSeconds: 0,
    rushArrowRemainder: 0,
    rushClaimedArrowTotal: 0,
    lastAutoSaleAt: now,
    createdAt: now,
  };
}

// 把舊/缺欄位的 shop 補齊（不覆蓋既有值）
export function normalizeShop(raw) {
  const base = defaultShopState(0);
  if (!raw || typeof raw !== "object") return defaultShopState(Date.now());
  const furniture = { ...(base.furniture || {}), ...(raw.furniture || {}) };
  const display = Array.isArray(raw.display) && raw.display.length
    ? raw.display
    : base.display;
  const stats = { ...(base.stats || {}), ...(raw.stats || {}) };
  const rawExchange = raw.exchange || {};
  const exchange = {
    ...rawExchange,
    date: todayStr(),
    counts: rawExchange.date === todayStr() ? { ...(rawExchange.counts || {}) } : {},
    daily: {
      ...(rawExchange.daily || {}),
      specialTickets: rawExchange.date === todayStr()
        ? { ...(rawExchange.daily?.specialTickets || {}) }
        : {},
    },
    week: weekStr(),
    weeklyCounts: rawExchange.week === weekStr() ? { ...(rawExchange.weeklyCounts || {}) } : {},
  };
  const out = {
    ...base,
    ...raw,
    furniture,
    display,
    stats,
    exchange,
  };
  // 等級由營業額推導（若手動存過舊 level 則以營業額為準）
  out.level = getShopLevel(out.stats?.totalRevenue || 0);
  out.tickets = Math.max(0, Number(out.tickets) || 0);
  out.rushSeconds = Math.max(0, Math.min(SHOP_RUSH_SECONDS_CAP, Math.floor(Number(out.rushSeconds) || 0)));
  out.rushArrowRemainder = Math.max(0, Math.min(9, Math.floor(Number(out.rushArrowRemainder) || 0)));
  out.rushClaimedArrowTotal = Math.max(0, Math.floor(Number(out.rushClaimedArrowTotal) || 0));
  return out;
}
