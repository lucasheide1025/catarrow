// 地下城權威端的異常流程（2026-08-02）
//
// ⚠️ 為什麼有這一支：processDungeonRound 會寫 Firestore，沒辦法直接單元測；
//    但它裡面那段異常邏輯是純函式組合的。這裡**照它的呼叫順序原樣跑一遍**，
//    確保組合起來是對的——不然只能靠開房間打一場才驗得到。
//
// ⚠️ 順序必須跟 dungeonDb.processDungeonRound 一致：
//    合併全隊施加 → 破防削防禦 → 打傷害 → 回合末 tick → 存回房間
import {
  mergeAllStatuses, monsterStatMods, rollInflictForArrows, tickMonsterStatuses,
} from "./monsterStatus";

const room = (over = {}) => ({
  monsterHP: 5000,
  monster: { hp: 5000, def: 200, atk: 100 },
  monsterStatuses: [],
  members: {
    a: { name: "甲", atk: 200, arrows: ["X", "10", "9"], inflict: { poison: { chancePct: 100, strength: 4, duration: 3 } } },
    b: { name: "乙", atk: 150, arrows: ["8", "7", "6"], inflict: { burn: { chancePct: 100, strength: 20, duration: 2 } } },
  },
  ...over,
});

/** 照 processDungeonRound 的順序跑一輪 */
function runRound(r, rand = () => 0) {
  const ids = Object.keys(r.members);
  let statuses = mergeAllStatuses(
    r.monsterStatuses || [],
    ids.map(id => rollInflictForArrows({ arrows: r.members[id].arrows, inflict: r.members[id].inflict, rand })),
  );
  const effDef = Math.max(0, r.monster.def * (1 - monsterStatMods(statuses).defDownPct / 100));
  let hp = r.monsterHP;
  const avgAtk = Math.round(ids.reduce((s, id) => s + r.members[id].atk, 0) / ids.length);
  const tick = tickMonsterStatuses({
    list: statuses, monsterHp: hp, monsterMaxHp: r.monster.hp, playerAtk: avgAtk,
  });
  hp = tick.monsterHp;
  statuses = tick.statuses;
  return { statuses, monsterHP: hp, effDef, dot: tick.totalDamage, logs: tick.logs };
}

describe("地下城：玩家施加的異常", () => {
  test("⚠️ 全隊的施加會合併到同一隻怪身上——這是組隊的合作價值", () => {
    // 兩位都要射得準，才看得到「各自帶的異常疊在同一隻怪身上」
    const out = runRound(room({
      members: {
        a: { name: "甲", atk: 200, arrows: ["X", "10"], inflict: { poison: { chancePct: 100, strength: 4, duration: 3 } } },
        b: { name: "乙", atk: 150, arrows: ["9", "10"], inflict: { burn: { chancePct: 100, strength: 20, duration: 2 } } },
      },
    }));
    const ids = out.statuses.map(s => s.id).concat(out.logs.map(l => l.id));
    expect(ids).toEqual(expect.arrayContaining(["poison", "burn"]));
  });

  test("⚠️ 射不準的成員不會施加（乙全部 8 環以下）", () => {
    const r = room({
      members: {
        b: { name: "乙", atk: 150, arrows: ["8", "7", "6"], inflict: { burn: { chancePct: 100, strength: 20, duration: 2 } } },
      },
    });
    const out = runRound(r);
    expect(out.statuses).toEqual([]);
    expect(out.dot).toBe(0);
  });

  test("🔨 破防會削低怪物防禦——全隊算傷害時都吃得到", () => {
    const r = room({
      members: {
        a: { name: "甲", atk: 200, arrows: ["X"], inflict: { defBreak: { chancePct: 100, strength: 25, duration: 2 } } },
      },
    });
    const out = runRound(r);
    expect(out.effDef).toBeCloseTo(200 * 0.75, 1);
  });

  test("回合末的持續傷害真的扣血，而且回合數會倒數", () => {
    const out = runRound(room());
    expect(out.monsterHP).toBeLessThan(5000);
    expect(out.dot).toBeGreaterThan(0);
    for (const s of out.statuses) expect(s.duration).toBeGreaterThanOrEqual(1);
  });

  test("⚠️ 中毒不會把怪打死——最後一刀要玩家自己補", () => {
    const r = room({
      monsterHP: 10,
      members: { a: { name: "甲", atk: 200, arrows: ["X"], inflict: { poison: { chancePct: 100, strength: 90, duration: 3 } } } },
    });
    expect(runRound(r).monsterHP).toBe(1);
  });

  test("下一輪帶著上一輪剩下的回合數繼續跑", () => {
    const first = runRound(room());
    const second = runRound({ ...room(), monsterStatuses: first.statuses, monsterHP: first.monsterHP });
    expect(second.monsterHP).toBeLessThan(first.monsterHP);
  });

  test("沒有人帶卡片時整段是 no-op，不會炸也不會扣血", () => {
    const r = room({
      members: { a: { name: "甲", atk: 200, arrows: ["X", "X", "X"], inflict: {} } },
    });
    const out = runRound(r);
    expect(out.statuses).toEqual([]);
    expect(out.monsterHP).toBe(5000);
    expect(out.effDef).toBe(200);
  });

  test("成員資料殘缺（沒有 arrows / inflict）也不會炸", () => {
    const r = room({ members: { a: { name: "甲", atk: 0 } } });
    expect(() => runRound(r)).not.toThrow();
  });
});
