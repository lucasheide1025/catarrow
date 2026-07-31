import { getTargetFaceFormat } from "../../lib/targetFace";
import {
  MATCH_ARROWS_PER_END,
  arrowRecord,
  biasLabel,
  shotStats,
  MATCH_FACE,
  MATCH_MAX_END_SCORE,
  arrowPoints,
  canSubmitEnd,
  endAcceptance,
  endResult,
  matchBossRatio,
  matchLeaderboard,
  matchTotals,
  myStanding,
} from "./matchScore";

const a = (label, score) => ({ label, score });

describe("一支箭的環值", () => {
  test("⚠️ 用靶紙印的環數，不是遊戲的標準化分數——要對得上紙本記分表", () => {
    expect(arrowPoints(a("7", 7))).toBe(7);
    expect(arrowPoints(a("10", 10))).toBe(10);
  });

  test("X 算 10 分", () => {
    expect(arrowPoints(a("X", 10))).toBe(10);
    expect(arrowPoints({ label: "X" })).toBe(10);
  });

  test("M（脫靶）是 0 分", () => {
    expect(arrowPoints(a("M", 0))).toBe(0);
    expect(arrowPoints(a("M", 8))).toBe(0);      // 標成 M 就是 0，不看 score
  });

  test("⚠️ 只有 label 也要讀得懂——戰鬥 log 只存 label，不解析會全部記成 0 分", () => {
    expect(arrowPoints({ label: "9" })).toBe(9);
    expect(arrowPoints({ label: "10" })).toBe(10);
    expect(arrowPoints({ label: "M" })).toBe(0);
  });

  test("壞資料算 0，不會變成 NaN 汙染全場總分", () => {
    expect(arrowPoints(null)).toBe(0);
    expect(arrowPoints({ score: "abc" })).toBe(0);
    expect(arrowPoints({ score: -5 })).toBe(0);
  });
});

describe("一回合三箭", () => {
  test("加總、X 數、10 數都算得出來", () => {
    const r = endResult([a("X", 10), a("10", 10), a("8", 8)]);
    expect(r.score).toBe(28);
    expect(r.xCount).toBe(1);
    expect(r.tens).toBe(2);
    expect(r.arrows).toBe(3);
  });

  test("脫靶記得出來（記分表要看得到 M）", () => {
    const r = endResult([a("M", 0), a("9", 9), a("7", 7)]);
    expect(r.score).toBe(16);
    expect(r.misses).toBe(1);
    expect(r.labels).toEqual(["M", "9", "7"]);
  });

  test("傷害只是分數放大——不進排名", () => {
    expect(endResult([a("10", 10)]).damage).toBeGreaterThan(0);
  });

  test("三箭射滿才送得出去", () => {
    expect(canSubmitEnd([a("9", 9), a("9", 9)])).toBe(false);
    expect(canSubmitEnd(Array.from({ length: MATCH_ARROWS_PER_END }, () => a("9", 9)))).toBe(true);
  });

  test("空回合不會炸", () => {
    expect(endResult().score).toBe(0);
    expect(endResult(null).labels).toEqual([]);
  });
});

describe("排行榜", () => {
  const players = {
    a: { name: "阿甲", score: 90, xCount: 2, tens: 3, arrows: 12, ends: 4, joinedAt: 1 },
    b: { name: "阿乙", score: 90, xCount: 4, tens: 5, arrows: 12, ends: 4, joinedAt: 2 },
    c: { name: "阿丙", score: 120, xCount: 0, tens: 1, arrows: 15, ends: 5, joinedAt: 3 },
  };

  test("分數高的排前面", () => {
    expect(matchLeaderboard(players).map(p => p.name)).toEqual(["阿丙", "阿乙", "阿甲"]);
  });

  test("⚠️ 同分比 X 數——當天有人同分卻名次亂跳是最容易被抗議的地方", () => {
    const board = matchLeaderboard(players);
    expect(board[1].name).toBe("阿乙");      // 同 90 分但 X 比較多
    expect(board[1].rank).toBe(2);
    expect(board[2].rank).toBe(3);
  });

  test("X 也同就比 10 數", () => {
    const board = matchLeaderboard({
      a: { name: "甲", score: 90, xCount: 2, tens: 3, joinedAt: 1 },
      b: { name: "乙", score: 90, xCount: 2, tens: 9, joinedAt: 2 },
    });
    expect(board[0].name).toBe("乙");
  });

  test("全部同分就先到的排前面（不能每次重繪都跳順序）", () => {
    const board = matchLeaderboard({
      late: { name: "後到", score: 50, xCount: 1, tens: 1, joinedAt: 999 },
      early: { name: "先到", score: 50, xCount: 1, tens: 1, joinedAt: 1 },
    });
    expect(board.map(p => p.name)).toEqual(["先到", "後到"]);
  });

  test("離場的人還在榜上——分數不會因為離場消失", () => {
    const board = matchLeaderboard({ a: { name: "甲", score: 60, active: false } });
    expect(board).toHaveLength(1);
    expect(board[0].active).toBe(false);
  });

  test("平均環數算得出來（0 箭不會除以零）", () => {
    const board = matchLeaderboard({
      a: { name: "甲", score: 90, arrows: 12 },
      b: { name: "乙", score: 0, arrows: 0 },
    });
    expect(board.find(p => p.name === "甲").average).toBe(7.5);
    expect(board.find(p => p.name === "乙").average).toBe(0);
  });

  test("找得到我自己在第幾名", () => {
    const board = matchLeaderboard(players);
    expect(myStanding(board, "a").rank).toBe(3);
    expect(myStanding(board, "nobody")).toBeNull();
    expect(myStanding(board, null)).toBeNull();
  });

  test("沒有人也不會炸", () => {
    expect(matchLeaderboard()).toEqual([]);
    expect(matchLeaderboard({ a: null })).toEqual([]);
  });
});

describe("全場合計與王的血條", () => {
  test("加總所有人的分數與箭數", () => {
    const t = matchTotals({
      a: { name: "甲", score: 90, arrows: 12, damage: 1000, active: true },
      b: { name: "乙", score: 60, arrows: 9, damage: 700, active: false },
    });
    expect(t.players).toBe(2);
    expect(t.shooting).toBe(1);
    expect(t.score).toBe(150);
    expect(t.arrows).toBe(21);
  });

  test("⚠️ 王的血打光也不會擋人繼續射——比賽是射到玩家自己離場為止", () => {
    expect(matchBossRatio(0, 1000)).toBe(1);
    expect(matchBossRatio(500, 1000)).toBe(0.5);
    expect(matchBossRatio(999999, 1000)).toBe(0);      // 夾在 0，不會變負的
  });

  test("血上限壞掉也不會除以零", () => {
    expect(matchBossRatio(100, 0)).toBe(0);
    expect(matchBossRatio(null, null)).toBe(1);
  });
});

describe("⚠️ 重送不能重複計分（射箭場網路差，玩家一定會按第二次）", () => {
  test("第一次送出照收", () => {
    expect(endAcceptance(0, 0)).toEqual({ accept: true, duplicate: false });
    expect(endAcceptance(5, 5)).toEqual({ accept: true, duplicate: false });
  });

  test("重送已經記過的回合＝當作成功但不加分", () => {
    const r = endAcceptance(5, 4);
    expect(r.accept).toBe(false);
    expect(r.duplicate).toBe(true);
  });

  test("序號跳號就拒收（本機記錄壞了，不能亂加分）", () => {
    const r = endAcceptance(5, 9);
    expect(r.accept).toBe(false);
    expect(r.duplicate).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  test("壞值當 0 處理", () => {
    expect(endAcceptance(undefined, undefined).accept).toBe(true);
    expect(endAcceptance(null, 0).accept).toBe(true);
  });
});

describe("⚠️ 靶紙固定 1~10 分全靶（作者 2026-08-01）", () => {
  test("就是 full_110，不給玩家選", () => {
    expect(MATCH_FACE).toBe("full_110");
  });

  test("環值範圍真的是 1~10——半靶只印 6~10，混榜就不能比了", () => {
    const fmt = getTargetFaceFormat(MATCH_FACE);
    expect(fmt.minScore).toBe(1);
    expect(fmt.maxScore).toBe(10);
  });

  test("一回合滿分 30", () => {
    expect(MATCH_MAX_END_SCORE).toBe(30);
    expect(endResult([a("X", 10), a("10", 10), a("10", 10)]).score).toBe(MATCH_MAX_END_SCORE);
  });

  test("全靶最低有效環是 1 分（半靶的 6 分底線不適用）", () => {
    expect(arrowPoints(a("1", 1))).toBe(1);
  });
});

describe("⚠️ 每一箭的落點都要留（作者 2026-08-01）", () => {
  test("存得下座標、環值、標籤、第幾回合", () => {
    const r = arrowRecord({ nx: 0.123456, ny: -0.5, label: "9", score: 9 }, { at: 111, end: 2 });
    expect(r).toEqual({ p: 9, l: "9", x: 0.123, y: -0.5, e: 2, t: 111 });
  });

  test("座標壞掉不會存進 NaN（Firestore 會整筆拒絕）", () => {
    const r = arrowRecord({ label: "M" });
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(Number.isFinite(r.x)).toBe(true);
  });

  test("刻意用短欄位名——這份會累積到幾千筆", () => {
    expect(Object.keys(arrowRecord({})).sort()).toEqual(["e", "l", "p", "t", "x", "y"]);
  });
});

describe("落點統計：教練要看的是系統性偏差", () => {
  const shots = [
    { p: 9, l: "9", x: 0.3, y: 0.3 },
    { p: 8, l: "8", x: 0.35, y: 0.25 },
    { p: 10, l: "X", x: 0.28, y: 0.32 },
  ];

  test("平均落點與離散度算得出來", () => {
    const st = shotStats(shots);
    expect(st.shots).toBe(3);
    expect(st.total).toBe(27);
    expect(st.centerX).toBeCloseTo(0.31, 2);
    expect(st.spread).toBeGreaterThan(0);
  });

  test("⚠️ 離散度是離**自己的平均落點**，不是離靶心——那才是穩定度", () => {
    const tight = shotStats([
      { p: 8, l: "8", x: 0.5, y: 0.5 }, { p: 8, l: "8", x: 0.5, y: 0.5 },
    ]);
    const loose = shotStats([
      { p: 10, l: "X", x: 0, y: 0 }, { p: 6, l: "6", x: 0.6, y: 0.6 },
    ]);
    expect(tight.spread).toBe(0);                    // 分數低但超穩
    expect(loose.spread).toBeGreaterThan(tight.spread);
  });

  test("脫靶不算進落點平均（M 沒有位置可言）", () => {
    const st = shotStats([...shots, { p: 0, l: "M", x: 0, y: 0 }]);
    expect(st.misses).toBe(1);
    expect(st.onTarget).toBe(3);
    expect(st.centerX).toBeCloseTo(0.31, 2);
  });

  test("翻成一句教練當場看得懂的話", () => {
    expect(biasLabel(0.3, 0.3)).toBe("偏下偏右");
    expect(biasLabel(-0.3, -0.3)).toBe("偏上偏左");
    expect(biasLabel(0.01, 0.01)).toBe("落點居中");
    expect(biasLabel(0, -0.4)).toBe("偏上");
  });

  test("沒有箭也不會除以零", () => {
    const st = shotStats([]);
    expect(st.average).toBe(0);
    expect(st.spread).toBe(0);
    expect(st.bias).toBe("落點居中");
  });
});
