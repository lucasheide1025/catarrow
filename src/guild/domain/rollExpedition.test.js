// src/guild/domain/rollExpedition.test.js
import { rollExpedition, DANGER_META, MAX_TARGETS } from "./rollExpedition";

// 固定亂數（deterministic），讓測試可重現
function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe("rollExpedition — 委託遠征生成", () => {
  test("波數依危險度（一般3/危險4/極危5）", () => {
    expect(rollExpedition({ danger: 1 }, { rand: seededRand(1) }).totalWaves).toBe(3);
    expect(rollExpedition({ danger: 2 }, { rand: seededRand(1) }).totalWaves).toBe(4);
    expect(rollExpedition({ danger: 3 }, { rand: seededRand(1) }).totalWaves).toBe(5);
  });

  test("每波怪數不超過畫面上限 4，且至少 1 隻", () => {
    const exp = rollExpedition({ danger: 3 }, { rand: seededRand(42) });
    for (const w of exp.waves) {
      expect(w.monsters.length).toBeGreaterThanOrEqual(1);
      expect(w.monsters.length).toBeLessThanOrEqual(MAX_TARGETS);
    }
  });

  test("怪物帶完整戰鬥數值與距離倒數", () => {
    const m = rollExpedition({ danger: 1 }, { rand: seededRand(7) }).waves[0].monsters[0];
    expect(m.maxHp).toBeGreaterThan(0);
    expect(m.atk).toBeGreaterThan(0);
    expect(m.hp).toBe(m.maxHp);
    expect(m.distance).toBeGreaterThan(0);
    expect(m.instanceId).toBeTruthy();
  });

  test("指定 family 時只出該族怪", () => {
    const exp = rollExpedition({ danger: 2, family: "ghost" }, { rand: seededRand(99) });
    const fams = exp.waves.flatMap(w => w.monsters.map(m => m.family));
    expect(fams.every(f => f === "ghost")).toBe(true);
  });

  test("怪物 tier 落在危險度允許範圍", () => {
    const exp = rollExpedition({ danger: 1 }, { rand: seededRand(3) });
    const allowed = DANGER_META[1].tiers;
    const tiers = exp.waves.flatMap(w => w.monsters.map(m => m.tier));
    expect(tiers.every(t => allowed.includes(t))).toBe(true);
  });
});
