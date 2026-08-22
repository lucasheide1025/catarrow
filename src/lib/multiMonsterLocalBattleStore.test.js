import {
  buildMultiMonsterLocalBattleKey,
  clearMultiMonsterLocalBattle,
  createMultiMonsterBattleIdentity,
  createMultiMonsterLocalRandom,
  loadMultiMonsterLocalBattle,
  saveMultiMonsterLocalBattle,
} from "./multiMonsterLocalBattleStore";

beforeEach(() => {
  localStorage.clear();
});

test("stable local battle key scopes by member, family and tier", () => {
  expect(buildMultiMonsterLocalBattleKey({memberId:"m1",family:"ghost",tier:2})).toBe("m1::ghost::2");
});

test("battle identity produces a stable deterministic encounter seed", () => {
  const first = createMultiMonsterBattleIdentity({memberId:"m1",family:"ghost",tier:2,now:123456,random:()=>0.25});
  const second = createMultiMonsterBattleIdentity({memberId:"m1",family:"ghost",tier:2,now:123456,random:()=>0.25});
  expect(first).toEqual(second);
  expect(first.battleId).toMatch(/^multi_m1_/);
  expect(createMultiMonsterLocalRandom(first.encounterSeed)()).toBe(createMultiMonsterLocalRandom(second.encounterSeed)());
});

test("localStorage fallback preserves an unfinished battle and can clear it", async () => {
  const original = global.indexedDB;
  try {
    Object.defineProperty(global, "indexedDB", { configurable:true, value:undefined });
    const identity = {memberId:"m1",family:"ghost",tier:1};
    await saveMultiMonsterLocalBattle({ ...identity, battleId:"multi_test", encounterSeed:42, battleState:{round:3}, actionHistory:[{round:3}] });
    const restored = await loadMultiMonsterLocalBattle(identity);
    expect(restored.battleId).toBe("multi_test");
    expect(restored.battleState.round).toBe(3);
    expect(restored.actionHistory).toHaveLength(1);
    await clearMultiMonsterLocalBattle(identity);
    expect(await loadMultiMonsterLocalBattle(identity)).toBeNull();
  } finally {
    Object.defineProperty(global, "indexedDB", { configurable:true, value:original });
  }
});
