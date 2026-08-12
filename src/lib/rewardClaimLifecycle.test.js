import fs from "fs";
import path from "path";

test("solo dungeon preserves the room until the authoritative reward claim completes", () => {
  const source=fs.readFileSync(path.resolve(__dirname,"../components/dungeon/DungeonExpedition.jsx"),"utf8");
  const finalizer=source.slice(source.indexOf("const finalize = async"),source.indexOf("}, delay);",source.indexOf("const finalize = async")));
  expect(finalizer.indexOf("await onDoneRef.current")).toBeGreaterThanOrEqual(0);
  expect(finalizer.indexOf("await cleanupExpeditionRoom")).toBeGreaterThan(finalizer.indexOf("await onDoneRef.current"));
  expect(source).toContain("finishBattle(false, 1500)");
  const handler=source.slice(source.indexOf("const handleBattleDone"),source.indexOf("const handleAbandon"));
  expect(handler.indexOf("serverCardClaim=await claimDungeonNormalCard")).toBeLessThan(handler.indexOf("addChests(myId"));
});

test("expedition boss victory keeps reward proof and retry restores the result flow", () => {
  const battleSource=fs.readFileSync(path.resolve(__dirname,"../components/dungeon/DungeonBattleRoom.jsx"),"utf8");
  const expeditionSource=fs.readFileSync(path.resolve(__dirname,"../components/dungeon/DungeonExpedition.jsx"),"utf8");
  expect(battleSource).toContain('if (isHost && room?.status === "path_select")');
  expect(expeditionSource).toContain("resultBase:bossKillResultBase");
  expect(expeditionSource).toContain("const retryBossReward = useCallback");
  expect(expeditionSource).toContain("bossDrops: bossDropsFromEnvelope(claim?.envelope)");
  expect(expeditionSource).toContain("onClick={retryBossReward}");
});

test("guild cards use defeated settlement roster with a stable profile claim", () => {
  const client=fs.readFileSync(path.resolve(__dirname,"../guild/db/guildDb.js"),"utf8");
  const functions=fs.readFileSync(path.resolve(__dirname,"../../functions/index.js"),"utf8");
  expect(client).toContain("loot?.defeatedMonsterIds||[]");
  expect(client).toContain("guild-cards-v1");
  expect(functions).not.toContain("exports.persistGuildExpeditionResultV2");
  expect(functions).not.toContain("exports.startGuildExpeditionSession");
});
