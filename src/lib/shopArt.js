// Explicit ID mapping. Each portrait was visually reviewed; filenames describe
// the illustrated archetype, which does not always match the old customer array order.
const customerArt = (archetype, tier) => `/assets/shop/customer-${archetype}-${tier}.webp`;
export const CUSTOMER_ART_MANIFEST = Object.freeze({
  小貓仔:customerArt("kitten", "common"), 冒險貓:customerArt("foodie", "common"),
  淑女貓:customerArt("scholar", "common"), 貓村長:customerArt("elder", "common"),
  神秘貓:customerArt("adventurer", "common"), 批發貓:customerArt("vip", "common"),
  收藏貓:customerArt("fashion", "common"), 旅行貓:customerArt("worker", "common"),
  大食客貓:customerArt("worker", "rare"), 獵人貓:customerArt("foodie", "rare"),
  貴族貓:customerArt("scholar", "rare"), 貓議員:customerArt("elder", "rare"),
  幻影貓:customerArt("adventurer", "rare"), 富商貓:customerArt("vip", "rare"),
  古董商貓:customerArt("fashion", "rare"), 觀光團長貓:customerArt("kitten", "rare"),
  美食家貓:customerArt("worker", "legend"), 傳奇勇者貓:customerArt("foodie", "legend"),
  女王貓:customerArt("scholar", "legend"), 貓神:customerArt("elder", "legend"),
  異世界貓:customerArt("adventurer", "legend"), 銀行家貓:customerArt("vip", "legend"),
  圖鑑大師貓:customerArt("fashion", "legend"), 異國商隊貓:customerArt("kitten", "legend"),
});

export const GOOD_ART_MANIFEST = Object.freeze({
  bow:"/assets/shop/good-bow.webp", "short-sword":"/assets/shop/good-short-sword.webp",
  "long-sword":"/assets/shop/good-long-sword.webp", staff:"/assets/shop/good-staff.webp",
  sling:"/assets/shop/good-sling.webp", "war-hammer":"/assets/shop/good-war-hammer.webp",
  "fishbone-sword":"/assets/shop/good-fishbone-sword.webp", crossbow:"/assets/shop/good-crossbow.webp",
  "chest-armor":"/assets/shop/good-chest-armor.webp", amulet:"/assets/shop/good-amulet.webp",
  cloak:"/assets/shop/good-cloak.webp", helmet:"/assets/shop/good-helmet.webp",
  boots:"/assets/shop/good-boots.webp", gloves:"/assets/shop/good-gloves.webp",
  shield:"/assets/shop/good-shield.webp", collar:"/assets/shop/good-collar.webp",
  "rice-bowl":"/assets/shop/good-rice-bowl.webp", salad:"/assets/shop/good-salad.webp",
  soup:"/assets/shop/good-soup.webp", "meat-skewer":"/assets/shop/good-meat-skewer.webp",
  cake:"/assets/shop/good-cake.webp", sushi:"/assets/shop/good-sushi.webp",
  ramen:"/assets/shop/good-ramen.webp", dumplings:"/assets/shop/good-dumplings.webp",
});

export const SHOP_INTERIOR_ART = Object.freeze({
  low: "/assets/shop/interior-stock-low.webp",
  normal: "/assets/shop/interior-stock-normal.webp",
  abundant: "/assets/shop/interior-stock-abundant.webp",
});

const SHOP_VISUAL_MILESTONES = Object.freeze([
  Object.freeze({ id:"starter", minLevel:1, label:"街角小舖", decor:"🪴" }),
  Object.freeze({ id:"established", minLevel:10, label:"人氣商店", decor:"🏮" }),
  Object.freeze({ id:"renowned", minLevel:20, label:"貓村名店", decor:"✨" }),
  Object.freeze({ id:"legendary", minLevel:30, label:"傳說商號", decor:"👑" }),
]);

export function getShopInteriorArt(shop) {
  const units = Object.values(shop?.stock || {}).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );
  if (units >= 120) return SHOP_INTERIOR_ART.abundant;
  if (units >= 30) return SHOP_INTERIOR_ART.normal;
  return SHOP_INTERIOR_ART.low;
}

export function getShopVisualMilestone(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  for (let index = SHOP_VISUAL_MILESTONES.length - 1; index >= 0; index -= 1) {
    if (safeLevel >= SHOP_VISUAL_MILESTONES[index].minLevel) return SHOP_VISUAL_MILESTONES[index];
  }
  return SHOP_VISUAL_MILESTONES[0];
}

export function getShopCustomerArt(customer) {
  return CUSTOMER_ART_MANIFEST[customer?.id] || null;
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
