import {
  AUTO_ACHIEVEMENTS,
  CHEST_DEX_TYPES,
  DEX_CATEGORIES,
  DEX_THEMES,
  MONSTER_CARD_FAMILIES,
  MONSTER_CARD_PACK,
  MONSTER_DEX_CATALOG,
  MONSTER_DEX_FAMILIES,
  TIERED_ACHIEVEMENTS,
  computeTierProgress,
  isActiveAchievement,
} from "./achievementDex";
import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import { CATS, CAT_EQUIP_SLOTS, catEquipEnhancement, getBondLevel } from "./catData";
import { catLevelFromXP } from "./catLevel";
import { GUILD_RANKS } from "../guild/domain/guildRank";
import { normalizeGuildExpeditionStats } from "../guild/domain/guildExpeditionStats";

test("V3 九大主題完整且只覆蓋每個 legacy 分類一次", () => {
  expect(DEX_THEMES).toHaveLength(9);
  const mapped = DEX_THEMES.flatMap(theme => theme.categories);
  expect([...mapped].sort()).toEqual(DEX_CATEGORIES.map(cat => cat.id).sort());
  expect(new Set(mapped).size).toBe(mapped.length);
});


test("chest dex is a combat category with 13 active chest types and stacks to 1000", () => {
  expect(DEX_CATEGORIES.some(cat => cat.id === "chest")).toBe(true);
  expect(DEX_THEMES.find(theme => theme.id === "combat")?.categories).toContain("chest");
  expect(DEX_THEMES.find(theme => theme.id === "collection")?.categories).not.toContain("chest");
  expect(CHEST_DEX_TYPES).toHaveLength(13);
  const cards = TIERED_ACHIEVEMENTS.filter(item =>
    item.cat === "chest" && isActiveAchievement(item) && item.id !== "chest_catalog"
  );
  expect(cards).toHaveLength(13);
  cards.forEach(item => {
    expect(item.tiers.map(tier => tier.count)).toEqual([1, 5, 10, 20, 50, 100, 250, 500, 1000]);
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

test("world boss has permanent participation and kill achievement tracks", () => {
  const participation = TIERED_ACHIEVEMENTS.find(item => item.id === "worldboss_participations");
  const kills = TIERED_ACHIEVEMENTS.find(item => item.id === "worldboss_kills");
  expect(participation?.cat).toBe("worldboss");
  expect(kills?.cat).toBe("worldboss");
  expect(participation?.getValue({ member:{ worldBossParticipations:37 } })).toBe(37);
  expect(kills?.getValue({ member:{ worldBossKills:12 } })).toBe(12);
  expect(participation?.tiers[participation.tiers.length - 1]?.count).toBe(1000);
  expect(kills?.tiers[kills.tiers.length - 1]?.count).toBe(1000);
});

test("village development sums nine buildings and each building has its own track", () => {
  const total = TIERED_ACHIEVEMENTS.find(item => item.id === "village_level");
  const buildings = TIERED_ACHIEVEMENTS.filter(item => item.id.startsWith("village_building_") && isActiveAchievement(item));
  const legacyMax = TIERED_ACHIEVEMENTS.find(item => item.id === "building_max");
  expect(buildings).toHaveLength(9);
  buildings.forEach(item => expect(item.tiers.map(tier => tier.count)).toEqual([1,5,10,15,20]));
  expect(isActiveAchievement(legacyMax)).toBe(false);
  const allLv20 = { mine:20, farm:20, harbor:20, hunting:20, market:20, warehouse:20, alchemy:20, gacha:20, archery:20 };
  expect(total?.getValue({ member:{ village:{ buildings:allLv20 } } })).toBe(180);
});

test("village shop has level, sales, customers served and customer catalog tracks", () => {
  ["shop_level","shop_sales","shop_customers_served","shop_customer_catalog"].forEach(id => {
    expect(TIERED_ACHIEVEMENTS.find(item => item.id === id)?.cat).toBe("shop");
  });
  const sales = TIERED_ACHIEVEMENTS.find(item => item.id === "shop_sales");
  const served = TIERED_ACHIEVEMENTS.find(item => item.id === "shop_customers_served");
  expect(sales?.getValue({ member:{ village:{ shop:{ stats:{ totalSales:321 } } } } })).toBe(321);
  expect(served?.getValue({ member:{ village:{ shop:{ stats:{ customersServed:456 } } } } })).toBe(456);
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
  expect(TIERED_ACHIEVEMENTS.some(item => item.id === "monster_family_treasure")).toBe(true);
});

test("新版怪物圖鑑以 252 隻擴充目錄為真本，七族各 36 隻", () => {
  expect(MONSTER_DEX_CATALOG).toHaveLength(252);
  expect(MONSTER_DEX_FAMILIES).toHaveLength(7);
  MONSTER_DEX_FAMILIES.forEach(family => {
    expect(MONSTER_DEX_CATALOG.filter(monster => monster.family === family)).toHaveLength(36);
  });
});

test("怪物全圖鑑只計正式 catalog 中已擊敗的不同 id，未知舊 key 不灌進度", () => {
  const catalog = TIERED_ACHIEVEMENTS.find(item => item.id === "monster_catalog");
  const monsterDex = Object.fromEntries(MONSTER_DEX_CATALOG.slice(0, 3).map(monster => [monster.id, { wins: 5 }]));
  monsterDex.legacy_unknown = { wins: 999 };
  expect(catalog.getValue({ monsterDex })).toBe(3);
  expect(catalog.tiers[catalog.tiers.length - 1].count).toBe(252);
});

test("指定怪物討伐收斂為 42 組普通怪、84 小王、42 大王，且首次擊倒併入同卡", () => {
  const targets = TIERED_ACHIEVEMENTS.filter(item =>
    isActiveAchievement(item) && item.monsterAchievementKind
  );
  const normals = targets.filter(item => item.monsterAchievementKind === "normalGroup");
  const miniBosses = targets.filter(item => item.monsterAchievementKind === "miniBoss");
  const bosses = targets.filter(item => item.monsterAchievementKind === "boss");

  expect(normals).toHaveLength(42);
  expect(miniBosses).toHaveLength(84);
  expect(bosses).toHaveLength(42);
  expect(targets).toHaveLength(168);
  targets.forEach(item => {
    expect(item.tiers.map(tier => tier.count)).toEqual([1, 5, 10, 25, 50, 100]);
  });
});

test("普通怪討伐每張只合計同族同 T 的 3 隻 normal，不吃小王或未知 key", () => {
  const group = TIERED_ACHIEVEMENTS.find(item => item.monsterAchievementKind === "normalGroup");
  const pool = MONSTER_DEX_CATALOG.filter(monster =>
    monster.family === group.family
      && monster.tierIndex === group.tierIndex
      && monster.encounter === "normal"
  );
  expect(pool).toHaveLength(3);
  expect(new Set(group.monsterIds)).toEqual(new Set(pool.map(monster => monster.id)));
  pool.forEach(monster => expect(group.desc).toContain(monster.name));

  const outsider = MONSTER_DEX_CATALOG.find(monster =>
    monster.family === group.family
      && monster.tierIndex === group.tierIndex
      && monster.encounter === "miniBoss"
  );
  const monsterDex = {
    [pool[0].id]: { wins: 1 },
    [pool[1].id]: { wins: 2 },
    [pool[2].id]: { wins: 3 },
    [outsider.id]: { wins: 999 },
    legacy_unknown: { wins: 999 },
  };
  expect(group.getValue({ monsterDex })).toBe(6);
});

test("小王與大王各自只追蹤指定怪物，不會把其他怪擊倒數灌進來", () => {
  for (const kind of ["miniBoss", "boss"]) {
    const card = TIERED_ACHIEVEMENTS.find(item => item.monsterAchievementKind === kind);
    const other = MONSTER_DEX_CATALOG.find(monster =>
      monster.encounter === (kind === "miniBoss" ? "miniBoss" : "boss")
        && monster.id !== card.monsterId
    );
    expect(card).toBeTruthy();
    expect(card.monsterId).toBeTruthy();
    expect(card.getValue({
      monsterDex: {
        [card.monsterId]: { wins: 4 },
        [other.id]: { wins: 999 },
      },
    })).toBe(4);
  }
});

test("舊 36 怪個別成就保留 id 供相容，但現行圖鑑不再顯示", () => {
  const legacyFirstDefeats = AUTO_ACHIEVEMENTS.filter(item =>
    /^dex_(ghost|mountain|insect|workplace|exam|temple)_t[1-6]$/.test(item.id)
  );
  const legacyAutoMilestones = AUTO_ACHIEVEMENTS.filter(item =>
    /^kill_(ghost|mountain|insect|workplace|exam|temple)_[1-6]_(5|10|25|50|100)$/.test(item.id)
  );
  const legacyTiered = TIERED_ACHIEVEMENTS.filter(item =>
    /^kill_(ghost|mountain|insect|workplace|exam|temple)_[1-6]$/.test(item.id)
  );

  expect(legacyFirstDefeats).toHaveLength(36);
  expect(legacyAutoMilestones).toHaveLength(180);
  expect(legacyTiered).toHaveLength(36);
  [...legacyFirstDefeats, ...legacyAutoMilestones, ...legacyTiered].forEach(item => {
    expect(isActiveAchievement(item)).toBe(false);
  });

  const catalog = TIERED_ACHIEVEMENTS.find(item => item.id === "monster_catalog");
  expect(isActiveAchievement(catalog)).toBe(true);
  const familyDex = TIERED_ACHIEVEMENTS.filter(item => item.id.startsWith("monster_family_"));
  expect(familyDex).toHaveLength(7);
  familyDex.forEach(item => expect(isActiveAchievement(item)).toBe(true));
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

test("頭目與神話判定由擴充 catalog id 解析 metadata，不要求 monsterDex 另存 metadata", () => {
  const boss = TIERED_ACHIEVEMENTS.find(item => item.id === "monster_boss");
  const bossMonster = MONSTER_DEX_CATALOG.find(monster => monster.tier === "boss");
  const mythicMonster = MONSTER_DEX_CATALOG.find(monster => monster.tier === "mythic");
  const monsterDex = {
    [bossMonster.id]: { wins: 3 },
    "fake_5": { wins: 99, family: "ghost", tier: "rare" },
  };
  expect(boss.getValue({ monsterDex })).toBe(3);

  const mythicFirst = AUTO_ACHIEVEMENTS.find(item => item.id === "mythic_first");
  expect(mythicFirst.check({ monsterDex: { [mythicMonster.id]: { wins: 1 } } })).toBe(true);
});

test("寶箱族圖鑑依不同正式怪物 id 計數，36 隻全收才封頂", () => {
  const treasure = TIERED_ACHIEVEMENTS.find(item => item.id === "monster_family_treasure");
  const treasureCatalog = MONSTER_DEX_CATALOG.filter(monster => monster.family === "treasure");
  const monsterDex = Object.fromEntries(treasureCatalog.map(monster => [monster.id, { wins: 1 }]));
  monsterDex.unknown_treasure = { wins: 999, family: "treasure" };
  expect(treasure.getValue({ monsterDex })).toBe(36);
  expect(treasure.tiers[treasure.tiers.length - 1].count).toBe(36);
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

test("貓小隊改為九隻貓各自 3 條養成成就，舊聚合等級／羈絆退役", () => {
  const catIds = Object.keys(CATS);
  const tracks = TIERED_ACHIEVEMENTS.filter(item =>
    isActiveAchievement(item) && item.catAchievementKind
  );

  expect(catIds).toHaveLength(9);
  expect(tracks).toHaveLength(27);
  expect(new Set(tracks.map(item => item.catId))).toEqual(new Set(catIds));
  catIds.forEach(catId => {
    expect(tracks.filter(item => item.catId === catId).map(item => item.catAchievementKind).sort())
      .toEqual(["bond", "equipment", "level"]);
  });

  expect(isActiveAchievement(TIERED_ACHIEVEMENTS.find(item => item.id === "cat_level"))).toBe(false);
  expect(isActiveAchievement(TIERED_ACHIEVEMENTS.find(item => item.id === "cat_bond"))).toBe(false);
  expect(isActiveAchievement(TIERED_ACHIEVEMENTS.find(item => item.id === "cat_collect"))).toBe(true);
});

test("九貓三條養成里程碑固定為現行等級／羈絆／裝備上限", () => {
  const tracks = TIERED_ACHIEVEMENTS.filter(item =>
    isActiveAchievement(item) && item.catAchievementKind
  );
  const expected = {
    level: [10, 50, 100, 200, 300, 500],
    bond: [5, 10, 20, 30, 40, 50],
    equipment: [5, 10, 20, 30, 40, 50],
  };
  tracks.forEach(item => {
    expect(item.tiers.map(tier => tier.count)).toEqual(expected[item.catAchievementKind]);
  });
});

test("各貓等級與羈絆進度完全隔離，並使用貓咪自身等級公式", () => {
  const catIds = Object.keys(CATS);
  const [firstId, secondId, unownedId] = catIds;
  const firstLevel = TIERED_ACHIEVEMENTS.find(item => item.id === `cat_${firstId}_level`);
  const secondLevel = TIERED_ACHIEVEMENTS.find(item => item.id === `cat_${secondId}_level`);
  const unownedLevel = TIERED_ACHIEVEMENTS.find(item => item.id === `cat_${unownedId}_level`);
  const firstBond = TIERED_ACHIEVEMENTS.find(item => item.id === `cat_${firstId}_bond`);
  const secondBond = TIERED_ACHIEVEMENTS.find(item => item.id === `cat_${secondId}_bond`);
  const highXP = 123456;
  const highBond = 999999;
  const cats = [
    { catId:firstId, catXP:highXP, bond:highBond, equip:{} },
    { catId:secondId, catXP:0, bond:0, equip:{} },
  ];

  expect(firstLevel.getValue({ cats })).toBe(catLevelFromXP(highXP));
  expect(secondLevel.getValue({ cats })).toBe(catLevelFromXP(0));
  expect(unownedLevel.getValue({ cats })).toBe(0);
  expect(firstBond.getValue({ cats })).toBe(getBondLevel(highBond));
  expect(firstBond.getValue({ cats })).toBe(50);
  expect(secondBond.getValue({ cats })).toBe(0);
});

test("貓裝成就以七槽整套平均強化計算，缺裝算 +0，單件 +50 不能冒充整套高強化", () => {
  const catId = Object.keys(CATS)[0];
  const equipment = TIERED_ACHIEVEMENTS.find(item => item.id === `cat_${catId}_equipment`);
  const slotId = slot => typeof slot === "string" ? slot : slot.id;
  const maxItem = { grade:"神話", plusLevel:0 };

  expect(CAT_EQUIP_SLOTS).toHaveLength(7);
  expect(catEquipEnhancement(maxItem.grade, maxItem.plusLevel)).toBe(50);
  expect(equipment.getValue({ cats:[{ catId, equip:{} }] })).toBe(0);

  const oneMax = { [slotId(CAT_EQUIP_SLOTS[0])]:maxItem };
  expect(equipment.getValue({ cats:[{ catId, equip:oneMax }] })).toBe(Math.floor(50 / 7));
  expect(computeTierProgress(equipment, { cats:[{ catId, equip:oneMax }] }).unlockedCount).toBe(1);

  const fullMax = Object.fromEntries(
    CAT_EQUIP_SLOTS.map(slot => [slotId(slot), { ...maxItem }])
  );
  expect(equipment.getValue({ cats:[{ catId, equip:fullMax }] })).toBe(50);
  expect(computeTierProgress(equipment, { cats:[{ catId, equip:fullMax }] }).isComplete).toBe(true);
});
