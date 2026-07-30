// src/guild/domain/guildStats.test.js
import {
  GUILD_BASE_STATS,
  calcGuildExpeditionStats,
  carryStatus,
  deriveGuildCombat,
  guildArcherBonus,
  sumGuildEquipStats,
} from "./guildStats";
import { archerLevelBonus } from "../../lib/archerLevel";

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

describe("VIT 負重上調（2026-07-30）", () => {
  test("VIT 明顯影響可攜帶量，不再是「幾乎沒感覺」", () => {
    const carry = vit => deriveGuildCombat({ hp: 100, atk: 16, agi: 10, def: 5, vit, luk: 5 }).carryBonus;
    expect(carry(0)).toBe(0);
    expect(carry(10)).toBeGreaterThan(carry(0));
    expect(carry(54)).toBeGreaterThan(carry(10));
    // 頂配 VIT 要能多帶「一整趟份量」以上（食物+水各 10 份＝20kg）
    expect(carry(54)).toBeGreaterThanOrEqual(20);
  });

  test("基礎負重要留有餘裕：滿帶補給後還裝得下裝備", () => {
    const status = carryStatus({
      derived: deriveGuildCombat({ hp: 100, atk: 16, agi: 10, def: 5, vit: 10, luk: 5 }),
      gearWeight: 0, food: 10, water: 10,     // 滿帶
    });
    expect(status.capacity).toBeGreaterThan(20);   // 20 = 滿帶補給的重量
  });
});

describe("射手等級加成改用公會專用遞減曲線（2026-07-30）", () => {
  test("低於 50 等成長最快——新手每一級都有感", () => {
    const perLevelEarly = guildArcherBonus(30).hp - guildArcherBonus(29).hp;
    const perLevelMid = guildArcherBonus(80).hp - guildArcherBonus(79).hp;
    const perLevelLate = guildArcherBonus(300).hp - guildArcherBonus(299).hp;
    expect(perLevelEarly).toBeGreaterThan(perLevelMid);
    expect(perLevelMid).toBeGreaterThan(perLevelLate);
  });

  test("50 等以下比舊的線性曲線給得多", () => {
    const oldHp = lv => (lv - 1) * 5;      // 主線 archerLevelBonus 的公式
    const oldAtk = lv => Math.floor(lv / 5);
    for (const lv of [10, 25, 50]) {
      expect(guildArcherBonus(lv).hp).toBeGreaterThan(oldHp(lv));
      expect(guildArcherBonus(lv).atk).toBeGreaterThan(oldAtk(lv));
    }
  });

  test("100 等以上大幅遞減，滿等不再輾壓", () => {
    expect(guildArcherBonus(500).hp).toBeLessThan((500 - 1) * 5 / 3);
    expect(guildArcherBonus(500).atk).toBeLessThan(100 * 0.7);
  });

  test("新老差距壓在 3 倍內（作者要求「差距不要太大」）", () => {
    const rookie = guildArcherBonus(50);
    const veteran = guildArcherBonus(500);
    expect(veteran.hp / rookie.hp).toBeLessThan(3);
    expect(veteran.atk / rookie.atk).toBeLessThan(3);
  });

  test("單調不遞減，且 1 級為 0", () => {
    expect(guildArcherBonus(1)).toEqual({ hp: 0, atk: 0, def: 0 });
    let prevHp = -1; let prevAtk = -1;
    for (let lv = 1; lv <= 500; lv += 1) {
      const b = guildArcherBonus(lv);
      expect(b.hp).toBeGreaterThanOrEqual(prevHp);
      expect(b.atk).toBeGreaterThanOrEqual(prevAtk);
      prevHp = b.hp; prevAtk = b.atk;
    }
  });

  test("異常輸入不丟例外", () => {
    expect(guildArcherBonus(0)).toEqual({ hp: 0, atk: 0, def: 0 });
    expect(guildArcherBonus(-5)).toEqual({ hp: 0, atk: 0, def: 0 });
    expect(guildArcherBonus(undefined)).toEqual({ hp: 0, atk: 0, def: 0 });
  });

  test("公會不得改動主線的 archerLevelBonus（隔離鐵律）", () => {
    // 主線公式維持線性；若有人「順手」把主線改成遞減，這條會紅
    expect(archerLevelBonus(100)).toEqual({ hp: 495, atk: 20, def: 20 });
    expect(archerLevelBonus(500)).toEqual({ hp: 2495, atk: 100, def: 100 });
  });
});
