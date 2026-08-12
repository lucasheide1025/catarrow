import {
  AUTO_ACHIEVEMENTS,
  CHEST_DEX_TYPES,
  DEX_CATEGORIES,
  DEX_THEMES,
  MONSTER_CARD_FAMILIES,
  MONSTER_CARD_PACK,
  TIERED_ACHIEVEMENTS,
  computeTierProgress,
  isActiveAchievement,
} from "./achievementDex";
import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import { GUILD_RANKS } from "../guild/domain/guildRank";
import { normalizeGuildExpeditionStats } from "../guild/domain/guildExpeditionStats";

test("V3 九大主題完整且只覆蓋每個 legacy 分類一次", () => {
  expect(DEX_THEMES).toHaveLength(9);
  const mapped = DEX_THEMES.flatMap(theme => theme.categories);
  expect([...mapped].sort()).toEqual(DEX_CATEGORIES.map(cat => cat.id).sort());
  expect(new Set(mapped).size).toBe(mapped.length);
});


test("chest dex is a collection category with 13 active chest types", () => {
  expect(DEX_CATEGORIES.some(cat => cat.id === "chest")).toBe(true);
  expect(DEX_THEMES.find(theme => theme.id === "collection")?.categories).toContain("chest");
  expect(CHEST_DEX_TYPES).toHaveLength(13);
  const cards = TIERED_ACHIEVEMENTS.filter(item =>
    item.cat === "chest" && isActiveAchievement(item) && item.id !== "chest_catalog"
  );
  expect(cards).toHaveLength(13);
  cards.forEach(item => {
    expect(item.tiers.map(tier => tier.count)).toEqual([1, 5, 10, 20, 50, 100]);
  });
});

test("coin and current special chests are tracked while legacy cat and card_pack are not active chest types", () => {
  const ids = CHEST_DEX_TYPES.map(type => type.id);
  ["coin", "cat_box", "mimi_box", "wb_relic", "family_mat", "mini_boss_mat", "boss_mat"]
    .forEach(id => expect(ids).toContain(id));
  expect(ids).not.toContain("cat");
  expect(ids).not.toContain("card_pack");
  const oldCat = TIERED_ACHIEVEMENTS.find(item => item.id === "chest_cat");
  expect(oldCat).toBeTruthy();
  expect(isActiveAchievement(oldCat)).toBe(false);
  AUTO_ACHIEVEMENTS.filter(item => item.id.startsWith("chest_cat_open_"))
    .forEach(item => expect(isActiveAchievement(item)).toBe(false));
});

test("chest catalog counts only distinct current chest types that have been opened", () => {
  const catalog = TIERED_ACHIEVEMENTS.find(item => item.id === "chest_catalog");
  expect(catalog).toBeTruthy();
  expect(catalog.tiers[catalog.tiers.length - 1].count).toBe(CHEST_DEX_TYPES.length);
  expect(catalog.getValue({
    chestStats: { wood: 2, coin: 1, family_mat: 3, cat: 999, unknown_box: 999 },
  })).toBe(3);
  const all = Object.fromEntries(CHEST_DEX_TYPES.map(type => [type.id, 1]));
  expect(catalog.getValue({ chestStats: all })).toBe(CHEST_DEX_TYPES.length);
  expect(computeTierProgress(catalog, { chestStats: all }).isComplete).toBe(true);
});

test("死掉寶、舊公會與舊 36 怪終局成就保留 id 但已退役", () => {
  const ids = [
    "drop_rare", "drop_epic", "drop_legendary", "drop_mythic",
    "guild_first_xp", "guild_lv10", "guild_promo_bronze", "guild_max",
    "dex_all6", "dex_all36", "mythic_all",
  ];
  ids.forEach(id => {
    const achievement = AUTO_ACHIEVEMENTS.find(item => item.id === id);
    expect(achievement).toBeTruthy();
    expect(isActiveAchievement(achievement)).toBe(false);
  });
});

test("一般怪物卡包以現行 126 張 normal catalog 為真本，里程碑自動封頂", () => {
  const normalCards = EXPANSION_MONSTERS.filter(monster => monster.encounter === "normal");
  expect(normalCards).toHaveLength(126);
  expect(MONSTER_CARD_PACK).toHaveLength(126);
  const cardCollect = TIERED_ACHIEVEMENTS.find(item => item.id === "card_collect");
  const counts = cardCollect.tiers.map(tier => tier.count);
  expect(counts).toEqual(expect.arrayContaining([1, 10, 25, 50, 100]));
  expect(counts[counts.length - 1]).toBe(normalCards.length);
});

test("怪物卡族群已是七族，card_all6fam 舊 id 以七族條件判定", () => {
  expect(MONSTER_CARD_FAMILIES).toHaveLength(7);
  expect(MONSTER_CARD_FAMILIES).toContain("treasure");
  const allFamilies = AUTO_ACHIEVEMENTS.find(item => item.id === "card_all6fam");
  expect(allFamilies.check({ cardFamilies:[...MONSTER_CARD_FAMILIES] })).toBe(true);
  expect(allFamilies.check({ cardFamilies:MONSTER_CARD_FAMILIES.filter(fam => fam !== "treasure") })).toBe(false);
  expect(TIERED_ACHIEVEMENTS.some(item => item.id === "dex_treasure")).toBe(true);
});

test("新版公會聲望沿用 GUILD_RANKS 門檻，舊 guild AUTO 仍維持退役", () => {
  const guild = TIERED_ACHIEVEMENTS.find(item => item.id === "guild_reputation");
  expect(guild).toBeTruthy();
  expect(guild.tiers.map(tier => tier.count)).toEqual([
    1,
    ...GUILD_RANKS.filter(rank => rank.rep > 0).map(rank => rank.rep),
  ]);
  expect(computeTierProgress(guild, { guildRep: 0 }).unlockedCount).toBe(0);
  expect(computeTierProgress(guild, { guildRep: 300 }).unlockedCount).toBe(2);
  expect(computeTierProgress(guild, { guildRep: 15000 }).unlockedCount).toBe(6);
  expect(AUTO_ACHIEVEMENTS.filter(item => item.cat === "guild" && isActiveAchievement(item))).toHaveLength(0);
});

test("頭目與神話判定使用 metadata，不再依賴 monster id 的 _5/_6 尾碼", () => {
  const boss = TIERED_ACHIEVEMENTS.find(item => item.id === "monster_boss");
  const monsterDex = {
    "treasure-boss-special": { wins: 3, family: "treasure", tier: "boss" },
    "fake_5": { wins: 99, family: "ghost", tier: "rare" },
  };
  expect(boss.getValue({ monsterDex })).toBe(3);

  const mythicFirst = AUTO_ACHIEVEMENTS.find(item => item.id === "mythic_first");
  expect(mythicFirst.check({
    monsterDex: {
      "treasure-mythic-special": { wins: 1, family: "treasure", tier: "mythic" },
    },
  })).toBe(true);
});

test("寶箱族討伐以六種階級 metadata 計數，同階級多怪不重複灌進度", () => {
  const treasure = TIERED_ACHIEVEMENTS.find(item => item.id === "dex_treasure");
  const tiers = ["common", "rare", "elite", "fierce", "boss", "mythic"];
  const monsterDex = Object.fromEntries(tiers.map((tier, index) => [
    `treasure-special-${index}`,
    { wins: 1, family: "treasure", tier },
  ]));
  monsterDex["treasure-extra-boss"] = { wins: 8, family: "treasure", tier: "boss" };
  expect(treasure.getValue({ monsterDex })).toBe(6);
});

test("新版公會遠征統計由永久 total/won/byDanger 正規化，高危與神話勝場不重複失真", () => {
  const stats = normalizeGuildExpeditionStats({
    total: 12,
    won: 9,
    byDanger: { 1: 2, 3: 3, 5: 2, 6: 2 },
  });
  expect(stats).toEqual({ total: 12, won: 9, hardWon: 7, deadlyWon: 4, mythicWon: 2 });

  const total = TIERED_ACHIEVEMENTS.find(item => item.id === "guild_expeditions");
  const wins = TIERED_ACHIEVEMENTS.find(item => item.id === "guild_wins");
  const hard = TIERED_ACHIEVEMENTS.find(item => item.id === "guild_hard_wins");
  const deadly = TIERED_ACHIEVEMENTS.find(item => item.id === "guild_deadly_wins");
  const mythic = TIERED_ACHIEVEMENTS.find(item => item.id === "guild_mythic_wins");
  expect(total.getValue({ guildExpeditionStats: stats })).toBe(12);
  expect(wins.getValue({ guildExpeditionStats: stats })).toBe(9);
  expect(hard.getValue({ guildExpeditionStats: stats })).toBe(7);
  expect(deadly.getValue({ guildExpeditionStats: stats })).toBe(4);
  expect(mythic.getValue({ guildExpeditionStats: stats })).toBe(2);
});

test("地下城通關里程碑計七族永久 dungeonClears，未知 key 不灌進度", () => {
  const dungeon = TIERED_ACHIEVEMENTS.find(item => item.id === "dungeon_clears");
  expect(dungeon).toBeTruthy();
  expect(dungeon.getValue({
    member: {
      dungeonClears: { ghost: 3, mountain: 2, insect: 1, treasure: 4, legacy_unknown: 999 },
    },
  })).toBe(10);
  expect(computeTierProgress(dungeon, { member: { dungeonClears: { ghost: 20 } } }).unlockedCount).toBe(3);
});
