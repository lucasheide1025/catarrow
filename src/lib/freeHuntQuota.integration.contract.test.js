import fs from "fs";
import path from "path";

function read(relative) {
  return fs.readFileSync(path.join(__dirname, relative), "utf8");
}

test("Free Hunt quota is wired into all four battle entrypoints", () => {
  const solo = read("../components/member/MonsterBattle.jsx");
  const party = read("../components/party/PartyBattleRoom.jsx");
  const multiSolo = read("../components/battle/MultiMonsterBattle.jsx");
  const multiParty = read("../components/battle/MultiMonsterPartyRoom.jsx");

  expect(solo).toContain("consumeFreeHuntAttempt");
  expect(solo).toContain("FREE_HUNT_QUOTA_MODE.SINGLE");
  expect(solo).toContain("huntMonsterId && profile?.id");
  expect(party).toContain("consumeFreeHuntAttempt");
  expect(party).toContain("FREE_HUNT_QUOTA_MODE.SINGLE");
  expect(party).toContain("freeHuntStartIdRef");
  expect(multiSolo).toContain("consumeFreeHuntAttempt");
  expect(multiSolo).toContain("FREE_HUNT_QUOTA_MODE.MULTI");
  expect(multiSolo).toContain("pendingBattleMetaRef");
  expect(multiParty).toContain("consumeFreeHuntAttempt");
  expect(multiParty).toContain("FREE_HUNT_QUOTA_MODE.MULTI");
  expect(multiParty).toContain("multi_party_");
});

test("server quota callable is authoritative, idempotent, and verifies party host", () => {
  const source = read("../../functions/index.js");
  expect(source).toContain("exports.consumeFreeHuntAttempt");
  expect(source).toContain("freeHuntAttemptClaims");
  expect(source).toContain("member.freeHuntUsage");
  expect(source).toContain("room.hostId !== memberId");
  expect(source).toContain("free_hunt_host_only");
  expect(source).toContain("free_hunt_limit_reached");
});

test("Free Hunt lobby keeps independent single and multi remaining counters while join stays available", () => {
  const source = read("../components/member/FreeHunt.jsx");
  expect(source).toContain("singleRemaining");
  expect(source).toContain("multiRemaining");
  expect(source).toContain("今日指定單怪剩餘");
  expect(source).toContain("今日複數討伐剩餘");
  expect(source).toContain('data-multi-hunt-join-party="true"');
});
