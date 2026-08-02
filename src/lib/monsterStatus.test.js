import {
  CONTROL_PROC_CAP,
  FAMILY_STATUS,
  MONSTER_STATUSES,
  MONSTER_STATUS_LIST,
  PROC_CAP,
  PROC_MIN_SCORE,
  describeMonsterStatuses,
  isProcEligible,
  mergeMonsterStatus,
  monsterBlocked,
  monsterStatMods,
  procCapFor,
  rollInflict,
  rollInflictForArrows,
  mergeAllStatuses,
  tickMonsterStatuses,
} from "./monsterStatus";

describe("狀態目錄", () => {
  test("每一種都有完整顯示資料與上限回合", () => {
    for (const s of MONSTER_STATUS_LIST) {
      expect(s.name && s.icon && s.color && s.kind).toBeTruthy();
      expect(s.maxDuration).toBeGreaterThanOrEqual(1);
    }
  });

  test("⚠️ 控場類持續最短——冰凍/麻痺只有 1 回合", () => {
    expect(MONSTER_STATUSES.freeze.maxDuration).toBe(1);
    expect(MONSTER_STATUSES.paralyze.maxDuration).toBe(1);
  });

  test("六族各有招牌狀態，而且都是真的存在的狀態", () => {
    expect(Object.keys(FAMILY_STATUS).length).toBeGreaterThanOrEqual(6);
    for (const id of Object.values(FAMILY_STATUS)) expect(MONSTER_STATUSES[id]).toBeTruthy();
  });
});

describe("⚠️ 觸發綁在射得準上（這是射箭遊戲）", () => {
  test(`${PROC_MIN_SCORE} 環以上與 X 才判定`, () => {
    expect(isProcEligible("X")).toBe(true);
    expect(isProcEligible(10)).toBe(true);
    expect(isProcEligible(PROC_MIN_SCORE)).toBe(true);
    expect(isProcEligible(PROC_MIN_SCORE - 1)).toBe(false);
    expect(isProcEligible("M")).toBe(false);
  });

  test("射不準就算機率 100% 也不會觸發", () => {
    const out = rollInflict({ score: 5, inflict: { poison: { chancePct: 100, strength: 5 } }, rand: () => 0 });
    expect(out).toEqual([]);
  });

  test("射準了才吃機率", () => {
    const cfg = { poison: { chancePct: 50, strength: 5 } };
    expect(rollInflict({ score: 10, inflict: cfg, rand: () => 0.1 })).toHaveLength(1);
    expect(rollInflict({ score: 10, inflict: cfg, rand: () => 0.9 })).toHaveLength(0);
  });

  test("⚠️ 控場類的觸發率上限比較低——它最強", () => {
    expect(procCapFor("freeze")).toBe(CONTROL_PROC_CAP);
    expect(procCapFor("poison")).toBe(PROC_CAP);
    expect(CONTROL_PROC_CAP).toBeLessThan(PROC_CAP);
    // 就算卡片給 99%，冰凍也被壓到上限
    const out = rollInflict({
      score: "X", inflict: { freeze: { chancePct: 99, strength: 1 } },
      rand: () => (CONTROL_PROC_CAP + 1) / 100,
    });
    expect(out).toHaveLength(0);
  });

  test("持續回合不會超過該狀態的上限", () => {
    const out = rollInflict({
      score: "X", inflict: { freeze: { chancePct: 100, strength: 1, duration: 99 } }, rand: () => 0,
    });
    expect(out[0].duration).toBe(1);
  });

  test("沒設定就不會憑空生出狀態", () => {
    expect(rollInflict({ score: "X", inflict: {}, rand: () => 0 })).toEqual([]);
    expect(rollInflict({ score: "X", inflict: { 不存在: { chancePct: 100 } }, rand: () => 0 })).toEqual([]);
  });
});

describe("⚠️ 同種狀態不疊加——疊加會把怪物鎖死", () => {
  test("重複命中是刷新回合、取較強的強度", () => {
    let list = mergeMonsterStatus([], { id: "poison", strength: 3, duration: 2 });
    list = mergeMonsterStatus(list, { id: "poison", strength: 5, duration: 1 });
    expect(list).toHaveLength(1);
    expect(list[0].strength).toBe(5);
    expect(list[0].duration).toBe(2);
  });

  test("不同狀態可以並存", () => {
    let list = mergeMonsterStatus([], { id: "poison", strength: 3, duration: 2 });
    list = mergeMonsterStatus(list, { id: "burn", strength: 10, duration: 2 });
    expect(list).toHaveLength(2);
  });

  test("流血是唯一會累積層數的，而且有上限", () => {
    let list = [];
    for (let i = 0; i < 10; i += 1) {
      list = mergeMonsterStatus(list, { id: "bleed", strength: 5, duration: 3 });
    }
    expect(list[0].stacks).toBeLessThanOrEqual(5);
  });
});

describe("怪物被壓低的數值", () => {
  test("破防降防禦、虛弱降攻擊", () => {
    const mods = monsterStatMods([
      { id: "defBreak", strength: 20 }, { id: "weaken", strength: 15 },
    ]);
    expect(mods.defDownPct).toBe(20);
    expect(mods.atkDownPct).toBe(15);
  });

  test("有上限，不會把怪物數值歸零", () => {
    expect(monsterStatMods([{ id: "defBreak", strength: 999 }]).defDownPct).toBeLessThanOrEqual(60);
  });

  test("沒狀態就是 0", () => {
    expect(monsterStatMods([]).defDownPct).toBe(0);
  });
});

describe("控場", () => {
  test("冰凍必定擋技能", () => {
    expect(monsterBlocked([{ id: "freeze", duration: 1 }]).skillBlocked).toBe(true);
  });

  test("⚠️ 麻痺是機率擋反擊——必定擋等於怪物完全不會動", () => {
    const list = [{ id: "paralyze", strength: 50, duration: 1 }];
    expect(monsterBlocked(list, () => 0.1).counterBlocked).toBe(true);
    expect(monsterBlocked(list, () => 0.9).counterBlocked).toBe(false);
  });

  test("沒有狀態就什麼都不擋", () => {
    const r = monsterBlocked([]);
    expect(r.skillBlocked).toBe(false);
    expect(r.counterBlocked).toBe(false);
  });
});

describe("回合末結算", () => {
  test("中毒按最大 HP 百分比", () => {
    const r = tickMonsterStatuses({
      list: [{ id: "poison", strength: 5, duration: 2 }],
      monsterHp: 1000, monsterMaxHp: 1000,
    });
    expect(r.monsterHp).toBe(950);
    expect(r.statuses[0].duration).toBe(1);
  });

  test("⚠️ 中毒不致死——最後一刀要玩家自己補", () => {
    const r = tickMonsterStatuses({
      list: [{ id: "poison", strength: 99, duration: 2 }],
      monsterHp: 50, monsterMaxHp: 1000,
    });
    expect(r.monsterHp).toBe(1);
  });

  test("灼燒依玩家攻擊力，而且**可以**造成最後一擊", () => {
    const r = tickMonsterStatuses({
      list: [{ id: "burn", strength: 50, duration: 1 }],
      monsterHp: 10, monsterMaxHp: 1000, playerAtk: 100,
    });
    expect(r.monsterHp).toBe(0);
  });

  test("流血的層數會放大傷害", () => {
    const one = tickMonsterStatuses({
      list: [{ id: "bleed", strength: 10, duration: 2, stacks: 1 }],
      monsterHp: 1000, monsterMaxHp: 1000, playerAtk: 100,
    });
    const three = tickMonsterStatuses({
      list: [{ id: "bleed", strength: 10, duration: 2, stacks: 3 }],
      monsterHp: 1000, monsterMaxHp: 1000, playerAtk: 100,
    });
    expect(three.totalDamage).toBeGreaterThan(one.totalDamage);
  });

  test("回合數歸零就消失，而且會記一筆", () => {
    const r = tickMonsterStatuses({
      list: [{ id: "freeze", strength: 1, duration: 1 }],
      monsterHp: 100, monsterMaxHp: 100,
    });
    expect(r.statuses).toHaveLength(0);
    expect(r.logs.some(l => l.expired)).toBe(true);
  });

  test("壓數值的狀態不會造成傷害", () => {
    const r = tickMonsterStatuses({
      list: [{ id: "defBreak", strength: 20, duration: 2 }],
      monsterHp: 100, monsterMaxHp: 100,
    });
    expect(r.totalDamage).toBe(0);
    expect(r.monsterHp).toBe(100);
  });

  test("空清單不會炸", () => {
    const r = tickMonsterStatuses({ monsterHp: 100, monsterMaxHp: 100 });
    expect(r.monsterHp).toBe(100);
    expect(r.statuses).toEqual([]);
  });
});

describe("UI 說明", () => {
  test("看得到狀態、層數與剩餘回合", () => {
    const rows = describeMonsterStatuses([
      { id: "bleed", duration: 2, stacks: 3 }, { id: "freeze", duration: 1 },
    ]);
    expect(rows[0].text).toContain("×3");
    expect(rows[0].text).toContain("2 回合");
    expect(rows[1].icon).toBe("❄️");
  });

  test("不認識的狀態會被濾掉，不會印出空白列", () => {
    expect(describeMonsterStatuses([{ id: "亂寫" }])).toEqual([]);
  });
});

describe("⚠️ 權威端結算（組隊／地下城／世界王）", () => {
  const inflict = { poison: { chancePct: 100, strength: 5, duration: 3 } };

  test("一整輪的箭一次判定", () => {
    const out = rollInflictForArrows({ arrows: ["X", "10", "5"], inflict, rand: () => 0 });
    expect(out).toHaveLength(1);          // 同種不疊加
    expect(out[0].id).toBe("poison");
  });

  test("整輪都射不準就不會有任何異常", () => {
    expect(rollInflictForArrows({ arrows: ["5", "6", "M"], inflict, rand: () => 0 })).toEqual([]);
  });

  test("吃得下 { label } 物件（房間文件存的是這個形狀）", () => {
    const out = rollInflictForArrows({ arrows: [{ label: "X" }], inflict, rand: () => 0 });
    expect(out).toHaveLength(1);
  });

  test("多位成員的施加會合併，同種取較強", () => {
    const merged = mergeAllStatuses([], [
      [{ id: "poison", strength: 3, duration: 2 }],
      [{ id: "poison", strength: 8, duration: 1 }],
      [{ id: "burn", strength: 10, duration: 2 }],
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.find(s => s.id === "poison").strength).toBe(8);
  });

  test("空輸入不會炸", () => {
    expect(rollInflictForArrows()).toEqual([]);
    expect(mergeAllStatuses()).toEqual([]);
  });
});
