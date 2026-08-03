// 🏅 四種「實體榮譽」的加成：射手證、肥貓章、積分章、成就章。
//
// ⚠️ 這些是道館裡**真的拿得到的實體榮譽**（檢定、徽章），不是遊戲內產出。
//    設計原則：**越難拿的，加成越有感**。
//
// ⚠️ 最重要的隱形規則：**各項上限的總和必須剛好等於三圍天花板**。
//    原作者是精算過的（ATK 15+25+40+30+20+30=160、DEF 10+25+30+25+15+15=120），
//    但這件事沒有寫在任何地方。動任何一項就必須從別項讓出來，
//    否則會出現「拿滿也永遠碰不到天花板」或「某幾項變成廢的」。
import { calcArcherStats } from "./monsterData";

const ATK_CEILING = 160;
const DEF_CEILING = 120;

/** 造一個「該項拿到滿、其餘皆空」的成員 */
const member = (over = {}) => ({ joinDate: new Date().toISOString(), ...over });
const statsOf = (over = {}, extra = {}) =>
  calcArcherStats({ member: member(over), certification: null, certRecords: [], dexStats: null, ...extra });

const BASE = statsOf();

describe("四種榮譽都要真的有加成", () => {
  test("🎯 射手證（實體檢定，最難）——四種裡加成最重", () => {
    const full = calcArcherStats({
      member: member(), certification: null, dexStats: null,
      certRecords: Array.from({ length: 4 }, () => ({ level: "精英" })),   // 4 弓 × 5 等 = 20
    });
    expect(full.atk - BASE.atk).toBe(45);
  });

  test("🐱 肥貓章 → ATK", () => {
    expect(statsOf({ fatCat: { gold: 3 } }).atk - BASE.atk).toBe(20);
    // ⚠️ 不能太快封頂：2 個金章（100 分）不該就滿
    expect(statsOf({ fatCat: { gold: 2 } }).atk - BASE.atk).toBeLessThan(20);
  });

  test("🏆 積分章 → DEF", () => {
    expect(statsOf({ score: { gold: 3 } }).def - BASE.def).toBe(30);
  });

  test("🏅 成就章 → HP：最難拿的，回報不能最小", () => {
    // 舊值是 /8 上限 20——要 160 點才封頂，而肥貓章 2 個金章就滿
    expect(statsOf({ achievement: { black: 50 } }).hp - BASE.hp).toBe(50);
    // 中段就要看得到成長
    expect(statsOf({ achievement: { silver: 21 } }).hp - BASE.hp).toBe(7);
  });
});

describe("⚠️ 各項上限總和必須剛好等於天花板", () => {
  // 這條是原設計的隱形規則。沒有它，下一個人調某一項就會靜靜地
  // 讓其他項變成永遠吃不到的廢數值。
  test("ATK：滿的成員剛好打到 160，不多不少", () => {
    const full = calcArcherStats({
      member: member({
        fatCat: { gold: 99 }, equipment: Array(9).fill("弓"),
        eventPoints: 9999, dailyQuestCount: 9999,
      }),
      certification: null, dexStats: null,
      certRecords: Array.from({ length: 4 }, () => ({ level: "精英" })),
    });
    expect(full.atk).toBe(ATK_CEILING);
  });

  test("DEF：滿的成員剛好打到 120，不多不少", () => {
    const full = calcArcherStats({
      member: member({
        score: { gold: 99 }, joinDate: "2000-01-01",
        armorSets: [{ a: "x", b: "y", c: "z", d: "w", e: "v", f: "u", g: "t", h: "s", i: "r", j: "q" }],
      }),
      certification: { level: "gold" }, certRecords: [],
      dexStats: { cohortBonus: 99, totalUnlocked: 0 },
    });
    expect(full.def).toBe(DEF_CEILING);
  });

  test("⚠️ 空白帳號不能一開始就接近天花板", () => {
    expect(BASE.atk).toBeLessThan(ATK_CEILING * 0.35);
    expect(BASE.def).toBeLessThan(DEF_CEILING * 0.35);
  });
});
