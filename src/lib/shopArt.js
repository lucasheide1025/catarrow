import { SHOP_CUSTOMERS } from "./villageShop";

const CUSTOMER_GROUPS = [
  "kitten", "worker", "elder", "scholar",
  "foodie", "fashion", "adventurer", "vip",
];
const CUSTOMER_TIERS = ["common", "rare", "legend"];

export const CUSTOMER_ART_MANIFEST = Object.freeze(Object.fromEntries(
  CUSTOMER_GROUPS.map(group => [group, Object.freeze(Object.fromEntries(
    CUSTOMER_TIERS.map(tier => [tier, `/assets/shop/customer-${group}-${tier}.webp`]),
  ))]),
));

export const GOOD_ART_MANIFEST = Object.freeze({
  weapon_0: "/assets/shop/good-bow.webp",
  weapon_1: "/assets/shop/good-crossbow.webp",
  weapon_2: "/assets/shop/good-sling.webp",
  weapon_3: "/assets/shop/good-staff.webp",
  weapon_4: "/assets/shop/good-short-sword.webp",
  weapon_5: "/assets/shop/good-long-sword.webp",
  weapon_6: "/assets/shop/good-fishbone-sword.webp",
  weapon_7: "/assets/shop/good-war-hammer.webp",
  armor_0: "/assets/shop/good-helmet.webp",
  armor_1: "/assets/shop/good-chest-armor.webp",
  armor_2: "/assets/shop/good-gloves.webp",
  armor_3: "/assets/shop/good-boots.webp",
  armor_4: "/assets/shop/good-shield.webp",
  armor_5: "/assets/shop/good-cloak.webp",
  armor_6: "/assets/shop/good-amulet.webp",
  armor_7: "/assets/shop/good-collar.webp",
  food_0: "/assets/shop/good-rice-bowl.webp",
  food_1: "/assets/shop/good-ramen.webp",
  food_2: "/assets/shop/good-sushi.webp",
  food_3: "/assets/shop/good-dumplings.webp",
  food_4: "/assets/shop/good-meat-skewer.webp",
  food_5: "/assets/shop/good-soup.webp",
  food_6: "/assets/shop/good-salad.webp",
  food_7: "/assets/shop/good-cake.webp",
});

export function getShopCustomerArt(customer) {
  const index = SHOP_CUSTOMERS.findIndex(candidate => candidate.id === customer?.id);
  const group = CUSTOMER_GROUPS[(index < 0 ? 0 : index) % CUSTOMER_GROUPS.length];
  const tier = CUSTOMER_TIERS.includes(customer?.tier) ? customer.tier : "common";
  return CUSTOMER_ART_MANIFEST[group][tier];
}

export function getShopGoodArt(good) {
  return GOOD_ART_MANIFEST[good?.visualKey] || null;
}

export const SHOP_MANAGER_OPTIONS = Object.freeze([
  ["meimei", "妹妹"], ["gege", "哥哥"], ["niuniu", "妞妞"],
  ["baobao", "寶寶"], ["daming", "大娘"], ["diandian", "顛顛"],
  ["haji", "哈吉"], ["xiaoan", "小安"], ["youyou", "悠悠"],
].map(([id, name]) => Object.freeze({ id, name, art:`/assets/shop/managers/manager-${id}.webp` })));

export function getShopManager(managerId) {
  return SHOP_MANAGER_OPTIONS.find(manager => manager.id === managerId) || SHOP_MANAGER_OPTIONS[0];
}
