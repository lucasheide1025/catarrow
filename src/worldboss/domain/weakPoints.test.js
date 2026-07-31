import {
  CHARGE_EXPOSED_BONUS,
  QUADRANT_BONUS,
  STAGGER_BONUS,
  WEAK_POINTS,
  WEAK_POINT_MAP,
  callableParts,
  clockOf,
  matchesQuadrant,
  resolveWeakPointHit,
  scoreOf,
} from "./weakPoints";

const BOSS_HP = 200000;
const shoot = (declaredId, score, extra = {}) =>
  resolveWeakPointHit({ declaredId, score, bossMaxHp: BOSS_HP, ...extra });
// 平衡數字一律從常數推導。寫死在測試裡的話，每次調平衡都要回頭改一輪測試。
const flatOf = (id, mult = 1) => Math.round(BOSS_HP * WEAK_POINT_MAP[id].dmgPct * mult);

describe("宣告制的判定", () => {
  test("分數達標＝命中，不再擲骰（玩家賭的是自己的穩定度）", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(shoot("eye", 9).hit).toBe(true);
      expect(shoot("eye", 8).hit).toBe(false);
    }
  });

  test("每個部位的門檻都不同，構成真實的取捨", () => {
    expect(shoot("eye", 8).grazed).toBe(true);
    expect(shoot("heart", 8).hit).toBe(true);
    expect(shoot("leg", 5).hit).toBe(true);
    expect(shoot("tail", 3).hit).toBe(true);
  });

  test("X 環當 10 分；M 是脫靶", () => {
    expect(scoreOf(0, "X")).toBe(10);
    expect(scoreOf(9, "M")).toBe(0);
    expect(shoot("eye", 0, { label: "X" }).hit).toBe(true);
    expect(shoot("eye", 10, { label: "M" }).missed).toBe(true);
  });

  test("脫靶什麼都沒有——連一般傷害都沒有", () => {
    const r = shoot("eye", 0);
    expect(r.normalMult).toBe(0);
    expect(r.flatDamage).toBe(0);
    expect(r.breakPoints).toBe(0);
  });

  test("高門檻部位賭失敗要有代價，否則所有人永遠宣告眼睛", () => {
    expect(shoot("eye", 5).normalMult).toBe(0.5);
    expect(shoot("heart", 5).normalMult).toBe(0.5);
    // 低門檻部位沒有懲罰——新手才敢用
    expect(shoot("leg", 4).normalMult).toBe(1);
    expect(shoot("tail", 2).normalMult).toBe(1);
  });

  test("沒宣告就只有一般傷害，不會拿到弱點收益", () => {
    const r = shoot(null, 10);
    expect(r.hit).toBe(false);
    expect(r.flatDamage).toBe(0);
    expect(r.normalMult).toBe(1);
  });
});

describe("固定傷害：不乘攻擊力，只看王的血量", () => {
  test("弱點傷害＝王最大血量的固定比例", () => {
    for (const part of WEAK_POINTS) {
      const r = shoot(part.id, 10);
      expect(r.flatDamage).toBe(Math.round(BOSS_HP * part.dmgPct));
    }
  });

  test("血越多的王，弱點的絕對傷害越高（比例制的重點）", () => {
    const small = resolveWeakPointHit({ declaredId: "eye", score: 10, bossMaxHp: 100000 });
    const big = resolveWeakPointHit({ declaredId: "eye", score: 10, bossMaxHp: 1100000 });
    expect(big.flatDamage).toBeGreaterThan(small.flatDamage * 10);
  });

  test("眼＞心＞腿＞尾，跟門檻高低一致", () => {
    const dmg = id => shoot(id, 10).flatDamage;
    expect(dmg("eye")).toBeGreaterThan(dmg("heart"));
    expect(dmg("heart")).toBeGreaterThan(dmg("leg"));
    expect(dmg("leg")).toBeGreaterThan(dmg("tail"));
  });
});

describe("情境倍率", () => {
  test("蓄力回合弱點外露，值得貪", () => {
    expect(shoot("heart", 10, { charging: true }).flatDamage)
      .toBe(flatOf("heart", CHARGE_EXPOSED_BONUS));
  });

  test("打斷後的硬直回合傷害加倍——這是打斷的回報", () => {
    expect(shoot("heart", 10, { staggered: true }).flatDamage)
      .toBe(flatOf("heart", STAGGER_BONUS));
  });

  test("倍率會疊乘（蓄力中被打斷後的下一輪最肥）", () => {
    const both = shoot("heart", 10, { charging: true, staggered: true }).flatDamage;
    expect(both).toBe(flatOf("heart", CHARGE_EXPOSED_BONUS * STAGGER_BONUS));
  });

  test("倍率只碰固定傷害，不碰一般傷害", () => {
    expect(shoot("heart", 10, { charging: true, staggered: true }).normalMult).toBe(1);
  });
});

describe("階段封鎖", () => {
  test("被護住的部位宣告無效，只剩一般傷害", () => {
    const r = shoot("eye", 10, { blocked: ["eye"] });
    expect(r.blocked).toBe(true);
    expect(r.hit).toBe(false);
    expect(r.flatDamage).toBe(0);
    expect(r.normalMult).toBe(1);   // 不額外懲罰——玩家是被規則擋的，不是賭輸
  });

  test("沒被封鎖的部位照常", () => {
    expect(shoot("heart", 10, { blocked: ["eye"] }).hit).toBe(true);
  });

  test("UI 拿得到「被鎖住」的旗標，才畫得出鎖鏈", () => {
    const parts = callableParts(["eye"]);
    expect(parts.find(p => p.id === "eye").blocked).toBe(true);
    expect(parts.find(p => p.id === "leg").blocked).toBe(false);
    expect(parts).toHaveLength(WEAK_POINTS.length);
  });
});

describe("方位加碼（靶面模式選配）", () => {
  test("正上方＝12 點、正右＝3 點、正下＝6 點、正左＝9 點", () => {
    expect(clockOf(0, -1)).toBe(12);
    expect(clockOf(1, 0)).toBe(3);
    expect(clockOf(0, 1)).toBe(6);
    expect(clockOf(-1, 0)).toBe(9);
  });

  test("容差 ±1 小時，且 12↔1 要繞回去算", () => {
    expect(matchesQuadrant(0, -1, 1)).toBe(true);
    expect(matchesQuadrant(0, -1, 12)).toBe(true);
    expect(matchesQuadrant(0, -1, 3)).toBe(false);
  });

  test("命中方位 → 固定傷害加碼且破防多 1 點", () => {
    const plain = shoot("heart", 10);
    const bonus = shoot("heart", 10, { nx: 0, ny: -1, weakClock: 12 });
    expect(bonus.flatDamage).toBe(Math.round(plain.flatDamage * QUADRANT_BONUS));
    expect(bonus.breakPoints).toBe(plain.breakPoints + 1);
    expect(bonus.bonuses).toContain("quadrant");
  });

  test("⚠️ 按分數鍵的玩家（沒有座標）完全不受影響——不能被排除", () => {
    const noCoords = shoot("heart", 10, { weakClock: 12 });
    expect(noCoords.hit).toBe(true);
    expect(noCoords.flatDamage).toBe(flatOf("heart"));
    expect(noCoords.bonuses).not.toContain("quadrant");
  });
});
