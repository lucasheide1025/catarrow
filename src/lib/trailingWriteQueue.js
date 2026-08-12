// 小型 keyed trailing-write queue。
// 用於「本機立即保存、雲端只需最後狀態」的資料；不要拿來節流多人即時共享狀態。
export function createTrailingWriteQueue(write, { delay = 5000 } = {}) {
  const pending = new Map();

  const cancel = key => {
    const entry = pending.get(key);
    if (!entry) return false;
    if (entry.timer) clearTimeout(entry.timer);
    pending.delete(key);
    return true;
  };

  const flush = async key => {
    const entry = pending.get(key);
    if (!entry) return { ok: true, skipped: true };
    if (entry.timer) clearTimeout(entry.timer);
    pending.delete(key);
    return write(key, entry.value);
  };

  const queue = (key, value) => {
    if (!key) return false;
    cancel(key);
    const entry = { value, timer: null };
    entry.timer = setTimeout(() => {
      flush(key).catch(() => {});
    }, Math.max(0, Number(delay) || 0));
    pending.set(key, entry);
    return true;
  };

  return {
    queue,
    flush,
    cancel,
    hasPending: key => pending.has(key),
  };
}
