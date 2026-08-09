import { SHOP_GOODS } from "./shopGoodsCatalog";
import { SHOP_CUSTOMERS } from "./villageShop";
import {
  CUSTOMER_ART_MANIFEST,
  GOOD_ART_MANIFEST,
  getShopCustomerArt,
  getShopGoodArt,
  getShopManager,
  SHOP_MANAGER_OPTIONS,
} from "./shopArt";

test("maps all eight customer groups across common, rare and legend art", () => {
  expect(Object.keys(CUSTOMER_ART_MANIFEST)).toHaveLength(8);
  expect(SHOP_CUSTOMERS).toHaveLength(24);

  SHOP_CUSTOMERS.forEach(customer => {
    expect(getShopCustomerArt(customer)).toMatch(
      /^\/assets\/shop\/customer-(kitten|worker|elder|scholar|foodie|fashion|adventurer|vip)-(common|rare|legend)\.webp$/,
    );
  });
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
  });
});
