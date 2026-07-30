// src/guild/domain/expeditionFlow.test.js
import {
  createExpeditionState,
  consumeTravelSupplies,
  prepareExpeditionWave,
  processRound,
  resolveShotTarget,
  resolveTravelEvent,
  normalizeArrowsPerRound,
  GUILD_ARROWS_OPTIONS,
  DEFAULT_GUILD_ARROWS,
} from "./expeditionFlow";

const NO_LUCK = { rand: () => 0.99 }; // 不爆擊、不閃避（機率都很小）

function mon(id, over = {}) {
  return { instanceId: id, name: "m", icon: "👾", family: "ghost", tier: "common", maxHp: 10, hp: 10, atk: 20, def: 0, distance: 1, ...over };
}
const STATS = { hp: 100, atk: 50, agi: 0, def: 0, vit: 0, luk: 0 };

describe("expeditionFlow — 戰鬥核心狀態機", () => {
  test("清光一波 → 進下一波（該回合怪不推進）", () => {
    const exp = { totalWaves: 2, waves: [{ monsters: [mon("a")] }, { monsters: [mon("b", { distance: 3 })] }] };
    let s = createExpeditionState(exp, STATS, { food: 6, water: 6 });
    s = processRound(s, [{ targetInstanceId: "a", score: 11 }], NO_LUCK);
    expect(s.status).toBe("fighting");
    expect(s.waveIndex).toBe(1);
    expect(s.monsters[0].instanceId).toBe("b");
    expect(s.log.some(l => l.type === "travelEvent")).toBe(true);
  });

  test("地圖模式清波後暫停，不直接載入下一波或觸發旅行事件", () => {
    const exp = { totalWaves: 2, waves: [{ monsters: [mon("a")] }, { monsters: [mon("b")] }] };
    const state = createExpeditionState(exp, STATS, { food: 6, water: 6 });
    const next = processRound(
      state,
      [{ targetInstanceId: "a", score: 11 }],
      { ...NO_LUCK, pauseBetweenWaves: true },
    );

    expect(next.status).toBe("waveCleared");
    expect(next.waveIndex).toBe(0);
    expect(next.monsters).toHaveLength(0);
    expect(next.log).toContainEqual(expect.objectContaining({ type: "waveClear", nextWave: 1 }));
    expect(next.log.some(entry => entry.type === "travelEvent")).toBe(false);
    expect(next.supplies).toEqual({ food: 5, water: 5 });
  });

  test("地圖每前進一格會依 VIT 節省率消耗食物與水", () => {
    const state = createExpeditionState(
      { totalWaves: 1, waves: [{ monsters: [mon("a")] }] },
      { ...STATS, vit: 10 },
      { food: 4, water: 4 },
    );
    const next = consumeTravelSupplies(state);

    expect(next.supplies).toEqual({ food: 3.77, water: 3.77 });
    expect(next.log).toContainEqual(expect.objectContaining({
      type: "travelSupply",
      food: -0.23,
      water: -0.23,
    }));
  });

  test("走到下一個事件格才套用事件並準備下一波", () => {
    const exp = { totalWaves: 2, waves: [{ monsters: [mon("a")] }, { monsters: [mon("b")] }] };
    const cleared = processRound(
      createExpeditionState(exp, STATS, { food: 6, water: 6 }),
      [{ targetInstanceId: "a", score: 11 }],
      { ...NO_LUCK, pauseBetweenWaves: true },
    );
    const prepared = prepareExpeditionWave(cleared, 1, { eventRand: () => 0 });

    expect(prepared.status).toBe("fighting");
    expect(prepared.waveIndex).toBe(1);
    expect(prepared.monsters[0].instanceId).toBe("b");
    expect(prepared.log).toContainEqual(expect.objectContaining({ type: "travelEvent", id: "lost_trail" }));
  });

  test("清波旅途事件會消耗補給或改變 HP", () => {
    const exp = { totalWaves: 2, waves: [{ monsters: [mon("a")] }, { monsters: [mon("b")] }] };
    let s = createExpeditionState(exp, STATS, { food: 6, water: 6 });
    s = processRound(s, [{ targetInstanceId: "a", score: 11 }], { ...NO_LUCK, eventRand: () => 0 });
    expect(s.supplies).toEqual({ food: 4, water: 4.5 });
    expect(s.log).toContainEqual(expect.objectContaining({ type: "travelEvent", id: "lost_trail" }));
  });

  test("糧食與飲水在事件後同時耗盡會立即強制撤退", () => {
    const state = createExpeditionState(
      { totalWaves: 1, waves: [{ monsters: [mon("a")] }] },
      STATS,
      { food: 0.5, water: 0.5 },
    );
    const next = resolveTravelEvent(state, () => 0);
    expect(next.status).toBe("lost");
    expect(next.lostReason).toContain("強迫撤退");
  });

  test("休息泉可補水並治療，但不超過上限", () => {
    const state = { ...createExpeditionState(
      { totalWaves: 1, waves: [{ monsters: [mon("a")] }] },
      STATS,
      { food: 3, water: 2 },
    ), hp: 98 };
    const next = resolveTravelEvent(state, () => 0.99);
    expect(next.supplies.water).toBe(3);
    expect(next.hp).toBe(100);
  });

  test("清光最後一波 → 勝利", () => {
    const exp = { totalWaves: 1, waves: [{ monsters: [mon("a")] }] };
    let s = createExpeditionState(exp, STATS, { food: 6, water: 6 });
    s = processRound(s, [{ targetInstanceId: "a", score: 11 }], NO_LUCK);
    expect(s.status).toBe("won");
    expect(s.supplies).toEqual({ food: 5, water: 5 });
  });

  test("原目標被前一箭擊殺時，剩餘箭自動轉向存活怪物", () => {
    const exp = {
      totalWaves: 1,
      waves: [{ monsters: [
        mon("a", { hp: 120, maxHp: 120, distance: 4 }),
        mon("b", { hp: 100, maxHp: 100, distance: 2 }),
      ] }],
    };
    const state = createExpeditionState(exp, STATS, { food: 9, water: 9 });
    const shots = [1, 2, 3].map(() => ({ targetInstanceId: "a", score: 11 }));
    const next = processRound(state, shots, NO_LUCK);

    expect(next.log.filter(entry => entry.type === "arrow").map(entry => entry.target))
      .toEqual(["a", "a", "b"]);
    expect(next.monsters.find(monster => monster.instanceId === "b")?.hp).toBe(25);
  });

  test("轉向依距離、目前 HP、戰場順序決定，原目標存活時不轉向", () => {
    const monsters = [
      mon("first", { hp: 30, distance: 2 }),
      mon("selected", { hp: 90, distance: 9 }),
      mon("lower-hp", { hp: 20, distance: 2 }),
      mon("dead", { hp: 0, distance: 1 }),
    ];

    expect(resolveShotTarget(monsters, "selected")?.instanceId).toBe("selected");
    expect(resolveShotTarget(monsters, "dead")?.instanceId).toBe("lower-hp");
    monsters[0].hp = 20;
    expect(resolveShotTarget(monsters, "missing")?.instanceId).toBe("first");
  });

  test("所有怪物死亡後，剩餘箭不產生傷害紀錄", () => {
    const state = createExpeditionState(
      { totalWaves: 1, waves: [{ monsters: [mon("only", { hp: 10 })] }] },
      STATS,
      { food: 9, water: 9 },
    );
    const shots = [1, 2, 3].map(() => ({ targetInstanceId: "only", score: 11 }));
    const next = processRound(state, shots, NO_LUCK);

    expect(next.log.filter(entry => entry.type === "arrow")).toHaveLength(1);
    expect(next.status).toBe("won");
  });

  test("怪距離歸零會攻擊玩家（DEF 減傷）", () => {
    const exp = { totalWaves: 1, waves: [{ monsters: [mon("z", { hp: 9999, maxHp: 9999, atk: 30, distance: 1 })] }] };
    let s = createExpeditionState(exp, { ...STATS, hp: 200, vit: 99 }, { food: 9, water: 9 });
    s = processRound(s, [], NO_LUCK); // 不射，怪 1→0 攻擊
    expect(s.hp).toBe(170); // 200 - 30
    expect(s.log.some(l => l.type === "monsterAttack")).toBe(true);
  });

  test("補給歸零 → 飢渴掉血", () => {
    const exp = { totalWaves: 1, waves: [{ monsters: [mon("z", { hp: 9999, maxHp: 9999, distance: 9 })] }] };
    let s = createExpeditionState(exp, { ...STATS, hp: 100, vit: 0 }, { food: 0.4, water: 5 });
    s = processRound(s, [], NO_LUCK);
    expect(s.supplies.food).toBe(0);
    expect(s.log.some(l => l.type === "starve")).toBe(true);
    expect(s.hp).toBe(90); // 100 - 10%(=10)
  });

  test("貓貓每回合自動攻擊怪物（助攻清場）", () => {
    const exp = { totalWaves: 1, waves: [{ monsters: [mon("z", { hp: 40, maxHp: 40, atk: 5, def: 0, distance: 9 })] }] };
    const cats = [{ id: "c1", name: "小黑", atk: 30, def: 0 }];
    let s = createExpeditionState(exp, { ...STATS, atk: 1, vit: 99 }, { food: 9, water: 9 }, cats);
    s = processRound(s, [], NO_LUCK); // 玩家不射，只靠貓
    expect(s.log.some(l => l.type === "catAttack")).toBe(true);
    expect(s.monsters[0]?.hp ?? 0).toBeLessThan(40); // 被貓打掉血
  });

  test("HP 歸零 → 失敗", () => {
    const exp = { totalWaves: 1, waves: [{ monsters: [mon("z", { hp: 9999, maxHp: 9999, atk: 999, distance: 1 })] }] };
    let s = createExpeditionState(exp, { ...STATS, hp: 50, vit: 99 }, { food: 9, water: 9 });
    s = processRound(s, [], NO_LUCK);
    expect(s.status).toBe("lost");
    expect(s.lostReason).toBe("陣亡");
  });
});

describe("每回合箭數 3/6（作者要求提供選擇）", () => {
  const stats = { hp: 500, atk: 60, agi: 0, def: 0, vit: 0, luk: 0 };
  const exp = {
    danger: 1, totalWaves: 1,
    waves: [{ monsters: [
      { instanceId: "m1", monsterId: "x", name: "怪", icon: "👻", family: "ghost", tier: "common", tierIndex: 1, encounter: "normal", maxHp: 9999, hp: 9999, atk: 5, def: 0, distance: 5 },
    ] }],
  };

  test("只接受 3 或 6，其他一律回預設", () => {
    expect(GUILD_ARROWS_OPTIONS).toEqual([3, 6]);
    expect(normalizeArrowsPerRound(6)).toBe(6);
    expect(normalizeArrowsPerRound(3)).toBe(3);
    expect(normalizeArrowsPerRound(99)).toBe(DEFAULT_GUILD_ARROWS);
    expect(normalizeArrowsPerRound(undefined)).toBe(DEFAULT_GUILD_ARROWS);
  });

  test("設定會存進戰鬥狀態", () => {
    expect(createExpeditionState(exp, stats, { food: 9, water: 9 }, [], { arrowsPerRound: 6 }).arrowsPerRound).toBe(6);
    expect(createExpeditionState(exp, stats, { food: 9, water: 9 }, []).arrowsPerRound).toBe(DEFAULT_GUILD_ARROWS);
  });

  test("6 箭的補給消耗是 3 箭的兩倍（不然一律選 6 就沒得選了）", () => {
    const s3 = processRound(createExpeditionState(exp, stats, { food: 9, water: 9 }, [], { arrowsPerRound: 3 }), []);
    const s6 = processRound(createExpeditionState(exp, stats, { food: 9, water: 9 }, [], { arrowsPerRound: 6 }), []);
    const used3 = 9 - s3.supplies.food;
    const used6 = 9 - s6.supplies.food;
    expect(used6).toBeCloseTo(used3 * 2, 5);
  });

  test("v2 怪物冷卻完成後仍以機率預告技能，玩家可用分數反制", () => {
    const skillExp = {
      ...exp,
      totalWaves: 1,
      waves: [{ monsters: [mon("mage", { hp: 999, maxHp: 999, distance: 5, combatRole: "caster", cooldown: 1 })] }],
    };
    let state = createExpeditionState(skillExp, stats, { food: 9, water: 9 }, [], { combatV2: true });
    state = processRound(state, [], { rand: () => 0.99, skillRand: () => 0 });
    expect(state.monsters[0].intent).toBeTruthy();
    expect(state.log).toContainEqual(expect.objectContaining({ type: "skillIntent" }));

    state = processRound(state, [{ targetInstanceId: "mage", score: 3, rawScore: 3 }], { rand: () => 0.99 });
    expect(state.log).toContainEqual(expect.objectContaining({ type: "counterSuccess" }));
    expect(state.monsters[0].intent).toBeNull();
  });

  test("技能判定未通過時不會在固定回合必定預告", () => {
    const skillExp = {
      ...exp,
      totalWaves: 1,
      waves: [{ monsters: [mon("mage", { hp:999, maxHp:999, distance:5, combatRole:"caster", cooldown:1, skillChance:0.3 })] }],
    };
    let state = createExpeditionState(skillExp, stats, { food:9, water:9 }, [], { combatV2:true });
    state = processRound(state, [], { rand:() => 0.99, skillRand:() => 0.99 });
    expect(state.monsters[0].intent).toBeNull();
    expect(state.log).not.toContainEqual(expect.objectContaining({ type:"skillIntent" }));
  });

  test("指定環數只採用進場前鎖定的靶紙，射擊資料不能偷換", () => {
    const skillExp = {
      ...exp,
      totalWaves: 1,
      waves: [{ monsters: [mon("mage", { hp: 999, maxHp: 999, distance: 5, combatRole: "caster", cooldown: 1 })] }],
    };
    let state = createExpeditionState(skillExp, stats, { food: 9, water: 9 }, [], {
      combatV2: true,
      targetFormat: "half_610",
    });
    state = processRound(state, [], { rand: () => 0.99, skillRand: () => 0 });

    const cheating = processRound(state, [{ targetInstanceId: "mage", score: 3, rawScore: 3, targetFormat: "full_110" }], { rand: () => 0.99 });
    expect(cheating.log).not.toContainEqual(expect.objectContaining({ type: "counterSuccess" }));
    expect(cheating.log).toContainEqual(expect.objectContaining({ type: "skillResolve" }));

    const valid = processRound(state, [{ targetInstanceId: "mage", score: 7, rawScore: 7, targetFormat: "full_110" }], { rand: () => 0.99 });
    expect(valid.log).toContainEqual(expect.objectContaining({ type: "counterSuccess" }));
  });

  test("防守戰保存城門、時間、視距外隊列並觸發一次性村民助戰", () => {
    const defenseExp = {
      ...exp,
      totalWaves: 2,
      waves: [
        { monsters: [mon("a", { hp: 999, maxHp: 999, distance: 5 }), mon("b", { hp: 999, maxHp: 999, distance: 5 })] },
        { monsters: [mon("c", { hp: 999, maxHp: 999, distance: 5 }), mon("d", { hp: 999, maxHp: 999, distance: 5 })] },
      ],
    };
    let state = createExpeditionState(defenseExp, stats, { food: 9, water: 9 }, [], {
      combatV2: true, missionMode: "defense",
    });
    expect(state.defense.queue).toHaveLength(1);
    for (let i = 0; i < 3; i += 1) state = processRound(state, [], { rand: () => 0.99 });
    expect(state.defense.clock).toBe(3);
    expect(state.defense.assistanceUsed).toEqual(["hunter_volley"]);
    expect(state.log).toContainEqual(expect.objectContaining({ type: "villagerAssist", id: "hunter_volley" }));
    expect(state.eventGate).toMatchObject({
      id: "hunter_volley",
      summary: expect.stringMatching(/造成.*傷害/),
      targets: expect.arrayContaining([
        expect.objectContaining({
          name: expect.any(String),
          hpBefore: expect.any(Number),
          hpAfter: expect.any(Number),
          damage: expect.any(Number),
        }),
      ]),
    });
    const frozen = processRound(state, [{ targetInstanceId: "a", score: 11 }]);
    expect(frozen).toBe(state);
  });

  test("防守戰視距外與場上都沒有敵軍時立即勝利，不會卡在空戰場", () => {
    const defenseExp = {
      ...exp,
      totalWaves: 1,
      waves: [{ monsters: [mon("last", { hp: 1, maxHp: 1, def: 0, distance: 5 })] }],
    };
    const state = createExpeditionState(defenseExp, stats, { food: 9, water: 9 }, [], {
      combatV2: true, missionMode: "defense",
    });
    const next = processRound(state, [{ targetInstanceId: "last", score: 11, rawScore: 10 }], { rand: () => 0.99 });

    expect(next.defense.clock).toBeLessThan(next.defense.duration);
    expect(next.defense.queue).toHaveLength(0);
    expect(next.monsters).toHaveLength(0);
    expect(next.status).toBe("won");
  });

  test("6 箭模式一回合能射 6 箭、傷害照算", () => {
    const st = createExpeditionState(exp, stats, { food: 9, water: 9 }, [], { arrowsPerRound: 6 });
    const shots = Array.from({ length: 6 }, () => ({ targetInstanceId: "m1", score: 10 }));
    const next = processRound(st, shots, { rand: () => 0.9 });
    expect(next.log.filter(l => l.type === "arrow")).toHaveLength(6);
    expect(next.monsters[0].hp).toBeLessThan(9999);
  });
});
