import { buildHuntBattleResume, parseHuntBattleResume } from "./huntBattleResume";

describe("free hunt battle resume", () => {
  test("accepts a matching unexpired free-hunt battle", () => {
    const now = 1000;
    const descriptor = buildHuntBattleResume("ghost_t1_a", now);
    const battleSave = { ts:now, huntMonsterId:"ghost_t1_a", runtimeSnapshot:{ battle:{ round:2 } } };
    expect(parseHuntBattleResume(descriptor, battleSave, now + 10)).toMatchObject({ source:"free-hunt", monsterId:"ghost_t1_a" });
  });

  test("rejects expired or mismatched saves", () => {
    const descriptor = buildHuntBattleResume("ghost_t1_a", 1000, 50);
    expect(parseHuntBattleResume(descriptor, { huntMonsterId:"ghost_t1_a", runtimeSnapshot:{} }, 1051)).toBeNull();
    expect(parseHuntBattleResume(buildHuntBattleResume("ghost_t1_a", 1000), { huntMonsterId:"ghost_t2_a", runtimeSnapshot:{} }, 1010)).toBeNull();
  });
});
