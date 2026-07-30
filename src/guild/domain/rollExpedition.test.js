// src/guild/domain/rollExpedition.test.js
import {
  DANGER_META,
  GUILD_TIER_SCALE,
  MAX_DANGER,
  MAX_TARGETS,
  planWaveRoles,
  rollExpedition,
} from "./rollExpedition";
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

  test("所有階級怪物都在 3～10 公尺間隨機進場", () => {
    for (let danger = 1; danger <= MAX_DANGER; danger++) {
      const near = rollExpedition({ danger }, { rand: () => 0 }).waves.flatMap(wave => wave.monsters);
      const far = rollExpedition({ danger }, { rand: () => 0.999999 }).waves.flatMap(wave => wave.monsters);
      expect(near.every(monster => monster.distance === 3)).toBe(true);
      expect(far.every(monster => monster.distance === 10)).toBe(true);
    }
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
  // 2026-07-30 作者要求把第七族加入輪替（原本刻意排除，因為它在主線是隱藏地下城專屬）
  test("寶箱族已加入委託輪替", () => {
    const families = new Set();
    for (let seed = 1; seed <= 60; seed += 1) {
      let x = seed;
      const rand = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
      const exp = rollExpedition({ danger: 2, family: "treasure" }, { rand });
      exp.waves.forEach(w => w.monsters.forEach(mon => families.add(mon.family)));
    }
    expect(families.has("treasure")).toBe(true);
  });
});

describe("波次規模與角色組成（2026-07-30 放寬高危險度 + 組成隨機）", () => {
  const seeded = seed => {
    let x = seed;
    return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  };

  test("低危險度維持原樣，高危險度才放寬", () => {
    // ☠️1~2 不動：新手體驗不變
    expect(DANGER_META[1].waveSize).toEqual([1, 2]);
    expect(DANGER_META[2].waveSize).toEqual([2, 3]);
    // ☠️4 以上明顯拉開
    expect(DANGER_META[5].waveSize[1]).toBeGreaterThan(4);
    expect(DANGER_META[6].waveSize[0]).toBeGreaterThanOrEqual(4);
  });

  test("同時上限不再把高危險度的上緣切掉", () => {
    for (const danger of [1, 2, 3, 4, 5, 6]) {
      expect(DANGER_META[danger].waveSize[1]).toBeLessThanOrEqual(MAX_TARGETS);
    }
  });

  test("多次擲出的每波隻數會有變化，不是固定值", () => {
    const sizes = new Set();
    for (let seed = 1; seed <= 40; seed += 1) {
      const exp = rollExpedition({ danger: 5, family: "ghost" }, { rand: seeded(seed) });
      exp.waves.forEach(w => sizes.add(w.monsters.length));
    }
    expect(sizes.size).toBeGreaterThan(1);
  });

  test("planWaveRoles：1 隻給近戰、2 隻近戰+遠程、3 隻再加施法或支援", () => {
    const melee = ["pursuer", "heavy", "charger"];
    const ranged = ["ranged", "caster"];
    const support = ["caster", "support"];
    expect(planWaveRoles(1, seeded(7))).toHaveLength(1);
    expect(melee).toContain(planWaveRoles(1, seeded(7))[0]);

    const two = planWaveRoles(2, seeded(11));
    expect(two).toHaveLength(2);
    expect(two.some(r => melee.includes(r))).toBe(true);
    expect(two.some(r => ranged.includes(r))).toBe(true);

    const three = planWaveRoles(3, seeded(13));
    expect(three).toHaveLength(3);
    expect(three.some(r => melee.includes(r))).toBe(true);
    expect(three.some(r => ranged.includes(r))).toBe(true);
    expect(three.some(r => support.includes(r))).toBe(true);
  });

  test("planWaveRoles 邊界：0 隻回空、大量也不會少給", () => {
    expect(planWaveRoles(0)).toEqual([]);
    expect(planWaveRoles(-3)).toEqual([]);
    expect(planWaveRoles(6, seeded(3))).toHaveLength(6);
  });

  test("組成會因為 seed 不同而不同（不再由 monsterId hash 綁死）", () => {
    const a = rollExpedition({ danger: 6, family: "ghost" }, { rand: seeded(21) });
    const b = rollExpedition({ danger: 6, family: "ghost" }, { rand: seeded(99) });
    const rolesOf = exp => exp.waves.flatMap(w => w.monsters.map(m => m.combatRole || "auto")).join(",");
    expect(rolesOf(a)).not.toBe(rolesOf(b));
  });

  test("首領不被組成規劃洗掉角色", () => {
    const exp = rollExpedition({ danger: 6, family: "ghost" }, { rand: seeded(5) });
    const last = exp.waves[exp.waves.length - 1];
    const leader = last.monsters.find(m => m.encounter === "boss" || m.encounter === "miniBoss");
    expect(leader).toBeTruthy();
    expect(leader.combatRole).toBeUndefined();   // 交給圖鑑/hash 決定
  });
});

describe("首領單挑（2026-07-30）", () => {
  const seeded = seed => { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; };
  const duel = (danger, extra = {}) => rollExpedition(
    { id: "d", danger, family: "ghost", mode: "duel", ...extra }, { rand: seeded(7) },
  );

  test("只有一波、只有一隻", () => {
    for (const danger of [1, 3, 5, 6]) {
      const exp = duel(danger);
      expect(exp.totalWaves).toBe(1);
      expect(exp.waves).toHaveLength(1);
      expect(exp.waves[0].monsters).toHaveLength(1);
      expect(exp.isDuel).toBe(true);
    }
  });

  test("對手是首領，不是雜兵", () => {
    for (const danger of [3, 4]) {
      expect(duel(danger).waves[0].monsters[0].encounter).toBe("miniBoss");
    }
    for (const danger of [5, 6]) {
      expect(duel(danger).waves[0].monsters[0].encounter).toBe("boss");
    }
  });

  test("血量比一般首領厚——否則三箭結束、技能放不出來", () => {
    const solo = duel(5).waves[0].monsters[0];
    const normal = rollExpedition({ id: "n", danger: 5, family: "ghost" }, { rand: seeded(7) });
    const anyBoss = normal.waves.flatMap(w => w.monsters).find(m => m.encounter === "boss");
    if (anyBoss) expect(solo.maxHp).toBeGreaterThan(anyBoss.maxHp);
    expect(solo.hp).toBe(solo.maxHp);
  });

  test("起始距離夠遠，玩家有回合觀察蓄力節奏", () => {
    expect(duel(5).waves[0].monsters[0].distance).toBeGreaterThanOrEqual(8);
  });

  test("單挑也吃詞綴", () => {
    const plain = duel(5).waves[0].monsters[0];
    const buffed = duel(5, { affixes: ["berserk", "veteran"] }).waves[0].monsters[0];
    expect(buffed.atk).toBeGreaterThan(plain.atk);
    expect(buffed.maxHp).toBeGreaterThan(plain.maxHp);
  });

  test("非單挑模式完全不受影響", () => {
    const normal = rollExpedition({ id: "n", danger: 3, family: "ghost" }, { rand: seeded(7) });
    expect(normal.isDuel).toBeUndefined();
    expect(normal.totalWaves).toBeGreaterThan(1);
  });
});
