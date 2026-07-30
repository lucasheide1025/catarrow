// 組隊遠征戰鬥核心的測試。重點是「多人共享怪物、各自扛傷」這幾條規則不能壞。
import {
  createTeamState, processTeamRound, partyHpScale, scaleExpeditionForParty,
  aliveMemberIds, memberShootingRatio, memberSettleState, MAX_TEAM_SIZE,
} from "./teamExpeditionFlow";
import { settleExpedition } from "./settleExpedition";

const stats = (over = {}) => ({ hp: 100, atk: 30, agi: 10, def: 10, vit: 10, luk: 10, ...over });

// 兩波，各一隻怪；距離 1 → 下一回合就會貼臉攻擊
const expedition = () => ({
  family: "ghost",
  totalWaves: 2,
  waves: [
    { monsters: [{ instanceId: "m1", monsterId: "ghost_1", name: "怪一", hp: 100, maxHp: 100, atk: 20, def: 5, distance: 1 }] },
    { monsters: [{ instanceId: "m2", monsterId: "ghost_2", name: "怪二", hp: 100, maxHp: 100, atk: 20, def: 5, distance: 3 }] },
  ],
});

const members = (n = 2) => Array.from({ length: n }, (_, i) => ({
  id: `p${i + 1}`, name: `射手${i + 1}`, guildStats: stats(), supplies: { food: 6, water: 6 }, cats: [], arrowsPerRound: 3,
}));

describe("組隊人數加成", () => {
  test("HP 放大幅度小於人數（組隊該比較輕鬆，不是更難）", () => {
    expect(partyHpScale(1)).toBe(1);
    expect(partyHpScale(4)).toBe(2.8);
    expect(partyHpScale(4)).toBeLessThan(4);
  });

  test("超過上限的人數會被夾住", () => {
    expect(partyHpScale(99)).toBe(partyHpScale(MAX_TEAM_SIZE));
  });

  test("放大是純函數：不動原本的 expedition", () => {
    const src = expedition();
    const out = scaleExpeditionForParty(src, 3);
    expect(src.waves[0].monsters[0].hp).toBe(100);
    expect(out.waves[0].monsters[0].hp).toBe(Math.round(100 * partyHpScale(3)));
  });
});

describe("組隊回合處理", () => {
  test("每人各自一份 HP／補給／射擊表現", () => {
    const st = createTeamState(expedition(), members(2));
    expect(Object.keys(st.members)).toEqual(["p1", "p2"]);
    expect(st.members.p1.hp).toBe(st.members.p1.maxHp);
    expect(st.members.p1.supplies.food).toBe(6);
  });

  test("全隊的箭都打在同一隻共享怪物上", () => {
    const st = createTeamState(expedition(), members(2));
    const mon = st.monsters[0];
    const next = processTeamRound(st, {
      p1: [{ targetInstanceId: mon.instanceId, score: 10 }],
      p2: [{ targetInstanceId: mon.instanceId, score: 10 }],
    }, { rand: () => 0.99 });   // 不爆擊、不閃避
    const arrows = next.log.filter(l => l.type === "arrow");
    expect(arrows).toHaveLength(2);
    expect(new Set(arrows.map(a => a.by))).toEqual(new Set(["p1", "p2"]));
  });

  test("隊員的原目標死亡時，剩餘箭自動轉向存活怪物", () => {
    const exp = {
      family: "ghost",
      totalWaves: 1,
      waves: [{ monsters: [
        { instanceId: "a", name: "怪一", hp: 70, maxHp: 70, atk: 1, def: 0, distance: 4 },
        { instanceId: "b", name: "怪二", hp: 100, maxHp: 100, atk: 1, def: 0, distance: 2 },
      ] }],
    };
    const state = createTeamState(exp, members(1));
    const shots = [1, 2, 3].map(() => ({ targetInstanceId: "a", score: 11 }));
    const next = processTeamRound(state, { p1: shots }, { rand: () => 0.99 });

    expect(next.log.filter(entry => entry.type === "arrow").map(entry => entry.target))
      .toEqual(["a", "a", "b"]);
    expect(next.monsters.find(monster => monster.instanceId === "b")?.hp).toBe(55);
  });

  test("射擊表現分開累計（自己的命中率只算自己的箭）", () => {
    const st = createTeamState(expedition(), members(2));
    const mon = st.monsters[0];
    const next = processTeamRound(st, {
      p1: [{ targetInstanceId: mon.instanceId, score: 11 }],
      p2: [{ targetInstanceId: mon.instanceId, score: 0 }],
    }, { rand: () => 0.99 });
    expect(memberShootingRatio(next, "p1")).toBe(1);
    expect(memberShootingRatio(next, "p2")).toBe(0);
  });

  // ⚠️ 測試踩坑：rand=0 會先命中「閃避」判定（0 < dodgeChance）→ 打不到人。
  //    agi=10 的 dodgeChance 是 0.05，所以用 0.3：不閃避，且 floor(0.3×2)=0 仍挑到第一個人。
  test("怪物貼臉時只打一個人（隨機挑存活隊員）", () => {
    const st = createTeamState(expedition(), members(2));
    const next = processTeamRound(st, {}, { rand: () => 0.3 });
    const hits = next.log.filter(l => l.type === "monsterAttack" || l.type === "dodge");
    expect(hits).toHaveLength(1);
    expect(hits[0].by).toBe("p1");
  });

  test("單人倒地只是 down，全隊繼續打", () => {
    const st = createTeamState(expedition(), members(2));
    st.members.p1.hp = 1;
    const next = processTeamRound(st, {}, { rand: () => 0.3 });   // 不閃避、挑到 p1
    expect(next.members.p1.status).toBe("down");
    expect(next.status).toBe("fighting");
    expect(aliveMemberIds(next)).toEqual(["p2"]);
  });

  test("全員倒地才算遠征失敗", () => {
    const st = createTeamState(expedition(), members(1));
    st.members.p1.hp = 1;
    const next = processTeamRound(st, {}, { rand: () => 0.3 });
    expect(next.status).toBe("lost");
    expect(next.lostReason).toMatch(/全隊倒地/);
  });

  test("已倒地的人射出的箭不算數", () => {
    const st = createTeamState(expedition(), members(2));
    st.members.p1.status = "down";
    const mon = st.monsters[0];
    const next = processTeamRound(st, {
      p1: [{ targetInstanceId: mon.instanceId, score: 11 }],
    }, { rand: () => 0.99 });
    expect(next.log.filter(l => l.type === "arrow")).toHaveLength(0);
    expect(next.members.p1.shotStats.count).toBe(0);
  });

  test("清空最後一波 → 勝利", () => {
    const st = createTeamState(expedition(), members(1), { alreadyScaled: true });
    st.waveIndex = 1;
    st.monsters = [{ instanceId: "m2", monsterId: "ghost_2", name: "怪二", hp: 1, maxHp: 100, atk: 20, def: 0, distance: 3 }];
    const next = processTeamRound(st, { p1: [{ targetInstanceId: "m2", score: 11 }] }, { rand: () => 0.99 });
    expect(next.status).toBe("won");
  });

  test("清波後全隊遭遇同一旅途事件，各自扣除補給", () => {
    const st = createTeamState(expedition(), members(2), { alreadyScaled: true });
    st.monsters = [{ ...st.monsters[0], hp: 1, def: 0 }];
    const next = processTeamRound(st, {
      p1: [{ targetInstanceId: "m1", score: 11 }],
    }, { rand: () => 0.99, eventRand: () => 0 });
    expect(next.log.filter(l => l.type === "travelEvent")).toHaveLength(2);
    expect(next.members.p1.supplies.food).toBe(4.1);
    expect(next.members.p2.supplies.food).toBe(4.1);
  });

  test("清波事件讓全隊補給同時耗盡會強迫撤退", () => {
    const roster = members(2).map(m => ({ ...m, supplies: { food: 0.5, water: 0.5 } }));
    const st = createTeamState(expedition(), roster, { alreadyScaled: true });
    st.monsters = [{ ...st.monsters[0], hp: 1, def: 0 }];
    const next = processTeamRound(st, {
      p1: [{ targetInstanceId: "m1", score: 11 }],
    }, { rand: () => 0.99, eventRand: () => 0 });
    expect(next.status).toBe("lost");
    expect(next.lostReason).toMatch(/強迫撤退/);
  });

  test("防守村民事件形成共享 gate，確認前整個隊伍狀態凍結", () => {
    const base = expedition();
    const defenseExp = {
      ...base,
      totalWaves: 2,
      waves: [
        { monsters: [
          { ...base.waves[0].monsters[0], instanceId: "a" },
          { ...base.waves[0].monsters[0], instanceId: "b" },
        ] },
        { monsters: [
          { ...base.waves[1].monsters[0], instanceId: "c" },
          { ...base.waves[1].monsters[0], instanceId: "d" },
        ] },
      ],
    };
    let state = createTeamState(defenseExp, members(2), { missionMode: "defense" });
    for (let i = 0; i < 3; i += 1) state = processTeamRound(state, {});
    expect(state.eventGate).toMatchObject({
      id: "hunter_volley",
      summary: expect.stringMatching(/造成.*傷害/),
      targets: expect.arrayContaining([
        expect.objectContaining({
          name: expect.any(String),
          hpBefore: expect.any(Number),
          hpAfter: expect.any(Number),
          damage: 10,
        }),
      ]),
    });
    expect(processTeamRound(state, {})).toBe(state);
  });

  test("組隊防守沒有任何剩餘敵軍時立即勝利", () => {
    const base = expedition();
    const defenseExp = {
      ...base,
      totalWaves: 1,
      waves: [{ monsters: [{ ...base.waves[0].monsters[0], instanceId: "last", hp: 1, maxHp: 1, def: 0 }] }],
    };
    const state = createTeamState(defenseExp, members(1), { missionMode: "defense", alreadyScaled: true });
    const next = processTeamRound(state, {
      p1: [{ targetInstanceId: "last", score: 11, rawScore: 10 }],
    }, { rand: () => 0.99 });

    expect(next.defense.clock).toBeLessThan(next.defense.duration);
    expect(next.defense.queue).toHaveLength(0);
    expect(next.monsters).toHaveLength(0);
    expect(next.status).toBe("won");
  });

  test("組隊指定環數使用房主出發時鎖定的靶紙", () => {
    const base = expedition();
    const skillExp = {
      ...base,
      waves: [{ monsters: [{ ...base.waves[0].monsters[0], instanceId: "mage", hp: 999, maxHp: 999, combatRole: "caster", cooldown: 1 }] }],
      totalWaves: 1,
    };
    let state = createTeamState(skillExp, members(1).map(member => ({ ...member, targetFormat: "half_610" })), { alreadyScaled: true });
    state = processTeamRound(state, {}, { rand: () => 0.99, skillRand: () => 0 });

    const next = processTeamRound(state, {
      p1: [{ targetInstanceId: "mage", score: 3, rawScore: 3, targetFormat: "full_110" }],
    }, { rand: () => 0.99, skillRand: () => 0 });
    expect(next.log).not.toContainEqual(expect.objectContaining({ type: "counterSuccess" }));
    expect(next.log).toContainEqual(expect.objectContaining({ type: "skillResolve" }));
  });

  test("組隊怪物技能在冷卻結束後仍按機率發生", () => {
    const base = expedition();
    const skillExp = {
      ...base,
      waves: [{
        monsters: [{
          ...base.waves[0].monsters[0],
          instanceId: "mage",
          hp: 999,
          maxHp: 999,
          combatRole: "caster",
          cooldown: 1,
          skillChance: 0.3,
        }],
      }],
      totalWaves: 1,
    };
    const state = createTeamState(skillExp, members(1), { alreadyScaled: true });
    const next = processTeamRound(state, {}, { rand: () => 0.99, skillRand: () => 0.99 });

    expect(next.monsters[0].intent).toBeNull();
    expect(next.log).not.toContainEqual(expect.objectContaining({ type: "skillIntent" }));
  });

  test("純函數：不修改傳入的狀態", () => {
    const st = createTeamState(expedition(), members(2));
    const before = JSON.stringify(st);
    processTeamRound(st, { p1: [{ targetInstanceId: "m1", score: 11 }] }, { rand: () => 0.99 });
    expect(JSON.stringify(st)).toBe(before);
  });
});

describe("結算投影（讓 settleExpedition 原封不動可用）", () => {
  test("投影出單人版的形狀，各自帶自己的 derived 與 shotStats", () => {
    const st = createTeamState(expedition(), members(2));
    st.status = "won";
    st.members.p1.shotStats = { count: 3, score: 33 };   // 全 X
    st.members.p2.shotStats = { count: 3, score: 0 };    // 全 M
    const a = memberSettleState(st, "p1");
    const b = memberSettleState(st, "p2");
    expect(a.status).toBe("won");
    expect(a.guildStats).toBe(st.members.p1.guildStats);
    expect(a.shotStats.score).toBe(33);
    expect(b.shotStats.score).toBe(0);
  });

  test("射得準的人結算評價比較好（同一場戰鬥）", () => {
    const st = createTeamState(expedition(), members(2));
    st.status = "won";
    st.members.p1.shotStats = { count: 6, score: 66 };
    st.members.p2.shotStats = { count: 6, score: 6 };
    const good = settleExpedition(memberSettleState(st, "p1"), { rand: () => 0.5 });
    const bad = settleExpedition(memberSettleState(st, "p2"), { rand: () => 0.5 });
    expect(good.accuracy.band).toBe("S");
    expect(bad.accuracy.band).toBe("D");
    expect(good.accuracy.dropMult).toBeGreaterThan(bad.accuracy.dropMult);
  });

  test("不存在的成員 → null（不要炸畫面）", () => {
    const st = createTeamState(expedition(), members(1));
    expect(memberSettleState(st, "nobody")).toBeNull();
  });
});
