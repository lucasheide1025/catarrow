import { tallyEventVotes, allActiveMembersVoted } from "./dungeonEventVotes";

const M = {
  host: { name: "房主", alive: true },
  a: { name: "A", alive: true },
  b: { name: "B", alive: true },
  down: { name: "倒下", alive: false },
};

describe("tallyEventVotes", () => {
  it("無人投票 → winner null", () => {
    const r = tallyEventVotes({ members: M, choices: {}, hostId: "host" });
    expect(r.winner).toBeNull();
    expect(r.tally).toEqual({});
  });

  it("最高票勝出（一般票）", () => {
    const r = tallyEventVotes({
      members: M, hostId: "host",
      choices: { host: 1, a: 1, b: 0 },
    });
    expect(r.winner).toBe(1);
  });

  it("倒下成員的票不計", () => {
    const r = tallyEventVotes({
      members: M, hostId: "host",
      choices: { host: 0, a: 0, down: 1 },
    });
    expect(r.winner).toBe(0);
  });

  it("平票且房主投了其中一邊 → 房主那票 ×2 打破僵局", () => {
    const r = tallyEventVotes({
      members: M, hostId: "host",
      choices: { host: 1, a: 0, b: 0 },
    });
    // 一般票 0:2、1:1 → 0 勝（無需加權，多數明確）
    expect(r.winner).toBe(0);
  });

  it("四票平手（2:2）時房主票加權取勝", () => {
    const members = { host: M.host, a: M.a, b: M.b, c: { name: "C", alive: true } };
    const r = tallyEventVotes({
      members, hostId: "host",
      choices: { host: 1, a: 1, b: 0, c: 0 },
    });
    // 一般票 0:2、1:2 → 平票 → 房主(1) 變 4 → 1 勝
    expect(r.winner).toBe(1);
  });

  it("多數明確時即使房主投少數也不翻盤", () => {
    const members = { host: M.host, a: M.a, b: M.b, c: { name: "C", alive: true } };
    const r = tallyEventVotes({
      members, hostId: "host",
      choices: { host: 1, a: 0, b: 0, c: 0 },
    });
    expect(r.winner).toBe(0);
  });

  it("單人房：唯一活人決定", () => {
    const r = tallyEventVotes({
      members: { host: M.host, down: M.down },
      hostId: "host",
      choices: { host: 0 },
    });
    expect(r.winner).toBe(0);
  });

  it("選項鍵是字串也可正常計票（陷阱房 big/small 同構）", () => {
    const r = tallyEventVotes({
      members: M, hostId: "host",
      choices: { host: "big", a: "small", b: "small" },
    });
    expect(r.winner).toBe("small");
  });

  it("回傳 tally 與 votes 供 UI 顯示票數", () => {
    const r = tallyEventVotes({
      members: M, hostId: "host",
      choices: { host: 0, a: 1, b: 1 },
    });
    expect(r.tally).toEqual({ 0: 1, 1: 2 });
    expect(r.votes).toEqual({ host: 0, a: 1, b: 1 });
  });
});

describe("allActiveMembersVoted", () => {
  it("全員投完 → true", () => {
    expect(allActiveMembersVoted({
      members: M,
      choices: { host: 0, a: 1, b: 0 },
    })).toBe(true);
  });

  it("有人沒投 → false", () => {
    expect(allActiveMembersVoted({
      members: M,
      choices: { host: 0, a: 1 },
    })).toBe(false);
  });

  it("倒下的人不用投", () => {
    expect(allActiveMembersVoted({
      members: M,
      choices: { host: 0, a: 1, b: 1 },
    })).toBe(true);
  });

  it("空隊伍 → false", () => {
    expect(allActiveMembersVoted({ members: {}, choices: {} })).toBe(false);
  });
});
