// src/components/member/cards/cardSeen.test.js
import { seedSeenIfFirstRun, isUnseen, markSeen, countUnseen, getUnseenKeys, _resetSeen } from "./cardSeen";

const M = "member_A";
const M2 = "member_B";

beforeEach(() => {
  _resetSeen(M);
  _resetSeen(M2);
});

describe("cardSeen 紅點規則", () => {
  test("首次 seed：已持有卡片不製造紅點", () => {
    const owned = ["ghost_1", "ghost_2", "mountain_1"];
    const first = seedSeenIfFirstRun(M, owned);
    expect(first).toBe(true);
    expect(countUnseen(M, owned)).toBe(0);
    owned.forEach(id => expect(isUnseen(M, id)).toBe(false));
  });

  test("seed 只跑一次", () => {
    expect(seedSeenIfFirstRun(M, ["ghost_1"])).toBe(true);
    expect(seedSeenIfFirstRun(M, ["ghost_2"])).toBe(false); // 第二次不再 seed
    // ghost_2 未被 seed → 視為新卡
    expect(isUnseen(M, "ghost_2")).toBe(true);
  });

  test("後續新增卡片會產生紅點", () => {
    seedSeenIfFirstRun(M, ["ghost_1"]);
    // 新取得 ghost_5（不在首次 seed 集合）
    expect(isUnseen(M, "ghost_5")).toBe(true);
    expect(countUnseen(M, ["ghost_1", "ghost_5"])).toBe(1);
  });

  test("開啟卡片詳情後清除單一卡片紅點", () => {
    seedSeenIfFirstRun(M, []);
    // 兩張新卡
    expect(isUnseen(M, "ghost_5")).toBe(true);
    expect(isUnseen(M, "ghost_6")).toBe(true);
    markSeen(M, "ghost_5"); // 只點開 ghost_5
    expect(isUnseen(M, "ghost_5")).toBe(false);
    expect(isUnseen(M, "ghost_6")).toBe(true); // 另一張仍未讀
    expect(getUnseenKeys(M, ["ghost_5", "ghost_6"])).toEqual(["ghost_6"]);
  });

  test("未讀計數正確", () => {
    seedSeenIfFirstRun(M, ["ghost_1", "ghost_2"]);
    const owned = ["ghost_1", "ghost_2", "ghost_3", "ghost_4"]; // 3/4 為新取得
    expect(countUnseen(M, owned)).toBe(2);
    markSeen(M, "ghost_3");
    expect(countUnseen(M, owned)).toBe(1);
  });

  test("不同帳號互不污染", () => {
    seedSeenIfFirstRun(M, ["ghost_1"]);
    // M2 尚未 seed → 對 M2 而言 ghost_1 是未讀（獨立 key）
    expect(isUnseen(M2, "ghost_1")).toBe(true);
    expect(isUnseen(M, "ghost_1")).toBe(false);
  });
});
