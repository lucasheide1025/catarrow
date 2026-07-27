// src/guild/domain/guildRank.test.js
import { GUILD_RANKS, repToRank, nextRankInfo, rankUnlocks, canAcceptDanger, repNeededForDanger } from "./guildRank";
import { purchaseFromShop } from "./guildShopPurchase";
import { emptyGuildProfile, GUILD_STASH_LIMIT } from "./guildRewards";
import { shopItemById, shopItemsForTier, GUILD_SHOP_ITEMS, validateGuildShop, SHOP_MATERIALS, MAT_FAMILIES } from "../data/guildShop";
import { EXPANSION_MATERIALS } from "../../lib/monsterExpansionCatalog";

describe("階級（聲望 → 解鎖，零戰力加成）", () => {
  test("階級表 rep 門檻遞增，且沒有任何數值加成欄位", () => {
    for (let i = 1; i < GUILD_RANKS.length; i++) expect(GUILD_RANKS[i].rep).toBeGreaterThan(GUILD_RANKS[i - 1].rep);
    for (const r of GUILD_RANKS) {
      expect(r.mult).toBeUndefined();  // 舊公會的金幣加乘不可復活
      expect(r.atk).toBeUndefined();
      expect(r.hp).toBeUndefined();
    }
  });

  test("rep → 階級", () => {
    expect(repToRank(0).id).toBe("apprentice");
    expect(repToRank(99).id).toBe("apprentice");
    expect(repToRank(100).id).toBe("bronze");
    expect(repToRank(3000).id).toBe("legend");
    expect(repToRank(999999).id).toBe("legend");
  });

  test("下一階進度", () => {
    const a = nextRankInfo(0);
    expect(a.next.id).toBe("bronze");
    expect(a.need).toBe(100);
    expect(a.progressPct).toBe(0);
    expect(nextRankInfo(50).progressPct).toBe(50);
    const max = nextRankInfo(5000);
    expect(max.next).toBeNull();
    expect(max.progressPct).toBe(100);
  });

  test("危險度 gate：6 階一階開一個危險度（T1~T6）", () => {
    const cases = [[0, 1], [100, 2], [300, 3], [700, 4], [1500, 5], [3000, 6]];
    for (const [rep, maxD] of cases) {
      expect(canAcceptDanger(rep, maxD)).toBe(true);              // 剛好開到這階
      if (maxD < 6) expect(canAcceptDanger(rep, maxD + 1)).toBe(false);  // 更上一階要更高聲望
    }
  });

  test("鎖住時算得出還差多少聲望；已解鎖回 null", () => {
    expect(repNeededForDanger(0, 2)).toBe(100);
    expect(repNeededForDanger(250, 3)).toBe(50);      // 銀牌 300 才能接 T3
    expect(repNeededForDanger(300, 3)).toBeNull();
    expect(repNeededForDanger(0, 6)).toBe(3000);      // T6 要傳說
  });

  test("商店層級跟著階級走", () => {
    expect(rankUnlocks(0).shopTier).toBe(1);
    expect(rankUnlocks(300).shopTier).toBe(2);
    expect(rankUnlocks(1500).shopTier).toBe(3);
    expect(shopItemsForTier(1).every(i => i.tier === 1)).toBe(true);
    expect(shopItemsForTier(3).length).toBeGreaterThan(shopItemsForTier(1).length);
  });
});

describe("公會商店購買", () => {
  const rich = rep => ({ ...emptyGuildProfile(), catCoins: 1000, rep });

  test("買裝備：扣 CAT幣、進倉庫", () => {
    const { ok, profile, spent } = purchaseFromShop(rich(0), "eq_wood_bow_common", { uidFn: () => "u1", now: 1 });
    expect(ok).toBe(true);
    expect(spent).toBe(shopItemById("eq_wood_bow_common").costCat);
    expect(profile.catCoins).toBe(1000 - spent);
    expect(profile.stash).toEqual([{ uid: "u1", archetypeId: "wood_bow", grade: "common", at: 1 }]);
  });

  test("買補給：扣主線金幣額度、不扣 CAT幣，並累積到公會倉庫", () => {
    const before = { ...rich(0), supplyStock: { food: 3, water: 1 } };
    const food = purchaseFromShop(before, "supply_food_x6", { coins: 500 });
    expect(food.ok).toBe(true);
    expect(food.profile.supplyStock).toEqual({ food: 9, water: 1 });
    expect(food.profile.catCoins).toBe(1000);
    expect(food.coinsSpent).toBe(shopItemById("supply_food_x6").costCoins);
    const water = purchaseFromShop(food.profile, "supply_water_x6", { coins: 500 });
    expect(water.profile.supplyStock).toEqual({ food: 9, water: 7 });
  });

  test("補給金幣不足或超過倉庫容量時不能購買", () => {
    expect(purchaseFromShop(rich(0), "supply_food_x6", { coins: 0 }).ok).toBe(false);
    const full = { ...rich(0), supplyStock: { food: 36, water: 0 } };
    expect(purchaseFromShop(full, "supply_food_x6", { coins: 999 }).reason).toMatch(/容量/);
  });

  test("商店買不到高階裝備（elite 以上只能靠打）", () => {
    expect(validateGuildShop().ok).toBe(true);
    for (const item of GUILD_SHOP_ITEMS.filter(i => i.kind === "equip")) {
      expect(["common", "rare"]).toContain(item.grade);
    }
    expect(shopItemById("eq_long_bow_fierce")).toBeNull();   // 舊的高階商品已移除
  });

  test("材料商店：七族全開、每種都有單買與 5 入包（5 入更便宜）", () => {
    const mats = GUILD_SHOP_ITEMS.filter(i => i.kind === "material");
    expect(mats.length).toBe(SHOP_MATERIALS.length * 2);       // 每種材料＝單買＋5入
    expect(new Set(mats.map(i => i.family)).size).toBe(MAT_FAMILIES.length);  // 7 族
    const single = shopItemById("buy_mat_ghost_t1_normal_a");
    const bundle = shopItemById("buy_mat_ghost_t1_normal_a_x5");
    expect(bundle.qty).toBe(5);
    expect(bundle.costCat).toBeLessThan(single.costCat * 5);  // 有折扣
  });

  test("材料商店只賣一般怪素材：小王/大王素材買不到", () => {
    expect(SHOP_MATERIALS.every(m => m.kind === "normal")).toBe(true);
    // 目錄裡確實有小王/大王素材，但不該出現在貨架上
    const bossIds = EXPANSION_MATERIALS.filter(m => m.kind !== "normal").map(m => m.id);
    expect(bossIds.length).toBeGreaterThan(0);
    const onShelf = new Set(GUILD_SHOP_ITEMS.filter(i => i.kind === "material").map(i => i.materialId));
    expect(bossIds.some(id => onShelf.has(id))).toBe(false);
  });

  test("材料不鎖階級：高階材料用價格當門檻（見習也買得到 T6）", () => {
    const t6 = GUILD_SHOP_ITEMS.find(i => i.kind === "material" && i.matTier === 6);
    expect(t6.tier).toBe(1);                                   // 貨架層級 1 = 不需升階
    expect(t6.costCat).toBeGreaterThan(
      GUILD_SHOP_ITEMS.find(i => i.kind === "material" && i.matTier === 1).costCat * 10);
  });

  test("買 5 入包會拿到 5 個材料", () => {
    const { ok, materials } = purchaseFromShop(rich(0), "buy_mat_ghost_t1_normal_a_x5");
    expect(ok).toBe(true);
    expect(materials).toHaveLength(5);
    expect(materials.every(m => m.id === "mat_ghost_t1_normal_a")).toBe(true);
  });

  test("買材料：扣 CAT幣、回傳要寫進主線背包的材料", () => {
    const { ok, profile, materials } = purchaseFromShop(rich(0), "buy_mat_ghost_t1_normal_a");
    expect(ok).toBe(true);
    expect(profile.catCoins).toBe(1000 - shopItemById("buy_mat_ghost_t1_normal_a").costCat);
    expect(materials).toHaveLength(1);
    expect(materials[0].id).toBe("mat_ghost_t1_normal_a");
    expect(materials[0].name).toBeTruthy();
  });

  test("階級不足 → 買不到高層級貨，存檔不動", () => {
    const before = rich(0);
    const res = purchaseFromShop(before, "eq_ranger_quiver_rare");   // 特製貨架（需白金）
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/階級不足/);
    expect(res.profile.catCoins).toBe(1000);
  });

  test("CAT幣不足 → 擋下", () => {
    const res = purchaseFromShop({ ...emptyGuildProfile(), catCoins: 1, rep: 0 }, "eq_wood_bow_common");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/CAT幣不足/);
  });

  test("倉庫滿 → 擋下買裝備（不會扣錢又沒東西）", () => {
    const full = { ...rich(0), stash: Array.from({ length: GUILD_STASH_LIMIT }, (_, i) => ({ uid: `s${i}`, archetypeId: "wood_bow", grade: "common" })) };
    const res = purchaseFromShop(full, "eq_wood_bow_common");
    expect(res.ok).toBe(false);
    expect(res.profile.catCoins).toBe(1000);
  });

  test("不存在的商品 → 擋下", () => {
    expect(purchaseFromShop(rich(3000), "nope").ok).toBe(false);
  });

  test("純函數：不修改傳入的存檔", () => {
    const before = rich(0);
    purchaseFromShop(before, "mat_ghost_m1");
    expect(before.catCoins).toBe(1000);
  });
});
