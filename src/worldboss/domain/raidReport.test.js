import { raidRoundResults, raidTotalDamage, roundResultFromLog } from "./raidReport";
import { createRaidState, resolveRaidRound } from "./raidFlow";
import { WEAK_SPOT_MAP } from "./weakPoints";

const log = [
  { type: "roundStart" },
  { type: "arrow", memberId: "me", label: "10", damage: 100 },
  { type: "gauge" },
  { type: "arrow", memberId: "mate", label: "9", damage: 400 },
  { type: "catAssist", memberId: "me", damage: 30 },
  { type: "catAssist", memberId: "mate", damage: 50 },
  { type: "roundEnd", damage: 580 },
];

describe("回合 log → attackWorldBoss 的 roundResults", () => {
  test("⚠️ 組隊時只算自己的——直接加總會把隊友的傷害記到自己頭上", () => {
    expect(roundResultFromLog(log, "me").dmg).toBe(130);
    expect(roundResultFromLog(log, "mate").dmg).toBe(450);
  });

  test("貓貓陪練的傷害算自己的", () => {
    expect(roundResultFromLog([{ type: "catAssist", memberId: "me", damage: 77 }], "me").dmg).toBe(77);
  });

  test("沒指定人就全算（單人路徑）", () => {
    expect(roundResultFromLog(log).dmg).toBe(580);
  });

  test("箭的清單只留自己的", () => {
    expect(roundResultFromLog(log, "me").arrows).toEqual([{ label: "10", score: 100 }]);
  });

  test("空 log 不會炸", () => {
    expect(roundResultFromLog(null, "me")).toEqual({ dmg: 0, arrows: [] });
  });
});

describe("整場結果", () => {
  test("⚠️ 一箭都沒打也要回一筆——空陣列等於這次出擊完全沒紀錄，次數白扣", () => {
    const out = raidRoundResults([], { totals: { damage: 250 } }, "me");
    expect(out).toHaveLength(1);
    expect(out[0].dmg).toBe(250);
  });

  test("補的那一筆優先用自己的傷害，不是全隊的", () => {
    const final = { totals: { damage: 9999 }, members: [{ memberId: "me", damage: 120 }] };
    expect(raidRoundResults([], final, "me")[0].dmg).toBe(120);
  });

  test("有回合就照原樣送", () => {
    const rounds = [{ dmg: 10, arrows: [] }, { dmg: 20, arrows: [] }];
    expect(raidRoundResults(rounds, null, "me")).toEqual(rounds);
    expect(raidTotalDamage(rounds)).toBe(30);
  });
});

describe("接上真的戰鬥流程", () => {
  test("⚠️ 送出的傷害要跟 state 記的一致——對不上就是玩家白打", () => {
    const st = {
      ...createRaidState({
        boss: { key: "t", name: "測試王", hp: 9_000_000, maxHp: 9_000_000, atk: 1, def: 0 },
        members: [
          { memberId: "me", name: "我", stats: { atk: 150, def: 60, hp: 9999 } },
          { memberId: "mate", name: "隊友", stats: { atk: 150, def: 60, hp: 9999 } },
        ],
      }),
      spots: [{ ...WEAK_SPOT_MAP.green, cx: 0, cy: 0, key: "k" }],
    };
    const arrows = ["me", "mate"].flatMap(id =>
      Array.from({ length: 3 }, () => ({ memberId: id, nx: 0, ny: 0, score: 10 })));
    const { state, log: roundLog } = resolveRaidRound({ state: st, arrows });

    const mine = roundResultFromLog(roundLog, "me");
    expect(mine.dmg).toBe(state.members.find(m => m.memberId === "me").damage);
    expect(mine.dmg).toBeGreaterThan(0);
    expect(mine.dmg).toBeLessThan(state.totals.damage);   // 沒有把隊友的算進來
  });
});
