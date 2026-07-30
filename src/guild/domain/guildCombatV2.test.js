import {
  advanceCounter,
  applySignedEffect,
  BATTLEFIELD,
  createCounter,
  createGridCombatState,
  resolveMonsterActions,
  toGridMonster,
} from "./guildCombatV2";

const monster = (id, extra = {}) => ({ id, instanceId: id, hp: 20, atk: 5, distance: 5, ...extra });

describe("公會棋盤戰鬥 v2", () => {
  test("使用三路十公尺視距並限制最多八隻可見怪物", () => {
    const distances = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
    const state = createGridCombatState(distances.map((distance, i) => monster(`m${i}`, { distance })));
    expect(BATTLEFIELD).toEqual({ lanes: 3, visibleDepth: 10, maxVisible: 8 });
    expect(state.visible.length).toBeLessThanOrEqual(8);
    expect(state.visible.length + state.approaching.length).toBe(10);
    expect(state.visible.some(monster => monster.position.depth === 10)).toBe(true);
    expect(state.approaching.every(monster => monster.position.depth > 10)).toBe(true);
  });

  test("不同角色具有不同移速與射程預設", () => {
    expect(toGridMonster(monster("fast", { combatRole: "charger" })).moveSpeed).toBe(2);
    expect(toGridMonster(monster("bow", { combatRole: "ranged" })).attackRange).toBe(3);
  });

  test("怪物逐格移動且不會佔據同一格", () => {
    const state = createGridCombatState([
      monster("a", { combatRole: "pursuer", position: { lane: 0, depth: 4 } }),
      monster("b", { combatRole: "charger", position: { lane: 0, depth: 5 } }),
    ]);
    const next = resolveMonsterActions(state);
    const cells = next.visible.map(m => `${m.position.lane}:${m.position.depth}`);
    expect(new Set(cells).size).toBe(cells.length);
    expect(next.log.some(event => event.type === "monsterMove")).toBe(true);
  });

  test.each([
    ["minScore", { threshold: 9 }, [{ score: 9 }]],
    ["totalScore", { threshold: 15 }, [{ score: 7 }, { score: 8 }]],
    ["defeatCaster", { targetId: "mage" }, []],
    ["exactRing", { exactRing: 7 }, [{ rawScore: 7, score: 11 }]],
  ])("四種反制模板：%s", (type, config, shots) => {
    const living = type === "defeatCaster" ? [] : ["mage"];
    const result = advanceCounter(createCounter(type, config), shots, living);
    expect(result.success).toBe(true);
  });

  test("指定環數依靶紙改成玩家實際能命中的分數", () => {
    const counter = createCounter("exactRing", {
      exactRing: 3,
      exactRings: { full_110: 3, half_610: 7, field_16: 3 },
    });

    expect(advanceCounter(counter, [{ rawScore: 7, targetFormat: "half_610" }]).success).toBe(true);
    expect(advanceCounter(counter, [{ rawScore: 3, targetFormat: "half_610" }]).success).toBe(false);
    expect(advanceCounter(counter, [{ rawScore: 3, targetFormat: "field_16" }]).success).toBe(true);
  });

  test("同目標同屬性正負各一格，不疊加：刷新、取代、忽略都有事件", () => {
    let state = createGridCombatState([]);
    state = applySignedEffect(state, { targetId: "hero", stat: "atk", value: -2, duration: 2, sourceId: "a" });
    state = applySignedEffect(state, { targetId: "hero", stat: "atk", value: -2, duration: 3, sourceId: "a" });
    state = applySignedEffect(state, { targetId: "hero", stat: "atk", value: -5, duration: 2, sourceId: "b" });
    state = applySignedEffect(state, { targetId: "hero", stat: "atk", value: -1, duration: 5, sourceId: "c" });
    state = applySignedEffect(state, { targetId: "hero", stat: "atk", value: 3, duration: 2, sourceId: "d" });
    expect(Object.keys(state.effects)).toHaveLength(2);
    expect(Object.values(state.effects).find(effect => effect.value < 0).value).toBe(-5);
    expect(state.log.map(event => event.type)).toEqual(expect.arrayContaining([
      "effectApply", "effectRefresh", "effectReplace", "effectIgnore",
    ]));
  });
});
