import {
  planDungeonRoundAbility,
  tickDungeonStatuses,
  getAbilityTargetMode,
  pickSingleTarget,
  getStatusStatMods,
  PARTY_TARGET_SCALE,
} from "./dungeonAbilityRound";
import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import { toLegacyBattleMonster } from "./monsterExpansionAdapter";

const legacy = id => toLegacyBattleMonster(EXPANSION_MONSTERS.find(m => m.id === id));
const normalMonster = legacy("ghost_t1_normal_a");
const bossMonster = legacy("ghost_t1_boss");
const calcCounter = (atk, def) => Math.max(1, atk * 2 - def);

function member(id, overrides = {}) {
  return {
    id, name: id, role: "front", alive: true, hp: 500, maxHP: 500, def: 10,
    validSubmission: true, arrows: [8, 8, 8, 8, 8, 8], ...overrides,
  };
}

describe("技能目標推導", () => {
  test("大王＝全隊、一般怪/小王＝單體", () => {
    expect(getAbilityTargetMode(bossMonster)).toBe("party");
    expect(getAbilityTargetMode(normalMonster)).toBe("single");
    expect(getAbilityTargetMode(legacy("ghost_t1_mini_a"))).toBe("single");
  });
  test("單體優先點名前衛，全部倒地才落到後衛", () => {
    expect(pickSingleTarget([member("r", { role: "rear" }), member("f")]).id).toBe("f");
    expect(pickSingleTarget([member("r", { role: "rear" }), member("f", { hp: 0 })]).id).toBe("r");
  });
});

describe("planDungeonRoundAbility", () => {
  test("舊 60 隻怪（無 signatureSkillId）完全不出招", () => {
    const plan = planDungeonRoundAbility({
      battleId: "dungeon:r1", monster: { id: "ghost_1", name: "舊怪", atk: 20 },
      round: 2, participants: [member("a")], monsterAtk: 20, calcCounter,
    });
    expect(plan).toBeNull();
  });

  test("奇數回合沒有排程 → 不出招", () => {
    const plan = planDungeonRoundAbility({
      battleId: "dungeon:r1", monster: normalMonster, round: 3,
      participants: [member("a")], monsterAtk: 20, calcCounter,
    });
    expect(plan).toBeNull();
  });

  test("單體技能只打一位前衛，後衛不受傷", () => {
    const plan = planDungeonRoundAbility({
      battleId: "dungeon:r1", monster: normalMonster, round: 2,
      participants: [member("front1"), member("front2"), member("rear1", { role: "rear" })],
      monsterAtk: 30, calcCounter,
    });
    expect(plan.targetMode).toBe("single");
    expect(Object.keys(plan.damageByMember)).toEqual(["front1"]);
  });

  test("大王全隊技能命中所有有效成員，且每人約為單體版 50%", () => {
    const common = { battleId: "dungeon:r1", round: 2, monsterAtk: 60, calcCounter };
    const partyPlan = planDungeonRoundAbility({
      ...common, monster: bossMonster, participants: [member("a"), member("b")],
    });
    expect(partyPlan.targetMode).toBe("party");
    expect(Object.keys(partyPlan.damageByMember).sort()).toEqual(["a", "b"]);

    // 單體對照組用小王（同 T1）：tierMult 略高於大王，故比值約 0.5 而非精確 0.5，
    // 容許 15% 誤差仍足以抓出「忘記套 PARTY_TARGET_SCALE」（那會讓比值 ≈1.0）
    const singleEquivalent = planDungeonRoundAbility({
      ...common, monster: legacy("ghost_t1_mini_a"), participants: [member("a")],
    });
    const ratio = partyPlan.damageByMember.a / singleEquivalent.damageByMember.a;
    expect(ratio).toBeGreaterThan(PARTY_TARGET_SCALE * 0.85);
    expect(ratio).toBeLessThan(PARTY_TARGET_SCALE * 1.15);
  });

  test("倒地/未提交成員不進破解分母，也不會被點名", () => {
    const plan = planDungeonRoundAbility({
      battleId: "dungeon:r1", monster: bossMonster, round: 2,
      participants: [
        member("alive"),
        member("down", { hp: 0, alive: false }),
        member("idle", { validSubmission: false }),
      ],
      monsterAtk: 60, calcCounter,
    });
    expect(plan.targetIds).toEqual(["alive"]);
  });

  test("全隊高分 → 完全破解，低分 → 未破解且傷害更高", () => {
    const base = {
      battleId: "dungeon:r1", monster: bossMonster, round: 2, monsterAtk: 60, calcCounter,
    };
    const broken = planDungeonRoundAbility({ ...base, participants: [member("a", { arrows: [10, 10, 10, 10, 10, 10] })] });
    const missed = planDungeonRoundAbility({ ...base, participants: [member("a", { arrows: ["M", "M", "M", "M", "M", "M"] })] });
    expect(broken.breakLevel).toBe("full");
    expect(missed.breakLevel).toBe("none");
    expect(missed.damageByMember.a || 0).toBeGreaterThanOrEqual(broken.damageByMember.a || 0);
  });

  test("技能傷害不致死，最多留 1 HP", () => {
    const plan = planDungeonRoundAbility({
      battleId: "dungeon:r1", monster: bossMonster, round: 2,
      participants: [member("a", { hp: 5, arrows: ["M", "M", "M", "M", "M", "M"] })],
      monsterAtk: 9999, calcCounter,
    });
    expect(plan.damageByMember.a).toBe(4);
  });

  test("冪等 key 對同房同回合穩定，換回合就變", () => {
    const args = {
      battleId: "dungeon:room1", monster: bossMonster, participants: [member("a")],
      monsterAtk: 60, calcCounter,
    };
    const first = planDungeonRoundAbility({ ...args, round: 2 });
    const again = planDungeonRoundAbility({ ...args, round: 2 });
    const later = planDungeonRoundAbility({ ...args, round: 6 });
    expect(first.resolvedKey).toBe(again.resolvedKey);
    expect(later.resolvedKey).not.toBe(first.resolvedKey);
  });
});

describe("異常 tick", () => {
  test("毒扣血不致死、duration 遞減後移除", () => {
    const result = tickDungeonStatuses(
      { a: [{ id: "poison", stat: "hp", unit: "maxHpPct", strength: 10, duration: 1 }] },
      { a: 100 }, { a: 200 },
    );
    expect(result.poisonDamage.a).toBe(20);
    expect(result.memberHP.a).toBe(80);
    expect(result.statuses.a).toBeUndefined();
  });
  test("毒不會把人打死（最低留 1 HP）", () => {
    const result = tickDungeonStatuses(
      { a: [{ id: "poison", stat: "hp", unit: "maxHpPct", strength: 90, duration: 2 }] },
      { a: 10 }, { a: 500 },
    );
    expect(result.memberHP.a).toBe(1);
    expect(result.statuses.a[0].duration).toBe(1);
  });
  test("atkDown/defDown 轉成下一回合的減幅百分比", () => {
    const mods = getStatusStatMods([
      { id: "atkDown", strength: 15, duration: 1 },
      { id: "defDown", strength: 5, duration: 1 },
    ]);
    expect(mods).toEqual({ atkPct: 15, defPct: 5 });
  });
});
