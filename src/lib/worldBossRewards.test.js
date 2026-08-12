// 世界王獎勵：這份測試守的是**作者的理念**，不是某組數字。
//
//   「我希望能上場幫忙打得都能有不錯的獎勵，而努力打得又有更好的獎勵」
//
// 所以下面每一條都是「不變式」——調數值可以，但踩破這些條就是背離理念。
import {
  EXPECTED_DAMAGE_PER_ATTACK, TARGET_ATTACKS, WB_REWARD_TABLE,
  attendanceDays, calcWorldBossRewards, describeSpread, effortWeight,
  isEligible, suggestedBossHp,
} from "./worldBossRewards";
import { WORLD_BOSSES, getDropCategory } from "./worldBossData";

const p = (dmg, days = 1, over = {}) => ({
  totalDmg: dmg, sessions: Array.from({ length: days }, () => ({})), ...over,
});

const group = (dmgs) => Object.fromEntries(dmgs.map((d, i) => [`p${i}`, p(d)]));
const coinsOf = (rewards, id) => rewards[id].total.coins;

test("v2 快照固定共同擊殺、守恆分潤，名次與尾刀完整疊加", () => {
  const snapshot={version:2,kill:{coins:222,arrowDew:55,archerXP:300,catXP:90,bond:9,materialChests:2,coinChests:1,cardPacks:1,scrolls:1,wbCardChance:.2},effortPool:{coins:2001,arrowDew:401,archerXP:1601,catXP:501,bond:61},honor:{rank1:{arrowDew:200,materialChests:30,coinChests:30,catBoxes:1},rank2:{materialChests:20,coinChests:20},rank3:{materialChests:10,coinChests:10},lastHit:{arrowDew:150,materialChests:5,coinChests:5,catBoxes:1}}};
  const rewards=calcWorldBossRewards({a:p(100),b:p(400)},"family_small",{top3Ids:["b","a"],lastHitBy:"b",rewardSnapshot:snapshot});
  expect(rewards.a.participation.coins).toBe(222);
  expect(rewards.b.honor).toMatchObject({materialChests:35,coinChests:35,catBoxes:2,arrowDew:350});
  for(const field of Object.keys(snapshot.effortPool))expect(rewards.a.effort[field]+rewards.b.effort[field]).toBe(snapshot.effortPool[field]);
});

describe("理念 ①：上場幫忙的就有不錯的獎勵", () => {
  test("⚠️ 幫忙的人不會拿到「幾乎是 0」——舊版下限是 1 金幣", () => {
    // 一個只打了 2% 傷害的人，跟一個打了 50% 的人同場
    const r = calcWorldBossRewards({ helper: p(1000), carry: p(50000) }, "family_big");
    expect(coinsOf(r, "helper")).toBeGreaterThan(400);
  });

  test("⚠️ 出席保底完全不看傷害——傷害再低也拿得到整份", () => {
    const table = WB_REWARD_TABLE.family_big;
    const r = calcWorldBossRewards({ a: p(1), b: p(999999) }, "family_big");
    expect(r.a.participation).toEqual(table.participation);
    expect(r.b.participation).toEqual(table.participation);
  });

  test("⚠️ 差距要壓得住：最努力的人不該是幫忙的人的 5 倍以上", () => {
    // 傷害差 10 倍的一群人
    const spread = describeSpread("family_big", { players: 10 });
    expect(spread.ratio).toBeLessThan(5);
    expect(spread.ratio).toBeGreaterThan(1.5);   // 但也不能沒有差距
  });

  test("沒造成傷害的人不算參戰", () => {
    expect(isEligible(p(0))).toBe(false);
    expect(isEligible(p(5))).toBe(true);
  });

  test("訪客不列入結算，正式帳號才算", () => {
    expect(isEligible(p(100, 1, { isGuest: true }))).toBe(false);
    expect(isEligible(p(100, 1, { isGuest: true, accountType: "official" }))).toBe(true);
  });
});

describe("理念 ②：努力的人拿更多", () => {
  test("傷害越高，拿的越多——單調遞增，沒有例外", () => {
    const r = calcWorldBossRewards(group([1000, 5000, 20000, 60000]), "family_big");
    const coins = ["p0", "p1", "p2", "p3"].map(id => coinsOf(r, id));
    for (let i = 1; i < coins.length; i += 1) expect(coins[i]).toBeGreaterThan(coins[i - 1]);
  });

  test("⚠️ 用 √ 壓縮：傷害 4 倍，努力權重只有 2 倍", () => {
    expect(effortWeight(p(40000)) / effortWeight(p(10000))).toBeCloseTo(2, 5);
  });

  test("⚠️ 多來幾天也算努力——這是新手唯一不靠數值就能追的維度", () => {
    const oneDay = effortWeight(p(10000, 1));
    const threeDays = effortWeight(p(10000, 3));
    expect(threeDays / oneDay).toBeCloseTo(1.5, 5);
  });

  test("出席加成有上限，不會無限疊", () => {
    expect(effortWeight(p(10000, 99)) / effortWeight(p(10000, 1))).toBe(2);
    expect(attendanceDays({ sessions: [] })).toBe(1);
  });
});

describe("理念 ③：人多是把鍋變大，不是把每片切小", () => {
  test("⚠️ 人數從 5 → 30，每個人拿的不能變少——舊版會直接砍成 1/6", () => {
    const five = calcWorldBossRewards(group(Array(5).fill(10000)), "family_big");
    const thirty = calcWorldBossRewards(group(Array(30).fill(10000)), "family_big");
    expect(coinsOf(thirty, "p0")).toBeGreaterThanOrEqual(coinsOf(five, "p0"));
  });

  test("同樣努力的人拿一樣多", () => {
    const r = calcWorldBossRewards(group([8000, 8000, 8000]), "family_big");
    expect(coinsOf(r, "p0")).toBe(coinsOf(r, "p2"));
  });
});

describe("理念 ④：名次是榮譽，不是收入", () => {
  test("⚠️ 第一名的金幣加成不該蓋過努力分潤——舊版第一名光金幣就 3000", () => {
    const participants = group([10000, 12000, 14000, 60000]);
    const r = calcWorldBossRewards(participants, "family_big", { top3Ids: ["p3", "p2", "p1"] });
    const noRank = calcWorldBossRewards(participants, "family_big");
    // 名次帶來的金幣差距是 0（榮譽物不含金幣）
    expect(coinsOf(r, "p3")).toBe(coinsOf(noRank, "p3"));
    // 但確實拿得到榮譽物
    expect(r.p3.honor.trophy).toBe(true);
    expect(r.p3.honor.gachaCoins).toBeGreaterThan(0);
    expect(r.p3.rank).toBe(1);
  });

  test("尾刀疊加在名次之上，不取代", () => {
    const r = calcWorldBossRewards(group([10000, 20000]), "family_big",
      { top3Ids: ["p1"], lastHitBy: "p1" });
    expect(r.p1.isLastHit).toBe(true);
    // 第一名 10 + 尾刀 5
    expect(r.p1.honor.gachaCoins).toBe(15);
  });

  test("沒進前三也沒尾刀就沒有榮譽物，但保底與分潤照給", () => {
    const r = calcWorldBossRewards(group([5000, 90000]), "family_big", { top3Ids: ["p1"] });
    expect(r.p0.honor).toEqual({});
    expect(r.p0.total.coins).toBeGreaterThan(0);
  });
});

describe("強度：血量用「幾人次」推，不憑感覺填", () => {
  test("⚠️ 舊版教練王 1,100,000 需要 92 人次——實際上打不死", () => {
    expect(1100000 / EXPECTED_DAMAGE_PER_ATTACK).toBeGreaterThan(90);
    expect(suggestedBossHp("coach")).toBeLessThan(700000);
  });

  test("四個分類的難度是遞增的", () => {
    const order = ["family_small", "family_big", "cat", "coach"];
    for (let i = 1; i < order.length; i += 1) {
      expect(TARGET_ATTACKS[order[i]]).toBeGreaterThan(TARGET_ATTACKS[order[i - 1]]);
      expect(suggestedBossHp(order[i])).toBeGreaterThan(suggestedBossHp(order[i - 1]));
    }
  });

  test("族系小王一小群人一次聚會就收得掉", () => {
    expect(TARGET_ATTACKS.family_small).toBeLessThanOrEqual(10);
  });

  test("可以指定人次覆寫", () => {
    expect(suggestedBossHp("cat", 20)).toBe(20 * EXPECTED_DAMAGE_PER_ATTACK);
  });
});

describe("⚠️ 24 隻王的血量必須落在自己分類的人次區間內", () => {
  // 這一條是**護欄**：以後誰手動改 hp，只要偏離「幾人次」的設計就會被擋下來。
  // 舊版就是因為沒有這條，教練王被填成 1,100,000（92 人次＝打不死）。
  test("每一隻都在目標人次的 ±60% 以內", () => {
    const bad = [];
    for (const [key, boss] of Object.entries(WORLD_BOSSES)) {
      const cat = getDropCategory(boss);
      const attacks = boss.hp / EXPECTED_DAMAGE_PER_ATTACK;
      const target = TARGET_ATTACKS[cat];
      if (attacks < target * 0.4 || attacks > target * 1.6) {
        bad.push(`${key}(${cat}) 需要 ${attacks.toFixed(1)} 人次，目標 ${target}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("同分類裡小王一定比大王好打", () => {
    for (const family of ["ghost", "forest", "poison", "office", "exam", "western"]) {
      const small = WORLD_BOSSES[`${family}_boss_small`];
      const big = WORLD_BOSSES[`${family}_boss`];
      if (small && big) expect(small.hp).toBeLessThan(big.hp);
    }
  });
});

describe("邊界", () => {
  test("沒有人參戰回空物件，不會炸", () => {
    expect(calcWorldBossRewards({}, "family_big")).toEqual({});
    expect(calcWorldBossRewards(null)).toEqual({});
  });

  test("不認識的分類退回 family_big，不會回 undefined", () => {
    const r = calcWorldBossRewards(group([1000]), "不存在的分類");
    expect(r.p0.participation).toEqual(WB_REWARD_TABLE.family_big.participation);
  });

  test("傷害是壞值也不會算出 NaN", () => {
    const r = calcWorldBossRewards({ a: { totalDmg: "壞掉" }, b: p(1000) }, "family_big");
    expect(r.a).toBeUndefined();          // 算不出傷害＝沒參戰
    for (const v of Object.values(r.b.total)) expect(Number.isFinite(v)).toBe(true);
  });
});
