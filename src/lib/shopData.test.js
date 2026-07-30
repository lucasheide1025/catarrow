import {
  DAILY_SHOP_PRODUCTS,
  MATERIAL_SUPPLY_PRODUCTS,
  SHOP_PRODUCT_MAP,
  SPECIAL_TICKET_META,
  WEEKLY_TREASURE_PRODUCTS,
  getShopDailyKey,
  getShopPeriodKey,
  getShopWeeklyKey,
  getMaterialUpgradePlan,
} from "./shopData";

describe("coin shop fixed catalog", () => {
  test("keeps the approved fixed product counts", () => {
    expect(DAILY_SHOP_PRODUCTS).toHaveLength(4);
    expect(MATERIAL_SUPPLY_PRODUCTS).toHaveLength(6);
    expect(WEEKLY_TREASURE_PRODUCTS).toHaveLength(5);
    expect(SHOP_PRODUCT_MAP.size).toBe(15);
  });

  test("uses approved ticket prices, limits and hold caps", () => {
    expect(SHOP_PRODUCT_MAP.get("solo_battle_ticket")).toMatchObject({ price:1000, limit:2, holdCap:5 });
    expect(SHOP_PRODUCT_MAP.get("party_battle_ticket")).toMatchObject({ price:1500, limit:1, holdCap:3 });
    expect(SHOP_PRODUCT_MAP.get("board_dice_ticket")).toMatchObject({ price:750, limit:2, holdCap:5 });
    expect(SPECIAL_TICKET_META.boardDiceTicket.holdCap).toBe(5);
  });

  test("uses approved material chest prices and limits", () => {
    expect(MATERIAL_SUPPLY_PRODUCTS.map(({ price, limit }) => [price, limit])).toEqual([
      [500, 3], [800, 3], [1200, 2], [1800, 2], [2500, 1], [3500, 1],
    ]);
  });

  test("keeps all five weekly treasures instead of rotating one", () => {
    expect(WEEKLY_TREASURE_PRODUCTS.map(item => item.id)).toEqual([
      "king_seal", "rune_fragment_bundle", "world_boss_dungeon_scroll", "cat_box", "card_pack",
    ]);
    expect(SHOP_PRODUCT_MAP.get("cat_box").price).toBe(100000);
  });

  test("resets days and Monday-based weeks in Taipei", () => {
    const sunday = new Date("2026-08-02T12:00:00+08:00");
    const monday = new Date("2026-08-03T00:00:00+08:00");
    expect(getShopDailyKey(sunday)).toBe("2026-08-02");
    expect(getShopWeeklyKey(sunday)).toBe("week-2026-07-27");
    expect(getShopWeeklyKey(monday)).toBe("week-2026-08-03");
    expect(getShopPeriodKey(SHOP_PRODUCT_MAP.get("cat_box"), monday)).toBe("week-2026-08-03");
    expect(getShopPeriodKey(SHOP_PRODUCT_MAP.get("potion_chest"), monday)).toBe("2026-08-03");
  });

  test("batch upgrade keeps five source materials", () => {
    expect(getMaterialUpgradePlan("ghost_m2", 34, "all")).toEqual({
      sourceId:"ghost_m2", targetId:"ghost_m3", exchanges:5, consume:25, output:5, keep:5,
    });
    expect(getMaterialUpgradePlan("ghost_m6", 100, "all")).toBeNull();
  });
});
