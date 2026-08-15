import { buildBattleBonusSections } from "./battleBonusViewModel";

test("本場加成整合卡片、異常、專精、能力來源與護盾", () => {
  const sections = buildBattleBonusSections({
    cardFx:{ firstStrikePct:20, openingShieldPct:4, poisonResistPct:30, inflict:{ poison:{ chancePct:45 } } },
    equipSpec:{ weapon:{ trackId:"precision", level:3 } },
    statRows:[{ id:"card", label:"卡片", atk:12, def:8 }],
    shield:40,
  });
  const text = sections.flatMap(section => section.items).map(item => `${item.label}${item.value}`).join("|");
  expect(text).toContain("首回合傷害20%");
  expect(text).toContain("開場護盾4%");
  expect(text).toContain("中毒抗性30%");
  expect(text).toContain("可施加中毒45%");
  expect(text).toContain("武器專精精準 Lv.3");
  expect(text).toContain("目前護盾40");
});
