import {
  BULLSEYE_BONUS,
  CHARGE_EXPOSED_BONUS,
  STAGGER_BONUS,
  WEAK_SPOTS,
  WEAK_SPOT_MAP,
  hitSpot,
  resolveWeakPointHit,
  rollWeakSpots,
  standardScoreFromRatio,
} from "./weakPoints";

const BOSS_HP = 200000;
const seeded = seed => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const spotAt = (id, cx = 0, cy = 0) => ({ ...WEAK_SPOT_MAP[id], cx, cy });
const shoot = (spots, nx, ny, extra = {}) =>
  resolveWeakPointHit({ spots, nx, ny, bossMaxHp: BOSS_HP, ...extra });

describe("四種弱點：大小＝難度，顏色＝報酬", () => {
  test("越小的圈傷害越高；破防點數不遞減（一場只有 30 箭，點數刻意壓低）", () => {
    for (let i = 1; i < WEAK_SPOTS.length; i += 1) {
      expect(WEAK_SPOTS[i].radius).toBeLessThan(WEAK_SPOTS[i - 1].radius);
      expect(WEAK_SPOTS[i].dmgPct).toBeGreaterThan(WEAK_SPOTS[i - 1].dmgPct);
      expect(WEAK_SPOTS[i].breakPoints).toBeGreaterThanOrEqual(WEAK_SPOTS[i - 1].breakPoints);
    }
    // 最難的還是要比最好打的多
    expect(WEAK_SPOTS[WEAK_SPOTS.length - 1].breakPoints).toBeGreaterThan(WEAK_SPOTS[0].breakPoints);
  });

  test("破防點數壓在個位數——一場 30 箭不該把全場的槽灌爆", () => {
    for (const s2 of WEAK_SPOTS) expect(s2.breakPoints).toBeLessThanOrEqual(3);
  });

  test("每種都有顯示資料，UI 才畫得出來", () => {
    for (const s of WEAK_SPOTS) {
      expect(s.name && s.icon && s.color && s.desc).toBeTruthy();
      expect(s.radius).toBeGreaterThan(0);
    }
  });

  test("只有紅點會削弱牠的強攻", () => {
    expect(WEAK_SPOTS.filter(s => s.weakensUlt).map(s => s.id)).toEqual(["red"]);
  });
});

describe("命中判定", () => {
  test("射進圈裡＝命中，圈外＝只有一般傷害", () => {
    const green = WEAK_SPOT_MAP.green;
    const spots = [spotAt("green", 0.3, 0)];
    expect(shoot(spots, 0.3, 0).hit).toBe(true);
    expect(shoot(spots, 0.3, green.radius * 0.95).hit).toBe(true);   // 圈邊緣內
    expect(shoot(spots, 0.3, green.radius * 1.15).hit).toBe(false);  // 圈外
    expect(shoot(spots, 0.3, green.radius * 1.15).normalMult).toBe(1); // 但沒有額外懲罰
  });

  test("脫靶（半徑 > 1）連一般傷害都沒有", () => {
    const r = shoot([spotAt("green")], 0.9, 0.9);
    expect(r.missed).toBe(true);
    expect(r.normalMult).toBe(0);
  });

  test("沒有圈的回合照常射，不會壞掉", () => {
    const r = shoot([], 0.1, 0.1);
    expect(r.hit).toBe(false);
    expect(r.normalMult).toBe(1);
  });

  test("圈重疊時算最難的那個——玩家該拿到他真正達成的那一層", () => {
    const spots = [spotAt("green", 0, 0), spotAt("red", 0, 0)];
    expect(hitSpot(spots, 0.01, 0).id).toBe("red");
    expect(hitSpot(spots, 0.2, 0).id).toBe("green");
  });

  test("傷害＝王最大血量的固定比例，不乘攻擊力", () => {
    for (const s2 of WEAK_SPOTS) {
      expect(shoot([spotAt(s2.id)], 0, 0).flatDamage).toBe(Math.round(BOSS_HP * s2.dmgPct * BULLSEYE_BONUS));
    }
  });

  test("三連靶：同樣的座標但不同張靶，不算命中", () => {
    const spots = [{ ...WEAK_SPOT_MAP.green, cx: 0, cy: 0, faceIndex: 1 }];
    expect(resolveWeakPointHit({ spots, nx: 0, ny: 0, faceIndex: 1, bossMaxHp: BOSS_HP }).hit).toBe(true);
    expect(resolveWeakPointHit({ spots, nx: 0, ny: 0, faceIndex: 0, bossMaxHp: BOSS_HP }).hit).toBe(false);
  });
});

describe("正中加碼", () => {
  test("射進圈心一半的範圍＝正中，傷害加一層", () => {
    const spots = [spotAt("yellow", 0, 0)];
    const r = WEAK_SPOT_MAP.yellow.radius;
    const edge = shoot(spots, r * 0.8, 0);   // 圈內但偏外
    const centre = shoot(spots, r * 0.1, 0);
    expect(edge.bullseye).toBe(false);
    expect(centre.bullseye).toBe(true);
    expect(centre.flatDamage).toBe(Math.round(edge.flatDamage * BULLSEYE_BONUS));
  });

  test("⚠️ 正中**不加**破防點數——一場只有 30 箭，加了會把槽灌爆", () => {
    const spots = [spotAt("yellow", 0, 0)];
    const r = WEAK_SPOT_MAP.yellow.radius;
    expect(shoot(spots, r * 0.1, 0).breakPoints).toBe(shoot(spots, r * 0.8, 0).breakPoints);
  });
});

describe("情境倍率", () => {
  const spots = [spotAt("yellow", 0, 0)];
  const base = () => shoot(spots, WEAK_SPOT_MAP.yellow.radius * 0.8, 0).flatDamage;

  test("蓄力回合弱點外露，值得貪", () => {
    expect(shoot(spots, WEAK_SPOT_MAP.yellow.radius * 0.8, 0, { charging: true }).flatDamage)
      .toBe(Math.round(base() * CHARGE_EXPOSED_BONUS));
  });

  test("打斷後的硬直回合傷害加倍", () => {
    expect(shoot(spots, WEAK_SPOT_MAP.yellow.radius * 0.8, 0, { staggered: true }).flatDamage)
      .toBe(Math.round(base() * STAGGER_BONUS));
  });

  test("倍率只碰固定傷害，不碰一般傷害", () => {
    expect(shoot(spots, WEAK_SPOT_MAP.yellow.radius * 0.8, 0, { charging: true, staggered: true }).normalMult).toBe(1);
  });
});

describe("每回合抽圈", () => {
  test("三連靶時圈會分佈在三張靶上", () => {
    const seen = new Set();
    for (let seed = 1; seed <= 200; seed += 1) {
      for (const sp of rollWeakSpots({ rand: seeded(seed), faceCount: 3 })) seen.add(sp.faceIndex);
    }
    expect(seen).toEqual(new Set([0, 1, 2]));
  });

  test("單靶時 faceIndex 恆為 0", () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      for (const sp of rollWeakSpots({ rand: seeded(seed) })) expect(sp.faceIndex).toBe(0);
    }
  });

  test("每回合 1~2 個（作者定案）", () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const spots = rollWeakSpots({ rand: seeded(seed) });
      expect(spots.length).toBeGreaterThanOrEqual(1);
      expect(spots.length).toBeLessThanOrEqual(2);
    }
  });

  test("⚠️ 整個圈都要在靶紙內——不然會出現射不滿的圈", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      for (const s of rollWeakSpots({ rand: seeded(seed) })) {
        expect(Math.hypot(s.cx, s.cy) + s.radius).toBeLessThanOrEqual(1);
      }
    }
  });

  test("兩個圈時一大一小——新手有得打，老手有得賭", () => {
    for (let seed = 1; seed <= 120; seed += 1) {
      const spots = rollWeakSpots({ rand: seeded(seed) });
      if (spots.length === 2) {
        const ids = spots.map(s => s.id);
        expect(ids.some(id => ["green", "yellow"].includes(id))).toBe(true);
        expect(ids.some(id => ["orange", "red"].includes(id))).toBe(true);
      }
    }
  });

  test("同一張靶上的圈不會互相重疊，否則一箭吃兩個", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const spots = rollWeakSpots({ rand: seeded(seed) });
      if (spots.length === 2 && spots[0].faceIndex === spots[1].faceIndex) {
        expect(Math.hypot(spots[0].cx - spots[1].cx, spots[0].cy - spots[1].cy))
          .toBeGreaterThan(spots[0].radius + spots[1].radius);
      }
    }
  });

  test("位置每回合都不同——不能靠肌肉記憶一直射同一點", () => {
    const rand = seeded(9);
    const a = rollWeakSpots({ rand, round: 1 });
    const b = rollWeakSpots({ rand, round: 2 });
    expect(JSON.stringify(a.map(s => [s.cx, s.cy]))).not.toBe(JSON.stringify(b.map(s => [s.cx, s.cy])));
  });

  test("後段階段更容易出現小圈（更吃準度）", () => {
    const smallRate = phaseId => {
      let small = 0, total = 0;
      for (let seed = 1; seed <= 300; seed += 1) {
        for (const s of rollWeakSpots({ rand: seeded(seed), phaseId })) {
          total += 1;
          if (["orange", "red"].includes(s.id)) small += 1;
        }
      }
      return small / total;
    };
    expect(smallRate(3)).toBeGreaterThan(smallRate(1));
  });
});

describe("標準環值（只用於顯示，跨靶紙可比）", () => {
  test("中心＝10、邊緣＝1、靶外＝0", () => {
    expect(standardScoreFromRatio(0)).toBe(10);
    expect(standardScoreFromRatio(0.95)).toBe(1);
    expect(standardScoreFromRatio(1.4)).toBe(0);
  });

  test("⚠️ 17cm 半靶印的是 6~10 環，換算後才跨靶紙可比", () => {
    expect(standardScoreFromRatio(0.92)).toBeLessThan(6);
  });
});
