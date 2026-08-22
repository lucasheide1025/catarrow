import fs from "fs";
import path from "path";

const read = rel => fs.readFileSync(path.join(__dirname, rel), "utf8");

test("multi party room owns a dedicated Firestore multiplayer lifecycle", () => {
  const source = read("MultiMonsterPartyRoom.jsx");
  expect(source).toContain("subscribeMultiMonsterPartyRoom");
  expect(source).toContain("startMultiMonsterPartyBattle");
  expect(source).toContain("submitMultiMonsterPartyRound");
  expect(source).toContain("processMultiMonsterPartyRound");
  expect(source).toContain('data-multi-monster-party-room="true"');
  expect(source).not.toContain("PartyBattleRoom");
});

test("host authority uses the current Firestore host and expected round guard", () => {
  const source = read("MultiMonsterPartyRoom.jsx");
  expect(source).toContain("room?.hostId === myId");
  expect(source).toContain("processingRoundRef.current === expectedRound");
  expect(source).toContain("processMultiMonsterPartyRound(roomId, myId, expectedRound)");
});

test("party HUD keeps only self HP and moves full stats into the team sheet", () => {
  const source = read("MultiMonsterPartyRoom.jsx");
  expect(source).toContain("getMultiMonsterPlayerStats({ player:member || {} })");
  expect(source).toContain('data-multi-party-live-stats="true"');
  expect(source).toContain('setSheet("team")');
  expect(source).toContain('label="ATK"');
  expect(source).toContain('label="DEF"');
});

test("active mobile shell uses viewport height, fixed action hierarchy and revision", () => {
  const source = read("MultiMonsterPartyRoom.jsx");
  expect(source).toContain('h-[100dvh] overflow-hidden');
  expect(source).toContain('data-multi-party-action-dock="true"');
  expect(source).toContain("reviseMultiMonsterPartyRound");
  expect(source).toContain("修改本回合");
});

test("party presentation uses real archer, cat, monster art and a local intro overlay", () => {
  const source = read("MultiMonsterPartyRoom.jsx");
  expect(source).toContain("PlayerAvatar");
  expect(source).toContain("CatSVG");
  expect(source).toContain("getBattleBackgroundUrl");
  expect(source).toContain("getBattleMonsterSources");
  expect(source).toContain('data-multi-party-intro="true"');
  expect(source).toContain('data-multi-party-battle-hud="true"');
  expect(source).toContain('data-multi-party-battlefield="true"');
});

test("waiting member sync persists cosmetics without adding per-round cosmetic writes", () => {
  const room = read("MultiMonsterPartyRoom.jsx");
  const db = read("../../lib/multiMonsterPartyDb.js");
  for (const field of ["avatarId","catId","catName","catType","bondLv"]) {
    expect(room).toContain(field);
    expect(db).toContain(field);
  }
  expect(db).not.toContain('[`members.${memberId}.avatarId`]');
  expect(db).not.toContain('[`members.${memberId}.catId`]');
});

test("victory reward uses the single trusted multi-monster claim and excludes pillars", () => {
  const source = read("MultiMonsterPartyRoom.jsx");
  expect(source).toContain('target.position === "front" && !target.isRunePillar');
  expect(source).toContain("claimMultiMonsterBattleReward");
  expect(source).toContain("battleId:roomId");
  expect(source).toContain("memberId:memberProfile.id");
});

test("member and coach shooter modes route multi rooms separately from single PartyBattleRoom and persist reconnect state", () => {
  const member = read("../../pages/MemberApp.jsx");
  const admin = read("../../pages/AdminApp.jsx");
  for (const source of [member, admin]) {
    expect(source).toContain("MultiMonsterPartyRoom");
    expect(source).toContain('page==="multi-monster-party"');
    expect(source).toContain("onEnterMultiPartyRoom={enterMultiMonsterParty}");
    expect(source).toContain("<PartyBattleRoom");
  }
  expect(member).toContain("member_multi_monster_party_room");
  expect(admin).toContain("admin_multi_monster_party_room");
});

test("multi party Firestore adapter uses transactions, expected-round idempotency and host migration", () => {
  const source = read("../../lib/multiMonsterPartyDb.js");
  expect(source).toContain("runTransaction");
  expect(source).toContain('reason:"stale_round"');
  expect(source).toContain("room.hostId !== hostId");
  expect(source).toContain("update.hostId = remainingIds[0]");
  expect(source).toContain("generateMultiMonsterEncounter");
  expect(source).toContain('reason:"member_stats_pending"');
});

test("v2 battle authority routes start, submit and revision through regional callables", () => {
  const source = read("../../lib/multiMonsterPartyDb.js");
  expect(source).toContain('callV2("startMultiMonsterPartyBattleV2"');
  expect(source).toContain('callV2("submitMultiMonsterPartyRoundV2"');
  expect(source).toContain('callV2("reviseMultiMonsterPartyRoundV2"');
  expect(source).toContain('getFunctions(app, "asia-east1")');
});

test("host-side resolver is disabled for combat v2", () => {
  const source = read("MultiMonsterPartyRoom.jsx");
  expect(source).toContain('room?.combatVersion === 2');
});

test("solo dungeon terminal waits for an explicit return-to-map action", () => {
  const source = read("MultiMonsterPartyRoom.jsx");
  expect(source).toContain('data-dungeon-solo-settlement="true"');
  expect(source).toContain('setDungeonSoloSettlement({ status:"ready"');
  expect(source).toContain("function continueDungeonSolo()");
  expect(source).toContain("onClick={continueDungeonSolo}");
  expect(source).toContain("本次敗北，沒有取得遭遇戰利品");
});

test("all multi-monster renderers opt into synchronized cat and canonical status floats", () => {
  const party = read("MultiMonsterPartyRoom.jsx");
  const solo = read("MultiMonsterBattle.jsx");
  expect(party).toContain('"free_hunt_party"');
  expect(party).toContain('"dungeon_solo"');
  expect(party).toContain('"dungeon_team"');
  expect(party).toContain("presentationPolicy.preservePlayerArrows");
  expect(solo).toContain('getMultiMonsterPresentationPolicy("free_hunt_solo")');
  expect(solo).toContain("MONSTER_STATUSES[p.status?.id]?.color");
  expect(solo).toContain("event.type === MULTI_BATTLE_EVENT.STATUS_TICK ? null");
});

test("dungeon multi propagates dungeonMode through waiting sync, arrow count and battle start", () => {
  const room = read("MultiMonsterPartyRoom.jsx");
  const db = read("../../lib/multiMonsterPartyDb.js");
  expect(room).toContain("updateMultiMonsterPartyMemberStats(roomId, myId, entryStats, { dungeonMode })");
  expect(room).toContain("setMultiMonsterPartyArrowsPerRound(roomId, myId, count, { dungeonMode })");
  expect(room).toContain("startMultiMonsterPartyBattle(roomId, myId, { dungeonMode })");
  expect(room).toContain("if (!dungeonMode && quotaRemaining <= 0)");
  expect(db).toContain("roomRef(roomId, dungeonMode)");
});

test("multi round submit has a synchronous per-round flight lock and aborted retry", () => {
  const room = read("MultiMonsterPartyRoom.jsx");
  const db = read("../../lib/multiMonsterPartyDb.js");
  expect(room).toContain("submitFlightRef.current === flightKey");
  expect(room).toContain("submitFlightRef.current = flightKey");
  expect(room).toContain("submitFlightRef.current = null");
  expect(room).toContain("setSubmittingRound(true)");
  expect(room).toContain('disabled={submittingRound || arrows.length !== arrowsPerRound');
  expect(room).toContain('(attackMode === "focus" && !targetId)');
  expect(db).toContain("retryAborted:true");
  expect(db).toContain("isAbortedCallable");
});
