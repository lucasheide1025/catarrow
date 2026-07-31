import { ARROW_TIERS, CHEER_TIERS, arrowFeedback, milestoneFor, pickCheer } from "./matchCheer";

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

describe("🎯 每一支箭的即時回饋", () => {
  test("X 比一般十環更大的特效——內十環值得", () => {
    const x = arrowFeedback(10, "X");
    const ten = arrowFeedback(10, "10");
    expect(x.tier).toBe("inner_ten");
    expect(ten.tier).toBe("ten");
    expect(x.fx).toBe("nova");
  });

  test("高分才有大特效與震動", () => {
    expect(arrowFeedback(10).big).toBe(true);
    expect(arrowFeedback(9).big).toBe(true);
    expect(arrowFeedback(6).big).toBe(false);
    expect(arrowFeedback(2).shake).toBeNull();
  });

  test("⚠️ 低分那一級絕不能是負面的——那支箭已經射出去了", () => {
    for (const p of [0, 1, 2, 3, 5]) {
      const f = arrowFeedback(p);
      expect(f.line).not.toMatch(/差|爛|糟|失敗|不行/);
    }
    expect(arrowFeedback(0, "M").line).toMatch(/沒關係|下一箭|忘掉/);
    expect(arrowFeedback(2).line).toMatch(/加油|深呼吸|不要急/);
  });

  test("每一級都有完整的顯示資料", () => {
    for (const t of ARROW_TIERS) {
      expect(t.icon && t.color).toBeTruthy();
      expect(t.lines.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("不會連續跳同一句", () => {
    const a = arrowFeedback(9, null, { rand: () => 0 });
    const b = arrowFeedback(9, null, { prevLine: a.line, rand: () => 0 });
    expect(b.line).not.toBe(a.line);
  });

  test("壞值一律當脫靶處理，不會炸", () => {
    expect(arrowFeedback(null).tier).toBe("miss");
    expect(arrowFeedback(undefined).line).toBeTruthy();
  });
});
