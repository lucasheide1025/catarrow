// src/zombie/domain/partyEngine.test.js
import {
  createParty,
  joinParty,
  leaveParty,
  toggleReady,
  isAllReady,
  setPlayerEquipment,
  updateInfection,
  recordShot,
  getAliveMembers,
  getInfectedMembers,
  getMemberBySlot,
  createPlayer,
  MAX_PARTY_SIZE,
  PLAYER_ROLE,
} from "./partyEngine";

describe("Party Engine", () => {
  const leaderId = "player_1";
  const leaderName = "隊長";

  test("creates party with leader", () => {
    const party = createParty(leaderId, leaderName);
    expect(party.leaderId).toBe(leaderId);
    expect(party.members.length).toBe(1);
    expect(party.members[0].name).toBe(leaderName);
    expect(party.members[0].slot).toBe("A");
    expect(party.members[0].role).toBe(PLAYER_ROLE.LEADER);
  });

  test("joinParty adds member to available slot", () => {
    const party = createParty(leaderId, leaderName);
    const result = joinParty(party, "player_2", "射手A");
    expect(result.ok).toBe(true);
    expect(result.party.members.length).toBe(2);
    expect(result.party.members[1].slot).toBe("B");
  });

  test("joinParty rejects duplicate", () => {
    const party = createParty(leaderId, leaderName);
    const result = joinParty(party, leaderId, "again");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("already_in_party");
  });

  test("joinParty rejects full party", () => {
    let party = createParty(leaderId, leaderName);
    for (let i = 1; i < 5; i++) {
      const r = joinParty(party, `player_${i + 1}`, `隊員${i + 1}`);
      expect(r.ok).toBe(true);
      party = r.party;
    }
    // 第六人
    const result = joinParty(party, "player_6", "too_many");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("party_full");
  });

  test("leaveParty removes member", () => {
    let party = createParty(leaderId, leaderName);
    party = joinParty(party, "player_2", "射手A").party;
    const result = leaveParty(party, "player_2");
    expect(result.ok).toBe(true);
    expect(result.party.members.length).toBe(1);
  });

  test("leaveParty transfers leadership when leader leaves", () => {
    let party = createParty(leaderId, leaderName);
    party = joinParty(party, "player_2", "射手A").party;
    const result = leaveParty(party, leaderId);
    expect(result.ok).toBe(true);
    expect(result.party.leaderId).toBe("player_2");
    expect(result.party.members[0].role).toBe(PLAYER_ROLE.LEADER);
  });

  test("toggleReady switches ready state", () => {
    let party = createParty(leaderId, leaderName);
    party = toggleReady(party, leaderId);
    expect(party.members[0].isReady).toBe(true);
    party = toggleReady(party, leaderId);
    expect(party.members[0].isReady).toBe(false);
  });

  test("isAllReady returns true when 2+ members all ready", () => {
    let party = createParty(leaderId, leaderName);
    party = joinParty(party, "player_2", "射手A").party;
    party = toggleReady(party, leaderId);
    party = toggleReady(party, "player_2");
    expect(isAllReady(party)).toBe(true);
  });

  test("isAllReady returns false when not all ready", () => {
    let party = createParty(leaderId, leaderName);
    party = joinParty(party, "player_2", "射手A").party;
    party = toggleReady(party, leaderId);
    expect(isAllReady(party)).toBe(false);
  });

  test("setPlayerEquipment updates specific member", () => {
    let party = createParty(leaderId, leaderName);
    party = joinParty(party, "player_2", "射手A").party;
    const updated = setPlayerEquipment(party, "player_2", {
      armor: "t2_plate",
      arrows: ["piercing", "explosive"],
    });
    const member = updated.members.find(m => m.id === "player_2");
    expect(member.equipment.armor).toBe("t2_plate");
    expect(member.equipment.arrows).toEqual(["piercing", "explosive"]);
  });

  test("updateInfection tracks progress and fully infected state", () => {
    let party = createParty(leaderId, leaderName);
    party = updateInfection(party, leaderId, 5, false);
    expect(party.members[0].infectionProgress).toBe(5);
    expect(party.members[0].isFullyInfected).toBe(false);
    expect(party.members[0].isAlive).toBe(true);

    party = updateInfection(party, leaderId, 10, true);
    expect(party.members[0].isFullyInfected).toBe(true);
    expect(party.members[0].isAlive).toBe(false);
  });

  test("recordShot tracks accuracy", () => {
    let party = createParty(leaderId, leaderName);
    party = recordShot(party, leaderId, "head", true);
    party = recordShot(party, leaderId, null, false);
    party = recordShot(party, leaderId, "chest", true);
    const member = party.members[0];
    expect(member.combatStats.totalShots).toBe(3);
    expect(member.combatStats.totalHits).toBe(2);
    expect(member.combatStats.accuracy).toBe(67);
  });

  test("getAliveMembers returns only alive", () => {
    let party = createParty(leaderId, leaderName);
    party = joinParty(party, "player_2", "射手A").party;
    party = updateInfection(party, "player_2", 10, true);
    const alive = getAliveMembers(party);
    expect(alive.length).toBe(1);
    expect(alive[0].id).toBe(leaderId);
  });

  test("getInfectedMembers returns infected only", () => {
    let party = createParty(leaderId, leaderName);
    party = joinParty(party, "player_2", "射手A").party;
    party = updateInfection(party, "player_2", 3, false);
    const infected = getInfectedMembers(party);
    expect(infected.length).toBe(1);
    expect(infected[0].id).toBe("player_2");
  });

  test("getMemberBySlot finds correct member", () => {
    let party = createParty(leaderId, leaderName);
    party = joinParty(party, "player_2", "射手A").party;
    const found = getMemberBySlot(party, "B");
    expect(found).toBeTruthy();
    expect(found.id).toBe("player_2");
    expect(getMemberBySlot(party, "C")).toBeUndefined();
  });

  test("createPlayer with custom values", () => {
    const player = createPlayer({ id: "p1", name: "玩家一", slot: "C", role: PLAYER_ROLE.SPOTTER });
    expect(player.slot).toBe("C");
    expect(player.role).toBe(PLAYER_ROLE.SPOTTER);
    expect(player.isAlive).toBe(true);
    expect(player.combatStats.totalShots).toBe(0);
  });

  test("MAX_PARTY_SIZE is 5", () => {
    expect(MAX_PARTY_SIZE).toBe(5);
  });
});
