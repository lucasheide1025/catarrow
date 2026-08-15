import {
  HIGH_QUALITY_SCORE,
  MAX_DAMAGE_REDUCTION_PCT,
  TALENT_CRIT_MULT,
  applyBattleStart,
  applyCompanion,
  applyIncoming,
  applyOutgoing,
  applyRoundEnd,
  applyStatusResist,
  buildCombatModifiers,
  describeModifiers,
  effectiveDefense,
  reflectDamage,
} from "./combatModifiers";

const spec = (slot, trackId, level) => ({ [slot]: { trackId, level } });

describe("彙總", () => {
  test("沒帶任何東西時全部是 0，不會是 NaN", () => {
    const m = buildCombatModifiers();
    // inflict 是物件（能施加哪些異常），其餘一律是數字
    for (const [k, v] of Object.entries(m)) {
      if (k === "inflict") { expect(v).toEqual({}); continue; }
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(m.damagePct).toBe(0);
  });

  test("卡片與專精會合進同一包", () => {
    const m = buildCombatModifiers({
      cardFx: { armorPiercePct: 5, damagePct: 3 },
      equipSpec: spec("weapon", "armorBreak", 4),
    });
    expect(m.defIgnoreCardPct).toBe(5);
    expect(m.defIgnoreSpecPct).toBe(6);      // 4 × 1.5
    expect(m.damagePct).toBe(3);
  });

  test("壞掉的專精資料不會讓整包爆炸", () => {
    const m = buildCombatModifiers({ equipSpec: { weapon: { trackId: "不存在", level: 9 } } });
    expect(m.defIgnoreSpecPct).toBe(0);
  });
});

describe("進場", () => {
  test("營養加最大 HP，護盾照加完之後的 HP 算", () => {
    const m = buildCombatModifiers({
      cardFx: { openingShieldPct: 10 },
      equipSpec: spec("accessory", "nutrition", 10),
    });
    const r = applyBattleStart({ playerMaxHp: 1000, mods: m });
    expect(r.playerMaxHp).toBe(1030);        // +30
    expect(r.shield).toBe(103);
  });

  test("⚠️ 威嚇/破防是常駐壓怪物面板，不是每箭再算一次", () => {
    const m = buildCombatModifiers({ cardFx: { monsterAtkDownPct: 6, monsterDefDownPct: 6 } });
    const r = applyBattleStart({ playerMaxHp: 100, monsterAtk: 100, monsterDef: 100, mods: m });
    expect(r.monsterAtk).toBe(94);
    expect(r.monsterDef).toBe(94);
  });

  test("怪物 ATK 不會被壓到 0（不然完全不會受傷）", () => {
    const m = buildCombatModifiers({ cardFx: { monsterAtkDownPct: 99 } });
    expect(applyBattleStart({ monsterAtk: 1, mods: m }).monsterAtk).toBeGreaterThanOrEqual(1);
  });
});

describe("有效防禦", () => {
  test("⚠️ 破甲與穿甲相乘，不是相加——相加的話兩個點滿防禦直接歸零", () => {
    const m = buildCombatModifiers({
      cardFx: { armorPiercePct: 10 },
      equipSpec: spec("weapon", "armorBreak", 10),   // 15%
    });
    // 相加會是 100 × (1 - 0.25) = 75；相乘是 100 × 0.85 × 0.9 = 76.5
    expect(effectiveDefense(100, m)).toBeCloseTo(76.5, 1);
  });

  test("永遠不會變成負的", () => {
    const m = buildCombatModifiers({ cardFx: { armorPiercePct: 999 } });
    expect(effectiveDefense(100, m)).toBeGreaterThanOrEqual(0);
  });
});

describe("出手", () => {
  const flat = () => buildCombatModifiers({ cardFx: { damagePct: 10 } });

  test("傷害加成有效", () => {
    expect(applyOutgoing({ baseDamage: 100, score: 5, mods: flat() }).damage).toBe(110);
  });

  test("高品質命中才吃精準與精研", () => {
    const m = buildCombatModifiers({
      cardFx: { hqDamagePct: 10 }, equipSpec: spec("weapon", "precision", 5),  // 10%
    });
    const low = applyOutgoing({ baseDamage: 100, score: 5, mods: m }).damage;
    const high = applyOutgoing({ baseDamage: 100, score: HIGH_QUALITY_SCORE, mods: m }).damage;
    expect(low).toBe(100);
    expect(high).toBe(121);        // 100 × 1.1 × 1.1
  });

  test("X 也算高品質", () => {
    const m = buildCombatModifiers({ cardFx: { hqDamagePct: 10 } });
    expect(applyOutgoing({ baseDamage: 100, score: "X", mods: m }).highQuality).toBe(true);
  });

  test("對王加成只對王類生效", () => {
    const m = buildCombatModifiers({ cardFx: { bossDamagePct: 10 } });
    expect(applyOutgoing({ baseDamage: 100, score: 5, bossTagged: false, mods: m }).damage).toBe(100);
    expect(applyOutgoing({ baseDamage: 100, score: 5, bossTagged: true, mods: m }).damage).toBe(110);
  });

  test("⚠️ X 不再吃連擊爆擊——不然滿環變成雙重爆擊", () => {
    const m = buildCombatModifiers({ cardFx: { critRatePct: 100 } });
    expect(applyOutgoing({ baseDamage: 100, score: "X", mods: m, rand: () => 0 }).crit).toBe(false);
    const hit = applyOutgoing({ baseDamage: 100, score: 7, mods: m, rand: () => 0 });
    expect(hit.crit).toBe(true);
    expect(hit.damage).toBe(100 * TALENT_CRIT_MULT);
  });

  test("0 傷害不會被加成放大", () => {
    expect(applyOutgoing({ baseDamage: 0, score: 10, mods: flat() }).damage).toBe(0);
  });
});

describe("受擊", () => {
  test("堅韌固定減免", () => {
    const m = buildCombatModifiers({ equipSpec: spec("armor", "tenacity", 10) });
    expect(applyIncoming({ damage: 100, currentHp: 100, maxHp: 100, mods: m }).damage).toBe(90);
  });

  test("⚠️ 守護只在血量低於門檻時才生效", () => {
    const m = buildCombatModifiers({ equipSpec: spec("armor", "guard", 5) });   // 10%
    expect(applyIncoming({ damage: 100, currentHp: 100, maxHp: 100, mods: m }).damage).toBe(100);
    const low = applyIncoming({ damage: 100, currentHp: 30, maxHp: 100, mods: m });
    expect(low.damage).toBe(90);
    expect(low.guardActive).toBe(true);
  });

  test("⚠️ 多來源疊加有上限，玩家不會無敵", () => {
    const m = buildCombatModifiers({
      cardFx: { damageReductionPct: 60 }, equipSpec: spec("armor", "tenacity", 10),
    });
    const r = applyIncoming({ damage: 100, currentHp: 1, maxHp: 100, mods: m });
    expect(r.reductionPct).toBeLessThanOrEqual(MAX_DAMAGE_REDUCTION_PCT);
    expect(r.damage).toBeGreaterThan(0);
  });

  test("⚠️ 不完整 mods（機器人快照缺欄位）不會算出 NaN 傷害", () => {
    const partial = { openingShieldPct: 30, reflectPct: 40, endRoundHeal: 20 };
    const r = applyIncoming({ damage: 100, currentHp: 100, maxHp: 100, mods: partial });
    expect(Number.isFinite(r.damage)).toBe(true);
    expect(r.damage).toBeGreaterThan(0);
  });
});

describe("異常狀態抗性", () => {
  test("免疫專精削強度", () => {
    const m = buildCombatModifiers({ equipSpec: spec("armor", "immunity", 10) });  // 30%
    const s = applyStatusResist({ id: "atkDown", strength: 20, duration: 3 }, m);
    expect(s.strength).toBe(14);
  });

  test("⚠️ 回合最少留 1——削到 0 等於完全免疫", () => {
    const m = buildCombatModifiers({
      equipSpec: spec("armor", "immunity", 10),          // -2 回合
      cardFx: { statusDurationReduction: 5 },
    });
    expect(applyStatusResist({ id: "poison", strength: 5, duration: 2 }, m).duration).toBe(1);
  });

  test("毒抗是額外一層，滿抗＝完全免疫", () => {
    const m = buildCombatModifiers({ cardFx: { poisonResistPct: 100 } });
    expect(applyStatusResist({ id: "poison", strength: 8, duration: 2 }, m).strength).toBe(0);
    // 只擋毒，不擋其他狀態
    expect(applyStatusResist({ id: "atkDown", strength: 8, duration: 2 }, m).strength).toBe(8);
  });

  test("沒有狀態時回 null，不會炸", () => {
    expect(applyStatusResist(null, buildCombatModifiers())).toBeNull();
  });

  test("空白或舊版抗性快照不會把持續時間算成 NaN", () => {
    expect(applyStatusResist({id:"defDown",strength:10,duration:2},{}).duration).toBe(2);
  });
});

describe("回合末與其他", () => {
  test("睡飽與汲取疊加回血", () => {
    const m = buildCombatModifiers({
      cardFx: { endRoundHeal: 10 }, equipSpec: spec("accessory", "wellRested", 5),
    });
    expect(applyRoundEnd({ currentHp: 50, maxHp: 100, mods: m }).healed).toBe(15);
  });

  test("不會回超過最大 HP", () => {
    const m = buildCombatModifiers({ cardFx: { endRoundHeal: 999 } });
    expect(applyRoundEnd({ currentHp: 95, maxHp: 100, mods: m }).hp).toBe(100);
  });

  test("⚠️ 倒下的人不回血——那是後衛系統的事", () => {
    const m = buildCombatModifiers({ cardFx: { endRoundHeal: 20 } });
    expect(applyRoundEnd({ currentHp: 0, maxHp: 100, mods: m, alive: false }).healed).toBe(0);
  });

  test("反彈照受到的傷害算", () => {
    const m = buildCombatModifiers({ cardFx: { reflectPct: 6 } });
    expect(reflectDamage(100, m)).toBe(6);
    expect(reflectDamage(100, buildCombatModifiers())).toBe(0);
  });

  test("支援專精放大貓貓", () => {
    const m = buildCombatModifiers({ equipSpec: spec("accessory", "support", 10) });  // 30%
    const c = applyCompanion({ attack: 100, healing: 100, mods: m });
    expect(c.attack).toBe(130);
    expect(c.healing).toBe(130);
  });
});

describe("UI 說明", () => {
  test("玩家看得到自己帶了什麼——投資有沒有效要看得見", () => {
    const rows = describeModifiers(buildCombatModifiers({
      cardFx: { damagePct: 5, armorPiercePct: 10 },
      equipSpec: spec("weapon", "armorBreak", 10),
    }));
    expect(rows.some(r => r.label === "傷害")).toBe(true);
    expect(rows.find(r => r.label === "無視防禦").text).toMatch(/23|24/);   // 相乘後約 23.5%
  });

  test("什麼都沒帶就沒有列", () => {
    expect(describeModifiers(buildCombatModifiers())).toEqual([]);
  });
});

describe("拆開後的新鍵（2026-08-01）", () => {
  test("⚠️ 蓄勁只在第一回合——有條件才有辨識度", () => {
    const m = buildCombatModifiers({ cardFx: { firstStrikePct: 20 } });
    expect(applyOutgoing({ baseDamage: 100, score: 5, mods: m, round: 1 }).damage).toBe(120);
    expect(applyOutgoing({ baseDamage: 100, score: 5, mods: m, round: 2 }).damage).toBe(100);
  });

  test("⚠️ 終結只在怪物殘血（3 成以下）", () => {
    const m = buildCombatModifiers({ cardFx: { finisherPct: 20 } });
    expect(applyOutgoing({ baseDamage: 100, score: 5, mods: m, monsterHpRatio: 1 }).damage).toBe(100);
    expect(applyOutgoing({ baseDamage: 100, score: 5, mods: m, monsterHpRatio: 0.2 }).damage).toBe(120);
  });

  test("inflict 會被帶進 mods 給戰鬥端用", () => {
    const m = buildCombatModifiers({ cardFx: { inflict: { poison: { chancePct: 12, strength: 3 } } } });
    expect(m.inflict.poison.chancePct).toBe(12);
  });

  test("沒有 inflict 時是空物件，不是 undefined", () => {
    expect(buildCombatModifiers().inflict).toEqual({});
  });
});
