import {
  COMBAT_PHASES,
  allMembersSubmitted,
  beginShooting,
  createCombatRoundState,
  moveToPhase,
  orderCompanionActions,
  recordResolvedCompanion,
  recordResolvedSkill,
  restoreCombatRoundState,
  serializeCombatRoundState,
  startNextCombatRound,
  submitMemberRound,
} from "./combatRoundState";

const makeState = () => createCombatRoundState({
  battleId: "battle-locked",
  mode: "party",
  monster: { id: "ghost_1", hp: 250, atk: 20, def: 14 },
  members: {
    z: { role: "rear", alive: true, companionId: "cat-z" },
    a: { role: "front", alive: true, companionId: "cat-a" },
  },
  arrowsPerRound: 3,
  targetFmt: "half_610",
  rngSeed: "seed-1",
});

test("combat settings and snapshots survive serialization without being reselected", () => {
  const state = makeState();
  const restored = restoreCombatRoundState(serializeCombatRoundState(state));
  expect(restored.lockedSettings).toEqual({ arrowsPerRound: 3, targetFmt: "half_610" });
  expect(restored.monsterSnapshot).toEqual(state.monsterSnapshot);
  expect(restored.rngSeed).toBe("seed-1");
});

test("member submissions are accepted exactly once with the locked arrow count", () => {
  let state = beginShooting(makeState());
  const first = submitMemberRound(state, { memberId: "a", arrows: [10, 9, 8] });
  const duplicate = submitMemberRound(first, { memberId: "a", arrows: ["M", "M", "M"] });
  const wrongCount = submitMemberRound(duplicate, { memberId: "z", arrows: [10] });
  expect(duplicate).toBe(first);
  expect(wrongCount).toBe(duplicate);
  expect(allMembersSubmitted(wrongCount)).toBe(false);
  state = submitMemberRound(wrongCount, { memberId: "z", arrows: [7, 6, 5] });
  expect(allMembersSubmitted(state)).toBe(true);
});

test("phase progression is ordered and animation replay cannot skip phases", () => {
  const shooting = beginShooting(makeState());
  expect(moveToPhase(shooting, COMBAT_PHASES.COMPANION)).toBe(shooting);
  expect(moveToPhase(shooting, COMBAT_PHASES.PLAYER_DAMAGE).phase).toBe(COMBAT_PHASES.PLAYER_DAMAGE);
});

test("skill and companion resolved keys are idempotent", () => {
  const state = makeState();
  const skillOnce = recordResolvedSkill(state, { resolvedKey: "skill-key", result: { damage: 5 } });
  const skillTwice = recordResolvedSkill(skillOnce, { resolvedKey: "skill-key", result: { damage: 999 } });
  expect(skillTwice).toBe(skillOnce);
  expect(skillTwice.skillHistory).toHaveLength(1);
  const catOnce = recordResolvedCompanion(skillTwice, "cat-key");
  expect(recordResolvedCompanion(catOnce, "cat-key")).toBe(catOnce);
});

test("next round only starts after end-heal and clears submissions", () => {
  let state = beginShooting(makeState());
  for (const phase of [
    COMBAT_PHASES.PLAYER_DAMAGE,
    COMBAT_PHASES.BREAK_RESULT,
    COMBAT_PHASES.COMPANION,
    COMBAT_PHASES.MONSTER_ABILITY,
    COMBAT_PHASES.STATUSES,
    COMBAT_PHASES.COUNTER,
    COMBAT_PHASES.END_HEAL,
  ]) state = moveToPhase(state, phase);
  const next = startNextCombatRound(state, { skillId: "sig_ghost_1" });
  expect(next).toMatchObject({ combatRound: 2, phase: COMBAT_PHASES.TELEGRAPH, submissions: {} });
  expect(next.pendingTelegraph).toEqual({ skillId: "sig_ghost_1" });
});

test("companion order is front, middle, rear then member id", () => {
  expect(orderCompanionActions({
    c: { role: "rear", companionId: "cat-c", alive: true },
    b: { role: "front", companionId: "cat-b", alive: true },
    a: { role: "front", companionId: "cat-a", alive: true },
    d: { role: "middle", companionId: "cat-d", alive: false },
  }).map(item => item.memberId)).toEqual(["a", "b", "c"]);
});
