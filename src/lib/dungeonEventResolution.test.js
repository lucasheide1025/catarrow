import { buildTeamEventResolution } from "./dungeonEventResolution";
import { GENERAL_EVENTS, SPECIAL_EVENTS } from "./dungeonEventPool";

describe("team dungeon event resolution", () => {
  test("ATK +10% produces the same visible result and persisted member buff", () => {
    const result = buildTeamEventResolution({
      event: { id: "atk", title: "鼓舞", effect: { atk: 0.1 } },
      members: {
        a: { alive: true, buffs: { atkMult: 1, defMult: 1, dmgMult: 1 } },
        b: { alive: true, buffs: { atkMult: 1.2, defMult: 1, dmgMult: 1 } },
      },
      random: () => 0,
    });

    expect(result.effect).toEqual({ atk: 0.1 });
    expect(result.badges).toContain("全隊 ATK +10%");
    expect(result.updates["members.a.buffs.atkMult"]).toBe(1.1);
    expect(result.updates["members.b.buffs.atkMult"]).toBe(1.32);
  });

  test("random effects are resolved once into a concrete shared result", () => {
    const result = buildTeamEventResolution({
      event: { id: "dice", effect: { random: [{ atk: 0.1 }, { def: 0.1 }] } },
      members: { a: { alive: true, buffs: {} } },
      random: () => 0.99,
    });
    expect(result.effect).toEqual({ def: 0.1 });
    expect(result.updates["members.a.buffs.defMult"]).toBe(1.1);
  });

  test("every published event only uses implemented effect fields", () => {
    const supported = new Set(["hp", "atk", "def", "dmg", "monsterHp", "monsterAtk", "gold", "item", "random"]);
    const effects = [
      ...GENERAL_EVENTS.map(event => event.effect),
      ...SPECIAL_EVENTS.flatMap(event => event.choices.map(choice => choice.effect)),
    ];
    for (const effect of effects) {
      expect(Object.keys(effect || {}).filter(key => !supported.has(key))).toEqual([]);
    }
  });
});
