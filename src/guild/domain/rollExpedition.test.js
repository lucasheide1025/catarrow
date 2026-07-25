// src/guild/domain/rollExpedition.test.js
import { rollExpedition, DANGER_META, MAX_TARGETS, MAX_DANGER, GUILD_TIER_SCALE } from "./rollExpedition";
import { EXPANSION_MONSTER_BY_ID } from "../../lib/monsterExpansionCatalog";

// 固定亂數（deterministic），讓測試可重現
function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe("rollExpedition — 委託遠征生成", () => {
  test("波數依危險度（1~6，波數只增不減）", () => {
    let prev = 0;
    for (let d = 1; d <= MAX_DANGER; d++) {
      const w = rollExpedition({ danger: d }, { rand: seededRand(1) }).totalWaves;
      expect(w).toBe(DANGER_META[d].waves);
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
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

  test("危險度 n 只出 Tn 的怪（1~6 一對一）", () => {
    for (let d = 1; d <= MAX_DANGER; d++) {
      const exp = rollExpedition({ danger: d }, { rand: seededRand(3 + d) });
      const tiers = exp.waves.flatMap(w => w.monsters.map(m => m.tier));
      expect(tiers.every(t => t === DANGER_META[d].tier)).toBe(true);
      expect(exp.waves.flatMap(w => w.monsters).every(m => m.tierIndex === d)).toBe(true);
    }
  });

  test("怪物來自擴充圖鑑，且 HP 吃公會縮放（不是原始數值）", () => {
    const exp = rollExpedition({ danger: 4 }, { rand: seededRand(11) });
    for (const m of exp.waves.flatMap(w => w.monsters)) {
      const raw = EXPANSION_MONSTER_BY_ID[m.monsterId];
      expect(raw).toBeTruthy();                       // 是新怪不是舊怪
      expect(m.maxHp).toBe(Math.max(1, Math.round(raw.hp * GUILD_TIER_SCALE[4].hp)));
      expect(m.artKey).toBeTruthy();                  // 有立繪 key 可畫圖
    }
  });

  test("寶箱族不會出現在委託裡", () => {
    for (let d = 1; d <= MAX_DANGER; d++) {
      const exp = rollExpedition({ danger: d }, { rand: seededRand(50 + d) });
      expect(exp.waves.flatMap(w => w.monsters).some(m => m.family === "treasure")).toBe(false);
    }
  });
});
