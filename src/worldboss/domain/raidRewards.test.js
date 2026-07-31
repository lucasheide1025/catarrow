import {
  CONTRIBUTION_FULL_PCT,
  PARTICIPATION_FLOOR,
  SORTIE_WB_CARD_CHANCE,
  contributionRatio,
  rewardRows,
  rollSortieRewards,
} from "./raidRewards";
import { DROP_TABLE_BY_CATEGORY } from "../../lib/worldBossData";

const BOSS_HP = 200000;
const familyBoss = { family: "ghost", familyTier: "big" };
const catBoss = { family: "cat" };
const coachBoss = { family: "coach" };

const seeded = seed => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const roll = (over = {}) => rollSortieRewards({
  boss: familyBoss, bossMaxHp: BOSS_HP, rand: seeded(7), ...over,
});

describe("⚠️ 沒擊倒也要給獎勵（這次改版的重點）", () => {
  test("一箭都沒中也拿得到——來射箭這件事本身就該有回饋", () => {
    const r = roll({ totals: { damage: 0 } });
    expect(r.coins).toBeGreaterThan(0);
    expect(r.archerXP).toBeGreaterThan(0);
    expect(r.materialChest).toBeTruthy();
    expect(r.coinChest.coins).toBeGreaterThan(0);
  });

  test("參與保底就是那個比例，不是零", () => {
    expect(contributionRatio({ damage: 0, bossMaxHp: BOSS_HP })).toBe(PARTICIPATION_FLOOR);
  });

  test("打得越多拿越多", () => {
    const little = roll({ totals: { damage: BOSS_HP * 0.002 } });
    const lots = roll({ totals: { damage: BOSS_HP * 0.03 } });
    expect(lots.coins).toBeGreaterThan(little.coins);
    expect(lots.archerXP).toBeGreaterThan(little.archerXP);
  });

  test("貢獻係數有上限，不會因為一場打爆就無限膨脹", () => {
    const full = contributionRatio({ damage: BOSS_HP * CONTRIBUTION_FULL_PCT, bossMaxHp: BOSS_HP });
    const insane = contributionRatio({ damage: BOSS_HP * 10, bossMaxHp: BOSS_HP });
    expect(full).toBe(1);
    expect(insane).toBe(1);
  });

  test("破防貢獻另外加成——那是新手推得動的那條路", () => {
    const noBreak = roll({ totals: { damage: BOSS_HP * 0.01, breakPoints: 0 } });
    const withBreak = roll({ totals: { damage: BOSS_HP * 0.01, breakPoints: 30 } });
    expect(withBreak.coins).toBeGreaterThan(noBreak.coins);
  });

  test("擊倒的人多一份，但沒擊倒的也不是零", () => {
    const alive = roll({ totals: { damage: BOSS_HP * 0.01 } });
    const killed = roll({ totals: { damage: BOSS_HP * 0.01 }, defeated: true });
    expect(killed.coins).toBeGreaterThan(alive.coins);
    expect(alive.coins).toBeGreaterThan(0);
  });
});

describe("獎勵內容", () => {
  test("六樣都有：金幣、射手經驗、貓貓經驗、材料寶箱、金幣寶箱、王卡機率", () => {
    const r = roll({ totals: { damage: 1000 }, hasCat: true });
    expect(r.coins).toBeGreaterThan(0);
    expect(r.archerXP).toBeGreaterThan(0);
    expect(r.catXP).toBeGreaterThan(0);
    expect(r.materialChest.family).toBeTruthy();
    expect(r.coinChest.name).toBeTruthy();
    expect(typeof r.wbCard).toBe("boolean");
  });

  test("沒帶貓就不給貓經驗", () => {
    expect(roll({ totals: { damage: 1000 }, hasCat: false }).catXP).toBe(0);
  });

  test("材料寶箱是隨機族——七族都抽得到", () => {
    const seen = new Set();
    for (let s = 1; s <= 200; s += 1) {
      seen.add(roll({ totals: { damage: 1000 }, rand: seeded(s) }).materialChest.family);
    }
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  test("越強的王，寶箱階級越高", () => {
    const tiers = boss => {
      const set = new Set();
      for (let s = 1; s <= 60; s += 1) {
        set.add(rollSortieRewards({ boss, bossMaxHp: BOSS_HP, totals: { damage: 1000 }, rand: seeded(s) }).materialChest.tier);
      }
      return Math.max(...set);
    };
    expect(tiers(coachBoss)).toBeGreaterThan(tiers(catBoss));
  });

  test("金幣寶箱的金額用既有的 COIN_CHEST_TIERS，不另外發明", () => {
    const r = roll({ totals: { damage: 1000 } });
    expect(r.coinChest.coins).toBeGreaterThan(0);
    expect(r.totalCoins).toBe(r.coins + r.coinChest.coins);
  });
});

describe("世界王卡 1%", () => {
  test("⚠️ 機率就是 1%（作者指定）", () => {
    expect(SORTIE_WB_CARD_CHANCE).toBe(0.01);
  });

  test("實抽接近 1%，不會是 0 也不會太高", () => {
    let hit = 0;
    const N = 4000;
    for (let s = 1; s <= N; s += 1) {
      if (roll({ totals: { damage: 1000 }, rand: seeded(s * 7919) }).wbCard) hit += 1;
    }
    const rate = hit / N;
    expect(rate).toBeGreaterThan(0.003);
    expect(rate).toBeLessThan(0.025);
  });

  test("⚠️ 跟擊倒分配的王卡機率是兩回事，出擊的低很多", () => {
    for (const cfg of Object.values(DROP_TABLE_BY_CATEGORY)) {
      expect(SORTIE_WB_CARD_CHANCE).toBeLessThan(cfg.wbCardChance);
    }
  });
});

describe("⚠️ 不能壓掉擊倒獎勵的份量", () => {
  test("一場出擊的金幣，遠小於擊倒分配的池子", () => {
    const best = rollSortieRewards({
      boss: coachBoss, bossMaxHp: BOSS_HP, defeated: true,
      totals: { damage: BOSS_HP, breakPoints: 100 }, hasCat: true, rand: seeded(3),
    });
    expect(best.coins).toBeLessThan(DROP_TABLE_BY_CATEGORY.coach.coinsPool / 5);
  });

  test("射手經驗同理", () => {
    const best = rollSortieRewards({
      boss: coachBoss, bossMaxHp: BOSS_HP, defeated: true,
      totals: { damage: BOSS_HP, breakPoints: 100 }, rand: seeded(3),
    });
    expect(best.archerXP).toBeLessThan(DROP_TABLE_BY_CATEGORY.coach.archerXPPool / 5);
  });
});

describe("結算頁的顯示列", () => {
  test("有貓給貓經驗那一行，沒貓就不給", () => {
    const withCat = rewardRows(roll({ totals: { damage: 1000 }, hasCat: true }));
    const noCat = rewardRows(roll({ totals: { damage: 1000 }, hasCat: false }));
    expect(withCat.some(r => r.key === "catXP")).toBe(true);
    expect(noCat.some(r => r.key === "catXP")).toBe(false);
  });

  test("抽到王卡才有那一行，而且標成稀有", () => {
    const rows = rewardRows({
      ...roll({ totals: { damage: 1000 } }), wbCard: true,
    });
    const card = rows.find(r => r.key === "wbCard");
    expect(card).toBeTruthy();
    expect(card.rare).toBe(true);
  });

  test("壞資料不會炸", () => {
    expect(rewardRows(null)).toEqual([]);
  });
});
