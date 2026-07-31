import {
  DEFAULT_MATCH_REWARD,
  describeRewardConfig,
  matchRewardFor,
  matchRewardPreview,
  normalizeRewardConfig,
} from "./matchRewards";

const p = (arrows, score, over = {}) => ({ arrows, score, name: "甲", ...over });

describe("一位選手拿多少", () => {
  test("經驗照箭數給、金幣照分數給", () => {
    const r = matchRewardFor(p(24, 200), { accuracyBonus: false });
    expect(r.archerXP).toBe(24 * DEFAULT_MATCH_REWARD.archerXPPerArrow);
    expect(r.catXP).toBe(24 * DEFAULT_MATCH_REWARD.catXPPerArrow);
    expect(r.coins).toBe(200 * DEFAULT_MATCH_REWARD.coinsPerPoint);
  });

  test("寶箱照箭數的門檻給", () => {
    const r = matchRewardFor(p(24, 100), { arrowsPerChest: 12, arrowsPerCoinChest: 12, accuracyBonus: false });
    expect(r.chests).toBe(2);
    expect(r.coinChests).toBe(2);
  });

  test("⚠️ 準度加碼給的是寶箱不是經驗——不然射得準的人連練習量都算比較多", () => {
    const good = matchRewardFor(p(12, 108));    // 平均 9 環
    const plain = matchRewardFor(p(12, 60));    // 平均 5 環
    expect(good.accurate).toBe(true);
    expect(plain.accurate).toBe(false);
    expect(good.chests).toBe(plain.chests + 1);
    expect(good.archerXP).toBe(plain.archerXP);   // 經驗一樣
  });

  test("⚠️ 有單場上限——射一整天不會爆量", () => {
    const r = matchRewardFor(p(600, 5000), { maxChests: 8, maxCoinChests: 8 });
    expect(r.chests).toBe(8);
    expect(r.coinChests).toBe(8);
  });

  test("沒射滿一輪就沒有獎勵（進場點兩下不算參加）", () => {
    const r = matchRewardFor(p(2, 20));
    expect(r.eligible).toBe(false);
    expect(r.archerXP).toBe(0);
    expect(r.chests).toBe(0);
  });

  test("⚠️ 給多少跟名次無關——獎勵綁名次會讓後段班沒動力射完", () => {
    const first = matchRewardFor(p(30, 290));
    const last = matchRewardFor(p(30, 150));
    expect(last.archerXP).toBe(first.archerXP);
    expect(last.catXP).toBe(first.catXP);
    expect(last.chests).toBeGreaterThan(0);
  });

  test("壞資料不會算出 NaN", () => {
    const r = matchRewardFor({ arrows: "abc", score: null }, null);
    expect(r.eligible).toBe(false);
    expect(Number.isFinite(r.coins)).toBe(true);
  });
});

describe("設定", () => {
  test("缺的、壞的一律補預設", () => {
    const c = normalizeRewardConfig({ archerXPPerArrow: "x", arrowsPerChest: 0 });
    expect(c.archerXPPerArrow).toBe(DEFAULT_MATCH_REWARD.archerXPPerArrow);
    expect(c.arrowsPerChest).toBeGreaterThanOrEqual(1);     // 不能除以零
  });

  test("教練調高就真的變多", () => {
    const r = matchRewardFor(p(12, 100), { archerXPPerArrow: 10, accuracyBonus: false });
    expect(r.archerXP).toBe(120);
  });

  test("一句話說明看得懂", () => {
    const text = describeRewardConfig({ archerXPPerArrow: 5 });
    expect(text).toContain("射手XP+5");
    expect(text).toContain("金幣");
  });
});

describe("發放前的預覽", () => {
  const players = {
    a: { name: "甲", arrows: 24, score: 200 },
    b: { name: "乙", arrows: 12, score: 60 },
    c: { name: "丙", arrows: 1, score: 8 },              // 沒射滿一輪
    d: { name: "丁", arrows: 24, score: 190, rewarded: true },   // 已經領過
  };

  test("算得出還有幾個人要發、總共要發多少", () => {
    const pv = matchRewardPreview(players, { accuracyBonus: false });
    expect(pv.pending).toBe(2);
    expect(pv.already).toBe(1);
    expect(pv.skipped).toBe(1);
    expect(pv.totals.archerXP).toBe((24 + 12) * DEFAULT_MATCH_REWARD.archerXPPerArrow);
  });

  test("⚠️ 已經領過的不算進總計——教練按第二次不會重複發", () => {
    const pv = matchRewardPreview(players, { accuracyBonus: false });
    expect(pv.rows.find(r => r.name === "丁").rewarded).toBe(true);
    expect(pv.totals.coins).toBe((200 + 60) * DEFAULT_MATCH_REWARD.coinsPerPoint);
  });

  test("分數高的排前面（教練對名單用）", () => {
    expect(matchRewardPreview(players).rows[0].name).toBe("甲");
  });

  test("沒有人也不會炸", () => {
    const pv = matchRewardPreview({});
    expect(pv.pending).toBe(0);
    expect(pv.totals.coins).toBe(0);
  });
});
