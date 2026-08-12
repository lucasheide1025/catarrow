import { completeClassEndRushFlow, settleClassEndRushAward } from "./classEndRush";

test("class-end persistence succeeds before any rush settlement starts", async () => {
  const calls = [];
  await expect(completeClassEndRushFlow({
    persistClassEnd:async () => { calls.push("submit"); },
    settleRush:async () => { calls.push("rush"); return { pending:false }; },
  })).resolves.toEqual({ pending:false });
  expect(calls).toEqual(["submit", "rush"]);

  calls.length = 0;
  await expect(completeClassEndRushFlow({
    persistClassEnd:async () => { calls.push("submit"); throw new Error("submit failed"); },
    settleRush:async () => { calls.push("rush"); },
  })).rejects.toThrow("submit failed");
  expect(calls).toEqual(["submit"]);
});

test("class-end rush waits for a complete arrow flush before claiming", async () => {
  const calls = [];
  const result = await settleClassEndRushAward("member-1", {
    flushArrows:async () => { calls.push("flush"); return { synced:1, pending:2, lastError:"offline" }; },
    claimRush:async () => { calls.push("claim"); return { awardedSeconds:60 }; },
  });
  expect(result).toMatchObject({ pending:true, reason:"arrow_flush_pending", pendingArrows:2 });
  expect(calls).toEqual(["flush"]);
});

test("class-end rush claims only after flush success and can be retried after a claim failure", async () => {
  const calls = [];
  let attempt = 0;
  const deps = {
    flushArrows:async () => { calls.push("flush"); return { synced:1, pending:0 }; },
    claimRush:async () => {
      calls.push("claim");
      attempt += 1;
      if (attempt === 1) throw new Error("offline");
      return { awardedSeconds:60, isReplay:false };
    },
  };
  await expect(settleClassEndRushAward("member-1", deps)).rejects.toThrow("offline");
  await expect(settleClassEndRushAward("member-1", deps)).resolves.toMatchObject({
    pending:false, awardedSeconds:60, isReplay:false,
  });
  expect(calls).toEqual(["flush", "claim", "flush", "claim"]);
});
