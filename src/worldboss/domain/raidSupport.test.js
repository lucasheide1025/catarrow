import {
  SUPPORT_MAX_ATK,
  SUPPORT_MAX_HEAL,
  supportLabel,
  supportPerformance,
  teamSupport,
} from "./raidSupport";
import { createRaidState, resolveRaidRound } from "./raidFlow";
import { WEAK_SPOT_MAP } from "./weakPoints";

const member = (id, over = {}) => ({
  memberId: id, name: id, hp: 200, maxHp: 200, damage: 0,
  stats: { atk: 100, def: 50, hp: 200 }, cats: [], ...over,
});

describe("倒地轉後衛", () => {
  test("沒有人倒地就沒有助戰", () => {
    const s = teamSupport([member("a"), member("b")]);
    expect(s.atkMult).toBe(1);
    expect(s.healPct).toBe(0);
    expect(s.supporters).toEqual([]);
  });

  test("倒地的人變成後衛，不是出局", () => {
    const s = teamSupport([member("a", { hp: 0, damage: 500 }), member("b", { damage: 500 })]);
    expect(s.supporters.map(x => x.memberId)).toEqual(["a"]);
    expect(s.atkMult).toBeGreaterThan(1);
    expect(s.healPct).toBeGreaterThan(0);
  });

  test("全隊都倒下就沒有助戰對象（不會自己補自己）", () => {
    const s = teamSupport([member("a", { hp: 0 }), member("b", { hp: 0 })]);
    expect(s.atkMult).toBe(1);
    expect(s.healPct).toBe(0);
  });
});

describe("⚠️ 按表現給——不然故意送死會變成一種打法", () => {
  test("倒下前打得好，助戰就強", () => {
    const good = teamSupport([member("a", { hp: 0, damage: 1000 }), member("b", { damage: 1000 })]);
    const bad = teamSupport([member("a", { hp: 0, damage: 10 }), member("b", { damage: 1000 })]);
    expect(good.atkMult).toBeGreaterThan(bad.atkMult);
    expect(good.healPct).toBeGreaterThan(bad.healPct);
  });

  test("一箭都沒打就倒地＝幾乎沒有助戰", () => {
    const s = teamSupport([member("a", { hp: 0, damage: 0 }), member("b", { damage: 2000 })]);
    expect(s.atkMult).toBeCloseTo(1, 2);
    expect(s.healPct).toBeCloseTo(0, 3);
  });

  test("表現係數＝自己的傷害 ÷ 隊伍平均，打到平均就滿檔", () => {
    expect(supportPerformance({ damage: 500 }, 500)).toBe(1);
    expect(supportPerformance({ damage: 250 }, 500)).toBe(0.5);
    expect(supportPerformance({ damage: 9999 }, 500)).toBe(1);   // 有上限
  });
});

describe("上限：倒地不能比站著有用", () => {
  test("攻擊加成最多 15%", () => {
    const s = teamSupport([
      member("a", { hp: 0, damage: 9999 }), member("b", { hp: 0, damage: 9999 }),
      member("c", { hp: 0, damage: 9999 }), member("d", { damage: 1 }),
    ]);
    expect(s.atkMult).toBeCloseTo(1 + SUPPORT_MAX_ATK, 5);
  });

  test("補血最多 15%", () => {
    const s = teamSupport([
      member("a", { hp: 0, damage: 9999 }), member("b", { hp: 0, damage: 9999 }),
      member("c", { damage: 1 }),
    ]);
    expect(s.healPct).toBeCloseTo(SUPPORT_MAX_HEAL, 5);
  });

  test("多位後衛累加但不會超過上限", () => {
    const one = teamSupport([member("a", { hp: 0, damage: 400 }), member("b", { damage: 400 })]);
    const three = teamSupport([
      member("a", { hp: 0, damage: 400 }), member("b", { hp: 0, damage: 400 }),
      member("c", { hp: 0, damage: 400 }), member("d", { damage: 400 }),
    ]);
    expect(three.atkMult).toBeGreaterThanOrEqual(one.atkMult);
    expect(three.atkMult).toBeLessThanOrEqual(1 + SUPPORT_MAX_ATK);
  });
});

describe("實際結算", () => {
  const teamState = (over = {}) => {
    const st = createRaidState({
      boss: { key: "t", name: "測試王", hp: 900000, maxHp: 900000, atk: 120, def: 50 },
      members: [
        { memberId: "a", name: "阿甲", stats: { atk: 120, def: 60, hp: 250 } },
        { memberId: "b", name: "阿乙", stats: { atk: 120, def: 60, hp: 250 } },
      ],
    });
    return { ...st, spots: [{ ...WEAK_SPOT_MAP.green, cx: 0, cy: 0, key: "t" }], ...over };
  };
  const shots = id => Array.from({ length: 6 }, () => ({ memberId: id, nx: 0, ny: 0, score: 10 }));

  test("有人倒地時 log 會說明後衛在幹嘛", () => {
    const st = teamState();
    st.members[0].hp = 0;
    st.members[0].damage = 3000;
    const { log } = resolveRaidRound({ state: st, arrows: shots("b") });
    const sup = log.find(e => e.type === "support");
    expect(sup).toBeTruthy();
    expect(sup.text).toContain("後衛");
    expect(sup.text).toContain("阿甲");
  });

  test("⚠️ 倒地的人不能再射——他已經是後衛了", () => {
    const st = teamState();
    st.members[0].hp = 0;
    const { log } = resolveRaidRound({ state: st, arrows: [...shots("a"), ...shots("b")] });
    const shooters = new Set(log.filter(e => e.type === "arrow").map(e => e.memberId));
    expect(shooters.has("a")).toBe(false);
    expect(shooters.has("b")).toBe(true);
  });

  test("助戰真的讓隊友打更痛", () => {
    const withSupport = (() => {
      const st = teamState();
      st.members[0].hp = 0; st.members[0].damage = 5000;
      return resolveRaidRound({ state: st, arrows: shots("b") }).state.totals.damage;
    })();
    const without = resolveRaidRound({ state: teamState(), arrows: shots("b") }).state.totals.damage;
    expect(withSupport).toBeGreaterThan(without);
  });

  test("後衛每回合幫還站著的人補血", () => {
    const st = teamState();
    st.members[0].hp = 0; st.members[0].damage = 5000;
    st.members[1].hp = 100;                      // 受傷的隊友
    const { state, log } = resolveRaidRound({ state: st, arrows: shots("b") });
    const heal = log.find(e => e.type === "supportHeal");
    expect(heal).toBeTruthy();
    expect(state.members[1].hp).toBeGreaterThan(100 - 200);   // 有補到（扣掉王的反擊還是比沒補好）
  });

  test("補血不會超過最大生命", () => {
    const st = teamState();
    st.members[0].hp = 0; st.members[0].damage = 5000;
    const { state } = resolveRaidRound({ state: st, arrows: shots("b") });
    for (const m of state.members) expect(m.hp).toBeLessThanOrEqual(m.maxHp);
  });

  test("沒有人倒地就不會有 support 事件（不吵）", () => {
    const { log } = resolveRaidRound({ state: teamState(), arrows: shots("b") });
    expect(log.some(e => e.type === "support")).toBe(false);
    expect(log.some(e => e.type === "supportHeal")).toBe(false);
  });
});

describe("UI 文案", () => {
  test("講得出是誰、加多少", () => {
    const s = teamSupport([member("a", { hp: 0, damage: 500 }), member("b", { damage: 500 })]);
    const text = supportLabel(s);
    expect(text).toContain("a");
    expect(text).toContain("%");
  });

  test("沒有後衛就沒有文案", () => {
    expect(supportLabel(teamSupport([member("a")]))).toBe("");
    expect(supportLabel(null)).toBe("");
  });
});
