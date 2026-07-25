// src/guild/domain/guildStats.test.js
import { calcGuildExpeditionStats, sumGuildEquipStats, deriveGuildCombat, GUILD_BASE_STATS } from "./guildStats";

describe("guildStats — 六維戰力（隔離於主線）", () => {
  test("無裝備 Lv1：六維 = 基底（+射手等級 Lv1 加成=0）", () => {
    const s = calcGuildExpeditionStats({ archerXP: 0 }, {});
    expect(s.hp).toBe(GUILD_BASE_STATS.hp);
    expect(s.atk).toBe(GUILD_BASE_STATS.atk);
    expect(s.agi).toBe(GUILD_BASE_STATS.agi);
    expect(s._archerLevel).toBe(1);
  });

  test("射手等級只加 HP/ATK/DEF，不加 AGI/VIT/LUK", () => {
    const low = calcGuildExpeditionStats({ archerXP: 0 }, {});
    const high = calcGuildExpeditionStats({ archerXP: 100000 }, {});
    expect(high.hp).toBeGreaterThan(low.hp);
    expect(high.atk).toBeGreaterThanOrEqual(low.atk);
    expect(high.agi).toBe(low.agi); // 敏捷不吃等級
    expect(high.luk).toBe(low.luk); // 幸運不吃等級
  });

  test("公會裝備六維加總（含品級倍率）", () => {
    // 木弓 base atk8/agi2；rare 倍率 1.4 → atk≈11, agi≈3
    const eq = sumGuildEquipStats({ bow: { archetypeId: "wood_bow", grade: "rare" } });
    expect(eq.atk).toBe(Math.round(8 * 1.4));
    expect(eq.agi).toBe(Math.round(2 * 1.4));
    // 空槽不貢獻
    expect(eq.hp).toBe(0);
  });

  test("裝上獵弓提升六維（偏 AGI/LUK）", () => {
    const bare = calcGuildExpeditionStats({ archerXP: 0 }, {});
    const armed = calcGuildExpeditionStats({ archerXP: 0 }, { bow: { archetypeId: "hunter_bow", grade: "elite" } });
    expect(armed.atk).toBeGreaterThan(bare.atk);
    expect(armed.agi).toBeGreaterThan(bare.agi);
    expect(armed.luk).toBeGreaterThan(bare.luk);
  });

  test("衍生數值：DEF→減傷、VIT→省補給、LUK→掉寶，皆有上限", () => {
    const d = deriveGuildCombat({ hp: 200, atk: 30, agi: 50, def: 200, vit: 100, luk: 100 });
    expect(d.maxHP).toBe(200);
    expect(d.dmgReducePct).toBeLessThanOrEqual(60);
    expect(d.supplySavePct).toBeLessThanOrEqual(0.5);
    expect(d.dropBonusPct).toBeCloseTo(1.0);
  });
});
