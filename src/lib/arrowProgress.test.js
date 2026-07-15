import {
  createRoundArrowRecorder, dailyArrowStorageKey, getLocalTodayArrows,
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
