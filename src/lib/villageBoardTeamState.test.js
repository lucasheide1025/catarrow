import { resolveTeamHostDice, teamRoomStepPassed } from "./villageBoardTeamState";

test("room dice is authoritative including zero", () => {
  expect(resolveTeamHostDice({ hostDiceLeft: 0 }, 9)).toBe(0);
  expect(resolveTeamHostDice({ hostDiceLeft: 4 }, 9)).toBe(4);
});

test("legacy rooms safely fall back to the member snapshot", () => {
  expect(resolveTeamHostDice({}, 3)).toBe(3);
  expect(resolveTeamHostDice({}, undefined)).toBeNull();
});

test("a reward step requires every active member to claim and acknowledge", () => {
  const room = { seq:2, members:{ a:{}, b:{} }, pendingSettle:{ seq:2 }, settleClaims:{ a:2, b:2 }, ackClaims:{ a:2 } };
  expect(teamRoomStepPassed(room)).toBe(false);
  expect(teamRoomStepPassed({ ...room, ackClaims:{ a:2, b:2 } })).toBe(true);
});

test("a fork requires every active member to vote and acknowledge", () => {
  const room = { seq:3, members:{ a:{}, b:{} }, pendingFork:{ seq:3 }, forkVotes:{ a:"left", b:"right" }, ackClaims:{ a:3 } };
  expect(teamRoomStepPassed(room)).toBe(false);
  expect(teamRoomStepPassed({ ...room, ackClaims:{ a:3, b:3 } })).toBe(true);
});
