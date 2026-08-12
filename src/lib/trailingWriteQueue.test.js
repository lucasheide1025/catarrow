import { createTrailingWriteQueue } from "./trailingWriteQueue";

describe("createTrailingWriteQueue", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("同一 key 的連續變更只寫最後一份", async () => {
    const write = jest.fn().mockResolvedValue({ ok: true });
    const q = createTrailingWriteQueue(write, { delay: 5000 });
    q.queue("m1", { step: 1 });
    q.queue("m1", { step: 2 });
    expect(write).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("m1", { step: 2 });
  });

  test("flush 立即寫最後一份並取消 timer", async () => {
    const write = jest.fn().mockResolvedValue({ ok: true });
    const q = createTrailingWriteQueue(write, { delay: 5000 });
    q.queue("m1", { step: 3 });
    await q.flush("m1");
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("m1", { step: 3 });
    jest.advanceTimersByTime(5000);
    expect(write).toHaveBeenCalledTimes(1);
  });

  test("cancel 後不會把舊狀態延遲寫回", async () => {
    const write = jest.fn().mockResolvedValue({ ok: true });
    const q = createTrailingWriteQueue(write, { delay: 5000 });
    q.queue("m1", { step: 4 });
    expect(q.cancel("m1")).toBe(true);
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(write).not.toHaveBeenCalled();
  });

  test("不同 key 各自合併，不互相覆蓋", async () => {
    const write = jest.fn().mockResolvedValue({ ok: true });
    const q = createTrailingWriteQueue(write, { delay: 5000 });
    q.queue("m1", { step: 1 });
    q.queue("m2", { step: 8 });
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledWith("m1", { step: 1 });
    expect(write).toHaveBeenCalledWith("m2", { step: 8 });
  });
});
