import { BREAK_GAUGE_MAX } from "./breakGauge";
import { INTERRUPT_REQUIRED } from "./bossIntent";
import {
  RAID_MAX_TEAM,
  RAID_MIN_TEAM,
  allSubmitted,
  canTeamDepart,
  pendingMembers,
  teamGaugeMax,
  teamInterruptRequired,
  teamQuotaSummary,
  teamBreakSpeedup,
  teamStatBonus,
} from "./raidTeam";
import { RAID_DAILY_ATTEMPTS, attemptsUsed, canRaid, consumeAttempt, remainingAttempts } from "./raidQuota";
import { RAID_TOTAL_ROUNDS, createRaidState, resolveRaidRound } from "./raidFlow";
import { WEAK_SPOT_MAP } from "./weakPoints";

const DAY = "2026-07-31";
const member = (id, over = {}) => ({
  memberId: id, name: id, ready: true, participant: {}, ...over,
});

describe("每日次數（各扣各的）", () => {
  test("預設沿用線上規則，沒用過就是滿的", () => {
    expect(remainingAttempts({}, DAY)).toBe(RAID_DAILY_ATTEMPTS);
    expect(canRaid({}, DAY)).toBe(true);
  });

  test("扣一次就少一次，扣完不能再打", () => {
    let p = {};
    for (let i = 0; i < RAID_DAILY_ATTEMPTS; i += 1) {
      expect(canRaid(p, DAY)).toBe(true);
      p = consumeAttempt(p, DAY);
    }
    expect(canRaid(p, DAY)).toBe(false);
    expect(remainingAttempts(p, DAY)).toBe(0);
  });

  test("換一天就重置", () => {
    const used = consumeAttempt({}, DAY);
    expect(canRaid(used, "2026-08-01")).toBe(true);
  });

  test("⚠️ 舊資料相容：只有 lastAttackedDate 的玩家，當天算已用 1 次", () => {
    // 不這樣做的話，改版當下所有人會平白多出次數
    expect(attemptsUsed({ lastAttackedDate: DAY }, DAY)).toBe(1);
    expect(attemptsUsed({ lastAttackedDate: "2026-07-30" }, DAY)).toBe(0);
  });

  test("扣次數時一併更新 lastAttackedDate，舊的 server 檢查也還是對的", () => {
    expect(consumeAttempt({}, DAY).lastAttackedDate).toBe(DAY);
  });

  test("不會改到傳進去的物件", () => {
    const p = {};
    consumeAttempt(p, DAY);
    expect(p).toEqual({});
  });
});

describe("出發前檢查", () => {
  test("人數要在 2~4 之間", () => {
    expect(canTeamDepart([member("a")], DAY).ok).toBe(false);
    expect(canTeamDepart([member("a"), member("b")], DAY).ok).toBe(true);
    const five = ["a", "b", "c", "d", "e"].map(id => member(id));
    expect(canTeamDepart(five, DAY).ok).toBe(false);
    expect(RAID_MIN_TEAM).toBe(2);
    expect(RAID_MAX_TEAM).toBe(4);
  });

  test("⚠️ 有人次數用完就不能一起打（作者指定）", () => {
    const spent = member("b", { participant: consumeAttempt({}, DAY) });
    const res = canTeamDepart([member("a"), spent], DAY);
    expect(res.ok).toBe(false);
    expect(res.blockers.some(b => b.code === "no_attempts" && b.memberId === "b")).toBe(true);
  });

  test("blockers 要指名道姓，UI 才說得出是誰卡住", () => {
    const res = canTeamDepart([member("a"), member("b", { ready: false })], DAY);
    expect(res.blockers[0].memberId).toBe("b");
    expect(res.blockers[0].text).toContain("b");
  });

  test("沒準備好也不能出發", () => {
    expect(canTeamDepart([member("a"), member("b", { ready: false })], DAY).ok).toBe(false);
  });

  test("同一個人不能重複加入", () => {
    expect(canTeamDepart([member("a"), member("a")], DAY).blockers.some(b => b.code === "duplicate")).toBe(true);
  });

  test("等待室摘要看得到每個人剩幾次", () => {
    const rows = teamQuotaSummary([member("a"), member("b", { participant: consumeAttempt({}, DAY) })], DAY);
    expect(rows[0].canGo).toBe(true);
    expect(rows[1].canGo).toBe(false);
    expect(rows[1].left).toBe(0);
  });
});

describe("房主要等全隊送出", () => {
  const roster = [member("a"), member("b")];

  test("有人還沒送出就不能推進", () => {
    expect(allSubmitted(roster, { a: [{}] })).toBe(false);
    expect(pendingMembers(roster, { a: [{}] })).toEqual(["b"]);
  });

  test("全部送出才可以", () => {
    expect(allSubmitted(roster, { a: [{}], b: [{}] })).toBe(true);
    expect(pendingMembers(roster, { a: [{}], b: [{}] })).toEqual([]);
  });

  test("空陣列不算送出（不然可以按空白過關）", () => {
    expect(allSubmitted(roster, { a: [{}], b: [] })).toBe(false);
  });
});

describe("門檻依人數放大（組隊要有好處，但不能免費）", () => {
  test("打斷需求人多才變高，但比人數線性成長慢", () => {
    const solo = teamInterruptRequired(1, 1);
    const four = teamInterruptRequired(1, 4);
    expect(solo).toBe(INTERRUPT_REQUIRED[1]);
    expect(four).toBeGreaterThan(solo);
    expect(four).toBeLessThan(solo * 4);       // ← 次線性＝組隊真的比較容易
  });

  test("破防槽同理", () => {
    expect(teamGaugeMax(1)).toBe(BREAK_GAUGE_MAX);
    expect(teamGaugeMax(4)).toBeGreaterThan(BREAK_GAUGE_MAX);
    expect(teamGaugeMax(4)).toBeLessThan(BREAK_GAUGE_MAX * 4);
  });

  test("階段越後面越難斷，組隊也一樣", () => {
    expect(teamInterruptRequired(3, 2)).toBeGreaterThan(teamInterruptRequired(1, 2));
  });
});

describe("組隊實際結算", () => {
  const teamState = (n = 3) => createRaidState({
    boss: { key: "t", name: "測試王", hp: 300000, maxHp: 300000, atk: 120, def: 50 },
    members: Array.from({ length: n }, (_, i) => ({
      memberId: `m${i}`, name: `隊員${i}`,
      stats: { atk: 120, def: 60, hp: 250 },
      archerLevel: 60,
    })),
  });
  const spotAt = () => ({ ...WEAK_SPOT_MAP.green, cx: 0, cy: 0, key: "t" });
  const shots = (memberId, n = 6) =>
    Array.from({ length: n }, () => ({ memberId, nx: 0, ny: 0, score: 10 }));

  test("單人＝一人的隊伍，只有一條程式路徑", () => {
    const solo = createRaidState({
      boss: { key: "t", hp: 1000, maxHp: 1000, atk: 100, def: 10 },
      stats: { atk: 50, def: 20, hp: 100 },
    });
    expect(solo.members).toHaveLength(1);
    expect(solo.members[0].memberId).toBe("me");
    expect(solo.playerHp).toBe(100);
  });

  test("每支箭用射手自己的攻擊力結算，傷害記在他名下", () => {
    const st = { ...teamState(2), spots: [spotAt()] };
    st.members[1].stats = { ...st.members[1].stats, atk: 400 };
    const { state } = resolveRaidRound({ state: st, arrows: [...shots("m0", 3), ...shots("m1", 3)] });
    expect(state.members[1].damage).toBeGreaterThan(state.members[0].damage);
    expect(state.members[0].damage + state.members[1].damage).toBeLessThanOrEqual(state.totals.damage);
  });

  test("新手扶助是射手自己的——不會因為隊友是老手就被拉低", () => {
    const st = { ...teamState(2), spots: [spotAt()] };
    st.members[0].rookieMult = 1;      // 老手
    st.members[1].rookieMult = 2;      // 新手
    const { state } = resolveRaidRound({ state: st, arrows: [...shots("m0", 3), ...shots("m1", 3)] });
    expect(state.members[1].damage).toBeGreaterThan(state.members[0].damage * 1.5);
  });

  test("破防貢獻也記在各自名下", () => {
    const st = { ...teamState(2), spots: [spotAt()] };
    const { state } = resolveRaidRound({ state: st, arrows: [...shots("m0", 4), ...shots("m1", 2)] });
    expect(state.members[0].breakPoints).toBeGreaterThan(state.members[1].breakPoints);
  });

  test("王的大招打全隊，每個人都掉血", () => {
    const st = { ...teamState(3), spots: [] };
    st.round = 2;
    st.boss = { ...st.boss, skillConfig: { r2Strike: { skillId: "x", name: "測試技", baseMultiplier: 1.6 } } };
    const before = st.members.map(m => m.hp);
    const { state } = resolveRaidRound({ state: st, arrows: [] });
    state.members.forEach((m, i) => expect(m.hp).toBeLessThan(before[i]));
  });

  test("平砍也打全隊", () => {
    const st = { ...teamState(3), spots: [] };
    const { state } = resolveRaidRound({ state: st, arrows: [] });
    expect(state.members.every(m => m.hp < m.maxHp)).toBe(true);
  });

  test("全隊倒下才算結束（有人還站著就繼續）", () => {
    const st = { ...teamState(2), spots: [] };
    st.members[0].hp = 0;
    st.round = 3;
    const { state } = resolveRaidRound({ state: st, arrows: [] });
    expect(state.finished).toBe(false);
  });

  test("每個人的貓都會出手", () => {
    const st = createRaidState({
      boss: { key: "t", hp: 300000, maxHp: 300000, atk: 120, def: 50 },
      members: [
        { memberId: "a", name: "A", stats: { atk: 100, def: 50, hp: 200 }, cats: [{ catId: "c1", name: "貓一", atk: 80 }] },
        { memberId: "b", name: "B", stats: { atk: 100, def: 50, hp: 200 }, cats: [{ catId: "c2", name: "貓二", atk: 80 }] },
      ],
    });
    const { log } = resolveRaidRound({ state: { ...st, spots: [] }, arrows: [] });
    expect(log.filter(e => e.type === "catAssist")).toHaveLength(2);
  });

  test("四人一場能打完五回合不會爆", () => {
    let state = { ...teamState(4), spots: [spotAt()] };
    for (let i = 0; i < RAID_TOTAL_ROUNDS; i += 1) {
      const arrows = state.members.flatMap(m => shots(m.memberId, 6));
      state = resolveRaidRound({ state, arrows }).state;
    }
    expect(state.finished).toBe(true);
    expect(state.totals.damage).toBeGreaterThan(0);
  });
});

describe("組隊三維加成（作者 2026-07-31）", () => {
  test("單人完全沒有加成——不能偷偷加", () => {
    const b = teamStatBonus(1);
    expect(b.atk).toBe(1);
    expect(b.def).toBe(1);
    expect(b.hp).toBe(1);
    expect(b.label).toBe("");
  });

  test("人越多三維越高，且三種都會漲", () => {
    const two = teamStatBonus(2);
    const four = teamStatBonus(4);
    expect(two.atk).toBeGreaterThan(1);
    expect(four.atk).toBeGreaterThan(two.atk);
    expect(four.def).toBeGreaterThan(two.def);
    expect(four.hp).toBeGreaterThan(two.hp);
  });

  test("超過上限不會繼續疊", () => {
    expect(teamStatBonus(9).atk).toBe(teamStatBonus(RAID_MAX_TEAM).atk);
  });

  test("加成真的套進隊員數值（不是只有標籤）", () => {
    const solo = createRaidState({
      boss: { key: "t", hp: 1000, maxHp: 1000, atk: 10, def: 5 },
      members: [{ memberId: "a", stats: { atk: 100, def: 50, hp: 200 } }],
    });
    const team = createRaidState({
      boss: { key: "t", hp: 1000, maxHp: 1000, atk: 10, def: 5 },
      members: Array.from({ length: 4 }, (_, i) => ({ memberId: `m${i}`, stats: { atk: 100, def: 50, hp: 200 } })),
    });
    expect(team.members[0].stats.atk).toBeGreaterThan(solo.members[0].stats.atk);
    expect(team.members[0].stats.def).toBeGreaterThan(solo.members[0].stats.def);
    expect(team.members[0].maxHp).toBeGreaterThan(solo.members[0].maxHp);
    // 原始值要留著，UI 才能顯示「100 → 130」
    expect(team.members[0].baseStats.atk).toBe(100);
  });

  test("加成後的 HP 就是起始 HP（不會加了上限卻沒補血）", () => {
    const team = createRaidState({
      boss: { key: "t", hp: 1000, maxHp: 1000, atk: 10, def: 5 },
      members: Array.from({ length: 3 }, (_, i) => ({ memberId: `m${i}`, stats: { atk: 100, def: 50, hp: 200 } })),
    });
    for (const m of team.members) expect(m.hp).toBe(m.maxHp);
  });
});

describe("破防更快（作者 2026-07-31）", () => {
  test("⚠️ 綜合起來破防真的更快——門檻成長比「人數 × 默契」慢", () => {
    expect(teamBreakSpeedup(1)).toBe(1);
    expect(teamBreakSpeedup(2)).toBeGreaterThan(1.2);
    expect(teamBreakSpeedup(4)).toBeGreaterThan(2);
  });

  test("⚠️ 不用「每次命中 ×倍率」——綠點只有 1 點，round(1×1.45) 還是 1，加成會被取整吃掉", () => {
    // 這條是實測踩到的：門檻調整沒有這個問題
    expect(teamGaugeMax(4) / teamGaugeMax(1)).toBeLessThan(4);
  });

  // ⚠️ 要量的是「一回合把槽推了幾成」，不是原始點數——
  //    點數本來就跟人數成正比（4 人 = 4 倍），那不叫更快。
  test("實際結算：四人一回合把破防槽推得比單人多得多（比例）", () => {
    const spot = { ...WEAK_SPOT_MAP.green, cx: 0, cy: 0, key: "t" };
    const run = n => {
      const st = {
        ...createRaidState({
          boss: { key: "t", hp: 900000, maxHp: 900000, atk: 120, def: 50 },
          members: Array.from({ length: n }, (_, i) => ({
            memberId: `m${i}`, stats: { atk: 120, def: 60, hp: 250 }, archerLevel: 60,
          })),
        }),
        spots: [spot],
      };
      const arrows = st.members.flatMap(m =>
        Array.from({ length: 6 }, () => ({ memberId: m.memberId, nx: 0, ny: 0, score: 10 })));
      const after = resolveRaidRound({ state: st, arrows }).state;
      return after.gauge.gauge / teamGaugeMax(n);     // 推了幾成
    };
    const solo = run(1);
    const four = run(4);
    expect(four).toBeGreaterThan(solo * 2);           // 四人至少快兩倍以上
    expect(four / solo).toBeCloseTo(teamBreakSpeedup(4), 1);
  });
});
