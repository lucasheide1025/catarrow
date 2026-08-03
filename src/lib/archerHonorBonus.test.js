// 🏅 四種「實體榮譽」的加成：射手證、肥貓章、積分章、成就章。
//
// ⚠️ 這些是道館裡**真的拿得到的實體榮譽**（檢定、徽章），不是遊戲內產出。
//    設計原則：**越難拿的，加成越有感**。三種章都是**長期慢慢累積**的，
//    所以速率不要調快、只把上限拉高，讓累積一直有回報。
//
// ⚠️⚠️ **難度順序是作者定的，不要從點數權重去推**（2026-08-03 踩過）：
//        🐱 肥貓章 = **最難拿** → ATK 上限 30（三種章裡最重）
//        🏆 積分章 = 中間      → DEF 上限 30
//        🏅 成就章 = **最好拿** → HP 上限 25（最輕）
//      成就章的計分是 silver1/gold2/black3，要 160 點才封頂，
//      **看起來**最難——那是計分方式，不是實際取得難度。
//      配 HP 也是刻意的：HP 在高等會被等級加成稀釋（117 級光等級 +580），
//      影響最小的軸配最容易拿的榮譽。
//
// ⚠️ 最重要的隱形規則：**各項上限的總和必須剛好等於 calcArcherStats 的
//    「基礎三圍」上限**。
//
// ⚠️⚠️ 這裡的 160/120/800 是**基礎值上限，不是玩家最終三圍**。實際戰鬥還會再疊：
//        等級加成 archerLevelBonus(lv) = { hp:(lv-1)*5, atk:⌊lv/5⌋, def:⌊lv/5⌋ }
//        怪物卡片 calcEquippedBonus、貓貓羈絆、RPG 裝備與符文
//      117 級光等級就 +580 HP，所以實際 HP 一千多是正常的。
//      **推論：flat 的 HP 加成在高等會被等級加成稀釋到幾乎無感**
//      （成就章 +50 對 1,000 HP 只有 5%），但 ATK/DEF 不會——
//      等級到 117 也才 +23，基礎的 160/120 仍然是主體。
//      要讓成就章真正有感，得改成 % 或換一條軸，而那要動所有
//      「calcArcherStats + archerLevelBonus」的呼叫點（MonsterBattle 就有 3 處），
//      不是改一個數字的事。留給後續評估。
//    原作者是精算過的（ATK 15+25+40+30+20+30=160、DEF 10+25+30+25+15+15=120），
//    但這件事沒有寫在任何地方。動任何一項就必須從別項讓出來，
//    否則會出現「拿滿也永遠碰不到天花板」或「某幾項變成廢的」。
import { calcArcherStats } from "./monsterData";

const ATK_CEILING = 160;   // ⚠️ 基礎值上限，不是最終 ATK
const DEF_CEILING = 120;   // ⚠️ 同上

/** 造一個「該項拿到滿、其餘皆空」的成員 */
const member = (over = {}) => ({ joinDate: new Date().toISOString(), ...over });
const statsOf = (over = {}, extra = {}) =>
  calcArcherStats({ member: member(over), certification: null, certRecords: [], dexStats: null, ...extra });

const BASE = statsOf();

describe("四種榮譽都要真的有加成", () => {
  test("🎯 射手證 → ATK", () => {
    const full = calcArcherStats({
      member: member(), certification: null, dexStats: null,
      certRecords: Array.from({ length: 4 }, () => ({ level: "精英" })),   // 4 弓 × 5 等 = 20
    });
    expect(full.atk - BASE.atk).toBe(40);
  });

  test("🐱 肥貓章（最難拿）→ ATK，三種章裡加成最重", () => {
    expect(statsOf({ fatCat: { gold: 3 } }).atk - BASE.atk).toBe(30);
    // ⚠️ 長期累積型：2 個金章（100 分）還不該封頂
    expect(statsOf({ fatCat: { gold: 2 } }).atk - BASE.atk).toBeLessThan(30);
  });

  test("🏆 積分章（中間）→ DEF", () => {
    expect(statsOf({ score: { gold: 3 } }).def - BASE.def).toBe(30);
  });

  test("🏅 成就章（最好拿）→ HP，三種章裡加成最輕", () => {
    expect(statsOf({ achievement: { black: 50 } }).hp - BASE.hp).toBe(25);
  });

  test("⚠️ 難度排序要反映在加成上：肥貓章 > 積分章 ≥ 成就章", () => {
    const fat = statsOf({ fatCat: { gold: 9 } }).atk - BASE.atk;
    const score = statsOf({ score: { gold: 9 } }).def - BASE.def;
    const ach = statsOf({ achievement: { black: 99 } }).hp - BASE.hp;
    expect(fat).toBeGreaterThanOrEqual(score);
    expect(score).toBeGreaterThan(ach);
  });
});

describe("⚠️ 各項上限總和必須剛好等於天花板", () => {
  // 這條是原設計的隱形規則。沒有它，下一個人調某一項就會靜靜地
  // 讓其他項變成永遠吃不到的廢數值。
  test("ATK 基礎值：滿的成員剛好打到 160，不多不少", () => {
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

  test("DEF 基礎值：滿的成員剛好打到 120，不多不少", () => {
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
