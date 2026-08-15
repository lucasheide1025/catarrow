import { calcPartyCounter, resolvePlayerCounter } from "./damage";

describe("party counter defense", () => {
  test("高 DEF 玩家承受的怪物傷害必須低於低 DEF 玩家，即使怪物攻擊很高", () => {
    const monsterAtk = 1000;
    const maxHP = 500;
    const lowDefDamage = resolvePlayerCounter({
      arrows:[{ score:10 }],
      baseDamage:calcPartyCounter(monsterAtk, 14, 0, false),
      maxHP,
    }).damage;
    const highDefDamage = resolvePlayerCounter({
      arrows:[{ score:10 }],
      baseDamage:calcPartyCounter(monsterAtk, 257, 0, false),
      maxHP,
    }).damage;

    expect(lowDefDamage).toBe(599);
    expect(highDefDamage).toBe(502);
    expect(lowDefDamage).toBeGreaterThan(maxHP * 0.25);
    expect(highDefDamage).toBeLessThan(lowDefDamage);
  });
});
