// src/arcade/arcadeDb.test.js — 雲端保存合併邏輯單元測試
import { mergeRemoteProfile, profileForCloud } from "./arcadeDb";

describe("mergeRemoteProfile（本機＋雲端合併）", () => {
  const base = (overrides) => ({
    visitorId: "abc",
    nickname: "小勇者",
    coins: 100,
    catLevel: 2,
    inventory: { fire_arrow: 3, catnip: 1 },
    statistics: { battles: 5, kills: 20, bestDamage: 80, xCount: 30, bestCombo: 1.5 },
    teamStats: { forest: { wins: 2, bestCombo: 1.25, bestTimeMs: 120000 } },
    achievements: ["first_win"],
    lastPlayedAt: 1000,
    ...overrides,
  });

  it("兩邊都有 → 取較新 lastPlayedAt 的 identity，數值取 max", () => {
    const local = base({ lastPlayedAt: 2000, coins: 80, statistics: { battles: 3, kills: 10, bestDamage: 60, xCount: 20, bestCombo: 1.1 } });
    const remote = base({ lastPlayedAt: 1000, coins: 150, statistics: { battles: 8, kills: 30, bestDamage: 90, xCount: 40, bestCombo: 1.5 } });
    const merged = mergeRemoteProfile(local, remote);
    expect(merged.lastPlayedAt).toBe(2000); // local 較新
    expect(merged.coins).toBe(150);          // 取 max
    expect(merged.statistics.battles).toBe(8);
    expect(merged.statistics.bestCombo).toBe(1.5);
  });

  it("teamStats：各自模式獨立，bestTimeMs 取較短", () => {
    const local = base({ lastPlayedAt: 1000, teamStats: { forest: { wins: 1, bestCombo: 1.1, bestTimeMs: 90000 } } });
    const remote = base({ lastPlayedAt: 2000, teamStats: { abyss: { wins: 3, bestCombo: 1.5, bestTimeMs: 60000 } } });
    const merged = mergeRemoteProfile(local, remote);
    expect(merged.teamStats.forest.wins).toBe(1);  // local 有 forest
    expect(merged.teamStats.abyss.wins).toBe(3);    // remote 有 abyss
  });

  it("同一模式 bestTimeMs 較短者勝", () => {
    const local = base({ lastPlayedAt: 1000, teamStats: { abyss: { wins: 1, bestCombo: 1.25, bestTimeMs: 80000 } } });
    const remote = base({ lastPlayedAt: 2000, teamStats: { abyss: { wins: 2, bestCombo: 1.5, bestTimeMs: 60000 } } });
    const merged = mergeRemoteProfile(local, remote);
    expect(merged.teamStats.abyss.wins).toBe(2);      // remote 較新
    expect(merged.teamStats.abyss.bestTimeMs).toBe(60000); // 取較短
    expect(merged.teamStats.abyss.bestCombo).toBe(1.5);
  });

  it("inventory 合併：同物品取 max", () => {
    const local = base({ lastPlayedAt: 1000, inventory: { fire_arrow: 2, catnip: 5 } });
    const remote = base({ lastPlayedAt: 2000, inventory: { fire_arrow: 8, cat_riceball: 3 } });
    const merged = mergeRemoteProfile(local, remote);
    expect(merged.inventory.fire_arrow).toBe(8);
    expect(merged.inventory.catnip).toBe(5);          // local 有
    expect(merged.inventory.cat_riceball).toBe(3);     // remote 有
  });

  it("achievements 併集不重複", () => {
    const local = base({ lastPlayedAt: 1000, achievements: ["first_win", "combo_master"] });
    const remote = base({ lastPlayedAt: 2000, achievements: ["combo_master", "speed_demon"] });
    const merged = mergeRemoteProfile(local, remote);
    expect(merged.achievements).toEqual(expect.arrayContaining(["first_win", "combo_master", "speed_demon"]));
    expect(new Set(merged.achievements).size).toBe(merged.achievements.length); // 無重複
  });

  it("duelStats 合併取 max，但上傳雲端時一定剝除", () => {
    const local = base({ lastPlayedAt: 2000, duelStats: { matches: 8, wins: 3, damage: 520, xCount: 12, bestScore: 30 } });
    const remote = base({ lastPlayedAt: 1000, duelStats: { matches: 5, wins: 4, damage: 600, xCount: 9, bestScore: 28 } });
    const merged = mergeRemoteProfile(local, remote);
    expect(merged.duelStats).toEqual({ matches: 8, wins: 4, damage: 600, xCount: 12, bestScore: 30 });
    const cloud = profileForCloud(merged);
    expect(cloud.duelStats).toBeUndefined();
    expect(merged.duelStats.matches).toBe(8); // sanitizer 不改本機物件
  });

  it("remote 為 null → 回傳 local", () => {
    const local = base({});
    expect(mergeRemoteProfile(local, null)).toBe(local);
  });

  it("local 為 null → 回傳 remote", () => {
    const remote = base({});
    expect(mergeRemoteProfile(null, remote)).toBe(remote);
  });
});
