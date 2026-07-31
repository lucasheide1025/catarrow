// 平衡模擬：新老玩家的貢獻差距是這次改版的**主要目的**，所以用模擬把它釘住。
// 之後調 dmgPct / 門檻 / 倍率，都要讓這支測試繼續過——不靠手感。
//
// 作者原話：「低等玩家打不動 都是高等玩家在貢獻」。
import { calcWorldBossArrowDmg } from "../../lib/damage";
import { RAID_TOTAL_ROUNDS, createRaidState, resolveRaidRound } from "./raidFlow";

const BOSS_HP = 200000;

// 三種玩家。分數分佈用「平均 ± 抖動」模擬穩定度：老手不只射得高，也射得穩。
const PROFILES = {
  rookie:  { name: "新手白板",   atk: 30,  mean: 5, spread: 2, call: "leg" },
  mid:     { name: "中階玩家",   atk: 120, mean: 7, spread: 2, call: "heart" },
  veteran: { name: "114 級好裝", atk: 300, mean: 9, spread: 1, call: "eye" },
};

// 決定性亂數，測試才不會偶爾紅
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollScore(profile, rand) {
  const jitter = Math.round((rand() * 2 - 1) * profile.spread);
  return Math.max(0, Math.min(10, profile.mean + jitter));
}

// 跑完一整場出擊（5 回合 × 6 箭），回傳這個人打出的總傷害
function simulateSortie(profile, { seed = 7, call = null } = {}) {
  const rand = seeded(seed);
  let state = createRaidState({
    boss: { key: "sim", name: "模擬王", hp: BOSS_HP, maxHp: BOSS_HP, atk: 120, def: 50 },
    stats: { atk: profile.atk, def: 60, hp: 300 },
  });
  for (let round = 0; round < RAID_TOTAL_ROUNDS; round += 1) {
    const arrows = Array.from({ length: 6 }, () => ({
      declaredId: call || profile.call,
      score: rollScore(profile, rand),
    }));
    // 血量固定在滿血附近，才是在比「每箭貢獻」而不是比誰先把王打死
    state = { ...resolveRaidRound({ state, arrows }).state, bossHp: BOSS_HP };
  }
  return state.totals.damage;
}

// 舊制度：沒有部位，只有 分數 × 攻擊力
function simulateLegacy(profile, seed = 7) {
  const rand = seeded(seed);
  let total = 0;
  for (let i = 0; i < RAID_TOTAL_ROUNDS * 6; i += 1) {
    total += calcWorldBossArrowDmg(rollScore(profile, rand), profile.atk, 50, 1, 0);
  }
  return total;
}

describe("舊制度的問題（改版的理由）", () => {
  test("只有分數 × 攻擊力時，貢獻差距接近十倍", () => {
    const gap = simulateLegacy(PROFILES.veteran) / simulateLegacy(PROFILES.rookie);
    expect(gap).toBeGreaterThan(7);
  });
});

describe("新制度：宣告制 + 固定傷害", () => {
  const rookie = simulateSortie(PROFILES.rookie);
  const mid = simulateSortie(PROFILES.mid);
  const veteran = simulateSortie(PROFILES.veteran);

  test("差距壓縮到 2.5×～4.5×（規格定案的目標區間）", () => {
    const gap = veteran / rookie;
    expect(gap).toBeGreaterThanOrEqual(2.5);
    expect(gap).toBeLessThanOrEqual(4.5);
  });

  test("比舊制度明顯縮小——這是改版的主要目的", () => {
    const legacyGap = simulateLegacy(PROFILES.veteran) / simulateLegacy(PROFILES.rookie);
    expect(veteran / rookie).toBeLessThan(legacyGap / 2);
  });

  test("老手仍然比較強——裝備和等級不能白練", () => {
    expect(veteran).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(rookie);
  });

  test("新手的絕對輸出比舊制度高很多：從「打不動」變成「打得動」", () => {
    expect(rookie).toBeGreaterThan(simulateLegacy(PROFILES.rookie) * 2);
  });
});

describe("宣告策略是有意義的選擇（不是只有一個正解）", () => {
  test("新手宣告眼睛會比宣告腿更慘——高門檻不是免費的", () => {
    const safe = simulateSortie(PROFILES.rookie, { call: "leg" });
    const greedy = simulateSortie(PROFILES.rookie, { call: "eye" });
    expect(greedy).toBeLessThan(safe);
  });

  test("老手宣告眼睛才划算——穩定度高的人該拿高門檻的回報", () => {
    const safe = simulateSortie(PROFILES.veteran, { call: "tail" });
    const greedy = simulateSortie(PROFILES.veteran, { call: "eye" });
    expect(greedy).toBeGreaterThan(safe);
  });

  test("中階玩家的最佳解在中間——三種人有三種答案", () => {
    const byPart = ["eye", "heart", "leg", "tail"]
      .map(call => ({ call, dmg: simulateSortie(PROFILES.mid, { call }) }))
      .sort((a, b) => b.dmg - a.dmg);
    expect(["heart", "leg"]).toContain(byPart[0].call);
  });
});

describe("破防貢獻：新手真的排得上去", () => {
  function simulateBreak(profile, call) {
    const rand = seeded(11);
    let state = createRaidState({
      boss: { key: "sim", name: "模擬王", hp: BOSS_HP, maxHp: BOSS_HP, atk: 120, def: 50 },
      stats: { atk: profile.atk, def: 60, hp: 300 },
    });
    for (let round = 0; round < RAID_TOTAL_ROUNDS; round += 1) {
      const arrows = Array.from({ length: 6 }, () => ({
        declaredId: call || profile.call, score: rollScore(profile, rand),
      }));
      state = { ...resolveRaidRound({ state, arrows }).state, bossHp: BOSS_HP };
    }
    return state.totals.breakPoints;
  }

  test("破防貢獻的差距比傷害差距更小——這是給新手的舞台", () => {
    const dmgGap = simulateSortie(PROFILES.veteran) / simulateSortie(PROFILES.rookie);
    const breakGap = simulateBreak(PROFILES.veteran) / simulateBreak(PROFILES.rookie);
    expect(breakGap).toBeLessThan(dmgGap);
    expect(breakGap).toBeLessThanOrEqual(3);
  });

  test("新手穩穩打腿，累積得到有意義的點數（不是零頭）", () => {
    expect(simulateBreak(PROFILES.rookie, "leg")).toBeGreaterThan(10);
  });
});
