import {
  buildDungeonExcavationAfterArrows, createIdempotentBattleRoundRecorder, createRoundArrowRecorder, dailyArrowStorageKey, getLocalTodayArrows,
  incrementLocalTodayArrows, taipeiDateKey,
} from "./arrowProgress";

function makeRecorder({ localOnly = false, identifyError = null } = {}) {
  const enqueueOfficial = jest.fn(() => ({ count: 3 }));
  const afterEnqueue = jest.fn(() => Promise.resolve());
  const identifyLocalOnly = jest.fn(() => identifyError
    ? Promise.reject(identifyError)
    : Promise.resolve(localOnly));
  return {
    record: createRoundArrowRecorder({ identifyLocalOnly, enqueueOfficial, afterEnqueue }),
    identifyLocalOnly, enqueueOfficial, afterEnqueue,
  };
}

beforeEach(() => localStorage.clear());

test.each(["coach-1", "member-1"])("%s gets an immediate local increment that survives refresh", memberId => {
  const { record } = makeRecorder();
  record(memberId, 3);
  expect(getLocalTodayArrows(memberId)).toBe(3);
  expect(localStorage.getItem(dailyArrowStorageKey(memberId))).toBe("3");
});

test.each(["guest-1", "kid-1"])("%s remains local-only", async memberId => {
  const { record, enqueueOfficial } = makeRecorder({ localOnly: true });
  await record(memberId, 3);
  expect(getLocalTodayArrows(memberId)).toBe(3);
  expect(enqueueOfficial).not.toHaveBeenCalled();
});

test("account lookup failure preserves the synchronous local increment", async () => {
  const { record, enqueueOfficial } = makeRecorder({ identifyError: new Error("offline") });
  const pending = record("member-1", 4);
  expect(getLocalTodayArrows("member-1")).toBe(4);
  await expect(pending).rejects.toThrow("offline");
  expect(getLocalTodayArrows("member-1")).toBe(4);
  expect(enqueueOfficial).not.toHaveBeenCalled();
});

test.each([["", 3], ["member-1", 0], ["member-1", -1], ["member-1", "bad"]])(
  "invalid input does not mutate local or cloud state",
  async (memberId, count) => {
    const { record, identifyLocalOnly, enqueueOfficial } = makeRecorder();
    await record(memberId, count);
    expect(localStorage.length).toBe(0);
    expect(identifyLocalOnly).not.toHaveBeenCalled();
    expect(enqueueOfficial).not.toHaveBeenCalled();
  }
);

test("cloud completion does not increment local mileage twice", async () => {
  const { record, enqueueOfficial, afterEnqueue } = makeRecorder();
  await record("member-1", 3);
  expect(enqueueOfficial).toHaveBeenCalledTimes(1);
  expect(enqueueOfficial).toHaveBeenCalledWith("member-1", 3);
  expect(afterEnqueue).toHaveBeenCalledTimes(1);
  expect(getLocalTodayArrows("member-1")).toBe(3);
});

test("records the submitted count exactly once before identity lookup settles", async () => {
  let resolveIdentity;
  const identifyLocalOnly = jest.fn(() => new Promise(resolve => { resolveIdentity = resolve; }));
  const enqueueOfficial = jest.fn(() => ({ count: 5 }));
  const afterEnqueue = jest.fn();
  const record = createRoundArrowRecorder({ identifyLocalOnly, enqueueOfficial, afterEnqueue });

  const pending = record("coach-1", 5);
  expect(getLocalTodayArrows("coach-1")).toBe(5);
  expect(enqueueOfficial).not.toHaveBeenCalled();
  await Promise.resolve();
  resolveIdentity(false);
  await pending;

  expect(enqueueOfficial).toHaveBeenCalledWith("coach-1", 5);
  expect(getLocalTodayArrows("coach-1")).toBe(5);
});

test("daily storage is isolated by member and Asia/Taipei calendar date", () => {
  const beforeTaipeiMidnight = new Date("2026-07-15T15:59:59.000Z");
  const afterTaipeiMidnight = new Date("2026-07-15T16:00:00.000Z");
  expect(taipeiDateKey(beforeTaipeiMidnight)).toBe("2026-07-15");
  expect(taipeiDateKey(afterTaipeiMidnight)).toBe("2026-07-16");
  expect(dailyArrowStorageKey("member-a", beforeTaipeiMidnight))
    .not.toBe(dailyArrowStorageKey("member-a", afterTaipeiMidnight));
  expect(dailyArrowStorageKey("member-a", beforeTaipeiMidnight))
    .not.toBe(dailyArrowStorageKey("member-b", beforeTaipeiMidnight));
});

test("local mileage remains in localStorage across repeated reads", () => {
  incrementLocalTodayArrows("member-1", 2);
  incrementLocalTodayArrows("member-1", 4);
  expect(getLocalTodayArrows("member-1")).toBe(6);
  expect(localStorage.getItem(dailyArrowStorageKey("member-1"))).toBe("6");
});

test("authoritative battle round receipt records exactly once across replay", async () => {
  const record=jest.fn(()=>Promise.resolve());
  const submit=createIdempotentBattleRoundRecorder({record});
  await submit({memberId:"m1",battleId:"battle/a",round:2,count:6,accountType:"official"});
  await submit({memberId:"m1",battleId:"battle/a",round:2,count:6,accountType:"official"});
  expect(record).toHaveBeenCalledTimes(1);
  expect(record).toHaveBeenCalledWith("m1",6,{accountType:"official"});
});

test("legacy dungeon excavation scalar or array is repaired into a safe map", () => {
  expect(buildDungeonExcavationAfterArrows(7, 6, "2026-08-22")).toEqual({
    lastActiveDate:"2026-08-22", progress:6, dailyArrowsUsed:6,
  });
  expect(buildDungeonExcavationAfterArrows([], 3, "2026-08-22")).toEqual({
    lastActiveDate:"2026-08-22", progress:3, dailyArrowsUsed:3,
  });
});

test("dungeon excavation arrow update preserves fields and daily/cat progress", () => {
  const next = buildDungeonExcavationAfterArrows({
    progress:40, dailyArrowsUsed:12, lastActiveDate:"2026-08-22",
    assignedCatId:"haji", catDigProgress:80, keepMe:"yes",
  }, 6, "2026-08-22");
  expect(next).toMatchObject({
    progress:46, dailyArrowsUsed:18, lastActiveDate:"2026-08-22",
    assignedCatId:"haji", catDigProgress:83, keepMe:"yes",
  });
});

test("invalid arrow count leaves excavation state untouched", () => {
  const current = { progress:22, keepMe:true };
  expect(buildDungeonExcavationAfterArrows(current, "bad", "2026-08-22")).toEqual(current);
});
