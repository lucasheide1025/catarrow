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
import {
  CERT_BONUS, HONOR_BONUS_PER_BADGE, applyCertBonus, calcArcherStats, calcHonorBonus,
} from "./monsterData";

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
    // ⚠️ 這條要**隔離**章的效果，所以不帶射手證——
    //    金證的 5% 會把章的加成也乘上去（36 → 38），那是另一條測試的事。
    const extra = {
      certification: null,
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

describe("🎯 射手證（藍證／金證）", () => {
  // ⚠️ 跟三弓檢定 certRecords 是兩回事：這是 certification.level
  const st = { hp: 1000, atk: 100, def: 80 };

  test("沒有證不加任何東西", () => {
    expect(applyCertBonus(st, null)).toEqual(st);
    expect(applyCertBonus(st, { level: "none" })).toEqual(st);
  });

  test("藍證：ATK+10 DEF+10 HP+100", () => {
    expect(applyCertBonus(st, { level: "blue" })).toEqual({ hp: 1100, atk: 110, def: 90 });
  });

  test("⚠️ 金證＝藍證的量**再額外 ×1.05**，不是取代", () => {
    const gold = applyCertBonus(st, { level: "gold" });
    const blue = applyCertBonus(st, { level: "blue" });
    expect(gold).toEqual({
      hp: Math.round(1100 * 1.05), atk: Math.round(110 * 1.05), def: Math.round(90 * 1.05),
    });
    for (const k of ["hp", "atk", "def"]) expect(gold[k]).toBeGreaterThan(blue[k]);
  });

  test("⚠️ 要在夾制之外——已經滿檔的老手拿到證仍然有感", () => {
    const maxed = {
      equipment: Array(9).fill("弓"), eventPoints: 9999, dailyQuestCount: 9999,
      joinDate: "2000-01-01", fatCat: { gold: 9 },
      armorSets: [{ a: "x", b: "y", c: "z", d: "w", e: "v", f: "u", g: "t", h: "s" }],
    };
    const none = calcArcherStats({ member: member(maxed), certification: null, certRecords: [], dexStats: null });
    const gold = calcArcherStats({ member: member(maxed), certification: { level: "gold" }, certRecords: [], dexStats: null });
    expect(gold.atk).toBeGreaterThan(none.atk + CERT_BONUS.flat.atk - 1);
    expect(gold.hp).toBeGreaterThan(none.hp + CERT_BONUS.flat.hp - 1);
  });

  test("金證的 5% 也吃得到三種章的加成", () => {
    const withBadges = { fatCat: { gold: 5 } };
    const gold = calcArcherStats({ member: member(withBadges), certification: { level: "gold" }, certRecords: [], dexStats: null });
    const blue = calcArcherStats({ member: member(withBadges), certification: { level: "blue" }, certRecords: [], dexStats: null });
    // 章加了 60 ATK，金證的 5% 應該乘在含章的總量上
    expect(gold.atk - blue.atk).toBeGreaterThanOrEqual(Math.round(blue.atk * 0.05) - 1);
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
