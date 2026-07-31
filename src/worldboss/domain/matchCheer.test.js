import { CHEER_TIERS, milestoneFor, pickCheer } from "./matchCheer";

const r = over => ({ score: 0, xCount: 0, tens: 0, misses: 0, ...over });

describe("激勵詞分級", () => {
  test("滿分 30 是最高一級", () => {
    expect(pickCheer(r({ score: 30, xCount: 3 })).tier).toBe("perfect");
  });

  test("兩個 X 有自己的一級（就算沒滿分）", () => {
    expect(pickCheer(r({ score: 28, xCount: 2 })).tier).toBe("triple_x");
  });

  test("高分、中分各有分級", () => {
    expect(pickCheer(r({ score: 27 })).tier).toBe("great");
    expect(pickCheer(r({ score: 22 })).tier).toBe("good");
  });

  test("⚠️ 脫靶那一輪給台階，不是給評語——旁邊站著教練和家長", () => {
    const c = pickCheer(r({ score: 14, misses: 1 }));
    expect(c.tier).toBe("recover");
    expect(c.line).toMatch(/沒關係|放掉|調整/);
  });

  test("一定挑得出一句（保底規則不能漏）", () => {
    expect(pickCheer(r({ score: 3 })).line).toBeTruthy();
    expect(pickCheer(null).line).toBeTruthy();
    expect(pickCheer().line).toBeTruthy();
  });

  test("每一級都有圖示、顏色、至少兩句可選", () => {
    for (const t of CHEER_TIERS) {
      expect(t.icon && t.color).toBeTruthy();
      expect(t.lines.length).toBeGreaterThanOrEqual(2);
      expect(typeof t.match).toBe("function");
    }
  });

  test("⚠️ 不會連續跳同一句——連跳兩次很敷衍", () => {
    const first = pickCheer(r({ score: 24 }), { rand: () => 0 });
    const second = pickCheer(r({ score: 24 }), { prevLine: first.line, rand: () => 0 });
    expect(second.line).not.toBe(first.line);
  });

  test("整級只剩一句可用時也不會壞掉", () => {
    const tier = CHEER_TIERS.find(t => t.id === "steady");
    let out = null;
    for (const line of tier.lines) out = pickCheer(r({ score: 1 }), { prevLine: line, rand: () => 0.99 });
    expect(out.line).toBeTruthy();
  });
});

describe("里程碑", () => {
  test("⚠️ 只在剛好跨過的那一輪給——每輪都跳就沒有意義", () => {
    expect(milestoneFor(9, 12)).toBeTruthy();
    expect(milestoneFor(12, 15)).toBeNull();
  });

  test("一次跨過多個只給最早那個", () => {
    expect(milestoneFor(0, 30)).toContain("12");
  });

  test("沒跨過就沒有", () => {
    expect(milestoneFor(0, 3)).toBeNull();
    expect(milestoneFor(null, null)).toBeNull();
  });
});
