import fs from "fs";
import path from "path";

const read=file=>fs.readFileSync(path.join(__dirname,file),"utf8");

test("solo multi completion carries the authoritative reward into dungeon settlement",()=>{
  const party=read("../battle/MultiMonsterPartyRoom.jsx");
  const dungeon=read("DungeonExpedition.jsx");
  expect(party).toContain("claimDungeonMultiSoloReward({battleId:roomId,memberId:myId})");
  expect(party).toContain("dungeonReward");
  expect(dungeon).toContain("if (battle?.dungeonReward)");
  expect(dungeon.indexOf("if (battle?.dungeonReward)")).toBeLessThan(dungeon.indexOf("let serverCardClaim = null"));
});

test("solo dungeon multi persists the authoritative encounter identity before entering battle",()=>{
  const dungeon=read("DungeonExpedition.jsx");
  const functions=read("../../../functions/index.js");
  const roomAssigned=dungeon.indexOf("r.multiBattleRoomId = created.roomId");
  const snapshotBuilt=dungeon.indexOf("const battleSnapshot = buildActiveExpeditionPayload(r)", roomAssigned);
  const queued=dungeon.indexOf("queueActiveExpeditionProgress(myId, battleSnapshot)", snapshotBuilt);
  const flushed=dungeon.indexOf("await flushActiveExpeditionProgress(myId)", queued);
  const checked=dungeon.indexOf("if (!persisted?.ok)", flushed);
  const entered=dungeon.indexOf("setPendingRoom(r)", checked);

  expect(roomAssigned).toBeGreaterThan(-1);
  expect(snapshotBuilt).toBeGreaterThan(roomAssigned);
  expect(queued).toBeGreaterThan(snapshotBuilt);
  expect(flushed).toBeGreaterThan(queued);
  expect(checked).toBeGreaterThan(flushed);
  expect(entered).toBeGreaterThan(checked);
  expect(dungeon).toContain("pendingRoom: pendingRoomOverride");
  expect(functions).toContain("dungeon_multi_run_mismatch");
  expect(functions).toContain("savedPending?.multiBattleRoomId!==battleId");
  expect(functions).toContain("savedPending?.encounter?.encounterId!==roomSnap.data()?.encounter?.encounterId");
});
