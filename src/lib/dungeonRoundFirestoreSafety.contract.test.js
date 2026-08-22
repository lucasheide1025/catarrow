import fs from "fs";
import path from "path";
import { stripUndefinedDeep } from "./firestoreSafeWrite";

describe("dungeon round Firestore safety", () => {
  test("deep skill payload removes nested undefined values", () => {
    const payload = {
      round: 2,
      ability: {
        name: "測試技能",
        statusResultsByMember: {
          a: [{ statusId: "pressure", rawStatus: { id: "pressure", strength: undefined }, finalStatus: undefined }],
        },
      },
    };
    expect(stripUndefinedDeep(payload)).toEqual({
      round: 2,
      ability: {
        name: "測試技能",
        statusResultsByMember: {
          a: [{ statusId: "pressure", rawStatus: { id: "pressure" } }],
        },
      },
    });
  });

  test("processDungeonRound sanitizes logEntry before arrayUnion", () => {
    const source = fs.readFileSync(path.join(__dirname, "dungeonDb.js"), "utf8");
    expect(source).toContain("const safeLogEntry = stripUndefinedDeep(logEntry)");
    expect(source).toContain("log: arrayUnion(safeLogEntry)");
  });

  test("same round processing failure does not clear guard and restart countdown", () => {
    const source = fs.readFileSync(path.join(__dirname, "../battle/useFirestoreRound.js"), "utf8");
    expect(source).not.toContain("else { guardRef.current = 0; retryCountRef.current++; }");
    expect(source).not.toContain("if (!res?.ok) guardRef.current = 0");
    expect(source).not.toContain("catch(() => { guardRef.current = 0; })");
    expect(source).toContain("retryTimerRef.current = setTimeout(doProcess, 750)");
    expect(source).toContain("Keep guardRef on the same round");
  });

  test("only the Firestore host may own countdown and advance a round", () => {
    const source = fs.readFileSync(path.join(__dirname, "../battle/useFirestoreRound.js"), "utf8");
    expect(source).not.toContain("Non-host clients also render the shared countdown");
    expect(source).not.toContain('room.hostId === myId) return');
    expect(source).toContain('if (!room || room.hostId !== myId || room.status !== "active") return');
    expect(source).toContain('authorityRoom.hostId !== myId');
  });

  test("processDungeonRound atomically claims the expected round", () => {
    const source = fs.readFileSync(path.join(__dirname, "dungeonDb.js"), "utf8");
    expect(source).toContain("const claim = await runTransaction");
    expect(source).toContain('reason:"already-processing"');
    expect(source).toContain('reason:"stale-round"');
    expect(source).toContain("if (!claim?.ok) return claim");
    expect(source).toContain("if (claimedRound)");
  });
});
