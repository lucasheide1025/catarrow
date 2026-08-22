"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WEEKLY_TREASURE_PRODUCTS = exports.SPECIAL_TICKET_META = exports.SHOP_PRODUCT_MAP = exports.SHOP_PRODUCTS = exports.MATERIAL_SUPPLY_PRODUCTS = exports.DAILY_SHOP_PRODUCTS = void 0;
exports.getDailyShopProducts = getDailyShopProducts;
exports.getMaterialSupplyProducts = getMaterialSupplyProducts;
exports.getMaterialUpgradePlan = getMaterialUpgradePlan;
exports.getShopDailyKey = getShopDailyKey;
exports.getShopPeriodKey = getShopPeriodKey;
exports.getShopWeeklyKey = getShopWeeklyKey;
exports.getWeeklyShopProduct = getWeeklyShopProduct;
exports.getWeeklyShopProducts = getWeeklyShopProducts;
// 金幣商店固定商品白名單。商品不輪替，只有個人限購次數按日／週重置。
const SPECIAL_TICKET_META = exports.SPECIAL_TICKET_META = Object.freeze({
  soloBattleTicket: {
    name: "單人打怪次數券",
    icon: "🎯",
    holdCap: 5
  },
  partyBattleTicket: {
    name: "組隊打怪次數券",
    icon: "🤝",
    holdCap: 3
  },
  boardDiceTicket: {
    name: "探索骰子券",
    icon: "🎲",
    holdCap: 5
  }
});
const DAILY_SHOP_PRODUCTS = exports.DAILY_SHOP_PRODUCTS = Object.freeze([{
  id: "solo_battle_ticket",
  name: "單人打怪次數券",
  icon: "🎯",
  price: 1000,
  rarity: "rare",
  kind: "specialTicket",
  ticketId: "soloBattleTicket",
  amount: 1,
  art: "/ui/member-nav/feature-art.png",
  limit: 2,
  holdCap: 5,
  destination: "背包・特殊",
  effect: "使用後增加今日單人打怪次數 1 次。",
  desc: "額外次數保留完整戰鬥獎勵。"
}, {
  id: "party_battle_ticket",
  name: "組隊打怪次數券",
  icon: "🤝",
  price: 1500,
  rarity: "rare",
  kind: "specialTicket",
  ticketId: "partyBattleTicket",
  amount: 1,
  art: "/ui/member-nav/feature-art.png",
  limit: 1,
  holdCap: 3,
  destination: "背包・特殊",
  effect: "使用後增加今日組隊打怪次數 1 次。",
  desc: "額外次數保留完整組隊獎勵。"
}, {
  id: "board_dice_ticket",
  name: "探索骰子券",
  icon: "🎲",
  price: 750,
  rarity: "uncommon",
  kind: "specialTicket",
  ticketId: "boardDiceTicket",
  amount: 1,
  art: "/ui/cat-village/explore-map.png",
  limit: 2,
  holdCap: 5,
  destination: "背包・特殊",
  effect: "使用後立即增加 3 顆探索骰子。",
  desc: "可超過每日原有的 15 顆骰子上限。"
}, {
  id: "potion_chest",
  name: "藥水箱",
  icon: "🧪",
  price: 2000,
  rarity: "uncommon",
  kind: "chest",
  chestType: "potion",
  limit: 2,
  art: "/assets/board/tile_potion.webp",
  destination: "背包・戰利品",
  effect: "開啟後獲得 1 個隨機消耗品。",
  desc: "藥水與一般素材箱分開收納。"
}]);
const TIER_CONFIG = [{
  tier: 1,
  price: 500,
  limit: 3,
  rarity: "common"
}, {
  tier: 2,
  price: 800,
  limit: 3,
  rarity: "uncommon"
}, {
  tier: 3,
  price: 1200,
  limit: 2,
  rarity: "rare"
}, {
  tier: 4,
  price: 1800,
  limit: 2,
  rarity: "epic"
}, {
  tier: 5,
  price: 2500,
  limit: 1,
  rarity: "legendary"
}, {
  tier: 6,
  price: 3500,
  limit: 1,
  rarity: "legendary"
}];
const MATERIAL_SUPPLY_PRODUCTS = exports.MATERIAL_SUPPLY_PRODUCTS = Object.freeze(TIER_CONFIG.map(config => ({
  id: `material_chest_t${config.tier}`,
  name: `T${config.tier} 隨機族系素材箱`,
  icon: "📦",
  price: config.price,
  rarity: config.rarity,
  kind: "familyMaterialChest",
  art: `/assets/chests/chest_treasure_t${config.tier}.webp`,
  tier: config.tier,
  limit: config.limit,
  destination: "背包・戰利品",
  effect: `固定 T${config.tier}，購買時隨機決定一個族系。`,
  desc: "開啟獲得 1～3 個同族、同階的一般素材；不含小王與王級素材。"
})));
const WEEKLY_TREASURE_PRODUCTS = exports.WEEKLY_TREASURE_PRODUCTS = Object.freeze([{
  id: "king_seal",
  name: "王之印記",
  icon: "👑",
  price: 20000,
  rarity: "legendary",
  kind: "kingSeal",
  amount: 1,
  limit: 2,
  destination: "裝備資源",
  art: "/ui/coin-shop/shop-header-v1.webp",
  effect: "裝備品階突破與打洞使用。",
  desc: "每週限量供應。"
}, {
  id: "rune_fragment_bundle",
  name: "隨機符文碎片 ×5",
  icon: "🔮",
  price: 15000,
  rarity: "epic",
  kind: "runeFragments",
  amount: 5,
  limit: 2,
  destination: "裝備資源",
  art: "/assets/runes/rune_atk_t1.webp",
  effect: "隨機獲得攻擊、防禦或生命其中一種碎片 ×5。",
  desc: "同一包只會出現一種屬性。"
}, {
  id: "world_boss_dungeon_scroll",
  name: "世界王地下城卷軸",
  icon: "📜",
  price: 50000,
  rarity: "legendary",
  kind: "worldBossDungeonScroll",
  amount: 1,
  limit: 1,
  destination: "地下城",
  art: "/ui/msg-scroll-bg.webp",
  effect: "增加 1 張世界王地下城探索卷軸。",
  desc: "存入地下城實際使用的卷軸欄位。"
}, {
  id: "cat_box",
  name: "貓貓箱",
  icon: "🎐",
  price: 100000,
  rarity: "legendary",
  kind: "chest",
  chestType: "cat_box",
  limit: 1,
  destination: "背包・戰利品",
  art: "/assets/chests/chest_treasure_t6.webp",
  effect: "開啟後取得既有積分系統使用的徽章碎片。",
  desc: "現實獎勵仍由積分系統處理。"
}, {
  id: "card_pack",
  name: "怪物卡包",
  icon: "🃏",
  price: 30000,
  rarity: "epic",
  kind: "chest",
  chestType: "card_pack",
  limit: 1,
  destination: "背包・戰利品",
  art: "/ui/card-bg.webp",
  effect: "開啟後獲得 3 張隨機怪物卡片。",
  desc: "每週限量供應。"
}]);
const SHOP_PRODUCTS = exports.SHOP_PRODUCTS = Object.freeze([...DAILY_SHOP_PRODUCTS, ...MATERIAL_SUPPLY_PRODUCTS, ...WEEKLY_TREASURE_PRODUCTS]);
const SHOP_PRODUCT_MAP = exports.SHOP_PRODUCT_MAP = new Map(SHOP_PRODUCTS.map(product => [product.id, product]));
function taipeiParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
}
function getShopDailyKey(date = new Date()) {
  const {
    year,
    month,
    day
  } = taipeiParts(date);
  return `${year}-${month}-${day}`;
}
function getShopWeeklyKey(date = new Date()) {
  const {
    year,
    month,
    day
  } = taipeiParts(date);
  const utc = new Date(`${year}-${month}-${day}T00:00:00Z`);
  const weekday = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - weekday);
  return `week-${utc.toISOString().slice(0, 10)}`;
}
function getDailyShopProducts() {
  return DAILY_SHOP_PRODUCTS;
}
function getMaterialSupplyProducts() {
  return MATERIAL_SUPPLY_PRODUCTS;
}
function getWeeklyShopProducts() {
  return WEEKLY_TREASURE_PRODUCTS;
}

// 舊呼叫點相容：固定目錄的第一件珍寶，不再代表輪替商品。
function getWeeklyShopProduct() {
  return WEEKLY_TREASURE_PRODUCTS[0];
}
function getShopPeriodKey(product, date = new Date()) {
  return WEEKLY_TREASURE_PRODUCTS.some(item => item.id === product?.id) ? getShopWeeklyKey(date) : getShopDailyKey(date);
}
function getMaterialUpgradePlan(materialId, owned, exchanges, keep = 5) {
  const match = materialId?.match(/^(.+)_m([1-5])$/);
  if (!match) return null;
  const available = Math.max(0, Math.floor(Number(owned) || 0) - keep);
  const maxExchanges = Math.floor(available / 5);
  const count = exchanges === "all" ? maxExchanges : Math.min(maxExchanges, Math.max(0, Math.floor(Number(exchanges) || 0)));
  return {
    sourceId: materialId,
    targetId: `${match[1]}_m${Number(match[2]) + 1}`,
    exchanges: count,
    consume: count * 5,
    output: count,
    keep
  };
}
