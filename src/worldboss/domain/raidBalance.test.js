// 平衡模擬。
//
// ⚠️ 作者 2026-07-31 定案，這份測試分成**兩件不同的事**，不要混在一起看：
//   ① 戰鬥模型必須是**中性**的——越難的圈報酬越高，就這樣。
//      這裡不做任何「照顧新手」的手腳（那會讓數值失去意義）。
//   ② 新老差距的補償由**外層**負責（raidRookie.js，50 級以下），
//      所以「差距多少才合理」要看**套上新手扶助之後**的數字。
import { calcWorldBossArrowDmg } from "../../lib/damage";
import { RAID_TOTAL_ROUNDS, createRaidState, resolveRaidRound } from "./raidFlow";
import { WEAK_SPOTS, WEAK_SPOT_MAP } from "./weakPoints";
import { RANGE_MAX_MULT, RANGE_MIN_MULT, rangeMultiplier } from "./raidRange";
import { rookieMultiplier } from "./raidRookie";

const BOSS_HP = 200000;

// 三種玩家：sigma 是箭群散佈（越小越穩），level 決定有沒有新手扶助。
// E[半徑] ≈ σ√(π/2)：σ 0.42 → 平均 5 環、σ 0.26 → 7 環、σ 0.15 → 9 環
const PROFILES = {
  rookie:  { name: "新手白板",   atk: 30,  sigma: 0.42, level: 10 },
  mid:     { name: "中階玩家",   atk: 120, sigma: 0.26, level: 60 },
  veteran: { name: "114 級好裝", atk: 300, sigma: 0.15, level: 114 },
};

const SAMPLES = 120;   // ⚠️ 一場只有 30 支箭，單一 seed 的結果毫無統計意義

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller（兩個分量都用，不然會有相關性）
function gaussPair(rand, sigma) {
  const u = Math.max(1e-9, rand());
  const v = rand();
  const m = Math.sqrt(-2 * Math.log(u)) * sigma;
  return [m * Math.cos(2 * Math.PI * v), m * Math.sin(2 * Math.PI * v)];
}

function arrowAt(target, profile, rand) {
  const [dx, dy] = gaussPair(rand, profile.sigma);
  return { nx: (target?.cx || 0) + dx, ny: (target?.cy || 0) + dy, score: 5 };
}

// 期望值＝命中率 × 報酬。命中率用 2D 常態落在圓內的機率：1 - exp(-r²/2σ²)
const spotEV = (sigma, spot) => (1 - Math.exp(-(spot.radius ** 2) / (2 * sigma ** 2))) * spot.dmgPct;

// 好的打法：把箭分散到場上的圈（同一個圈重複打會遞減）
function simulateOne(profile, { seed = 7, level = null, force = null } = {}) {
  const rand = seeded(seed);
  let state = createRaidState({
    boss: { key: "sim", name: "模擬王", hp: BOSS_HP, maxHp: BOSS_HP, atk: 120, def: 50 },
    stats: { atk: profile.atk, def: 60, hp: 300 },
    archerLevel: level == null ? profile.level : level,
    rand,
  });
  for (let round = 0; round < RAID_TOTAL_ROUNDS; round += 1) {
    const spots = state.spots || [];
    const forced = force ? spots.find(s => s.id === force) : null;
    const arrows = Array.from({ length: 6 }, (_, i) => {
      const target = force ? forced : (spots.length ? spots[i % spots.length] : null);
      return arrowAt(target, profile, rand);
    });
    // 血量固定在滿血附近，才是在比「每箭貢獻」而不是比誰先把王打死
    state = { ...resolveRaidRound({ state, arrows, rand }).state, bossHp: BOSS_HP };
  }
  return state.totals;
}

function simulate(profile, opts = {}) {
  let damage = 0, breakPoints = 0;
  for (let i = 1; i <= SAMPLES; i += 1) {
    const t = simulateOne(profile, { ...opts, seed: (i * 2654435761) % 2147483647 });
    damage += t.damage;
    breakPoints += t.breakPoints;
  }
  return { damage: damage / SAMPLES, breakPoints: breakPoints / SAMPLES };
}

// ════════════════════════════════════════════════════════════
//  ① 戰鬥模型：必須中性
// ════════════════════════════════════════════════════════════
describe("戰鬥模型是中性的（不在這裡偷偷照顧新手）", () => {
  test("越小的圈，傷害越高——沒有例外", () => {
    for (let i = 1; i < WEAK_SPOTS.length; i += 1) {
      expect(WEAK_SPOTS[i].radius).toBeLessThan(WEAK_SPOTS[i - 1].radius);
      expect(WEAK_SPOTS[i].dmgPct).toBeGreaterThan(WEAK_SPOTS[i - 1].dmgPct);
    }
  });

  test("穩定度越高的射手，越吃得到小圈的報酬（這就是準度的價值）", () => {
    const bestFor = sigma => WEAK_SPOTS
      .map(s => ({ id: s.id, ev: spotEV(sigma, s) }))
      .sort((a, b) => b.ev - a.ev)[0].id;
    expect(["green", "yellow"]).toContain(bestFor(PROFILES.rookie.sigma));
    expect(["orange", "red"]).toContain(bestFor(0.09));   // 非常穩的射手
  });

  test("新手硬打紅點會比打綠點慘——小圈不是免費的", () => {
    expect(simulate(PROFILES.rookie, { force: "red" }).damage)
      .toBeLessThan(simulate(PROFILES.rookie, { force: "green" }).damage);
  });

  test("⚠️ 不做「同一個圈重複打會遞減」——打到就是打到，一支箭一份報酬", () => {
    const mod = require("./weakPoints");
    expect(mod.SPOT_DECAY).toBeUndefined();
    expect(mod.spotDecay).toBeUndefined();
  });

  test("⚠️ 命中率必須算進報酬：紅點面積只有綠點的 7%", () => {
    const area = s => s.radius ** 2;
    expect(area(WEAK_SPOT_MAP.red) / area(WEAK_SPOT_MAP.green)).toBeLessThan(0.1);
    expect(WEAK_SPOT_MAP.red.dmgPct / WEAK_SPOT_MAP.green.dmgPct).toBeGreaterThan(4);
  });
});

// ════════════════════════════════════════════════════════════
//  ② 補償：由外層（新手扶助）負責
// ════════════════════════════════════════════════════════════
describe("新手扶助把差距拉回可接受的範圍", () => {
  const rawRookie = simulate(PROFILES.rookie, { level: 99 }).damage;   // 關掉扶助
  const withHelp = simulate(PROFILES.rookie).damage;                   // 10 級，有扶助
  const veteran = simulate(PROFILES.veteran).damage;

  test("關掉扶助時差距確實很大——這就是需要外層補償的理由", () => {
    expect(veteran / rawRookie).toBeGreaterThan(4);
  });

  test("扶助的效果就是那個倍率，沒有別的暗招", () => {
    expect(withHelp / rawRookie).toBeCloseTo(rookieMultiplier(PROFILES.rookie.level), 1);
  });

  // ⚠️ 不能用精確相等：一般傷害公式裡有 attackDamageVariance()（真的 Math.random），
  //    同樣的輸入每次跑都會差千分之幾。這裡看的是「有沒有被扶助加成」，用比值判斷。
  test("老手完全不受扶助影響——這一層只碰 50 級以下", () => {
    expect(rookieMultiplier(PROFILES.veteran.level)).toBe(1);
    expect(rookieMultiplier(200)).toBe(1);
    expect(simulate(PROFILES.veteran, { level: 200 }).damage / veteran).toBeCloseTo(1, 1);
    expect(simulate(PROFILES.mid, { level: 200 }).damage / simulate(PROFILES.mid).damage).toBeCloseTo(1, 1);
  });

  test("扶助後差距明顯縮小", () => {
    expect(veteran / withHelp).toBeLessThan(veteran / rawRookie);
  });

  test("比舊制度（只有分數 × 攻擊力）明顯縮小", () => {
    const legacy = p => {
      let total = 0;
      for (let s = 1; s <= SAMPLES; s += 1) {
        const rand = seeded((s * 2654435761) % 2147483647);
        for (let i = 0; i < RAID_TOTAL_ROUNDS * 6; i += 1) {
          const a = arrowAt(null, p, rand);
          const ratio = Math.hypot(a.nx, a.ny);
          total += calcWorldBossArrowDmg(
            ratio > 1 ? 0 : Math.max(1, Math.ceil((1 - ratio) * 10)), p.atk, 50, 1, 0,
          );
        }
      }
      return total / SAMPLES;
    };
    expect(veteran / withHelp).toBeLessThan(legacy(PROFILES.veteran) / legacy(PROFILES.rookie) / 2);
  });
});

describe("破防貢獻：新手真的排得上去", () => {
  // ⚠️ 要比就要比同一個基準：新手扶助只加傷害、不加破防點數，
  //    所以這裡兩邊都關掉扶助，看的是**戰鬥模型本身**的性質。
  test("破防的差距比傷害差距更小——這是給新手的舞台", () => {
    const r = simulate(PROFILES.rookie, { level: 99 });
    const v = simulate(PROFILES.veteran, { level: 99 });
    expect(v.breakPoints / r.breakPoints).toBeLessThan(v.damage / r.damage);
  });

  test("新手一場累積得到有意義的破防點數（不是零頭）", () => {
    expect(simulate(PROFILES.rookie).breakPoints).toBeGreaterThan(5);
  });
});

describe("射程加成（貓小隊：17cm 半靶、5~18 米）", () => {
  test("同一張靶紙，退得越遠加成越高", () => {
    const at = d => rangeMultiplier({ distanceM: d, faceSizeCm: 17 });
    expect(at(18)).toBeGreaterThan(at(12));
    expect(at(12)).toBeGreaterThan(at(5));
  });

  test("同一個距離，靶紙越小加成越高——這才是難度的來源", () => {
    expect(rangeMultiplier({ distanceM: 18, faceSizeCm: 17 }))
      .toBeGreaterThan(rangeMultiplier({ distanceM: 18, faceSizeCm: 40 }));
    expect(rangeMultiplier({ distanceM: 18, faceSizeCm: 40 }))
      .toBeGreaterThan(rangeMultiplier({ distanceM: 18, faceSizeCm: 122 }));
  });

  test("開平方是刻意的：難度加倍不讓傷害也加倍，否則大家只會一路退到 18 米", () => {
    expect(rangeMultiplier({ distanceM: 18, faceSizeCm: 17 })
      / rangeMultiplier({ distanceM: 9, faceSizeCm: 17 })).toBeLessThan(2);
  });

  test("倍率有上下限，不會失控", () => {
    expect(rangeMultiplier({ distanceM: 1, faceSizeCm: 122 })).toBe(RANGE_MIN_MULT);
    expect(rangeMultiplier({ distanceM: 90, faceSizeCm: 10 })).toBe(RANGE_MAX_MULT);
  });

  test("靶紙沒有尺寸資料（原野靶）→ 不給也不扣", () => {
    expect(rangeMultiplier({ distanceM: 18, faceSizeCm: null })).toBe(1);
    expect(rangeMultiplier({})).toBe(1);
  });
});
