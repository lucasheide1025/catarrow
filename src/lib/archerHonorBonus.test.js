// 🏅 三種實體榮譽章的加成：肥貓章、積分章、成就章。
//
// ⚠️ 這些是道館裡**教練親手發的實體徽章**，不是遊戲內產出。
//
// ⚠️⚠️ **不設上限是作者的決定**（2026-08-03）：
//        「我就是煞車，而且這遊戲會繼續更新往上攀升」。
//      發放速度本身就是節流閥，遊戲數值本來也會隨改版成長。
//      **不要因為「看起來會通膨」就自己把上限加回去。**
//
// ⚠️ 難度排序是作者定的，**不要從點數權重去推**（2026-08-03 踩過這個坑）：
//      🐱 肥貓章 = 最難拿  → ATK，單顆最重
//      🏆 積分章 = 中間    → DEF
//      🏅 成就章 = 最好拿  → HP（HP 單位大又會被等級稀釋，實際權重最輕）
import { HONOR_BONUS_PER_BADGE, calcArcherStats, calcHonorBonus } from "./monsterData";

const member = (over = {}) => ({ joinDate: new Date().toISOString(), ...over });
const statsOf = (over = {}, extra = {}) =>
  calcArcherStats({ member: member(over), certification: null, certRecords: [], dexStats: null, ...extra });
const BASE = statsOf();

describe("每一顆章值多少", () => {
  test("肥貓章 → ATK：銅1／銀4／金12", () => {
    expect(calcHonorBonus({ fatCat: { bronze: 1 } }).atk).toBe(1);
    expect(calcHonorBonus({ fatCat: { silver: 1 } }).atk).toBe(4);
    expect(calcHonorBonus({ fatCat: { gold: 1 } }).atk).toBe(12);
  });

  test("積分章 → DEF：銅1／銀3／金9", () => {
    expect(calcHonorBonus({ score: { gold: 1 } }).def).toBe(9);
  });

  test("成就章 → HP：銀3／金8／黑15", () => {
    expect(calcHonorBonus({ achievement: { black: 1 } }).hp).toBe(15);
  });

  test("混合持有會相加", () => {
    const b = calcHonorBonus({ fatCat: { gold: 3, silver: 5, bronze: 10 } });
    expect(b.atk).toBe(3 * 12 + 5 * 4 + 10 * 1);   // 66
  });

  test("⚠️ 肥貓章單顆最重、成就章單顆數字大但軸最輕", () => {
    expect(HONOR_BONUS_PER_BADGE.fatCat.gold).toBeGreaterThan(HONOR_BONUS_PER_BADGE.score.gold);
  });
});

describe("⚠️ 不設上限，而且要在三圍夾制「之外」", () => {
  test("⚠️ 收越多一直有回報——沒有任何封頂", () => {
    const ten = calcHonorBonus({ fatCat: { gold: 10 } }).atk;
    const hundred = calcHonorBonus({ fatCat: { gold: 100 } }).atk;
    expect(hundred).toBe(ten * 10);
  });

  test("⚠️ 已經頂到天花板的老手，再拿章仍然有感（這是整個改動的重點）", () => {
    // 造一個基礎三圍全滿的成員：舊版把章算在夾制內，這種人再拿章完全沒感覺
    const maxed = {
      equipment: Array(9).fill("弓"), eventPoints: 9999, dailyQuestCount: 9999,
      joinDate: "2000-01-01",
      armorSets: [{ a: "x", b: "y", c: "z", d: "w", e: "v", f: "u", g: "t", h: "s", i: "r", j: "q" }],
    };
    const extra = {
      certification: { level: "gold" },
      certRecords: Array.from({ length: 4 }, () => ({ level: "精英" })),
      dexStats: { cohortBonus: 99, totalUnlocked: 9999 },
    };
    const without = calcArcherStats({ member: member(maxed), ...extra });
    const with3Gold = calcArcherStats({ member: member({ ...maxed, fatCat: { gold: 3 } }), ...extra });
    expect(with3Gold.atk - without.atk).toBe(36);
  });

  test("沒有任何章時完全不影響三圍", () => {
    expect(calcHonorBonus({})).toEqual({ hp: 0, atk: 0, def: 0 });
    expect(calcHonorBonus(null)).toEqual({ hp: 0, atk: 0, def: 0 });
  });

  test("章的欄位是壞值也不會算出 NaN", () => {
    const b = calcHonorBonus({ fatCat: { gold: "亂填" }, achievement: { black: null } });
    for (const v of Object.values(b)) expect(Number.isFinite(v)).toBe(true);
  });
});

describe("實際感受", () => {
  test("3金+5銀+10銅的肥貓章 = +66 ATK（舊版上限只有 +30）", () => {
    const s = statsOf({ fatCat: { gold: 3, silver: 5, bronze: 10 } });
    expect(s.atk - BASE.atk).toBe(66);
  });

  test("空白帳號不會憑空多出三圍", () => {
    expect(BASE.atk).toBe(statsOf().atk);
  });
});
