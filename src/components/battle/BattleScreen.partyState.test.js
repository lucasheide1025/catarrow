jest.mock("../../lib/equipSpecializationDb", () => ({
  getEquipSpecializations: jest.fn(() => Promise.resolve({
    weapon:{ activeTrackId:null, tracks:{} },
    armor:{ activeTrackId:null, tracks:{} },
    accessory:{ activeTrackId:null, tracks:{} },
  })),
}));

jest.mock("../../lib/db", () => ({
  addRoundArrows: jest.fn(() => Promise.resolve()),
  subscribeCardCollection: jest.fn(() => () => {}),
}));

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ profile:null }),
}));

const { battleReducer, resolvePartySelectedAlly, shouldSyncPartyPlayer } = require("./BattleScreen");

describe("BattleScreen party authoritative state", () => {
  test("selected ally detail resolves the latest HP and role by id", () => {
    const id = "mate-1";
    const before = resolvePartySelectedAlly([{ id, hp:80, maxHp:100, role:"front" }], id);
    const after = resolvePartySelectedAlly([{ id, hp:50, maxHp:100, role:"rear" }], id);
    expect(before).toMatchObject({ hp:80, role:"front" });
    expect(after).toMatchObject({ hp:50, role:"rear" });
  });

  test("party player HP waits for the shared resolution animation before syncing", () => {
    expect(shouldSyncPartyPlayer({ partyMode:true, inBattle:true, partyResolutionKey:2, completedPartyResolutionKey:1 })).toBe(false);
    expect(shouldSyncPartyPlayer({ partyMode:true, inBattle:true, partyResolutionKey:2, completedPartyResolutionKey:2 })).toBe(true);
  });

  test("SYNC_PARTY_PLAYER updates player HP without overriding monster animation state", () => {
    const state = { playerHp:20, playerMaxHp:100, monsterHp:321, monsterMaxHp:500, phase:"playing", messages:[] };
    const next = battleReducer(state, { type:"SYNC_PARTY_PLAYER", playerHp:50, playerMaxHp:100 });
    expect(next.playerHp).toBe(50);
    expect(next.playerMaxHp).toBe(100);
    expect(next.monsterHp).toBe(321);
    expect(next.monsterMaxHp).toBe(500);
  });

  test("START preserves a valid zero HP instead of replacing it with max HP", () => {
    const next = battleReducer({}, {
      type:"START",
      monster:{ name:"測試怪", family:"ghost", hp:100, maxHp:100, atk:10, def:5 },
      diff:{ hp:1, atk:1, def:1 },
      battleMode:"score",
      playerHp:0,
      playerMaxHp:100,
      playerAtk:10,
      playerDef:10,
    });
    expect(next.playerHp).toBe(0);
    expect(next.playerMaxHp).toBe(100);
  });
});
