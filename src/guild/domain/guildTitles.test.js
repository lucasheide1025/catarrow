// src/guild/domain/guildTitles.test.js
import { buildTitleStats, evaluateTitles, unlockedTitles, setGuildTitle, currentTitle } from "./guildTitles";
import { emptyGuildProfile, applyLootToProfile, sellJunkFromStock } from "./guildRewards";
import { salvageEquip } from "./guildEnhance";
import { GUILD_TITLES } from "../data/guildTitles";
import { GUILD_JUNK } from "../data/guildJunkCatalog";

const uidFn = (() => { let n = 0; return () => `u${n++}`; })();

describe("稱號表", () => {
  test("每個稱號都有分類、說明與判定函式，且**沒有任何戰力加成欄位**", () => {
    for (const t of GUILD_TITLES) {
      expect(t.name).toBeTruthy();
      expect(t.cat).toBeTruthy();
      expect(t.desc).toBeTruthy();
      expect(typeof t.of).toBe("function");
      // 稱號零加成——跟階級同一個原則，不可以偷偷加數值
      expect(t.atk).toBeUndefined();
      expect(t.hp).toBeUndefined();
      expect(t.mult).toBeUndefined();
    }
  });
});

describe("統計來源都是既有存檔欄位（不必另外埋點）", () => {
  test("新玩家什麼都沒有", () => {
    const s = buildTitleStats(emptyGuildProfile());
    expect(s).toMatchObject({ total: 0, won: 0, hardWon: 0, mythicWon: 0, junkSeen: 0, maxPlus: 0, salvaged: 0, catEarned: 0 });
    expect(s.junkTotal).toBe(GUILD_JUNK.length);
  });

  test("遠征勝場依危險度分流（☠️×3+ / ☠️×5+ / ☠️×6）", () => {
    let p = emptyGuildProfile();
    const win = danger => { p = applyLootToProfile(p, { won: true, junk: [], equipDrops: [], catCoins: 0 }, { danger, uidFn }).profile; };
    win(1); win(3); win(5); win(6); win(6);
    const s = buildTitleStats(p);
    expect(s.won).toBe(5);
    expect(s.hardWon).toBe(4);     // 3,5,6,6
    expect(s.deadlyWon).toBe(3);   // 5,6,6
    expect(s.mythicWon).toBe(2);
  });

  test("CAT幣是「累計賺取」——花掉也不會倒退", () => {
    let p = applyLootToProfile(emptyGuildProfile(), { won: true, junk: [], equipDrops: [], catCoins: 100 }, { danger: 1, uidFn }).profile;
    expect(buildTitleStats(p).catEarned).toBe(100);
    p = { ...p, catCoins: 0 };                       // 全部花光
    expect(buildTitleStats(p).catEarned).toBe(100);  // 累計不受影響
  });

  test("賣雜貨也算賺取", () => {
    const withJunk = applyLootToProfile(emptyGuildProfile(), { won: true, junk: [{ id: "gemstone_shard" }], equipDrops: [], catCoins: 0 }, { danger: 1, uidFn }).profile;
    const sold = sellJunkFromStock(withJunk, { gemstone_shard: 1 }, 1);
    expect(sold.profile.catEarned).toBeGreaterThan(0);
  });

  test("分解累計次數（裝備狂人用）", () => {
    const p = { ...emptyGuildProfile(), stash: [{ uid: "a", archetypeId: "iron_bow", grade: "rare", plus: 0, affixes: [] }] };
    const after = salvageEquip(p, "a").profile;
    expect(buildTitleStats(after).salvaged).toBe(1);
  });

  test("最高強化取「裝備中與倉庫」的最大值", () => {
    const p = {
      ...emptyGuildProfile(),
      equipped: { bow: { archetypeId: "iron_bow", grade: "boss", plus: 4, affixes: [] } },
      stash: [{ uid: "a", archetypeId: "wood_bow", grade: "elite", plus: 6, affixes: [] }],
    };
    expect(buildTitleStats(p).maxPlus).toBe(6);
  });
});

describe("解鎖與配戴", () => {
  test("達標才解鎖，進度百分比可畫", () => {
    const rookie = evaluateTitles(emptyGuildProfile()).find(t => t.id === "rookie");
    expect(rookie.unlocked).toBe(false);
    expect(rookie.progressPct).toBe(0);

    const won1 = applyLootToProfile(emptyGuildProfile(), { won: true, junk: [], equipDrops: [], catCoins: 0 }, { danger: 1, uidFn }).profile;
    expect(evaluateTitles(won1).find(t => t.id === "rookie").unlocked).toBe(true);
    expect(unlockedTitles(won1).length).toBeGreaterThan(0);
  });

  test("沒解鎖的稱號不能配戴", () => {
    const p = emptyGuildProfile();
    expect(setGuildTitle(p, "legendary").title).toBeNull();   // 沒解鎖 → 不會被配戴
    expect(setGuildTitle(p, "not_a_title").title).toBeNull(); // 不存在的 id 也擋下
    expect(currentTitle(p)).toBeNull();
  });

  test("解鎖後可配戴、可取下", () => {
    const won1 = applyLootToProfile(emptyGuildProfile(), { won: true, junk: [], equipDrops: [], catCoins: 0 }, { danger: 1, uidFn }).profile;
    const worn = setGuildTitle(won1, "rookie");
    expect(worn.title).toBe("rookie");
    expect(currentTitle(worn).name).toBeTruthy();
    expect(setGuildTitle(worn, null).title).toBeNull();
  });

  test("存檔裡的稱號若條件已不符 → 不顯示假稱號", () => {
    const fake = { ...emptyGuildProfile(), title: "legendary" };
    expect(currentTitle(fake)).toBeNull();
  });

  test("全收集類稱號的 need 會跟著圖鑑總數走", () => {
    const completist = evaluateTitles(emptyGuildProfile()).find(t => t.id === "completist");
    expect(completist.need).toBe(GUILD_JUNK.length);
  });
});
