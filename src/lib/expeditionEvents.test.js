import {
  EXPEDITION_EVENTS, EXPEDITION_INVEST,
  generateExpeditionRoute, getExpeditionEventById,
  resolveExpeditionEventChoice, sumResolvedEventRewards,
  calcMoraleDecay, moraleMultiplier, aggregateExpeditionRewards,
  calcInvestCost, totalArcherCost, MORALE_MAX,
  EXPEDITION_LOOT_RATES, rollExpeditionLoot, EXPEDITION_FAMILIES,
} from "./expeditionEvents";

describe("探險事件池", () => {
  test("事件至少 10 種", () => {
    expect(EXPEDITION_EVENTS.length).toBeGreaterThanOrEqual(10);
  });
  test("事件都有 2 個選擇且不虧本（無負面獎勵、無扣資源）", () => {
    for (const ev of EXPEDITION_EVENTS) {
      expect(ev.choices.length).toBeGreaterThanOrEqual(2);
      for (const c of ev.choices) {
        const entries = c.type === "gamble" ? c.success : (c.reward || []);
        for (const entry of entries) {
          expect(entry.min).toBeGreaterThanOrEqual(1);
          expect(entry.max).toBeGreaterThanOrEqual(entry.min);
        }
        if (c.type === "gamble") {
          expect(c.rate).toBeGreaterThan(0);
          expect(c.rate).toBeLessThan(1);
        }
      }
    }
  });
});

describe("路線生成", () => {
  const fixedRng = () => 0; // 恆選第一個 → 可重現
  test("T1 抽 2 個、T5 抽 4 個事件", () => {
    expect(generateExpeditionRoute(1, fixedRng).filter(e => e.id).length).toBe(2);
    expect(generateExpeditionRoute(2, fixedRng).filter(e => e.id).length).toBe(3);
    expect(generateExpeditionRoute(3, fixedRng).filter(e => e.id).length).toBe(3);
    expect(generateExpeditionRoute(4, fixedRng).filter(e => e.id).length).toBe(4);
    expect(generateExpeditionRoute(5, fixedRng).filter(e => e.id).length).toBe(4);
  });
  test("同趟不重複事件、檢查點依序遞增", () => {
    const route = generateExpeditionRoute(5, fixedRng);
    const ids = route.filter(e => e.id).map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < route.length; i++) {
      expect(route[i].at).toBeGreaterThan(route[i - 1].at);
    }
  });
  test("事件 minTier 不高於任務難度", () => {
    const route = generateExpeditionRoute(2, fixedRng);
    for (const e of route) {
      if (e.id) expect(getExpeditionEventById(e.id).minTier).toBeLessThanOrEqual(2);
    }
  });
});

describe("事件選擇判定（不虧本）", () => {
  test("guarantee 一定成功且給獎勵＋士氣", () => {
    const ev = getExpeditionEventById("forest_fog");
    const guarantee = ev.choices[1];
    // 用 spy 固定 random 避免干擾（guarantee 不 roll）
    const r = resolveExpeditionEventChoice(ev, 1, 1);
    expect(r.success).toBe(true);
    expect(r.moraleDelta).toBe(guarantee.morale);
  });
  test("gamble 失敗＝無獎勵、無士氣、無任何扣減", () => {
    const ev = getExpeditionEventById("old_chest");
    const spy = jest.spyOn(Math, "random").mockReturnValue(0.99); // 大於 0.7 → 失敗
    const r = resolveExpeditionEventChoice(ev, 0, 1);
    spy.mockRestore();
    expect(r.success).toBe(false);
    expect(r.rewards).toEqual({});
    expect(r.moraleDelta).toBe(0);
  });
  test("gamble 成功＝給較大獎勵（材料 tier 跟隨任務難度）", () => {
    const ev = getExpeditionEventById("old_chest");
    const spy = jest.spyOn(Math, "random").mockReturnValue(0.1); // 成功
    const r = resolveExpeditionEventChoice(ev, 0, 4);
    spy.mockRestore();
    expect(r.success).toBe(true);
    expect(r.rewards["fur_t4"]).toBeGreaterThanOrEqual(1);
  });
});

describe("士氣", () => {
  test("T1/T2 無時間衰減；T5 72 小時扣滿 24", () => {
    expect(calcMoraleDecay(1, 72)).toBe(0);
    expect(calcMoraleDecay(2, 72)).toBe(0);
    expect(calcMoraleDecay(3, 24)).toBe(8);
    expect(calcMoraleDecay(4, 48)).toBe(16);
    expect(calcMoraleDecay(5, 72)).toBe(24);
  });
  test("士氣倍率 ×1.0 ~ ×1.2，基礎不縮水", () => {
    expect(moraleMultiplier(0)).toBe(1.0);
    expect(moraleMultiplier(MORALE_MAX)).toBe(1.2);
  });
});

describe("投資", () => {
  const base = { archer_t1: 50, archer_t2: 30 };
  test("標準無追加；各檔只追加射手（無箭露）", () => {
    expect(calcInvestCost(base, 1)).toEqual({ arrowdew: 0, archerCost: {} });
    expect(calcInvestCost(base, 2)).toEqual({ arrowdew: 0, archerCost: { archer_t1: 25, archer_t2: 15 } });
    expect(calcInvestCost(base, 3)).toEqual({ arrowdew: 0, archerCost: { archer_t1: 50, archer_t2: 30 } });
    expect(calcInvestCost(base, 4)).toEqual({ arrowdew: 0, archerCost: { archer_t1: 75, archer_t2: 45 } });
    expect(calcInvestCost(base, 5)).toEqual({ arrowdew: 0, archerCost: { archer_t1: 100, archer_t2: 60 } });
    expect(calcInvestCost(base, 6)).toEqual({ arrowdew: 0, archerCost: { archer_t1: 150, archer_t2: 90 } });
  });
  test("總射手花費＝基本 × 倍率（進位）", () => {
    expect(totalArcherCost({ archer_t1: 50, archer_t3: 20 }, 2)).toEqual({ archer_t1: 75, archer_t3: 30 });
    expect(totalArcherCost({ archer_t1: 50, archer_t3: 20 }, 4)).toEqual({ archer_t1: 125, archer_t3: 50 });
    expect(totalArcherCost({ archer_t1: 50, archer_t3: 20 }, 6)).toEqual({ archer_t1: 200, archer_t3: 80 });
  });
});

describe("探險戰利品（寶箱／卡包／商店商品）", () => {
  // rng 依序吐出值：第一個 < 0.01 時所有 roll 都命中
  test("難度越高機率越高", () => {
    expect(EXPEDITION_LOOT_RATES[1].material).toBeLessThan(EXPEDITION_LOOT_RATES[5].material);
    expect(EXPEDITION_LOOT_RATES[1].cardPack).toBeLessThan(EXPEDITION_LOOT_RATES[5].cardPack);
  });
  test("全命中時：通用箱＋族系箱＋金幣箱＋卡包＋商店商品齊全", () => {
    // 依序：material/family/coin/cardPack/goods 的 roll(5) + family/family/tierIndex(3) + goods 的 kinds/count(2) + family/tierIndex(2)
    const sequence = [0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    let i = 0;
    const rng = () => sequence[Math.min(i++, sequence.length - 1)];
    const loot = rollExpeditionLoot(3, 4, rng);
    expect(loot.chests.length).toBeGreaterThanOrEqual(3); // 通用＋族系＋金幣（卡包依機率）
    const types = loot.chests.map(c => c.type);
    expect(types).toContain("gold");
    expect(types).toContain("family_mat");
    expect(types).toContain("coin");
    expect(Object.keys(loot.shopGoods).length).toBeGreaterThanOrEqual(1);
    const goodId = Object.keys(loot.shopGoods)[0];
    expect(goodId.startsWith("weapon_") || goodId.startsWith("armor_") || goodId.startsWith("food_")).toBe(true);
  });
  test("神話（第 6 檔）必定保底 1 個族系寶箱", () => {
    const rng = () => 0.99; // 所有 roll 都不中 → 只剩保底
    const loot = rollExpeditionLoot(1, 6, rng);
    const familyChests = loot.chests.filter(c => c.type === "family_mat");
    expect(familyChests.length).toBe(1);
    expect(EXPEDITION_FAMILIES).toContain(familyChests[0].family);
  });
  test("族系寶箱族與階皆隨機且在合法範圍", () => {
    const rng = () => 0; // 全命中
    const loot = rollExpeditionLoot(2, 1, rng);
    const family = loot.chests.find(c => c.type === "family_mat");
    if (family) {
      expect(EXPEDITION_FAMILIES).toContain(family.family);
      expect(family.tierIndex).toBeGreaterThanOrEqual(1);
      expect(family.tierIndex).toBeLessThanOrEqual(6);
    }
  });
});

describe("結算聚合", () => {
  test("投資＋士氣倍率正確套用", () => {
    const base = { fur_t1: 10, arrowdew: 5, catXP: 100 };
    const events = [{ rewards: { fur_t1: 5 } }];
    // 充裕 ×1.3、士氣 100 → ×1.2
    const r = aggregateExpeditionRewards(base, events, 3, MORALE_MAX);
    expect(r.fur_t1).toBe(Math.round(15 * 1.3 * 1.2));
    expect(r.arrowdew).toBe(Math.round(5 * 1.3 * 1.2));
    expect(r.catXP).toBe(Math.round(100 * 1.3 * 1.2));
  });
  test("士氣 0 時基礎獎勵完全不縮水", () => {
    const base = { fur_t1: 10 };
    const r = aggregateExpeditionRewards(base, [], 1, 0);
    expect(r.fur_t1).toBe(10);
  });
  test("事件失敗（無獎勵）不會影響基礎", () => {
    const base = { fur_t1: 10 };
    const r = aggregateExpeditionRewards(base, [{ rewards: {} }], 1, MORALE_MAX);
    expect(r.fur_t1).toBe(Math.round(10 * 1.2));
  });
  test("catXP 不超過既有上限 800", () => {
    const r = aggregateExpeditionRewards({ catXP: 790 }, [], 3, MORALE_MAX);
    expect(r.catXP).toBe(800);
  });
  test("聚合結果不帶 missionTier 時不崩潰、純資源照常", () => {
    const r = aggregateExpeditionRewards({ fur_t1: 10 }, [], 1, 0);
    expect(r.fur_t1).toBe(10);
  });
  test("rollExpeditionLoot 回傳結構穩定（chests 陣列、shopGoods 物件）", () => {
    const loot = rollExpeditionLoot(1, 1, () => 0.99);
    expect(Array.isArray(loot.chests)).toBe(true);
    expect(typeof loot.shopGoods).toBe("object");
  });
});

describe("投資檔位表", () => {
  test("六檔齊全且倍率遞增、不使用箭露", () => {
    expect(Object.keys(EXPEDITION_INVEST).length).toBe(6);
    const mults = Object.values(EXPEDITION_INVEST).map(i => i.mult);
    for (let i = 1; i < mults.length; i++) {
      expect(mults[i]).toBeGreaterThan(mults[i - 1]);
    }
    expect(EXPEDITION_INVEST[1].arrowdew).toBeUndefined();
    expect(EXPEDITION_INVEST[6].mult).toBe(2.0);
  });
});
