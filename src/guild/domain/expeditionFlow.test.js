// src/guild/domain/expeditionFlow.test.js
import { createExpeditionState, processRound } from "./expeditionFlow";

const NO_LUCK = { rand: () => 0.99 }; // 不爆擊、不閃避（機率都很小）

function mon(id, over = {}) {
  return { instanceId: id, name: "m", icon: "👾", family: "ghost", tier: "common", maxHp: 10, hp: 10, atk: 20, def: 0, distance: 1, ...over };
}
const STATS = { hp: 100, atk: 50, agi: 0, def: 0, vit: 0, luk: 0 };

describe("expeditionFlow — 戰鬥核心狀態機", () => {
  test("清光一波 → 進下一波（該回合怪不推進）", () => {
    const exp = { totalWaves: 2, waves: [{ monsters: [mon("a")] }, { monsters: [mon("b", { distance: 3 })] }] };
    let s = createExpeditionState(exp, STATS, { food: 6, water: 6 });
    s = processRound(s, [{ targetInstanceId: "a", score: 11 }], NO_LUCK);
    expect(s.status).toBe("fighting");
    expect(s.waveIndex).toBe(1);
    expect(s.monsters[0].instanceId).toBe("b");
  });

  test("清光最後一波 → 勝利", () => {
    const exp = { totalWaves: 1, waves: [{ monsters: [mon("a")] }] };
    let s = createExpeditionState(exp, STATS, { food: 6, water: 6 });
    s = processRound(s, [{ targetInstanceId: "a", score: 11 }], NO_LUCK);
    expect(s.status).toBe("won");
  });

  test("怪距離歸零會攻擊玩家（DEF 減傷）", () => {
    const exp = { totalWaves: 1, waves: [{ monsters: [mon("z", { hp: 9999, maxHp: 9999, atk: 30, distance: 1 })] }] };
    let s = createExpeditionState(exp, { ...STATS, hp: 200, vit: 99 }, { food: 9, water: 9 });
    s = processRound(s, [], NO_LUCK); // 不射，怪 1→0 攻擊
    expect(s.hp).toBe(170); // 200 - 30
    expect(s.log.some(l => l.type === "monsterAttack")).toBe(true);
  });

  test("補給歸零 → 飢渴掉血", () => {
    const exp = { totalWaves: 1, waves: [{ monsters: [mon("z", { hp: 9999, maxHp: 9999, distance: 9 })] }] };
    let s = createExpeditionState(exp, { ...STATS, hp: 100, vit: 0 }, { food: 0.4, water: 5 });
    s = processRound(s, [], NO_LUCK);
    expect(s.supplies.food).toBe(0);
    expect(s.log.some(l => l.type === "starve")).toBe(true);
    expect(s.hp).toBe(90); // 100 - 10%(=10)
  });

  test("貓貓每回合自動攻擊怪物（助攻清場）", () => {
    const exp = { totalWaves: 1, waves: [{ monsters: [mon("z", { hp: 40, maxHp: 40, atk: 5, def: 0, distance: 9 })] }] };
    const cats = [{ id: "c1", name: "小黑", atk: 30, def: 0 }];
    let s = createExpeditionState(exp, { ...STATS, atk: 1, vit: 99 }, { food: 9, water: 9 }, cats);
    s = processRound(s, [], NO_LUCK); // 玩家不射，只靠貓
    expect(s.log.some(l => l.type === "catAttack")).toBe(true);
    expect(s.monsters[0]?.hp ?? 0).toBeLessThan(40); // 被貓打掉血
  });

  test("HP 歸零 → 失敗", () => {
    const exp = { totalWaves: 1, waves: [{ monsters: [mon("z", { hp: 9999, maxHp: 9999, atk: 999, distance: 1 })] }] };
    let s = createExpeditionState(exp, { ...STATS, hp: 50, vit: 99 }, { food: 9, water: 9 });
    s = processRound(s, [], NO_LUCK);
    expect(s.status).toBe("lost");
    expect(s.lostReason).toBe("陣亡");
  });
});
