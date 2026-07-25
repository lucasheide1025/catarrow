// src/guild/domain/guildRank.test.js
import { GUILD_RANKS, repToRank, nextRankInfo, rankUnlocks, canAcceptDanger, repNeededForDanger } from "./guildRank";
import { purchaseFromShop } from "./guildShopPurchase";
import { emptyGuildProfile, GUILD_STASH_LIMIT } from "./guildRewards";
import { shopItemById, shopItemsForTier } from "../data/guildShop";

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

  test("危險度 gate：見習只能接 1，金牌才能接 3", () => {
    expect(canAcceptDanger(0, 1)).toBe(true);
    expect(canAcceptDanger(0, 2)).toBe(false);
    expect(canAcceptDanger(100, 2)).toBe(true);
    expect(canAcceptDanger(100, 3)).toBe(false);
    expect(canAcceptDanger(700, 3)).toBe(true);
  });

  test("鎖住時算得出還差多少聲望；已解鎖回 null", () => {
    expect(repNeededForDanger(0, 2)).toBe(100);
    expect(repNeededForDanger(650, 3)).toBe(50);
    expect(repNeededForDanger(700, 3)).toBeNull();
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
    const { ok, profile, spent } = purchaseFromShop(rich(0), "eq_wood_bow_rare", { uidFn: () => "u1", now: 1 });
    expect(ok).toBe(true);
    expect(spent).toBe(shopItemById("eq_wood_bow_rare").costCat);
    expect(profile.catCoins).toBe(1000 - spent);
    expect(profile.stash).toEqual([{ uid: "u1", archetypeId: "wood_bow", grade: "rare", at: 1 }]);
  });

  test("買材料：扣 CAT幣、回傳要寫進主線背包的材料", () => {
    const { ok, profile, materials } = purchaseFromShop(rich(0), "mat_ghost_m1");
    expect(ok).toBe(true);
    expect(profile.catCoins).toBe(990);
    expect(materials).toHaveLength(1);
    expect(materials[0].id).toBe("ghost_m1");
    expect(materials[0].name).toBeTruthy();
  });

  test("階級不足 → 買不到高層級貨，存檔不動", () => {
    const before = rich(0);
    const res = purchaseFromShop(before, "eq_long_bow_fierce");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/階級不足/);
    expect(res.profile.catCoins).toBe(1000);
  });

  test("CAT幣不足 → 擋下", () => {
    const res = purchaseFromShop({ ...emptyGuildProfile(), catCoins: 5, rep: 0 }, "eq_wood_bow_rare");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/CAT幣不足/);
  });

  test("倉庫滿 → 擋下買裝備（不會扣錢又沒東西）", () => {
    const full = { ...rich(0), stash: Array.from({ length: GUILD_STASH_LIMIT }, (_, i) => ({ uid: `s${i}`, archetypeId: "wood_bow", grade: "common" })) };
    const res = purchaseFromShop(full, "eq_wood_bow_rare");
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
