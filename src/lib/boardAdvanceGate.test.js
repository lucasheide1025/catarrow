// 組隊大富翁的推進閘門：房主要等所有隊員「領取 + 按過收下」才能骰下一步。
// 這裡把 CatVillageBoardTeam 的判斷條件抽成純函式測，因為那個元件 import firebase 載不動，
// 而這段邏輯錯了會讓全隊互等卡死（斷線的人不會再寫任何 claim/ack）。

// 與 CatVillageBoardTeam 的 claimedStep / ackedStep / allPassed 同一套規則
function buildGate(room, curSeq) {
  const activeMems = Object.entries(room.members || {}).filter(([, m]) => m);
  const claimedStep = id => (room.settleClaims?.[id] || 0) >= curSeq || (room.eventClaims?.[id] || 0) >= curSeq;
  const ackedStep = id => (room.ackClaims?.[id] || 0) >= curSeq;
  const passedStep = id => claimedStep(id) && ackedStep(id);
  const hasPending = curSeq > 0 && ((room.pendingSettle?.seq === curSeq) || (room.pendingEvent?.seq === curSeq));
  const forced = (room.forcedSeq || 0) >= curSeq && curSeq > 0;
  const allPassed = !hasPending || forced || activeMems.every(([id]) => passedStep(id));
  const waitingAck = hasPending
    ? activeMems.filter(([id]) => claimedStep(id) && !ackedStep(id)).map(([id]) => id)
    : [];
  return { allPassed, waitingAck, hasPending };
}

const base = seq => ({
  seq,
  members: { host: { name: "房主" }, m1: { name: "隊員一" }, m2: { name: "隊員二" } },
  pendingSettle: { seq, tileType: "material" },
  settleClaims: {}, eventClaims: {}, ackClaims: {},
});

test("全員都領取了但沒人按收下 → 不可推進", () => {
  const room = base(3);
  room.settleClaims = { host: 3, m1: 3, m2: 3 };
  const gate = buildGate(room, 3);
  expect(gate.allPassed).toBe(false);
  expect(gate.waitingAck.sort()).toEqual(["host", "m1", "m2"]);
});

test("只差一個人沒按收下 → 仍不可推進，且指得出是誰", () => {
  const room = base(3);
  room.settleClaims = { host: 3, m1: 3, m2: 3 };
  room.ackClaims = { host: 3, m1: 3 };
  const gate = buildGate(room, 3);
  expect(gate.allPassed).toBe(false);
  expect(gate.waitingAck).toEqual(["m2"]);
});

test("全員領取且全員按過收下 → 可推進", () => {
  const room = base(3);
  room.settleClaims = { host: 3, m1: 3, m2: 3 };
  room.ackClaims = { host: 3, m1: 3, m2: 3 };
  expect(buildGate(room, 3).allPassed).toBe(true);
});

test("只按了收下但沒領取（理論上不該發生）也不算通過", () => {
  const room = base(3);
  room.ackClaims = { host: 3, m1: 3, m2: 3 };
  expect(buildGate(room, 3).allPassed).toBe(false);
});

test("上一步的 ack 不能算進這一步", () => {
  const room = base(4);
  room.settleClaims = { host: 4, m1: 4, m2: 4 };
  room.ackClaims = { host: 4, m1: 4, m2: 3 }; // m2 還停在上一步
  expect(buildGate(room, 4).allPassed).toBe(false);
  expect(buildGate(room, 4).waitingAck).toEqual(["m2"]);
});

test("房主按強制推進 → 不再等任何人（斷線解卡用）", () => {
  const room = base(3);
  room.settleClaims = { host: 3 };
  room.forcedSeq = 3;
  expect(buildGate(room, 3).allPassed).toBe(true);
});

test("沒有 pending 的步驟不需要任何 ack", () => {
  const room = base(3);
  room.pendingSettle = null;
  const gate = buildGate(room, 3);
  expect(gate.hasPending).toBe(false);
  expect(gate.allPassed).toBe(true);
  expect(gate.waitingAck).toEqual([]);
});

test("事件格用 eventClaims 也算領取過", () => {
  const room = base(3);
  room.pendingSettle = null;
  room.pendingEvent = { seq: 3 };
  room.eventClaims = { host: 3, m1: 3, m2: 3 };
  expect(buildGate(room, 3).allPassed).toBe(false); // 還沒 ack
  room.ackClaims = { host: 3, m1: 3, m2: 3 };
  expect(buildGate(room, 3).allPassed).toBe(true);
});

test("離開房間的成員（members 值為 falsy）不列入等待", () => {
  const room = base(3);
  room.members.m2 = null;
  room.settleClaims = { host: 3, m1: 3 };
  room.ackClaims = { host: 3, m1: 3 };
  expect(buildGate(room, 3).allPassed).toBe(true);
});
