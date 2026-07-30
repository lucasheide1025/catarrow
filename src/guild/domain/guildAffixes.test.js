import { CHALLENGE_TIERS, GUILD_AFFIXES } from "../data/guildAffixPool";
import {
  NEUTRAL_AFFIX_MODS,
  affixSummary,
  affixesOf,
  challengeRewardMult,
  mergeAffixMods,
  rollAffixes,
} from "./guildAffixes";
import { rollChallengeContracts, rollDailyContracts } from "./guildContracts";
import { rollExpedition } from "./rollExpedition";

const seeded = seed => {
  let x = seed;
  return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
};

describe("詞綴合併", () => {
  test("沒有詞綴＝中性值（等於完全沒有修正）", () => {
    expect(mergeAffixMods([])).toEqual(NEUTRAL_AFFIX_MODS);
    expect(mergeAffixMods(undefined)).toEqual(NEUTRAL_AFFIX_MODS);
  });

  test("倍率相乘、加值相加", () => {
    const mods = mergeAffixMods(["berserk", "armored", "swarm", "swift"]);
    expect(mods.monsterAtkMult).toBeCloseTo(1.3, 5);
    expect(mods.monsterDefMult).toBeCloseTo(1.4, 5);
    expect(mods.waveSizeBonus).toBe(2);
    expect(mods.monsterSpeedBonus).toBe(1);
  });

  test("同類倍率會疊乘，不是取最大", () => {
    const twice = mergeAffixMods(["berserk", "berserk"]);
    expect(twice.monsterAtkMult).toBeCloseTo(1.69, 5);
  });

  test("回合上限與可見距離取最嚴格（較小的非 0 值）", () => {
    expect(mergeAffixMods(["blitz"]).roundLimit).toBe(12);
    expect(mergeAffixMods(["night"]).visionDepth).toBe(4);
    expect(mergeAffixMods(["blitz", "night"]).roundLimit).toBe(12);
  });

  test("未知詞綴被忽略，不會汙染結果", () => {
    expect(mergeAffixMods(["不存在", "berserk"]).monsterAtkMult).toBeCloseTo(1.3, 5);
  });

  test("每條詞綴都有完整的顯示資料", () => {
    for (const affix of GUILD_AFFIXES) {
      expect(affix.id && affix.name && affix.icon && affix.desc).toBeTruthy();
      expect(Object.keys(affix.mods).length).toBeGreaterThan(0);
      // 宣告的修正都要是消費端認得的鍵，否則加了不會生效
      for (const key of Object.keys(affix.mods)) {
        expect(Object.keys(NEUTRAL_AFFIX_MODS)).toContain(key);
      }
    }
  });
});

describe("挑戰層級", () => {
  test("精銳抽 1 條、危殆抽 2 條，且不重複", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      expect(rollAffixes("elite", seeded(seed))).toHaveLength(1);
      const perilous = rollAffixes("perilous", seeded(seed));
      expect(perilous).toHaveLength(2);
      expect(new Set(perilous).size).toBe(2);
    }
  });

  test("非挑戰委託不抽詞綴", () => {
    expect(rollAffixes(null)).toEqual([]);
    expect(rollAffixes("不存在的層級")).toEqual([]);
  });

  test("危殆的獎勵倍率高於精銳，一般委託是 1", () => {
    const elite = challengeRewardMult("elite");
    const perilous = challengeRewardMult("perilous");
    expect(perilous.loot).toBeGreaterThan(elite.loot);
    expect(perilous.rep).toBeGreaterThan(elite.rep);
    expect(challengeRewardMult(null)).toEqual({ loot: 1, rep: 1 });
  });

  test("摘要文字可直接顯示", () => {
    expect(affixSummary([])).toBe("");
    expect(affixSummary(["berserk"])).toContain("狂暴");
    expect(affixesOf(["berserk", "不存在"])).toHaveLength(1);
  });
});

describe("挑戰委託", () => {
  const args = { dateKey: "2026-07-30", memberId: "m1" };

  test("每個危險度各一張精銳／危殆／單挑＝18 張", () => {
    const list = rollChallengeContracts(args);
    expect(list).toHaveLength(18);
    for (let danger = 1; danger <= 6; danger += 1) {
      const ofDanger = list.filter(c => c.danger === danger);
      expect(ofDanger).toHaveLength(3);
      expect(ofDanger.map(c => c.challenge).sort()).toEqual(["duel", "elite", "perilous"]);
    }
  });

  test("單挑層級鎖定 duel 模式；其餘層級只會是日常三種模式", () => {
    for (const c of rollChallengeContracts(args)) {
      if (c.challenge === "duel") expect(c.mode).toBe("duel");
      else expect(["exploration", "assault", "defense"]).toContain(c.mode);
    }
  });

  test("日常委託不會出現單挑模式（spec：每階恰好一張探索/進攻/防守）", () => {
    for (const c of rollDailyContracts(args)) {
      expect(["exploration", "assault", "defense"]).toContain(c.mode);
    }
  });

  test("每張挑戰委託都帶詞綴與獎勵倍率", () => {
    for (const c of rollChallengeContracts(args)) {
      expect(c.affixes.length).toBe(CHALLENGE_TIERS[c.challenge].affixCount);
      expect(c.affixList.length).toBe(c.affixes.length);
      expect(c.rewardMult.loot).toBeGreaterThan(1);
      expect(c.challengeMeta.name).toBeTruthy();
    }
  });

  test("一般委託沒有詞綴，不會誤帶倍率", () => {
    for (const c of rollDailyContracts(args)) {
      expect(c.challenge).toBeNull();
      expect(c.affixes).toEqual([]);
      expect(c.rewardMult).toEqual({ loot: 1, rep: 1 });
    }
  });

  test("同日同人固定同一批（重整不能洗）；不同人不同批", () => {
    expect(rollChallengeContracts(args).map(c => c.id + c.affixes.join()))
      .toEqual(rollChallengeContracts(args).map(c => c.id + c.affixes.join()));
    const other = rollChallengeContracts({ ...args, memberId: "m2" });
    expect(other.map(c => c.affixes.join()).join())
      .not.toBe(rollChallengeContracts(args).map(c => c.affixes.join()).join());
  });

  test("挑戰板與一般板的 id 不會相撞", () => {
    const ids = [...rollDailyContracts(args), ...rollChallengeContracts(args)].map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("詞綴實際影響生怪", () => {
  const base = { id: "x", danger: 3, family: "ghost" };

  test("成群讓每波隻數變多", () => {
    const plain = rollExpedition(base, { rand: seeded(9) });
    const swarm = rollExpedition({ ...base, affixes: ["swarm"] }, { rand: seeded(9) });
    const count = exp => exp.waves.reduce((sum, w) => sum + w.monsters.length, 0);
    expect(count(swarm)).toBeGreaterThan(count(plain));
  });

  test("狂暴／厚甲／宿敵確實改到怪物數值", () => {
    const plain = rollExpedition(base, { rand: seeded(4) }).waves[0].monsters[0];
    const buffed = rollExpedition(
      { ...base, affixes: ["berserk", "armored", "veteran"] },
      { rand: seeded(4) },
    ).waves[0].monsters[0];
    expect(buffed.atk).toBeGreaterThan(plain.atk);
    expect(buffed.maxHp).toBeGreaterThan(plain.maxHp);
    expect(buffed.def).toBeGreaterThanOrEqual(plain.def);
  });

  test("沒有詞綴時數值完全不變（一般委託零風險）", () => {
    const a = rollExpedition(base, { rand: seeded(77) }).waves[0].monsters[0];
    const b = rollExpedition({ ...base, affixes: [] }, { rand: seeded(77) }).waves[0].monsters[0];
    expect(b.atk).toBe(a.atk);
    expect(b.maxHp).toBe(a.maxHp);
    expect(b.def).toBe(a.def);
  });
});
