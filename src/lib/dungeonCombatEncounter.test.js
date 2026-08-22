import {
  createDungeonEncounterRandom,
  isDungeonCombatEncounter,
  resolveDungeonCombatEncounter,
  resolveOrRestoreDungeonEncounter,
} from "./dungeonCombatEncounter";

const primary = { id:"ghost_1", name:"主怪", family:"ghost", tierIndex:1, hp:100, atk:10, def:5 };
const make = overrides => resolveDungeonCombatEncounter({
  runId:"run-1", floorIndex:0, roomId:"room-1", roomType:"battle",
  family:"ghost", difficultyTier:1, primaryMonster:primary, ...overrides,
});

test("same room restores a byte-stable encounter with unique target instances", () => {
  const first = make();
  const second = make();
  expect(second).toEqual(first);
  expect(isDungeonCombatEncounter(first)).toBe(true);
  expect(new Set(first.targets.map(target => target.instanceId)).size).toBe(first.targets.length);
});

test("normal rooms deterministically cover both 50/50 branches", () => {
  const kinds = Array.from({ length:80 }, (_, index) => make({ roomId:`room-${index}` }).kind);
  expect(kinds).toContain("single");
  expect(kinds).toContain("multi");
  const multiRatio = kinds.filter(kind => kind === "multi").length / kinds.length;
  expect(multiRatio).toBeGreaterThan(0.3);
  expect(multiRatio).toBeLessThan(0.7);
});

test.each([
  ["elite_battle", "elite"],
  ["boss_battle", "boss"],
])("%s is primary plus two normal adds", (roomType, role) => {
  const encounter = make({ roomType });
  expect(encounter.kind).toBe("multi");
  expect(encounter.roomRole).toBe(role);
  expect(encounter.targets).toHaveLength(3);
  expect(encounter.targets[0]).toMatchObject({ instanceId:"primary", isPrimary:true, id:primary.id });
  expect(encounter.targets.slice(1).every(target => target.isPrimary === false)).toBe(true);
});

test("persisted snapshots win and legacy rooms may remain single", () => {
  const encounter = make({ roomType:"boss_battle" });
  expect(resolveOrRestoreDungeonEncounter({ encounter, roomId:"changed" })).toBe(encounter);
  expect(resolveOrRestoreDungeonEncounter({ legacyFallback:true })).toBeNull();
});

test("seeded random is repeatable", () => {
  const a = createDungeonEncounterRandom("seed");
  const b = createDungeonEncounterRandom("seed");
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

test("supports T6 and alias family names without throwing missing pool errors", () => {
  const aliasFamilies = ["forest", "poison", "office", "western", "temple", "mountain", "insect", "workplace", "exam", "ghost", "treasure"];
  for (const fam of aliasFamilies) {
    const enc = resolveDungeonCombatEncounter({
      runId: "run-t6",
      floorIndex: 2,
      roomId: `room-t6-${fam}`,
      roomType: "elite_battle",
      family: fam,
      difficultyTier: 6,
      primaryMonster: { id: `${fam}_t6_boss`, name: "T6王", family: fam, tierIndex: 6, hp: 5000, atk: 50, def: 20 },
    });
    expect(enc.kind).toBe("multi");
    expect(enc.targets).toHaveLength(3);
    expect(enc.targets[1].tierIndex).toBe(6);
    expect(enc.targets[2].tierIndex).toBe(6);
  }
});

