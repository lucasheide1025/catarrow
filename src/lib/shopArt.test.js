import { SHOP_GOODS } from "./shopGoodsCatalog";
import { SHOP_CUSTOMERS } from "./villageShop";
import {
  CUSTOMER_ART_MANIFEST,
  GOOD_ART_MANIFEST,
  getShopCustomerArt,
  getShopGoodArt,
  getShopManager,
  getShopInteriorArt,
  getShopVisualMilestone,
  SHOP_INTERIOR_ART,
  SHOP_MANAGER_OPTIONS,
} from "./shopArt";

test("maps every customer ID explicitly to all 24 semantically reviewed portraits", () => {
  expect(SHOP_CUSTOMERS).toHaveLength(24);

  expect(Object.keys(CUSTOMER_ART_MANIFEST)).toHaveLength(24);
  SHOP_CUSTOMERS.forEach(customer => {
    expect(CUSTOMER_ART_MANIFEST[customer.id]).toBeDefined();
    expect(getShopCustomerArt(customer)).toMatch(
      /^\/assets\/shop\/customer-(kitten|worker|elder|scholar|foodie|fashion|adventurer|vip)-(common|rare|legend)\.webp$/,
    );
  });
  expect(new Set(Object.values(CUSTOMER_ART_MANIFEST)).size).toBe(24);
  expect(getShopCustomerArt({ id:"not-a-customer", tier:"legend" })).toBeNull();
});

test("offers nine Cat Village shop managers with dedicated artwork", () => {
  expect(SHOP_MANAGER_OPTIONS).toHaveLength(9);
  expect(getShopManager("daming").name).toBe("大娘");
  expect(getShopManager("diandian").name).toBe("顛顛");
  SHOP_MANAGER_OPTIONS.forEach(manager => expect(getShopManager(manager.id).art)
    .toMatch(/^\/assets\/shop\/managers\/manager-[a-z]+\.webp$/));
});

test("maps every visual archetype to one of the 24 product illustrations", () => {
  expect(Object.keys(GOOD_ART_MANIFEST)).toHaveLength(24);
  expect(new Set(SHOP_GOODS.map(good => good.visualKey))).toEqual(new Set(Object.keys(GOOD_ART_MANIFEST)));

  SHOP_GOODS.forEach(good => {
    expect(getShopGoodArt(good)).toMatch(/^\/assets\/shop\/good-[a-z-]+\.webp$/);
    expect(getShopGoodArt(good)).toBe(`/assets/shop/good-${good.visualKey}.webp`);
  });

  const expectedNounByVisualKey = {
    bow:"弓", "short-sword":"短劍", "long-sword":"長劍", staff:"法杖",
    sling:"投石索", "war-hammer":"戰錘", "fishbone-sword":"魚骨劍", crossbow:"重弩",
    "chest-armor":"胸甲", amulet:"護符", cloak:"斗篷", helmet:"頭盔",
    boots:"靴子", gloves:"手甲", shield:"圓盾", collar:"項圈",
    "rice-bowl":"蓋飯", salad:"沙拉", soup:"湯品", "meat-skewer":"烤肉串",
    cake:"蛋糕", sushi:"壽司", ramen:"拉麵", dumplings:"蒸餃",
  };
  for (const [visualKey, noun] of Object.entries(expectedNounByVisualKey)) {
    const variants = SHOP_GOODS.filter(good => good.visualKey === visualKey);
    expect(variants).toHaveLength(5);
    expect(variants.every(good => good.visualLabel === noun && good.name.endsWith(noun))).toBe(true);
  }
});

test("owns static interior paths and exposes visible level milestones", () => {
  expect(SHOP_INTERIOR_ART).toEqual({
    low: "/assets/shop/interior-stock-low.webp",
    normal: "/assets/shop/interior-stock-normal.webp",
    abundant: "/assets/shop/interior-stock-abundant.webp",
  });
  expect(getShopInteriorArt({ stock: {} })).toBe(SHOP_INTERIOR_ART.low);
  expect(getShopInteriorArt({ stock: { weapon_0: 30 } })).toBe(SHOP_INTERIOR_ART.normal);
  expect(getShopInteriorArt({ stock: { weapon_0: 120 } })).toBe(SHOP_INTERIOR_ART.abundant);
  expect(getShopVisualMilestone(1).id).toBe("starter");
  expect(getShopVisualMilestone(10).id).toBe("established");
  expect(getShopVisualMilestone(20).id).toBe("renowned");
  expect(getShopVisualMilestone(30).id).toBe("legendary");
});
