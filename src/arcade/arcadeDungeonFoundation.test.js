import { ARCADE_CATS } from "./arcadeData";
import { resolveRound } from "./arcadeBattle";
import { getArcadeEquippedCardEffects, normalizeArcadeProfile } from "./arcadeProgression";
import { decideAdventureSessionClaim } from "./arcadeDb";

function profile(overrides = {}) {
  return normalizeArcadeProfile({
    visitorId: "visitor-foundation",
    nickname: "測試射手",
    selectedCat: "haji",
    coins: 0,
    inventory: {},
    statistics: {},
    playerLevel: 1,
    playerXp: 0,
    ...overrides,
  });
}

function battleState(overrides = {}) {
  return {
    playerHp: 100,
    playerMaxHp: 100,
    playerAtk: 10,
    playerDef: 5,
    cat: ARCADE_CATS[0],
    monster: { id: "visitor-test", name: "測試怪", hp: 250, atk: 0, def: 4, ability: "none" },
    monsterHp: 250,
    ...overrides,
  };
}

describe("Arcade dungeon foundation", () => {
  test("equipped status-card adapter excludes guard and maps level chance", () => {
    const p = profile({
      cards: {
        owned: {
          poison: { id: "poison", level: 2, shards: 0 },
          guard: { id: "guard", level: 3, shards: 0 },
        },
        equipped: ["poison", "guard"],
      },
    });
    expect(getArcadeEquippedCardEffects(p)).toEqual([
      { id: "poison", status: "poison", level: 2, chance: 0.2 },
    ]);
  });

  test("status card needs at least one 9+ arrow and can persist across rounds", () => {
    const card = [{ id: "poison", status: "poison", level: 1, chance: 0.15 }];
    const missThreshold = resolveRound(battleState({ equippedCards: card }), [8, 8, 8, 8, 8, 8], () => 0);
    expect(missThreshold.monsterStatuses).toEqual([]);

    const proc = resolveRound(battleState({ equippedCards: card }), [9, 1, 1, 1, 1, 1], () => 0);
    expect(proc.monsterStatuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "poison", level: 1, duration: 3 }),
    ]));

    const next = resolveRound(battleState({
      monsterHp: proc.monsterHp,
      monsterStatuses: proc.monsterStatuses,
    }), [0, 0, 0, 0, 0, 0], () => 0.99);
    expect(next.statusDamage).toBeGreaterThan(0);
    expect(next.monsterStatuses[0]).toEqual(expect.objectContaining({ status: "poison", duration: 2 }));
  });

  test("armor break reduces visitor monster effective DEF only", () => {
    const normal = resolveRound(battleState(), [10, 0, 0, 0, 0, 0], () => 0.99);
    const broken = resolveRound(battleState({
      monsterStatuses: [{ status: "armorBreak", level: 2, duration: 2 }],
    }), [10, 0, 0, 0, 0, 0], () => 0.99);
    expect(normal.effectiveMonsterDef).toBe(4);
    expect(broken.effectiveMonsterDef).toBe(2);
    expect(broken.dmg).toBeGreaterThan(normal.dmg);
  });

  test("forced same-browser takeover keeps the existing run state and mode", () => {
    const current = {
      runId: "run-existing",
      ownerTabId: "tab-a",
      mode: "moon",
      heartbeatAt: 1000,
      revision: 4,
      settled: false,
      runState: { floorIndex: 1, playerHp: 77 },
    };
    const blocked = decideAdventureSessionClaim(current, { mode: "forest", tabId: "tab-b", now: 1100 });
    expect(blocked.kind).toBe("conflict");

    const takeover = decideAdventureSessionClaim(current, { mode: "forest", force: true, tabId: "tab-b", now: 1100 });
    expect(takeover.kind).toBe("resume");
    expect(takeover.session.runId).toBe("run-existing");
    expect(takeover.session.mode).toBe("moon");
    expect(takeover.session.runState).toEqual({ floorIndex: 1, playerHp: 77 });
    expect(takeover.session.ownerTabId).toBe("tab-b");
  });
});
