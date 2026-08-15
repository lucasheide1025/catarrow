jest.mock("../../lib/equipSpecializationDb", () => ({
  getEquipSpecializations: jest.fn().mockResolvedValue({}),
}));
jest.mock("../../lib/db", () => ({
  addRoundArrows: jest.fn().mockResolvedValue(undefined),
  subscribeCardCollection: jest.fn(() => () => {}),
}));
jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ profile: null }),
}));

const { battleReducer, initBattle } = require("./BattleScreen");

function startedBattle() {
  return battleReducer(initBattle, {
    type: "START",
    monster: { id: "draft-test", name: "草稿測試怪", family: "insect", hp: 500, atk: 20, def: 10 },
    diff: { hp: 1, atk: 1, def: 1 },
    battleMode: "score",
    playerAtk: 100,
    playerDef: 50,
    playerHp: 500,
    playerMaxHp: 500,
    cardFx: { inflict: { poison: { chancePct: 100, strength: 5, duration: 2 } } },
  });
}

describe("BattleScreen arrow draft is side-effect free", () => {
  test("輸入 X、刪除再輸入 X，在正式送出前不得累積怪物異常", () => {
    const scoreX = {
      type: "SCORE_ARROW",
      score: "X",
      displayLabel: "X",
      battleMode: "score",
      arrowsPerRound: 6,
      previewDamage: true,
    };

    const afterFirstX = battleReducer(startedBattle(), scoreX);
    const afterUndo = battleReducer(afterFirstX, { type: "UNDO_ARROW" });
    const afterSecondX = battleReducer(afterUndo, scoreX);

    expect(afterFirstX.monsterStatuses).toEqual([]);
    expect(afterUndo.monsterStatuses).toEqual([]);
    expect(afterSecondX.monsterStatuses).toEqual([]);
  });
});
