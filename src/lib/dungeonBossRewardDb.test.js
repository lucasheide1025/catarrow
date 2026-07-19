global.mockCallable = jest.fn();

jest.mock("firebase/functions", () => ({
  getFunctions: jest.fn(() => ({ region:"asia-east1" })),
  httpsCallable: jest.fn((functions, name) => payload => global.mockCallable(name, payload)),
}));
jest.mock("./firebase", () => ({ __esModule:true, default:{} }));

const { createDungeonBossRewardClaim, claimDungeonBossChoices } = require("./dungeonBossRewardDb");
const { httpsCallable } = require("firebase/functions");

beforeEach(() => {
  global.mockCallable.mockReset();
  httpsCallable.mockImplementation((functions, name) => payload => global.mockCallable(name, payload));
});

test("fixed boss rewards are requested from the trusted callable", async () => {
  global.mockCallable.mockResolvedValue({ data:{ ok:true, duplicate:false, claimId:"claim", envelope:{ choiceCount:2 } } });
  const result = await createDungeonBossRewardClaim({ battleId:"b1", memberId:"m1", monsterId:"ghost_t1_boss" });
  expect(global.mockCallable).toHaveBeenCalledWith("createDungeonBossRewardClaim", { battleId:"b1", memberId:"m1", monsterId:"ghost_t1_boss" });
  expect(result.claimId).toBe("claim");
});

test("choice rewards are requested from the trusted callable", async () => {
  global.mockCallable.mockResolvedValue({ data:{ ok:true, selectedOptionIds:["a"] } });
  const result = await claimDungeonBossChoices({ claimId:"claim", memberId:"m1", selectedOptionIds:["a"] });
  expect(global.mockCallable).toHaveBeenCalledWith("claimDungeonBossChoices", { claimId:"claim", memberId:"m1", selectedOptionIds:["a"] });
  expect(result.selectedOptionIds).toEqual(["a"]);
});

test("invalid identities fail before a network call", async () => {
  await expect(createDungeonBossRewardClaim({})).rejects.toThrow("invalid_dungeon_reward_identity");
  await expect(claimDungeonBossChoices({ claimId:"", memberId:"m1", selectedOptionIds:[] })).rejects.toThrow("invalid_dungeon_choice_identity");
  expect(global.mockCallable).not.toHaveBeenCalled();
});
