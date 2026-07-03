// 金幣商店商品白名單與全服同步輪替
const FAMILIES = [
  ["ghost", "鬼怪族", "👻"], ["mountain", "山林族", "🏔️"], ["insect", "毒蟲族", "🦂"],
  ["workplace", "職場族", "💼"], ["exam", "考試族", "📝"], ["temple", "西方怪物族", "🏰"],
];

const DAILY_BASE = [
  { id:"chest_iron", name:"鐵寶箱", icon:"🧰", price:350, rarity:"common", kind:"chest", chestType:"iron", limit:2, destination:"戰利品", desc:"開出普通與非凡素材，並有機會獲得藥水。" },
  { id:"chest_gold", name:"黃金寶箱", icon:"🎁", price:700, rarity:"rare", kind:"chest", chestType:"gold", limit:1, destination:"戰利品", desc:"開出前三階素材，並有機會獲得藥水。" },
  { id:"potion_chest", name:"藥水箱", icon:"🧪", price:500, rarity:"uncommon", kind:"chest", chestType:"potion", limit:2, destination:"戰利品", desc:"必定開出 1 個隨機消耗品。" },
];

const MATERIAL_PRODUCTS = FAMILIES.flatMap(([family, label, icon]) => [1, 2, 3].map(tier => ({
  id:`mat_${family}_t${tier}`,
  name:`${label} T${tier} 素材包`,
  icon,
  price:[200, 450, 800][tier - 1],
  rarity:["common", "uncommon", "rare"][tier - 1],
  kind:"material",
  materialId:`${family}_m${tier}`,
  amount:[5, 3, 2][tier - 1],
  limit:2,
  destination:"怪物素材",
  desc:`直接獲得 ${[5, 3, 2][tier - 1]} 個指定族系 T${tier} 素材。`,
})));

const WEEKLY_PRODUCTS = [
  { id:"chest_epic", name:"史詩寶箱", icon:"💜", price:1200, rarity:"epic", kind:"chest", chestType:"epic", limit:1, destination:"戰利品", desc:"開出前四階素材，25% 機率額外獲得藥水。" },
  { id:"card_pack", name:"怪物卡包", icon:"🃏", price:1500, rarity:"epic", kind:"chest", chestType:"card_pack", limit:1, destination:"戰利品", desc:"開啟後獲得 3 張隨機怪物卡片。" },
  { id:"mimi_box", name:"咪咪箱", icon:"😺", price:2500, rarity:"legendary", kind:"chest", chestType:"mimi_box", limit:1, destination:"戰利品", desc:"隨機獲得 1 隻貓咪；重複貓咪轉為羈絆經驗。" },
  { id:"dungeon_scroll", name:"地下城卷軸", icon:"📜", price:3000, rarity:"legendary", kind:"dungeonScroll", amount:1, limit:1, destination:"特殊道具", desc:"使用後產生 1 個隨機難度地下城。" },
  { id:"gacha_coins_3", name:"扭蛋幣 ×3", icon:"🎰", price:1400, rarity:"rare", kind:"gachaCoins", amount:3, limit:1, destination:"貓貓村", desc:"獲得 3 枚扭蛋幣；箭露不會在金幣商店販售。" },
];

export const SHOP_PRODUCTS = [...DAILY_BASE, ...MATERIAL_PRODUCTS, ...WEEKLY_PRODUCTS];
export const SHOP_PRODUCT_MAP = new Map(SHOP_PRODUCTS.map(product => [product.id, product]));

function taipeiParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"Asia/Taipei", year:"numeric", month:"2-digit", day:"2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
}

export function getShopDailyKey(date = new Date()) {
  const { year, month, day } = taipeiParts(date);
  return `${year}-${month}-${day}`;
}

export function getShopWeeklyKey(date = new Date()) {
  const { year, month, day } = taipeiParts(date);
  const utc = new Date(`${year}-${month}-${day}T00:00:00Z`);
  const weekday = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - weekday);
  return `week-${utc.toISOString().slice(0, 10)}`;
}

function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function seededSelection(items, count, seed) {
  return [...items]
    .map(item => ({ item, score:hash(`${seed}:${item.id}`) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map(entry => entry.item);
}

export function getDailyShopProducts(date = new Date()) {
  return [...DAILY_BASE, ...seededSelection(MATERIAL_PRODUCTS, 3, getShopDailyKey(date))];
}

export function getWeeklyShopProduct(date = new Date()) {
  return seededSelection(WEEKLY_PRODUCTS, 1, getShopWeeklyKey(date))[0];
}

export function getShopPeriodKey(product, date = new Date()) {
  return WEEKLY_PRODUCTS.some(item => item.id === product.id)
    ? getShopWeeklyKey(date)
    : getShopDailyKey(date);
}
