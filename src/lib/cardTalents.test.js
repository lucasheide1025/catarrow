// src/lib/cardTalents.test.js — 卡片天賦與族系套裝
import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import { getCardTalent, calcFamilySetStatus, calcCardCombatEffects, FAMILY_SET_BONUSES } from "./cardTalents";

const view = monster => ({ monsterId: monster.id, family: monster.family, tier: monster.tier, tierIndex: monster.tierIndex, source: "monster" });

test("252 張卡全部有天賦（零手工映射）", () => {
  for (const monster of EXPANSION_MONSTERS) {
    const talent = getCardTalent(view(monster));
    expect({ id: monster.id, ok: !!(talent && talent.key && talent.value > 0 && talent.text) })
      .toEqual({ id: monster.id, ok: true });
  }
});

test("天賦映射抽查：穿甲怪→穿甲天賦;Tier 放大", () => {
  const pierce = EXPANSION_MONSTERS.find(m => m.id === "ghost_t1_mini_a"); // 導光突進:無視防禦10%
  expect(getCardTalent(view(pierce)).key).toBe("armorPiercePct");
  const t1 = getCardTalent(view(EXPANSION_MONSTERS.find(m => m.id === "ghost_t1_normal_a")));
  const sameKindT6 = EXPANSION_MONSTERS.filter(m => m.tierIndex === 6).map(m => getCardTalent(view(m)));
  expect(sameKindT6.every(t => t.value >= t1.value)).toBe(true); // T6 天賦數值 ≥ T1
});

test("族系套裝 2/4 張觸發與彙總", () => {
  const ghosts = EXPANSION_MONSTERS.filter(m => m.family === "ghost").slice(0, 4).map(view);
  const two = calcFamilySetStatus(ghosts.slice(0, 2));
  expect(two[0]).toMatchObject({ family: "ghost", tier2: true, tier4: false });
  const four = calcCardCombatEffects(ghosts);
  expect(four.statusDurationReduction).toBe(FAMILY_SET_BONUSES.ghost.t2.statusDurationReduction);
  expect(four.statusStrengthReductionPct).toBe(FAMILY_SET_BONUSES.ghost.t4.statusStrengthReductionPct);
});

test("天賦彙總有 cap;世界王卡不參與", () => {
  const pierceCards = EXPANSION_MONSTERS
    .filter(m => (m.signatureSummary || "").includes("無視防禦")).slice(0, 12).map(view);
  const total = calcCardCombatEffects(pierceCards);
  expect(total.armorPiercePct).toBeLessThanOrEqual(10);
  expect(getCardTalent({ source: "wb", tier: "worldboss", monsterId: "wb:x" })).toBeNull();
});
