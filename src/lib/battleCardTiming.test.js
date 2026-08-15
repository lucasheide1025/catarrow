import { canAutoStartStandaloneBattle, resolveMonsterShieldHit, resolvePlayerShieldHit, resolveReflectDamage } from "./battleCardTiming";

describe("standalone battle card timing", () => {
  test("authenticated battle waits for card effects but guest does not", () => {
    expect(canAutoStartStandaloneBattle({ memberId:"m1", cardEffects:undefined })).toBe(false);
    expect(canAutoStartStandaloneBattle({ memberId:"m1", cardEffects:{ firstStrikePct:4 } })).toBe(true);
    expect(canAutoStartStandaloneBattle({ memberId:null, cardEffects:null })).toBe(true);
  });

  test("shield absorbs before hp and is consumed", () => {
    expect(resolvePlayerShieldHit({ hp:500, shield:20, damage:12 })).toEqual({ hp:500, shield:8, absorbed:12, hpDamage:0 });
    expect(resolvePlayerShieldHit({ hp:500, shield:8, damage:20 })).toEqual({ hp:488, shield:0, absorbed:8, hpDamage:12 });
  });

  test("monster shield pierce bypasses the matching share of damage", () => {
    expect(resolveMonsterShieldHit({ hp:500, shield:100, damage:50, piercePct:20 }))
      .toEqual({ hp:490, shield:60, absorbed:40, hpDamage:10 });
  });

  test("player shield pierce bypasses shield instead of shrinking its capacity", () => {
    expect(resolvePlayerShieldHit({ hp:500, shield:100, damage:50, piercePct:20 }))
      .toEqual({ hp:490, shield:60, absorbed:40, hpDamage:10 });
  });

  test("reflect is calculated from damage that actually reached hp", () => {
    expect(resolveReflectDamage({ incomingDamage:25, reflectPct:12 })).toBe(3);
  });
});
